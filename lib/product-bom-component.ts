import { supabase, type Product } from './supabase'
import {
  isProductBomComponent,
  productCategoryDisplayName,
} from './product-category-settings'

/** Procurement Materials Inventory category for product-inventory BOM components. */
export const BOM_COMPONENT_MATERIAL_CATEGORY = 'Components'

export function isComponentMaterialCategory(category: string | null | undefined): boolean {
  const normalized = category?.trim().toLowerCase() || ''
  return normalized === 'components' || normalized === 'component'
}

/**
 * Companion product IDs linked from active Components-category materials.
 * Use this to keep BOM/schedule pickers aligned with Factory → Components.
 */
export async function loadActiveComponentLinkedProductIds(
  brandId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('raw_materials')
    .select('linked_product_id, category')
    .eq('brand_id', brandId)
    .eq('is_active', true)
    .not('linked_product_id', 'is', null)

  if (error) throw error

  const ids = new Set<string>()
  for (const row of data || []) {
    if (!isComponentMaterialCategory(row.category as string | null)) continue
    const linkedId = row.linked_product_id as string | null
    if (linkedId) ids.add(linkedId)
  }
  return ids
}

export type BomComponentMaterialContext = {
  /** Brand on raw_materials.brand_id (factory for shared GFC components). */
  materialBrand: { id: string; name: string }
  /** Brand names merged into raw_materials.owner (factory + retail consumer). */
  ownerBrandNames?: string[]
}

export type BomComponentProduct = Pick<
  Product,
  | 'id'
  | 'product_id'
  | 'product_name'
  | 'name'
  | 'sku'
  | 'category'
  | 'unit'
  | 'price'
  | 'initial_stock'
  | 'production'
  | 'released'
  | 'reserved'
>

function normalizeBrandContext(
  context: BomComponentMaterialContext | { id: string; name: string }
): BomComponentMaterialContext {
  if ('materialBrand' in context) {
    const names =
      context.ownerBrandNames?.map((n) => n.trim()).filter(Boolean) ?? []
    return {
      materialBrand: context.materialBrand,
      ownerBrandNames:
        names.length > 0 ? names : [context.materialBrand.name.trim()].filter(Boolean),
    }
  }
  const name = context.name.trim()
  return {
    materialBrand: context,
    ownerBrandNames: name ? [name] : [],
  }
}

/** Merge owner brand names without duplicates (preserves order). */
export function mergeOwnerBrandNames(
  existing: string[] | null | undefined,
  additions: string[]
): string[] {
  const seen = new Set<string>()
  const merged: string[] = []
  for (const raw of [...(existing ?? []), ...additions]) {
    const name = raw.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    merged.push(name)
  }
  return merged
}

function toBomComponentProduct(product: Product): BomComponentProduct | null {
  const id = product.id || product.product_id
  if (!id) return null
  return {
    id,
    product_id: product.product_id,
    product_name: product.product_name || product.name,
    name: product.name,
    sku: product.sku,
    category: product.category,
    unit: product.unit,
    price: product.price,
    initial_stock: product.initial_stock,
    production: product.production,
    released: product.released,
    reserved: product.reserved,
  }
}

export async function fetchCategorySortOrdersForBrand(
  brandId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('product_category_sort')
    .select('category_name, sort_index')
    .eq('brand_id', brandId)

  if (error) throw error

  const map: Record<string, number> = {}
  for (const row of data || []) {
    const display = productCategoryDisplayName(row.category_name as string)
    map[display] = Number(row.sort_index) || 0
  }
  return map
}

/** Product-inventory SKUs in the Components category for a brand. */
export async function loadBomComponentProductsForBrand(brandId: string): Promise<{
  products: BomComponentProduct[]
  categorySortOrders: Record<string, number>
}> {
  const [productsRes, categorySortOrders, linkedProductIds] = await Promise.all([
    supabase.from('products').select('*').eq('brand_id', brandId).order('name'),
    fetchCategorySortOrdersForBrand(brandId),
    loadActiveComponentLinkedProductIds(brandId),
  ])

  if (productsRes.error) throw productsRes.error

  const products = ((productsRes.data || []) as Product[])
    .filter((p) => isProductBomComponent(p, categorySortOrders))
    .filter((p) => {
      const id = p.id || p.product_id
      return Boolean(id && linkedProductIds.has(id))
    })
    .map(toBomComponentProduct)
    .filter((p): p is BomComponentProduct => p != null)

  return { products, categorySortOrders }
}

export function computeProductAvailableStock(product: {
  initial_stock?: number | null
  production?: number | null
  released?: number | null
  reserved?: number | null
}): number {
  return Math.max(
    0,
    (Number(product.initial_stock) || 0) +
      (Number(product.production) || 0) -
      (Number(product.released) || 0) -
      (Number(product.reserved) || 0)
  )
}

/** Product inventory final stock (initial + production − released). */
export function computeProductFinalStock(product: {
  initial_stock?: number | null
  production?: number | null
  released?: number | null
}): number {
  return Math.max(
    0,
    (Number(product.initial_stock) || 0) +
      (Number(product.production) || 0) -
      (Number(product.released) || 0)
  )
}

function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return '0'
  return Number.isInteger(qty)
    ? String(qty)
    : qty.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

/** Ensures procurement category/owner for a linked component material row. */
export async function syncBomComponentMaterialCatalogFields(
  materialId: string,
  ownerBrandNames: string | string[]
): Promise<void> {
  const namesToAdd = (Array.isArray(ownerBrandNames) ? ownerBrandNames : [ownerBrandNames])
    .map((n) => n.trim())
    .filter(Boolean)
  if (namesToAdd.length === 0) return

  const { data: row, error: readErr } = await supabase
    .from('raw_materials')
    .select('category, owner')
    .eq('id', materialId)
    .maybeSingle()

  if (readErr) throw readErr
  if (!row) return

  const owners = (row.owner ?? []).map((o) => o.trim()).filter(Boolean)
  const hasCategory = Boolean(row.category?.trim())
  const mergedOwners = mergeOwnerBrandNames(owners, namesToAdd)
  const ownersComplete = namesToAdd.every((n) => owners.includes(n))

  if (hasCategory && ownersComplete) return

  const { error: updateErr } = await supabase
    .from('raw_materials')
    .update({
      category: hasCategory ? row.category : BOM_COMPONENT_MATERIAL_CATEGORY,
      owner: mergedOwners,
      updated_at: new Date().toISOString(),
    })
    .eq('id', materialId)

  if (updateErr) throw updateErr
}

/**
 * Set companion component material `unit_cost` (and linked `products.price`)
 * from the product BOM rollup. Purchase/production unit cost = cost per one finished unit.
 */
export async function syncComponentCostFromBom(productId: string): Promise<number> {
  if (!productId) return 0

  const { computeProductUnitCost } = await import('./product-bom')
  const unitCost =
    Math.round(Math.max(0, Number(await computeProductUnitCost(productId)) || 0) * 100) / 100
  const now = new Date().toISOString()

  const { error: matErr } = await supabase
    .from('raw_materials')
    .update({ unit_cost: unitCost, updated_at: now })
    .eq('linked_product_id', productId)
    .eq('is_active', true)

  if (matErr) throw matErr

  const { error: prodErr } = await supabase
    .from('products')
    .update({ price: unitCost, updated_at: now })
    .eq('id', productId)

  if (prodErr) throw prodErr

  return unitCost
}

/** Remove procurement materials linked to a product-inventory component product. */
export async function deleteLinkedComponentMaterials(productId: string): Promise<number> {
  const { data: linked, error: findErr } = await supabase
    .from('raw_materials')
    .select('id')
    .eq('linked_product_id', productId)

  if (findErr) throw findErr
  const ids = (linked || []).map((row) => row.id as string).filter(Boolean)
  if (ids.length === 0) return 0

  const { error: delErr } = await supabase.from('raw_materials').delete().in('id', ids)
  if (delErr) throw delErr
  return ids.length
}

/** Raw material row for a product-inventory BOM component (creates if missing). */
export async function ensureBomComponentMaterial(
  product: Pick<Product, 'id' | 'product_id' | 'product_name' | 'name' | 'sku' | 'unit' | 'price'>,
  context: BomComponentMaterialContext | { id: string; name: string }
): Promise<string> {
  const productId = product.id || product.product_id
  if (!productId) throw new Error('Invalid component product.')

  const { materialBrand, ownerBrandNames } = normalizeBrandContext(context)
  if (!materialBrand.id || ownerBrandNames.length === 0) {
    throw new Error('Invalid brand.')
  }

  const { data: existing, error: findErr } = await supabase
    .from('raw_materials')
    .select('id')
    .eq('linked_product_id', productId)
    .eq('is_active', true)
    .maybeSingle()

  if (findErr) throw findErr
  if (existing?.id) {
    await syncBomComponentMaterialCatalogFields(existing.id, ownerBrandNames)
    const { error: brandErr } = await supabase
      .from('raw_materials')
      .update({
        brand_id: materialBrand.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .neq('brand_id', materialBrand.id)
    if (brandErr) throw brandErr
    try {
      await syncComponentCostFromBom(productId)
    } catch (err) {
      console.warn('syncComponentCostFromBom:', err)
    }
    return existing.id
  }

  const unit = product.unit?.trim() || 'pcs'
  const { computeProductUnitCost } = await import('./product-bom')
  const bomUnitCost = Math.max(0, Number(await computeProductUnitCost(productId)) || 0)
  const unitCost = bomUnitCost > 0 ? bomUnitCost : Math.max(0, Number(product.price) || 0)
  const { data: created, error: insertErr } = await supabase
    .from('raw_materials')
    .insert({
      brand_id: materialBrand.id,
      material_name: product.product_name || product.name || 'Component',
      sku: product.sku || null,
      category: BOM_COMPONENT_MATERIAL_CATEGORY,
      owner: ownerBrandNames,
      unit,
      uom_base_unit: unit,
      uom_base_per_unit: 1,
      uom_purchase_unit: unit,
      uom_stock_per_purchase: 1,
      unit_cost: unitCost,
      minimum_stock: 0,
      current_stock: 0,
      linked_product_id: productId,
      factory_inventory_kind: 'ingredients',
      factory_bom_uom: 'stock',
      factory_request_uom: 'stock',
      is_active: true,
      notes: 'BOM component linked from product inventory',
    })
    .select('id')
    .single()

  if (insertErr) throw insertErr
  return created.id
}

/** Move product inventory qty into linked procurement Component material inventory. */
export async function exportComponentToProcurement(params: {
  product: Pick<
    Product,
    'id' | 'product_id' | 'product_name' | 'name' | 'sku' | 'unit' | 'price'
  >
  brand: { id: string; name: string }
  quantity: number
  createdBy: string
  notes?: string
}): Promise<{
  materialId: string
  quantityExported: number
  materialStockAfter: number
  productFinalStockAfter: number
}> {
  const productId = params.product.id || params.product.product_id
  if (!productId) throw new Error('Invalid component product.')

  const quantityExported = Math.max(0, Number(params.quantity) || 0)
  if (quantityExported <= 0) {
    throw new Error('Enter a quantity greater than 0.')
  }

  const materialId = await ensureBomComponentMaterial(params.product, params.brand)

  const { data: productRow, error: prodErr } = await supabase
    .from('products')
    .select('id, name, initial_stock, production, released, reserved, unit')
    .eq('id', productId)
    .single()

  if (prodErr || !productRow) {
    throw new Error(prodErr?.message || 'Product not found.')
  }

  const finalStock = computeProductFinalStock(productRow)
  if (finalStock <= 0) {
    throw new Error('No final stock to export.')
  }
  if (quantityExported > finalStock + 1e-9) {
    throw new Error(
      `Cannot export more than final stock (${formatQty(finalStock)}).`
    )
  }

  const { data: materialRow, error: matErr } = await supabase
    .from('raw_materials')
    .select('id, material_name, current_stock, unit, unit_cost')
    .eq('id', materialId)
    .single()

  if (matErr || !materialRow) {
    throw new Error(matErr?.message || 'Linked component material not found.')
  }

  const unitLabel = productRow.unit?.trim() || materialRow.unit?.trim() || 'pcs'
  const materialBefore = Number(materialRow.current_stock) || 0
  const materialAfter = materialBefore + quantityExported
  const productName =
    params.product.product_name || params.product.name || productRow.name || 'Component'
  const initialBefore = Number(productRow.initial_stock) || 0
  const initialAfter = initialBefore - quantityExported
  const productFinalStockAfter = computeProductFinalStock({
    initial_stock: initialAfter,
    production: productRow.production,
    released: productRow.released,
  })

  const noteParts = [
    params.notes?.trim(),
    `Exported from product inventory: ${productName}`,
    `${formatQty(quantityExported)} ${unitLabel} → procurement (${BOM_COMPONENT_MATERIAL_CATEGORY})`,
    `Material stock: ${formatQty(materialBefore)} → ${formatQty(materialAfter)} ${unitLabel}`,
    `Product final stock: ${formatQty(finalStock)} → ${formatQty(productFinalStockAfter)} ${unitLabel}`,
  ].filter(Boolean)

  const unitCost = Math.max(
    0,
    Number(params.product.price) || Number(materialRow.unit_cost) || 0
  )

  const { data: movementRow, error: movErr } = await supabase
    .from('material_stock_movements')
    .insert({
      material_id: materialId,
      movement_type: 'in',
      quantity: quantityExported,
      unit_cost: unitCost,
      reference_type: 'export_component',
      reference_id: productId,
      reference_number: productName,
      notes: noteParts.join(' | '),
      movement_date: new Date().toISOString().split('T')[0],
      created_by: params.createdBy.trim() || 'system',
    })
    .select('id')
    .single()

  if (movErr) throw movErr

  if (movementRow?.id) {
    const { postMaterialMovementJournalWithNotice } = await import('./accounting-movement-posting')
    await postMaterialMovementJournalWithNotice(
      movementRow.id as string,
      params.brand.id,
      params.createdBy.trim() || 'system',
      `component export — ${productName}`
    )
  }

  const { error: productUpdErr } = await supabase
    .from('products')
    .update({
      initial_stock: initialAfter,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)

  if (productUpdErr) throw productUpdErr

  return {
    materialId,
    quantityExported,
    materialStockAfter: materialAfter,
    productFinalStockAfter,
  }
}
