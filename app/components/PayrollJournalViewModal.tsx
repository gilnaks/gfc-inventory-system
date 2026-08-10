'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Modal } from './Modal'
import { formatGlPhp } from './AccountingLedgerTable'

type PayrollDetail = {
  brandName: string
  weekStart?: string
  weekEnd?: string
  grossPay: number
  netPay: number
  refunds: number
  cashAdvances: number
  withholdings: number
}

export function PayrollJournalViewModal({
  payrollRunBrandTotalId,
  onClose,
}: {
  payrollRunBrandTotalId: string
  onClose: () => void
}) {
  const [detail, setDetail] = useState<PayrollDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      const { data, error: err } = await supabase
        .from('payroll_run_brand_totals')
        .select(
          'gross_pay, net_pay, refunds, cash_advances_withheld, withholdings_other, payroll_run:payroll_runs(week_start_date, week_end_date), brand:brands(name)'
        )
        .eq('id', payrollRunBrandTotalId)
        .maybeSingle()
      if (cancelled) return
      if (err || !data) {
        setError(err?.message || 'Payroll record not found')
        setLoading(false)
        return
      }
      const runRaw = data.payroll_run as
        | { week_start_date?: string; week_end_date?: string }
        | { week_start_date?: string; week_end_date?: string }[]
        | null
      const run = Array.isArray(runRaw) ? runRaw[0] : runRaw
      const brandRaw = data.brand as { name?: string } | { name?: string }[] | null
      setDetail({
        brandName: (Array.isArray(brandRaw) ? brandRaw[0]?.name : brandRaw?.name) || 'Brand',
        weekStart: run?.week_start_date,
        weekEnd: run?.week_end_date,
        grossPay: Number(data.gross_pay) || 0,
        netPay: Number(data.net_pay) || 0,
        refunds: Number(data.refunds) || 0,
        cashAdvances: Number(data.cash_advances_withheld) || 0,
        withholdings: Number(data.withholdings_other) || 0,
      })
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [payrollRunBrandTotalId])

  return (
    <Modal onClose={onClose} align="center" zIndex={70}>
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Payroll</h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          {loading && <p className="text-gray-500">Loading…</p>}
          {error && <p className="text-red-600">{error}</p>}
          {detail && (
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <dt className="text-gray-500">Brand</dt>
                <dd className="font-medium">{detail.brandName}</dd>
              </div>
              {(detail.weekStart || detail.weekEnd) && (
                <div className="col-span-2">
                  <dt className="text-gray-500">Pay period</dt>
                  <dd className="font-medium">
                    {detail.weekStart} – {detail.weekEnd}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Gross pay</dt>
                <dd className="font-medium tabular-nums">{formatGlPhp(detail.grossPay)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Net pay</dt>
                <dd className="font-medium tabular-nums">{formatGlPhp(detail.netPay)}</dd>
              </div>
              {detail.refunds > 0 && (
                <div>
                  <dt className="text-gray-500">Refunds</dt>
                  <dd className="font-medium tabular-nums">{formatGlPhp(detail.refunds)}</dd>
                </div>
              )}
              {detail.cashAdvances > 0 && (
                <div>
                  <dt className="text-gray-500">Cash advances</dt>
                  <dd className="font-medium tabular-nums">{formatGlPhp(detail.cashAdvances)}</dd>
                </div>
              )}
              {detail.withholdings > 0 && (
                <div>
                  <dt className="text-gray-500">Withholdings</dt>
                  <dd className="font-medium tabular-nums">{formatGlPhp(detail.withholdings)}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>
    </Modal>
  )
}
