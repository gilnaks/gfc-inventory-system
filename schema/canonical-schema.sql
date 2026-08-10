-- =====================================================================
-- GFC INVENTORY SYSTEM — CANONICAL CONSOLIDATED SCHEMA
-- =====================================================================
-- ONE idempotent file that reflects the schema the application actually
-- uses. Reconstructed by layering all 86 repo SQL files in order and
-- cross-referencing against app usage (app/ + lib/). See SCHEMA-AUDIT.md.
--
-- SAFE TO RUN REPEATEDLY on an existing database:
--   * CREATE TABLE IF NOT EXISTS         (won't touch existing tables)
--   * ALTER TABLE ... ADD COLUMN IF NOT EXISTS  (converges partial DBs)
--   * CREATE INDEX IF NOT EXISTS
--   * CREATE OR REPLACE FUNCTION / VIEW
--   * DROP TRIGGER/POLICY IF EXISTS + CREATE
--   * constraint adds are guarded with DO/IF NOT EXISTS
-- No data is dropped or truncated by the main body.
--
-- CONVENTIONS / CAVEATS:
--   * RECONCILED against a live information_schema dump (see schema/dumps/).
--     Confirmed present in live DB (dashboard-created, not in repo SQL):
--       announcements, staff_registrations.hourly_rate / employment_date,
--       locations.can_access_order_features, staff_schedules.hours_manual_override.
--     Former ACTIVE BUGS (app referenced objects absent from live) — now RESOLVED:
--       * fixed_asset_movements — real feature; table IS created below, RUN IT ON LIVE.
--       * dsir_expenses.particulars — app code fixed to use existing `description` col.
--       * staff_schedules.is_rest_day — vestigial app logic removed (was always false).
--       * staff_codes + staff_assignments.staff_code_id/brand_id — dead component
--         (StaffCodeManager, not mounted); objects removed from this schema.
--     Absent from live and unused by app (kept for migration-compat only):
--       gfc_material_legacy_mapping.
--   * RLS policies are standardized to a permissive "Allow all on <t>"
--     (FOR ALL USING true), matching the repo's existing posture.
--     `leave_requests` intentionally has RLS DISABLED (Section 13).
--   * `quotations` / `quotation_items` / `material_stock_alerts` are NOT
--     used by the app but are kept here because used tables / triggers
--     depend on them. Removal steps are in the commented CLEANUP appendix.
--   * `gfc_product_retail_mapping` is intentionally absent (it was created
--     then dropped by the retail-direct migration).
-- =====================================================================

-- =====================================================================
-- SECTION 0. EXTENSIONS + SHARED TRIGGER FUNCTION
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- SECTION 1. CORE: brands, locations, products, raw_materials, suppliers
-- (cross FKs products<->raw_materials added in Section 11 to avoid cycles)
-- =====================================================================

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  logo_url TEXT,
  brand_role VARCHAR(20) NOT NULL DEFAULT 'retail' CHECK (brand_role IN ('factory', 'retail')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  passkey VARCHAR(6) NOT NULL UNIQUE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  franchisee VARCHAR(100),
  contact_number VARCHAR(20),
  company_owned BOOLEAN DEFAULT FALSE,
  is_remote BOOLEAN DEFAULT FALSE,
  is_factory_floor BOOLEAN NOT NULL DEFAULT FALSE,
  can_access_order_features BOOLEAN DEFAULT FALSE,           -- MISSING in repo SQL; used by order portal
  incentive_regular_sales_threshold DECIMAL(12,2),
  incentive_holiday_sales_threshold DECIMAL(12,2),
  incentive_base_amount DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  sku VARCHAR(100),
  category VARCHAR(100),
  unit VARCHAR(50) DEFAULT 'pcs',
  price DECIMAL(10,2) DEFAULT 0.00,
  initial_stock INTEGER DEFAULT 0,
  production INTEGER DEFAULT 0,
  released INTEGER DEFAULT 0,
  reserved INTEGER DEFAULT 0,
  minimum_stock INTEGER NOT NULL DEFAULT 0,
  bom_quantity_mode TEXT NOT NULL DEFAULT 'unit' CHECK (bom_quantity_mode IN ('unit', 'batch')),
  bom_yield_per_batch DECIMAL(12,4),
  linked_material_id UUID,   -- FK -> raw_materials(id) added in Section 11
  material_inventory_uom VARCHAR(20) CHECK (material_inventory_uom IS NULL OR material_inventory_uom IN ('purchase', 'stock')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, name),
  UNIQUE (brand_id, sku)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(20),
  address TEXT,
  payment_terms VARCHAR(50),
  bank_name VARCHAR(100),
  bank_account_number VARCHAR(50),
  bank_account_name VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('cash', 'check', 'bank_transfer')),
  lead_time_days INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raw_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  material_name VARCHAR(200) NOT NULL,
  sku VARCHAR(100),
  category VARCHAR(100),
  unit VARCHAR(50) NOT NULL,
  unit_cost DECIMAL(12,2) DEFAULT 0,
  minimum_stock DECIMAL(10,2) DEFAULT 0,
  current_stock DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  owner TEXT[] DEFAULT '{}'::text[],
  uom_base_unit VARCHAR(50),
  uom_base_per_unit DECIMAL(12,4) DEFAULT 1,
  uom_purchase_unit VARCHAR(50),
  uom_stock_per_purchase DECIMAL(12,4) DEFAULT 1,
  factory_bom_uom VARCHAR(20) CHECK (factory_bom_uom IS NULL OR factory_bom_uom IN ('stock', 'base')),
  factory_request_uom VARCHAR(20) CHECK (factory_request_uom IS NULL OR factory_request_uom IN ('purchase', 'stock')),
  factory_inventory_kind TEXT CHECK (factory_inventory_kind IS NULL OR factory_inventory_kind IN ('ingredients', 'packaging', 'supplies')),
  linked_product_id UUID,   -- FK -> products(id) added in Section 11
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, material_name)
);

-- =====================================================================
-- SECTION 2. ORDERS
-- =====================================================================

CREATE TABLE IF NOT EXISTS customer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  customer_name VARCHAR(100),
  customer_contact VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(10,2) DEFAULT 0,
  delivery_type VARCHAR(10) NOT NULL DEFAULT 'delivery',
  deposit_slip_url TEXT,
  deposit_slip_uploaded_at TIMESTAMPTZ,
  freight_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  bill_of_lading_url TEXT,
  returnable_pans_image_url TEXT,
  notes TEXT,
  -- accounting links (added by accounting-books / accounting-cogs-column)
  journal_entry_id_revenue UUID,
  journal_entry_id_cash UUID,
  journal_entry_id_cogs UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  changed_by VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS logistics_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_slot VARCHAR(10) NOT NULL CHECK (time_slot IN ('morning', 'afternoon')),
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_transit', 'delivered', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (order_id, date, time_slot)
);

CREATE TABLE IF NOT EXISTS daily_stock_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_production INTEGER DEFAULT 0,
  total_released INTEGER DEFAULT 0,
  total_final_stock INTEGER DEFAULT 0,
  production_details JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, date)
);

-- =====================================================================
-- SECTION 3. PRODUCT EXTENSIONS (BOM, categories, cycle counts)
-- =====================================================================

CREATE TABLE IF NOT EXISTS product_bom_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  quantity DECIMAL(12,4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  quantity_mode TEXT NOT NULL DEFAULT 'unit' CHECK (quantity_mode IN ('unit', 'batch')),
  yield_per_batch DECIMAL(12,4),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, material_id)
);

CREATE TABLE IF NOT EXISTS product_category_sort (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL DEFAULT '',
  sort_index INTEGER NOT NULL DEFAULT 0,
  show_on_order_portal BOOLEAN NOT NULL DEFAULT TRUE,
  remote_store BOOLEAN NOT NULL DEFAULT FALSE,
  yield_per_batch NUMERIC(12,2) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, category_name)
);

CREATE TABLE IF NOT EXISTS product_cycle_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  count_date DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'posted', 'cancelled')),
  category_scope TEXT,
  notes TEXT,
  created_by VARCHAR(100),
  posted_by VARCHAR(100),
  posted_at TIMESTAMPTZ,
  journal_entry_id UUID,   -- FK -> accounting_journal_entries added in Section 11
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_cycle_count_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_count_id UUID NOT NULL REFERENCES product_cycle_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  system_available NUMERIC(12,2) NOT NULL,
  counted_available NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cycle_count_id, product_id)
);

CREATE TABLE IF NOT EXISTS product_stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  previous_initial_stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
  new_initial_stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
  quantity_delta NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit TEXT,
  journal_entry_id UUID,
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- SECTION 4. STAFF / DSIR
-- =====================================================================

CREATE TABLE IF NOT EXISTS staff_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(100) NOT NULL,
  mobile_number VARCHAR(20) NOT NULL,
  staff_code VARCHAR(8) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  total_warnings INTEGER DEFAULT 0,
  leave_balance INTEGER DEFAULT 10 CHECK (leave_balance >= 0 AND leave_balance <= 10),
  hourly_rate DECIMAL(10,2) DEFAULT 0,        -- MISSING in repo SQL; used by payroll
  employment_date DATE,                        -- MISSING in repo SQL; used by StaffManager
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_registration_id UUID REFERENCES staff_registrations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  assigned_by_location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (staff_registration_id, location_id)
);

CREATE TABLE IF NOT EXISTS staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  staff_registration_id UUID NOT NULL REFERENCES staff_registrations(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  hours DECIMAL(4,1) DEFAULT 8.0,              -- live default is 8.0 (repo SQL used 11.0)
  day_type VARCHAR(20) DEFAULT 'default' CHECK (day_type IN ('default', 'regular-holiday', 'special-holiday')),
  is_absent BOOLEAN DEFAULT FALSE,
  hours_manual_override BOOLEAN NOT NULL DEFAULT FALSE,  -- exists in live DB
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (location_id, schedule_date, staff_registration_id)
);

CREATE TABLE IF NOT EXISTS dsir_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  staff_registration_id UUID NOT NULL REFERENCES staff_registrations(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  store_hours VARCHAR(50),
  staff_name VARCHAR(100),
  initial VARCHAR(10),
  gross_sales DECIMAL(10,2) DEFAULT 0,
  total_discounts DECIMAL(10,2) DEFAULT 0,
  total_expenses DECIMAL(10,2) DEFAULT 0,
  net_sales DECIMAL(10,2) DEFAULT 0,
  total_cash DECIMAL(10,2) DEFAULT 0,
  discrepancy DECIMAL(10,2) DEFAULT 0,
  big_cup_sales DECIMAL(10,2) DEFAULT 0,
  small_cup_sales DECIMAL(10,2) DEFAULT 0,
  water_sales DECIMAL(10,2) DEFAULT 0,
  ml_500_sales DECIMAL(10,2) DEFAULT 0,
  choco_coated_sales DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (location_id, report_date, staff_registration_id)
);

CREATE TABLE IF NOT EXISTS dsir_sales_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dsir_report_id UUID NOT NULL REFERENCES dsir_reports(id) ON DELETE CASCADE,
  item_name VARCHAR(100) NOT NULL,
  beginning_inventory INTEGER DEFAULT 0,
  arrival INTEGER DEFAULT 0,
  pull_out INTEGER DEFAULT 0,
  new_inventory INTEGER DEFAULT 0,
  ending_inventory INTEGER DEFAULT 0,
  sold INTEGER DEFAULT 0,
  price DECIMAL(10,2) DEFAULT 0,
  sales DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dsir_ice_cream_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dsir_report_id UUID NOT NULL REFERENCES dsir_reports(id) ON DELETE CASCADE,
  flavor VARCHAR(100) NOT NULL,
  beginning INTEGER DEFAULT 0,
  arrival INTEGER DEFAULT 0,
  pull_out INTEGER DEFAULT 0,
  ending INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dsir_materials_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dsir_report_id UUID NOT NULL REFERENCES dsir_reports(id) ON DELETE CASCADE,
  material_name VARCHAR(100) NOT NULL,
  beginning INTEGER DEFAULT 0,
  arrival INTEGER DEFAULT 0,
  pull_out INTEGER DEFAULT 0,
  ending INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dsir_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dsir_report_id UUID NOT NULL REFERENCES dsir_reports(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  id_type VARCHAR(20) NOT NULL CHECK (id_type IN ('senior', 'pwd')),
  id_no VARCHAR(50),
  attach_url TEXT,
  order_type VARCHAR(20),
  order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- NOTE: live DB stores this as a PLAIN nullable numeric (app computes it), NOT a generated column.
  discount_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dsir_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dsir_report_id UUID NOT NULL REFERENCES dsir_reports(id) ON DELETE CASCADE,
  expense_type VARCHAR(100),
  description VARCHAR(100),   -- DSIRForm/DSIRSections write here (was wrongly 'particulars' in app; fixed)
  amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dsir_sales_recon (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dsir_report_id UUID NOT NULL REFERENCES dsir_reports(id) ON DELETE CASCADE,
  denomination VARCHAR(100) NOT NULL,
  quantity INTEGER DEFAULT 0,
  amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dsir_predefined_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  category VARCHAR(20) NOT NULL CHECK (category IN ('sales', 'ice_cream', 'materials', 'denominations')),
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  show_in_local BOOLEAN DEFAULT TRUE,
  show_in_remote BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, category, name)
);

CREATE TABLE IF NOT EXISTS dsir_store_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  flavor VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, flavor)
);

CREATE TABLE IF NOT EXISTS dsir_store_inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  flavor VARCHAR(100) NOT NULL,
  delta INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
  movement_type VARCHAR(40) NOT NULL
    CHECK (movement_type IN ('transfer_receive', 'dsir_pull_out', 'cycle_count')),
  staff_registration_id UUID REFERENCES staff_registrations(id) ON DELETE SET NULL,
  staff_name TEXT,
  dsir_report_id UUID REFERENCES dsir_reports(id) ON DELETE SET NULL,
  source_key TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_registration_id UUID NOT NULL REFERENCES staff_registrations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN (
    'absence_sickness', 'absence_family', 'absence_authorized', 'absence_personal',
    'absence_bereavement', 'absence_vacation', 'absence_admin')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  approved_by UUID REFERENCES staff_registrations(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) NOT NULL UNIQUE,
  passcode VARCHAR(20) NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'guest', 'developer', 'accounting_manager', 'procurement_manager', 'production_manager')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Developer "Lock Access": a row means that dashboard module (or one of its
-- sub-tabs, when sub_tab_key is set) is temporarily hidden. Unlock = delete row.
CREATE TABLE IF NOT EXISTS module_access_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL,
  sub_tab_key TEXT,
  reason TEXT,
  locked_by VARCHAR(120),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- SECTION 4b. FLEET GPS / ZONES / TRIPS
-- Driver app submits location pings; geofence trigger auto-tracks trips.
-- =====================================================================

CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plate_number TEXT,
  driver_id UUID REFERENCES staff_registrations(id) ON DELETE SET NULL,
  tracking_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  last_lat DOUBLE PRECISION,
  last_lng DOUBLE PRECISION,
  last_accuracy_m DOUBLE PRECISION,
  last_heading DOUBLE PRECISION,
  last_speed_mps DOUBLE PRECISION,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_location_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed_mps DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_m DOUBLE PRECISION NOT NULL DEFAULT 200,
  is_hq BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES staff_registrations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_trip_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES fleet_trips(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES fleet_zones(id) ON DELETE CASCADE,
  leg_order INT NOT NULL,
  arrived_at TIMESTAMPTZ NOT NULL,
  departed_at TIMESTAMPTZ,
  duration_from_prev_s INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- SECTION 5. PURCHASING / MATERIALS
-- NOTE: quotations / quotation_items are UNUSED by the app but retained
-- because purchase_orders.quotation_id references quotations.
-- =====================================================================

CREATE TABLE IF NOT EXISTS purchase_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_number VARCHAR(50) NOT NULL UNIQUE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  requested_by VARCHAR(100) NOT NULL,
  department VARCHAR(100),
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  required_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'converted')),
  purpose TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_requisition_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id UUID NOT NULL REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
  product_description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  estimated_price DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number VARCHAR(50) NOT NULL UNIQUE,
  pr_id UUID REFERENCES purchase_requisitions(id) ON DELETE SET NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  total_amount DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(50) NOT NULL UNIQUE,
  pr_id UUID REFERENCES purchase_requisitions(id) ON DELETE SET NULL,
  quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  purchasing_agent VARCHAR(100) NOT NULL,
  approved_by VARCHAR(100),
  approved_date DATE,
  payment_terms VARCHAR(50),
  payment_method VARCHAR(20) CHECK (payment_method IS NULL OR payment_method IN ('cash', 'check', 'bank_transfer')),
  payment_timing VARCHAR(20) NOT NULL DEFAULT 'after_delivery' CHECK (payment_timing IN ('before_delivery', 'after_delivery', 'partial')),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'order_confirmed', 'in_transit', 'delivered', 'paid', 'closed', 'cancelled')),
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  balance_amount DECIMAL(12,2) DEFAULT 0,
  delivery_address TEXT,
  delivery_contact VARCHAR(100),
  delivery_phone VARCHAR(20),
  po_attachment_url TEXT,
  payment_account_name VARCHAR(200),
  payment_account_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  pr_item_id UUID REFERENCES purchase_requisition_items(id) ON DELETE SET NULL,
  material_id UUID REFERENCES raw_materials(id) ON DELETE SET NULL,
  fixed_asset_id UUID,   -- FK -> fixed_assets(id) added in Section 11
  product_description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  quantity_received DECIMAL(10,2) DEFAULT 0,
  quantity_remaining DECIMAL(10,2) GENERATED ALWAYS AS (quantity - COALESCE(quantity_received, 0)) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS po_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  payment_number VARCHAR(50) NOT NULL UNIQUE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('advance', 'partial', 'full', 'final')),
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'check', 'bank_transfer')),
  amount DECIMAL(12,2) NOT NULL,
  check_number VARCHAR(50),
  bank_name VARCHAR(100),
  reference_number VARCHAR(100),
  proof_of_payment_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  receipt_number VARCHAR(50) NOT NULL UNIQUE,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by VARCHAR(100) NOT NULL,
  condition VARCHAR(20) DEFAULT 'good' CHECK (condition IN ('good', 'damaged', 'partial', 'incomplete')),
  notes TEXT,
  delivery_receipt_url TEXT,
  inspection_notes TEXT,
  journal_entry_id UUID,   -- FK -> accounting_journal_entries added in Section 11
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_receipt_id UUID NOT NULL REFERENCES delivery_receipts(id) ON DELETE CASCADE,
  po_item_id UUID NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
  quantity_received DECIMAL(10,2) NOT NULL,
  quantity_damaged DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (quantity_damaged >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS po_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  changed_by VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS po_purchaser_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  template_name VARCHAR(100) NOT NULL DEFAULT 'Default',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  purchasing_agent VARCHAR(100),
  payment_terms VARCHAR(50),
  payment_method VARCHAR(20),
  payment_timing VARCHAR(20) DEFAULT 'after_delivery',
  payment_account_name VARCHAR(200),
  payment_account_number VARCHAR(100),
  delivery_address TEXT,
  delivery_contact VARCHAR(100),
  delivery_phone VARCHAR(20),
  approved_by VARCHAR(100),
  approved_by_signatories TEXT[] DEFAULT '{}'::text[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  quantity DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(12,2),
  reference_type VARCHAR(50),
  reference_id UUID,
  reference_number VARCHAR(100),
  notes TEXT,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by VARCHAR(100),
  journal_entry_id UUID,   -- FK -> accounting_journal_entries added in Section 11
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- UNUSED by app UI, but written by check_material_stock_level() trigger.
CREATE TABLE IF NOT EXISTS material_stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'overstock')),
  alert_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_cycle_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'posted', 'cancelled')),
  notes TEXT,
  created_by VARCHAR(100),
  posted_by VARCHAR(100),
  posted_at TIMESTAMPTZ,
  journal_entry_id UUID,   -- FK -> accounting_journal_entries added in Section 11
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_cycle_count_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_count_id UUID NOT NULL REFERENCES material_cycle_counts(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  system_stock NUMERIC(12,2) NOT NULL,
  counted_stock NUMERIC(12,2),
  notes TEXT,
  adjustment_movement_id UUID REFERENCES material_stock_movements(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cycle_count_id, material_id)
);

-- =====================================================================
-- SECTION 6. ACCOUNTING + FIXED ASSETS
-- =====================================================================

CREATE TABLE IF NOT EXISTS accounting_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(200) NOT NULL,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  parent_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, code)
);

CREATE TABLE IF NOT EXISTS accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  year_closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, year, month)
);

CREATE TABLE IF NOT EXISTS accounting_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  franchise_brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  entry_number VARCHAR(50) NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  memo TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'reversed')),
  source_type VARCHAR(40) NOT NULL CHECK (source_type IN (
    'manual', 'payment_voucher', 'petty_cash_voucher', 'customer_order_revenue',
    'customer_order_cash', 'customer_order_cogs', 'delivery_receipt', 'material_movement',
    'fixed_asset_movement', 'material_cycle_count', 'product_cycle_count', 'reversal',
    'opening_balance', 'year_end_close', 'payroll_run_accrual', 'payroll_run_payment',
    'intercompany_transfer', 'intercompany_transfer_settlement', 'production_batch',
    'staff_advance_disbursement', 'material_transfer',
    'factory_material_release', 'factory_wip_adjustment',
    'product_opening_stock', 'product_stock_adjustment')),
  source_id UUID,
  posted_at TIMESTAMPTZ,
  posted_by VARCHAR(120),
  reverses_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  created_by VARCHAR(120),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, entry_number)
);

CREATE TABLE IF NOT EXISTS accounting_journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES accounting_journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
  line_no INTEGER NOT NULL DEFAULT 1,
  debit DECIMAL(14,2) NOT NULL DEFAULT 0,
  credit DECIMAL(14,2) NOT NULL DEFAULT 0,
  memo TEXT,
  voucher_line_id UUID,   -- FK -> accounting_voucher_lines added in Section 11
  franchise_brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  franchise_brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  voucher_type VARCHAR(20) NOT NULL CHECK (voucher_type IN ('payment', 'petty_cash')),
  voucher_number VARCHAR(50) NOT NULL,
  voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
  department VARCHAR(100),
  requested_by VARCHAR(120),
  prepared_by VARCHAR(120),
  payee_name VARCHAR(200),
  payment_for TEXT,
  payee_kind VARCHAR(40) CHECK (payee_kind IS NULL OR payee_kind IN (
    'supplier', 'reimbursement', 'petty_cash_replenishment', 'invoice', 'payroll', 'intercompany', 'other')),
  payment_mode VARCHAR(20) CHECK (payment_mode IS NULL OR payment_mode IN ('cash', 'check', 'bank_gcash')),
  bank_account_id UUID REFERENCES accounting_bank_accounts(id) ON DELETE SET NULL,
  check_number VARCHAR(80),
  check_date DATE,
  bank_ref_number VARCHAR(80),
  bank_ref_date DATE,
  received_by VARCHAR(120),
  purpose TEXT,
  amount_requested DECIMAL(12,2) DEFAULT 0,
  amount_released DECIMAL(12,2) DEFAULT 0,
  date_released DATE,
  actual_expense DECIMAL(12,2),
  cash_advance DECIMAL(12,2),
  excess_returned DECIMAL(12,2),
  additional_reimbursement DECIMAL(12,2),
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  liquidated_at TIMESTAMPTZ,
  prepared_by_name VARCHAR(120),
  requestor_name VARCHAR(120),
  approved_by_name VARCHAR(120),
  approved_by_title VARCHAR(120),
  liquidated_by_name VARCHAR(120),
  liquidated_by_title VARCHAR(120),
  has_or BOOLEAN DEFAULT FALSE,
  has_si BOOLEAN DEFAULT FALSE,
  has_dr BOOLEAN DEFAULT FALSE,
  has_transport_receipt BOOLEAN DEFAULT FALSE,
  has_po BOOLEAN DEFAULT FALSE,
  has_invoice BOOLEAN DEFAULT FALSE,
  has_receiving_report BOOLEAN DEFAULT FALSE,
  supporting_docs_other TEXT,
  notes TEXT,
  proof_of_payment_url TEXT,
  journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ,
  created_by VARCHAR(120),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (voucher_type, voucher_number)
);

CREATE TABLE IF NOT EXISTS accounting_voucher_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES accounting_vouchers(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL DEFAULT '',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  reference_doc VARCHAR(120),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  debit_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  franchise_brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting_voucher_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES accounting_vouchers(id) ON DELETE CASCADE,
  source_type VARCHAR(40) NOT NULL CHECK (source_type IN (
    'po_payment', 'purchase_order', 'delivery_receipt', 'customer_order',
    'payroll_deduction_refund', 'payroll_run_brand_total', 'supplier', 'supplier_invoice',
    'intercompany_transfer')),
  source_id UUID NOT NULL,
  link_role VARCHAR(20) NOT NULL DEFAULT 'primary' CHECK (link_role IN ('primary', 'supporting')),
  attachment_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting_voucher_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  company_name VARCHAR(200) DEFAULT 'GILNAKS',
  company_address TEXT DEFAULT 'Lapu-lapu City, Cebu',
  approved_by_name VARCHAR(120) DEFAULT 'WENDELLIN C. NAKILA',
  approved_by_title VARCHAR(120) DEFAULT 'Accounting Manager',
  petty_cash_custodian_name VARCHAR(120) DEFAULT 'John Gilbert G. Nakila',
  petty_cash_custodian_title VARCHAR(200) DEFAULT 'Procurement Manager / Petty Cash Custodian',
  liquidated_by_name VARCHAR(120) DEFAULT 'WENDELLIN C. NAKILA',
  liquidated_by_title VARCHAR(120) DEFAULT 'Accounting Manager',
  pv_number_prefix VARCHAR(20) DEFAULT 'PV',
  pcv_number_prefix VARCHAR(20) DEFAULT 'PCV',
  pv_next_seq INTEGER DEFAULT 1,
  pcv_next_seq INTEGER DEFAULT 1,
  petty_cash_fund_amount DECIMAL(12,2) DEFAULT 5000,
  je_number_prefix VARCHAR(20) DEFAULT 'JE',
  je_next_seq INTEGER DEFAULT 1,
  default_cash_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_cash_customer_order_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_cash_payment_voucher_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_cash_payroll_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_cash_staff_advance_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_ap_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_ar_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_sales_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_delivery_income_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_inventory_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_wip_factory_materials_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_finished_goods_inventory_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_petty_cash_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_inventory_variance_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_damaged_goods_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_payroll_expense_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_accrued_payroll_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_staff_advance_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_intercompany_sales_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_intercompany_cogs_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_due_to_gfc_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  coa_seeded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id)
);

CREATE TABLE IF NOT EXISTS accounting_gl_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounting_accounts(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES accounting_periods(id) ON DELETE CASCADE,
  debit_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  credit_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, period_id)
);

CREATE TABLE IF NOT EXISTS accounting_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  account_last4 VARCHAR(4),
  gl_account_id UUID NOT NULL REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting_bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES accounting_bank_accounts(id) ON DELETE CASCADE,
  statement_date DATE NOT NULL,
  statement_ending_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  book_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  reconciled_by VARCHAR(120),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting_bank_reconciliation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID NOT NULL REFERENCES accounting_bank_reconciliations(id) ON DELETE CASCADE,
  voucher_id UUID REFERENCES accounting_vouchers(id) ON DELETE SET NULL,
  journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  description TEXT,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  is_cleared BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting_petty_cash_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fund_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  cash_on_hand DECIMAL(12,2) NOT NULL DEFAULT 0,
  pcv_expenses_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  variance DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  counted_by VARCHAR(120),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting_year_end_closes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  journal_entry_id UUID NOT NULL REFERENCES accounting_journal_entries(id) ON DELETE RESTRICT,
  closed_at TIMESTAMPTZ DEFAULT NOW(),
  closed_by VARCHAR(120),
  UNIQUE (brand_id, fiscal_year)
);

CREATE TABLE IF NOT EXISTS accounting_posting_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  source_type VARCHAR(40) NOT NULL,
  source_id UUID NOT NULL,
  error_message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS fixed_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  asset_name VARCHAR(200) NOT NULL,
  sku VARCHAR(100),
  category VARCHAR(100),
  unit VARCHAR(50) NOT NULL DEFAULT 'unit',
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  location VARCHAR(200),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, asset_name)
);

CREATE TABLE IF NOT EXISTS fixed_asset_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixed_asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  quantity DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(12,2),
  reference_type VARCHAR(50),
  reference_id UUID,
  reference_number VARCHAR(100),
  notes TEXT,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by VARCHAR(100),
  journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- SECTION 7. FACTORY / PRODUCTION
-- =====================================================================

CREATE TABLE IF NOT EXISTS production_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  quantity_required INTEGER NOT NULL DEFAULT 0,
  batch_number VARCHAR(50) NOT NULL,
  notes TEXT,
  allow_override BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'cancelled')),
  for_brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, schedule_date, for_brand_id)
);

CREATE TABLE IF NOT EXISTS production_sticker_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES production_schedules(id) ON DELETE SET NULL,
  batch_number VARCHAR(50) NOT NULL,
  manufacture_date DATE NOT NULL,
  serial_number VARCHAR(50) UNIQUE,
  produced_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_material_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  quantity_used NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (quantity_used >= 0 AND quantity_used <= quantity),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'released', 'cancelled')),
  notes TEXT,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  released_at TIMESTAMPTZ,
  requested_by VARCHAR(100),
  released_by VARCHAR(100),
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  schedule_date DATE,
  journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_opened_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  label TEXT,
  quantity_opened DECIMAL(12,4) NOT NULL CHECK (quantity_opened > 0),
  quantity_remaining DECIMAL(12,4) NOT NULL CHECK (quantity_remaining >= 0),
  unit TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'depleted', 'discarded')),
  inventory_kind TEXT NOT NULL DEFAULT 'ingredients' CHECK (inventory_kind IN ('ingredients', 'packaging', 'supplies')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_by TEXT,
  notes TEXT,
  factory_request_id UUID REFERENCES factory_material_requests(id) ON DELETE SET NULL,
  journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT factory_opened_remaining_lte_opened CHECK (quantity_remaining <= quantity_opened)
);

CREATE TABLE IF NOT EXISTS factory_production_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES production_schedules(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  batch_number TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 1 CHECK (units > 0),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_by TEXT,
  completed_at TIMESTAMPTZ,
  journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  intercompany_transfer_id UUID,   -- FK -> intercompany_transfers added in Section 11
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_batch_material_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES factory_production_batches(id) ON DELETE CASCADE,
  opened_material_id UUID REFERENCES factory_opened_materials(id) ON DELETE SET NULL,
  material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  quantity_used NUMERIC(12,4) NOT NULL CHECK (quantity_used > 0),
  unit TEXT NOT NULL,
  unit_cost DECIMAL(12,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_daily_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_date DATE NOT NULL,
  staff_registration_id UUID NOT NULL REFERENCES staff_registrations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (work_date, staff_registration_id)
);

CREATE TABLE IF NOT EXISTS factory_sticker_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES production_schedules(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  quantity_fulfilled INTEGER NOT NULL DEFAULT 0 CHECK (quantity_fulfilled >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  requested_by TEXT,
  notes TEXT,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT factory_sticker_requests_fulfilled_lte_qty CHECK (quantity_fulfilled <= quantity)
);

-- =====================================================================
-- SECTION 8. PAYROLL
-- =====================================================================

CREATE TABLE IF NOT EXISTS payroll_deductions_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff_registrations(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  utilities DECIMAL(10,2) DEFAULT 0,
  shortages DECIMAL(10,2) DEFAULT 0,
  cash_advances DECIMAL(10,2) DEFAULT 0,
  penalties DECIMAL(10,2) DEFAULT 0,
  others DECIMAL(10,2) DEFAULT 0,
  refunds DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (staff_id, week_start_date, week_end_date)
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'approved', 'accrued', 'paid', 'void')),
  calculated_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  accrued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_by VARCHAR(120),
  approved_by VARCHAR(120),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (week_start_date, week_end_date)
);

CREATE TABLE IF NOT EXISTS payroll_run_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff_registrations(id) ON DELETE RESTRICT,
  hourly_rate_snapshot DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  regular_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  overtime_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  double_pay_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  special_pay_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  regular_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  overtime_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  double_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  special_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  gross_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  deductions_refund_id UUID REFERENCES payroll_deductions_refunds(id) ON DELETE SET NULL,
  utilities DECIMAL(10,2) NOT NULL DEFAULT 0,
  shortages DECIMAL(10,2) NOT NULL DEFAULT 0,
  cash_advances DECIMAL(10,2) NOT NULL DEFAULT 0,
  penalties DECIMAL(10,2) NOT NULL DEFAULT 0,
  others DECIMAL(10,2) NOT NULL DEFAULT 0,
  refunds DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  incentive_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (payroll_run_id, staff_id)
);

CREATE TABLE IF NOT EXISTS payroll_run_brand_totals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  gross_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
  refunds DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  withholdings_other DECIMAL(12,2) NOT NULL DEFAULT 0,
  cash_advances_withheld DECIMAL(12,2) NOT NULL DEFAULT 0,
  journal_entry_id_accrual UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  journal_entry_id_payment UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  payment_voucher_id UUID REFERENCES accounting_vouchers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (payroll_run_id, brand_id)
);

-- =====================================================================
-- SECTION 9. GFC INTERCOMPANY / TRANSFERS / ATTENDANCE
-- =====================================================================

CREATE TABLE IF NOT EXISTS gfc_attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_no INT NOT NULL,
  terminal_no INT,
  verify_mode INT,
  device_name TEXT NOT NULL,
  work_date DATE NOT NULL,
  punch_at TIMESTAMPTZ NOT NULL,
  staff_registration_id UUID REFERENCES staff_registrations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (enrollment_no, punch_at)
);

CREATE TABLE IF NOT EXISTS gfc_attendance_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_registration_id UUID NOT NULL REFERENCES staff_registrations(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  break_hours NUMERIC(4, 2) NOT NULL DEFAULT 0 CHECK (break_hours >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_registration_id, work_date)
);

CREATE TABLE IF NOT EXISTS staff_advance_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff_registrations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  voucher_id UUID REFERENCES accounting_vouchers(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  amount_recovered DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (amount_recovered >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'partial', 'recovered', 'void')),
  disbursed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intercompany_brand_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  retail_brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  due_from_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  due_to_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (factory_brand_id, retail_brand_id)
);

CREATE TABLE IF NOT EXISTS intercompany_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number VARCHAR(40) NOT NULL,
  from_brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  to_brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'void')),
  transfer_price_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  cost_amount_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  margin_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  journal_entry_id_from UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  journal_entry_id_to UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  created_by VARCHAR(120),
  posted_at TIMESTAMPTZ,
  posted_by VARCHAR(120),
  settled_at TIMESTAMPTZ,
  settled_by VARCHAR(120),
  settlement_journal_entry_id_from UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  settlement_journal_entry_id_to UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (from_brand_id, transfer_number)
);

CREATE TABLE IF NOT EXISTS intercompany_transfer_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES intercompany_transfers(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL DEFAULT 1,
  source_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  dest_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  sku VARCHAR(100),
  description VARCHAR(300),
  quantity DECIMAL(14,4) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(14,4) NOT NULL DEFAULT 0,
  unit_price DECIMAL(14,4) NOT NULL DEFAULT 0,
  line_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  line_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number VARCHAR(40) NOT NULL,
  from_brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  to_brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'void')),
  cost_amount_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  journal_entry_id_from UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  journal_entry_id_to UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  created_by VARCHAR(120),
  posted_at TIMESTAMPTZ,
  posted_by VARCHAR(120),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (from_brand_id, transfer_number)
);

CREATE TABLE IF NOT EXISTS material_transfer_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES material_transfers(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL DEFAULT 1,
  source_material_id UUID REFERENCES raw_materials(id) ON DELETE SET NULL,
  dest_material_id UUID REFERENCES raw_materials(id) ON DELETE SET NULL,
  sku VARCHAR(100),
  description VARCHAR(300),
  quantity DECIMAL(14,4) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(14,4) NOT NULL DEFAULT 0,
  line_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gfc_material_legacy_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  gfc_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  legacy_brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  migrated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (legacy_material_id)
);

-- =====================================================================
-- SECTION 10. RECONSTRUCTED-FROM-APP-USAGE TABLES (MISSING from repo SQL)
-- VERIFY column TYPES against the live DB; these are best-effort.
-- =====================================================================

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT,                       -- e.g. 'general', 'notice'
  staff_registration_id UUID REFERENCES staff_registrations(id) ON DELETE CASCADE,  -- NULL = broadcast
  created_by TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTE: staff_codes table removed — the StaffCodeManager component that used it
-- is dead code (not mounted anywhere) and the table never existed in live.

-- =====================================================================
-- SECTION 11. DEFERRED / CROSS / LATE FOREIGN KEYS + ADD-COLUMN CONVERGENCE
-- For existing DBs that predate later migrations: add any missing columns,
-- then add cross-table FKs only if absent. All guarded → safe to re-run.
-- =====================================================================

-- 11a. ADD COLUMN IF NOT EXISTS for columns introduced by later migrations
--      and for the MISSING (app-used) columns. (Fresh installs already have
--      them from the CREATEs above; this converges partially-migrated DBs.)
ALTER TABLE brands ADD COLUMN IF NOT EXISTS brand_role VARCHAR(20) NOT NULL DEFAULT 'retail';

ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_remote BOOLEAN DEFAULT FALSE;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_factory_floor BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS can_access_order_features BOOLEAN DEFAULT FALSE;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS incentive_regular_sales_threshold DECIMAL(12,2);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS incentive_holiday_sales_threshold DECIMAL(12,2);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS incentive_base_amount DECIMAL(12,2);

ALTER TABLE products ADD COLUMN IF NOT EXISTS minimum_stock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bom_quantity_mode TEXT NOT NULL DEFAULT 'unit';
ALTER TABLE products ADD COLUMN IF NOT EXISTS bom_yield_per_batch DECIMAL(12,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS linked_material_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS material_inventory_uom VARCHAR(20);

ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS owner TEXT[] DEFAULT '{}'::text[];
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS uom_base_unit VARCHAR(50);
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS uom_base_per_unit DECIMAL(12,4) DEFAULT 1;
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS uom_purchase_unit VARCHAR(50);
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS uom_stock_per_purchase DECIMAL(12,4) DEFAULT 1;
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS factory_bom_uom VARCHAR(20);
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS factory_request_uom VARCHAR(20);
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS factory_inventory_kind TEXT;
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS linked_product_id UUID;

ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS deposit_slip_uploaded_at TIMESTAMPTZ;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS freight_fee NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS bill_of_lading_url TEXT;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS returnable_pans_image_url TEXT;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS journal_entry_id_revenue UUID;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS journal_entry_id_cash UUID;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS journal_entry_id_cogs UUID;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS collection_bank_account_id UUID REFERENCES accounting_bank_accounts(id) ON DELETE SET NULL;

ALTER TABLE staff_registrations ADD COLUMN IF NOT EXISTS total_warnings INTEGER DEFAULT 0;
ALTER TABLE staff_registrations ADD COLUMN IF NOT EXISTS leave_balance INTEGER DEFAULT 10;
ALTER TABLE staff_registrations ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) DEFAULT 0;
ALTER TABLE staff_registrations ADD COLUMN IF NOT EXISTS employment_date DATE;

ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS hours DECIMAL(4,1) DEFAULT 11.0;
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS day_type VARCHAR(20) DEFAULT 'default';
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS is_absent BOOLEAN DEFAULT FALSE;
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS hours_manual_override BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 0;

ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS material_id UUID;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS fixed_asset_id UUID;

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_account_name VARCHAR(200);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_account_number VARCHAR(100);
ALTER TABLE purchase_orders ALTER COLUMN supplier_id DROP NOT NULL;

ALTER TABLE delivery_receipts ADD COLUMN IF NOT EXISTS journal_entry_id UUID;
ALTER TABLE material_stock_movements ADD COLUMN IF NOT EXISTS journal_entry_id UUID;
ALTER TABLE material_cycle_counts ADD COLUMN IF NOT EXISTS journal_entry_id UUID;
ALTER TABLE product_cycle_counts ADD COLUMN IF NOT EXISTS journal_entry_id UUID;
ALTER TABLE product_cycle_counts ADD COLUMN IF NOT EXISTS category_scope TEXT;

ALTER TABLE production_schedules ADD COLUMN IF NOT EXISTS for_brand_id UUID;
ALTER TABLE factory_production_batches ADD COLUMN IF NOT EXISTS journal_entry_id UUID;
ALTER TABLE factory_production_batches ADD COLUMN IF NOT EXISTS intercompany_transfer_id UUID;
ALTER TABLE factory_material_requests ADD COLUMN IF NOT EXISTS quantity_used NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE factory_material_requests ADD COLUMN IF NOT EXISTS requested_by VARCHAR(100);
ALTER TABLE factory_material_requests ADD COLUMN IF NOT EXISTS released_by VARCHAR(100);
ALTER TABLE factory_opened_materials ADD COLUMN IF NOT EXISTS inventory_kind TEXT NOT NULL DEFAULT 'ingredients';
ALTER TABLE factory_opened_materials ADD COLUMN IF NOT EXISTS factory_request_id UUID;

ALTER TABLE payroll_run_lines ADD COLUMN IF NOT EXISTS incentive_pay DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS match_fingerprint TEXT;
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ;

ALTER TABLE intercompany_transfers ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
ALTER TABLE intercompany_transfers ADD COLUMN IF NOT EXISTS settled_by VARCHAR(120);
ALTER TABLE intercompany_transfers ADD COLUMN IF NOT EXISTS settlement_journal_entry_id_from UUID;
ALTER TABLE intercompany_transfers ADD COLUMN IF NOT EXISTS settlement_journal_entry_id_to UUID;

ALTER TABLE accounting_voucher_settings ADD COLUMN IF NOT EXISTS default_intercompany_sales_account_id UUID;
ALTER TABLE accounting_voucher_settings ADD COLUMN IF NOT EXISTS default_intercompany_cogs_account_id UUID;
ALTER TABLE accounting_voucher_settings ADD COLUMN IF NOT EXISTS default_due_to_gfc_account_id UUID;
ALTER TABLE accounting_voucher_settings ADD COLUMN IF NOT EXISTS default_damaged_goods_account_id UUID;
ALTER TABLE accounting_voucher_settings ADD COLUMN IF NOT EXISTS coa_seeded_at TIMESTAMPTZ;
ALTER TABLE accounting_voucher_settings ADD COLUMN IF NOT EXISTS default_cash_customer_order_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL;
ALTER TABLE accounting_voucher_settings ADD COLUMN IF NOT EXISTS default_cash_payment_voucher_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL;
ALTER TABLE accounting_voucher_settings ADD COLUMN IF NOT EXISTS default_cash_payroll_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL;
ALTER TABLE accounting_voucher_settings ADD COLUMN IF NOT EXISTS default_cash_staff_advance_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL;

ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES staff_registrations(id) ON DELETE SET NULL;
ALTER TABLE fleet_trips ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES staff_registrations(id) ON DELETE SET NULL;
ALTER TABLE fleet_trip_legs ADD COLUMN IF NOT EXISTS departed_at TIMESTAMPTZ;

-- 11b. Cross / circular foreign keys (added only if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_linked_material_id_fkey') THEN
    ALTER TABLE products ADD CONSTRAINT products_linked_material_id_fkey
      FOREIGN KEY (linked_material_id) REFERENCES raw_materials(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_materials_linked_product_id_fkey') THEN
    ALTER TABLE raw_materials ADD CONSTRAINT raw_materials_linked_product_id_fkey
      FOREIGN KEY (linked_product_id) REFERENCES products(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_items_fixed_asset_id_fkey') THEN
    ALTER TABLE purchase_order_items ADD CONSTRAINT purchase_order_items_fixed_asset_id_fkey
      FOREIGN KEY (fixed_asset_id) REFERENCES fixed_assets(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounting_journal_lines_voucher_line_id_fkey') THEN
    ALTER TABLE accounting_journal_lines ADD CONSTRAINT accounting_journal_lines_voucher_line_id_fkey
      FOREIGN KEY (voucher_line_id) REFERENCES accounting_voucher_lines(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_cycle_counts_journal_entry_id_fkey') THEN
    ALTER TABLE product_cycle_counts ADD CONSTRAINT product_cycle_counts_journal_entry_id_fkey
      FOREIGN KEY (journal_entry_id) REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_stock_adjustments_journal_entry_id_fkey') THEN
    ALTER TABLE product_stock_adjustments ADD CONSTRAINT product_stock_adjustments_journal_entry_id_fkey
      FOREIGN KEY (journal_entry_id) REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_cycle_counts_journal_entry_id_fkey') THEN
    ALTER TABLE material_cycle_counts ADD CONSTRAINT material_cycle_counts_journal_entry_id_fkey
      FOREIGN KEY (journal_entry_id) REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_stock_movements_journal_entry_id_fkey') THEN
    ALTER TABLE material_stock_movements ADD CONSTRAINT material_stock_movements_journal_entry_id_fkey
      FOREIGN KEY (journal_entry_id) REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_receipts_journal_entry_id_fkey') THEN
    ALTER TABLE delivery_receipts ADD CONSTRAINT delivery_receipts_journal_entry_id_fkey
      FOREIGN KEY (journal_entry_id) REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_orders_journal_entry_id_revenue_fkey') THEN
    ALTER TABLE customer_orders ADD CONSTRAINT customer_orders_journal_entry_id_revenue_fkey
      FOREIGN KEY (journal_entry_id_revenue) REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;
    ALTER TABLE customer_orders ADD CONSTRAINT customer_orders_journal_entry_id_cash_fkey
      FOREIGN KEY (journal_entry_id_cash) REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;
    ALTER TABLE customer_orders ADD CONSTRAINT customer_orders_journal_entry_id_cogs_fkey
      FOREIGN KEY (journal_entry_id_cogs) REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_schedules_for_brand_id_fkey') THEN
    ALTER TABLE production_schedules ADD CONSTRAINT production_schedules_for_brand_id_fkey
      FOREIGN KEY (for_brand_id) REFERENCES brands(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'factory_production_batches_intercompany_transfer_id_fkey') THEN
    ALTER TABLE factory_production_batches ADD CONSTRAINT factory_production_batches_intercompany_transfer_id_fkey
      FOREIGN KEY (intercompany_transfer_id) REFERENCES intercompany_transfers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================================
-- SECTION 12. SUPPLIER INVOICES (three-way match) — defined after accounting
-- =====================================================================

CREATE TABLE IF NOT EXISTS supplier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  invoice_number VARCHAR(80) NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  attachment_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'matched', 'exception', 'vouchered', 'paid')),
  match_summary JSONB,
  match_fingerprint TEXT,
  matched_at TIMESTAMPTZ,
  payment_voucher_id UUID REFERENCES accounting_vouchers(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, supplier_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS supplier_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id UUID NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  po_item_id UUID NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
  quantity_invoiced DECIMAL(12,4) NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  line_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- SECTION 13. VIEWS
-- =====================================================================

CREATE OR REPLACE VIEW inventory_summary AS
SELECT
  p.id AS product_id,
  p.brand_id,
  p.name AS product_name,
  p.sku,
  p.category,
  p.unit,
  COALESCE(p.price, 0.00) AS price,
  COALESCE(p.initial_stock, 0) AS initial_stock,
  COALESCE(p.production, 0) AS production,
  COALESCE(p.released, 0) AS released,
  COALESCE(p.reserved, 0) AS reserved,
  b.name AS brand_name,
  b.slug AS brand_slug,
  (COALESCE(p.initial_stock, 0) + COALESCE(p.production, 0) - COALESCE(p.released, 0)) AS final_stock,
  (COALESCE(p.initial_stock, 0) + COALESCE(p.production, 0) - COALESCE(p.released, 0) - COALESCE(p.reserved, 0)) AS available_stock,
  p.created_at,
  p.updated_at
FROM products p
JOIN brands b ON p.brand_id = b.id;

CREATE OR REPLACE VIEW materials_stock_view AS
SELECT
  rm.id,
  rm.brand_id,
  rm.supplier_id,
  rm.material_name,
  rm.sku,
  rm.category,
  rm.unit,
  rm.unit_cost,
  rm.minimum_stock,
  rm.current_stock,
  rm.is_active,
  b.name AS brand_name,
  s.name AS supplier_name,
  CASE
    WHEN rm.current_stock <= 0 THEN 'out_of_stock'
    WHEN rm.current_stock <= rm.minimum_stock THEN 'low_stock'
    WHEN rm.current_stock > rm.minimum_stock * 3 THEN 'overstock'
    ELSE 'normal'
  END AS stock_status,
  rm.current_stock * rm.unit_cost AS stock_value,
  rm.created_at,
  rm.updated_at
FROM raw_materials rm
JOIN brands b ON rm.brand_id = b.id
LEFT JOIN suppliers s ON rm.supplier_id = s.id;

CREATE OR REPLACE VIEW po_summary_view AS
SELECT
  po.id,
  po.po_number,
  po.brand_id,
  b.name AS brand_name,
  po.supplier_id,
  s.name AS supplier_name,
  po.order_date,
  po.expected_delivery_date,
  po.status,
  po.total_amount,
  po.paid_amount,
  po.balance_amount,
  po.payment_timing,
  COUNT(poi.id) AS item_count,
  po.created_at
FROM purchase_orders po
JOIN suppliers s ON po.supplier_id = s.id
JOIN brands b ON po.brand_id = b.id
LEFT JOIN purchase_order_items poi ON po.id = poi.po_id
GROUP BY po.id, b.name, s.name;

-- =====================================================================
-- SECTION 14. BUSINESS-LOGIC FUNCTIONS + TRIGGERS (verbatim from migrations)
-- =====================================================================

-- updated_at triggers (shared function defined in Section 0)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'brands','products','locations','customer_orders','suppliers','raw_materials',
    'purchase_requisitions','quotations','purchase_orders','po_payments','delivery_receipts',
    'staff_registrations','staff_schedules','dsir_reports','dsir_sales_inventory',
    'dsir_ice_cream_inventory','dsir_materials_inventory','dsir_discounts','dsir_expenses',
    'dsir_sales_recon','dsir_predefined_items','supplier_invoices','payroll_runs',
    'payroll_deductions_refunds','staff_advance_disbursements',
    'accounting_accounts','accounting_periods','accounting_journal_entries','accounting_vouchers',
    'accounting_voucher_settings','accounting_bank_accounts','accounting_bank_reconciliations',
    'production_schedules','fleet_vehicles','fleet_zones','dsir_store_inventory',
    'module_access_locks'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%1$s_updated_at ON %1$s', t);
    EXECUTE format('CREATE TRIGGER update_%1$s_updated_at BEFORE UPDATE ON %1$s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t);
  END LOOP;
END $$;

-- leave_requests uses its own (functionally identical) trigger function
CREATE OR REPLACE FUNCTION update_leave_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_leave_requests_updated_at ON leave_requests;
CREATE TRIGGER trigger_update_leave_requests_updated_at
  BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION update_leave_requests_updated_at();

-- PO totals
CREATE OR REPLACE FUNCTION update_po_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE purchase_orders
  SET
    subtotal = (SELECT COALESCE(SUM(total_price), 0) FROM purchase_order_items WHERE po_id = COALESCE(NEW.po_id, OLD.po_id)),
    total_amount = (SELECT COALESCE(SUM(total_price), 0) FROM purchase_order_items WHERE po_id = COALESCE(NEW.po_id, OLD.po_id)),
    balance_amount = (
      SELECT COALESCE(SUM(total_price), 0) - COALESCE((SELECT SUM(amount) FROM po_payments WHERE po_id = COALESCE(NEW.po_id, OLD.po_id)), 0)
      FROM purchase_order_items WHERE po_id = COALESCE(NEW.po_id, OLD.po_id)
    )
  WHERE id = COALESCE(NEW.po_id, OLD.po_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_po_totals_insert ON purchase_order_items;
CREATE TRIGGER trigger_update_po_totals_insert AFTER INSERT ON purchase_order_items FOR EACH ROW EXECUTE FUNCTION update_po_totals();
DROP TRIGGER IF EXISTS trigger_update_po_totals_update ON purchase_order_items;
CREATE TRIGGER trigger_update_po_totals_update AFTER UPDATE ON purchase_order_items FOR EACH ROW EXECUTE FUNCTION update_po_totals();
DROP TRIGGER IF EXISTS trigger_update_po_totals_delete ON purchase_order_items;
CREATE TRIGGER trigger_update_po_totals_delete AFTER DELETE ON purchase_order_items FOR EACH ROW EXECUTE FUNCTION update_po_totals();

-- PO balance
CREATE OR REPLACE FUNCTION update_po_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE purchase_orders
  SET
    paid_amount = (SELECT COALESCE(SUM(amount), 0) FROM po_payments WHERE po_id = COALESCE(NEW.po_id, OLD.po_id)),
    balance_amount = total_amount - (SELECT COALESCE(SUM(amount), 0) FROM po_payments WHERE po_id = COALESCE(NEW.po_id, OLD.po_id))
  WHERE id = COALESCE(NEW.po_id, OLD.po_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_po_balance_insert ON po_payments;
CREATE TRIGGER trigger_update_po_balance_insert AFTER INSERT ON po_payments FOR EACH ROW EXECUTE FUNCTION update_po_balance();
DROP TRIGGER IF EXISTS trigger_update_po_balance_update ON po_payments;
CREATE TRIGGER trigger_update_po_balance_update AFTER UPDATE ON po_payments FOR EACH ROW EXECUTE FUNCTION update_po_balance();
DROP TRIGGER IF EXISTS trigger_update_po_balance_delete ON po_payments;
CREATE TRIGGER trigger_update_po_balance_delete AFTER DELETE ON po_payments FOR EACH ROW EXECUTE FUNCTION update_po_balance();

-- PO status history
CREATE OR REPLACE FUNCTION log_po_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO po_status_history (po_id, old_status, new_status, changed_by, notes)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.purchasing_agent,
            'Status changed from ' || COALESCE(OLD.status, 'null') || ' to ' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_po_status ON purchase_orders;
CREATE TRIGGER trigger_log_po_status AFTER UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION log_po_status_change();

-- PO item received qty
CREATE OR REPLACE FUNCTION update_po_item_received()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE purchase_order_items
  SET quantity_received = COALESCE(quantity_received, 0)
    + NEW.quantity_received + COALESCE(NEW.quantity_damaged, 0)
  WHERE id = NEW.po_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_po_item_received ON delivery_receipt_items;
CREATE TRIGGER trigger_update_po_item_received AFTER INSERT ON delivery_receipt_items FOR EACH ROW EXECUTE FUNCTION update_po_item_received();

-- Material stock from movements
CREATE OR REPLACE FUNCTION update_material_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'in' THEN
    UPDATE raw_materials
    SET current_stock = current_stock + NEW.quantity,
        unit_cost = CASE WHEN NEW.unit_cost IS NOT NULL THEN NEW.unit_cost ELSE unit_cost END
    WHERE id = NEW.material_id;
  ELSIF NEW.movement_type = 'out' THEN
    UPDATE raw_materials SET current_stock = current_stock - NEW.quantity WHERE id = NEW.material_id;
  ELSIF NEW.movement_type = 'adjustment' THEN
    UPDATE raw_materials SET current_stock = current_stock + NEW.quantity WHERE id = NEW.material_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_material_stock ON material_stock_movements;
CREATE TRIGGER trigger_update_material_stock AFTER INSERT ON material_stock_movements FOR EACH ROW EXECUTE FUNCTION update_material_stock();

-- Low-stock alerts (writes material_stock_alerts)
CREATE OR REPLACE FUNCTION check_material_stock_level()
RETURNS TRIGGER AS $$
DECLARE
  material_record RECORD;
BEGIN
  SELECT * INTO material_record FROM raw_materials WHERE id = NEW.material_id;
  IF material_record.current_stock <= material_record.minimum_stock AND material_record.current_stock > 0 THEN
    INSERT INTO material_stock_alerts (material_id, alert_type, alert_date)
    SELECT NEW.material_id, 'low_stock', CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM material_stock_alerts WHERE material_id = NEW.material_id AND alert_type = 'low_stock' AND is_resolved = FALSE);
  ELSIF material_record.current_stock <= 0 THEN
    INSERT INTO material_stock_alerts (material_id, alert_type, alert_date)
    SELECT NEW.material_id, 'out_of_stock', CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM material_stock_alerts WHERE material_id = NEW.material_id AND alert_type = 'out_of_stock' AND is_resolved = FALSE);
  ELSE
    UPDATE material_stock_alerts SET is_resolved = TRUE, resolved_date = CURRENT_DATE
    WHERE material_id = NEW.material_id AND alert_type IN ('low_stock', 'out_of_stock') AND is_resolved = FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_material_stock_level ON material_stock_movements;
CREATE TRIGGER trigger_check_material_stock_level AFTER INSERT ON material_stock_movements FOR EACH ROW EXECUTE FUNCTION check_material_stock_level();

-- Delivery receipt -> material movement (purchase->stock unit conversion)
CREATE OR REPLACE FUNCTION create_material_movement_from_delivery()
RETURNS TRIGGER AS $$
DECLARE
  po_item_record RECORD;
  delivery_record RECORD;
  po_record RECORD;
  material_record RECORD;
  stock_per_purchase INTEGER;
  stock_qty DECIMAL(10,2);
  po_unit TEXT;
  purchase_unit TEXT;
  stock_unit TEXT;
BEGIN
  SELECT * INTO po_item_record FROM purchase_order_items WHERE id = NEW.po_item_id;
  IF po_item_record.material_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO material_record FROM raw_materials WHERE id = po_item_record.material_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  stock_per_purchase := GREATEST(1, FLOOR(COALESCE(material_record.uom_stock_per_purchase, 1)));
  po_unit := LOWER(TRIM(COALESCE(po_item_record.unit, '')));
  purchase_unit := LOWER(TRIM(COALESCE(NULLIF(TRIM(material_record.uom_purchase_unit), ''), material_record.unit, '')));
  stock_unit := LOWER(TRIM(COALESCE(material_record.unit, '')));
  IF stock_per_purchase > 1 AND po_unit <> '' AND stock_unit <> '' AND po_unit = stock_unit
     AND (purchase_unit = '' OR po_unit IS DISTINCT FROM purchase_unit) THEN
    stock_qty := NEW.quantity_received;
  ELSE
    stock_qty := NEW.quantity_received * stock_per_purchase;
  END IF;
  SELECT * INTO delivery_record FROM delivery_receipts WHERE id = NEW.delivery_receipt_id;
  SELECT * INTO po_record FROM purchase_orders WHERE id = delivery_record.po_id;
  INSERT INTO material_stock_movements (
    material_id, movement_type, quantity, unit_cost, reference_type, reference_id, reference_number, notes, movement_date, created_by
  ) VALUES (
    po_item_record.material_id, 'in', stock_qty, po_item_record.unit_price, 'delivery_receipt', NEW.delivery_receipt_id, delivery_record.receipt_number,
    'Received from PO: ' || po_record.po_number || ' (' || NEW.quantity_received::TEXT || ' ' || COALESCE(po_item_record.unit, '') || ')' ||
    CASE WHEN NEW.notes IS NOT NULL THEN ' - ' || NEW.notes ELSE '' END,
    delivery_record.delivery_date, delivery_record.received_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_material_movement_from_delivery ON delivery_receipt_items;
CREATE TRIGGER trigger_create_material_movement_from_delivery AFTER INSERT ON delivery_receipt_items FOR EACH ROW EXECUTE FUNCTION create_material_movement_from_delivery();

-- Fixed asset quantity from movements
CREATE OR REPLACE FUNCTION update_fixed_asset_quantity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'in' THEN
    UPDATE fixed_assets
    SET quantity = COALESCE(quantity, 0) + NEW.quantity,
        unit_cost = CASE WHEN NEW.unit_cost IS NOT NULL AND NEW.unit_cost > 0 THEN NEW.unit_cost ELSE unit_cost END,
        updated_at = NOW()
    WHERE id = NEW.fixed_asset_id;
  ELSIF NEW.movement_type = 'out' THEN
    UPDATE fixed_assets SET quantity = COALESCE(quantity, 0) - NEW.quantity, updated_at = NOW() WHERE id = NEW.fixed_asset_id;
  ELSIF NEW.movement_type = 'adjustment' THEN
    UPDATE fixed_assets SET quantity = COALESCE(quantity, 0) + NEW.quantity, updated_at = NOW() WHERE id = NEW.fixed_asset_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_fixed_asset_quantity ON fixed_asset_movements;
CREATE TRIGGER trigger_update_fixed_asset_quantity AFTER INSERT ON fixed_asset_movements FOR EACH ROW EXECUTE FUNCTION update_fixed_asset_quantity();

-- Delivery receipt -> fixed asset movement
CREATE OR REPLACE FUNCTION apply_fixed_asset_from_delivery()
RETURNS TRIGGER AS $$
DECLARE
  po_item_record RECORD;
  delivery_record RECORD;
  po_record RECORD;
BEGIN
  SELECT * INTO po_item_record FROM purchase_order_items WHERE id = NEW.po_item_id;
  IF po_item_record.fixed_asset_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF po_item_record.material_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO delivery_record FROM delivery_receipts WHERE id = NEW.delivery_receipt_id;
  SELECT * INTO po_record FROM purchase_orders WHERE id = delivery_record.po_id;
  INSERT INTO fixed_asset_movements (
    fixed_asset_id, movement_type, quantity, unit_cost, reference_type, reference_id, reference_number, notes, movement_date, created_by
  ) VALUES (
    po_item_record.fixed_asset_id, 'in', NEW.quantity_received, po_item_record.unit_price, 'delivery_receipt', NEW.delivery_receipt_id, delivery_record.receipt_number,
    'Received from PO: ' || po_record.po_number || CASE WHEN NEW.notes IS NOT NULL THEN ' - ' || NEW.notes ELSE '' END,
    delivery_record.delivery_date, delivery_record.received_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_apply_fixed_asset_from_delivery ON delivery_receipt_items;
CREATE TRIGGER trigger_apply_fixed_asset_from_delivery AFTER INSERT ON delivery_receipt_items FOR EACH ROW EXECUTE FUNCTION apply_fixed_asset_from_delivery();

-- Fleet geofence: auto trip/leg lifecycle on location ping insert.
CREATE OR REPLACE FUNCTION check_fleet_geofence()
RETURNS TRIGGER AS $$
DECLARE
  v_zone RECORD;
  v_trip fleet_trips%ROWTYPE;
  v_last_leg RECORD;
  v_dist_m DOUBLE PRECISION;
  v_earth CONSTANT DOUBLE PRECISION := 6371000;
  v_lat_rad DOUBLE PRECISION;
  v_zone_lat_rad DOUBLE PRECISION;
  v_dlat DOUBLE PRECISION;
  v_dlng DOUBLE PRECISION;
  v_a DOUBLE PRECISION;
  v_matched_zone_id UUID := NULL;
  v_matched_is_hq BOOLEAN := FALSE;
  v_prev_arrived TIMESTAMPTZ;
  v_dur_s INT;
  v_next_order INT;
  v_non_hq_count INT;
  v_prev_leg RECORD;
  v_brief_dwell_s INT;
  v_min_zone_dwell_s CONSTANT INT := 120;
BEGIN
  FOR v_zone IN
    SELECT id, lat, lng, radius_m, is_hq
    FROM fleet_zones
    WHERE is_active = TRUE
    ORDER BY is_hq DESC
  LOOP
    v_lat_rad := radians(NEW.lat);
    v_zone_lat_rad := radians(v_zone.lat);
    v_dlat := radians(v_zone.lat - NEW.lat);
    v_dlng := radians(v_zone.lng - NEW.lng);
    v_a := sin(v_dlat / 2) ^ 2
          + cos(v_lat_rad) * cos(v_zone_lat_rad) * sin(v_dlng / 2) ^ 2;
    v_dist_m := 2 * v_earth * asin(sqrt(v_a));

    IF v_dist_m <= v_zone.radius_m THEN
      v_matched_zone_id := v_zone.id;
      v_matched_is_hq := v_zone.is_hq;
      EXIT;
    END IF;
  END LOOP;

  IF v_matched_zone_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_trip
  FROM fleet_trips
  WHERE vehicle_id = NEW.vehicle_id
    AND status = 'in_progress'
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_trip.id IS NOT NULL THEN
    SELECT * INTO v_last_leg
    FROM fleet_trip_legs
    WHERE trip_id = v_trip.id
    ORDER BY leg_order DESC
    LIMIT 1;
  END IF;

  IF v_matched_is_hq AND v_trip.id IS NULL THEN
    INSERT INTO fleet_trips (vehicle_id, driver_id, started_at)
    SELECT NEW.vehicle_id, fv.driver_id, COALESCE(NEW.recorded_at, NOW())
    FROM fleet_vehicles fv
    WHERE fv.id = NEW.vehicle_id
    RETURNING * INTO v_trip;

    INSERT INTO fleet_trip_legs (trip_id, zone_id, leg_order, arrived_at, duration_from_prev_s)
    VALUES (v_trip.id, v_matched_zone_id, 0, COALESCE(NEW.recorded_at, NOW()), NULL);

    RETURN NEW;
  END IF;

  IF v_trip.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_last_leg IS NOT NULL AND v_last_leg.zone_id = v_matched_zone_id THEN
    IF v_last_leg.departed_at IS NOT NULL THEN
      UPDATE fleet_trip_legs
      SET departed_at = NULL
      WHERE id = v_last_leg.id;
    END IF;
    RETURN NEW;
  END IF;

  -- GPS jitter: ignore a brief spurious visit to another zone before returning here.
  IF v_last_leg IS NOT NULL AND v_last_leg.zone_id != v_matched_zone_id THEN
    v_brief_dwell_s := EXTRACT(EPOCH FROM (
      COALESCE(NEW.recorded_at, NOW()) - v_last_leg.arrived_at
    ))::INT;
    IF v_brief_dwell_s >= 0 AND v_brief_dwell_s < v_min_zone_dwell_s THEN
      SELECT * INTO v_prev_leg
      FROM fleet_trip_legs
      WHERE trip_id = v_trip.id
        AND leg_order = v_last_leg.leg_order - 1;

      IF v_prev_leg IS NOT NULL AND v_prev_leg.zone_id = v_matched_zone_id THEN
        DELETE FROM fleet_trip_legs WHERE id = v_last_leg.id;
        UPDATE fleet_trip_legs
        SET departed_at = NULL
        WHERE id = v_prev_leg.id;
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  v_prev_arrived := NULL;
  v_dur_s := NULL;
  IF v_last_leg IS NOT NULL THEN
    v_prev_arrived := v_last_leg.arrived_at;
    v_dur_s := EXTRACT(EPOCH FROM (COALESCE(NEW.recorded_at, NOW()) - v_prev_arrived))::INT;
    IF v_dur_s < 0 THEN v_dur_s := 0; END IF;

    UPDATE fleet_trip_legs
    SET departed_at = COALESCE(NEW.recorded_at, NOW())
    WHERE id = v_last_leg.id
      AND departed_at IS NULL;
  END IF;

  v_next_order := COALESCE(v_last_leg.leg_order, -1) + 1;

  INSERT INTO fleet_trip_legs (trip_id, zone_id, leg_order, arrived_at, duration_from_prev_s)
  VALUES (v_trip.id, v_matched_zone_id, v_next_order, COALESCE(NEW.recorded_at, NOW()), v_dur_s);

  IF v_matched_is_hq THEN
    SELECT COUNT(*) INTO v_non_hq_count
    FROM fleet_trip_legs tl
    JOIN fleet_zones z ON z.id = tl.zone_id
    WHERE tl.trip_id = v_trip.id
      AND z.is_hq = FALSE;

    IF v_non_hq_count > 0 THEN
      UPDATE fleet_trips
      SET status = 'completed',
          completed_at = COALESCE(NEW.recorded_at, NOW())
      WHERE id = v_trip.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_fleet_geofence_check ON fleet_location_pings;
CREATE TRIGGER trg_fleet_geofence_check
  AFTER INSERT ON fleet_location_pings
  FOR EACH ROW
  EXECUTE FUNCTION check_fleet_geofence();

-- =====================================================================
-- SECTION 15. RPC FUNCTIONS (admin / dashboard auth)
-- =====================================================================

DROP FUNCTION IF EXISTS authenticate_dashboard_passcode(TEXT);
CREATE OR REPLACE FUNCTION authenticate_dashboard_passcode(input_passcode TEXT)
RETURNS JSONB AS $$
DECLARE
  found_role TEXT;
  found_username TEXT;
BEGIN
  IF input_passcode IS NULL OR btrim(input_passcode) = '' THEN
    RETURN NULL;
  END IF;
  SELECT ac.username, ac.role INTO found_username, found_role
  FROM admin_credentials ac
  WHERE ac.passcode = btrim(input_passcode) AND ac.is_active = TRUE
  LIMIT 1;
  IF found_role IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object('username', found_username, 'role', found_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION validate_admin_passcode(input_passcode TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF input_passcode IS NULL OR btrim(input_passcode) = '' THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM admin_credentials
    WHERE passcode = btrim(input_passcode) AND is_active = TRUE AND role <> 'guest'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION validate_admin_credentials(input_passcode TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN validate_admin_passcode(input_passcode);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS get_admin_credentials();
CREATE OR REPLACE FUNCTION get_admin_credentials()
RETURNS TABLE(username VARCHAR, role TEXT, is_active BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT ac.username, ac.role, ac.is_active
  FROM admin_credentials ac
  ORDER BY ac.role, ac.username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION authenticate_dashboard_passcode(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION validate_admin_passcode(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION validate_admin_credentials(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_admin_credentials() TO authenticated, anon;

-- Fleet driver location ping RPC (used by driver app and web tracking page).
CREATE OR REPLACE FUNCTION submit_fleet_location_ping(
  input_tracking_token UUID,
  input_lat DOUBLE PRECISION,
  input_lng DOUBLE PRECISION,
  input_accuracy_m DOUBLE PRECISION DEFAULT NULL,
  input_heading DOUBLE PRECISION DEFAULT NULL,
  input_speed_mps DOUBLE PRECISION DEFAULT NULL,
  input_recorded_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_vehicle fleet_vehicles%ROWTYPE;
  v_recorded_at TIMESTAMPTZ;
BEGIN
  IF input_tracking_token IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_token');
  END IF;

  IF input_lat IS NULL OR input_lng IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_coordinates');
  END IF;

  SELECT * INTO v_vehicle
  FROM fleet_vehicles
  WHERE tracking_token = input_tracking_token
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_inactive_vehicle');
  END IF;

  v_recorded_at := COALESCE(input_recorded_at, NOW());

  INSERT INTO fleet_location_pings (
    vehicle_id,
    lat,
    lng,
    accuracy_m,
    heading,
    speed_mps,
    recorded_at
  ) VALUES (
    v_vehicle.id,
    input_lat,
    input_lng,
    input_accuracy_m,
    input_heading,
    input_speed_mps,
    v_recorded_at
  );

  UPDATE fleet_vehicles
  SET
    last_lat = input_lat,
    last_lng = input_lng,
    last_accuracy_m = input_accuracy_m,
    last_heading = input_heading,
    last_speed_mps = input_speed_mps,
    last_seen_at = v_recorded_at,
    updated_at = NOW()
  WHERE id = v_vehicle.id;

  RETURN jsonb_build_object(
    'ok', true,
    'vehicle_id', v_vehicle.id,
    'vehicle_name', v_vehicle.name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION submit_fleet_location_ping(
  UUID,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  TIMESTAMPTZ
) TO authenticated, anon;

-- =====================================================================
-- SECTION 16. INDEXES (non-PK / non-UNIQUE)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_linked_material_id ON products(linked_material_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_location_id ON customer_orders(location_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_brand_id ON customer_orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON customer_orders(status);
CREATE INDEX IF NOT EXISTS idx_customer_orders_created_at ON customer_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_details_order_id ON order_details(order_id);
CREATE INDEX IF NOT EXISTS idx_order_details_product_id ON order_details(product_id);
CREATE INDEX IF NOT EXISTS idx_customer_order_status_history_order_id ON customer_order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_daily_stock_summaries_brand_id ON daily_stock_summaries(brand_id);
CREATE INDEX IF NOT EXISTS idx_daily_stock_summaries_date ON daily_stock_summaries(date);
CREATE INDEX IF NOT EXISTS idx_product_bom_items_product ON product_bom_items(product_id);
CREATE INDEX IF NOT EXISTS idx_product_bom_items_material ON product_bom_items(material_id);
CREATE INDEX IF NOT EXISTS idx_product_category_sort_brand ON product_category_sort(brand_id);
CREATE INDEX IF NOT EXISTS idx_product_cycle_counts_brand_date ON product_cycle_counts(brand_id, count_date DESC);
CREATE INDEX IF NOT EXISTS idx_product_cycle_count_lines_count ON product_cycle_count_lines(cycle_count_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_adjustments_brand ON product_stock_adjustments (brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_stock_adjustments_product ON product_stock_adjustments (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_registrations_staff_code ON staff_registrations(staff_code);
CREATE INDEX IF NOT EXISTS idx_staff_registrations_mobile_number ON staff_registrations(mobile_number);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_location_id ON staff_assignments(location_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_location_date ON staff_schedules(location_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_dsir_reports_location_id ON dsir_reports(location_id);
CREATE INDEX IF NOT EXISTS idx_dsir_reports_date ON dsir_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_dsir_store_inventory_location ON dsir_store_inventory (location_id);
CREATE INDEX IF NOT EXISTS idx_dsir_store_inventory_brand ON dsir_store_inventory (brand_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dsir_store_inv_mov_source_key
  ON dsir_store_inventory_movements (location_id, source_key)
  WHERE source_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dsir_store_inv_mov_location_created
  ON dsir_store_inventory_movements (location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dsir_store_inv_mov_report
  ON dsir_store_inventory_movements (dsir_report_id)
  WHERE dsir_report_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff ON leave_requests(staff_registration_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_admin_credentials_passcode ON admin_credentials(passcode);
CREATE INDEX IF NOT EXISTS idx_admin_credentials_active ON admin_credentials(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_pr_brand_id ON purchase_requisitions(brand_id);
CREATE INDEX IF NOT EXISTS idx_pr_status ON purchase_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_pr_items_pr_id ON purchase_requisition_items(pr_id);
CREATE INDEX IF NOT EXISTS idx_po_brand_id ON purchase_orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_order_date ON purchase_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_material_id ON purchase_order_items(material_id);
CREATE INDEX IF NOT EXISTS idx_po_items_fixed_asset_id ON purchase_order_items(fixed_asset_id);
CREATE INDEX IF NOT EXISTS idx_po_payments_po_id ON po_payments(po_id);
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_po_id ON delivery_receipts(po_id);
CREATE INDEX IF NOT EXISTS idx_delivery_receipt_items_receipt_id ON delivery_receipt_items(delivery_receipt_id);
CREATE INDEX IF NOT EXISTS idx_po_purchaser_templates_brand ON po_purchaser_templates(brand_id);
CREATE INDEX IF NOT EXISTS idx_raw_materials_brand_id ON raw_materials(brand_id);
CREATE INDEX IF NOT EXISTS idx_raw_materials_supplier_id ON raw_materials(supplier_id);
CREATE INDEX IF NOT EXISTS idx_raw_materials_active ON raw_materials(is_active);
CREATE INDEX IF NOT EXISTS idx_raw_materials_owner_gin ON raw_materials USING GIN (owner);
CREATE INDEX IF NOT EXISTS idx_raw_materials_linked_product_id ON raw_materials(linked_product_id);
CREATE INDEX IF NOT EXISTS idx_material_movements_material_id ON material_stock_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_material_movements_date ON material_stock_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_material_alerts_material_id ON material_stock_alerts(material_id);
CREATE INDEX IF NOT EXISTS idx_material_cycle_counts_brand_date ON material_cycle_counts(brand_id, count_date DESC);
CREATE INDEX IF NOT EXISTS idx_material_cycle_count_lines_count ON material_cycle_count_lines(cycle_count_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_brand ON supplier_invoices(brand_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_po ON supplier_invoices(po_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status ON supplier_invoices(status);
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_lines_invoice ON supplier_invoice_lines(supplier_invoice_id);
CREATE INDEX IF NOT EXISTS idx_accounting_accounts_brand ON accounting_accounts(brand_id);
CREATE INDEX IF NOT EXISTS idx_accounting_accounts_type ON accounting_accounts(brand_id, account_type);
CREATE INDEX IF NOT EXISTS idx_accounting_periods_brand ON accounting_periods(brand_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_brand_date ON accounting_journal_entries(brand_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_franchise_date ON accounting_journal_entries(brand_id, franchise_brand_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_status ON accounting_journal_entries(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_journal_posted_source ON accounting_journal_entries(brand_id, source_type, source_id) WHERE status = 'posted' AND source_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_journal_one_opening_balance ON accounting_journal_entries(brand_id) WHERE source_type = 'opening_balance' AND status = 'posted';
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_entry ON accounting_journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_account ON accounting_journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_franchise ON accounting_journal_lines(franchise_brand_id) WHERE franchise_brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_location ON accounting_journal_lines(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_vouchers_brand ON accounting_vouchers(brand_id);
CREATE INDEX IF NOT EXISTS idx_accounting_vouchers_franchise ON accounting_vouchers(brand_id, franchise_brand_id);
CREATE INDEX IF NOT EXISTS idx_accounting_vouchers_status ON accounting_vouchers(status);
CREATE INDEX IF NOT EXISTS idx_accounting_voucher_lines_voucher ON accounting_voucher_lines(voucher_id);
CREATE INDEX IF NOT EXISTS idx_accounting_voucher_links_voucher ON accounting_voucher_links(voucher_id);
CREATE INDEX IF NOT EXISTS idx_accounting_voucher_links_source ON accounting_voucher_links(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_accounting_gl_balances_brand_period ON accounting_gl_balances(brand_id, period_id);
CREATE INDEX IF NOT EXISTS idx_accounting_bank_accounts_brand ON accounting_bank_accounts(brand_id);
CREATE INDEX IF NOT EXISTS idx_bank_recon_items_recon ON accounting_bank_reconciliation_items(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_recon_brand ON accounting_petty_cash_reconciliations(brand_id);
CREATE INDEX IF NOT EXISTS idx_accounting_year_end_closes_brand ON accounting_year_end_closes(brand_id);
CREATE INDEX IF NOT EXISTS idx_accounting_posting_errors_source ON accounting_posting_errors(brand_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_brand ON fixed_assets(brand_id);
CREATE INDEX IF NOT EXISTS idx_fixed_asset_movements_asset ON fixed_asset_movements(fixed_asset_id);
CREATE INDEX IF NOT EXISTS idx_production_schedules_schedule_date ON production_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_production_schedules_product_id ON production_schedules(product_id);
CREATE INDEX IF NOT EXISTS idx_production_schedules_for_brand_date ON production_schedules(for_brand_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_production_sticker_logs_product_id ON production_sticker_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_production_sticker_logs_schedule_id ON production_sticker_logs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_production_sticker_logs_voided_at ON production_sticker_logs(voided_at) WHERE voided_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_factory_production_batches_schedule ON factory_production_batches(schedule_id, work_date);
CREATE INDEX IF NOT EXISTS idx_factory_batch_material_usage_batch ON factory_batch_material_usage(batch_id);
CREATE INDEX IF NOT EXISTS idx_factory_material_requests_status ON factory_material_requests(status);
CREATE INDEX IF NOT EXISTS idx_factory_material_requests_brand_date ON factory_material_requests(brand_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_factory_opened_materials_material ON factory_opened_materials(material_id);
CREATE INDEX IF NOT EXISTS idx_factory_opened_materials_status ON factory_opened_materials(status);
CREATE INDEX IF NOT EXISTS idx_factory_daily_staff_work_date ON factory_daily_staff(work_date);
CREATE INDEX IF NOT EXISTS idx_factory_sticker_requests_schedule_date ON factory_sticker_requests(schedule_date);
CREATE INDEX IF NOT EXISTS idx_factory_sticker_requests_status ON factory_sticker_requests(status);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON payroll_runs(status);
CREATE INDEX IF NOT EXISTS idx_payroll_run_lines_run ON payroll_run_lines(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_run_lines_staff ON payroll_run_lines(staff_id);
CREATE INDEX IF NOT EXISTS idx_payroll_run_brand_totals_run ON payroll_run_brand_totals(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_deductions_refunds_staff_id ON payroll_deductions_refunds(staff_id);
CREATE INDEX IF NOT EXISTS idx_gfc_attendance_logs_work_date ON gfc_attendance_logs(work_date);
CREATE INDEX IF NOT EXISTS idx_gfc_attendance_logs_staff_registration_id ON gfc_attendance_logs(staff_registration_id);
CREATE INDEX IF NOT EXISTS idx_gfc_attendance_breaks_work_date ON gfc_attendance_breaks(work_date);
CREATE INDEX IF NOT EXISTS idx_gfc_attendance_breaks_staff_registration_id ON gfc_attendance_breaks(staff_registration_id);
CREATE INDEX IF NOT EXISTS idx_staff_advance_disbursements_staff ON staff_advance_disbursements(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_advance_disbursements_status ON staff_advance_disbursements(status);
CREATE INDEX IF NOT EXISTS idx_intercompany_brand_settings_factory ON intercompany_brand_settings(factory_brand_id);
CREATE INDEX IF NOT EXISTS idx_intercompany_transfers_from ON intercompany_transfers(from_brand_id);
CREATE INDEX IF NOT EXISTS idx_intercompany_transfers_to ON intercompany_transfers(to_brand_id);
CREATE INDEX IF NOT EXISTS idx_intercompany_transfer_lines_transfer ON intercompany_transfer_lines(transfer_id);
CREATE INDEX IF NOT EXISTS idx_material_transfers_from ON material_transfers(from_brand_id);
CREATE INDEX IF NOT EXISTS idx_material_transfer_lines_transfer ON material_transfer_lines(transfer_id);
CREATE INDEX IF NOT EXISTS idx_gfc_material_legacy_gfc ON gfc_material_legacy_mapping(gfc_material_id);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_active ON fleet_vehicles (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_fleet_location_pings_vehicle_recorded ON fleet_location_pings (vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_zones_active ON fleet_zones (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_fleet_trips_vehicle_status ON fleet_trips (vehicle_id, status);
CREATE INDEX IF NOT EXISTS idx_fleet_trip_legs_trip ON fleet_trip_legs (trip_id, leg_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_module_access_locks_target
  ON module_access_locks (module_key, COALESCE(sub_tab_key, ''));

-- =====================================================================
-- SECTION 17. STORAGE BUCKETS + POLICIES
-- NOTE: the app uses BOTH 'deposit-slips' and 'deposit_slips' (bug — see audit).
-- Both are created here so neither path breaks; standardize in app code later.
-- =====================================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('delivery_receipts', 'delivery_receipts', true),
  ('payment_receipts', 'payment_receipts', true),
  ('supplier_invoices', 'supplier_invoices', true),
  ('returnable_pans', 'returnable_pans', true),
  ('deposit-slips', 'deposit-slips', true),
  ('deposit_slips', 'deposit_slips', true)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['delivery_receipts','payment_receipts','supplier_invoices','returnable_pans','deposit-slips','deposit_slips'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow public uploads to %1$s bucket" ON storage.objects', b);
    EXECUTE format('CREATE POLICY "Allow public uploads to %1$s bucket" ON storage.objects FOR INSERT WITH CHECK (bucket_id = %2$L)', b, b);
    EXECUTE format('DROP POLICY IF EXISTS "Allow public reads from %1$s bucket" ON storage.objects', b);
    EXECUTE format('CREATE POLICY "Allow public reads from %1$s bucket" ON storage.objects FOR SELECT USING (bucket_id = %2$L)', b, b);
    EXECUTE format('DROP POLICY IF EXISTS "Allow public updates to %1$s bucket" ON storage.objects', b);
    EXECUTE format('CREATE POLICY "Allow public updates to %1$s bucket" ON storage.objects FOR UPDATE USING (bucket_id = %2$L)', b, b);
    EXECUTE format('DROP POLICY IF EXISTS "Allow public deletes from %1$s bucket" ON storage.objects', b);
    EXECUTE format('CREATE POLICY "Allow public deletes from %1$s bucket" ON storage.objects FOR DELETE USING (bucket_id = %2$L)', b, b);
  END LOOP;
END $$;

-- =====================================================================
-- SECTION 18. ROW LEVEL SECURITY (permissive "Allow all", matching repo posture)
-- leave_requests intentionally has RLS DISABLED (handled separately).
-- =====================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'brands','products','locations','customer_orders','order_details','customer_order_status_history',
    'daily_stock_summaries','product_bom_items','product_category_sort','product_cycle_counts',
    'product_cycle_count_lines','staff_registrations','staff_assignments','staff_schedules',
    'announcements','dsir_reports','dsir_sales_inventory','dsir_ice_cream_inventory','dsir_materials_inventory',
    'dsir_discounts','dsir_expenses','dsir_sales_recon','dsir_predefined_items',
    'dsir_store_inventory','dsir_store_inventory_movements','product_stock_adjustments',
    'suppliers','purchase_requisitions','purchase_requisition_items','quotations','quotation_items',
    'purchase_orders','purchase_order_items','po_payments','delivery_receipts','delivery_receipt_items',
    'po_status_history','po_purchaser_templates','raw_materials','material_stock_movements','material_stock_alerts',
    'material_cycle_counts','material_cycle_count_lines','supplier_invoices','supplier_invoice_lines',
    'accounting_accounts','accounting_periods','accounting_journal_entries','accounting_journal_lines',
    'accounting_vouchers','accounting_voucher_lines','accounting_voucher_links','accounting_voucher_settings',
    'accounting_gl_balances','accounting_bank_accounts','accounting_bank_reconciliations',
    'accounting_bank_reconciliation_items','accounting_petty_cash_reconciliations','accounting_year_end_closes',
    'accounting_posting_errors','fixed_assets','fixed_asset_movements',
    'production_schedules','production_sticker_logs','factory_production_batches','factory_batch_material_usage',
    'factory_material_requests','factory_opened_materials','factory_daily_staff','factory_sticker_requests',
    'payroll_runs','payroll_run_lines','payroll_run_brand_totals','payroll_deductions_refunds',
    'gfc_attendance_logs','gfc_attendance_breaks','staff_advance_disbursements','intercompany_brand_settings','intercompany_transfers',
    'intercompany_transfer_lines','material_transfers','material_transfer_lines','gfc_material_legacy_mapping',
    'fleet_vehicles','fleet_location_pings','fleet_zones','fleet_trips','fleet_trip_legs',
    'module_access_locks'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all on %s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "Allow all on %s" ON %I FOR ALL USING (true)', t, t);
  END LOOP;
END $$;

ALTER TABLE leave_requests DISABLE ROW LEVEL SECURITY;
GRANT ALL ON leave_requests TO authenticated, anon;
GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- Fleet realtime (dashboard live updates).
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE fleet_vehicles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE fleet_location_pings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE fleet_zones;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE fleet_trips;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE fleet_trip_legs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Developer lock access realtime (locks apply without a refresh).
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE module_access_locks;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- admin_credentials uses restrictive policies (not "allow all")
ALTER TABLE admin_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to read admin credentials" ON admin_credentials;
CREATE POLICY "Allow authenticated users to read admin credentials" ON admin_credentials
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow service role to manage admin credentials" ON admin_credentials;
CREATE POLICY "Allow service role to manage admin credentials" ON admin_credentials
  FOR ALL USING (auth.role() = 'service_role');
GRANT SELECT ON admin_credentials TO authenticated, anon;

-- =====================================================================
-- SECTION 19. SEED CHART-OF-ACCOUNTS DEFAULTS (optional, idempotent)
-- =====================================================================
-- The repo seeds COA codes 1150 (Staff Advances), 2110 (Payroll Withholdings),
-- and 5910 (Inventory Variance) / 5920 (Inventory Shrinkage) per brand via the accounting-*-posting migrations.
-- Seeding is data, not schema; run those migrations or seed via the app's
-- "seed chart of accounts" action. Intentionally omitted here to avoid
-- inserting brand-scoped data blindly.

-- =====================================================================
-- =====================================================================
-- OPTIONAL CLEANUP APPENDIX  —  REVIEW BEFORE RUNNING. NOTHING BELOW RUNS
-- AUTOMATICALLY (everything is commented). Confirm row counts on the LIVE
-- database first; some objects have FK/trigger dependencies.
-- =====================================================================
-- =====================================================================
--
-- 1) gfc_product_retail_mapping — should already be gone (dropped by the
--    retail-direct migration). Remove it if it lingers:
-- DROP TABLE IF EXISTS gfc_product_retail_mapping CASCADE;
--
-- 2) quotations / quotation_items — UNUSED by the app (procurement is PR->PO).
--    Blocked by purchase_orders.quotation_id FK. To remove:
-- ALTER TABLE purchase_orders DROP COLUMN IF EXISTS quotation_id;
-- DROP TABLE IF EXISTS quotation_items CASCADE;
-- DROP TABLE IF EXISTS quotations CASCADE;
--
-- 3) material_stock_alerts — UNUSED by the app UI but WRITTEN by the
--    check_material_stock_level() trigger. To remove, drop the trigger first:
-- DROP TRIGGER IF EXISTS trigger_check_material_stock_level ON material_stock_movements;
-- DROP FUNCTION IF EXISTS check_material_stock_level();
-- DROP TABLE IF EXISTS material_stock_alerts CASCADE;
--
-- 4) Redundant duplicate column on accounting_voucher_settings — the app reads
--    intercompany_default_markup_percent; default_intercompany_markup_percent
--    is the older duplicate. Confirm nothing reads it, then:
-- ALTER TABLE accounting_voucher_settings DROP COLUMN IF EXISTS default_intercompany_markup_percent;
--
-- 5) Dead TypeScript type (not a DB object): remove `daily_inventory` from
--    lib/supabase.ts — there is no daily_inventory table; the app uses the
--    inventory_summary view.
--
-- 5b) Verified-unused COLUMNS (never read/written by app code; confirm no
--     trigger/dashboard sets them, then drop). All low-risk:
-- ALTER TABLE purchase_orders     DROP COLUMN IF EXISTS quotation_id;          -- also see (2); type-only
-- ALTER TABLE purchase_orders     DROP COLUMN IF EXISTS actual_delivery_date;  -- type-only, never used
-- ALTER TABLE daily_stock_summaries DROP COLUMN IF EXISTS total_released;      -- never referenced
-- ALTER TABLE production_schedules DROP COLUMN IF EXISTS allow_override;        -- never referenced
-- ALTER TABLE staff_schedules     DROP COLUMN IF EXISTS hours_manual_override; -- in live, never used by app
--
-- 6) App-code cleanup (not SQL): standardize deposit-slip bucket name
--    (deposit-slips vs deposit_slips). See SCHEMA-AUDIT.md.
--    (The dsir_expenses particulars mismatch is already fixed in app code.)
-- =====================================================================
-- END OF CANONICAL SCHEMA
-- =====================================================================
