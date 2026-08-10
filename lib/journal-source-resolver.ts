import { supabase } from './supabase'
import type { AccountingJournalSourceType } from './supabase'
import {
  FACTORY_REQUEST_MATERIAL_SELECT,
  getFactoryRequestUnitLabel,
  type RawMaterialUomFields,
} from './raw-material-uom'
import { formatPoLabel } from './accounting-voucher-prefill'
import {
  customerOrderJournalMemoPrefix,
  formatAssetMovementJournalMemo,
  formatCustomerOrderJournalMemo,
  formatDeliveryReceiptJournalMemo,
  formatFactoryMaterialReleaseJournalMemo,
  formatFactoryWipAdjustmentJournalMemo,
  formatIntercompanySettlementJournalMemo,
  formatIntercompanyTransferJournalMemo,
  formatMaterialCycleCountJournalMemo,
  formatMaterialTransferJournalMemo,
  formatOpeningBalanceJournalMemo,
  formatPaymentVoucherJournalMemo,
  formatPayrollAccrualJournalMemo,
  formatPayrollPaymentJournalMemo,
  formatPettyCashVoucherJournalMemo,
  formatProductionBatchJournalMemo,
  formatProductCycleCountJournalMemo,
  formatProductOpeningStockJournalMemo,
  formatProductStockAdjustmentJournalMemo,
  formatReversalJournalMemo,
  formatStaffAdvanceJournalMemo,
  formatStockMovementJournalMemo,
  formatYearEndCloseJournalMemo,
  isIdHeavyMemo,
} from './journal-description'

const journalSourceLabelCache = new Map<string, string>()
const journalLabelCacheListeners = new Set<() => void>()

function notifyJournalLabelCache(): void {
  for (const listener of journalLabelCacheListeners) listener()
}

export type JournalSourceDocKind =
  | 'delivery_receipt'
  | 'purchase_order'
  | 'supplier_invoice'
  | 'payment_voucher'
  | 'petty_cash_voucher'
  | 'material_transfer'
  | 'intercompany_transfer'
  | 'opening_balance'
  | 'product_cycle_count'
  | 'product_opening_stock'
  | 'product_stock_adjustment'
  | 'material_cycle_count'
  | 'material_movement'
  | 'fixed_asset_movement'
  | 'customer_order'
  | 'payroll_run'
  | 'production_batch'
  | 'factory_material_release'
  | 'factory_wip_adjustment'
  | 'staff_advance_disbursement'
  | 'journal_entry'
  | 'year_end_close'

export type JournalRelatedDoc = {
  kind: JournalSourceDocKind
  id: string
  label: string
}

export type JournalLineMemoLink = {
  kind: JournalSourceDocKind
  id?: string
  poNumber?: string
  entryNumber?: string
  label: string
}

const SOURCE_TYPE_TO_DOC_KIND: Partial<Record<AccountingJournalSourceType, JournalSourceDocKind>> = {
  delivery_receipt: 'delivery_receipt',
  payment_voucher: 'payment_voucher',
  petty_cash_voucher: 'petty_cash_voucher',
  material_transfer: 'material_transfer',
  intercompany_transfer: 'intercompany_transfer',
  intercompany_transfer_settlement: 'intercompany_transfer',
  opening_balance: 'opening_balance',
  product_cycle_count: 'product_cycle_count',
  product_opening_stock: 'product_opening_stock',
  product_stock_adjustment: 'product_stock_adjustment',
  material_cycle_count: 'material_cycle_count',
  material_movement: 'material_movement',
  fixed_asset_movement: 'fixed_asset_movement',
  customer_order_revenue: 'customer_order',
  customer_order_cash: 'customer_order',
  customer_order_cogs: 'customer_order',
  payroll_run_accrual: 'payroll_run',
  payroll_run_payment: 'payroll_run',
  production_batch: 'production_batch',
  factory_material_release: 'factory_material_release',
  factory_wip_adjustment: 'factory_wip_adjustment',
  staff_advance_disbursement: 'staff_advance_disbursement',
  reversal: 'journal_entry',
  year_end_close: 'year_end_close',
}

export function sourceTypeToDocKind(
  sourceType: AccountingJournalSourceType | string
): JournalSourceDocKind | null {
  return SOURCE_TYPE_TO_DOC_KIND[sourceType as AccountingJournalSourceType] ?? null
}

export function isSourceTypeTrackable(
  sourceType: AccountingJournalSourceType | string,
  sourceId?: string | null
): boolean {
  if (!sourceId) return false
  return sourceTypeToDocKind(sourceType) != null
}

function labelCacheKey(sourceType: string, sourceId: string): string {
  return `${sourceType}:${sourceId}`
}

function journalDescCacheKey(sourceType: string, sourceId: string): string {
  return `journal_desc:${sourceType}:${sourceId}`
}

function embedName(
  embed: { name?: string; full_name?: string } | { name?: string; full_name?: string }[] | null | undefined,
  field: 'name' | 'full_name' = 'name'
): string | undefined {
  const row = Array.isArray(embed) ? embed[0] : embed
  const value = row?.[field]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

type PaymentVoucherDescFields = {
  payee_name?: string | null
  links?: Array<{ source_type: string; source_id: string }> | null
}

function paymentVoucherDescriptionFromFields(
  voucher: PaymentVoucherDescFields,
  poNumber?: string | null
): string {
  return formatPaymentVoucherJournalMemo(voucher.payee_name, poNumber)
}

async function resolvePoNumberFromVoucherLinks(
  links?: Array<{ source_type: string; source_id: string }> | null
): Promise<string | null> {
  if (!links?.length) return null

  const purchaseOrderLink = links.find((l) => l.source_type === 'purchase_order')
  if (purchaseOrderLink) {
    const { data } = await supabase
      .from('purchase_orders')
      .select('po_number')
      .eq('id', purchaseOrderLink.source_id)
      .maybeSingle()
    return data?.po_number ?? null
  }

  const invoiceLink = links.find((l) => l.source_type === 'supplier_invoice')
  if (invoiceLink) {
    const { data } = await supabase
      .from('supplier_invoices')
      .select('po_id')
      .eq('id', invoiceLink.source_id)
      .maybeSingle()
    if (data?.po_id) {
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('po_number')
        .eq('id', data.po_id)
        .maybeSingle()
      return po?.po_number ?? null
    }
  }

  const drLink = links.find((l) => l.source_type === 'delivery_receipt')
  if (drLink) {
    const { data: dr } = await supabase
      .from('delivery_receipts')
      .select('po_id')
      .eq('id', drLink.source_id)
      .maybeSingle()
    if (dr?.po_id) {
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('po_number')
        .eq('id', dr.po_id)
        .maybeSingle()
      return po?.po_number ?? null
    }
  }

  const poPaymentLink = links.find((l) => l.source_type === 'po_payment')
  if (poPaymentLink) {
    const { data } = await supabase
      .from('po_payments')
      .select('po_id')
      .eq('id', poPaymentLink.source_id)
      .maybeSingle()
    if (data?.po_id) {
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('po_number')
        .eq('id', data.po_id)
        .maybeSingle()
      return po?.po_number ?? null
    }
  }

  return null
}

export async function resolvePaymentVoucherJournalDescription(
  voucher: PaymentVoucherDescFields
): Promise<string> {
  const poNumber = await resolvePoNumberFromVoucherLinks(voucher.links)
  return formatPaymentVoucherJournalMemo(voucher.payee_name, poNumber)
}

export function getCachedJournalEntryDescription(
  sourceType: string,
  sourceId: string
): string | null {
  return journalSourceLabelCache.get(journalDescCacheKey(sourceType, sourceId)) ?? null
}

/** @deprecated Use getCachedJournalEntryDescription('payment_voucher', id) */
export function getCachedPaymentVoucherJournalDescription(voucherId: string): string | null {
  return getCachedJournalEntryDescription('payment_voucher', voucherId)
}

export async function fetchJournalEntryDescription(
  sourceType: AccountingJournalSourceType | string,
  sourceId: string,
  journalEntryId?: string
): Promise<string | null> {
  try {
    switch (sourceType) {
      case 'payment_voucher': {
        const { data } = await supabase
          .from('accounting_vouchers')
          .select('payee_name, links:accounting_voucher_links(source_type, source_id)')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        return resolvePaymentVoucherJournalDescription({
          payee_name: data.payee_name,
          links: (data.links || []) as Array<{ source_type: string; source_id: string }>,
        })
      }
      case 'petty_cash_voucher': {
        const { data } = await supabase
          .from('accounting_vouchers')
          .select('purpose, payee_name')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        return formatPettyCashVoucherJournalMemo(data.purpose, data.payee_name)
      }
      case 'delivery_receipt': {
        const { data: dr, error } = await supabase
          .from('delivery_receipts')
          .select('po_id')
          .eq('id', sourceId)
          .maybeSingle()
        if (error || !dr?.po_id) return null
        const { data: po } = await supabase
          .from('purchase_orders')
          .select('po_number, supplier:suppliers(name)')
          .eq('id', dr.po_id)
          .maybeSingle()
        const supplierRaw = po?.supplier as { name?: string } | { name?: string }[] | null
        const supplierName = embedName(supplierRaw)
        return formatDeliveryReceiptJournalMemo(supplierName, po?.po_number)
      }
      case 'material_transfer': {
        const { data } = await supabase
          .from('material_transfers')
          .select(
            'from_brand:brands!material_transfers_from_brand_id_fkey(name), to_brand:brands!material_transfers_to_brand_id_fkey(name)'
          )
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        return formatMaterialTransferJournalMemo(
          embedName(data.from_brand as { name?: string } | { name?: string }[] | null),
          embedName(data.to_brand as { name?: string } | { name?: string }[] | null)
        )
      }
      case 'intercompany_transfer': {
        const { data } = await supabase
          .from('intercompany_transfers')
          .select(
            'from_brand:brands!intercompany_transfers_from_brand_id_fkey(name), to_brand:brands!intercompany_transfers_to_brand_id_fkey(name)'
          )
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        return formatIntercompanyTransferJournalMemo(
          embedName(data.from_brand as { name?: string } | { name?: string }[] | null),
          embedName(data.to_brand as { name?: string } | { name?: string }[] | null)
        )
      }
      case 'intercompany_transfer_settlement': {
        const { data } = await supabase
          .from('intercompany_transfers')
          .select(
            'from_brand:brands!intercompany_transfers_from_brand_id_fkey(name), to_brand:brands!intercompany_transfers_to_brand_id_fkey(name)'
          )
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        return formatIntercompanySettlementJournalMemo(
          embedName(data.from_brand as { name?: string } | { name?: string }[] | null),
          embedName(data.to_brand as { name?: string } | { name?: string }[] | null)
        )
      }
      case 'customer_order_revenue':
      case 'customer_order_cash':
      case 'customer_order_cogs': {
        const { data } = await supabase
          .from('customer_orders')
          .select('id, location:locations(name)')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        return formatCustomerOrderJournalMemo(customerOrderJournalMemoPrefix(sourceType), data)
      }
      case 'payroll_run_accrual':
      case 'payroll_run_payment': {
        const { data } = await supabase
          .from('payroll_run_brand_totals')
          .select('payroll_run:payroll_runs(week_start_date, week_end_date), brand:brands(name)')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        const runRaw = data.payroll_run as
          | { week_start_date?: string; week_end_date?: string }
          | { week_start_date?: string; week_end_date?: string }[]
          | null
        const run = Array.isArray(runRaw) ? runRaw[0] : runRaw
        const brandName = embedName(data.brand as { name?: string } | { name?: string }[] | null)
        if (sourceType === 'payroll_run_payment') {
          return formatPayrollPaymentJournalMemo(
            brandName,
            run?.week_start_date,
            run?.week_end_date
          )
        }
        return formatPayrollAccrualJournalMemo(brandName, run?.week_start_date, run?.week_end_date)
      }
      case 'production_batch': {
        const { data } = await supabase
          .from('factory_production_batches')
          .select('batch_number, product_id, product:products(name)')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        let productName = embedName(
          data.product as { name?: string } | { name?: string }[] | null
        )
        if (!productName && data.product_id) {
          const { data: productRow } = await supabase
            .from('products')
            .select('name')
            .eq('id', data.product_id as string)
            .maybeSingle()
          productName = productRow?.name?.trim() || undefined
        }
        return formatProductionBatchJournalMemo(data.batch_number, productName)
      }
      case 'factory_material_release': {
        const { data } = await supabase
          .from('factory_material_requests')
          .select(`quantity, material:raw_materials(${FACTORY_REQUEST_MATERIAL_SELECT})`)
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        const matRaw = data.material as RawMaterialUomFields & { material_name?: string } | Array<
          RawMaterialUomFields & { material_name?: string }
        > | null
        const mat = Array.isArray(matRaw) ? matRaw[0] : matRaw
        return formatFactoryMaterialReleaseJournalMemo(
          mat?.material_name,
          data.quantity,
          mat ? getFactoryRequestUnitLabel(mat) : null
        )
      }
      case 'factory_wip_adjustment': {
        const { data } = await supabase
          .from('factory_opened_materials')
          .select('label, material:raw_materials(material_name)')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        const mat = data.material as { material_name?: string } | { material_name?: string }[] | null
        const name = Array.isArray(mat) ? mat[0]?.material_name : mat?.material_name
        return formatFactoryWipAdjustmentJournalMemo(name, data.label)
      }
      case 'staff_advance_disbursement': {
        const { data } = await supabase
          .from('staff_advance_disbursements')
          .select('staff:staff_registrations(full_name)')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        return formatStaffAdvanceJournalMemo(
          embedName(data.staff as { full_name?: string } | { full_name?: string }[] | null, 'full_name')
        )
      }
      case 'material_movement': {
        const { data } = await supabase
          .from('material_stock_movements')
          .select(
            'movement_type, reference_type, reference_id, material:raw_materials(material_name, linked_product_id)'
          )
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        const mat = data.material as
          | { material_name?: string; linked_product_id?: string | null }
          | { material_name?: string; linked_product_id?: string | null }[]
          | null
        let name = Array.isArray(mat) ? mat[0]?.material_name : mat?.material_name
        const linkedProductId = Array.isArray(mat)
          ? mat[0]?.linked_product_id
          : mat?.linked_product_id
        const productId =
          data.reference_type === 'export_component' && data.reference_id
            ? (data.reference_id as string)
            : linkedProductId
        if (productId) {
          const { data: productRow } = await supabase
            .from('products')
            .select('name')
            .eq('id', productId)
            .maybeSingle()
          if (productRow?.name?.trim()) {
            name = productRow.name.trim()
          }
        }
        return formatStockMovementJournalMemo(data.movement_type, name)
      }
      case 'product_opening_stock': {
        const { data: entry } = await supabase
          .from('accounting_journal_entries')
          .select('memo')
          .eq('source_type', 'product_opening_stock')
          .eq('source_id', sourceId)
          .eq('status', 'posted')
          .maybeSingle()
        if (entry?.memo?.trim()) return entry.memo.trim()

        const { data } = await supabase
          .from('products')
          .select('name, initial_stock, price, unit')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        return formatProductOpeningStockJournalMemo(
          data.name,
          data.initial_stock,
          data.unit,
          data.price
        )
      }
      case 'product_stock_adjustment': {
        const { data: entry } = await supabase
          .from('accounting_journal_entries')
          .select('memo')
          .eq('source_type', 'product_stock_adjustment')
          .eq('source_id', sourceId)
          .eq('status', 'posted')
          .maybeSingle()
        if (entry?.memo?.trim()) return entry.memo.trim()

        const { data } = await supabase
          .from('product_stock_adjustments')
          .select('quantity_delta, unit_cost, unit, product:products(name)')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        const product = data.product as { name?: string } | { name?: string }[] | null
        const name = Array.isArray(product) ? product[0]?.name : product?.name
        return formatProductStockAdjustmentJournalMemo(
          name,
          data.quantity_delta,
          data.unit,
          data.unit_cost
        )
      }
      case 'fixed_asset_movement': {
        const { data } = await supabase
          .from('fixed_asset_movements')
          .select('movement_type, asset:fixed_assets(asset_name)')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        const asset = data.asset as { asset_name?: string } | { asset_name?: string }[] | null
        const name = Array.isArray(asset) ? asset[0]?.asset_name : asset?.asset_name
        return formatAssetMovementJournalMemo(data.movement_type, name)
      }
      case 'product_cycle_count': {
        const { data } = await supabase
          .from('product_cycle_counts')
          .select('count_date')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        return formatProductCycleCountJournalMemo(data.count_date)
      }
      case 'material_cycle_count': {
        const { data } = await supabase
          .from('material_cycle_counts')
          .select('count_date')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        return formatMaterialCycleCountJournalMemo(data.count_date)
      }
      case 'opening_balance':
        return formatOpeningBalanceJournalMemo()
      case 'year_end_close': {
        if (journalEntryId) {
          const { data } = await supabase
            .from('accounting_year_end_closes')
            .select('fiscal_year')
            .eq('journal_entry_id', journalEntryId)
            .maybeSingle()
          if (data?.fiscal_year != null) {
            return formatYearEndCloseJournalMemo(data.fiscal_year)
          }
          const { data: je } = await supabase
            .from('accounting_journal_entries')
            .select('memo')
            .eq('id', journalEntryId)
            .maybeSingle()
          const match = je?.memo?.match(/(\d{4})/)
          return formatYearEndCloseJournalMemo(match?.[1] ?? null)
        }
        return formatYearEndCloseJournalMemo(null)
      }
      case 'reversal': {
        const { data } = await supabase
          .from('accounting_journal_entries')
          .select('entry_number')
          .eq('id', sourceId)
          .maybeSingle()
        return formatReversalJournalMemo(data?.entry_number)
      }
      default:
        return null
    }
  } catch {
    return null
  }
}

export async function ensureJournalEntryDescription(
  sourceType: string,
  sourceId: string,
  journalEntryId?: string
): Promise<string | null> {
  const key = journalDescCacheKey(sourceType, sourceId)
  const cached = journalSourceLabelCache.get(key)
  if (cached) return cached

  const description = await fetchJournalEntryDescription(sourceType, sourceId, journalEntryId)
  if (description) {
    journalSourceLabelCache.set(key, description)
    notifyJournalLabelCache()
  }
  return description
}

/** @deprecated Use ensureJournalEntryDescription('payment_voucher', id) */
export async function ensurePaymentVoucherJournalDescription(voucherId: string): Promise<string | null> {
  return ensureJournalEntryDescription('payment_voucher', voucherId)
}

export async function batchPrefetchJournalEntryDescriptions(
  requests: JournalSourceLabelRequest[]
): Promise<void> {
  const pending = requests.filter(
    (r) =>
      r.sourceId &&
      isSourceTypeTrackable(r.sourceType, r.sourceId) &&
      !journalSourceLabelCache.has(journalDescCacheKey(r.sourceType, r.sourceId))
  )
  if (!pending.length) return

  const paymentVoucherIds = pending
    .filter((r) => r.sourceType === 'payment_voucher')
    .map((r) => r.sourceId)
  if (paymentVoucherIds.length) {
    const { data: vouchers } = await supabase
      .from('accounting_vouchers')
      .select('id, payee_name, links:accounting_voucher_links(source_type, source_id)')
      .in('id', Array.from(new Set(paymentVoucherIds)))
    await Promise.all(
      (vouchers || []).map(async (voucher) => {
        const poNumber = await resolvePoNumberFromVoucherLinks(
          (voucher.links || []) as Array<{ source_type: string; source_id: string }>
        )
        journalSourceLabelCache.set(
          journalDescCacheKey('payment_voucher', voucher.id),
          paymentVoucherDescriptionFromFields({ payee_name: voucher.payee_name }, poNumber)
        )
      })
    )
  }

  const otherPending = pending.filter((r) => r.sourceType !== 'payment_voucher')
  await Promise.all(
    otherPending.map(async (req) => {
      const description = await fetchJournalEntryDescription(req.sourceType, req.sourceId)
      if (description) {
        journalSourceLabelCache.set(journalDescCacheKey(req.sourceType, req.sourceId), description)
      }
    })
  )

  notifyJournalLabelCache()
}

/** @deprecated Use batchPrefetchJournalEntryDescriptions */
export async function batchPrefetchPaymentVoucherJournalDescriptions(
  voucherIds: string[]
): Promise<void> {
  return batchPrefetchJournalEntryDescriptions(
    voucherIds.map((sourceId) => ({ sourceType: 'payment_voucher', sourceId }))
  )
}

export function subscribeJournalLabelCache(listener: () => void): () => void {
  journalLabelCacheListeners.add(listener)
  return () => journalLabelCacheListeners.delete(listener)
}

export function getCachedJournalSourceLabel(
  sourceType: string,
  sourceId: string
): string | null {
  return journalSourceLabelCache.get(labelCacheKey(sourceType, sourceId)) ?? null
}

export function journalEntryNeedsSourceLabel(
  memo: string | null | undefined,
  sourceType: string,
  sourceId: string | null | undefined
): boolean {
  const memoText = memo?.trim() || ''
  const memoIsUsable = memoText.length > 0 && !isIdHeavyMemo(memoText)
  return Boolean(!memoIsUsable && sourceId && isSourceTypeTrackable(sourceType, sourceId))
}

export type JournalSourceLabelRequest = {
  sourceType: string
  sourceId: string
}

function labelCustomerOrderRow(
  _sourceType: string,
  order: {
    id?: string | null
    customer_name?: string | null
    location?: { name?: string } | { name?: string }[] | null
  }
): string {
  return formatCustomerOrderJournalMemo('', order)
}

/** One batched query for all order JEs on a page; individual fetch for other source types. */
export async function batchPrefetchJournalSourceLabels(
  requests: JournalSourceLabelRequest[]
): Promise<void> {
  const pending = requests.filter(
    (r) => r.sourceId && !journalSourceLabelCache.has(labelCacheKey(r.sourceType, r.sourceId))
  )
  if (!pending.length) return

  const orderRequests = pending.filter((r) => sourceTypeToDocKind(r.sourceType) === 'customer_order')
  const uniqueOrderIds = Array.from(new Set(orderRequests.map((r) => r.sourceId)))

  if (uniqueOrderIds.length) {
    const { data } = await supabase
      .from('customer_orders')
      .select('id, customer_name, location:locations(name)')
      .in('id', uniqueOrderIds)

    const byId = new Map((data || []).map((row) => [row.id as string, row]))
    for (const req of orderRequests) {
      const order = byId.get(req.sourceId)
      if (!order) continue
      journalSourceLabelCache.set(
        labelCacheKey(req.sourceType, req.sourceId),
        labelCustomerOrderRow(req.sourceType, order)
      )
    }
  }

  const otherPending = pending.filter((r) => sourceTypeToDocKind(r.sourceType) !== 'customer_order')
  await Promise.all(
    otherPending.map(async (req) => {
      const label = await fetchJournalSourceLabel(req.sourceType, req.sourceId)
      if (label) {
        journalSourceLabelCache.set(labelCacheKey(req.sourceType, req.sourceId), label)
      }
    })
  )

  notifyJournalLabelCache()
}

export async function ensureJournalSourceLabel(
  sourceType: string,
  sourceId: string
): Promise<string | null> {
  const key = labelCacheKey(sourceType, sourceId)
  const cached = journalSourceLabelCache.get(key)
  if (cached) return cached

  const label = await fetchJournalSourceLabel(sourceType, sourceId)
  if (label) {
    journalSourceLabelCache.set(key, label)
    notifyJournalLabelCache()
  }
  return label
}

export async function fetchJournalSourceLabel(
  sourceType: AccountingJournalSourceType | string,
  sourceId: string,
  journalEntryId?: string
): Promise<string | null> {
  void journalEntryId
  const kind = sourceTypeToDocKind(sourceType)
  if (!kind) return null

  try {
    switch (kind) {
      case 'delivery_receipt': {
        const { data } = await supabase
          .from('delivery_receipts')
          .select('receipt_number')
          .eq('id', sourceId)
          .maybeSingle()
        return data?.receipt_number ? `Delivery ${data.receipt_number}` : null
      }
      case 'payment_voucher':
      case 'petty_cash_voucher': {
        const { data } = await supabase
          .from('accounting_vouchers')
          .select('voucher_number')
          .eq('id', sourceId)
          .maybeSingle()
        return data?.voucher_number ?? null
      }
      case 'material_transfer': {
        const { data } = await supabase
          .from('material_transfers')
          .select('transfer_number')
          .eq('id', sourceId)
          .maybeSingle()
        return data?.transfer_number ? `Materials transfer ${data.transfer_number}` : null
      }
      case 'intercompany_transfer': {
        const { data } = await supabase
          .from('intercompany_transfers')
          .select('transfer_number')
          .eq('id', sourceId)
          .maybeSingle()
        return data?.transfer_number ? `Intercompany transfer ${data.transfer_number}` : null
      }
      case 'opening_balance':
        return 'Opening balances'
      case 'product_cycle_count': {
        const { data } = await supabase
          .from('product_cycle_counts')
          .select('count_date')
          .eq('id', sourceId)
          .maybeSingle()
        return data?.count_date ? `Product cycle count ${data.count_date}` : null
      }
      case 'product_opening_stock': {
        const { data } = await supabase
          .from('products')
          .select('name, sku')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data?.name) return 'Product'
        return data.sku ? `${data.name} (${data.sku})` : data.name
      }
      case 'product_stock_adjustment': {
        const { data } = await supabase
          .from('product_stock_adjustments')
          .select('product:products(name, sku)')
          .eq('id', sourceId)
          .maybeSingle()
        const product = data?.product as
          | { name?: string; sku?: string | null }
          | { name?: string; sku?: string | null }[]
          | null
        const row = Array.isArray(product) ? product[0] : product
        if (!row?.name) return 'Stock adjustment'
        return row.sku ? `${row.name} (${row.sku})` : row.name
      }
      case 'material_cycle_count': {
        const { data } = await supabase
          .from('material_cycle_counts')
          .select('count_date')
          .eq('id', sourceId)
          .maybeSingle()
        return data?.count_date ? `Material cycle count ${data.count_date}` : null
      }
      case 'material_movement': {
        const { data } = await supabase
          .from('material_stock_movements')
          .select('reference_number, notes, movement_type, material:raw_materials(material_name)')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        const mat = data.material as { material_name?: string } | { material_name?: string }[] | null
        const name = Array.isArray(mat) ? mat[0]?.material_name : mat?.material_name
        return (
          data.reference_number ||
          data.notes ||
          (name ? `Material ${data.movement_type} — ${name}` : `Material movement`)
        )
      }
      case 'fixed_asset_movement': {
        const { data } = await supabase
          .from('fixed_asset_movements')
          .select('reference_number, notes, movement_type, asset:fixed_assets(asset_name)')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        const asset = data.asset as { asset_name?: string } | { asset_name?: string }[] | null
        const name = Array.isArray(asset) ? asset[0]?.asset_name : asset?.asset_name
        return (
          data.reference_number ||
          data.notes ||
          (name ? `Fixed asset ${data.movement_type} — ${name}` : `Fixed asset movement`)
        )
      }
      case 'customer_order': {
        const { data } = await supabase
          .from('customer_orders')
          .select('customer_name, location:locations(name)')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        return labelCustomerOrderRow(sourceType, data)
      }
      case 'payroll_run': {
        const { data } = await supabase
          .from('payroll_run_brand_totals')
          .select('payroll_run:payroll_runs(week_start_date, week_end_date), brand:brands(name)')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        const runRaw = data.payroll_run as
          | { week_start_date?: string; week_end_date?: string }
          | { week_start_date?: string; week_end_date?: string }[]
          | null
        const run = Array.isArray(runRaw) ? runRaw[0] : runRaw
        const brandRaw = data.brand as { name?: string } | { name?: string }[] | null
        const brandName = (Array.isArray(brandRaw) ? brandRaw[0]?.name : brandRaw?.name) || 'Brand'
        return `Payroll week ${run?.week_start_date || ''}–${run?.week_end_date || ''} — ${brandName}`
      }
      case 'production_batch': {
        const { data } = await supabase
          .from('factory_production_batches')
          .select('batch_number')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data?.batch_number) return 'Materials consumed'
        return `Materials consumed - ${data.batch_number}`
      }
      case 'factory_material_release': {
        const { data } = await supabase
          .from('factory_material_requests')
          .select('id, material:raw_materials(material_name)')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return 'Factory material release'
        const mat = data.material as { material_name?: string } | { material_name?: string }[] | null
        const name = Array.isArray(mat) ? mat[0]?.material_name : mat?.material_name
        return name ? `Factory material release - ${name}` : 'Factory material release'
      }
      case 'factory_wip_adjustment': {
        const { data } = await supabase
          .from('factory_opened_materials')
          .select('label, material:raw_materials(material_name)')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return 'Factory WIP adjustment'
        const mat = data.material as { material_name?: string } | { material_name?: string }[] | null
        const name = Array.isArray(mat) ? mat[0]?.material_name : mat?.material_name
        const label = data.label ? ` (${data.label})` : ''
        return name ? `Factory shrink — ${name}${label}` : 'Factory WIP adjustment'
      }
      case 'staff_advance_disbursement': {
        const { data } = await supabase
          .from('staff_advance_disbursements')
          .select('staff:staff_registrations(full_name)')
          .eq('id', sourceId)
          .maybeSingle()
        if (!data) return null
        const staffRaw = data.staff as { full_name?: string } | { full_name?: string }[] | null
        const name = (Array.isArray(staffRaw) ? staffRaw[0]?.full_name : staffRaw?.full_name) || 'Staff'
        return `Staff advance — ${name}`
      }
      case 'journal_entry': {
        const { data } = await supabase
          .from('accounting_journal_entries')
          .select('entry_number')
          .eq('id', sourceId)
          .maybeSingle()
        return data?.entry_number ? `Reversal of ${data.entry_number}` : null
      }
      case 'year_end_close':
        return 'Year-end close'
      default:
        return null
    }
  } catch {
    return null
  }
}

function labelMaterialMovementRow(data: {
  reference_number?: string | null
  notes?: string | null
  movement_type?: string | null
  material?: { material_name?: string } | { material_name?: string }[] | null
}): string {
  const matRaw = data.material
  const mat = Array.isArray(matRaw) ? matRaw[0] : matRaw
  const name = mat?.material_name
  if (name) return `Stock ${data.movement_type || 'movement'} — ${name}`
  return data.notes || data.reference_number || 'Material movement'
}

function labelFixedAssetMovementRow(data: {
  reference_number?: string | null
  notes?: string | null
  movement_type?: string | null
  asset?: { asset_name?: string } | { asset_name?: string }[] | null
}): string {
  const assetRaw = data.asset
  const asset = Array.isArray(assetRaw) ? assetRaw[0] : assetRaw
  const name = asset?.asset_name
  if (name) return `Asset ${data.movement_type || 'movement'} — ${name}`
  return data.notes || data.reference_number || 'Fixed asset movement'
}

export async function fetchRelatedJournalDocs(
  sourceType: AccountingJournalSourceType | string,
  sourceId: string,
  brandId?: string
): Promise<JournalRelatedDoc[]> {
  const related: JournalRelatedDoc[] = []

  try {
    if (sourceType === 'delivery_receipt') {
      const { data: dr } = await supabase
        .from('delivery_receipts')
        .select('po_id, receipt_number')
        .eq('id', sourceId)
        .maybeSingle()
      if (dr?.po_id) {
        const { data: po } = await supabase
          .from('purchase_orders')
          .select('po_number')
          .eq('id', dr.po_id)
          .maybeSingle()
        if (po?.po_number) {
          related.push({
            kind: 'purchase_order',
            id: dr.po_id,
            label: formatPoLabel(po.po_number),
          })
        }
      }

      const [{ data: materialMovs }, { data: faMovs }] = await Promise.all([
        supabase
          .from('material_stock_movements')
          .select(
            'id, reference_number, notes, movement_type, material:raw_materials(material_name)'
          )
          .eq('reference_type', 'delivery_receipt')
          .eq('reference_id', sourceId),
        supabase
          .from('fixed_asset_movements')
          .select(
            'id, reference_number, notes, movement_type, asset:fixed_assets(asset_name)'
          )
          .eq('reference_type', 'delivery_receipt')
          .eq('reference_id', sourceId),
      ])

      for (const mov of materialMovs || []) {
        related.push({
          kind: 'material_movement',
          id: mov.id,
          label: labelMaterialMovementRow(mov),
        })
      }
      for (const mov of faMovs || []) {
        related.push({
          kind: 'fixed_asset_movement',
          id: mov.id,
          label: labelFixedAssetMovementRow(mov),
        })
      }
    }

    if (sourceType === 'payment_voucher' || sourceType === 'petty_cash_voucher') {
      const { data: links } = await supabase
        .from('accounting_voucher_links')
        .select('source_type, source_id')
        .eq('voucher_id', sourceId)

      for (const link of links || []) {
        if (link.source_type === 'purchase_order') {
          const { data: po } = await supabase
            .from('purchase_orders')
            .select('po_number')
            .eq('id', link.source_id)
            .maybeSingle()
          related.push({
            kind: 'purchase_order',
            id: link.source_id,
            label: po?.po_number ? formatPoLabel(po.po_number) : 'Purchase order',
          })
        } else if (link.source_type === 'supplier_invoice') {
          const { data: inv } = await supabase
            .from('supplier_invoices')
            .select('invoice_number')
            .eq('id', link.source_id)
            .maybeSingle()
          related.push({
            kind: 'supplier_invoice',
            id: link.source_id,
            label: inv?.invoice_number ? `Invoice ${inv.invoice_number}` : 'Supplier invoice',
          })
        } else if (link.source_type === 'delivery_receipt') {
          const { data: dr } = await supabase
            .from('delivery_receipts')
            .select('receipt_number')
            .eq('id', link.source_id)
            .maybeSingle()
          related.push({
            kind: 'delivery_receipt',
            id: link.source_id,
            label: dr?.receipt_number ? `Receiving report ${dr.receipt_number}` : 'Receiving report',
          })
        }
      }
    }

    if (sourceType === 'opening_balance' && brandId) {
      void brandId
    }

    if (sourceType === 'product_opening_stock') {
      const { data: product } = await supabase
        .from('products')
        .select('name, sku')
        .eq('id', sourceId)
        .maybeSingle()
      related.push({
        kind: 'product_opening_stock',
        id: sourceId,
        label: product?.name
          ? product.sku
            ? `${product.name} (${product.sku})`
            : product.name
          : 'Product',
      })
    }

    if (sourceType === 'product_stock_adjustment') {
      const { data: adjustment } = await supabase
        .from('product_stock_adjustments')
        .select('product_id, product:products(name, sku)')
        .eq('id', sourceId)
        .maybeSingle()
      const product = adjustment?.product as
        | { name?: string; sku?: string | null }
        | { name?: string; sku?: string | null }[]
        | null
      const row = Array.isArray(product) ? product[0] : product
      if (adjustment?.product_id) {
        related.push({
          kind: 'product_stock_adjustment',
          id: sourceId,
          label: row?.name
            ? row.sku
              ? `${row.name} (${row.sku})`
              : row.name
            : 'Stock adjustment',
        })
      }
    }

    if (sourceType === 'material_movement') {
      const { data: mov } = await supabase
        .from('material_stock_movements')
        .select('reference_type, reference_id')
        .eq('id', sourceId)
        .maybeSingle()
      if (mov?.reference_type === 'cycle_count' && mov.reference_id) {
        const { data: cc } = await supabase
          .from('material_cycle_counts')
          .select('count_date')
          .eq('id', mov.reference_id)
          .maybeSingle()
        related.push({
          kind: 'material_cycle_count',
          id: mov.reference_id,
          label: cc?.count_date
            ? `Material cycle count ${cc.count_date}`
            : 'Material cycle count',
        })
      } else if (mov?.reference_type === 'delivery_receipt' && mov.reference_id) {
        const { data: dr } = await supabase
          .from('delivery_receipts')
          .select('receipt_number')
          .eq('id', mov.reference_id)
          .maybeSingle()
        related.push({
          kind: 'delivery_receipt',
          id: mov.reference_id,
          label: dr?.receipt_number
            ? `Receiving report ${dr.receipt_number}`
            : 'Receiving report',
        })
      }
    }

    if (sourceType === 'factory_material_release') {
      const { data: movement } = await supabase
        .from('material_stock_movements')
        .select(
          'id, reference_number, notes, movement_type, material:raw_materials(material_name)'
        )
        .eq('reference_type', 'factory_request')
        .eq('reference_id', sourceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (movement?.id) {
        related.push({
          kind: 'material_movement',
          id: movement.id,
          label: labelMaterialMovementRow(movement),
        })
      }
    }
  } catch {
    // ignore fetch errors for related docs
  }

  return related
}

const AP_PO_PATTERN = /^AP — (.+)$/
const REVERSAL_PATTERN = /^Reversal of (.+)$/

export function parseLineMemoLink(memo: string | null | undefined): JournalLineMemoLink | null {
  if (!memo?.trim()) return null
  const trimmed = memo.trim()

  const apMatch = trimmed.match(AP_PO_PATTERN)
  if (apMatch) {
    return {
      kind: 'purchase_order',
      poNumber: apMatch[1].trim(),
      label: `PO ${apMatch[1].trim()}`,
    }
  }

  const revMatch = trimmed.match(REVERSAL_PATTERN)
  if (revMatch) {
    return {
      kind: 'journal_entry',
      entryNumber: revMatch[1].trim(),
      label: `JE ${revMatch[1].trim()}`,
    }
  }

  return null
}

export async function resolveLineMemoLink(
  link: JournalLineMemoLink,
  brandId?: string
): Promise<JournalRelatedDoc | null> {
  if (link.kind === 'purchase_order' && link.poNumber) {
    let query = supabase.from('purchase_orders').select('id, po_number').eq('po_number', link.poNumber)
    if (brandId) query = query.eq('brand_id', brandId)
    const { data } = await query.maybeSingle()
    if (!data) return null
    return {
      kind: 'purchase_order',
      id: data.id,
      label: formatPoLabel(data.po_number),
    }
  }

  if (link.kind === 'journal_entry' && link.entryNumber) {
    let query = supabase
      .from('accounting_journal_entries')
      .select('id, entry_number')
      .eq('entry_number', link.entryNumber)
    if (brandId) query = query.eq('brand_id', brandId)
    const { data } = await query.maybeSingle()
    if (!data) return null
    return {
      kind: 'journal_entry',
      id: data.id,
      label: data.entry_number,
    }
  }

  return null
}

export async function resolveLineMemosToDocs(
  memos: Array<string | null | undefined>,
  brandId?: string
): Promise<JournalRelatedDoc[]> {
  const seen = new Set<string>()
  const results: JournalRelatedDoc[] = []

  for (const memo of memos) {
    const parsed = parseLineMemoLink(memo)
    if (!parsed) continue
    const resolved = await resolveLineMemoLink(parsed, brandId)
    if (!resolved) continue
    const key = `${resolved.kind}:${resolved.id}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push(resolved)
  }

  return results
}
