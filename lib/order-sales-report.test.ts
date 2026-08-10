import assert from 'node:assert/strict'
import { buildOrderSalesReport, formatOrderSalesMatrixCell } from './order-sales-report'

const report = buildOrderSalesReport(
  [
    {
      status: 'fulfilled',
      delivery_type: 'pickup',
      location: { id: 'loc-a', name: 'CEBU', company_owned: false },
      order_details: [
        {
          quantity: 100,
          unit_price: 150,
          products: { id: 'p1', name: 'Ube', sku: 'UBE', category: 'PANS' },
        },
        {
          quantity: 1,
          unit_price: 50,
          products: { id: 'p2', name: 'Spoon Pack', sku: 'SP1', category: 'SPOONS' },
        },
      ],
    },
    {
      status: 'paid',
      delivery_type: 'delivery',
      location: { id: 'loc-b', name: 'SEASIDE', company_owned: false },
      order_details: [
        {
          quantity: 3,
          unit_price: 100,
          products: { id: 'p1', name: 'Ube', sku: 'UBE', category: 'PANS' },
        },
      ],
    },
  ],
  { PANS: 1, SPOONS: 5 },
  { includeFranchiseReceivables: true }
)

assert.deepEqual(report.categories, ['PANS', 'SPOONS'])
assert.equal(report.includeFranchiseReceivables, true)
assert.equal(report.summaryRows.length, 2)
assert.equal(report.summaryRows[0].locationName, 'CEBU')
assert.equal(report.summaryRows[0].amountsByCategory.PANS, 15000)
assert.ok((report.summaryRows[0].franchise?.discount || 0) > 0)
assert.equal(report.summaryRows[0].franchise?.balance, report.summaryRows[0].franchise?.payable)
assert.equal(report.summaryRows[1].franchise?.paidAmt, report.summaryRows[1].franchise?.payable)
assert.equal(report.summaryRows[1].franchise?.balance, 0)
assert.equal(formatOrderSalesMatrixCell(0), '')
assert.equal(formatOrderSalesMatrixCell(200), '200.00')

console.log('order-sales-report ok')
