'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '../../lib/supabase'
import { getPhilippinesDate } from '../../lib/timezone'
import {
  CheckCircle,
  XCircle,
  Scan,
  Factory,
  ClipboardList,
  ArrowLeft,
  FlaskConical,
  Send,
  Users,
  UserPlus,
  X,
  Trash2,
} from 'lucide-react'

const Scanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then((mod) => mod.Scanner),
  { ssr: false }
)

function extractStickerIdFromUrl(value: string): string | null {
  try {
    if (value.includes('id=')) {
      const url = value.startsWith('http') ? new URL(value) : new URL(value, 'https://dummy.com')
      return url.searchParams.get('id')
    }
    return null
  } catch {
    return null
  }
}

type ScheduleRow = {
  schedule_id: string
  product_id: string
  product_name: string
  sku?: string
  brand_name: string
  quantity_required: number
  printed: number
  produced: number
}

type RawMat = {
  id: string
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

export default function FactoryPage() {
  const searchParams = useSearchParams()
  const urlId = searchParams.get('id')
  const today = getPhilippinesDate()

  const [schedule, setSchedule] = useState<ScheduleRow[]>([])
  const [materials, setMaterials] = useState<RawMat[]>([])
  const [requests, setRequests] = useState<
    { id: string; quantity: number; status: string; request_date: string; notes?: string; material?: RawMat }[]
  >([])
  const [loadingMain, setLoadingMain] = useState(true)

  const [recordOutputMode, setRecordOutputMode] = useState(false)
  const [view, setView] = useState<'scanner' | 'result'>('scanner')
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'invalid'>('loading')
  const [message, setMessage] = useState('')
  const [testStickerId, setTestStickerId] = useState('')
  const processingRef = useRef(false)

  const [reqMaterialId, setReqMaterialId] = useState('')
  const [reqQty, setReqQty] = useState('')
  const [reqNotes, setReqNotes] = useState('')
  const [submittingReq, setSubmittingReq] = useState(false)

  const [factoryLocationNames, setFactoryLocationNames] = useState<string[]>([])
  const [eligibleFactoryStaff, setEligibleFactoryStaff] = useState<FactoryStaffOption[]>([])
  const [floorStaffToday, setFloorStaffToday] = useState<FloorStaffRow[]>([])
  const [staffToAdd, setStaffToAdd] = useState('')
  const [addingStaff, setAddingStaff] = useState(false)
  const [cancellingReqId, setCancellingReqId] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setLoadingMain(true)
    try {
      const { data: scheduleData } = await supabase
        .from('production_schedules')
        .select('id, product_id, quantity_required')
        .eq('schedule_date', today)

      if (!scheduleData?.length) {
        setSchedule([])
      } else {
        const pids = scheduleData.map((s) => s.product_id)
        const { data: products } = await supabase
          .from('products')
          .select('id, name, sku, brands(name)')
          .in('id', pids)

        const prodMap = new Map(
          (products || []).map((p: any) => [
            p.id,
            { name: p.name, sku: p.sku, brand_name: p.brands?.name || '—' },
          ])
        )

        const { data: printed } = await supabase
          .from('production_sticker_logs')
          .select('product_id, schedule_id')
          .eq('manufacture_date', today)

        const prodSince = new Date()
        prodSince.setDate(prodSince.getDate() - 2)
        const { data: producedLogs } = await supabase
          .from('production_sticker_logs')
          .select('product_id, schedule_id, produced_at')
          .not('produced_at', 'is', null)
          .gte('produced_at', prodSince.toISOString())

        const rows: ScheduleRow[] = scheduleData.map((row: any) => {
          const p = prodMap.get(row.product_id)
          const printedN =
            printed?.filter(
              (x) => x.product_id === row.product_id && (x.schedule_id === row.id || !x.schedule_id)
            ).length ?? 0
          const producedN =
            producedLogs?.filter((x) => {
              if (x.product_id !== row.product_id) return false
              if (!(x.schedule_id === row.id || !x.schedule_id)) return false
              const ph = new Date(x.produced_at as string).toLocaleDateString('en-CA', {
                timeZone: 'Asia/Manila',
              })
              return ph === today
            }).length ?? 0
          return {
            schedule_id: row.id,
            product_id: row.product_id,
            product_name: p?.name || '—',
            sku: p?.sku,
            brand_name: p?.brand_name || '—',
            quantity_required: row.quantity_required,
            printed: printedN,
            produced: producedN,
          }
        })
        setSchedule(rows)
      }

      const { data: mats } = await supabase
        .from('raw_materials')
        .select('id, material_name, sku, unit, current_stock, is_active, brand_id')
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
        .select('id, material_id, quantity, status, request_date, notes, material:raw_materials(id, material_name, sku, unit)')
        .in('status', ['pending', 'released'])
        .order('created_at', { ascending: false })
        .limit(50)

      setRequests((reqs || []) as any[])

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
    if (!urlId) loadDashboard()
  }, [urlId, loadDashboard])

  const processScan = useCallback(async (stickerId: string) => {
    if (!stickerId || processingRef.current) return
    processingRef.current = true
    setStatus('loading')
    setView('result')

    try {
      const { data: sticker, error: fetchError } = await supabase
        .from('production_sticker_logs')
        .select('id, product_id, produced_at')
        .eq('id', stickerId)
        .single()

      if (fetchError || !sticker) {
        setStatus('error')
        setMessage('Invalid or unknown sticker')
        processingRef.current = false
        return
      }

      if (sticker.produced_at) {
        setStatus('success')
        setMessage('Already in production inventory')
        processingRef.current = false
        return
      }

      const { data: product } = await supabase
        .from('products')
        .select('production')
        .eq('id', sticker.product_id)
        .single()

      const newProduction = (product?.production || 0) + 1
      await supabase.from('products').update({ production: newProduction }).eq('id', sticker.product_id)

      await supabase
        .from('production_sticker_logs')
        .update({ produced_at: new Date().toISOString() })
        .eq('id', stickerId)

      setStatus('success')
      setMessage('Added to production inventory')
      await loadDashboard()
    } catch (err) {
      console.error('Factory scan error:', err)
      setStatus('error')
      setMessage('Failed to process scan')
    } finally {
      processingRef.current = false
    }
  }, [loadDashboard])

  useEffect(() => {
    if (urlId) processScan(urlId)
  }, [urlId, processScan])

  const handleScan = (detectedCodes: { rawValue: string }[]) => {
    if (detectedCodes.length === 0 || processingRef.current) return
    const rawValue = detectedCodes[0].rawValue
    const stickerId = extractStickerIdFromUrl(rawValue) || (rawValue.match(/^[0-9a-f-]{36}$/i) ? rawValue : null)
    if (stickerId) processScan(stickerId)
    else {
      setView('result')
      setStatus('error')
      setMessage('Invalid QR code - expected factory sticker')
      processingRef.current = false
    }
  }

  const submitMaterialRequest = async () => {
    const q = parseFloat(reqQty)
    if (!reqMaterialId || !q || q <= 0) {
      alert('Select a material and enter quantity.')
      return
    }
    setSubmittingReq(true)
    try {
      const { error } = await supabase.from('factory_material_requests').insert({
        material_id: reqMaterialId,
        quantity: q,
        request_date: today,
        notes: reqNotes.trim() || null,
        status: 'pending',
      })
      if (error) throw error
      setReqMaterialId('')
      setReqQty('')
      setReqNotes('')
      await loadDashboard()
    } catch (e: any) {
      alert(e?.message || 'Could not submit request')
    } finally {
      setSubmittingReq(false)
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

  const exitRecordOutput = () => {
    setRecordOutputMode(false)
    setView('scanner')
    setStatus('loading')
    setMessage('')
  }

  if (urlId) {
    return (
      <div className="min-h-[100dvh] min-h-screen bg-slate-100 flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 max-w-md w-full text-center">
          {status === 'loading' && (
            <>
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-slate-700 mb-4" />
              <p className="text-gray-600">Processing...</p>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Success</h2>
              <p className="text-gray-600 mb-6">{message}</p>
              <a
                href="/factory"
                className="inline-flex min-h-[44px] items-center justify-center w-full sm:w-auto px-4 py-3 rounded-lg bg-slate-100 text-slate-800 font-medium active:bg-slate-200"
              >
                Back to factory
              </a>
            </>
          )}
          {(status === 'error' || status === 'invalid') && (
            <>
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Scan failed</h2>
              <p className="text-gray-600 mb-6">{message}</p>
              <a
                href="/factory"
                className="inline-flex min-h-[44px] items-center justify-center w-full sm:w-auto px-4 py-3 rounded-lg bg-slate-100 text-slate-800 font-medium active:bg-slate-200"
              >
                Try again
              </a>
            </>
          )}
        </div>
      </div>
    )
  }

  if (recordOutputMode) {
    if (view === 'result') {
      return (
        <div className="min-h-[100dvh] min-h-screen bg-slate-100 flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 max-w-md w-full text-center">
            {status === 'loading' && (
              <>
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-slate-700 mb-4" />
                <p className="text-gray-600">Processing...</p>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Recorded</h2>
                <p className="text-gray-600 mb-6">{message}</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => {
                      setView('scanner')
                      setStatus('loading')
                      setMessage('')
                    }}
                    className="min-h-[44px] px-4 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900 active:bg-slate-950 sm:flex-1"
                  >
                    Scan another
                  </button>
                  <button
                    onClick={exitRecordOutput}
                    className="min-h-[44px] px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 sm:flex-1"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
            {(status === 'error' || status === 'invalid') && (
              <>
                <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed</h2>
                <p className="text-gray-600 mb-6">{message}</p>
                <button
                  onClick={() => {
                    setView('scanner')
                    setStatus('loading')
                    setMessage('')
                  }}
                  className="min-h-[44px] w-full sm:w-auto px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900 active:bg-slate-950"
                >
                  Try again
                </button>
              </>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-[100dvh] min-h-screen bg-slate-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto px-3 sm:px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-4">
          <button
            type="button"
            onClick={exitRecordOutput}
            className="flex items-center gap-2 min-h-[44px] text-slate-700 mb-3 active:text-slate-900 touch-manipulation"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to overview
          </button>
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center gap-2">
              <Scan className="h-6 w-6" />
              <h1 className="text-lg font-semibold">Record production output</h1>
            </div>
            <div className="p-3 sm:p-4 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-medium text-amber-900 mb-2">Testing (no camera)</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    autoCapitalize="off"
                    placeholder="Paste sticker ID (UUID)"
                    value={testStickerId}
                    onChange={(e) => setTestStickerId(e.target.value)}
                    className="flex-1 min-h-[44px] px-3 py-2 text-base border border-amber-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const id = testStickerId.trim()
                      if (id) processScan(id)
                    }}
                    disabled={!testStickerId.trim()}
                    className="min-h-[44px] shrink-0 px-4 py-2 bg-amber-600 text-white text-base rounded-lg disabled:opacity-50 active:bg-amber-700 touch-manipulation"
                  >
                    Simulate
                  </button>
                </div>
              </div>
              <div className="rounded-lg overflow-hidden border-2 border-slate-200">
                <Scanner
                  onScan={handleScan}
                  onError={(err) => console.error('Scanner:', err)}
                  components={{ finder: true }}
                  sound={true}
                  constraints={{ facingMode: 'environment' }}
                  styles={{ container: { width: '100%', aspectRatio: '1' } }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] min-h-screen bg-slate-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="bg-slate-800 text-white">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-start sm:items-center gap-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Factory className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 mt-0.5 sm:mt-0" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold leading-tight">Factory</h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-0.5 tabular-nums">{today}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
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

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-slate-600 shrink-0" />
                Today&apos;s production schedule
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setRecordOutputMode(true)
                setView('scanner')
                setStatus('loading')
                setMessage('')
                setTestStickerId('')
              }}
              className="shrink-0 flex items-center justify-center gap-2 w-full sm:w-auto min-h-[44px] px-4 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-medium text-sm active:bg-slate-950 touch-manipulation"
            >
              <Scan className="h-4 w-4" />
              Record production output
            </button>
          </div>

          {loadingMain ? (
            <p className="text-gray-500 py-8 text-center">Loading…</p>
          ) : schedule.length === 0 ? (
            <p className="text-gray-500 py-6 text-center text-sm">No schedule for today. Admin can set it in Dashboard → Inventory → Production Schedule.</p>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto mt-4 -mx-1 px-1">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500 text-xs uppercase">
                      <th className="py-2.5 pr-3">Brand</th>
                      <th className="py-2.5 pr-3">Product</th>
                      <th className="py-2.5 pr-3">SKU</th>
                      <th className="py-2.5 pr-2 text-right">Req</th>
                      <th className="py-2.5 pr-2 text-right">Printed</th>
                      <th className="py-2.5 text-right">In Prod</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((r) => (
                      <tr key={r.schedule_id} className="border-b border-slate-100">
                        <td className="py-2.5 pr-3 text-gray-600">{r.brand_name}</td>
                        <td className="py-2.5 pr-3 font-medium text-gray-900">{r.product_name}</td>
                        <td className="py-2.5 pr-3 text-gray-600">{r.sku || '—'}</td>
                        <td className="py-2.5 pr-2 text-right tabular-nums">{r.quantity_required}</td>
                        <td className="py-2.5 pr-2 text-right tabular-nums">{r.printed}</td>
                        <td className="py-2.5 text-right text-emerald-700 font-medium tabular-nums">{r.produced}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden mt-4 space-y-3">
                {schedule.map((r) => (
                  <div
                    key={r.schedule_id}
                    className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 active:bg-slate-100/80"
                  >
                    <p className="font-medium text-gray-900 leading-snug">{r.product_name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {r.brand_name}
                      {r.sku ? ` · ${r.sku}` : null}
                    </p>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-white/80 border border-slate-100 py-2 px-1">
                        <dt className="text-[10px] uppercase tracking-wide text-gray-500">Req</dt>
                        <dd className="text-base font-semibold text-gray-900 tabular-nums">{r.quantity_required}</dd>
                      </div>
                      <div className="rounded-md bg-white/80 border border-slate-100 py-2 px-1">
                        <dt className="text-[10px] uppercase tracking-wide text-gray-500">Printed</dt>
                        <dd className="text-base font-semibold text-gray-900 tabular-nums">{r.printed}</dd>
                      </div>
                      <div className="rounded-md bg-white/80 border border-slate-100 py-2 px-1">
                        <dt className="text-[10px] uppercase tracking-wide text-gray-500">In Prod</dt>
                        <dd className="text-base font-semibold text-emerald-700 tabular-nums">{r.produced}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <FlaskConical className="h-5 w-5 text-slate-600" />
            Raw materials
          </h2>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Material</label>
              <select
                value={reqMaterialId}
                onChange={(e) => setReqMaterialId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 border rounded-lg text-base text-gray-900 bg-white"
              >
                <option value="">Select material…</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.material_name} ({m.brands?.name || '—'}) · {m.current_stock} {m.unit}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full sm:w-28 shrink-0">
                <label className="block text-xs font-medium text-gray-600 mb-1">Qty</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={reqQty}
                  onChange={(e) => setReqQty(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border rounded-lg text-base"
                  placeholder="0"
                />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border rounded-lg text-base"
                  placeholder="Reason / batch…"
                />
              </div>
              <button
                type="button"
                onClick={submitMaterialRequest}
                disabled={submittingReq}
                className="flex items-center justify-center gap-2 min-h-[44px] w-full sm:w-auto px-5 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 text-base font-medium shrink-0 active:bg-slate-900 disabled:opacity-50 touch-manipulation"
              >
                <Send className="h-4 w-4" />
                Request
              </button>
            </div>
          </div>

          <h3 className="text-sm font-medium text-gray-700 mb-2">Recent requests</h3>
          {requests.length === 0 ? (
            <p className="text-sm text-gray-400">No requests yet.</p>
          ) : (
            <ul className="divide-y text-sm max-h-60 sm:max-h-48 overflow-y-auto overscroll-y-contain -mx-1 px-1">
              {requests.map((r) => (
                <li key={r.id} className="py-3 flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start">
                  <span className="min-w-0">
                    <span className="font-medium">{r.material?.material_name || 'Material'}</span>
                    <span className="text-gray-500"> · {r.quantity} {r.material?.unit}</span>
                    {r.notes ? <span className="text-gray-500 block text-xs mt-0.5">{r.notes}</span> : null}
                  </span>
                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded ${
                        r.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {r.status === 'pending' ? 'Pending release' : 'Released'}
                    </span>
                    {r.status === 'pending' ? (
                      <button
                        type="button"
                        title="Cancel request"
                        onClick={() => cancelMaterialRequest(r.id)}
                        disabled={cancellingReqId === r.id}
                        className="inline-flex items-center gap-1 min-h-[40px] px-2.5 py-1.5 text-xs font-medium rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 touch-manipulation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {cancellingReqId === r.id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
