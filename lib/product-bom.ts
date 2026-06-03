import { supabase } from './supabase'
import type { ProductBomItem } from './supabase'
import { bomBaseQtyToStockUnits, bomCostPerProductUnit } from './raw-material-uom'

export type BomQuantityMode = 'unit' | 'batch'

export type ProductBomSettings = {
  quantity_mode: BomQuantityMode
  yield_per_batch?: number | null
}

export function isBomQuantityMode(value: unknown): value is BomQuantityMode {
  return value === 'unit' || value === 'batch'
}

export function parseProductBomSettings(row: {
  bom_quantity_mode?: string | null
  bom_yield_per_batch?: number | string | null
}): ProductBomSettings {
  const quantity_mode = isBomQuantityMode(row.bom_quantity_mode) ? row.bom_quantity_mode : 'unit'
  const rawYield = Number(row.bom_yield_per_batch)
  return {
    quantity_mode,
    yield_per_batch:
      quantity_mode === 'batch' && rawYield > 0 ? rawYield : null,
  }
}

/** BOM line quantity (base unit) required per one finished product unit. */
export function effectiveBomQtyPerProductUnit(
  item: {
    quantity: number
    quantity_mode?: string | null
    yield_per_batch?: number | null
  },
  productSettings?: ProductBomSettings | null
): number {
  const qty = Number(item.quantity) || 0
  if (!qty) return 0
  const mode = productSettings?.quantity_mode ?? item.quantity_mode
  if (mode === 'batch') {
    const yieldPerBatch =
      Number(productSettings?.yield_per_batch ?? item.yield_per_batch) || 0
    return yieldPerBatch > 0 ? qty / yieldPerBatch : qty
  }
  return qty
}

/** BOM line quantity (base unit) required per one production batch. */
export function effectiveBomQtyPerBatch(
  item: {
    quantity: number
    quantity_mode?: string | null
    yield_per_batch?: number | null
  },
  productSettings?: ProductBomSettings | null
): number {
  const qty = Number(item.quantity) || 0
  if (!qty) return 0
  const mode = productSettings?.quantity_mode ?? item.quantity_mode
  if (mode === 'batch') {
    return qty
  }
  return qty * scheduleYieldPerBatch(productSettings)
}

export function lineCostPerProductUnit(
  item: Pick<ProductBomItem, 'quantity' | 'quantity_mode' | 'yield_per_batch' | 'material'>,
  productSettings?: ProductBomSettings | null
): number {
  const mat = item.material
  if (!mat) return 0
  return bomCostPerProductUnit(
    effectiveBomQtyPerProductUnit(item, productSettings),
    mat
  )
}

/** Stock units required per finished product (for factory inventory). */
export function effectiveBomStockQtyPerProductUnit(
  item: Pick<ProductBomItem, 'quantity' | 'quantity_mode' | 'yield_per_batch' | 'material'>,
  productSettings?: ProductBomSettings | null
): number {
  const mat = item.material
  if (!mat) return 0
  return bomBaseQtyToStockUnits(effectiveBomQtyPerProductUnit(item, productSettings), mat)
}

export function bomQtyBasisLabel(mode: BomQuantityMode | string | null | undefined): string {
  return mode === 'batch' ? 'batch' : 'unit'
}

/** Finished units per production batch on the factory schedule (1 when BOM is per-unit). */
export function scheduleYieldPerBatch(settings?: ProductBomSettings | null): number {
  if (!settings || settings.quantity_mode !== 'batch') return 1
  const y = Number(settings.yield_per_batch)
  return y > 0 ? y : 1
}

export async function fetchProductIdsWithBomItems(
  productIds: string[]
): Promise<Set<string>> {
  if (productIds.length === 0) return new Set()

  const { data, error } = await supabase
    .from('product_bom_items')
    .select('product_id')
    .in('product_id', productIds)

  if (error) {
    console.warn('product_bom_items:', error.message)
    return new Set()
  }

  return new Set((data || []).map((row) => row.product_id as string))
}

export async function fetchProductBomSettingsByProductId(
  productIds: string[]
): Promise<Record<string, ProductBomSettings>> {
  if (productIds.length === 0) return {}

  const { data, error } = await supabase
    .from('products')
    .select('id, bom_quantity_mode, bom_yield_per_batch')
    .in('id', productIds)

  if (error) {
    console.warn('products bom settings:', error.message)
    return {}
  }

  const map: Record<string, ProductBomSettings> = {}
  for (const row of data || []) {
    map[row.id as string] = parseProductBomSettings(row)
  }
  return map
}
