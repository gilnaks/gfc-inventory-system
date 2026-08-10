import { supabase } from './supabase'
import type { DraftJournalLine } from './accounting-journal-service'
import {
  createAndPostJournal,
  findPostedJournal,
  resolveDefaultAccountId,
  reverseJournalEntry,
} from './accounting-journal-service'
import {
  formatPayrollAccrualJournalMemo,
  formatPayrollPaymentJournalMemo,
} from './journal-description'
import { loadAccounts } from './accounting-coa-seed'
import { ensureVoucherSettings } from './accounting-voucher-service'
import { withPostingErrorLog } from './accounting-posting-errors'
import { getCashDefaultAccountId } from './resolve-cash-default-account'
import { getBooksBrandId, resolveFranchiseBrandId } from './accounting-books-brand'

async function requirePayrollSettings(brandId: string) {
  return ensureVoucherSettings(brandId)
}

export async function postPayrollRunAccrual(
  payrollRunBrandTotalId: string,
  postedBy: string
): Promise<{ entryNumber: string; journalEntryId: string }> {
  const booksBrandId = await getBooksBrandId()
  return withPostingErrorLog(
    booksBrandId,
    'payroll_run_accrual',
    payrollRunBrandTotalId,
    async () => postPayrollRunAccrualBody(payrollRunBrandTotalId, postedBy, booksBrandId)
  )
}

async function postPayrollRunAccrualBody(
  payrollRunBrandTotalId: string,
  postedBy: string,
  booksBrandId: string
): Promise<{ entryNumber: string; journalEntryId: string }> {
  const { data: brandTotal } = await supabase
    .from('payroll_run_brand_totals')
    .select(
      '*, payroll_run:payroll_runs(week_start_date, week_end_date, status), brand:brands(name)'
    )
    .eq('id', payrollRunBrandTotalId)
    .single()

  if (!brandTotal) throw new Error('Payroll brand total not found')
  if (brandTotal.journal_entry_id_accrual) {
    const { data: je } = await supabase
      .from('accounting_journal_entries')
      .select('entry_number')
      .eq('id', brandTotal.journal_entry_id_accrual)
      .single()
    return {
      entryNumber: je?.entry_number || '—',
      journalEntryId: brandTotal.journal_entry_id_accrual,
    }
  }

  const sourceBrandId = brandTotal.brand_id as string
  const franchiseBrandId = resolveFranchiseBrandId(sourceBrandId, booksBrandId)
  const settings = await requirePayrollSettings(booksBrandId)
  const accounts = await loadAccounts(booksBrandId)

  const payrollExpId = resolveDefaultAccountId(
    settings,
    'default_payroll_expense_account_id',
    accounts,
    '5800'
  )
  const accruedId = resolveDefaultAccountId(
    settings,
    'default_accrued_payroll_account_id',
    accounts,
    '2100'
  )
  const staffAdvId = resolveDefaultAccountId(
    settings,
    'default_staff_advance_account_id',
    accounts,
    '1150'
  )
  const withholdId = accounts.find((a) => a.code === '2110')?.id || accruedId

  if (!payrollExpId || !accruedId) {
    throw new Error('Configure payroll expense (5800) and accrued payroll (2100) in Accounting settings.')
  }

  const grossPay = Number(brandTotal.gross_pay) || 0
  const netPay = Number(brandTotal.net_pay) || 0
  const refunds = Number(brandTotal.refunds) || 0
  const cashAdv = Number(brandTotal.cash_advances_withheld) || 0
  const withholdOther = Number(brandTotal.withholdings_other) || 0

  if (grossPay <= 0 && netPay <= 0) {
    throw new Error('Brand total has no payroll amount to accrue')
  }

  const draftLines: DraftJournalLine[] = []

  if (grossPay > 0) {
    draftLines.push({
      account_id: payrollExpId,
      debit: grossPay,
      credit: 0,
      memo: 'Gross wages',
    })
  }
  if (refunds > 0) {
    draftLines.push({
      account_id: payrollExpId,
      debit: refunds,
      credit: 0,
      memo: 'Staff refunds',
    })
  }
  if (netPay > 0) {
    draftLines.push({
      account_id: accruedId,
      debit: 0,
      credit: netPay,
      memo: 'Net pay accrued',
    })
  }
  if (cashAdv > 0 && staffAdvId) {
    draftLines.push({
      account_id: staffAdvId,
      debit: 0,
      credit: cashAdv,
      memo: 'Cash advance recovery',
    })
  }
  if (withholdOther > 0 && withholdId) {
    draftLines.push({
      account_id: withholdId,
      debit: 0,
      credit: withholdOther,
      memo: 'Payroll withholdings',
    })
  }

  const runRaw = brandTotal.payroll_run as
    | { week_start_date: string; week_end_date: string }
    | { week_start_date: string; week_end_date: string }[]
    | null
  const run = Array.isArray(runRaw) ? runRaw[0] : runRaw
  const brandRaw = brandTotal.brand as { name?: string } | { name?: string }[] | null
  const brandName = (Array.isArray(brandRaw) ? brandRaw[0]?.name : brandRaw?.name) || 'Brand'
  const entryDate = run?.week_end_date || new Date().toISOString().split('T')[0]
  const memo = formatPayrollAccrualJournalMemo(
    brandName,
    run?.week_start_date,
    run?.week_end_date
  )

  const entry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId,
    entryDate,
    memo,
    sourceType: 'payroll_run_accrual',
    sourceId: payrollRunBrandTotalId,
    lines: draftLines,
    postedBy,
  })

  await supabase
    .from('payroll_run_brand_totals')
    .update({ journal_entry_id_accrual: entry.id })
    .eq('id', payrollRunBrandTotalId)

  return { entryNumber: entry.entry_number, journalEntryId: entry.id }
}

export async function postPayrollRunPayment(
  payrollRunBrandTotalId: string,
  voucherId: string,
  postedBy: string,
  creditAccountId?: string
): Promise<{ entryNumber: string }> {
  const { data: brandTotal } = await supabase
    .from('payroll_run_brand_totals')
    .select('*, payroll_run:payroll_runs(week_start_date, week_end_date, status), brand:brands(name)')
    .eq('id', payrollRunBrandTotalId)
    .single()

  if (!brandTotal) throw new Error('Payroll brand total not found')
  if (!brandTotal.journal_entry_id_accrual) {
    throw new Error('Payroll accrual must be posted before payment.')
  }

  const booksBrandId = await getBooksBrandId()
  const sourceBrandId = brandTotal.brand_id as string
  const franchiseBrandId = resolveFranchiseBrandId(sourceBrandId, booksBrandId)

  return withPostingErrorLog(booksBrandId, 'payroll_run_payment', payrollRunBrandTotalId, async () => {
    const existing = await findPostedJournal(booksBrandId, 'payroll_run_payment', payrollRunBrandTotalId)
    if (existing) {
      return { entryNumber: existing.entry_number }
    }

    const settings = await requirePayrollSettings(booksBrandId)
    const accounts = await loadAccounts(booksBrandId)
    const accruedId = resolveDefaultAccountId(
      settings,
      'default_accrued_payroll_account_id',
      accounts,
      '2100'
    )
    const cashId = creditAccountId || getCashDefaultAccountId(settings, 'payroll_run_payment')
    if (!accruedId || !cashId) {
      throw new Error(
        'Configure accrued payroll (2100) and Cash — payroll payment (or Cash fallback) in Accounting settings.'
      )
    }

    const netPay = Number(brandTotal.net_pay) || 0
    if (netPay <= 0) throw new Error('No net pay amount to disburse')

    const runRaw = brandTotal.payroll_run as
      | { week_start_date: string; week_end_date: string }
      | { week_start_date: string; week_end_date: string }[]
      | null
    const run = Array.isArray(runRaw) ? runRaw[0] : runRaw
    const brandRaw = brandTotal.brand as { name?: string } | { name?: string }[] | null
    const brandName = (Array.isArray(brandRaw) ? brandRaw[0]?.name : brandRaw?.name) || 'Brand'
    const entryDate = run?.week_end_date || new Date().toISOString().split('T')[0]

    const entry = await createAndPostJournal({
      brandId: booksBrandId,
      franchiseBrandId,
      entryDate,
      memo: formatPayrollPaymentJournalMemo(brandName, run?.week_start_date, run?.week_end_date),
      sourceType: 'payroll_run_payment',
      sourceId: payrollRunBrandTotalId,
      lines: [
        { account_id: accruedId, debit: netPay, credit: 0, memo: 'Clear accrued payroll' },
        { account_id: cashId, debit: 0, credit: netPay, memo: 'Net pay paid' },
      ],
      postedBy,
    })

    await supabase
      .from('payroll_run_brand_totals')
      .update({
        journal_entry_id_payment: entry.id,
        payment_voucher_id: voucherId,
      })
      .eq('id', payrollRunBrandTotalId)

    const { data: allBrands } = await supabase
      .from('payroll_run_brand_totals')
      .select('journal_entry_id_payment')
      .eq('payroll_run_id', brandTotal.payroll_run_id)

    const allPaid = (allBrands || []).every((b) => b.journal_entry_id_payment)
    if (allPaid) {
      await supabase
        .from('payroll_runs')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', brandTotal.payroll_run_id)
    }

    return { entryNumber: entry.entry_number }
  })
}

export async function voidPayrollRunAccruals(payrollRunId: string, postedBy: string): Promise<void> {
  const { data: brandTotals } = await supabase
    .from('payroll_run_brand_totals')
    .select('id, journal_entry_id_accrual')
    .eq('payroll_run_id', payrollRunId)

  for (const bt of brandTotals || []) {
    if (bt.journal_entry_id_accrual) {
      await reverseJournalEntry(bt.journal_entry_id_accrual, postedBy, 'Payroll run voided')
      await supabase
        .from('payroll_run_brand_totals')
        .update({ journal_entry_id_accrual: null })
        .eq('id', bt.id)
    }
  }
}
