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
import { fetchBomLinesByProductId } from './production-schedule-bom'
import { bomCostPerProductUnit } from './raw-material-uom'
import { computeBatchActualMaterialCost } from './accounting-factory-wip-posting'
import { formatProductionBatchJournalMemo } from './journal-description'
import { getBooksBrandId, resolveFranchiseBrandId } from './accounting-books-brand'

/** BOM theoretical material cost for a batch (display / variance comparison only). */
export async function computeBatchTheoreticalMaterialCost(
  productId: string,
  units: number
): Promise<number> {
  const bomMap = await fetchBomLinesByProductId([productId])
  const lines = bomMap[productId] || []
  let total = 0
  for (const line of lines) {
    const costPerUnit = bomCostPerProductUnit(line.base_qty_per_unit, line)
    total += costPerUnit * units
  }
  return Math.round(total * 100) / 100
}

/** Scale actual usage cost when material rows only cover part of the produced units. */
export async function scaleProductionBatchJournalAmount(
  productId: string,
  units: number,
  actualCost: number
): Promise<number> {
  if (units <= 1 || actualCost <= 0) return actualCost

  const theoreticalTotal = await computeBatchTheoreticalMaterialCost(productId, units)
  if (theoreticalTotal <= 0) return actualCost

  const avgTheoreticalPerUnit = theoreticalTotal / units
  const estimatedUsageUnits = Math.max(1, Math.round(actualCost / avgTheoreticalPerUnit))
  if (estimatedUsageUnits >= units) return actualCost

  return Math.round(actualCost * (units / estimatedUsageUnits) * 100) / 100
}

async function linkBatchJournalEntryId(batchId: string, journalEntryId: string): Promise<void> {
  await supabase
    .from('factory_production_batches')
    .update({ journal_entry_id: journalEntryId })
    .eq('id', batchId)
}

export async function postProductionBatchJournal(
  batchId: string,
  brandId: string,
  postedBy: string,
  options?: { producedUnits?: number }
): Promise<string | null> {
  const booksBrandId = await getBooksBrandId()
  return withPostingErrorLog(booksBrandId, 'production_batch', batchId, () =>
    postProductionBatchJournalBody(batchId, brandId, postedBy, options, booksBrandId)
  )
}

async function postProductionBatchJournalBody(
  batchId: string,
  brandId: string,
  postedBy: string,
  options: { producedUnits?: number } | undefined,
  booksBrandId: string
): Promise<string | null> {
  const { data: batch } = await supabase
    .from('factory_production_batches')
    .select(
      'id, product_id, units, work_date, batch_number, journal_entry_id, status, schedule_id, product:products(name)'
    )
    .eq('id', batchId)
    .single()

  if (!batch) return null
  if (batch.journal_entry_id) return batch.journal_entry_id as string
  // brandId kept for caller compatibility; books = GFC Main, franchise from schedule.
  void brandId

  const existing = await findPostedJournal(booksBrandId, 'production_batch', batchId)
  if (existing) {
    await linkBatchJournalEntryId(batchId, existing.id)
    return existing.id
  }

  const units = Math.max(
    0,
    Number(options?.producedUnits ?? batch.units) || 0
  )
  if (units <= 0) return null

  let amount = await computeBatchActualMaterialCost(batchId)
  if (amount <= 0) {
    amount = await computeBatchTheoreticalMaterialCost(batch.product_id as string, units)
  } else {
    amount = await scaleProductionBatchJournalAmount(
      batch.product_id as string,
      units,
      amount
    )
  }
  if (amount <= 0) return null

  let forBrandId: string | null = null
  if (batch.schedule_id) {
    const { data: schedule } = await supabase
      .from('production_schedules')
      .select('for_brand_id')
      .eq('id', batch.schedule_id as string)
      .maybeSingle()
    forBrandId = (schedule?.for_brand_id as string | null) || null
  }
  // Factory production is on GFC; tag franchise only when schedule targets a retail brand.
  const franchiseBrandId = resolveFranchiseBrandId(forBrandId, booksBrandId)

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
  const wipId = resolveDefaultAccountId(
    settings,
    'default_wip_factory_materials_account_id',
    accounts,
    '1210'
  )

  if (!fgId || !wipId) {
    throw new Error(
      'Finished goods (1220) or WIP — Factory Materials (1210) account is not configured on GFC books.'
    )
  }

  const productRaw = batch.product as { name?: string } | { name?: string }[] | null
  let productName = (Array.isArray(productRaw) ? productRaw[0]?.name : productRaw?.name)?.trim()
  if (!productName && batch.product_id) {
    const { data: productRow } = await supabase
      .from('products')
      .select('name')
      .eq('id', batch.product_id as string)
      .maybeSingle()
    productName = productRow?.name?.trim() || undefined
  }
  const memo = formatProductionBatchJournalMemo(batch.batch_number as string, productName)

  const lines: DraftJournalLine[] = [
    { account_id: fgId, debit: amount, credit: 0, memo: 'Finished goods — material conversion' },
    { account_id: wipId, debit: 0, credit: amount, memo: 'WIP materials consumed' },
  ]

  const entry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId,
    entryDate: batch.work_date as string,
    memo,
    sourceType: 'production_batch',
    sourceId: batchId,
    lines,
    postedBy,
    createdBy: postedBy,
  })

  await linkBatchJournalEntryId(batchId, entry.id)
  return entry.id
}

/** Post production batch journal and surface failures to the user (batch is already completed). */
export async function postProductionBatchJournalWithNotice(
  batchId: string,
  brandId: string,
  postedBy: string,
  options?: { producedUnits?: number }
): Promise<void> {
  try {
    await postProductionBatchJournal(batchId, brandId, postedBy, options)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Accounting journal could not be posted.'
    console.error('Production batch journal failed:', e)
    alert(
      `Batch was completed, but the production journal failed:\n${msg}\n\nRetry from Accounting → Posting errors.`
    )
  }
}
