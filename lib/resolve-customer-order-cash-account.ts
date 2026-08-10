import type { AccountingBankAccount, AccountingVoucherSettings } from './supabase'
import { getCashDefaultAccountId } from './resolve-cash-default-account'

/**
 * Resolve the GL account to debit for customer order cash collection.
 * Prefer explicit bank override, then order-stored bank, else per-source / fallback Cash.
 */
export function resolveCustomerOrderCashAccountPure(
  brandId: string,
  settings: AccountingVoucherSettings | null,
  bankAccountId: string | null | undefined,
  bank: Pick<AccountingBankAccount, 'brand_id' | 'gl_account_id'> | null
): string {
  if (bankAccountId) {
    if (!bank) {
      throw new Error('Bank account not found. Select a valid bank for this collection.')
    }
    if (bank.brand_id !== brandId) {
      throw new Error('Bank account does not belong to this brand.')
    }
    if (!bank.gl_account_id) {
      throw new Error('Selected bank account has no GL account configured.')
    }
    return bank.gl_account_id
  }

  const cashId = getCashDefaultAccountId(settings, 'customer_order_cash')
  if (!cashId) {
    throw new Error(
      'Customer collections cash account not configured. Set Cash — customer collections (or Cash fallback) in Accounting settings.'
    )
  }
  return cashId
}

export async function resolveCustomerOrderCashAccount(
  brandId: string,
  settings: AccountingVoucherSettings | null,
  bankAccountId: string | null | undefined
): Promise<string> {
  let bank: Pick<AccountingBankAccount, 'brand_id' | 'gl_account_id'> | null = null
  if (bankAccountId) {
    const { supabase } = await import('./supabase')
    const { data, error } = await supabase
      .from('accounting_bank_accounts')
      .select('brand_id, gl_account_id')
      .eq('id', bankAccountId)
      .maybeSingle()
    if (error) throw error
    bank = data
  }
  return resolveCustomerOrderCashAccountPure(brandId, settings, bankAccountId, bank)
}
