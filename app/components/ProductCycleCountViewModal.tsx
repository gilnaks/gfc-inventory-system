'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Modal } from './Modal'

type CycleCountLine = {
  id: string
  system_available: number
  counted_available: number | null
  product?: { name?: string } | null
}

type CycleCountDetail = {
  id: string
  count_date: string
  status: string
  lines: CycleCountLine[]
}

export function ProductCycleCountViewModal({
  cycleCountId,
  onClose,
}: {
  cycleCountId: string
  onClose: () => void
}) {
  const [detail, setDetail] = useState<CycleCountDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      const { data: header, error: hErr } = await supabase
        .from('product_cycle_counts')
        .select('id, count_date, status')
        .eq('id', cycleCountId)
        .maybeSingle()
      if (cancelled) return
      if (hErr || !header) {
        setError(hErr?.message || 'Cycle count not found')
        setLoading(false)
        return
      }
      const { data: lines } = await supabase
        .from('product_cycle_count_lines')
        .select('id, system_available, counted_available, product:products(name)')
        .eq('cycle_count_id', cycleCountId)
      if (cancelled) return
      setDetail({
        ...header,
        lines: (lines || []) as CycleCountLine[],
      })
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [cycleCountId])

  return (
    <Modal onClose={onClose} align="center" zIndex={70}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">Product cycle count</h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          {loading && <p className="text-gray-500">Loading…</p>}
          {error && <p className="text-red-600">{error}</p>}
          {detail && (
            <>
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-500">Count date</p>
                  <p className="font-medium">{detail.count_date}</p>
                </div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <p className="font-medium capitalize">{detail.status}</p>
                </div>
              </div>
              <table className="w-full text-xs border rounded">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-2 py-1.5">Product</th>
                    <th className="text-right px-2 py-1.5">System</th>
                    <th className="text-right px-2 py-1.5">Counted</th>
                    <th className="text-right px-2 py-1.5">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((l) => {
                    const variance =
                      l.counted_available != null
                        ? Number(l.counted_available) - Number(l.system_available)
                        : null
                    return (
                      <tr key={l.id} className="border-t">
                        <td className="px-2 py-1.5">{l.product?.name || '—'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{l.system_available}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {l.counted_available ?? '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {variance != null ? (variance > 0 ? `+${variance}` : variance) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
