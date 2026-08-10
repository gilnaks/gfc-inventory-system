import { supabase } from './supabase'
import type { AccountingVoucherSettings, RawMaterial } from './supabase'
import { ensureVoucherSettings } from './accounting-voucher-service'
import { ensureProcurementPostingAccounts, loadAccounts } from './accounting-coa-seed'
import {
  createAndPostJournal,
  findPostedJournal,
  resolveDefaultAccountId,
} from './accounting-journal-service'
import type { DraftJournalLine } from './accounting-journal-service'
import { withPostingErrorLog } from './accounting-posting-errors'
import { stockUnitsPerPurchase } from './raw-material-uom'
import { computeProductUnitCost } from './product-bom'
import { getBooksBrandId, resolveFranchiseBrandId } from './accounting-books-brand'

const SKIP_MATERIAL_REF_TYPES = new Set(['delivery_receipt', 'purchase_order', 'material_transfer', 'factory_request'])

async function requireProcurementSettings(booksBrandId: string): Promise<AccountingVoucherSettings> {
  await ensureProcurementPostingAccounts(booksBrandId)
  return ensureVoucherSettings(booksBrandId)
}

function resolveAccountId(
  settings: AccountingVoucherSettings,
  key: keyof AccountingVoucherSettings,
  accounts: Awaited<ReturnType<typeof loadAccounts>>,
  fallbackCode: string
): string | null {
  return resolveDefaultAccountId(settings, key, accounts, fallbackCode)
}

export function materialStockUnitCost(material: RawMaterial, movementUnitCost?: number | null): number {
  const perPurchase = stockUnitsPerPurchase(material)
  const purchaseCost =
    movementUnitCost != null && Number(movementUnitCost) > 0
      ? Number(movementUnitCost)
      : Number(material.unit_cost) || 0
  return purchaseCost / perPurchase
}

function inventoryVarianceLines(
  invId: string,
  varianceId: string,
  amount: number,
  inventoryIncreases: boolean,
  invMemo: string
): DraftJournalLine[] {
  if (amount <= 0) return []
  if (inventoryIncreases) {
    return [
      { account_id: invId, debit: amount, credit: 0, memo: invMemo },
      { account_id: varianceId, debit: 0, credit: amount, memo: 'Inventory variance' },
    ]
  }
  return [
    { account_id: varianceId, debit: amount, credit: 0, memo: 'Inventory variance' },
    { account_id: invId, debit: 0, credit: amount, memo: invMemo },
  ]
}

function inventoryOpeningStockLines(
  invId: string,
  equityId: string,
  amount: number,
  invMemo: string
): DraftJournalLine[] {
  if (amount <= 0) return []
  return [
    { account_id: invId, debit: amount, credit: 0, memo: invMemo },
    { account_id: equityId, debit: 0, credit: amount, memo: "Owner's equity — opening stock" },
  ]
}

function fixedAssetVarianceLines(
  faId: string,
  varianceId: string,
  amount: number,
  assetIncreases: boolean,
  faMemo: string
): DraftJournalLine[] {
  if (amount <= 0) return []
  if (assetIncreases) {
    return [
      { account_id: faId, debit: amount, credit: 0, memo: faMemo },
      { account_id: varianceId, debit: 0, credit: amount, memo: 'Capitalization / variance' },
    ]
  }
  return [
    { account_id: varianceId, debit: amount, credit: 0, memo: 'Capitalization / variance' },
    { account_id: faId, debit: 0, credit: amount, memo: faMemo },
  ]
}

export async function postMaterialMovementJournal(
  movementId: string,
  brandId: string,
  postedBy: string
): Promise<void> {
  const booksBrandId = await getBooksBrandId()
  return withPostingErrorLog(booksBrandId, 'material_movement', movementId, () =>
    postMaterialMovementJournalBody(movementId, brandId, postedBy, booksBrandId)
  )
}

async function postMaterialMovementJournalBody(
  movementId: string,
  brandId: string,
  postedBy: string,
  booksBrandId: string
): Promise<void> {
  const { data: movement } = await supabase
    .from('material_stock_movements')
    .select(
      `*, material:raw_materials(id, brand_id, material_name, unit_cost, uom_stock_per_purchase)`
    )
    .eq('id', movementId)
    .single()

  if (!movement) return
  if (movement.journal_entry_id) return
  if (movement.reference_type && SKIP_MATERIAL_REF_TYPES.has(movement.reference_type)) return

  const existing = await findPostedJournal(booksBrandId, 'material_movement', movementId)
  if (existing) {
    await linkMovementJournalEntryId(movementId, existing.id)
    return
  }

  const matRaw = movement.material as RawMaterial | RawMaterial[] | null
  const mat = (Array.isArray(matRaw) ? matRaw[0] : matRaw) as RawMaterial | null
  if (!mat) return

  const sourceBrandId = mat.brand_id || brandId
  const franchiseBrandId = resolveFranchiseBrandId(sourceBrandId, booksBrandId)

  const settings = await requireProcurementSettings(booksBrandId)
  const accounts = await loadAccounts(booksBrandId)
  const invId = resolveAccountId(settings, 'default_inventory_account_id', accounts, '1200')

  const qty = Number(movement.quantity) || 0
  if (qty === 0) return

  const unitCost = materialStockUnitCost(mat, movement.unit_cost)
  const amount = Math.abs(qty) * unitCost
  if (amount <= 0) {
    throw new Error(
      `Cannot post material movement: zero cost for ${mat.material_name || 'material'}. Set material unit cost.`
    )
  }

  let inventoryIncreases = false
  if (movement.movement_type === 'in') inventoryIncreases = true
  else if (movement.movement_type === 'out') inventoryIncreases = false
  else if (movement.movement_type === 'adjustment') inventoryIncreases = qty > 0
  else return

  const memo =
    movement.reference_number ||
    movement.notes ||
    `Material ${movement.movement_type} — ${mat.material_name || movementId.slice(0, 8)}`

  const isOpeningStock = movement.reference_type === 'initial_stock'
  let lines: DraftJournalLine[]
  if (isOpeningStock) {
    const equityId =
      accounts.find((a) => a.code === '3000')?.id ||
      accounts.find((a) => a.account_type === 'equity')?.id
    if (!invId || !equityId) {
      throw new Error(
        'Inventory (1200) or Owner\'s Capital (3000) account is not configured. Seed the chart of accounts or add equity account 3000.'
      )
    }
    lines = inventoryOpeningStockLines(invId, equityId, amount, memo)
  } else {
    const varianceId = resolveAccountId(
      settings,
      'default_inventory_variance_account_id',
      accounts,
      '5910'
    )
    if (!invId || !varianceId) {
      throw new Error(
        'Inventory (1200) or inventory variance (5910) account is not configured. Open Accounting → Settings and set both accounts, or ensure those COA codes exist.'
      )
    }
    lines = inventoryVarianceLines(invId, varianceId, amount, inventoryIncreases, memo)
  }

  const entry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId,
    entryDate: movement.movement_date || new Date().toISOString().split('T')[0],
    memo,
    sourceType: 'material_movement',
    sourceId: movementId,
    lines,
    postedBy,
  })

  await linkMovementJournalEntryId(movementId, entry.id)
}

async function linkMovementJournalEntryId(movementId: string, journalEntryId: string): Promise<void> {
  const { error } = await supabase
    .from('material_stock_movements')
    .update({ journal_entry_id: journalEntryId })
    .eq('id', movementId)
  if (error && !error.message.includes('journal_entry_id')) {
    throw error
  }
}

export async function postFixedAssetMovementJournal(
  movementId: string,
  brandId: string,
  postedBy: string
): Promise<void> {
  const booksBrandId = await getBooksBrandId()
  return withPostingErrorLog(booksBrandId, 'fixed_asset_movement', movementId, () =>
    postFixedAssetMovementJournalBody(movementId, brandId, postedBy, booksBrandId)
  )
}

async function postFixedAssetMovementJournalBody(
  movementId: string,
  brandId: string,
  postedBy: string,
  booksBrandId: string
): Promise<void> {
  const { data: movement } = await supabase
    .from('fixed_asset_movements')
    .select(`*, asset:fixed_assets(id, brand_id, asset_name, unit_cost)`)
    .eq('id', movementId)
    .single()

  if (!movement) return
  if (movement.journal_entry_id) return
  if (movement.reference_type === 'purchase_order' || movement.reference_type === 'delivery_receipt') {
    return
  }

  const existing = await findPostedJournal(booksBrandId, 'fixed_asset_movement', movementId)
  if (existing) return

  const asset = movement.asset as { id: string; brand_id: string; asset_name?: string; unit_cost?: number } | null
  if (!asset || asset.brand_id !== brandId) return

  const franchiseBrandId = resolveFranchiseBrandId(asset.brand_id || brandId, booksBrandId)

  const settings = await requireProcurementSettings(booksBrandId)
  const accounts = await loadAccounts(booksBrandId)
  const faId = accounts.find((a) => a.code === '1500')?.id
  const varianceId = resolveAccountId(settings, 'default_inventory_variance_account_id', accounts, '5910')
  if (!faId || !varianceId) {
    throw new Error(
      'Fixed Assets (1500) or inventory variance (5910) account is not configured. Open Accounting → Settings and set inventory variance (5910), or ensure COA codes 1500 and 5910 exist.'
    )
  }

  const qty = Number(movement.quantity) || 0
  if (qty === 0) return

  const unitCost =
    movement.movement_type === 'in' && movement.unit_cost != null && Number(movement.unit_cost) > 0
      ? Number(movement.unit_cost)
      : Number(asset.unit_cost) || 0
  const amount = Math.abs(qty) * unitCost
  if (amount <= 0) {
    throw new Error(
      `Cannot post fixed asset movement: zero cost for ${asset.asset_name || 'asset'}. Set unit cost.`
    )
  }

  let assetIncreases = false
  if (movement.movement_type === 'in') assetIncreases = true
  else if (movement.movement_type === 'out') assetIncreases = false
  else if (movement.movement_type === 'adjustment') assetIncreases = qty > 0
  else return

  const memo =
    movement.reference_number ||
    movement.notes ||
    `Fixed asset ${movement.movement_type} — ${asset.asset_name || movementId.slice(0, 8)}`

  const entry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId,
    entryDate: movement.movement_date || new Date().toISOString().split('T')[0],
    memo,
    sourceType: 'fixed_asset_movement',
    sourceId: movementId,
    lines: fixedAssetVarianceLines(faId, varianceId, amount, assetIncreases, memo),
    postedBy,
  })

  await supabase
    .from('fixed_asset_movements')
    .update({ journal_entry_id: entry.id })
    .eq('id', movementId)
}

export async function postProductCycleCountJournal(
  cycleCountId: string,
  brandId: string,
  postedBy: string
): Promise<void> {
  const booksBrandId = await getBooksBrandId()
  return withPostingErrorLog(booksBrandId, 'product_cycle_count', cycleCountId, () =>
    postProductCycleCountJournalBody(cycleCountId, brandId, postedBy, booksBrandId)
  )
}

async function postProductCycleCountJournalBody(
  cycleCountId: string,
  brandId: string,
  postedBy: string,
  booksBrandId: string
): Promise<void> {
  const { data: header } = await supabase
    .from('product_cycle_counts')
    .select('id, brand_id, count_date, status, journal_entry_id')
    .eq('id', cycleCountId)
    .single()

  if (!header || header.brand_id !== brandId) return
  if (header.journal_entry_id) return
  if (header.status !== 'posted') return

  const existing = await findPostedJournal(booksBrandId, 'product_cycle_count', cycleCountId)
  if (existing) return

  const franchiseBrandId = resolveFranchiseBrandId(header.brand_id || brandId, booksBrandId)

  const { data: lines } = await supabase
    .from('product_cycle_count_lines')
    .select('product_id, system_available, counted_available, product:products(name)')
    .eq('cycle_count_id', cycleCountId)

  let netInventoryValue = 0
  const detailParts: string[] = []

  for (const line of lines || []) {
    if (line.counted_available == null) continue
    const variance = Number(line.counted_available) - Number(line.system_available)
    if (Math.abs(variance) < 0.0001) continue

    const unitCost = await computeProductUnitCost(line.product_id as string)
    if (unitCost <= 0) {
      const label = (line.product as { name?: string } | null)?.name || line.product_id
      throw new Error(
        `Cannot post product cycle count: zero BOM cost for ${label}. Configure product BOM and material costs.`
      )
    }
    netInventoryValue += variance * unitCost
    const label = (line.product as { name?: string } | null)?.name || line.product_id
    detailParts.push(`${label} ${variance > 0 ? '+' : ''}${variance}`)
  }

  if (Math.abs(netInventoryValue) < 0.005) return

  const settings = await requireProcurementSettings(booksBrandId)
  const accounts = await loadAccounts(booksBrandId)
  const invId = resolveAccountId(settings, 'default_inventory_account_id', accounts, '1200')
  const varianceId = resolveAccountId(settings, 'default_inventory_variance_account_id', accounts, '5910')
  if (!invId || !varianceId) {
    throw new Error(
      'Inventory (1200) or inventory variance (5910) account is not configured. Open Accounting → Settings and set both accounts, or ensure those COA codes exist.'
    )
  }

  const amount = Math.abs(netInventoryValue)
  const inventoryIncreases = netInventoryValue > 0
  const memo = `Product cycle count ${header.count_date}${detailParts.length ? ` — ${detailParts.join(', ')}` : ''}`

  const entry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId,
    entryDate: header.count_date || new Date().toISOString().split('T')[0],
    memo,
    sourceType: 'product_cycle_count',
    sourceId: cycleCountId,
    lines: inventoryVarianceLines(invId, varianceId, amount, inventoryIncreases, memo),
    postedBy,
  })

  await supabase
    .from('product_cycle_counts')
    .update({ journal_entry_id: entry.id })
    .eq('id', cycleCountId)
}
