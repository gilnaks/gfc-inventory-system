import { supabase } from './supabase'
import type {
  AccountingVoucher,
  AccountingVoucherLine,
  AccountingVoucherLink,
  AccountingVoucherSettings,
  AccountingVoucherType,
  Brand,
} from './supabase'
import { fallbackVoucherNumber, formatVoucherNumber } from './accounting-voucher-numbers'
import { validateProcurementVoucherMatch, linkInvoiceToVoucher, markInvoicePaid, revertInvoiceOnVoucherRemoved } from './supplier-invoice-service'
import { voidPendingStaffAdvancesForVoucher } from './staff-advance-service'

function supabaseErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: string }).message || '').trim()
    if (message) return message
  }
  return fallback
}

function throwSupabaseError(error: unknown, fallback: string): never {
  throw new Error(supabaseErrorMessage(error, fallback))
}

export async function ensureVoucherSettings(brandId: string): Promise<AccountingVoucherSettings> {
  const { data } = await supabase
    .from('accounting_voucher_settings')
    .select('*')
    .eq('brand_id', brandId)
    .maybeSingle()

  if (data) {
    return data as AccountingVoucherSettings
  }

  const brandRes = await supabase.from('brands').select('name, slug, brand_role').eq('id', brandId).single()
  const brand = brandRes.data as Brand | null
  const companyName =
    brand?.slug === 'gfc' || brand?.brand_role === 'factory'
      ? 'GILNAKS FOOD CORPORATION'
      : (brand?.name || 'GILNAKS').toUpperCase()

  const insert = {
    brand_id: brandId,
    company_name: companyName,
  }
  const { data: created, error } = await supabase
    .from('accounting_voucher_settings')
    .insert([insert])
    .select()
    .single()
  if (error) throw error
  return created as AccountingVoucherSettings
}

export async function reserveVoucherNumber(
  brandId: string,
  type: AccountingVoucherType
): Promise<string> {
  const settings = await ensureVoucherSettings(brandId)
  const prefix =
    type === 'payment'
      ? settings.pv_number_prefix || 'PV'
      : settings.pcv_number_prefix || 'PCV'
  const seqField = type === 'payment' ? 'pv_next_seq' : 'pcv_next_seq'
  let seq = (type === 'payment' ? settings.pv_next_seq : settings.pcv_next_seq) || 1

  for (let attempt = 0; attempt < 50; attempt++) {
    const number = formatVoucherNumber(prefix, seq)
    const { data: existing } = await supabase
      .from('accounting_vouchers')
      .select('id')
      .eq('voucher_type', type)
      .eq('voucher_number', number)
      .maybeSingle()

    if (!existing) {
      const { error } = await supabase
        .from('accounting_voucher_settings')
        .update({ [seqField]: seq + 1 })
        .eq('brand_id', brandId)
      if (error) throw new Error(error.message || 'Could not update voucher sequence')
      return number
    }
    seq++
  }

  throw new Error('Could not reserve a unique voucher number. Check voucher settings.')
}

export async function loadVouchers(
  brandId: string,
  type: AccountingVoucherType
): Promise<AccountingVoucher[]> {
  const { data, error } = await supabase
    .from('accounting_vouchers')
    .select('*, lines:accounting_voucher_lines(*), links:accounting_voucher_links(*)')
    .eq('brand_id', brandId)
    .eq('voucher_type', type)
    .order('voucher_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as AccountingVoucher[]
}

export async function loadVoucherById(id: string): Promise<AccountingVoucher | null> {
  const { data, error } = await supabase
    .from('accounting_vouchers')
    .select('*, lines:accounting_voucher_lines(*), links:accounting_voucher_links(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as AccountingVoucher
}

export async function findPrimaryVoucherForSource(
  sourceType: string,
  sourceId: string
): Promise<AccountingVoucher | null> {
  const { data: links } = await supabase
    .from('accounting_voucher_links')
    .select('voucher_id')
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .eq('link_role', 'primary')
    .limit(1)
  if (!links?.length) return null
  return loadVoucherById(links[0].voucher_id)
}

export async function saveVoucher(
  brandId: string,
  voucher: Partial<AccountingVoucher>,
  lines: AccountingVoucherLine[],
  links: AccountingVoucherLink[],
  createdBy: string
): Promise<AccountingVoucher> {
  const check = await validateProcurementVoucherMatch(links)
  if (check.ok === false) throw new Error(check.message)

  const isNew = !voucher.id
  let voucherNumber = voucher.voucher_number
  if (!voucherNumber) {
    try {
      voucherNumber = await reserveVoucherNumber(brandId, voucher.voucher_type!)
    } catch {
      voucherNumber = fallbackVoucherNumber(voucher.voucher_type!)
    }
  }

  const header = {
    brand_id: brandId,
    voucher_type: voucher.voucher_type,
    voucher_number: voucherNumber,
    voucher_date: voucher.voucher_date || new Date().toISOString().split('T')[0],
    department: voucher.department || null,
    requested_by: voucher.requested_by || null,
    prepared_by: voucher.prepared_by || null,
    payee_name: voucher.payee_name || null,
    payment_for: voucher.payment_for || null,
    payee_kind: voucher.payee_kind || null,
    payment_mode: voucher.payment_mode || null,
    bank_account_id: voucher.bank_account_id || null,
    check_number: voucher.check_number || null,
    check_date: voucher.check_date || null,
    bank_ref_number: voucher.bank_ref_number || null,
    bank_ref_date: voucher.bank_ref_date || null,
    received_by: voucher.received_by || null,
    purpose: voucher.purpose || null,
    amount_requested: voucher.amount_requested ?? null,
    amount_released: voucher.amount_released ?? null,
    date_released: voucher.date_released || null,
    actual_expense: voucher.actual_expense ?? null,
    cash_advance: voucher.cash_advance ?? null,
    excess_returned: voucher.excess_returned ?? null,
    additional_reimbursement: voucher.additional_reimbursement ?? null,
    status: voucher.status || 'draft',
    prepared_by_name: voucher.prepared_by_name || null,
    requestor_name: voucher.requestor_name || null,
    approved_by_name: voucher.approved_by_name || null,
    approved_by_title: voucher.approved_by_title || null,
    liquidated_by_name: voucher.liquidated_by_name || null,
    liquidated_by_title: voucher.liquidated_by_title || null,
    has_or: voucher.has_or ?? false,
    has_si: voucher.has_si ?? false,
    has_dr: voucher.has_dr ?? false,
    has_transport_receipt: voucher.has_transport_receipt ?? false,
    has_po: voucher.has_po ?? false,
    has_invoice: voucher.has_invoice ?? false,
    has_receiving_report: voucher.has_receiving_report ?? false,
    supporting_docs_other: voucher.supporting_docs_other || null,
    notes: voucher.notes || null,
    proof_of_payment_url: voucher.proof_of_payment_url || null,
    created_by: voucher.created_by || createdBy,
    submitted_at: voucher.submitted_at || null,
    approved_at: voucher.approved_at || null,
    liquidated_at: voucher.liquidated_at || null,
  }

  let savedId = voucher.id
  if (isNew) {
    const { data, error } = await supabase
      .from('accounting_vouchers')
      .insert([header])
      .select()
      .single()
    if (error) throwSupabaseError(error, 'Failed to save voucher header')
    savedId = data.id
  } else {
    const { error } = await supabase.from('accounting_vouchers').update(header).eq('id', savedId!)
    if (error) throwSupabaseError(error, 'Failed to update voucher')
    await supabase.from('accounting_voucher_lines').delete().eq('voucher_id', savedId!)
    await supabase.from('accounting_voucher_links').delete().eq('voucher_id', savedId!)
  }

  const lineRows = lines
    .filter((l) => l.description?.trim() || l.amount > 0)
    .map((l, i) => ({
      voucher_id: savedId,
      line_no: l.line_no || i + 1,
      description: l.description || '',
      amount: Number(l.amount) || 0,
      reference_doc: l.reference_doc || null,
      po_id: l.po_id || null,
      debit_account_id: l.debit_account_id || null,
    }))
  if (lineRows.length > 0) {
    const { error: lineErr } = await supabase.from('accounting_voucher_lines').insert(lineRows)
    if (lineErr) throwSupabaseError(lineErr, 'Failed to save voucher lines')
  }

  const linkRows = links
    .filter((l) => l.source_id)
    .map((l) => ({
      voucher_id: savedId,
      source_type: l.source_type,
      source_id: l.source_id,
      link_role: l.link_role || 'primary',
      attachment_url: l.attachment_url || null,
      notes: l.notes || null,
    }))
  if (linkRows.length > 0) {
    const { error: linkErr } = await supabase.from('accounting_voucher_links').insert(linkRows)
    if (linkErr) throwSupabaseError(linkErr, 'Failed to save voucher links')
  }

  const result = await loadVoucherById(savedId!)
  if (!result) throw new Error('Failed to load saved voucher')

  const invoiceLink = links.find((l) => l.source_type === 'supplier_invoice' && l.source_id)
  if (invoiceLink?.source_id && result.status !== 'cancelled' && result.status !== 'draft') {
    await linkInvoiceToVoucher(invoiceLink.source_id, savedId!)
  }

  return result
}

export async function updateVoucherStatus(
  id: string,
  status: string,
  extra: Partial<AccountingVoucher> = {}
): Promise<void> {
  if (status === 'submitted' || status === 'paid') {
    const voucher = await loadVoucherById(id)
    if (voucher?.links?.length) {
      const check = await validateProcurementVoucherMatch(voucher.links)
      if (check.ok === false) throw new Error(check.message)
    }
  }

  const { error } = await supabase
    .from('accounting_vouchers')
    .update({ status, ...extra })
    .eq('id', id)
  if (error) throw error

  if (status === 'paid') {
    const voucher = await loadVoucherById(id)
    const invoiceLink = voucher?.links?.find((l) => l.source_type === 'supplier_invoice')
    if (invoiceLink?.source_id) {
      await markInvoicePaid(invoiceLink.source_id)
    }
  }

  if (status === 'cancelled') {
    const voucher = await loadVoucherById(id)
    const invoiceLink = voucher?.links?.find((l) => l.source_type === 'supplier_invoice')
    if (invoiceLink?.source_id) {
      await revertInvoiceOnVoucherRemoved(invoiceLink.source_id)
    }
    await voidPendingStaffAdvancesForVoucher(id)
  }
}

/** Hard-delete voucher and cascaded lines/links (dev/testing only). */
export async function deleteVoucher(id: string): Promise<void> {
  const voucher = await loadVoucherById(id)
  const invoiceLink = voucher?.links?.find((l) => l.source_type === 'supplier_invoice')
  const { error } = await supabase.from('accounting_vouchers').delete().eq('id', id)
  if (error) throw error
  await voidPendingStaffAdvancesForVoucher(id)
  if (invoiceLink?.source_id) {
    await revertInvoiceOnVoucherRemoved(invoiceLink.source_id)
  }
}

export async function saveVoucherSettings(
  settings: AccountingVoucherSettings
): Promise<void> {
  const { id, brand_id, ...fields } = settings
  const { error } = await supabase
    .from('accounting_voucher_settings')
    .update(fields)
    .eq('id', id)
  if (error) throw error
}
