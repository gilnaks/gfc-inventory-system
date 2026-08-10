import { supabase } from './supabase'
import type { AccountingAccount, AccountingVoucherSettings } from './supabase'
import { ensureProcurementPostingAccounts, loadAccounts } from './accounting-coa-seed'

type CoaRow = {
  code: string
  name: string
  account_type: AccountingAccount['account_type']
  normal_balance: 'debit' | 'credit'
}

const GFC_INTERCOMPANY_ACCOUNTS: CoaRow[] = [
  { code: '1111', name: 'Due from Gelatofilipino', account_type: 'asset', normal_balance: 'debit' },
  { code: '1112', name: 'Due from MyChoice', account_type: 'asset', normal_balance: 'debit' },
  { code: '1113', name: 'Due from Mang Sorbetes', account_type: 'asset', normal_balance: 'debit' },
  { code: '4510', name: 'Intercompany Sales', account_type: 'revenue', normal_balance: 'credit' },
  { code: '4520', name: 'Intercompany Markup Income', account_type: 'revenue', normal_balance: 'credit' },
  { code: '5510', name: 'Intercompany COGS', account_type: 'expense', normal_balance: 'debit' },
]

const RETAIL_INTERCOMPANY_ACCOUNTS: CoaRow[] = [
  { code: '2115', name: 'Due to GFC', account_type: 'liability', normal_balance: 'credit' },
  { code: '1210', name: 'Inventory from GFC', account_type: 'asset', normal_balance: 'debit' },
]

export const DUE_FROM_BY_RETAIL_SLUG: Record<string, string> = {
  gelatofilipino: '1111',
  mychoice: '1112',
  'mang-sorbetes': '1113',
  mangsorbetes: '1113',
}

async function linkVoucherSetting(
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
    await supabase.from('accounting_voucher_settings').update({ [column]: accountId }).eq('id', settings.id)
  }
}

async function ensureAccounts(brandId: string, rows: CoaRow[]): Promise<Map<string, string>> {
  const byCode = new Map<string, string>()
  for (const row of rows) {
    const { data: existing } = await supabase
      .from('accounting_accounts')
      .select('id')
      .eq('brand_id', brandId)
      .eq('code', row.code)
      .maybeSingle()
    if (existing?.id) {
      byCode.set(row.code, existing.id as string)
      continue
    }
    const { data: inserted, error } = await supabase
      .from('accounting_accounts')
      .insert({
        brand_id: brandId,
        code: row.code,
        name: row.name,
        account_type: row.account_type,
        normal_balance: row.normal_balance,
        is_active: true,
      })
      .select('id')
      .single()
    if (error) throw error
    byCode.set(row.code, inserted!.id as string)
  }
  return byCode
}

export async function ensureIntercompanyAccounts(
  brandId: string,
  brandSlug: string,
  brandRole: string | undefined
): Promise<void> {
  const isFactory = brandRole === 'factory' || brandSlug === 'gfc'
  const accounts = isFactory
    ? await ensureAccounts(brandId, GFC_INTERCOMPANY_ACCOUNTS)
    : await ensureAccounts(brandId, RETAIL_INTERCOMPANY_ACCOUNTS)

  if (isFactory) {
    const sales = accounts.get('4510')
    const cogs = accounts.get('5510')
    if (sales) await linkVoucherSetting(brandId, 'default_intercompany_sales_account_id', sales)
    if (cogs) await linkVoucherSetting(brandId, 'default_intercompany_cogs_account_id', cogs)
  } else {
    const dueTo = accounts.get('2115')
    if (dueTo) await linkVoucherSetting(brandId, 'default_due_to_gfc_account_id', dueTo)
  }
}

export async function ensureIntercompanyBrandPairSettings(
  factoryBrandId: string,
  retailBrandId: string,
  retailSlug: string
): Promise<void> {
  const factoryAccounts = await loadAccounts(factoryBrandId)
  const retailAccounts = await loadAccounts(retailBrandId)
  const dueFromCode = DUE_FROM_BY_RETAIL_SLUG[retailSlug]
  const dueFrom = dueFromCode ? factoryAccounts.find((a) => a.code === dueFromCode) : undefined
  const dueTo = retailAccounts.find((a) => a.code === '2115')

  const { data: existing } = await supabase
    .from('intercompany_brand_settings')
    .select('id')
    .eq('factory_brand_id', factoryBrandId)
    .eq('retail_brand_id', retailBrandId)
    .maybeSingle()

  if (existing?.id) {
    await supabase
      .from('intercompany_brand_settings')
      .update({
        due_from_account_id: dueFrom?.id ?? null,
        due_to_account_id: dueTo?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    await supabase.from('intercompany_brand_settings').insert([
      {
        factory_brand_id: factoryBrandId,
        retail_brand_id: retailBrandId,
        due_from_account_id: dueFrom?.id ?? null,
        due_to_account_id: dueTo?.id ?? null,
        updated_at: new Date().toISOString(),
      },
    ])
  }
}

/** Ensure COA + voucher links for one GFC → retail transfer before posting. */
export async function ensureIntercompanyTransferPostingReady(
  factoryBrandId: string,
  retailBrandId: string
): Promise<void> {
  const { data: brands, error } = await supabase
    .from('brands')
    .select('id, slug, brand_role')
    .in('id', [factoryBrandId, retailBrandId])

  if (error) throw error

  const factory = brands?.find((b) => b.id === factoryBrandId)
  const retail = brands?.find((b) => b.id === retailBrandId)
  if (!factory || !retail) throw new Error('Factory or retail brand not found')

  await ensureIntercompanyAccounts(factory.id, factory.slug, factory.brand_role)
  await ensureIntercompanyAccounts(retail.id, retail.slug, retail.brand_role)
  await ensureIntercompanyBrandPairSettings(factory.id, retail.id, retail.slug)
  await ensureProcurementPostingAccounts(factory.id)
  await ensureProcurementPostingAccounts(retail.id)
}

export async function ensureAllIntercompanySetup(brands: Array<{ id: string; slug: string; brand_role?: string }>): Promise<void> {
  const factory = brands.find((b) => b.slug === 'gfc' || b.brand_role === 'factory')
  if (!factory) return

  for (const brand of brands) {
    await ensureIntercompanyAccounts(brand.id, brand.slug, brand.brand_role)
  }

  for (const retail of brands.filter((b) => b.id !== factory.id && b.brand_role !== 'factory')) {
    await ensureIntercompanyBrandPairSettings(factory.id, retail.id, retail.slug)
  }
}
