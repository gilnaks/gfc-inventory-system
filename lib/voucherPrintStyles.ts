/** Letter-size voucher print styles (PV / PCV). */
export const VOUCHER_PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    line-height: 1.35;
    color: #111827;
    padding: 0.35in 0.4in;
    background: #fff;
  }
  @page { size: letter; margin: 0.35in; }
  .company { font-size: 14px; font-weight: 700; letter-spacing: 0.5px; }
  .address { font-size: 10px; color: #374151; margin-top: 2px; }
  .doc-title {
    font-size: 15px;
    font-weight: 700;
    text-align: center;
    margin: 10px 0 8px;
    text-decoration: underline;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
    font-size: 11px;
  }
  .meta-field { flex: 1; border-bottom: 1px solid #111; min-height: 16px; padding-bottom: 1px; }
  .meta-label { font-weight: 600; margin-right: 4px; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
  }
  th, td {
    border: 1px solid #111;
    padding: 5px 6px;
    font-size: 10px;
    vertical-align: top;
  }
  th { background: #f3f4f6; font-weight: 700; text-align: center; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .section-label { font-weight: 700; font-size: 10px; margin: 8px 0 4px; }
  .checkbox-line { margin: 3px 0; font-size: 10px; }
  .box { border: 1px solid #111; padding: 8px; margin: 6px 0; }
  .sig-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
    margin-top: 16px;
  }
  .sig-block { text-align: center; font-size: 10px; }
  .sig-line {
    border-bottom: 1px solid #111;
    height: 28px;
    margin-bottom: 4px;
  }
  .sig-name { font-weight: 700; font-size: 9px; }
  .total-row td { font-weight: 700; }
  .purpose-box {
    border: 1px solid #111;
    min-height: 48px;
    padding: 6px;
    margin: 4px 0 8px;
  }
`

/** Compact layout additions for payment voucher (PV) print. */
export const PAYMENT_VOUCHER_PRINT_STYLES = `
  body.pv-print { padding: 0.25in 0.35in; font-size: 10px; line-height: 1.3; }
  .pv-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1.5px solid #111;
  }
  .pv-header-left { flex: 1; min-width: 0; }
  .pv-header-right { text-align: right; flex-shrink: 0; }
  .pv-header-right .doc-title {
    margin: 0 0 4px;
    text-align: right;
    text-decoration: none;
    font-size: 13px;
    letter-spacing: 0.3px;
  }
  .pv-id-row { font-size: 10px; white-space: nowrap; }
  .pv-id-row span + span { margin-left: 12px; }
  .pv-fields {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 6px;
    table-layout: fixed;
  }
  .pv-fields td {
    border: 1px solid #111;
    padding: 4px 6px;
    font-size: 10px;
    vertical-align: top;
    width: 50%;
  }
  .pv-fields .field-label {
    display: block;
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #374151;
    margin-bottom: 1px;
  }
  .pv-fields .field-value {
    font-size: 10px;
    min-height: 14px;
    word-break: break-word;
  }
  .pv-fields .field-value.amount {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .pv-panel {
    border: 1px solid #111;
    margin-bottom: 6px;
  }
  .pv-panel-title {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 3px 6px;
    background: #f3f4f6;
    border-bottom: 1px solid #111;
  }
  .pv-panel-body { padding: 4px 6px; }
  .check-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2px 6px;
    font-size: 9px;
  }
  .check-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
  .check-item { white-space: nowrap; }
  .check-item-on { font-weight: 700; }
  .check-detail {
    font-weight: 400;
    font-size: 9px;
    margin-left: 2px;
  }
  .pv-split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    margin-bottom: 6px;
    border: 1px solid #111;
  }
  .pv-split > div + div { border-left: 1px solid #111; }
  .pv-split .pv-panel { border: none; margin: 0; }
  .pv-split .pv-panel-title { border-bottom: 1px solid #111; }
  table.pv-lines th, table.pv-lines td { padding: 3px 5px; font-size: 9px; }
  table.pv-lines .col-no { width: 22px; }
  table.pv-lines .col-ref { width: 18%; }
  table.pv-lines .col-amt { width: 88px; }
  .pv-sig-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin-top: 8px;
  }
  .pv-sig-grid .sig-line { height: 22px; margin-bottom: 2px; }
  .pv-sig-grid .sig-block { font-size: 9px; }
  @media print {
    body.pv-print { padding: 0; }
  }
`

export function renderCheckboxGrid(
  items: Array<{ label: string; checked: boolean }>,
  cols: 3 | 4 = 4
): string {
  const colClass = cols === 3 ? 'check-grid cols-3' : 'check-grid'
  return `<div class="${colClass}">${items
    .map(
      ({ label, checked }) =>
        `<span class="check-item${checked ? ' check-item-on' : ''}">${checkboxMark(checked)} ${escapeVoucherHtml(label)}</span>`
    )
    .join('')}</div>`
}

export function escapeVoucherHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatVoucherMoney(amount: number) {
  const n = Number(amount) || 0
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function checkboxMark(checked: boolean) {
  return checked ? '☑' : '☐'
}

/** Opens print dialog on load; closes tab after print or cancel (afterprint). */
export const VOUCHER_PRINT_CLOSE_SCRIPT = `
  window.addEventListener('afterprint', function () {
    window.close();
  });
  window.addEventListener('load', function () {
    setTimeout(function () {
      window.print();
    }, 150);
  });
`
