import type { AccountingVoucherType, AccountingVoucherSettings } from './supabase'

export function formatVoucherNumber(
  prefix: string,
  seq: number,
  year = new Date().getFullYear() % 100
): string {
  const yy = String(year).padStart(2, '0')
  const num = String(seq).padStart(4, '0')
  return `${prefix}-${yy}${num}`
}

export function nextVoucherNumberFromSettings(
  type: AccountingVoucherType,
  settings: AccountingVoucherSettings
): { number: string; nextSeq: number } {
  if (type === 'payment') {
    const seq = settings.pv_next_seq || 1
    return {
      number: formatVoucherNumber(settings.pv_number_prefix || 'PV', seq),
      nextSeq: seq + 1,
    }
  }
  const seq = settings.pcv_next_seq || 1
  return {
    number: formatVoucherNumber(settings.pcv_number_prefix || 'PCV', seq),
    nextSeq: seq + 1,
  }
}

export function fallbackVoucherNumber(type: AccountingVoucherType): string {
  const prefix = type === 'payment' ? 'PV' : 'PCV'
  const random = Math.floor(Math.random() * 9000) + 1000
  const yy = String(new Date().getFullYear() % 100).padStart(2, '0')
  return `${prefix}-${yy}${random}`
}
