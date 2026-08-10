export type VoucherLookupRow = {
  sourceType: string
  sourceId: string
  voucherLink?: { sourceType: string; sourceId: string }
}

/** Resolve the key used to look up primary voucher refs for a payables row. */
export function voucherLookupKey(row: VoucherLookupRow): string {
  if (row.voucherLink) return `${row.voucherLink.sourceType}:${row.voucherLink.sourceId}`
  return `${row.sourceType}:${row.sourceId}`
}
