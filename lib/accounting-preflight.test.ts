import assert from 'node:assert/strict'
import {
  missingDefaultAccountLabels,
  totalUnpostedCount,
  type PreflightUnpostedCounts,
} from './accounting-preflight-checks'
import type { AccountingVoucherSettings } from './supabase'

function runTests() {
  const fullSettings = {
    default_cash_account_id: '1',
    default_ar_account_id: '2',
    default_ap_account_id: '3',
    default_sales_account_id: '4',
    default_delivery_income_account_id: '5',
    default_inventory_account_id: '6',
    default_inventory_variance_account_id: '7',
    default_damaged_goods_account_id: '12',
    default_petty_cash_account_id: '8',
    default_payroll_expense_account_id: '9',
    default_accrued_payroll_account_id: '10',
    default_staff_advance_account_id: '11',
  } as AccountingVoucherSettings

  assert.deepEqual(missingDefaultAccountLabels(fullSettings), [])

  const partial = { ...fullSettings, default_cash_account_id: null }
  assert.ok(missingDefaultAccountLabels(partial).includes('Cash'))

  const counts: PreflightUnpostedCounts = {
    paymentVouchers: 1,
    pettyCashVouchers: 2,
    ordersRevenue: 3,
    ordersCash: 0,
    ordersCogs: 1,
    deliveryReceipts: 0,
    materialMovements: 0,
    payrollAccruals: 0,
    productionBatches: 0,
    factoryMaterialReleases: 0,
  }
  assert.equal(totalUnpostedCount(counts), 7)

  console.log('accounting-preflight.test.ts: all passed')
}

runTests()
