'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase, type SupplierInvoice, type SupplierInvoiceLine } from '../../lib/supabase'
import { formatPoLabel } from '../../lib/accounting-voucher-prefill'
import { Modal } from './Modal'
import { SupplierInvoiceStatusBadge } from './SupplierInvoiceModal'

type InvoiceLineView = SupplierInvoiceLine & {
  product_description?: string
  unit?: string
}


function attachmentPreviewKind(url: string): 'pdf' | 'image' | 'other' {
  const lower = url.toLowerCase()
  if (/\.pdf(\?|$)/.test(lower)) return 'pdf'
  if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/.test(lower)) return 'image'
  return 'other'
}

export function SupplierInvoiceViewModal({
  invoiceId,
  onClose,
}: {
  invoiceId: string
  onClose: () => void
}) {
  const [invoice, setInvoice] = useState<SupplierInvoice | null>(null)
  const [lines, setLines] = useState<InvoiceLineView[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<'invoice' | 'attachment'>('invoice')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    void (async () => {
      try {
        const { data: inv, error: invErr } = await supabase
          .from('supplier_invoices')
          .select('*')
          .eq('id', invoiceId)
          .maybeSingle()

        if (invErr) throw new Error(invErr.message)
        if (!inv) throw new Error('Supplier invoice not found.')

        const [{ data: invLines, error: linesErr }, { data: po, error: poErr }, { data: supplier }] =
          await Promise.all([
            supabase.from('supplier_invoice_lines').select('*').eq('supplier_invoice_id', invoiceId),
            supabase
              .from('purchase_orders')
              .select('id, po_number, supplier:suppliers(name), items:purchase_order_items(id, product_description, unit)')
              .eq('id', inv.po_id)
              .maybeSingle(),
            inv.supplier_id
              ? supabase.from('suppliers').select('name').eq('id', inv.supplier_id).maybeSingle()
              : Promise.resolve({ data: null, error: null }),
          ])

        if (linesErr) throw new Error(linesErr.message)
        if (poErr) throw new Error(poErr.message)

        const poItemMap = new Map(
          ((po as { items?: Array<{ id: string; product_description: string; unit?: string }> })?.items ||
            []
          ).map((item) => [item.id, item])
        )

        if (cancelled) return

        const viewLines: InvoiceLineView[] = (invLines || []).map((line) => {
          const poItem = poItemMap.get(line.po_item_id)
          return {
            ...line,
            product_description: poItem?.product_description,
            unit: poItem?.unit,
          }
        })

        setInvoice({
          ...(inv as SupplierInvoice),
          supplier: supplier ? { name: supplier.name } as SupplierInvoice['supplier'] : undefined,
          purchase_order: po
            ? ({
                id: po.id,
                po_number: po.po_number,
                supplier: Array.isArray((po as { supplier?: unknown }).supplier)
                  ? (po as { supplier: { name?: string }[] }).supplier[0]
                  : (po as { supplier?: { name?: string } }).supplier,
              } as SupplierInvoice['purchase_order'])
            : undefined,
          lines: viewLines,
        })
        setLines(viewLines)
      } catch (e) {
        if (!cancelled) {
          setInvoice(null)
          setLines([])
          setLoadError(e instanceof Error ? e.message : 'Failed to load supplier invoice.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [invoiceId])

  const attachmentUrl = invoice?.attachment_url?.trim() || ''
  const attachmentKind = attachmentUrl ? attachmentPreviewKind(attachmentUrl) : null
  const totalAmount =
    Number(invoice?.total_amount) ||
    lines.reduce((s, l) => s + (Number(l.line_amount) || 0), 0)

  return (
    <Modal onClose={onClose} zIndex={70} align="center">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl">
        <div className="p-4 border-b flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Supplier Invoice</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              {invoice?.invoice_number || (loading ? 'Loading…' : 'Not found')}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading supplier invoice…</div>
        ) : !invoice ? (
          <div className="p-8 text-center text-sm text-red-600">
            {loadError || 'Could not load supplier invoice.'}
          </div>
        ) : (
          <>
            <div className="px-4 pt-3 border-b shrink-0">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActivePanel('invoice')}
                  className={`px-3 py-1.5 text-sm rounded-t-md border-b-2 ${
                    activePanel === 'invoice'
                      ? 'border-blue-600 text-blue-700 font-medium'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Invoice
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
              {activePanel === 'invoice' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Invoice Info</p>
                      <dl className="space-y-1 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">Invoice #</dt>
                          <dd className="font-mono font-medium">{invoice.invoice_number}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">Date</dt>
                          <dd>{new Date(invoice.invoice_date).toLocaleDateString()}</dd>
                        </div>
                        <div className="flex justify-between gap-4 items-center">
                          <dt className="text-gray-500">Status</dt>
                          <dd>
                            <SupplierInvoiceStatusBadge status={invoice.status} />
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">Total</dt>
                          <dd className="tabular-nums font-medium">
                            ₱{totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Purchase Order</p>
                      <dl className="space-y-1 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">PO #</dt>
                          <dd className="font-medium">
                            {invoice.purchase_order?.po_number
                              ? formatPoLabel(invoice.purchase_order.po_number)
                              : '—'}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">Supplier</dt>
                          <dd>
                            {invoice.supplier?.name ||
                              invoice.purchase_order?.supplier?.name ||
                              '—'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Invoice Items</p>
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full text-sm min-w-[640px]">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-gray-700">#</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-700">Description</th>
                            <th className="text-right px-3 py-2 font-medium text-gray-700">Qty</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-700">Unit</th>
                            <th className="text-right px-3 py-2 font-medium text-gray-700">Unit Price</th>
                            <th className="text-right px-3 py-2 font-medium text-gray-700">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {lines.map((line, idx) => {
                            const qty = Number(line.quantity_invoiced) || 0
                            const price = Number(line.unit_price) || 0
                            const amount = Number(line.line_amount) || qty * price
                            return (
                              <tr key={line.id || line.po_item_id}>
                                <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                                <td className="px-3 py-2">{line.product_description || '—'}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{qty}</td>
                                <td className="px-3 py-2">{line.unit || '—'}</td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  ₱{price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium">
                                  ₱{amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            )
                          })}
                          {lines.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                                No line items on this invoice
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t">
                          <tr>
                            <td colSpan={5} className="px-3 py-2 text-right font-medium">
                              Invoice Total
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold">
                              ₱{totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {invoice.notes && (
                    <div className="border rounded-lg p-3 bg-gray-50 text-sm">
                      <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Notes</p>
                      <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
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
                        alt="Supplier invoice attachment"
                        className="max-w-full max-h-[60vh] object-contain"
                      />
                    </div>
                  ) : (
                    <iframe
                      src={attachmentUrl}
                      title="Supplier invoice attachment"
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
                  No attachment uploaded for this supplier invoice.
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
