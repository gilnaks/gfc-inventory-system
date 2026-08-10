import { supabase } from './supabase'
import { ensureVoucherSettings } from './accounting-voucher-service'
import { createAndPostJournal, findPostedJournal, getDefaultAccountId } from './accounting-journal-service'
import type { DraftJournalLine } from './accounting-journal-service'
import { withPostingErrorLog } from './accounting-posting-errors'
import { formatCustomerOrderJournalMemo } from './journal-description'
import {
  computeOrderCogsTotal,
  formatOrderCogsError,
} from './accounting-order-cogs'
import { getBooksBrandId, resolveFranchiseBrandId } from './accounting-books-brand'

const COGS_SOURCE_TYPE = 'customer_order_cogs' as const

/** Post COGS at fulfill: Dr COGS / Cr Inventory using product BOM material costs */
export async function postCogsForFulfilledOrder(
  orderId: string,
  brandId: string,
  postedBy: string
): Promise<void> {
  const booksBrandId = await getBooksBrandId()
  return withPostingErrorLog(booksBrandId, 'customer_order_cogs', orderId, () =>
    postCogsForFulfilledOrderBody(orderId, brandId, postedBy, booksBrandId)
  )
}

async function postCogsForFulfilledOrderBody(
  orderId: string,
  brandId: string,
  postedBy: string,
  booksBrandId: string
): Promise<void> {
  const { data: order } = await supabase
    .from('customer_orders')
    .select(
      'id, brand_id, status, journal_entry_id_cogs, updated_at, created_at, customer_name, location_id, location:locations(name)'
    )
    .eq('id', orderId)
    .single()
  if (!order || order.brand_id !== brandId) return
  if (order.journal_entry_id_cogs) return
  const existing = await findPostedJournal(booksBrandId, COGS_SOURCE_TYPE, orderId)
  if (existing) return
  if (order.status !== 'fulfilled' && order.status !== 'paid' && order.status !== 'complete') return

  const breakdown = await computeOrderCogsTotal(orderId)
  const cogsTotal = breakdown.total
  if (cogsTotal <= 0) {
    const detail = formatOrderCogsError(breakdown)
    const suffix = breakdown.loadError
      ? ''
      : '. Configure product BOM and material unit costs in the Products tab.'
    throw new Error(`Cannot post COGS: ${detail}${suffix}`)
  }

  const franchiseBrandId = resolveFranchiseBrandId(brandId, booksBrandId)
  const settings = await ensureVoucherSettings(booksBrandId)
  const cogsId =
    (await supabase
      .from('accounting_accounts')
      .select('id')
      .eq('brand_id', booksBrandId)
      .eq('code', '5000')
      .maybeSingle()).data?.id || null
  const invId = getDefaultAccountId(settings, 'default_inventory_account_id')
  if (!cogsId || !invId) {
    throw new Error(
      'Cannot post COGS: Cost of Goods Sold (5000) or default Inventory account is not configured in Accounting settings.'
    )
  }

  const lines: DraftJournalLine[] = [
    { account_id: cogsId, debit: cogsTotal, credit: 0, memo: 'COGS' },
    { account_id: invId, debit: 0, credit: cogsTotal, memo: 'Inventory relief' },
  ]

  const entryDate = (order.updated_at || order.created_at || new Date().toISOString()).split(
    'T'
  )[0]

  const entry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId,
    locationId: order.location_id || null,
    entryDate,
    memo: formatCustomerOrderJournalMemo('COGS', order),
    sourceType: COGS_SOURCE_TYPE,
    sourceId: orderId,
    lines,
    postedBy,
  })

  await supabase
    .from('customer_orders')
    .update({ journal_entry_id_cogs: entry.id })
    .eq('id', orderId)
}

export async function reverseCogsForOrder(
  orderId: string,
  brandId: string,
  postedBy: string
): Promise<void> {
  const { data: order } = await supabase
    .from('customer_orders')
    .select('id, brand_id, journal_entry_id_cogs')
    .eq('id', orderId)
    .single()
  if (!order || order.brand_id !== brandId || !order.journal_entry_id_cogs) return

  const { reverseJournalEntry } = await import('./accounting-journal-service')
  await reverseJournalEntry(order.journal_entry_id_cogs, postedBy, 'COGS reversal')
  await supabase.from('customer_orders').update({ journal_entry_id_cogs: null }).eq('id', orderId)
}

/** Reverse posted revenue, cash, and COGS journals when an order is cancelled after fulfillment. */
export async function reverseOrderAccountingOnCancel(
  orderId: string,
  brandId: string,
  postedBy: string
): Promise<void> {
  const { data: order } = await supabase
    .from('customer_orders')
    .select(
      'brand_id, journal_entry_id_revenue, journal_entry_id_cash, journal_entry_id_cogs'
    )
    .eq('id', orderId)
    .single()
  if (!order || order.brand_id !== brandId) return

  const { reverseJournalEntry } = await import('./accounting-journal-service')
  const ids = [
    order.journal_entry_id_cash,
    order.journal_entry_id_revenue,
    order.journal_entry_id_cogs,
  ].filter(Boolean) as string[]

  for (const jeId of ids) {
    try {
      await reverseJournalEntry(jeId, postedBy, `Order ${orderId.slice(0, 8)} cancelled`)
    } catch {
      /* already reversed or period closed */
    }
  }

  await supabase
    .from('customer_orders')
    .update({
      journal_entry_id_revenue: null,
      journal_entry_id_cash: null,
      journal_entry_id_cogs: null,
    })
    .eq('id', orderId)
}
