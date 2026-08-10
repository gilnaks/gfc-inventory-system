-- COGS journal link on fulfilled orders (run after accounting-books.sql)
ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS journal_entry_id_cogs UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;
