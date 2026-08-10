import type { AccountingVoucherSettings } from './supabase'

export type DefaultAccountFieldMeta = {
  key: keyof AccountingVoucherSettings
  label: string
  /** Normal / typical posting side for this mapping. */
  side: 'debit' | 'credit' | 'both'
  /** When this mapping is used in automated posting. */
  usage: string
}

/**
 * Default GL mappings shown in Journal settings → Default accounts.
 * Keys must match columns on accounting_voucher_settings and posting resolvers.
 */
export const DEFAULT_ACCOUNT_FIELDS: DefaultAccountFieldMeta[] = [
  {
    key: 'default_cash_account_id',
    label: 'Cash',
    side: 'both',
    usage: 'Used when no bank account is selected.',
  },
  {
    key: 'default_cash_customer_order_account_id',
    label: 'Cash — orders',
    side: 'debit',
    usage: 'Cash collected from customer orders.',
  },
  {
    key: 'default_cash_payment_voucher_account_id',
    label: 'Cash — payments',
    side: 'credit',
    usage: 'Cash paid on payment vouchers.',
  },
  {
    key: 'default_cash_payroll_account_id',
    label: 'Cash — payroll',
    side: 'credit',
    usage: 'Cash paid for payroll.',
  },
  {
    key: 'default_cash_staff_advance_account_id',
    label: 'Cash — advances',
    side: 'credit',
    usage: 'Cash paid for staff advances.',
  },
  {
    key: 'default_petty_cash_account_id',
    label: 'Petty cash',
    side: 'both',
    usage: 'Petty cash releases and liquidations.',
  },
  {
    key: 'default_ar_account_id',
    label: 'Accounts receivable',
    side: 'both',
    usage: 'Customer sales and collections.',
  },
  {
    key: 'default_ap_account_id',
    label: 'Accounts payable',
    side: 'both',
    usage: 'Supplier bills and payments.',
  },
  {
    key: 'default_sales_account_id',
    label: 'Sales',
    side: 'credit',
    usage: 'Revenue from customer orders.',
  },
  {
    key: 'default_delivery_income_account_id',
    label: 'Delivery income',
    side: 'credit',
    usage: 'Delivery fees on customer orders.',
  },
  {
    key: 'default_inventory_account_id',
    label: 'Inventory',
    side: 'both',
    usage: 'Materials stock, receipts, and COGS.',
  },
  {
    key: 'default_wip_factory_materials_account_id',
    label: 'WIP — materials',
    side: 'both',
    usage: 'Materials moved into production.',
  },
  {
    key: 'default_finished_goods_inventory_account_id',
    label: 'Finished goods',
    side: 'both',
    usage: 'Completed products and stock adjustments.',
  },
  {
    key: 'default_inventory_variance_account_id',
    label: 'Inventory variance',
    side: 'debit',
    usage: 'Cycle count differences.',
  },
  {
    key: 'default_damaged_goods_account_id',
    label: 'Inventory shrinkage',
    side: 'debit',
    usage: 'Damaged or lost inventory.',
  },
  {
    key: 'default_payroll_expense_account_id',
    label: 'Payroll expense',
    side: 'debit',
    usage: 'Payroll cost when accrued or paid.',
  },
  {
    key: 'default_accrued_payroll_account_id',
    label: 'Accrued payroll',
    side: 'credit',
    usage: 'Payroll owed before payment.',
  },
  {
    key: 'default_staff_advance_account_id',
    label: 'Staff advances',
    side: 'both',
    usage: 'Advances given and recovered on payroll.',
  },
  {
    key: 'default_intercompany_cogs_account_id',
    label: 'Intercompany COGS',
    side: 'debit',
    usage: 'GFC cost on transfers to franchise brands.',
  },
  {
    key: 'default_due_to_gfc_account_id',
    label: 'Due to GFC',
    side: 'credit',
    usage: 'Amount franchise brands owe GFC.',
  },
]

export function defaultAccountUsage(key: keyof AccountingVoucherSettings): string | undefined {
  return DEFAULT_ACCOUNT_FIELDS.find((f) => f.key === key)?.usage
}
