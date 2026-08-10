import { supabase } from './supabase'
import type {
  AccountingAccount,
  AccountingJournalEntry,
  AccountingJournalLine,
  AccountingJournalSourceType,
  AccountingVoucherSettings,
} from './supabase'
import { ensureVoucherSettings } from './accounting-voucher-service'
import { applyGlBalances, journalLinesToGlInput, loadAccountsMap } from './accounting-gl-service'
import { isPeriodClosed } from './accounting-period-service'
import { validateBalanced as validateBalancedLines } from './accounting-journal-balance'

/** Statuses that still affect GL running balances (reversals stay visible with their originals). */
const GL_ACTIVITY_STATUSES = ['posted', 'reversed'] as const

export type DraftJournalLine = {
  account_id: string
  debit: number
  credit: number
  line_no?: number
  memo?: string
  voucher_line_id?: string | null
  franchise_brand_id?: string | null
  location_id?: string | null
}

export function validateBalanced(lines: DraftJournalLine[]) {
  return validateBalancedLines(lines)
}

export async function reserveJournalNumber(brandId: string): Promise<string> {
  const settings = await ensureVoucherSettings(brandId)
  const prefix = settings.je_number_prefix || 'JE'
  const seq = settings.je_next_seq ?? 1
  const number = `${prefix}-${String(seq).padStart(5, '0')}`
  await supabase
    .from('accounting_voucher_settings')
    .update({ je_next_seq: seq + 1 })
    .eq('brand_id', brandId)
  return number
}

export async function findPostedJournal(
  brandId: string,
  sourceType: AccountingJournalSourceType,
  sourceId: string
): Promise<AccountingJournalEntry | null> {
  const { data } = await supabase
    .from('accounting_journal_entries')
    .select('*, lines:accounting_journal_lines(*)')
    .eq('brand_id', brandId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .eq('status', 'posted')
    .maybeSingle()
  return data as AccountingJournalEntry | null
}

async function assertEntryDateOpen(brandId: string, entryDate: string) {
  if (await isPeriodClosed(brandId, entryDate)) {
    throw new Error(`Accounting period for ${entryDate} is closed. Reopen the period or choose another date.`)
  }
}

export async function loadJournalEntryById(id: string): Promise<AccountingJournalEntry | null> {
  const { data, error } = await supabase
    .from('accounting_journal_entries')
    .select('*, lines:accounting_journal_lines(*, account:accounting_accounts(code, name, account_type))')
    .eq('id', id)
    .maybeSingle()
  if (error) return null
  return data as AccountingJournalEntry | null
}

export async function saveManualDraftJournal(params: {
  brandId: string
  entryDate: string
  memo: string
  lines: DraftJournalLine[]
  createdBy: string
  existingId?: string
  franchiseBrandId?: string | null
  locationId?: string | null
}): Promise<AccountingJournalEntry> {
  const { ok, debit, credit } = validateBalanced(params.lines)
  if (!ok) {
    throw new Error(`Journal entry is not balanced (debits ${debit} vs credits ${credit})`)
  }
  await assertEntryDateOpen(params.brandId, params.entryDate)

  const franchiseBrandId = params.franchiseBrandId ?? null
  const locationId = params.locationId ?? null

  let entryId = params.existingId
  if (entryId) {
    await supabase
      .from('accounting_journal_entries')
      .update({
        entry_date: params.entryDate,
        memo: params.memo,
        franchise_brand_id: franchiseBrandId,
      })
      .eq('id', entryId)
    await supabase.from('accounting_journal_lines').delete().eq('journal_entry_id', entryId)
  } else {
    const entryNumber = await reserveJournalNumber(params.brandId)
    const { data, error } = await supabase
      .from('accounting_journal_entries')
      .insert([
        {
          brand_id: params.brandId,
          franchise_brand_id: franchiseBrandId,
          entry_number: entryNumber,
          entry_date: params.entryDate,
          memo: params.memo,
          status: 'draft',
          source_type: 'manual',
          source_id: null,
          created_by: params.createdBy,
        },
      ])
      .select()
      .single()
    if (error) throw error
    entryId = data.id
  }

  const lineRows = params.lines.map((l, i) => ({
    journal_entry_id: entryId,
    account_id: l.account_id,
    line_no: l.line_no ?? i + 1,
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
    memo: l.memo || null,
    franchise_brand_id: l.franchise_brand_id ?? franchiseBrandId,
    location_id: l.location_id ?? locationId,
  }))
  const { error: lineErr } = await supabase.from('accounting_journal_lines').insert(lineRows)
  if (lineErr) throw lineErr

  const full = await loadJournalEntryById(entryId!)
  if (!full) throw new Error('Failed to load draft journal')
  return full
}

export async function postDraftJournal(entryId: string, postedBy: string): Promise<AccountingJournalEntry> {
  const entry = await loadJournalEntryById(entryId)
  if (!entry || entry.status !== 'draft') throw new Error('Draft journal entry not found')
  await assertEntryDateOpen(entry.brand_id, entry.entry_date)

  const lines = (entry.lines || []).map((l) => ({
    account_id: l.account_id,
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
  }))
  const { ok, debit, credit } = validateBalanced(lines)
  if (!ok) throw new Error(`Cannot post unbalanced entry (debits ${debit} vs credits ${credit})`)

  const now = new Date().toISOString()
  const { error: postErr } = await supabase
    .from('accounting_journal_entries')
    .update({ status: 'posted', posted_at: now, posted_by: postedBy })
    .eq('id', entryId)
  if (postErr) throw postErr

  const accountsMap = await loadAccountsMap(entry.brand_id)
  try {
    await applyGlBalances(entry.brand_id, entry.entry_date, lines, accountsMap)
  } catch (glErr) {
    // Avoid leaving a posted JE with missing/partial GL impact.
    await supabase
      .from('accounting_journal_entries')
      .update({ status: 'draft', posted_at: null, posted_by: null })
      .eq('id', entryId)
    throw glErr
  }

  const full = await loadJournalEntryById(entryId)
  if (!full) throw new Error('Failed to load posted journal')
  return full
}

export async function reverseJournalEntry(
  entryId: string,
  postedBy: string,
  memo?: string
): Promise<AccountingJournalEntry> {
  const original = await loadJournalEntryById(entryId)
  if (!original || original.status !== 'posted') throw new Error('Posted journal entry not found')

  const revDate = new Date().toISOString().split('T')[0]
  await assertEntryDateOpen(original.brand_id, revDate)

  const lines: DraftJournalLine[] = (original.lines || []).map((l, i) => ({
    account_id: l.account_id,
    debit: Number(l.credit) || 0,
    credit: Number(l.debit) || 0,
    line_no: i + 1,
    memo: `Reversal of ${original.entry_number}`,
    franchise_brand_id: l.franchise_brand_id ?? original.franchise_brand_id ?? null,
    location_id: l.location_id ?? null,
  }))

  const entryNumber = await reserveJournalNumber(original.brand_id)
  const now = new Date().toISOString()
  const { data: revEntry, error: revErr } = await supabase
    .from('accounting_journal_entries')
    .insert([
      {
        brand_id: original.brand_id,
        franchise_brand_id: original.franchise_brand_id ?? null,
        entry_number: entryNumber,
        entry_date: revDate,
        memo: memo || `Reversal of ${original.entry_number}`,
        status: 'posted',
        source_type: 'reversal',
        source_id: original.id,
        reverses_entry_id: original.id,
        posted_at: now,
        posted_by: postedBy,
        created_by: postedBy,
      },
    ])
    .select()
    .single()
  if (revErr) throw revErr

  const lineRows = lines.map((l, i) => ({
    journal_entry_id: revEntry.id,
    account_id: l.account_id,
    line_no: l.line_no ?? i + 1,
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
    memo: l.memo || null,
    franchise_brand_id: l.franchise_brand_id ?? null,
    location_id: l.location_id ?? null,
  }))
  const { error: lineErr } = await supabase.from('accounting_journal_lines').insert(lineRows)
  if (lineErr) {
    await supabase.from('accounting_journal_entries').delete().eq('id', revEntry.id)
    throw lineErr
  }

  const accountsMap = await loadAccountsMap(original.brand_id)
  const glLines = lines.map((l) => ({
    account_id: l.account_id,
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
  }))
  try {
    await applyGlBalances(original.brand_id, revDate, glLines, accountsMap)
  } catch (glErr) {
    await supabase.from('accounting_journal_lines').delete().eq('journal_entry_id', revEntry.id)
    await supabase.from('accounting_journal_entries').delete().eq('id', revEntry.id)
    throw glErr
  }

  const { error: reverseStatusErr } = await supabase
    .from('accounting_journal_entries')
    .update({ status: 'reversed' })
    .eq('id', entryId)
  if (reverseStatusErr) throw reverseStatusErr

  const { voidStaffAdvanceDisbursementForReversedJournal } = await import('./staff-advance-service')
  await voidStaffAdvanceDisbursementForReversedJournal(entryId)

  const full = await loadJournalEntryById(revEntry.id)
  if (!full) throw new Error('Failed to load reversal')
  return full
}

export async function createAndPostJournal(params: {
  brandId: string
  entryDate: string
  memo: string
  sourceType: AccountingJournalSourceType
  sourceId: string | null
  lines: DraftJournalLine[]
  postedBy: string
  createdBy?: string
  skipPeriodCheck?: boolean
  /** Retail/franchise brand for performance filtering (null = HQ/plant). */
  franchiseBrandId?: string | null
  /** Default location on lines when source is store-scoped. */
  locationId?: string | null
}): Promise<AccountingJournalEntry> {
  const { ok, debit, credit } = validateBalanced(params.lines)
  if (!ok) {
    throw new Error(`Journal entry is not balanced (debits ${debit} vs credits ${credit})`)
  }

  if (!params.skipPeriodCheck) {
    await assertEntryDateOpen(params.brandId, params.entryDate)
  }

  if (params.sourceId) {
    const existing = await findPostedJournal(params.brandId, params.sourceType, params.sourceId)
    if (existing) return existing
  }

  const franchiseBrandId = params.franchiseBrandId ?? null
  const locationId = params.locationId ?? null

  const entryNumber = await reserveJournalNumber(params.brandId)
  const now = new Date().toISOString()

  const { data: entry, error: entryErr } = await supabase
    .from('accounting_journal_entries')
    .insert([
      {
        brand_id: params.brandId,
        franchise_brand_id: franchiseBrandId,
        entry_number: entryNumber,
        entry_date: params.entryDate,
        memo: params.memo,
        status: 'posted',
        source_type: params.sourceType,
        source_id: params.sourceId,
        posted_at: now,
        posted_by: params.postedBy,
        created_by: params.createdBy || params.postedBy,
      },
    ])
    .select()
    .single()
  if (entryErr) throw entryErr

  const lineRows = params.lines.map((l, i) => ({
    journal_entry_id: entry.id,
    account_id: l.account_id,
    line_no: l.line_no ?? i + 1,
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
    memo: l.memo || null,
    voucher_line_id: l.voucher_line_id || null,
    franchise_brand_id: l.franchise_brand_id ?? franchiseBrandId,
    location_id: l.location_id ?? locationId,
  }))
  const { error: lineErr } = await supabase.from('accounting_journal_lines').insert(lineRows)
  if (lineErr) throw lineErr

  const accountsMap = await loadAccountsMap(params.brandId)
  try {
    await applyGlBalances(params.brandId, params.entryDate, journalLinesToGlInput(lineRows as AccountingJournalLine[]), accountsMap)
  } catch (glErr) {
    await supabase.from('accounting_journal_lines').delete().eq('journal_entry_id', entry.id)
    await supabase.from('accounting_journal_entries').delete().eq('id', entry.id)
    throw glErr
  }

  const { data: full } = await supabase
    .from('accounting_journal_entries')
    .select('*, lines:accounting_journal_lines(*, account:accounting_accounts(code, name))')
    .eq('id', entry.id)
    .single()

  return full as AccountingJournalEntry
}

export async function loadJournalEntries(
  brandId: string,
  options?: {
    fromDate?: string
    toDate?: string
    status?: string
    includeDrafts?: boolean
    franchiseBrandId?: string | null
    /** When true with franchiseBrandId null, only HQ rows (franchise_brand_id IS NULL). */
    hqOnly?: boolean
  }
): Promise<AccountingJournalEntry[]> {
  let q = supabase
    .from('accounting_journal_entries')
    .select('*, lines:accounting_journal_lines(*, account:accounting_accounts(code, name, account_type))')
    .eq('brand_id', brandId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (options?.status) q = q.eq('status', options.status)
  else if (!options?.includeDrafts) q = q.eq('status', 'posted')
  if (options?.fromDate) q = q.gte('entry_date', options.fromDate)
  if (options?.toDate) q = q.lte('entry_date', options.toDate)
  if (options?.franchiseBrandId) q = q.eq('franchise_brand_id', options.franchiseBrandId)
  else if (options?.hqOnly) q = q.is('franchise_brand_id', null)

  const { data, error } = await q
  if (error) throw error
  return (data || []) as AccountingJournalEntry[]
}

/** Signed balance for an account from all posted JEs strictly before beforeDate (includes opening balance). */
export async function getAccountSignedBalanceBeforeDate(
  brandId: string,
  accountId: string,
  beforeDate: string
): Promise<number> {
  const { data: account } = await supabase
    .from('accounting_accounts')
    .select('normal_balance')
    .eq('id', accountId)
    .single()
  if (!account) return 0

  const { data: lines } = await supabase
    .from('accounting_journal_lines')
    .select('debit, credit, journal_entry:accounting_journal_entries!inner(entry_date, status, brand_id)')
    .eq('account_id', accountId)
    .eq('journal_entry.brand_id', brandId)
    .in('journal_entry.status', [...GL_ACTIVITY_STATUSES])
    .lt('journal_entry.entry_date', beforeDate)

  let running = 0
  const normal = (account as AccountingAccount).normal_balance
  for (const row of lines || []) {
    const d = Number(row.debit) || 0
    const c = Number(row.credit) || 0
    running += normal === 'debit' ? d - c : c - d
  }
  return running
}

/** Signed balance including all posted entries on or before asOfDate. */
export async function getAccountSignedBalanceAsOfDate(
  brandId: string,
  accountId: string,
  asOfDate: string
): Promise<number> {
  const next = new Date(`${asOfDate}T12:00:00`)
  next.setDate(next.getDate() + 1)
  const beforeDate = next.toISOString().split('T')[0]
  return getAccountSignedBalanceBeforeDate(brandId, accountId, beforeDate)
}

/** Signed balance from opening-balance JEs on a single date (period start). */
async function sumOpeningBalanceJeOnDate(
  brandId: string,
  accountId: string,
  normalBalance: 'debit' | 'credit',
  date: string
): Promise<number> {
  const { data: lines } = await supabase
    .from('accounting_journal_lines')
    .select(
      'debit, credit, journal_entry:accounting_journal_entries!inner(entry_date, status, brand_id, source_type)'
    )
    .eq('account_id', accountId)
    .eq('journal_entry.brand_id', brandId)
    .in('journal_entry.status', [...GL_ACTIVITY_STATUSES])
    .eq('journal_entry.entry_date', date)
    .eq('journal_entry.source_type', 'opening_balance')

  let sum = 0
  for (const row of lines || []) {
    const d = Number(row.debit) || 0
    const c = Number(row.credit) || 0
    sum += normalBalance === 'debit' ? d - c : c - d
  }
  return sum
}

/** Opening balance row for account ledger (includes opening-balance JE on period start date). */
export async function getLedgerOpeningBalance(
  brandId: string,
  accountId: string,
  fromDate: string
): Promise<number> {
  const { data: account } = await supabase
    .from('accounting_accounts')
    .select('normal_balance')
    .eq('id', accountId)
    .single()
  if (!account) return 0
  const normal = (account as AccountingAccount).normal_balance
  return (
    (await getAccountSignedBalanceBeforeDate(brandId, accountId, fromDate)) +
    (await sumOpeningBalanceJeOnDate(brandId, accountId, normal, fromDate))
  )
}

export async function loadGlForAccount(
  brandId: string,
  accountId: string,
  fromDate: string,
  toDate: string
): Promise<
  Array<{
    entry_date: string
    entry_number: string
    journal_entry_id: string
    memo: string | null
    source_type: string
    source_id: string | null
    debit: number
    credit: number
    running_balance: number
  }>
> {
  const { data: account } = await supabase
    .from('accounting_accounts')
    .select('*')
    .eq('id', accountId)
    .single()
  if (!account) return []

  const acc = account as AccountingAccount
  const { data: entries } = await supabase
    .from('accounting_journal_entries')
    .select('id, entry_date, entry_number, memo, source_type, source_id')
    .eq('brand_id', brandId)
    .in('status', [...GL_ACTIVITY_STATUSES])
    .gte('entry_date', fromDate)
    .lte('entry_date', toDate)

  const activityEntries = (entries || []).filter(
    (e) => !(e.entry_date === fromDate && e.source_type === 'opening_balance')
  )

  let running = await getLedgerOpeningBalance(brandId, accountId, fromDate)

  const entryIds = activityEntries.map((e) => e.id)
  if (!entryIds.length) return []

  const { data: lines } = await supabase
    .from('accounting_journal_lines')
    .select('debit, credit, memo, journal_entry_id')
    .eq('account_id', accountId)
    .in('journal_entry_id', entryIds)

  const entryMap = new Map(activityEntries.map((e) => [e.id, e]))
  type Row = { debit: number; credit: number; memo: string | null; journal_entry_id: string }
  const sorted = ((lines || []) as Row[]).sort((a, b) => {
    const ea = entryMap.get(a.journal_entry_id)!
    const eb = entryMap.get(b.journal_entry_id)!
    return (
      ea.entry_date.localeCompare(eb.entry_date) || ea.entry_number.localeCompare(eb.entry_number)
    )
  })

  return sorted.map((row) => {
    const je = entryMap.get(row.journal_entry_id)!
    const debit = Number(row.debit) || 0
    const credit = Number(row.credit) || 0
    running += acc.normal_balance === 'debit' ? debit - credit : credit - debit
    return {
      entry_date: je.entry_date,
      entry_number: je.entry_number,
      journal_entry_id: je.id,
      memo: row.memo || je.memo,
      source_type: je.source_type,
      source_id: je.source_id ?? null,
      debit,
      credit,
      running_balance: running,
    }
  })
}

export function getDefaultAccountId(
  settings: AccountingVoucherSettings,
  key: keyof AccountingVoucherSettings
): string | null {
  const v = settings[key]
  return typeof v === 'string' ? v : null
}

export function resolveDefaultAccountId(
  settings: AccountingVoucherSettings,
  key: keyof AccountingVoucherSettings,
  accounts: { id: string; code: string }[],
  fallbackCode: string
): string | null {
  return getDefaultAccountId(settings, key) || accounts.find((a) => a.code === fallbackCode)?.id || null
}
