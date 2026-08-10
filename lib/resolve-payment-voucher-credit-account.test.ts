import assert from 'node:assert/strict'
import { resolvePaymentVoucherCreditAccountPure } from './resolve-payment-voucher-credit-account'

type TestSettings = { default_cash_account_id?: string | null }

const brandId = 'brand-1'
const settings = { default_cash_account_id: 'cash-default' } as TestSettings
const bank = { brand_id: brandId, gl_account_id: 'gl-bdo' }

function runTests() {
  assert.equal(
    resolvePaymentVoucherCreditAccountPure(
      { brand_id: brandId, payment_mode: 'cash', bank_account_id: null, payee_kind: 'supplier' },
      settings,
      null
    ),
    'cash-default'
  )

  assert.equal(
    resolvePaymentVoucherCreditAccountPure(
      { brand_id: brandId, payment_mode: 'cash', bank_account_id: null, payee_kind: 'supplier' },
      {
        default_cash_account_id: 'cash-default',
        default_cash_payment_voucher_account_id: 'cash-pv',
      } as TestSettings,
      null
    ),
    'cash-pv'
  )

  assert.equal(
    resolvePaymentVoucherCreditAccountPure(
      { brand_id: brandId, payment_mode: 'cash', bank_account_id: 'bank-1', payee_kind: 'supplier' },
      settings,
      bank
    ),
    'gl-bdo'
  )

  assert.equal(
    resolvePaymentVoucherCreditAccountPure(
      {
        brand_id: brandId,
        payment_mode: 'bank_gcash',
        bank_account_id: 'bank-1',
        payee_kind: 'supplier',
      },
      settings,
      bank
    ),
    'gl-bdo'
  )

  assert.throws(
    () =>
      resolvePaymentVoucherCreditAccountPure(
        {
          brand_id: brandId,
          payment_mode: 'check',
          bank_account_id: null,
          payee_kind: 'supplier',
        },
        settings,
        null
      ),
    /Select a bank account/
  )

  assert.throws(
    () =>
      resolvePaymentVoucherCreditAccountPure(
        {
          brand_id: brandId,
          payment_mode: 'bank_gcash',
          bank_account_id: 'bank-1',
          payee_kind: 'supplier',
        },
        settings,
        { brand_id: 'other-brand', gl_account_id: 'gl-bdo' }
      ),
    /does not belong to this brand/
  )

  assert.throws(
    () =>
      resolvePaymentVoucherCreditAccountPure(
        { brand_id: brandId, payment_mode: 'cash', bank_account_id: null, payee_kind: 'supplier' },
        { default_cash_account_id: null } as TestSettings,
        null
      ),
    /Payment voucher cash account not configured/
  )

  console.log('resolve-payment-voucher-credit-account: all scenarios passed')
}

runTests()
