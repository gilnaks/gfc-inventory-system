import { supabase } from './supabase'
import type { AccountingBankAccount } from './supabase'
import { getAccountSignedBalanceAsOfDate } from './accounting-journal-service'
import {
  groupCashJournalLines,
  type CashGlLineInput,
  type CashGlTransaction,
} from './accounting-bank-grouping'

export type { CashGlTransaction, CashGlLineInput }
export { groupCashJournalLines }

export async function loadBankAccounts(brandId: string): Promise<AccountingBankAccount[]> {
  const { data, error } = await supabase
    .from('accounting_bank_accounts')
    .select('*')
    .eq('brand_id', brandId)
    .order('name')
  if (error) throw error
  return (data || []) as AccountingBankAccount[]
}

export async function saveBankAccount(
  brandId: string,
  row: Partial<AccountingBankAccount> & { name: string; gl_account_id: string }
): Promise<void> {
  const payload = {
    brand_id: brandId,
    name: row.name,
    account_last4: row.account_last4 || null,
    gl_account_id: row.gl_account_id,
    is_active: row.is_active !== false,
  }
  if (row.id) {
    const { error } = await supabase.from('accounting_bank_accounts').update(payload).eq('id', row.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('accounting_bank_accounts').insert([payload])
    if (error) throw error
  }
}

export async function loadGlCashBalanceForPeriod(
  brandId: string,
  cashAccountId: string,
  fromDate: string,
  toDate: string
): Promise<number> {
  const { data: lines } = await supabase
    .from('accounting_journal_lines')
    .select('debit, credit, journal_entry:accounting_journal_entries!inner(entry_date, brand_id, status)')
    .eq('account_id', cashAccountId)
    .eq('journal_entry.brand_id', brandId)
    .in('journal_entry.status', ['posted', 'reversed'])
    .gte('journal_entry.entry_date', fromDate)
    .lte('journal_entry.entry_date', toDate)

  let balance = 0
  for (const row of lines || []) {
    balance += (Number(row.debit) || 0) - (Number(row.credit) || 0)
  }
  return balance
}

export async function loadGlCashBalanceAsOfDate(
  brandId: string,
  cashAccountId: string,
  asOfDate: string
): Promise<number> {
  return getAccountSignedBalanceAsOfDate(brandId, cashAccountId, asOfDate)
}

export async function loadCashGlTransactionsForPeriod(
  brandId: string,
  cashAccountId: string,
  fromDate: string,
  toDate: string
): Promise<CashGlTransaction[]> {
  const { data: lines, error } = await supabase
    .from('accounting_journal_lines')
    .select(
      'debit, credit, journal_entry_id, journal_entry:accounting_journal_entries!inner(id, entry_date, entry_number, memo, source_type, source_id, brand_id, status)'
    )
    .eq('account_id', cashAccountId)
    .eq('journal_entry.brand_id', brandId)
    .in('journal_entry.status', ['posted', 'reversed'])
    .gte('journal_entry.entry_date', fromDate)
    .lte('journal_entry.entry_date', toDate)

  if (error) throw error

  return groupCashJournalLines((lines || []) as unknown as CashGlLineInput[])
}

export async function loadBankReconciliationHistory(brandId: string, limit = 20) {
  const { data, error } = await supabase
    .from('accounting_bank_reconciliations')
    .select('*, bank_account:accounting_bank_accounts(name)')
    .eq('brand_id', brandId)
    .order('statement_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function loadBankReconciliationWithItems(reconciliationId: string) {
  const { data: recon, error } = await supabase
    .from('accounting_bank_reconciliations')
    .select('*, bank_account:accounting_bank_accounts(name)')
    .eq('id', reconciliationId)
    .single()
  if (error) throw error

  const { data: items, error: itemsErr } = await supabase
    .from('accounting_bank_reconciliation_items')
    .select('*')
    .eq('reconciliation_id', reconciliationId)
    .order('created_at')
  if (itemsErr) throw itemsErr

  return { recon, items: items || [] }
}

export async function loadPettyReconciliationHistory(brandId: string, limit = 20) {
  const { data, error } = await supabase
    .from('accounting_petty_cash_reconciliations')
    .select('*')
    .eq('brand_id', brandId)
    .order('count_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}
