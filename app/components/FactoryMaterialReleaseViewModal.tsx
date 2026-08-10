'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase, type RawMaterial } from '../../lib/supabase'
import { materialStockUnitCost } from '../../lib/accounting-procurement-posting'
import {
  formatStockUnitTotal,
  getPurchaseUnitLabel,
} from '../../lib/raw-material-uom'
import { Modal } from './Modal'
import { formatGlPhp } from './AccountingLedgerTable'

type ReleaseDetail = {
  materialName: string
  brandName?: string
  status: string
  requestDate: string
  scheduleDate?: string | null
  releasedAt?: string | null
  requestedBy?: string | null
  releasedBy?: string | null
  requestQty: number
  quantityUsed?: number
  requestQtyLabel: string
  stockReleased?: number
  stockReleasedLabel?: string
  movementDate?: string | null
  movementRef?: string | null
  movementNotes?: string | null
  unitCost?: number
  amount?: number
}

export function FactoryMaterialReleaseViewModal({
  requestId,
  onClose,
}: {
  requestId: string
  onClose: () => void
}) {
  const [detail, setDetail] = useState<ReleaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      const { data: request, error: reqErr } = await supabase
        .from('factory_material_requests')
        .select(
          `id, quantity, quantity_used, status, request_date, schedule_date, released_at,
           requested_by, released_by,
           material:raw_materials(material_name, unit_cost, uom_stock_per_purchase, uom_purchase_unit, unit),
           brand:brands(name)`
        )
        .eq('id', requestId)
        .maybeSingle()

      if (cancelled) return
      if (reqErr || !request) {
        setError(reqErr?.message || 'Factory material request not found')
        setLoading(false)
        return
      }

      const matRaw = request.material as RawMaterial | RawMaterial[] | null
      const mat = (Array.isArray(matRaw) ? matRaw[0] : matRaw) as RawMaterial | null
      const brandRaw = request.brand as { name?: string } | { name?: string }[] | null
      const brandName = Array.isArray(brandRaw) ? brandRaw[0]?.name : brandRaw?.name

      const { data: movement } = await supabase
        .from('material_stock_movements')
        .select('quantity, unit_cost, movement_date, reference_number, notes')
        .eq('reference_type', 'factory_request')
        .eq('reference_id', requestId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cancelled) return

      const requestQty = Number(request.quantity) || 0
      const stockReleased = movement ? Math.abs(Number(movement.quantity) || 0) : undefined
      const unitCost = mat
        ? materialStockUnitCost(mat, movement?.unit_cost)
        : undefined
      const amount =
        stockReleased != null && unitCost != null
          ? Math.round(stockReleased * unitCost * 100) / 100
          : undefined

      setDetail({
        materialName: mat?.material_name || 'Material',
        brandName: brandName || undefined,
        status: request.status,
        requestDate: request.request_date,
        scheduleDate: request.schedule_date,
        releasedAt: request.released_at,
        requestedBy: request.requested_by,
        releasedBy: request.released_by,
        requestQty,
        quantityUsed: request.quantity_used != null ? Number(request.quantity_used) : undefined,
        requestQtyLabel: mat ? getPurchaseUnitLabel(mat) : 'units',
        stockReleased,
        stockReleasedLabel: mat ? formatStockUnitTotal(stockReleased ?? 0, mat) : undefined,
        movementDate: movement?.movement_date,
        movementRef: movement?.reference_number,
        movementNotes: movement?.notes,
        unitCost,
        amount,
      })
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [requestId])

  return (
    <Modal onClose={onClose} align="center" zIndex={70}>
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Factory material release</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          {loading && <p className="text-gray-500">Loading…</p>}
          {error && <p className="text-red-600">{error}</p>}
          {detail && (
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <dt className="text-gray-500">Material</dt>
                <dd className="font-medium">{detail.materialName}</dd>
              </div>
              {detail.brandName && (
                <div className="col-span-2">
                  <dt className="text-gray-500">Factory brand</dt>
                  <dd className="font-medium">{detail.brandName}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd className="font-medium capitalize">{detail.status}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Request date</dt>
                <dd className="font-medium">{detail.requestDate}</dd>
              </div>
              {detail.scheduleDate && (
                <div>
                  <dt className="text-gray-500">Schedule date</dt>
                  <dd className="font-medium">{detail.scheduleDate}</dd>
                </div>
              )}
              {detail.releasedAt && (
                <div>
                  <dt className="text-gray-500">Released</dt>
                  <dd className="font-medium">{new Date(detail.releasedAt).toLocaleString()}</dd>
                </div>
              )}
              {detail.requestedBy && (
                <div>
                  <dt className="text-gray-500">Requested by</dt>
                  <dd className="font-medium">{detail.requestedBy}</dd>
                </div>
              )}
              {detail.releasedBy && (
                <div>
                  <dt className="text-gray-500">Released by</dt>
                  <dd className="font-medium">{detail.releasedBy}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Request qty</dt>
                <dd className="font-medium tabular-nums">
                  {detail.requestQty.toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                  {detail.requestQtyLabel}
                </dd>
              </div>
              {detail.quantityUsed != null && (
                <div>
                  <dt className="text-gray-500">Qty used</dt>
                  <dd className="font-medium tabular-nums">
                    {detail.quantityUsed.toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                    {detail.requestQtyLabel}
                  </dd>
                </div>
              )}
              {detail.stockReleased != null && detail.stockReleased > 0 && (
                <div className="col-span-2">
                  <dt className="text-gray-500">Warehouse stock released</dt>
                  <dd className="font-medium tabular-nums">{detail.stockReleasedLabel}</dd>
                </div>
              )}
              {detail.movementRef && (
                <div className="col-span-2">
                  <dt className="text-gray-500">Movement reference</dt>
                  <dd className="font-medium font-mono">{detail.movementRef}</dd>
                </div>
              )}
              {detail.movementDate && (
                <div>
                  <dt className="text-gray-500">Movement date</dt>
                  <dd className="font-medium">{detail.movementDate}</dd>
                </div>
              )}
              {detail.unitCost != null && detail.unitCost > 0 && (
                <div>
                  <dt className="text-gray-500">Stock unit cost</dt>
                  <dd className="font-medium tabular-nums">{formatGlPhp(detail.unitCost)}</dd>
                </div>
              )}
              {detail.amount != null && detail.amount > 0 && (
                <div>
                  <dt className="text-gray-500">JE amount</dt>
                  <dd className="font-medium tabular-nums">{formatGlPhp(detail.amount)}</dd>
                </div>
              )}
              {detail.movementNotes && (
                <div className="col-span-2">
                  <dt className="text-gray-500">Notes</dt>
                  <dd className="font-medium">{detail.movementNotes}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>
    </Modal>
  )
}
