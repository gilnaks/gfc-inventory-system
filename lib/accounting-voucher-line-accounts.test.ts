import assert from 'node:assert/strict'
import {
  applyDefaultVoucherLineAccounts,
  filterVoucherLineDebitAccounts,
  resolveProcurementPoItemDebitAccountId,
} from './accounting-voucher-line-accounts'
import type { AccountingAccount, AccountingVoucherSettings } from './supabase'

const accounts: AccountingAccount[] = [
  { id: 'cash', brand_id: 'b', code: '1000', name: 'Cash in Bank', account_type: 'asset', normal_balance: 'debit', is_system: true, is_active: true },
  { id: 'pc', brand_id: 'b', code: '1010', name: 'Petty Cash', account_type: 'asset', normal_balance: 'debit', is_system: true, is_active: true },
  { id: 'ar', brand_id: 'b', code: '1100', name: 'Accounts Receivable', account_type: 'asset', normal_balance: 'debit', is_system: true, is_active: true },
  { id: 'due', brand_id: 'b', code: '1111', name: 'Due from Gelatofilipino', account_type: 'asset', normal_balance: 'debit', is_system: false, is_active: true },
  { id: 'adv', brand_id: 'b', code: '1150', name: 'Staff Advances', account_type: 'asset', normal_balance: 'debit', is_system: false, is_active: true },
  { id: 'inv', brand_id: 'b', code: '1200', name: 'Inventory', account_type: 'asset', normal_balance: 'debit', is_system: true, is_active: true },
  { id: 'wip', brand_id: 'b', code: '1210', name: 'WIP', account_type: 'asset', normal_balance: 'debit', is_system: false, is_active: true },
  { id: 'fg', brand_id: 'b', code: '1220', name: 'Finished Goods', account_type: 'asset', normal_balance: 'debit', is_system: false, is_active: true },
  { id: 'prepaid', brand_id: 'b', code: '1300', name: 'Prepaid Expenses', account_type: 'asset', normal_balance: 'debit', is_system: false, is_active: true },
  { id: 'fa', brand_id: 'b', code: '1500', name: 'Fixed Assets', account_type: 'asset', normal_balance: 'debit', is_system: false, is_active: true },
  { id: 'rent', brand_id: 'b', code: '5100', name: 'Rent Expense', account_type: 'expense', normal_balance: 'debit', is_system: false, is_active: true },
  { id: 'proc', brand_id: 'b', code: '5900', name: 'Procurement Expense', account_type: 'expense', normal_balance: 'debit', is_system: false, is_active: true },
  { id: 'pay', brand_id: 'b', code: '5800', name: 'Payroll Expense', account_type: 'expense', normal_balance: 'debit', is_system: false, is_active: true },
] as AccountingAccount[]

const settings = {
  default_inventory_account_id: 'inv',
  default_payroll_expense_account_id: 'pay',
} as AccountingVoucherSettings

function runTests() {
  assert.equal(
    resolveProcurementPoItemDebitAccountId({ material_id: 'm1' }, settings, accounts),
    'inv'
  )
  assert.equal(
    resolveProcurementPoItemDebitAccountId({ fixed_asset_id: 'fa1' }, settings, accounts),
    'fa'
  )
  assert.equal(resolveProcurementPoItemDebitAccountId({}, settings, accounts), 'proc')

  const lines = applyDefaultVoucherLineAccounts(
    [
      { line_no: 1, description: 'Flour', amount: 100, po_id: 'po-1' },
      { line_no: 2, description: 'Oven', amount: 500, po_id: 'po-1' },
    ],
    {
      sourceType: 'supplier_invoice',
      links: [],
      settings,
      accounts,
      poItems: [
        { id: 'i1', po_id: 'po-1', product_description: 'Flour', quantity: 1, unit: 'kg', unit_price: 100, quantity_received: 1, material_id: 'm1' },
        { id: 'i2', po_id: 'po-1', product_description: 'Oven', quantity: 1, unit: 'pc', unit_price: 500, quantity_received: 1, fixed_asset_id: 'fa1' },
      ],
    }
  )
  assert.equal(lines[0].debit_account_id, 'inv')
  assert.equal(lines[1].debit_account_id, 'fa')

  const payroll = applyDefaultVoucherLineAccounts(
    [{ line_no: 1, description: 'Net payroll', amount: 1000 }],
    { sourceType: 'payroll_run_brand_total', links: [], settings, accounts }
  )
  assert.equal(payroll[0].debit_account_id, 'pay')

  const manual = applyDefaultVoucherLineAccounts(
    [{ line_no: 1, description: 'Office supplies', amount: 500 }],
    { sourceType: 'supplier', links: [], settings, accounts }
  )
  assert.equal(manual[0].debit_account_id, undefined)

  const lineDebits = filterVoucherLineDebitAccounts(accounts)
  assert.deepEqual(
    lineDebits.map((a) => a.code),
    ['1150', '1200', '1220', '1300', '1500', '5100', '5800', '5900']
  )
  assert.ok(!lineDebits.some((a) => ['1000', '1010', '1100', '1111', '1210'].includes(a.code)))

  console.log('accounting-voucher-line-accounts: all scenarios passed')
}

runTests()
