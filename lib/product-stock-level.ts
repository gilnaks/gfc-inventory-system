export type ProductStockFields = {
  initial_stock?: number
  production?: number
  released?: number
  reserved?: number
  minimum_stock?: number
}

export type StockLevel = 'critical' | 'low' | 'ok'

export function computeProductFinalStock(product: ProductStockFields): number {
  return (
    (product.initial_stock || 0) +
    (product.production || 0) -
    (product.released || 0)
  )
}

export function computeProductAvailableStock(product: ProductStockFields): number {
  return computeProductFinalStock(product) - (product.reserved || 0)
}

/** Red band upper bound: 0 through 25% of minimum (inclusive). */
export function getMinimumStockRedMax(minimumStock: number): number {
  if (minimumStock <= 0) return 0
  return Math.floor(minimumStock * 0.25)
}

/** Green band lower bound: minimum minus 25% tolerance (inclusive). */
export function getMinimumStockGreenMin(minimumStock: number): number {
  if (minimumStock <= 0) return 1
  return Math.ceil(minimumStock * 0.75)
}

/** Critical (red) = from 0 up through 25% of minimum. */
export function isAvailableCritical(available: number, minimumStock: number): boolean {
  if (minimumStock <= 0) return available <= 0
  return available <= getMinimumStockRedMax(minimumStock)
}

/**
 * Stock level bands (when minimum > 0):
 * - critical (red): 0 → 25% of min
 * - low (orange): between red and green (~50% band: 25%–75% of min)
 * - ok (green): at or above 75% of min (includes full min and above)
 */
export function getProductStockLevel(available: number, minimumStock: number): StockLevel {
  if (minimumStock <= 0) {
    return available <= 0 ? 'critical' : 'ok'
  }
  if (available <= getMinimumStockRedMax(minimumStock)) return 'critical'
  if (available >= getMinimumStockGreenMin(minimumStock)) return 'ok'
  return 'low'
}

export function getStockLevelSortRank(level: StockLevel): number {
  return level === 'critical' ? 0 : level === 'low' ? 1 : 2
}

export function compareProductsByStockLevel<
  T extends ProductStockFields & { name?: string | null },
>(a: T, b: T): number {
  const availA = computeProductAvailableStock(a)
  const availB = computeProductAvailableStock(b)
  const rankA = getStockLevelSortRank(
    getProductStockLevel(availA, a.minimum_stock ?? 0)
  )
  const rankB = getStockLevelSortRank(
    getProductStockLevel(availB, b.minimum_stock ?? 0)
  )
  if (rankA !== rankB) return rankA - rankB
  return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
}

export function getStockLevelTextClass(level: StockLevel): string {
  switch (level) {
    case 'critical':
      return 'text-red-600 font-bold'
    case 'low':
      return 'text-orange-600 font-semibold'
    default:
      return 'text-emerald-600 font-semibold'
  }
}

export function getStockLevelRowClass(level: StockLevel, selected: boolean): string {
  const base =
    level === 'critical'
      ? 'hover:bg-red-50'
      : level === 'low'
        ? 'hover:bg-orange-50'
        : 'hover:bg-emerald-50'
  return selected ? `${base} bg-slate-100` : base
}

export function getAvailableStockTextClass(available: number, minimumStock: number): string {
  return getStockLevelTextClass(getProductStockLevel(available, minimumStock))
}

export function formatAvailableForDisplay(available: number, minimumStock: number): string {
  const critical = isAvailableCritical(available, minimumStock)
  return `${available}${critical ? '*' : ''}`
}
