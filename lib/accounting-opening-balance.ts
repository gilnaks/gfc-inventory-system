import type { AccountingJournalEntry } from './supabase'
import { createAndPostJournal, findPostedJournal, type DraftJournalLine } from './accounting-journal-service'
import { getBooksBrandId } from './accounting-books-brand'

export type OpeningBalanceLineInput = {
  account_id: string
  debit: number
  credit: number
}

export async function loadOpeningBalanceEntry(brandId: string): Promise<AccountingJournalEntry | null> {
  const booksBrandId = await getBooksBrandId()
  // brandId kept for signature stability; opening balances live on GFC Main books.
  void brandId
  return findPostedJournal(booksBrandId, 'opening_balance', booksBrandId)
}

export async function postOpeningBalance(params: {
  brandId: string
  entryDate: string
  lines: OpeningBalanceLineInput[]
  postedBy: string
}): Promise<AccountingJournalEntry> {
  const booksBrandId = await getBooksBrandId()
  void params.brandId

  const existing = await loadOpeningBalanceEntry(booksBrandId)
  if (existing) {
    throw new Error(
      `Opening balances already posted (${existing.entry_number}). Reverse that entry before posting again.`
    )
  }

  const draftLines: DraftJournalLine[] = params.lines
    .filter((l) => (Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0)
    .map((l, i) => ({
      account_id: l.account_id,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      line_no: i + 1,
      memo: 'Opening balance',
    }))

  if (!draftLines.length) {
    throw new Error('Enter at least one debit or credit amount.')
  }

  return createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId: null,
    entryDate: params.entryDate,
    memo: 'Opening balances',
    sourceType: 'opening_balance',
    sourceId: booksBrandId,
    lines: draftLines,
    postedBy: params.postedBy,
    skipPeriodCheck: true,
  })
}

export async function loadOpeningBalanceLinesForEdit(
  brandId: string
): Promise<OpeningBalanceLineInput[] | null> {
  const entry = await loadOpeningBalanceEntry(brandId)
  if (!entry?.lines?.length) return null
  return entry.lines.map((l) => ({
    account_id: l.account_id,
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
  }))
}
