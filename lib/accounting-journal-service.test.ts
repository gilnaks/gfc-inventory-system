import assert from 'node:assert/strict'
import { validateBalanced } from './accounting-journal-balance'

function runTests() {
  const balanced = validateBalanced([
    { account_id: 'a', debit: 100, credit: 0 },
    { account_id: 'b', debit: 0, credit: 100 },
  ])
  assert.equal(balanced.ok, true)
  assert.equal(balanced.debit, 100)
  assert.equal(balanced.credit, 100)

  const unbalanced = validateBalanced([
    { account_id: 'a', debit: 100, credit: 0 },
    { account_id: 'b', debit: 0, credit: 50 },
  ])
  assert.equal(unbalanced.ok, false)

  console.log('accounting-journal-service.test.ts: all passed')
}

runTests()
