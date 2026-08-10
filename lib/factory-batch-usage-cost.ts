import type { RawMaterial } from './supabase'
import { stockUnitsPerPurchase } from './raw-material-uom'

function usageLineStockUnitCost(
  material: RawMaterial,
  movementUnitCost?: number | null
): number {
  const perPurchase = stockUnitsPerPurchase(material)
  const purchaseCost =
    movementUnitCost != null && Number(movementUnitCost) > 0
      ? Number(movementUnitCost)
      : Number(material.unit_cost) || 0
  return purchaseCost / perPurchase
}

/** Sum usage line costs (quantity_used × unit_cost, with material fallback). */
export function sumBatchUsageLineCosts(
  rows: Array<{
    quantity_used: number | string
    unit_cost?: number | string | null
    material?: Partial<RawMaterial> | Partial<RawMaterial>[] | null
  }>
): number {
  let total = 0
  for (const row of rows) {
    const qty = Number(row.quantity_used) || 0
    if (qty <= 0) continue
    let unitCost = Number(row.unit_cost) || 0
    if (unitCost <= 0) {
      const mat = row.material
      const material = (Array.isArray(mat) ? mat[0] : mat) as RawMaterial | null
      if (material) unitCost = usageLineStockUnitCost(material, material.unit_cost)
    }
    total += qty * unitCost
  }
  return Math.round(total * 100) / 100
}
