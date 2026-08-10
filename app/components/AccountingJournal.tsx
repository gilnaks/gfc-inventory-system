'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Download, Search } from 'lucide-react'
import type { Brand } from '../../lib/supabase'
import type { AccountingJournalEntry } from '../../lib/supabase'
import { loadJournalEntries } from '../../lib/accounting-journal-service'
import { batchPrefetchJournalEntryDescriptions, isSourceTypeTrackable } from '../../lib/journal-source-resolver'
import { periodRangeFromFilter } from '../../lib/accounting-reports'
import { downloadCsv } from '../../lib/csv-export'
import {
  getPhilippinesBillingPeriodLabel,
  getPhilippinesDate,
  type BillingTimeFilter,
} from '../../lib/timezone'
import { AccountingJournalListSkeleton } from './AccountingBooksSkeletons'
import { formatGlPhp } from './AccountingLedgerTable'
import {
  JournalLineMemoLink,
  JournalMemoLinks,
  JournalSupportingDocs,
} from './JournalMemoLinks'
import {
  JournalSourceModalHost,
  type JournalDocOpenRequest,
} from './JournalSourceModalHost'
import { useBrands } from '../contexts/BrandsContext'
import {
  getFranchiseJournalTag,
  getFranchiseJournalTagClasses,
  getFranchiseJournalTagTitle,
  type FranchiseJournalTag,
} from '../../lib/brand-colors'

interface Props {
  selectedBrand: Brand | null
  timeFilter: BillingTimeFilter
  currentUsername?: string
  themeBtn?: string
  refreshToken?: number
  onOpenJournalEntry?: (entryId: string) => void
  franchiseBrandId?: string | null
  hqOnly?: boolean
}

function formatSourceType(source: string): string {
  return source.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function FranchiseJournalTagBadge({ tag }: { tag: FranchiseJournalTag | null }) {
  if (!tag) return null
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${getFranchiseJournalTagClasses(tag)}`}
      title={getFranchiseJournalTagTitle(tag)}
    >
      {tag}
    </span>
  )
}

/** Border/bg/text classes for journal source-type tags. */
export function journalSourceTagClass(source: string): string {
  switch (source) {
    case 'manual':
      return 'bg-slate-100 text-slate-800 border-slate-200'
    case 'payment_voucher':
      return 'bg-blue-50 text-blue-800 border-blue-200'
    case 'petty_cash_voucher':
      return 'bg-amber-50 text-amber-900 border-amber-200'
    case 'customer_order_revenue':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200'
    case 'customer_order_cash':
      return 'bg-green-50 text-green-800 border-green-200'
    case 'customer_order_cogs':
      return 'bg-teal-50 text-teal-800 border-teal-200'
    case 'delivery_receipt':
      return 'bg-sky-50 text-sky-800 border-sky-200'
    case 'material_movement':
    case 'material_transfer':
      return 'bg-violet-50 text-violet-800 border-violet-200'
    case 'fixed_asset_movement':
      return 'bg-indigo-50 text-indigo-800 border-indigo-200'
    case 'material_cycle_count':
    case 'product_cycle_count':
    case 'product_stock_adjustment':
      return 'bg-rose-50 text-rose-800 border-rose-200'
    case 'product_opening_stock':
    case 'opening_balance':
      return 'bg-cyan-50 text-cyan-900 border-cyan-200'
    case 'reversal':
      return 'bg-red-50 text-red-800 border-red-200'
    case 'year_end_close':
      return 'bg-gray-800 text-white border-gray-700'
    case 'payroll_run_accrual':
    case 'payroll_run_payment':
      return 'bg-purple-50 text-purple-800 border-purple-200'
    case 'staff_advance_disbursement':
      return 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200'
    case 'intercompany_transfer':
    case 'intercompany_transfer_settlement':
      return 'bg-pink-50 text-pink-800 border-pink-200'
    case 'production_batch':
    case 'factory_material_release':
    case 'factory_wip_adjustment':
      return 'bg-orange-50 text-orange-900 border-orange-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

function isFutureJournalEntryDate(entryDate: string, today: string): boolean {
  return entryDate > today
}

function entryLineTotals(entry: AccountingJournalEntry) {
  const debit = (entry.lines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const credit = (entry.lines || []).reduce((s, l) => s + (Number(l.credit) || 0), 0)
  return { debit, credit }
}

/** Expand siblings that share a source document, plus any linked reversals. */
function relatedJournalEntryIds(
  entry: AccountingJournalEntry,
  all: AccountingJournalEntry[]
): Set<string> {
  const ids = new Set<string>([entry.id])

  const addSameSource = (sourceId: string) => {
    for (const other of all) {
      if (
        other.source_id === sourceId &&
        other.source_type !== 'reversal'
      ) {
        ids.add(other.id)
      }
    }
  }

  if (entry.source_type === 'reversal' && entry.source_id) {
    ids.add(entry.source_id)
    const original = all.find((e) => e.id === entry.source_id)
    if (original?.source_id) addSameSource(original.source_id)
  } else if (entry.source_id) {
    addSameSource(entry.source_id)
  }

  for (const other of all) {
    if (other.source_type === 'reversal' && other.source_id && ids.has(other.source_id)) {
      ids.add(other.id)
    }
  }

  return ids
}

export function AccountingJournal({
  selectedBrand,
  timeFilter,
  themeBtn,
  refreshToken = 0,
  onOpenJournalEntry,
  franchiseBrandId,
  hqOnly,
}: Props) {
  const { brands } = useBrands()
  const brandById = useMemo(() => {
    const map = new Map<string, Brand>()
    for (const b of brands) map.set(b.id, b)
    return map
  }, [brands])

  const tagForEntry = useCallback(
    (entry: AccountingJournalEntry): FranchiseJournalTag | null => {
      if (entry.franchise_brand_id) {
        return getFranchiseJournalTag(brandById.get(entry.franchise_brand_id))
      }
      return 'HQ'
    },
    [brandById]
  )

  const brandId = selectedBrand?.id || ''
  const [entries, setEntries] = useState<AccountingJournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState('')
  const [search, setSearch] = useState('')
  const [openDoc, setOpenDoc] = useState<JournalDocOpenRequest | null>(null)

  const handleOpenDocument = useCallback((req: JournalDocOpenRequest) => {
    if (req.kind === 'journal_entry' && onOpenJournalEntry) {
      onOpenJournalEntry(req.id)
      return
    }
    setOpenDoc(req)
  }, [onOpenJournalEntry])

  const periodLabel = useMemo(() => getPhilippinesBillingPeriodLabel(timeFilter), [timeFilter])

  const refresh = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    try {
      const { fromDate, toDate } = periodRangeFromFilter(timeFilter)
      const data = await loadJournalEntries(brandId, {
        fromDate,
        toDate,
        status: 'posted',
        franchiseBrandId: franchiseBrandId || undefined,
        hqOnly: hqOnly || undefined,
      })
      setEntries(data)
    } finally {
      setLoading(false)
    }
  }, [brandId, timeFilter, refreshToken, franchiseBrandId, hqOnly])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const requests = entries
      .filter((e) => e.source_id && isSourceTypeTrackable(e.source_type, e.source_id))
      .map((e) => ({ sourceType: e.source_type, sourceId: e.source_id as string }))
    if (requests.length) void batchPrefetchJournalEntryDescriptions(requests)
  }, [entries])

  const sourceOptions = useMemo(() => {
    const types = new Set(entries.map((e) => e.source_type))
    return Array.from(types).sort()
  }, [entries])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter((e) => {
      if (sourceFilter && e.source_type !== sourceFilter) return false
      if (!q) return true
      const tag = tagForEntry(e)
      return (
        e.entry_number.toLowerCase().includes(q) ||
        (e.memo || '').toLowerCase().includes(q) ||
        e.source_type.toLowerCase().includes(q) ||
        (tag || '').toLowerCase().includes(q) ||
        (tag ? getFranchiseJournalTagTitle(tag).toLowerCase().includes(q) : false)
      )
    })
  }, [entries, sourceFilter, search, tagForEntry])

  const { currentEntries, futureEntries } = useMemo(() => {
    const today = getPhilippinesDate()
    const current: AccountingJournalEntry[] = []
    const future: AccountingJournalEntry[] = []
    for (const entry of filtered) {
      if (isFutureJournalEntryDate(entry.entry_date, today)) future.push(entry)
      else current.push(entry)
    }
    return { currentEntries: current, futureEntries: future }
  }, [filtered])

  const todayPh = getPhilippinesDate()
  const allExpanded = expandedId === '__all__'
  const anyExpanded = expandedId !== null

  const expandedRelatedIds = useMemo(() => {
    if (!expandedId || expandedId === '__all__') return null
    const entry = entries.find((e) => e.id === expandedId)
    if (!entry) return new Set([expandedId])
    return relatedJournalEntryIds(entry, entries)
  }, [expandedId, entries])

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => {
      if (prev === '__all__') return id
      if (prev === null) return id
      const focus = entries.find((e) => e.id === prev)
      const related = focus ? relatedJournalEntryIds(focus, entries) : new Set([prev])
      if (related.has(id)) return null
      return id
    })
  }

  const toggleExpandAll = () => {
    if (anyExpanded) setExpandedId(null)
    else setExpandedId('__all__')
  }

  const isExpanded = (id: string) =>
    allExpanded || (expandedRelatedIds != null && expandedRelatedIds.has(id))

  const exportCsv = () => {
    const rows: string[][] = []
    for (const e of filtered) {
      const tag = tagForEntry(e)
      for (const l of e.lines || []) {
        rows.push([
          e.entry_number,
          tag || '',
          e.entry_date,
          e.source_type,
          e.memo || '',
          l.account?.code || '',
          l.account?.name || '',
          String(l.debit),
          String(l.credit),
        ])
      }
    }
    downloadCsv(
      'journal.csv',
      ['JE#', 'Franchise', 'Date', 'Source', 'Description', 'Code', 'Account', 'Debit', 'Credit'],
      rows
    )
  }

  const renderEntryRows = (list: AccountingJournalEntry[], markFutureDates = false) =>
    list.map((e) => {
      const expanded = isExpanded(e.id)
      const futureDate = markFutureDates || isFutureJournalEntryDate(e.entry_date, todayPh)
      const totals = entryLineTotals(e)
      const lineMemos = (e.lines || []).map((l) => l.memo)
      const franchiseTag = tagForEntry(e)
      return (
        <Fragment key={e.id}>
          <tr
            className={`hover:bg-gray-50/80 cursor-pointer ${futureDate ? 'bg-amber-50/50' : ''}`}
            onClick={() => toggleExpand(e.id)}
          >
            <td className="px-2 py-3 text-gray-400 align-middle">
              {expanded ? (
                <ChevronDown className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden />
              )}
            </td>
            <td className="px-4 py-3 font-mono text-xs whitespace-nowrap align-middle">
              <div className="inline-flex items-center gap-1.5">
                <FranchiseJournalTagBadge tag={franchiseTag} />
                {onOpenJournalEntry ? (
                  <button
                    type="button"
                    className="text-blue-600 hover:underline font-medium"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onOpenJournalEntry(e.id)
                    }}
                  >
                    {e.entry_number}
                  </button>
                ) : (
                  <span className="font-medium text-gray-900">{e.entry_number}</span>
                )}
              </div>
            </td>
            <td className="px-4 py-3 tabular-nums whitespace-nowrap align-middle">
              <span className={futureDate ? 'text-amber-800 font-medium' : 'text-gray-700'}>
                {e.entry_date}
              </span>
            </td>
            <td className="px-4 py-3 whitespace-nowrap align-middle">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${journalSourceTagClass(e.source_type)}`}
              >
                {formatSourceType(e.source_type)}
              </span>
            </td>
            <td className="px-4 py-3 align-middle max-w-[240px]">
              <JournalMemoLinks
                memo={e.memo}
                sourceType={e.source_type}
                sourceId={e.source_id}
                journalEntryId={e.id}
                compact
              />
            </td>
            <td className="px-4 py-3 text-right tabular-nums text-green-700 align-middle whitespace-nowrap">
              {totals.debit > 0 ? formatGlPhp(totals.debit) : '—'}
            </td>
            <td className="px-4 py-3 text-right tabular-nums text-red-700 align-middle whitespace-nowrap">
              {totals.credit > 0 ? formatGlPhp(totals.credit) : '—'}
            </td>
            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap align-middle hidden lg:table-cell">
              {e.posted_at ? (
                <>
                  {new Date(e.posted_at).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {e.posted_by ? ` · ${e.posted_by}` : ''}
                </>
              ) : (
                '—'
              )}
            </td>
          </tr>
          {expanded && e.lines && (
            <tr>
              <td colSpan={8} className="px-4 py-3 bg-slate-50/80 border-t border-slate-100">
                <div onClick={(ev) => ev.stopPropagation()}>
                  <JournalSupportingDocs
                    sourceType={e.source_type}
                    sourceId={e.source_id}
                    journalEntryId={e.id}
                    brandId={brandId}
                    lineMemos={lineMemos}
                    onOpenDocument={handleOpenDocument}
                  />
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-200">
                      <th className="text-left py-1.5 pr-4 font-medium">Account</th>
                      <th className="text-left py-1.5 pr-4 font-medium">Description</th>
                      <th className="text-right py-1.5 px-4 font-medium w-28">Debit</th>
                      <th className="text-right py-1.5 pl-4 font-medium w-28">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.lines.map((l) => (
                      <tr key={l.id} className="border-t border-gray-100">
                        <td className="py-1.5 pr-4">
                          <span className="font-mono text-gray-500 mr-1">{l.account?.code}</span>
                          {l.account?.name}
                        </td>
                        <td className="py-1.5 pr-4">
                          <JournalLineMemoLink memo={l.memo} />
                        </td>
                        <td className="text-right px-4 py-1.5 tabular-nums whitespace-nowrap text-green-700">
                          {Number(l.debit) > 0 ? formatGlPhp(Number(l.debit)) : '—'}
                        </td>
                        <td className="text-right pl-4 py-1.5 tabular-nums whitespace-nowrap text-red-700">
                          {Number(l.credit) > 0 ? formatGlPhp(Number(l.credit)) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>
          )}
        </Fragment>
      )
    })

  const journalTable = (
    list: AccountingJournalEntry[],
    { title, hint, markFutureDates = false }: { title?: string; hint?: string; markFutureDates?: boolean }
  ) => (
    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {(title || list.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b bg-gray-50">
          <div>
            {title && <h3 className="text-sm font-semibold text-gray-900">{title}</h3>}
            {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
          </div>
          {list.length > 0 && (
            <button
              type="button"
              onClick={toggleExpandAll}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              {anyExpanded ? 'Collapse all' : 'Expand all lines'}
            </button>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-white border-b text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-8 px-2 py-2.5" aria-hidden />
              <th className="text-left px-4 py-2.5">JE #</th>
              <th className="text-left px-4 py-2.5">Date</th>
              <th className="text-left px-4 py-2.5">Source</th>
              <th className="text-left px-4 py-2.5 min-w-[160px]">Description</th>
              <th className="text-right px-4 py-2.5">Debit</th>
              <th className="text-right px-4 py-2.5">Credit</th>
              <th className="text-left px-4 py-2.5 hidden lg:table-cell">Posted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">{renderEntryRows(list, markFutureDates)}</tbody>
        </table>
      </div>
    </section>
  )

  if (!brandId) {
    return <p className="text-sm text-gray-500">Select a brand to view the journal.</p>
  }

  return (
    <div className="space-y-5">
      <JournalSourceModalHost
        open={openDoc}
        onClose={() => setOpenDoc(null)}
        brandId={brandId}
        themeBtn={themeBtn}
        onOpenJournalEntry={onOpenJournalEntry}
      />

      <div className="flex flex-wrap justify-between gap-3 items-start">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Posted journal</h2>
          <p className="text-sm text-gray-600 mt-0.5">
            All posted entries for this period (newest first). Period:{' '}
            <span className="font-medium text-gray-800">{periodLabel}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!filtered.length}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 shrink-0"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Filter entries</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-700 mb-1 block">Search</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="search"
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white"
                placeholder="JE #, description, or source…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-700 mb-1 block">Source type</span>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="">All sources</option>
              {sourceOptions.map((s) => (
                <option key={s} value={s}>
                  {formatSourceType(s)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {(search || sourceFilter) && (
          <p className="text-xs text-gray-500">
            Showing {filtered.length} of {entries.length} entries.{' '}
            <button
              type="button"
              className="text-blue-600 hover:underline"
              onClick={() => {
                setSearch('')
                setSourceFilter('')
              }}
            >
              Clear filters
            </button>
          </p>
        )}
      </section>

      {loading ? (
        <AccountingJournalListSkeleton rows={8} />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-10 text-center text-sm text-gray-500">
          {entries.length === 0
            ? 'No posted journal entries for this period. Post a voucher, manual entry, or run backfill in Journal settings.'
            : 'No entries match your filters. Clear search or change the source filter.'}
        </div>
      ) : (
        <div className="space-y-5">
          {currentEntries.length > 0 &&
            journalTable(currentEntries, {
              title: 'Current & past-dated entries',
              hint: 'Click a row to expand lines. Click the description or JE # for details.',
            })}
          {futureEntries.length > 0 && (
            <>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {futureEntries.length} future-dated{' '}
                {futureEntries.length === 1 ? 'entry' : 'entries'} — dated after today (
                {todayPh}) but already posted.
              </div>
              {journalTable(futureEntries, {
                title: 'Future-dated entries',
                hint: 'These affect GL when their entry date falls in the reporting period.',
                markFutureDates: true,
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
