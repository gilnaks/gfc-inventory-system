import type {
  AccountingVoucherLine,
  AccountingVoucherLink,
  AccountingVoucherPrefill,
  AccountingVoucherSourceType,
  AccountingVoucherType,
  DeliveryReceipt,
  IntercompanyTransfer,
  POPayment,
  PurchaseOrder,
  SupplierInvoice,
} from './supabase'
import { formatPaymentVoucherJournalMemo } from './journal-description'
import { pickPrimaryDeliveryReceipt } from './supplier-invoice-service'

/** PO numbers are stored as PO-######; avoid doubling the "PO" prefix in labels. */
export function formatPoLabel(poNumber: string): string {
  const trimmed = poNumber.trim()
  if (/^PO[-\s]/i.test(trimmed)) return trimmed
  return `PO ${trimmed}`
}

function withRequestedBy(name?: string | null): { requested_by?: string; requestor_name?: string } {
  const trimmed = name?.trim()
  if (!trimmed) return {}
  return { requested_by: trimmed, requestor_name: trimmed }
}

export function departmentFromPurchaseOrder(po: PurchaseOrder): string | undefined {
  return po.requisition?.department?.trim() || undefined
}

function withDepartmentFromPo(po: PurchaseOrder): { department?: string } {
  const department = departmentFromPurchaseOrder(po)
  return department ? { department } : {}
}

function withDepartment(name?: string | null): { department?: string } {
  const trimmed = name?.trim()
  return trimmed ? { department: trimmed } : {}
}

export function mapPoPaymentMethod(
  method: POPayment['payment_method']
): 'cash' | 'check' | 'bank_gcash' {
  if (method === 'check') return 'check'
  if (method === 'bank_transfer') return 'bank_gcash'
  return 'cash'
}

export function buildPrefillFromPoPayment(
  payment: POPayment,
  po: PurchaseOrder
): AccountingVoucherPrefill {
  const supplierName = po.supplier?.name || 'Supplier'
  return {
    voucherType: 'payment',
    sourceType: 'po_payment',
    sourceId: payment.id,
    header: {
      voucher_type: 'payment',
      payee_name: supplierName,
      payee_kind: 'supplier',
      payment_for: formatPoLabel(po.po_number),
      payment_mode: mapPoPaymentMethod(payment.payment_method),
      check_number: payment.check_number || undefined,
      bank_ref_number: payment.reference_number || undefined,
      has_po: true,
      notes: payment.proof_of_payment_url
        ? `Proof: ${payment.proof_of_payment_url}`
        : payment.notes || undefined,
      ...withRequestedBy(po.purchasing_agent),
      ...withDepartmentFromPo(po),
    },
    lines: [
      {
        line_no: 1,
        description: `${payment.payment_type} payment — ${payment.payment_method}`,
        amount: Number(payment.amount) || 0,
        reference_doc: po.po_number,
        po_id: po.id,
      },
    ],
    links: [
      {
        source_type: 'po_payment',
        source_id: payment.id,
        link_role: 'primary',
        attachment_url: payment.proof_of_payment_url || undefined,
      },
      {
        source_type: 'purchase_order',
        source_id: po.id,
        link_role: 'supporting',
      },
    ],
  }
}

export function buildPrefillFromPurchaseOrder(po: PurchaseOrder): AccountingVoucherPrefill {
  const items = po.items || []
  const lines: AccountingVoucherLine[] = items.map((item, i) => ({
    line_no: i + 1,
    description: item.product_description,
    amount: (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    reference_doc: po.po_number,
    po_id: po.id,
  }))
  if (lines.length === 0) {
    lines.push({
      line_no: 1,
      description: `Balance for ${formatPoLabel(po.po_number)}`,
      amount: Number(po.balance_amount) || Number(po.total_amount) || 0,
      reference_doc: po.po_number,
      po_id: po.id,
    })
  }
  return {
    voucherType: 'payment',
    sourceType: 'purchase_order',
    sourceId: po.id,
    header: {
      voucher_type: 'payment',
      payee_name: po.supplier?.name || 'Supplier',
      payee_kind: 'supplier',
      payment_for: formatPoLabel(po.po_number),
      has_po: true,
      payment_mode: po.payment_method === 'check' ? 'check' : po.payment_method === 'bank_transfer' ? 'bank_gcash' : 'cash',
      ...withRequestedBy(po.purchasing_agent),
      ...withDepartmentFromPo(po),
    },
    lines,
    links: [{ source_type: 'purchase_order', source_id: po.id, link_role: 'primary' }],
  }
}

export function buildPrefillFromMatchedInvoice(
  invoice: SupplierInvoice,
  po: PurchaseOrder,
  deliveryReceipts: DeliveryReceipt[]
): AccountingVoucherPrefill {
  const supplierName = po.supplier?.name || invoice.supplier?.name || 'Supplier'
  const dr = pickPrimaryDeliveryReceipt(deliveryReceipts)
  const invLines = invoice.lines || []
  const lines: AccountingVoucherLine[] = invLines.map((item, i) => {
    const poItem = po.items?.find((p) => p.id === item.po_item_id)
    return {
      line_no: i + 1,
      description: poItem?.product_description || `Invoice line ${i + 1}`,
      amount: Number(item.line_amount) || 0,
      reference_doc: po.po_number,
      po_id: po.id,
    }
  })
  if (lines.length === 0) {
    lines.push({
      line_no: 1,
      description: `Invoice ${invoice.invoice_number}`,
      amount: Number(invoice.total_amount) || 0,
      reference_doc: po.po_number,
      po_id: po.id,
    })
  }

  const links: AccountingVoucherLink[] = [
    {
      source_type: 'supplier_invoice',
      source_id: invoice.id,
      link_role: 'primary',
      attachment_url: invoice.attachment_url || undefined,
    },
    {
      source_type: 'purchase_order',
      source_id: po.id,
      link_role: 'supporting',
      attachment_url: po.po_attachment_url || undefined,
    },
  ]
  if (dr) {
    links.push({
      source_type: 'delivery_receipt',
      source_id: dr.id,
      link_role: 'supporting',
      attachment_url: dr.delivery_receipt_url || undefined,
    })
  }

  return {
    voucherType: 'payment',
    sourceType: 'supplier_invoice',
    sourceId: invoice.id,
    header: {
      voucher_type: 'payment',
      payee_name: supplierName,
      payee_kind: 'supplier',
      payment_for: formatPaymentVoucherJournalMemo(supplierName, po.po_number),
      has_po: true,
      has_invoice: true,
      has_receiving_report: true,
      has_dr: !!dr,
      amount_requested: Number(invoice.total_amount) || 0,
      notes: invoice.notes || undefined,
      ...withRequestedBy(po.purchasing_agent),
      ...withDepartmentFromPo(po),
    },
    lines,
    links,
  }
}

export function buildPrefillFromCustomerOrder(order: {
  id: string
  customer_name?: string
  total_amount: number
  notes?: string
  deposit_slip_url?: string
  location?: { name?: string; franchisee?: string }
}): AccountingVoucherPrefill {
  const payee =
    order.location?.franchisee || order.location?.name || order.customer_name || 'Customer'
  return {
    voucherType: 'payment',
    sourceType: 'customer_order',
    sourceId: order.id,
    header: {
      voucher_type: 'payment',
      payee_name: payee,
      payee_kind: 'invoice',
      payment_for: `Franchise order ${order.id.slice(0, 8)}`,
      has_invoice: true,
      notes: order.deposit_slip_url ? `Deposit slip on file` : undefined,
      ...withRequestedBy(payee),
      ...withDepartment(order.location?.name || 'Franchise'),
    },
    lines: [
      {
        line_no: 1,
        description: order.notes || 'Franchise order',
        amount: Number(order.total_amount) || 0,
        reference_doc: order.id.slice(0, 8).toUpperCase(),
      },
    ],
    links: [
      {
        source_type: 'customer_order',
        source_id: order.id,
        link_role: 'primary',
        attachment_url: order.deposit_slip_url,
      },
    ],
  }
}

export function buildPrefillFromPayrollBrandTotal(record: {
  id: string
  week_start_date: string
  week_end_date: string
  brand_name: string
  net_pay: number
  created_by?: string | null
}): AccountingVoucherPrefill {
  const amount = Number(record.net_pay) || 0
  return {
    voucherType: 'payment',
    sourceType: 'payroll_run_brand_total',
    sourceId: record.id,
    header: {
      voucher_type: 'payment',
      payee_name: `Payroll — ${record.brand_name}`,
      payee_kind: 'payroll',
      payment_for: `Net payroll week ${record.week_start_date} to ${record.week_end_date}`,
      amount_requested: amount,
      ...withRequestedBy(record.created_by),
      ...withDepartment('Payroll'),
    },
    lines: [
      {
        line_no: 1,
        description: 'Net payroll disbursement',
        amount,
        reference_doc: `${record.week_start_date} – ${record.week_end_date}`,
      },
    ],
    links: [
      { source_type: 'payroll_run_brand_total', source_id: record.id, link_role: 'primary' },
    ],
  }
}

export function buildPrefillFromIntercompanyTransfer(
  transfer: IntercompanyTransfer
): AccountingVoucherPrefill {
  const amount = Number(transfer.transfer_price_total) || 0
  const gfcName = transfer.from_brand?.name || 'GFC'
  return {
    voucherType: 'payment',
    sourceType: 'intercompany_transfer',
    sourceId: transfer.id,
    header: {
      voucher_type: 'payment',
      payee_name: gfcName,
      payee_kind: 'intercompany',
      payment_for: `Intercompany transfer ${transfer.transfer_number}`,
      amount_requested: amount,
      ...withRequestedBy(transfer.created_by),
      ...withDepartment(transfer.to_brand?.name || 'Intercompany'),
    },
    lines: [
      {
        line_no: 1,
        description: `Payment to ${gfcName} for ${transfer.transfer_number}`,
        amount,
        reference_doc: transfer.transfer_number,
      },
    ],
    links: [{ source_type: 'intercompany_transfer', source_id: transfer.id, link_role: 'primary' }],
  }
}

export function buildPrefillFromPayrollDeduction(record: {
  id: string
  staff_name: string
  week_start_date: string
  week_end_date: string
  cash_advances: number
  refunds: number
  utilities: number
  shortages: number
  penalties: number
  others: number
}): AccountingVoucherPrefill {
  const lines: AccountingVoucherLine[] = []
  let lineNo = 1
  const addLine = (desc: string, amount: number) => {
    if (amount > 0) {
      lines.push({
        line_no: lineNo++,
        description: desc,
        amount,
        reference_doc: `${record.week_start_date} – ${record.week_end_date}`,
      })
    }
  }
  addLine('Cash advance', Number(record.cash_advances) || 0)
  addLine('Refund', Number(record.refunds) || 0)
  addLine('Utilities', Number(record.utilities) || 0)
  addLine('Shortages', Number(record.shortages) || 0)
  addLine('Penalties', Number(record.penalties) || 0)
  addLine('Others', Number(record.others) || 0)
  if (lines.length === 0) {
    lines.push({ line_no: 1, description: 'Payroll reimbursement', amount: 0 })
  }
  const total = lines.reduce((s, l) => s + l.amount, 0)
  return {
    voucherType: 'payment',
    sourceType: 'payroll_deduction_refund',
    sourceId: record.id,
    header: {
      voucher_type: 'payment',
      payee_name: record.staff_name,
      payee_kind: 'reimbursement',
      payment_for: `Payroll week ${record.week_start_date} to ${record.week_end_date}`,
      amount_requested: total,
      ...withRequestedBy(record.staff_name),
      ...withDepartment('Payroll'),
    },
    lines,
    links: [
      { source_type: 'payroll_deduction_refund', source_id: record.id, link_role: 'primary' },
    ],
  }
}

export function buildPrefillFromPendingStaffAdvance(params: {
  staff_name: string
  amount: number
  disbursed_date: string
}): AccountingVoucherPrefill {
  const amount = Number(params.amount) || 0
  return {
    voucherType: 'payment',
    sourceType: 'staff_advance_disbursement',
    sourceId: '',
    header: {
      voucher_type: 'payment',
      payee_name: params.staff_name,
      payee_kind: 'staff_advance',
      payment_for: 'Staff cash advance',
      amount_requested: amount,
      ...withRequestedBy(params.staff_name),
      ...withDepartment('Administration'),
    },
    lines: [
      {
        line_no: 1,
        description: 'Staff cash advance',
        amount,
        reference_doc: params.disbursed_date,
      },
    ],
    links: [],
  }
}

export function buildPrefillFromStaffAdvance(record: {
  id: string
  staff_name: string
  amount: number
  disbursed_date: string
}): AccountingVoucherPrefill {
  const amount = Number(record.amount) || 0
  return {
    voucherType: 'payment',
    sourceType: 'staff_advance_disbursement',
    sourceId: record.id,
    header: {
      voucher_type: 'payment',
      payee_name: record.staff_name,
      payee_kind: 'staff_advance',
      payment_for: 'Staff cash advance',
      amount_requested: amount,
      ...withRequestedBy(record.staff_name),
      ...withDepartment('Administration'),
    },
    lines: [
      {
        line_no: 1,
        description: 'Staff cash advance',
        amount,
        reference_doc: record.disbursed_date,
      },
    ],
    links: [
      { source_type: 'staff_advance_disbursement', source_id: record.id, link_role: 'primary' },
    ],
  }
}

export function defaultVoucherLines(count = 1): AccountingVoucherLine[] {
  return Array.from({ length: count }, (_, i) => ({
    line_no: i + 1,
    description: '',
    amount: 0,
  }))
}

export function emptyPaymentVoucherPrefill(): AccountingVoucherPrefill {
  return {
    voucherType: 'payment',
    sourceType: 'supplier',
    sourceId: '',
    header: { voucher_type: 'payment', payee_kind: 'supplier' },
    lines: defaultVoucherLines(),
    links: [],
  }
}

export function emptyPettyCashPrefill(): AccountingVoucherPrefill {
  return {
    voucherType: 'petty_cash',
    sourceType: 'supplier',
    sourceId: '',
    header: { voucher_type: 'petty_cash' },
    lines: defaultVoucherLines(),
    links: [],
  }
}

export function parseStoredPrefill(raw: string | null): AccountingVoucherPrefill | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as AccountingVoucherPrefill
  } catch {
    return null
  }
}
