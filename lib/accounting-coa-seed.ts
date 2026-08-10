import { supabase } from './supabase'
import type { AccountingAccount, AccountingVoucherSettings } from './supabase'

export type CoaSeedAccount = {
  code: string
  name: string
  account_type: AccountingAccount['account_type']
  normal_balance: 'debit' | 'credit'
  is_system?: boolean
}

export const PH_SME_COA_TEMPLATE: CoaSeedAccount[] = [
  { code: '1000', name: 'Cash in Bank', account_type: 'asset', normal_balance: 'debit', is_system: true },
  { code: '1010', name: 'Petty Cash', account_type: 'asset', normal_balance: 'debit', is_system: true },
  { code: '1100', name: 'Accounts Receivable', account_type: 'asset', normal_balance: 'debit', is_system: true },
  { code: '1150', name: 'Staff Advances', account_type: 'asset', normal_balance: 'debit' },
  { code: '1200', name: 'Inventory', account_type: 'asset', normal_balance: 'debit', is_system: true },
  { code: '1210', name: 'WIP — Factory Materials', account_type: 'asset', normal_balance: 'debit' },
  { code: '1220', name: 'Finished Goods Inventory', account_type: 'asset', normal_balance: 'debit' },
  { code: '1300', name: 'Prepaid Expenses', account_type: 'asset', normal_balance: 'debit' },
  { code: '1500', name: 'Fixed Assets', account_type: 'asset', normal_balance: 'debit' },
  { code: '2000', name: 'Accounts Payable', account_type: 'liability', normal_balance: 'credit', is_system: true },
  { code: '2100', name: 'Accrued Expenses', account_type: 'liability', normal_balance: 'credit' },
  { code: '2110', name: 'Payroll Withholdings', account_type: 'liability', normal_balance: 'credit' },
  { code: '3000', name: "Owner's Capital", account_type: 'equity', normal_balance: 'credit', is_system: true },
  { code: '3100', name: 'Retained Earnings', account_type: 'equity', normal_balance: 'credit', is_system: true },
  { code: '4000', name: 'Sales Revenue', account_type: 'revenue', normal_balance: 'credit', is_system: true },
  { code: '4100', name: 'Delivery Income', account_type: 'revenue', normal_balance: 'credit', is_system: true },
  { code: '5000', name: 'Cost of Goods Sold', account_type: 'expense', normal_balance: 'debit' },
  { code: '5100', name: 'Rent Expense', account_type: 'expense', normal_balance: 'debit' },
  { code: '5200', name: 'Utilities Expense', account_type: 'expense', normal_balance: 'debit' },
  { code: '5300', name: 'Office Supplies Expense', account_type: 'expense', normal_balance: 'debit' },
  { code: '5400', name: 'Travel Expense', account_type: 'expense', normal_balance: 'debit' },
  { code: '5500', name: 'Miscellaneous Expense', account_type: 'expense', normal_balance: 'debit' },
  { code: '5600', name: 'Repairs and Maintenance', account_type: 'expense', normal_balance: 'debit' },
  { code: '5700', name: 'Professional Fees', account_type: 'expense', normal_balance: 'debit' },
  { code: '5800', name: 'Payroll Expense', account_type: 'expense', normal_balance: 'debit' },
  { code: '5900', name: 'Procurement Expense', account_type: 'expense', normal_balance: 'debit' },
  { code: '5910', name: 'Inventory Variance', account_type: 'expense', normal_balance: 'debit' },
  { code: '5920', name: 'Inventory Shrinkage', account_type: 'expense', normal_balance: 'debit' },
]

const CODE_KEYS: Record<string, keyof AccountingVoucherSettings> = {
  '1000': 'default_cash_account_id',
  '1010': 'default_petty_cash_account_id',
  '1100': 'default_ar_account_id',
  '1200': 'default_inventory_account_id',
  '1210': 'default_wip_factory_materials_account_id',
  '1220': 'default_finished_goods_inventory_account_id',
  '2000': 'default_ap_account_id',
  '4000': 'default_sales_account_id',
  '4100': 'default_delivery_income_account_id',
  '5910': 'default_inventory_variance_account_id',
  '5920': 'default_damaged_goods_account_id',
  '5800': 'default_payroll_expense_account_id',
  '2100': 'default_accrued_payroll_account_id',
  '1150': 'default_staff_advance_account_id',
}

export async function ensureChartOfAccounts(brandId: string): Promise<AccountingAccount[]> {
  const { data: existingAccounts, error: loadErr } = await supabase
    .from('accounting_accounts')
    .select('code, id')
    .eq('brand_id', brandId)

  if (loadErr) throw loadErr

  const existingCodes = new Set((existingAccounts || []).map((a) => a.code as string))
  const missing = PH_SME_COA_TEMPLATE.filter((a) => !existingCodes.has(a.code))
  const isFirstSeed = existingCodes.size === 0

  if (missing.length) {
    const { data: inserted, error } = await supabase
      .from('accounting_accounts')
      .insert(
        missing.map((a) => ({
          brand_id: brandId,
          code: a.code,
          name: a.name,
          account_type: a.account_type,
          normal_balance: a.normal_balance,
          is_system: a.is_system ?? false,
          is_active: true,
        }))
      )
      .select('code, id')

    if (error) throw error

    const byCode = new Map((inserted || []).map((a) => [a.code as string, a.id as string]))
    const settingsPatch: Record<string, string | null> = {}
    if (isFirstSeed) {
      settingsPatch.coa_seeded_at = new Date().toISOString()
    }
    for (const [code, key] of Object.entries(CODE_KEYS)) {
      const id = byCode.get(code)
      if (id) settingsPatch[key] = id
    }

    if (Object.keys(settingsPatch).length) {
      const { data: settings } = await supabase
        .from('accounting_voucher_settings')
        .select('id')
        .eq('brand_id', brandId)
        .maybeSingle()

      if (settings?.id) {
        await supabase.from('accounting_voucher_settings').update(settingsPatch).eq('id', settings.id)
      }
    }

    const cashId = byCode.get('1000')
    if (cashId && isFirstSeed) {
      const { data: bankExists } = await supabase
        .from('accounting_bank_accounts')
        .select('id')
        .eq('brand_id', brandId)
        .limit(1)
      if (!bankExists?.length) {
        await supabase.from('accounting_bank_accounts').insert([
          { brand_id: brandId, name: 'Primary Bank Account', gl_account_id: cashId },
        ])
      }
    }
  }

  return loadAccounts(brandId, false)
}

/** Link core GL defaults (cash, petty cash) when voucher settings are still empty. */
export async function ensureCoreGlAccountDefaults(brandId: string): Promise<void> {
  const accounts = await loadAccounts(brandId, false)
  const links: Array<[string, keyof AccountingVoucherSettings]> = [
    ['1000', 'default_cash_account_id'],
    ['1010', 'default_petty_cash_account_id'],
  ]
  for (const [code, key] of links) {
    const acc = accounts.find((a) => a.code === code)
    if (acc?.id) await linkVoucherSettingAccount(brandId, key, acc.id)
  }
}

export async function loadAccounts(brandId: string, activeOnly = true): Promise<AccountingAccount[]> {
  let q = supabase.from('accounting_accounts').select('*').eq('brand_id', brandId).order('code')
  if (activeOnly) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error
  return (data || []) as AccountingAccount[]
}

async function linkVoucherSettingAccount(
  brandId: string,
  column: keyof AccountingVoucherSettings,
  accountId: string
): Promise<void> {
  const { data: settings } = await supabase
    .from('accounting_voucher_settings')
    .select(`id, ${column}`)
    .eq('brand_id', brandId)
    .maybeSingle()
  if (settings && !settings[column]) {
    await supabase
      .from('accounting_voucher_settings')
      .update({ [column]: accountId })
      .eq('id', settings.id)
  }
}

/** Ensure payroll posting accounts (5800, 2100, 1150) are linked in voucher settings. */
export async function ensurePayrollPostingAccounts(brandId: string): Promise<void> {
  const accounts = await loadAccounts(brandId)
  const links: Array<[string, keyof AccountingVoucherSettings]> = [
    ['5800', 'default_payroll_expense_account_id'],
    ['2100', 'default_accrued_payroll_account_id'],
    ['1150', 'default_staff_advance_account_id'],
  ]
  for (const [code, key] of links) {
    const acc = accounts.find((a) => a.code === code)
    if (acc?.id) await linkVoucherSettingAccount(brandId, key, acc.id)
  }
}

/** Link inventory (1200), AP (2000), WIP (1210), FG (1220) defaults when empty. Does not seed COA. */
export async function ensureProcurementPostingAccounts(brandId: string): Promise<void> {
  await ensureFactoryWipPostingAccounts(brandId)

  const accounts = await loadAccounts(brandId)
  const links: Array<[string, keyof AccountingVoucherSettings]> = [
    ['1200', 'default_inventory_account_id'],
    ['2000', 'default_ap_account_id'],
  ]
  for (const [code, key] of links) {
    const acc = accounts.find((a) => a.code === code)
    if (acc?.id) await linkVoucherSettingAccount(brandId, key, acc.id)
  }
}

/** Link 1210 WIP and 1220 Finished Goods in voucher settings when empty. Does not create accounts. */
export async function ensureFactoryWipPostingAccounts(brandId: string): Promise<void> {
  const accounts = await loadAccounts(brandId)

  for (const code of ['1210', '1220'] as const) {
    const acc = accounts.find((a) => a.code === code)
    const key = CODE_KEYS[code]
    if (acc?.id && key) await linkVoucherSettingAccount(brandId, key, acc.id)
  }
}
