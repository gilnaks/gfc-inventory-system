'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Brand } from '../../lib/supabase'
import type { AccountingPeriod } from '../../lib/supabase'
import { loadPeriods, closePeriod, reopenPeriod } from '../../lib/accounting-period-service'
import {
  closeFiscalYear,
  loadFiscalYearClose,
  listClosedFiscalYears,
} from '../../lib/accounting-year-end-close'

interface Props {
  selectedBrand: Brand | null
  currentUsername: string
  onPosted?: () => void
  onOpenJournalEntry?: (entryId: string) => void
  onStatus?: (msg: string, variant: 'success' | 'error') => void
}

export function AccountingFiscalPeriodSettings({
  selectedBrand,
  currentUsername,
  onPosted,
  onOpenJournalEntry,
  onStatus,
}: Props) {
  const brandId = selectedBrand?.id || ''
  const [periods, setPeriods] = useState<AccountingPeriod[]>([])
  const [fiscalYear, setFiscalYear] = useState<number>(() => new Date().getFullYear())
  const [fiscalYears, setFiscalYears] = useState<number[]>([])
  const [closedYears, setClosedYears] = useState<number[]>([])
  const [yearCloseInfo, setYearCloseInfo] = useState<{ journal_entry_id: string } | null>(null)
  const [closingYear, setClosingYear] = useState(false)

  const refresh = useCallback(async () => {
    if (!brandId) return
    const per = await loadPeriods(brandId)
    setPeriods(per)
    const years = Array.from(new Set(per.map((p) => p.year))).sort((a, b) => b - a)
    setFiscalYears(years)
    if (years.length) {
      setFiscalYear((y) => (years.includes(y) ? y : years[0]))
    }
    setClosedYears(await listClosedFiscalYears(brandId))
  }, [brandId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!brandId) return
    void loadFiscalYearClose(brandId, fiscalYear).then((row) =>
      setYearCloseInfo(row ? { journal_entry_id: row.journal_entry_id } : null)
    )
  }, [brandId, fiscalYear])

  if (!brandId) return null

  const recentPeriods = [...periods]
    .sort((a, b) => b.year - a.year || b.month - a.month)
    .slice(0, 12)

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <h3 className="text-sm font-medium text-gray-900">Year-end close</h3>
        <p className="text-xs text-gray-600">
          Move profit and loss into retained earnings (3100).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="border rounded-lg px-2 py-1.5 text-sm"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(parseInt(e.target.value, 10))}
          >
            {(fiscalYears.length ? fiscalYears : [new Date().getFullYear()]).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          {yearCloseInfo || closedYears.includes(fiscalYear) ? (
            <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800">
              Closed
              {yearCloseInfo && onOpenJournalEntry && (
                <>
                  {' '}
                  ·{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => onOpenJournalEntry(yearCloseInfo.journal_entry_id)}
                  >
                    View JE
                  </button>
                </>
              )}
            </span>
          ) : (
            <button
              type="button"
              disabled={closingYear}
              className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              onClick={async () => {
                if (
                  !confirm(
                    `Close fiscal year ${fiscalYear}? Profit and loss will move to retained earnings (3100) and all months will be closed.`
                  )
                ) {
                  return
                }
                setClosingYear(true)
                try {
                  const { entryNumber } = await closeFiscalYear(brandId, fiscalYear, currentUsername)
                  onStatus?.(`Year-end close posted: ${entryNumber}`, 'success')
                  onPosted?.()
                  await refresh()
                } catch (e: unknown) {
                  onStatus?.(e instanceof Error ? e.message : 'Year-end close failed', 'error')
                } finally {
                  setClosingYear(false)
                }
              }}
            >
              {closingYear ? 'Closing…' : 'Close fiscal year'}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <h3 className="text-sm font-medium text-gray-900">Monthly periods</h3>
        <p className="text-xs text-gray-600">Close or reopen recent months.</p>
        {recentPeriods.length === 0 ? (
          <p className="text-xs text-gray-500">No periods configured.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {recentPeriods.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-1">
                <span className="text-gray-700 tabular-nums">
                  {p.year}-{String(p.month).padStart(2, '0')}
                </span>
                {p.status === 'open' ? (
                  <button
                    type="button"
                    className="text-amber-700 hover:underline shrink-0"
                    onClick={async () => {
                      await closePeriod(p.id)
                      await refresh()
                    }}
                  >
                    Close
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-blue-700 hover:underline shrink-0"
                    onClick={async () => {
                      await reopenPeriod(p.id)
                      await refresh()
                    }}
                  >
                    Reopen
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
