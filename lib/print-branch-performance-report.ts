import { escapeVoucherHtml, formatVoucherMoney, VOUCHER_PRINT_CLOSE_SCRIPT } from './voucherPrintStyles'
import { getBrandColorKey } from './brand-colors'

export type BranchPerformanceSummary = {
  totalGrossSales: number
  totalNetSales: number
  totalBigCupSales: number
  totalSmallCupSales: number
  totalBigCupQuantity: number
  totalSmallCupQuantity: number
  totalReports: number
  totalQuantity: number
  salesPerUnit: number
  periodDays?: number
  weeksInPeriod?: number
  dsirReportDays?: number
  avgWeeklyBigCups?: number
  avgWeeklySmallCups?: number
  categoryLabel?: string
}

export type BranchPerformanceBreakdownRow = {
  location: string
  grossSales: number
  netSales?: number
  bigCupQuantity: number
  smallCupQuantity: number
  avgWeeklyBigCups: number
  avgWeeklySmallCups: number
  pansDelivered: number
  salesPerPan: number
  dsirReportDays: number
  reportCount?: number
}

export type BranchPerformanceDailyRow = {
  date: string
  location: string
  grossSales: number
  bigCupQty?: number
  smallCupQty?: number
  takeawayQty?: number
  waterQty?: number
  ml500Qty?: number
  chocoQty?: number
  itemsSold?: Array<{ itemName: string; quantity: number }>
}

export type BranchPerformancePrintParams = {
  brandName: string
  periodLabel: string
  filterNote?: string
  generatedByUsername?: string
  generatedByRole?: string
  summary: BranchPerformanceSummary
  branchBreakdown: BranchPerformanceBreakdownRow[]
  itemSoldSummary?: Array<{ itemName: string; quantity: number }>
  dailyRows?: BranchPerformanceDailyRow[]
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

function buildSummaryCardsHtml(summary: BranchPerformanceSummary): string {
  const panLabel = summary.categoryLabel
    ? `${summary.categoryLabel} Delivered`
    : 'Pans Delivered'
  const periodNote =
    summary.periodDays && summary.periodDays > 0
      ? ` · ${summary.periodDays}-day period`
      : ''

  return `
    <h2 class="section-title">Summary</h2>
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">Gross Sales</div>
        <div class="kpi-value">${escape(money(summary.totalGrossSales))}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Net Sales</div>
        <div class="kpi-value">${escape(money(summary.totalNetSales))}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">DSIR Reports</div>
        <div class="kpi-value">${escape(num(summary.totalReports))}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">${escape(panLabel)}</div>
        <div class="kpi-value">${escape(num(summary.totalQuantity))}</div>
      </div>
      <div class="kpi accent">
        <div class="kpi-label">Big Cup Sales</div>
        <div class="kpi-value">${escape(money(summary.totalBigCupSales))}</div>
        <div class="kpi-sub">${escape(num(summary.totalBigCupQuantity))} cups
          ${
            summary.avgWeeklyBigCups != null
              ? ` · ${escape(num(summary.avgWeeklyBigCups, 1))} avg/wk${escape(periodNote)}`
              : ''
          }
        </div>
      </div>
      <div class="kpi accent">
        <div class="kpi-label">Small Cup Sales</div>
        <div class="kpi-value">${escape(money(summary.totalSmallCupSales))}</div>
        <div class="kpi-sub">${escape(num(summary.totalSmallCupQuantity))} cups
          ${
            summary.avgWeeklySmallCups != null
              ? ` · ${escape(num(summary.avgWeeklySmallCups, 1))} avg/wk${escape(periodNote)}`
              : ''
          }
        </div>
      </div>
      <div class="kpi accent">
        <div class="kpi-label">Sales Per Pan</div>
        <div class="kpi-value">${escape(money(summary.salesPerUnit))}</div>
        <div class="kpi-sub">${escape(num(summary.totalQuantity))} ${escape(
          (summary.categoryLabel || 'pan').toLowerCase()
        )} delivered</div>
      </div>
    </div>`
}

function buildBranchTableHtml(
  rows: BranchPerformanceBreakdownRow[],
  categoryLabel?: string
): string {
  if (!rows.length) {
    return `<p class="empty">No branch data in this period.</p>`
  }

  const pansHeader = categoryLabel ? `${categoryLabel} Pans` : 'Pans'
  const body = rows
    .map(
      (row) => `<tr>
      <td>${escape(row.location)}</td>
      <td class="num">${escape(money(row.grossSales))}</td>
      <td class="num">${escape(num(row.bigCupQuantity))}</td>
      <td class="num">${escape(num(row.avgWeeklyBigCups, 1))}</td>
      <td class="num">${escape(num(row.smallCupQuantity))}</td>
      <td class="num">${escape(num(row.avgWeeklySmallCups, 1))}</td>
      <td class="num">${escape(num(row.pansDelivered))}</td>
      <td class="num">${escape(money(row.salesPerPan))}</td>
      <td class="num">${escape(num(row.dsirReportDays))}</td>
    </tr>`
    )
    .join('')

  return `
    <h2 class="section-title">Branch Breakdown</h2>
    <table class="report">
      <thead>
        <tr>
          <th>Branch</th>
          <th class="num">Gross Sales</th>
          <th class="num">Big Cups</th>
          <th class="num">Avg/Wk Big</th>
          <th class="num">Small Cups</th>
          <th class="num">Avg/Wk Small</th>
          <th class="num">${escape(pansHeader)}</th>
          <th class="num">Sales / Pan</th>
          <th class="num">DSIR Days</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`
}

function buildItemSoldSummaryHtml(
  rows: Array<{ itemName: string; quantity: number }> | undefined
): string {
  if (!rows?.length) return ''
  const body = rows
    .map(
      (row) => `<tr>
      <td>${escape(row.itemName)}</td>
      <td class="num">${escape(num(row.quantity))}</td>
    </tr>`
    )
    .join('')
  const total = rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
  return `
    <h2 class="section-title">Items Sold</h2>
    <table class="report">
      <thead>
        <tr>
          <th>Item</th>
          <th class="num">Qty Sold</th>
        </tr>
      </thead>
      <tbody>
        ${body}
        <tr class="total-row">
          <td>TOTAL</td>
          <td class="num">${escape(num(total))}</td>
        </tr>
      </tbody>
    </table>`
}

function buildDailyTableHtml(rows: BranchPerformanceDailyRow[] | undefined): string {
  if (!rows?.length) return ''

  const byBranch = new Map<string, BranchPerformanceDailyRow[]>()
  for (const row of rows) {
    const key = (row.location || 'Unknown').trim() || 'Unknown'
    const list = byBranch.get(key)
    if (list) list.push(row)
    else byBranch.set(key, [row])
  }

  const branchNames = [...byBranch.keys()].sort((a, b) => a.localeCompare(b))

  const sections = branchNames
    .map((branchName, index) => {
      const branchRows = (byBranch.get(branchName) || []).slice().sort((a, b) => {
        const byDate = String(a.date).localeCompare(String(b.date))
        if (byDate !== 0) return byDate
        return 0
      })
      const branchTotal = branchRows.reduce((sum, r) => sum + (Number(r.grossSales) || 0), 0)
      const body = branchRows
        .map((row) => {
          const items =
            (row.itemsSold || [])
              .map((i) => `${escape(i.itemName)} (${escape(num(i.quantity))})`)
              .join(', ') || '—'
          return `<tr>
          <td>${escape(row.date)}</td>
          <td class="num">${escape(money(row.grossSales))}</td>
          <td class="num">${escape(num(row.bigCupQty || 0))}</td>
          <td class="num">${escape(num(row.smallCupQty || 0))}</td>
          <td class="num">${escape(num(row.takeawayQty || 0))}</td>
          <td class="num">${escape(num(row.waterQty || 0))}</td>
          <td class="num">${escape(num(row.ml500Qty || 0))}</td>
          <td class="num">${escape(num(row.chocoQty || 0))}</td>
          <td class="items">${items}</td>
        </tr>`
        })
        .join('')

      return `
      <section class="daily-branch${index === 0 ? ' page-break-before' : ' page-break'}">
        <h2 class="section-title">Daily DSIR — ${escape(branchName)}</h2>
        <table class="report">
          <thead>
            <tr>
              <th>Date</th>
              <th class="num">Gross Sales</th>
              <th class="num">Big</th>
              <th class="num">Small</th>
              <th class="num">Takeaway</th>
              <th class="num">Water</th>
              <th class="num">500ml</th>
              <th class="num">Choco</th>
              <th>Items Sold</th>
            </tr>
          </thead>
          <tbody>
            ${body}
            <tr class="total-row">
              <td>TOTAL</td>
              <td class="num">${escape(money(branchTotal))}</td>
              <td class="num">${escape(num(branchRows.reduce((s, r) => s + (r.bigCupQty || 0), 0)))}</td>
              <td class="num">${escape(num(branchRows.reduce((s, r) => s + (r.smallCupQty || 0), 0)))}</td>
              <td class="num">${escape(num(branchRows.reduce((s, r) => s + (r.takeawayQty || 0), 0)))}</td>
              <td class="num">${escape(num(branchRows.reduce((s, r) => s + (r.waterQty || 0), 0)))}</td>
              <td class="num">${escape(num(branchRows.reduce((s, r) => s + (r.ml500Qty || 0), 0)))}</td>
              <td class="num">${escape(num(branchRows.reduce((s, r) => s + (r.chocoQty || 0), 0)))}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </section>`
    })
    .join('')

  return sections
}

export function openBranchPerformanceReportPrintWindow(
  params: BranchPerformancePrintParams
): boolean {
  const accent = brandAccent(params.brandName)
  const user = (params.generatedByUsername || '').trim() || 'Unknown user'
  const role = (params.generatedByRole || '').trim()
  const generatedBy = role ? `${user} (${role})` : user
  const filterNote = (params.filterNote || '').trim()

  const bodyHtml = `
    ${buildSummaryCardsHtml(params.summary)}
    ${buildBranchTableHtml(params.branchBreakdown, params.summary.categoryLabel)}
    ${buildItemSoldSummaryHtml(params.itemSoldSummary)}
    ${buildDailyTableHtml(params.dailyRows)}
  `

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Branch Performance — ${escape(params.brandName)}</title>
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
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 8px;
    }
    .kpi {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px 12px;
      background: #f9fafb;
    }
    .kpi.accent {
      background: ${accent.band};
      border-color: transparent;
    }
    .kpi-label {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #4b5563;
      margin-bottom: 4px;
    }
    .kpi-value {
      font-size: 13pt;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .kpi-sub {
      margin-top: 4px;
      font-size: 8pt;
      color: #4b5563;
    }
    table.report {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    table.report th, table.report td {
      padding: 5px 6px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }
    table.report th {
      text-align: left;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #374151;
      background: ${accent.band};
      border-bottom: 1.5px solid #111;
    }
    table.report th.num, table.report td.num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    table.report td.items {
      font-size: 7.5pt;
      line-height: 1.35;
    }
    table.report .total-row td {
      border-top: 1.5px solid #111;
      font-weight: 700;
      padding-top: 7px;
      padding-bottom: 7px;
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
    .page-break-before { page-break-before: always; break-before: page; }
    .page-break { page-break-before: always; break-before: page; }
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
      <h1 class="doc-title">Branch Performance Report</h1>
      <div class="meta">
        <div>Period: ${escape(params.periodLabel)}</div>
        ${filterNote ? `<div>${escape(filterNote)}</div>` : ''}
        <div>Generated by: ${escape(generatedBy)}</div>
        <div>Printed: ${escape(printedAtLabel())}</div>
      </div>
    </header>
    ${bodyHtml}
    <footer class="footer">
      <span>Branch Performance (DSIR) — ${escape(params.brandName)}</span>
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
