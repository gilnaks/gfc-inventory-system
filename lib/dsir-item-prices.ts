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
  const now = new Date()
  const yy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
