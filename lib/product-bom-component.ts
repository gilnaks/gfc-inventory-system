import { supabase, type Product } from './supabase'

/** Procurement Materials Inventory category for product-inventory BOM components. */
export const BOM_COMPONENT_MATERIAL_CATEGORY = 'Component'

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
  brandName: string
): Promise<void> {
  const { data: row, error: readErr } = await supabase
    .from('raw_materials')
    .select('category, owner')
    .eq('id', materialId)
    .maybeSingle()

  if (readErr) throw readErr
  if (!row) return

  const owners = (row.owner ?? []).map((o) => o.trim()).filter(Boolean)
  const hasCategory = Boolean(row.category?.trim())
  const hasBrandOwner = owners.includes(brandName)

  if (hasCategory && hasBrandOwner) return

  const { error: updateErr } = await supabase
    .from('raw_materials')
    .update({
      category: hasCategory ? row.category : BOM_COMPONENT_MATERIAL_CATEGORY,
      owner: hasBrandOwner ? owners : [brandName],
      updated_at: new Date().toISOString(),
    })
    .eq('id', materialId)

  if (updateErr) throw updateErr
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
  brand: { id: string; name: string }
): Promise<string> {
  const productId = product.id || product.product_id
  if (!productId) throw new Error('Invalid component product.')

  const brandName = brand.name.trim()
  if (!brandName) throw new Error('Invalid brand.')

  const { data: existing, error: findErr } = await supabase
    .from('raw_materials')
    .select('id')
    .eq('linked_product_id', productId)
    .eq('is_active', true)
    .maybeSingle()

  if (findErr) throw findErr
  if (existing?.id) {
    await syncBomComponentMaterialCatalogFields(existing.id, brandName)
    return existing.id
  }

  const unit = product.unit?.trim() || 'pcs'
  const { data: created, error: insertErr } = await supabase
    .from('raw_materials')
    .insert({
      brand_id: brand.id,
      material_name: product.product_name || product.name || 'Component',
      sku: product.sku || null,
      category: BOM_COMPONENT_MATERIAL_CATEGORY,
      owner: [brandName],
      unit,
      uom_base_unit: unit,
      uom_base_per_unit: 1,
      uom_purchase_unit: unit,
      uom_stock_per_purchase: 1,
      unit_cost: Math.max(0, Number(product.price) || 0),
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
    .select('id, material_name, current_stock, unit')
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

  const { error: movErr } = await supabase.from('material_stock_movements').insert({
    material_id: materialId,
    movement_type: 'in',
    quantity: quantityExported,
    reference_type: 'export_component',
    reference_id: productId,
    reference_number: productName,
    notes: noteParts.join(' | '),
    movement_date: new Date().toISOString().split('T')[0],
    created_by: params.createdBy.trim() || 'system',
  })

  if (movErr) throw movErr

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
