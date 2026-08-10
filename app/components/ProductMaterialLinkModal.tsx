'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { supabase, type Brand, type Product, type RawMaterial } from '../../lib/supabase'
import {
  getProductMaterialInventoryUnitLabel,
  getProductMaterialInventoryUom,
  materialSupportsPurchaseUom,
  formatMaterialStockAvailable,
  saveProductMaterialLink,
  type ProductMaterialInventoryUom,
} from '../../lib/product-material-link'
import { getStockUnitLabel } from '../../lib/raw-material-uom'
import { isProductConsumableSupply } from '../../lib/product-category-settings'
import { Modal } from './Modal'

interface ProductMaterialLinkModalProps {
  product: Product
  selectedBrand: Brand
  categorySortOrders: Record<string, number>
  theme?: string
  guestMode?: boolean
  onClose: () => void
  onSaved: () => void
  onOpenProcurement?: () => void
}

function materialVisibleToBrand(material: RawMaterial, brand: Brand) {
  if (material.brand_id === brand.id) return true
  const owners = (material.owner ?? []).map((o) => o.trim()).filter(Boolean)
  return owners.includes(brand.name)
}

function ownerGroupKey(material: RawMaterial, selectedBrand: Brand): string {
  const owners = (material.owner ?? []).map((o) => o.trim()).filter(Boolean)
  if (owners.length === 0) return 'No owner'
  if (owners.includes(selectedBrand.name)) return selectedBrand.name
  return [...owners].sort((a, b) => a.localeCompare(b))[0]
}

function groupMaterialsByOwner(materials: RawMaterial[], selectedBrand: Brand) {
  const groups = new Map<string, RawMaterial[]>()

  for (const material of materials) {
    const owner = ownerGroupKey(material, selectedBrand)
    const list = groups.get(owner) ?? []
    list.push(material)
    groups.set(owner, list)
  }

  for (const list of Array.from(groups.values())) {
    list.sort((a, b) => a.material_name.localeCompare(b.material_name))
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      if (a === selectedBrand.name) return -1
      if (b === selectedBrand.name) return 1
      if (a === 'No owner') return 1
      if (b === 'No owner') return -1
      return a.localeCompare(b)
    })
    .map(([owner, items]) => ({ owner, materials: items }))
}

export function ProductMaterialLinkModal({
  product,
  selectedBrand,
  categorySortOrders,
  theme = 'blue',
  guestMode = false,
  onClose,
  onSaved,
  onOpenProcurement,
}: ProductMaterialLinkModalProps) {
  const productId = product.product_id || product.id || ''
  const isConsumable = isProductConsumableSupply(product, categorySortOrders)

  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [savingLink, setSavingLink] = useState(false)

  const [materialId, setMaterialId] = useState(product.linked_material_id || '')
  const [inventoryUom, setInventoryUom] = useState<ProductMaterialInventoryUom>(
    getProductMaterialInventoryUom(product.material_inventory_uom)
  )

  const themeBtn =
    theme === 'green'
      ? 'bg-green-600 hover:bg-green-700'
      : theme === 'red'
        ? 'bg-red-600 hover:bg-red-700'
        : theme === 'yellow'
          ? 'bg-yellow-600 hover:bg-yellow-700'
          : 'bg-blue-600 hover:bg-blue-700'

  const loadMaterials = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*')
        .eq('is_active', true)
        .order('material_name')

      if (error) throw error
      const visible = ((data || []) as RawMaterial[]).filter((m) =>
        materialVisibleToBrand(m, selectedBrand)
      )
      setMaterials(visible)
    } catch (err) {
      console.error(err)
      setMaterials([])
    } finally {
      setLoading(false)
    }
  }, [selectedBrand])

  useEffect(() => {
    loadMaterials()
  }, [loadMaterials])

  const materialsByOwner = useMemo(
    () => groupMaterialsByOwner(materials, selectedBrand),
    [materials, selectedBrand]
  )

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === materialId),
    [materials, materialId]
  )

  const canUsePurchaseUom = selectedMaterial
    ? materialSupportsPurchaseUom(selectedMaterial)
    : false

  useEffect(() => {
    if (selectedMaterial && !canUsePurchaseUom && inventoryUom === 'purchase') {
      setInventoryUom('stock')
    }
  }, [selectedMaterial, canUsePurchaseUom, inventoryUom])

  const handleSaveLink = async () => {
    if (!materialId) {
      alert('Select a material from Materials Inventory.')
      return
    }
    setSavingLink(true)
    try {
      await saveProductMaterialLink({
        productId,
        materialId,
        materialInventoryUom: inventoryUom,
        previousMaterialId: product.linked_material_id,
      })
      onSaved()
      onClose()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save link.')
    } finally {
      setSavingLink(false)
    }
  }

  const materialAvailableLabel =
    selectedMaterial != null
      ? formatMaterialStockAvailable(
          Number(selectedMaterial.current_stock) || 0,
          inventoryUom,
          selectedMaterial
        )
      : ''

  return (
    <Modal onClose={onClose} align="center">
      <div className="bg-white rounded-lg max-w-sm w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        <div className="p-5 border-b shrink-0 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Materials inventory link</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {product.product_name || product.name}
              {isConsumable ? (
                <span className="ml-2 text-xs font-medium text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">
                  Supplies / consumable
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1 min-h-0">
          {!isConsumable ? (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This product is not in a supplies/consumables category (sort index 0). Bill of materials
              applies instead.
            </p>
          ) : null}

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-800">
              Material from inventory *
            </label>
            {loading ? (
              <p className="text-sm text-gray-400">Loading materials…</p>
            ) : (
              <select
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                disabled={guestMode}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
              >
                <option value="">Select material…</option>
                {materialsByOwner.map(({ owner, materials: ownerMaterials }) => (
                  <optgroup key={owner} label={owner}>
                    {ownerMaterials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.material_name} ({m.unit})
                        {m.sku ? ` · ${m.sku}` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
            {onOpenProcurement && !guestMode ? (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenProcurement()
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Open Procurement → Materials Inventory
              </button>
            ) : null}
          </div>

          {selectedMaterial ? (
            <div className="space-y-2">
              <span className="block text-sm font-medium text-gray-800">Receive unit</span>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="inventoryUom"
                    checked={inventoryUom === 'stock'}
                    onChange={() => setInventoryUom('stock')}
                    disabled={guestMode}
                  />
                  Stock — {getStockUnitLabel(selectedMaterial)}
                </label>
                <label
                  className={`inline-flex items-center gap-2 ${
                    canUsePurchaseUom ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <input
                    type="radio"
                    name="inventoryUom"
                    checked={inventoryUom === 'purchase'}
                    onChange={() => setInventoryUom('purchase')}
                    disabled={guestMode || !canUsePurchaseUom}
                  />
                  Purchase — {getProductMaterialInventoryUnitLabel(selectedMaterial, 'purchase')}
                </label>
              </div>
              <p className="text-xs text-gray-500">
                Materials available: {materialAvailableLabel}
              </p>
            </div>
          ) : null}
        </div>

        <div className="p-5 border-t shrink-0 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          {!guestMode ? (
            <button
              type="button"
              disabled={savingLink || !materialId}
              onClick={handleSaveLink}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${themeBtn}`}
            >
              {savingLink ? 'Saving…' : 'Save link'}
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
