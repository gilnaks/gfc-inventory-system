'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ClipboardCheck,
  Search,
  X,
  Save,
  CheckCircle2,
  Loader2,
  Play,
  History,
} from 'lucide-react'
import { Modal } from './Modal'
import type { Brand, Product, ProductCycleCount, ProductCycleCountLine } from '../../lib/supabase'
import {
  cancelProductCycleCount,
  cycleCountScopeLabel,
  fetchInProgressProductCycleCount,
  fetchProductCycleCountHistory,
  fetchProductCycleCountLines,
  formatProductCycleCountQty,
  lineVarianceAvailable,
  postProductCycleCount,
  saveProductCycleCountLineDrafts,
  startProductCycleCount,
  type ProductCycleCountScope,
} from '../../lib/product-cycle-count'
import { productCategoryDisplayName } from '../../lib/product-category-settings'

interface ProductsCycleCountPanelProps {
  selectedBrand: Brand
  products: Product[]
  categoryScope: ProductCycleCountScope
  scopeTitle: string
  scopeDescription?: string
  groupByCategory?: boolean
  categorySortOrders?: Record<string, number>
  createdBy: string
  onClose: () => void
  onPosted: () => void
}

function categorySortRank(displayName: string, sortIndex: number | undefined): number {
  if (displayName === 'Uncategorized') return 1_000_000_000
  if (sortIndex === 0) return 900_000_000
  if (sortIndex !== undefined && sortIndex > 0) return sortIndex
  return 500_000_000
}

type LineDraft = { countedQty: string; notes: string }

const HISTORY_PAGE_SIZE = 3

function isProductCycleCountSchemaMissing(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    msg.includes('product_cycle_counts') ||
    msg.includes('product_cycle_count_lines') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  )
}

function parseCountQtyInput(raw: string): number | null {
  const s = raw.trim()
  if (!s) return null
  const n = parseFloat(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function productLineName(line: ProductCycleCountLine): string {
  return line.product?.name || line.product?.product_name || 'Product'
}

export function ProductsCycleCountPanel({
  selectedBrand,
  products,
  categoryScope,
  scopeTitle,
  scopeDescription,
  groupByCategory = false,
  categorySortOrders = {},
  createdBy,
  onClose,
  onPosted,
}: ProductsCycleCountPanelProps) {
  const countProducts = useMemo(
    () =>
      products
        .filter((p) => p.id || p.product_id)
        .sort((a, b) =>
          (a.name || a.product_name || '').localeCompare(
            b.name || b.product_name || '',
            undefined,
            { sensitivity: 'base' }
          )
        ),
    [products]
  )

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [posting, setPosting] = useState(false)
  const [view, setView] = useState<'home' | 'count' | 'posted'>('home')
  const [activeCount, setActiveCount] = useState<ProductCycleCount | null>(null)
  const [lines, setLines] = useState<ProductCycleCountLine[]>([])
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({})
  const [history, setHistory] = useState<ProductCycleCount[]>([])
  const [search, setSearch] = useState('')
  const [showUncountedOnly, setShowUncountedOnly] = useState(false)
  const [showVarianceOnly, setShowVarianceOnly] = useState(false)
  const [startNotes, setStartNotes] = useState('')
  const [historyPage, setHistoryPage] = useState(1)

  const draftsFromLines = useCallback((rows: ProductCycleCountLine[]) => {
    const next: Record<string, LineDraft> = {}
    for (const line of rows) {
      const countedQty =
        line.counted_available != null
          ? String(
              Number.isInteger(Number(line.counted_available))
                ? line.counted_available
                : Number(line.counted_available).toFixed(2)
            )
          : ''
      next[line.id] = { countedQty, notes: line.notes?.trim() || '' }
    }
    return next
  }, [])

  const refreshHome = useCallback(async () => {
    const [inProgress, past] = await Promise.all([
      fetchInProgressProductCycleCount(selectedBrand.id, categoryScope),
      fetchProductCycleCountHistory(selectedBrand.id, categoryScope),
    ])
    setActiveCount(inProgress)
    setHistory(past.filter((c) => c.status !== 'in_progress'))
    if (inProgress) {
      const rows = await fetchProductCycleCountLines(inProgress.id)
      setLines(rows)
      setDrafts(draftsFromLines(rows))
      setView('count')
    } else {
      setView('home')
      setLines([])
      setDrafts({})
    }
  }, [selectedBrand.id, categoryScope, draftsFromLines])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await refreshHome()
      } catch (e) {
        if (!cancelled) {
          if (isProductCycleCountSchemaMissing(e)) {
            alert(
              'Product cycle count tables are not set up yet. Run migrations/product-cycle-counts.sql in Supabase first.'
            )
          } else {
            alert(e instanceof Error ? e.message : 'Failed to load cycle counts')
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshHome])

  useEffect(() => {
    setHistoryPage(1)
  }, [selectedBrand.id, history.length])

  const historyTotalPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE))
  const safeHistoryPage = Math.min(historyPage, historyTotalPages)
  const paginatedHistory = useMemo(() => {
    const start = (safeHistoryPage - 1) * HISTORY_PAGE_SIZE
    return history.slice(start, start + HISTORY_PAGE_SIZE)
  }, [history, safeHistoryPage])
  const historyRangeStart =
    history.length === 0 ? 0 : (safeHistoryPage - 1) * HISTORY_PAGE_SIZE + 1
  const historyRangeEnd = Math.min(safeHistoryPage * HISTORY_PAGE_SIZE, history.length)

  const filteredLines = useMemo(() => {
    const q = search.trim().toLowerCase()
    return lines.filter((line) => {
      const p = line.product
      if (!p) return false
      if (showUncountedOnly && drafts[line.id]?.countedQty.trim()) return false
      if (showVarianceOnly) {
        const counted = parseCountQtyInput(drafts[line.id]?.countedQty ?? '')
        if (counted == null) return false
        if (Math.abs(counted - Number(line.system_available)) < 0.0001) return false
      }
      if (!q) return true
      const name = (p.name || p.product_name || '').toLowerCase()
      return (
        name.includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
      )
    })
  }, [lines, drafts, search, showUncountedOnly, showVarianceOnly])

  const linesByCategory = useMemo(() => {
    if (!groupByCategory) {
      return [{ category: null as string | null, lines: filteredLines }]
    }
    const groups = new Map<string, ProductCycleCountLine[]>()
    for (const line of filteredLines) {
      const cat = productCategoryDisplayName(line.product?.category)
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(line)
    }
    return Array.from(groups.entries())
      .sort(
        ([a], [b]) =>
          categorySortRank(a, categorySortOrders[a]) -
          categorySortRank(b, categorySortOrders[b])
      )
      .map(([category, categoryLines]) => ({ category, lines: categoryLines }))
  }, [filteredLines, groupByCategory, categorySortOrders])

  const summary = useMemo(() => {
    let counted = 0
    let withVariance = 0
    for (const line of lines) {
      const countedQty = parseCountQtyInput(drafts[line.id]?.countedQty ?? '')
      if (countedQty == null) continue
      counted++
      if (Math.abs(countedQty - Number(line.system_available)) >= 0.0001) withVariance++
    }
    return { counted, withVariance, total: lines.length }
  }, [lines, drafts])

  const buildUpdatesFromDrafts = () => {
    const updates: { id: string; counted_available: number | null; notes?: string | null }[] = []
    for (const line of lines) {
      const draft = drafts[line.id]
      const counted = parseCountQtyInput(draft?.countedQty ?? '')
      updates.push({
        id: line.id,
        counted_available: counted,
        notes: draft?.notes ?? null,
      })
    }
    return updates
  }

  const handleStart = async () => {
    setSaving(true)
    try {
      const { count, lines: newLines } = await startProductCycleCount({
        brandId: selectedBrand.id,
        products: countProducts,
        categoryScope,
        createdBy,
        notes: startNotes,
      })
      setActiveCount(count)
      setLines(newLines)
      setDrafts(draftsFromLines(newLines))
      setView('count')
      setStartNotes('')
    } catch (e) {
      if (isProductCycleCountSchemaMissing(e)) {
        alert(
          'Product cycle count tables are not set up yet. Run migrations/product-cycle-counts.sql in Supabase first.'
        )
      } else {
        alert(e instanceof Error ? e.message : 'Could not start cycle count')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!activeCount) return
    setSaving(true)
    try {
      await saveProductCycleCountLineDrafts(buildUpdatesFromDrafts())
      const rows = await fetchProductCycleCountLines(activeCount.id)
      setLines(rows)
      setDrafts(draftsFromLines(rows))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePost = async () => {
    if (!activeCount) return
    if (summary.counted === 0) {
      alert('Enter at least one physical count before posting.')
      return
    }
    const uncounted = summary.total - summary.counted
    const msg = [
      `Post cycle count for ${activeCount.count_date}?`,
      `${summary.counted} product(s) counted.`,
      summary.withVariance > 0
        ? `${summary.withVariance} variance adjustment(s) will update initial stock.`
        : 'No quantity variances — available stock stays the same for counted lines.',
      uncounted > 0 ? `${uncounted} uncounted line(s) will be left unchanged.` : null,
    ]
      .filter(Boolean)
      .join('\n')
    if (!confirm(msg)) return

    setPosting(true)
    try {
      await saveProductCycleCountLineDrafts(buildUpdatesFromDrafts())
      const result = await postProductCycleCount({
        cycleCountId: activeCount.id,
        postedBy: createdBy,
      })
      alert(
        `Cycle count posted.\n${result.posted} adjustment(s) recorded.` +
          (result.zeroVariance > 0 ? `\n${result.zeroVariance} counted with no variance.` : '') +
          (result.skipped > 0 ? `\n${result.skipped} line(s) had no count entered.` : '')
      )
      onPosted()
      onClose()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Post failed')
    } finally {
      setPosting(false)
    }
  }

  const handleCancel = async () => {
    if (!activeCount) return
    if (!confirm('Cancel this cycle count? Counted quantities will not adjust inventory.')) return
    setSaving(true)
    try {
      await cancelProductCycleCount(activeCount.id)
      setActiveCount(null)
      setLines([])
      setDrafts({})
      setView('home')
      await refreshHome()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Cancel failed')
    } finally {
      setSaving(false)
    }
  }

  const openPosted = async (count: ProductCycleCount) => {
    setLoading(true)
    try {
      const rows = await fetchProductCycleCountLines(count.id)
      setActiveCount(count)
      setLines(rows)
      setDrafts(draftsFromLines(rows))
      setView('posted')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to load count')
    } finally {
      setLoading(false)
    }
  }

  const readOnly = view === 'posted'

  return (
    <Modal onClose={onClose} align="center">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-white shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-indigo-600" />
              {scopeTitle}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {selectedBrand.name}
              {scopeDescription ? ` · ${scopeDescription}` : ''} — variances adjust initial stock
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading…
          </div>
        ) : view === 'home' ? (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4 h-full">
                <h3 className="text-sm font-semibold text-indigo-950">Start new count</h3>
                <p className="text-xs text-indigo-900/80 mt-1">
                  Snapshots available stock for {countProducts.length} product
                  {countProducts.length === 1 ? '' : 's'}
                  {categoryScope == null
                    ? ' in finished product categories (excludes supplies and components)'
                    : ` in ${cycleCountScopeLabel(categoryScope)}`}
                  . Enter physical counts, then post to apply adjustments to initial stock.
                </p>
                <label className="block text-xs font-medium text-gray-700 mt-3 mb-1">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={startNotes}
                  onChange={(e) => setStartNotes(e.target.value)}
                  placeholder="e.g. Monthly warehouse count"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={saving || countProducts.length === 0}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Play className="h-4 w-4" />
                  {saving ? 'Starting…' : 'Start cycle count'}
                </button>
              </div>

              <section className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col min-h-[12rem]">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 shrink-0">
                  <History className="h-4 w-4 text-gray-500" />
                  Recent counts
                  {history.length > 0 ? (
                    <span className="text-xs font-normal text-gray-500">({history.length})</span>
                  ) : null}
                </h3>
                {history.length === 0 ? (
                  <p className="text-sm text-gray-500 mt-3">No completed cycle counts yet.</p>
                ) : (
                  <>
                    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden mt-3 flex-1">
                      {paginatedHistory.map((row) => (
                        <li
                          key={row.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 hover:bg-gray-50"
                        >
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-gray-900">
                              {row.count_date}
                            </span>
                            <span
                              className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                                row.status === 'posted'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {row.status === 'posted' ? 'Posted' : 'Cancelled'}
                            </span>
                            {row.notes ? (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                {row.notes}
                              </p>
                            ) : null}
                          </div>
                          {row.status === 'posted' ? (
                            <button
                              type="button"
                              onClick={() => openPosted(row)}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 shrink-0"
                            >
                              View
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {historyTotalPages > 1 ? (
                      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600 shrink-0">
                        <span>
                          {historyRangeStart}–{historyRangeEnd} of {history.length}
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={safeHistoryPage <= 1}
                            onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                            className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            disabled={safeHistoryPage >= historyTotalPages}
                            onClick={() =>
                              setHistoryPage((p) => Math.min(historyTotalPages, p + 1))
                            }
                            className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </section>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/80 shrink-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-gray-700">
                  <span className="font-medium text-gray-900">{activeCount?.count_date}</span>
                  {activeCount?.notes ? (
                    <span className="text-gray-500"> — {activeCount.notes}</span>
                  ) : null}
                  {readOnly && activeCount?.posted_by ? (
                    <span className="block text-xs text-gray-500 mt-0.5">
                      Posted by {activeCount.posted_by}
                    </span>
                  ) : null}
                </div>
                {!readOnly ? (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-gray-200 px-2.5 py-1 text-gray-700">
                      {summary.counted}/{summary.total} counted
                    </span>
                    {summary.withVariance > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">
                        {summary.withVariance} variance
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search products…"
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {!readOnly ? (
                  <>
                    <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={showUncountedOnly}
                        onChange={(e) => setShowUncountedOnly(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      Uncounted only
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={showVarianceOnly}
                        onChange={(e) => setShowVarianceOnly(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      Variance only
                    </label>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex-1 overflow-auto min-h-0">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                  <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    <th className="px-4 py-2.5">Product</th>
                    <th className="px-3 py-2.5 text-right">System</th>
                    <th className="px-3 py-2.5 text-right w-36">Physical count</th>
                    <th className="px-3 py-2.5 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {linesByCategory.map(({ category, lines: categoryLines }) => (
                    <Fragment key={category ?? '_all'}>
                      {groupByCategory && category ? (
                        <tr className="bg-slate-100/90">
                          <td
                            colSpan={4}
                            className="px-4 py-2 text-xs font-semibold text-slate-700 uppercase tracking-wide"
                          >
                            {category}
                            <span className="ml-2 font-normal text-slate-500 normal-case">
                              ({categoryLines.length}{' '}
                              {categoryLines.length === 1 ? 'product' : 'products'})
                            </span>
                          </td>
                        </tr>
                      ) : null}
                      {categoryLines.map((line) => {
                        const p = line.product
                        if (!p) return null
                        const unit = p.unit || 'pcs'
                        const systemFmt = formatProductCycleCountQty(
                          Number(line.system_available),
                          unit
                        )
                        const draft = drafts[line.id] || { countedQty: '', notes: '' }
                        const countedQty = parseCountQtyInput(draft.countedQty)
                        const variance =
                          countedQty != null
                            ? countedQty - Number(line.system_available)
                            : lineVarianceAvailable(line)
                        const hasVariance =
                          variance != null && Math.abs(variance) >= 0.0001

                        return (
                          <tr
                            key={line.id}
                            className={hasVariance ? 'bg-amber-50/50' : 'bg-white'}
                          >
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-gray-900">
                                {productLineName(line)}
                              </div>
                              {p.sku ? (
                                <div className="text-xs text-gray-400">{p.sku}</div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">
                              {systemFmt}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {readOnly ? (
                                <div className="tabular-nums text-gray-900">
                                  {line.counted_available != null
                                    ? formatProductCycleCountQty(
                                        Number(line.counted_available),
                                        unit
                                      )
                                    : '—'}
                                </div>
                              ) : (
                                <div className="flex justify-end">
                                  <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={draft.countedQty}
                                    onChange={(e) =>
                                      setDrafts((prev) => ({
                                        ...prev,
                                        [line.id]: {
                                          ...draft,
                                          countedQty: e.target.value,
                                        },
                                      }))
                                    }
                                    placeholder={unit}
                                    className="w-24 px-2 py-1 text-right text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                                  />
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {variance == null ? (
                                <span className="text-gray-400">—</span>
                              ) : hasVariance ? (
                                <span
                                  className={
                                    variance > 0
                                      ? 'text-emerald-700 font-medium'
                                      : 'text-red-700 font-medium'
                                  }
                                >
                                  {variance > 0 ? '+' : ''}
                                  {formatProductCycleCountQty(variance, unit)}
                                </span>
                              ) : (
                                <span className="text-gray-500">0</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              {filteredLines.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-8">No products match filters.</p>
              ) : null}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex flex-wrap justify-between gap-2 shrink-0">
              {readOnly ? (
                <button
                  type="button"
                  onClick={() => {
                    setView('home')
                    setActiveCount(null)
                    refreshHome()
                  }}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-white"
                >
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving || posting}
                  className="px-4 py-2 text-sm text-red-700 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  Cancel count
                </button>
              )}
              <div className="flex flex-wrap gap-2 ml-auto">
                {readOnly ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-white bg-gray-600 rounded-lg hover:bg-gray-700"
                  >
                    Close
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={saving || posting}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-800 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? 'Saving…' : 'Save progress'}
                    </button>
                    <button
                      type="button"
                      onClick={handlePost}
                      disabled={saving || posting}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {posting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {posting ? 'Posting…' : 'Post adjustments'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
