import { supabase } from './supabase'
import type { AccountingAccount, AccountingYearEndClose } from './supabase'
import { loadAccounts } from './accounting-coa-seed'
import { createAndPostJournal, type DraftJournalLine } from './accounting-journal-service'
import { ensurePeriod } from './accounting-period-service'
import { getBooksBrandId } from './accounting-books-brand'

function signedNetForAccount(acc: AccountingAccount, debit: number, credit: number): number {
  if (acc.account_type === 'revenue') return credit - debit
  if (acc.account_type === 'expense') return debit - credit
  return 0
}

function closingLinesForNet(acc: AccountingAccount, net: number): DraftJournalLine {
  if (net > 0) {
    if (acc.account_type === 'revenue') {
      return { account_id: acc.id, debit: net, credit: 0, memo: `Close ${acc.code}` }
    }
    return { account_id: acc.id, debit: 0, credit: net, memo: `Close ${acc.code}` }
  }
  const abs = Math.abs(net)
  if (acc.account_type === 'revenue') {
    return { account_id: acc.id, debit: 0, credit: abs, memo: `Close ${acc.code}` }
  }
  return { account_id: acc.id, debit: abs, credit: 0, memo: `Close ${acc.code}` }
}

export async function loadFiscalYearClose(
  brandId: string,
  fiscalYear: number
): Promise<AccountingYearEndClose | null> {
  const booksBrandId = await getBooksBrandId()
  void brandId
  const { data } = await supabase
    .from('accounting_year_end_closes')
    .select('*')
    .eq('brand_id', booksBrandId)
    .eq('fiscal_year', fiscalYear)
    .maybeSingle()
  return data as AccountingYearEndClose | null
}

export async function listClosedFiscalYears(brandId: string): Promise<number[]> {
  const booksBrandId = await getBooksBrandId()
  void brandId
  const { data } = await supabase
    .from('accounting_year_end_closes')
    .select('fiscal_year')
    .eq('brand_id', booksBrandId)
    .order('fiscal_year', { ascending: false })
  return (data || []).map((r) => r.fiscal_year)
}

export async function closeFiscalYear(
  brandId: string,
  fiscalYear: number,
  postedBy: string
): Promise<{ entryNumber: string }> {
  const booksBrandId = await getBooksBrandId()
  void brandId

  const existing = await loadFiscalYearClose(booksBrandId, fiscalYear)
  if (existing) {
    throw new Error(`Fiscal year ${fiscalYear} is already closed.`)
  }

  for (let month = 1; month <= 12; month++) {
    await ensurePeriod(booksBrandId, `${fiscalYear}-${String(month).padStart(2, '0')}-01`)
  }

  const { data: periods } = await supabase
    .from('accounting_periods')
    .select('id')
    .eq('brand_id', booksBrandId)
    .eq('year', fiscalYear)

  const periodIds = (periods || []).map((p) => p.id)
  if (!periodIds.length) throw new Error(`No periods found for ${fiscalYear}`)

  const accounts = await loadAccounts(booksBrandId, true)
  const plAccounts = accounts.filter(
    (a) => a.account_type === 'revenue' || a.account_type === 'expense'
  )

  const { data: balances } = await supabase
    .from('accounting_gl_balances')
    .select('account_id, debit_total, credit_total')
    .eq('brand_id', booksBrandId)
    .in('period_id', periodIds)

  const byAccount = new Map<string, { debit: number; credit: number }>()
  for (const b of balances || []) {
    const cur = byAccount.get(b.account_id) || { debit: 0, credit: 0 }
    cur.debit += Number(b.debit_total) || 0
    cur.credit += Number(b.credit_total) || 0
    byAccount.set(b.account_id, cur)
  }

  const draftLines: DraftJournalLine[] = []
  let netToRetained = 0

  for (const acc of plAccounts) {
    const bal = byAccount.get(acc.id)
    if (!bal) continue
    const net = signedNetForAccount(acc, bal.debit, bal.credit)
    if (Math.abs(net) < 0.005) continue
    draftLines.push(closingLinesForNet(acc, net))
    netToRetained += net
  }

  if (!draftLines.length) {
    throw new Error(`No revenue or expense balances to close for ${fiscalYear}.`)
  }

  const reAccount =
    accounts.find((a) => a.code === '3100') ||
    accounts.find((a) => a.account_type === 'equity' && a.code.startsWith('31'))

  if (!reAccount) throw new Error('Retained Earnings account (3100) not found.')

  if (netToRetained > 0) {
    draftLines.push({
      account_id: reAccount.id,
      debit: 0,
      credit: netToRetained,
      memo: `Year-end close ${fiscalYear}`,
    })
  } else if (netToRetained < 0) {
    draftLines.push({
      account_id: reAccount.id,
      debit: Math.abs(netToRetained),
      credit: 0,
      memo: `Year-end close ${fiscalYear}`,
    })
  }

  const entry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId: null,
    entryDate: `${fiscalYear}-12-31`,
    memo: `Year-end close ${fiscalYear}`,
    sourceType: 'year_end_close',
    sourceId: booksBrandId,
    lines: draftLines,
    postedBy,
    skipPeriodCheck: true,
  })

  await supabase.from('accounting_year_end_closes').insert([
    {
      brand_id: booksBrandId,
      fiscal_year: fiscalYear,
      journal_entry_id: entry.id,
      closed_by: postedBy,
    },
  ])

  await supabase
    .from('accounting_periods')
    .update({ status: 'closed', year_closed: true })
    .eq('brand_id', booksBrandId)
    .eq('year', fiscalYear)

  return { entryNumber: entry.entry_number }
}
