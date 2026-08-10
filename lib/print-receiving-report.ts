import type { PurchaseOrder, PurchaseOrderItem, RawMaterial } from './supabase'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

function purchaseUnitForItem(item: PurchaseOrderItem): string {
  const material = item.material as RawMaterial | undefined
  if (material) {
    return material.uom_purchase_unit?.trim() || material.unit || item.unit
  }
  return item.unit
}

export function canPrintReceivingReportBlank(po: PurchaseOrder): boolean {
  if (!['in_transit', 'delivered', 'paid'].includes(po.status)) return false
  const items = po.items || []
  if (items.length === 0) return po.status === 'in_transit'
  return items.some(
    (item) => (Number(item.quantity_received) || 0) < (Number(item.quantity) || 0)
  )
}

export function openReceivingReportBlankPrintWindow(
  po: PurchaseOrder,
  items: PurchaseOrderItem[]
): boolean {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return false

  const lines = items
    .map((item) => {
      const ordered = Number(item.quantity) || 0
      const received = Number(item.quantity_received) || 0
      return {
        description: item.product_description,
        ordered,
        received,
        remaining: Math.max(0, ordered - received),
        unit: purchaseUnitForItem(item),
      }
    })
    .filter((line) => line.remaining > 0)

  const displayLines = lines.length > 0 ? lines : items.map((item) => {
    const ordered = Number(item.quantity) || 0
    const received = Number(item.quantity_received) || 0
    return {
      description: item.product_description,
      ordered,
      received,
      remaining: Math.max(0, ordered - received),
      unit: purchaseUnitForItem(item),
    }
  })

  const totalOrdered = displayLines.reduce((s, l) => s + l.ordered, 0)
  const totalPrev = displayLines.reduce((s, l) => s + l.received, 0)
  const totalRemaining = displayLines.reduce((s, l) => s + l.remaining, 0)

  const itemsTable = displayLines
    .map(
      (line, index) => `
      <tr>
        <td class="text-center num">${index + 1}</td>
        <td class="desc">${escapeHtml(line.description)}</td>
        <td class="text-center num">${line.ordered}</td>
        <td class="text-center num muted">${line.received > 0 ? line.received : '—'}</td>
        <td class="text-center num">${line.remaining}</td>
        <td class="text-center fill good">&nbsp;</td>
        <td class="text-center fill damaged">&nbsp;</td>
        <td class="text-center unit">${escapeHtml(line.unit)}</td>
        <td class="fill">&nbsp;</td>
      </tr>`
    )
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receiving Report — ${escapeHtml(po.po_number)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      color: #111827;
      padding: 0.45in 0.45in 0.45in 0.3in;
      background: #fff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 2px solid #111827;
    }
    .company-name { font-size: 16px; font-weight: 700; letter-spacing: 0.3px; }
    .company-sub { font-size: 9px; color: #6b7280; margin-top: 2px; }
    .doc-info { text-align: right; }
    .doc-title { font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }
    .doc-meta { font-size: 11px; font-weight: 600; margin-top: 3px; }
    .doc-subtitle { font-size: 9px; color: #6b7280; margin-top: 2px; }

    .meta-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 10px;
    }
    .meta-cell {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
      min-height: 42px;
    }
    .meta-label {
      display: block;
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      color: #6b7280;
      letter-spacing: 0.04em;
      margin-bottom: 3px;
    }
    .meta-value { font-size: 11px; font-weight: 600; }
    .meta-blank {
      border-bottom: 1px solid #111827;
      min-height: 16px;
      margin-top: 2px;
    }

    .condition-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 14px;
      border: 1px solid #d1d5db;
      padding: 6px 10px;
      margin-bottom: 10px;
      font-size: 10px;
    }
    .condition-title {
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      color: #6b7280;
      margin-right: 4px;
    }
    .checkbox-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
    .checkbox-box {
      width: 11px;
      height: 11px;
      border: 1px solid #111827;
      flex-shrink: 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-bottom: 10px;
    }
    th, td {
      border: 1px solid #111827;
      padding: 5px 4px;
      vertical-align: middle;
      word-wrap: break-word;
    }
    th {
      background: #f3f4f6;
      font-size: 8px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.02em;
      line-height: 1.2;
    }
    th.th-qty {
      font-size: 7px;
      letter-spacing: 0;
      padding: 4px 3px;
      white-space: nowrap;
    }
    td.desc {
      font-size: 9px;
      line-height: 1.2;
      word-break: break-word;
    }
    td.num, td.unit {
      font-size: 10px;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    td.muted { color: #6b7280; }
    td.fill { background: #fafafa; min-height: 26px; }
    td.fill.good { background: #ecfdf5; }
    td.fill.damaged { background: #fef2f2; }
    .text-center { text-align: center; }
    tfoot td {
      font-size: 9px;
      font-weight: 700;
      background: #f9fafb;
    }

    .notes-box {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
      margin-bottom: 12px;
    }
    .notes-label {
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 4px;
    }
    .notes-area {
      border: 1px solid #111827;
      min-height: 52px;
      background: #fafafa;
    }

    .hint {
      font-size: 8px;
      color: #6b7280;
      margin-bottom: 8px;
    }

    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr 0.55fr;
      gap: 20px;
      margin-top: 20px;
      page-break-inside: avoid;
    }
    .signature-line {
      border-top: 1px solid #111827;
      margin-top: 32px;
      padding-top: 4px;
    }
    .signature-label {
      font-size: 8px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .footer {
      margin-top: 10px;
      padding-top: 6px;
      border-top: 1px solid #e5e7eb;
      font-size: 8px;
      color: #9ca3af;
      text-align: center;
    }

    @page { size: letter; margin: 0.45in 0.45in 0.45in 0.3in; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">GILNAKS FOOD CORPORATION</div>
      <div class="company-sub">Procurement · Goods receipt</div>
    </div>
    <div class="doc-info">
      <div class="doc-title">RECEIVING REPORT</div>
      <div class="doc-meta">${escapeHtml(po.po_number)}</div>
      <div class="doc-subtitle">Fill in upon physical delivery</div>
    </div>
  </div>

  <div class="meta-row">
    <div class="meta-cell">
      <span class="meta-label">Supplier</span>
      <div class="meta-value">${escapeHtml(po.supplier?.name || '—')}</div>
    </div>
    <div class="meta-cell">
      <span class="meta-label">Expected delivery</span>
      <div class="meta-value">${escapeHtml(formatDate(po.expected_delivery_date))}</div>
    </div>
    <div class="meta-cell">
      <span class="meta-label">Delivery date</span>
      <div class="meta-blank"></div>
    </div>
    <div class="meta-cell">
      <span class="meta-label">Received by</span>
      <div class="meta-blank"></div>
    </div>
  </div>

  <div class="condition-bar">
    <span class="condition-title">Condition</span>
    <span class="checkbox-item"><span class="checkbox-box"></span> Complete</span>
    <span class="checkbox-item"><span class="checkbox-box"></span> Damaged</span>
    <span class="checkbox-item"><span class="checkbox-box"></span> Partial</span>
    <span class="checkbox-item"><span class="checkbox-box"></span> Incomplete</span>
    ${
      po.delivery_address
        ? `<span style="margin-left:auto;font-size:9px;color:#4b5563;max-width:42%;text-align:right;">Deliver to: ${escapeHtml(po.delivery_address)}</span>`
        : ''
    }
  </div>

  <p class="hint">Write good and damaged quantities in the shaded columns, then enter the same figures in Procurement when recording the receiving report.</p>

  <table>
    <colgroup>
      <col style="width: 20px" />
      <col style="width: 24%" />
      <col style="width: 48px" />
      <col style="width: 46px" />
      <col style="width: 52px" />
      <col style="width: 48px" />
      <col style="width: 48px" />
      <col style="width: 36px" />
      <col style="width: 60px" />
    </colgroup>
    <thead>
      <tr>
        <th>#</th>
        <th>Item / description</th>
        <th class="th-qty">Ordered</th>
        <th class="th-qty">Previous</th>
        <th class="th-qty">Remaining</th>
        <th class="th-qty">Good</th>
        <th class="th-qty">Damaged</th>
        <th class="th-qty">Unit</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${
        itemsTable ||
        '<tr><td colspan="9" class="text-center" style="padding:12px;">No line items on this PO.</td></tr>'
      }
    </tbody>
    ${
      displayLines.length > 0
        ? `<tfoot>
      <tr>
        <td colspan="2" class="text-center">Totals</td>
        <td class="text-center">${totalOrdered}</td>
        <td class="text-center">${totalPrev > 0 ? totalPrev : '—'}</td>
        <td class="text-center">${totalRemaining}</td>
        <td colspan="4"></td>
      </tr>
    </tfoot>`
        : ''
    }
  </table>

  <div class="notes-box">
    <div class="notes-label">Inspection / general notes</div>
    <div class="notes-area"></div>
  </div>

  <div class="signatures">
    <div>
      <div class="signature-line"></div>
      <div class="signature-label">Received by (name &amp; sign)</div>
    </div>
    <div>
      <div class="signature-line"></div>
      <div class="signature-label">Inspected by (name &amp; sign)</div>
    </div>
    <div>
      <div class="signature-line"></div>
      <div class="signature-label">Date</div>
    </div>
  </div>

  <div class="footer">Generated ${escapeHtml(new Date().toLocaleString())} · PO ${escapeHtml(po.po_number)} · ${escapeHtml((po.status || '').replace(/_/g, ' '))}</div>

  <script>
    window.addEventListener('afterprint', function () { window.close(); });
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 150);
    });
  </script>
</body>
</html>`

  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  return true
}
