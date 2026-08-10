import assert from 'node:assert/strict'
import { formatBackfillSummary, type BackfillResult } from './accounting-backfill-summary'

function runTests() {
  const ok: BackfillResult = {
    vouchers: 2,
    ordersRevenue: 5,
    ordersCash: 3,
    ordersCogs: 4,
    deliveries: 1,
    materialMovements: 0,
    payrollAccruals: 0,
    productionBatches: 0,
    factoryMaterialReleases: 0,
    intercompanyTransfers: 0,
    materialTransfers: 0,
    errors: [],
  }
  assert.match(formatBackfillSummary(ok), /2 vouchers/)
  assert.match(formatBackfillSummary(ok), /4 order COGS/)

  const withErrors: BackfillResult = { ...ok, errors: ['Order x: missing BOM'] }
  assert.match(formatBackfillSummary(withErrors), /Errors \(1\)/)

  console.log('accounting-backfill.test.ts: all passed')
}

runTests()
