import { supabase } from './supabase'
import { getPhilippinesDate } from './timezone'
import { fetchDayStatusMapForPeriod, resolveScheduleDayType } from './payroll-calculation'
import {
  computeDailyIncentive,
  resolveLocationIncentiveSettings,
} from './payroll-incentive'
import { computeLiveNetPayrollTotal } from './analytics-payroll'

/**
 * GFC Main Analytics: business-wide KPIs, trends and rankings.
 *
 * Financial figures come from operational data (submitted DSIR reports +
 * paid/complete/fulfilled customer orders), not the GL — journals are not
 * posted yet. Factory / material / voucher sections read their tables and
 * render as empty states until those flows start recording data.
 */

// ---------------------------------------------------------------------------
// Date ranges (Philippines calendar, YYYY-MM-DD inclusive)
// ---------------------------------------------------------------------------

export type AnalyticsRange = { start: string; end: string }

export type AnalyticsPreset = '7d' | '30d' | '90d' | 'custom'

export const ANALYTICS_PRESETS: Array<{ key: Exclude<AnalyticsPreset, 'custom'>; label: string; days: number }> = [
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
]

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return t.toISOString().slice(0, 10)
}

export function getPresetRange(days: number): AnalyticsRange {
  const end = getPhilippinesDate()
  return { start: addDays(end, -(days - 1)), end }
}

/** Immediately-preceding window of the same length, for period deltas. */
export function getPreviousRange(range: AnalyticsRange): AnalyticsRange {
  const [ys, ms, ds] = range.start.split('-').map(Number)
  const [ye, me, de] = range.end.split('-').map(Number)
  const lengthDays =
    Math.round((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86_400_000) + 1
  return { start: addDays(range.start, -lengthDays), end: addDays(range.start, -1) }
}

function eachDay(range: AnalyticsRange): string[] {
  const days: string[] = []
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) days.push(d)
  return days
}

function shortDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, d))
  )
}

/** Monday-based week start for a YYYY-MM-DD date. */
function weekStartOf(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return addDays(ymd, -((day + 6) % 7))
}

function weekLabel(weekStart: string): string {
  const end = addDays(weekStart, 6)
  const startLabel = shortDayLabel(weekStart)
  const endLabel =
    weekStart.slice(0, 7) === end.slice(0, 7) ? end.slice(8).replace(/^0/, '') : shortDayLabel(end)
  return `${startLabel}–${endLabel}`
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function num(value: unknown): number {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value)
  return Number.isFinite(n) ? n : 0
}

const PAGE_SIZE = 1000

/**
 * Drains every page of a query (PostgREST caps single responses at ~1000 rows).
 * Rows are cast to T: without generated DB types supabase-js infers to-one
 * joins as arrays, but at runtime single-FK embeds come back as objects.
 */
async function fetchAll<T>(
  buildPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildPage(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const batch = (data || []) as T[]
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }
  return rows
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type KpiValue = { current: number; previous: number }

export type SalesTrendPoint = {
  date: string
  label: string
  netSales: number
  grossSales: number
  orderRevenue: number
}

export type BrandRevenueSlice = {
  brandId: string
  name: string
  slug: string | null
  dsirNetSales: number
  orderRevenue: number
  total: number
}

export type FlavorStat = { flavor: string; consumed: number }

export type ItemSalesStat = { name: string; quantity: number; amount: number }

export type FactoryWeekPoint = {
  weekStart: string
  label: string
  production: number
  batchUnits: number
}

export type MaterialUsageStat = { material: string; quantity: number; unit: string; cost: number }

export type PaymentsTrendPoint = {
  date: string
  label: string
  storeCash: number
  orderPayments: number
  voucherOutflow: number
}

export type LocationRanking = {
  locationId: string
  name: string
  brandId: string | null
  brandName: string
  brandSlug: string | null
  franchisee: string | null
  companyOwned: boolean
  /** Portal order revenue (paid/complete/fulfilled). */
  orderRevenue: number
  orderCount: number
  orderDays: number
  avgDailyOrders: number
}

export type CompanyOwnedDsirRanking = {
  locationId: string
  name: string
  brandId: string | null
  brandName: string
  brandSlug: string | null
  franchisee: string | null
  netSales: number
  grossSales: number
  cashCollected: number
  reportDays: number
  avgDailySales: number
  discrepancy: number
  bigCupQty: number
  smallCupQty: number
  avgBigCups: number
  avgSmallCups: number
  bigCupSales: number
  smallCupSales: number
  pansDelivered: number
  panDeliveryCost: number
  /** Delivered-pan cost allocated by cup sales share ÷ big cups sold. */
  avgCostPerBigCup: number
  /** Delivered-pan cost allocated by cup sales share ÷ small cups sold. */
  avgCostPerSmallCup: number
  salesPerPan: number
  /** Actual big cups sold ÷ pans delivered. */
  avgBigCupsPerPan: number
  /** Actual small cups sold ÷ pans delivered. */
  avgSmallCupsPerPan: number
  /**
   * If all cup sales were big cups only: total cup sales ÷ big-cup unit price ÷ pans.
   * Answers “1 pan would yield this many big cups.”
   */
  allBigOnlyPerPan: number
  /**
   * If all cup sales were small cups only: total cup sales ÷ small-cup unit price ÷ pans.
   * Answers “1 pan would yield this many small cups.”
   */
  allSmallOnlyPerPan: number
}

export type StaffRanking = {
  staffId: string
  name: string
  locationId: string
  locationName: string
  brandName: string
  sales: number
  days: number
  hours: number
  salesPerHour: number
}

export type OverallStaffRanking = {
  staffId: string
  name: string
  sales: number
  days: number
  hours: number
  salesPerHour: number
  storeCount: number
  topStoreName: string | null
  incentive: number
  discrepancy: number
}

export type AnalyticsData = {
  range: AnalyticsRange
  previousRange: AnalyticsRange
  kpis: {
    netSales: KpiValue
    grossSales: KpiValue
    orderRevenue: KpiValue
    ordersCount: KpiValue
    cashCollected: KpiValue
    netPayroll: KpiValue
    activeFranchises: KpiValue
    productionUnits: KpiValue
  }
  salesTrend: SalesTrendPoint[]
  revenueByBrand: BrandRevenueSlice[]
  topFlavors: FlavorStat[]
  topStoreItems: ItemSalesStat[]
  topOrderProducts: ItemSalesStat[]
  factoryWeekly: FactoryWeekPoint[]
  factoryBatchCount: number
  materialUsage: MaterialUsageStat[]
  materialUsageTotalCost: number
  payments: {
    storeCash: number
    orderPayments: number
    voucherOutflow: number
    voucherCount: number
    trend: PaymentsTrendPoint[]
  }
  locationRankings: LocationRanking[]
  companyOwnedDsirRankings: CompanyOwnedDsirRanking[]
  staffRankings: StaffRanking[]
  staffRankingsOverall: OverallStaffRanking[]
}

// ---------------------------------------------------------------------------
// Row shapes (only the columns we select)
// ---------------------------------------------------------------------------

type LocationRow = {
  id: string
  name: string
  brand_id: string | null
  franchisee: string | null
  company_owned: boolean | null
  is_factory_floor: boolean | null
  incentive_regular_sales_threshold: number | null
  incentive_holiday_sales_threshold: number | null
  incentive_base_amount: number | null
}

type DsirReportRow = {
  id: string
  location_id: string
  staff_registration_id: string | null
  staff_name: string | null
  report_date: string
  gross_sales: unknown
  net_sales: unknown
  total_cash: unknown
  discrepancy: unknown
  big_cup_sales: unknown
  small_cup_sales: unknown
}

type CustomerOrderRow = {
  id: string
  created_at: string
  brand_id: string
  location_id: string | null
  status: string
  total_amount: unknown
  order_details:
    | Array<{
        quantity: unknown
        unit_price: unknown
        products: { name: string | null; category: string | null } | null
      }>
    | null
}

type DsirJoinRow = { report_date: string; location_id: string }

type FlavorRow = {
  flavor: string
  beginning: unknown
  arrival: unknown
  pull_out: unknown
  ending: unknown
  dsir_reports: DsirJoinRow | null
}

type StoreItemRow = {
  item_name: string
  sold: unknown
  sales: unknown
  price: unknown
  beginning_inventory: unknown
  arrival: unknown
  pull_out: unknown
  new_inventory: unknown
  ending_inventory: unknown
  dsir_reports: DsirJoinRow | null
}

/**
 * Sold quantity for a DSIR sales-inventory row. Stores usually leave
 * sold/sales/new_inventory at 0 and only fill the count columns, so derive:
 * available (beginning + arrival − pull_out) minus the ending count.
 */
function storeItemSoldQuantity(row: StoreItemRow): number {
  if (row.ending_inventory !== null && row.ending_inventory !== undefined && row.ending_inventory !== '') {
    const newInventory = num(row.new_inventory)
    const available =
      newInventory > 0 ? newInventory : num(row.beginning_inventory) + num(row.arrival) - num(row.pull_out)
    const fromInventory = Math.max(0, available - num(row.ending_inventory))
    if (fromInventory > 0) return fromInventory
  }

  const price = num(row.price)
  const sales = num(row.sales)
  if (sales > 0 && price > 0) return Math.round(sales / price)

  return Math.max(0, num(row.sold))
}

function normalizeItemName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, ' ')
}

function isBigCupItem(itemName: string): boolean {
  const name = normalizeItemName(itemName)
  return (name.includes('BIG') && name.includes('CUP')) || name === 'BIGCUP' || name === 'BIG CUP'
}

function isSmallCupItem(itemName: string): boolean {
  const name = normalizeItemName(itemName)
  return (name.includes('SMALL') && name.includes('CUP')) || name === 'SMALLCUP' || name === 'SMALL CUP'
}

/** Portal order product category that counts as delivered pans for a brand. */
function panCategoryForBrand(slug: string | null | undefined, name: string | null | undefined): string | null {
  const key = `${slug || ''} ${name || ''}`.toLowerCase()
  if (key.includes('mychoice')) return 'ice cream'
  if (key.includes('gelato')) return 'gelato'
  if (key.includes('sorbetes')) return 'sorbetes'
  return null
}

type StockSummaryRow = {
  date: string
  brand_id: string
  total_production: unknown
}

type BatchRow = { work_date: string; units: unknown; status: string }

type MaterialUsageRow = {
  quantity_used: unknown
  unit: string | null
  unit_cost: unknown
  created_at: string
  raw_materials: { material_name: string | null } | null
}

type VoucherRow = {
  voucher_date: string
  status: string
  amount_released: unknown
  actual_expense: unknown
}

type ScheduleRow = {
  staff_registration_id: string
  location_id: string | null
  schedule_date: string
  hours: unknown
  day_type: string | null
  staff: { full_name: string | null } | null
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export type LoadAnalyticsOptions = {
  /** Restrict retail-side figures to one franchise brand; null/undefined = all. */
  franchiseBrandId?: string | null
}

export async function loadAnalytics(
  range: AnalyticsRange,
  options: LoadAnalyticsOptions = {}
): Promise<AnalyticsData> {
  const previousRange = getPreviousRange(range)
  const franchiseBrandId = options.franchiseBrandId || null

  const [
    locations,
    brands,
    dsirReports,
    orders,
    flavorRows,
    storeItemRows,
    stockSummaries,
    batches,
    materialUsageRows,
    vouchers,
    schedules,
    predefinedSalesItems,
  ] = await Promise.all([
    fetchAll<LocationRow>((from, to) =>
      supabase
        .from('locations')
        .select(
          'id, name, brand_id, franchisee, company_owned, is_factory_floor, incentive_regular_sales_threshold, incentive_holiday_sales_threshold, incentive_base_amount'
        )
        .range(from, to)
    ),
    fetchAll<{ id: string; name: string; slug: string | null; brand_role: string | null }>((from, to) =>
      supabase.from('brands').select('id, name, slug, brand_role').range(from, to)
    ),
    // Current + previous period in one query, partitioned client-side.
    fetchAll<DsirReportRow>((from, to) =>
      supabase
        .from('dsir_reports')
        .select(
          'id, location_id, staff_registration_id, staff_name, report_date, gross_sales, net_sales, total_cash, discrepancy, big_cup_sales, small_cup_sales'
        )
        .eq('status', 'submitted')
        .gte('report_date', previousRange.start)
        .lte('report_date', range.end)
        .range(from, to)
    ),
    fetchAll<CustomerOrderRow>((from, to) =>
      supabase
        .from('customer_orders')
        .select(
          'id, created_at, brand_id, location_id, status, total_amount, order_details(quantity, unit_price, products:products(name, category))'
        )
        .in('status', ['paid', 'complete', 'fulfilled'])
        .gte('created_at', previousRange.start + 'T00:00:00')
        .lte('created_at', range.end + 'T23:59:59')
        .range(from, to)
    ),
    fetchAll<FlavorRow>((from, to) =>
      supabase
        .from('dsir_ice_cream_inventory')
        .select('flavor, beginning, arrival, pull_out, ending, dsir_reports!inner(report_date, location_id, status)')
        .eq('dsir_reports.status', 'submitted')
        .gte('dsir_reports.report_date', range.start)
        .lte('dsir_reports.report_date', range.end)
        .range(from, to)
    ),
    fetchAll<StoreItemRow>((from, to) =>
      supabase
        .from('dsir_sales_inventory')
        .select(
          'item_name, sold, sales, price, beginning_inventory, arrival, pull_out, new_inventory, ending_inventory, dsir_reports!inner(report_date, location_id, status)'
        )
        .eq('dsir_reports.status', 'submitted')
        .gte('dsir_reports.report_date', range.start)
        .lte('dsir_reports.report_date', range.end)
        .range(from, to)
    ),
    fetchAll<StockSummaryRow>((from, to) =>
      supabase
        .from('daily_stock_summaries')
        // NOTE: the live table has no total_released column (canonical schema is ahead).
        .select('date, brand_id, total_production')
        .gte('date', previousRange.start)
        .lte('date', range.end)
        .range(from, to)
    ),
    fetchAll<BatchRow>((from, to) =>
      supabase
        .from('factory_production_batches')
        .select('work_date, units, status')
        .neq('status', 'cancelled')
        .gte('work_date', range.start)
        .lte('work_date', range.end)
        .range(from, to)
    ),
    fetchAll<MaterialUsageRow>((from, to) =>
      supabase
        .from('factory_batch_material_usage')
        .select('quantity_used, unit, unit_cost, created_at, raw_materials(material_name)')
        .gte('created_at', range.start + 'T00:00:00')
        .lte('created_at', range.end + 'T23:59:59')
        .range(from, to)
    ),
    fetchAll<VoucherRow>((from, to) =>
      supabase
        .from('accounting_vouchers')
        .select('voucher_date, status, amount_released, actual_expense')
        .in('status', ['approved', 'paid', 'released', 'liquidated'])
        .gte('voucher_date', range.start)
        .lte('voucher_date', range.end)
        .range(from, to)
    ),
    fetchAll<ScheduleRow>((from, to) =>
      supabase
        .from('staff_schedules')
        .select(
          'staff_registration_id, location_id, schedule_date, hours, day_type, staff:staff_registrations(full_name)'
        )
        .eq('is_absent', false)
        .gte('schedule_date', range.start)
        .lte('schedule_date', range.end)
        .range(from, to)
    ),
    fetchAll<{ brand_id: string; name: string; price: unknown }>((from, to) =>
      supabase
        .from('dsir_predefined_items')
        .select('brand_id, name, price')
        .eq('category', 'sales')
        .eq('is_active', true)
        .range(from, to)
    ),
  ])

  const locationById = new Map(locations.map((l) => [l.id, l]))
  const brandNameById = new Map(brands.map((b) => [b.id, b.name]))
  const brandSlugById = new Map(brands.map((b) => [b.id, b.slug]))
  const factoryBrandIds = new Set(
    brands
      .filter((b) => b.brand_role === 'factory' || (b.slug || '').toLowerCase() === 'gfc')
      .map((b) => b.id)
  )
  const companyOwnedLocationIds = locations
    .filter((location) => location.company_owned && !location.is_factory_floor)
    .map((location) => location.id)

  // Live net payroll (matches Payroll module; finalized runs are often empty).
  const [netPayrollCurrent, netPayrollPrevious] = await Promise.all([
    computeLiveNetPayrollTotal(range, companyOwnedLocationIds),
    computeLiveNetPayrollTotal(previousRange, companyOwnedLocationIds),
  ])

  const locationMatchesFilter = (locationId: string | null | undefined): boolean => {
    if (!franchiseBrandId) return true
    if (!locationId) return false
    return locationById.get(locationId)?.brand_id === franchiseBrandId
  }

  // ---- DSIR partitions ----
  const dsirFiltered = dsirReports.filter((r) => locationMatchesFilter(r.location_id))
  const dsirCurrent = dsirFiltered.filter((r) => r.report_date >= range.start)
  const dsirPrevious = dsirFiltered.filter((r) => r.report_date < range.start)

  // ---- Order partitions (created_at is a timestamp; compare on date part) ----
  const orderDate = (o: CustomerOrderRow) => o.created_at.slice(0, 10)
  const ordersFiltered = franchiseBrandId
    ? orders.filter((o) => o.brand_id === franchiseBrandId)
    : orders
  const ordersCurrent = ordersFiltered.filter((o) => orderDate(o) >= range.start)
  const ordersPrevious = ordersFiltered.filter((o) => orderDate(o) < range.start)

  // ---- Stock summary partitions ----
  const summariesFiltered = franchiseBrandId
    ? stockSummaries.filter((s) => s.brand_id === franchiseBrandId)
    : stockSummaries
  const summariesCurrent = summariesFiltered.filter((s) => s.date >= range.start)
  const summariesPrevious = summariesFiltered.filter((s) => s.date < range.start)

  // ---- KPIs ----
  const sum = <T,>(rows: T[], pick: (row: T) => unknown) =>
    rows.reduce((total, row) => total + num(pick(row)), 0)

  const activeFranchiseCountWithOrders = (
    dsirRows: DsirReportRow[],
    orderRows: CustomerOrderRow[]
  ) => {
    const brandIds = new Set<string>()
    dsirRows.forEach((r) => {
      const brandId = locationById.get(r.location_id)?.brand_id
      if (!brandId || factoryBrandIds.has(brandId)) return
      brandIds.add(brandId)
    })
    orderRows.forEach((o) => {
      if (!o.brand_id || factoryBrandIds.has(o.brand_id)) return
      if (franchiseBrandId && o.brand_id !== franchiseBrandId) return
      brandIds.add(o.brand_id)
    })
    return brandIds.size
  }

  const kpis: AnalyticsData['kpis'] = {
    netSales: {
      current: sum(dsirCurrent, (r) => r.net_sales),
      previous: sum(dsirPrevious, (r) => r.net_sales),
    },
    grossSales: {
      current: sum(dsirCurrent, (r) => r.gross_sales),
      previous: sum(dsirPrevious, (r) => r.gross_sales),
    },
    orderRevenue: {
      current: sum(ordersCurrent, (o) => o.total_amount),
      previous: sum(ordersPrevious, (o) => o.total_amount),
    },
    ordersCount: { current: ordersCurrent.length, previous: ordersPrevious.length },
    cashCollected: {
      current: sum(dsirCurrent, (r) => r.total_cash),
      previous: sum(dsirPrevious, (r) => r.total_cash),
    },
    netPayroll: {
      current: netPayrollCurrent,
      previous: netPayrollPrevious,
    },
    activeFranchises: {
      current: activeFranchiseCountWithOrders(dsirCurrent, ordersCurrent),
      previous: activeFranchiseCountWithOrders(dsirPrevious, ordersPrevious),
    },
    productionUnits: {
      current: sum(summariesCurrent, (s) => s.total_production),
      previous: sum(summariesPrevious, (s) => s.total_production),
    },
  }

  // ---- Daily sales trend ----
  const dsirByDate = new Map<string, { net: number; gross: number }>()
  dsirCurrent.forEach((r) => {
    const entry = dsirByDate.get(r.report_date) || { net: 0, gross: 0 }
    entry.net += num(r.net_sales)
    entry.gross += num(r.gross_sales)
    dsirByDate.set(r.report_date, entry)
  })
  const ordersByDate = new Map<string, number>()
  ordersCurrent.forEach((o) => {
    const date = orderDate(o)
    ordersByDate.set(date, (ordersByDate.get(date) || 0) + num(o.total_amount))
  })
  const salesTrend: SalesTrendPoint[] = eachDay(range).map((date) => ({
    date,
    label: shortDayLabel(date),
    netSales: Math.round(dsirByDate.get(date)?.net || 0),
    grossSales: Math.round(dsirByDate.get(date)?.gross || 0),
    orderRevenue: Math.round(ordersByDate.get(date) || 0),
  }))

  // ---- Revenue mix by franchise brand ----
  const revenueByBrandMap = new Map<string, BrandRevenueSlice>()
  const ensureBrandSlice = (brandId: string): BrandRevenueSlice => {
    let slice = revenueByBrandMap.get(brandId)
    if (!slice) {
      slice = {
        brandId,
        name: brandNameById.get(brandId) || 'Unknown brand',
        slug: brandSlugById.get(brandId) || null,
        dsirNetSales: 0,
        orderRevenue: 0,
        total: 0,
      }
      revenueByBrandMap.set(brandId, slice)
    }
    return slice
  }
  dsirCurrent.forEach((r) => {
    const brandId = locationById.get(r.location_id)?.brand_id
    if (brandId) ensureBrandSlice(brandId).dsirNetSales += num(r.net_sales)
  })
  ordersCurrent.forEach((o) => {
    ensureBrandSlice(o.brand_id).orderRevenue += num(o.total_amount)
  })
  const revenueByBrand = Array.from(revenueByBrandMap.values())
    .map((slice) => ({ ...slice, total: slice.dsirNetSales + slice.orderRevenue }))
    .filter((slice) => slice.total > 0)
    .sort((a, b) => b.total - a.total)

  // ---- Top flavors (inventory movement as consumption proxy) ----
  const flavorMap = new Map<string, number>()
  flavorRows.forEach((row) => {
    if (!locationMatchesFilter(row.dsir_reports?.location_id)) return
    const consumed =
      num(row.beginning) + num(row.arrival) - num(row.pull_out) - num(row.ending)
    if (consumed <= 0) return
    const flavor = row.flavor.trim()
    if (!flavor) return
    flavorMap.set(flavor, (flavorMap.get(flavor) || 0) + consumed)
  })
  const topFlavors: FlavorStat[] = Array.from(flavorMap.entries())
    .map(([flavor, consumed]) => ({ flavor, consumed }))
    .sort((a, b) => b.consumed - a.consumed)
    .slice(0, 8)

  // ---- Top store items (DSIR cup SKUs by revenue) ----
  // Rows rarely carry a price, so price quantities from the brand's
  // predefined sales items (falling back to any brand with that item name).
  const priceByBrandItem = new Map<string, number>()
  const priceByItem = new Map<string, number>()
  predefinedSalesItems.forEach((item) => {
    const price = num(item.price)
    if (price <= 0) return
    const normalized = normalizeItemName(item.name)
    priceByBrandItem.set(`${item.brand_id}|${normalized}`, price)
    if (!priceByItem.has(normalized)) priceByItem.set(normalized, price)
  })
  const storeItemMap = new Map<string, ItemSalesStat>()
  storeItemRows.forEach((row) => {
    const locationId = row.dsir_reports?.location_id
    if (!locationMatchesFilter(locationId)) return
    const name = row.item_name.trim()
    if (!name) return
    const quantity = storeItemSoldQuantity(row)
    if (quantity <= 0) return
    const normalized = normalizeItemName(name)
    const brandId = locationId ? locationById.get(locationId)?.brand_id : null
    const price =
      num(row.price) ||
      (brandId ? priceByBrandItem.get(`${brandId}|${normalized}`) : undefined) ||
      priceByItem.get(normalized) ||
      0
    const storedSales = num(row.sales)
    const amount = storedSales > 0 ? storedSales : quantity * price
    const entry = storeItemMap.get(normalized) || { name, quantity: 0, amount: 0 }
    entry.quantity += quantity
    entry.amount += amount
    storeItemMap.set(normalized, entry)
  })
  const topStoreItems = Array.from(storeItemMap.values())
    .filter((item) => item.quantity > 0 || item.amount > 0)
    .sort((a, b) => b.amount - a.amount || b.quantity - a.quantity)
    .slice(0, 8)

  // ---- Top wholesale products (customer orders) ----
  const orderProductMap = new Map<string, ItemSalesStat>()
  ordersCurrent.forEach((order) => {
    ;(order.order_details || []).forEach((line) => {
      const name = line.products?.name?.trim()
      if (!name) return
      const entry = orderProductMap.get(name.toLowerCase()) || { name, quantity: 0, amount: 0 }
      const qty = num(line.quantity)
      entry.quantity += qty
      entry.amount += qty * num(line.unit_price)
      orderProductMap.set(name.toLowerCase(), entry)
    })
  })
  const topOrderProducts = Array.from(orderProductMap.values())
    .sort((a, b) => b.amount - a.amount || b.quantity - a.quantity)
    .slice(0, 8)

  // ---- Weekly factory output ----
  const weekMap = new Map<string, FactoryWeekPoint>()
  const ensureWeek = (date: string): FactoryWeekPoint => {
    const weekStart = weekStartOf(date)
    let week = weekMap.get(weekStart)
    if (!week) {
      week = { weekStart, label: weekLabel(weekStart), production: 0, batchUnits: 0 }
      weekMap.set(weekStart, week)
    }
    return week
  }
  summariesCurrent.forEach((s) => {
    ensureWeek(s.date).production += num(s.total_production)
  })
  batches.forEach((b) => {
    ensureWeek(b.work_date).batchUnits += num(b.units)
  })
  const factoryWeekly = Array.from(weekMap.values())
    .filter((w) => w.production > 0 || w.batchUnits > 0)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))

  // ---- Material usage ----
  const materialMap = new Map<string, MaterialUsageStat>()
  materialUsageRows.forEach((row) => {
    const material = row.raw_materials?.material_name?.trim() || 'Unknown material'
    const key = material.toLowerCase()
    const entry =
      materialMap.get(key) || { material, quantity: 0, unit: row.unit || '', cost: 0 }
    const qty = num(row.quantity_used)
    entry.quantity += qty
    entry.cost += qty * num(row.unit_cost)
    materialMap.set(key, entry)
  })
  const materialUsage = Array.from(materialMap.values())
    .sort((a, b) => b.cost - a.cost || b.quantity - a.quantity)
    .slice(0, 10)
  const materialUsageTotalCost = materialUsage.reduce((total, m) => total + m.cost, 0)

  // ---- Payments ----
  const voucherAmount = (v: VoucherRow) => {
    const actual = num(v.actual_expense)
    return actual > 0 ? actual : num(v.amount_released)
  }
  const vouchersByDate = new Map<string, number>()
  vouchers.forEach((v) => {
    vouchersByDate.set(v.voucher_date, (vouchersByDate.get(v.voucher_date) || 0) + voucherAmount(v))
  })
  const cashByDate = new Map<string, number>()
  dsirCurrent.forEach((r) => {
    cashByDate.set(r.report_date, (cashByDate.get(r.report_date) || 0) + num(r.total_cash))
  })
  const payments: AnalyticsData['payments'] = {
    storeCash: kpis.cashCollected.current,
    orderPayments: kpis.orderRevenue.current,
    voucherOutflow: vouchers.reduce((total, v) => total + voucherAmount(v), 0),
    voucherCount: vouchers.length,
    trend: eachDay(range).map((date) => ({
      date,
      label: shortDayLabel(date),
      storeCash: Math.round(cashByDate.get(date) || 0),
      orderPayments: Math.round(ordersByDate.get(date) || 0),
      voucherOutflow: Math.round(vouchersByDate.get(date) || 0),
    })),
  }

  // ---- Location rankings from portal orders (UI groups by franchise) ----
  type OrderLocationAgg = {
    revenue: number
    orderCount: number
    dates: Set<string>
  }
  const orderLocationAgg = new Map<string, OrderLocationAgg>()
  ordersCurrent.forEach((o) => {
    if (!o.location_id) return
    if (!locationMatchesFilter(o.location_id)) return
    const location = locationById.get(o.location_id)
    if (!location || location.is_factory_floor) return
    if (location.brand_id && factoryBrandIds.has(location.brand_id)) return
    const agg =
      orderLocationAgg.get(o.location_id) ||
      { revenue: 0, orderCount: 0, dates: new Set<string>() }
    agg.revenue += num(o.total_amount)
    agg.orderCount += 1
    agg.dates.add(orderDate(o))
    orderLocationAgg.set(o.location_id, agg)
  })

  const brandOrderTotals = new Map<string, number>()
  locations.forEach((location) => {
    if (!location.brand_id) return
    brandOrderTotals.set(
      location.brand_id,
      (brandOrderTotals.get(location.brand_id) || 0) +
        (orderLocationAgg.get(location.id)?.revenue || 0)
    )
  })

  const locationRankings: LocationRanking[] = locations
    .filter((location) => {
      if (location.is_factory_floor) return false
      if (!location.brand_id) return false
      if (factoryBrandIds.has(location.brand_id)) return false
      if (franchiseBrandId && location.brand_id !== franchiseBrandId) return false
      return true
    })
    .map((location) => {
      const agg = orderLocationAgg.get(location.id)
      const orderDays = agg?.dates.size || 0
      const orderRevenue = agg?.revenue || 0
      return {
        locationId: location.id,
        name: location.name,
        brandId: location.brand_id,
        brandName: brandNameById.get(location.brand_id!) || '—',
        brandSlug: brandSlugById.get(location.brand_id!) || null,
        franchisee: location.franchisee || null,
        companyOwned: !!location.company_owned,
        orderRevenue,
        orderCount: agg?.orderCount || 0,
        orderDays,
        avgDailyOrders: orderDays > 0 ? orderRevenue / orderDays : 0,
      }
    })
    .sort((a, b) => {
      if (a.brandId !== b.brandId) {
        const aBrandTotal = brandOrderTotals.get(a.brandId || '') || 0
        const bBrandTotal = brandOrderTotals.get(b.brandId || '') || 0
        if (bBrandTotal !== aBrandTotal) return bBrandTotal - aBrandTotal
        return a.brandName.localeCompare(b.brandName)
      }
      if (b.orderRevenue !== a.orderRevenue) return b.orderRevenue - a.orderRevenue
      return a.name.localeCompare(b.name)
    })

  // ---- Company-owned location rankings from DSIR performance ----
  type DsirLocationAgg = {
    netSales: number
    grossSales: number
    cashCollected: number
    discrepancy: number
    bigCupSales: number
    smallCupSales: number
    dates: Set<string>
  }
  const dsirLocationAgg = new Map<string, DsirLocationAgg>()
  dsirCurrent.forEach((r) => {
    const agg =
      dsirLocationAgg.get(r.location_id) ||
      {
        netSales: 0,
        grossSales: 0,
        cashCollected: 0,
        discrepancy: 0,
        bigCupSales: 0,
        smallCupSales: 0,
        dates: new Set<string>(),
      }
    agg.netSales += num(r.net_sales)
    agg.grossSales += num(r.gross_sales)
    agg.cashCollected += num(r.total_cash)
    agg.discrepancy += num(r.discrepancy)
    agg.bigCupSales += num(r.big_cup_sales)
    agg.smallCupSales += num(r.small_cup_sales)
    agg.dates.add(r.report_date)
    dsirLocationAgg.set(r.location_id, agg)
  })

  // Cup counts from DSIR sales inventory, keyed by location.
  const cupsByLocation = new Map<string, { big: number; small: number }>()
  storeItemRows.forEach((row) => {
    const locationId = row.dsir_reports?.location_id
    if (!locationId || !locationMatchesFilter(locationId)) return
    const quantity = storeItemSoldQuantity(row)
    if (quantity <= 0) return
    const entry = cupsByLocation.get(locationId) || { big: 0, small: 0 }
    if (isBigCupItem(row.item_name)) entry.big += quantity
    else if (isSmallCupItem(row.item_name)) entry.small += quantity
    cupsByLocation.set(locationId, entry)
  })

  // Delivered pans (portal orders) by location — qty + line cost for the brand's pan category.
  const pansByLocation = new Map<string, { qty: number; cost: number }>()
  ordersCurrent.forEach((order) => {
    if (!order.location_id) return
    if (!locationMatchesFilter(order.location_id)) return
    const location = locationById.get(order.location_id)
    if (!location?.brand_id) return
    const targetCategory = panCategoryForBrand(
      brandSlugById.get(location.brand_id),
      brandNameById.get(location.brand_id)
    )
    if (!targetCategory) return
    ;(order.order_details || []).forEach((line) => {
      const category = (line.products?.category || '').toLowerCase().trim()
      if (category !== targetCategory) return
      const qty = num(line.quantity)
      if (qty <= 0) return
      const entry = pansByLocation.get(order.location_id!) || { qty: 0, cost: 0 }
      entry.qty += qty
      entry.cost += qty * num(line.unit_price)
      pansByLocation.set(order.location_id!, entry)
    })
  })

  const companyOwnedDsirRankings: CompanyOwnedDsirRanking[] = locations
    .filter((location) => {
      if (!location.company_owned) return false
      if (location.is_factory_floor) return false
      if (!location.brand_id) return false
      if (factoryBrandIds.has(location.brand_id)) return false
      if (franchiseBrandId && location.brand_id !== franchiseBrandId) return false
      // Company-owned DSIR boards are for MyChoice and Gelato Filipino only.
      const slug = (brandSlugById.get(location.brand_id) || '').toLowerCase()
      const name = (brandNameById.get(location.brand_id) || '').toLowerCase()
      const isMyChoice = slug.includes('mychoice') || name.includes('mychoice')
      const isGelato = slug.includes('gelato') || name.includes('gelato')
      if (!isMyChoice && !isGelato) return false
      return true
    })
    .map((location) => {
      const agg = dsirLocationAgg.get(location.id)
      const reportDays = agg?.dates.size || 0
      const netSales = agg?.netSales || 0
      const cups = cupsByLocation.get(location.id) || { big: 0, small: 0 }
      const pans = pansByLocation.get(location.id) || { qty: 0, cost: 0 }
      const bigCupSales = agg?.bigCupSales || 0
      const smallCupSales = agg?.smallCupSales || 0
      const totalCupSales = bigCupSales + smallCupSales
      const bigShare = totalCupSales > 0 ? bigCupSales / totalCupSales : 0
      const smallShare = totalCupSales > 0 ? smallCupSales / totalCupSales : 0
      const avgCostPerBigCup =
        cups.big > 0 && pans.cost > 0 ? (pans.cost * bigShare) / cups.big : 0
      const avgCostPerSmallCup =
        cups.small > 0 && pans.cost > 0 ? (pans.cost * smallShare) / cups.small : 0
      const bigUnitPrice = cups.big > 0 ? bigCupSales / cups.big : 0
      const smallUnitPrice = cups.small > 0 ? smallCupSales / cups.small : 0
      return {
        locationId: location.id,
        name: location.name,
        brandId: location.brand_id,
        brandName: brandNameById.get(location.brand_id!) || '—',
        brandSlug: brandSlugById.get(location.brand_id!) || null,
        franchisee: location.franchisee || null,
        netSales,
        grossSales: agg?.grossSales || 0,
        cashCollected: agg?.cashCollected || 0,
        reportDays,
        avgDailySales: reportDays > 0 ? netSales / reportDays : 0,
        discrepancy: agg?.discrepancy || 0,
        bigCupQty: cups.big,
        smallCupQty: cups.small,
        avgBigCups: reportDays > 0 ? cups.big / reportDays : 0,
        avgSmallCups: reportDays > 0 ? cups.small / reportDays : 0,
        bigCupSales,
        smallCupSales,
        pansDelivered: pans.qty,
        panDeliveryCost: pans.cost,
        avgCostPerBigCup,
        avgCostPerSmallCup,
        salesPerPan: pans.qty > 0 ? totalCupSales / pans.qty : 0,
        avgBigCupsPerPan: pans.qty > 0 ? cups.big / pans.qty : 0,
        avgSmallCupsPerPan: pans.qty > 0 ? cups.small / pans.qty : 0,
        allBigOnlyPerPan:
          pans.qty > 0 && bigUnitPrice > 0 ? totalCupSales / bigUnitPrice / pans.qty : 0,
        allSmallOnlyPerPan:
          pans.qty > 0 && smallUnitPrice > 0 ? totalCupSales / smallUnitPrice / pans.qty : 0,
      }
    })
    .sort((a, b) => {
      if (a.brandId !== b.brandId) {
        const rank = (slug: string | null, name: string) => {
          const key = `${slug || ''} ${name}`.toLowerCase()
          if (key.includes('mychoice')) return 0
          if (key.includes('gelato')) return 1
          return 2
        }
        const diff = rank(a.brandSlug, a.brandName) - rank(b.brandSlug, b.brandName)
        if (diff !== 0) return diff
        return a.brandName.localeCompare(b.brandName)
      }
      if (b.netSales !== a.netSales) return b.netSales - a.netSales
      return a.name.localeCompare(b.name)
    })

  // ---- Staff rankings (by store) ----
  type StaffAgg = {
    name: string
    locationId: string
    sales: number
    dates: Set<string>
    hours: number
  }
  const staffAgg = new Map<string, StaffAgg>()
  const staffKey = (staffId: string, locationId: string) => `${staffId}|${locationId}`

  dsirCurrent.forEach((r) => {
    if (!r.staff_registration_id || !r.location_id) return
    const key = staffKey(r.staff_registration_id, r.location_id)
    const agg =
      staffAgg.get(key) ||
      {
        name: r.staff_name?.trim() || 'Unknown',
        locationId: r.location_id,
        sales: 0,
        dates: new Set<string>(),
        hours: 0,
      }
    agg.sales += num(r.gross_sales)
    agg.dates.add(r.report_date)
    staffAgg.set(key, agg)
  })

  schedules.forEach((s) => {
    if (!s.location_id) return
    if (!locationMatchesFilter(s.location_id)) return
    const key = staffKey(s.staff_registration_id, s.location_id)
    const agg = staffAgg.get(key)
    if (!agg) return
    agg.hours += num(s.hours)
    if (agg.name === 'Unknown' && s.staff?.full_name) agg.name = s.staff.full_name
  })

  const staffRankings: StaffRanking[] = Array.from(staffAgg.entries())
    .map(([key, agg]) => {
      const staffId = key.split('|')[0]
      const location = locationById.get(agg.locationId)
      return {
        staffId,
        name: agg.name,
        locationId: agg.locationId,
        locationName: location?.name || 'Unknown location',
        brandName: (location?.brand_id && brandNameById.get(location.brand_id)) || '—',
        sales: agg.sales,
        days: agg.dates.size,
        hours: agg.hours,
        salesPerHour: agg.hours > 0 ? agg.sales / agg.hours : 0,
      }
    })
    // Stores first by total sales, then staff within each store by sales.
    .sort((a, b) => {
      if (a.locationId !== b.locationId) {
        const aLoc = dsirLocationAgg.get(a.locationId)?.netSales || 0
        const bLoc = dsirLocationAgg.get(b.locationId)?.netSales || 0
        if (bLoc !== aLoc) return bLoc - aLoc
        return a.locationName.localeCompare(b.locationName)
      }
      return b.sales - a.sales
    })

  // Overall staff ranking: sum sales across all stores for each person.
  type OverallAgg = {
    name: string
    sales: number
    dates: Set<string>
    hours: number
    discrepancy: number
    stores: Map<string, number>
  }
  const overallAgg = new Map<string, OverallAgg>()
  staffRankings.forEach((row) => {
    const agg =
      overallAgg.get(row.staffId) ||
      {
        name: row.name,
        sales: 0,
        dates: new Set<string>(),
        hours: 0,
        discrepancy: 0,
        stores: new Map<string, number>(),
      }
    agg.name = row.name
    agg.sales += row.sales
    agg.hours += row.hours
    agg.stores.set(row.locationName, (agg.stores.get(row.locationName) || 0) + row.sales)
    overallAgg.set(row.staffId, agg)
  })
  // Distinct selling days + discrepancy from DSIR rows attributed to the staff member.
  dsirCurrent.forEach((r) => {
    if (!r.staff_registration_id) return
    const agg = overallAgg.get(r.staff_registration_id)
    if (!agg) return
    agg.dates.add(r.report_date)
    agg.discrepancy += num(r.discrepancy)
  })

  // Incentives: same store-day rules as payroll (present staff each earn the daily incentive).
  const incentiveLocationIds = Array.from(
    new Set(
      [
        ...dsirCurrent.map((r) => r.location_id),
        ...schedules.map((s) => s.location_id).filter(Boolean),
      ].filter((id): id is string => !!id && locationMatchesFilter(id))
    )
  )
  const dayStatusMap = await fetchDayStatusMapForPeriod(range.start, range.end, incentiveLocationIds)
  const grossByStoreDay = new Map<string, number>()
  dsirCurrent.forEach((r) => {
    if (!r.location_id) return
    const key = `${r.location_id}|${r.report_date}`
    grossByStoreDay.set(key, (grossByStoreDay.get(key) || 0) + num(r.gross_sales))
  })
  const presentByStoreDay = new Map<string, Array<{ staffId: string; dayType: string | null }>>()
  schedules.forEach((s) => {
    if (!s.location_id) return
    if (!locationMatchesFilter(s.location_id)) return
    const key = `${s.location_id}|${s.schedule_date}`
    const group = presentByStoreDay.get(key) || []
    group.push({ staffId: s.staff_registration_id, dayType: s.day_type })
    presentByStoreDay.set(key, group)
  })
  const incentiveByStaff = new Map<string, number>()
  grossByStoreDay.forEach((grossSales, storeDayKey) => {
    const presentStaff = presentByStoreDay.get(storeDayKey) || []
    if (presentStaff.length === 0) return
    const sep = storeDayKey.indexOf('|')
    const locationId = storeDayKey.slice(0, sep)
    const reportDate = storeDayKey.slice(sep + 1)
    const location = locationById.get(locationId)
    const settings = resolveLocationIncentiveSettings(location)
    const dayType = resolveScheduleDayType(reportDate, presentStaff[0]?.dayType, dayStatusMap)
    const isHoliday = dayType === 'regular-holiday' || dayType === 'special-holiday'
    const incentiveAmount = computeDailyIncentive(grossSales, isHoliday, settings)
    if (incentiveAmount <= 0) return
    presentStaff.forEach(({ staffId }) => {
      if (!overallAgg.has(staffId)) return
      incentiveByStaff.set(staffId, (incentiveByStaff.get(staffId) || 0) + incentiveAmount)
    })
  })

  const staffRankingsOverall: OverallStaffRanking[] = Array.from(overallAgg.entries())
    .map(([staffId, agg]) => {
      let topStoreName: string | null = null
      let topStoreSales = -1
      agg.stores.forEach((sales, storeName) => {
        if (sales > topStoreSales) {
          topStoreSales = sales
          topStoreName = storeName
        }
      })
      return {
        staffId,
        name: agg.name,
        sales: agg.sales,
        days: agg.dates.size,
        hours: agg.hours,
        salesPerHour: agg.hours > 0 ? agg.sales / agg.hours : 0,
        storeCount: agg.stores.size,
        topStoreName,
        incentive: incentiveByStaff.get(staffId) || 0,
        discrepancy: agg.discrepancy,
      }
    })
    .sort((a, b) => b.sales - a.sales)

  return {
    range,
    previousRange,
    kpis,
    salesTrend,
    revenueByBrand,
    topFlavors,
    topStoreItems,
    topOrderProducts,
    factoryWeekly,
    factoryBatchCount: batches.length,
    materialUsage,
    materialUsageTotalCost,
    payments,
    locationRankings,
    companyOwnedDsirRankings,
    staffRankings,
    staffRankingsOverall,
  }
}
