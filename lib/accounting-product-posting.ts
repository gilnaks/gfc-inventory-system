import { supabase } from './supabase'
import { ensureFactoryWipPostingAccounts, ensureProcurementPostingAccounts, loadAccounts } from './accounting-coa-seed'
import {
  createAndPostJournal,
  findPostedJournal,
  resolveDefaultAccountId,
} from './accounting-journal-service'
import type { DraftJournalLine } from './accounting-journal-service'
import { ensureVoucherSettings } from './accounting-voucher-service'
import { withPostingErrorLog } from './accounting-posting-errors'
import { formatProductOpeningStockJournalMemo, formatProductStockAdjustmentJournalMemo } from './journal-description'
import { getBooksBrandId, resolveFranchiseBrandId } from './accounting-books-brand'

export type ProductOpeningStockPostOptions = {
  quantity?: number
  unitCost?: number
  unit?: string | null
  productName?: string | null
}

function finishedGoodsOpeningLines(
  fgId: string,
  equityId: string,
  amount: number,
  memo: string
): DraftJournalLine[] {
  if (amount <= 0) return []
  return [
    { account_id: fgId, debit: amount, credit: 0, memo },
    { account_id: equityId, debit: 0, credit: amount, memo: "Owner's equity — opening stock" },
  ]
}

export async function postProductOpeningStockJournal(
  productId: string,
  brandId: string,
  postedBy: string,
  options?: ProductOpeningStockPostOptions
): Promise<string | null> {
  const booksBrandId = await getBooksBrandId()
  return withPostingErrorLog(booksBrandId, 'product_opening_stock', productId, () =>
    postProductOpeningStockJournalBody(productId, brandId, postedBy, options, booksBrandId)
  )
}

async function postProductOpeningStockJournalBody(
  productId: string,
  brandId: string,
  postedBy: string,
  options: ProductOpeningStockPostOptions | undefined,
  booksBrandId: string
): Promise<string | null> {
  const { data: product, error } = await supabase
    .from('products')
    .select('id, name, brand_id, initial_stock, price, unit')
    .eq('id', productId)
    .maybeSingle()

  if (error) throw error
  if (!product || product.brand_id !== brandId) {
    throw new Error('Product not found for opening stock journal.')
  }

  const qty = Math.max(
    0,
    options?.quantity != null ? Number(options.quantity) : Number(product.initial_stock) || 0
  )
  const unitCost = Math.max(
    0,
    options?.unitCost != null ? Number(options.unitCost) : Number(product.price) || 0
  )
  if (qty <= 0 || unitCost <= 0) {
    throw new Error('Opening stock journal requires initial stock and unit cost greater than zero.')
  }

  const existing = await findPostedJournal(booksBrandId, 'product_opening_stock', productId)
  if (existing) return existing.id

  const amount = Math.round(qty * unitCost * 100) / 100
  if (amount <= 0) {
    throw new Error('Opening stock journal amount must be greater than zero.')
  }

  const franchiseBrandId = resolveFranchiseBrandId(brandId, booksBrandId)

  await ensureProcurementPostingAccounts(booksBrandId)
  await ensureFactoryWipPostingAccounts(booksBrandId)
  const settings = await ensureVoucherSettings(booksBrandId)
  const accounts = await loadAccounts(booksBrandId)

  const fgId = resolveDefaultAccountId(
    settings,
    'default_finished_goods_inventory_account_id',
    accounts,
    '1220'
  )
  const equityId =
    accounts.find((a) => a.code === '3000')?.id ||
    accounts.find((a) => a.account_type === 'equity')?.id

  if (!fgId || !equityId) {
    throw new Error(
      "Finished goods (1220) or Owner's Capital (3000) account is not configured. Seed the chart of accounts first."
    )
  }

  const productName =
    options?.productName?.trim() || (product.name as string)?.trim() || 'Product'
  const unit = options?.unit?.trim() || (product.unit as string | null)?.trim() || null
  const memo = formatProductOpeningStockJournalMemo(productName, qty, unit, unitCost)

  const entry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId,
    entryDate: new Date().toISOString().split('T')[0],
    memo,
    sourceType: 'product_opening_stock',
    sourceId: productId,
    lines: finishedGoodsOpeningLines(fgId, equityId, amount, memo),
    postedBy,
    createdBy: postedBy,
  })

  return entry.id
}

/** Post finished-goods opening stock journal and surface failures without blocking product save. */
export async function postProductOpeningStockJournalWithNotice(
  productId: string,
  brandId: string,
  postedBy: string,
  options?: ProductOpeningStockPostOptions
): Promise<void> {
  try {
    const entryId = await postProductOpeningStockJournal(productId, brandId, postedBy, options)
    if (!entryId) {
      throw new Error('Opening stock journal was not posted.')
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Accounting journal could not be posted.'
    console.error('Product opening stock journal failed:', e)
    const label = options?.productName?.trim() || 'product'
    alert(
      `${label} was saved, but the opening stock journal failed:\n${msg}\n\nRetry from Accounting → Posting errors.`
    )
  }
}

function finishedGoodsVarianceLines(
  fgId: string,
  varianceId: string,
  amount: number,
  inventoryIncreases: boolean,
  memo: string
): DraftJournalLine[] {
  if (amount <= 0) return []
  if (inventoryIncreases) {
    return [
      { account_id: fgId, debit: amount, credit: 0, memo },
      { account_id: varianceId, debit: 0, credit: amount, memo: 'Inventory variance' },
    ]
  }
  return [
    { account_id: varianceId, debit: amount, credit: 0, memo: 'Inventory variance' },
    { account_id: fgId, debit: 0, credit: amount, memo },
  ]
}

export async function postProductStockAdjustmentJournal(
  adjustmentId: string,
  brandId: string,
  postedBy: string
): Promise<string | null> {
  const booksBrandId = await getBooksBrandId()
  return withPostingErrorLog(booksBrandId, 'product_stock_adjustment', adjustmentId, () =>
    postProductStockAdjustmentJournalBody(adjustmentId, brandId, postedBy, booksBrandId)
  )
}

async function postProductStockAdjustmentJournalBody(
  adjustmentId: string,
  brandId: string,
  postedBy: string,
  booksBrandId: string
): Promise<string | null> {
  const { data: adjustment, error } = await supabase
    .from('product_stock_adjustments')
    .select(
      'id, brand_id, product_id, quantity_delta, unit_cost, amount, unit, journal_entry_id, product:products(name, brand_id)'
    )
    .eq('id', adjustmentId)
    .maybeSingle()

  if (error) throw error
  if (!adjustment || adjustment.brand_id !== brandId) {
    throw new Error('Stock adjustment not found.')
  }
  if (adjustment.journal_entry_id) return adjustment.journal_entry_id

  const existing = await findPostedJournal(booksBrandId, 'product_stock_adjustment', adjustmentId)
  if (existing) return existing.id

  const delta = Number(adjustment.quantity_delta) || 0
  const unitCost = Number(adjustment.unit_cost) || 0
  const amount = Number(adjustment.amount) || Math.round(Math.abs(delta) * unitCost * 100) / 100
  if (Math.abs(delta) < 0.0001 || amount <= 0 || unitCost <= 0) {
    throw new Error('Stock adjustment requires a non-zero quantity change and unit cost.')
  }

  const productRaw = adjustment.product as
    | { name?: string; brand_id?: string }
    | { name?: string; brand_id?: string }[]
    | null
  const product = Array.isArray(productRaw) ? productRaw[0] : productRaw
  if (!product || product.brand_id !== brandId) {
    throw new Error('Product not found for stock adjustment journal.')
  }

  const franchiseBrandId = resolveFranchiseBrandId(brandId, booksBrandId)

  await ensureProcurementPostingAccounts(booksBrandId)
  await ensureFactoryWipPostingAccounts(booksBrandId)
  const settings = await ensureVoucherSettings(booksBrandId)
  const accounts = await loadAccounts(booksBrandId)

  const fgId = resolveDefaultAccountId(
    settings,
    'default_finished_goods_inventory_account_id',
    accounts,
    '1220'
  )
  const varianceId = resolveDefaultAccountId(
    settings,
    'default_inventory_variance_account_id',
    accounts,
    '5910'
  )

  if (!fgId || !varianceId) {
    throw new Error(
      'Finished goods (1220) or inventory variance (5910) account is not configured. Open Accounting → Settings or seed the chart of accounts.'
    )
  }

  const productName = product.name?.trim() || 'Product'
  const unit = adjustment.unit?.trim() || null
  const memo = formatProductStockAdjustmentJournalMemo(productName, delta, unit, unitCost)
  const inventoryIncreases = delta > 0

  const entry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId,
    entryDate: new Date().toISOString().split('T')[0],
    memo,
    sourceType: 'product_stock_adjustment',
    sourceId: adjustmentId,
    lines: finishedGoodsVarianceLines(fgId, varianceId, amount, inventoryIncreases, memo),
    postedBy,
    createdBy: postedBy,
  })

  await supabase
    .from('product_stock_adjustments')
    .update({ journal_entry_id: entry.id })
    .eq('id', adjustmentId)

  return entry.id
}

/** Post initial-stock edit journal and surface failures without blocking product save. */
export async function postProductStockAdjustmentJournalWithNotice(
  adjustmentId: string,
  brandId: string,
  postedBy: string,
  productName?: string | null
): Promise<void> {
  try {
    const entryId = await postProductStockAdjustmentJournal(adjustmentId, brandId, postedBy)
    if (!entryId) {
      throw new Error('Stock adjustment journal was not posted.')
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Accounting journal could not be posted.'
    console.error('Product stock adjustment journal failed:', e)
    const label = productName?.trim() || 'Product'
    alert(
      `${label} was saved, but the stock adjustment journal failed:\n${msg}\n\nRetry from Accounting → Posting errors.`
    )
  }
}
