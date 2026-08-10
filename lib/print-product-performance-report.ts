import { escapeVoucherHtml, formatVoucherMoney, VOUCHER_PRINT_CLOSE_SCRIPT } from './voucherPrintStyles'
import { getBrandColorKey } from './brand-colors'

export type ProductPerformanceRow = {
  productName: string
  quantity: number
  amount: number
}

export type ProductPerformancePrintParams = {
  brandName: string
  periodLabel: string
  filterNote?: string
  generatedByUsername?: string
  generatedByRole?: string
  totalQuantity: number
  totalAmount: number
  rows: ProductPerformanceRow[]
}

function escape(s: string) {
  return escapeVoucherHtml(s)
}

function money(n: number) {
  return formatVoucherMoney(n)
}

function num(n: number, digits = 0) {
  return Number(n || 0).toLocaleString('en-PH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function printedAtLabel() {
  return new Date().toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function brandAccent(brandName: string): { band: string; text: string } {
  switch (getBrandColorKey(brandName)) {
    case 'green':
      return { band: '#dcfce7', text: '#166534' }
    case 'red':
      return { band: '#fee2e2', text: '#991b1b' }
    case 'yellow':
      return { band: '#fef3c7', text: '#92400e' }
    default:
      return { band: '#dbeafe', text: '#1e40af' }
  }
}

export function openProductPerformanceReportPrintWindow(
  params: ProductPerformancePrintParams
): boolean {
  const accent = brandAccent(params.brandName)
  const user = (params.generatedByUsername || '').trim() || 'Unknown user'
  const role = (params.generatedByRole || '').trim()
  const generatedBy = role ? `${user} (${role})` : user
  const filterNote = (params.filterNote || '').trim()

  const sorted = [...params.rows].sort((a, b) => b.quantity - a.quantity)
  const bodyRows = sorted
    .map(
      (row, i) => `<tr>
      <td class="num">${i + 1}</td>
      <td>${escape(row.productName)}</td>
      <td class="num">${escape(num(row.quantity))}</td>
      <td class="num">${escape(money(row.amount))}</td>
    </tr>`
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Product Performance — ${escape(params.brandName)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 0;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      font-size: 10pt; color: #111; background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .sheet { width: 100%; max-width: 210mm; margin: 0 auto; padding: 12mm 14mm 14mm; }
    .header { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
    .brand-band {
      display: inline-block; background: ${accent.band}; color: ${accent.text};
      font-size: 11pt; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
      padding: 6px 12px; border-radius: 4px; margin-bottom: 8px;
    }
    .doc-title { margin: 0 0 4px; font-size: 16pt; font-weight: 700; }
    .meta { font-size: 9pt; color: #444; line-height: 1.45; }
    .section-title {
      margin: 16px 0 8px; font-size: 12pt; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
    .kpi {
      border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px;
      background: ${accent.band};
    }
    .kpi-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em; color: #4b5563; }
    .kpi-value { font-size: 14pt; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 4px; }
    table.report { width: 100%; border-collapse: collapse; }
    table.report th, table.report td {
      padding: 5px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top;
    }
    table.report th {
      text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em;
      color: #374151; background: ${accent.band}; border-bottom: 1.5px solid #111;
    }
    table.report th.num, table.report td.num {
      text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap;
    }
    table.report .total-row td {
      border-top: 1.5px solid #111; font-weight: 700; padding-top: 7px; padding-bottom: 7px;
    }
    .empty { color: #6b7280; font-style: italic; }
    .footer {
      margin-top: 20px; padding-top: 8px; border-top: 1px solid #ccc;
      font-size: 8pt; color: #666; display: flex; justify-content: space-between; gap: 12px;
    }
    .toolbar {
      position: sticky; top: 0; z-index: 10; display: flex; justify-content: flex-end; gap: 8px;
      padding: 10px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
    }
    .toolbar button {
      font: inherit; font-size: 12px; font-weight: 600; padding: 8px 14px;
      border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer;
    }
    .toolbar button.primary { background: #111; color: #fff; border-color: #111; }
    @media print {
      .toolbar, .no-print { display: none !important; }
      .sheet { max-width: none; padding: 8mm 10mm; }
    }
    @page { size: A4 portrait; margin: 10mm; }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" class="primary" onclick="window.print()">Print / Save as PDF</button>
    <button type="button" onclick="window.close()">Close</button>
  </div>
  <div class="sheet">
    <header class="header">
      <div class="brand-band">${escape(params.brandName)}</div>
      <h1 class="doc-title">Product Performance Report</h1>
      <div class="meta">
        <div>Period: ${escape(params.periodLabel)}</div>
        ${filterNote ? `<div>${escape(filterNote)}</div>` : ''}
        <div>Generated by: ${escape(generatedBy)}</div>
        <div>Printed: ${escape(printedAtLabel())}</div>
      </div>
    </header>
    <h2 class="section-title">Summary</h2>
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">Total Quantity</div>
        <div class="kpi-value">${escape(num(params.totalQuantity))}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Total Amount</div>
        <div class="kpi-value">${escape(money(params.totalAmount))}</div>
      </div>
    </div>
    <h2 class="section-title">Products</h2>
    ${
      sorted.length
        ? `<table class="report">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Product</th>
          <th class="num">Quantity</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
        <tr class="total-row">
          <td></td>
          <td>TOTAL</td>
          <td class="num">${escape(num(params.totalQuantity))}</td>
          <td class="num">${escape(money(params.totalAmount))}</td>
        </tr>
      </tbody>
    </table>`
        : `<p class="empty">No product sales in this period.</p>`
    }
    <footer class="footer">
      <span>Product Performance — ${escape(params.brandName)}</span>
      <span>${escape(params.periodLabel)}</span>
    </footer>
  </div>
  <script>${VOUCHER_PRINT_CLOSE_SCRIPT}</script>
</body>
</html>`

  const w = window.open('', '_blank')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  w.focus()
  return true
}
