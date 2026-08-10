'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layers, Plus, RefreshCw } from 'lucide-react'
import type { Brand, Product, RawMaterial, Supplier } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import {
  linkComponentMaterialToProduct,
  loadFactoryComponentsCatalog,
  type FactoryComponentRow,
} from '../../lib/factory-components'
import {
  BOM_COMPONENT_MATERIAL_CATEGORY,
  fetchCategorySortOrdersForBrand,
  syncComponentCostFromBom,
} from '../../lib/product-bom-component'
import { ProductBomModal } from './ProductBomModal'
import {
  MaterialModal,
  ownerBrandSlugMapFromBrands,
  parseMoneyInput,
  parseWholeQuantityInput,
  sortOwnerOptions,
} from './PurchasingManager'
import { isFactoryInventoryKind } from '../../lib/factory-inventory'
import { isFactoryBomUom } from '../../lib/raw-material-uom'

interface FactoryComponentsPanelProps {
  factoryBrand: Brand
  theme?: string
  currentUsername?: string
  readOnlyMode?: boolean
  variant?: 'default' | 'floor'
}

function formatQty(qty: number) {
  if (!Number.isFinite(qty)) return '0'
  return Number.isInteger(qty)
    ? qty.toLocaleString()
    : qty.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      })
}

function UsedInList({
  items,
  max = 3,
  className = '',
}: {
  items: FactoryComponentRow['usedInFinishedGoods']
  max?: number
  className?: string
}) {
  if (items.length === 0) {
    return (
      <span className={`text-gray-400 ${className}`}>
        Not used in any finished-good BOM yet
      </span>
    )
  }
  const shown = items.slice(0, max)
  const rest = items.length - shown.length
  return (
    <span className={className}>
      {shown.map((u, i) => (
        <span key={u.productId}>
          {i > 0 ? ', ' : ''}
          {u.productName}
          <span className="text-gray-400"> ({u.brandName})</span>
        </span>
      ))}
      {rest > 0 ? <span className="text-gray-500"> +{rest} more</span> : null}
    </span>
  )
}

export function FactoryComponentsPanel({
  factoryBrand,
  theme = 'blue',
  currentUsername = '',
  readOnlyMode = false,
  variant = 'default',
}: FactoryComponentsPanelProps) {
  const canEdit = !readOnlyMode
  const isFloor = variant === 'floor'

  const [rows, setRows] = useState<FactoryComponentRow[]>([])
  const [brands, setBrands] = useState<Brand[]>([factoryBrand])
  const [brandProducts, setBrandProducts] = useState<Product[]>([])
  const [allMaterials, setAllMaterials] = useState<RawMaterial[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categorySortOrders, setCategorySortOrders] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showMaterialModal, setShowMaterialModal] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null)
  const [bomProduct, setBomProduct] = useState<Product | null>(null)

  const themeBtn =
    theme === 'green'
      ? 'bg-green-600 hover:bg-green-700'
      : theme === 'red'
        ? 'bg-red-600 hover:bg-red-700'
        : theme === 'yellow'
          ? 'bg-yellow-600 hover:bg-yellow-700'
          : 'bg-blue-600 hover:bg-blue-700'

  const ownerBrandSlugMap = useMemo(
    () => ownerBrandSlugMapFromBrands(brands),
    [brands]
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [catalog, productsRes, matsRes, suppliersRes, brandsRes, sortOrders] =
        await Promise.all([
          loadFactoryComponentsCatalog(factoryBrand.id),
          supabase.from('products').select('*').eq('brand_id', factoryBrand.id).order('name'),
          supabase
            .from('raw_materials')
            .select('*')
            .eq('is_active', true)
            .order('material_name'),
          supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
          supabase.from('brands').select('*').order('name'),
          fetchCategorySortOrdersForBrand(factoryBrand.id),
        ])
      setRows(catalog)
      setCategorySortOrders(sortOrders)
      setBrandProducts(
        productsRes.error ? [] : ((productsRes.data || []) as Product[])
      )
      setAllMaterials(
        matsRes.error ? [] : ((matsRes.data || []) as RawMaterial[])
      )
      setSuppliers(
        suppliersRes.error ? [] : ((suppliersRes.data || []) as Supplier[])
      )
      setBrands(
        brandsRes.error || !brandsRes.data?.length
          ? [factoryBrand]
          : (brandsRes.data as Brand[])
      )
    } catch (err) {
      console.error(err)
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to load components.'
      setLoadError(message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [factoryBrand.id])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const openBomForRow = async (row: FactoryComponentRow) => {
    try {
      let productId = row.linkedProductId
      if (!productId) {
        productId = await linkComponentMaterialToProduct({
          material: row.material as RawMaterial,
          brand: factoryBrand,
        })
        await loadData()
      }
      const fromBrand = brandProducts.find((p) => p.id === productId)
      if (fromBrand) {
        setBomProduct(fromBrand)
        return
      }
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()
      if (error) throw error
      setBomProduct(data as Product)
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Failed to open BOM.')
    }
  }

  const handleSaveMaterial = async (materialData: Partial<RawMaterial>) => {
    if (!canEdit) return

    const dataToSave = {
      ...materialData,
      supplier_id: materialData.supplier_id?.trim() ? materialData.supplier_id : null,
      unit_cost: parseMoneyInput(materialData.unit_cost),
      minimum_stock:
        typeof materialData.minimum_stock === 'string'
          ? parseWholeQuantityInput(materialData.minimum_stock)
          : Math.max(0, Math.floor(Number(materialData.minimum_stock) || 0)),
      current_stock:
        typeof materialData.current_stock === 'string'
          ? parseWholeQuantityInput(materialData.current_stock)
          : Math.max(0, Math.floor(Number(materialData.current_stock) || 0)),
      uom_base_per_unit:
        typeof materialData.uom_base_per_unit === 'string'
          ? Math.max(1, parseWholeQuantityInput(materialData.uom_base_per_unit))
          : Math.max(1, Math.floor(Number(materialData.uom_base_per_unit) || 1)),
      uom_stock_per_purchase:
        typeof materialData.uom_stock_per_purchase === 'string'
          ? Math.max(1, parseWholeQuantityInput(materialData.uom_stock_per_purchase))
          : Math.max(1, Math.floor(Number(materialData.uom_stock_per_purchase) || 1)),
      uom_base_unit: materialData.uom_base_unit || materialData.unit,
      uom_purchase_unit: materialData.uom_purchase_unit || materialData.unit,
      category: BOM_COMPONENT_MATERIAL_CATEGORY,
      linked_product_id: editingMaterial?.linked_product_id || null,
      factory_inventory_kind: isFactoryInventoryKind(materialData.factory_inventory_kind)
        ? materialData.factory_inventory_kind
        : 'ingredients',
      factory_request_uom:
        materialData.factory_request_uom === 'purchase' ? 'purchase' : 'stock',
      factory_bom_uom: isFactoryBomUom(materialData.factory_bom_uom)
        ? materialData.factory_bom_uom
        : 'stock',
      brand_id: factoryBrand.id,
      owner:
        (materialData.owner || []).length > 0
          ? materialData.owner
          : [factoryBrand.name],
    }

    if (editingMaterial) {
      const linkedProductId = editingMaterial.linked_product_id
      let bomUnitCost = 0
      if (linkedProductId) {
        try {
          bomUnitCost = await syncComponentCostFromBom(linkedProductId)
        } catch (err) {
          console.warn('syncComponentCostFromBom:', err)
        }
      }
      const { error } = await supabase
        .from('raw_materials')
        .update({
          ...dataToSave,
          unit_cost: linkedProductId ? bomUnitCost : dataToSave.unit_cost,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingMaterial.id)
      if (error) {
        alert(error.message)
        return
      }
      if (linkedProductId) {
        await supabase
          .from('products')
          .update({
            name: dataToSave.material_name,
            sku: dataToSave.sku || null,
            unit: dataToSave.unit,
            price: bomUnitCost,
            updated_at: new Date().toISOString(),
          })
          .eq('id', linkedProductId)
      }
    } else {
      const initialStock = Number(dataToSave.current_stock) || 0
      const { data: created, error } = await supabase
        .from('raw_materials')
        .insert([
          {
            ...dataToSave,
            current_stock: initialStock > 0 ? 0 : initialStock,
          },
        ])
        .select('*')
        .single()

      if (error) {
        alert(error.message)
        return
      }

      if (created) {
        if (initialStock > 0) {
          await supabase.from('material_stock_movements').insert({
            material_id: created.id,
            movement_type: 'in',
            quantity: initialStock,
            unit_cost: dataToSave.unit_cost,
            reference_type: 'opening',
            notes: 'Opening stock — component',
            movement_date: new Date().toISOString().split('T')[0],
            created_by: currentUsername.trim() || 'Factory',
          })
        }

        try {
          const productId = await linkComponentMaterialToProduct({
            material: created as RawMaterial,
            brand: factoryBrand,
          })
          setShowMaterialModal(false)
          setEditingMaterial(null)
          await loadData()
          const { data: product } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single()
          if (product) setBomProduct(product as Product)
          return
        } catch (linkErr) {
          console.warn(linkErr)
        }
      }
    }

    setShowMaterialModal(false)
    setEditingMaterial(null)
    await loadData()
  }

  const existingCategories = useMemo(
    () =>
      Array.from(
        new Set([
          BOM_COMPONENT_MATERIAL_CATEGORY,
          ...allMaterials
            .map((m) => m.category?.trim())
            .filter((c): c is string => Boolean(c)),
        ])
      ).sort((a, b) => a.localeCompare(b)),
    [allMaterials]
  )

  const ownerOptions = useMemo(
    () =>
      sortOwnerOptions(
        Array.from(
          new Set([
            factoryBrand.name,
            ...brands.map((b) => b.name),
            ...allMaterials
              .flatMap((m) => (m.owner ?? []).map((o) => o.trim()))
              .filter(Boolean),
          ])
        ),
        ownerBrandSlugMap
      ),
    [allMaterials, brands, factoryBrand.name, ownerBrandSlugMap]
  )

  return (
    <div className={isFloor ? 'space-y-3' : 'space-y-4'}>
      {!isFloor ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Components</h2>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl leading-relaxed">
              Procurement materials in the Components category. Add them here (same form as
              Materials Inventory). Production credits procurement stock directly — no export
              step.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {canEdit ? (
              <button
                type="button"
                onClick={() => {
                  setEditingMaterial(null)
                  setShowMaterialModal(true)
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-white rounded-md ${themeBtn}`}
              >
                <Plus className="h-4 w-4" />
                Add component
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="px-3 pt-1">
          <p className="text-xs text-gray-600 leading-relaxed">
            Components live in procurement Materials Inventory. Production updates stock
            automatically.
          </p>
        </div>
      )}

      {loading ? (
        <div className={`space-y-3 animate-pulse ${isFloor ? 'px-3' : ''}`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : loadError ? (
        <div
          className={`text-center py-10 ${isFloor ? 'px-3' : 'rounded-lg border border-red-200 bg-red-50'}`}
        >
          <p className="text-sm text-red-800">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadData()}
            className="mt-3 text-sm font-medium text-red-900 underline"
          >
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div
          className={`text-center py-10 ${isFloor ? 'px-3' : 'rounded-lg border border-gray-200 bg-gray-50'}`}
        >
          <Layers className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600">
            No components yet.
            {!isFloor && canEdit
              ? ' Add a Components-category material — it will appear here and in Materials Inventory.'
              : isFloor
                ? ' Add them from Dashboard → Factory → Components.'
                : ''}
          </p>
          {!isFloor && canEdit ? (
            <button
              type="button"
              onClick={() => {
                setEditingMaterial(null)
                setShowMaterialModal(true)
              }}
              className={`mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white rounded-lg ${themeBtn}`}
            >
              <Plus className="h-4 w-4" />
              Add component
            </button>
          ) : null}
        </div>
      ) : isFloor ? (
        <div className="px-3 pb-4 space-y-2.5">
          {rows.map((row) => {
            const unit = row.material.unit?.trim() || 'pcs'
            return (
              <article
                key={row.material.id}
                className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">
                      {row.material.material_name}
                    </p>
                    {row.material.sku ? (
                      <p className="text-xs text-gray-400 font-mono mt-0.5">
                        {row.material.sku}
                      </p>
                    ) : null}
                    {row.bomLineCount === 0 ? (
                      <p className="text-[11px] font-medium text-amber-700 mt-1">Needs BOM</p>
                    ) : null}
                  </div>
                  <p className="text-sm font-bold tabular-nums text-gray-900 shrink-0">
                    {formatQty(Number(row.material.current_stock) || 0)} {unit}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Used in{' '}
                  {row.usedInFinishedGoods.length === 0
                    ? 'no finished-good BOM yet'
                    : `${row.usedInFinishedGoods.length} finished-good product${row.usedInFinishedGoods.length === 1 ? '' : 's'}`}
                </p>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full">
            <thead className="bg-gray-50/80">
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Component
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Procurement stock
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Own BOM
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Used in
                </th>
                {canEdit ? (
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => {
                const unit = row.material.unit?.trim() || 'pcs'
                return (
                  <tr key={row.material.id} className="bg-white hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {row.material.material_name}
                      </div>
                      {row.material.sku ? (
                        <div className="text-xs text-gray-400 font-mono mt-0.5">
                          {row.material.sku}
                        </div>
                      ) : null}
                      <div className="text-xs text-gray-500 mt-0.5">
                        {unit} · {row.material.category || BOM_COMPONENT_MATERIAL_CATEGORY}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm tabular-nums text-gray-900">
                      {formatQty(Number(row.material.current_stock) || 0)} {unit}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {row.bomLineCount === 0 ? (
                        <span className="text-amber-700 font-medium">Needs BOM</span>
                      ) : (
                        <>
                          {row.bomLineCount} line{row.bomLineCount === 1 ? '' : 's'}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 max-w-xs">
                      <UsedInList items={row.usedInFinishedGoods} />
                    </td>
                    {canEdit ? (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const full = allMaterials.find((m) => m.id === row.material.id)
                              setEditingMaterial(full || (row.material as RawMaterial))
                              setShowMaterialModal(true)
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void openBomForRow(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100"
                          >
                            <Layers className="h-3.5 w-3.5" />
                            BOM
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showMaterialModal && canEdit && !isFloor ? (
        <MaterialModal
          material={editingMaterial}
          brandId={factoryBrand.id}
          allMaterials={allMaterials}
          suppliers={suppliers}
          existingCategories={existingCategories}
          ownerOptions={ownerOptions}
          ownerBrandSlugMap={ownerBrandSlugMap}
          presets={{
            category: BOM_COMPONENT_MATERIAL_CATEGORY,
            lockCategory: true,
            factoryInventoryKind: 'ingredients',
            owners: [factoryBrand.name],
            titleAdd: 'Add component',
            titleEdit: 'Edit component',
            buttonAdd: 'Add component',
            buttonEdit: 'Update component',
            compact: true,
          }}
          onSave={handleSaveMaterial}
          onClose={() => {
            setShowMaterialModal(false)
            setEditingMaterial(null)
          }}
        />
      ) : null}

      {bomProduct ? (
        <ProductBomModal
          product={bomProduct}
          selectedBrand={factoryBrand}
          categorySortOrders={categorySortOrders}
          brandProducts={brandProducts}
          theme={theme}
          onClose={() => {
            setBomProduct(null)
            void loadData()
          }}
        />
      ) : null}
    </div>
  )
}
