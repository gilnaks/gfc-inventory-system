/** Effective-dated unit price for a DSIR predefined sales item. */
export type DsirItemPriceRange = {
  predefined_item_id?: string
  price: number
  effective_from: string
  effective_to: string | null
}

/** Pick the price covering `reportDate` (YYYY-MM-DD); null if none. */
export function priceForReportDate(
  ranges: DsirItemPriceRange[] | undefined | null,
  reportDate: string | null | undefined
): number | null {
  if (!reportDate || !ranges?.length) return null
  const covering = ranges.filter((r) => {
    if (r.effective_from > reportDate) return false
    if (r.effective_to != null && r.effective_to < reportDate) return false
    return true
  })
  if (covering.length === 0) return null
  // Prefer the latest effective_from among matches
  covering.sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))
  const price = Number(covering[0].price)
  return Number.isFinite(price) ? price : null
}

/** Calendar day before YYYY-MM-DD (UTC date arithmetic). */
export function dayBefore(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - 1)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function todayIsoDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

export function soldFromInventoryCounts(row: {
  beginning_inventory?: unknown
  arrival?: unknown
  pull_out?: unknown
  ending_inventory?: unknown
}): number {
  const beg = parseInt(String(row.beginning_inventory ?? '0'), 10) || 0
  const arrival = parseInt(String(row.arrival ?? '0'), 10) || 0
  const pullOut = parseInt(String(row.pull_out ?? '0'), 10) || 0
  const endRaw = row.ending_inventory
  if (endRaw === null || endRaw === undefined || endRaw === '') return 0
  const endInv = parseInt(String(endRaw), 10) || 0
  const newInv = beg + arrival - pullOut
  return endInv === 0 ? newInv : newInv - endInv
}
