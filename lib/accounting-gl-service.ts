import { supabase } from './supabase'
import type { AccountingAccount, AccountingJournalLine } from './supabase'
import { ensurePeriod } from './accounting-period-service'

function signedDelta(account: AccountingAccount, debit: number, credit: number): number {
  if (account.normal_balance === 'debit') return debit - credit
  return credit - debit
}

export async function applyGlBalances(
  brandId: string,
  entryDate: string,
  lines: Array<{ account_id: string; debit: number; credit: number }>,
  accountsById: Map<string, AccountingAccount>
): Promise<void> {
  const period = await ensurePeriod(brandId, entryDate)
  for (const line of lines) {
    const account = accountsById.get(line.account_id)
    const d = Number(line.debit) || 0
    const c = Number(line.credit) || 0
    if (!account) {
      if (d || c) throw new Error(`GL account not found: ${line.account_id}`)
      continue
    }
    const delta = signedDelta(account, d, c)

    const { data: row } = await supabase
      .from('accounting_gl_balances')
      .select('*')
      .eq('account_id', line.account_id)
      .eq('period_id', period.id)
      .maybeSingle()

    if (row) {
      const debit_total = Number(row.debit_total) + d
      const credit_total = Number(row.credit_total) + c
      const balance = Number(row.balance) + delta
      const { error } = await supabase
        .from('accounting_gl_balances')
        .update({ debit_total, credit_total, balance, updated_at: new Date().toISOString() })
        .eq('id', row.id)
      if (error) {
        throw new Error(`GL balance update failed for account ${line.account_id}: ${error.message}`)
      }
    } else {
      const { error } = await supabase.from('accounting_gl_balances').insert([
        {
          brand_id: brandId,
          account_id: line.account_id,
          period_id: period.id,
          debit_total: d,
          credit_total: c,
          balance: delta,
        },
      ])
      if (error) {
        throw new Error(`GL balance insert failed for account ${line.account_id}: ${error.message}`)
      }
    }
  }
}

export async function loadAccountsMap(brandId: string): Promise<Map<string, AccountingAccount>> {
  const { data } = await supabase.from('accounting_accounts').select('*').eq('brand_id', brandId)
  return new Map((data || []).map((a) => [a.id, a as AccountingAccount]))
}

export function journalLinesToGlInput(lines: AccountingJournalLine[]) {
  return lines.map((l) => ({
    account_id: l.account_id,
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
  }))
}

/** Negate GL impact for reversals */
export async function reverseGlBalances(
  brandId: string,
  entryDate: string,
  lines: Array<{ account_id: string; debit: number; credit: number }>,
  accountsById: Map<string, AccountingAccount>
): Promise<void> {
  const negated = lines.map((l) => ({
    account_id: l.account_id,
    debit: -(Number(l.debit) || 0),
    credit: -(Number(l.credit) || 0),
  }))
  await applyGlBalances(brandId, entryDate, negated, accountsById)
}
