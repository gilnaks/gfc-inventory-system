'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase, type RawMaterial } from '../../lib/supabase'
import { formatCycleCountMovementNotes } from '../../lib/material-cycle-count'
import { getPurchaseUnitLabel, stockUnitsPerPurchase } from '../../lib/raw-material-uom'
import { Modal } from './Modal'
import { formatGlPhp } from './AccountingLedgerTable'

type MovementDetail = {
  movement_type: string
  movement_date?: string
  quantity: number
  quantityLabel?: string
  unit_cost?: number | null
  reference_number?: string | null
  reference_type?: string | null
  notes?: string | null
  created_by?: string | null
  itemName?: string
}

export function JournalMovementViewModal({
  movementId,
  kind,
  onClose,
}: {
  movementId: string
  kind: 'material_movement' | 'fixed_asset_movement'
  onClose: () => void
}) {
  const [detail, setDetail] = useState<MovementDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      if (kind === 'material_movement') {
        const { data, error: err } = await supabase
          .from('material_stock_movements')
          .select(
            `movement_type, movement_date, quantity, unit_cost, reference_number, reference_type, reference_id,
             material_id, notes, created_by,
             material:raw_materials(material_name, unit, uom_purchase_unit, uom_stock_per_purchase)`
          )
          .eq('id', movementId)
          .maybeSingle()
        if (cancelled) return
        if (err || !data) {
          setError(err?.message || 'Movement not found')
        } else {
          const matRaw = data.material as RawMaterial | RawMaterial[] | null
          const mat = (Array.isArray(matRaw) ? matRaw[0] : matRaw) as RawMaterial | null
          const name = mat?.material_name || undefined
          const stockQty = Number(data.quantity) || 0
          const perPurchase = mat ? stockUnitsPerPurchase(mat) : 1

          let notes = data.notes as string | null
          if (data.reference_type === 'cycle_count' && data.reference_id && data.material_id && mat) {
            const [{ data: ccLine }, { data: ccHeader }] = await Promise.all([
              supabase
                .from('material_cycle_count_lines')
                .select('system_stock, counted_stock')
                .eq('cycle_count_id', data.reference_id)
                .eq('material_id', data.material_id)
                .maybeSingle(),
              supabase
                .from('material_cycle_counts')
                .select('count_date')
                .eq('id', data.reference_id)
                .maybeSingle(),
            ])
            if (ccLine && ccHeader?.count_date) {
              notes = formatCycleCountMovementNotes({
                countDate: ccHeader.count_date,
                materialName: name || 'Material',
                systemStock: Number(ccLine.system_stock),
                countedStock: Number(ccLine.counted_stock),
                material: mat,
              })
            }
          }

          setDetail({
            movement_type: data.movement_type,
            movement_date: data.movement_date,
            quantity: stockQty / perPurchase,
            quantityLabel: mat ? getPurchaseUnitLabel(mat) : undefined,
            unit_cost: data.unit_cost,
            reference_number: data.reference_number,
            reference_type: data.reference_type,
            notes,
            created_by: data.created_by,
            itemName: name,
          })
        }
      } else {
        const { data, error: err } = await supabase
          .from('fixed_asset_movements')
          .select(
            'movement_type, movement_date, quantity, unit_cost, reference_number, notes, created_by, asset:fixed_assets(asset_name)'
          )
          .eq('id', movementId)
          .maybeSingle()
        if (cancelled) return
        if (err || !data) {
          setError(err?.message || 'Movement not found')
        } else {
          const asset = data.asset as { asset_name?: string } | { asset_name?: string }[] | null
          const name = Array.isArray(asset) ? asset[0]?.asset_name : asset?.asset_name
          setDetail({ ...data, itemName: name || undefined })
        }
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [movementId, kind])

  const title = kind === 'material_movement' ? 'Material movement' : 'Fixed asset movement'

  return (
    <Modal onClose={onClose} align="center" zIndex={70}>
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          {loading && <p className="text-gray-500">Loading…</p>}
          {error && <p className="text-red-600">{error}</p>}
          {detail && (
            <dl className="grid grid-cols-2 gap-3 text-xs">
              {detail.itemName && (
                <div className="col-span-2">
                  <dt className="text-gray-500">Item</dt>
                  <dd className="font-medium">{detail.itemName}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Type</dt>
                <dd className="font-medium capitalize">{detail.movement_type}</dd>
              </div>
              {detail.movement_date && (
                <div>
                  <dt className="text-gray-500">Date</dt>
                  <dd className="font-medium">{detail.movement_date}</dd>
                </div>
              )}
              {detail.created_by && (
                <div>
                  <dt className="text-gray-500">By</dt>
                  <dd className="font-medium">{detail.created_by}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Quantity</dt>
                <dd className="font-medium tabular-nums">
                  {detail.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  {detail.quantityLabel ? ` ${detail.quantityLabel}` : ''}
                </dd>
              </div>
              {detail.unit_cost != null && Number(detail.unit_cost) > 0 && (
                <div>
                  <dt className="text-gray-500">Unit cost</dt>
                  <dd className="font-medium tabular-nums">{formatGlPhp(Number(detail.unit_cost))}</dd>
                </div>
              )}
              {detail.reference_number && (
                <div className="col-span-2">
                  <dt className="text-gray-500">Reference</dt>
                  <dd className="font-medium">{detail.reference_number}</dd>
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
