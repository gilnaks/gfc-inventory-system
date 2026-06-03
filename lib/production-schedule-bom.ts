import { supabase } from './supabase'
import type { FactoryScheduleItem } from './factory-schedule'
import {
  isFactoryInventoryKind,
  isMaterialLinkedToFactoryFloor,
  type FactoryInventoryKind,
} from './factory-inventory'
import {
  effectiveBomQtyPerProductUnit,
  fetchProductBomSettingsByProductId,
} from './product-bom'
import {
  bomBaseQtyToDisplayQty,
  bomCostPerProductUnit,
  bomDisplayQtyToStockQty,
  getBomDisplayUnitLabel,
  getFactoryBomUom,
  requestQtyToBomDisplayQty,
  stockQtyToBomDisplayQty,
  type FactoryBomUom,
  type RawMaterialUomFields,
} from './raw-material-uom'

type ScheduleBomMaterial = {
  id: string
  material_name: string
  sku?: string
  unit: string
  uom_base_unit?: string | null
  uom_base_per_unit?: number | null
  uom_purchase_unit?: string | null
  uom_stock_per_purchase?: number | string | null
  factory_request_uom?: string | null
  factory_bom_uom?: string | null
  unit_cost?: number
  current_stock: number
  factory_inventory_kind?: string | null
  is_active?: boolean
}

function scheduleBomMaterial(
  row: { material?: ScheduleBomMaterial | ScheduleBomMaterial[] | null }
): ScheduleBomMaterial | undefined {
  const m = row.material
  if (!m) return undefined
  return Array.isArray(m) ? m[0] : m
}

export type ProductBomLine = {
  material_id: string
  material_name: string
  sku?: string
  unit: string
  /** Qty per finished product in factory BOM display unit. */
  qty_per_unit: number
  /** Product BOM qty per finished product (always base unit). */
  base_qty_per_unit: number
  /** Opened-package quantity remaining on the factory floor (when factoryFloorOnly). */
  current_stock: number
  factory_inventory_kind?: FactoryInventoryKind | null
  uom_purchase_unit?: string | null
  uom_stock_per_purchase?: number | string | null
  factory_request_uom?: string | null
  factory_bom_uom?: FactoryBomUom | null
  unit_cost?: number
  uom_base_unit?: string | null
  uom_base_per_unit?: number | string | null
}

export type ComputedBomLine = ProductBomLine & {
  scheduled_units: number
  actual_yield_units: number
  scheduled_total_qty: number
  total_qty: number
  cost_per_product_unit: number
  total_cost: number
  released_qty?: number
  pending_qty?: number
}

export type ScheduleBomItem = Pick<
  FactoryScheduleItem,
  'product_id' | 'quantity_required' | 'schedule_id' | 'produced'
>

/** Production units for BOM: actual yield = stickers scanned at factory (extras included). */
export function resolveBomProductionUnits(item: {
  quantity_required: number
  produced?: number
}): {
  scheduled_units: number
  actual_yield_units: number
} {
  const scheduled_units = Math.max(0, item.quantity_required)
  const actual_yield_units = Math.max(0, item.produced ?? 0)
  return { scheduled_units, actual_yield_units }
}

export function formatBomCost(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '—'
  return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Total material cost for one schedule row (batch) and cost per scanned unit. */
export function computeSkuMaterialCostSummary(
  lines: Pick<ComputedBomLine, 'total_cost'>[],
  actual_yield_units: number
): { batch_cost: number; cost_per_unit: number | null } {
  const batch_cost = lines.reduce((s, l) => s + (l.total_cost || 0), 0)
  const cost_per_unit =
    actual_yield_units > 0 && batch_cost > 0 ? batch_cost / actual_yield_units : null
  return { batch_cost, cost_per_unit }
}

function displayCostPerProductUnit(
  baseQtyPerProduct: number,
  line: ProductBomLine
): number {
  return bomCostPerProductUnit(baseQtyPerProduct, line)
}

export function formatBomQty(qty: number): string {
  if (!Number.isFinite(qty)) return '0'
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(2)
}

/** Quantity with material BOM unit suffix for tables. */
export function formatBomQtyWithUnit(qty: number, unit?: string | null): string {
  const u = (unit || '').trim()
  if (!Number.isFinite(qty)) return u ? `— ${u}` : '—'
  return u ? `${formatBomQty(qty)} ${u}` : formatBomQty(qty)
}

export async function fetchFactoryFloorStockByMaterial(
  materialIds: string[]
): Promise<Record<string, number>> {
  if (materialIds.length === 0) return {}

  const { data, error } = await supabase
    .from('factory_opened_materials')
    .select('material_id, quantity_remaining')
    .in('material_id', materialIds)
    .eq('status', 'open')

  if (error) {
    console.warn('factory_opened_materials:', error.message)
    return {}
  }

  const totals: Record<string, number> = {}
  for (const row of data || []) {
    const id = row.material_id as string
    totals[id] = (totals[id] || 0) + (Number(row.quantity_remaining) || 0)
  }
  return totals
}

export async function fetchBomLinesByProductId(
  productIds: string[],
  options?: { factoryFloorOnly?: boolean }
): Promise<Record<string, ProductBomLine[]>> {
  if (productIds.length === 0) return {}

  const factoryFloorOnly = options?.factoryFloorOnly ?? false

  const { data, error } = await supabase
    .from('product_bom_items')
    .select(
      'product_id, quantity, quantity_mode, yield_per_batch, material:raw_materials(id, material_name, sku, unit, uom_base_unit, uom_base_per_unit, uom_purchase_unit, uom_stock_per_purchase, factory_request_uom, factory_bom_uom, unit_cost, current_stock, factory_inventory_kind, is_active)'
    )
    .in('product_id', productIds)

  if (error) {
    console.warn('product_bom_items:', error.message)
    return {}
  }

  const productBomSettings = await fetchProductBomSettingsByProductId(productIds)

  const map: Record<string, ProductBomLine[]> = {}
  for (const row of data || []) {
    const mat = scheduleBomMaterial(
      row as { material?: ScheduleBomMaterial | ScheduleBomMaterial[] | null }
    )
    if (!mat?.id || mat.is_active === false) continue
    if (factoryFloorOnly && !isMaterialLinkedToFactoryFloor(mat)) continue

    const pid = row.product_id as string
    const bomSettings = productBomSettings[pid]
    if (!map[pid]) map[pid] = []
    const floorStock = factoryFloorOnly ? 0 : Number(mat.current_stock) || 0
    const baseQtyPerProduct = effectiveBomQtyPerProductUnit(
      {
        quantity: Number(row.quantity) || 0,
        quantity_mode: (row as { quantity_mode?: string }).quantity_mode,
        yield_per_batch: (row as { yield_per_batch?: number | null }).yield_per_batch,
      },
      bomSettings
    )
    map[pid].push({
      material_id: mat.id,
      material_name: mat.material_name || 'Material',
      sku: mat.sku,
      unit: getBomDisplayUnitLabel(mat),
      base_qty_per_unit: baseQtyPerProduct,
      qty_per_unit: bomBaseQtyToDisplayQty(baseQtyPerProduct, mat),
      current_stock: stockQtyToBomDisplayQty(floorStock, mat),
      factory_inventory_kind: isFactoryInventoryKind(mat.factory_inventory_kind)
        ? mat.factory_inventory_kind
        : null,
      uom_purchase_unit: mat.uom_purchase_unit,
      uom_stock_per_purchase: mat.uom_stock_per_purchase,
      factory_request_uom: mat.factory_request_uom,
      factory_bom_uom: getFactoryBomUom(mat),
      unit_cost: Number(mat.unit_cost) || 0,
      uom_base_unit: mat.uom_base_unit,
      uom_base_per_unit: mat.uom_base_per_unit,
    })
  }

  if (factoryFloorOnly) {
    const allMaterialIds = Array.from(
      new Set(Object.values(map).flatMap((lines) => lines.map((l) => l.material_id)))
    )
    const floorStock = await fetchFactoryFloorStockByMaterial(allMaterialIds)
    for (const lines of Object.values(map)) {
      for (const line of lines) {
        line.current_stock = stockQtyToBomDisplayQty(
          floorStock[line.material_id] ?? 0,
          line
        )
      }
    }
  }

  for (const pid of Object.keys(map)) {
    map[pid].sort((a, b) => a.material_name.localeCompare(b.material_name))
  }
  return map
}

function aggregateFactoryRequestQtys(
  rows: Array<{
    material_id: string
    quantity: unknown
    quantity_used?: unknown
    status: string
  }> | null
): { released: Record<string, number>; pending: Record<string, number> } {
  const released: Record<string, number> = {}
  const pending: Record<string, number> = {}
  for (const row of rows || []) {
    const id = row.material_id as string
    const q = Number(row.quantity) || 0
    if (row.status === 'released') {
      const used = Number(row.quantity_used) || 0
      released[id] = (released[id] || 0) + Math.max(0, q - used)
    } else if (row.status === 'pending') {
      pending[id] = (pending[id] || 0) + q
    }
  }
  return { released, pending }
}

/** Pending/released request qtys (request UOM) for a schedule date, optionally scoped to brand. */
export async function fetchFactoryRequestQtysByMaterial(
  scheduleDate: string,
  options?: { brandId?: string }
): Promise<{ released: Record<string, number>; pending: Record<string, number> }> {
  if (!scheduleDate) return { released: {}, pending: {} }

  const select = 'material_id, quantity, quantity_used, status'

  const queryByDate = (useScheduleDate: boolean, useBrand: boolean) => {
    let q = supabase
      .from('factory_material_requests')
      .select(select)
      .in('status', ['pending', 'released'])
    if (useScheduleDate) {
      q = q.eq('schedule_date', scheduleDate)
    } else {
      q = q.eq('request_date', scheduleDate)
    }
    if (useBrand && options?.brandId) {
      q = q.eq('brand_id', options.brandId)
    }
    return q
  }

  let { data, error } = await queryByDate(true, true)

  if (error) {
    const msg = error.message
    if (msg.includes('schedule_date')) {
      const res = await queryByDate(false, !msg.includes('brand_id'))
      if (res.error) {
        console.warn('factory_material_requests:', res.error.message)
        return { released: {}, pending: {} }
      }
      return aggregateFactoryRequestQtys(res.data)
    }
    if (msg.includes('brand_id')) {
      const res = await queryByDate(true, false)
      if (res.error) {
        console.warn('factory_material_requests:', res.error.message)
        return { released: {}, pending: {} }
      }
      return aggregateFactoryRequestQtys(res.data)
    }
    console.warn('factory_material_requests:', msg)
    return { released: {}, pending: {} }
  }

  let result = aggregateFactoryRequestQtys(data)

  // Include legacy rows that only have request_date (no schedule_date) for this brand.
  if (options?.brandId) {
    const { data: legacy, error: legacyErr } = await supabase
      .from('factory_material_requests')
      .select(select)
      .eq('request_date', scheduleDate)
      .eq('brand_id', options.brandId)
      .is('schedule_date', null)
      .in('status', ['pending', 'released'])

    if (!legacyErr && legacy?.length) {
      const extra = aggregateFactoryRequestQtys(legacy)
      for (const [id, q] of Object.entries(extra.released)) {
        result.released[id] = (result.released[id] || 0) + q
      }
      for (const [id, q] of Object.entries(extra.pending)) {
        result.pending[id] = (result.pending[id] || 0) + q
      }
    }
  }

  return result
}

/** Request UOM qty → factory BOM display units for this material. */
export function requestQtyToBomDisplayUnits(
  requestQty: number | undefined,
  line: RawMaterialUomFields
): number {
  return requestQtyToBomDisplayQty(requestQty, line)
}

/** Factory BOM display qty → stock units (e.g. material request shortfall). */
export function bomDisplayQtyToStockForLine(
  displayQty: number,
  line: RawMaterialUomFields
): number {
  return bomDisplayQtyToStockQty(displayQty, line)
}

export function computeLinesForScheduleItem(
  item: ScheduleBomItem,
  bomByProductId: Record<string, ProductBomLine[]>,
  releasedQtyByMaterial: Record<string, number>,
  pendingQtyByMaterial: Record<string, number>
): ComputedBomLine[] {
  const lines = bomByProductId[item.product_id] || []
  const { scheduled_units, actual_yield_units } = resolveBomProductionUnits(item)

  return lines
    .map((line) => {
      const costPerProduct = displayCostPerProductUnit(line.base_qty_per_unit, line)
      const scheduled_total_qty = line.qty_per_unit * scheduled_units
      const total_qty = line.qty_per_unit * actual_yield_units
      const releasedRaw = releasedQtyByMaterial[line.material_id]
      const pendingRaw = pendingQtyByMaterial[line.material_id]
      return {
        ...line,
        scheduled_units,
        actual_yield_units,
        scheduled_total_qty,
        total_qty,
        cost_per_product_unit: costPerProduct,
        total_cost: costPerProduct * actual_yield_units,
        released_qty: requestQtyToBomDisplayUnits(releasedRaw, line),
        pending_qty: requestQtyToBomDisplayUnits(pendingRaw, line),
      }
    })
    .sort((a, b) => a.material_name.localeCompare(b.material_name))
}

export function computeRunningBomTotals(
  scheduleItems: ScheduleBomItem[],
  bomByProductId: Record<string, ProductBomLine[]>,
  releasedQtyByMaterial: Record<string, number>,
  pendingQtyByMaterial: Record<string, number>
): ComputedBomLine[] {
  const totals = new Map<string, ComputedBomLine>()
  for (const item of scheduleItems) {
    for (const line of computeLinesForScheduleItem(
      item,
      bomByProductId,
      releasedQtyByMaterial,
      pendingQtyByMaterial
    )) {
      const existing = totals.get(line.material_id)
      if (existing) {
        existing.scheduled_total_qty += line.scheduled_total_qty
        existing.total_qty += line.total_qty
        existing.total_cost += line.total_cost
      } else {
        totals.set(line.material_id, { ...line })
      }
    }
  }
  return Array.from(totals.values()).sort((a, b) =>
    a.material_name.localeCompare(b.material_name)
  )
}
