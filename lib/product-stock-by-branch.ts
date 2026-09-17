import { isFactoryBrand } from './brand-roles'
import { supabase } from './supabase'

export type BranchQty = {
  locationId: string
  locationName: string
  quantity: number
}

export type ProductBranchStock = {
  released: BranchQty[]
  reserved: BranchQty[]
  releasedQty: number
  reservedQty: number
}

export type ProductStockByBranch = {
  byProduct: Record<string, ProductBranchStock>
  releasedTotals: BranchQty[]
  reservedTotals: BranchQty[]
}

const RESERVED_STATUSES = new Set(['pending', 'approved'])
const RELEASED_STATUSES = new Set(['in-transit'])

function emptyResult(): ProductStockByBranch {
  return { byProduct: {}, releasedTotals: [], reservedTotals: [] }
}

function toSortedBranchList(map: Map<string, { locationName: string; quantity: number }>): BranchQty[] {
  return Array.from(map.entries())
    .map(([locationId, row]) => ({
      locationId,
      locationName: row.locationName,
      quantity: row.quantity,
    }))
    .filter((row) => row.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || a.locationName.localeCompare(b.locationName))
}

export function sumBranchQty(rows: BranchQty[] | undefined): number {
  if (!rows?.length) return 0
  return rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)
}

/** Rel/Res for display: live open-order totals, with stored counter only as factory fallback. */
export function liveRelResForProduct(
  stock: ProductStockByBranch,
  productId: string,
  storedReleased: number,
  storedReserved: number,
  useStoredFallback: boolean
): { released: number; reserved: number } {
  const branch = stock.byProduct[productId]
  if (branch) {
    return { released: branch.releasedQty, reserved: branch.reservedQty }
  }
  if (useStoredFallback) {
    return { released: storedReleased || 0, reserved: storedReserved || 0 }
  }
  return { released: 0, reserved: 0 }
}

/**
 * Derive Rel/Res pans per branch from open customer orders for a brand.
 * Reserved: pending + approved. Released: in-transit.
 */
export async function loadProductStockByBranch(brandId: string): Promise<ProductStockByBranch> {
  if (!brandId) return emptyResult()

  const { data, error } = await supabase
    .from('customer_orders')
    .select(
      `
      id,
      status,
      location_id,
      location:locations(id, name),
      order_details(product_id, quantity)
    `
    )
    .eq('brand_id', brandId)
    .in('status', ['pending', 'approved', 'in-transit'])

  if (error) throw error

  const byProductMaps = new Map<
    string,
    {
      released: Map<string, { locationName: string; quantity: number }>
      reserved: Map<string, { locationName: string; quantity: number }>
    }
  >()
  const releasedTotalsMap = new Map<string, { locationName: string; quantity: number }>()
  const reservedTotalsMap = new Map<string, { locationName: string; quantity: number }>()

  const ensureProduct = (productId: string) => {
    let maps = byProductMaps.get(productId)
    if (!maps) {
      maps = {
        released: new Map(),
        reserved: new Map(),
      }
      byProductMaps.set(productId, maps)
    }
    return maps
  }

  const addQty = (
    map: Map<string, { locationName: string; quantity: number }>,
    locationId: string,
    locationName: string,
    qty: number
  ) => {
    const existing = map.get(locationId)
    if (existing) existing.quantity += qty
    else map.set(locationId, { locationName, quantity: qty })
  }

  for (const order of data || []) {
    const status = String(order.status || '')
    const location = order.location as { id?: string; name?: string } | null
    const locationId = String(order.location_id || location?.id || '')
    const locationName = String(location?.name || 'Unknown branch').trim() || 'Unknown branch'
    if (!locationId) continue

    const kind: 'released' | 'reserved' | null = RELEASED_STATUSES.has(status)
      ? 'released'
      : RESERVED_STATUSES.has(status)
        ? 'reserved'
        : null
    if (!kind) continue

    for (const detail of order.order_details || []) {
      const productId = detail.product_id as string | null
      const qty = Math.max(0, Math.floor(Number(detail.quantity) || 0))
      if (!productId || qty <= 0) continue

      const maps = ensureProduct(productId)
      addQty(maps[kind], locationId, locationName, qty)
      addQty(kind === 'released' ? releasedTotalsMap : reservedTotalsMap, locationId, locationName, qty)
    }
  }

  const byProduct: Record<string, ProductBranchStock> = {}
  for (const [productId, maps] of byProductMaps) {
    const released = toSortedBranchList(maps.released)
    const reserved = toSortedBranchList(maps.reserved)
    byProduct[productId] = {
      released,
      reserved,
      releasedQty: sumBranchQty(released),
      reservedQty: sumBranchQty(reserved),
    }
  }

  return {
    byProduct,
    releasedTotals: toSortedBranchList(releasedTotalsMap),
    reservedTotals: toSortedBranchList(reservedTotalsMap),
  }
}

export function formatBranchQtyLines(
  rows: BranchQty[],
  emptyLabel = 'No open orders by branch'
): string {
  if (!rows.length) return emptyLabel
  return rows.map((r) => `${r.locationName}: ${r.quantity.toLocaleString()} pans`).join('\n')
}

/**
 * Set products.released / reserved to open-order sums for a retail brand.
 * Factory brands are skipped so intercompany Rel is not wiped.
 * Returns the same aggregation used for Rel/Res hover.
 */
export async function syncProductRelResFromOpenOrders(
  brandId: string
): Promise<ProductStockByBranch> {
  const stock = await loadProductStockByBranch(brandId)
  if (!brandId) return stock

  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id, slug, brand_role')
    .eq('id', brandId)
    .maybeSingle()
  if (brandError) throw brandError
  if (isFactoryBrand(brand)) return stock

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, released, reserved')
    .eq('brand_id', brandId)
  if (productsError) throw productsError

  const mismatched = (products || []).filter((product) => {
    const live = stock.byProduct[product.id]
    const released = live ? live.releasedQty : 0
    const reserved = live ? live.reservedQty : 0
    return (Number(product.released) || 0) !== released || (Number(product.reserved) || 0) !== reserved
  })

  const now = new Date().toISOString()
  const chunkSize = 8
  for (let i = 0; i < mismatched.length; i += chunkSize) {
    const chunk = mismatched.slice(i, i + chunkSize)
    const results = await Promise.all(
      chunk.map((product) => {
        const live = stock.byProduct[product.id]
        return supabase
          .from('products')
          .update({
            released: live ? live.releasedQty : 0,
            reserved: live ? live.reservedQty : 0,
            updated_at: now,
          })
          .eq('id', product.id)
      })
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) throw failed.error
  }

  return stock
}
