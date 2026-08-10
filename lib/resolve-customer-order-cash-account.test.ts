import assert from 'node:assert/strict'
import { resolveCustomerOrderCashAccountPure } from './resolve-customer-order-cash-account'
import type { AccountingVoucherSettings } from './supabase'

const brandId = 'brand-1'
const settings = {
  default_cash_account_id: 'cash-default',
  default_cash_customer_order_account_id: 'cash-collections',
} as AccountingVoucherSettings
const bank = { brand_id: brandId, gl_account_id: 'gl-bdo' }

function runTests() {
  assert.equal(
    resolveCustomerOrderCashAccountPure(brandId, settings, null, null),
    'cash-collections'
  )
  assert.equal(
    resolveCustomerOrderCashAccountPure(
      brandId,
      { default_cash_account_id: 'cash-default' } as AccountingVoucherSettings,
      null,
      null
    ),
    'cash-default'
  )
  assert.equal(
    resolveCustomerOrderCashAccountPure(brandId, settings, undefined, null),
    'cash-collections'
  )
  assert.equal(
    resolveCustomerOrderCashAccountPure(brandId, settings, 'bank-1', bank),
    'gl-bdo'
  )

  assert.throws(
    () => resolveCustomerOrderCashAccountPure(brandId, settings, 'bank-1', null),
    /Bank account not found/
  )
  assert.throws(
    () =>
      resolveCustomerOrderCashAccountPure(brandId, settings, 'bank-1', {
        brand_id: 'other',
        gl_account_id: 'gl-bdo',
      }),
    /does not belong/
  )
  assert.throws(
    () =>
      resolveCustomerOrderCashAccountPure(brandId, settings, 'bank-1', {
        brand_id: brandId,
        gl_account_id: '',
      }),
    /no GL account/
  )
  assert.throws(
    () =>
      resolveCustomerOrderCashAccountPure(
        brandId,
        { default_cash_account_id: null } as AccountingVoucherSettings,
        null,
        null
      ),
    /Customer collections cash account/
  )

  console.log('resolve-customer-order-cash-account: all scenarios passed')
}

runTests()
