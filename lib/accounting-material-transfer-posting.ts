import type { MaterialTransfer, MaterialTransferLine } from './supabase'
import { createAndPostJournal, findPostedJournal } from './accounting-journal-service'
import { formatMaterialTransferJournalMemo } from './journal-description'
import { withPostingErrorLog } from './accounting-posting-errors'
import { ensureVoucherSettings } from './accounting-voucher-service'
import { loadAccounts } from './accounting-coa-seed'
import { ensureIntercompanyTransferPostingReady } from './accounting-intercompany-coa'
import { getBooksBrandId, resolveFranchiseBrandId } from './accounting-books-brand'

type ResolvedMaterialTransferAccounts = {
  cogsId: string
  inventoryGfcId: string
}

async function resolveMaterialTransferAccounts(
  booksBrandId: string,
  toBrandId: string
): Promise<ResolvedMaterialTransferAccounts> {
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
    .map(([key]) => key)

  if (missing.length) {
    throw new Error(
      `Material transfer accounts missing on GFC Main: ${missing.join(', ')}. Open Accounting on GFC Main to seed the chart of accounts, then retry.`
    )
  }

  return resolved as ResolvedMaterialTransferAccounts
}

/** Single GFC journal for material transfer; toEntryId mirrors fromEntryId. */
export async function postMaterialTransferJournals(
  transfer: MaterialTransfer,
  lines: MaterialTransferLine[],
  postedBy: string
): Promise<{ fromEntryId: string; toEntryId: string }> {
  const booksBrandId = await getBooksBrandId()
  return withPostingErrorLog(booksBrandId, 'material_transfer', transfer.id, () =>
    postMaterialTransferJournalsBody(transfer, lines, postedBy, booksBrandId)
  )
}

async function postMaterialTransferJournalsBody(
  transfer: MaterialTransfer,
  lines: MaterialTransferLine[],
  postedBy: string,
  booksBrandId: string
): Promise<{ fromEntryId: string; toEntryId: string }> {
  if (!lines.length) throw new Error('Transfer has no lines')

  const costAmount = Number(transfer.cost_amount_total) || 0
  if (costAmount <= 0) throw new Error('Transfer cost must be greater than zero')

  const franchiseBrandId = resolveFranchiseBrandId(transfer.to_brand_id, booksBrandId)
  const { cogsId, inventoryGfcId } = await resolveMaterialTransferAccounts(
    booksBrandId,
    transfer.to_brand_id
  )

  const fromBrandRaw = transfer.from_brand as { name?: string } | { name?: string }[] | null | undefined
  const toBrandRaw = transfer.to_brand as { name?: string } | { name?: string }[] | null | undefined
  const fromBrandName = (Array.isArray(fromBrandRaw) ? fromBrandRaw[0]?.name : fromBrandRaw?.name)?.trim()
  const toBrandName = (Array.isArray(toBrandRaw) ? toBrandRaw[0]?.name : toBrandRaw?.name)?.trim()
  const memo = formatMaterialTransferJournalMemo(fromBrandName, toBrandName)
  const entryDate = transfer.transfer_date

  const existing = await findPostedJournal(booksBrandId, 'material_transfer', transfer.id)
  if (existing) {
    return { fromEntryId: existing.id, toEntryId: existing.id }
  }

  const gfcEntry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId,
    entryDate,
    memo,
    sourceType: 'material_transfer',
    sourceId: transfer.id,
    postedBy,
    lines: [
      { account_id: cogsId, debit: costAmount, credit: 0, memo: 'Materials COGS' },
      { account_id: inventoryGfcId, debit: 0, credit: costAmount, memo: 'Materials shipped at cost' },
    ],
  })

  return { fromEntryId: gfcEntry.id, toEntryId: gfcEntry.id }
}
