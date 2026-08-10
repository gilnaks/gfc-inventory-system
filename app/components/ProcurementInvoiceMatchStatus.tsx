'use client'

import type { PoInvoiceMatchSummary } from '../../lib/supplier-invoice-service'
import type { SupplierInvoiceStatus } from '../../lib/supabase'
import { AlertCircle, CheckCircle, Clock } from 'lucide-react'

const STATUS_STYLES: Record<
  SupplierInvoiceStatus | 'none',
  { label: string; className: string; icon?: 'alert' | 'check' | 'clock' }
> = {
  none: { label: 'Awaiting invoice', className: 'bg-amber-100 text-amber-800', icon: 'clock' },
  draft: { label: 'Invoice draft', className: 'bg-gray-100 text-gray-700', icon: 'clock' },
  exception: { label: 'Match exception', className: 'bg-red-100 text-red-800', icon: 'alert' },
  matched: { label: 'Ready for payment', className: 'bg-green-100 text-green-800', icon: 'check' },
  vouchered: { label: 'PV created', className: 'bg-blue-100 text-blue-800', icon: 'check' },
  paid: { label: 'Paid', className: 'bg-purple-100 text-purple-800', icon: 'check' },
}

export function InvoiceMatchStatusChip({
  summary,
}: {
  summary?: PoInvoiceMatchSummary | null
}) {
  const key = summary?.status || 'none'
  const style = STATUS_STYLES[key] || STATUS_STYLES.none
  const Icon =
    style.icon === 'alert' ? AlertCircle : style.icon === 'check' ? CheckCircle : Clock

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${style.className}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {style.label}
    </span>
  )
}

export function InvoiceMatchIssuesPanel({
  summary,
  compact = false,
}: {
  summary?: PoInvoiceMatchSummary | null
  compact?: boolean
}) {
  if (!summary) {
    return (
      <div className={`rounded-lg border border-amber-200 bg-amber-50 text-amber-900 ${compact ? 'p-2 text-xs' : 'p-3 text-sm'}`}>
        <p className="font-medium">No supplier invoice yet</p>
        <p className={compact ? 'mt-0.5' : 'mt-1'}>
          After goods are received, Accounting enters the supplier invoice and runs the 3-way match.
        </p>
      </div>
    )
  }

  if (summary.status === 'matched' || summary.status === 'vouchered') {
    return (
      <div className={`rounded-lg border border-green-200 bg-green-50 text-green-900 ${compact ? 'p-2 text-xs' : 'p-3 text-sm'}`}>
        <p className="font-medium">
          Supplier invoice {summary.invoice_number} is matched
        </p>
        <p className={compact ? 'mt-0.5' : 'mt-1'}>
          Recording additional receipt will change received quantities and may invalidate the match.
          Accounting must re-save the invoice after receipt changes.
        </p>
      </div>
    )
  }

  if (summary.status === 'paid') {
    return (
      <div className={`rounded-lg border border-purple-200 bg-purple-50 text-purple-900 ${compact ? 'p-2 text-xs' : 'p-3 text-sm'}`}>
        <p className="font-medium">Invoice {summary.invoice_number} is paid</p>
      </div>
    )
  }

  if (summary.status === 'draft') {
    return (
      <div className={`rounded-lg border border-gray-200 bg-gray-50 text-gray-800 ${compact ? 'p-2 text-xs' : 'p-3 text-sm'}`}>
        <p className="font-medium">Invoice {summary.invoice_number} is a draft in Accounting</p>
        <p className={compact ? 'mt-0.5' : 'mt-1'}>Complete and save the supplier invoice to run 3-way match.</p>
      </div>
    )
  }

  if (summary.status === 'exception') {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 text-red-900 ${compact ? 'p-2 text-xs' : 'p-3 text-sm'}`}>
        <p className="font-medium flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          3-way match exception — {summary.invoice_number}
        </p>
        {summary.summary_issues.length > 0 || summary.line_issues.length > 0 ? (
          <ul className={`space-y-1 ${compact ? 'mt-1.5' : 'mt-2'}`}>
            {summary.summary_issues.map((issue) => (
              <li key={issue}>• {issue}</li>
            ))}
            {summary.line_issues.map((issue) => (
              <li key={issue}>• {issue}</li>
            ))}
          </ul>
        ) : null}
      </div>
    )
  }

  return null
}
