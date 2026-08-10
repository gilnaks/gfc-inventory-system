/** True when memo text is mostly a source id suffix (not useful for scanning). */
export function isIdHeavyMemo(memo: string): boolean {
  const t = memo.trim()
  if (!t) return false
  if (/— [a-f0-9]{8}$/i.test(t)) return true
  if (/\border [a-f0-9]{8}\b/i.test(t)) return true
  if (/^COGS — order [a-f0-9]{8}$/i.test(t)) return true
  return false
}

/** Prefer human-readable journal description over id-heavy fallback labels. */
export function pickJournalDescription(
  memo?: string | null,
  sourceLabel?: string | null
): string | null {
  const m = memo?.trim()
  const l = sourceLabel?.trim()
  if (m && !isIdHeavyMemo(m)) return m
  if (l) return l
  return m || null
}

export const JOURNAL_DESCRIPTION_MAX_LENGTH = 56

export function truncateJournalDescription(text: string, maxLength = JOURNAL_DESCRIPTION_MAX_LENGTH): {
  display: string
  isTruncated: boolean
  full: string
} {
  const full = text.trim()
  if (full.length <= maxLength) {
    return { display: full, isTruncated: false, full }
  }
  return {
    display: `${full.slice(0, maxLength).trimEnd()}…`,
    isTruncated: true,
    full,
  }
}

type OrderMemoFields = {
  id?: string | null
  customer_name?: string | null
  location?: { name?: string } | { name?: string }[] | null
}

/** @deprecated Prefix is ignored; descriptions use location and order id. */
export function customerOrderJournalMemoPrefix(sourceType: string): string {
  switch (sourceType) {
    case 'customer_order_cash':
      return 'Order payment'
    case 'customer_order_cogs':
      return 'COGS'
    case 'customer_order_revenue':
    default:
      return 'Order revenue'
  }
}

export function formatCustomerOrderIdLabel(orderId?: string | null): string {
  const id = orderId?.trim()
  if (!id) return 'Order'
  if (id.length <= 12) return id
  return id.slice(0, 8)
}

export function formatCustomerOrderJournalMemo(_prefix: string, order: OrderMemoFields): string {
  const locRaw = order.location
  const locName = (Array.isArray(locRaw) ? locRaw[0]?.name : locRaw?.name)?.trim()
  const orderId = formatCustomerOrderIdLabel(order.id)
  if (locName && orderId) return `${locName} - ${orderId}`
  if (locName) return locName
  if (orderId) return orderId
  return 'Order'
}

export function formatJournalPoLabel(poNumber?: string | null): string {
  const trimmed = poNumber?.trim()
  if (!trimmed) return ''
  if (/^PO-/i.test(trimmed)) return trimmed
  if (/^PO\s/i.test(trimmed)) return trimmed.replace(/^PO\s+/i, 'PO-')
  return `PO-${trimmed}`
}

export function formatSupplierPoJournalMemo(
  supplierName?: string | null,
  poNumber?: string | null
): string {
  const supplier = supplierName?.trim() || 'Supplier'
  const po = formatJournalPoLabel(poNumber)
  if (po) return `${supplier} - ${po}`
  return supplier
}

/** Journal entry description for posted payment vouchers. */
export function formatPaymentVoucherJournalMemo(
  payeeName?: string | null,
  poNumber?: string | null
): string {
  return formatSupplierPoJournalMemo(payeeName, poNumber)
}

export function formatPettyCashVoucherJournalMemo(
  purpose?: string | null,
  payeeName?: string | null
): string {
  return purpose?.trim() || payeeName?.trim() || 'Expense'
}

export function formatDeliveryReceiptJournalMemo(
  supplierName?: string | null,
  poNumber?: string | null
): string {
  return formatSupplierPoJournalMemo(supplierName, poNumber)
}

export function formatBrandRouteJournalMemo(
  fromBrandName?: string | null,
  toBrandName?: string | null
): string {
  const from = fromBrandName?.trim()
  const to = toBrandName?.trim()
  if (from && to) return `${from} -> ${to}`
  if (to) return to
  if (from) return from
  return 'Transfer'
}

export function formatMaterialTransferJournalMemo(
  fromBrandName?: string | null,
  toBrandName?: string | null
): string {
  return formatBrandRouteJournalMemo(fromBrandName, toBrandName)
}

export function formatIntercompanyTransferJournalMemo(
  fromBrandName?: string | null,
  toBrandName?: string | null
): string {
  return formatBrandRouteJournalMemo(fromBrandName, toBrandName)
}

export function formatIntercompanySettlementJournalMemo(
  fromBrandName?: string | null,
  toBrandName?: string | null
): string {
  return formatBrandRouteJournalMemo(fromBrandName, toBrandName)
}

export function formatPayrollAccrualJournalMemo(
  brandName?: string | null,
  weekStart?: string | null,
  weekEnd?: string | null
): string {
  const brand = brandName?.trim() || 'Brand'
  const week = formatPayrollWeekRange(weekStart, weekEnd)
  return week ? `${brand} (${week})` : brand
}

export function formatPayrollPaymentJournalMemo(
  brandName?: string | null,
  weekStart?: string | null,
  weekEnd?: string | null
): string {
  return formatPayrollAccrualJournalMemo(brandName, weekStart, weekEnd)
}

function formatPayrollWeekRange(weekStart?: string | null, weekEnd?: string | null): string {
  const start = weekStart?.trim()
  const end = weekEnd?.trim()
  if (start && end) return `${start}–${end}`
  return start || end || ''
}

export function formatProductionBatchJournalMemo(
  batchNumber?: string | null,
  productName?: string | null
): string {
  const product = productName?.trim() || 'Product'
  const batch = formatProductionBatchLabel(batchNumber)
  if (batch) return `${product} (${batch})`
  return product
}

function formatProductionBatchLabel(batchNumber?: string | null): string {
  const raw = batchNumber?.trim()
  if (!raw) return ''
  const withoutPrefix = raw.replace(/^batch-/i, '')
  return `batch-${withoutPrefix}`
}

function formatJournalQtyDisplay(qty: number): string {
  if (!Number.isFinite(qty)) return '0'
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(2)
}

export function formatFactoryMaterialReleaseJournalMemo(
  materialName?: string | null,
  quantity?: number | string | null,
  unit?: string | null
): string {
  const name = materialName?.trim() || 'Material'
  const qtyNum = quantity != null && quantity !== '' ? Number(quantity) : NaN
  const qty = Number.isFinite(qtyNum) ? formatJournalQtyDisplay(qtyNum) : null
  const unitLabel = unit?.trim()
  if (qty && unitLabel) return `${name} - ${qty} ${unitLabel}`
  if (qty) return `${name} - ${qty}`
  return name
}

export function formatFactoryWipAdjustmentJournalMemo(
  materialName?: string | null,
  packageLabel?: string | null
): string {
  const name = materialName?.trim() || 'Material'
  const label = packageLabel?.trim()
  if (label) return `${name} (${label})`
  return name
}

export function formatStaffAdvanceJournalMemo(staffName?: string | null): string {
  return staffName?.trim() || 'Staff'
}

export function formatStockMovementJournalMemo(
  movementType?: string | null,
  materialName?: string | null
): string {
  const name = materialName?.trim() || 'Material'
  const action = stockMovementActionLabel(movementType)
  return `${action} - ${name}`
}

export function formatAssetMovementJournalMemo(
  movementType?: string | null,
  assetName?: string | null
): string {
  const name = assetName?.trim() || 'Asset'
  const action = assetMovementActionLabel(movementType)
  return `${action} - ${name}`
}

function stockMovementActionLabel(movementType?: string | null): string {
  switch (movementType) {
    case 'in':
      return 'Stock in'
    case 'out':
      return 'Stock out'
    case 'adjustment':
      return 'Stock adjustment'
    default:
      return 'Stock movement'
  }
}

function assetMovementActionLabel(movementType?: string | null): string {
  switch (movementType) {
    case 'in':
      return 'Asset in'
    case 'out':
      return 'Asset out'
    case 'adjustment':
      return 'Asset adjustment'
    default:
      return 'Asset movement'
  }
}

export function formatProductCycleCountJournalMemo(countDate?: string | null): string {
  const date = countDate?.trim() || 'Count'
  return `Product count - ${date}`
}

export function formatProductOpeningStockJournalMemo(
  productName?: string | null,
  quantity?: number | null,
  unit?: string | null,
  unitCost?: number | null
): string {
  const name = productName?.trim() || 'Product'
  const qty = Number(quantity)
  const cost = Number(unitCost)
  const unitLabel = unit?.trim()
  if (Number.isFinite(qty) && qty > 0 && Number.isFinite(cost) && cost > 0) {
    const qtyPart = unitLabel ? `${formatOpeningQty(qty)} ${unitLabel}` : formatOpeningQty(qty)
    return `${name} ${qtyPart} @ ₱${formatOpeningMoney(cost)}`
  }
  return name
}

export function formatProductStockAdjustmentJournalMemo(
  productName?: string | null,
  quantityDelta?: number | null,
  unit?: string | null,
  unitCost?: number | null
): string {
  const name = productName?.trim() || 'Product'
  const delta = Number(quantityDelta)
  const cost = Number(unitCost)
  const unitLabel = unit?.trim()
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.0001) return name
  if (!Number.isFinite(cost) || cost <= 0) return name

  const sign = delta > 0 ? '+' : ''
  const qtyPart = unitLabel
    ? `${sign}${formatOpeningQty(delta)} ${unitLabel}`
    : `${sign}${formatOpeningQty(delta)}`
  return `${name} ${qtyPart} @ ₱${formatOpeningMoney(cost)}`
}

function formatOpeningQty(qty: number): string {
  return Number.isInteger(qty)
    ? String(qty)
    : qty.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function formatOpeningMoney(amount: number): string {
  return amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatMaterialCycleCountJournalMemo(countDate?: string | null): string {
  const date = countDate?.trim() || 'Count'
  return `Material count - ${date}`
}

export function formatOpeningBalanceJournalMemo(): string {
  return 'Opening balances'
}

export function formatYearEndCloseJournalMemo(fiscalYear?: string | number | null): string {
  const year = fiscalYear != null && String(fiscalYear).trim() !== '' ? String(fiscalYear).trim() : ''
  return year ? `Year-end close - ${year}` : 'Year-end close'
}

export function formatReversalJournalMemo(entryNumber?: string | null): string {
  const je = entryNumber?.trim()
  return je ? `Reversal - ${je}` : 'Reversal'
}
