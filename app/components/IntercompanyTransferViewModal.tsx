'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase, type IntercompanyTransfer } from '../../lib/supabase'
import { Modal } from './Modal'
import { formatGlPhp } from './AccountingLedgerTable'

export function IntercompanyTransferViewModal({
  transferId,
  onClose,
}: {
  transferId: string
  onClose: () => void
}) {
  const [transfer, setTransfer] = useState<IntercompanyTransfer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      const { data, error: err } = await supabase
        .from('intercompany_transfers')
        .select(
          '*, lines:intercompany_transfer_lines(*), from_brand:brands!intercompany_transfers_from_brand_id_fkey(id, name), to_brand:brands!intercompany_transfers_to_brand_id_fkey(id, name)'
        )
        .eq('id', transferId)
        .maybeSingle()
      if (cancelled) return
      if (err || !data) {
        setError(err?.message || 'Transfer not found')
        setTransfer(null)
      } else {
        setTransfer(data as IntercompanyTransfer)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [transferId])

  return (
    <Modal onClose={onClose} align="center" zIndex={70}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">
            {transfer?.transfer_number || 'Intercompany transfer'}
          </h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          {loading && <p className="text-gray-500">Loading…</p>}
          {error && <p className="text-red-600">{error}</p>}
          {transfer && (
            <>
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-500">Date</p>
                  <p className="font-medium">{transfer.transfer_date}</p>
                </div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <p className="font-medium capitalize">{transfer.status}</p>
                </div>
                <div>
                  <p className="text-gray-500">From</p>
                  <p className="font-medium">{transfer.from_brand?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">To</p>
                  <p className="font-medium">{transfer.to_brand?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Transfer price</p>
                  <p className="font-medium tabular-nums">{formatGlPhp(transfer.transfer_price_total)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Cost amount</p>
                  <p className="font-medium tabular-nums">{formatGlPhp(transfer.cost_amount_total)}</p>
                </div>
                {transfer.notes && (
                  <div className="sm:col-span-2">
                    <p className="text-gray-500">Notes</p>
                    <p className="font-medium">{transfer.notes}</p>
                  </div>
                )}
              </div>
              {(transfer.lines?.length ?? 0) > 0 && (
                <table className="w-full text-xs border rounded">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-2 py-1.5">Item</th>
                      <th className="text-right px-2 py-1.5">Qty</th>
                      <th className="text-right px-2 py-1.5">Unit price</th>
                      <th className="text-right px-2 py-1.5">Line price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(transfer.lines || []).map((l) => (
                      <tr key={l.id || l.line_no} className="border-t">
                        <td className="px-2 py-1.5">{l.description || l.sku || '—'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{l.quantity}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {formatGlPhp(l.unit_price)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {formatGlPhp(l.line_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
