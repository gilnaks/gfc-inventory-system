'use client'

import { Fragment, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase, type AccountingVoucherLink } from '../../lib/supabase'
import { PurchaseOrderViewModal } from './PurchaseOrderViewModal'
import { ReceivingReportViewModal } from './ReceivingReportViewModal'
import { SupplierInvoiceViewModal } from './SupplierInvoiceViewModal'
import { formatPoLabel } from '../../lib/accounting-voucher-prefill'

const SUPPORTING_DOCS_FONT = 'font-mono text-xs tracking-tight'

type DocLabels = {
  po?: string
  invoice?: string
  receipt?: string
}

export function procurementDocIdsFromLinks(links: AccountingVoucherLink[]) {
  return {
    poId: links.find((l) => l.source_type === 'purchase_order')?.source_id,
    invoiceId: links.find((l) => l.source_type === 'supplier_invoice')?.source_id,
    receiptId: links.find((l) => l.source_type === 'delivery_receipt')?.source_id,
  }
}

export function procurementDocFlagsFromLinks(links: AccountingVoucherLink[]) {
  const { poId, invoiceId, receiptId } = procurementDocIdsFromLinks(links)
  return {
    has_po: !!poId,
    has_invoice: !!invoiceId,
    has_receiving_report: !!receiptId,
    has_dr: !!receiptId,
  }
}

export function VoucherProcurementSupportingDocs({
  links,
  brandId,
  themeBtn = 'bg-blue-600 hover:bg-blue-700',
  divider = 'below',
}: {
  links: AccountingVoucherLink[]
  brandId?: string
  themeBtn?: string
  /** `below` when section sits above form fields; `above` when it sits below totals. */
  divider?: 'above' | 'below'
}) {
  const { poId, invoiceId, receiptId } = procurementDocIdsFromLinks(links)
  const [labels, setLabels] = useState<DocLabels>({})
  const [viewPo, setViewPo] = useState(false)
  const [viewReceipt, setViewReceipt] = useState(false)
  const [viewInvoice, setViewInvoice] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const next: DocLabels = {}
      if (poId) {
        const { data } = await supabase
          .from('purchase_orders')
          .select('po_number')
          .eq('id', poId)
          .maybeSingle()
        if (!cancelled && data?.po_number) next.po = formatPoLabel(data.po_number)
      }
      if (invoiceId) {
        const { data } = await supabase
          .from('supplier_invoices')
          .select('invoice_number')
          .eq('id', invoiceId)
          .maybeSingle()
        if (!cancelled && data?.invoice_number) next.invoice = data.invoice_number
      }
      if (receiptId) {
        const { data } = await supabase
          .from('delivery_receipts')
          .select('receipt_number')
          .eq('id', receiptId)
          .maybeSingle()
        if (!cancelled && data?.receipt_number) next.receipt = data.receipt_number
      }
      if (!cancelled) setLabels(next)
    })()
    return () => {
      cancelled = true
    }
  }, [poId, invoiceId, receiptId])

  const openInvoice = () => {
    if (!invoiceId) return
    setViewInvoice(true)
  }

  if (!poId && !invoiceId && !receiptId) {
    return (
      <p className={`${SUPPORTING_DOCS_FONT} text-gray-500`}>No linked procurement documents.</p>
    )
  }

  const docLinks: Array<{ key: string; label: string; onClick: () => void }> = []
  if (poId) {
    docLinks.push({
      key: 'po',
      label: labels.po || 'Purchase order',
      onClick: () => setViewPo(true),
    })
  }
  if (invoiceId) {
    docLinks.push({
      key: 'invoice',
      label: labels.invoice ? `Invoice ${labels.invoice}` : 'Supplier invoice',
      onClick: openInvoice,
    })
  }
  if (receiptId) {
    docLinks.push({
      key: 'receipt',
      label: labels.receipt ? `Receiving report ${labels.receipt}` : 'Receiving report',
      onClick: () => setViewReceipt(true),
    })
  }

  const dividerClass =
    divider === 'above' ? 'pt-3 border-t border-gray-200' : 'pb-3 border-b border-gray-200'

  return (
    <>
      <div className={dividerClass}>
        <p className={`${SUPPORTING_DOCS_FONT} uppercase tracking-wider text-gray-500 mb-1.5`}>
          Supporting documents
        </p>
        <div className={`flex flex-wrap items-center gap-y-1 ${SUPPORTING_DOCS_FONT}`}>
          {docLinks.map((doc, index) => (
            <Fragment key={doc.key}>
              {index > 0 && (
                <span className="text-gray-300 select-none px-2" aria-hidden="true">
                  |
                </span>
              )}
              <button
                type="button"
                onClick={doc.onClick}
                className="text-blue-700 hover:text-blue-900 hover:underline text-left"
              >
                {doc.label}
              </button>
            </Fragment>
          ))}
        </div>
      </div>

      {typeof document !== 'undefined' &&
        viewPo &&
        poId &&
        createPortal(
          <PurchaseOrderViewModal poId={poId} onClose={() => setViewPo(false)} />,
          document.body
        )}
      {typeof document !== 'undefined' &&
        viewReceipt &&
        receiptId &&
        createPortal(
          <ReceivingReportViewModal receiptId={receiptId} onClose={() => setViewReceipt(false)} />,
          document.body
        )}
      {typeof document !== 'undefined' &&
        viewInvoice &&
        invoiceId &&
        createPortal(
          <SupplierInvoiceViewModal invoiceId={invoiceId} onClose={() => setViewInvoice(false)} />,
          document.body
        )}
    </>
  )
}
