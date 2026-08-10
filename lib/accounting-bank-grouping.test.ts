import assert from 'node:assert/strict'
import { groupCashJournalLines, type CashGlLineInput } from './accounting-bank-grouping'

function runTests() {
  const lines: CashGlLineInput[] = [
    {
      debit: 100,
      credit: 0,
      journal_entry_id: 'je-1',
      journal_entry: {
        id: 'je-1',
        entry_date: '2026-01-15',
        entry_number: 'JE-001',
        memo: 'Deposit',
        source_type: 'customer_order_cash',
        source_id: 'order-1',
      },
    },
    {
      debit: 0,
      credit: 40,
      journal_entry_id: 'je-2',
      journal_entry: {
        id: 'je-2',
        entry_date: '2026-01-16',
        entry_number: 'JE-002',
        memo: 'Payment',
        source_type: 'payment_voucher',
        source_id: 'pv-1',
      },
    },
    {
      debit: 0,
      credit: 10,
      journal_entry_id: 'je-2',
      journal_entry: {
        id: 'je-2',
        entry_date: '2026-01-16',
        entry_number: 'JE-002',
        memo: 'Payment',
        source_type: 'payment_voucher',
        source_id: 'pv-1',
      },
    },
  ]

  const grouped = groupCashJournalLines(lines)
  assert.equal(grouped.length, 2)
  assert.equal(grouped[0].amount, 100)
  assert.equal(grouped[1].amount, -50)
  assert.equal(grouped[1].voucher_id, 'pv-1')

  console.log('accounting-bank-grouping.test.ts: all passed')
}

runTests()
