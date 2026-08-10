import { supabase } from './supabase'

export type { VoucherLookupRow } from './accounting-voucher-lookup'
export { voucherLookupKey } from './accounting-voucher-lookup'

export type VoucherRef = { voucherId: string; voucherNumber: string }

/** Map "sourceType:sourceId" -> primary voucher id + number */
export async function batchPrimaryVoucherRefs(
  pairs: Array<{ sourceType: string; sourceId: string }>
): Promise<Record<string, VoucherRef>> {
  const out: Record<string, VoucherRef> = {}
  if (!pairs.length) return out

  const sourceIds = pairs.map((p) => p.sourceId)
  const { data: links } = await supabase
    .from('accounting_voucher_links')
    .select('source_type, source_id, voucher_id, voucher:accounting_vouchers(id, voucher_number)')
    .eq('link_role', 'primary')
    .in('source_id', sourceIds)

  for (const link of links || []) {
    const v = link.voucher as { id?: string; voucher_number?: string } | null
    const voucherId = v?.id || link.voucher_id
    const voucherNumber = v?.voucher_number
    if (!voucherId || !voucherNumber) continue
    const key = `${link.source_type}:${link.source_id}`
    if (!out[key]) out[key] = { voucherId, voucherNumber }
  }
  return out
}

/** Map "sourceType:sourceId" -> voucher_number for primary links */
export async function batchPrimaryVoucherNumbers(
  pairs: Array<{ sourceType: string; sourceId: string }>
): Promise<Record<string, string>> {
  const refs = await batchPrimaryVoucherRefs(pairs)
  const out: Record<string, string> = {}
  for (const [key, ref] of Object.entries(refs)) {
    out[key] = ref.voucherNumber
  }
  return out
}

export async function loadJournalNumbersByVoucherIds(
  voucherIds: string[]
): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  if (!voucherIds.length) return out

  const { data: vouchers } = await supabase
    .from('accounting_vouchers')
    .select('id, journal_entry_id')
    .in('id', voucherIds)
    .not('journal_entry_id', 'is', null)

  const jeIds = (vouchers || []).map((v) => v.journal_entry_id).filter(Boolean) as string[]
  if (!jeIds.length) return out

  const { data: entries } = await supabase
    .from('accounting_journal_entries')
    .select('id, entry_number')
    .in('id', jeIds)

  const jeMap = new Map((entries || []).map((e) => [e.id, e.entry_number]))
  for (const v of vouchers || []) {
    if (v.journal_entry_id && jeMap.has(v.journal_entry_id)) {
      out[v.id] = jeMap.get(v.journal_entry_id)!
    }
  }
  return out
}
