import type { AccountingVoucherSettings } from './supabase'

export const REQUIRED_DEFAULT_ACCOUNTS = [
  { key: 'default_cash_account_id', label: 'Cash' },
  { key: 'default_ar_account_id', label: 'Accounts receivable' },
  { key: 'default_ap_account_id', label: 'Accounts payable' },
  { key: 'default_sales_account_id', label: 'Sales' },
  { key: 'default_delivery_income_account_id', label: 'Delivery income' },
  { key: 'default_inventory_account_id', label: 'Inventory' },
  { key: 'default_inventory_variance_account_id', label: 'Inventory variance' },
  { key: 'default_damaged_goods_account_id', label: 'Inventory shrinkage' },
  { key: 'default_petty_cash_account_id', label: 'Petty cash' },
  { key: 'default_payroll_expense_account_id', label: 'Payroll expense' },
  { key: 'default_accrued_payroll_account_id', label: 'Accrued payroll' },
  { key: 'default_staff_advance_account_id', label: 'Staff advances' },
] as const

export type PreflightUnpostedCounts = {
  paymentVouchers: number
  pettyCashVouchers: number
  ordersRevenue: number
  ordersCash: number
  ordersCogs: number
  deliveryReceipts: number
  materialMovements: number
  payrollAccruals: number
  productionBatches: number
  factoryMaterialReleases: number
}

export function missingDefaultAccountLabels(settings: AccountingVoucherSettings): string[] {
  return REQUIRED_DEFAULT_ACCOUNTS.filter(({ key }) => !(settings[key] as string | null | undefined))
    .map(({ label }) => label)
}

export function totalUnpostedCount(unposted: PreflightUnpostedCounts): number {
  return Object.values(unposted).reduce((s, n) => s + n, 0)
}
