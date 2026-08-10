import { supabase } from './supabase'
import type {
  DeliveryReceipt,
  PurchaseOrder,
  SupplierInvoice,
  SupplierInvoiceLine,
  SupplierInvoiceStatus,
} from './supabase'
import {
  buildReceivedQtyMap,
  computeMatchFingerprint,
  matchIssueNeedsPoAmendment,
  parseMatchSummary,
  runThreeWayMatch,
  type ThreeWayMatchResult,
  type ThreeWayMatchSummary,
} from './accounting-three-way-match'
import {
  hasPoShortages,
  latestReceiptIsIncomplete,
} from './receiving-condition-service'

/** Default prefix for new supplier invoice numbers (matches PO-/PV- internal doc style). */
export const DEFAULT_SUPPLIER_INVOICE_NUMBER_PREFIX = 'SI-'

export type SupplierInvoiceDraft = {
  id?: string
  brand_id: string
  po_id: string
  supplier_id?: string | null
  invoice_number: string
  invoice_date: string
  total_amount: number
  attachment_url?: string | null
  notes?: string | null
  lines: Array<{
    po_item_id: string
    quantity_invoiced: number
    unit_price: number
    line_amount: number
  }>
}

export type InvoiceContext = {
  po: PurchaseOrder
  deliveryReceipts: DeliveryReceipt[]
  drItems: Array<{ po_item_id: string; quantity_received: number; quantity_damaged?: number }>
  existingInvoices: SupplierInvoice[]
  receivedByPoItem: Record<string, number>
}

export type PoAwaitingInvoice = {
  id: string
  po_number: string
  supplier_name: string
  total_received_value: number
  order_date: string
  has_matched_invoice: boolean
}

export type ExceptionInvoiceRow = {
  id: string
  po_id: string
  invoice_number: string
  po_number: string
  supplier_name: string
  total_amount: number
  invoice_date: string
}

export type PoInvoiceMatchSummary = {
  invoice_id: string
  po_id: string
  invoice_number: string
  status: SupplierInvoiceStatus
  summary_issues: string[]
  summary_hints: string[]
  line_issue_count: number
  line_issues: string[]
  top_hints: string[]
}

export function matchSummaryNeedsPoAmendment(summary?: PoInvoiceMatchSummary | null): boolean {
  if (!summary || summary.status !== 'exception') return false
  return summary.line_issues.some(matchIssueNeedsPoAmendment)
}

export function derivePaymentTimingFromTerms(
  terms?: string | null,
  explicitTiming?: string | null
): 'before_delivery' | 'after_delivery' | 'partial' {
  const normalized = (terms || '').trim().toLowerCase()

  if (
    normalized.includes('payment before delivery') ||
    normalized.includes('payment upon order')
  ) {
    return 'before_delivery'
  }
  if (normalized.includes('cod') || normalized.includes('payment after delivery')) {
    return 'after_delivery'
  }

  if (explicitTiming === 'before_delivery') return 'before_delivery'
  if (explicitTiming === 'after_delivery') return 'after_delivery'
  if (explicitTiming === 'partial') return 'partial'

  if (normalized.includes('upon order')) return 'before_delivery'
  if (normalized.includes('before') && !normalized.includes('after')) return 'before_delivery'
  return 'after_delivery'
}

export function isPaymentBeforeDeliveryTerms(terms?: string | null): boolean {
  return derivePaymentTimingFromTerms(terms) === 'before_delivery'
}

export function isPaymentBeforeDeliveryPo(po: {
  payment_terms?: string | null
  payment_timing?: string | null
}): boolean {
  return (
    derivePaymentTimingFromTerms(po.payment_terms, po.payment_timing) === 'before_delivery'
  )
}

export function isPaymentAfterDeliveryPo(po: {
  payment_terms?: string | null
  payment_timing?: string | null
}): boolean {
  const timing = derivePaymentTimingFromTerms(po.payment_terms, po.payment_timing)
  return timing === 'after_delivery' || timing === 'partial'
}

export function isPreDeliveryPayableCategory(category: string): boolean {
  return category.startsWith('Pre-delivery')
}

export function isPostDeliveryPayableCategory(category: string): boolean {
  return category.startsWith('Post-delivery')
}

export function poHasReceivedGoods(
  po: {
    items?: Array<{ quantity_received?: number | null }> | null
  },
  options?: { hasDeliveryReceipt?: boolean }
): boolean {
  if (options?.hasDeliveryReceipt) return true
  return (po.items || []).some((i) => (Number(i.quantity_received) || 0) > 0)
}

export function isProcurementPaymentDueCategory(category: string): boolean {
  return (
    category === 'Pre-delivery — awaiting invoice' ||
    category === 'Pre-delivery — ready for payment' ||
    category === 'Post-delivery — awaiting invoice' ||
    category === 'Post-delivery — ready for payment' ||
    category === 'Awaiting invoice' ||
    category === 'Ready for payment'
  )
}

const SUPPLIER_INVOICE_PO_STATUSES = new Set([
  'approved',
  'order_confirmed',
  'in_transit',
  'delivered',
  'paid',
])

export function isPoEligibleForSupplierInvoiceEntry(po: {
  status?: string | null
  payment_terms?: string | null
  payment_timing?: string | null
  items?: Array<{ quantity_received?: number | null }> | null
}): boolean {
  const status = po.status || ''
  if (!SUPPLIER_INVOICE_PO_STATUSES.has(status)) return false
  if (isPaymentBeforeDeliveryPo(po)) return true
  const items = po.items || []
  return items.some((i) => (Number(i.quantity_received) || 0) > 0)
}

export function poAmountForPayables(
  po: {
    total_amount?: number | null
    items?: Array<{ quantity?: number | null; quantity_received?: number | null; unit_price?: number | null }> | null
  },
  options?: { useReceived?: boolean }
): number {
  const items = po.items || []
  if (options?.useReceived) {
    return items.reduce(
      (sum, i) => sum + (Number(i.quantity_received) || 0) * (Number(i.unit_price) || 0),
      0
    )
  }
  const total = Number(po.total_amount) || 0
  if (total > 0) return total
  return items.reduce(
    (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0),
    0
  )
}

/** Open procurement payables stay visible regardless of the accounting period filter. */
export function isOpenProcurementPayableCategory(category: string): boolean {
  return (
    category === 'Awaiting invoice' ||
    category.startsWith('Pre-delivery') ||
    category.startsWith('Post-delivery') ||
    category === 'Match exception' ||
    category.endsWith('match exception') ||
    category === 'Ready for payment'
  )
}

export type ProcurementPayablePoRow = {
  id: string
  po_number: string
  order_date: string
  status?: string
  payment_terms?: string | null
  payment_timing?: string | null
  total_amount?: number | null
  supplier?: { name?: string } | null
  items?: Array<{ quantity?: number; quantity_received?: number; unit_price?: number }>
}

export function buildProcurementPayablePoRow(
  po: ProcurementPayablePoRow,
  latestInvoice?: { status: string; id: string; invoice_number: string; total_amount: number; invoice_date: string; updated_at?: string; supplier?: { name?: string } } | null,
  options?: { hasDeliveryReceipt?: boolean }
): {
  kind: 'exception' | 'ready' | 'awaiting' | 'skip'
  category: string
  sourceType: 'supplier_invoice_exception' | 'supplier_invoice_ready' | 'purchase_order'
  sourceId: string
  reference: string
  payee: string
  amount: number
  date: string
  voucherLink?: { sourceType: 'supplier_invoice' | 'purchase_order'; sourceId: string }
} | null {
  if (!isPoEligibleForSupplierInvoiceEntry(po)) return null

  const preDelivery = isPaymentBeforeDeliveryPo(po)
  const postDelivery = isPaymentAfterDeliveryPo(po)
  const hasReceived = poHasReceivedGoods(po, options)
  const invStatus = latestInvoice?.status

  if (invStatus === 'exception' && latestInvoice) {
    return {
      kind: 'exception',
      category: preDelivery ? 'Pre-delivery — match exception' : 'Post-delivery — match exception',
      sourceType: 'supplier_invoice_exception',
      sourceId: latestInvoice.id,
      reference: `${latestInvoice.invoice_number} / ${po.po_number}`,
      payee: latestInvoice.supplier?.name || po.supplier?.name || 'Supplier',
      amount: Number(latestInvoice.total_amount) || 0,
      date: latestInvoice.invoice_date || po.order_date || '',
      voucherLink: { sourceType: 'supplier_invoice', sourceId: latestInvoice.id },
    }
  }

  if ((invStatus === 'matched' || invStatus === 'vouchered') && latestInvoice) {
    return {
      kind: 'ready',
      category: preDelivery ? 'Pre-delivery — ready for payment' : 'Post-delivery — ready for payment',
      sourceType: 'supplier_invoice_ready',
      sourceId: latestInvoice.id,
      reference: `${latestInvoice.invoice_number} / ${po.po_number}`,
      payee: latestInvoice.supplier?.name || po.supplier?.name || 'Supplier',
      amount: Number(latestInvoice.total_amount) || 0,
      date: latestInvoice.invoice_date || po.order_date || '',
      voucherLink: { sourceType: 'supplier_invoice', sourceId: latestInvoice.id },
    }
  }

  if (invStatus === 'paid') return null
  if (postDelivery && !hasReceived) return null

  const amount = preDelivery ? poAmountForPayables(po) : poAmountForPayables(po, { useReceived: true })

  return {
    kind: 'awaiting',
    category: preDelivery ? 'Pre-delivery — awaiting invoice' : 'Post-delivery — awaiting invoice',
    sourceType: 'purchase_order',
    sourceId: po.id,
    reference: preDelivery
      ? `${po.po_number} (pay before delivery)`
      : `${po.po_number} (received — enter invoice)`,
    payee: po.supplier?.name || 'Supplier',
    amount,
    date: po.order_date || '',
    voucherLink: { sourceType: 'purchase_order', sourceId: po.id },
  }
}

function isDraftInvoice(draft: Pick<SupplierInvoiceDraft, 'invoice_number' | 'lines'>): boolean {
  if (!draft.invoice_number.trim()) return true
  const activeLines = draft.lines.filter((l) => (Number(l.quantity_invoiced) || 0) > 0)
  return activeLines.length === 0
}

export async function loadExceptionInvoices(brandId: string): Promise<ExceptionInvoiceRow[]> {
  const { data, error } = await supabase
    .from('supplier_invoices')
    .select('id, po_id, invoice_number, invoice_date, total_amount, purchase_order:purchase_orders(po_number), supplier:suppliers(name)')
    .eq('brand_id', brandId)
    .eq('status', 'exception')
    .order('updated_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data || []).map((row) => ({
    id: row.id,
    po_id: row.po_id,
    invoice_number: row.invoice_number,
    po_number: (row as { purchase_order?: { po_number?: string } }).purchase_order?.po_number || '—',
    supplier_name: (row as { supplier?: { name?: string } }).supplier?.name || 'Supplier',
    total_amount: Number(row.total_amount) || 0,
    invoice_date: row.invoice_date || '',
  }))
}

export async function loadPosAwaitingInvoice(brandId: string): Promise<PoAwaitingInvoice[]> {
  const { data: pos } = await supabase
    .from('purchase_orders')
    .select(
      'id, po_number, order_date, status, payment_terms, payment_timing, total_amount, supplier:suppliers(name), items:purchase_order_items(id, quantity, quantity_received, unit_price)'
    )
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: invoiceRows } = await supabase
    .from('supplier_invoices')
    .select('po_id, status')
    .eq('brand_id', brandId)

  const poInvoiceStatus = new Map<string, string>()
  for (const inv of invoiceRows || []) {
    const existing = poInvoiceStatus.get(inv.po_id)
    const rank = (s: string) =>
      s === 'paid' ? 5 : s === 'vouchered' ? 4 : s === 'matched' ? 3 : s === 'exception' ? 2 : 1
    if (!existing || rank(inv.status) > rank(existing)) {
      poInvoiceStatus.set(inv.po_id, inv.status)
    }
  }

  const result: PoAwaitingInvoice[] = []
  for (const po of pos || []) {
    const row = po as {
      status?: string
      payment_terms?: string | null
      payment_timing?: string | null
      total_amount?: number | null
      items?: Array<{ quantity_received: number; unit_price: number }>
    }
    if (!isPoEligibleForSupplierInvoiceEntry(row)) continue

    const items = row.items || []
    const totalReceived = items.reduce(
      (s, i) => s + (Number(i.quantity_received) || 0) * (Number(i.unit_price) || 0),
      0
    )
    const preDelivery = isPaymentBeforeDeliveryPo(row)
    const displayValue = preDelivery ? poAmountForPayables(row) : totalReceived
    const invStatus = poInvoiceStatus.get(po.id)
    if (invStatus === 'exception') continue

    result.push({
      id: po.id,
      po_number: po.po_number,
      supplier_name: (po as { supplier?: { name?: string } }).supplier?.name || 'Supplier',
      total_received_value: displayValue,
      order_date: po.order_date || '',
      has_matched_invoice: invStatus === 'matched' || invStatus === 'vouchered' || invStatus === 'paid',
    })
  }
  return result
}

export async function loadSupplierInvoices(brandId: string): Promise<SupplierInvoice[]> {
  const { data, error } = await supabase
    .from('supplier_invoices')
    .select(
      '*, supplier:suppliers(name), purchase_order:purchase_orders(po_number), lines:supplier_invoice_lines(*)'
    )
    .eq('brand_id', brandId)
    .order('invoice_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data || []) as SupplierInvoice[]
}

export type PoExistingInvoice = {
  id: string
  po_id: string
  invoice_number: string
  status: SupplierInvoiceStatus
  invoice_date: string
  total_amount: number
}

export async function loadInvoicesByPoIds(
  poIds: string[],
  brandId?: string
): Promise<Record<string, PoExistingInvoice[]>> {
  if (poIds.length === 0) return {}

  let query = supabase
    .from('supplier_invoices')
    .select('id, po_id, invoice_number, status, invoice_date, total_amount, updated_at')
    .in('po_id', poIds)
    .order('updated_at', { ascending: false })

  if (brandId) query = query.eq('brand_id', brandId)

  const { data, error } = await query
  if (error) throw error

  const map: Record<string, PoExistingInvoice[]> = {}
  for (const row of data || []) {
    if (!map[row.po_id]) map[row.po_id] = []
    map[row.po_id].push({
      id: row.id,
      po_id: row.po_id,
      invoice_number: row.invoice_number,
      status: row.status as SupplierInvoiceStatus,
      invoice_date: row.invoice_date || '',
      total_amount: Number(row.total_amount) || 0,
    })
  }
  return map
}

export async function loadLatestInvoiceStatusByPoIds(
  poIds: string[]
): Promise<Record<string, SupplierInvoiceStatus>> {
  if (poIds.length === 0) return {}
  const { data } = await supabase
    .from('supplier_invoices')
    .select('po_id, status, updated_at')
    .in('po_id', poIds)
    .order('updated_at', { ascending: false })

  const rank = (s: string) =>
    s === 'paid' ? 5 : s === 'vouchered' ? 4 : s === 'matched' ? 3 : s === 'exception' ? 2 : 1

  const map: Record<string, SupplierInvoiceStatus> = {}
  for (const row of data || []) {
    const cur = map[row.po_id]
    if (!cur || rank(row.status) > rank(cur)) {
      map[row.po_id] = row.status as SupplierInvoiceStatus
    }
  }
  return map
}

export async function loadInvoiceMatchSummaryByPoIds(
  poIds: string[],
  brandId?: string
): Promise<Record<string, PoInvoiceMatchSummary>> {
  if (poIds.length === 0) return {}

  let query = supabase
    .from('supplier_invoices')
    .select('id, po_id, invoice_number, status, match_summary, updated_at')
    .in('po_id', poIds)
    .order('updated_at', { ascending: false })

  if (brandId) query = query.eq('brand_id', brandId)

  const { data, error } = await query
  if (error) throw error

  const rank = (s: string) =>
    s === 'paid' ? 5 : s === 'vouchered' ? 4 : s === 'matched' ? 3 : s === 'exception' ? 2 : 1

  const map: Record<string, PoInvoiceMatchSummary> = {}
  for (const row of data || []) {
    const cur = map[row.po_id]
    if (cur && rank(cur.status) >= rank(row.status)) continue

    const parsed = parseMatchSummary(row.match_summary)
    const lineIssues: string[] = []
    const lineHints: string[] = []
    for (const line of parsed?.lines || []) {
      for (const issue of line.issues) {
        if (issue && !lineIssues.includes(issue)) lineIssues.push(issue)
      }
      for (const hint of line.resolutionHints) {
        if (hint && !lineHints.includes(hint)) lineHints.push(hint)
      }
    }
    const summaryHints = parsed?.summaryResolutionHints || []
    const top_hints = [...summaryHints, ...lineHints].slice(0, 3)

    map[row.po_id] = {
      invoice_id: row.id,
      po_id: row.po_id,
      invoice_number: row.invoice_number,
      status: row.status as SupplierInvoiceStatus,
      summary_issues: parsed?.summaryIssues || [],
      summary_hints: summaryHints,
      line_issue_count: lineIssues.length,
      line_issues: lineIssues,
      top_hints,
    }
  }
  return map
}

async function fetchSupplierInvoiceRow(id: string): Promise<SupplierInvoice | null> {
  const { data, error } = await supabase.from('supplier_invoices').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null

  const poId = data.po_id as string
  const [linesRes, poRes, supplierRes] = await Promise.all([
    supabase.from('supplier_invoice_lines').select('*').eq('supplier_invoice_id', id),
    supabase
      .from('purchase_orders')
      .select('*, supplier:suppliers(*), items:purchase_order_items(*), requisition:purchase_requisitions(id, pr_number, department)')
      .eq('id', poId)
      .maybeSingle(),
    data.supplier_id
      ? supabase.from('suppliers').select('*').eq('id', data.supplier_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (linesRes.error) throw linesRes.error
  if (poRes.error) throw poRes.error
  if (supplierRes.error) throw supplierRes.error

  return {
    ...(data as SupplierInvoice),
    lines: (linesRes.data || []) as SupplierInvoiceLine[],
    purchase_order: poRes.data as PurchaseOrder | undefined,
    supplier: supplierRes.data || undefined,
  }
}

/** Fast path for payment voucher prefill — skips match revalidation and parallelizes fetches. */
export async function loadMatchedInvoiceVoucherData(invoiceId: string): Promise<{
  invoice: SupplierInvoice
  po: PurchaseOrder
  deliveryReceipts: DeliveryReceipt[]
} | null> {
  const { data: invRow, error: invErr } = await supabase
    .from('supplier_invoices')
    .select('*')
    .eq('id', invoiceId)
    .maybeSingle()
  if (invErr) throw invErr
  if (!invRow) return null

  const poId = invRow.po_id as string
  const [linesRes, poRes, drsRes, supplierRes] = await Promise.all([
    supabase.from('supplier_invoice_lines').select('*').eq('supplier_invoice_id', invoiceId),
    supabase
      .from('purchase_orders')
      .select('*, supplier:suppliers(*), items:purchase_order_items(*), requisition:purchase_requisitions(id, pr_number, department)')
      .eq('id', poId)
      .maybeSingle(),
    supabase
      .from('delivery_receipts')
      .select('*')
      .eq('po_id', poId)
      .order('delivery_date', { ascending: false }),
    invRow.supplier_id
      ? supabase.from('suppliers').select('*').eq('id', invRow.supplier_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (linesRes.error) throw linesRes.error
  if (poRes.error) throw poRes.error
  if (drsRes.error) throw drsRes.error
  if (supplierRes.error) throw supplierRes.error
  if (!poRes.data) return null

  const invoice: SupplierInvoice = {
    ...(invRow as SupplierInvoice),
    lines: (linesRes.data || []) as SupplierInvoiceLine[],
    purchase_order: poRes.data as PurchaseOrder,
    supplier: supplierRes.data || undefined,
  }

  return {
    invoice,
    po: poRes.data as PurchaseOrder,
    deliveryReceipts: (drsRes.data || []) as DeliveryReceipt[],
  }
}

export async function revalidateStoredInvoiceMatch(invoice: SupplierInvoice): Promise<SupplierInvoice> {
  if (invoice.status === 'paid' || invoice.status === 'draft') return invoice

  const context = await loadInvoiceContext(invoice.po_id)
  if (!context) return invoice

  const poItems = context.po.items || []
  const liveFingerprint = computeMatchFingerprint(poItems, context.receivedByPoItem)
  const storedFingerprint = invoice.match_fingerprint || ''
  const stale = storedFingerprint !== '' && storedFingerprint !== liveFingerprint

  if (!stale) return invoice
  if (invoice.status !== 'matched' && invoice.status !== 'vouchered') return invoice

  const lines = (invoice.lines || []).map((l) => ({
    po_item_id: l.po_item_id,
    quantity_invoiced: l.quantity_invoiced,
    unit_price: l.unit_price,
    line_amount: l.line_amount,
  }))

  const match = runThreeWayMatch({
    poItems,
    receivedByPoItem: context.receivedByPoItem,
    invoiceLines: lines,
    headerTotal: Number(invoice.total_amount) || 0,
    staleSourceChange: true,
    finalReceiptIncomplete:
      latestReceiptIsIncomplete(context.deliveryReceipts) && hasPoShortages(poItems),
  })

  const { error } = await supabase
    .from('supplier_invoices')
    .update({
      status: 'exception',
      match_summary: match as unknown as Record<string, unknown>,
      match_fingerprint: liveFingerprint,
      matched_at: null,
    })
    .eq('id', invoice.id)

  if (error) throw error
  return (await fetchSupplierInvoiceRow(invoice.id)) || { ...invoice, status: 'exception', match_summary: match }
}

export async function loadSupplierInvoiceById(id: string): Promise<SupplierInvoice | null> {
  const invoice = await fetchSupplierInvoiceRow(id)
  if (!invoice) return null
  return revalidateStoredInvoiceMatch(invoice)
}

export async function loadInvoiceContext(poId: string): Promise<InvoiceContext | null> {
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('*, supplier:suppliers(*), items:purchase_order_items(*), requisition:purchase_requisitions(id, pr_number, department)')
    .eq('id', poId)
    .maybeSingle()
  if (!po) return null

  const { data: drs } = await supabase
    .from('delivery_receipts')
    .select('*')
    .eq('po_id', poId)
    .order('delivery_date', { ascending: false })

  const drIds = (drs || []).map((d) => d.id)
  let drItems: Array<{ po_item_id: string; quantity_received: number; quantity_damaged?: number }> = []
  if (drIds.length > 0) {
    const { data: drLineRows } = await supabase
      .from('delivery_receipt_items')
      .select('po_item_id, quantity_received, quantity_damaged')
      .in('delivery_receipt_id', drIds)
    drItems = (drLineRows || []).map((r) => ({
      po_item_id: r.po_item_id,
      quantity_received: Number(r.quantity_received) || 0,
      quantity_damaged: Number(r.quantity_damaged) || 0,
    }))
  }

  const deliveryReceipts = (drs || []) as DeliveryReceipt[]

  const { data: existingInvoices } = await supabase
    .from('supplier_invoices')
    .select('id, invoice_number, status, total_amount')
    .eq('po_id', poId)

  const poItems = (po as PurchaseOrder).items || []
  const receivedByPoItem = buildReceivedQtyMap(poItems, drItems)

  return {
    po: po as PurchaseOrder,
    deliveryReceipts,
    drItems,
    existingInvoices: (existingInvoices || []) as SupplierInvoice[],
    receivedByPoItem,
  }
}

export function computeMatchForDraft(
  context: InvoiceContext,
  draft: Pick<SupplierInvoiceDraft, 'lines' | 'total_amount'>,
  options?: { staleSourceChange?: boolean }
): ThreeWayMatchResult {
  const poItems = context.po.items || []
  return runThreeWayMatch({
    poItems,
    receivedByPoItem: context.receivedByPoItem,
    invoiceLines: draft.lines,
    headerTotal: Number(draft.total_amount) || 0,
    staleSourceChange: options?.staleSourceChange,
    finalReceiptIncomplete:
      latestReceiptIsIncomplete(context.deliveryReceipts) && hasPoShortages(poItems),
  })
}

export async function saveSupplierInvoice(draft: SupplierInvoiceDraft): Promise<SupplierInvoice> {
  if (!draft.invoice_number.trim()) {
    throw new Error('Supplier invoice number is required.')
  }

  const context = await loadInvoiceContext(draft.po_id)
  if (!context) throw new Error('Purchase order not found.')

  const draftMode = isDraftInvoice(draft)
  let status: SupplierInvoiceStatus = 'draft'
  let match: ThreeWayMatchSummary | null = null
  let fingerprint: string | null = null
  let matchedAt: string | null = null

  if (!draftMode) {
    match = computeMatchForDraft(context, draft)
    status = isPaymentBeforeDeliveryPo(context.po) ? 'matched' : match.status
    fingerprint = match.fingerprint
    if (status === 'matched') matchedAt = new Date().toISOString()
  } else {
    const poItems = context.po.items || []
    fingerprint = computeMatchFingerprint(poItems, context.receivedByPoItem)
  }

  const header = {
    brand_id: draft.brand_id,
    po_id: draft.po_id,
    supplier_id: draft.supplier_id ?? context.po.supplier_id ?? null,
    invoice_number: draft.invoice_number.trim(),
    invoice_date: draft.invoice_date,
    total_amount: Number(draft.total_amount) || 0,
    attachment_url: draft.attachment_url || null,
    status,
    match_summary: match ? (match as unknown as Record<string, unknown>) : null,
    match_fingerprint: fingerprint,
    matched_at: matchedAt,
    notes: draft.notes || null,
  }

  let invoiceId = draft.id
  if (invoiceId) {
    const { error } = await supabase.from('supplier_invoices').update(header).eq('id', invoiceId)
    if (error) throw error
    await supabase.from('supplier_invoice_lines').delete().eq('supplier_invoice_id', invoiceId)
  } else {
    const { data, error } = await supabase.from('supplier_invoices').insert([header]).select().single()
    if (error) throw error
    invoiceId = data.id
  }

  const lineRows = draft.lines
    .filter((l) => (Number(l.quantity_invoiced) || 0) > 0)
    .map((l) => ({
      supplier_invoice_id: invoiceId,
      po_item_id: l.po_item_id,
      quantity_invoiced: Number(l.quantity_invoiced) || 0,
      unit_price: Number(l.unit_price) || 0,
      line_amount: Number(l.line_amount) || 0,
    }))

  if (lineRows.length > 0) {
    const { error: lineErr } = await supabase.from('supplier_invoice_lines').insert(lineRows)
    if (lineErr) throw lineErr
  }

  const saved = await fetchSupplierInvoiceRow(invoiceId!)
  if (!saved) throw new Error('Failed to load saved supplier invoice.')
  return saved
}

export async function linkInvoiceToVoucher(invoiceId: string, voucherId: string): Promise<void> {
  const { error } = await supabase
    .from('supplier_invoices')
    .update({ payment_voucher_id: voucherId, status: 'vouchered' })
    .eq('id', invoiceId)
  if (error) throw error
}

export async function markInvoicePaid(invoiceId: string): Promise<void> {
  const { error } = await supabase
    .from('supplier_invoices')
    .update({ status: 'paid' })
    .eq('id', invoiceId)
  if (error) throw error
}

export async function revertInvoiceOnVoucherRemoved(invoiceId: string): Promise<void> {
  const invoice = await fetchSupplierInvoiceRow(invoiceId)
  if (!invoice || invoice.status === 'paid') return

  const context = await loadInvoiceContext(invoice.po_id)
  if (!context) return

  const lines = (invoice.lines || []).map((l) => ({
    po_item_id: l.po_item_id,
    quantity_invoiced: l.quantity_invoiced,
    unit_price: l.unit_price,
    line_amount: l.line_amount,
  }))

  const match = computeMatchForDraft(context, {
    lines,
    total_amount: Number(invoice.total_amount) || 0,
  })

  const nextStatus: SupplierInvoiceStatus = match.status === 'matched' ? 'matched' : 'exception'

  await supabase
    .from('supplier_invoices')
    .update({
      status: nextStatus,
      payment_voucher_id: null,
      match_summary: match as unknown as Record<string, unknown>,
      match_fingerprint: match.fingerprint,
      matched_at: nextStatus === 'matched' ? new Date().toISOString() : null,
    })
    .eq('id', invoiceId)
}

export function pickPrimaryDeliveryReceipt(drs: DeliveryReceipt[]): DeliveryReceipt | null {
  if (!drs.length) return null
  const withUrl = drs.find((d) => d.delivery_receipt_url?.trim())
  return withUrl || drs[0]
}

export type PoPrimaryDeliveryReceipt = {
  id: string
  receipt_number: string
}

/** Primary receiving report per PO (prefers DR with attachment, else latest). */
export async function loadPrimaryDeliveryReceiptsByPoIds(
  poIds: string[]
): Promise<Record<string, PoPrimaryDeliveryReceipt>> {
  const out: Record<string, PoPrimaryDeliveryReceipt> = {}
  const unique = Array.from(new Set(poIds.filter(Boolean)))
  if (!unique.length) return out

  const { data, error } = await supabase
    .from('delivery_receipts')
    .select('id, po_id, receipt_number, delivery_receipt_url, created_at')
    .in('po_id', unique)
    .order('created_at', { ascending: false })

  if (error) throw error

  const byPo = new Map<string, DeliveryReceipt[]>()
  for (const row of data || []) {
    if (!row.po_id) continue
    const list = byPo.get(row.po_id) || []
    list.push(row as DeliveryReceipt)
    byPo.set(row.po_id, list)
  }

  for (const [poId, drs] of byPo) {
    const primary = pickPrimaryDeliveryReceipt(drs)
    if (primary) {
      out[poId] = { id: primary.id, receipt_number: primary.receipt_number }
    }
  }

  return out
}

function hasProcurementLinks(links: Array<{ source_type: string; source_id: string }>): boolean {
  return links.some((l) =>
    ['supplier_invoice', 'purchase_order', 'delivery_receipt', 'po_payment'].includes(l.source_type)
  )
}

export async function validateProcurementVoucherMatch(
  links: Array<{ source_type: string; source_id: string }>
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!hasProcurementLinks(links)) return { ok: true }

  const invoiceLink = links.find((l) => l.source_type === 'supplier_invoice')
  if (!invoiceLink) {
    return {
      ok: false,
      message:
        'Procurement payment vouchers must originate from a matched supplier invoice. Use Accounting → Supplier Invoices.',
    }
  }

  const invoice = await loadSupplierInvoiceById(invoiceLink.source_id)
  if (!invoice) {
    return { ok: false, message: 'Linked supplier invoice not found.' }
  }
  if (invoice.status !== 'matched' && invoice.status !== 'vouchered' && invoice.status !== 'paid') {
    return {
      ok: false,
      message: `Supplier invoice ${invoice.invoice_number} is not matched. Resolve variances before submitting or paying this voucher.`,
    }
  }

  if (invoice.status === 'matched' || invoice.status === 'vouchered') {
    const context = await loadInvoiceContext(invoice.po_id)
    if (context) {
      const isPreDelivery = isPaymentBeforeDeliveryPo(context.po)
      const liveFingerprint = computeMatchFingerprint(
        context.po.items || [],
        context.receivedByPoItem
      )
      if (!isPreDelivery && invoice.match_fingerprint && invoice.match_fingerprint !== liveFingerprint) {
        return {
          ok: false,
          message:
            'PO or receiving report changed since invoice was matched. Re-open the supplier invoice in Accounting and re-save.',
        }
      }
    }
  }

  const hasPo = links.some((l) => l.source_type === 'purchase_order')
  const hasDr = links.some((l) => l.source_type === 'delivery_receipt')
  const contextForLinkCheck = await loadInvoiceContext(invoice.po_id)
  const requiresDr = !isPaymentBeforeDeliveryPo(contextForLinkCheck?.po || {})
  if (!hasPo || (requiresDr && !hasDr)) {
    return {
      ok: false,
      message: requiresDr
        ? 'Procurement payment vouchers must link PO, receiving report, and supplier invoice.'
        : 'Procurement payment vouchers for pre-delivery payments must link PO and supplier invoice.',
    }
  }

  return { ok: true }
}

export type { ThreeWayMatchResult, SupplierInvoiceLine, ThreeWayMatchSummary }
