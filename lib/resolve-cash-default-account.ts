import type { AccountingVoucherSettings } from './supabase'

/** Cash-in-bank JE sources that can have their own default GL. */
export type CashDefaultSource =
  | 'customer_order_cash'
  | 'payment_voucher'
  | 'payroll_run_payment'
  | 'staff_advance_disbursement'

const SOURCE_SETTING_KEY: Record<CashDefaultSource, keyof AccountingVoucherSettings> = {
  customer_order_cash: 'default_cash_customer_order_account_id',
  payment_voucher: 'default_cash_payment_voucher_account_id',
  payroll_run_payment: 'default_cash_payroll_account_id',
  staff_advance_disbursement: 'default_cash_staff_advance_account_id',
}

function asAccountId(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}

/**
 * Per-source cash GL, falling back to shared Cash (`default_cash_account_id`).
 */
export function getCashDefaultAccountId(
  settings: AccountingVoucherSettings | null | undefined,
  source: CashDefaultSource
): string | null {
  if (!settings) return null
  const specific = asAccountId(settings[SOURCE_SETTING_KEY[source]])
  if (specific) return specific
  return asAccountId(settings.default_cash_account_id)
}
