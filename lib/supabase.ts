import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export const supabase = createClientComponentClient()

export type Brand = {
  id: string
  name: string
  slug: string
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
  supplier_id: string
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
  po_attachment_url?: string
  notes?: string
  created_at?: string
  updated_at?: string
  supplier?: Supplier
  requisition?: Pick<PurchaseRequisition, 'id' | 'pr_number'>
  items?: PurchaseOrderItem[]
  payments?: POPayment[]
}

export type PurchaseOrderItem = {
  id: string
  po_id: string
  pr_item_id?: string
  material_id?: string
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
