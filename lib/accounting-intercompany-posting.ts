import { supabase } from './supabase'
import type { IntercompanyTransfer, IntercompanyTransferLine } from './supabase'
import { createAndPostJournal, findPostedJournal } from './accounting-journal-service'
import {
  formatIntercompanySettlementJournalMemo,
  formatIntercompanyTransferJournalMemo,
} from './journal-description'
import { ensureVoucherSettings } from './accounting-voucher-service'
import { loadAccounts } from './accounting-coa-seed'
import { withPostingErrorLog } from './accounting-posting-errors'
import {
  DUE_FROM_BY_RETAIL_SLUG,
  ensureIntercompanyTransferPostingReady,
} from './accounting-intercompany-coa'
import { getBooksBrandId, resolveFranchiseBrandId } from './accounting-books-brand'

type ResolvedCostTransferAccounts = {
  cogsId: string
  inventoryGfcId: string
}

type ResolvedSettlementAccounts = {
  dueFromId: string
  gfcCashId: string
}

function missingAccountLabel(key: string): string {
  const labels: Record<string, string> = {
    cogsId: 'Intercompany COGS (GFC 5510)',
    inventoryGfcId: 'Inventory (GFC 1200)',
    dueFromId: 'Due from brand (GFC 111x)',
    gfcCashId: 'Cash (GFC)',
  }
  return labels[key] || key
}

export function hasLegacyIntercompanyMarkup(transfer: IntercompanyTransfer): boolean {
  return (Number(transfer.margin_total) || 0) > 0.005
}

export function transferRequiresSettlement(transfer: IntercompanyTransfer): boolean {
  return hasLegacyIntercompanyMarkup(transfer) && !transfer.settled_at
}

async function resolveCostTransferAccounts(
  booksBrandId: string,
  toBrandId: string
): Promise<ResolvedCostTransferAccounts> {
  await ensureIntercompanyTransferPostingReady(booksBrandId, toBrandId)

  const gfcSettings = await ensureVoucherSettings(booksBrandId)
  const gfcAccounts = await loadAccounts(booksBrandId)

  const cogsId =
    gfcSettings.default_intercompany_cogs_account_id ||
    gfcAccounts.find((a) => a.code === '5510')?.id
  const inventoryGfcId =
    gfcSettings.default_inventory_account_id ||
    gfcAccounts.find((a) => a.code === '1200')?.id

  const resolved = { cogsId, inventoryGfcId }
  const missing = Object.entries(resolved)
    .filter(([, id]) => !id)
    .map(([key]) => missingAccountLabel(key))

  if (missing.length) {
    throw new Error(
      `Intercompany accounts missing on GFC Main: ${missing.join(', ')}. Open Accounting on GFC Main to seed the chart of accounts, then retry.`
    )
  }

  return resolved as ResolvedCostTransferAccounts
}

async function resolveSettlementAccounts(
  transfer: IntercompanyTransfer,
  booksBrandId: string
): Promise<ResolvedSettlementAccounts> {
  await ensureIntercompanyTransferPostingReady(booksBrandId, transfer.to_brand_id)

  const [{ data: pairSettings }, { data: retailBrand }, gfcSettings] = await Promise.all([
    supabase
      .from('intercompany_brand_settings')
      .select('*')
      .eq('factory_brand_id', booksBrandId)
      .eq('retail_brand_id', transfer.to_brand_id)
      .maybeSingle(),
    supabase.from('brands').select('slug').eq('id', transfer.to_brand_id).maybeSingle(),
    ensureVoucherSettings(booksBrandId),
  ])

  const gfcAccounts = await loadAccounts(booksBrandId)
  const dueFromCode = retailBrand?.slug ? DUE_FROM_BY_RETAIL_SLUG[retailBrand.slug] : undefined

  const dueFromId =
    pairSettings?.due_from_account_id ||
    (dueFromCode ? gfcAccounts.find((a) => a.code === dueFromCode)?.id : undefined) ||
    gfcAccounts.find((a) => a.code.startsWith('111'))?.id
  const gfcCashId =
    gfcSettings.default_cash_account_id || gfcAccounts.find((a) => a.code === '1000')?.id

  const resolved = { dueFromId, gfcCashId }
  const missing = Object.entries(resolved)
    .filter(([, id]) => !id)
    .map(([key]) => missingAccountLabel(key))

  if (missing.length) {
    throw new Error(
      `Intercompany settlement accounts missing on GFC Main: ${missing.join(', ')}. Open Accounting on GFC Main to seed the chart of accounts, then retry.`
    )
  }

  return resolved as ResolvedSettlementAccounts
}

/**
 * Single GFC journal for FG transfer at cost, tagged with receiving franchise.
 * Returns fromEntryId = toEntryId (same JE) for backward-compatible callers.
 */
export async function postIntercompanyTransferJournals(
  transfer: IntercompanyTransfer,
  lines: IntercompanyTransferLine[],
  postedBy: string
): Promise<{ fromEntryId: string; toEntryId: string }> {
  const booksBrandId = await getBooksBrandId()
  return withPostingErrorLog(booksBrandId, 'intercompany_transfer', transfer.id, () =>
    postIntercompanyTransferJournalsBody(transfer, lines, postedBy, booksBrandId)
  )
}

async function postIntercompanyTransferJournalsBody(
  transfer: IntercompanyTransfer,
  lines: IntercompanyTransferLine[],
  postedBy: string,
  booksBrandId: string
): Promise<{ fromEntryId: string; toEntryId: string }> {
  if (!lines.length) throw new Error('Transfer has no lines')

  const costAmount = Number(transfer.cost_amount_total) || 0
  if (costAmount <= 0) throw new Error('Transfer cost must be greater than zero')

  const franchiseBrandId = resolveFranchiseBrandId(transfer.to_brand_id, booksBrandId)
  const { cogsId, inventoryGfcId } = await resolveCostTransferAccounts(
    booksBrandId,
    transfer.to_brand_id
  )

  const fromBrandRaw = transfer.from_brand as { name?: string } | { name?: string }[] | null | undefined
  const toBrandRaw = transfer.to_brand as { name?: string } | { name?: string }[] | null | undefined
  const fromBrandName = (Array.isArray(fromBrandRaw) ? fromBrandRaw[0]?.name : fromBrandRaw?.name)?.trim()
  const toBrandName = (Array.isArray(toBrandRaw) ? toBrandRaw[0]?.name : toBrandRaw?.name)?.trim()
  const memo = formatIntercompanyTransferJournalMemo(fromBrandName, toBrandName)
  const entryDate = transfer.transfer_date

  const existing = await findPostedJournal(booksBrandId, 'intercompany_transfer', transfer.id)
  if (existing) {
    return { fromEntryId: existing.id, toEntryId: existing.id }
  }

  const gfcEntry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId,
    entryDate,
    memo,
    sourceType: 'intercompany_transfer',
    sourceId: transfer.id,
    postedBy,
    lines: [
      { account_id: cogsId, debit: costAmount, credit: 0, memo: 'Intercompany COGS' },
      { account_id: inventoryGfcId, debit: 0, credit: costAmount, memo: 'Inventory shipped at cost' },
    ],
  })

  return { fromEntryId: gfcEntry.id, toEntryId: gfcEntry.id }
}

/** Legacy retail settlement — posts on GFC books with franchise tag (Due to cleared via cash on GFC). */
export async function postIntercompanyTransferSettlementRetail(
  transfer: IntercompanyTransfer,
  postedBy: string,
  entryDate?: string,
  creditAccountId?: string
): Promise<{ toEntryId: string }> {
  if (transfer.status !== 'posted') {
    throw new Error('Only posted transfers can be settled')
  }

  const transferPrice = Number(transfer.transfer_price_total) || 0
  if (transferPrice <= 0) throw new Error('Transfer price must be greater than zero')

  if (transfer.settlement_journal_entry_id_to) {
    return { toEntryId: transfer.settlement_journal_entry_id_to }
  }

  const booksBrandId = await getBooksBrandId()
  const franchiseBrandId = resolveFranchiseBrandId(transfer.to_brand_id, booksBrandId)
  const { dueFromId, gfcCashId } = await resolveSettlementAccounts(transfer, booksBrandId)
  // Retail PV payment: clear Due from on GFC (cash received conceptually from franchise channel).
  // Prefer GFC cash unless voucher supplies a credit account on GFC books.
  const cashCreditId = creditAccountId || gfcCashId
  const fromBrandRaw = transfer.from_brand as { name?: string } | { name?: string }[] | null | undefined
  const toBrandRaw = transfer.to_brand as { name?: string } | { name?: string }[] | null | undefined
  const fromBrandName = (Array.isArray(fromBrandRaw) ? fromBrandRaw[0]?.name : fromBrandRaw?.name)?.trim()
  const toBrandName = (Array.isArray(toBrandRaw) ? toBrandRaw[0]?.name : toBrandRaw?.name)?.trim()
  const memo = formatIntercompanySettlementJournalMemo(fromBrandName, toBrandName)
  const date = entryDate || new Date().toISOString().split('T')[0]

  const existing = await findPostedJournal(
    booksBrandId,
    'intercompany_transfer_settlement',
    transfer.id
  )
  if (existing) {
    await supabase
      .from('intercompany_transfers')
      .update({ settlement_journal_entry_id_to: existing.id })
      .eq('id', transfer.id)
    return { toEntryId: existing.id }
  }

  // Franchise pays GFC: Dr Cash / Cr Due from (same as GFC receipt side under consolidated books)
  const entry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId,
    entryDate: date,
    memo,
    sourceType: 'intercompany_transfer_settlement',
    sourceId: transfer.id,
    postedBy,
    lines: [
      { account_id: cashCreditId, debit: transferPrice, credit: 0, memo: 'Cash received from franchise' },
      { account_id: dueFromId, debit: 0, credit: transferPrice, memo: 'Clear due from brand' },
    ],
  })

  await supabase
    .from('intercompany_transfers')
    .update({
      settlement_journal_entry_id_to: entry.id,
      settlement_journal_entry_id_from: entry.id,
    })
    .eq('id', transfer.id)

  return { toEntryId: entry.id }
}

export async function postIntercompanyTransferSettlementGfc(
  transfer: IntercompanyTransfer,
  postedBy: string,
  entryDate?: string
): Promise<{ fromEntryId: string }> {
  if (transfer.status !== 'posted') {
    throw new Error('Only posted transfers can be settled')
  }

  const transferPrice = Number(transfer.transfer_price_total) || 0
  if (transferPrice <= 0) throw new Error('Transfer price must be greater than zero')

  if (transfer.settlement_journal_entry_id_from) {
    return { fromEntryId: transfer.settlement_journal_entry_id_from }
  }

  // If retail settlement already posted the single GFC JE, reuse it
  if (transfer.settlement_journal_entry_id_to) {
    await supabase
      .from('intercompany_transfers')
      .update({ settlement_journal_entry_id_from: transfer.settlement_journal_entry_id_to })
      .eq('id', transfer.id)
    return { fromEntryId: transfer.settlement_journal_entry_id_to }
  }

  const booksBrandId = await getBooksBrandId()
  const franchiseBrandId = resolveFranchiseBrandId(transfer.to_brand_id, booksBrandId)
  const { dueFromId, gfcCashId } = await resolveSettlementAccounts(transfer, booksBrandId)
  const fromBrandRaw = transfer.from_brand as { name?: string } | { name?: string }[] | null | undefined
  const toBrandRaw = transfer.to_brand as { name?: string } | { name?: string }[] | null | undefined
  const fromBrandName = (Array.isArray(fromBrandRaw) ? fromBrandRaw[0]?.name : fromBrandRaw?.name)?.trim()
  const toBrandName = (Array.isArray(toBrandRaw) ? toBrandRaw[0]?.name : toBrandRaw?.name)?.trim()
  const memo = formatIntercompanySettlementJournalMemo(fromBrandName, toBrandName)
  const date = entryDate || transfer.settled_at?.split('T')[0] || new Date().toISOString().split('T')[0]

  const existing = await findPostedJournal(
    booksBrandId,
    'intercompany_transfer_settlement',
    transfer.id
  )
  if (existing) {
    return { fromEntryId: existing.id }
  }

  const gfcEntry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId,
    entryDate: date,
    memo,
    sourceType: 'intercompany_transfer_settlement',
    sourceId: transfer.id,
    postedBy,
    lines: [
      { account_id: gfcCashId, debit: transferPrice, credit: 0, memo: 'Cash received from franchise' },
      { account_id: dueFromId, debit: 0, credit: transferPrice, memo: 'Clear due from brand' },
    ],
  })

  return { fromEntryId: gfcEntry.id }
}

export async function postIntercompanyTransferPaymentFromVoucher(
  transferId: string,
  voucherId: string,
  brandId: string,
  postedBy: string,
  entryDate: string,
  creditAccountId?: string
): Promise<{ entryNumber: string; journalEntryId: string }> {
  const { data: transfer, error } = await supabase
    .from('intercompany_transfers')
    .select('*, from_brand:brands!intercompany_transfers_from_brand_id_fkey(id, name)')
    .eq('id', transferId)
    .single()
  if (error) throw error
  if (!transfer) throw new Error('Intercompany transfer not found')

  const row = transfer as IntercompanyTransfer
  const booksBrandId = await getBooksBrandId()
  // Voucher may be on GFC books; franchise is receiving brand
  if (row.to_brand_id !== brandId && brandId !== booksBrandId) {
    throw new Error('Transfer does not belong to this brand')
  }
  if (row.settlement_journal_entry_id_to) {
    const { data: je } = await supabase
      .from('accounting_journal_entries')
      .select('entry_number')
      .eq('id', row.settlement_journal_entry_id_to)
      .single()
    return {
      entryNumber: je?.entry_number || '—',
      journalEntryId: row.settlement_journal_entry_id_to,
    }
  }

  const { toEntryId } = await postIntercompanyTransferSettlementRetail(
    row,
    postedBy,
    entryDate,
    creditAccountId
  )

  await supabase
    .from('accounting_vouchers')
    .update({ journal_entry_id: toEntryId, posted_at: new Date().toISOString() })
    .eq('id', voucherId)

  const { data: je } = await supabase
    .from('accounting_journal_entries')
    .select('entry_number')
    .eq('id', toEntryId)
    .single()

  return { entryNumber: je?.entry_number || '—', journalEntryId: toEntryId }
}
