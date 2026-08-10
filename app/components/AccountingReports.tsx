'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, Printer, X } from 'lucide-react'
import type { Brand } from '../../lib/supabase'
import type { BillingTimeFilter } from '../../lib/timezone'
import { getPhilippinesBillingPeriodLabel } from '../../lib/timezone'
import { accountingThemeSolidButton } from '../../lib/accounting-theme'
import { getAccountSignedBalanceBeforeDate, loadGlForAccount } from '../../lib/accounting-journal-service'
import { Modal } from './Modal'
import {
  loadTrialBalance,
  loadIncomeStatement,
  loadBalanceSheet,
  periodRangeFromFilter,
  formatReportVsBalanceMessage,
  type TrialBalanceRow,
} from '../../lib/accounting-reports'
import { downloadCsv } from '../../lib/csv-export'
import {
  AccountingBalanceSheetSkeleton,
  AccountingBooksTableSkeleton,
  AccountingIncomeStatementSkeleton,
  AccountingReportsSkeleton,
} from './AccountingBooksSkeletons'
import { AccountingLedgerTable, formatGlPhp } from './AccountingLedgerTable'
import { openFinancialReportPrintWindow } from '../../lib/print-financial-reports'

interface Props {
  selectedBrand: Brand | null
  timeFilter: BillingTimeFilter
  theme?: string
  currentUsername?: string
  currentRoleLabel?: string
  onOpenJournalEntry?: (entryId: string) => void
}

type ReportTab = 'trial_balance' | 'income' | 'balance_sheet'

const REPORT_TABS: { id: ReportTab; label: string; description: string }[] = [
  {
    id: 'trial_balance',
    label: 'Trial Balance',
    description: 'Debits and credits for the period, checked for balance.',
  },
  {
    id: 'income',
    label: 'Income Statement',
    description: 'Revenue, expenses, and profit for the period.',
  },
  {
    id: 'balance_sheet',
    label: 'Balance Sheet',
    description: 'Assets, liabilities, and equity as of period end.',
  },
]

function StatementSection({
  title,
  rows,
  total,
  emptyLabel,
}: {
  title: string
  rows: { code: string; name: string; amount: number }[]
  total: number
  emptyLabel: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-gray-100 text-sm">
          {rows.map((r) => (
            <li key={r.code} className="flex justify-between gap-3 px-4 py-2.5 hover:bg-gray-50/80">
              <span className="min-w-0">
                <span className="font-mono text-xs text-gray-500 mr-2">{r.code}</span>
                {r.name}
              </span>
              <span className="tabular-nums font-medium shrink-0">{formatGlPhp(r.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-between gap-3 px-4 py-3 border-t bg-gray-50 font-semibold text-sm">
        <span>Total {title.toLowerCase()}</span>
        <span className="tabular-nums">{formatGlPhp(total)}</span>
      </div>
    </div>
  )
}

export function AccountingReports({
  selectedBrand,
  timeFilter,
  theme = 'blue',
  currentUsername = '',
  currentRoleLabel = '',
  onOpenJournalEntry,
}: Props) {
  const brandId = selectedBrand?.id || ''
  const [reportTab, setReportTab] = useState<ReportTab>('trial_balance')
  const [loading, setLoading] = useState(false)
  const [tb, setTb] = useState<Awaited<ReturnType<typeof loadTrialBalance>> | null>(null)
  const [pl, setPl] = useState<Awaited<ReturnType<typeof loadIncomeStatement>> | null>(null)
  const [bs, setBs] = useState<Awaited<ReturnType<typeof loadBalanceSheet>> | null>(null)
  const [ledgerAccount, setLedgerAccount] = useState<TrialBalanceRow | null>(null)
  const [ledgerRows, setLedgerRows] = useState<Awaited<ReturnType<typeof loadGlForAccount>>>([])
  const [ledgerOpening, setLedgerOpening] = useState(0)
  const [ledgerLoading, setLedgerLoading] = useState(false)

  const solidBtn = accountingThemeSolidButton(theme)
  const periodLabel = useMemo(() => getPhilippinesBillingPeriodLabel(timeFilter), [timeFilter])
  const { fromDate, toDate } = useMemo(() => periodRangeFromFilter(timeFilter), [timeFilter])

  const refresh = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    try {
      if (reportTab === 'trial_balance') {
        setTb(await loadTrialBalance(brandId, fromDate, toDate))
      } else if (reportTab === 'income') {
        setPl(await loadIncomeStatement(brandId, timeFilter))
      } else {
        setBs(await loadBalanceSheet(brandId, toDate))
      }
    } finally {
      setLoading(false)
    }
  }, [brandId, timeFilter, reportTab, fromDate, toDate])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!brandId || !ledgerAccount) {
      setLedgerRows([])
      setLedgerOpening(0)
      return
    }
    let cancelled = false
    setLedgerLoading(true)
    void Promise.all([
      loadGlForAccount(brandId, ledgerAccount.account_id, fromDate, toDate),
      getAccountSignedBalanceBeforeDate(brandId, ledgerAccount.account_id, fromDate),
    ])
      .then(([rows, opening]) => {
        if (!cancelled) {
          setLedgerRows(rows)
          setLedgerOpening(opening)
        }
      })
      .finally(() => {
        if (!cancelled) setLedgerLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [brandId, ledgerAccount, timeFilter, fromDate, toDate])

  const totalRevenue = pl?.revenue.reduce((s, r) => s + r.amount, 0) ?? 0
  const totalExpenses = pl?.expenses.reduce((s, r) => s + r.amount, 0) ?? 0
  const trialBalanceBanner = useMemo(
    () =>
      tb
        ? formatReportVsBalanceMessage('Debits', tb.totalDebit, 'credits', tb.totalCredit, formatGlPhp)
        : null,
    [tb]
  )
  const balanceSheetBanner = useMemo(
    () =>
      bs
        ? formatReportVsBalanceMessage(
            'Assets',
            bs.totalAssets,
            'liabilities + equity',
            bs.totalLiabilities + bs.totalEquity,
            formatGlPhp
          )
        : null,
    [bs]
  )

  const exportCsv = () => {
    if (reportTab === 'trial_balance' && tb) {
      downloadCsv(
        'trial-balance.csv',
        ['Code', 'Account', 'Debit', 'Credit'],
        tb.rows.map((r) => [r.code, r.name, String(r.debit), String(r.credit)])
      )
    } else if (reportTab === 'income' && pl) {
      const rows = [
        ...pl.revenue.map((r) => ['Revenue', r.code, r.name, String(r.amount)]),
        ...pl.expenses.map((r) => ['Expense', r.code, r.name, String(r.amount)]),
        ['Net income', '', '', String(pl.netIncome)],
      ]
      downloadCsv('income-statement.csv', ['Type', 'Code', 'Account', 'Amount'], rows)
    } else if (reportTab === 'balance_sheet' && bs) {
      const rows = [
        ...bs.assets.map((r) => ['Asset', r.code, r.name, String(r.amount)]),
        ...bs.liabilities.map((r) => ['Liability', r.code, r.name, String(r.amount)]),
        ...bs.equity.map((r) => ['Equity', r.code, r.name, String(r.amount)]),
        ...(bs.retainedEarnings3100
          ? [['Equity', bs.retainedEarnings3100.code, bs.retainedEarnings3100.name, String(bs.retainedEarnings3100.amount)]]
          : []),
        ['Equity', 'NI', 'Net income — current open periods', String(bs.currentYearNetIncome)],
      ]
      downloadCsv('balance-sheet.csv', ['Section', 'Code', 'Account', 'Amount'], rows)
    }
  }

  const canPrint =
    !loading &&
    ((reportTab === 'trial_balance' && !!tb) ||
      (reportTab === 'income' && !!pl) ||
      (reportTab === 'balance_sheet' && !!bs))

  const printReport = () => {
    if (!canPrint) {
      alert('Report is still loading. Try again in a moment.')
      return
    }
    const brandName = selectedBrand?.name || 'Company'
    const ok = openFinancialReportPrintWindow({
      kind: reportTab,
      brandName,
      periodLabel,
      generatedByUsername: currentUsername,
      generatedByRole: currentRoleLabel,
      trialBalance: reportTab === 'trial_balance' ? tb : null,
      incomeStatement: reportTab === 'income' ? pl : null,
      balanceSheet: reportTab === 'balance_sheet' ? bs : null,
    })
    if (!ok) alert('Allow pop-ups to print financial reports.')
  }

  if (!brandId) {
    return <p className="text-sm text-gray-500">Select a brand.</p>
  }

  const activeReport = REPORT_TABS.find((t) => t.id === reportTab)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3 items-start">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Financial Reports</h2>
          <p className="text-sm text-gray-600 mt-0.5">
            {activeReport?.description} Period:{' '}
            <span className="font-medium text-gray-800">{periodLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={exportCsv}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={printReport}
            disabled={!canPrint}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${solidBtn}`}
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-2">
        {REPORT_TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setReportTab(id)}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              reportTab === id
                ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                reportTab === id ? 'text-blue-800' : 'text-gray-900'
              }`}
            >
              {label}
            </p>
          </button>
        ))}
      </div>

      <div id="accounting-report-print">
        {loading ? (
          reportTab === 'income' ? (
            <AccountingIncomeStatementSkeleton />
          ) : reportTab === 'balance_sheet' ? (
            <AccountingBalanceSheetSkeleton />
          ) : (
            <AccountingReportsSkeleton />
          )
        ) : reportTab === 'trial_balance' && tb ? (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs text-gray-500">Accounts with activity</p>
                <p className="text-lg font-semibold mt-0.5">{tb.rows.length}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs text-gray-500">Total debits</p>
                <p className="text-lg font-semibold tabular-nums mt-0.5">{formatGlPhp(tb.totalDebit)}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs text-gray-500">Total credits</p>
                <p className="text-lg font-semibold tabular-nums mt-0.5">{formatGlPhp(tb.totalCredit)}</p>
              </div>
            </div>

            <div
              className={`rounded-lg px-4 py-3 text-sm border ${
                trialBalanceBanner?.balanced
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {trialBalanceBanner?.message}
              {!trialBalanceBanner?.balanced ? ' Review journal entries.' : ''}
            </div>

            {tb.rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-10 text-center text-sm text-gray-500">
                No GL activity in this period. Post journal entries or widen the date range.
              </div>
            ) : (
              <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">Trial balance detail</h3>
                  <p className="text-xs text-gray-500 inline-flex items-center gap-1">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Click a row to expand account ledger
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead className="bg-white border-b text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="text-left px-4 py-2.5">Code</th>
                        <th className="text-left px-4 py-2.5">Account</th>
                        <th className="text-right px-4 py-2.5">Debit</th>
                        <th className="text-right px-4 py-2.5">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {tb.rows.map((r) => (
                        <tr
                          key={r.account_id}
                          className="cursor-pointer hover:bg-blue-50/80 transition-colors"
                          onClick={() => setLedgerAccount(r)}
                        >
                          <td className="px-4 py-2.5 font-mono text-xs">{r.code}</td>
                          <td className="px-4 py-2.5">{r.name}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-green-700">
                            {r.debit > 0 ? formatGlPhp(r.debit) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-red-700">
                            {r.credit > 0 ? formatGlPhp(r.credit) : '—'}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-semibold bg-gray-50">
                        <td colSpan={2} className="px-4 py-2.5">
                          Totals
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatGlPhp(tb.totalDebit)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatGlPhp(tb.totalCredit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        ) : reportTab === 'income' && pl ? (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs text-gray-500">Total revenue</p>
                <p className="text-lg font-semibold tabular-nums text-green-700 mt-0.5">
                  {formatGlPhp(totalRevenue)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs text-gray-500">Total expenses</p>
                <p className="text-lg font-semibold tabular-nums text-red-700 mt-0.5">
                  {formatGlPhp(totalExpenses)}
                </p>
              </div>
              <div
                className={`rounded-xl border px-4 py-3 ${
                  pl.netIncome >= 0
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <p className="text-xs text-gray-600">Net income</p>
                <p
                  className={`text-lg font-semibold tabular-nums mt-0.5 ${
                    pl.netIncome >= 0 ? 'text-green-800' : 'text-red-800'
                  }`}
                >
                  {formatGlPhp(pl.netIncome)}
                </p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <StatementSection
                title="Revenue"
                rows={pl.revenue}
                total={totalRevenue}
                emptyLabel="No revenue posted in this period."
              />
              <StatementSection
                title="Expenses"
                rows={pl.expenses}
                total={totalExpenses}
                emptyLabel="No expenses posted in this period."
              />
            </div>
          </div>
        ) : reportTab === 'balance_sheet' && bs ? (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs text-gray-500">Total assets</p>
                <p className="text-lg font-semibold tabular-nums mt-0.5">{formatGlPhp(bs.totalAssets)}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs text-gray-500">Total liabilities</p>
                <p className="text-lg font-semibold tabular-nums mt-0.5">
                  {formatGlPhp(bs.totalLiabilities)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs text-gray-500">Total equity</p>
                <p className="text-lg font-semibold tabular-nums mt-0.5">{formatGlPhp(bs.totalEquity)}</p>
              </div>
            </div>

            <div
              className={`rounded-lg px-4 py-3 text-sm border ${
                balanceSheetBanner?.balanced
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {balanceSheetBanner?.message}
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <StatementSection
                title="Assets"
                rows={bs.assets}
                total={bs.totalAssets}
                emptyLabel="No asset balances."
              />
              <StatementSection
                title="Liabilities"
                rows={bs.liabilities}
                total={bs.totalLiabilities}
                emptyLabel="No liability balances."
              />
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-900">Equity</h3>
                </div>
                <ul className="divide-y divide-gray-100 text-sm">
                  {bs.equity.map((r) => (
                    <li key={r.code} className="flex justify-between gap-3 px-4 py-2.5">
                      <span>
                        <span className="font-mono text-xs text-gray-500 mr-2">{r.code}</span>
                        {r.name}
                      </span>
                      <span className="tabular-nums font-medium">{formatGlPhp(r.amount)}</span>
                    </li>
                  ))}
                  {bs.retainedEarnings3100 && (
                    <li className="flex justify-between gap-3 px-4 py-2.5">
                      <span>
                        <span className="font-mono text-xs text-gray-500 mr-2">
                          {bs.retainedEarnings3100.code}
                        </span>
                        {bs.retainedEarnings3100.name}
                      </span>
                      <span className="tabular-nums font-medium">
                        {formatGlPhp(bs.retainedEarnings3100.amount)}
                      </span>
                    </li>
                  )}
                  <li className="flex justify-between gap-3 px-4 py-2.5 text-gray-700">
                    <span>Net income — open periods</span>
                    <span className="tabular-nums font-medium">{formatGlPhp(bs.currentYearNetIncome)}</span>
                  </li>
                </ul>
                <div className="flex justify-between gap-3 px-4 py-3 border-t bg-gray-50 font-semibold text-sm">
                  <span>Total equity</span>
                  <span className="tabular-nums">{formatGlPhp(bs.totalEquity)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-10 text-center text-sm text-gray-500">
            No data for this period. Post journal entries first or change the period filter above.
          </div>
        )}
      </div>

      {ledgerAccount && (
        <Modal onClose={() => setLedgerAccount(null)} align="center">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
            <div className="p-4 border-b flex justify-between items-start gap-3 shrink-0 bg-gray-50">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Account ledger</h3>
                <p className="text-sm text-gray-600 mt-0.5">
                  {ledgerAccount.code} — {ledgerAccount.name}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Trial balance: {formatGlPhp(ledgerAccount.debit)} debit ·{' '}
                  {formatGlPhp(ledgerAccount.credit)} credit · {periodLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLedgerAccount(null)}
                className="text-gray-500 hover:text-gray-700 shrink-0 p-1 rounded-lg hover:bg-gray-200"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {ledgerLoading ? (
                <div className="p-4">
                  <AccountingBooksTableSkeleton columnCount={6} rows={8} tableMinWidthClass="w-full" />
                </div>
              ) : (
                <AccountingLedgerTable
                  rows={ledgerRows}
                  openingBalance={ledgerOpening}
                  brandId={brandId}
                  onOpenJournalEntry={onOpenJournalEntry}
                />
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
