import { supabase } from './supabase'
import type { AccountingVoucher, AccountingVoucherSettings } from './supabase'
import type { DraftJournalLine } from './accounting-journal-service'
import { ensureVoucherSettings, loadVoucherById } from './accounting-voucher-service'
import { ensureProcurementPostingAccounts, loadAccounts } from './accounting-coa-seed'
import { createAndPostJournal, findPostedJournal, getDefaultAccountId, resolveDefaultAccountId } from './accounting-journal-service'
import {
  getOrderDeliveryIncome,
  getOrderSalesRevenue,
  getOrderTotalAmount,
  type OrderTotalInput,
} from './order-totals'
import { withPostingErrorLog } from './accounting-posting-errors'
import {
  formatCustomerOrderJournalMemo,
  formatDeliveryReceiptJournalMemo,
  formatPettyCashVoucherJournalMemo,
} from './journal-description'
import { resolvePaymentVoucherJournalDescription } from './journal-source-resolver'
import { resolvePaymentVoucherCreditAccount } from './resolve-payment-voucher-credit-account'
import { resolveCustomerOrderCashAccount } from './resolve-customer-order-cash-account'
import { getBooksBrandId, resolveFranchiseBrandId } from './accounting-books-brand'

async function requireSettings(brandId: string): Promise<AccountingVoucherSettings> {
  return ensureVoucherSettings(brandId)
}

function expenseAccountForLine(
  settings: AccountingVoucherSettings,
  debitAccountId: string | null | undefined,
  accounts: { id: string; code: string }[]
): string {
  if (debitAccountId) return debitAccountId
  const misc = accounts.find((a) => a.code === '5500')
  return misc?.id || getDefaultAccountId(settings, 'default_cash_account_id')!
}

async function paymentVoucherJournalMemo(voucher: AccountingVoucher): Promise<string> {
  return resolvePaymentVoucherJournalDescription(voucher)
}

export async function postJournalFromVoucher(
  voucherId: string,
  postedBy: string
): Promise<{ entryNumber: string }> {
  const voucher = await loadVoucherById(voucherId)
  if (!voucher) throw new Error('Voucher not found')
  const sourceType =
    voucher.voucher_type === 'payment' ? 'payment_voucher' : 'petty_cash_voucher'
  return withPostingErrorLog(voucher.brand_id, sourceType, voucherId, () =>
    postJournalFromVoucherBody(voucher, postedBy)
  )
}

async function postJournalFromVoucherBody(
  voucher: AccountingVoucher,
  postedBy: string
): Promise<{ entryNumber: string }> {
  if (voucher.journal_entry_id) {
    const { data: je } = await supabase
      .from('accounting_journal_entries')
      .select('entry_number')
      .eq('id', voucher.journal_entry_id)
      .single()
    return { entryNumber: je?.entry_number || '—' }
  }

  const settings = await requireSettings(voucher.brand_id)
  const accounts = await loadAccounts(voucher.brand_id)
  const pettyId = getDefaultAccountId(settings, 'default_petty_cash_account_id')
  const apId = getDefaultAccountId(settings, 'default_ap_account_id')
  const lines = voucher.lines || []
  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const creditAccount =
    voucher.voucher_type === 'payment'
      ? await resolvePaymentVoucherCreditAccount(voucher, settings)
      : null
  const franchiseBrandId = voucher.franchise_brand_id ?? null

  const intercompanyLink = voucher.links?.find((l) => l.source_type === 'intercompany_transfer')
  if (intercompanyLink && voucher.voucher_type === 'payment') {
    if (voucher.status !== 'paid') throw new Error('Payment voucher must be paid before posting')
    const { postIntercompanyTransferPaymentFromVoucher } = await import('./accounting-intercompany-posting')
    const result = await postIntercompanyTransferPaymentFromVoucher(
      intercompanyLink.source_id,
      voucher.id,
      voucher.brand_id,
      postedBy,
      voucher.voucher_date,
      creditAccount!
    )
    return { entryNumber: result.entryNumber }
  }

  const payrollLink = voucher.links?.find((l) => l.source_type === 'payroll_run_brand_total')
  if (payrollLink && voucher.voucher_type === 'payment') {
    if (voucher.status !== 'paid') throw new Error('Payment voucher must be paid before posting')
    const { postPayrollRunPayment } = await import('./accounting-payroll-posting')
    const result = await postPayrollRunPayment(
      payrollLink.source_id,
      voucher.id,
      postedBy,
      creditAccount!
    )
    const { data: bt } = await supabase
      .from('payroll_run_brand_totals')
      .select('journal_entry_id_payment')
      .eq('id', payrollLink.source_id)
      .single()
    if (bt?.journal_entry_id_payment) {
      await supabase
        .from('accounting_vouchers')
        .update({ journal_entry_id: bt.journal_entry_id_payment, posted_at: new Date().toISOString() })
        .eq('id', voucher.id)
    }
    return { entryNumber: result.entryNumber }
  }

  const staffAdvanceLink = voucher.links?.find((l) => l.source_type === 'staff_advance_disbursement')
  if (staffAdvanceLink && voucher.voucher_type === 'payment') {
    if (voucher.status !== 'paid') throw new Error('Payment voucher must be paid before posting')
    const { postStaffAdvanceDisbursementFromVoucher } = await import('./accounting-staff-advance-posting')
    const result = await postStaffAdvanceDisbursementFromVoucher(
      staffAdvanceLink.source_id,
      voucher.id,
      voucher.brand_id,
      postedBy,
      voucher.voucher_date,
      creditAccount!
    )
    await supabase
      .from('accounting_vouchers')
      .update({ journal_entry_id: result.journalEntryId, posted_at: new Date().toISOString() })
      .eq('id', voucher.id)
    return { entryNumber: result.entryNumber }
  }

  const draftLines: DraftJournalLine[] = []

  if (voucher.voucher_type === 'payment') {
    if (voucher.status !== 'paid') throw new Error('Payment voucher must be paid before posting')
    if (!creditAccount) throw new Error('Default cash/petty cash account not configured')

    if (voucher.payee_kind === 'petty_cash_replenishment') {
      if (!pettyId) throw new Error('Default petty cash account not configured')
      if (total <= 0) throw new Error('No replenishment amount to post')
      draftLines.push({
        account_id: pettyId,
        debit: total,
        credit: 0,
        memo: voucher.payment_for || 'Petty cash replenishment',
      })
      draftLines.push({
        account_id: creditAccount,
        debit: 0,
        credit: total,
        memo: 'Petty cash replenishment',
      })
    } else {
    const poLink = voucher.links?.find((l) => l.source_type === 'purchase_order' || l.source_type === 'po_payment')
    const invoiceLink = voucher.links?.find((l) => l.source_type === 'supplier_invoice')
    const drLink = voucher.links?.find((l) => l.source_type === 'delivery_receipt')
    const hasProcurementLink = !!(poLink || invoiceLink || drLink)

    let useAp = false
    if (poLink && invoiceLink && apId && drLink) {
      const { data: dr } = await supabase
        .from('delivery_receipts')
        .select('journal_entry_id')
        .eq('id', drLink.source_id)
        .maybeSingle()
      useAp = !!dr?.journal_entry_id
    }

    if (hasProcurementLink && !useAp) {
      throw new Error(
        'Procurement payment voucher cannot post to expense. Ensure supplier invoice, PO, and receiving report with posted accrual are linked.'
      )
    }

    if (useAp && apId) {
      draftLines.push({ account_id: apId, debit: total, credit: 0, memo: voucher.payment_for || voucher.voucher_number })
      draftLines.push({ account_id: creditAccount, debit: 0, credit: total, memo: 'Payment' })
    } else if (lines.length > 0) {
      for (const line of lines) {
        const amt = Number(line.amount) || 0
        if (amt <= 0) continue
        draftLines.push({
          account_id: expenseAccountForLine(settings, line.debit_account_id, accounts),
          debit: amt,
          credit: 0,
          memo: line.description,
          voucher_line_id: line.id,
        })
      }
      const lineDebit = draftLines.reduce((s, l) => s + l.debit, 0)
      draftLines.push({
        account_id: creditAccount,
        debit: 0,
        credit: lineDebit,
        memo: 'Payment',
      })
    } else {
      const exp = accounts.find((a) => a.code === '5900')?.id || expenseAccountForLine(settings, null, accounts)
      draftLines.push({ account_id: exp, debit: total, credit: 0 })
      draftLines.push({ account_id: creditAccount, debit: 0, credit: total })
    }
    }
  } else {
    if (voucher.status !== 'liquidated') throw new Error('Petty cash voucher must be liquidated before posting')
    if (!pettyId) throw new Error('Default petty cash account not configured')
    const expenseTotal =
      Number(voucher.actual_expense) ||
      lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
    if (expenseTotal <= 0) throw new Error('No expense amount to post')

    if (lines.length > 0) {
      for (const line of lines) {
        const amt = Number(line.amount) || 0
        if (amt <= 0) continue
        draftLines.push({
          account_id: expenseAccountForLine(settings, line.debit_account_id, accounts),
          debit: amt,
          credit: 0,
          memo: line.description,
          voucher_line_id: line.id,
        })
      }
    } else {
      draftLines.push({
        account_id: expenseAccountForLine(settings, null, accounts),
        debit: expenseTotal,
        credit: 0,
        memo: voucher.purpose || voucher.voucher_number,
      })
    }
    const deb = draftLines.reduce((s, l) => s + l.debit, 0)
    draftLines.push({ account_id: pettyId, debit: 0, credit: deb, memo: 'Petty cash' })
  }

  const sourceType =
    voucher.voucher_type === 'payment' ? 'payment_voucher' : 'petty_cash_voucher'
  const memo =
    voucher.voucher_type === 'payment'
      ? await paymentVoucherJournalMemo(voucher)
      : formatPettyCashVoucherJournalMemo(voucher.purpose, voucher.payee_name)
  const entry = await createAndPostJournal({
    brandId: voucher.brand_id,
    franchiseBrandId,
    entryDate: voucher.voucher_date,
    memo,
    sourceType,
    sourceId: voucher.id,
    lines: draftLines,
    postedBy,
  })

  await supabase
    .from('accounting_vouchers')
    .update({ journal_entry_id: entry.id, posted_at: new Date().toISOString() })
    .eq('id', voucher.id)

  return { entryNumber: entry.entry_number }
}

export async function postCustomerOrderRevenue(
  orderId: string,
  brandId: string,
  postedBy: string
): Promise<void> {
  const booksBrandId = await getBooksBrandId()
  return withPostingErrorLog(booksBrandId, 'customer_order_revenue', orderId, () =>
    postCustomerOrderRevenueBody(orderId, brandId, postedBy, booksBrandId)
  )
}

async function postCustomerOrderRevenueBody(
  orderId: string,
  brandId: string,
  postedBy: string,
  booksBrandId: string
): Promise<void> {
  const { data: order } = await supabase
    .from('customer_orders')
    .select(
      '*, order_details(unit_price, quantity), journal_entry_id_revenue, status, brand_id, location_id, location:locations(name)'
    )
    .eq('id', orderId)
    .single()
  if (!order || order.brand_id !== brandId) return
  if (order.journal_entry_id_revenue) return
  if (!['fulfilled', 'paid', 'complete'].includes(order.status)) return

  const franchiseBrandId = resolveFranchiseBrandId(brandId, booksBrandId)
  const settings = await requireSettings(booksBrandId)
  const arId = getDefaultAccountId(settings, 'default_ar_account_id')
  const salesId = getDefaultAccountId(settings, 'default_sales_account_id')
  const deliveryId = getDefaultAccountId(settings, 'default_delivery_income_account_id')
  if (!arId || !salesId) throw new Error('AR or Sales account not configured')

  const o = order as OrderTotalInput & { created_at?: string; updated_at?: string }
  const total = getOrderTotalAmount(o)
  const sales = getOrderSalesRevenue(o)
  const delivery = getOrderDeliveryIncome(o)

  const lines: DraftJournalLine[] = [
    { account_id: arId, debit: total, credit: 0, memo: 'Accounts receivable' },
    { account_id: salesId, debit: 0, credit: sales, memo: 'Sales revenue' },
  ]
  if (delivery > 0 && deliveryId) {
    lines.push({ account_id: deliveryId, debit: 0, credit: delivery, memo: 'Delivery income' })
  } else if (delivery > 0) {
    lines[1].credit = total
  }

  const entry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId,
    locationId: order.location_id || null,
    entryDate: (order.updated_at || order.created_at || new Date().toISOString()).split('T')[0],
    memo: formatCustomerOrderJournalMemo('Order revenue', order),
    sourceType: 'customer_order_revenue',
    sourceId: orderId,
    lines,
    postedBy,
  })

  await supabase
    .from('customer_orders')
    .update({ journal_entry_id_revenue: entry.id })
    .eq('id', orderId)
}

export async function postCustomerOrderCash(
  orderId: string,
  brandId: string,
  postedBy: string,
  options?: { bankAccountId?: string | null }
): Promise<void> {
  const booksBrandId = await getBooksBrandId()
  return withPostingErrorLog(booksBrandId, 'customer_order_cash', orderId, () =>
    postCustomerOrderCashBody(orderId, brandId, postedBy, booksBrandId, options)
  )
}

async function postCustomerOrderCashBody(
  orderId: string,
  brandId: string,
  postedBy: string,
  booksBrandId: string,
  options?: { bankAccountId?: string | null }
): Promise<void> {
  const { data: order } = await supabase
    .from('customer_orders')
    .select(
      '*, order_details(unit_price, quantity), journal_entry_id_cash, journal_entry_id_revenue, status, brand_id, location_id, collection_bank_account_id, location:locations(name)'
    )
    .eq('id', orderId)
    .single()
  if (!order || order.brand_id !== brandId) return
  if (order.journal_entry_id_cash) return
  // Cash collection is recorded when accounting confirms payment (status complete), not on deposit slip upload (paid).
  if (order.status === 'paid' || order.status !== 'complete') return

  if (!order.journal_entry_id_revenue) {
    await postCustomerOrderRevenue(orderId, brandId, postedBy)
  }

  const franchiseBrandId = resolveFranchiseBrandId(brandId, booksBrandId)
  const settings = await requireSettings(booksBrandId)
  const bankAccountId =
    options?.bankAccountId !== undefined && options?.bankAccountId !== null && options.bankAccountId !== ''
      ? options.bankAccountId
      : (order.collection_bank_account_id as string | null | undefined) || null
  const cashId = await resolveCustomerOrderCashAccount(booksBrandId, settings, bankAccountId)
  const arId = getDefaultAccountId(settings, 'default_ar_account_id')
  if (!arId) throw new Error('AR account not configured')

  const total = getOrderTotalAmount(order as OrderTotalInput)
  const entry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId,
    locationId: order.location_id || null,
    entryDate: (order.updated_at || new Date().toISOString()).split('T')[0],
    memo: formatCustomerOrderJournalMemo('Order payment', order),
    sourceType: 'customer_order_cash',
    sourceId: orderId,
    lines: [
      { account_id: cashId, debit: total, credit: 0, memo: 'Cash received' },
      { account_id: arId, debit: 0, credit: total, memo: 'AR clearance' },
    ],
    postedBy,
  })

  await supabase
    .from('customer_orders')
    .update({ journal_entry_id_cash: entry.id })
    .eq('id', orderId)
}

export async function postAccrualFromDeliveryReceipt(
  deliveryReceiptId: string,
  _brandIdHint: string,
  postedBy: string
): Promise<void> {
  const { data: dr, error: drErr } = await supabase
    .from('delivery_receipts')
    .select('id, po_id, delivery_date, receipt_number')
    .eq('id', deliveryReceiptId)
    .single()

  if (drErr || !dr) {
    throw new Error(`Delivery receipt not found: ${drErr?.message || deliveryReceiptId}`)
  }

  const { data: po, error: poErr } = await supabase
    .from('purchase_orders')
    .select('id, brand_id, po_number, supplier:suppliers(name)')
    .eq('id', dr.po_id)
    .single()

  if (poErr || !po?.brand_id) {
    throw new Error(`Purchase order not found for delivery: ${poErr?.message || dr.po_id}`)
  }

  const supplierRaw = po.supplier as { name?: string } | { name?: string }[] | null
  const supplierName = (Array.isArray(supplierRaw) ? supplierRaw[0]?.name : supplierRaw?.name)?.trim()
  const booksBrandId = await getBooksBrandId()

  return withPostingErrorLog(booksBrandId, 'delivery_receipt', deliveryReceiptId, () =>
    postAccrualFromDeliveryReceiptBody(
      deliveryReceiptId,
      po.brand_id,
      booksBrandId,
      po.po_number,
      supplierName,
      postedBy
    )
  )
}

async function postAccrualFromDeliveryReceiptBody(
  deliveryReceiptId: string,
  sourceBrandId: string,
  booksBrandId: string,
  poNumber: string,
  supplierName: string | undefined,
  postedBy: string
): Promise<void> {
  const existing = await findPostedJournal(booksBrandId, 'delivery_receipt', deliveryReceiptId)
  if (existing) return

  const { data: dr, error: drErr } = await supabase
    .from('delivery_receipts')
    .select('id, delivery_date, receipt_number')
    .eq('id', deliveryReceiptId)
    .single()

  if (drErr || !dr) {
    throw new Error(`Delivery receipt not found: ${drErr?.message || deliveryReceiptId}`)
  }

  const franchiseBrandId = resolveFranchiseBrandId(sourceBrandId, booksBrandId)
  await ensureProcurementPostingAccounts(booksBrandId)
  const settings = await requireSettings(booksBrandId)
  const accounts = await loadAccounts(booksBrandId)
  const apId = resolveDefaultAccountId(settings, 'default_ap_account_id', accounts, '2000')
  const invId = resolveDefaultAccountId(settings, 'default_inventory_account_id', accounts, '1200')
  const fixedAssetAcc = accounts.find((a) => a.code === '1500')?.id
  const procExp = accounts.find((a) => a.code === '5900')?.id
  const damagedAccId =
    resolveDefaultAccountId(settings, 'default_damaged_goods_account_id', accounts, '5920') ||
    resolveDefaultAccountId(settings, 'default_inventory_variance_account_id', accounts, '5910') ||
    procExp
  if (!apId) {
    throw new Error('Accounts Payable (2000) is not configured. Set it in Accounting → Settings.')
  }

  const { data: receiptItems, error: itemsErr } = await supabase
    .from('delivery_receipt_items')
    .select('quantity_received, quantity_damaged, po_item_id')
    .eq('delivery_receipt_id', deliveryReceiptId)

  if (itemsErr) {
    throw new Error(`Failed to load delivery lines: ${itemsErr.message}`)
  }
  if (!receiptItems?.length) {
    throw new Error('Cannot post delivery accrual: delivery has no line items.')
  }

  const poItemIds = receiptItems.map((item) => item.po_item_id).filter(Boolean)
  const { data: poItems, error: poItemsErr } = await supabase
    .from('purchase_order_items')
    .select('id, unit_price, material_id, fixed_asset_id, product_description')
    .in('id', poItemIds)

  if (poItemsErr) {
    throw new Error(`Failed to load PO lines for delivery: ${poItemsErr.message}`)
  }

  const poItemById = new Map((poItems || []).map((item) => [item.id, item]))
  const goodBuckets = new Map<string, number>()
  const damagedBuckets = new Map<string, number>()
  let skippedLines = 0

  const addGoodCost = (pi: (typeof poItems)[number] | undefined, qty: number) => {
    const cost = qty * (Number(pi?.unit_price) || 0)
    if (cost <= 0) return
    let accountId: string | null | undefined = procExp || invId
    if (pi?.fixed_asset_id && fixedAssetAcc) accountId = fixedAssetAcc
    else if (pi?.material_id && invId) accountId = invId
    else if (!accountId) {
      skippedLines++
      return
    }
    goodBuckets.set(accountId!, (goodBuckets.get(accountId!) || 0) + cost)
  }

  const addDamagedCost = (pi: (typeof poItems)[number] | undefined, qty: number) => {
    const cost = qty * (Number(pi?.unit_price) || 0)
    if (cost <= 0) return
    if (!damagedAccId) {
      skippedLines++
      return
    }
    damagedBuckets.set(damagedAccId, (damagedBuckets.get(damagedAccId) || 0) + cost)
  }

  for (const item of receiptItems) {
    const pi = poItemById.get(item.po_item_id)
    const goodQty = Number(item.quantity_received) || 0
    const damagedQty = Number(item.quantity_damaged) || 0
    if (goodQty <= 0 && damagedQty <= 0) {
      skippedLines++
      continue
    }
    if (goodQty > 0) addGoodCost(pi, goodQty)
    if (damagedQty > 0) addDamagedCost(pi, damagedQty)
  }

  const goodTotal = Array.from(goodBuckets.values()).reduce((s, v) => s + v, 0)
  const damagedTotal = Array.from(damagedBuckets.values()).reduce((s, v) => s + v, 0)
  const total = goodTotal + damagedTotal
  if (total <= 0) {
    throw new Error(
      skippedLines > 0
        ? 'Cannot post delivery accrual: no line amounts or inventory/AP accounts missing for received items.'
        : 'Cannot post delivery accrual: no received quantity or unit cost on delivery lines.'
    )
  }

  const lines: DraftJournalLine[] = []
  Array.from(goodBuckets.entries()).forEach(([accountId, amt]) => {
    lines.push({ account_id: accountId, debit: amt, credit: 0, memo: 'Receipt accrual (good)' })
  })
  Array.from(damagedBuckets.entries()).forEach(([accountId, amt]) => {
    lines.push({ account_id: accountId, debit: amt, credit: 0, memo: 'Receipt accrual (shrinkage / damaged)' })
  })
  lines.push({ account_id: apId, debit: 0, credit: total, memo: `AP — ${poNumber}` })

  const entry = await createAndPostJournal({
    brandId: booksBrandId,
    franchiseBrandId,
    entryDate: dr.delivery_date,
    memo: formatDeliveryReceiptJournalMemo(supplierName, poNumber),
    sourceType: 'delivery_receipt',
    sourceId: deliveryReceiptId,
    lines,
    postedBy,
  })

  const { error: linkErr } = await supabase
    .from('delivery_receipts')
    .update({ journal_entry_id: entry.id })
    .eq('id', deliveryReceiptId)

  if (linkErr) {
    throw new Error(
      `Delivery journal ${entry.entry_number} posted but receipt link failed: ${linkErr.message}`
    )
  }
}
