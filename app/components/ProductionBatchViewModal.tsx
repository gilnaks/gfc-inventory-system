'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Modal } from './Modal'

type BatchDetail = {
  batch_number?: string | null
  work_date?: string
  units?: number
  status?: string
  productName?: string
}

export function ProductionBatchViewModal({
  batchId,
  onClose,
}: {
  batchId: string
  onClose: () => void
}) {
  const [detail, setDetail] = useState<BatchDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      const { data, error: err } = await supabase
        .from('factory_production_batches')
        .select('batch_number, work_date, units, status, product:products(name)')
        .eq('id', batchId)
        .maybeSingle()
      if (cancelled) return
      if (err || !data) {
        setError(err?.message || 'Production batch not found')
      } else {
        const prod = data.product as { name?: string } | { name?: string }[] | null
        setDetail({
          batch_number: data.batch_number,
          work_date: data.work_date,
          units: data.units,
          status: data.status,
          productName: (Array.isArray(prod) ? prod[0]?.name : prod?.name) || undefined,
        })
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [batchId])

  return (
    <Modal onClose={onClose} align="center" zIndex={70}>
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            {detail?.batch_number ? `Batch ${detail.batch_number}` : 'Production batch'}
          </h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          {loading && <p className="text-gray-500">Loading…</p>}
          {error && <p className="text-red-600">{error}</p>}
          {detail && (
            <dl className="grid grid-cols-2 gap-3 text-xs">
              {detail.productName && (
                <div className="col-span-2">
                  <dt className="text-gray-500">Product</dt>
                  <dd className="font-medium">{detail.productName}</dd>
                </div>
              )}
              {detail.work_date && (
                <div>
                  <dt className="text-gray-500">Work date</dt>
                  <dd className="font-medium">{detail.work_date}</dd>
                </div>
              )}
              {detail.units != null && (
                <div>
                  <dt className="text-gray-500">Units</dt>
                  <dd className="font-medium tabular-nums">{detail.units}</dd>
                </div>
              )}
              {detail.status && (
                <div>
                  <dt className="text-gray-500">Status</dt>
                  <dd className="font-medium capitalize">{detail.status}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>
    </Modal>
  )
}
