import type { FactoryMaterialRequest } from './supabase'
import { formatFactoryRequestQtyDisplay } from './raw-material-uom'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatQty(qty: number) {
  if (!Number.isFinite(qty)) return '0'
  return Number.isInteger(qty)
    ? String(qty)
    : qty.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function openFactoryMaterialRequestsPrintWindow(options: {
  requests: FactoryMaterialRequest[]
  brandName?: string
  scheduleDateLabel: string
  title?: string
}) {
  const { requests, brandName, scheduleDateLabel, title = 'Factory Material Request' } = options
  if (requests.length === 0) return false

  const printedAt = new Date().toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const rows = requests
    .map((row, index) => {
      const mat = row.material
      const name = escapeHtml(mat?.material_name || 'Material')
      const sku = mat?.sku ? escapeHtml(mat.sku) : '—'
      const qtyDisplay = mat
        ? formatFactoryRequestQtyDisplay(Number(row.quantity) || 0, mat)
        : { primary: formatQty(Number(row.quantity) || 0), stockNote: undefined }
      const qty = escapeHtml(qtyDisplay.primary)
      const unit =
        qtyDisplay.stockNote != null ? escapeHtml(qtyDisplay.stockNote) : ''
      const date = escapeHtml(row.schedule_date || row.request_date || '—')
      const requestedBy = escapeHtml(row.requested_by?.trim() || '—')
      const releasedBy = escapeHtml(row.released_by?.trim() || '—')
      const status = escapeHtml(row.status)
      return `
        <tr>
          <td class="num">${index + 1}</td>
          <td><strong>${name}</strong>${sku !== '—' ? `<div class="sub">${sku}</div>` : ''}</td>
          <td class="num">${qty}</td>
          <td>${unit ? `<span class="sub">${unit}</span>` : '—'}</td>
          <td>${date}</td>
          <td class="status">${status}</td>
          <td>${requestedBy}</td>
          <td>${releasedBy}</td>
        </tr>
      `
    })
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.35;
      color: #111827;
      padding: 0.4in 0.45in;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #111827;
    }
    .company { font-size: 16px; font-weight: 700; }
    .doc-title { font-size: 15px; font-weight: 700; text-align: right; }
    .meta { font-size: 11px; color: #4b5563; margin-top: 4px; text-align: right; }
    .info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 14px;
      font-size: 11px;
    }
    .info-block {
      border: 1px solid #d1d5db;
      padding: 8px 10px;
    }
    .info-label { color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; }
    .info-value { font-weight: 600; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f3f4f6;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    td.num, th.num { text-align: right; white-space: nowrap; }
    td.status { text-transform: capitalize; }
    td.person { font-size: 11px; white-space: nowrap; }
    .sub { font-size: 10px; color: #6b7280; font-family: monospace; margin-top: 2px; }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-top: 28px;
      font-size: 11px;
    }
    .sig-line {
      border-top: 1px solid #111827;
      padding-top: 4px;
      margin-top: 36px;
    }
    .sig-label { color: #6b7280; font-size: 10px; }
    @media print {
      body { padding: 0.25in; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">Gilnaks Food Corporation</div>
      ${brandName ? `<div class="meta">${escapeHtml(brandName)}</div>` : ''}
    </div>
    <div>
      <div class="doc-title">${escapeHtml(title)}</div>
      <div class="meta">Printed ${escapeHtml(printedAt)}</div>
    </div>
  </div>
  <div class="info">
    <div class="info-block">
      <div class="info-label">Schedule / request date</div>
      <div class="info-value">${escapeHtml(scheduleDateLabel)}</div>
    </div>
    <div class="info-block">
      <div class="info-label">Line items</div>
      <div class="info-value">${requests.length}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th>Material</th>
        <th class="num">Qty</th>
        <th>Unit</th>
        <th>Date</th>
        <th>Status</th>
        <th>Requested by</th>
        <th>Released by</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="signatures">
    <div>
      <div class="sig-line"></div>
      <div class="sig-label">Requested by (Factory)</div>
    </div>
    <div>
      <div class="sig-line"></div>
      <div class="sig-label">Received by (Procurement)</div>
    </div>
  </div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`

  const printWindow = window.open('', '_blank')
  if (!printWindow) return false
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  return true
}
