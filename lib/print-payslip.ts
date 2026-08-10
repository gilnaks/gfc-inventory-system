export type PayslipDayStatus = 'regular' | 'regular-holiday' | 'special-holiday'

export interface PayslipEntry {
  staffName: string
  hourlyRate: number
  regularHours: number
  doublePayHours: number
  specialPayHours: number
  overtimeHours: number
  regularPay: number
  doublePay: number
  specialPay: number
  overtimePay: number
  incentivePay: number
  totalPay: number
  deductions: {
    utilities: number
    shortages: number
    cashAdvances: number
    penalties: number
    others: number
  }
  refunds: number
  netPay: number
  locationGroups?: {
    [locationName: string]: Array<{
      date: string
      dayName: string
      hours: number
      scheduleDate: string
    }>
  }
}

export const PAYSLIP_PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: Arial, Helvetica, sans-serif;
    background: #fff;
    color: #000;
    line-height: 1.4;
  }

  .payslip {
    width: 7.5in;
    margin: 0 auto;
    background: #fff;
    padding: 0.3in 0.35in;
    font-size: 10px;
  }

  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding-bottom: 8px;
    margin-bottom: 10px;
    border-bottom: 2px solid #000;
  }

  .company-name {
    font-size: 16px;
    font-weight: 700;
    color: #000;
  }

  .doc-subtitle {
    margin-top: 1px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #000;
  }

  .doc-meta {
    text-align: right;
    flex-shrink: 0;
  }

  .generated-date {
    font-size: 9px;
    color: #000;
  }

  .period-badge {
    display: inline-block;
    margin-top: 4px;
    padding: 2px 8px;
    border: 1px solid #000;
    font-size: 9px;
    font-weight: 600;
    color: #000;
  }

  .info-strip {
    display: grid;
    grid-template-columns: 1.4fr 1.2fr 0.8fr;
    gap: 8px;
    margin-bottom: 10px;
  }

  .info-cell {
    padding: 6px 8px;
    border: 1px solid #000;
    background: #fff;
  }

  .info-label {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #000;
    margin-bottom: 2px;
  }

  .info-value {
    font-size: 11px;
    font-weight: 600;
    color: #000;
    word-break: break-word;
  }

  .card {
    border: 1px solid #000;
    padding: 8px 10px;
    margin-bottom: 10px;
    background: #fff;
  }

  .card.compact {
    padding: 6px 8px;
    margin-bottom: 8px;
  }

  .card-title {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #000;
    margin-bottom: 5px;
  }

  .days-compact {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .days-location-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 9px;
    line-height: 1.35;
    padding: 2px 0;
    border-bottom: 1px dotted #ccc;
  }

  .days-location-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .days-loc {
    font-weight: 700;
    color: #000;
    min-width: 72px;
    max-width: 110px;
    flex-shrink: 0;
  }

  .days-list {
    flex: 1;
    color: #000;
    word-break: break-word;
  }

  .day-token {
    white-space: nowrap;
  }

  .day-token.holiday::after {
    content: ' RH';
    font-size: 8px;
    font-weight: 700;
  }

  .day-token.special::after {
    content: ' SH';
    font-size: 8px;
    font-weight: 700;
  }

  .no-days {
    font-size: 9px;
    color: #000;
    font-style: italic;
  }

  .columns {
    display: grid;
    grid-template-columns: 1.35fr 1fr;
    gap: 10px;
    margin-bottom: 10px;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
  }

  .data-table th {
    padding: 5px 6px;
    text-align: left;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #000;
    border-bottom: 1px solid #000;
    background: #fff;
  }

  .data-table th.num,
  .data-table td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .data-table td {
    padding: 5px 6px;
    border-bottom: 1px solid #ddd;
    color: #000;
  }

  .data-table tr:last-child td {
    border-bottom: none;
  }

  .data-table .total-row td {
    padding-top: 6px;
    border-top: 2px solid #000;
    font-weight: 700;
    color: #000;
  }

  .deduction-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .deduction-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    font-size: 9px;
    color: #000;
    border-bottom: 1px solid #eee;
  }

  .deduction-row:last-child {
    border-bottom: none;
  }

  .deduction-row .amount {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .deduction-row.total {
    margin-top: 2px;
    padding-top: 5px;
    border-top: 1px solid #000;
    border-bottom: none;
    font-weight: 700;
    color: #000;
  }

  .deduction-row.refund {
    font-weight: 600;
    color: #000;
  }

  .net-pay-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    border: 2px solid #000;
    background: #fff;
    color: #000;
    margin-bottom: 10px;
  }

  .net-pay-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .net-pay-amount {
    font-size: 18px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .footer {
    text-align: center;
    font-size: 8px;
    color: #000;
    padding-top: 6px;
    border-top: 1px solid #000;
  }

  .footer p + p {
    margin-top: 2px;
  }

  .page-break {
    page-break-before: always;
    break-before: page;
  }

  @media print {
    body {
      background: #fff;
      margin: 0;
      padding: 0;
    }

    .payslip {
      width: 100%;
      margin: 0;
      padding: 0;
    }

    @page {
      margin: 0.45in;
      size: letter;
    }
  }
`

function formatPayslipMoney(amount: number) {
  const n = Number(amount) || 0
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPayslipRate(amount: number) {
  return `₱${(Number(amount) || 0).toFixed(2)}`
}

function getDayTokenClass(status: PayslipDayStatus) {
  if (status === 'regular-holiday') return 'holiday'
  if (status === 'special-holiday') return 'special'
  return 'regular'
}

function buildDaysWorkedHtml(
  entry: PayslipEntry,
  getDayStatus: (scheduleDate: string) => PayslipDayStatus
) {
  if (!entry.locationGroups || Object.keys(entry.locationGroups).length === 0) {
    return '<div class="no-days">No days worked recorded</div>'
  }

  return `<div class="days-compact">${Object.entries(entry.locationGroups)
    .map(([locationName, days]) => {
      const dayTokens = days
        .map((day) => {
          const statusClass = getDayTokenClass(getDayStatus(day.scheduleDate))
          const classAttr = statusClass === 'regular' ? 'day-token' : `day-token ${statusClass}`
          return `<span class="${classAttr}">${day.date} ${day.dayName} ${day.hours}h</span>`
        })
        .join(', ')

      const totalHours = days.reduce((sum, day) => sum + day.hours, 0)

      return `
        <div class="days-location-row">
          <span class="days-loc">${locationName}</span>
          <span class="days-list">${dayTokens} <strong>(${totalHours.toFixed(1)}h)</strong></span>
        </div>
      `
    })
    .join('')}</div>`
}

function buildEarningsRows(entry: PayslipEntry) {
  const rows = [
    `
      <tr>
        <td>Regular Hours</td>
        <td class="num">${entry.regularHours.toFixed(1)}</td>
        <td class="num">${formatPayslipRate(entry.hourlyRate)}</td>
        <td class="num">${formatPayslipMoney(entry.regularPay)}</td>
      </tr>
    `,
  ]

  if (entry.doublePay > 0) {
    rows.push(`
      <tr>
        <td>Regular Holiday (×2)</td>
        <td class="num">${entry.doublePayHours.toFixed(1)}</td>
        <td class="num">${formatPayslipRate(entry.hourlyRate * 2)}</td>
        <td class="num">${formatPayslipMoney(entry.doublePay)}</td>
      </tr>
    `)
  }

  if (entry.specialPay > 0) {
    rows.push(`
      <tr>
        <td>Special Holiday (×1.3)</td>
        <td class="num">${entry.specialPayHours.toFixed(1)}</td>
        <td class="num">${formatPayslipRate(entry.hourlyRate * 1.3)}</td>
        <td class="num">${formatPayslipMoney(entry.specialPay)}</td>
      </tr>
    `)
  }

  if (entry.overtimePay > 0) {
    rows.push(`
      <tr>
        <td>Overtime (after 48 hrs)</td>
        <td class="num">${entry.overtimeHours.toFixed(1)}</td>
        <td class="num">${formatPayslipRate(entry.hourlyRate * 1.25)}</td>
        <td class="num">${formatPayslipMoney(entry.overtimePay)}</td>
      </tr>
    `)
  }

  rows.push(`
    <tr class="total-row">
      <td>Total Pay</td>
      <td class="num"></td>
      <td class="num"></td>
      <td class="num">${formatPayslipMoney(entry.totalPay)}</td>
    </tr>
  `)

  if (entry.incentivePay > 0) {
    rows.push(`
      <tr>
        <td>Incentive Pay</td>
        <td class="num"></td>
        <td class="num"></td>
        <td class="num">${formatPayslipMoney(entry.incentivePay)}</td>
      </tr>
    `)
  }

  return rows.join('')
}

function buildDeductionsHtml(entry: PayslipEntry) {
  const deductionTotal = Object.values(entry.deductions).reduce((sum, amount) => sum + amount, 0)
  const deductionRows = [
    { label: 'Utilities', amount: entry.deductions.utilities },
    { label: 'Shortages', amount: entry.deductions.shortages },
    { label: 'Advances', amount: entry.deductions.cashAdvances },
    { label: 'Penalties', amount: entry.deductions.penalties },
    { label: 'Others', amount: entry.deductions.others },
  ]
    .map(
      ({ label, amount }) => `
        <div class="deduction-row">
          <span>${label}</span>
          <span class="amount">${formatPayslipMoney(amount)}</span>
        </div>
      `
    )
    .join('')

  const refundRow =
    entry.refunds > 0
      ? `
        <div class="deduction-row refund">
          <span>Refund</span>
          <span class="amount">+${formatPayslipMoney(entry.refunds)}</span>
        </div>
      `
      : ''

  return `
    <div class="deduction-list">
      ${deductionRows}
      <div class="deduction-row total">
        <span>Total Deductions</span>
        <span class="amount">${formatPayslipMoney(deductionTotal)}</span>
      </div>
      ${refundRow}
    </div>
  `
}

export function buildPayslipBodyHtml(
  entry: PayslipEntry,
  periodText: string,
  payslipDate: string,
  getDayStatus: (scheduleDate: string) => PayslipDayStatus,
  pageBreakBefore = false
) {
  return `
    ${pageBreakBefore ? '<div class="page-break"></div>' : ''}
    <div class="payslip">
      <header class="doc-header">
        <div>
          <div class="company-name">Gilnaks Food Corporation</div>
          <div class="doc-subtitle">Employee Payslip</div>
        </div>
        <div class="doc-meta">
          <div class="generated-date">Generated ${payslipDate}</div>
          <div class="period-badge">${periodText}</div>
        </div>
      </header>

      <section class="info-strip">
        <div class="info-cell">
          <div class="info-label">Employee</div>
          <div class="info-value">${entry.staffName}</div>
        </div>
        <div class="info-cell">
          <div class="info-label">Pay Period</div>
          <div class="info-value">${periodText}</div>
        </div>
        <div class="info-cell">
          <div class="info-label">Hourly Rate</div>
          <div class="info-value">${formatPayslipRate(entry.hourlyRate)}/hr</div>
        </div>
      </section>

      <section class="card compact">
        <div class="card-title">Days Worked</div>
        ${buildDaysWorkedHtml(entry, getDayStatus)}
      </section>

      <div class="columns">
        <section class="card">
          <div class="card-title">Earnings</div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th class="num">Hours</th>
                <th class="num">Rate</th>
                <th class="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${buildEarningsRows(entry)}
            </tbody>
          </table>
        </section>

        <section class="card">
          <div class="card-title">Deductions &amp; Refunds</div>
          ${buildDeductionsHtml(entry)}
        </section>
      </div>

      <div class="net-pay-bar">
        <span class="net-pay-label">Net Pay</span>
        <span class="net-pay-amount">${formatPayslipMoney(entry.netPay)}</span>
      </div>

      <footer class="footer">
        <p>This payslip is computer generated and does not require a signature.</p>
        <p>For inquiries, please contact the HR department.</p>
      </footer>
    </div>
  `
}

export function buildPayslipDocumentHtml(title: string, bodyHtml: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>${PAYSLIP_PRINT_STYLES}</style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`
}

export function printPayslipHtml(html: string) {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'absolute'
  iframe.style.left = '-9999px'
  iframe.style.top = '-9999px'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = 'none'

  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    document.body.removeChild(iframe)
    return
  }

  iframeDoc.open()
  iframeDoc.write(html)
  iframeDoc.close()

  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => {
      document.body.removeChild(iframe)
    }, 1000)
  }
}
