-- Staff advance disbursements linked to payment vouchers (Dr 1150 / Cr Cash on PV post)

CREATE TABLE IF NOT EXISTS staff_advance_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff_registrations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  voucher_id UUID REFERENCES accounting_vouchers(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  amount_recovered DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (amount_recovered >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'open', 'partial', 'recovered', 'void')),
  disbursed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_advance_disbursements_staff
  ON staff_advance_disbursements(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_advance_disbursements_brand
  ON staff_advance_disbursements(brand_id);
CREATE INDEX IF NOT EXISTS idx_staff_advance_disbursements_status
  ON staff_advance_disbursements(status);

ALTER TABLE staff_advance_disbursements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on staff_advance_disbursements" ON staff_advance_disbursements;
CREATE POLICY "Allow all on staff_advance_disbursements"
  ON staff_advance_disbursements FOR ALL USING (true);

DROP TRIGGER IF EXISTS update_staff_advance_disbursements_updated_at ON staff_advance_disbursements;
CREATE TRIGGER update_staff_advance_disbursements_updated_at
  BEFORE UPDATE ON staff_advance_disbursements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Payee kind for staff advance PVs
ALTER TABLE accounting_vouchers DROP CONSTRAINT IF EXISTS accounting_vouchers_payee_kind_check;
ALTER TABLE accounting_vouchers ADD CONSTRAINT accounting_vouchers_payee_kind_check
  CHECK (payee_kind IS NULL OR payee_kind IN (
    'supplier',
    'reimbursement',
    'petty_cash_replenishment',
    'invoice',
    'payroll',
    'intercompany',
    'staff_advance',
    'other'
  ));

-- Voucher link source for staff advances
ALTER TABLE accounting_voucher_links DROP CONSTRAINT IF EXISTS accounting_voucher_links_source_type_check;
ALTER TABLE accounting_voucher_links
  ADD CONSTRAINT accounting_voucher_links_source_type_check
  CHECK (source_type IN (
    'po_payment', 'purchase_order', 'delivery_receipt', 'customer_order',
    'payroll_deduction_refund', 'payroll_run_brand_total', 'supplier', 'supplier_invoice',
    'intercompany_transfer', 'staff_advance_disbursement'
  ));

-- Journal source type for staff advance disbursements
ALTER TABLE accounting_journal_entries DROP CONSTRAINT IF EXISTS accounting_journal_entries_source_type_check;
ALTER TABLE accounting_journal_entries
  ADD CONSTRAINT accounting_journal_entries_source_type_check
  CHECK (source_type IN (
    'manual', 'payment_voucher', 'petty_cash_voucher', 'customer_order_revenue',
    'customer_order_cash', 'customer_order_cogs', 'delivery_receipt', 'material_movement',
    'fixed_asset_movement', 'material_cycle_count', 'product_cycle_count', 'reversal',
    'opening_balance', 'year_end_close', 'payroll_run_accrual', 'payroll_run_payment',
    'intercompany_transfer', 'intercompany_transfer_settlement', 'production_batch',
    'staff_advance_disbursement'
  ));
