import { supabase } from './supabase'
import type { ProductBomItem, RawMaterial } from './supabase'
import { baseUnitCost, bomBaseQtyToStockUnits, bomCostPerProductUnit } from './raw-material-uom'

/** Same material fields as ProductBomModal — keeps order COGS aligned with UI “cost per unit”. */
export const PRODUCT_BOM_COST_SELECT =
  'id, product_id, material_id, quantity, quantity_mode, yield_per_batch, notes, material:raw_materials(id, material_name, sku, unit, uom_base_unit, uom_base_per_unit, current_stock, unit_cost, uom_stock_per_purchase, uom_purchase_unit, factory_bom_uom, factory_inventory_kind, factory_request_uom, brand_id, is_active, linked_product_id)'

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
  const rawYield = Number(row.bom_yield_per_batch)
  if (isBomQuantityMode(row.bom_quantity_mode)) {
    const quantity_mode = row.bom_quantity_mode
    return {
      quantity_mode,
      yield_per_batch:
        quantity_mode === 'batch' && rawYield > 0 ? rawYield : null,
    }
  }
  if (rawYield > 0) {
    return { quantity_mode: 'batch', yield_per_batch: rawYield }
  }
  return { quantity_mode: 'unit', yield_per_batch: null }
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

/** Match ProductBomModal when product-level bom_* columns were never saved. */
export function inferBomSettingsFromItems(items: ProductBomItem[]): ProductBomSettings {
  const first = items[0]
  if (!first) return { quantity_mode: 'unit', yield_per_batch: null }
  const quantity_mode = isBomQuantityMode(first.quantity_mode) ? first.quantity_mode : 'unit'
  return {
    quantity_mode,
    yield_per_batch:
      quantity_mode === 'batch' ? Number(first.yield_per_batch) || null : null,
  }
}

export function resolveProductBomSettings(
  productRow: { bom_quantity_mode?: string | null; bom_yield_per_batch?: number | string | null } | null,
  items: ProductBomItem[]
): ProductBomSettings {
  const fromProduct = productRow ? parseProductBomSettings(productRow) : null
  const fromItems = items.length > 0 ? inferBomSettingsFromItems(items) : null
  const candidates = [fromProduct, fromItems].filter(Boolean) as ProductBomSettings[]
  const batchWithYield = candidates.find(
    (s) => s.quantity_mode === 'batch' && (Number(s.yield_per_batch) || 0) > 0
  )
  if (batchWithYield) return batchWithYield
  return fromProduct ?? fromItems ?? { quantity_mode: 'unit', yield_per_batch: null }
}

export function unitCostPerProductFromBomItems(
  items: ProductBomItem[],
  settings: ProductBomSettings
): number {
  return items.reduce((sum, item) => sum + lineCostPerProductUnit(item, settings), 0)
}

export async function fetchProductBomItemsByProductId(
  productIds: string[]
): Promise<Record<string, ProductBomItem[]>> {
  if (productIds.length === 0) return {}

  const { data, error } = await supabase
    .from('product_bom_items')
    .select(PRODUCT_BOM_COST_SELECT)
    .in('product_id', productIds)
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('product_bom_items:', error.message)
    return {}
  }

  const map: Record<string, ProductBomItem[]> = {}
  for (const row of data || []) {
    const item = row as unknown as ProductBomItem
    const pid = item.product_id
    if (!map[pid]) map[pid] = []
    map[pid].push(item)
  }
  return map
}

export async function fetchProductBomSettingsByProductId(
  productIds: string[],
  itemsByProduct?: Record<string, ProductBomItem[]>
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

  const productRows = new Map((data || []).map((row) => [row.id as string, row]))
  const map: Record<string, ProductBomSettings> = {}
  for (const pid of productIds) {
    const items = itemsByProduct?.[pid] || []
    map[pid] = resolveProductBomSettings(productRows.get(pid) ?? null, items)
  }
  return map
}

/** One stock unit of linked material ≈ one sold product unit (consumables / supplies). */
export function unitCostFromLinkedMaterial(material: RawMaterial | null | undefined): number {
  if (!material) return 0
  return baseUnitCost(material)
}

/** BOM-based unit cost for one finished product (cycle count / COGS). */
export async function computeProductUnitCost(productId: string): Promise<number> {
  const bomByProduct = await fetchProductBomItemsByProductId([productId])
  const items = bomByProduct[productId] || []
  if (items.length === 0) return 0
  const settingsByProduct = await fetchProductBomSettingsByProductId([productId], bomByProduct)
  const settings = settingsByProduct[productId] || { quantity_mode: 'unit' as const, yield_per_batch: null }
  return unitCostPerProductFromBomItems(items, settings)
}
