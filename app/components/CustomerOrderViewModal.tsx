'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  computeOrderCogsTotal,
  formatOrderCogsError,
  type OrderCogsBreakdown,
} from '../../lib/accounting-order-cogs'
import { Modal } from './Modal'
import { formatGlPhp } from './AccountingLedgerTable'

type OrderDetail = {
  id: string
  status: string
  created_at?: string
  lines: Array<{ description?: string; quantity: number; unit_price: number }>
  total: number
}

export function CustomerOrderViewModal({
  orderId,
  journalSourceType,
  onClose,
}: {
  orderId: string
  journalSourceType?: string
  onClose: () => void
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [cogs, setCogs] = useState<OrderCogsBreakdown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const showCogs = journalSourceType === 'customer_order_cogs'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setCogs(null)
    void (async () => {
      const { data, error: err } = await supabase
        .from('customer_orders')
        .select('id, status, created_at, order_details(quantity, unit_price, products:products(name))')
        .eq('id', orderId)
        .maybeSingle()
      if (cancelled) return
      if (err || !data) {
        setError(err?.message || 'Order not found')
        setLoading(false)
        return
      }
      const details = (data.order_details || []) as Array<{
        quantity: number
        unit_price: number
        products?: { name?: string } | { name?: string }[] | null
      }>
      const lines = details.map((d) => {
        const prod = d.products
        const name = Array.isArray(prod) ? prod[0]?.name : prod?.name
        return {
          description: name,
          quantity: Number(d.quantity) || 0,
          unit_price: Number(d.unit_price) || 0,
        }
      })
      const total = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0)
      setOrder({
        id: data.id,
        status: data.status,
        created_at: data.created_at,
        lines,
        total,
      })

      if (showCogs) {
        const breakdown = await computeOrderCogsTotal(orderId)
        if (!cancelled) setCogs(breakdown)
      }

      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [orderId, showCogs])

  const title = showCogs
    ? `COGS — order #${orderId.slice(0, 8)}`
    : `Order #${orderId.slice(0, 8)}`

  return (
    <Modal onClose={onClose} align="center" zIndex={70}>
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          {loading && <p className="text-gray-500">Loading…</p>}
          {error && <p className="text-red-600">{error}</p>}
          {order && (
            <>
              <div className="text-xs space-y-1">
                <p>
                  <span className="capitalize font-medium">{order.status}</span>
                  {order.created_at && ` · ${order.created_at.split('T')[0]}`}
                </p>
              </div>
              {showCogs && cogs && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs space-y-1">
                  <p className="font-medium text-amber-900">
                    COGS total: {formatGlPhp(cogs.total)}
                  </p>
                  {cogs.loadError && (
                    <p className="text-amber-800">{formatOrderCogsError(cogs)}</p>
                  )}
                  {!cogs.loadError && cogs.productsWithoutBom.length > 0 && (
                    <p className="text-amber-800">
                      No BOM: {cogs.productsWithoutBom.join(', ')}
                    </p>
                  )}
                  {!cogs.loadError && cogs.productsWithZeroCost.length > 0 && (
                    <p className="text-amber-800">
                      Zero cost: {cogs.productsWithZeroCost.join(', ')}
                    </p>
                  )}
                </div>
              )}
              <table className="w-full text-xs border rounded">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-2 py-1">Item</th>
                    <th className="text-right px-2 py-1">Qty</th>
                    {!showCogs && (
                      <>
                        <th className="text-right px-2 py-1">Price</th>
                        <th className="text-right px-2 py-1">Amount</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">{l.description || '—'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{l.quantity}</td>
                      {!showCogs && (
                        <>
                          <td className="px-2 py-1 text-right tabular-nums">
                            {formatGlPhp(l.unit_price)}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums">
                            {formatGlPhp(l.quantity * l.unit_price)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!showCogs && (
                <p className="text-right font-medium tabular-nums">
                  Total: {formatGlPhp(order.total)}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
