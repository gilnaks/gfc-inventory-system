'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import type { AccountingAccount, AccountingAccountType, Brand } from '../../lib/supabase'
import { ensureCoreGlAccountDefaults, loadAccounts } from '../../lib/accounting-coa-seed'
import { ensureVoucherSettings } from '../../lib/accounting-voucher-service'
import { getLedgerOpeningBalance, loadGlForAccount } from '../../lib/accounting-journal-service'
import { batchPrefetchJournalEntryDescriptions, isSourceTypeTrackable } from '../../lib/journal-source-resolver'
import { periodRangeFromFilter } from '../../lib/accounting-reports'
import { downloadCsv } from '../../lib/csv-export'
import { getPhilippinesBillingPeriodLabel, type BillingTimeFilter } from '../../lib/timezone'
import {
  AccountingBooksTableSkeleton,
  AccountingGlToolbarSkeleton,
} from './AccountingBooksSkeletons'
import { AccountingLedgerTable, formatGlPhp } from './AccountingLedgerTable'

interface Props {
  selectedBrand: Brand | null
  timeFilter: BillingTimeFilter
  themeBtn?: string
  onOpenJournalEntry?: (entryId: string) => void
}

const ACCOUNT_TYPE_ORDER: AccountingAccountType[] = [
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
]

const ACCOUNT_TYPE_LABELS: Record<AccountingAccountType, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expenses',
}

const ACCOUNT_TYPE_BADGE: Record<AccountingAccountType, string> = {
  asset: 'bg-blue-50 text-blue-700 border-blue-100',
  liability: 'bg-amber-50 text-amber-800 border-amber-100',
  equity: 'bg-purple-50 text-purple-700 border-purple-100',
  revenue: 'bg-green-50 text-green-700 border-green-100',
  expense: 'bg-rose-50 text-rose-700 border-rose-100',
}

export function AccountingGeneralLedger({ selectedBrand, timeFilter, themeBtn, onOpenJournalEntry }: Props) {
  const brandId = selectedBrand?.id || ''
  const [accounts, setAccounts] = useState<AccountingAccount[]>([])
  const [accountId, setAccountId] = useState('')
  const [accountSearch, setAccountSearch] = useState('')
  const [rows, setRows] = useState<Awaited<ReturnType<typeof loadGlForAccount>>>([])
  const [openingBalance, setOpeningBalance] = useState(0)
  const [loading, setLoading] = useState(false)
  const [accountsLoading, setAccountsLoading] = useState(true)

  const periodLabel = useMemo(() => getPhilippinesBillingPeriodLabel(timeFilter), [timeFilter])
  const { fromDate, toDate } = useMemo(() => periodRangeFromFilter(timeFilter), [timeFilter])

  useEffect(() => {
    if (!brandId) return
    setAccountsLoading(true)
    void (async () => {
      await ensureCoreGlAccountDefaults(brandId)
      const [accts, settings] = await Promise.all([
        loadAccounts(brandId),
        ensureVoucherSettings(brandId),
      ])
      setAccounts(accts)
      const defaultCashId =
        settings.default_cash_account_id ||
        accts.find((a) => a.code === '1000')?.id ||
        ''
      if (defaultCashId) {
        setAccountId(defaultCashId)
      } else if (accts.length) {
        setAccountId(accts[0].id)
      }
    })().finally(() => setAccountsLoading(false))
  }, [brandId])

  const refresh = useCallback(async () => {
    if (!brandId || !accountId) return
    setLoading(true)
    try {
      const [glRows, opening] = await Promise.all([
        loadGlForAccount(brandId, accountId, fromDate, toDate),
        getLedgerOpeningBalance(brandId, accountId, fromDate),
      ])
      setRows(glRows)
      setOpeningBalance(opening)
    } finally {
      setLoading(false)
    }
  }, [brandId, accountId, fromDate, toDate])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const requests = rows
      .filter((r) => r.source_id && isSourceTypeTrackable(r.source_type || '', r.source_id))
      .map((r) => ({ sourceType: r.source_type as string, sourceId: r.source_id as string }))
    if (requests.length) void batchPrefetchJournalEntryDescriptions(requests)
  }, [rows])

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter(
      (a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    )
  }, [accounts, accountSearch])

  const accountsByType = useMemo(() => {
    const map = new Map<AccountingAccountType, AccountingAccount[]>()
    for (const type of ACCOUNT_TYPE_ORDER) map.set(type, [])
    for (const a of filteredAccounts) {
      const list = map.get(a.account_type) || []
      list.push(a)
      map.set(a.account_type, list)
    }
    return map
  }, [filteredAccounts])

  const selected = accounts.find((a) => a.id === accountId)

  const periodDebit = rows.reduce((s, r) => s + r.debit, 0)
  const periodCredit = rows.reduce((s, r) => s + r.credit, 0)
  const closingBalance = rows.length ? rows[rows.length - 1].running_balance : openingBalance

  const exportCsv = () => {
    downloadCsv(
      `gl-${selected?.code || 'account'}.csv`,
      ['Date', 'JE#', 'Description', 'Debit', 'Credit', 'Balance'],
      [
        ['', '', 'Opening balance', '', '', String(openingBalance)],
        ...rows.map((r) => [
          r.entry_date,
          r.entry_number,
          r.memo || '',
          String(r.debit),
          String(r.credit),
          String(r.running_balance),
        ]),
      ]
    )
  }

  if (!brandId) {
    return <p className="text-sm text-gray-500">Select a brand to view the general ledger.</p>
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">General Ledger</h2>
        <p className="text-sm text-gray-600 mt-0.5">
          Activity for each account, with a running balance. Period:{' '}
          <span className="font-medium text-gray-800">{periodLabel}</span>
        </p>
      </div>

      {accountsLoading ? (
        <AccountingGlToolbarSkeleton />
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 px-4 py-6 text-sm text-amber-900">
          No chart of accounts found for this brand. Open Chart of Accounts to seed or add accounts first.
        </div>
      ) : (
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Select account</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-medium text-gray-700 mb-1 block">Search</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="search"
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white"
                  placeholder="Filter by code or name…"
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="text-xs font-medium text-gray-700 mb-1 block">GL account</span>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {filteredAccounts.length === 0 ? (
                  <option value="">No accounts match your search</option>
                ) : (
                  ACCOUNT_TYPE_ORDER.map((type) => {
                    const group = accountsByType.get(type) || []
                    if (!group.length) return null
                    return (
                      <optgroup key={type} label={ACCOUNT_TYPE_LABELS[type]}>
                        {group.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </option>
                        ))}
                      </optgroup>
                    )
                  })
                )}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={exportCsv}
                disabled={!rows.length && openingBalance === 0}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>

          {selected && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                  ACCOUNT_TYPE_BADGE[selected.account_type]
                }`}
              >
                {selected.account_type}
              </span>
              <span className="text-xs text-gray-500">
                Normal balance: <span className="font-medium text-gray-700">{selected.normal_balance}</span>
              </span>
              <span className="text-xs text-gray-400 font-mono">{selected.code}</span>
            </div>
          )}
        </section>
      )}

      {selected && !loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Opening balance', sub: `before ${fromDate}`, value: formatGlPhp(openingBalance) },
            { label: 'Period debits', sub: `${rows.length} entries`, value: formatGlPhp(periodDebit) },
            { label: 'Period credits', sub: 'in selected range', value: formatGlPhp(periodCredit) },
            { label: 'Closing balance', sub: `as of ${toDate}`, value: formatGlPhp(closingBalance) },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-lg font-semibold tabular-nums text-gray-900 mt-0.5">{card.value}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <AccountingBooksTableSkeleton columnCount={6} rows={10} tableMinWidthClass="w-full" />
      ) : selected ? (
        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">
              {selected.code} — {selected.name}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Click a JE # to open the journal entry detail.
            </p>
          </div>
          <div className="p-0">
            <AccountingLedgerTable
              rows={rows}
              openingBalance={openingBalance}
              brandId={brandId}
              themeBtn={themeBtn}
              onOpenJournalEntry={onOpenJournalEntry}
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}
