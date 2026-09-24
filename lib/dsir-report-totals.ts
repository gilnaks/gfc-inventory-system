import { supabase } from './supabase'
import { priceForReportDate, soldFromInventoryCounts, type DsirItemPriceRange } from './dsir-item-prices'

export type DsirHeaderTotals = {
  gross_sales: number
  total_discounts: number
  total_expenses: number
  net_sales: number
  total_cash: number
  discrepancy: number
  big_cup_sales: number
  small_cup_sales: number
  water_sales: number
  ml_500_sales: number
  choco_coated_sales: number
}

const HEADER_KEYS: (keyof DsirHeaderTotals)[] = [
  'gross_sales',
  'total_discounts',
  'total_expenses',
  'net_sales',
  'total_cash',
  'discrepancy',
  'big_cup_sales',
  'small_cup_sales',
  'water_sales',
  'ml_500_sales',
  'choco_coated_sales',
]

const BILL_DENOMS = new Set(['1,000', '500', '200', '100', '50', '20'])

export function denominationValue(denominationName: string): number {
  switch (denominationName) {
    case '1,000':
      return 1000
    case '500':
      return 500
    case '200':
      return 200
    case '100':
      return 100
    case '50':
      return 50
    case '20':
      return 20
    case 'COINS':
      return 1
    case 'GCASH':
      return 0
    default:
      return 0
  }
}

/** Same cash math as DSIRViewer.getSalesReconAmount. */
export function salesReconAmount(denominationName: string, quantity: number): number {
  const value = denominationValue(denominationName)
  if (value === 0 && !BILL_DENOMS.has(denominationName)) return quantity
  return value * quantity
}

export function productSalesBuckets(itemName: string, amount: number) {
  const name = itemName.toUpperCase().trim()
  return {
    big_cup:
      (name.includes('BIG') && name.includes('CUP')) || name === 'BIGCUP' || name === 'BIG CUP'
        ? amount
        : 0,
    small_cup:
      (name.includes('SMALL') && name.includes('CUP')) || name === 'SMALLCUP' || name === 'SMALL CUP'
        ? amount
        : 0,
    water: name.includes('WATER') || name === 'WATER' ? amount : 0,
    ml_500: name.includes('500') || name.includes('500ML') || name.includes('500 ML') ? amount : 0,
    choco:
      name.includes('CHOCO') || name.includes('CHOCOLATE') || name.includes('COATED') ? amount : 0,
  }
}

function rangesForItemName(
  rangesByName: Record<string, DsirItemPriceRange[]> | undefined,
  itemName: string
): DsirItemPriceRange[] | undefined {
  if (!rangesByName) return undefined
  if (rangesByName[itemName]) return rangesByName[itemName]
  const trimmed = itemName.trim()
  if (rangesByName[trimmed]) return rangesByName[trimmed]
  const upper = trimmed.toUpperCase()
  if (rangesByName[upper]) return rangesByName[upper]
  for (const [key, ranges] of Object.entries(rangesByName)) {
    if (key.trim().toUpperCase() === upper) return ranges
  }
  return undefined
}

export function resolveLineUnitPrice(
  itemName: string,
  reportDate: string,
  storedPrice: number,
  rangesByName?: Record<string, DsirItemPriceRange[]>
): number {
  const dated = priceForReportDate(rangesForItemName(rangesByName, itemName), reportDate)
  if (dated != null && dated > 0) return dated
  if (storedPrice > 0) return storedPrice
  return 0
}

export function totalsDiffer(
  a: Partial<DsirHeaderTotals> | null | undefined,
  b: DsirHeaderTotals
): boolean {
  if (!a) return true
  return HEADER_KEYS.some(
    (key) => Math.abs((Number(a[key]) || 0) - (Number(b[key]) || 0)) > 0.009
  )
}

export function applyDsirTotals<T extends { id: string }>(
  reports: T[],
  totals: Record<string, DsirHeaderTotals>
): T[] {
  return reports.map((report) => {
    const next = totals[report.id]
    return next ? { ...report, ...next } : report
  })
}

export async function loadBrandSalesPriceRangesByName(
  brandId: string
): Promise<Record<string, DsirItemPriceRange[]>> {
  const { data: items, error: itemErr } = await supabase
    .from('dsir_predefined_items')
    .select('id, name')
    .eq('brand_id', brandId)
    .eq('category', 'sales')
    .eq('is_active', true)
  if (itemErr) throw itemErr

  const sales = items || []
  if (sales.length === 0) return {}

  const { data: priceRows, error: priceErr } = await supabase
    .from('dsir_predefined_item_prices')
    .select('predefined_item_id, price, effective_from, effective_to')
    .in(
      'predefined_item_id',
      sales.map((item) => item.id)
    )
  if (priceErr) throw priceErr

  const byId: Record<string, DsirItemPriceRange[]> = {}
  for (const row of priceRows || []) {
    const id = String(row.predefined_item_id)
    if (!byId[id]) byId[id] = []
    byId[id].push({
      predefined_item_id: id,
      price: Number(row.price) || 0,
      effective_from: String(row.effective_from).slice(0, 10),
      effective_to: row.effective_to != null ? String(row.effective_to).slice(0, 10) : null,
    })
  }

  const byName: Record<string, DsirItemPriceRange[]> = {}
  for (const item of sales) {
    const ranges = byId[item.id] || []
    const name = String(item.name || '')
    byName[name] = ranges
    byName[name.trim()] = ranges
    byName[name.trim().toUpperCase()] = ranges
  }
  return byName
}

type ReportRef = {
  id: string
  report_date: string
  status?: string
}

export async function computeAndPersistDsirReportTotals(
  reports: ReportRef[],
  rangesByName: Record<string, DsirItemPriceRange[]>
): Promise<Record<string, DsirHeaderTotals>> {
  const targets = reports.filter((report) => report.status !== 'draft')
  const result: Record<string, DsirHeaderTotals> = {}
  if (targets.length === 0) return result

  const chunkSize = 80
  for (let i = 0; i < targets.length; i += chunkSize) {
    const chunk = targets.slice(i, i + chunkSize)
    const ids = chunk.map((report) => report.id)
    const dateById = new Map(chunk.map((report) => [report.id, String(report.report_date).slice(0, 10)]))

    const [
      { data: headers, error: headerErr },
      { data: lines, error: lineErr },
      { data: discountRows, error: discountErr },
      { data: expenseRows, error: expenseErr },
      { data: reconRows, error: reconErr },
    ] = await Promise.all([
      supabase
        .from('dsir_reports')
        .select(
          'id, gross_sales, total_discounts, total_expenses, net_sales, total_cash, discrepancy, big_cup_sales, small_cup_sales, water_sales, ml_500_sales, choco_coated_sales'
        )
        .in('id', ids),
      supabase
        .from('dsir_sales_inventory')
        .select('dsir_report_id, item_name, beginning_inventory, arrival, pull_out, ending_inventory, price')
        .in('dsir_report_id', ids),
      supabase.from('dsir_discounts').select('dsir_report_id, order_amount').in('dsir_report_id', ids),
      supabase.from('dsir_expenses').select('dsir_report_id, amount').in('dsir_report_id', ids),
      supabase.from('dsir_sales_recon').select('dsir_report_id, denomination, quantity').in('dsir_report_id', ids),
    ])
    if (headerErr) throw headerErr
    if (lineErr) throw lineErr
    if (discountErr) throw discountErr
    if (expenseErr) throw expenseErr
    if (reconErr) throw reconErr

    const headerById = new Map((headers || []).map((row) => [row.id, row]))

    for (const report of chunk) {
      const reportDate = dateById.get(report.id) || ''
      let gross = 0
      let bigCup = 0
      let smallCup = 0
      let water = 0
      let ml500 = 0
      let choco = 0

      for (const row of lines || []) {
        if (row.dsir_report_id !== report.id) continue
        const sold = soldFromInventoryCounts(row)
        const amount =
          sold * resolveLineUnitPrice(String(row.item_name || ''), reportDate, Number(row.price) || 0, rangesByName)
        gross += amount
        const buckets = productSalesBuckets(String(row.item_name || ''), amount)
        bigCup += buckets.big_cup
        smallCup += buckets.small_cup
        water += buckets.water
        ml500 += buckets.ml_500
        choco += buckets.choco
      }

      const discounts = (discountRows || [])
        .filter((row) => row.dsir_report_id === report.id)
        .reduce((sum, row) => sum + (Number(row.order_amount) || 0) * 0.2, 0)
      const expenses = (expenseRows || [])
        .filter((row) => row.dsir_report_id === report.id)
        .reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
      const cash = (reconRows || [])
        .filter((row) => row.dsir_report_id === report.id)
        .reduce(
          (sum, row) => sum + salesReconAmount(String(row.denomination || ''), Number(row.quantity) || 0),
          0
        )

      const net = gross - discounts - expenses
      const totals: DsirHeaderTotals = {
        gross_sales: gross,
        total_discounts: discounts,
        total_expenses: expenses,
        net_sales: net,
        total_cash: cash,
        discrepancy: cash - net,
        big_cup_sales: bigCup,
        small_cup_sales: smallCup,
        water_sales: water,
        ml_500_sales: ml500,
        choco_coated_sales: choco,
      }
      result[report.id] = totals

      const existing = headerById.get(report.id)
      if (totalsDiffer(existing, totals)) {
        const { error: updErr } = await supabase.from('dsir_reports').update(totals).eq('id', report.id)
        if (updErr) {
          console.error('Failed to persist DSIR header totals', report.id, updErr)
        }
      }
    }
  }

  return result
}
