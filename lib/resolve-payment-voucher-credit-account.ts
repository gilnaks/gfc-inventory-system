import type { AccountingBankAccount, AccountingVoucher, AccountingVoucherSettings } from './supabase'
import { getCashDefaultAccountId } from './resolve-cash-default-account'

export type PaymentVoucherCreditInput = Pick<
  AccountingVoucher,
  'brand_id' | 'payment_mode' | 'bank_account_id' | 'payee_kind'
>

export function resolvePaymentVoucherCreditAccountPure(
  voucher: PaymentVoucherCreditInput,
  settings: AccountingVoucherSettings | null,
  bank: Pick<AccountingBankAccount, 'brand_id' | 'gl_account_id'> | null
): string {
  const defaultCashId = getCashDefaultAccountId(settings, 'payment_voucher')
  const requiresBank =
    voucher.payment_mode === 'check' || voucher.payment_mode === 'bank_gcash'

  if (requiresBank) {
    if (!voucher.bank_account_id) {
      throw new Error('Select a bank account on the payment voucher before marking it paid.')
    }
    if (!bank) {
      throw new Error('Bank account not found. Update the payment voucher and select a valid bank.')
    }
    if (bank.brand_id !== voucher.brand_id) {
      throw new Error('Bank account does not belong to this brand.')
    }
    if (!bank.gl_account_id) {
      throw new Error('Selected bank account has no GL account configured.')
    }
    return bank.gl_account_id
  }

  if (voucher.bank_account_id) {
    if (!bank) {
      throw new Error('Bank account not found. Update the payment voucher and select a valid bank.')
    }
    if (bank.brand_id !== voucher.brand_id) {
      throw new Error('Bank account does not belong to this brand.')
    }
    if (!bank.gl_account_id) {
      throw new Error('Selected bank account has no GL account configured.')
    }
    return bank.gl_account_id
  }

  if (!defaultCashId) {
    throw new Error(
      'Payment voucher cash account not configured. Set Cash — payment vouchers (or Cash fallback) in Accounting settings.'
    )
  }
  return defaultCashId
}

export function paymentVoucherMissingBankAccount(
  voucher: Pick<AccountingVoucher, 'payment_mode' | 'bank_account_id' | 'voucher_type'>
): boolean {
  if (voucher.voucher_type !== 'payment') return false
  return (
    (voucher.payment_mode === 'check' || voucher.payment_mode === 'bank_gcash') &&
    !voucher.bank_account_id
  )
}

export const PAYMENT_VOUCHER_BANK_REQUIRED_MSG =
  'Select a bank account on the payment voucher before marking it paid.'

export async function resolvePaymentVoucherCreditAccount(
  voucher: PaymentVoucherCreditInput,
  settings: AccountingVoucherSettings | null
): Promise<string> {
  let bank: Pick<AccountingBankAccount, 'brand_id' | 'gl_account_id'> | null = null
  if (voucher.bank_account_id) {
    const { supabase } = await import('./supabase')
    const { data, error } = await supabase
      .from('accounting_bank_accounts')
      .select('brand_id, gl_account_id')
      .eq('id', voucher.bank_account_id)
      .maybeSingle()
    if (error) throw error
    bank = data
  }
  return resolvePaymentVoucherCreditAccountPure(voucher, settings, bank)
}
