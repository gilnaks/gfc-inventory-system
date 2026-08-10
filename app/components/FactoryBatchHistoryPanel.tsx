'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Loader2, Search } from 'lucide-react'
import { getBrandTagClasses } from '../../lib/brand-colors'
import { FactoryBatchDetailModal } from '../factory/FactoryBatchDetailModal'
import {
  fetchBatchesForDateRange,
  type FactoryBatchHistoryItem,
} from '../../lib/factory-batch-history'
import { getPhilippinesDate } from '../../lib/timezone'

type StatusFilter = 'all' | FactoryBatchHistoryItem['status']

function daysAgo(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: FactoryBatchHistoryItem['status'] }) {
  const styles =
    status === 'completed'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'in_progress'
        ? 'bg-indigo-100 text-indigo-800'
        : 'bg-slate-200 text-slate-700'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${styles}`}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

export function FactoryBatchHistoryPanel({ embedded = false }: { embedded?: boolean }) {
  const today = getPhilippinesDate()
  const defaultFrom = daysAgo(today, 30)

  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(today)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [batches, setBatches] = useState<FactoryBatchHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)

  const loadBatches = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchBatchesForDateRange(fromDate, toDate, {
        status: statusFilter === 'all' ? 'all' : statusFilter,
      })
      setBatches(rows)
    } catch (e) {
      console.error(e)
      setBatches([])
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, statusFilter])

  useEffect(() => {
    void loadBatches()
  }, [loadBatches])

  const filteredBatches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return batches
    return batches.filter((b) => {
      const hay = [
        b.product_name,
        b.sku,
        b.batch_number,
        b.brand_name,
        b.started_by,
        b.work_date,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [batches, search])

  const groupedByDate = useMemo(() => {
    const map = new Map<string, FactoryBatchHistoryItem[]>()
    for (const b of filteredBatches) {
      const list = map.get(b.work_date) ?? []
      list.push(b)
      map.set(b.work_date, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [filteredBatches])

  const filterShell = embedded
    ? 'rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-3'
    : 'bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3'

  const listCard = embedded
    ? 'rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:bg-gray-50/50'
    : 'bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-slate-300 hover:bg-slate-50/50'

  return (
    <>
      <div className={embedded ? 'space-y-4' : 'space-y-4'}>
        <div className={filterShell}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full min-h-[40px] px-2 py-1.5 border border-slate-200 rounded-lg text-sm tabular-nums bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  max={today}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full min-h-[40px] px-2 py-1.5 border border-slate-200 rounded-lg text-sm tabular-nums bg-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(7.5rem,9.5rem)] gap-3">
              <div className="min-w-0">
                <label className="block text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-1">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Product, SKU, batch…"
                    className="w-full min-h-[40px] pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="w-full min-h-[40px] px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="all">All</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 tabular-nums">
            {loading
              ? 'Loading…'
              : `${filteredBatches.length} batch${filteredBatches.length === 1 ? '' : 'es'}`}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading batches…</span>
          </div>
        ) : filteredBatches.length === 0 ? (
          <div
            className={
              embedded
                ? 'rounded-lg border border-gray-200 bg-white text-center py-12 px-4'
                : 'bg-white rounded-xl border border-slate-200 shadow-sm text-center py-12 px-4'
            }
          >
            <p className="text-gray-600 text-sm">No batches found for this period.</p>
            <p className="text-gray-400 text-xs mt-1">Try widening the date range or changing filters.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedByDate.map(([date, dateBatches]) => (
              <section key={date}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 tabular-nums px-1">
                  {date}
                </h2>
                <ul className="space-y-2">
                  {dateBatches.map((batch) => (
                    <li key={batch.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedBatchId(batch.id)}
                        className={`w-full text-left ${listCard} active:bg-slate-50 touch-manipulation transition-colors`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-gray-900 truncate">
                                {batch.product_name || '—'}
                              </p>
                              <StatusBadge status={batch.status} />
                            </div>
                            <p className="text-xs text-gray-500 mt-1 font-mono truncate">
                              {batch.batch_number}
                            </p>
                            <dl className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[11px]">
                              <div>
                                <dt className="text-gray-400">Scanned</dt>
                                <dd className="font-medium tabular-nums text-gray-800">
                                  {batch.scanned_count}
                                  {batch.quantity_required > 0 ? ` / ${batch.quantity_required}` : ''}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-gray-400">Units</dt>
                                <dd className="font-medium tabular-nums text-gray-800">{batch.units}</dd>
                              </div>
                              <div>
                                <dt className="text-gray-400">Started</dt>
                                <dd className="font-medium text-gray-800">{formatTime(batch.started_at)}</dd>
                              </div>
                              {batch.completed_at ? (
                                <div>
                                  <dt className="text-gray-400">
                                    {batch.status === 'cancelled' ? 'Cancelled' : 'Completed'}
                                  </dt>
                                  <dd className="font-medium text-gray-800">
                                    {formatTime(batch.completed_at)}
                                  </dd>
                                </div>
                              ) : (
                                <div>
                                  <dt className="text-gray-400">By</dt>
                                  <dd className="font-medium text-gray-800 truncate">
                                    {batch.started_by || '—'}
                                  </dd>
                                </div>
                              )}
                            </dl>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {batch.brand_name ? (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getBrandTagClasses(batch.brand_name)}`}
                              >
                                {batch.brand_name}
                              </span>
                            ) : null}
                            <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {selectedBatchId ? (
        <FactoryBatchDetailModal batchId={selectedBatchId} onClose={() => setSelectedBatchId(null)} />
      ) : null}
    </>
  )
}
