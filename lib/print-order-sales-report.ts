import { escapeVoucherHtml, formatVoucherMoney, VOUCHER_PRINT_CLOSE_SCRIPT } from './voucherPrintStyles'
import { getBrandColorKey } from './brand-colors'
import type { OrderSalesReportData } from './order-sales-report'
import { formatOrderSalesMatrixCell, formatOrderSalesMoney } from './order-sales-report'

export type OrderSalesPrintParams = {
  brandName: string
  periodLabel: string
  filterNote?: string
  generatedByUsername?: string
  generatedByRole?: string
  report: OrderSalesReportData
}

function escape(s: string) {
  return escapeVoucherHtml(s)
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

function buildSummaryHtml(report: OrderSalesReportData): string {
  const { categories, summaryRows, categoryTotals, grandTotal } = report
  const franchise = report.includeFranchiseReceivables
  if (!summaryRows.length) {
    return `<p class="empty">No sales in this period.</p>`
  }

  const headCells = categories
    .map((c) => `<th class="num">${escape(c)}</th>`)
    .join('')
  const franchiseHeads = franchise
    ? `<th class="num">Discount</th><th class="num">Payable</th><th class="num">Paid Amt</th><th class="num">Balance</th>`
    : ''

  const bodyRows = summaryRows
    .map((row) => {
      const cells = categories
        .map((c) => {
          const amount = row.amountsByCategory[c] || 0
          const text = formatOrderSalesMatrixCell(amount)
          return `<td class="num">${text ? escape(text) : ''}</td>`
        })
        .join('')
      const franchiseCells = franchise
        ? `<td class="num">${escape(formatOrderSalesMatrixCell(row.franchise?.discount || 0))}</td>
           <td class="num">${escape(formatOrderSalesMoney(row.franchise?.payable || 0))}</td>
           <td class="num">${escape(formatOrderSalesMatrixCell(row.franchise?.paidAmt || 0))}</td>
           <td class="num"><strong>${escape(formatOrderSalesMoney(row.franchise?.balance || 0))}</strong></td>`
        : ''
      return `<tr>
        <td>${escape(row.locationName)}</td>
        ${cells}
        <td class="num"><strong>${escape(formatOrderSalesMatrixCell(row.locationTotal) || '0.00')}</strong></td>
        ${franchiseCells}
      </tr>`
    })
    .join('')

  const totalCells = categories
    .map((c) => {
      const amount = categoryTotals[c] || 0
      return `<td class="num">${escape(formatOrderSalesMatrixCell(amount) || '0.00')}</td>`
    })
    .join('')
  const franchiseTotals = franchise
    ? `<td class="num">${escape(formatOrderSalesMoney(report.franchiseTotals?.discount || 0))}</td>
       <td class="num">${escape(formatOrderSalesMoney(report.franchiseTotals?.payable || 0))}</td>
       <td class="num">${escape(formatOrderSalesMoney(report.franchiseTotals?.paidAmt || 0))}</td>
       <td class="num">${escape(formatOrderSalesMoney(report.franchiseTotals?.balance || 0))}</td>`
    : ''

  return `
    <h2 class="section-title">Summary by Location</h2>
    <table class="matrix">
      <thead>
        <tr>
          <th>Location</th>
          ${headCells}
          <th class="num">Total</th>
          ${franchiseHeads}
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
        <tr class="total-row">
          <td>TOTAL</td>
          ${totalCells}
          <td class="num">${escape(formatOrderSalesMatrixCell(grandTotal) || '0.00')}</td>
          ${franchiseTotals}
        </tr>
      </tbody>
    </table>`
}

function buildLocationDetailsHtml(report: OrderSalesReportData): string {
  if (!report.locations.length) return ''

  return report.locations
    .map((loc, index) => {
      const categoriesHtml = loc.categories
        .map((cat) => {
          const productRows = cat.products
            .map(
              (p) => `<tr>
              <td class="sku">${escape(p.sku || '—')}</td>
              <td>${escape(p.name)}</td>
              <td class="num">${escape(String(p.qty))}</td>
              <td class="num">${escape(formatVoucherMoney(p.amount).replace('₱', ''))}</td>
            </tr>`
            )
            .join('')

          return `
            <div class="category-block">
              <h4 class="category-title">${escape(cat.name)}</h4>
              <table class="detail">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th class="num">Qty</th>
                    <th class="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${productRows}
                  <tr class="subtotal">
                    <td colspan="2">Category total</td>
                    <td class="num">${escape(String(cat.qty))}</td>
                    <td class="num">${escape(formatVoucherMoney(cat.amount).replace('₱', ''))}</td>
                  </tr>
                </tbody>
              </table>
            </div>`
        })
        .join('')

      return `
        <section class="location-section${index === 0 ? '' : ' page-break'}">
          <h2 class="section-title">${escape(loc.locationName)}</h2>
          ${categoriesHtml || '<p class="empty">No line items.</p>'}
          <div class="location-total">Location total: <strong>${escape(formatVoucherMoney(loc.locationTotal))}</strong></div>
        </section>`
    })
    .join('')
}

export function openOrderSalesReportPrintWindow(params: OrderSalesPrintParams): boolean {
  const accent = brandAccent(params.brandName)
  const user = (params.generatedByUsername || '').trim() || 'Unknown user'
  const role = (params.generatedByRole || '').trim()
  const generatedBy = role ? `${user} (${role})` : user
  const filterNote = (params.filterNote || '').trim()

  const bodyHtml = `
    ${buildSummaryHtml(params.report)}
    <h2 class="section-title page-break-before">Location Detail</h2>
    ${buildLocationDetailsHtml(params.report)}
  `

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Order Sales Report — ${escape(params.brandName)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      font-size: 10pt;
      color: #111;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: 100%;
      max-width: 210mm;
      margin: 0 auto;
      padding: 12mm 14mm 14mm;
    }
    .header {
      border-bottom: 2px solid #111;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .brand-band {
      display: inline-block;
      background: ${accent.band};
      color: ${accent.text};
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 6px 12px;
      border-radius: 4px;
      margin-bottom: 8px;
    }
    .doc-title {
      margin: 0 0 4px;
      font-size: 16pt;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .meta {
      font-size: 9pt;
      color: #444;
      line-height: 1.45;
    }
    .section-title {
      margin: 18px 0 8px;
      font-size: 12pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    table.matrix, table.detail {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    table.matrix th, table.matrix td,
    table.detail th, table.detail td {
      padding: 5px 6px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }
    table.matrix th, table.detail th {
      text-align: left;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #374151;
      background: ${accent.band};
      border-bottom: 1.5px solid #111;
    }
    table.matrix th.num, table.matrix td.num,
    table.detail th.num, table.detail td.num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    table.matrix .total-row td,
    table.detail .subtotal td {
      border-top: 1.5px solid #111;
      font-weight: 700;
      padding-top: 7px;
      padding-bottom: 7px;
    }
    table.detail .sku {
      width: 90px;
      font-family: ui-monospace, Consolas, monospace;
      font-size: 8.5pt;
      color: #4b5563;
    }
    .category-block { margin-bottom: 12px; }
    .category-title {
      margin: 10px 0 4px;
      font-size: 10pt;
      font-weight: 700;
      color: ${accent.text};
    }
    .location-total {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid #9ca3af;
      text-align: right;
      font-size: 10.5pt;
    }
    .empty { color: #6b7280; font-style: italic; }
    .footer {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #ccc;
      font-size: 8pt;
      color: #666;
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 10px 14px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .toolbar button {
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #fff;
      cursor: pointer;
    }
    .toolbar button.primary {
      background: #111;
      color: #fff;
      border-color: #111;
    }
    .page-break, .page-break-before { page-break-before: always; break-before: page; }
    @media print {
      .toolbar, .no-print { display: none !important; }
      .sheet { max-width: none; padding: 8mm 10mm; }
    }
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
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
      <h1 class="doc-title">Order Sales Report</h1>
      <div class="meta">
        <div>Period: ${escape(params.periodLabel)}</div>
        ${filterNote ? `<div>${escape(filterNote)}</div>` : ''}
        <div>Generated by: ${escape(generatedBy)}</div>
        <div>Printed: ${escape(printedAtLabel())}</div>
      </div>
    </header>
    ${bodyHtml}
    <footer class="footer">
      <span>Order Sales Report — ${escape(params.brandName)}</span>
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
