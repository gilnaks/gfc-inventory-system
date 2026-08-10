-- Allow cycle-count (admin physical count) movements on DSIR store inventory ledger.

ALTER TABLE dsir_store_inventory_movements
  DROP CONSTRAINT IF EXISTS dsir_store_inventory_movements_movement_type_check;

ALTER TABLE dsir_store_inventory_movements
  ADD CONSTRAINT dsir_store_inventory_movements_movement_type_check
  CHECK (movement_type IN ('transfer_receive', 'dsir_pull_out', 'cycle_count'));
