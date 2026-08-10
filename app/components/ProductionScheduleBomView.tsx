'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, ChevronDown, ChevronRight, Layers, Search } from 'lucide-react'
import { getPhilippinesDate } from '../../lib/timezone'
import { loadGfcScheduleForBrand, type FactoryScheduleItem } from '../../lib/factory-schedule'
import { isFactoryScheduleAggregateView } from '../../lib/gfc-production-catalog'
import {
  computeLinesForScheduleItem,
  computeRunningBomTotals,
  computeSkuMaterialCostSummary,
  fetchBomLinesByProductId,
  fetchFactoryRequestQtysByMaterial,
  formatBomCost,
  formatBomQtyWithUnit,
  resolveBomProductionUnits,
  type ComputedBomLine,
  type ProductBomLine,
} from '../../lib/production-schedule-bom'
import { findBomStockShortages } from '../../lib/factory-bom-requirements'
import {
  DestinationBrandSelect,
  type DestinationBrandOption,
} from './DestinationBrandSelect'

interface ProductionScheduleBomViewProps {
  /** GFC factory brand id. */
  brandId: string
  /** Destination consumer brand. */
  forBrandId: string
  brandName?: string
  destinationBrands?: DestinationBrandOption[]
  onForBrandChange?: (brandId: string) => void
  theme?: string
  scheduleDate: string
  onScheduleDateChange: (date: string) => void
}

function SkuMaterialCostSummary({
  batchCost,
  costPerUnit,
  actualYieldUnits,
}: {
  batchCost: number
  costPerUnit: number | null
  actualYieldUnits: number
}) {
  if (batchCost <= 0) return null

  return (
    <div className="flex flex-wrap gap-3 sm:gap-6 mb-3 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5 text-sm">
      <div>
        <p className="text-[10px] font-semibold uppercase text-slate-600">Material cost / batch</p>
        <p className="tabular-nums font-semibold text-slate-900">{formatBomCost(batchCost)}</p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase text-slate-600">Material cost / unit</p>
        <p className="tabular-nums font-semibold text-slate-900">
          {costPerUnit != null ? formatBomCost(costPerUnit) : '—'}
        </p>
        {actualYieldUnits > 0 ? (
          <p className="text-[10px] text-slate-500 tabular-nums">
            ÷ {actualYieldUnits} scanned
          </p>
        ) : null}
      </div>
    </div>
  )
}

function DetailedBomTable({
  lines,
  showPerUnit = false,
  showScheduledQty = false,
  showMaterialCostPerUnit = false,
  skuBreakdown = false,
  skuCostSummary,
}: {
  lines: ComputedBomLine[]
  showPerUnit?: boolean
  showScheduledQty?: boolean
  /** Per-SKU table: material cost for one finished unit per BOM line */
  showMaterialCostPerUnit?: boolean
  /** Breakdown by SKU column labels (Per unit req, Batch req, Actual used). */
  skuBreakdown?: boolean
  skuCostSummary?: { batch_cost: number; cost_per_unit: number | null; actual_yield_units: number }
}) {
  const perUnitHeader = skuBreakdown ? 'Per unit req' : 'Per prod unit'
  const scheduledHeader = skuBreakdown ? 'Batch req' : 'Prod req'
  const scheduledTitle = skuBreakdown
    ? 'Batch requirement (scheduled batch qty)'
    : 'Production requirement (scheduled batch qty)'
  const actualHeader = 'Actual used'
  const actualTitle = 'Materials used for scanned output'
  if (lines.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-2">
        No factory-linked materials on this product BOM.
      </p>
    )
  }

  const tableTotalCost = lines.reduce((s, l) => s + (l.total_cost || 0), 0)

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
              <th className="py-2 pr-3">Material</th>
              {showPerUnit ? (
                <th className="py-2 pr-3 text-right whitespace-nowrap">{perUnitHeader}</th>
              ) : null}
              {showScheduledQty ? (
                <th
                  className="py-2 pr-3 text-right whitespace-nowrap"
                  title={scheduledTitle}
                >
                  {scheduledHeader}
                </th>
              ) : null}
              <th
                className="py-2 pr-3 text-right whitespace-nowrap"
                title={actualTitle}
              >
                {actualHeader}
              </th>
              <th className="py-2 pr-3 text-right whitespace-nowrap">On floor</th>
              <th className="py-2 pr-3 text-right whitespace-nowrap">Released</th>
              <th className="py-2 pr-3 text-right whitespace-nowrap">Pending</th>
              {showMaterialCostPerUnit ? (
                <th
                  className="py-2 pr-3 text-right whitespace-nowrap"
                  title="Material cost for one scanned production unit"
                >
                  Cost / unit
                </th>
              ) : null}
              <th className="py-2 pr-3 text-right whitespace-nowrap">
                {showMaterialCostPerUnit ? 'Batch cost' : 'Cost'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((line) => {
              const stock = Number(line.current_stock) || 0
              const stockShort = line.total_qty > 0 && (stock <= 0 || stock < line.total_qty)
              const released = line.released_qty ?? 0
              const pending = line.pending_qty ?? 0
              const fullyReleased = released >= line.total_qty && line.total_qty > 0

              return (
                <tr
                  key={line.material_id}
                  className={
                    stockShort
                      ? 'bg-red-50/80'
                      : fullyReleased
                        ? 'bg-emerald-50/60'
                        : 'bg-white'
                  }
                >
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-gray-900">{line.material_name}</div>
                    {line.sku ? <div className="text-xs text-gray-400 font-mono">{line.sku}</div> : null}
                  </td>
                  {showPerUnit ? (
                    <td className="py-2.5 pr-3 text-right tabular-nums text-gray-700 whitespace-nowrap">
                      {formatBomQtyWithUnit(line.qty_per_unit, line.unit)}
                    </td>
                  ) : null}
                  {showScheduledQty ? (
                    <td className="py-2.5 pr-3 text-right tabular-nums text-gray-500 whitespace-nowrap">
                      {formatBomQtyWithUnit(line.scheduled_total_qty, line.unit)}
                    </td>
                  ) : null}
                  <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap">
                    {line.actual_yield_units > 0
                      ? formatBomQtyWithUnit(line.total_qty, line.unit)
                      : '—'}
                  </td>
                  <td
                    className={`py-2.5 pr-3 text-right tabular-nums whitespace-nowrap ${
                      stockShort ? 'text-red-700 font-medium' : 'text-gray-700'
                    }`}
                  >
                    {formatBomQtyWithUnit(stock, line.unit)}
                  </td>
                  <td
                    className={`py-2.5 pr-3 text-right tabular-nums whitespace-nowrap ${
                      released > 0 ? 'text-emerald-700 font-medium' : 'text-gray-400'
                    }`}
                  >
                    {released > 0 ? formatBomQtyWithUnit(released, line.unit) : '—'}
                  </td>
                  <td
                    className={`py-2.5 pr-3 text-right tabular-nums whitespace-nowrap ${
                      pending > 0 ? 'text-amber-700 font-medium' : 'text-gray-400'
                    }`}
                  >
                    {pending > 0 ? formatBomQtyWithUnit(pending, line.unit) : '—'}
                  </td>
                  {showMaterialCostPerUnit ? (
                    <td className="py-2.5 pr-3 text-right tabular-nums text-gray-700 whitespace-nowrap">
                      {line.actual_yield_units > 0
                        ? formatBomCost(line.cost_per_product_unit)
                        : '—'}
                    </td>
                  ) : null}
                  <td className="py-2.5 pr-3 text-right tabular-nums text-gray-900 whitespace-nowrap">
                    {formatBomCost(line.total_cost)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {tableTotalCost > 0 ? (
            <tfoot>
              {skuCostSummary ? (
                <>
                  <tr className="border-t border-gray-200 bg-slate-50/80">
                    <td
                      colSpan={
                        1 +
                        (showPerUnit ? 1 : 0) +
                        (showScheduledQty ? 1 : 0) +
                        4 +
                        (showMaterialCostPerUnit ? 1 : 0)
                      }
                      className="py-2.5 pr-3 text-right text-xs font-semibold text-gray-600 uppercase"
                    >
                      Material cost / batch
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-gray-900">
                      {formatBomCost(skuCostSummary.batch_cost)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td
                      colSpan={
                        1 +
                        (showPerUnit ? 1 : 0) +
                        (showScheduledQty ? 1 : 0) +
                        4 +
                        (showMaterialCostPerUnit ? 1 : 0)
                      }
                      className="py-2 pr-3 text-right text-xs font-semibold text-gray-600 uppercase"
                    >
                      Material cost / unit
                      {skuCostSummary.actual_yield_units > 0 ? (
                        <span className="font-normal normal-case text-gray-500 ml-1">
                          ({skuCostSummary.actual_yield_units} scanned)
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums font-semibold text-indigo-900">
                      {skuCostSummary.cost_per_unit != null
                        ? formatBomCost(skuCostSummary.cost_per_unit)
                        : '—'}
                    </td>
                  </tr>
                </>
              ) : (
                <tr className="border-t border-gray-200 bg-slate-50/80">
                  <td
                    colSpan={
                      1 +
                      (showPerUnit ? 1 : 0) +
                      (showScheduledQty ? 1 : 0) +
                      4 +
                      (showMaterialCostPerUnit ? 1 : 0)
                    }
                    className="py-2.5 pr-3 text-right text-xs font-semibold text-gray-600 uppercase"
                  >
                    Total production material cost
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-gray-900">
                    {formatBomCost(tableTotalCost)}
                  </td>
                </tr>
              )}
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  )
}

export function ProductionScheduleBomView({
  brandId,
  forBrandId,
  brandName,
  destinationBrands,
  onForBrandChange,
  theme = 'blue',
  scheduleDate,
  onScheduleDateChange,
}: ProductionScheduleBomViewProps) {
  const today = getPhilippinesDate()
  const [scheduleItems, setScheduleItems] = useState<FactoryScheduleItem[]>([])
  const [bomByProductId, setBomByProductId] = useState<Record<string, ProductBomLine[]>>({})
  const [releasedQtyByMaterial, setReleasedQtyByMaterial] = useState<Record<string, number>>({})
  const [pendingQtyByMaterial, setPendingQtyByMaterial] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [materialSearch, setMaterialSearch] = useState('')
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({})

  const loadSavedScheduleBom = useCallback(async () => {
    if (!forBrandId || !scheduleDate) return
    setLoading(true)
    try {
      const items = await loadGfcScheduleForBrand(forBrandId, scheduleDate, brandId)
      setScheduleItems(items)

      const productIds = items.map((i) => i.product_id)
      const [bomMap, requestQtys] = await Promise.all([
        fetchBomLinesByProductId(productIds, { factoryFloorOnly: true }),
        fetchFactoryRequestQtysByMaterial(scheduleDate),
      ])
      setBomByProductId(bomMap)
      setReleasedQtyByMaterial(requestQtys.released)
      setPendingQtyByMaterial(requestQtys.pending)

      const initialExpanded: Record<string, boolean> = {}
      for (const item of items) {
        initialExpanded[item.product_id] = true
      }
      setExpandedProducts(initialExpanded)
    } finally {
      setLoading(false)
    }
  }, [forBrandId, scheduleDate])

  useEffect(() => {
    loadSavedScheduleBom()
  }, [loadSavedScheduleBom])

  const runningBom = useMemo(
    () =>
      computeRunningBomTotals(
        scheduleItems,
        bomByProductId,
        releasedQtyByMaterial,
        pendingQtyByMaterial
      ),
    [scheduleItems, bomByProductId, releasedQtyByMaterial, pendingQtyByMaterial]
  )

  const filteredRunningBom = useMemo(() => {
    const q = materialSearch.trim().toLowerCase()
    if (!q) return runningBom
    return runningBom.filter(
      (line) =>
        line.material_name.toLowerCase().includes(q) ||
        (line.sku || '').toLowerCase().includes(q)
    )
  }, [runningBom, materialSearch])

  const perSkuBom = useMemo(
    () =>
      scheduleItems.map((item) => ({
        item,
        lines: computeLinesForScheduleItem(
          item,
          bomByProductId,
          releasedQtyByMaterial,
          pendingQtyByMaterial
        ),
      })),
    [scheduleItems, bomByProductId, releasedQtyByMaterial, pendingQtyByMaterial]
  )

  const bomStockShortages = useMemo(() => findBomStockShortages(runningBom), [runningBom])

  const stats = useMemo(() => {
    const materialCount = runningBom.length
    const scheduledUnits = scheduleItems.reduce((s, i) => s + i.quantity_required, 0)
    const actualYieldUnits = scheduleItems.reduce((s, i) => s + (i.produced ?? 0), 0)
    const totalMaterialCost = runningBom.reduce((s, l) => s + (l.total_cost || 0), 0)
    const pendingMaterials = runningBom.filter((l) => (l.pending_qty ?? 0) > 0).length
    const releasedMaterials = runningBom.filter(
      (l) => (l.released_qty ?? 0) >= l.total_qty && l.total_qty > 0
    ).length
    return {
      skus: scheduleItems.length,
      scheduledUnits,
      actualYieldUnits,
      materialCount,
      totalMaterialCost,
      shortages: bomStockShortages.length,
      pendingMaterials,
      releasedMaterials,
    }
  }, [scheduleItems, runningBom, bomStockShortages])

  const toggleProduct = (productId: string) => {
    setExpandedProducts((prev) => ({ ...prev, [productId]: !prev[productId] }))
  }

  const themeAccent =
    theme === 'green'
      ? 'text-green-600 border-green-500'
      : theme === 'red'
        ? 'text-red-600 border-red-500'
        : theme === 'yellow'
          ? 'text-yellow-600 border-yellow-500'
          : 'text-blue-600 border-blue-500'

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center gap-3 min-w-0 pb-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Layers className="h-5 w-5 text-slate-600" />
          Bill of Materials
        </h2>
        <input
          type="date"
          value={scheduleDate}
          onChange={(e) => onScheduleDateChange(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 shrink-0"
        />
        {destinationBrands && destinationBrands.length > 0 && onForBrandChange ? (
          <DestinationBrandSelect
            brands={destinationBrands}
            value={forBrandId}
            onChange={onForBrandChange}
          />
        ) : brandName ? (
          <span className="text-sm text-gray-500 shrink-0">{brandName}</span>
        ) : null}
      </div>

      {scheduleDate < today ? (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Viewing a past schedule — material requirements reflect what was saved for this date.
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                <div className="h-2.5 bg-gray-200 rounded w-20 mb-2" />
                <div className="h-7 bg-gray-200 rounded w-12" />
              </div>
            ))}
          </div>
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="h-4 bg-gray-200 rounded w-40 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-56" />
            </div>
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex gap-4 items-center border-b border-gray-50 pb-3 last:border-0">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-gray-200 rounded w-40" />
                    <div className="h-2.5 bg-gray-100 rounded w-24" />
                  </div>
                  <div className="h-3 bg-gray-200 rounded w-10" />
                  <div className="h-3 bg-gray-200 rounded w-10" />
                  <div className="h-3 bg-emerald-100 rounded w-10" />
                  <div className="h-3 bg-amber-100 rounded w-10" />
                  <div className="h-3 bg-gray-100 rounded w-8" />
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden p-4 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-32" />
            {[1, 2].map((i) => (
              <div key={i} className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 space-y-2">
                <div className="h-3.5 bg-gray-200 rounded w-2/3" />
                <div className="h-8 bg-gray-100 rounded w-full" />
              </div>
            ))}
          </section>
        </div>
      ) : scheduleItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 py-14 px-6 text-center">
          <p className="text-gray-700 font-medium">No saved schedule for this date</p>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Add products and save the production schedule, then return here for the full materials
            breakdown.
          </p>
        </div>
      ) : runningBom.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 py-10 px-6 text-center">
          <p className="text-amber-950 font-medium">No factory floor materials in this schedule</p>
          <p className="text-sm text-amber-900/90 mt-1 max-w-lg mx-auto">
            Product BOMs for this date have no materials with Link to Factory set (Ingredients,
            Packaging, or Supplies) in Procurement.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
              <p className="text-[10px] font-medium text-gray-500 uppercase">SKUs scheduled</p>
              <p className="text-xl font-semibold text-gray-900 tabular-nums">{stats.skus}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
              <p className="text-[10px] font-medium text-gray-500 uppercase">Scheduled units</p>
              <p className="text-xl font-semibold text-gray-900 tabular-nums">{stats.scheduledUnits}</p>
            </div>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 px-3 py-2.5">
              <p className="text-[10px] font-medium text-indigo-800 uppercase">Actual output (scanned)</p>
              <p className="text-xl font-semibold text-indigo-950 tabular-nums">
                {stats.actualYieldUnits}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
              <p className="text-[10px] font-medium text-gray-500 uppercase">Unique materials</p>
              <p className="text-xl font-semibold text-gray-900 tabular-nums">{stats.materialCount}</p>
            </div>
            <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-medium text-slate-700 uppercase">Material cost</p>
              <p className="text-xl font-semibold text-slate-900 tabular-nums">
                {formatBomCost(stats.totalMaterialCost)}
              </p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50/80 px-3 py-2.5">
              <p className="text-[10px] font-medium text-red-800 uppercase">Stock shortages</p>
              <p className="text-xl font-semibold text-red-900 tabular-nums">{stats.shortages}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5">
              <p className="text-[10px] font-medium text-amber-900 uppercase">Pending release</p>
              <p className="text-xl font-semibold text-amber-950 tabular-nums">
                {stats.pendingMaterials}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5">
              <p className="text-[10px] font-medium text-emerald-900 uppercase">Fully released</p>
              <p className="text-xl font-semibold text-emerald-950 tabular-nums">
                {stats.releasedMaterials}
              </p>
            </div>
          </div>

          <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Running total (all SKUs)</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Actual used = scanned output · Prod req = production requirement (scheduled batch) ·
                  Cost uses scanned yield
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="search"
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                  placeholder="Filter materials…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                />
              </div>
            </div>
            <div className="p-4">
              <DetailedBomTable lines={filteredRunningBom} showScheduledQty />
              {bomStockShortages.length > 0 ? (
                <p className="text-sm text-red-700 mt-3 leading-snug">
                  {bomStockShortages.length} material
                  {bomStockShortages.length === 1 ? '' : 's'} below on-floor stock for this schedule.
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900">Breakdown by SKU</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Each SKU shows its own batch and per-unit material cost (shared materials are
                totaled separately in Running total above)
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {perSkuBom.map(({ item, lines }) => {
                const expanded = expandedProducts[item.product_id] !== false
                const lineCount = lines.length
                const { scheduled_units, actual_yield_units } = resolveBomProductionUnits(item)
                const skuCost = computeSkuMaterialCostSummary(lines, actual_yield_units)

                return (
                  <div key={item.schedule_id} className="bg-white">
                    <button
                      type="button"
                      onClick={() => toggleProduct(item.product_id)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50/80 transition-colors"
                    >
                      {expanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="font-semibold text-gray-900">{item.product_name}</span>
                          {item.sku ? (
                            <span className="text-xs font-mono text-gray-500">{item.sku}</span>
                          ) : null}
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${themeAccent} bg-white`}
                          >
                            {actual_yield_units > 0
                              ? `${actual_yield_units} scanned`
                              : `${scheduled_units} scheduled`}
                          </span>
                          {actual_yield_units > 0 && actual_yield_units !== scheduled_units ? (
                            <span className="text-xs text-indigo-700 tabular-nums">
                              (batch req {scheduled_units})
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-500">
                          <span>
                            Batch:{' '}
                            <span className="font-mono text-gray-700">{item.batch_number}</span>
                          </span>
                          <span>
                            {lineCount} BOM line{lineCount === 1 ? '' : 's'}
                          </span>
                          {skuCost.batch_cost > 0 ? (
                            <>
                              <span className="tabular-nums font-medium text-gray-700">
                                {formatBomCost(skuCost.batch_cost)} / batch
                              </span>
                              {skuCost.cost_per_unit != null ? (
                                <span className="tabular-nums font-medium text-indigo-800">
                                  {formatBomCost(skuCost.cost_per_unit)} / unit
                                </span>
                              ) : null}
                            </>
                          ) : actual_yield_units === 0 ? (
                            <span className="text-amber-700">Scan stickers for costing</span>
                          ) : null}
                          {item.notes ? (
                            <span className="text-gray-400 truncate max-w-xs" title={item.notes}>
                              Note: {item.notes}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                    {expanded ? (
                      <div className="px-4 pb-4 pl-12 border-t border-gray-50 bg-gray-50/40">
                        <SkuMaterialCostSummary
                          batchCost={skuCost.batch_cost}
                          costPerUnit={skuCost.cost_per_unit}
                          actualYieldUnits={actual_yield_units}
                        />
                        <DetailedBomTable
                          lines={lines}
                          showPerUnit
                          showScheduledQty
                          showMaterialCostPerUnit
                          skuBreakdown
                          skuCostSummary={{
                            batch_cost: skuCost.batch_cost,
                            cost_per_unit: skuCost.cost_per_unit,
                            actual_yield_units: actual_yield_units,
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}

      <p className="text-xs text-gray-500 flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5" />
        Schedule date {scheduleDate}
        {brandName ? ` · ${brandName}` : ''}
      </p>
    </div>
  )
}
