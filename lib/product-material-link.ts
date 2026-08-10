import { supabase } from './supabase'
import type { FactoryRequestUom } from './raw-material-uom'
import {
  factoryRequestQtyToStockUnits,
  getFactoryRequestUnitLabel,
  getPurchaseUnitLabel,
  getStockUnitLabel,
  stockUnitsPerPurchase,
  type RawMaterialUomFields,
} from './raw-material-uom'

export type ProductMaterialInventoryUom = FactoryRequestUom

export function getProductMaterialInventoryUom(
  productUom: string | null | undefined
): ProductMaterialInventoryUom {
  return productUom === 'purchase' ? 'purchase' : 'stock'
}

export function getProductMaterialInventoryUnitLabel(
  material: RawMaterialUomFields,
  uom: ProductMaterialInventoryUom
): string {
  return uom === 'purchase' ? getPurchaseUnitLabel(material) : getStockUnitLabel(material)
}

/** Warehouse current_stock (stock units) → qty in the selected receive UOM. */
export function materialStockAvailableInUom(
  stockQty: number,
  uom: ProductMaterialInventoryUom,
  material: RawMaterialUomFields
): number {
  const stock = Math.max(0, Number(stockQty) || 0)
  if (uom === 'purchase') {
    return stock / stockUnitsPerPurchase(material)
  }
  return stock
}

export function formatMaterialStockAvailable(
  stockQty: number,
  uom: ProductMaterialInventoryUom,
  material: RawMaterialUomFields
): string {
  const qty = materialStockAvailableInUom(stockQty, uom, material)
  const unit = getProductMaterialInventoryUnitLabel(material, uom)
  const formatted = Number.isInteger(qty)
    ? qty.toLocaleString()
    : qty.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return `${formatted} ${unit}`
}

export function productInventoryQtyToMaterialStockUnits(
  qty: number,
  uom: ProductMaterialInventoryUom,
  material: RawMaterialUomFields
): number {
  return factoryRequestQtyToStockUnits(qty, {
    ...material,
    factory_inventory_kind: material.factory_inventory_kind ?? 'ingredients',
    factory_request_uom: uom,
  })
}

export async function saveProductMaterialLink(params: {
  productId: string
  materialId: string | null
  materialInventoryUom: ProductMaterialInventoryUom | null
  previousMaterialId?: string | null
}): Promise<void> {
  const { error: productErr } = await supabase
    .from('products')
    .update({
      linked_material_id: params.materialId,
      material_inventory_uom: params.materialId ? params.materialInventoryUom : null,
    })
    .eq('id', params.productId)

  if (productErr) throw productErr

  if (params.previousMaterialId && params.previousMaterialId !== params.materialId) {
    await supabase
      .from('raw_materials')
      .update({ linked_product_id: null })
      .eq('id', params.previousMaterialId)
      .eq('linked_product_id', params.productId)
  }

  if (params.materialId) {
    await supabase.from('product_bom_items').delete().eq('product_id', params.productId)

    await supabase
      .from('raw_materials')
      .update({ linked_product_id: params.productId })
      .eq('id', params.materialId)
  }
}

export async function transferMaterialToProductInventory(params: {
  productId: string
  productName: string
  material: RawMaterialUomFields & { id: string }
  requestQty: number
  uom: ProductMaterialInventoryUom
  createdBy: string
  notes?: string
}): Promise<{ stockUnitsTransferred: number; productFinalStock: number; movementId: string }> {
  const requestQty = Math.max(0, Number(params.requestQty) || 0)
  if (requestQty <= 0) throw new Error('Enter a quantity greater than 0.')

  const stockOut = productInventoryQtyToMaterialStockUnits(
    requestQty,
    params.uom,
    params.material
  )
  if (stockOut <= 0) throw new Error('Invalid quantity.')

  const unitLabel = getProductMaterialInventoryUnitLabel(params.material, params.uom)

  const { data: materialRow, error: matErr } = await supabase
    .from('raw_materials')
    .select('current_stock')
    .eq('id', params.material.id)
    .single()

  if (matErr || !materialRow) {
    throw new Error(matErr?.message || 'Material not found.')
  }

  const available = Number(materialRow.current_stock) || 0
  if (available < stockOut - 1e-9) {
    throw new Error(
      `Insufficient materials inventory. Available: ${available} ${getStockUnitLabel(params.material)} (${requestQty} ${unitLabel} requested).`
    )
  }

  const { data: productRow, error: prodErr } = await supabase
    .from('products')
    .select('id, name, initial_stock')
    .eq('id', params.productId)
    .single()

  if (prodErr || !productRow) {
    throw new Error(prodErr?.message || 'Product not found.')
  }

  const productInitial = Number(productRow.initial_stock) || 0
  const productFinal = productInitial + stockOut

  const { data: movementRow, error: movErr } = await supabase
    .from('material_stock_movements')
    .insert({
      material_id: params.material.id,
      movement_type: 'out',
      quantity: stockOut,
      reference_type: 'transfer_to_product_inventory',
      reference_id: params.productId,
      reference_number: productRow.name || params.productName,
      notes: [
        params.notes?.trim(),
        `Transferred to product inventory: ${productRow.name || params.productName}`,
        `${formatQty(requestQty)} ${unitLabel} → ${formatQty(stockOut)} ${getStockUnitLabel(params.material)}`,
        `Product stock: ${formatQty(productInitial)} → ${formatQty(productFinal)}`,
      ]
        .filter(Boolean)
        .join(' | '),
      movement_date: new Date().toISOString().split('T')[0],
      created_by: params.createdBy,
    })
    .select('id')
    .single()

  if (movErr || !movementRow?.id) throw movErr || new Error('Failed to record material movement.')

  const { error: updErr } = await supabase
    .from('products')
    .update({ initial_stock: productFinal })
    .eq('id', params.productId)

  if (updErr) throw updErr

  return {
    stockUnitsTransferred: stockOut,
    productFinalStock: productFinal,
    movementId: movementRow.id,
  }
}

function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return '0'
  return Number.isInteger(qty)
    ? String(qty)
    : qty.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

export function materialSupportsPurchaseUom(material: RawMaterialUomFields): boolean {
  const per = stockUnitsPerPurchase(material)
  const purchase = material.uom_purchase_unit?.trim()
  return Boolean(purchase) && per > 1
}
