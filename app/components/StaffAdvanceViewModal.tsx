'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Modal } from './Modal'
import { formatGlPhp } from './AccountingLedgerTable'

type StaffAdvanceDetail = {
  staffName: string
  amount: number
  status: string
  disbursedAt?: string | null
  notes?: string | null
}

export function StaffAdvanceViewModal({
  disbursementId,
  onClose,
}: {
  disbursementId: string
  onClose: () => void
}) {
  const [detail, setDetail] = useState<StaffAdvanceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      const { data, error: err } = await supabase
        .from('staff_advance_disbursements')
        .select('amount, status, disbursed_at, notes, staff:staff_registrations(full_name)')
        .eq('id', disbursementId)
        .maybeSingle()
      if (cancelled) return
      if (err || !data) {
        setError(err?.message || 'Staff advance not found')
      } else {
        const staffRaw = data.staff as { full_name?: string } | { full_name?: string }[] | null
        setDetail({
          staffName:
            (Array.isArray(staffRaw) ? staffRaw[0]?.full_name : staffRaw?.full_name) || 'Staff',
          amount: Number(data.amount) || 0,
          status: data.status,
          disbursedAt: data.disbursed_at,
          notes: data.notes,
        })
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [disbursementId])

  return (
    <Modal onClose={onClose} align="center" zIndex={70}>
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Staff advance</h2>
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
                <dt className="text-gray-500">Staff</dt>
                <dd className="font-medium">{detail.staffName}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Amount</dt>
                <dd className="font-medium tabular-nums">{formatGlPhp(detail.amount)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd className="font-medium capitalize">{detail.status}</dd>
              </div>
              {detail.disbursedAt && (
                <div className="col-span-2">
                  <dt className="text-gray-500">Disbursed</dt>
                  <dd className="font-medium">{new Date(detail.disbursedAt).toLocaleString()}</dd>
                </div>
              )}
              {detail.notes && (
                <div className="col-span-2">
                  <dt className="text-gray-500">Notes</dt>
                  <dd className="font-medium">{detail.notes}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>
    </Modal>
  )
}
