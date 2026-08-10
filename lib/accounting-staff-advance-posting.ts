import { supabase } from './supabase'
import { loadAccounts } from './accounting-coa-seed'
import { createAndPostJournal, findPostedJournal, type DraftJournalLine } from './accounting-journal-service'
import { formatStaffAdvanceJournalMemo } from './journal-description'
import { ensureVoucherSettings } from './accounting-voucher-service'
import { activateStaffAdvanceDisbursement, linkStaffAdvanceVoucher } from './staff-advance-service'
import { getCashDefaultAccountId } from './resolve-cash-default-account'
import { getBooksBrandId, resolveFranchiseBrandId } from './accounting-books-brand'

async function resolveStaffAdvanceAccountId(booksBrandId: string): Promise<string> {
  const settings = await ensureVoucherSettings(booksBrandId)
  const accounts = await loadAccounts(booksBrandId)
  const staffAdvId =
    settings.default_staff_advance_account_id ||
    accounts.find((a) => a.code === '1150')?.id ||
    null
  if (!staffAdvId) {
    throw new Error('Configure staff advances account (1150) in Accounting settings.')
  }
  return staffAdvId
}

export async function postStaffAdvanceDisbursementFromVoucher(
  disbursementId: string,
  voucherId: string,
  brandId: string,
  postedBy: string,
  voucherDate: string,
  creditAccountId?: string
): Promise<{ entryNumber: string; journalEntryId: string }> {
  const booksBrandId = await getBooksBrandId()

  const { data: disbursement } = await supabase
    .from('staff_advance_disbursements')
    .select('*, staff:staff_registrations(full_name)')
    .eq('id', disbursementId)
    .single()

  if (!disbursement) throw new Error('Staff advance disbursement not found')
  if (disbursement.status === 'void') throw new Error('Staff advance disbursement is void')

  const existing = await findPostedJournal(booksBrandId, 'staff_advance_disbursement', disbursementId)
  if (existing) {
    await linkStaffAdvanceVoucher(disbursementId, voucherId)
    await activateStaffAdvanceDisbursement(disbursementId)
    return {
      entryNumber: existing.entry_number,
      journalEntryId: existing.id,
    }
  }

  const sourceBrandId = (disbursement.brand_id as string) || brandId
  const franchiseBrandId = resolveFranchiseBrandId(sourceBrandId, booksBrandId)

  const settings = await ensureVoucherSettings(booksBrandId)
  const staffAdvId = await resolveStaffAdvanceAccountId(booksBrandId)
  const cashId = creditAccountId || getCashDefaultAccountId(settings, 'staff_advance_disbursement')
  if (!cashId) {
    throw new Error(
      'Cash — staff advances (or Cash fallback) not configured in Accounting settings.'
    )
  }

  const amount = Number(disbursement.amount) || 0
  if (amount <= 0) throw new Error('Staff advance amount must be greater than zero')

  const staffRaw = disbursement.staff as { full_name?: string } | { full_name?: string }[] | null
  const staffName = (Array.isArray(staffRaw) ? staffRaw[0]?.full_name : staffRaw?.full_name) || 'Staff'

  const draftLines: DraftJournalLine[] = [
    {
      account_id: staffAdvId,
      debit: amount,
      credit: 0,
      memo: `Staff advance — ${staffName}`,
    },
    {
      account_id: cashId,
      debit: 0,
      credit: amount,
      memo: 'Staff advance paid',
    },
  ]

  const entry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId,
    entryDate: voucherDate,
    memo: formatStaffAdvanceJournalMemo(staffName),
    sourceType: 'staff_advance_disbursement',
    sourceId: disbursementId,
    lines: draftLines,
    postedBy,
  })

  await linkStaffAdvanceVoucher(disbursementId, voucherId)
  await activateStaffAdvanceDisbursement(disbursementId)

  return { entryNumber: entry.entry_number, journalEntryId: entry.id }
}
