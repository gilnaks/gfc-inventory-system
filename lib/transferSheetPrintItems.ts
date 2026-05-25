export interface TransferSheetLineItem {
  name: string
  sku?: string | null
  unit?: string
  quantity: number
  unitPrice?: number
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

function renderItemsHeader(showSku: boolean, showPrices: boolean, compactQty = false): string {
  return `
    <div class="items-header">
      <div class="header-cell header-checkbox">✓</div>
      <div class="header-cell header-item">Item</div>
      ${showSku ? '<div class="header-cell header-sku">SKU</div>' : ''}
      <div class="header-cell header-qty">${compactQty ? 'Qty' : 'Quantity'}</div>
      ${showPrices ? '<div class="header-cell header-price">Price</div><div class="header-cell header-total">Total</div>' : ''}
    </div>
  `
}

function renderItemRow(
  item: TransferSheetLineItem,
  showSku: boolean,
  showPrices: boolean,
  compactQty = false
): string {
  const sku = item.sku?.trim() ? escapeHtml(item.sku.trim()) : '—'
  const qtyText = compactQty
    ? String(item.quantity)
    : item.unit
      ? `${item.quantity} ${escapeHtml(item.unit)}`
      : String(item.quantity)
  const unitPrice = item.unitPrice ?? 0

  return `
    <div class="item-row">
      <div class="item-checkbox"><div class="checkbox"></div></div>
      <div class="item-name-cell"><div class="item-name">${escapeHtml(item.name)}</div></div>
      ${showSku ? `<div class="item-sku-col">${sku}</div>` : ''}
      <div class="item-quantity">${escapeHtml(qtyText)}</div>
      ${
        showPrices
          ? `<div class="item-unit-price">${formatMoney(unitPrice)}</div>
             <div class="item-price">${formatMoney(unitPrice * item.quantity)}</div>`
          : ''
      }
    </div>
  `
}

const ITEMS_PER_PRINT_COLUMN = 15

/** Item table for transfer sheet print: SKU column when single column; two columns at 16+ items (15 per column). */
export function renderTransferSheetItemsBlock(
  items: TransferSheetLineItem[],
  options?: { showPrices?: boolean }
): string {
  const showPrices = options?.showPrices ?? false
  const multiColumn = items.length > ITEMS_PER_PRINT_COLUMN
  const showSku = !multiColumn

  if (multiColumn) {
    const firstColumn = items.slice(0, ITEMS_PER_PRINT_COLUMN)
    const secondColumn = items.slice(ITEMS_PER_PRINT_COLUMN)

    return `
      <div class="items items-multi-column${showPrices ? ' items--with-prices' : ''}">
        <div class="items-column">
          ${renderItemsHeader(false, showPrices, true)}
          ${firstColumn.map((item) => renderItemRow(item, false, showPrices, true)).join('')}
        </div>
        <div class="items-column">
          ${renderItemsHeader(false, showPrices, true)}
          ${secondColumn.map((item) => renderItemRow(item, false, showPrices, true)).join('')}
        </div>
      </div>
    `
  }

  return `
    <div class="items${showPrices ? ' items--with-prices' : ''}">
      ${renderItemsHeader(true, showPrices)}
      ${items.map((item) => renderItemRow(item, true, showPrices)).join('')}
    </div>
  `
}
