'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { getPhilippinesBillingPeriodLabel, type BillingTimeFilter } from '../../lib/timezone'
import { formatGlPhp } from './AccountingLedgerTable'
import {
  isPreDeliveryPayableCategory,
  isPostDeliveryPayableCategory,
} from '../../lib/supplier-invoice-service'
import { AccountingPayablesSkeleton } from './AccountingBooksSkeletons'
import {
  accountingDocLinkClass,
  accountingVoucherLinkClass,
  accountingVoucherTextClass,
} from '../../lib/accounting-doc-link-styles'

export type PayableRow = {
  id: string
  sourceType: string
  sourceId: string
  category: string
  reference: string
  payee: string
  payeeBranchName?: string
  amount: number
  date: string
  voucherNumber?: string
  voucherId?: string
  voucherLink?: { sourceType: string; sourceId: string }
}

const PAGE_SIZE = 10

function paginateSlice<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  return { slice: items.slice(start, start + pageSize), safePage, totalPages }
}

function PayeeHoverCell({ label, branchName }: { label: string; branchName?: string }) {
  const display = label || '—'
  const branch = branchName?.trim()
  if (!branch || branch === display) return <span>{display}</span>
  return (
    <span className="inline-block cursor-default">
      <span className="group-hover:hidden">{display}</span>
      <span className="hidden group-hover:inline">{branch}</span>
    </span>
  )
}

function categoryBadgeClass(sourceType: string, category?: string): string {
  if (category?.startsWith('Pre-delivery')) return 'bg-amber-50 text-amber-900 border-amber-200'
  if (category?.startsWith('Post-delivery')) return 'bg-sky-50 text-sky-900 border-sky-200'
  if (sourceType === 'supplier_invoice_exception') return 'bg-red-50 text-red-800 border-red-200'
  if (sourceType === 'supplier_invoice_ready') return 'bg-green-50 text-green-800 border-green-200'
  if (sourceType === 'purchase_order') return 'bg-amber-50 text-amber-800 border-amber-200'
  if (sourceType === 'payroll_run_brand_total') return 'bg-violet-50 text-violet-800 border-violet-200'
  if (sourceType === 'po_payment') return 'bg-blue-50 text-blue-800 border-blue-200'
  return 'bg-gray-50 text-gray-700 border-gray-200'
}

interface Props {
  payables: PayableRow[]
  loading: boolean
  periodFilter: BillingTimeFilter
  readOnlyMode?: boolean
  onEnterInvoice: (poId: string) => void
  onResolveException: (invoiceId: string) => void
  onCreatePvFromInvoice: (invoiceId: string) => void
  onViewInvoice: (invoiceId: string) => void
  onViewVoucher: (voucherId: string) => void
  onPayPayroll: (row: PayableRow) => void
  onGoToSupplierInvoices: () => void
  /** When true, parent already renders the Payables title/description. */
  hideHeaderDescription?: boolean
}

export function AccountingPayables({
  payables,
  loading,
  periodFilter,
  readOnlyMode = false,
  hideHeaderDescription = false,
  onEnterInvoice,
  onResolveException,
  onCreatePvFromInvoice,
  onViewInvoice,
  onViewVoucher,
  onPayPayroll,
  onGoToSupplierInvoices,
}: Props) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const periodLabel = useMemo(() => getPhilippinesBillingPeriodLabel(periodFilter), [periodFilter])

  const categoryOptions = useMemo(() => {
    const cats = new Set(payables.map((r) => r.category))
    return Array.from(cats).sort()
  }, [payables])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return payables.filter((row) => {
      if (categoryFilter && row.category !== categoryFilter) return false
      if (!q) return true
      return (
        row.reference.toLowerCase().includes(q) ||
        row.payee.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q) ||
        (row.voucherNumber || '').toLowerCase().includes(q)
      )
    })
  }, [payables, search, categoryFilter])

  const stats = useMemo(() => {
    const open = filtered.filter((r) => !r.voucherId)
    return {
      count: filtered.length,
      totalAmount: filtered.reduce((s, r) => s + r.amount, 0),
      openCount: open.length,
      openAmount: open.reduce((s, r) => s + r.amount, 0),
      vouchered: filtered.filter((r) => r.voucherId).length,
      exceptions: filtered.filter((r) => r.sourceType === 'supplier_invoice_exception').length,
      preDeliveryDue: open.filter((r) => isPreDeliveryPayableCategory(r.category)).length,
      postDeliveryDue: open.filter((r) => isPostDeliveryPayableCategory(r.category)).length,
    }
  }, [filtered])

  const { slice: pageRows, safePage, totalPages } = useMemo(
    () => paginateSlice(filtered, page, PAGE_SIZE),
    [filtered, page]
  )

  useEffect(() => {
    setPage(1)
  }, [payables, search, categoryFilter, periodFilter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const isInvoiceRow = (row: PayableRow) =>
    row.sourceType === 'supplier_invoice_ready' || row.sourceType === 'supplier_invoice_exception'

  const renderActions = (row: PayableRow) => {
    if (readOnlyMode) {
      if (row.sourceType === 'supplier_invoice_exception' || row.sourceType === 'supplier_invoice_ready') {
        return (
          <button
            type="button"
            onClick={() => onViewInvoice(row.sourceId)}
            className="text-xs font-medium px-2.5 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            View
          </button>
        )
      }
      return <span className="text-xs text-gray-400">—</span>
    }
    if (row.voucherId) {
      return <span className="text-xs text-gray-400">—</span>
    }
    if (row.sourceType === 'purchase_order') {
      return (
        <button
          type="button"
          onClick={() => onEnterInvoice(row.sourceId)}
          className="text-xs font-medium px-2.5 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Enter invoice
        </button>
      )
    }
    if (row.sourceType === 'supplier_invoice_exception') {
      return (
        <button
          type="button"
          onClick={() => onResolveException(row.sourceId)}
          className="text-xs font-medium px-2.5 py-1 border border-red-300 text-red-700 rounded-md hover:bg-red-50"
        >
          Resolve exception
        </button>
      )
    }
    if (row.sourceType === 'supplier_invoice_ready') {
      return (
        <button
          type="button"
          onClick={() => onCreatePvFromInvoice(row.sourceId)}
          className="text-xs font-medium px-2.5 py-1 border border-green-600 text-green-700 rounded-md hover:bg-green-50"
        >
          Create PV
        </button>
      )
    }
    if (row.sourceType === 'payroll_run_brand_total') {
      return (
        <button
          type="button"
          onClick={() => onPayPayroll(row)}
          className="text-xs font-medium px-2.5 py-1 border border-violet-300 text-violet-800 rounded-md hover:bg-violet-50"
        >
          Pay net payroll
        </button>
      )
    }
    if (row.sourceType === 'po_payment') {
      return (
        <button
          type="button"
          onClick={onGoToSupplierInvoices}
          className="text-xs font-medium px-2.5 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Match invoice
        </button>
      )
    }
    return <span className="text-xs text-gray-400">—</span>
  }

  return (
    <div className="space-y-5">
      {!hideHeaderDescription && (
        <p className="text-sm text-gray-600">
          Bills to pay — purchases waiting on an invoice, plus payroll.{' '}
          Period: <span className="font-medium text-gray-800">{periodLabel}</span>
        </p>
      )}

      {!loading && payables.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Payables', sub: `${stats.openCount} open`, value: String(stats.count) },
            { label: 'Open amount', sub: 'not yet vouchered', value: formatGlPhp(stats.openAmount) },
            { label: 'Total amount', sub: 'all visible rows', value: formatGlPhp(stats.totalAmount) },
            {
              label: 'Exceptions',
              sub: stats.exceptions ? 'need resolution' : 'none',
              value: String(stats.exceptions),
            },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-lg font-semibold tabular-nums text-gray-900 mt-0.5">{card.value}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {stats.preDeliveryDue > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {stats.preDeliveryDue} payment-before-delivery{' '}
          {stats.preDeliveryDue === 1 ? 'PO needs' : 'POs need'} a supplier invoice or payment voucher.
        </div>
      )}

      {stats.postDeliveryDue > 0 && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          {stats.postDeliveryDue} received{' '}
          {stats.postDeliveryDue === 1 ? 'PO needs' : 'POs need'} a supplier invoice in Payables — enter
          invoice and run 3-way match before payment (COD / pay after delivery).
        </div>
      )}

      {stats.exceptions > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {stats.exceptions} match {stats.exceptions === 1 ? 'exception' : 'exceptions'} — resolve
          variances before creating payment vouchers.
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Procurement & payroll</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-700 mb-1 block">Search</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="search"
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white"
                placeholder="Reference, payee, voucher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-700 mb-1 block">Category</span>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All categories</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        {(search || categoryFilter) && (
          <p className="text-xs text-gray-500">
            Showing {filtered.length} of {payables.length}.{' '}
            <button
              type="button"
              className="text-blue-600 hover:underline"
              onClick={() => {
                setSearch('')
                setCategoryFilter('')
              }}
            >
              Clear filters
            </button>
          </p>
        )}
      </section>

      {loading ? (
        <AccountingPayablesSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-10 text-center text-sm text-gray-500">
          {payables.length === 0
            ? 'No payables found for this brand and period.'
            : 'No payables match your filters.'}
        </div>
      ) : (
        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Payables queue</h3>
            <p className="text-xs text-gray-500">{stats.vouchered} vouchered in view</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-white border-b text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2.5">Category</th>
                  <th className="text-left px-4 py-2.5">Reference</th>
                  <th className="text-left px-4 py-2.5">Payee</th>
                  <th className="text-right px-4 py-2.5">Amount</th>
                  <th className="text-left px-4 py-2.5">Date</th>
                  <th className="text-left px-4 py-2.5">Voucher</th>
                  <th className="text-right px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${categoryBadgeClass(row.sourceType, row.category)}`}
                      >
                        {row.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {isInvoiceRow(row) ? (
                        <button
                          type="button"
                          onClick={() => onViewInvoice(row.sourceId)}
                          className={accountingDocLinkClass}
                        >
                          {row.reference}
                        </button>
                      ) : (
                        <span className="font-mono text-xs">{row.reference}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 group">
                      <PayeeHoverCell label={row.payee} branchName={row.payeeBranchName} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {formatGlPhp(row.amount)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{row.date || '—'}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {row.voucherNumber && row.voucherId ? (
                        <button
                          type="button"
                          onClick={() => onViewVoucher(row.voucherId!)}
                          className={accountingVoucherLinkClass}
                        >
                          {row.voucherNumber}
                        </button>
                      ) : row.voucherNumber ? (
                        <span className={accountingVoucherTextClass}>{row.voucherNumber}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">{renderActions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > PAGE_SIZE && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-gray-700">
                Showing {(safePage - 1) * PAGE_SIZE + 1} to{' '}
                {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} payables
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
