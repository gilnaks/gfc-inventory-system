import { supabase, type Brand, type RawMaterial } from './supabase'
import {
  BOM_COMPONENT_MATERIAL_CATEGORY,
  ensureBomComponentMaterial,
  fetchCategorySortOrdersForBrand,
  isComponentMaterialCategory,
} from './product-bom-component'
import {
  BOM_COMPONENT_CATEGORY_SORT_INDEX,
  categorySortKey,
  isProductBomComponent,
} from './product-category-settings'

/** Ensure a sort-index-100 category exists; returns its display name. */
export async function ensureFactoryComponentCategory(brandId: string): Promise<string> {
  const sortOrders = await fetchCategorySortOrdersForBrand(brandId)
  const existing = Object.entries(sortOrders).find(
    ([, index]) => index === BOM_COMPONENT_CATEGORY_SORT_INDEX
  )
  if (existing) return existing[0]

  const display = 'Components'
  const { error } = await supabase.from('product_category_sort').upsert(
    {
      brand_id: brandId,
      category_name: categorySortKey(display),
      sort_index: BOM_COMPONENT_CATEGORY_SORT_INDEX,
      show_on_order_portal: false,
      remote_store: false,
      available_to_company_owned: true,
      available_to_franchise: true,
      yield_per_batch: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'brand_id,category_name' }
  )
  if (error) throw error
  return display
}

export type FactoryComponentFgUsage = {
  productId: string
  productName: string
  brandName: string
}

export type FactoryComponentRow = {
  material: Pick<
    RawMaterial,
    | 'id'
    | 'material_name'
    | 'sku'
    | 'unit'
    | 'category'
    | 'current_stock'
    | 'unit_cost'
    | 'linked_product_id'
    | 'factory_inventory_kind'
    | 'brand_id'
    | 'owner'
  >
  linkedProductId: string | null
  bomLineCount: number
  usedInFinishedGoods: FactoryComponentFgUsage[]
}

type BomConsumerProduct = {
  id: string
  name?: string | null
  category?: string | null
  brand_id?: string | null
}

/** Component materials in procurement (Components category) for the factory brand. */
export async function loadFactoryComponentsCatalog(
  factoryBrandId: string
): Promise<FactoryComponentRow[]> {
  const { data: materialsData, error: matErr } = await supabase
    .from('raw_materials')
    .select(
      'id, material_name, sku, unit, category, current_stock, unit_cost, linked_product_id, factory_inventory_kind, brand_id, owner, is_active'
    )
    .eq('is_active', true)
    .order('material_name')

  if (matErr) throw matErr

  const materials = ((materialsData || []) as RawMaterial[]).filter((m) => {
    if (!isComponentMaterialCategory(m.category)) return false
    if (m.brand_id === factoryBrandId) return true
    // Owner list may include factory brand name even if brand_id differs
    return true
  })

  // Prefer factory-brand rows; if duplicates by name, keep factory brand first
  const byKey = new Map<string, RawMaterial>()
  for (const m of materials) {
    const key = `${(m.material_name || '').trim().toLowerCase()}|${(m.sku || '').trim().toLowerCase()}`
    const existing = byKey.get(key)
    if (!existing || m.brand_id === factoryBrandId) {
      byKey.set(key, m)
    }
  }

  const componentMaterials = Array.from(byKey.values()).filter(
    (m) =>
      m.brand_id === factoryBrandId ||
      (m.owner || []).some((o) => o.trim().length > 0)
  )

  // Restrict to factory brand materials primarily
  const scoped = componentMaterials.filter((m) => m.brand_id === factoryBrandId)
  const list = scoped.length > 0 ? scoped : componentMaterials

  if (list.length === 0) return []

  const materialIds = list.map((m) => m.id)
  const productIds = list
    .map((m) => m.linked_product_id)
    .filter((id): id is string => Boolean(id))

  let bomLineCountByProduct = new Map<string, number>()
  if (productIds.length > 0) {
    const { data: ownBom, error: bomErr } = await supabase
      .from('product_bom_items')
      .select('product_id')
      .in('product_id', productIds)
    if (bomErr) {
      console.warn('factory components own BOM:', bomErr.message)
    } else {
      for (const row of ownBom || []) {
        const pid = row.product_id as string
        bomLineCountByProduct.set(pid, (bomLineCountByProduct.get(pid) || 0) + 1)
      }
    }
  }

  type ConsumerRow = {
    product_id: string
    material_id: string
    product: BomConsumerProduct | BomConsumerProduct[] | null
  }

  let consumerRows: ConsumerRow[] = []
  if (materialIds.length > 0) {
    const { data, error } = await supabase
      .from('product_bom_items')
      .select('product_id, material_id, product:products(id, name, category, brand_id)')
      .in('material_id', materialIds)

    if (error) {
      console.warn('factory components FG usage:', error.message)
    } else {
      consumerRows = (data || []) as ConsumerRow[]
    }
  }

  const brandIds = new Set<string>()
  for (const row of consumerRows) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product
    if (product?.brand_id) brandIds.add(product.brand_id)
  }

  const brandNameById = new Map<string, string>()
  if (brandIds.size > 0) {
    const { data: brandsData } = await supabase
      .from('brands')
      .select('id, name')
      .in('id', Array.from(brandIds))
    for (const b of brandsData || []) {
      brandNameById.set(b.id as string, (b.name as string) || 'Unknown')
    }
  }

  const sortOrdersByBrand = new Map<string, Record<string, number>>()
  await Promise.all(
    Array.from(brandIds).map(async (brandId) => {
      try {
        sortOrdersByBrand.set(brandId, await fetchCategorySortOrdersForBrand(brandId))
      } catch {
        sortOrdersByBrand.set(brandId, {})
      }
    })
  )

  const usageByMaterialId = new Map<string, FactoryComponentFgUsage[]>()
  const seenUsage = new Set<string>()

  for (const row of consumerRows) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product
    if (!product?.id) continue

    const brandId = product.brand_id
    const sortOrders = brandId ? sortOrdersByBrand.get(brandId) ?? {} : {}
    if (isProductBomComponent(product, sortOrders)) continue

    const key = `${row.material_id}:${product.id}`
    if (seenUsage.has(key)) continue
    seenUsage.add(key)

    const listUsage = usageByMaterialId.get(row.material_id) ?? []
    listUsage.push({
      productId: product.id,
      productName: product.name || 'Product',
      brandName: (brandId && brandNameById.get(brandId)) || 'Unknown',
    })
    usageByMaterialId.set(row.material_id, listUsage)
  }

  return list
    .map((material) => {
      const linkedProductId = material.linked_product_id || null
      return {
        material: {
          id: material.id,
          material_name: material.material_name,
          sku: material.sku,
          unit: material.unit,
          category: material.category,
          current_stock: material.current_stock,
          unit_cost: material.unit_cost,
          linked_product_id: material.linked_product_id,
          factory_inventory_kind: material.factory_inventory_kind,
          brand_id: material.brand_id,
          owner: material.owner,
        },
        linkedProductId,
        bomLineCount: linkedProductId
          ? bomLineCountByProduct.get(linkedProductId) || 0
          : 0,
        usedInFinishedGoods: usageByMaterialId.get(material.id) ?? [],
      }
    })
    .sort((a, b) =>
      (a.material.material_name || '').localeCompare(b.material.material_name || '')
    )
}

/** Create companion product for scheduling/BOM and link to the material. */
export async function linkComponentMaterialToProduct(params: {
  material: Pick<
    RawMaterial,
    'id' | 'material_name' | 'sku' | 'unit' | 'unit_cost' | 'linked_product_id'
  >
  brand: { id: string; name: string }
}): Promise<string> {
  if (params.material.linked_product_id) return params.material.linked_product_id

  const category = await ensureFactoryComponentCategory(params.brand.id)
  const unit = params.material.unit?.trim() || 'pcs'

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      brand_id: params.brand.id,
      name: params.material.material_name,
      sku: params.material.sku || null,
      category,
      unit,
      price: Math.max(0, Number(params.material.unit_cost) || 0),
      initial_stock: 0,
      production: 0,
      released: 0,
      reserved: 0,
      minimum_stock: 0,
    })
    .select('id')
    .single()

  if (error) throw error
  if (!product?.id) throw new Error('Failed to create companion product for component.')

  const { error: linkErr } = await supabase
    .from('raw_materials')
    .update({
      linked_product_id: product.id,
      category: BOM_COMPONENT_MATERIAL_CATEGORY,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.material.id)

  if (linkErr) throw linkErr

  // Keep ensureBomComponentMaterial in sync (owners / factory fields)
  await ensureBomComponentMaterial(
    {
      id: product.id,
      product_id: product.id,
      product_name: params.material.material_name,
      name: params.material.material_name,
      sku: params.material.sku,
      unit,
      price: Math.max(0, Number(params.material.unit_cost) || 0),
    },
    params.brand
  )

  return product.id as string
}

/** Credit procurement material stock when a component batch is completed. */
export async function postComponentProductionReceipt(params: {
  productId: string
  quantity: number
  unitCost: number
  batchId: string
  createdBy: string
  brandId: string
  productName?: string
}): Promise<{ materialId: string; quantity: number } | null> {
  const qty = Math.max(0, Number(params.quantity) || 0)
  if (qty <= 0) return null

  // Idempotent: do not credit stock twice for the same completed batch.
  const { data: existingIns } = await supabase
    .from('material_stock_movements')
    .select('id, quantity')
    .eq('reference_type', 'production_batch')
    .eq('reference_id', params.batchId)
    .eq('movement_type', 'in')
  const { data: existingOuts } = await supabase
    .from('material_stock_movements')
    .select('id, quantity')
    .eq('reference_type', 'production_batch')
    .eq('reference_id', params.batchId)
    .eq('movement_type', 'out')

  const inQty = (existingIns || []).reduce((s, r) => s + (Number(r.quantity) || 0), 0)
  const outQty = (existingOuts || []).reduce((s, r) => s + (Number(r.quantity) || 0), 0)
  const netCredited = inQty - outQty
  if (netCredited > 1e-9) {
    const { data: material } = await supabase
      .from('raw_materials')
      .select('id')
      .eq('linked_product_id', params.productId)
      .eq('is_active', true)
      .maybeSingle()
    return material?.id
      ? { materialId: material.id as string, quantity: netCredited }
      : null
  }

  const { data: material, error } = await supabase
    .from('raw_materials')
    .select('id, material_name, current_stock, unit, unit_cost')
    .eq('linked_product_id', params.productId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  if (!material?.id) return null

  const unitCost = Math.max(
    0,
    Number(params.unitCost) || Number(material.unit_cost) || 0
  )
  const label = params.productName || material.material_name || 'Component'

  const { data: movementRow, error: movErr } = await supabase
    .from('material_stock_movements')
    .insert({
      material_id: material.id,
      movement_type: 'in',
      quantity: qty,
      unit_cost: unitCost,
      reference_type: 'production_batch',
      reference_id: params.batchId,
      reference_number: label,
      notes: `Factory production — ${qty} ${material.unit || 'pcs'} of ${label}`,
      movement_date: new Date().toISOString().split('T')[0],
      created_by: params.createdBy.trim() || 'Factory',
    })
    .select('id')
    .single()

  if (movErr) throw movErr

  if (movementRow?.id) {
    const { postMaterialMovementJournalWithNotice } = await import(
      './accounting-movement-posting'
    )
    await postMaterialMovementJournalWithNotice(
      movementRow.id as string,
      params.brandId,
      params.createdBy.trim() || 'Factory',
      `component production — ${label}`
    )
  }

  return { materialId: material.id as string, quantity: qty }
}

/**
 * Undo component material stock credited on batch completion (revert → in progress).
 * Posts compensating OUT movements and reverses related movement journals.
 */
export async function reverseComponentProductionReceipt(
  batchId: string,
  postedBy: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: inMovements, error } = await supabase
    .from('material_stock_movements')
    .select('id, material_id, quantity, unit_cost, reference_number, journal_entry_id')
    .eq('reference_type', 'production_batch')
    .eq('reference_id', batchId)
    .eq('movement_type', 'in')

  if (error) {
    return { ok: false, message: error.message }
  }
  if (!inMovements?.length) {
    return { ok: true }
  }

  const { data: outMovements } = await supabase
    .from('material_stock_movements')
    .select('id, quantity')
    .eq('reference_type', 'production_batch')
    .eq('reference_id', batchId)
    .eq('movement_type', 'out')

  const alreadyReversedQty = (outMovements || []).reduce(
    (s, r) => s + (Number(r.quantity) || 0),
    0
  )
  const creditedQty = inMovements.reduce((s, r) => s + (Number(r.quantity) || 0), 0)
  if (creditedQty - alreadyReversedQty <= 1e-9) {
    return { ok: true }
  }

  const { reverseJournalEntry } = await import('./accounting-journal-service')
  const by = postedBy.trim() || 'Factory'
  const memo = 'Production batch reverted to in progress'

  for (const mov of inMovements) {
    const qty = Number(mov.quantity) || 0
    if (qty <= 0 || !mov.material_id) continue

    if (mov.journal_entry_id) {
      try {
        await reverseJournalEntry(mov.journal_entry_id as string, by, memo)
      } catch {
        /* already reversed or period closed */
      }
    }

    const { data: outRow, error: outErr } = await supabase
      .from('material_stock_movements')
      .insert({
        material_id: mov.material_id,
        movement_type: 'out',
        quantity: qty,
        unit_cost: Number(mov.unit_cost) || 0,
        reference_type: 'production_batch',
        reference_id: batchId,
        reference_number: mov.reference_number || null,
        notes: `Revert production receipt — ${qty}`,
        movement_date: new Date().toISOString().split('T')[0],
        created_by: by,
      })
      .select('id')
      .single()

    if (outErr) {
      return { ok: false, message: outErr.message }
    }

    // Stock OUT from revert should not post a second inventory journal if we already
    // reversed the original IN journal above. Skip movement JE for compensating outs.
    void outRow
  }

  return { ok: true }
}

export async function isFactoryComponentProduct(productId: string): Promise<boolean> {
  const { data: product } = await supabase
    .from('products')
    .select('id, category, brand_id')
    .eq('id', productId)
    .maybeSingle()

  if (!product?.id || !product.brand_id) return false

  const sortOrders = await fetchCategorySortOrdersForBrand(product.brand_id as string)
  if (isProductBomComponent(product, sortOrders)) return true

  const { data: linked } = await supabase
    .from('raw_materials')
    .select('id, category')
    .eq('linked_product_id', productId)
    .eq('is_active', true)
    .maybeSingle()

  return Boolean(linked?.id && isComponentMaterialCategory(linked.category))
}
