import type {
  AccountingAccount,
  AccountingVoucherLine,
  AccountingVoucherLink,
  AccountingVoucherSettings,
  AccountingVoucherSourceType,
  PurchaseOrderItem,
} from './supabase'

type PoItemPick = Pick<PurchaseOrderItem, 'material_id' | 'fixed_asset_id'>

/**
 * Asset codes allowed as PV/PCV line debits (expense accounts are always allowed).
 * Cash, AR, intercompany due-from, WIP, etc. are excluded — they are not typical voucher expense lines.
 */
export const VOUCHER_LINE_DEBIT_ASSET_CODES = new Set([
  '1150', // Staff Advances
  '1200', // Inventory
  '1220', // Finished Goods Inventory
  '1300', // Prepaid Expenses
  '1500', // Fixed Assets
])

/** Accounts shown in New/Edit PV & PCV line-item account dropdown. */
export function isVoucherLineDebitAccount(account: Pick<AccountingAccount, 'code' | 'account_type' | 'is_active'>): boolean {
  if (account.is_active === false) return false
  if (account.account_type === 'expense') return true
  if (account.account_type === 'asset') {
    return VOUCHER_LINE_DEBIT_ASSET_CODES.has(String(account.code || '').trim())
  }
  return false
}

export function filterVoucherLineDebitAccounts<T extends Pick<AccountingAccount, 'code' | 'account_type' | 'is_active'>>(
  accounts: T[]
): T[] {
  return accounts
    .filter(isVoucherLineDebitAccount)
    .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
}

function pickAccountId(
  settings: AccountingVoucherSettings | null,
  key: keyof AccountingVoucherSettings,
  accounts: AccountingAccount[],
  fallbackCode: string
): string | null {
  const fromSettings = settings?.[key]
  if (typeof fromSettings === 'string' && fromSettings) return fromSettings
  return accounts.find((a) => a.code === fallbackCode)?.id ?? null
}

export function resolveProcurementPoItemDebitAccountId(
  poItem: PoItemPick | null | undefined,
  settings: AccountingVoucherSettings | null,
  accounts: AccountingAccount[]
): string | null {
  const invId = pickAccountId(settings, 'default_inventory_account_id', accounts, '1200')
  const fixedAssetAcc = accounts.find((a) => a.code === '1500')?.id ?? null
  const procExp = accounts.find((a) => a.code === '5900')?.id ?? null

  if (poItem?.fixed_asset_id && fixedAssetAcc) return fixedAssetAcc
  if (poItem?.material_id && invId) return invId
  return procExp || invId || accounts.find((a) => a.code === '5500')?.id || null
}

export function resolveVoucherLineDefaultAccountId(params: {
  sourceType: AccountingVoucherSourceType
  line: AccountingVoucherLine
  lineIndex: number
  poItems?: PurchaseOrderItem[]
  settings: AccountingVoucherSettings | null
  accounts: AccountingAccount[]
}): string | null {
  const { sourceType, line, lineIndex, poItems, settings, accounts } = params

  if (sourceType === 'payroll_run_brand_total') {
    return pickAccountId(settings, 'default_payroll_expense_account_id', accounts, '5800')
  }

  if (sourceType === 'staff_advance_disbursement') {
    return pickAccountId(settings, 'default_staff_advance_account_id', accounts, '1150')
  }

  if (sourceType === 'payroll_deduction_refund') {
    const desc = line.description.toLowerCase()
    if (desc.includes('utilit')) return accounts.find((a) => a.code === '5200')?.id ?? null
    if (desc.includes('cash advance')) {
      return pickAccountId(settings, 'default_staff_advance_account_id', accounts, '1150')
    }
    return accounts.find((a) => a.code === '5500')?.id ?? null
  }

  if (sourceType === 'intercompany_transfer') {
    return (
      settings?.default_due_to_gfc_account_id ||
      accounts.find((a) => a.code === '2115')?.id ||
      accounts.find((a) => a.code === '5900')?.id ||
      null
    )
  }

  if (sourceType === 'purchase_order' || sourceType === 'supplier_invoice' || sourceType === 'po_payment') {
    const poItem = poItems?.[lineIndex] ?? null
    return resolveProcurementPoItemDebitAccountId(poItem, settings, accounts)
  }

  // Blank manual PV/PCV — no linked document; user selects the expense account.
  if (sourceType === 'supplier') return null

  return accounts.find((a) => a.code === '5900')?.id ?? accounts.find((a) => a.code === '5500')?.id ?? null
}

export function applyDefaultVoucherLineAccounts(
  lines: AccountingVoucherLine[],
  opts: {
    sourceType: AccountingVoucherSourceType
    links: AccountingVoucherLink[]
    settings: AccountingVoucherSettings | null
    accounts: AccountingAccount[]
    poItems?: PurchaseOrderItem[]
  }
): AccountingVoucherLine[] {
  return lines.map((line, lineIndex) => {
    if (line.debit_account_id) return line
    const debit_account_id = resolveVoucherLineDefaultAccountId({
      sourceType: opts.sourceType,
      line,
      lineIndex,
      poItems: opts.poItems,
      settings: opts.settings,
      accounts: opts.accounts,
    })
    return debit_account_id ? { ...line, debit_account_id } : line
  })
}
