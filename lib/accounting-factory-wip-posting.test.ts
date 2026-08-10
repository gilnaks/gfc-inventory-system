import assert from 'node:assert/strict'
import { sumBatchUsageLineCosts } from './factory-batch-usage-cost'
import { formatFactoryWipReclassSummary } from './accounting-factory-wip-reclass-summary'

function runTests() {
  const total = sumBatchUsageLineCosts([
    { quantity_used: 2, unit_cost: 10.5 },
    { quantity_used: 1.5, unit_cost: 4 },
  ])
  assert.equal(total, 27)

  const fallback = sumBatchUsageLineCosts([
    {
      quantity_used: 10,
      unit_cost: null,
      material: {
        unit_cost: 100,
        uom_stock_per_purchase: 4,
      } as never,
    },
  ])
  assert.equal(fallback, 250)

  const reclassSummary = formatFactoryWipReclassSummary({
    releasesReversed: 3,
    releasesReposted: 3,
    batchesReversed: 2,
    batchesReposted: 2,
    skipped: 1,
    errors: [],
  })
  assert.match(reclassSummary, /3 factory releases reclassified/)
  assert.match(reclassSummary, /2 production batches reclassified/)

  console.log('accounting-factory-wip-posting.test.ts: all passed')
}

runTests()
