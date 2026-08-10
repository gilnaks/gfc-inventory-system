import { supabase } from './supabase'
import type { RawMaterial } from './supabase'
import {
  ensureFactoryWipPostingAccounts,
  ensureProcurementPostingAccounts,
  loadAccounts,
} from './accounting-coa-seed'
import {
  createAndPostJournal,
  findPostedJournal,
  resolveDefaultAccountId,
} from './accounting-journal-service'
import type { DraftJournalLine } from './accounting-journal-service'
import { ensureVoucherSettings } from './accounting-voucher-service'
import {
  extractPostingErrorMessage,
  withPostingErrorLog,
  resolveBySource,
} from './accounting-posting-errors'
import { materialStockUnitCost } from './accounting-procurement-posting'
import {
  formatFactoryMaterialReleaseJournalMemo,
  formatFactoryWipAdjustmentJournalMemo,
} from './journal-description'
import { getFactoryRequestUnitLabel } from './raw-material-uom'
import { sumBatchUsageLineCosts } from './factory-batch-usage-cost'
import { getBooksBrandId, resolveFranchiseBrandId } from './accounting-books-brand'

/** Physical shrink on floor not consumed by batches (stock units). */
export async function computeFactoryPackageShrinkQty(openedMaterialId: string): Promise<number> {
  const { data: opened } = await supabase
    .from('factory_opened_materials')
    .select('quantity_opened, quantity_remaining')
    .eq('id', openedMaterialId)
    .maybeSingle()

  if (!opened) return 0

  const { data: usageRows } = await supabase
    .from('factory_batch_material_usage')
    .select('quantity_used')
    .eq('opened_material_id', openedMaterialId)

  const batchUsed = (usageRows || []).reduce((sum, row) => sum + (Number(row.quantity_used) || 0), 0)
  const openedQty = Number(opened.quantity_opened) || 0
  const remaining = Number(opened.quantity_remaining) || 0
  return Math.max(0, openedQty - remaining - batchUsed)
}

async function sumPostedWipAdjustmentCredits(
  booksBrandId: string,
  openedMaterialId: string
): Promise<number> {
  const { data: entries } = await supabase
    .from('accounting_journal_entries')
    .select('id')
    .eq('brand_id', booksBrandId)
    .eq('source_type', 'factory_wip_adjustment')
    .eq('source_id', openedMaterialId)
    .eq('status', 'posted')

  const entryIds = (entries || []).map((e) => e.id as string)
  if (!entryIds.length) return 0

  const settings = await ensureVoucherSettings(booksBrandId)
  const accounts = await loadAccounts(booksBrandId)
  const wipId = resolveDefaultAccountId(
    settings,
    'default_wip_factory_materials_account_id',
    accounts,
    '1210'
  )
  if (!wipId) return 0

  const { data: lines } = await supabase
    .from('accounting_journal_lines')
    .select('credit')
    .in('journal_entry_id', entryIds)
    .eq('account_id', wipId)

  return (lines || []).reduce((sum, line) => sum + (Number(line.credit) || 0), 0)
}

/** Retry a failed floor shrink journal from Accounting posting errors. */
export async function retryFactoryWipAdjustmentJournal(
  openedMaterialId: string,
  brandId: string,
  postedBy: string
): Promise<string | null> {
  const booksBrandId = await getBooksBrandId()

  const { data: opened } = await supabase
    .from('factory_opened_materials')
    .select(
      'id, label, factory_request_id, material:raw_materials(id, material_name, unit_cost, uom_stock_per_purchase, brand_id)'
    )
    .eq('id', openedMaterialId)
    .maybeSingle()

  if (!opened) throw new Error('Opened factory material package not found')

  const matRaw = opened.material as RawMaterial | RawMaterial[] | null
  const mat = (Array.isArray(matRaw) ? matRaw[0] : matRaw) as RawMaterial | null
  if (!mat) throw new Error('Material not found for opened package')

  const shrinkQty = await computeFactoryPackageShrinkQty(openedMaterialId)
  if (shrinkQty <= 1e-9) {
    const postedCredits = await sumPostedWipAdjustmentCredits(booksBrandId, openedMaterialId)
    if (postedCredits > 0) return null
    throw new Error('No floor shrink quantity to post for this package')
  }

  const unitCost = await resolveFactoryMaterialStockUnitCost(mat, opened.factory_request_id)
  if (unitCost <= 0) {
    throw new Error('Cannot post shrink journal: material unit cost is zero')
  }

  const shrinkAmount = Math.round(shrinkQty * unitCost * 100) / 100
  const postedCredits = await sumPostedWipAdjustmentCredits(booksBrandId, openedMaterialId)
  const unpostedAmount = Math.round((shrinkAmount - postedCredits) * 100) / 100

  if (unpostedAmount <= 0.005) {
    await resolveBySource(booksBrandId, 'factory_wip_adjustment', openedMaterialId)
    return null
  }

  const unpostedQty = Math.round((unpostedAmount / unitCost) * 10000) / 10000
  const matName = mat.material_name || 'material'
  const label = opened.label ? ` (${opened.label})` : ''

  return postFactoryWipAdjustmentJournal(
    openedMaterialId,
    brandId,
    unpostedQty,
    unitCost,
    postedBy,
    `Factory floor shrink (retry) — ${matName}${label}`
  )
}

/** Resolve a failed factory release journal from Accounting posting errors. */
export async function retryFactoryMaterialReleaseJournal(
  sourceId: string,
  brandId: string,
  postedBy: string
): Promise<string> {
  let requestId = sourceId
  let movementId: string | null = null

  const { data: request } = await supabase
    .from('factory_material_requests')
    .select('id')
    .eq('id', sourceId)
    .maybeSingle()

  if (request?.id) {
    const { data: movement } = await supabase
      .from('material_stock_movements')
      .select('id')
      .eq('reference_type', 'factory_request')
      .eq('reference_id', request.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    movementId = (movement?.id as string) ?? null
  } else {
    const { data: movement } = await supabase
      .from('material_stock_movements')
      .select('id, reference_id')
      .eq('id', sourceId)
      .maybeSingle()
    if (movement?.id && movement.reference_id) {
      movementId = movement.id as string
      requestId = movement.reference_id as string
    }
  }

  if (!movementId) {
    throw new Error('Factory release stock movement not found for this request')
  }

  const journalId = await postFactoryMaterialReleaseJournal(
    requestId,
    movementId,
    brandId,
    postedBy
  )
  if (!journalId) {
    throw new Error(
      'Factory release journal was not posted. Check WIP (1210) and inventory (1200) accounts, material unit cost, and accounting period.'
    )
  }
  return journalId
}

async function linkRequestJournalEntryId(requestId: string, journalEntryId: string): Promise<void> {
  await supabase
    .from('factory_material_requests')
    .update({ journal_entry_id: journalEntryId })
    .eq('id', requestId)
}

async function linkMovementJournalEntryId(movementId: string, journalEntryId: string): Promise<void> {
  const { error } = await supabase
    .from('material_stock_movements')
    .update({ journal_entry_id: journalEntryId })
    .eq('id', movementId)
  if (error && !error.message.includes('journal_entry_id')) throw error
}

/** Resolve stock-unit cost from release movement for a factory request, or material default. */
export async function resolveFactoryMaterialStockUnitCost(
  material: RawMaterial,
  factoryRequestId?: string | null
): Promise<number> {
  if (factoryRequestId) {
    const { data: movement } = await supabase
      .from('material_stock_movements')
      .select('unit_cost')
      .eq('reference_type', 'factory_request')
      .eq('reference_id', factoryRequestId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (movement) {
      const cost = materialStockUnitCost(material, movement.unit_cost)
      if (cost > 0) return cost
    }
  }
  return materialStockUnitCost(material, material.unit_cost)
}

export async function postFactoryMaterialReleaseJournal(
  requestId: string,
  movementId: string,
  brandId: string,
  postedBy: string
): Promise<string | null> {
  const booksBrandId = await getBooksBrandId()
  return withPostingErrorLog(booksBrandId, 'factory_material_release', requestId, () =>
    postFactoryMaterialReleaseJournalBody(requestId, movementId, brandId, postedBy, booksBrandId)
  )
}

async function postFactoryMaterialReleaseJournalBody(
  requestId: string,
  movementId: string,
  brandId: string,
  postedBy: string,
  booksBrandId: string
): Promise<string | null> {
  const { data: request, error: requestErr } = await supabase
    .from('factory_material_requests')
    .select('id, material_id, quantity, journal_entry_id, released_at, request_date')
    .eq('id', requestId)
    .maybeSingle()

  if (requestErr) throw requestErr
  if (!request) throw new Error('Factory material request not found')
  if (request.journal_entry_id) return request.journal_entry_id as string

  const existing = await findPostedJournal(booksBrandId, 'factory_material_release', requestId)
  if (existing) {
    await linkRequestJournalEntryId(requestId, existing.id)
    await linkMovementJournalEntryId(movementId, existing.id)
    return existing.id
  }

  const { data: movement, error: movementErr } = await supabase
    .from('material_stock_movements')
    .select(
      `id, quantity, unit_cost, movement_date, reference_number, notes,
       material:raw_materials(id, material_name, unit_cost, uom_stock_per_purchase)`
    )
    .eq('id', movementId)
    .maybeSingle()

  if (movementErr) throw movementErr
  if (!movement) throw new Error('Factory release stock movement not found')

  const matRaw = movement.material as RawMaterial | RawMaterial[] | null
  const mat = (Array.isArray(matRaw) ? matRaw[0] : matRaw) as RawMaterial | null
  if (!mat) throw new Error('Material not found on factory release movement')

  const qty = Math.abs(Number(movement.quantity) || 0)
  if (qty <= 0) return null

  const unitCost = materialStockUnitCost(mat, movement.unit_cost)
  const amount = Math.round(qty * unitCost * 100) / 100
  if (amount <= 0) {
    throw new Error(
      `Cannot post factory release: zero cost for ${mat.material_name || 'material'}. Set material unit cost.`
    )
  }

  // Plant materials / factory release: source is GFC; no franchise tag.
  const franchiseBrandId = resolveFranchiseBrandId(brandId, booksBrandId)

  await ensureProcurementPostingAccounts(booksBrandId)
  await ensureFactoryWipPostingAccounts(booksBrandId)
  const settings = await ensureVoucherSettings(booksBrandId)
  const accounts = await loadAccounts(booksBrandId)
  const invId = resolveDefaultAccountId(settings, 'default_inventory_account_id', accounts, '1200')
  const wipId = resolveDefaultAccountId(
    settings,
    'default_wip_factory_materials_account_id',
    accounts,
    '1210'
  )

  if (!invId || !wipId) {
    throw new Error(
      'Inventory (1200) or WIP — Factory Materials (1210) account is not configured on GFC books.'
    )
  }

  const refLabel = movement.reference_number || `FMR-${requestId.slice(0, 8)}`
  const memo = formatFactoryMaterialReleaseJournalMemo(
    mat.material_name || refLabel,
    request.quantity ?? qty,
    getFactoryRequestUnitLabel(mat)
  )

  const lines: DraftJournalLine[] = [
    { account_id: wipId, debit: amount, credit: 0, memo: 'Transfer to factory WIP' },
    { account_id: invId, debit: 0, credit: amount, memo: 'Warehouse inventory released' },
  ]

  const entryDate =
    (movement.movement_date as string) ||
    (request.released_at ? String(request.released_at).slice(0, 10) : null) ||
    (request.request_date as string) ||
    new Date().toISOString().split('T')[0]

  const entry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId,
    entryDate,
    memo,
    sourceType: 'factory_material_release',
    sourceId: requestId,
    lines,
    postedBy,
    createdBy: postedBy,
  })

  await linkRequestJournalEntryId(requestId, entry.id)
  await linkMovementJournalEntryId(movementId, entry.id)
  return entry.id
}

export async function postFactoryMaterialReleaseJournalWithNotice(
  requestId: string,
  movementId: string,
  brandId: string,
  postedBy: string
): Promise<void> {
  try {
    await postFactoryMaterialReleaseJournal(requestId, movementId, brandId, postedBy)
  } catch (e) {
    const msg = extractPostingErrorMessage(e)
    console.error('Factory material release journal failed:', e)
    alert(
      `Factory release was saved, but the WIP transfer journal failed:\n${msg}\n\nRetry from Accounting → Posting errors.`
    )
  }
}

export async function postFactoryWipAdjustmentJournal(
  openedMaterialId: string,
  brandId: string,
  writtenOffQty: number,
  stockUnitCost: number,
  postedBy: string,
  memoDetail?: string
): Promise<string | null> {
  const booksBrandId = await getBooksBrandId()
  return withPostingErrorLog(booksBrandId, 'factory_wip_adjustment', openedMaterialId, () =>
    postFactoryWipAdjustmentJournalBody(
      openedMaterialId,
      brandId,
      writtenOffQty,
      stockUnitCost,
      postedBy,
      memoDetail,
      booksBrandId
    )
  )
}

async function postFactoryWipAdjustmentJournalBody(
  openedMaterialId: string,
  brandId: string,
  writtenOffQty: number,
  stockUnitCost: number,
  postedBy: string,
  memoDetail: string | undefined,
  booksBrandId: string
): Promise<string | null> {
  if (writtenOffQty <= 0 || stockUnitCost <= 0) return null

  const amount = Math.round(writtenOffQty * stockUnitCost * 100) / 100
  if (amount <= 0) return null

  const { data: opened } = await supabase
    .from('factory_opened_materials')
    .select('id, label, material_id, material:raw_materials(material_name)')
    .eq('id', openedMaterialId)
    .single()

  if (!opened) return null

  // Factory floor shrink: source is GFC; no franchise tag.
  const franchiseBrandId = resolveFranchiseBrandId(brandId, booksBrandId)

  await ensureProcurementPostingAccounts(booksBrandId)
  await ensureFactoryWipPostingAccounts(booksBrandId)
  const settings = await ensureVoucherSettings(booksBrandId)
  const accounts = await loadAccounts(booksBrandId)
  const wipId = resolveDefaultAccountId(
    settings,
    'default_wip_factory_materials_account_id',
    accounts,
    '1210'
  )
  const shrinkageId = resolveDefaultAccountId(
    settings,
    'default_damaged_goods_account_id',
    accounts,
    '5920'
  )

  if (!wipId || !shrinkageId) {
    throw new Error(
      'WIP (1210) or inventory shrinkage (5920) account is not configured on GFC books.'
    )
  }

  const matName =
    (opened.material as { material_name?: string } | null)?.material_name || 'material'
  const memo =
    memoDetail || formatFactoryWipAdjustmentJournalMemo(matName, opened.label)

  const lines: DraftJournalLine[] = [
    { account_id: shrinkageId, debit: amount, credit: 0, memo: 'Factory material shrinkage' },
    { account_id: wipId, debit: 0, credit: amount, memo: 'WIP write-off' },
  ]

  const entry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId,
    entryDate: new Date().toISOString().split('T')[0],
    memo,
    sourceType: 'factory_wip_adjustment',
    sourceId: openedMaterialId,
    lines,
    postedBy,
    createdBy: postedBy,
  })

  await supabase
    .from('factory_opened_materials')
    .update({ journal_entry_id: entry.id })
    .eq('id', openedMaterialId)

  return entry.id
}

export async function postFactoryWipAdjustmentJournalWithNotice(
  openedMaterialId: string,
  brandId: string,
  writtenOffQty: number,
  stockUnitCost: number,
  postedBy: string,
  memoDetail?: string
): Promise<void> {
  try {
    await postFactoryWipAdjustmentJournal(
      openedMaterialId,
      brandId,
      writtenOffQty,
      stockUnitCost,
      postedBy,
      memoDetail
    )
  } catch (e) {
    const msg = extractPostingErrorMessage(e)
    console.error('Factory WIP adjustment journal failed:', e)
    alert(
      `Floor stock was updated, but the shrinkage journal failed:\n${msg}\n\nRetry from Accounting → Posting errors.`
    )
  }
}


/** Sum actual material cost from batch usage rows (quantity_used × unit_cost). */
export async function computeBatchActualMaterialCost(batchId: string): Promise<number> {
  const { data: rows } = await supabase
    .from('factory_batch_material_usage')
    .select('quantity_used, unit_cost, material:raw_materials(unit_cost, uom_stock_per_purchase)')
    .eq('batch_id', batchId)

  return sumBatchUsageLineCosts(rows || [])
}
