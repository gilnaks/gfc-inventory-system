'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Modal } from './Modal'
import { formatGlPhp } from './AccountingLedgerTable'

type OpeningDetail = {
  name: string
  quantity: number
  unit?: string
  unitCost: number
  amount: number
}

export function ProductOpeningStockViewModal({
  productId,
  onClose,
}: {
  productId: string
  onClose: () => void
}) {
  const [detail, setDetail] = useState<OpeningDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      const [{ data: product, error: productErr }, { data: entry }] = await Promise.all([
        supabase
          .from('products')
          .select('name, initial_stock, price, unit')
          .eq('id', productId)
          .maybeSingle(),
        supabase
          .from('accounting_journal_entries')
          .select('memo')
          .eq('source_type', 'product_opening_stock')
          .eq('source_id', productId)
          .eq('status', 'posted')
          .maybeSingle(),
      ])

      if (cancelled) return
      if (productErr || !product) {
        setError(productErr?.message || 'Product not found')
        setLoading(false)
        return
      }

      const parsed = parseOpeningMemo(entry?.memo)
      const quantity = parsed.quantity ?? Math.max(0, Number(product.initial_stock) || 0)
      const unitCost = parsed.unitCost ?? Math.max(0, Number(product.price) || 0)
      const amount = Math.round(quantity * unitCost * 100) / 100

      setDetail({
        name: product.name || 'Product',
        quantity,
        unit: parsed.unit || product.unit || undefined,
        unitCost,
        amount,
      })
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [productId])

  return (
    <Modal onClose={onClose} align="center" zIndex={70}>
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Product opening stock</h2>
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
                <dt className="text-gray-500">Quantity</dt>
                <dd className="font-medium tabular-nums">
                  {detail.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  {detail.unit ? ` ${detail.unit}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Unit cost</dt>
                <dd className="font-medium tabular-nums">{formatGlPhp(detail.unitCost)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-gray-500">Inventory value</dt>
                <dd className="font-medium tabular-nums">{formatGlPhp(detail.amount)}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </Modal>
  )
}

function parseOpeningMemo(memo?: string | null): {
  quantity?: number
  unit?: string
  unitCost?: number
} {
  const text = memo?.trim()
  if (!text) return {}

  const newFormat = text.match(
    /(.+?)\s+([+-]?[\d,.]+)\s+(\S+)\s+@\s*₱([\d,.]+)\s*$/
  )
  if (newFormat) {
    const quantity = Number.parseFloat(newFormat[2].replace(/,/g, ''))
    const unitCost = Number.parseFloat(newFormat[4].replace(/,/g, ''))
    const unit = newFormat[3].trim()
    return {
      quantity: Number.isFinite(quantity) ? quantity : undefined,
      unit: unit || undefined,
      unitCost: Number.isFinite(unitCost) ? unitCost : undefined,
    }
  }

  const match = text.match(
    /-\s*([\d,.]+)\s+([^@]+?)\s+@\s*₱([\d,.]+)\s*$/
  )
  if (!match) return {}

  const quantity = Number.parseFloat(match[1].replace(/,/g, ''))
  const unitCost = Number.parseFloat(match[3].replace(/,/g, ''))
  const unit = match[2].trim()

  return {
    quantity: Number.isFinite(quantity) ? quantity : undefined,
    unit: unit || undefined,
    unitCost: Number.isFinite(unitCost) ? unitCost : undefined,
  }
}
