-- WIP factory inventory: COA settings, cost snapshots, journal links

ALTER TABLE accounting_voucher_settings
  ADD COLUMN IF NOT EXISTS default_wip_factory_materials_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_finished_goods_inventory_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL;

ALTER TABLE factory_batch_material_usage
  ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(12,4);

ALTER TABLE factory_material_requests
  ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;

ALTER TABLE factory_opened_materials
  ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;
