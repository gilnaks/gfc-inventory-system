export interface TransferSheetCategoryTotal {
  category: string
  totalQuantity: number
  totalAmount: number
}

export interface TransferSheetTotalsParams {
  categoryTotals: TransferSheetCategoryTotal[]
  subtotal: number
  deliveryType: string
  grandTotal: number
  /** Order notes shown inside the remarks box */
  remarks?: string | null
  /** OrderManager: show row when logistics is "none" */
  showLogisticsNone?: boolean
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatMoney(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Two-column totals: breakdown on the left, grand total only on the right. */
export function renderTransferSheetTotalsSection(params: TransferSheetTotalsParams): string {
  const { categoryTotals, subtotal, deliveryType, grandTotal, remarks, showLogisticsNone } = params
  const remarksText = remarks?.trim() ? escapeHtml(remarks.trim()) : ''

  const categoryRows = categoryTotals
    .map(
      (ct) => `
    <div class="total-row">
      <span class="total-label">${escapeHtml(ct.category)}: ${ct.totalQuantity} items</span>
      <span class="total-value">${formatMoney(ct.totalAmount)}</span>
    </div>
  `
    )
    .join('')

  const deliveryRow =
    deliveryType === 'delivery'
      ? `
    <div class="total-row">
      <span class="total-label">Delivery Fee</span>
      <span class="total-value">${subtotal >= 10000 ? 'FREE (Order over ₱10k)' : '+₱500.00'}</span>
    </div>
  `
      : ''

  const pickupDiscountRow =
    deliveryType === 'pickup' && subtotal >= 10000
      ? `
    <div class="total-row">
      <span class="total-label">Pickup Discount (5%)</span>
      <span class="total-value">-${formatMoney(subtotal * 0.05)}</span>
    </div>
  `
      : ''

  const pickupUnavailableRow =
    deliveryType === 'pickup' && subtotal < 10000
      ? `
    <div class="total-row">
      <span class="total-label">Pickup Discount</span>
      <span class="total-value">Not available (Order under ₱10k)</span>
    </div>
  `
      : ''

  const logisticsNoneRow = showLogisticsNone && deliveryType === 'none'
    ? `
    <div class="total-row">
      <span class="total-label">Logistics</span>
      <span class="total-value">None (No discount, no delivery fee)</span>
    </div>
  `
    : ''

  return `
    <div class="total-section total-section-two-col">
      <div class="total-section-breakdown">
        ${categoryRows}
        <div class="total-row">
          <span class="total-label">Subtotal</span>
          <span class="total-value">${formatMoney(subtotal)}</span>
        </div>
        ${deliveryRow}
        ${pickupDiscountRow}
        ${pickupUnavailableRow}
        ${logisticsNoneRow}
      </div>
      <div class="total-section-grand">
        <div class="total-grand-block">
          <span class="total-grand-label">Total Amount</span>
          <span class="total-grand-value">${formatMoney(grandTotal)}</span>
        </div>
        <div class="total-remarks-box">
          <div class="total-remarks-area">
            <div class="total-remarks-label">Remarks</div>
            <div class="total-remarks-text">${remarksText}</div>
          </div>
        </div>
      </div>
    </div>
  `
}
