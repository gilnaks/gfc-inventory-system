import type {
  AccountingVoucher,
  AccountingVoucherLine,
  AccountingVoucherSettings,
} from './supabase'
import {
  VOUCHER_PRINT_STYLES,
  PAYMENT_VOUCHER_PRINT_STYLES,
  VOUCHER_PRINT_CLOSE_SCRIPT,
  escapeVoucherHtml,
  formatVoucherMoney,
  renderCheckboxGrid,
} from './voucherPrintStyles'

function pvField(label: string, value: string, extraClass = '') {
  return `<td>
    <span class="field-label">${escapeVoucherHtml(label)}</span>
    <div class="field-value ${extraClass}">${value ? escapeVoucherHtml(value) : '&nbsp;'}</div>
  </td>`
}

function pvFieldHtml(label: string, html: string, extraClass = '') {
  return `<td>
    <span class="field-label">${escapeVoucherHtml(label)}</span>
    <div class="field-value ${extraClass}">${html || '&nbsp;'}</div>
  </td>`
}

export function openPaymentVoucherPrintWindow(
  voucher: AccountingVoucher,
  lines: AccountingVoucherLine[],
  settings: AccountingVoucherSettings
) {
  const sortedLines = [...lines].sort((a, b) => (a.line_no ?? 0) - (b.line_no ?? 0))
  const lineTotal = sortedLines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const amountRequested = Number(voucher.amount_requested) || lineTotal

  const tableRows = sortedLines
    .map(
      (line, i) => `<tr>
      <td class="text-center col-no">${i + 1}</td>
      <td class="col-ref">${escapeVoucherHtml(line.reference_doc || '')}</td>
      <td>${escapeVoucherHtml(line.description)}</td>
      <td class="text-right col-amt">${formatVoucherMoney(line.amount)}</td>
    </tr>`
    )
    .join('')

  const payeeKinds = renderCheckboxGrid(
    [
      { label: 'Supplier', checked: voucher.payee_kind === 'supplier' },
      { label: 'Reimbursement', checked: voucher.payee_kind === 'reimbursement' },
      { label: 'Petty cash repl.', checked: voucher.payee_kind === 'petty_cash_replenishment' },
      { label: 'Invoice', checked: voucher.payee_kind === 'invoice' },
      { label: 'Payroll', checked: voucher.payee_kind === 'payroll' },
      { label: 'Intercompany', checked: voucher.payee_kind === 'intercompany' },
      { label: 'Staff advance', checked: voucher.payee_kind === 'staff_advance' },
      { label: 'Others', checked: voucher.payee_kind === 'other' },
    ],
    4
  )

  const mode = voucher.payment_mode
  const paymentModes = renderCheckboxGrid(
    [
      { label: 'Cash', checked: mode === 'cash' },
      {
        label:
          mode === 'check' && (voucher.check_number || voucher.check_date)
            ? `Check — ${voucher.check_number || '—'} / ${voucher.check_date || '—'}`
            : 'Check',
        checked: mode === 'check',
      },
      {
        label:
          mode === 'bank_gcash' && (voucher.bank_ref_number || voucher.bank_ref_date)
            ? `Bank / G-Cash — ${voucher.bank_ref_number || '—'} / ${voucher.bank_ref_date || '—'}`
            : 'Bank / G-Cash',
        checked: mode === 'bank_gcash',
      },
    ],
    3
  )

  const supportingDocs = renderCheckboxGrid(
    [
      { label: 'Purchase order', checked: !!voucher.has_po },
      { label: 'Invoice', checked: !!voucher.has_invoice },
      { label: 'Receiving report', checked: !!voucher.has_receiving_report },
    ],
    3
  )

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>PV ${escapeVoucherHtml(voucher.voucher_number)}</title>
<style>${VOUCHER_PRINT_STYLES}${PAYMENT_VOUCHER_PRINT_STYLES}</style></head>
<body class="pv-print">
<div class="pv-header">
  <div class="pv-header-left">
    <div class="company">${escapeVoucherHtml(settings.company_name)}</div>
    <div class="address">${escapeVoucherHtml(settings.company_address)}</div>
  </div>
  <div class="pv-header-right">
    <div class="doc-title">PAYMENT VOUCHER</div>
    <div class="pv-id-row">
      <span><span class="meta-label">PV No.</span> ${escapeVoucherHtml(voucher.voucher_number)}</span>
      <span><span class="meta-label">Date</span> ${escapeVoucherHtml(voucher.voucher_date)}</span>
    </div>
  </div>
</div>

<table class="pv-fields">
  <tr>
    ${pvField('Payee name', voucher.payee_name || '')}
    ${pvField('Department', voucher.department || '')}
  </tr>
  <tr>
    ${pvField('Payment for', voucher.payment_for || '')}
    ${pvField('Requested by', voucher.requested_by || voucher.requestor_name || '')}
  </tr>
  <tr>
    ${pvFieldHtml('Amount requested', formatVoucherMoney(amountRequested), 'amount')}
    ${pvField('Prepared by', voucher.prepared_by_name || voucher.prepared_by || '')}
  </tr>
</table>

<div class="pv-panel">
  <div class="pv-panel-title">Payment category</div>
  <div class="pv-panel-body">${payeeKinds}</div>
</div>

<table class="pv-lines">
  <thead>
    <tr>
      <th class="col-no">#</th>
      <th class="col-ref">Reference</th>
      <th>Description</th>
      <th class="col-amt">Amount</th>
    </tr>
  </thead>
  <tbody>${tableRows}
    <tr class="total-row">
      <td colspan="3" class="text-right">Total</td>
      <td class="text-right col-amt">${formatVoucherMoney(lineTotal)}</td>
    </tr>
  </tbody>
</table>

<div class="pv-split">
  <div class="pv-panel">
    <div class="pv-panel-title">Mode of payment</div>
    <div class="pv-panel-body">${paymentModes}</div>
  </div>
  <div class="pv-panel">
    <div class="pv-panel-title">Supporting documents</div>
    <div class="pv-panel-body">${supportingDocs}</div>
  </div>
</div>

${
  voucher.notes?.trim()
    ? `<div class="pv-panel">
    <div class="pv-panel-title">Notes</div>
    <div class="pv-panel-body" style="font-size:9px">${escapeVoucherHtml(voucher.notes.trim())}</div>
  </div>`
    : ''
}

<div class="pv-sig-grid sig-grid">
  <div class="sig-block">
    <div class="sig-line"></div>
    Prepared by<br/>${escapeVoucherHtml(voucher.prepared_by_name || voucher.prepared_by || '')}
  </div>
  <div class="sig-block">
    <div class="sig-line"></div>
    Approved by<br/>
    <span class="sig-name">${escapeVoucherHtml(voucher.approved_by_name || settings.approved_by_name || '')}</span>
    ${voucher.approved_by_title || settings.approved_by_title ? `<br/>${escapeVoucherHtml(voucher.approved_by_title || settings.approved_by_title || '')}` : ''}
  </div>
  <div class="sig-block">
    <div class="sig-line"></div>
    Received by<br/>${escapeVoucherHtml(voucher.received_by || '')}
  </div>
</div>

<script>${VOUCHER_PRINT_CLOSE_SCRIPT}</script>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  w.focus()
  return true
}
