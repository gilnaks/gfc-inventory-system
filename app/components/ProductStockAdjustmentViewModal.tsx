'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Modal } from './Modal'
import { formatGlPhp } from './AccountingLedgerTable'

type AdjustmentDetail = {
  name: string
  previousInitialStock: number
  newInitialStock: number
  quantityDelta: number
  unit?: string
  unitCost: number
  amount: number
}

export function ProductStockAdjustmentViewModal({
  adjustmentId,
  onClose,
}: {
  adjustmentId: string
  onClose: () => void
}) {
  const [detail, setDetail] = useState<AdjustmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      const { data, error: fetchErr } = await supabase
        .from('product_stock_adjustments')
        .select(
          'previous_initial_stock, new_initial_stock, quantity_delta, unit_cost, amount, unit, product:products(name)'
        )
        .eq('id', adjustmentId)
        .maybeSingle()

      if (cancelled) return
      if (fetchErr || !data) {
        setError(fetchErr?.message || 'Stock adjustment not found')
        setLoading(false)
        return
      }

      const product = data.product as { name?: string } | { name?: string }[] | null
      const name = (Array.isArray(product) ? product[0]?.name : product?.name) || 'Product'

      setDetail({
        name,
        previousInitialStock: Number(data.previous_initial_stock) || 0,
        newInitialStock: Number(data.new_initial_stock) || 0,
        quantityDelta: Number(data.quantity_delta) || 0,
        unit: data.unit || undefined,
        unitCost: Number(data.unit_cost) || 0,
        amount: Number(data.amount) || 0,
      })
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [adjustmentId])

  return (
    <Modal onClose={onClose} align="center" zIndex={70}>
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Stock adjustment</h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          {loading && <p className="text-gray-500">Loading…</p>}
          {error && <p className="text-red-600">{error}</p>}
          {detail && (
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <dt className="text-gray-500">Product</dt>
                <dd className="font-medium">{detail.name}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Initial stock before</dt>
                <dd className="font-medium tabular-nums">
                  {detail.previousInitialStock.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                  {detail.unit ? ` ${detail.unit}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Initial stock after</dt>
                <dd className="font-medium tabular-nums">
                  {detail.newInitialStock.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                  {detail.unit ? ` ${detail.unit}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Change</dt>
                <dd className="font-medium tabular-nums">
                  {detail.quantityDelta > 0 ? '+' : ''}
                  {detail.quantityDelta.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  {detail.unit ? ` ${detail.unit}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Unit cost</dt>
                <dd className="font-medium tabular-nums">{formatGlPhp(detail.unitCost)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-gray-500">Inventory value change</dt>
                <dd className="font-medium tabular-nums">{formatGlPhp(detail.amount)}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </Modal>
  )
}
