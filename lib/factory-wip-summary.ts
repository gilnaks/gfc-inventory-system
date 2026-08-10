import { supabase } from './supabase'
import { factoryRequestQtyToStockUnits } from './raw-material-uom'
import type { RawMaterial } from './supabase'

export type FactoryWipSummary = {
  releasedNotOpenedRequestCount: number
  releasedNotOpenedStockUnits: number
  openOnFloorPackages: number
  openOnFloorRemainingStock: number
  batchUsageStockUnits: number
  batchUsageCost: number
}

export async function fetchFactoryWipSummary(options?: {
  brandId?: string | null
  inventoryKind?: 'ingredients' | 'packaging' | 'supplies'
}): Promise<FactoryWipSummary> {
  let requestsQuery = supabase
    .from('factory_material_requests')
    .select('id, quantity, quantity_used, material_id, material:raw_materials(id, uom_stock_per_purchase, factory_request_uom, uom_purchase_unit, unit)')
    .eq('status', 'released')

  if (options?.brandId) {
    requestsQuery = requestsQuery.eq('brand_id', options.brandId)
  }

  let openedQuery = supabase
    .from('factory_opened_materials')
    .select('id, quantity_remaining, inventory_kind')
    .eq('status', 'open')

  if (options?.inventoryKind) {
    openedQuery = openedQuery.eq('inventory_kind', options.inventoryKind)
  }

  const [{ data: requests }, { data: openRows }, { data: usageRows }] = await Promise.all([
    requestsQuery,
    openedQuery,
    supabase
      .from('factory_batch_material_usage')
      .select('quantity_used, unit_cost'),
  ])

  let releasedNotOpenedRequestCount = 0
  let releasedNotOpenedStockUnits = 0

  for (const req of requests || []) {
    const available = Math.max(0, Number(req.quantity) - Number(req.quantity_used))
    if (available <= 0) continue
    releasedNotOpenedRequestCount++
    const matRaw = req.material as RawMaterial | RawMaterial[] | null
    const mat = (Array.isArray(matRaw) ? matRaw[0] : matRaw) as RawMaterial | null
    releasedNotOpenedStockUnits += mat
      ? factoryRequestQtyToStockUnits(available, mat)
      : available
  }

  let openOnFloorPackages = 0
  let openOnFloorRemainingStock = 0
  for (const row of openRows || []) {
    openOnFloorPackages++
    openOnFloorRemainingStock += Number(row.quantity_remaining) || 0
  }

  let batchUsageStockUnits = 0
  let batchUsageCost = 0
  for (const row of usageRows || []) {
    const qty = Number(row.quantity_used) || 0
    batchUsageStockUnits += qty
    const unitCost = Number(row.unit_cost) || 0
    batchUsageCost += qty * unitCost
  }

  return {
    releasedNotOpenedRequestCount,
    releasedNotOpenedStockUnits: Math.round(releasedNotOpenedStockUnits * 10000) / 10000,
    openOnFloorPackages,
    openOnFloorRemainingStock: Math.round(openOnFloorRemainingStock * 10000) / 10000,
    batchUsageStockUnits: Math.round(batchUsageStockUnits * 10000) / 10000,
    batchUsageCost: Math.round(batchUsageCost * 100) / 100,
  }
}
