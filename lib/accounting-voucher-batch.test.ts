import assert from 'node:assert/strict'
import { voucherLookupKey } from './accounting-voucher-lookup'

function runTests() {
  assert.equal(
    voucherLookupKey({
      sourceType: 'supplier_invoice_ready',
      sourceId: 'inv-1',
      voucherLink: { sourceType: 'supplier_invoice', sourceId: 'inv-1' },
    }),
    'supplier_invoice:inv-1'
  )

  assert.equal(
    voucherLookupKey({
      sourceType: 'supplier_invoice_exception',
      sourceId: 'inv-2',
      voucherLink: { sourceType: 'supplier_invoice', sourceId: 'inv-2' },
    }),
    'supplier_invoice:inv-2'
  )

  assert.equal(
    voucherLookupKey({
      sourceType: 'payroll_run_brand_total',
      sourceId: 'pbt-1',
    }),
    'payroll_run_brand_total:pbt-1'
  )

  assert.equal(
    voucherLookupKey({
      sourceType: 'po_payment',
      sourceId: 'pay-1',
      voucherLink: { sourceType: 'po_payment', sourceId: 'pay-1' },
    }),
    'po_payment:pay-1'
  )

  console.log('accounting-voucher-batch.test.ts: all passed')
}

runTests()
