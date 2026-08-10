import assert from 'node:assert/strict'
import { getCashDefaultAccountId } from './resolve-cash-default-account'
import type { AccountingVoucherSettings } from './supabase'

function runTests() {
  const both = {
    default_cash_account_id: 'cash-fallback',
    default_cash_customer_order_account_id: 'cash-collections',
    default_cash_payment_voucher_account_id: null,
  } as AccountingVoucherSettings

  assert.equal(getCashDefaultAccountId(both, 'customer_order_cash'), 'cash-collections')
  assert.equal(getCashDefaultAccountId(both, 'payment_voucher'), 'cash-fallback')
  assert.equal(getCashDefaultAccountId(both, 'payroll_run_payment'), 'cash-fallback')
  assert.equal(getCashDefaultAccountId(null, 'customer_order_cash'), null)
  assert.equal(
    getCashDefaultAccountId(
      { default_cash_account_id: null } as AccountingVoucherSettings,
      'customer_order_cash'
    ),
    null
  )

  console.log('resolve-cash-default-account: all scenarios passed')
}

runTests()
