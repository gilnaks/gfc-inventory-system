'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, type SupplierInvoice, type SupplierInvoiceStatus } from '../../lib/supabase'
import {
  loadInvoiceContext,
  loadInvoicesByPoIds,
  saveSupplierInvoice,
  computeMatchForDraft,
  isPaymentBeforeDeliveryPo,
  isPoEligibleForSupplierInvoiceEntry,
  DEFAULT_SUPPLIER_INVOICE_NUMBER_PREFIX,
  type SupplierInvoiceDraft,
  type InvoiceContext,
  type PoExistingInvoice,
} from '../../lib/supplier-invoice-service'
import {
  formatMatchUserMessage,
  formatMatchActionMessages,
  matchResultNeedsPoAmendment,
  type ThreeWayMatchResult,
} from '../../lib/accounting-three-way-match'
import { findPrimaryVoucherForSource } from '../../lib/accounting-voucher-service'
import { ReceivingReportViewModal } from './ReceivingReportViewModal'
import { Modal } from './Modal'
import { PurchaseOrderViewModal } from './PurchaseOrderViewModal'
import { X, Upload, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'

type Props = {
  brandId: string
  invoice?: SupplierInvoice | null
  initialPoId?: string
  viewOnly?: boolean
  onClose: () => void
  onSaved: (invoice: SupplierInvoice) => void
  onCreateVoucher: (invoice: SupplierInvoice) => void
  onGoToProcurement?: (poId: string) => void
  themeBtn: string
}

type LineDraft = {
  po_item_id: string
  product_description: string
  po_qty: number
  received_qty: number
  po_unit_price: number
  quantity_invoiced: number
  unit_price: number
  line_amount: number
}

export function supplierInvoiceStatusBadgeClass(status: SupplierInvoiceStatus): string {
  if (status === 'draft') return 'bg-gray-100 text-gray-700'
  if (status === 'matched') return 'bg-green-100 text-green-800'
  if (status === 'exception') return 'bg-red-100 text-red-800'
  if (status === 'vouchered') return 'bg-blue-100 text-blue-800'
  if (status === 'paid') return 'bg-green-100 text-green-800'
  return 'bg-gray-100 text-gray-700'
}

export function SupplierInvoiceModal({
  brandId,
  invoice,
  initialPoId,
  viewOnly = false,
  onClose,
  onSaved,
  onCreateVoucher,
  onGoToProcurement,
  themeBtn,
}: Props) {
  const [poId, setPoId] = useState(invoice?.po_id || initialPoId || '')
  const [context, setContext] = useState<InvoiceContext | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState(
    invoice?.invoice_number || DEFAULT_SUPPLIER_INVOICE_NUMBER_PREFIX
  )
  const [invoiceDate, setInvoiceDate] = useState(
    invoice?.invoice_date || new Date().toISOString().split('T')[0]
  )
  const [attachmentUrl, setAttachmentUrl] = useState(invoice?.attachment_url || '')
  const [notes, setNotes] = useState(invoice?.notes || '')
  const [lines, setLines] = useState<LineDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [posOptions, setPosOptions] = useState<
    Array<{ id: string; po_number: string; supplier_name: string }>
  >([])
  const [invoicesByPoId, setInvoicesByPoId] = useState<Record<string, PoExistingInvoice[]>>({})
  const [existingVoucher, setExistingVoucher] = useState<string | null>(null)
  const [savedStatus, setSavedStatus] = useState<SupplierInvoiceStatus | null>(
    invoice?.status || null
  )
  const [savedInvoice, setSavedInvoice] = useState<SupplierInvoice | null>(invoice || null)
  const [viewingReceiptId, setViewingReceiptId] = useState<string | null>(null)
  const [viewingPoId, setViewingPoId] = useState<string | null>(null)

  const loadPos = useCallback(async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select(
        'id, po_number, status, payment_terms, payment_timing, supplier:suppliers(name), items:purchase_order_items(quantity_received)'
      )
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(100)
    const opts = (data || [])
      .filter((po) =>
        isPoEligibleForSupplierInvoiceEntry(
          po as {
            status?: string
            payment_terms?: string | null
            payment_timing?: string | null
            items?: Array<{ quantity_received: number }>
          }
        )
      )
      .map((po) => ({
        id: po.id,
        po_number: po.po_number,
        supplier_name: (po as { supplier?: { name?: string } }).supplier?.name || 'Supplier',
      }))
    setPosOptions(opts)
    const poIds = opts.map((po) => po.id)
    if (poIds.length > 0) {
      const byPo = await loadInvoicesByPoIds(poIds, brandId)
      setInvoicesByPoId(byPo)
    } else {
      setInvoicesByPoId({})
    }
  }, [brandId])

  const initLinesFromContext = useCallback(
    (ctx: InvoiceContext, existing?: SupplierInvoice | null) => {
      const existingMap = new Map((existing?.lines || []).map((l) => [l.po_item_id, l]))
      return (ctx.po.items || []).map((item) => {
        const received = ctx.receivedByPoItem[item.id] ?? 0
        const existingLine = existingMap.get(item.id)
        const poQty = Number(item.quantity) || 0
        const qty = existingLine ? Number(existingLine.quantity_invoiced) : poQty
        const price = existingLine ? Number(existingLine.unit_price) : Number(item.unit_price) || 0
        return {
          po_item_id: item.id,
          product_description: item.product_description,
          po_qty: poQty,
          received_qty: received,
          po_unit_price: Number(item.unit_price) || 0,
          quantity_invoiced: qty,
          unit_price: price,
          line_amount: Math.round(qty * price * 100) / 100,
        }
      })
    },
    []
  )

  useEffect(() => {
    void loadPos()
  }, [loadPos])

  const isNewInvoice = !invoice
  const selectablePos = useMemo(() => {
    if (!isNewInvoice) return posOptions
    return posOptions.filter((po) => !(invoicesByPoId[po.id]?.length > 0))
  }, [posOptions, invoicesByPoId, isNewInvoice])

  useEffect(() => {
    if (!isNewInvoice || !poId) return
    if ((invoicesByPoId[poId] || []).length > 0) {
      setPoId('')
    }
  }, [invoicesByPoId, poId, isNewInvoice])

  useEffect(() => {
    if (!poId) {
      setContext(null)
      setLines([])
      return
    }
    setLoading(true)
    loadInvoiceContext(poId)
      .then((ctx) => {
        if (!ctx) return
        setContext(ctx)
        setLines(initLinesFromContext(ctx, savedInvoice || invoice))
      })
      .finally(() => setLoading(false))
  }, [poId, invoice, initLinesFromContext, savedInvoice])

  useEffect(() => {
    if (invoice?.id) {
      findPrimaryVoucherForSource('supplier_invoice', invoice.id).then((v) => {
        setExistingVoucher(v?.voucher_number || null)
      })
    }
  }, [invoice?.id])

  const totalAmount = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.line_amount) || 0), 0),
    [lines]
  )

  const matchResult = useMemo(() => {
    if (!context) return null
    return computeMatchForDraft(context, {
      lines: lines.map((l) => ({
        po_item_id: l.po_item_id,
        quantity_invoiced: l.quantity_invoiced,
        unit_price: l.unit_price,
        line_amount: l.line_amount,
      })),
      total_amount: totalAmount,
    })
  }, [context, lines, totalAmount])

  const needsProcurementPoFix = matchResultNeedsPoAmendment(matchResult)
  const isPreDeliveryPaymentPo = isPaymentBeforeDeliveryPo(context?.po || {})

  const updateLine = (idx: number, field: 'quantity_invoiced' | 'unit_price', value: number) => {
    setLines((prev) => {
      const next = [...prev]
      const line = { ...next[idx], [field]: value }
      line.line_amount = Math.round(line.quantity_invoiced * line.unit_price * 100) / 100
      next[idx] = line
      return next
    })
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'pdf'
      const path = `${brandId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('supplier_invoices').upload(path, file)
      if (error) throw error
      const { data } = supabase.storage.from('supplier_invoices').getPublicUrl(path)
      setAttachmentUrl(data.publicUrl)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const activeInvoice = savedInvoice || invoice

  const handleSave = async () => {
    if (!poId) {
      alert('Purchase order is required.')
      return
    }
    if (!invoiceNumber.trim()) {
      alert('Supplier invoice number is required.')
      return
    }
    setSaving(true)
    try {
      const draft: SupplierInvoiceDraft = {
        id: invoice?.id || savedInvoice?.id,
        brand_id: brandId,
        po_id: poId,
        supplier_id: context?.po.supplier_id,
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        total_amount: totalAmount,
        attachment_url: attachmentUrl || null,
        notes: notes || null,
        lines: lines
          .filter((l) => l.quantity_invoiced > 0)
          .map((l) => ({
            po_item_id: l.po_item_id,
            quantity_invoiced: l.quantity_invoiced,
            unit_price: l.unit_price,
            line_amount: l.line_amount,
          })),
      }
      const saved = await saveSupplierInvoice(draft)
      setSavedStatus(saved.status)
      setSavedInvoice(saved)
      onSaved(saved)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const displayStatus = savedStatus || activeInvoice?.status
  const hasSavedOnce = !!displayStatus

  const showLineMatchActions =
    !!matchResult &&
    (matchResult.status === 'exception' ||
      (hasSavedOnce && displayStatus === 'exception')) &&
    matchResult.lines.some((l) => l.issues.length > 0)

  const matchActionMessages = useMemo(
    () => (matchResult && showLineMatchActions ? formatMatchActionMessages(matchResult) : []),
    [matchResult, showLineMatchActions]
  )

  const canCreateVoucher =
    (savedStatus === 'matched' || activeInvoice?.status === 'matched') &&
    !existingVoucher &&
    (matchResult?.canCreateVoucher || isPreDeliveryPaymentPo) &&
    !!activeInvoice?.id

  const primaryReceipt = context?.deliveryReceipts?.[0]

  return (
    <>
      <Modal onClose={onClose} align="center">
        <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
          <div className="p-4 border-b flex justify-between items-start gap-3 shrink-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">
                  {viewOnly
                    ? 'View Supplier Invoice'
                    : invoice || savedInvoice
                      ? 'Edit Supplier Invoice'
                      : 'Enter Supplier Invoice'}
                </h2>
                {displayStatus && (
                  <SupplierInvoiceStatusBadge status={displayStatus} />
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {isPreDeliveryPaymentPo
                  ? 'Pre-delivery payment: PO + Invoice'
                  : '3-way match: PO + Receiving Report + Invoice'}
              </p>
            </div>
            <button type="button" onClick={onClose} className="shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Purchase Order</label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-50"
                  value={poId}
                  disabled={!!invoice || viewOnly}
                  onChange={(e) => setPoId(e.target.value)}
                >
                  <option value="">
                    {selectablePos.length === 0
                      ? 'No POs awaiting supplier invoice…'
                      : 'Select PO…'}
                  </option>
                  {selectablePos.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} — {po.supplier_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Supplier Invoice # <span className="text-red-600">*</span>
                </label>
                <input
                  className="w-full border rounded px-2 py-1.5 text-sm font-mono disabled:bg-gray-50"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder={`${DEFAULT_SUPPLIER_INVOICE_NUMBER_PREFIX}123456`}
                  required
                  readOnly={viewOnly}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Invoice Date</label>
                <input
                  type="date"
                  className="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-50"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  readOnly={viewOnly}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Attachment</label>
                <div className="flex gap-2 items-center">
                  {!viewOnly && (
                    <label className="flex items-center gap-1 px-3 py-1.5 border rounded text-sm cursor-pointer hover:bg-gray-50">
                      <Upload className="h-4 w-4" />
                      {uploading ? 'Uploading…' : 'Upload'}
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) void handleUpload(f)
                        }}
                      />
                    </label>
                  )}
                  {attachmentUrl && (
                    <a
                      href={attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 truncate max-w-[180px]"
                    >
                      View file
                    </a>
                  )}
                </div>
              </div>
            </div>

            {loading && <p className="text-sm text-gray-500">Loading PO context…</p>}

            {context && (
              <>
                <div className="space-y-3">
                  <div className="bg-blue-50/60 rounded-lg border border-blue-100 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-xs font-semibold uppercase text-blue-800">Purchase Order</p>
                      <button
                        type="button"
                        onClick={() => setViewingPoId(context.po.id)}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View purchase order
                      </button>
                    </div>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">PO #</dt>
                        <dd className="font-mono font-medium text-gray-900">{context.po.po_number}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">Supplier</dt>
                        <dd className="text-gray-900">{context.po.supplier?.name || '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">Order date</dt>
                        <dd className="text-gray-900">
                          {context.po.order_date
                            ? new Date(context.po.order_date).toLocaleDateString()
                            : '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">PO total</dt>
                        <dd className="tabular-nums font-medium text-gray-900">
                          ₱
                          {(Number(context.po.total_amount) || 0).toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                          })}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">Lines</dt>
                        <dd className="text-gray-900">{(context.po.items || []).length}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">Status</dt>
                        <dd className="capitalize text-gray-900">
                          {(context.po.status || '—').replace(/_/g, ' ')}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="bg-amber-50/60 rounded-lg border border-amber-100 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-xs font-semibold uppercase text-amber-800">Receiving Reports</p>
                      {primaryReceipt && (
                        <button
                          type="button"
                          onClick={() => setViewingReceiptId(primaryReceipt.id)}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View receiving report
                        </button>
                      )}
                    </div>
                    {context.deliveryReceipts.length === 0 ? (
                      isPreDeliveryPaymentPo ? (
                        <p className="text-xs text-gray-500">
                          No receiving report yet — expected for pre-delivery payment terms.
                        </p>
                      ) : (
                        <p className="text-red-600 text-xs">No receiving report on file for this PO.</p>
                      )
                    ) : (
                      <ul className="space-y-1">
                        {context.deliveryReceipts.map((dr) => (
                          <li key={dr.id} className="flex items-center gap-2 text-xs text-gray-700">
                            <span className="font-mono">{dr.receipt_number}</span>
                            <span>{dr.delivery_date}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs min-w-[900px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2">Item</th>
                        <th className="text-right px-3 py-2 bg-blue-50/50">PO Qty</th>
                        <th className="text-right px-3 py-2 bg-blue-50/50">PO Price</th>
                        <th className="text-right px-3 py-2 bg-amber-50/50">Received</th>
                        <th className="text-right px-3 py-2 bg-green-50/50">Invoice Qty</th>
                        <th className="text-right px-3 py-2 bg-green-50/50">Invoice Price</th>
                        <th className="text-right px-3 py-2">Line Total</th>
                        <th className="text-left px-3 py-2 w-20 shrink-0 whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {lines.map((line, idx) => {
                        const lineMatch = matchResult?.lines.find((l) => l.poItemId === line.po_item_id)
                        const issueCount = lineMatch?.issues.length || 0
                        const hasIssue = issueCount > 0
                        return (
                          <tr key={line.po_item_id} className={hasIssue ? 'bg-red-50' : ''}>
                            <td className="px-3 py-2 text-gray-800">{line.product_description}</td>
                            <td className="px-3 py-2 text-right tabular-nums bg-blue-50/30">
                              {line.po_qty}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums bg-blue-50/30">
                              ₱
                              {line.po_unit_price.toLocaleString('en-PH', {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums bg-amber-50/30 font-medium">
                              {line.received_qty}
                            </td>
                            <td className="px-3 py-2 text-right bg-green-50/30">
                              {viewOnly ? (
                                <span className="tabular-nums">{line.quantity_invoiced}</span>
                              ) : (
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  className="w-20 border rounded px-1 py-0.5 text-right"
                                  value={line.quantity_invoiced || ''}
                                  onChange={(e) =>
                                    updateLine(idx, 'quantity_invoiced', Number(e.target.value) || 0)
                                  }
                                />
                              )}
                            </td>
                            <td className="px-3 py-2 text-right bg-green-50/30">
                              {viewOnly ? (
                                <span className="tabular-nums">
                                  ₱
                                  {line.unit_price.toLocaleString('en-PH', {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  className="w-24 border rounded px-1 py-0.5 text-right"
                                  value={line.unit_price || ''}
                                  onChange={(e) =>
                                    updateLine(idx, 'unit_price', Number(e.target.value) || 0)
                                  }
                                />
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">
                              ₱{line.line_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2 w-20 shrink-0 whitespace-nowrap">
                              {line.quantity_invoiced <= 0 ? (
                                <span className="text-gray-400">—</span>
                              ) : hasIssue ? (
                                <span
                                  className="text-red-700 text-[10px] font-medium leading-snug"
                                  title={
                                    lineMatch
                                      ? [...lineMatch.issues, ...lineMatch.resolutionHints].join('\n')
                                      : undefined
                                  }
                                >
                                  Mismatch
                                </span>
                              ) : (
                                <span className="text-green-700 text-[10px]">OK</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-medium">
                        <td colSpan={6} className="px-3 py-2 text-right">
                          Total
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          ₱{totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {matchResult && (
                  <div
                    className={`rounded-lg p-3 text-sm flex gap-2 ${
                      matchResult.status === 'matched' && hasSavedOnce && displayStatus === 'matched'
                        ? 'bg-green-50 text-green-800'
                        : matchResult.status === 'exception' ||
                            (hasSavedOnce && displayStatus === 'exception')
                          ? 'bg-red-50 text-red-800'
                          : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    {matchResult.status === 'matched' && displayStatus !== 'exception' ? (
                      <CheckCircle className="h-5 w-5 shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 shrink-0" />
                    )}
                    <div className="min-w-0 space-y-1">
                      {showLineMatchActions ? (
                        matchActionMessages.length > 0 ? (
                          matchActionMessages.map((msg, i) => (
                            <p key={i} className="text-sm leading-snug">
                              {msg}
                            </p>
                          ))
                        ) : (
                          <p className="text-sm leading-snug">Fix mismatched lines before saving.</p>
                        )
                      ) : (
                        <p className="text-sm leading-snug">
                          {formatMatchUserMessage(matchResult, !hasSavedOnce ? 'preview' : 'saved') ||
                            (!hasSavedOnce
                              ? 'Save invoice to confirm match.'
                              : displayStatus === 'draft'
                                ? 'Draft saved — complete lines and save again to run match.'
                                : isPreDeliveryPaymentPo && displayStatus === 'matched'
                                  ? 'Invoice matched for pre-delivery payment.'
                                  : displayStatus === 'matched'
                                    ? '3-way match passed.'
                                    : 'Fix match issues before creating a payment voucher.')}
                        </p>
                      )}
                      {needsProcurementPoFix && onGoToProcurement && poId && !viewOnly && (
                        <button
                          type="button"
                          onClick={() => onGoToProcurement(poId)}
                          className="mt-2 text-xs font-medium text-blue-700 hover:underline"
                        >
                          Go to Procurement to update purchase order →
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {existingVoucher && (
                  <p className="text-xs text-blue-700">
                    Payment voucher {existingVoucher} already linked to this invoice.
                  </p>
                )}
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                className="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-50"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                readOnly={viewOnly}
              />
            </div>
          </div>

          <div className="p-4 border-t flex justify-end gap-2 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">
              {viewOnly ? 'Close' : 'Cancel'}
            </button>
            {!viewOnly && (
              <>
                <button
                  type="button"
                  disabled={saving || !poId || !invoiceNumber.trim()}
                  onClick={() => void handleSave()}
                  className={`px-4 py-2 text-white rounded-lg text-sm disabled:opacity-50 ${themeBtn}`}
                >
                  {saving ? 'Saving…' : 'Save Invoice'}
                </button>
                {canCreateVoucher && activeInvoice && (
                  <button
                    type="button"
                    onClick={() => onCreateVoucher(activeInvoice)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                  >
                    Create Payment Voucher
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </Modal>

      {viewingPoId && (
        <PurchaseOrderViewModal poId={viewingPoId} onClose={() => setViewingPoId(null)} />
      )}

      {viewingReceiptId && (
        <ReceivingReportViewModal
          receiptId={viewingReceiptId}
          onClose={() => setViewingReceiptId(null)}
        />
      )}
    </>
  )
}

export function SupplierInvoiceStatusBadge({ status }: { status: SupplierInvoiceStatus }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${supplierInvoiceStatusBadgeClass(status)}`}>
      {status}
    </span>
  )
}
