'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, ArrowDownToLine } from 'lucide-react'
import { supabase, type Product, type RawMaterial } from '../../lib/supabase'
import {
  formatMaterialStockAvailable,
  getProductMaterialInventoryUnitLabel,
  getProductMaterialInventoryUom,
  productInventoryQtyToMaterialStockUnits,
  transferMaterialToProductInventory,
} from '../../lib/product-material-link'
import { formatFactoryRequestQtyDisplay, getStockUnitLabel } from '../../lib/raw-material-uom'

interface ProductMaterialReceiveModalProps {
  product: Product
  theme?: string
  guestMode?: boolean
  currentUsername?: string
  onClose: () => void
  onReceived: () => void
  onOpenMaterialLink?: () => void
}

export function ProductMaterialReceiveModal({
  product,
  theme = 'blue',
  guestMode = false,
  currentUsername = '',
  onClose,
  onReceived,
  onOpenMaterialLink,
}: ProductMaterialReceiveModalProps) {
  const productId = product.product_id || product.id || ''
  const linkedMaterialId = product.linked_material_id

  const [material, setMaterial] = useState<RawMaterial | null>(null)
  const [loading, setLoading] = useState(true)
  const [receiving, setReceiving] = useState(false)
  const [receiveQty, setReceiveQty] = useState('1')
  const [receiveNotes, setReceiveNotes] = useState('')

  const inventoryUom = getProductMaterialInventoryUom(product.material_inventory_uom)

  const themeBtn =
    theme === 'green'
      ? 'bg-green-600 hover:bg-green-700'
      : theme === 'red'
        ? 'bg-red-600 hover:bg-red-700'
        : theme === 'yellow'
          ? 'bg-yellow-600 hover:bg-yellow-700'
          : 'bg-blue-600 hover:bg-blue-700'

  const loadMaterial = useCallback(async () => {
    if (!linkedMaterialId) {
      setMaterial(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*')
        .eq('id', linkedMaterialId)
        .single()

      if (error) throw error
      setMaterial((data as RawMaterial) || null)
    } catch (err) {
      console.error(err)
      setMaterial(null)
    } finally {
      setLoading(false)
    }
  }, [linkedMaterialId])

  useEffect(() => {
    loadMaterial()
  }, [loadMaterial])

  const handleReceive = async () => {
    if (!material || !productId) return
    const qty = parseFloat(receiveQty)
    if (!Number.isFinite(qty) || qty <= 0) {
      alert('Enter a valid quantity greater than 0.')
      return
    }
    setReceiving(true)
    try {
      const result = await transferMaterialToProductInventory({
        productId,
        productName: product.product_name || product.name || 'Product',
        material,
        requestQty: qty,
        uom: inventoryUom,
        createdBy: currentUsername.trim() || 'Unknown',
        notes: receiveNotes.trim() || undefined,
      })
      setReceiveQty('1')
      setReceiveNotes('')
      onReceived()
      alert(
        `Received ${result.stockUnitsTransferred} ${getStockUnitLabel(material)} into product inventory.`
      )
      await loadMaterial()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not receive from materials inventory.')
    } finally {
      setReceiving(false)
    }
  }

  const receivePreview = useMemo(() => {
    if (!material || !receiveQty) return null
    const q = parseFloat(receiveQty)
    if (!Number.isFinite(q) || q <= 0) return null
    const stock = productInventoryQtyToMaterialStockUnits(q, inventoryUom, material)
    return {
      stock,
      display: formatFactoryRequestQtyDisplay(q, {
        ...material,
        factory_inventory_kind: material.factory_inventory_kind ?? 'ingredients',
        factory_request_uom: inventoryUom,
      }),
    }
  }, [material, receiveQty, inventoryUom])

  const materialAvailableLabel = material
    ? formatMaterialStockAvailable(
        Number(material.current_stock) || 0,
        inventoryUom,
        material
      )
    : ''

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-sm w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        <div className="p-5 border-b shrink-0 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-emerald-700" />
              Import materials
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{product.product_name || product.name}</p>
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

        <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          {!linkedMaterialId ? (
            <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 space-y-2">
              <p>No material linked yet. Set up the link first.</p>
              {onOpenMaterialLink && !guestMode ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onOpenMaterialLink()
                  }}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Open materials link
                </button>
              ) : null}
            </div>
          ) : loading ? (
            <p className="text-sm text-gray-400">Loading material…</p>
          ) : !material ? (
            <p className="text-sm text-red-700">Linked material not found.</p>
          ) : (
            <>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                <div className="font-medium text-gray-900">{material.material_name}</div>
                {material.sku ? (
                  <div className="text-xs text-gray-400 font-mono">{material.sku}</div>
                ) : null}
                <div className="text-xs text-gray-600 mt-1">
                  Receive unit: {getProductMaterialInventoryUnitLabel(material, inventoryUom)} ·
                  Available: {materialAvailableLabel}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity ({getProductMaterialInventoryUnitLabel(material, inventoryUom)})
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={receiveQty}
                  onChange={(e) => setReceiveQty(e.target.value)}
                  disabled={guestMode || receiving}
                  className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  disabled={guestMode || receiving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Optional"
                />
              </div>
              {receivePreview ? (
                <p className="text-xs text-gray-600">
                  ≈ {receivePreview.display.primary}
                  {receivePreview.display.stockNote
                    ? ` (${receivePreview.display.stockNote})`
                    : null}{' '}
                  → {receivePreview.stock.toLocaleString()} {getStockUnitLabel(material)} on product
                </p>
              ) : null}
              {!guestMode ? (
                <button
                  type="button"
                  disabled={receiving || !receiveQty}
                  onClick={handleReceive}
                  className={`w-full px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${themeBtn}`}
                >
                  {receiving ? 'Receiving…' : 'Receive materials'}
                </button>
              ) : null}
            </>
          )}
        </div>

        <div className="p-5 border-t shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
