'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase, type RawMaterial } from '../../lib/supabase'
import {
  formatCycleCountQty,
  formatPurchaseUnitQty,
  purchaseQtyVarianceFromStock,
} from '../../lib/material-cycle-count'
import { Modal } from './Modal'

type CycleCountLine = {
  id: string
  system_stock: number
  counted_stock: number | null
  material?: RawMaterial | null
}

type CycleCountDetail = {
  id: string
  count_date: string
  status: string
  notes?: string | null
  lines: CycleCountLine[]
}

export function MaterialCycleCountViewModal({
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
        .from('material_cycle_counts')
        .select('id, count_date, status, notes')
        .eq('id', cycleCountId)
        .maybeSingle()
      if (cancelled) return
      if (hErr || !header) {
        setError(hErr?.message || 'Cycle count not found')
        setLoading(false)
        return
      }
      const { data: lines } = await supabase
        .from('material_cycle_count_lines')
        .select(
          'id, system_stock, counted_stock, material:raw_materials(material_name, unit, uom_purchase_unit, uom_stock_per_purchase)'
        )
        .eq('cycle_count_id', cycleCountId)
      if (cancelled) return
      setDetail({
        ...header,
        lines: (lines || []).map((row) => {
          const materialRaw = row.material as
            | Partial<RawMaterial>
            | Partial<RawMaterial>[]
            | null
          const material = Array.isArray(materialRaw) ? materialRaw[0] : materialRaw
          return {
            id: row.id as string,
            system_stock: Number(row.system_stock) || 0,
            counted_stock: row.counted_stock == null ? null : Number(row.counted_stock),
            material: (material || null) as RawMaterial | null,
          }
        }),
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
          <h2 className="text-lg font-semibold">Material cycle count</h2>
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
                {detail.notes && (
                  <div className="sm:col-span-2">
                    <p className="text-gray-500">Notes</p>
                    <p className="font-medium">{detail.notes}</p>
                  </div>
                )}
              </div>
              <table className="w-full text-xs border rounded">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-2 py-1.5">Material</th>
                    <th className="text-right px-2 py-1.5">System</th>
                    <th className="text-right px-2 py-1.5">Counted</th>
                    <th className="text-right px-2 py-1.5">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((l) => {
                    const mat = l.material
                    const variancePurchase =
                      mat && l.counted_stock != null
                        ? purchaseQtyVarianceFromStock(
                            l.counted_stock,
                            Number(l.system_stock),
                            mat
                          )
                        : null
                    return (
                      <tr key={l.id} className="border-t">
                        <td className="px-2 py-1.5">{mat?.material_name || '—'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {mat ? formatCycleCountQty(Number(l.system_stock), mat).purchase : l.system_stock}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {l.counted_stock != null && mat
                            ? formatCycleCountQty(Number(l.counted_stock), mat).purchase
                            : l.counted_stock ?? '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {variancePurchase == null ? (
                            '—'
                          ) : variancePurchase === 0 ? (
                            '0'
                          ) : (
                            <span
                              className={
                                variancePurchase > 0 ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'
                              }
                            >
                              {variancePurchase > 0 ? '+' : '−'}
                              {mat
                                ? formatPurchaseUnitQty(Math.abs(variancePurchase), mat)
                                : Math.abs(variancePurchase)}
                            </span>
                          )}
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
