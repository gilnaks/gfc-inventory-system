-- Allow payroll as a payment voucher payee category (net payroll disbursements).

ALTER TABLE accounting_vouchers DROP CONSTRAINT IF EXISTS accounting_vouchers_payee_kind_check;

ALTER TABLE accounting_vouchers ADD CONSTRAINT accounting_vouchers_payee_kind_check
  CHECK (payee_kind IS NULL OR payee_kind IN (
    'supplier',
    'reimbursement',
    'petty_cash_replenishment',
    'invoice',
    'payroll',
    'other'
  ));
