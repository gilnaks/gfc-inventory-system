'use client'
import { Fragment, useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import {
  groupScheduleByBrand,
  loadTodayFactorySchedule,
  type FactoryScheduleItem,
} from '../../lib/factory-schedule'
import { ProgressFractionCircle } from '../components/ProgressFractionCircle'
import { ScheduleNotesBlock } from './ScheduleNotesBlock'
import { getBrandTagClasses } from '../../lib/brand-colors'
import {
  fetchAggregatedBomRequirements,
  formatBomQuantity,
  parseWholeQuantity,
  type BomRequirementLine,
} from '../../lib/factory-bom-requirements'
import { getPhilippinesDate } from '../../lib/timezone'
import { stockQtyToFactoryRequestQty } from '../../lib/raw-material-uom'
import {
  Factory,
  ClipboardList,
  FlaskConical,
  Send,
  Users,
  UserPlus,
  X,
  Trash2,
  Barcode,
  Plus,
  Package,
  Box,
  Wrench,
} from 'lucide-react'
import { FactoryMaterialInventory } from '../components/FactoryMaterialInventory'
import { FactoryScheduleBatchActions } from './FactoryScheduleBatchActions'
import type { FactoryInventoryKind } from '../../lib/factory-inventory'
import {
  fetchActiveBatchesForDate,
  fetchCompletedBatchesForDate,
  type FactoryBatchListItem,
} from '../../lib/factory-batch-production'


type RawMat = {
  id: string
  brand_id?: string
  material_name: string
  sku?: string
  unit: string
  current_stock: number
  brands?: { name: string }
}

type FactoryStaffOption = { id: string; full_name: string }

type FloorStaffRow = {
  id: string
  staff_registration_id: string
  full_name: string
}

function getFactoryRequestedBy(): string {
  if (typeof window === 'undefined') return 'Factory'
  return (localStorage.getItem('dashboard_username') || '').trim() || 'Factory'
}

export default function FactoryPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlId = searchParams.get('id')
  const today = getPhilippinesDate()

  const [schedule, setSchedule] = useState<FactoryScheduleItem[]>([])
  const [materials, setMaterials] = useState<RawMat[]>([])
  const [bomNeeds, setBomNeeds] = useState<BomRequirementLine[]>([])
  const [requests, setRequests] = useState<
    {
      id: string
      material_id: string
      quantity: number
      status: string
      request_date: string
      requested_by?: string
      released_by?: string
      material?: RawMat
    }[]
  >([])
  const [loadingMain, setLoadingMain] = useState(true)

  const [reqMaterialId, setReqMaterialId] = useState('')
  const [reqQty, setReqQty] = useState('')
  const [additionalLines, setAdditionalLines] = useState<
    { id: string; material_id: string; material_name: string; unit: string; quantity: number }[]
  >([])
  const [submittingAll, setSubmittingAll] = useState(false)

  const [factoryLocationNames, setFactoryLocationNames] = useState<string[]>([])
  const [eligibleFactoryStaff, setEligibleFactoryStaff] = useState<FactoryStaffOption[]>([])
  const [floorStaffToday, setFloorStaffToday] = useState<FloorStaffRow[]>([])
  const [staffToAdd, setStaffToAdd] = useState('')
  const [addingStaff, setAddingStaff] = useState(false)
  const [cancellingReqId, setCancellingReqId] = useState<string | null>(null)
  const [floorInventoryKind, setFloorInventoryKind] = useState<FactoryInventoryKind | null>(
    null
  )
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0)
  const [activeBatches, setActiveBatches] = useState<FactoryBatchListItem[]>([])
  const [completedBatches, setCompletedBatches] = useState<FactoryBatchListItem[]>([])

  const bumpInventoryRefresh = () => setInventoryRefreshKey((k) => k + 1)

  const loadDashboard = useCallback(async () => {
    setLoadingMain(true)
    try {
      const rows = await loadTodayFactorySchedule(today)
      setSchedule(rows)
      const needs = await fetchAggregatedBomRequirements(rows)
      setBomNeeds(needs)

      const { data: mats } = await supabase
        .from('raw_materials')
        .select(
          'id, material_name, sku, unit, uom_purchase_unit, uom_stock_per_purchase, factory_request_uom, factory_inventory_kind, current_stock, is_active, brand_id'
        )
        .eq('is_active', true)
        .order('material_name')

      const { data: brandRows } = await supabase.from('brands').select('id, name')
      const brandMap = new Map((brandRows || []).map((b: any) => [b.id, b.name]))
      const withBrands: RawMat[] = (mats || []).map((m: any) => ({
        ...m,
        brands: { name: brandMap.get(m.brand_id) || '—' },
      }))
      setMaterials(withBrands)

      const { data: reqs } = await supabase
        .from('factory_material_requests')
        .select(
          'id, material_id, quantity, status, request_date, requested_by, released_by, material:raw_materials(id, material_name, sku, unit)'
        )
        .in('status', ['pending', 'released'])
        .order('created_at', { ascending: false })
        .limit(50)

      setRequests((reqs || []) as any[])

      try {
        const [inProgress, completed] = await Promise.all([
          fetchActiveBatchesForDate(today),
          fetchCompletedBatchesForDate(today),
        ])
        setActiveBatches(inProgress)
        setCompletedBatches(completed)
      } catch {
        setActiveBatches([])
        setCompletedBatches([])
      }

      const { data: factoryLocs } = await supabase
        .from('locations')
        .select('id, name')
        .ilike('name', '%factory%')

      const locIds = (factoryLocs || []).map((l: { id: string }) => l.id)
      setFactoryLocationNames((factoryLocs || []).map((l: { name: string }) => l.name))

      if (locIds.length === 0) {
        setEligibleFactoryStaff([])
      } else {
        const { data: assigns } = await supabase
          .from('staff_assignments')
          .select('staff_registration_id')
          .in('location_id', locIds)

        const regIds = Array.from(
          new Set(
            (assigns || []).map((a: { staff_registration_id: string }) => a.staff_registration_id)
          )
        )
        if (regIds.length === 0) {
          setEligibleFactoryStaff([])
        } else {
          const { data: regs } = await supabase
            .from('staff_registrations')
            .select('id, full_name')
            .in('id', regIds)
            .eq('is_active', true)
            .order('full_name')
          setEligibleFactoryStaff((regs || []) as FactoryStaffOption[])
        }
      }

      const floorRes = await supabase
        .from('factory_daily_staff')
        .select('id, staff_registration_id, created_at, staff_registrations(full_name)')
        .eq('work_date', today)
        .order('created_at', { ascending: true })

      if (floorRes.error) {
        console.warn('factory_daily_staff:', floorRes.error.message)
        setFloorStaffToday([])
      } else {
        setFloorStaffToday(
          (floorRes.data || []).map((r: any) => ({
            id: r.id,
            staff_registration_id: r.staff_registration_id,
            full_name: r.staff_registrations?.full_name || 'Staff',
          }))
        )
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingMain(false)
    }
  }, [today])

  useEffect(() => {
    if (urlId) {
      router.replace(`/factory/scan?code=${encodeURIComponent(urlId)}`)
      return
    }
    loadDashboard()
  }, [urlId, loadDashboard, router])

  const todayRequestsByMaterial = useMemo(() => {
    const map = new Map<string, { status: 'pending' | 'released'; quantity: number }>()
    for (const r of requests) {
      const reqDate = String(r.request_date ?? '').slice(0, 10)
      if (reqDate !== today) continue
      if (r.status !== 'pending' && r.status !== 'released') continue
      const existing = map.get(r.material_id)
      if (!existing || r.status === 'pending') {
        map.set(r.material_id, { status: r.status as 'pending' | 'released', quantity: r.quantity })
      }
    }
    return map
  }, [requests, today])

  const alreadyRequestedMaterialIdsToday = useMemo(
    () => new Set(todayRequestsByMaterial.keys()),
    [todayRequestsByMaterial]
  )

  const actionableBomNeeds = useMemo(
    () => bomNeeds.filter((line) => !alreadyRequestedMaterialIdsToday.has(line.material_id)),
    [bomNeeds, alreadyRequestedMaterialIdsToday]
  )

  const requestsToday = useMemo(
    () =>
      requests.filter((r) => String(r.request_date ?? '').slice(0, 10) === today),
    [requests, today]
  )

  const scheduleByBrand = useMemo(() => groupScheduleByBrand(schedule), [schedule])

  const bomLinesToSend = useMemo(() => {
    return actionableBomNeeds
      .map((line) => {
        const stockQty = parseWholeQuantity(formatBomQuantity(line.quantity))
        if (!stockQty) return null
        const mat = materials.find((m) => m.id === line.material_id)
        const quantity = mat ? stockQtyToFactoryRequestQty(stockQty, mat) : stockQty
        return quantity ? { line, quantity, stockQty } : null
      })
      .filter(
        (x): x is { line: BomRequirementLine; quantity: number; stockQty: number } => x !== null
      )
  }, [actionableBomNeeds, materials])

  const totalToSend = bomLinesToSend.length + additionalLines.length

  const getMaterialStock = useCallback(
    (materialId: string, bomLine?: BomRequirementLine) => {
      if (bomLine) return bomLine.current_stock
      return materials.find((m) => m.id === materialId)?.current_stock ?? 0
    },
    [materials]
  )

  const stockBlocksRequest = useMemo(() => {
    for (const { line, stockQty } of bomLinesToSend) {
      const stock = getMaterialStock(line.material_id, line)
      if (stock <= 0 || stock < stockQty) return true
    }
    for (const line of additionalLines) {
      const stock = getMaterialStock(line.material_id)
      if (stock <= 0 || stock < line.quantity) return true
    }
    return false
  }, [bomLinesToSend, additionalLines, getMaterialStock])

  const canRequestMaterials = totalToSend > 0 && !stockBlocksRequest

  const addAdditionalLine = () => {
    const q = parseWholeQuantity(reqQty)
    if (!reqMaterialId || !q) {
      alert('Select a material and enter a whole number quantity.')
      return
    }
    const mat = materials.find((m) => m.id === reqMaterialId)
    if (!mat) return
    setAdditionalLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        material_id: mat.id,
        material_name: mat.material_name,
        unit: mat.unit,
        quantity: q,
      },
    ])
    setReqMaterialId('')
    setReqQty('')
  }

  const removeAdditionalLine = (id: string) => {
    setAdditionalLines((prev) => prev.filter((l) => l.id !== id))
  }

  const submitAllMaterialRequests = async () => {
    if (!canRequestMaterials) {
      if (totalToSend === 0) {
        alert('Nothing to request. Add additional materials if needed.')
      } else {
        alert('Cannot request: one or more materials are out of stock or quantity exceeds available stock.')
      }
      return
    }
    setSubmittingAll(true)
    try {
      const requestedBy = getFactoryRequestedBy()
      const rows = [
        ...bomLinesToSend.map(({ line, quantity }) => {
          const mat = materials.find((m) => m.id === line.material_id)
          return {
            material_id: line.material_id,
            quantity,
            request_date: today,
            schedule_date: today,
            brand_id: mat?.brand_id ?? null,
            requested_by: requestedBy,
            status: 'pending' as const,
          }
        }),
        ...additionalLines.map((line) => {
          const mat = materials.find((m) => m.id === line.material_id)
          return {
            material_id: line.material_id,
            quantity: line.quantity,
            request_date: today,
            schedule_date: today,
            brand_id: mat?.brand_id ?? null,
            requested_by: requestedBy,
            status: 'pending' as const,
          }
        }),
      ]
      const { error } = await supabase.from('factory_material_requests').insert(rows)
      if (error) throw error
      setAdditionalLines([])
      await loadDashboard()
    } catch (e: any) {
      alert(e?.message || 'Could not send requests')
    } finally {
      setSubmittingAll(false)
    }
  }

  const cancelMaterialRequest = async (id: string) => {
    if (!confirm('Cancel this material request? It will be removed from the pending queue.')) return
    setCancellingReqId(id)
    try {
      const { data, error } = await supabase
        .from('factory_material_requests')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id')
      if (error) throw error
      if (!data?.length) {
        alert('This request is no longer pending (it may have been released or cancelled already).')
      }
      await loadDashboard()
    } catch (e: any) {
      alert(e?.message || 'Could not cancel request')
    } finally {
      setCancellingReqId(null)
    }
  }

  const addStaffToFloor = async () => {
    if (!staffToAdd) return
    setAddingStaff(true)
    try {
      const { error } = await supabase.from('factory_daily_staff').insert({
        work_date: today,
        staff_registration_id: staffToAdd,
      })
      if (error) {
        if (error.code === '23505') {
          alert('That person is already on the list for today.')
        } else {
          throw error
        }
        return
      }
      setStaffToAdd('')
      await loadDashboard()
    } catch (e: any) {
      alert(e?.message || 'Could not add staff')
    } finally {
      setAddingStaff(false)
    }
  }

  const removeStaffFromFloor = async (rowId: string) => {
    try {
      const { error } = await supabase.from('factory_daily_staff').delete().eq('id', rowId)
      if (error) throw error
      await loadDashboard()
    } catch (e: any) {
      alert(e?.message || 'Could not remove')
    }
  }

  if (urlId) {
    return (
      <div className="min-h-[100dvh] min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <p className="text-gray-500 text-sm">Opening scanner…</p>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] min-h-screen bg-slate-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="bg-slate-800 text-white">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-start sm:items-center gap-3">
            <Factory className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 mt-0.5 sm:mt-0" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold leading-tight">Factory</h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-0.5 tabular-nums">{today}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <Link
          href="/factory/scan"
          className="block bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white rounded-xl shadow-sm p-5 sm:p-6 touch-manipulation transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="shrink-0 rounded-lg bg-slate-700 p-3">
              <Barcode className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Record production</h2>
              <p className="text-slate-300 text-sm mt-0.5">
                Pick today&apos;s item, then scan — stays ready for your barcode gun
              </p>
            </div>
          </div>
        </Link>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-slate-600" />
            Staff on floor today
          </h2>

          {factoryLocationNames.length === 0 ? (
            <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
              No matching location yet. Create or rename a location (for example &quot;Factory&quot;) under brands/locations, then assign staff to it in Staff Manager.
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-end mb-4">
                <div className="flex-1 min-w-0 w-full">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Add staff</label>
                  <select
                    value={staffToAdd}
                    onChange={(e) => setStaffToAdd(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 border rounded-lg text-base text-gray-900 bg-white"
                  >
                    <option value="">Choose name…</option>
                    {eligibleFactoryStaff
                      .filter((s) => !floorStaffToday.some((f) => f.staff_registration_id === s.id))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name}
                        </option>
                      ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={addStaffToFloor}
                  disabled={!staffToAdd || addingStaff}
                  className="flex items-center justify-center gap-2 min-h-[44px] w-full sm:w-auto px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 text-sm font-medium disabled:opacity-50 active:bg-slate-900 touch-manipulation"
                >
                  <UserPlus className="h-4 w-4" />
                  {addingStaff ? 'Adding…' : 'Add to list'}
                </button>
              </div>

              {eligibleFactoryStaff.length === 0 ? (
                <p className="text-sm text-gray-500 mb-3">
                  No active staff assigned to these factory locations. Assign them in Dashboard → Staff → location assignments.
                </p>
              ) : null}

              {floorStaffToday.length === 0 ? (
                <p className="text-sm text-gray-400">Nobody has been added for today yet.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {floorStaffToday.map((row) => (
                    <li
                      key={row.id}
                      className="inline-flex items-center gap-0.5 pl-3 pr-1 py-1.5 bg-slate-100 rounded-full text-sm text-gray-900"
                    >
                      <span>{row.full_name}</span>
                      <button
                        type="button"
                        title={`Remove ${row.full_name}`}
                        onClick={() => removeStaffFromFloor(row.id)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-gray-500 hover:bg-slate-200 hover:text-gray-900 active:bg-slate-300 touch-manipulation"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {activeBatches.length > 0 || completedBatches.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeBatches.length > 0 ? (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-4">
                <h2 className="text-sm font-semibold text-indigo-950 mb-2">Batches in progress</h2>
                <ul className="space-y-1.5 text-sm text-indigo-900">
                  {activeBatches.map((b) => (
                    <li key={b.id}>
                      <span className="font-medium">{b.product_name}</span>
                      {b.brand_name ? (
                        <span className="text-indigo-700"> · {b.brand_name}</span>
                      ) : null}
                      <span className="text-indigo-700">
                        {' '}
                        · {b.units} unit{b.units === 1 ? '' : 's'} · started{' '}
                        {new Date(b.started_at).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {completedBatches.length > 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
                <h2 className="text-sm font-semibold text-emerald-950 mb-2">Completed batches</h2>
                <ul className="space-y-1.5 text-sm text-emerald-900">
                  {completedBatches.map((b) => (
                    <li key={b.id}>
                      <span className="font-medium">{b.product_name}</span>
                      {b.brand_name ? (
                        <span className="text-emerald-700"> · {b.brand_name}</span>
                      ) : null}
                      <span className="text-emerald-700">
                        {' '}
                        · {b.units} unit{b.units === 1 ? '' : 's'}
                        {b.completed_at
                          ? ` · completed ${new Date(b.completed_at).toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}`
                          : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <ClipboardList className="h-5 w-5 text-slate-600 shrink-0" />
            Today&apos;s production schedule
          </h2>
          <p className="text-xs text-gray-500 -mt-2 mb-4">
            Start a batch to deduct factory-floor materials (opened packages) per BOM. Complete when
            finished.
          </p>

          {loadingMain ? (
            <p className="text-gray-500 py-8 text-center">Loading…</p>
          ) : schedule.length === 0 ? (
            <p className="text-gray-500 py-6 text-center text-sm">No schedule for today. Admin can set it in Dashboard → Inventory → Production Schedule.</p>
          ) : (
            <div className="mt-4 space-y-6">
              {scheduleByBrand.map(({ brandName, items: groupItems }) => (
                <section key={brandName} className="space-y-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getBrandTagClasses(brandName)}`}
                  >
                    {brandName}
                  </span>
                  <div className="hidden md:block overflow-x-auto -mx-1 px-1">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500 text-xs uppercase">
                          <th className="py-2.5 pr-3">Product</th>
                          <th className="py-2.5 pr-3">SKU</th>
                          <th className="py-2.5 pr-3">Batch #</th>
                          <th className="py-2.5 pr-2 text-right">Req</th>
                          <th className="py-2.5 pr-2 text-right">Printed</th>
                          <th className="py-2.5 text-center">Progress</th>
                          <th className="py-2.5 text-right">Run</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupItems.map((r) => (
                          <Fragment key={r.schedule_id}>
                            <tr className="border-b border-slate-100">
                              <td className="py-2.5 pr-3 font-medium text-gray-900">{r.product_name}</td>
                              <td className="py-2.5 pr-3 text-gray-600">{r.sku || '—'}</td>
                              <td className="py-2.5 pr-3 text-gray-600 font-mono text-xs max-w-[10rem] truncate" title={r.batch_number}>
                                {r.batch_number}
                              </td>
                              <td className="py-2.5 pr-2 text-right tabular-nums">{r.quantity_required}</td>
                              <td className="py-2.5 pr-2 text-right tabular-nums">{r.printed}</td>
                              <td className="py-2.5">
                                <div className="flex justify-center">
                                  <ProgressFractionCircle
                                    current={r.produced}
                                    total={r.quantity_required}
                                    size="sm"
                                  />
                                </div>
                              </td>
                              <td className="py-2.5 align-bottom text-right min-w-[9rem]">
                                <FactoryScheduleBatchActions
                                  item={r}
                                  workDate={today}
                                  onChanged={() => {
                                    loadDashboard()
                                    bumpInventoryRefresh()
                                  }}
                                  compact
                                />
                              </td>
                            </tr>
                            {r.notes ? (
                              <tr className="border-b border-slate-100">
                                <td colSpan={7} className="pb-2.5 pt-0">
                                  <ScheduleNotesBlock notes={r.notes} />
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="md:hidden space-y-2">
                    {groupItems.map((r) => (
                      <div
                        key={r.schedule_id}
                        className="rounded-lg border border-slate-200 bg-slate-50/80 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900 leading-snug">{r.product_name}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {r.sku ? <span className="font-mono">{r.sku}</span> : null}
                              {r.sku ? ' · ' : null}
                              <span className="font-mono">{r.batch_number}</span>
                            </p>
                            <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
                              <div className="rounded-md bg-white/80 border border-slate-100 py-2 px-1">
                                <dt className="text-[10px] uppercase tracking-wide text-gray-500">Req</dt>
                                <dd className="text-base font-semibold text-gray-900 tabular-nums">
                                  {r.quantity_required}
                                </dd>
                              </div>
                              <div className="rounded-md bg-white/80 border border-slate-100 py-2 px-1">
                                <dt className="text-[10px] uppercase tracking-wide text-gray-500">Printed</dt>
                                <dd className="text-base font-semibold text-gray-900 tabular-nums">
                                  {r.printed}
                                </dd>
                              </div>
                            </dl>
                          </div>
                          <ProgressFractionCircle
                            current={r.produced}
                            total={r.quantity_required}
                            size="sm"
                          />
                        </div>
                        <ScheduleNotesBlock notes={r.notes} />
                        <div className="mt-3 pt-3 border-t border-slate-200 w-full">
                          <FactoryScheduleBatchActions
                            item={r}
                            workDate={today}
                            onChanged={() => {
                              loadDashboard()
                              bumpInventoryRefresh()
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <FlaskConical className="h-5 w-5 text-slate-600" />
            Raw materials
          </h2>

          <p className="text-xs text-gray-500 mb-3">
            BOM quantities are set from today&apos;s schedule. Add additional materials if needed, then request.
          </p>

          {loadingMain ? (
            <p className="text-sm text-gray-400 py-4">Loading…</p>
          ) : schedule.length === 0 && additionalLines.length === 0 ? (
            <p className="text-sm text-gray-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-3">
              No production scheduled for today.
            </p>
          ) : (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              {(bomNeeds.length > 0 || additionalLines.length > 0) && (
                <ul className="divide-y divide-slate-100">
                  {bomNeeds.map((line) => {
                    const todayReq = todayRequestsByMaterial.get(line.material_id)
                    const outOfStock = line.current_stock <= 0
                    const bomQty = parseWholeQuantity(formatBomQuantity(line.quantity)) ?? 0
                    const exceedsStock =
                      !todayReq && bomQty > 0 && line.current_stock > 0 && bomQty > line.current_stock
                    return (
                      <li
                        key={`bom-${line.material_id}`}
                        className={`flex items-center gap-3 px-3 py-2.5 ${
                          todayReq?.status === 'released'
                            ? 'bg-emerald-50/60'
                            : todayReq
                              ? 'bg-amber-50/50'
                              : outOfStock
                                ? 'bg-red-50/50'
                                : 'bg-white'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{line.material_name}</p>
                          <p
                            className={`text-xs ${outOfStock || exceedsStock ? 'text-red-700 font-medium' : 'text-gray-500'}`}
                          >
                            {todayReq?.status === 'released'
                              ? `Released today · ${todayReq.quantity} ${line.unit}`
                              : todayReq?.status === 'pending'
                                ? `Awaiting release · ${todayReq.quantity} ${line.unit}`
                                : outOfStock
                                  ? `Out of stock · BOM`
                                  : exceedsStock
                                    ? `Only ${line.current_stock} ${line.unit} in stock`
                                    : `BOM · ${line.current_stock} ${line.unit} in stock`}
                          </p>
                        </div>
                        {todayReq ? (
                          <span
                            className={`text-xs font-medium shrink-0 ${
                              todayReq.status === 'released' ? 'text-emerald-800' : 'text-amber-800'
                            }`}
                          >
                            {todayReq.status === 'released' ? 'Released' : 'Pending'}
                          </span>
                        ) : (
                          <p className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">
                            {bomQty} <span className="text-xs font-normal text-gray-500">{line.unit}</span>
                          </p>
                        )}
                      </li>
                    )
                  })}
                  {additionalLines.map((line) => {
                    const stock = getMaterialStock(line.material_id)
                    const outOfStock = stock <= 0
                    const exceedsStock = stock > 0 && line.quantity > stock
                    return (
                    <li
                      key={line.id}
                      className={`flex items-center gap-3 px-3 py-2.5 ${outOfStock ? 'bg-red-50/50' : 'bg-blue-50/40'}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{line.material_name}</p>
                        <p
                          className={`text-xs truncate ${outOfStock || exceedsStock ? 'text-red-700 font-medium' : 'text-gray-500'}`}
                        >
                          Additional · {line.quantity} {line.unit}
                          {outOfStock
                            ? ' · out of stock'
                            : exceedsStock
                              ? ` · only ${stock} in stock`
                              : ` · ${stock} in stock`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAdditionalLine(line.id)}
                        className="shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-md text-gray-500 hover:bg-white/80 touch-manipulation"
                        aria-label="Remove additional material"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                    )
                  })}
                </ul>
              )}
              {schedule.length > 0 && bomNeeds.length === 0 && additionalLines.length === 0 ? (
                <p className="text-sm text-gray-500 px-3 py-3 bg-slate-50">
                  No BOM on scheduled products — add a material below.
                </p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center px-3 py-3 bg-slate-50 border-t border-slate-200">
                <select
                  value={reqMaterialId}
                  onChange={(e) => setReqMaterialId(e.target.value)}
                  className="flex-1 min-h-[40px] px-2 py-2 border rounded-md text-sm bg-white"
                >
                  <option value="">Add additional material…</option>
                  {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.material_name}
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  step="1"
                  min="1"
                  inputMode="numeric"
                  value={reqQty}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '' || /^\d+$/.test(v)) setReqQty(v)
                  }}
                  placeholder="Qty"
                  className="w-full sm:w-20 min-h-[40px] px-2 py-2 border rounded-md text-sm bg-white"
                />
                <button
                  type="button"
                  onClick={addAdditionalLine}
                  disabled={submittingAll}
                  className="min-h-[40px] px-3 py-2 rounded-md border border-slate-300 bg-white text-sm font-medium hover:bg-white touch-manipulation shrink-0 inline-flex items-center justify-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={submitAllMaterialRequests}
            disabled={submittingAll || !canRequestMaterials}
            className="w-full mt-4 flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-900 text-base font-semibold disabled:opacity-40 touch-manipulation"
          >
            <Send className="h-5 w-5" />
            {submittingAll ? 'Requesting…' : 'Request materials'}
            {canRequestMaterials && !submittingAll ? (
              <span className="text-slate-300 font-normal">({totalToSend})</span>
            ) : null}
          </button>
          {totalToSend > 0 && stockBlocksRequest ? (
            <p className="text-xs text-red-700 text-center mt-2">
              Out of stock or quantity too high for one or more materials above.
            </p>
          ) : null}

          {requestsToday.length > 0 ? (
            <details className="mt-5 group">
              <summary className="text-sm font-medium text-gray-600 cursor-pointer list-none flex items-center gap-2 touch-manipulation">
                <span className="group-open:rotate-90 transition-transform inline-block">›</span>
                Sent today ({requestsToday.length})
              </summary>
              <ul className="mt-2 divide-y text-sm border border-slate-100 rounded-lg overflow-hidden">
                {requestsToday.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-2 px-3 py-2.5 bg-white"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">
                        {r.material?.material_name || 'Material'}
                        <span className="font-normal text-gray-500">
                          {' '}
                          · {r.quantity} {r.material?.unit}
                        </span>
                      </p>
                      {(r.requested_by || r.released_by) ? (
                        <p className="text-xs text-gray-500 truncate">
                          {r.requested_by ? `Requested by ${r.requested_by}` : ''}
                          {r.requested_by && r.released_by ? ' · ' : ''}
                          {r.released_by ? `Released by ${r.released_by}` : ''}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded shrink-0 ${
                        r.status === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {r.status === 'pending' ? 'Pending' : 'Released'}
                    </span>
                    {r.status === 'pending' ? (
                      <button
                        type="button"
                        title="Cancel"
                        onClick={() => cancelMaterialRequest(r.id)}
                        disabled={cancellingReqId === r.id}
                        className="shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50 touch-manipulation"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-4 sm:px-5 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-gray-900">Floor inventory</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Opened packages on the factory floor — record opens after procurement releases materials.
            </p>
            <nav
              className="mt-3 flex flex-wrap gap-2"
              aria-label="Floor inventory type"
            >
              {(
                [
                  { id: 'ingredients' as const, label: 'Ingredients', icon: FlaskConical },
                  { id: 'packaging' as const, label: 'Packaging', icon: Package },
                  { id: 'supplies' as const, label: 'Supplies', icon: Wrench },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    setFloorInventoryKind((current) => (current === id ? null : id))
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium touch-manipulation transition-colors ${
                    floorInventoryKind === id
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-gray-700 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              ))}
            </nav>
          </div>
          {floorInventoryKind ? (
            <div className="border-t border-slate-100">
              <FactoryMaterialInventory
                key={`${floorInventoryKind}-${inventoryRefreshKey}`}
                inventoryKind={floorInventoryKind}
                theme="blue"
                currentUsername={getFactoryRequestedBy()}
              />
            </div>
          ) : (
            <p className="px-4 py-6 sm:px-5 text-sm text-gray-500 text-center">
              Choose Ingredients, Packaging, or Supplies above.
            </p>
          )}
        </section>
      </main>
    </div>
  )
}
