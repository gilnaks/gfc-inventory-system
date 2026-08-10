'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase, Product, Brand, ProductBomItem, RawMaterial, type BomQuantityMode } from '../../lib/supabase'
import { getFactoryBrand } from '../../lib/brand-roles'
import { useBrands } from '../contexts/BrandsContext'
import { X, Plus, Trash2, Layers, ExternalLink, Lock } from 'lucide-react'
import { Modal } from './Modal'
import {
  bomQtyBasisLabel,
  effectiveBomQtyPerProductUnit,
  isBomQuantityMode,
  inferBomSettingsFromItems,
  lineCostPerProductUnit,
  parseProductBomSettings,
  type ProductBomSettings,
} from '../../lib/product-bom'
import {
  bomBaseQtyToDisplayQty,
  bomDisplayQtyToBaseQty,
  getBomDisplayUnitLabel,
  getPurchaseUnitLabel,
} from '../../lib/raw-material-uom'
import { isProductBomComponent } from '../../lib/product-category-settings'
import {
  ensureBomComponentMaterial,
  isComponentMaterialCategory,
  loadActiveComponentLinkedProductIds,
  loadBomComponentProductsForBrand,
  syncBomComponentMaterialCatalogFields,
  syncComponentCostFromBom,
  type BomComponentProduct,
} from '../../lib/product-bom-component'

interface ProductBomModalProps {
  product: Product
  selectedBrand: Brand
  categorySortOrders: Record<string, number>
  /** Brand products from Product Inventory (used for component picker). */
  brandProducts: Product[]
  theme?: string
  guestMode?: boolean
  onClose: () => void
  onOpenProcurement?: () => void
}

function toComponentProduct(p: Product): BomComponentProduct | null {
  const id = p.id || p.product_id
  if (!id) return null
  return {
    id,
    product_id: p.product_id,
    product_name: p.product_name || p.name,
    name: p.name,
    sku: p.sku,
    category: p.category,
    unit: p.unit,
    price: p.price,
    initial_stock: p.initial_stock,
    production: p.production,
    released: p.released,
    reserved: p.reserved,
  }
}

function formatMoney(amount: number) {
  return `₱${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatQty(qty: number) {
  if (!Number.isFinite(qty)) return '0'
  return Number.isInteger(qty)
    ? String(qty)
    : qty.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

const BOM_SELECT =
  'id, product_id, material_id, quantity, quantity_mode, yield_per_batch, notes, material:raw_materials(id, material_name, sku, unit, uom_base_unit, uom_base_per_unit, uom_purchase_unit, current_stock, unit_cost, uom_stock_per_purchase, factory_bom_uom, factory_inventory_kind, brand_id, is_active, linked_product_id)'

const RAW_MATERIALS_SELECT =
  'id, material_name, sku, unit, uom_base_unit, uom_base_per_unit, uom_purchase_unit, current_stock, unit_cost, uom_stock_per_purchase, factory_bom_uom, factory_inventory_kind, brand_id, is_active, linked_product_id'

type BomLinePickerValue = `material:${string}` | `component:${string}` | `gfc-component:${string}`

function parseBomLinePicker(
  value: string
): { kind: 'material' | 'component' | 'gfc-component'; id: string } | null {
  const sep = value.indexOf(':')
  if (sep < 0) return null
  const prefix = value.slice(0, sep)
  const id = value.slice(sep + 1)
  if (prefix === 'material' && id) return { kind: 'material', id }
  if (prefix === 'component' && id) return { kind: 'component', id }
  if (prefix === 'gfc-component' && id) return { kind: 'gfc-component', id }
  return null
}

export function ProductBomModal({
  product,
  selectedBrand,
  categorySortOrders,
  brandProducts,
  theme = 'blue',
  guestMode = false,
  onClose,
  onOpenProcurement,
}: ProductBomModalProps) {
  const productId = product.id || product.product_id
  const [bomItems, setBomItems] = useState<ProductBomItem[]>([])
  const [bomSettings, setBomSettings] = useState<ProductBomSettings>({
    quantity_mode: 'unit',
    yield_per_batch: null,
  })
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lineToAdd, setLineToAdd] = useState('')
  const [addQty, setAddQty] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [draftYieldPerBatch, setDraftYieldPerBatch] = useState('1')
  const [gfcComponentProducts, setGfcComponentProducts] = useState<BomComponentProduct[]>([])
  const [gfcCategorySortOrders, setGfcCategorySortOrders] = useState<
    Record<string, number>
  >({})
  const [activeComponentProductIds, setActiveComponentProductIds] = useState<Set<string>>(
    () => new Set()
  )

  const bomLocked = bomItems.length > 0
  const { brands } = useBrands()
  const factoryBrand = useMemo(() => getFactoryBrand(brands), [brands])
  const bomMaterialBrandId = factoryBrand?.id || selectedBrand.id
  const showGfcComponentPicker = Boolean(
    factoryBrand && selectedBrand.id !== factoryBrand.id
  )

  const themeClasses = {
    green: 'bg-green-600 hover:bg-green-700',
    red: 'bg-red-600 hover:bg-red-700',
    yellow: 'bg-yellow-600 hover:bg-yellow-700',
    blue: 'bg-blue-600 hover:bg-blue-700',
  }[theme]

  const loadData = async () => {
    if (!productId) return
    setLoading(true)
    try {
      const gfcLoadPromise =
        showGfcComponentPicker && factoryBrand
          ? loadBomComponentProductsForBrand(factoryBrand.id)
          : Promise.resolve({ products: [] as BomComponentProduct[], categorySortOrders: {} })

      const activeComponentIdsPromise = factoryBrand
        ? loadActiveComponentLinkedProductIds(factoryBrand.id)
        : selectedBrand.id
          ? loadActiveComponentLinkedProductIds(selectedBrand.id)
          : Promise.resolve(new Set<string>())

      const [bomRes, matsRes, productRes, gfcLoad, activeComponentIds] = await Promise.all([
        supabase
          .from('product_bom_items')
          .select(BOM_SELECT)
          .eq('product_id', productId)
          .order('created_at', { ascending: true }),
        supabase.from('raw_materials').select(RAW_MATERIALS_SELECT)
          .eq('brand_id', bomMaterialBrandId)
          .eq('is_active', true)
          .order('material_name'),
        supabase
          .from('products')
          .select('bom_quantity_mode, bom_yield_per_batch')
          .eq('id', productId)
          .maybeSingle(),
        gfcLoadPromise,
        activeComponentIdsPromise,
      ])

      setGfcComponentProducts(gfcLoad.products)
      setGfcCategorySortOrders(gfcLoad.categorySortOrders)
      setActiveComponentProductIds(activeComponentIds)

      const items = bomRes.error
        ? []
        : ((bomRes.data || []) as unknown as ProductBomItem[])
      if (bomRes.error) console.warn('product_bom_items:', bomRes.error.message)
      setBomItems(items)

      let settings: ProductBomSettings = { quantity_mode: 'unit', yield_per_batch: null }
      if (productRes.data && !productRes.error) {
        settings = parseProductBomSettings(productRes.data)
      } else if (items.length > 0) {
        settings = inferBomSettingsFromItems(items)
      }
      setBomSettings(settings)
      setDraftYieldPerBatch(String(settings.yield_per_batch ?? 1))

      if (matsRes.error) throw matsRes.error
      setRawMaterials((matsRes.data || []) as RawMaterial[])

      const brandName = selectedBrand.name.trim()
      if (brandName) {
        const gfcComponentIds = new Set(gfcLoad.products.map((p) => p.id).filter(Boolean))
        for (const item of items) {
          const mat = item.material
          const linkedId = mat?.linked_product_id
          if (!mat?.id || !linkedId) continue
          const linkedProduct =
            brandProducts.find((p) => (p.id || p.product_id) === linkedId) ??
            gfcLoad.products.find((p) => p.id === linkedId)
          const sortOrders = gfcComponentIds.has(linkedId)
            ? gfcLoad.categorySortOrders
            : categorySortOrders
          if (linkedProduct && isProductBomComponent(linkedProduct, sortOrders)) {
            try {
              const ownerNames =
                gfcComponentIds.has(linkedId) && factoryBrand
                  ? [factoryBrand.name, brandName]
                  : [brandName]
              await syncBomComponentMaterialCatalogFields(mat.id, ownerNames)
            } catch (syncErr) {
              console.warn('component material catalog sync:', syncErr)
            }
          }
        }
      }
    } catch (err) {
      console.error('Error loading BOM:', err)
      alert('Failed to load bill of materials.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [productId, selectedBrand.id, bomMaterialBrandId, showGfcComponentPicker])

  const localComponentProducts = useMemo(() => {
    const isFactoryBrandView = Boolean(factoryBrand && selectedBrand.id === factoryBrand.id)
    return brandProducts
      .filter((p) => isProductBomComponent(p, categorySortOrders))
      .filter((p) => {
        const id = p.id || p.product_id
        if (!id) return false
        // On GFC Main / factory, only list Components that are still in Factory → Components.
        if (isFactoryBrandView) return activeComponentProductIds.has(id)
        return true
      })
      .map(toComponentProduct)
      .filter((p): p is BomComponentProduct => p != null)
  }, [
    brandProducts,
    categorySortOrders,
    activeComponentProductIds,
    factoryBrand,
    selectedBrand.id,
  ])

  const componentProducts = useMemo(() => {
    const seen = new Set<string>()
    const merged: BomComponentProduct[] = []
    for (const p of [...localComponentProducts, ...gfcComponentProducts]) {
      if (!p.id || seen.has(p.id)) continue
      seen.add(p.id)
      merged.push(p)
    }
    return merged
  }, [localComponentProducts, gfcComponentProducts])

  const componentProductIds = useMemo(
    () => new Set(componentProducts.map((p) => p.id).filter(Boolean)),
    [componentProducts]
  )

  const componentById = useMemo(() => {
    const map = new Map<string, BomComponentProduct>()
    for (const p of componentProducts) {
      if (p.id) map.set(p.id, p)
    }
    return map
  }, [componentProducts])

  const usedMaterialIds = useMemo(
    () => new Set(bomItems.map((b) => b.material_id)),
    [bomItems]
  )

  const usedComponentProductIds = useMemo(() => {
    const ids = new Set<string>()
    for (const item of bomItems) {
      const linked = item.material?.linked_product_id
      if (linked && componentProductIds.has(linked)) ids.add(linked)
    }
    return ids
  }, [bomItems, componentProductIds])

  const availableMaterials = useMemo(
    () =>
      rawMaterials.filter((m) => {
        if (usedMaterialIds.has(m.id)) return false
        // Components belong in the Components optgroup when actively linked.
        if (
          isComponentMaterialCategory(m.category) &&
          m.linked_product_id &&
          activeComponentProductIds.has(m.linked_product_id)
        ) {
          return false
        }
        if (m.linked_product_id && componentProductIds.has(m.linked_product_id)) {
          return false
        }
        return true
      }),
    [rawMaterials, usedMaterialIds, componentProductIds, activeComponentProductIds]
  )

  const availableLocalComponents = useMemo(
    () =>
      localComponentProducts.filter((p) => {
        const id = p.id
        if (!id || id === productId) return false
        return !usedComponentProductIds.has(id)
      }),
    [localComponentProducts, productId, usedComponentProductIds]
  )

  const availableGfcComponents = useMemo(
    () =>
      gfcComponentProducts.filter((p) => {
        const id = p.id
        if (!id || id === productId) return false
        return !usedComponentProductIds.has(id)
      }),
    [gfcComponentProducts, productId, usedComponentProductIds]
  )

  const totalCostPerUnit = useMemo(
    () =>
      bomItems.reduce(
        (sum, item) => sum + lineCostPerProductUnit(item, bomSettings),
        0
      ),
    [bomItems, bomSettings]
  )

  const persistProductBomSettings = async (
    next: ProductBomSettings
  ): Promise<boolean> => {
    if (!productId || guestMode) return false
    const { error } = await supabase
      .from('products')
      .update({
        bom_quantity_mode: next.quantity_mode,
        bom_yield_per_batch:
          next.quantity_mode === 'batch' ? next.yield_per_batch : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)

    if (error) {
      if (error.message.includes('bom_quantity_mode')) {
        alert('Run migrations/product-bom-product-settings.sql in Supabase first.')
      } else {
        alert(error.message)
      }
      return false
    }
    setBomSettings(next)
    try {
      await syncComponentCostFromBom(productId)
    } catch (err) {
      console.warn('syncComponentCostFromBom:', err)
    }
    return true
  }

  const applyQuantityMode = async (mode: BomQuantityMode) => {
    if (bomLocked || guestMode) return
    const next: ProductBomSettings = {
      quantity_mode: mode,
      yield_per_batch: mode === 'batch' ? Number(draftYieldPerBatch) || 1 : null,
    }
    if (mode === 'batch') {
      const parsed = parseFloat(draftYieldPerBatch)
      if (!parsed || parsed <= 0) {
        alert('Enter units per batch (finished units per batch) greater than 0.')
        return
      }
      next.yield_per_batch = parsed
    }
    await persistProductBomSettings(next)
  }

  const applyYieldPerBatch = async () => {
    if (bomLocked || guestMode || bomSettings.quantity_mode !== 'batch') return
    const parsed = parseFloat(draftYieldPerBatch)
    if (!parsed || parsed <= 0) {
      alert('Enter units per batch greater than 0.')
      return
    }
    await persistProductBomSettings({
      quantity_mode: 'batch',
      yield_per_batch: parsed,
    })
  }

  const insertBomLine = async (
    materialId: string,
    displayQty: number,
    notes: string
  ): Promise<boolean> => {
    const addMaterial = rawMaterials.find((m) => m.id === materialId)
    const qty = addMaterial
      ? bomDisplayQtyToBaseQty(displayQty, addMaterial)
      : displayQty
    if (bomSettings.quantity_mode === 'batch') {
      const y = Number(bomSettings.yield_per_batch) || 0
      if (y <= 0) {
        alert('Set units per batch above before adding materials.')
        return false
      }
    }

    if (!bomLocked) {
      const ok = await persistProductBomSettings(bomSettings)
      if (!ok) return false
    }

    const lineYield =
      bomSettings.quantity_mode === 'batch' ? bomSettings.yield_per_batch : null

    const { error } = await supabase.from('product_bom_items').insert({
      product_id: productId,
      material_id: materialId,
      quantity: qty,
      quantity_mode: bomSettings.quantity_mode,
      yield_per_batch: lineYield,
      notes: notes.trim() || null,
    })
    if (error) {
      if (error.message.includes('quantity_mode')) {
        alert('Run migrations/product-bom-quantity-mode.sql in Supabase first.')
      } else if (error.code === '23505') alert('That line is already on this BOM.')
      else throw error
      return false
    }
    return true
  }

  const handleAddLine = async () => {
    if (!productId || !lineToAdd || guestMode) return
    const picked = parseBomLinePicker(lineToAdd)
    if (!picked) return
    const displayQty = parseFloat(addQty)
    if (!displayQty || displayQty <= 0) {
      alert('Enter a valid quantity greater than 0.')
      return
    }
    setSaving(true)
    try {
      let materialId = picked.id
      if (picked.kind === 'component' || picked.kind === 'gfc-component') {
        const component = componentById.get(picked.id)
        if (!component) return
        if (picked.kind === 'gfc-component' && factoryBrand) {
          materialId = await ensureBomComponentMaterial(component, {
            materialBrand: factoryBrand,
            ownerBrandNames: [factoryBrand.name, selectedBrand.name],
          })
        } else {
          materialId = await ensureBomComponentMaterial(component, selectedBrand)
        }
      }
      const ok = await insertBomLine(materialId, displayQty, addNotes)
      if (!ok) return
      setLineToAdd('')
      setAddQty('')
      setAddNotes('')
      await loadData()
      try {
        await syncComponentCostFromBom(productId)
      } catch (err) {
        console.warn('syncComponentCostFromBom:', err)
      }
    } catch (err) {
      console.error(err)
      alert('Could not add line. Run migrations/product-bom.sql if the table is missing.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateQty = async (
    item: ProductBomItem,
    displayQuantity: number
  ) => {
    if (guestMode || displayQuantity <= 0) return
    const mat = item.material
    const quantity = mat
      ? bomDisplayQtyToBaseQty(displayQuantity, mat)
      : displayQuantity
    if (quantity <= 0) return
    try {
      const { error } = await supabase
        .from('product_bom_items')
        .update({ quantity, updated_at: new Date().toISOString() })
        .eq('id', item.id)
      if (error) throw error
      setBomItems((prev) =>
        prev.map((b) => (b.id === item.id ? { ...b, quantity } : b))
      )
      try {
        await syncComponentCostFromBom(productId)
      } catch (err) {
        console.warn('syncComponentCostFromBom:', err)
      }
    } catch (err) {
      console.error(err)
      alert('Failed to update quantity.')
      await loadData()
    }
  }

  const handleRemove = async (itemId: string) => {
    if (guestMode || !confirm('Remove this material from the bill of materials?')) return
    try {
      const { error } = await supabase.from('product_bom_items').delete().eq('id', itemId)
      if (error) throw error
      const nextItems = bomItems.filter((b) => b.id !== itemId)
      setBomItems(nextItems)
      try {
        await syncComponentCostFromBom(productId)
      } catch (err) {
        console.warn('syncComponentCostFromBom:', err)
      }
    } catch (err) {
      console.error(err)
      alert('Failed to remove line.')
    }
  }

  const productLabel = product.product_name || product.name || 'Product'
  const productSku = product.sku || '—'
  const pickedLine = parseBomLinePicker(lineToAdd)
  const materialToAddRow =
    pickedLine?.kind === 'material'
      ? rawMaterials.find((m) => m.id === pickedLine.id)
      : undefined
  const componentToAddRow =
    pickedLine?.kind === 'component' || pickedLine?.kind === 'gfc-component'
      ? componentById.get(pickedLine.id)
      : undefined
  const addQtyUnitLabel = materialToAddRow
    ? getBomDisplayUnitLabel(materialToAddRow)
    : componentToAddRow?.unit?.trim() || 'unit'
  const qtyColumnLabel = `Qty (${bomQtyBasisLabel(bomSettings.quantity_mode)}, ${addQtyUnitLabel})`
  const tableQtyColumnLabel = `Qty (${bomQtyBasisLabel(bomSettings.quantity_mode)})`
  const canAddMoreLines =
    availableMaterials.length > 0 ||
    availableLocalComponents.length > 0 ||
    availableGfcComponents.length > 0
  const parsedAddQty = parseFloat(addQty)
  const addQtyValid = addQty.trim() !== '' && Number.isFinite(parsedAddQty) && parsedAddQty > 0

  return (
    <Modal onClose={onClose} backdropClassName="bg-gray-600/50">
      <div className="mx-auto p-6 border w-11/12 md:w-[92%] lg:max-w-5xl shadow-lg rounded-lg bg-white max-h-[90vh] overflow-y-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4 pb-4 border-b border-gray-200">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5 text-slate-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-gray-900">Bill of Materials</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                {productLabel} <span className="text-gray-400">·</span> {productSku}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 shrink-0">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,320px)_1fr] gap-5 items-start">
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-sm font-medium text-gray-800">Quantity basis</p>
                {bomLocked && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-full px-2 py-0.5">
                    <Lock className="h-3.5 w-3.5" />
                    Locked
                  </span>
                )}
              </div>

              {loading ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : bomLocked ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-900">
                  <span className="font-medium capitalize">
                    Per {bomQtyBasisLabel(bomSettings.quantity_mode)}
                  </span>
                  {bomSettings.quantity_mode === 'batch' && bomSettings.yield_per_batch ? (
                    <span className="text-gray-600 tabular-nums">
                      · {formatQty(bomSettings.yield_per_batch)} units / batch
                    </span>
                  ) : null}
                </div>
              ) : !guestMode ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => applyQuantityMode('unit')}
                      className={`flex-1 px-2 py-2 text-xs font-medium rounded-lg border ${
                        bomSettings.quantity_mode === 'unit'
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Per unit
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => applyQuantityMode('batch')}
                      className={`flex-1 px-2 py-2 text-xs font-medium rounded-lg border ${
                        bomSettings.quantity_mode === 'batch'
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Per batch
                    </button>
                  </div>
                  {bomSettings.quantity_mode === 'batch' && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Finished units per batch
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={draftYieldPerBatch}
                        onChange={(e) => setDraftYieldPerBatch(e.target.value)}
                        onBlur={applyYieldPerBatch}
                        disabled={saving}
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Per unit (default)</p>
              )}

              {!guestMode && (
                <>
                  <div className="border-t border-gray-200 my-4" />
                  <h3 className="text-sm font-medium text-gray-800 mb-3">Add to BOM</h3>
                  <div className="space-y-3">
                  <div className="flex gap-2 items-end">
                    <div className="min-w-0 flex-1">
                      <label className="block text-xs text-gray-600 mb-1.5">Material</label>
                      <select
                        value={lineToAdd}
                        onChange={(e) => setLineToAdd(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                        disabled={saving || !canAddMoreLines}
                      >
                        <option value="">
                          {!canAddMoreLines
                            ? 'No more lines to add'
                            : 'Select item'}
                        </option>
                        {availableMaterials.length > 0 && (
                          <optgroup label="Raw materials">
                            {availableMaterials.map((m) => (
                              <option
                                key={m.id}
                                value={`material:${m.id}` satisfies BomLinePickerValue}
                              >
                                {m.sku ? `${m.sku} - ` : ''}
                                {m.material_name} ({getBomDisplayUnitLabel(m)})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {availableLocalComponents.length > 0 && (
                          <optgroup label="Components">
                            {availableLocalComponents.map((p) => (
                              <option
                                key={p.id}
                                value={`component:${p.id}` satisfies BomLinePickerValue}
                              >
                                {p.sku ? `${p.sku} - ` : ''}
                                {p.product_name || p.name} ({p.unit || 'pcs'})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {availableGfcComponents.length > 0 && factoryBrand && (
                          <optgroup label={`${factoryBrand.name} — Components`}>
                            {availableGfcComponents.map((p) => (
                              <option
                                key={p.id}
                                value={`gfc-component:${p.id}` satisfies BomLinePickerValue}
                              >
                                {p.sku ? `${p.sku} - ` : ''}
                                {p.product_name || p.name} ({p.unit || 'pcs'})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                    <div className="w-14 shrink-0">
                      <label className="block text-xs text-gray-600 mb-1.5 truncate" title={qtyColumnLabel}>
                        Qty
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={addQty}
                        onChange={(e) => setAddQty(e.target.value)}
                        className="w-full px-1 py-2 border rounded-lg text-sm bg-white tabular-nums text-center"
                        disabled={saving}
                        required
                        placeholder="0"
                        title={qtyColumnLabel}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1.5">Notes</label>
                    <input
                      type="text"
                      value={addNotes}
                      onChange={(e) => setAddNotes(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                      disabled={saving}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    disabled={saving || !lineToAdd || !addQtyValid}
                    className={`flex items-center justify-center gap-1 w-full px-3 py-2 text-white text-sm rounded-lg disabled:opacity-50 ${themeClasses}`}
                  >
                    <Plus className="h-4 w-4" />
                    Add to BOM
                  </button>
                  </div>
                </>
              )}
            </div>

            {onOpenProcurement && !guestMode && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenProcurement()
                }}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800"
              >
                <ExternalLink className="h-4 w-4" />
                Open Procurement → Materials Inventory
              </button>
            )}
          </div>

          <div className="min-w-0 rounded-lg border border-gray-200 bg-white overflow-hidden">
            <h3 className="text-sm font-medium text-gray-800 px-4 py-3 border-b border-gray-200 bg-gray-50">
              Materials list
            </h3>
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading…</div>
            ) : bomItems.length === 0 ? (
              <div className="text-center py-12 px-4 text-gray-500">
                <p>No materials linked yet.</p>
                {!guestMode && (
                  <p className="text-sm mt-1">
                    Set quantity basis on the left, then add materials or components.
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-gray-200 text-sm min-w-[440px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Material
                      </th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        {tableQtyColumnLabel}
                      </th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        / prod unit
                      </th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Cost
                      </th>
                      {!guestMode && <th className="px-2 py-2 w-10" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {bomItems.map((item) => {
                      const mat = item.material
                      const linkedProductId = mat?.linked_product_id
                      const componentProduct =
                        linkedProductId && componentProductIds.has(linkedProductId)
                          ? componentById.get(linkedProductId)
                          : undefined
                      const isComponentLine = Boolean(componentProduct)
                      const lineLabel =
                        componentProduct?.product_name ||
                        componentProduct?.name ||
                        mat?.material_name ||
                        '—'
                      const perUnitBase = effectiveBomQtyPerProductUnit(item, bomSettings)
                      const displayQty = mat
                        ? bomBaseQtyToDisplayQty(item.quantity, mat)
                        : item.quantity
                      const perUnitDisplay = mat
                        ? bomBaseQtyToDisplayQty(perUnitBase, mat)
                        : perUnitBase
                      const displayUnit = isComponentLine
                        ? componentProduct?.unit?.trim() || 'pcs'
                        : mat
                          ? getBomDisplayUnitLabel(mat)
                          : '—'
                      const itemNameUnitLabel = isComponentLine
                        ? componentProduct?.unit?.trim() || 'pcs'
                        : mat
                          ? getPurchaseUnitLabel(mat)
                          : '—'
                      const lineCost = lineCostPerProductUnit(item, bomSettings)

                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-900">
                            <div className="truncate max-w-[180px]" title={lineLabel}>
                              {lineLabel}
                            </div>
                            <div className="text-xs text-gray-500">
                              {itemNameUnitLabel}
                              {isComponentLine ? (
                                <span className="ml-1 text-violet-700">· component</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right">
                            {guestMode ? (
                              <span className="tabular-nums whitespace-nowrap">
                                {formatQty(displayQty)} {displayUnit}
                              </span>
                            ) : (
                              <div className="inline-flex flex-col items-end gap-0.5">
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  defaultValue={displayQty}
                                  key={`${item.id}-q-${item.quantity}-${mat?.factory_bom_uom ?? 'base'}`}
                                  onBlur={(e) => {
                                    const v = parseFloat(e.target.value)
                                    if (
                                      !Number.isNaN(v) &&
                                      Math.abs(v - displayQty) > 1e-9
                                    ) {
                                      handleUpdateQty(item, v)
                                    }
                                  }}
                                  className="w-20 max-w-full px-1.5 py-1 border rounded text-sm text-right"
                                />
                                <span className="text-[10px] text-gray-400">{displayUnit}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-gray-600 text-xs whitespace-nowrap">
                            {formatQty(perUnitDisplay)}
                            <span className="block text-[10px] text-gray-400">{displayUnit}</span>
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-gray-900 whitespace-nowrap">
                            {formatMoney(lineCost)}
                          </td>
                          {!guestMode && (
                            <td className="px-2 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemove(item.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Remove"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={4} className="px-3 py-2.5 text-sm text-right">
                        <span className="font-semibold text-gray-900">Total cost per unit</span>
                        <span className="ml-4 font-semibold text-gray-900 tabular-nums">
                          {formatMoney(totalCostPerUnit)}
                        </span>
                      </td>
                      {!guestMode && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
