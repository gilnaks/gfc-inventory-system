import { supabase, type RawMaterial } from './supabase'
import { FACTORY_BRAND_SLUG } from './brand-roles'
import { postProductionBatchJournalWithNotice } from './accounting-production-posting'
import { resolveFactoryMaterialStockUnitCost, computeBatchActualMaterialCost } from './accounting-factory-wip-posting'
import { computeBatchTheoreticalMaterialCost } from './accounting-production-posting'
import {
  postProductionBatchTransfer,
  reversePostedIntercompanyTransferForBatchRevert,
} from './intercompany-transfer-service'
import { reverseJournalEntry } from './accounting-journal-service'
import {
  countProducedForScheduleItem,
  isScheduleItemScanComplete,
  type FactoryScheduleItem,
} from './factory-schedule'
import { isMaterialLinkedToFactoryFloor } from './factory-inventory'
import {
  effectiveBomStockQtyPerProductUnit,
  fetchProductBomSettingsByProductId,
  isBomQuantityMode,
  type ProductBomSettings,
} from './product-bom'
import { fetchFactoryFloorStockByMaterial } from './production-schedule-bom'
import { getStockUnitLabel } from './raw-material-uom'

export type BatchBomLine = {
  material_id: string
  material_name: string
  unit: string
  qty_per_unit: number
}

export type BatchMaterialShortageReason =
  | 'not_linked_to_factory'
  | 'not_opened'
  | 'insufficient'

export type BatchMaterialShortage = {
  material_id: string
  material_name: string
  unit: string
  required: number
  available: number
  reason: BatchMaterialShortageReason
}

type BatchBomMaterial = {
  id: string
  material_name: string
  sku?: string
  unit: string
  uom_base_unit?: string | null
  uom_base_per_unit?: number | null
  factory_inventory_kind?: string | null
  is_active?: boolean
}

type BatchBomMaterialRow = {
  material?: BatchBomMaterial
}

function batchBomMaterial(
  row: { material?: BatchBomMaterial | BatchBomMaterial[] | null }
): BatchBomMaterial | undefined {
  const m = row.material
  if (!m) return undefined
  return Array.isArray(m) ? m[0] : m
}

function formatQty(qty: number) {
  if (!Number.isFinite(qty)) return '0'
  return Number.isInteger(qty)
    ? String(qty)
    : qty.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function bomQtyPerUnitForBatch(
  row: BatchBomMaterialRow & {
    quantity_mode?: string | null
    yield_per_batch?: number | null
  },
  productSettings?: ProductBomSettings | null
): number {
  const mat = batchBomMaterial(row)
  if (!mat?.id || mat.is_active === false) return 0
  return effectiveBomStockQtyPerProductUnit(
    {
      quantity: Number((row as { quantity?: number }).quantity) || 0,
      quantity_mode: isBomQuantityMode(row.quantity_mode) ? row.quantity_mode : 'unit',
      yield_per_batch: row.yield_per_batch,
      material: mat as RawMaterial,
    },
    productSettings
  )
}

/** Active BOM materials with positive per-unit qty (factory-linked or not). */
export async function fetchBatchMaterialRequirements(
  productId: string
): Promise<
  Array<{
    material_id: string
    material_name: string
    unit: string
    qty_per_unit: number
    factory_linked: boolean
  }>
> {
  const { data, error } = await supabase
    .from('product_bom_items')
    .select(
      'product_id, quantity, quantity_mode, yield_per_batch, material:raw_materials(id, material_name, sku, unit, uom_base_unit, uom_base_per_unit, factory_inventory_kind, is_active)'
    )
    .eq('product_id', productId)

  if (error) {
    console.warn('product_bom_items:', error.message)
    return []
  }

  const settings = await fetchProductBomSettingsByProductId([productId])
  const productSettings = settings[productId]
  const requirements: Array<{
    material_id: string
    material_name: string
    unit: string
    qty_per_unit: number
    factory_linked: boolean
  }> = []

  for (const row of data || []) {
    const typed = row as unknown as BatchBomMaterialRow & {
      quantity?: number
      quantity_mode?: string | null
      yield_per_batch?: number | null
    }
    const mat = batchBomMaterial(typed)
    if (!mat?.id || mat.is_active === false) continue

    const qtyPerUnit = bomQtyPerUnitForBatch({ ...typed, material: mat }, productSettings)
    if (qtyPerUnit <= 0) continue

    requirements.push({
      material_id: mat.id,
      material_name: mat.material_name || 'Material',
      unit: getStockUnitLabel(mat),
      qty_per_unit: qtyPerUnit,
      factory_linked: isMaterialLinkedToFactoryFloor(mat),
    })
  }

  return requirements.sort((a, b) => a.material_name.localeCompare(b.material_name))
}

/** Factory-floor BOM lines for one product (stock units per finished unit). */
export async function fetchBatchBomForProduct(
  productId: string
): Promise<BatchBomLine[]> {
  const requirements = await fetchBatchMaterialRequirements(productId)
  return requirements
    .filter((r) => r.factory_linked)
    .map((r) => ({
      material_id: r.material_id,
      material_name: r.material_name,
      unit: r.unit,
      qty_per_unit: r.qty_per_unit,
    }))
}

/** Material IDs with at least one open floor package (remaining > 0). */
export async function fetchMaterialIdsWithOpenFloorPackages(
  materialIds: string[]
): Promise<Set<string>> {
  if (materialIds.length === 0) return new Set()

  const { data, error } = await supabase
    .from('factory_opened_materials')
    .select('material_id, quantity_remaining')
    .in('material_id', materialIds)
    .eq('status', 'open')

  if (error) {
    console.warn('factory_opened_materials:', error.message)
    return new Set()
  }

  const ids = new Set<string>()
  for (const row of data || []) {
    if ((Number(row.quantity_remaining) || 0) > 0) {
      ids.add(row.material_id as string)
    }
  }
  return ids
}

export function formatBatchMaterialShortageMessage(shortages: BatchMaterialShortage[]): string {
  if (shortages.length === 0) return ''
  const lines = shortages.map((s) => {
    if (s.reason === 'not_linked_to_factory') {
      return `• ${s.material_name}: link to factory inventory (Ingredients / Packaging / Supplies) in Procurement, then open a package on the floor`
    }
    if (s.reason === 'not_opened') {
      return `• ${s.material_name}: open a package on the factory floor first (record under Ingredients / Packaging / Supplies)`
    }
    return `• ${s.material_name}: need ${formatQty(s.required)} ${s.unit}, ${formatQty(s.available)} on floor`
  })
  return lines.join('\n')
}

export async function countBatchUnitsForSchedule(
  scheduleId: string,
  workDate: string
): Promise<number> {
  const { data, error } = await supabase
    .from('factory_production_batches')
    .select('units')
    .eq('schedule_id', scheduleId)
    .eq('work_date', workDate)
    .neq('status', 'cancelled')

  if (error) {
    if (error.message.includes('factory_production_batches')) return 0
    console.warn('factory_production_batches:', error.message)
    return 0
  }

  return (data || []).reduce((sum, row) => sum + (Number(row.units) || 0), 0)
}

/** One production batch run per schedule line per day (cancelled runs can be replaced). */
export async function countBatchRunsForSchedule(
  scheduleId: string,
  workDate: string
): Promise<number> {
  const { data, error } = await supabase
    .from('factory_production_batches')
    .select('id')
    .eq('schedule_id', scheduleId)
    .eq('work_date', workDate)
    .in('status', ['in_progress', 'completed'])

  if (error) {
    if (error.message.includes('factory_production_batches')) return 0
    console.warn('factory_production_batches:', error.message)
    return 0
  }

  return (data || []).length
}

export async function fetchInProgressBatchForSchedule(
  scheduleId: string,
  workDate: string
) {
  const { data, error } = await supabase
    .from('factory_production_batches')
    .select('id, schedule_id, product_id, work_date, batch_number, units, status, started_at, started_by')
    .eq('schedule_id', scheduleId)
    .eq('work_date', workDate)
    .eq('status', 'in_progress')
    .maybeSingle()

  if (error) {
    if (error.message.includes('factory_production_batches')) return null
    throw error
  }
  return data
}

export type FactoryBatchListItem = {
  id: string
  schedule_id: string
  product_id: string
  work_date: string
  batch_number: string
  units: number
  status: 'in_progress' | 'completed' | 'cancelled'
  started_at: string
  started_by: string | null
  completed_at?: string | null
  journal_entry_id?: string | null
  product_name?: string
  sku?: string
  brand_name?: string
}

export type FactoryBatchCostSummary = {
  batchId: string
  actualCost: number
  theoreticalCost: number
  variance: number
  journalEntryId: string | null
}

const FACTORY_BATCH_LIST_SELECT =
  'id, schedule_id, product_id, work_date, batch_number, units, status, started_at, started_by, completed_at, journal_entry_id, product:products(name, sku, brands(name))'

function mapFactoryBatchListRow(row: Record<string, unknown>): FactoryBatchListItem {
  const product = row.product as { name?: string; sku?: string; brands?: { name?: string } } | null
  return {
    id: row.id as string,
    schedule_id: row.schedule_id as string,
    product_id: row.product_id as string,
    work_date: row.work_date as string,
    batch_number: row.batch_number as string,
    units: Number(row.units) || 1,
    status: row.status as FactoryBatchListItem['status'],
    started_at: row.started_at as string,
    started_by: (row.started_by as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    journal_entry_id: (row.journal_entry_id as string | null) ?? null,
    product_name: product?.name,
    sku: product?.sku,
    brand_name: product?.brands?.name,
  }
}

export async function fetchBatchCostSummary(
  batchId: string,
  productId: string,
  units: number
): Promise<FactoryBatchCostSummary> {
  const [actualCost, theoreticalCost, batchRow] = await Promise.all([
    computeBatchActualMaterialCost(batchId),
    computeBatchTheoreticalMaterialCost(productId, units),
    supabase
      .from('factory_production_batches')
      .select('journal_entry_id')
      .eq('id', batchId)
      .maybeSingle(),
  ])

  return {
    batchId,
    actualCost,
    theoreticalCost,
    variance: Math.round((actualCost - theoreticalCost) * 100) / 100,
    journalEntryId: (batchRow.data?.journal_entry_id as string | null) ?? null,
  }
}

export async function fetchBatchCostSummaries(
  batches: Pick<FactoryBatchListItem, 'id' | 'product_id' | 'units'>[]
): Promise<Record<string, FactoryBatchCostSummary>> {
  const out: Record<string, FactoryBatchCostSummary> = {}
  await Promise.all(
    batches.map(async (b) => {
      out[b.id] = await fetchBatchCostSummary(b.id, b.product_id, b.units)
    })
  )
  return out
}

export async function fetchActiveBatchesForDate(workDate: string): Promise<FactoryBatchListItem[]> {
  const { data, error } = await supabase
    .from('factory_production_batches')
    .select(FACTORY_BATCH_LIST_SELECT)
    .eq('work_date', workDate)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: true })

  if (error) {
    if (error.message.includes('factory_production_batches')) return []
    throw error
  }

  return (data || []).map((row) => mapFactoryBatchListRow(row as Record<string, unknown>))
}

/** Schedule line IDs with a batch currently in progress for the work date. */
export async function fetchInProgressScheduleIds(workDate: string): Promise<Set<string>> {
  const batches = await fetchActiveBatchesForDate(workDate)
  return new Set(batches.map((b) => b.schedule_id))
}

export async function hasInProgressBatchForSchedule(
  scheduleId: string,
  workDate: string
): Promise<boolean> {
  return !!(await fetchInProgressBatchForSchedule(scheduleId, workDate))
}

export async function fetchCompletedBatchesForDate(
  workDate: string
): Promise<FactoryBatchListItem[]> {
  const { data, error } = await supabase
    .from('factory_production_batches')
    .select(FACTORY_BATCH_LIST_SELECT)
    .eq('work_date', workDate)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })

  if (error) {
    if (error.message.includes('factory_production_batches')) return []
    throw error
  }

  return (data || []).map((row) => mapFactoryBatchListRow(row as Record<string, unknown>))
}

export async function fetchCompletedBatchesForSchedule(
  scheduleId: string,
  workDate: string
): Promise<FactoryBatchListItem[]> {
  const { data, error } = await supabase
    .from('factory_production_batches')
    .select(FACTORY_BATCH_LIST_SELECT)
    .eq('schedule_id', scheduleId)
    .eq('work_date', workDate)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })

  if (error) {
    if (error.message.includes('factory_production_batches')) return []
    throw error
  }

  return (data || []).map((row) => mapFactoryBatchListRow(row as Record<string, unknown>))
}

export async function fetchBatchesForSchedulesOnDate(
  scheduleIds: string[],
  workDate: string
): Promise<FactoryBatchListItem[]> {
  if (!scheduleIds.length) return []

  const { data, error } = await supabase
    .from('factory_production_batches')
    .select(FACTORY_BATCH_LIST_SELECT)
    .in('schedule_id', scheduleIds)
    .eq('work_date', workDate)
    .in('status', ['in_progress', 'completed'])
    .order('started_at', { ascending: false })

  if (error) {
    if (error.message.includes('factory_production_batches')) return []
    throw error
  }

  return (data || []).map((row) => mapFactoryBatchListRow(row as Record<string, unknown>))
}

export async function revertProductionBatchToInProgress(
  batchId: string,
  options?: { postedBy?: string }
): Promise<{ ok: boolean; message?: string }> {
  const { data: batchRow } = await supabase
    .from('factory_production_batches')
    .select('id, schedule_id, work_date, status, journal_entry_id, intercompany_transfer_id')
    .eq('id', batchId)
    .maybeSingle()

  if (!batchRow || batchRow.status !== 'completed') {
    return { ok: false, message: 'Only completed batches can be reverted to in progress.' }
  }

  const inProgress = await fetchInProgressBatchForSchedule(
    batchRow.schedule_id as string,
    batchRow.work_date as string
  )
  if (inProgress) {
    return {
      ok: false,
      message: 'A batch is already in progress for this schedule line.',
    }
  }

  const postedBy = options?.postedBy?.trim() || 'Factory'

  if (batchRow.journal_entry_id) {
    try {
      await reverseJournalEntry(
        batchRow.journal_entry_id as string,
        postedBy,
        'Production batch reverted to in progress'
      )
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : 'Could not reverse the production journal entry.',
      }
    }
  }

  if (batchRow.intercompany_transfer_id) {
    const transferResult = await reversePostedIntercompanyTransferForBatchRevert(
      batchRow.intercompany_transfer_id as string,
      postedBy
    )
    if (transferResult.ok === false) {
      return { ok: false, message: transferResult.message }
    }
  }

  // Components credit materials inventory on complete — undo that before allowing re-complete.
  const { reverseComponentProductionReceipt } = await import('./factory-components')
  const componentRevert = await reverseComponentProductionReceipt(batchId, postedBy)
  if (componentRevert.ok === false) {
    return { ok: false, message: componentRevert.message }
  }

  const { data, error } = await supabase
    .from('factory_production_batches')
    .update({
      status: 'in_progress',
      completed_at: null,
      journal_entry_id: null,
      intercompany_transfer_id: null,
    })
    .eq('id', batchId)
    .eq('status', 'completed')
    .select('id')

  if (error) {
    return { ok: false, message: error.message }
  }
  if (!data?.length) {
    return { ok: false, message: 'Batch could not be reverted.' }
  }

  return { ok: true }
}

type DeductionLine = {
  material_id: string
  material_name?: string
  quantity: number
  unit: string
}

async function deductFromOpenedPackages(
  lines: DeductionLine[]
): Promise<
  | { ok: true; usage: Array<{ material_id: string; opened_material_id: string; quantity_used: number; unit: string }> }
  | { ok: false; shortages: BatchMaterialShortage[] }
> {
  const materialIds = Array.from(new Set(lines.map((l) => l.material_id)))

  const { data: openRows, error: openErr } = await supabase
    .from('factory_opened_materials')
    .select('id, material_id, quantity_remaining, unit, status')
    .in('material_id', materialIds)
    .eq('status', 'open')
    .order('opened_at', { ascending: true })

  if (openErr) throw openErr

  const packagesByMaterial = new Map<string, typeof openRows>()
  for (const row of openRows || []) {
    const id = row.material_id as string
    if (!packagesByMaterial.has(id)) packagesByMaterial.set(id, [])
    packagesByMaterial.get(id)!.push(row)
  }

  const usage: Array<{
    material_id: string
    opened_material_id: string
    quantity_used: number
    unit: string
  }> = []

  for (const line of lines) {
    let need = line.quantity
    const packages = packagesByMaterial.get(line.material_id) || []
    for (const pkg of packages) {
      if (need <= 1e-9) break
      const remaining = Number(pkg.quantity_remaining) || 0
      if (remaining <= 0) continue
      const take = Math.min(remaining, need)
      const nextRemaining = remaining - take
      const nextStatus = nextRemaining <= 1e-9 ? 'depleted' : 'open'

      const { error: updErr } = await supabase
        .from('factory_opened_materials')
        .update({
          quantity_remaining: nextRemaining,
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pkg.id)

      if (updErr) throw updErr

      pkg.quantity_remaining = nextRemaining
      pkg.status = nextStatus
      need -= take
      usage.push({
        material_id: line.material_id,
        opened_material_id: pkg.id as string,
        quantity_used: take,
        unit: line.unit,
      })
    }

    if (need > 1e-6) {
      return {
        ok: false,
        shortages: [
          {
            material_id: line.material_id,
            material_name: line.material_name || 'Material',
            unit: line.unit,
            required: line.quantity,
            available: Math.max(0, line.quantity - need),
            reason: 'insufficient',
          },
        ],
      }
    }
  }

  return { ok: true, usage }
}

type UsageLine = {
  material_id: string
  opened_material_id: string
  quantity_used: number
  unit: string
}

async function enrichUsageWithUnitCosts(
  usage: UsageLine[]
): Promise<Array<UsageLine & { unit_cost: number }>> {
  if (!usage.length) return []

  const openedIds = usage.map((u) => u.opened_material_id)
  const materialIds = Array.from(new Set(usage.map((u) => u.material_id)))

  const [{ data: openedRows }, { data: materials }] = await Promise.all([
    supabase.from('factory_opened_materials').select('id, factory_request_id').in('id', openedIds),
    supabase
      .from('raw_materials')
      .select('id, material_name, unit_cost, uom_stock_per_purchase')
      .in('id', materialIds),
  ])

  const requestByOpened = new Map(
    (openedRows || []).map((r) => [r.id as string, r.factory_request_id as string | null])
  )
  const matById = new Map((materials || []).map((m) => [m.id as string, m as RawMaterial]))

  const enriched: Array<UsageLine & { unit_cost: number }> = []
  for (const line of usage) {
    const mat = matById.get(line.material_id)
    const requestId = requestByOpened.get(line.opened_material_id)
    const unit_cost = mat ? await resolveFactoryMaterialStockUnitCost(mat, requestId) : 0
    enriched.push({ ...line, unit_cost })
  }
  return enriched
}

export async function checkBatchCanStart(
  item: Pick<FactoryScheduleItem, 'schedule_id' | 'product_id' | 'quantity_required'>,
  workDate: string,
  units = 1
): Promise<{
  ok: boolean
  bomLines: BatchBomLine[]
  shortages: BatchMaterialShortage[]
  unitsRemaining: number
  inProgress: boolean
}> {
  const requirements = await fetchBatchMaterialRequirements(item.product_id)
  const bomLines = requirements
    .filter((r) => r.factory_linked)
    .map((r) => ({
      material_id: r.material_id,
      material_name: r.material_name,
      unit: r.unit,
      qty_per_unit: r.qty_per_unit,
    }))
  const batchRunsUsed = await countBatchRunsForSchedule(item.schedule_id, workDate)
  const unitsRemaining = Math.max(0, 1 - batchRunsUsed)
  const inProgress = !!(await fetchInProgressBatchForSchedule(item.schedule_id, workDate))

  if (inProgress) {
    return { ok: false, bomLines, shortages: [], unitsRemaining, inProgress: true }
  }
  if (units > unitsRemaining) {
    return { ok: false, bomLines, shortages: [], unitsRemaining, inProgress: false }
  }

  const factoryRequirements = requirements.filter((r) => r.factory_linked)
  if (requirements.length === 0) {
    return { ok: units > 0 && units <= unitsRemaining, bomLines, shortages: [], unitsRemaining, inProgress: false }
  }

  const materialIds = factoryRequirements.map((r) => r.material_id)
  const [floorStock, openPackageIds] = await Promise.all([
    fetchFactoryFloorStockByMaterial(materialIds),
    fetchMaterialIdsWithOpenFloorPackages(materialIds),
  ])
  const shortages: BatchMaterialShortage[] = []

  for (const req of requirements) {
    if (!req.factory_linked) {
      shortages.push({
        material_id: req.material_id,
        material_name: req.material_name,
        unit: req.unit,
        required: req.qty_per_unit * units,
        available: 0,
        reason: 'not_linked_to_factory',
      })
      continue
    }

    const required = req.qty_per_unit * units
    const available = floorStock[req.material_id] ?? 0
    const isOpened = openPackageIds.has(req.material_id)

    if (!isOpened) {
      shortages.push({
        material_id: req.material_id,
        material_name: req.material_name,
        unit: req.unit,
        required,
        available: 0,
        reason: 'not_opened',
      })
    } else if (available < required - 1e-9) {
      shortages.push({
        material_id: req.material_id,
        material_name: req.material_name,
        unit: req.unit,
        required,
        available,
        reason: 'insufficient',
      })
    }
  }

  return {
    ok: shortages.length === 0 && units > 0 && units <= unitsRemaining,
    bomLines,
    shortages,
    unitsRemaining,
    inProgress: false,
  }
}

export async function startProductionBatch(options: {
  item: FactoryScheduleItem
  workDate: string
  units?: number
  startedBy: string
}): Promise<{ ok: true; batchId: string } | { ok: false; message: string }> {
  const units = Math.max(1, Math.floor(Number(options.units) || 1))
  const check = await checkBatchCanStart(options.item, options.workDate, units)

  if (check.inProgress) {
    return { ok: false, message: 'A batch is already in progress for this schedule line.' }
  }
  if (units > check.unitsRemaining) {
    return {
      ok: false,
      message: 'A batch has already been run for this schedule line today.',
    }
  }
  if (check.shortages.length) {
    const detail = formatBatchMaterialShortageMessage(check.shortages)
    const heading =
      check.shortages.some((s) => s.reason === 'not_opened' || s.reason === 'not_linked_to_factory')
        ? 'Required materials must be opened on the factory floor first:'
        : 'Not enough materials on the factory floor:'
    return {
      ok: false,
      message: `${heading}\n\n${detail}`,
    }
  }

  const deductionLines: DeductionLine[] = check.bomLines.map((line) => ({
    material_id: line.material_id,
    material_name: line.material_name,
    quantity: line.qty_per_unit * units,
    unit: line.unit,
  }))

  let usage: Array<{
    material_id: string
    opened_material_id: string
    quantity_used: number
    unit: string
  }> = []

  if (deductionLines.length > 0) {
    const deduct = await deductFromOpenedPackages(deductionLines)
    if (deduct.ok === false) {
      const detail = formatBatchMaterialShortageMessage(deduct.shortages)
      return { ok: false, message: `Could not deduct floor stock:\n\n${detail}` }
    }
    usage = deduct.usage
  }

  const { data: batchRow, error: batchErr } = await supabase
    .from('factory_production_batches')
    .insert({
      schedule_id: options.item.schedule_id,
      product_id: options.item.product_id,
      work_date: options.workDate,
      batch_number: options.item.batch_number,
      units,
      status: 'in_progress',
      started_by: options.startedBy,
    })
    .select('id')
    .single()

  if (batchErr) {
    if (batchErr.message.includes('factory_production_batches')) {
      return {
        ok: false,
        message:
          'Run migrations/factory-production-batches.sql in Supabase first.',
      }
    }
    return { ok: false, message: batchErr.message }
  }

  const batchId = batchRow.id as string

  if (usage.length > 0) {
    const enrichedUsage = await enrichUsageWithUnitCosts(usage)
    const { error: usageErr } = await supabase.from('factory_batch_material_usage').insert(
      enrichedUsage.map((u) => ({
        batch_id: batchId,
        opened_material_id: u.opened_material_id,
        material_id: u.material_id,
        quantity_used: u.quantity_used,
        unit: u.unit,
        unit_cost: u.unit_cost > 0 ? u.unit_cost : null,
      }))
    )
    if (usageErr) {
      await supabase.from('factory_production_batches').delete().eq('id', batchId)
      return { ok: false, message: usageErr.message }
    }
  }

  return { ok: true, batchId }
}

async function deductMaterialsToCoverProducedUnits(
  batchId: string,
  productId: string,
  targetUnits: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const units = Math.max(0, Math.floor(Number(targetUnits) || 0))
  if (units <= 0) return { ok: true }

  const bomLines = await fetchBatchBomForProduct(productId)
  if (!bomLines.length) return { ok: true }

  const { data: usageRows, error: usageLoadErr } = await supabase
    .from('factory_batch_material_usage')
    .select('material_id, quantity_used')
    .eq('batch_id', batchId)

  if (usageLoadErr) {
    return { ok: false, message: usageLoadErr.message }
  }

  const usedByMaterial = new Map<string, number>()
  for (const row of usageRows || []) {
    const mid = row.material_id as string
    if (!mid) continue
    usedByMaterial.set(mid, (usedByMaterial.get(mid) || 0) + (Number(row.quantity_used) || 0))
  }

  const deductionLines: DeductionLine[] = []
  for (const line of bomLines) {
    const needed = line.qty_per_unit * units
    const already = usedByMaterial.get(line.material_id) || 0
    const shortfall = needed - already
    if (shortfall > 1e-9) {
      deductionLines.push({
        material_id: line.material_id,
        material_name: line.material_name,
        quantity: shortfall,
        unit: line.unit,
      })
    }
  }

  if (!deductionLines.length) return { ok: true }

  const deduct = await deductFromOpenedPackages(deductionLines)
  if (deduct.ok === false) {
    const detail = formatBatchMaterialShortageMessage(deduct.shortages)
    return {
      ok: false,
      message: `Not enough floor materials for ${units} unit${units === 1 ? '' : 's'}:\n\n${detail}`,
    }
  }

  if (deduct.usage.length > 0) {
    const enrichedUsage = await enrichUsageWithUnitCosts(deduct.usage)
    const { error: usageErr } = await supabase.from('factory_batch_material_usage').insert(
      enrichedUsage.map((u) => ({
        batch_id: batchId,
        opened_material_id: u.opened_material_id,
        material_id: u.material_id,
        quantity_used: u.quantity_used,
        unit: u.unit,
        unit_cost: u.unit_cost > 0 ? u.unit_cost : null,
      }))
    )
    if (usageErr) {
      return { ok: false, message: usageErr.message }
    }
  }

  return { ok: true }
}

export async function completeProductionBatch(
  batchId: string,
  options?: { postedBy?: string }
): Promise<{ ok: boolean; message?: string }> {
  const { data: batchRow } = await supabase
    .from('factory_production_batches')
    .select('id, product_id, schedule_id, work_date, units, status, journal_entry_id, intercompany_transfer_id')
    .eq('id', batchId)
    .maybeSingle()

  if (!batchRow || batchRow.status !== 'in_progress') {
    return { ok: false, message: 'Batch is not in progress or was already finished.' }
  }

  const scheduleItem = {
    schedule_id: batchRow.schedule_id as string,
    product_id: batchRow.product_id as string,
  }
  const workDate = batchRow.work_date as string

  const [{ data: scheduleRow }, producedUnits] = await Promise.all([
    supabase
      .from('production_schedules')
      .select('quantity_required')
      .eq('id', batchRow.schedule_id)
      .maybeSingle(),
    countProducedForScheduleItem(scheduleItem, workDate),
  ])

  const quantityRequired = Number(scheduleRow?.quantity_required) || 0
  const batchUnits = Math.max(1, Number(batchRow.units) || 1)

  if (
    quantityRequired > 0
      ? !isScheduleItemScanComplete({ produced: producedUnits, quantity_required: quantityRequired })
      : producedUnits < batchUnits
  ) {
    const remaining =
      quantityRequired > 0 ? Math.max(0, quantityRequired - producedUnits) : batchUnits - producedUnits
    return {
      ok: false,
      message:
        quantityRequired > 0
          ? `Cannot complete batch — ${producedUnits} of ${quantityRequired} sticker(s) scanned (${remaining} remaining). Finish on the Factory Scan page first.`
          : 'Scan at least one sticker on the Factory Scan page before completing this batch.',
    }
  }

  const finalUnits = producedUnits
  const deductCover = await deductMaterialsToCoverProducedUnits(
    batchId,
    batchRow.product_id as string,
    finalUnits
  )
  if (deductCover.ok === false) {
    return { ok: false, message: deductCover.message }
  }

  const { data, error } = await supabase
    .from('factory_production_batches')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      units: finalUnits,
    })
    .eq('id', batchId)
    .eq('status', 'in_progress')
    .select('id')

  if (error) {
    return { ok: false, message: error.message }
  }
  if (!data?.length) {
    return { ok: false, message: 'Batch is not in progress or was already finished.' }
  }

  await finalizeCompletedProductionBatch(
    batchId,
    { ...batchRow, units: finalUnits },
    options
  )

  return { ok: true }
}

async function finalizeCompletedProductionBatch(
  batchId: string,
  batchRow: {
    journal_entry_id: string | null
    intercompany_transfer_id: string | null
    schedule_id: string
    product_id: string
    work_date: string
    units: number
  },
  options?: { postedBy?: string }
): Promise<void> {
  try {
    const { data: gfcBrand } = await supabase
      .from('brands')
      .select('id')
      .eq('slug', FACTORY_BRAND_SLUG)
      .maybeSingle()

    if (gfcBrand?.id && !batchRow.journal_entry_id) {
      const postedBy = options?.postedBy?.trim() || 'Factory'
      await postProductionBatchJournalWithNotice(batchId, gfcBrand.id as string, postedBy, {
        producedUnits: batchRow.units,
      })
    }

    if (gfcBrand?.id && !batchRow.intercompany_transfer_id) {
      const postedBy = options?.postedBy?.trim() || 'Factory'

      const { data: scheduleRow } = await supabase
        .from('production_schedules')
        .select('id, for_brand_id')
        .eq('id', batchRow.schedule_id)
        .maybeSingle()

      const { data: productRow } = await supabase
        .from('products')
        .select('id, brand_id, price, name')
        .eq('id', batchRow.product_id)
        .maybeSingle()

      const { isFactoryComponentProduct, postComponentProductionReceipt } = await import(
        './factory-components'
      )
      const isComponent = await isFactoryComponentProduct(batchRow.product_id)

      if (isComponent && productRow?.id) {
        // Components land directly in procurement materials inventory — no export step.
        const { computeProductUnitCost } = await import('./product-bom')
        const { syncComponentCostFromBom } = await import('./product-bom-component')
        let unitCost = 0
        try {
          unitCost = await syncComponentCostFromBom(productRow.id as string)
        } catch {
          unitCost = Math.max(
            0,
            (await computeProductUnitCost(productRow.id as string)) ||
              Number(productRow.price) ||
              0
          )
        }
        await postComponentProductionReceipt({
          productId: productRow.id as string,
          quantity: Number(batchRow.units) || 0,
          unitCost,
          batchId,
          createdBy: postedBy,
          brandId: gfcBrand.id as string,
          productName: (productRow.name as string) || undefined,
        })
      } else {
        const toBrandId =
          (scheduleRow?.for_brand_id as string | null) || (productRow?.brand_id as string | null)
        if (toBrandId && productRow?.id) {
          const transfer = await postProductionBatchTransfer({
            factoryBrandId: gfcBrand.id as string,
            toBrandId,
            destProductId: productRow.id as string,
            quantity: Number(batchRow.units) || 0,
            unitCost: Math.max(0, Number(productRow.price) || 0),
            transferDate: batchRow.work_date as string,
            createdBy: postedBy,
            notes: `Auto transfer — ${batchRow.units} unit${batchRow.units === 1 ? '' : 's'} produced`,
          })

          await supabase
            .from('factory_production_batches')
            .update({ intercompany_transfer_id: transfer.id })
            .eq('id', batchId)
        }
      }
    }
  } catch (e) {
    console.error('Production batch finalize failed:', e)
  }
}

export async function cancelProductionBatch(batchId: string): Promise<{ ok: boolean; message?: string }> {
  const { data: usageRows, error: usageErr } = await supabase
    .from('factory_batch_material_usage')
    .select('opened_material_id, material_id, quantity_used, unit')
    .eq('batch_id', batchId)

  if (usageErr) {
    return { ok: false, message: usageErr.message }
  }

  for (const row of usageRows || []) {
    const openedId = row.opened_material_id as string | null
    const qty = Number(row.quantity_used) || 0
    if (!openedId || qty <= 0) continue

    const { data: pkg } = await supabase
      .from('factory_opened_materials')
      .select('id, quantity_remaining, quantity_opened, status')
      .eq('id', openedId)
      .maybeSingle()

    if (!pkg) continue

    const nextRemaining = Math.min(
      Number(pkg.quantity_opened) || 0,
      (Number(pkg.quantity_remaining) || 0) + qty
    )

    await supabase
      .from('factory_opened_materials')
      .update({
        quantity_remaining: nextRemaining,
        status: 'open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', openedId)
  }

  const { data, error } = await supabase
    .from('factory_production_batches')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('id', batchId)
    .eq('status', 'in_progress')
    .select('id')

  if (error) {
    return { ok: false, message: error.message }
  }
  if (!data?.length) {
    return { ok: false, message: 'Batch is not in progress.' }
  }
  return { ok: true }
}
