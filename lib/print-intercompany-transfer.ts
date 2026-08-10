import type { IntercompanyTransfer, IntercompanyTransferLine } from './supabase'

export function printIntercompanyDeliveryNote(
  transfer: IntercompanyTransfer,
  companyName = 'GILNAKS FOOD CORPORATION'
): void {
  const lines = (transfer.lines || []) as IntercompanyTransferLine[]
  const fromName = transfer.from_brand?.name || 'GFC'
  const toName = transfer.to_brand?.name || 'Brand'
  const rows = lines
    .map(
      (l) => `
      <tr>
        <td>${l.line_no}</td>
        <td>${escapeHtml(l.sku || '—')}</td>
        <td>${escapeHtml(l.description || '—')}</td>
        <td class="num">${l.quantity}</td>
        <td class="num">${formatMoney(l.unit_cost)}</td>
        <td class="num">${formatMoney(l.line_cost)}</td>
      </tr>`
    )
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(transfer.transfer_number)}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 24px; color: #111; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; }
    .num { text-align: right; }
    .totals { margin-top: 12px; text-align: right; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <h1>Intercompany Delivery Note</h1>
  <div class="meta">
    <div><strong>${escapeHtml(companyName)}</strong></div>
    <div>Transfer: <strong>${escapeHtml(transfer.transfer_number)}</strong></div>
    <div>Date: ${escapeHtml(transfer.transfer_date)}</div>
    <div>From: ${escapeHtml(fromName)} → To: ${escapeHtml(toName)}</div>
    ${transfer.notes ? `<div>Notes: ${escapeHtml(transfer.notes)}</div>` : ''}
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>SKU</th>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit cost</th>
        <th>Line total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div>Transfer total (at cost): <strong>${formatMoney(transfer.cost_amount_total)}</strong></div>
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`

  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) {
    alert('Allow pop-ups to print the delivery note.')
    return
  }
  w.document.write(html)
  w.document.close()
}

function formatMoney(n: number): string {
  return `₱${(Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
