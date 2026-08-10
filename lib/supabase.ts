import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export const supabase = createClientComponentClient()

export type BrandRole = 'factory' | 'retail'

export type Brand = {
  id: string
  name: string
  slug: string
  brand_role?: BrandRole
  logo_url?: string
  created_at?: string
  updated_at?: string
}

export type ProductCategorySort = {
  id: string
  brand_id: string
  category_name: string
  sort_index: number
}

export type BomQuantityMode = 'unit' | 'batch'

export type Product = {
  id?: string
  product_id?: string
  brand_id: string
  name?: string
  product_name?: string
  sku?: string
  category?: string
  bom_quantity_mode?: BomQuantityMode
  bom_yield_per_batch?: number | null
  unit: string
  price?: number
  minimum_stock?: number
  initial_stock?: number
  production?: number
  released?: number
  reserved?: number
  /** Supplies/consumables: source material in Materials Inventory. */
  linked_material_id?: string | null
  /** UOM when receiving from materials inventory: purchase or stock. */
  material_inventory_uom?: 'purchase' | 'stock' | null
  final_stock?: number
  available_stock?: number
  brand_name?: string
  brand_slug?: string
  created_at?: string
  updated_at?: string
}

export type DailyInventory = {
  id: string
  product_id: string
  date: string
  initial_stock: number
  production: number
  released: number
  reserved: number
  created_at?: string
  updated_at?: string
}

export type InventorySummary = DailyInventory & {
  product_name: string
  sku?: string
  brand_name: string
  brand_slug: string
  final_stock: number
  available_stock: number
}

// =============================================
// PURCHASING TYPES
// =============================================

export type Supplier = {
  id: string
  name: string
  contact_person?: string
  email?: string
  phone?: string
  address?: string
  payment_terms?: string
  payment_method?: 'cash' | 'check' | 'bank_transfer'
  bank_name?: string
  bank_account_number?: string
  bank_account_name?: string
  lead_time_days?: number
  is_active: boolean
  notes?: string
  created_at?: string
  updated_at?: string
}

export type PurchaseRequisition = {
  id: string
  pr_number: string
  brand_id: string
  requested_by: string
  department?: string
  request_date: string
  required_date?: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'converted'
  purpose?: string
  notes?: string
  created_at?: string
  updated_at?: string
  items?: PurchaseRequisitionItem[]
}

export type PurchaseRequisitionItem = {
  id: string
  pr_id: string
  product_description: string
  quantity: number
  unit: string
  estimated_price?: number
  notes?: string
  created_at?: string
}

export type Quotation = {
  id: string
  quotation_number: string
  pr_id?: string
  supplier_id: string
  brand_id: string
  quotation_date: string
  valid_until?: string
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  total_amount: number
  notes?: string
  attachment_url?: string
  created_at?: string
  updated_at?: string
  supplier?: Supplier
}

export type QuotationItem = {
  id: string
  quotation_id: string
  product_description: string
  quantity: number
  unit: string
  unit_price: number
  total_price?: number
  notes?: string
  created_at?: string
}

export type PurchaseOrder = {
  id: string
  po_number: string
  pr_id?: string
  quotation_id?: string
  supplier_id: string | null
  brand_id: string
  order_date: string
  expected_delivery_date?: string
  actual_delivery_date?: string
  purchasing_agent: string
  approved_by?: string
  approved_date?: string
  payment_terms?: string
  payment_method?: 'cash' | 'check' | 'bank_transfer'
  payment_timing: 'before_delivery' | 'after_delivery' | 'partial'
  status: 'draft' | 'pending_approval' | 'approved' | 'order_confirmed' | 'in_transit' | 'delivered' | 'paid' | 'closed' | 'cancelled'
  subtotal: number
  tax_amount: number
  total_amount: number
  paid_amount: number
  balance_amount: number
  delivery_address?: string
  delivery_contact?: string
  delivery_phone?: string
  payment_account_name?: string | null
  payment_account_number?: string | null
  po_attachment_url?: string
  notes?: string
  created_at?: string
  updated_at?: string
  supplier?: Supplier
  requisition?: Pick<PurchaseRequisition, 'id' | 'pr_number' | 'department'>
  items?: PurchaseOrderItem[]
  payments?: POPayment[]
}

export type PurchaseOrderItem = {
  id: string
  po_id: string
  pr_item_id?: string
  material_id?: string
  fixed_asset_id?: string
  product_description: string
  quantity: number
  unit: string
  unit_price: number
  total_price?: number
  quantity_received: number
  quantity_remaining?: number
  notes?: string
  created_at?: string
  material?: RawMaterial
  fixed_asset?: FixedAsset
  /** UI-only: true when item was selected from catalog (makes fields read-only) */
  fromCatalog?: boolean
}

export type POPayment = {
  id: string
  po_id: string
  payment_number: string
  payment_date: string
  payment_type: 'advance' | 'partial' | 'full' | 'final'
  payment_method: 'cash' | 'check' | 'bank_transfer'
  amount: number
  check_number?: string
  bank_name?: string
  reference_number?: string
  proof_of_payment_url?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

export type DeliveryReceipt = {
  id: string
  po_id: string
  receipt_number: string
  delivery_date: string
  received_by: string
  condition: 'good' | 'damaged' | 'partial' | 'incomplete'
  notes?: string
  delivery_receipt_url?: string
  inspection_notes?: string
  created_at?: string
  updated_at?: string
  items?: DeliveryReceiptItem[]
}

export type DeliveryReceiptItem = {
  id: string
  delivery_receipt_id: string
  po_item_id: string
  quantity_received: number
  quantity_damaged?: number
  notes?: string
  created_at?: string
}

export type POStatusHistory = {
  id: string
  po_id: string
  old_status?: string
  new_status: string
  changed_by: string
  notes?: string
  created_at?: string
}

export type CustomerOrderStatusHistory = {
  id: string
  order_id: string
  old_status?: string | null
  new_status: string
  changed_by: string
  notes?: string | null
  created_at?: string
}

// =============================================
// RAW MATERIALS INVENTORY TYPES
// =============================================

export type RawMaterial = {
  id: string
  brand_id: string
  supplier_id?: string
  linked_product_id?: string
  material_name: string
  sku?: string
  category?: string
  factory_inventory_kind?: FactoryInventoryKind | null
  /** When linked to factory: whether requests use purchase or stock unit qty. */
  factory_request_uom?: 'purchase' | 'stock' | null
  /** When linked to factory: whether production BOM uses stock or base unit. */
  factory_bom_uom?: 'stock' | 'base' | null
  owner?: string[]
  unit: string
  uom_base_unit?: string
  uom_base_per_unit?: number
  uom_purchase_unit?: string
  uom_stock_per_purchase?: number
  unit_cost: number
  minimum_stock: number
  current_stock: number
  notes?: string
  is_active: boolean
  created_at?: string
  updated_at?: string
  supplier?: Supplier
}

export type FixedAsset = {
  id: string
  brand_id: string
  supplier_id?: string | null
  asset_name: string
  sku?: string | null
  category?: string | null
  unit: string
  unit_cost: number
  quantity: number
  location?: string | null
  notes?: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
  supplier?: Supplier
}

export type POPurchaserTemplate = {
  id: string
  brand_id: string
  template_name: string
  is_default: boolean
  purchasing_agent?: string | null
  payment_terms?: string | null
  payment_method?: 'cash' | 'check' | 'bank_transfer'
  payment_timing?: 'before_delivery' | 'after_delivery' | 'partial'
  payment_account_name?: string | null
  payment_account_number?: string | null
  delivery_address?: string | null
  delivery_contact?: string | null
  delivery_phone?: string | null
  approved_by?: string | null
  approved_by_signatories?: string[] | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export type FixedAssetMovement = {
  id: string
  fixed_asset_id: string
  movement_type: 'in' | 'out' | 'adjustment'
  quantity: number
  unit_cost?: number | null
  reference_type?: string | null
  reference_id?: string | null
  reference_number?: string | null
  notes?: string | null
  movement_date: string
  created_by?: string | null
  journal_entry_id?: string | null
  created_at?: string
}

export type ProductBomItem = {
  id: string
  product_id: string
  material_id: string
  quantity: number
  quantity_mode?: BomQuantityMode
  yield_per_batch?: number | null
  notes?: string
  created_at?: string
  updated_at?: string
  material?: RawMaterial
}

export type FactoryMaterialRequest = {
  id: string
  material_id: string
  quantity: number
  quantity_used?: number
  status: 'pending' | 'released' | 'cancelled'
  requested_by?: string | null
  released_by?: string | null
  /** @deprecated Use requested_by / released_by */
  notes?: string
  request_date: string
  schedule_date?: string | null
  brand_id?: string | null
  released_at?: string
  journal_entry_id?: string | null
  created_at?: string
  material?: RawMaterial
}

export type ProductionScheduleStatus = 'draft' | 'active' | 'cancelled'

export type FactoryInventoryKind = 'ingredients' | 'packaging' | 'supplies'

export type FactoryOpenedMaterial = {
  id: string
  material_id: string
  factory_request_id?: string
  inventory_kind: FactoryInventoryKind
  label?: string
  quantity_opened: number
  quantity_remaining: number
  unit: string
  status: 'open' | 'depleted' | 'discarded'
  opened_at: string
  opened_by?: string
  notes?: string
  created_at?: string
  updated_at?: string
  material?: RawMaterial
}

export type FactoryOpenedMaterialBomUsage = {
  product_id: string
  product_name: string
  sku?: string
  bom_quantity: number
}

export type FactoryProductionBatchStatus = 'in_progress' | 'completed' | 'cancelled'

export type FactoryProductionBatch = {
  id: string
  schedule_id: string
  product_id: string
  work_date: string
  batch_number: string
  units: number
  status: FactoryProductionBatchStatus
  started_at: string
  started_by?: string | null
  completed_at?: string | null
  created_at?: string
  product_name?: string
  sku?: string
  brand_name?: string
}

export type FactoryBatchMaterialUsage = {
  id: string
  batch_id: string
  opened_material_id?: string | null
  material_id: string
  quantity_used: number
  unit: string
  created_at?: string
  material_name?: string
}

export type FactoryDailyStaff = {
  id: string
  work_date: string
  staff_registration_id: string
  created_at?: string
  staff_registrations?: { id: string; full_name: string }
}

export type GfcAttendanceLog = {
  id: string
  enrollment_no: number
  terminal_no?: number | null
  verify_mode?: number | null
  device_name: string
  work_date: string
  punch_at: string
  staff_registration_id?: string | null
  created_at?: string
  staff_registrations?: { id: string; full_name: string } | null
}

export type GfcAttendanceBreak = {
  id: string
  staff_registration_id: string
  work_date: string
  break_hours: number
  created_at?: string
  updated_at?: string
}

export type MaterialStockMovement = {
  id: string
  material_id: string
  movement_type: 'in' | 'out' | 'adjustment'
  quantity: number
  unit_cost?: number
  reference_type?: string
  reference_id?: string
  reference_number?: string
  notes?: string
  movement_date: string
  created_by?: string
  journal_entry_id?: string | null
  created_at?: string
}

export type MaterialStockAlert = {
  id: string
  material_id: string
  alert_type: 'low_stock' | 'out_of_stock' | 'overstock'
  alert_date: string
  is_resolved: boolean
  resolved_date?: string
  created_at?: string
}

export type MaterialCycleCountStatus = 'in_progress' | 'posted' | 'cancelled'

export type MaterialCycleCount = {
  id: string
  brand_id: string
  count_date: string
  status: MaterialCycleCountStatus
  notes?: string | null
  created_by?: string | null
  posted_by?: string | null
  posted_at?: string | null
  journal_entry_id?: string | null
  created_at?: string
  updated_at?: string
}

export type MaterialCycleCountLine = {
  id: string
  cycle_count_id: string
  material_id: string
  system_stock: number
  counted_stock?: number | null
  notes?: string | null
  adjustment_movement_id?: string | null
  created_at?: string
  updated_at?: string
  material?: RawMaterial
}

export type ProductCycleCountStatus = MaterialCycleCountStatus

export type ProductCycleCount = {
  id: string
  brand_id: string
  count_date: string
  status: ProductCycleCountStatus
  notes?: string | null
  /** NULL = main (non index-0 categories); set for index-0 category counts. */
  category_scope?: string | null
  created_by?: string | null
  posted_by?: string | null
  posted_at?: string | null
  journal_entry_id?: string | null
  created_at?: string
  updated_at?: string
}

export type ProductCycleCountLine = {
  id: string
  cycle_count_id: string
  product_id: string
  system_available: number
  counted_available?: number | null
  notes?: string | null
  created_at?: string
  updated_at?: string
  product?: Pick<Product, 'id' | 'name' | 'sku' | 'unit' | 'category'> & {
    product_name?: string
  }
}

export type ProductStockAdjustment = {
  id: string
  brand_id: string
  product_id: string
  previous_initial_stock: number
  new_initial_stock: number
  quantity_delta: number
  unit_cost: number
  amount: number
  unit?: string | null
  journal_entry_id?: string | null
  created_by?: string | null
  created_at?: string
}

// =============================================
// PRODUCTION SCHEDULE TYPES
// =============================================

export type ProductionSchedule = {
  id: string
  product_id: string
  schedule_date: string
  quantity_required: number
  batch_number: string
  created_at?: string
  updated_at?: string
  product?: Product
  brand?: Brand
}

export type ProductionStickerLog = {
  id: string
  product_id: string
  schedule_id?: string
  batch_number: string
  manufacture_date: string
  serial_number?: string
  produced_at?: string
  released_at?: string
  voided_at?: string | null
  created_at?: string
}

export type FactoryStickerRequestStatus = 'pending' | 'fulfilled' | 'cancelled'

export type FactoryStickerRequest = {
  id: string
  schedule_id: string
  product_id: string
  schedule_date: string
  quantity: number
  quantity_fulfilled?: number
  status: FactoryStickerRequestStatus
  requested_by?: string | null
  notes?: string | null
  request_date: string
  fulfilled_at?: string | null
  created_at?: string
}

// =============================================
// ACCOUNTING VOUCHERS
// =============================================

export type AccountingVoucherType = 'payment' | 'petty_cash'

export type PaymentVoucherStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'paid'
  | 'cancelled'

export type PettyCashVoucherStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'released'
  | 'liquidated'
  | 'cancelled'

export type AccountingVoucherStatus = PaymentVoucherStatus | PettyCashVoucherStatus

export type PayeeKind =
  | 'supplier'
  | 'reimbursement'
  | 'petty_cash_replenishment'
  | 'invoice'
  | 'payroll'
  | 'intercompany'
  | 'staff_advance'
  | 'other'

export type VoucherPaymentMode = 'cash' | 'check' | 'bank_gcash'

export type AccountingVoucherSourceType =
  | 'po_payment'
  | 'purchase_order'
  | 'delivery_receipt'
  | 'customer_order'
  | 'payroll_deduction_refund'
  | 'payroll_run_brand_total'
  | 'supplier'
  | 'supplier_invoice'
  | 'intercompany_transfer'
  | 'staff_advance_disbursement'

export type SupplierInvoiceStatus = 'draft' | 'matched' | 'exception' | 'vouchered' | 'paid'

export type SupplierInvoice = {
  id: string
  brand_id: string
  po_id: string
  supplier_id?: string | null
  invoice_number: string
  invoice_date: string
  total_amount: number
  attachment_url?: string | null
  status: SupplierInvoiceStatus
  match_summary?: Record<string, unknown> | null
  match_fingerprint?: string | null
  matched_at?: string | null
  payment_voucher_id?: string | null
  notes?: string | null
  created_at?: string
  updated_at?: string
  supplier?: Supplier
  purchase_order?: Pick<PurchaseOrder, 'id' | 'po_number' | 'items' | 'supplier'>
  lines?: SupplierInvoiceLine[]
}

export type SupplierInvoiceLine = {
  id?: string
  supplier_invoice_id?: string
  po_item_id: string
  quantity_invoiced: number
  unit_price: number
  line_amount: number
  created_at?: string
}

export type AccountingVoucherLinkRole = 'primary' | 'supporting'

export type AccountingVoucherSettings = {
  id: string
  brand_id: string
  company_name: string
  company_address: string
  approved_by_name: string
  approved_by_title: string
  petty_cash_custodian_name: string
  petty_cash_custodian_title: string
  liquidated_by_name: string
  liquidated_by_title: string
  pv_number_prefix: string
  pcv_number_prefix: string
  pv_next_seq: number
  pcv_next_seq: number
  petty_cash_fund_amount?: number
  je_number_prefix?: string
  je_next_seq?: number
  default_cash_account_id?: string | null
  default_cash_customer_order_account_id?: string | null
  default_cash_payment_voucher_account_id?: string | null
  default_cash_payroll_account_id?: string | null
  default_cash_staff_advance_account_id?: string | null
  default_ap_account_id?: string | null
  default_ar_account_id?: string | null
  default_sales_account_id?: string | null
  default_delivery_income_account_id?: string | null
  default_inventory_account_id?: string | null
  default_wip_factory_materials_account_id?: string | null
  default_finished_goods_inventory_account_id?: string | null
  default_inventory_variance_account_id?: string | null
  default_damaged_goods_account_id?: string | null
  default_petty_cash_account_id?: string | null
  default_payroll_expense_account_id?: string | null
  default_accrued_payroll_account_id?: string | null
  default_staff_advance_account_id?: string | null
  default_intercompany_sales_account_id?: string | null
  default_intercompany_cogs_account_id?: string | null
  default_due_to_gfc_account_id?: string | null
  coa_seeded_at?: string | null
  created_at?: string
  updated_at?: string
}

export type IntercompanyBrandSettings = {
  id: string
  factory_brand_id: string
  retail_brand_id: string
  due_from_account_id?: string | null
  due_to_account_id?: string | null
  created_at?: string
  updated_at?: string
}

export type IntercompanyTransferStatus = 'draft' | 'posted' | 'void'

export type IntercompanyTransfer = {
  id: string
  transfer_number: string
  from_brand_id: string
  to_brand_id: string
  transfer_date: string
  status: IntercompanyTransferStatus
  transfer_price_total: number
  cost_amount_total: number
  margin_total: number
  notes?: string | null
  journal_entry_id_from?: string | null
  journal_entry_id_to?: string | null
  settled_at?: string | null
  settled_by?: string | null
  settlement_journal_entry_id_from?: string | null
  settlement_journal_entry_id_to?: string | null
  created_by?: string | null
  posted_at?: string | null
  posted_by?: string | null
  created_at?: string
  updated_at?: string
  lines?: IntercompanyTransferLine[]
  from_brand?: Pick<Brand, 'id' | 'name'>
  to_brand?: Pick<Brand, 'id' | 'name'>
}

export type IntercompanyTransferLine = {
  id?: string
  transfer_id?: string
  line_no: number
  source_product_id?: string | null
  dest_product_id?: string | null
  sku?: string | null
  description?: string | null
  quantity: number
  unit_cost: number
  unit_price: number
  line_cost: number
  line_price: number
  created_at?: string
}

export type MaterialTransferStatus = 'draft' | 'posted' | 'void'

export type MaterialTransfer = {
  id: string
  transfer_number: string
  from_brand_id: string
  to_brand_id: string
  transfer_date: string
  status: MaterialTransferStatus
  cost_amount_total: number
  notes?: string | null
  journal_entry_id_from?: string | null
  journal_entry_id_to?: string | null
  created_by?: string | null
  posted_at?: string | null
  posted_by?: string | null
  created_at?: string
  updated_at?: string
  lines?: MaterialTransferLine[]
  from_brand?: Pick<Brand, 'id' | 'name'>
  to_brand?: Pick<Brand, 'id' | 'name'>
}

export type MaterialTransferLine = {
  id?: string
  transfer_id?: string
  line_no: number
  source_material_id?: string | null
  dest_material_id?: string | null
  sku?: string | null
  description?: string | null
  quantity: number
  unit_cost: number
  line_cost: number
  created_at?: string
}

export type AccountingVoucher = {
  id: string
  brand_id: string
  franchise_brand_id?: string | null
  voucher_type: AccountingVoucherType
  voucher_number: string
  voucher_date: string
  department?: string | null
  requested_by?: string | null
  prepared_by?: string | null
  payee_name?: string | null
  payment_for?: string | null
  payee_kind?: PayeeKind | null
  payment_mode?: VoucherPaymentMode | null
  bank_account_id?: string | null
  check_number?: string | null
  check_date?: string | null
  bank_ref_number?: string | null
  bank_ref_date?: string | null
  received_by?: string | null
  purpose?: string | null
  amount_requested?: number | null
  amount_released?: number | null
  date_released?: string | null
  actual_expense?: number | null
  cash_advance?: number | null
  excess_returned?: number | null
  additional_reimbursement?: number | null
  status: AccountingVoucherStatus
  submitted_at?: string | null
  approved_at?: string | null
  liquidated_at?: string | null
  prepared_by_name?: string | null
  requestor_name?: string | null
  approved_by_name?: string | null
  approved_by_title?: string | null
  liquidated_by_name?: string | null
  liquidated_by_title?: string | null
  has_or?: boolean
  has_si?: boolean
  has_dr?: boolean
  has_transport_receipt?: boolean
  has_po?: boolean
  has_invoice?: boolean
  has_receiving_report?: boolean
  supporting_docs_other?: string | null
  notes?: string | null
  proof_of_payment_url?: string | null
  created_by?: string | null
  journal_entry_id?: string | null
  posted_at?: string | null
  created_at?: string
  updated_at?: string
  lines?: AccountingVoucherLine[]
  links?: AccountingVoucherLink[]
}

export type AccountingVoucherLine = {
  id?: string
  voucher_id?: string
  line_no: number
  description: string
  amount: number
  reference_doc?: string | null
  po_id?: string | null
  debit_account_id?: string | null
  franchise_brand_id?: string | null
}

export type AccountingVoucherLink = {
  id?: string
  voucher_id?: string
  source_type: AccountingVoucherSourceType
  source_id: string
  link_role: AccountingVoucherLinkRole
  attachment_url?: string | null
  notes?: string | null
}

export type AccountingVoucherPrefill = {
  voucherType: AccountingVoucherType
  sourceType: AccountingVoucherSourceType
  sourceId: string
  header: Partial<AccountingVoucher>
  lines: AccountingVoucherLine[]
  links: AccountingVoucherLink[]
}

export const ACCOUNTING_VOUCHER_PREFILL_KEY = 'accounting_voucher_prefill'
export const ACCOUNTING_ACTIVE_SUBTAB_KEY = 'accounting_active_subtab'
export const ACCOUNTING_VOUCHER_VIEW_KEY = 'accounting_voucher_view'
export const PROCUREMENT_PO_EDIT_KEY = 'procurement_po_edit'

// =============================================
// PAYROLL RUNS
// =============================================

export type PayrollRunStatus = 'draft' | 'calculated' | 'approved' | 'accrued' | 'paid' | 'void'

export type PayrollRun = {
  id: string
  week_start_date: string
  week_end_date: string
  status: PayrollRunStatus
  calculated_at?: string | null
  approved_at?: string | null
  accrued_at?: string | null
  paid_at?: string | null
  created_by?: string | null
  approved_by?: string | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export type PayrollRunLine = {
  id: string
  payroll_run_id: string
  staff_id: string
  hourly_rate_snapshot: number
  total_hours: number
  regular_hours: number
  overtime_hours: number
  double_pay_hours: number
  special_pay_hours: number
  regular_pay: number
  overtime_pay: number
  double_pay: number
  special_pay: number
  incentive_pay: number
  gross_pay: number
  deductions_refund_id?: string | null
  utilities: number
  shortages: number
  cash_advances: number
  penalties: number
  others: number
  refunds: number
  total_deductions: number
  net_pay: number
  created_at?: string
}

export type PayrollRunBrandTotal = {
  id: string
  payroll_run_id: string
  brand_id: string
  gross_pay: number
  total_deductions: number
  refunds: number
  net_pay: number
  withholdings_other: number
  cash_advances_withheld: number
  journal_entry_id_accrual?: string | null
  journal_entry_id_payment?: string | null
  payment_voucher_id?: string | null
  created_at?: string
  brand?: { id: string; name: string }
}

// =============================================
// ACCOUNTING BOOKS
// =============================================

export type AccountingAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export type AccountingAccount = {
  id: string
  brand_id: string
  code: string
  name: string
  account_type: AccountingAccountType
  normal_balance: 'debit' | 'credit'
  parent_id?: string | null
  is_system: boolean
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export type AccountingPeriod = {
  id: string
  brand_id: string
  year: number
  month: number
  status: 'open' | 'closed'
  year_closed?: boolean
  created_at?: string
  updated_at?: string
}

export type AccountingYearEndClose = {
  id: string
  brand_id: string
  fiscal_year: number
  journal_entry_id: string
  closed_at?: string
  closed_by?: string | null
}

export type AccountingPostingError = {
  id: string
  brand_id: string
  source_type: string
  source_id: string
  error_message: string
  created_at?: string
  resolved_at?: string | null
}

export type AccountingJournalSourceType =
  | 'manual'
  | 'payment_voucher'
  | 'petty_cash_voucher'
  | 'customer_order_revenue'
  | 'customer_order_cash'
  | 'customer_order_cogs'
  | 'delivery_receipt'
  | 'material_movement'
  | 'fixed_asset_movement'
  | 'material_cycle_count'
  | 'product_cycle_count'
  | 'reversal'
  | 'opening_balance'
  | 'year_end_close'
  | 'payroll_run_accrual'
  | 'payroll_run_payment'
  | 'intercompany_transfer'
  | 'intercompany_transfer_settlement'
  | 'production_batch'
  | 'factory_material_release'
  | 'factory_wip_adjustment'
  | 'staff_advance_disbursement'
  | 'material_transfer'
  | 'product_opening_stock'
  | 'product_stock_adjustment'

export type AccountingJournalEntry = {
  id: string
  brand_id: string
  franchise_brand_id?: string | null
  entry_number: string
  entry_date: string
  memo?: string | null
  status: 'draft' | 'posted' | 'reversed'
  source_type: AccountingJournalSourceType
  source_id?: string | null
  posted_at?: string | null
  posted_by?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
  lines?: AccountingJournalLine[]
}

export type AccountingJournalLine = {
  id?: string
  journal_entry_id?: string
  account_id: string
  line_no: number
  debit: number
  credit: number
  memo?: string | null
  voucher_line_id?: string | null
  franchise_brand_id?: string | null
  location_id?: string | null
  account?: Pick<AccountingAccount, 'code' | 'name' | 'account_type'>
}

export type AccountingBankAccount = {
  id: string
  brand_id: string
  name: string
  account_last4?: string | null
  gl_account_id: string
  is_active: boolean
}

/** Optional bank used when posting customer_order_cash (debit bank GL / credit AR). */
export type CustomerOrderCollectionBankFields = {
  collection_bank_account_id?: string | null
}

export type AccountingBankReconciliation = {
  id: string
  brand_id: string
  bank_account_id: string
  statement_date: string
  statement_ending_balance: number
  book_balance: number
  notes?: string | null
  reconciled_by?: string | null
}

export type AccountingPettyCashReconciliation = {
  id: string
  brand_id: string
  count_date: string
  fund_amount: number
  cash_on_hand: number
  pcv_expenses_total: number
  variance: number
  notes?: string | null
  counted_by?: string | null
}
