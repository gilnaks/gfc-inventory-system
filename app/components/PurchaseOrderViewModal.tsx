'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase, type PurchaseOrder, type PurchaseOrderItem } from '../../lib/supabase'
import { Modal } from './Modal'

type PurchaseOrderDetail = Omit<PurchaseOrder, 'items'> & {
  items?: Array<
    PurchaseOrderItem & {
      quantity_received_display?: number
    }
  >
}

function attachmentPreviewKind(url: string): 'pdf' | 'image' | 'other' {
  const lower = url.toLowerCase()
  if (/\.pdf(\?|$)/.test(lower)) return 'pdf'
  if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/.test(lower)) return 'image'
  return 'other'
}

export function PurchaseOrderViewModal({
  poId,
  onClose,
}: {
  poId: string
  onClose: () => void
}) {
  const [po, setPo] = useState<PurchaseOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<'order' | 'attachment'>('order')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    void (async () => {
      try {
        const { data: poRow, error: poErr } = await supabase
          .from('purchase_orders')
          .select('*, supplier:suppliers(*), items:purchase_order_items(*)')
          .eq('id', poId)
          .maybeSingle()

        if (poErr) throw new Error(poErr.message)
        if (!poRow) throw new Error('Purchase order not found.')

        const { data: drs } = await supabase
          .from('delivery_receipts')
          .select('id')
          .eq('po_id', poId)

        const receivedByPoItem: Record<string, number> = {}
        const drIds = (drs || []).map((d) => d.id)
        if (drIds.length > 0) {
          const { data: drItems, error: drItemsErr } = await supabase
            .from('delivery_receipt_items')
            .select('po_item_id, quantity_received')
            .in('delivery_receipt_id', drIds)

          if (drItemsErr) throw new Error(drItemsErr.message)
          for (const row of drItems || []) {
            const id = row.po_item_id
            if (!id) continue
            receivedByPoItem[id] =
              (receivedByPoItem[id] || 0) + (Number(row.quantity_received) || 0)
          }
        }

        if (cancelled) return

        const items = ((poRow as PurchaseOrder).items || []).map((item) => ({
          ...item,
          quantity_received_display: receivedByPoItem[item.id] ?? (Number(item.quantity_received) || 0),
        }))

        setPo({
          ...(poRow as PurchaseOrder),
          items,
        })
      } catch (e) {
        if (!cancelled) {
          setPo(null)
          setLoadError(e instanceof Error ? e.message : 'Failed to load purchase order.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [poId])

  const attachmentUrl = po?.po_attachment_url?.trim() || ''
  const attachmentKind = attachmentUrl ? attachmentPreviewKind(attachmentUrl) : null

  return (
    <Modal onClose={onClose} zIndex={70} align="center">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl">
        <div className="p-4 border-b flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Purchase Order</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              {po?.po_number || (loading ? 'Loading…' : 'Not found')}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading purchase order…</div>
        ) : !po ? (
          <div className="p-8 text-center text-sm text-red-600">
            {loadError || 'Could not load purchase order.'}
          </div>
        ) : (
          <>
            <div className="px-4 pt-3 border-b shrink-0">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActivePanel('order')}
                  className={`px-3 py-1.5 text-sm rounded-t-md border-b-2 ${
                    activePanel === 'order'
                      ? 'border-blue-600 text-blue-700 font-medium'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Order
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('attachment')}
                  className={`px-3 py-1.5 text-sm rounded-t-md border-b-2 ${
                    activePanel === 'attachment'
                      ? 'border-blue-600 text-blue-700 font-medium'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Attachment
                  {!attachmentUrl && <span className="ml-1 text-xs text-gray-400">(none)</span>}
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {activePanel === 'order' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Order Info</p>
                      <dl className="space-y-1 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">PO #</dt>
                          <dd className="font-mono font-medium">{po.po_number}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">Order date</dt>
                          <dd>{new Date(po.order_date).toLocaleDateString()}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">Status</dt>
                          <dd className="capitalize">{(po.status || '—').replace(/_/g, ' ')}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">Payment terms</dt>
                          <dd>{po.payment_terms || '—'}</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Supplier</p>
                      <dl className="space-y-1 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">Name</dt>
                          <dd className="font-medium">{po.supplier?.name || '—'}</dd>
                        </div>
                        {po.supplier?.contact_person && (
                          <div className="flex justify-between gap-4">
                            <dt className="text-gray-500">Contact</dt>
                            <dd>{po.supplier.contact_person}</dd>
                          </div>
                        )}
                        {po.delivery_address && (
                          <div>
                            <dt className="text-gray-500 text-xs mb-0.5">Delivery address</dt>
                            <dd className="text-sm">{po.delivery_address}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Order Items</p>
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full text-sm min-w-[640px]">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-gray-700">#</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-700">Description</th>
                            <th className="text-right px-3 py-2 font-medium text-gray-700">Ordered</th>
                            <th className="text-right px-3 py-2 font-medium text-gray-700">Received</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-700">Unit</th>
                            <th className="text-right px-3 py-2 font-medium text-gray-700">Unit Price</th>
                            <th className="text-right px-3 py-2 font-medium text-gray-700">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(po.items || []).map((line, idx) => {
                            const qty = Number(line.quantity) || 0
                            const price = Number(line.unit_price) || 0
                            return (
                              <tr key={line.id}>
                                <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                                <td className="px-3 py-2">{line.product_description}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{qty}</td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium">
                                  {line.quantity_received_display ?? 0}
                                </td>
                                <td className="px-3 py-2">{line.unit || '—'}</td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  ₱{price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium">
                                  ₱{(qty * price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            )
                          })}
                          {(po.items || []).length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                                No line items on this PO
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t">
                          <tr>
                            <td colSpan={6} className="px-3 py-2 text-right font-medium">
                              PO Total
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold">
                              ₱
                              {(Number(po.total_amount) || 0).toLocaleString('en-PH', {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {po.notes && (
                    <div className="border rounded-lg p-3 bg-gray-50 text-sm">
                      <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Notes</p>
                      <p className="text-gray-700 whitespace-pre-wrap">{po.notes}</p>
                    </div>
                  )}

                  {attachmentUrl && (
                    <button
                      type="button"
                      onClick={() => setActivePanel('attachment')}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View uploaded attachment →
                    </button>
                  )}
                </div>
              ) : attachmentUrl ? (
                <div className="space-y-3">
                  {attachmentKind === 'image' ? (
                    <div className="border rounded-lg overflow-hidden bg-gray-100 flex justify-center">
                      <img
                        src={attachmentUrl}
                        alt="Purchase order attachment"
                        className="max-w-full max-h-[60vh] object-contain"
                      />
                    </div>
                  ) : (
                    <iframe
                      src={attachmentUrl}
                      title="Purchase order attachment"
                      className="w-full h-[60vh] border rounded-lg bg-gray-50"
                    />
                  )}
                  <a
                    href={attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Open attachment in new tab
                  </a>
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-8 text-center border border-dashed rounded-lg">
                  No attachment uploaded for this purchase order.
                </p>
              )}
            </div>
          </>
        )}

        <div className="p-4 border-t shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
