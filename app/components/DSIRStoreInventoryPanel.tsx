'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getBalancesAsOfReportDate,
  getBalancesForLocation,
  listMovements,
  listMovementsForReportDay,
  ensureDsirPullOutsFromReport,
  applyCycleCount,
  normalizeDsirFlavor,
  type DsirStoreBalance,
  type DsirStoreMovement,
} from '../../lib/dsir-store-inventory'
import { supabase } from '../../lib/supabase'
import { Modal } from './Modal'
import { ClipboardList, Package, RefreshCw, X } from 'lucide-react'

type LocationOption = {
  id: string
  name: string
}

type Props = {
  mode: 'staff' | 'admin'
  locationId: string
  locationName?: string
  /** Admin: pick among brand locations */
  locations?: LocationOption[]
  onLocationChange?: (locationId: string) => void
  /** When set, show balances/movements for this DSIR report date only */
  reportDate?: string
  dsirReportId?: string | null
  /** If submitted/reviewed, missing ledger pull-outs are backfilled from the form */
  reportStatus?: 'draft' | 'submitted' | 'reviewed'
  /** Hide the top title block when embedded in a modal that already has a title */
  embedded?: boolean
  /**
   * Dashboard admin only: show Cycle count. Never enable on /dsir staff portal.
   * Guests should pass false.
   */
  allowCycleCount?: boolean
  /** Shown on cycle-count movements (e.g. dashboard role label) */
  adjustedByName?: string | null
}

type CycleCountRow = {
  flavor: string
  onHand: number
  counted: string
}

function movementTypeLabel(type: string): string {
  if (type === 'transfer_receive') return 'Receive (QR)'
  if (type === 'dsir_pull_out') return 'Pull-out (DSIR)'
  if (type === 'cycle_count') return 'Cycle count'
  return type
}

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function formatReportDayLabel(reportDate: string): string {
  const [y, m, d] = reportDate.split('T')[0].split('-')
  if (!y || !m || !d) return reportDate
  return `${Number(m)}/${Number(d)}/${y}`
}

function normalizeCategoryKey(category: string | null | undefined): string {
  return (category || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
}

/** Same source as DSIR Section B ice cream rows (active inventory products for the brand). */
async function loadDsirActiveIceCreamFlavors(brandId: string): Promise<string[]> {
  if (!brandId) return []

  const [{ data: inventoryProducts, error: inventoryError }, { data: categorySortRows, error: categorySortError }] =
    await Promise.all([
      supabase.from('products').select('name, category').eq('brand_id', brandId).order('name'),
      supabase
        .from('product_category_sort')
        .select('category_name, sort_index')
        .eq('brand_id', brandId),
    ])

  if (inventoryError) throw inventoryError
  if (categorySortError) throw categorySortError

  const categorySortMap = new Map<string, number>()
  for (const row of categorySortRows || []) {
    categorySortMap.set(normalizeCategoryKey(row.category_name), Number(row.sort_index) || 0)
  }

  const groupedUnique = new Map<string, string>()
  for (const product of inventoryProducts || []) {
    const key = normalizeCategoryKey(product.category as string)
    const categoryIndex = key ? categorySortMap.get(key) : undefined
    // Match DSIRViewer: exclude categories with sort_index 0
    if (categoryIndex === 0) continue
    const name = normalizeDsirFlavor(String(product.name || ''))
    if (!name) continue
    if (!groupedUnique.has(name)) groupedUnique.set(name, name)
  }

  return Array.from(groupedUnique.keys()).sort((a, b) => a.localeCompare(b))
}

export function DSIRStoreInventoryPanel({
  mode,
  locationId,
  locationName,
  locations,
  onLocationChange,
  reportDate,
  dsirReportId,
  reportStatus,
  embedded = false,
  allowCycleCount = false,
  adjustedByName = null,
}: Props) {
  const [balances, setBalances] = useState<Array<{ flavor: string; quantity: number; id?: string }>>([])
  const [movements, setMovements] = useState<DsirStoreMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const dateScoped = Boolean(reportDate)

  const canCycleCount = mode === 'admin' && allowCycleCount && !dateScoped

  const [showCycleCount, setShowCycleCount] = useState(false)
  const [cycleRows, setCycleRows] = useState<CycleCountRow[]>([])
  const [cycleNotes, setCycleNotes] = useState('')
  const [cycleSaving, setCycleSaving] = useState(false)
  const [cycleError, setCycleError] = useState<string | null>(null)
  const [newFlavor, setNewFlavor] = useState('')
  const [dsirActiveFlavors, setDsirActiveFlavors] = useState<string[]>([])

  const refresh = useCallback(async () => {
    if (!locationId) return
    setLoading(true)
    setError(null)
    try {
      // Backfill pull-outs for submitted reports that posted receive but missed ledger outs
      if (
        dsirReportId &&
        (reportStatus === 'submitted' || reportStatus === 'reviewed')
      ) {
        const { data: loc } = await supabase
          .from('locations')
          .select('brand_id')
          .eq('id', locationId)
          .maybeSingle()
        if (loc?.brand_id) {
          try {
            await ensureDsirPullOutsFromReport({
              locationId,
              brandId: loc.brand_id as string,
              dsirReportId,
            })
          } catch (backfillErr) {
            console.warn('DSIR pull-out backfill skipped:', backfillErr)
          }
        }
      }

      if (reportDate) {
        const [asOf, dayMoves] = await Promise.all([
          getBalancesAsOfReportDate(locationId, reportDate),
          listMovementsForReportDay(locationId, reportDate, dsirReportId),
        ])
        setBalances(asOf)
        setMovements(dayMoves)
      } else {
        const bal = await getBalancesForLocation(locationId)
        setBalances(bal as DsirStoreBalance[])
        if (mode === 'admin') {
          setMovements(await listMovements(locationId, { limit: 100 }))
        } else {
          setMovements(await listMovements(locationId, { since: startOfTodayIso(), limit: 50 }))
        }
      }
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Failed to load store inventory')
    } finally {
      setLoading(false)
    }
  }, [locationId, mode, reportDate, dsirReportId, reportStatus])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openCycleCount = useCallback(async () => {
    if (!canCycleCount || !locationId) return
    setCycleError(null)
    setCycleNotes('')
    setNewFlavor('')

    try {
      const { data: loc } = await supabase
        .from('locations')
        .select('brand_id')
        .eq('id', locationId)
        .maybeSingle()

      const brandId = (loc?.brand_id as string) || ''
      const [bal, activeFlavors] = await Promise.all([
        getBalancesForLocation(locationId),
        loadDsirActiveIceCreamFlavors(brandId),
      ])

      const onHandByFlavor = new Map(
        bal.map((b) => [normalizeDsirFlavor(b.flavor), Number(b.quantity) || 0])
      )

      // Start with ledger balances; DSIR active items available via Add dropdown
      const flavorSet = new Set<string>([
        ...Array.from(onHandByFlavor.keys()),
        ...activeFlavors,
      ])

      const rows: CycleCountRow[] = Array.from(flavorSet)
        .sort((a, b) => a.localeCompare(b))
        .map((flavor) => {
          const onHand = onHandByFlavor.get(flavor) || 0
          return {
            flavor,
            onHand,
            counted: String(onHand),
          }
        })

      setDsirActiveFlavors(activeFlavors)
      setCycleRows(rows)
      setShowCycleCount(true)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Failed to open cycle count')
    }
  }, [canCycleCount, locationId])

  const flavorsAvailableToAdd = useMemo(
    () =>
      dsirActiveFlavors.filter(
        (flavor) => !cycleRows.some((r) => r.flavor === flavor)
      ),
    [dsirActiveFlavors, cycleRows]
  )

  const cycleVarianceSummary = useMemo(() => {
    let changed = 0
    let absDelta = 0
    for (const row of cycleRows) {
      const counted = Math.max(0, Math.floor(Number(row.counted) || 0))
      const delta = counted - row.onHand
      if (delta !== 0) {
        changed += 1
        absDelta += Math.abs(delta)
      }
    }
    return { changed, absDelta }
  }, [cycleRows])

  const submitCycleCount = async () => {
    if (!locationId) return
    const notes = cycleNotes.trim()
    if (!notes) {
      setCycleError('Notes / reason is required.')
      return
    }
    if (cycleVarianceSummary.changed === 0) {
      setCycleError('No variances to post — counted matches on hand for all flavors.')
      return
    }

    setCycleSaving(true)
    setCycleError(null)
    try {
      const { data: loc, error: locErr } = await supabase
        .from('locations')
        .select('brand_id')
        .eq('id', locationId)
        .maybeSingle()
      if (locErr) throw locErr
      const brandId = (loc?.brand_id as string) || ''
      if (!brandId) throw new Error('Store brand is missing for this location.')

      const result = await applyCycleCount({
        locationId,
        brandId,
        notes,
        adjustedByName: adjustedByName || 'Dashboard admin',
        counts: cycleRows.map((row) => ({
          flavor: row.flavor,
          countedQty: Math.max(0, Math.floor(Number(row.counted) || 0)),
        })),
      })

      if (result.status === 'invalid_notes') {
        setCycleError('Notes / reason is required.')
        return
      }
      if (result.status === 'empty') {
        setCycleError('No variances to post.')
        return
      }

      setShowCycleCount(false)
      await refresh()
      alert(
        `Cycle count posted for ${result.flavors} flavor(s) (total adjustment ${result.totalAbsDelta} pan(s)).`
      )
    } catch (e) {
      console.error(e)
      setCycleError(e instanceof Error ? e.message : 'Failed to post cycle count')
    } finally {
      setCycleSaving(false)
    }
  }

  const addFlavorRow = () => {
    const flavor = normalizeDsirFlavor(newFlavor)
    if (!flavor) return
    if (!dsirActiveFlavors.includes(flavor)) {
      setCycleError('Select a DSIR active flavor from the list.')
      return
    }
    if (cycleRows.some((r) => r.flavor === flavor)) {
      setCycleError(`${flavor} is already in the list.`)
      return
    }
    setCycleRows((prev) =>
      [...prev, { flavor, onHand: 0, counted: '0' }].sort((a, b) =>
        a.flavor.localeCompare(b.flavor)
      )
    )
    setNewFlavor('')
    setCycleError(null)
  }

  const totalOnHand = useMemo(
    () => balances.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0),
    [balances]
  )

  const dayReceive = useMemo(() => {
    const since = dateScoped ? null : startOfTodayIso()
    return movements
      .filter((m) => m.movement_type === 'transfer_receive')
      .filter((m) => !since || m.created_at >= since)
      .reduce((s, m) => s + Math.max(0, m.delta), 0)
  }, [movements, dateScoped])
  const dayPullOut = useMemo(() => {
    const since = dateScoped ? null : startOfTodayIso()
    return movements
      .filter((m) => m.movement_type === 'dsir_pull_out')
      .filter((m) => !since || m.created_at >= since)
      .reduce((s, m) => s + Math.abs(Math.min(0, m.delta)), 0)
  }, [movements, dateScoped])

  const showMovements = mode === 'admin' || dateScoped

  return (
    <div className="space-y-4">
      {!embedded ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-gray-600" />
              Store inventory
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {dateScoped
                ? `Balances and movements for ${formatReportDayLabel(reportDate!)}.`
                : mode === 'staff'
                  ? 'Counter-check only — updated by transfer QR receives and daily DSIR pull-outs.'
                  : 'True on-hand ice cream stock by store, with movement history.'}
            </p>
            {locationName && mode === 'staff' ? (
              <p className="text-xs text-gray-600 mt-1">{locationName}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mode === 'admin' && !dateScoped && locations && locations.length > 0 && onLocationChange ? (
              <select
                value={locationId}
                onChange={(e) => onLocationChange(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            ) : null}
            {canCycleCount ? (
              <button
                type="button"
                onClick={() => void openCycleCount()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 bg-white"
              >
                <ClipboardList className="h-4 w-4" />
                Cycle count
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      )}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-800">
          {dateScoped ? 'On hand (end of day)' : 'On hand'}: {totalOnHand.toLocaleString()} pans
        </span>
        {(mode === 'staff' || dateScoped || mode === 'admin') && (
          <>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">
              {dateScoped ? 'Day' : 'Today'} received: +{dayReceive.toLocaleString()}
            </span>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-amber-900">
              {dateScoped ? 'Day' : 'Today'} pull-out: −{dayPullOut.toLocaleString()}
            </span>
          </>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">Loading inventory…</div>
      ) : balances.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-600 space-y-3">
          <p>
            {dateScoped
              ? 'No store stock ledger activity on or before this date.'
              : 'No store stock yet. Scan a transfer sheet QR on today\'s DSIR to receive pans.'}
          </p>
          {canCycleCount ? (
            <button
              type="button"
              onClick={() => void openCycleCount()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-white bg-white"
            >
              <ClipboardList className="h-4 w-4" />
              Start cycle count
            </button>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Flavor</th>
                <th className="text-right px-4 py-2.5 font-medium">
                  {dateScoped ? 'On hand (EOD)' : 'On hand'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {balances.map((row) => (
                <tr key={row.id || row.flavor} className="hover:bg-gray-50/80">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{row.flavor}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-800">
                    {Number(row.quantity).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showMovements ? (
        <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
          <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-800">
              {dateScoped ? `Movements · ${formatReportDayLabel(reportDate!)}` : 'Movements'}
            </h3>
          </div>
          {movements.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              {dateScoped ? 'No movements for this DSIR date.' : 'No movements yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-white border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">When</th>
                    <th className="text-left px-4 py-2 font-medium">Flavor</th>
                    <th className="text-right px-4 py-2 font-medium">Δ</th>
                    <th className="text-right px-4 py-2 font-medium">After</th>
                    <th className="text-left px-4 py-2 font-medium">Type</th>
                    <th className="text-left px-4 py-2 font-medium">Staff</th>
                    <th className="text-left px-4 py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/80">
                      <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {new Date(m.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 font-medium text-gray-900">{m.flavor}</td>
                      <td
                        className={`px-4 py-2 text-right tabular-nums font-medium ${
                          m.delta >= 0 ? 'text-emerald-700' : 'text-amber-800'
                        }`}
                      >
                        {m.delta >= 0 ? '+' : ''}
                        {m.delta}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                        {m.quantity_after}
                      </td>
                      <td className="px-4 py-2 text-gray-700">{movementTypeLabel(m.movement_type)}</td>
                      <td className="px-4 py-2 text-gray-700">{m.staff_name || '—'}</td>
                      <td className="px-4 py-2 text-gray-600 max-w-[12rem] truncate" title={m.notes || ''}>
                        {m.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {showCycleCount ? (
        <Modal onClose={() => !cycleSaving && setShowCycleCount(false)} align="center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Cycle count</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Enter physical pans on hand. Variances post as ledger adjustments (admin only).
                </p>
              </div>
              <button
                type="button"
                disabled={cycleSaving}
                onClick={() => setShowCycleCount(false)}
                className="p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto min-h-0 flex-1 space-y-4">
              {cycleError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {cycleError}
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes / reason <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={cycleNotes}
                  onChange={(e) => setCycleNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  disabled={cycleSaving}
                />
              </div>

              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Flavor</th>
                        <th className="text-right px-3 py-2 font-medium">On hand</th>
                        <th className="text-right px-3 py-2 font-medium">Counted</th>
                        <th className="text-right px-3 py-2 font-medium">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cycleRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-gray-500">
                            No flavors yet — add one below or receive stock via QR first.
                          </td>
                        </tr>
                      ) : (
                        cycleRows.map((row, idx) => {
                          const counted = Math.max(0, Math.floor(Number(row.counted) || 0))
                          const variance = counted - row.onHand
                          return (
                            <tr key={row.flavor} className="hover:bg-gray-50/80">
                              <td className="px-3 py-2 font-medium text-gray-900">{row.flavor}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                                {row.onHand}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={row.counted}
                                  disabled={cycleSaving}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    setCycleRows((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, counted: value } : r))
                                    )
                                  }}
                                  className="w-20 border border-gray-300 rounded px-2 py-1 text-right text-sm tabular-nums"
                                />
                              </td>
                              <td
                                className={`px-3 py-2 text-right tabular-nums font-medium ${
                                  variance === 0
                                    ? 'text-gray-400'
                                    : variance > 0
                                      ? 'text-emerald-700'
                                      : 'text-amber-800'
                                }`}
                              >
                                {variance > 0 ? '+' : ''}
                                {variance}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[10rem]">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Add flavor</label>
                  <select
                    value={newFlavor}
                    onChange={(e) => setNewFlavor(e.target.value)}
                    disabled={cycleSaving || flavorsAvailableToAdd.length === 0}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white disabled:bg-gray-50"
                  >
                    <option value="">
                      {flavorsAvailableToAdd.length === 0
                        ? 'All DSIR flavors already listed'
                        : 'Select DSIR flavor…'}
                    </option>
                    {flavorsAvailableToAdd.map((flavor) => (
                      <option key={flavor} value={flavor}>
                        {flavor}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={addFlavorRow}
                  disabled={cycleSaving || !newFlavor}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Add
                </button>
              </div>

              <p className="text-xs text-gray-500">
                {cycleVarianceSummary.changed} flavor(s) with variance · total |Δ|{' '}
                {cycleVarianceSummary.absDelta}
              </p>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                disabled={cycleSaving}
                onClick={() => setShowCycleCount(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={cycleSaving || cycleVarianceSummary.changed === 0}
                onClick={() => void submitCycleCount()}
                className="px-4 py-2 text-sm rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {cycleSaving ? 'Posting…' : 'Post adjustments'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
