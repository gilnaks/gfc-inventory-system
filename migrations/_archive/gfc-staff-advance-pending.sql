-- Staff advances stay pending until the linked PV is marked paid (then open for payroll recovery)

ALTER TABLE staff_advance_disbursements DROP CONSTRAINT IF EXISTS staff_advance_disbursements_status_check;
ALTER TABLE staff_advance_disbursements
  ADD CONSTRAINT staff_advance_disbursements_status_check
  CHECK (status IN ('pending', 'open', 'partial', 'recovered', 'void'));
