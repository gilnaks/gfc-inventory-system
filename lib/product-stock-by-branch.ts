import { supabase } from './supabase'

export type BranchQty = {
  locationId: string
  locationName: string
  quantity: number
}

export type ProductBranchStock = {
  released: BranchQty[]
  reserved: BranchQty[]
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
    byProduct[productId] = {
      released: toSortedBranchList(maps.released),
      reserved: toSortedBranchList(maps.reserved),
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
