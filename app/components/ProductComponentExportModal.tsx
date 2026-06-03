'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, ArrowUpFromLine } from 'lucide-react'
import type { Brand, Product, RawMaterial } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import {
  BOM_COMPONENT_MATERIAL_CATEGORY,
  computeProductFinalStock,
  exportComponentToProcurement,
} from '../../lib/product-bom-component'
import { getStockUnitLabel } from '../../lib/raw-material-uom'

type AdminPasswordConfirm = (options: {
  title: string
  message: string
  confirmLabel?: string
}) => Promise<boolean>

interface ProductComponentExportModalProps {
  product: Product
  selectedBrand: Brand
  theme?: string
  guestMode?: boolean
  currentUsername?: string
  requestAdminPassword: AdminPasswordConfirm
  onClose: () => void
  onExported: () => void
}

export function ProductComponentExportModal({
  product,
  selectedBrand,
  theme = 'blue',
  guestMode = false,
  currentUsername = '',
  requestAdminPassword,
  onClose,
  onExported,
}: ProductComponentExportModalProps) {
  const [exportQty, setExportQty] = useState('')
  const [exportNotes, setExportNotes] = useState('')
  const [material, setMaterial] = useState<RawMaterial | null>(null)
  const [loadingMaterial, setLoadingMaterial] = useState(true)
  const [exporting, setExporting] = useState(false)

  const unitLabel = product.unit?.trim() || 'pcs'
  const finalStock = computeProductFinalStock(product)
  const productLabel = product.product_name || product.name || 'Product'

  const themeBtn =
    theme === 'green'
      ? 'bg-green-600 hover:bg-green-700'
      : theme === 'red'
        ? 'bg-red-600 hover:bg-red-700'
        : theme === 'yellow'
          ? 'bg-yellow-600 hover:bg-yellow-700'
          : 'bg-blue-600 hover:bg-blue-700'

  useEffect(() => {
    if (finalStock > 0) {
      setExportQty(String(finalStock))
    } else {
      setExportQty('')
    }
    setExportNotes('')
  }, [product.id, product.product_id, finalStock])

  useEffect(() => {
    const productId = product.id || product.product_id
    if (!productId) {
      setMaterial(null)
      setLoadingMaterial(false)
      return
    }

    let cancelled = false
    setLoadingMaterial(true)
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('raw_materials')
          .select('id, material_name, sku, unit, current_stock, category')
          .eq('linked_product_id', productId)
          .eq('is_active', true)
          .maybeSingle()

        if (cancelled) return
        if (error) throw error
        setMaterial((data as RawMaterial) || null)
      } catch (err) {
        console.error(err)
        if (!cancelled) setMaterial(null)
      } finally {
        if (!cancelled) setLoadingMaterial(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [product.id, product.product_id])

  const parsedQty = parseFloat(exportQty)
  const qtyValid = Number.isFinite(parsedQty) && parsedQty > 0 && parsedQty <= finalStock

  const preview = useMemo(() => {
    if (!qtyValid || !material) return null
    const materialBefore = Number(material.current_stock) || 0
    const materialAfter = materialBefore + parsedQty
    const initialAfter = (Number(product.initial_stock) || 0) - parsedQty
    const finalAfter = computeProductFinalStock({
      initial_stock: initialAfter,
      production: product.production,
      released: product.released,
    })
    return { materialAfter, finalAfter }
  }, [qtyValid, material, parsedQty, product])

  const handleExport = async () => {
    if (!qtyValid || guestMode) return

    const confirmed = await requestAdminPassword({
      title: 'Export component',
      message: `Export ${parsedQty.toLocaleString()} ${unitLabel} of "${productLabel}" to procurement (${BOM_COMPONENT_MATERIAL_CATEGORY})?\n\nEnter admin password to confirm.`,
      confirmLabel: 'Export',
    })
    if (!confirmed) return

    setExporting(true)
    try {
      const result = await exportComponentToProcurement({
        product,
        brand: selectedBrand,
        quantity: parsedQty,
        createdBy: currentUsername.trim() || 'Unknown',
        notes: exportNotes.trim() || undefined,
      })
      onExported()
      onClose()
      alert(
        `Exported ${result.quantityExported.toLocaleString()} ${unitLabel} to procurement. Product final stock is now ${result.productFinalStockAfter.toLocaleString()} ${unitLabel}.`
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to export component.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-sm w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        <div className="p-5 border-b shrink-0 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ArrowUpFromLine className="h-5 w-5 text-indigo-700" />
              Export component
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{productLabel}</p>
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
          {finalStock <= 0 ? (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-3">
              No final stock available to export.
            </p>
          ) : (
            <>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                <div className="text-xs text-gray-600">
                  Final stock available:{' '}
                  <span className="font-semibold text-gray-900 tabular-nums">
                    {finalStock.toLocaleString()} {unitLabel}
                  </span>
                </div>
                {loadingMaterial ? (
                  <p className="text-xs text-gray-400 mt-2">Loading linked material…</p>
                ) : material ? (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="font-medium text-gray-900">{material.material_name}</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      Procurement · {material.category || BOM_COMPONENT_MATERIAL_CATEGORY} ·
                      Current: {Number(material.current_stock || 0).toLocaleString()}{' '}
                      {getStockUnitLabel(material)}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-2">
                    Linked procurement material will be created on export.
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Quantity to export ({unitLabel})
                  </label>
                  <button
                    type="button"
                    onClick={() => setExportQty(String(finalStock))}
                    disabled={guestMode || exporting}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                  >
                    Use max
                  </button>
                </div>
                <input
                  type="number"
                  min={0}
                  max={finalStock}
                  step="any"
                  value={exportQty}
                  onChange={(e) => setExportQty(e.target.value)}
                  disabled={guestMode || exporting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                {exportQty && !qtyValid ? (
                  <p className="text-xs text-red-600 mt-1">
                    Enter a quantity from 1 to {finalStock.toLocaleString()}.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={exportNotes}
                  onChange={(e) => setExportNotes(e.target.value)}
                  disabled={guestMode || exporting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Optional"
                />
              </div>

              {preview ? (
                <p className="text-xs text-gray-600">
                  Product final → {preview.finalAfter.toLocaleString()} {unitLabel} · Procurement
                  stock → {preview.materialAfter.toLocaleString()}{' '}
                  {material ? getStockUnitLabel(material) : unitLabel}
                </p>
              ) : null}

              {!guestMode ? (
                <button
                  type="button"
                  disabled={exporting || !qtyValid}
                  onClick={handleExport}
                  className={`w-full px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${themeBtn}`}
                >
                  {exporting ? 'Exporting…' : 'Export to procurement'}
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
