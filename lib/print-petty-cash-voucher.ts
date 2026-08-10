import type {
  AccountingVoucher,
  AccountingVoucherLine,
  AccountingVoucherSettings,
} from './supabase'
import {
  VOUCHER_PRINT_STYLES,
  VOUCHER_PRINT_CLOSE_SCRIPT,
  checkboxMark,
  escapeVoucherHtml,
  formatVoucherMoney,
} from './voucherPrintStyles'

export function openPettyCashVoucherPrintWindow(
  voucher: AccountingVoucher,
  lines: AccountingVoucherLine[],
  settings: AccountingVoucherSettings
) {
  const sortedLines = [...lines].sort((a, b) => (a.line_no ?? 0) - (b.line_no ?? 0))
  const total = sortedLines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const expenseRows = sortedLines
    .map(
      (line, i) => `<tr>
      <td class="text-center">${i + 1}</td>
      <td>${escapeVoucherHtml(line.description)}</td>
      <td class="text-right">${formatVoucherMoney(line.amount)}</td>
    </tr>`
    )
    .join('')

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>PCV ${escapeVoucherHtml(voucher.voucher_number)}</title>
<style>${VOUCHER_PRINT_STYLES}
.liquidation { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
.liquidation .field { border-bottom: 1px solid #111; padding: 4px 0; }
</style></head><body>
<div class="company">${escapeVoucherHtml(settings.company_name)}</div>
<div class="address">${escapeVoucherHtml(settings.company_address)}</div>
<div class="doc-title">PETTY CASH VOUCHER</div>
<div class="meta-row">
  <div><span class="meta-label">PCV No.:</span> ${escapeVoucherHtml(voucher.voucher_number)}</div>
  <div><span class="meta-label">Date:</span> ${escapeVoucherHtml(voucher.voucher_date)}</div>
</div>
<div class="meta-row">
  <div class="meta-field"><span class="meta-label">Department:</span> ${escapeVoucherHtml(voucher.department || '')}</div>
  <div class="meta-field"><span class="meta-label">Requested By:</span> ${escapeVoucherHtml(voucher.requested_by || '')}</div>
</div>
<table>
  <thead><tr><th style="width:28px">#</th><th>Description of Expense</th><th style="width:100px">Amount (PHP)</th></tr></thead>
  <tbody>${expenseRows}
  <tr class="total-row"><td colspan="2" class="text-right">TOTAL</td><td class="text-right">${formatVoucherMoney(total)}</td></tr>
  </tbody>
</table>
<div class="section-label">Purpose / Business Justification</div>
<div class="purpose-box">${escapeVoucherHtml(voucher.purpose || '')}</div>
<div class="section-label">Supporting Documents Attached</div>
<div class="checkbox-line">${checkboxMark(!!voucher.has_or)} Official Receipt (OR) &nbsp; ${checkboxMark(!!voucher.has_si)} Sales Invoice (SI)</div>
<div class="checkbox-line">${checkboxMark(!!voucher.has_dr)} Delivery Receipt (DR) &nbsp; ${checkboxMark(!!voucher.has_transport_receipt)} Transportation Receipt</div>
<div class="section-label">Cash Release</div>
<div class="meta-row">
  <div>Amount Requested: ${formatVoucherMoney(Number(voucher.amount_requested) || total)}</div>
  <div>Amount Released: ${formatVoucherMoney(Number(voucher.amount_released) || 0)}</div>
  <div>Date Released: ${escapeVoucherHtml(voucher.date_released || '')}</div>
</div>
<div class="sig-grid">
  <div class="sig-block"><div class="sig-line"></div>Prepared By<br/>${escapeVoucherHtml(voucher.prepared_by_name || '')}</div>
  <div class="sig-block"><div class="sig-line"></div>Requestor<br/>${escapeVoucherHtml(voucher.requestor_name || voucher.requested_by || '')}</div>
  <div class="sig-block"><div class="sig-line"></div>Approved By<br/><span class="sig-name">${escapeVoucherHtml(voucher.approved_by_name || settings.petty_cash_custodian_name)}</span><br/>${escapeVoucherHtml(settings.petty_cash_custodian_title)}</div>
</div>
<div class="section-label">Liquidation</div>
<div class="liquidation">
  <div>Actual Expense: ${formatVoucherMoney(Number(voucher.actual_expense) || 0)}</div>
  <div>Cash Advance: ${formatVoucherMoney(Number(voucher.cash_advance) || 0)}</div>
  <div>Excess Returned: ${formatVoucherMoney(Number(voucher.excess_returned) || 0)}</div>
  <div>Additional Reimbursement: ${formatVoucherMoney(Number(voucher.additional_reimbursement) || 0)}</div>
</div>
<div class="box" style="margin-top:12px">
  <div class="sig-block" style="text-align:left">
    <div class="sig-line" style="width:60%"></div>
    Liquidated By: <span class="sig-name">${escapeVoucherHtml(voucher.liquidated_by_name || settings.liquidated_by_name)}</span> — ${escapeVoucherHtml(voucher.liquidated_by_title || settings.liquidated_by_title)}
    <br/>Date: ${escapeVoucherHtml(voucher.liquidated_at ? voucher.voucher_date : '')}
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
