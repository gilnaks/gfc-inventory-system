import { supabase } from './supabase'
import type { AccountingAccount, AccountingAccountType } from './supabase'
import { ensurePeriod, periodFromDate } from './accounting-period-service'
import { getPhilippinesBillingPeriodRange, type BillingTimeFilter } from './timezone'

export type TrialBalanceRow = {
  account_id: string
  code: string
  name: string
  account_type: AccountingAccountType
  debit: number
  credit: number
}

export type FinancialStatementRow = {
  code: string
  name: string
  amount: number
}

export async function loadTrialBalance(
  brandId: string,
  fromDate: string,
  toDate: string
): Promise<{ rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number; balanced: boolean }> {
  const { data: accounts } = await supabase
    .from('accounting_accounts')
    .select('*')
    .eq('brand_id', brandId)
    .eq('is_active', true)
    .order('code')

  const start = periodFromDate(fromDate)
  const end = periodFromDate(toDate)
  const { data: periods } = await supabase
    .from('accounting_periods')
    .select('id, year, month')
    .eq('brand_id', brandId)

  const periodIds = (periods || [])
    .filter(
      (p) =>
        (p.year > start.year || (p.year === start.year && p.month >= start.month)) &&
        (p.year < end.year || (p.year === end.year && p.month <= end.month))
    )
    .map((p) => p.id)

  const { data: balances } = periodIds.length
    ? await supabase
        .from('accounting_gl_balances')
        .select('*')
        .eq('brand_id', brandId)
        .in('period_id', periodIds)
    : { data: [] }

  const balanceByAccount = new Map<string, { debit: number; credit: number }>()
  for (const b of balances || []) {
    const cur = balanceByAccount.get(b.account_id) || { debit: 0, credit: 0 }
    cur.debit += Number(b.debit_total) || 0
    cur.credit += Number(b.credit_total) || 0
    balanceByAccount.set(b.account_id, cur)
  }

  const rows: TrialBalanceRow[] = []
  let totalDebit = 0
  let totalCredit = 0

  for (const acc of (accounts || []) as AccountingAccount[]) {
    const bal = balanceByAccount.get(acc.id)
    if (!bal || (bal.debit === 0 && bal.credit === 0)) continue
    rows.push({
      account_id: acc.id,
      code: acc.code,
      name: acc.name,
      account_type: acc.account_type,
      debit: bal.debit,
      credit: bal.credit,
    })
    totalDebit += bal.debit
    totalCredit += bal.credit
  }

  return {
    rows,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.01,
  }
}

export async function loadIncomeStatement(
  brandId: string,
  timeFilter: BillingTimeFilter
): Promise<{ revenue: FinancialStatementRow[]; expenses: FinancialStatementRow[]; netIncome: number }> {
  const { fromDate, toDate } = periodRangeFromFilter(timeFilter)
  const tb = await loadTrialBalance(brandId, fromDate, toDate)

  const revenue: FinancialStatementRow[] = []
  const expenses: FinancialStatementRow[] = []
  let netIncome = 0

  for (const row of tb.rows) {
    const net = row.credit - row.debit
    if (row.account_type === 'revenue') {
      revenue.push({ code: row.code, name: row.name, amount: net })
      netIncome += net
    } else if (row.account_type === 'expense') {
      const exp = row.debit - row.credit
      expenses.push({ code: row.code, name: row.name, amount: exp })
      netIncome -= exp
    }
  }

  return { revenue, expenses, netIncome }
}

export async function loadBalanceSheet(
  brandId: string,
  asOfDate: string
): Promise<{
  assets: FinancialStatementRow[]
  liabilities: FinancialStatementRow[]
  equity: FinancialStatementRow[]
  retainedEarnings3100: FinancialStatementRow | null
  currentYearNetIncome: number
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
}> {
  const tb = await loadTrialBalance(brandId, '2000-01-01', asOfDate)
  const assets: FinancialStatementRow[] = []
  const liabilities: FinancialStatementRow[] = []
  const equity: FinancialStatementRow[] = []
  let retainedEarnings3100: FinancialStatementRow | null = null

  for (const row of tb.rows) {
    if (row.account_type === 'revenue' || row.account_type === 'expense') continue

    const amount =
      row.account_type === 'asset'
        ? row.debit - row.credit
        : row.credit - row.debit

    // Keep signed amounts (contra / overdrawn accounts). Skip near-zero nets.
    if (Math.abs(amount) < 0.005 && row.code !== '3100') continue

    const item = { code: row.code, name: row.name, amount }

    if (row.account_type === 'asset') assets.push(item)
    else if (row.account_type === 'liability') liabilities.push(item)
    else if (row.account_type === 'equity') {
      if (row.code === '3100') {
        retainedEarnings3100 = item
      } else {
        equity.push(item)
      }
    }
  }

  const currentYearNetIncome = await loadCurrentYearOpenNetIncome(brandId, asOfDate)

  const totalAssets = assets.reduce((s, r) => s + r.amount, 0)
  const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0)
  const reAmount = retainedEarnings3100?.amount ?? 0
  const totalEquity = equity.reduce((s, r) => s + r.amount, 0) + reAmount + currentYearNetIncome

  return {
    assets,
    liabilities,
    equity,
    retainedEarnings3100,
    currentYearNetIncome,
    totalAssets,
    totalLiabilities,
    totalEquity,
  }
}

async function loadCurrentYearOpenNetIncome(brandId: string, asOfDate: string): Promise<number> {
  const asOf = periodFromDate(asOfDate)
  const { data: periods } = await supabase
    .from('accounting_periods')
    .select('id, month, year_closed')
    .eq('brand_id', brandId)
    .eq('year', asOf.year)
    .lte('month', asOf.month)

  const periodIds = (periods || [])
    .filter((p) => !p.year_closed)
    .map((p) => p.id)
  if (!periodIds.length) return 0

  const { data: accounts } = await supabase
    .from('accounting_accounts')
    .select('id, account_type')
    .eq('brand_id', brandId)
    .in('account_type', ['revenue', 'expense'])

  const plAccounts = (accounts || []) as Pick<AccountingAccount, 'id' | 'account_type'>[]
  const plIds = plAccounts.map((a) => a.id)
  if (!plIds.length) return 0

  const { data: balances } = await supabase
    .from('accounting_gl_balances')
    .select('account_id, debit_total, credit_total')
    .eq('brand_id', brandId)
    .in('period_id', periodIds)
    .in('account_id', plIds)

  const accountById = new Map(plAccounts.map((a) => [a.id, a]))
  let netIncome = 0
  for (const b of balances || []) {
    const acc = accountById.get(b.account_id)
    if (!acc) continue
    const debit = Number(b.debit_total) || 0
    const credit = Number(b.credit_total) || 0
    if (acc.account_type === 'revenue') netIncome += credit - debit
    else netIncome -= debit - credit
  }
  return netIncome
}

export function periodRangeFromFilter(filter: BillingTimeFilter): { fromDate: string; toDate: string } {
  const { start, end } = getPhilippinesBillingPeriodRange(filter)
  return {
    fromDate: start.split('T')[0],
    toDate: end.split('T')[0],
  }
}

/** Plain-language banner: "Assets ₱5.00 - (liabilities + equity ₱5.00) = ₱0.00 — balanced." */
export function formatReportVsBalanceMessage(
  leftLabel: string,
  leftAmount: number,
  rightLabel: string,
  rightAmount: number,
  formatMoney: (amount: number) => string = (amount) =>
    `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
): { balanced: boolean; message: string } {
  const balanced = Math.abs(leftAmount - rightAmount) < 0.01
  const difference = Math.abs(leftAmount - rightAmount)
  const rightExpr = rightLabel.includes('+')
    ? `(${rightLabel} ${formatMoney(rightAmount)})`
    : `${rightLabel} ${formatMoney(rightAmount)}`
  const base = `${leftLabel} ${formatMoney(leftAmount)} - ${rightExpr} = ${formatMoney(difference)}`
  const message = balanced ? `${base} — balanced.` : `${base} — not balanced.`
  return { balanced, message }
}
