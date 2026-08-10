import { escapeVoucherHtml, formatVoucherMoney, VOUCHER_PRINT_CLOSE_SCRIPT } from './voucherPrintStyles'
import { getBrandColorKey } from './brand-colors'

export type StaffPerformanceDailyRow = {
  date: string
  locationName: string
  hours: number
  dayType: string
  sales: number
  bigCupQty?: number
  smallCupQty?: number
  takeawayQty?: number
  waterQty?: number
  ml500Qty?: number
  chocoQty?: number
  itemsSold?: Array<{ itemName: string; quantity: number }>
}

export type StaffPerformanceRow = {
  staffId?: string
  staffName: string
  averageSales: number
  totalGrossSales: number
  workingDays?: number
  dsirDays?: number
  totalWorkingHours: number
  regularPay?: number
  overtimePay?: number
  doublePay?: number
  specialPay?: number
  incentivePay?: number
  totalDeductions?: number
  refunds?: number
  totalPayroll: number
  bigCupQty?: number
  smallCupQty?: number
  takeawayQty?: number
  waterQty?: number
  ml500Qty?: number
  chocoQty?: number
  dailyBreakdown?: StaffPerformanceDailyRow[]
}

export type StaffPerformancePrintParams = {
  brandName: string
  periodLabel: string
  filterNote?: string
  generatedByUsername?: string
  generatedByRole?: string
  totalStaff: number
  averageSales: number
  totalGrossSales: number
  totalPayroll: number
  totalDoublePay?: number
  totalSpecialPay?: number
  totalOvertimePay?: number
  totalIncentivePay?: number
  totalDeductions?: number
  totalRefunds?: number
  rows: StaffPerformanceRow[]
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

function dayTypeLabel(dayType: string): string {
  if (dayType === 'regular-holiday') return 'Double'
  if (dayType === 'special-holiday') return 'Special'
  return 'Regular'
}

export function openStaffPerformanceReportPrintWindow(
  params: StaffPerformancePrintParams
): boolean {
  const accent = brandAccent(params.brandName)
  const user = (params.generatedByUsername || '').trim() || 'Unknown user'
  const role = (params.generatedByRole || '').trim()
  const generatedBy = role ? `${user} (${role})` : user
  const filterNote = (params.filterNote || '').trim()

  const sorted = [...params.rows].sort((a, b) => b.totalGrossSales - a.totalGrossSales)
  const totalHours = sorted.reduce((sum, r) => sum + (Number(r.totalWorkingHours) || 0), 0)
  const bodyRows = sorted
    .map(
      (row, i) => `<tr>
      <td class="num">${i + 1}</td>
      <td>${escape(row.staffName)}</td>
      <td class="num">${escape(num(row.workingDays || 0))}</td>
      <td class="num">${escape(num(row.totalWorkingHours, 1))}</td>
      <td class="num">${escape(money(row.averageSales))}</td>
      <td class="num">${escape(money(row.totalGrossSales))}</td>
      <td class="num">${escape(money(row.regularPay || 0))}</td>
      <td class="num">${escape(money(row.overtimePay || 0))}</td>
      <td class="num">${escape(money(row.doublePay || 0))}</td>
      <td class="num">${escape(money(row.specialPay || 0))}</td>
      <td class="num">${escape(money(row.incentivePay || 0))}</td>
      <td class="num">${escape(money(row.totalDeductions || 0))}</td>
      <td class="num">${escape(money(row.refunds || 0))}</td>
      <td class="num"><strong>${escape(money(row.totalPayroll))}</strong></td>
    </tr>`
    )
    .join('')

  const dailySections = sorted
    .filter((row) => (row.dailyBreakdown || []).length > 0)
    .map((row, index) => {
      const days = row.dailyBreakdown || []
      const dayRows = days
        .map((d) => {
          const items =
            (d.itemsSold || [])
              .map((i) => `${escape(i.itemName)} (${escape(num(i.quantity))})`)
              .join(', ') || '—'
          return `<tr>
          <td>${escape(d.date)}</td>
          <td>${escape(d.locationName)}</td>
          <td>${escape(dayTypeLabel(d.dayType))}</td>
          <td class="num">${escape(num(d.hours, 1))}</td>
          <td class="num">${escape(money(d.sales))}</td>
          <td class="num">${escape(num(d.bigCupQty || 0))}</td>
          <td class="num">${escape(num(d.smallCupQty || 0))}</td>
          <td class="num">${escape(num(d.takeawayQty || 0))}</td>
          <td class="num">${escape(num(d.waterQty || 0))}</td>
          <td class="num">${escape(num(d.ml500Qty || 0))}</td>
          <td class="num">${escape(num(d.chocoQty || 0))}</td>
          <td class="items">${items}</td>
        </tr>`
        })
        .join('')
      const salesTotal = days.reduce((sum, d) => sum + (Number(d.sales) || 0), 0)
      const hoursTotal = days.reduce((sum, d) => sum + (Number(d.hours) || 0), 0)
      return `
      <section class="staff-daily${index === 0 ? ' page-break-before' : ' page-break'}">
        <h2 class="section-title">${escape(row.staffName)} — Working Days</h2>
        <p class="meta" style="margin-bottom:8px">
          Sold totals: Big ${escape(num(row.bigCupQty || 0))} · Small ${escape(num(row.smallCupQty || 0))} ·
          Takeaway ${escape(num(row.takeawayQty || 0))} · Water ${escape(num(row.waterQty || 0))} ·
          500ml ${escape(num(row.ml500Qty || 0))} · Choco ${escape(num(row.chocoQty || 0))}
        </p>
        <table class="report">
          <thead>
            <tr>
              <th>Date</th>
              <th>Location</th>
              <th>Day Type</th>
              <th class="num">Hours</th>
              <th class="num">Sales</th>
              <th class="num">Big</th>
              <th class="num">Small</th>
              <th class="num">Takeaway</th>
              <th class="num">Water</th>
              <th class="num">500ml</th>
              <th class="num">Choco</th>
              <th>All Items</th>
            </tr>
          </thead>
          <tbody>
            ${dayRows}
            <tr class="total-row">
              <td colspan="3">TOTAL</td>
              <td class="num">${escape(num(hoursTotal, 1))}</td>
              <td class="num">${escape(money(salesTotal))}</td>
              <td class="num">${escape(num(days.reduce((s, d) => s + (d.bigCupQty || 0), 0)))}</td>
              <td class="num">${escape(num(days.reduce((s, d) => s + (d.smallCupQty || 0), 0)))}</td>
              <td class="num">${escape(num(days.reduce((s, d) => s + (d.takeawayQty || 0), 0)))}</td>
              <td class="num">${escape(num(days.reduce((s, d) => s + (d.waterQty || 0), 0)))}</td>
              <td class="num">${escape(num(days.reduce((s, d) => s + (d.ml500Qty || 0), 0)))}</td>
              <td class="num">${escape(num(days.reduce((s, d) => s + (d.chocoQty || 0), 0)))}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </section>`
    })
    .join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Staff Performance — ${escape(params.brandName)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 0;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      font-size: 9pt; color: #111; background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .sheet { width: 100%; max-width: 210mm; margin: 0 auto; padding: 10mm 12mm 12mm; }
    .header { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 12px; }
    .brand-band {
      display: inline-block; background: ${accent.band}; color: ${accent.text};
      font-size: 11pt; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
      padding: 6px 12px; border-radius: 4px; margin-bottom: 8px;
    }
    .doc-title { margin: 0 0 4px; font-size: 15pt; font-weight: 700; }
    .meta { font-size: 8.5pt; color: #444; line-height: 1.45; }
    .section-title {
      margin: 14px 0 8px; font-size: 11pt; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px; }
    .kpi {
      border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px;
      background: ${accent.band};
    }
    .kpi-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.04em; color: #4b5563; }
    .kpi-value { font-size: 11pt; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 3px; }
    table.report { width: 100%; border-collapse: collapse; font-size: 8pt; }
    table.report th, table.report td {
      padding: 4px 5px; border-bottom: 1px solid #e5e7eb; vertical-align: top;
    }
    table.report th {
      text-align: left; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.03em;
      color: #374151; background: ${accent.band}; border-bottom: 1.5px solid #111;
    }
    table.report th.num, table.report td.num {
      text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap;
    }
    table.report td.items { font-size: 7pt; line-height: 1.3; }
    table.report .total-row td {
      border-top: 1.5px solid #111; font-weight: 700; padding-top: 6px; padding-bottom: 6px;
    }
    .empty { color: #6b7280; font-style: italic; }
    .footer {
      margin-top: 16px; padding-top: 8px; border-top: 1px solid #ccc;
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
    .page-break-before, .page-break { page-break-before: always; break-before: page; }
    @media print {
      .toolbar, .no-print { display: none !important; }
      .sheet { max-width: none; padding: 8mm 8mm; }
    }
    @page { size: A4 portrait; margin: 8mm; }
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
      <h1 class="doc-title">Staff Performance Report</h1>
      <div class="meta">
        <div>Period: ${escape(params.periodLabel)}</div>
        ${filterNote ? `<div>${escape(filterNote)}</div>` : ''}
        <div>Generated by: ${escape(generatedBy)}</div>
        <div>Printed: ${escape(printedAtLabel())}</div>
      </div>
    </header>
    <h2 class="section-title">Summary</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Staff</div><div class="kpi-value">${escape(num(params.totalStaff))}</div></div>
      <div class="kpi"><div class="kpi-label">Gross Sales</div><div class="kpi-value">${escape(money(params.totalGrossSales))}</div></div>
      <div class="kpi"><div class="kpi-label">Net Payroll</div><div class="kpi-value">${escape(money(params.totalPayroll))}</div></div>
      <div class="kpi"><div class="kpi-label">Double Pay</div><div class="kpi-value">${escape(money(params.totalDoublePay || 0))}</div></div>
      <div class="kpi"><div class="kpi-label">Special / OT / Incentive</div><div class="kpi-value">${escape(money((params.totalSpecialPay || 0) + (params.totalOvertimePay || 0) + (params.totalIncentivePay || 0)))}</div></div>
      <div class="kpi"><div class="kpi-label">Deductions</div><div class="kpi-value">${escape(money(params.totalDeductions || 0))}</div></div>
    </div>
    <h2 class="section-title">Staff Payroll & Sales</h2>
    ${
      sorted.length
        ? `<table class="report">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Staff</th>
          <th class="num">Days</th>
          <th class="num">Hours</th>
          <th class="num">Avg Sales</th>
          <th class="num">Gross Sales</th>
          <th class="num">Regular</th>
          <th class="num">OT</th>
          <th class="num">Double</th>
          <th class="num">Special</th>
          <th class="num">Incentive</th>
          <th class="num">Deductions</th>
          <th class="num">Refunds</th>
          <th class="num">Net Pay</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
        <tr class="total-row">
          <td></td>
          <td>TOTAL</td>
          <td></td>
          <td class="num">${escape(num(totalHours, 1))}</td>
          <td class="num">${escape(money(params.averageSales))}</td>
          <td class="num">${escape(money(params.totalGrossSales))}</td>
          <td class="num">${escape(money(sorted.reduce((s, r) => s + (r.regularPay || 0), 0)))}</td>
          <td class="num">${escape(money(params.totalOvertimePay || 0))}</td>
          <td class="num">${escape(money(params.totalDoublePay || 0))}</td>
          <td class="num">${escape(money(params.totalSpecialPay || 0))}</td>
          <td class="num">${escape(money(params.totalIncentivePay || 0))}</td>
          <td class="num">${escape(money(params.totalDeductions || 0))}</td>
          <td class="num">${escape(money(params.totalRefunds || 0))}</td>
          <td class="num">${escape(money(params.totalPayroll))}</td>
        </tr>
      </tbody>
    </table>`
        : `<p class="empty">No staff performance data in this period.</p>`
    }
    ${dailySections}
    <footer class="footer">
      <span>Staff Performance — ${escape(params.brandName)}</span>
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
