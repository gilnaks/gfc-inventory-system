'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  supabase,
  type DeliveryReceipt,
  type DeliveryReceiptItem,
  type PurchaseOrderItem,
} from '../../lib/supabase'
import { Modal } from './Modal'
import { conditionBadgeClass, formatConditionLabel } from '../../lib/receiving-condition-service'

type ReceivingReportLine = DeliveryReceiptItem & {
  po_item?: Pick<PurchaseOrderItem, 'product_description' | 'unit' | 'unit_price' | 'quantity'>
}

type ReceivingReportDetail = Omit<DeliveryReceipt, 'items'> & {
  items?: ReceivingReportLine[]
  purchase_order?: {
    po_number?: string
    supplier?: { name?: string }
    delivery_address?: string
  }
}

function attachmentPreviewKind(url: string): 'pdf' | 'image' | 'other' {
  const lower = url.toLowerCase()
  if (/\.pdf(\?|$)/.test(lower)) return 'pdf'
  if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/.test(lower)) return 'image'
  return 'other'
}

function ReceivingReportViewSkeleton() {
  return (
    <>
      <div className="px-4 pt-3 border-b shrink-0 animate-pulse">
        <div className="flex gap-2">
          <div className="h-8 w-16 bg-gray-200 rounded-t-md" />
          <div className="h-8 w-24 bg-gray-100 rounded-t-md" />
        </div>
      </div>

      <div className="p-4 overflow-y-auto flex-1 animate-pulse space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
            <div className="h-3 w-24 bg-gray-200 rounded" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between gap-4">
                <div className="h-3 w-20 bg-gray-200 rounded" />
                <div className="h-3 w-28 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
          <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
            <div className="h-3 w-28 bg-gray-200 rounded" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between gap-4">
                <div className="h-3 w-16 bg-gray-200 rounded" />
                <div className="h-3 w-32 bg-gray-200 rounded" />
              </div>
            ))}
            <div className="h-8 w-full bg-gray-200 rounded" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-3 w-28 bg-gray-200 rounded" />
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b px-3 py-2 flex gap-3">
              <div className="h-3 w-6 bg-gray-200 rounded" />
              <div className="h-3 flex-1 bg-gray-200 rounded" />
              <div className="h-3 w-14 bg-gray-200 rounded" />
              <div className="h-3 w-14 bg-gray-200 rounded" />
              <div className="h-3 w-10 bg-gray-200 rounded" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-3 py-2.5 border-t border-gray-100 flex gap-3 items-center">
                <div className="h-3 w-6 bg-gray-200 rounded" />
                <div className="h-3 flex-1 bg-gray-200 rounded" />
                <div className="h-3 w-10 bg-gray-200 rounded" />
                <div className="h-3 w-10 bg-gray-200 rounded" />
                <div className="h-3 w-8 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
          <div className="h-3 w-16 bg-gray-200 rounded" />
          <div className="h-12 w-full bg-gray-200 rounded" />
        </div>
      </div>
    </>
  )
}

export function ReceivingReportViewModal({
  receiptId,
  onClose,
}: {
  receiptId: string
  onClose: () => void
}) {
  const [report, setReport] = useState<ReceivingReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<'report' | 'attachment'>('report')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    void (async () => {
      try {
        const { data: dr, error: drErr } = await supabase
          .from('delivery_receipts')
          .select('*')
          .eq('id', receiptId)
          .maybeSingle()

        if (drErr) throw new Error(drErr.message)
        if (!dr) throw new Error('Receiving report not found.')

        const { data: receiptItems, error: itemsErr } = await supabase
          .from('delivery_receipt_items')
          .select('*')
          .eq('delivery_receipt_id', receiptId)

        if (itemsErr) throw new Error(itemsErr.message)

        const poItemIds = (receiptItems || []).map((i) => i.po_item_id).filter(Boolean)
        let poItemMap = new Map<
          string,
          Pick<PurchaseOrderItem, 'product_description' | 'unit' | 'unit_price' | 'quantity'>
        >()

        if (poItemIds.length > 0) {
          const { data: poItems, error: poItemsErr } = await supabase
            .from('purchase_order_items')
            .select('id, product_description, unit, unit_price, quantity')
            .in('id', poItemIds)

          if (poItemsErr) throw new Error(poItemsErr.message)
          poItemMap = new Map(
            (poItems || []).map((item) => [
              item.id,
              {
                product_description: item.product_description,
                unit: item.unit,
                unit_price: item.unit_price,
                quantity: item.quantity,
              },
            ])
          )
        }

        const { data: po, error: poErr } = await supabase
          .from('purchase_orders')
          .select('po_number, delivery_address, supplier_id')
          .eq('id', dr.po_id)
          .maybeSingle()

        if (poErr) throw new Error(poErr.message)

        let supplierName: string | undefined
        if (po?.supplier_id) {
          const { data: supplier } = await supabase
            .from('suppliers')
            .select('name')
            .eq('id', po.supplier_id)
            .maybeSingle()
          supplierName = supplier?.name
        }

        if (cancelled) return

        const items: ReceivingReportLine[] = (receiptItems || []).map((line) => ({
          ...line,
          po_item: poItemMap.get(line.po_item_id),
        }))

        setReport({
          ...(dr as DeliveryReceipt),
          items,
          purchase_order: po
            ? {
                po_number: po.po_number,
                delivery_address: po.delivery_address,
                supplier: supplierName ? { name: supplierName } : undefined,
              }
            : undefined,
        })
      } catch (e) {
        if (!cancelled) {
          setReport(null)
          setLoadError(e instanceof Error ? e.message : 'Failed to load receiving report.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [receiptId])

  const attachmentUrl = report?.delivery_receipt_url?.trim() || ''
  const attachmentKind = attachmentUrl ? attachmentPreviewKind(attachmentUrl) : null

  return (
    <Modal onClose={onClose} align="center" zIndex={70}>
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl">
        <div className="p-4 border-b flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Receiving Report</h2>
            {loading ? (
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-sm text-gray-600 mt-0.5">
                {report?.receipt_number || 'Not found'}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <ReceivingReportViewSkeleton />
        ) : !report ? (
          <div className="p-8 text-center text-sm text-red-600">
            {loadError || 'Could not load receiving report.'}
          </div>
        ) : (
          <>
            <div className="px-4 pt-3 border-b shrink-0">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActivePanel('report')}
                  className={`px-3 py-1.5 text-sm rounded-t-md border-b-2 ${
                    activePanel === 'report'
                      ? 'border-blue-600 text-blue-700 font-medium'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Report
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
              {activePanel === 'report' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Receipt Info</p>
                      <dl className="space-y-1 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">Receipt #</dt>
                          <dd className="font-mono font-medium">{report.receipt_number}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">Date</dt>
                          <dd>{new Date(report.delivery_date).toLocaleDateString()}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">Received by</dt>
                          <dd>{report.received_by || '—'}</dd>
                        </div>
                        <div className="flex justify-between gap-4 items-center">
                          <dt className="text-gray-500">Condition</dt>
                          <dd>
                            <span
                              className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${conditionBadgeClass(report.condition)}`}
                            >
                              {formatConditionLabel(report.condition)}
                            </span>
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Purchase Order</p>
                      <dl className="space-y-1 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">PO #</dt>
                          <dd className="font-medium">{report.purchase_order?.po_number || '—'}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">Supplier</dt>
                          <dd>{report.purchase_order?.supplier?.name || '—'}</dd>
                        </div>
                        {report.purchase_order?.delivery_address && (
                          <div>
                            <dt className="text-gray-500 text-xs mb-0.5">Delivery address</dt>
                            <dd className="text-sm">{report.purchase_order.delivery_address}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Items Received</p>
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full text-sm min-w-[560px]">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-gray-700">#</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-700">Description</th>
                            <th className="text-right px-3 py-2 font-medium text-gray-700">Ordered</th>
                            <th className="text-right px-3 py-2 font-medium text-green-800">Good</th>
                            <th className="text-right px-3 py-2 font-medium text-red-800">Damaged</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-700">Unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(report.items || []).map((line, idx) => (
                            <tr key={line.id}>
                              <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                              <td className="px-3 py-2">{line.po_item?.product_description || '—'}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {line.po_item?.quantity ?? '—'}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-medium text-green-800">
                                {line.quantity_received}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-red-700">
                                {(Number(line.quantity_damaged) || 0) > 0
                                  ? line.quantity_damaged
                                  : '—'}
                              </td>
                              <td className="px-3 py-2">{line.po_item?.unit || '—'}</td>
                            </tr>
                          ))}
                          {(report.items || []).length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                                No line items recorded
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {(report.notes || report.inspection_notes) && (
                    <div className="border rounded-lg p-3 bg-gray-50 text-sm space-y-2">
                      {report.notes && (
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Notes</p>
                          <p className="text-gray-700 whitespace-pre-wrap">{report.notes}</p>
                        </div>
                      )}
                      {report.inspection_notes && (
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-500 mb-1">
                            Inspection Notes
                          </p>
                          <p className="text-gray-700 whitespace-pre-wrap">{report.inspection_notes}</p>
                        </div>
                      )}
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
                        alt="Receiving report attachment"
                        className="max-w-full max-h-[60vh] object-contain"
                      />
                    </div>
                  ) : (
                    <iframe
                      src={attachmentUrl}
                      title="Receiving report attachment"
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
                  No attachment uploaded for this receiving report.
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
