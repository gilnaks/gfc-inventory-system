import { supabase } from './supabase'
import type { Product, ProductBomItem, RawMaterial } from './supabase'
import {
  fetchProductBomItemsByProductId,
  fetchProductBomSettingsByProductId,
  unitCostFromLinkedMaterial,
  unitCostPerProductFromBomItems,
} from './product-bom'

export type OrderCogsBreakdown = {
  total: number
  productsWithoutBom: string[]
  productsWithZeroCost: string[]
  /** Set when order_details could not be loaded (e.g. bad column in select). */
  loadError?: string
}

type OrderLineProduct = Pick<
  Product,
  'id' | 'name' | 'linked_material_id' | 'bom_quantity_mode' | 'bom_yield_per_batch'
> & {
  product_name?: string
}

function unwrapProduct(products: unknown): OrderLineProduct | null {
  if (!products) return null
  if (Array.isArray(products)) return (products[0] as OrderLineProduct) ?? null
  return products as OrderLineProduct
}

function productLabel(p: OrderLineProduct | null, productId: string): string {
  return (p?.name || p?.product_name || productId.slice(0, 8)).trim()
}

const LINKED_MATERIAL_SELECT =
  'id, unit, uom_base_unit, uom_base_per_unit, unit_cost, uom_stock_per_purchase, uom_purchase_unit, factory_bom_uom, factory_request_uom, factory_inventory_kind'

/** COGS for one customer order — same costing as Product inventory BOM modal. */
export async function computeOrderCogsTotal(orderId: string): Promise<OrderCogsBreakdown> {
  const { data: details, error: detailsError } = await supabase
    .from('order_details')
    .select(
      `product_id, quantity,
       products:products(
         id, name, linked_material_id, bom_quantity_mode, bom_yield_per_batch
       )`
    )
    .eq('order_id', orderId)

  if (detailsError) {
    console.error('computeOrderCogsTotal order_details:', detailsError)
    return {
      total: 0,
      productsWithoutBom: [],
      productsWithZeroCost: [],
      loadError: detailsError.message,
    }
  }

  if (!details?.length) {
    return {
      total: 0,
      productsWithoutBom: [],
      productsWithZeroCost: [],
      loadError: 'order has no line items',
    }
  }

  const productIds = Array.from(
    new Set(details.map((d) => d.product_id).filter(Boolean) as string[])
  )
  const bomByProduct = await fetchProductBomItemsByProductId(productIds)
  const settingsByProduct = await fetchProductBomSettingsByProductId(productIds, bomByProduct)

  const linkedMaterialIds = new Set<string>()
  for (const d of details) {
    const p = unwrapProduct(d.products)
    if (p?.linked_material_id) linkedMaterialIds.add(p.linked_material_id)
  }

  const linkedMaterialById: Record<string, RawMaterial> = {}
  if (linkedMaterialIds.size > 0) {
    const { data: mats, error: matError } = await supabase
      .from('raw_materials')
      .select(LINKED_MATERIAL_SELECT)
      .in('id', Array.from(linkedMaterialIds))
    if (matError) {
      console.error('computeOrderCogsTotal raw_materials:', matError)
      return {
        total: 0,
        productsWithoutBom: [],
        productsWithZeroCost: [],
        loadError: matError.message,
      }
    }
    for (const m of mats || []) {
      linkedMaterialById[m.id as string] = m as RawMaterial
    }
  }

  let total = 0
  const productsWithoutBom: string[] = []
  const productsWithZeroCost: string[] = []
  let linesWithQty = 0

  for (const d of details) {
    const pid = d.product_id as string
    const qty = Number(d.quantity) || 0
    if (!pid || qty <= 0) continue
    linesWithQty++

    const p = unwrapProduct(d.products)
    const label = productLabel(p, pid)
    const linkedMat = p?.linked_material_id
      ? linkedMaterialById[p.linked_material_id] ?? null
      : null

    const items: ProductBomItem[] = bomByProduct[pid] || []
    const settings = settingsByProduct[pid] || { quantity_mode: 'unit' as const, yield_per_batch: null }

    let unitCost = 0
    if (items.length > 0) {
      unitCost = unitCostPerProductFromBomItems(items, settings)
    } else if (p?.linked_material_id && linkedMat) {
      unitCost = unitCostFromLinkedMaterial(linkedMat)
    }

    if (items.length === 0 && !p?.linked_material_id) {
      productsWithoutBom.push(label)
      continue
    }
    if (unitCost <= 0) {
      productsWithZeroCost.push(label)
      continue
    }
    total += unitCost * qty
  }

  if (linesWithQty === 0) {
    return {
      total: 0,
      productsWithoutBom: [],
      productsWithZeroCost: [],
      loadError: 'order lines have no product or quantity',
    }
  }

  return { total, productsWithoutBom, productsWithZeroCost }
}

export function formatOrderCogsError(breakdown: OrderCogsBreakdown): string {
  if (breakdown.loadError) {
    return breakdown.loadError
  }
  const parts: string[] = []
  if (breakdown.productsWithoutBom.length) {
    parts.push(`no BOM: ${breakdown.productsWithoutBom.join(', ')}`)
  }
  if (breakdown.productsWithZeroCost.length) {
    parts.push(
      `zero cost (set material unit cost in Procurement or component product price): ${breakdown.productsWithZeroCost.join(', ')}`
    )
  }
  if (parts.length === 0 && breakdown.total <= 0) {
    return 'no order lines with computable BOM cost'
  }
  return parts.join('; ')
}
