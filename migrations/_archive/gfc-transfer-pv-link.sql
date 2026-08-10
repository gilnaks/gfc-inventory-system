-- Allow payment vouchers to link to intercompany transfers

ALTER TABLE accounting_voucher_links DROP CONSTRAINT IF EXISTS accounting_voucher_links_source_type_check;
ALTER TABLE accounting_voucher_links
  ADD CONSTRAINT accounting_voucher_links_source_type_check
  CHECK (source_type IN (
    'po_payment', 'purchase_order', 'delivery_receipt', 'customer_order',
    'payroll_deduction_refund', 'payroll_run_brand_total', 'supplier', 'supplier_invoice',
    'intercompany_transfer'
  ));
