'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, type FactoryMaterialRequest, type RawMaterial } from '../../lib/supabase'
import {
  cancelPendingMaterialRequest,
  createManualFactoryMaterialRequest,
} from '../../lib/factory-schedule-material-requests'
import { parseWholeQuantity } from '../../lib/factory-bom-requirements'
import { isMaterialLinkedToFactoryFloor } from '../../lib/factory-inventory'
import { ClipboardList, Printer, Send, X } from 'lucide-react'
import { openFactoryMaterialRequestsPrintWindow } from '../../lib/print-factory-material-requests'
import {
  FACTORY_REQUEST_MATERIAL_SELECT,
  formatFactoryRequestQtyDisplay,
  getFactoryRequestUnitLabel,
} from '../../lib/raw-material-uom'
import {
  DestinationBrandSelect,
  type DestinationBrandOption,
} from './DestinationBrandSelect'

interface FactoryMaterialRequestsPanelProps {
  brandId: string
  brandName?: string
  destinationBrands?: DestinationBrandOption[]
  onForBrandChange?: (brandId: string) => void
  scheduleDate: string
  onScheduleDateChange?: (date: string) => void
  theme?: string
  currentUsername?: string
  readOnlyMode?: boolean
}

function formatQty(qty: number) {
  if (!Number.isFinite(qty)) return '0'
  return Number.isInteger(qty)
    ? String(qty)
    : qty.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function statusBadge(status: FactoryMaterialRequest['status']) {
  if (status === 'pending') {
    return 'bg-amber-100 text-amber-900'
  }
  if (status === 'released') {
    return 'bg-emerald-100 text-emerald-900'
  }
  return 'bg-gray-100 text-gray-600'
}

export function FactoryMaterialRequestsPanel({
  brandId,
  brandName,
  destinationBrands,
  onForBrandChange,
  scheduleDate,
  onScheduleDateChange,
  theme = 'blue',
  currentUsername = '',
  readOnlyMode = false,
}: FactoryMaterialRequestsPanelProps) {
  const canEdit = !readOnlyMode
  const [requests, setRequests] = useState<FactoryMaterialRequest[]>([])
  const [factoryMaterials, setFactoryMaterials] = useState<RawMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [showAllDates, setShowAllDates] = useState(false)
  const [manualMaterialId, setManualMaterialId] = useState('')
  const [manualQty, setManualQty] = useState('')
  const [submittingManual, setSubmittingManual] = useState(false)

  const themeBtn =
    theme === 'green'
      ? 'bg-green-600 hover:bg-green-700'
      : theme === 'red'
        ? 'bg-red-600 hover:bg-red-700'
        : theme === 'yellow'
          ? 'bg-yellow-600 hover:bg-yellow-700'
          : 'bg-blue-600 hover:bg-blue-700'

  const loadRequests = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('factory_material_requests')
        .select(
          `id, material_id, quantity, quantity_used, status, requested_by, released_by, request_date, schedule_date, brand_id, released_at, created_at, material:raw_materials(${FACTORY_REQUEST_MATERIAL_SELECT})`
        )
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(200)

      if (!showAllDates) {
        query = query.eq('schedule_date', scheduleDate)
      }

      let { data: queryData, error } = await query
      let data = queryData as unknown as FactoryMaterialRequest[] | null
      if (
        error &&
        (error.message.includes('brand_id') || error.message.includes('schedule_date'))
      ) {
        let fallback = supabase
          .from('factory_material_requests')
          .select(
            `id, material_id, quantity, quantity_used, status, requested_by, released_by, request_date, released_at, created_at, material:raw_materials(${FACTORY_REQUEST_MATERIAL_SELECT})`
          )
          .order('created_at', { ascending: false })
          .limit(200)
        if (!showAllDates) {
          fallback = fallback.eq('request_date', scheduleDate)
        }
        const res = await fallback
        data = res.data as unknown as FactoryMaterialRequest[] | null
        error = res.error
      }
      if (error) throw error
      const rows = ((data || []) as FactoryMaterialRequest[]).filter(
        (r) => r.material?.brand_id === brandId || r.brand_id === brandId
      )
      setRequests(rows)

      const { data: mats, error: matsErr } = await supabase
        .from('raw_materials')
        .select(FACTORY_REQUEST_MATERIAL_SELECT)
        .eq('brand_id', brandId)
        .eq('is_active', true)
        .order('material_name')

      if (matsErr) {
        console.warn('raw_materials:', matsErr.message)
        setFactoryMaterials([])
      } else {
        setFactoryMaterials(
          ((mats || []) as RawMaterial[]).filter((m) =>
            isMaterialLinkedToFactoryFloor(m)
          )
        )
      }
    } catch (err) {
      console.error(err)
      setRequests([])
      setFactoryMaterials([])
    } finally {
      setLoading(false)
    }
  }, [brandId, scheduleDate, showAllDates])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const pending = useMemo(
    () => requests.filter((r) => r.status === 'pending'),
    [requests]
  )

  const history = useMemo(
    () => requests.filter((r) => r.status !== 'pending'),
    [requests]
  )

  const scheduleDateLabel = showAllDates ? 'All dates' : scheduleDate

  const printRequests = (rows: FactoryMaterialRequest[], title: string) => {
    if (rows.length === 0) {
      alert('Nothing to print.')
      return
    }
    const ok = openFactoryMaterialRequestsPrintWindow({
      requests: rows,
      brandName,
      scheduleDateLabel,
      title,
    })
    if (!ok) {
      alert('Could not open print window. Allow pop-ups for this site.')
    }
  }

  const selectedManualMaterial = useMemo(
    () => factoryMaterials.find((m) => m.id === manualMaterialId),
    [factoryMaterials, manualMaterialId]
  )

  const handleManualRequest = async () => {
    const qty = parseWholeQuantity(manualQty)
    if (!manualMaterialId || !qty) {
      alert('Select a material and enter a whole number quantity.')
      return
    }
    setSubmittingManual(true)
    try {
      await createManualFactoryMaterialRequest({
        materialId: manualMaterialId,
        quantity: qty,
        scheduleDate,
        brandId,
        requestedBy: currentUsername?.trim() || 'Factory',
      })
      setManualMaterialId('')
      setManualQty('')
      await loadRequests()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not create request')
    } finally {
      setSubmittingManual(false)
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this material request?')) return
    setCancellingId(id)
    try {
      const ok = await cancelPendingMaterialRequest(id)
      if (!ok) {
        alert('This request is no longer pending.')
      }
      await loadRequests()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not cancel request')
    } finally {
      setCancellingId(null)
    }
  }

  const renderTableSkeleton = (showCancel: boolean, rows = 4) => (
    <div className="overflow-x-auto rounded-lg border border-gray-200 animate-pulse">
      <table className="min-w-full text-sm divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {['Material', 'Qty', 'Schedule', 'Status', 'Requested by', 'Released by'].map(
              (label) => (
                <th
                  key={label}
                  className={`px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase ${
                    label === 'Qty' ? 'text-right' : ''
                  }`}
                >
                  <div className="h-3 bg-gray-200 rounded w-14" />
                </th>
              )
            )}
            {showCancel ? (
              <th className="px-3 py-2 w-20">
                <div className="h-3 bg-gray-200 rounded w-10 ml-auto" />
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i}>
              <td className="px-3 py-3">
                <div className="h-3.5 bg-gray-200 rounded w-32 mb-1.5" />
                <div className="h-2.5 bg-gray-100 rounded w-20" />
              </td>
              <td className="px-3 py-3 text-right">
                <div className="h-3.5 bg-gray-200 rounded w-12 ml-auto mb-1" />
                <div className="h-2 bg-gray-100 rounded w-16 ml-auto" />
              </td>
              <td className="px-3 py-3">
                <div className="h-3 bg-gray-200 rounded w-20" />
              </td>
              <td className="px-3 py-3">
                <div className="h-5 bg-amber-100 rounded-full w-16" />
              </td>
              <td className="px-3 py-3">
                <div className="h-3 bg-gray-200 rounded w-16" />
              </td>
              <td className="px-3 py-3">
                <div className="h-3 bg-gray-100 rounded w-14" />
              </td>
              {showCancel ? (
                <td className="px-3 py-3 text-right">
                  <div className="h-7 bg-red-50 border border-red-100 rounded w-16 ml-auto" />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const renderTable = (rows: FactoryMaterialRequest[], showCancel: boolean) => {
    if (rows.length === 0) {
      return <p className="text-sm text-gray-500 py-4">None</p>
    }
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Material</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-left">Schedule</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Requested by</th>
              <th className="px-3 py-2 text-left">Released by</th>
              {showCancel ? <th className="px-3 py-2 w-20" /> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((row) => {
              const mat = row.material
              const qtyDisplay = mat
                ? formatFactoryRequestQtyDisplay(row.quantity, mat)
                : null
              return (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">
                      {mat?.material_name || 'Material'}
                    </div>
                    {mat?.sku ? (
                      <div className="text-xs text-gray-400 font-mono">{mat.sku}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {qtyDisplay ? (
                      <>
                        <div>{qtyDisplay.primary}</div>
                        {qtyDisplay.stockNote ? (
                          <div className="text-[10px] text-gray-500 font-normal">
                            {qtyDisplay.stockNote}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      formatQty(row.quantity)
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap text-xs">
                    {row.schedule_date || row.request_date || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                    {row.requested_by?.trim() || '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                    {row.released_by?.trim() || '—'}
                  </td>
                  {showCancel ? (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleCancel(row.id)}
                        disabled={cancellingId === row.id}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-700 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-slate-600" />
            Material requests
          </h2>
          <p className="text-sm text-gray-600 mt-0.5">
            Schedule shortages and manual requests for this date
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {destinationBrands && destinationBrands.length > 0 && onForBrandChange ? (
            <DestinationBrandSelect
              brands={destinationBrands}
              value={brandId}
              onChange={onForBrandChange}
            />
          ) : null}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showAllDates}
              onChange={(e) => setShowAllDates(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show all dates
          </label>
          {onScheduleDateChange ? (
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => onScheduleDateChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          ) : null}
          <button
            type="button"
            onClick={() =>
              printRequests(pending, 'Factory Material Request — Pending')
            }
            disabled={loading || pending.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="h-4 w-4" />
            Print pending
          </button>
          <button
            type="button"
            onClick={() =>
              printRequests(requests, 'Factory Material Request — All')
            }
            disabled={loading || requests.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="h-4 w-4" />
            Print all
          </button>
          <button
            type="button"
            onClick={loadRequests}
            className={`px-3 py-2 text-sm text-white rounded-lg ${themeBtn}`}
          >
            Refresh
          </button>
        </div>
      </div>

      {canEdit ? (
      <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Request material manually</h3>
        <p className="text-xs text-gray-500 mb-3">
          Add a request without going through the production schedule BOM.
        </p>
        {loading ? (
          <div className="flex flex-col sm:flex-row gap-2 animate-pulse">
            <div className="h-10 bg-gray-200 rounded-lg flex-1" />
            <div className="h-10 bg-gray-200 rounded-lg w-full sm:w-24" />
            <div className="h-10 bg-gray-200 rounded-lg w-full sm:w-32" />
          </div>
        ) : factoryMaterials.length === 0 ? (
          <p className="text-sm text-gray-500">
            No factory-linked materials for this brand. Link materials in Procurement first.
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-xs text-gray-600 mb-1">Material</label>
              <select
                value={manualMaterialId}
                onChange={(e) => setManualMaterialId(e.target.value)}
                disabled={submittingManual}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">Select material…</option>
                {factoryMaterials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.sku ? `${m.sku} · ` : ''}
                    {m.material_name} ({getFactoryRequestUnitLabel(m)})
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-28">
              <label className="block text-xs text-gray-600 mb-1">
                Qty
                {selectedManualMaterial ? (
                  <span className="text-gray-400 font-normal">
                    {' '}
                    ({getFactoryRequestUnitLabel(selectedManualMaterial)})
                  </span>
                ) : null}
              </label>
              <input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={manualQty}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || /^\d+$/.test(v)) setManualQty(v)
                }}
                placeholder="Qty"
                disabled={submittingManual}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleManualRequest()}
              disabled={submittingManual || !manualMaterialId || !manualQty}
              className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 shrink-0 ${themeBtn}`}
            >
              {submittingManual ? (
                'Sending…'
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit request
                </>
              )}
            </button>
          </div>
        )}
      </section>
      ) : null}

      {loading ? (
        <>
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="h-4 bg-gray-200 rounded w-28 animate-pulse" />
              <div className="h-3 bg-gray-100 rounded w-12 animate-pulse" />
            </div>
            {renderTableSkeleton(true, 4)}
          </section>
          <section>
            <div className="h-4 bg-gray-200 rounded w-24 mb-2 animate-pulse" />
            {renderTableSkeleton(false, 3)}
          </section>
        </>
      ) : (
        <>
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-800">
                Pending ({pending.length})
              </h3>
              {pending.length > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    printRequests(pending, 'Factory Material Request — Pending')
                  }
                  className="inline-flex items-center gap-1 text-xs text-indigo-700 hover:text-indigo-900"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </button>
              ) : null}
            </div>
            {renderTable(pending, canEdit)}
          </section>
          <section>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              History ({history.length})
            </h3>
            {renderTable(history, false)}
          </section>
        </>
      )}
    </div>
  )
}
