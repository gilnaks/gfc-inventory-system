'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Truck } from 'lucide-react'
import type { Brand, IntercompanyTransfer } from '../../lib/supabase'
import {
  loadIntercompanyTransfers,
  settleIntercompanyTransfer,
} from '../../lib/intercompany-transfer-service'
import { hasLegacyIntercompanyMarkup } from '../../lib/accounting-intercompany-posting'
import {
  formatPhilippinesDate,
  formatPhilippinesDateTime,
  getPhilippinesBillingPeriodRange,
  isDateStringInBillingPeriod,
  isTimestampInBillingPeriod,
  type BillingTimeFilter,
} from '../../lib/timezone'
import { AccountingStatusBanner } from './AccountingStatusBanner'
import { Modal } from './Modal'

interface TransferReceivablesPanelProps {
  selectedBrand: Brand
  theme?: string
  timeFilter: BillingTimeFilter
  currentUsername?: string
  readOnlyMode?: boolean
  /** When set, only show transfers to this franchise brand. */
  franchiseBrandId?: string | null
}

function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function franchisePaymentStatus(transfer: IntercompanyTransfer): string {
  if (transfer.settlement_journal_entry_id_to) return 'Paid via PV'
  return 'Awaiting franchise PV'
}

function themeButtonClass(theme: string): string {
  switch (theme) {
    case 'green':
      return 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
    case 'red':
      return 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    case 'yellow':
      return 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
    default:
      return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
  }
}

export function TransferReceivablesPanel({
  selectedBrand,
  theme = 'blue',
  timeFilter,
  currentUsername = '',
  readOnlyMode = false,
  franchiseBrandId = null,
}: TransferReceivablesPanelProps) {
  const canEdit = !readOnlyMode
  const [transfers, setTransfers] = useState<IntercompanyTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [confirmTransfer, setConfirmTransfer] = useState<IntercompanyTransfer | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusVariant, setStatusVariant] = useState<'success' | 'error'>('success')

  const loadTransfers = useCallback(async () => {
    if (!selectedBrand?.id) return
    setLoading(true)
    try {
      const rows = await loadIntercompanyTransfers(selectedBrand.id)
      const gfcReceivables = rows.filter(
        (row) =>
          row.from_brand_id === selectedBrand.id &&
          row.status === 'posted' &&
          hasLegacyIntercompanyMarkup(row) &&
          (!franchiseBrandId || row.to_brand_id === franchiseBrandId)
      )
      setTransfers(gfcReceivables)
    } catch (error) {
      console.error('Failed to load transfer receivables:', error)
      setStatusVariant('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to load transfer receivables')
    } finally {
      setLoading(false)
    }
  }, [selectedBrand?.id, franchiseBrandId])

  useEffect(() => {
    loadTransfers()
  }, [loadTransfers])

  const periodRange = useMemo(() => getPhilippinesBillingPeriodRange(timeFilter), [timeFilter])

  const outstandingTransfers = useMemo(
    () =>
      transfers.filter(
        (row) =>
          !row.settled_at && isDateStringInBillingPeriod(row.transfer_date, timeFilter)
      ),
    [transfers, timeFilter]
  )

  const collectedTransfers = useMemo(
    () =>
      transfers.filter(
        (row) =>
          row.settled_at &&
          isTimestampInBillingPeriod(row.settled_at, periodRange.start, periodRange.end, timeFilter)
      ),
    [transfers, periodRange.end, periodRange.start, timeFilter]
  )

  const totalReceivable = useMemo(
    () => outstandingTransfers.reduce((sum, row) => sum + (Number(row.transfer_price_total) || 0), 0),
    [outstandingTransfers]
  )

  const totalCollected = useMemo(
    () => collectedTransfers.reduce((sum, row) => sum + (Number(row.transfer_price_total) || 0), 0),
    [collectedTransfers]
  )

  const brandBreakdown = useMemo(() => {
    const counts = new Map<string, { name: string; count: number; amount: number }>()
    for (const row of outstandingTransfers) {
      const name = row.to_brand?.name || 'Unknown brand'
      const existing = counts.get(row.to_brand_id) || { name, count: 0, amount: 0 }
      existing.count += 1
      existing.amount += Number(row.transfer_price_total) || 0
      counts.set(row.to_brand_id, existing)
    }
    return Array.from(counts.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [outstandingTransfers])

  const handleConfirmSettle = async () => {
    if (!confirmTransfer) return
    const settledBy = currentUsername.trim() || 'Accounting'
    setSettlingId(confirmTransfer.id)
    try {
      await settleIntercompanyTransfer(confirmTransfer.id, settledBy)
      setStatusVariant('success')
      setStatusMessage(`Transfer ${confirmTransfer.transfer_number} marked as paid.`)
      setConfirmTransfer(null)
      await loadTransfers()
    } catch (error) {
      setStatusVariant('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to settle transfer')
    } finally {
      setSettlingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading transfer receivables…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AccountingStatusBanner
        message={statusMessage}
        variant={statusVariant}
        onDismiss={() => setStatusMessage(null)}
      />

      <p className="text-sm text-gray-600">
        Outstanding amounts from franchise brands. Mark as paid only after the franchise payment
        voucher is posted — this records GFC cash collection in the books.
      </p>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Truck className="h-5 w-5 text-gray-500" />
          <h4 className="text-lg font-medium">Summary</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-orange-600 font-medium">Total Receivable</p>
            <p className="text-2xl font-bold text-orange-900">{formatCurrency(totalReceivable)}</p>
            <p className="text-xs text-orange-700 mt-1">
              {outstandingTransfers.length} outstanding transfer
              {outstandingTransfers.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600 font-medium">Collected</p>
            <p className="text-2xl font-bold text-green-900">{formatCurrency(totalCollected)}</p>
            <p className="text-xs text-green-700 mt-1">
              {collectedTransfers.length} settled transfer
              {collectedTransfers.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600 font-medium">By Franchise Brand</p>
            {brandBreakdown.length === 0 ? (
              <p className="text-sm text-blue-800 mt-2">No outstanding balances</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-blue-900">
                {brandBreakdown.map((row) => (
                  <li key={row.name} className="flex justify-between gap-2">
                    <span className="truncate">{row.name}</span>
                    <span className="shrink-0 font-medium">
                      {row.count} · {formatCurrency(row.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {outstandingTransfers.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-orange-50">
            <h4 className="text-lg font-medium text-orange-900">Outstanding Transfers (Receivable)</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transfer #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Franchise Brand
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Franchise Payment
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {outstandingTransfers.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {row.transfer_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatPhilippinesDate(row.transfer_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {row.to_brand?.name || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                      {formatCurrency(Number(row.transfer_price_total) || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {franchisePaymentStatus(row)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {row.settlement_journal_entry_id_to ? (
                        canEdit ? (
                        <button
                          type="button"
                          onClick={() => setConfirmTransfer(row)}
                          disabled={settlingId === row.id}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 ${themeButtonClass(theme)}`}
                        >
                          {settlingId === row.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Mark as Paid
                        </button>
                        ) : (
                          <span className="text-xs text-gray-500">Pending settlement</span>
                        )
                      ) : (
                        <span className="text-xs text-gray-500">Awaiting franchise PV</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-500">
          No outstanding intercompany receivables for this period.
        </div>
      )}

      {collectedTransfers.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
            <h4 className="text-lg font-medium text-green-900">Collected Transfers</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transfer #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transfer Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Franchise Brand
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Settled
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Settled By
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {collectedTransfers.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {row.transfer_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatPhilippinesDate(row.transfer_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {row.to_brand?.name || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                      {formatCurrency(Number(row.transfer_price_total) || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {row.settled_at ? formatPhilippinesDateTime(row.settled_at) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {row.settled_by || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {confirmTransfer ? (
        <Modal
          onClose={() => {
            if (!settlingId) setConfirmTransfer(null)
          }}
          align="center"
        >
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Mark Transfer as Paid</h3>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-sm text-gray-600">
                Confirm receipt for transfer{' '}
                <span className="font-medium text-gray-900">{confirmTransfer.transfer_number}</span> from{' '}
                <span className="font-medium text-gray-900">
                  {confirmTransfer.to_brand?.name || 'franchise brand'}
                </span>{' '}
                for{' '}
                <span className="font-medium text-gray-900">
                  {formatCurrency(Number(confirmTransfer.transfer_price_total) || 0)}
                </span>
                . This posts the GFC cash collection journal only.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmTransfer(null)}
                  disabled={!!settlingId}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSettle}
                  disabled={!!settlingId}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${themeButtonClass(theme)}`}
                >
                  {settlingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Mark as Paid
                </button>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
