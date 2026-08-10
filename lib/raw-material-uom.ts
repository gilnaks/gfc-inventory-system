/** UOM helpers: BOM quantities are stored in base units; factory/procurement stock uses stock units. */

export type FactoryRequestUom = 'purchase' | 'stock'

/** Unit for factory / production schedule BOM quantities when material is linked to factory. */
export type FactoryBomUom = 'stock' | 'base'

export type RawMaterialUomFields = {
  unit: string
  uom_base_unit?: string | null
  uom_base_per_unit?: number | string | null
  uom_purchase_unit?: string | null
  uom_stock_per_purchase?: number | string | null
  unit_cost?: number
  factory_request_uom?: string | null
  factory_bom_uom?: string | null
  factory_inventory_kind?: string | null
}

export function isFactoryBomUom(value: unknown): value is FactoryBomUom {
  return value === 'stock' || value === 'base'
}

/** BOM display/cost unit for factory-linked materials (default base). */
export function getFactoryBomUom(material: RawMaterialUomFields): FactoryBomUom {
  return isFactoryBomUom(material.factory_bom_uom) ? material.factory_bom_uom : 'base'
}

export function isBomQtyInBase(material: RawMaterialUomFields): boolean {
  return getFactoryBomUom(material) === 'base'
}

export function getBomDisplayUnitLabel(material: RawMaterialUomFields): string {
  return isBomQtyInBase(material) ? getBaseUnitLabel(material) : getStockUnitLabel(material)
}

export function isFactoryRequestUom(value: unknown): value is FactoryRequestUom {
  return value === 'purchase' || value === 'stock'
}

export function stockUnitsPerPurchase(material: RawMaterialUomFields): number {
  return Math.max(1, Math.floor(Number(material.uom_stock_per_purchase) || 1))
}

export function getPurchaseUnitLabel(material: RawMaterialUomFields): string {
  const purchase = material.uom_purchase_unit?.trim()
  if (purchase) return purchase
  return material.unit?.trim() || '—'
}

export function getFactoryRequestUom(material: RawMaterialUomFields): FactoryRequestUom {
  if (!material.factory_inventory_kind) return 'stock'
  return isFactoryRequestUom(material.factory_request_uom)
    ? material.factory_request_uom
    : 'stock'
}

export function getFactoryRequestUnitLabel(material: RawMaterialUomFields): string {
  return getFactoryRequestUom(material) === 'purchase'
    ? getPurchaseUnitLabel(material)
    : getStockUnitLabel(material)
}

/** Fields needed when joining raw_materials on factory_material_requests. */
export const FACTORY_REQUEST_MATERIAL_SELECT =
  'id, material_name, sku, unit, current_stock, brand_id, uom_purchase_unit, uom_stock_per_purchase, factory_request_uom, factory_inventory_kind'

type MaterialWithId = RawMaterialUomFields & {
  id?: string
  material_name?: string
  sku?: string
  brand_id?: string
  current_stock?: number
}

/**
 * Prefer catalog row with factory UOM (joined embed often omits factory_inventory_kind).
 */
export function resolveFactoryRequestMaterial(
  req: { material_id: string; material?: RawMaterialUomFields | null },
  catalog?: MaterialWithId[]
): MaterialWithId | undefined {
  const fromCatalog = catalog?.find((m) => m.id === req.material_id)
  const embedded = req.material
  if (!fromCatalog && !embedded) return undefined

  const merged = {
    ...(embedded ?? {}),
    ...(fromCatalog ?? {}),
    id: req.material_id,
    unit: fromCatalog?.unit ?? embedded?.unit ?? 'pcs',
    factory_inventory_kind:
      fromCatalog?.factory_inventory_kind ?? embedded?.factory_inventory_kind ?? null,
    factory_request_uom:
      fromCatalog?.factory_request_uom ?? embedded?.factory_request_uom ?? null,
  } satisfies MaterialWithId
  return merged
}

function formatQtyDisplay(qty: number): string {
  if (!Number.isFinite(qty)) return '0'
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(2)
}

function formatWholeQtyDisplay(qty: number): string {
  const n = Math.max(0, Math.floor(Number(qty) || 0))
  return n.toLocaleString()
}

/** Stock units → whole purchase units + remainder in stock unit. */
export function splitStockIntoPurchaseAndRemainder(
  stockQty: number,
  material: RawMaterialUomFields
): { wholePurchase: number; remainderStock: number; stockPerPurchase: number } {
  const stock = Math.max(0, Math.floor(Number(stockQty) || 0))
  const per = stockUnitsPerPurchase(material)
  return {
    wholePurchase: Math.floor(stock / per),
    remainderStock: stock % per,
    stockPerPurchase: per,
  }
}

/**
 * Whole purchase units plus remainder in stock unit, e.g. "19 box & 5 bottle".
 * Avoids decimal purchase units when stock does not divide evenly.
 */
export function formatStockAsPurchaseWithRemainder(
  stockQty: number,
  material: RawMaterialUomFields
): string {
  const { wholePurchase, remainderStock, stockPerPurchase } = splitStockIntoPurchaseAndRemainder(
    stockQty,
    material
  )
  const purchaseLabel = getPurchaseUnitLabel(material)
  const stockLabel = getStockUnitLabel(material)

  if (stockPerPurchase <= 1 || purchaseLabel === stockLabel) {
    return `${formatWholeQtyDisplay(stockQty)} ${purchaseLabel}`
  }

  const parts: string[] = []
  if (wholePurchase > 0) {
    parts.push(`${formatWholeQtyDisplay(wholePurchase)} ${purchaseLabel}`)
  }
  if (remainderStock > 0) {
    parts.push(`${formatWholeQtyDisplay(remainderStock)} ${stockLabel}`)
  }
  if (parts.length === 0) return `0 ${purchaseLabel}`
  return parts.join(' & ')
}

/** Total on-hand in stock units for sublines under purchase breakdowns. */
export function formatStockUnitTotal(
  stockQty: number,
  material: RawMaterialUomFields
): string {
  const stock = Math.max(0, Math.floor(Number(stockQty) || 0))
  return `${stock.toLocaleString()} ${getStockUnitLabel(material)}`
}

/** Human-readable request qty for procurement / factory request lists. */
export function formatFactoryRequestQtyDisplay(
  requestQty: number,
  material: RawMaterialUomFields
): { primary: string; stockNote?: string } {
  const q = Math.max(0, Number(requestQty) || 0)
  const unit = getFactoryRequestUnitLabel(material)
  const primary = `${formatQtyDisplay(q)} ${unit}`
  if (getFactoryRequestUom(material) === 'purchase') {
    const stockOut = factoryRequestQtyToStockUnits(q, material)
    return {
      primary,
      stockNote: `${formatQtyDisplay(stockOut)} ${getStockUnitLabel(material)} from inventory`,
    }
  }
  return { primary }
}

/** Warehouse on-hand for procurement lists (whole purchase units + stock remainder). */
export function formatProcurementMaterialStockAvailable(
  material: RawMaterialUomFields & { current_stock?: number }
): string {
  return formatStockAsPurchaseWithRemainder(Number(material.current_stock) || 0, material)
}

/** Confirm dialog when releasing a factory request from procurement. */
export function formatFactoryReleaseConfirmMessage(
  requestQty: number,
  material: RawMaterialUomFields,
  materialName: string
): string {
  const name = materialName || 'material'
  const { primary, stockNote } = formatFactoryRequestQtyDisplay(requestQty, material)
  if (stockNote) {
    return `Release ${primary} of ${name} to factory?\n(${stockNote})`
  }
  const stockOut = factoryRequestQtyToStockUnits(requestQty, material)
  const per = stockUnitsPerPurchase(material)
  const purchaseLabel = getPurchaseUnitLabel(material)
  const stockLabel = getStockUnitLabel(material)
  if (per > 1 || purchaseLabel !== stockLabel) {
    return `Release ${primary} of ${name} to factory?\n(Deducts ${formatStockAsPurchaseWithRemainder(stockOut, material)} from materials inventory)`
  }
  return `Release ${primary} of ${name} to factory?`
}

export function formatFactoryReleaseInsufficientStockMessage(
  requestQty: number,
  material: RawMaterialUomFields & { current_stock?: number }
): string {
  const { primary } = formatFactoryRequestQtyDisplay(requestQty, material)
  const available = formatProcurementMaterialStockAvailable(material)
  return `Insufficient stock. Available: ${available}. Requested: ${primary}.`
}

/** Total required in stock units → factory request line quantity. */
export function stockQtyToFactoryRequestQty(
  stockQty: number,
  material: RawMaterialUomFields
): number {
  const qty = Math.max(0, Number(stockQty) || 0)
  if (qty <= 0) return 0
  if (getFactoryRequestUom(material) === 'purchase') {
    return Math.ceil(qty / stockUnitsPerPurchase(material))
  }
  return Math.ceil(qty)
}

/** Shortfall in stock units → quantity to store on factory_material_requests. */
export function stockShortfallToFactoryRequestQty(
  stockShortfall: number,
  material: RawMaterialUomFields
): number {
  const shortfall = Math.max(0, Number(stockShortfall) || 0)
  if (shortfall <= 0) return 0
  if (getFactoryRequestUom(material) === 'purchase') {
    return Math.ceil(shortfall / stockUnitsPerPurchase(material))
  }
  return Math.ceil(shortfall)
}

/**
 * Request qty from schedule BOM need minus factory floor stock and existing requests.
 * All need/coverage values are in stock units; pending/released are in request UOM on the line.
 */
export function computeFactoryRequestQtyForShortfall(params: {
  requiredStock: number
  floorStock: number
  pendingRequestQty?: number
  releasedRequestQty?: number
  material: RawMaterialUomFields
}): number {
  const required = Math.max(0, Number(params.requiredStock) || 0)
  const floor = Math.max(0, Number(params.floorStock) || 0)
  const pendingStock = factoryRequestQtyToStockUnits(
    params.pendingRequestQty ?? 0,
    params.material
  )
  const releasedStock = factoryRequestQtyToStockUnits(
    params.releasedRequestQty ?? 0,
    params.material
  )
  const covered = floor + pendingStock + releasedStock
  const shortfallStock = Math.max(0, required - covered)
  return stockShortfallToFactoryRequestQty(shortfallStock, params.material)
}

/** Opened floor qty (stock unit) → consumption against a released request line. */
export function openStockQtyToRequestUnits(
  openStockQty: number,
  material: RawMaterialUomFields
): number {
  const qty = Math.max(0, Number(openStockQty) || 0)
  if (qty <= 0) return 0
  if (getFactoryRequestUom(material) === 'purchase') {
    return qty / stockUnitsPerPurchase(material)
  }
  return qty
}

/** Request line qty → stock units deducted from procurement warehouse on release. */
export function factoryRequestQtyToStockUnits(
  requestQty: number,
  material: RawMaterialUomFields
): number {
  const qty = Math.max(0, Number(requestQty) || 0)
  if (qty <= 0) return 0
  if (getFactoryRequestUom(material) === 'purchase') {
    return qty * stockUnitsPerPurchase(material)
  }
  return qty
}
export function baseUnitsPerStockUnit(material: RawMaterialUomFields): number {
  return Math.max(1, Math.floor(Number(material.uom_base_per_unit) || 1))
}

export function getBaseUnitLabel(material: RawMaterialUomFields): string {
  const base = material.uom_base_unit?.trim()
  if (base) return base
  return material.unit?.trim() || '—'
}

export function getStockUnitLabel(material: RawMaterialUomFields): string {
  return material.unit?.trim() || '—'
}

/** BOM line quantity (base) → stock units for factory floor / warehouse stock. */
export function bomBaseQtyToStockUnits(
  baseQty: number,
  material: RawMaterialUomFields
): number {
  const qty = Number(baseQty) || 0
  if (qty <= 0) return 0
  return qty / baseUnitsPerStockUnit(material)
}

export function stockUnitsToBomBaseQty(
  stockQty: number,
  material: RawMaterialUomFields
): number {
  const qty = Number(stockQty) || 0
  if (qty <= 0) return 0
  return qty * baseUnitsPerStockUnit(material)
}

export function stockUnitCost(material: RawMaterialUomFields): number {
  const purchaseCost = Number(material.unit_cost) || 0
  return purchaseCost / stockUnitsPerPurchase(material)
}

export function baseUnitCost(material: RawMaterialUomFields): number {
  return stockUnitCost(material) / baseUnitsPerStockUnit(material)
}

/** Display cost in unit hierarchy panels (purchase / stock / base). */
export function formatUnitHierarchyCost(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return '0.00'
  const abs = Math.abs(amount)
  // Keep enough precision so small per-base costs don't look like zero.
  const digits = abs >= 0.01 ? 2 : abs >= 0.0001 ? 4 : 6
  const factor = 10 ** digits
  const rounded = Math.round(amount * factor) / factor
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  })
}

/** Factory BOM display qty → product BOM base qty (for costing). */
export function bomDisplayQtyToBaseQty(
  displayQty: number,
  material: RawMaterialUomFields
): number {
  if (isBomQtyInBase(material)) return displayQty
  return stockUnitsToBomBaseQty(displayQty, material)
}

/** Product BOM qty (base) → qty in the material's factory BOM display unit. */
export function bomBaseQtyToDisplayQty(
  baseQty: number,
  material: RawMaterialUomFields
): number {
  if (isBomQtyInBase(material)) return baseQty
  return bomBaseQtyToStockUnits(baseQty, material)
}

/** Factory floor / warehouse stock units → factory BOM display qty. */
export function stockQtyToBomDisplayQty(
  stockQty: number,
  material: RawMaterialUomFields
): number {
  if (isBomQtyInBase(material)) return stockUnitsToBomBaseQty(stockQty, material)
  return stockQty
}

/** Factory BOM display qty → stock units (requests, shortfall checks). */
export function bomDisplayQtyToStockQty(
  displayQty: number,
  material: RawMaterialUomFields
): number {
  if (isBomQtyInBase(material)) return bomBaseQtyToStockUnits(displayQty, material)
  return displayQty
}

/** Request line qty (request UOM) → factory BOM display qty. */
export function requestQtyToBomDisplayQty(
  requestQty: number | undefined,
  material: RawMaterialUomFields
): number {
  return stockQtyToBomDisplayQty(factoryRequestQtyToStockUnits(requestQty ?? 0, material), material)
}

/** Material cost per finished product in factory BOM display units. */
export function bomCostPerProductUnit(
  baseQtyPerProduct: number,
  material: RawMaterialUomFields
): number {
  if (baseQtyPerProduct <= 0) return 0
  if (isBomQtyInBase(material)) return baseQtyPerProduct * baseUnitCost(material)
  const stockQty = bomBaseQtyToStockUnits(baseQtyPerProduct, material)
  const purchaseCost = Number(material.unit_cost) || 0
  if (purchaseCost <= 0 || stockQty <= 0) return 0
  const perPurchase = Math.max(1, Math.floor(Number(material.uom_stock_per_purchase) || 1))
  return (purchaseCost / perPurchase) * stockQty
}
