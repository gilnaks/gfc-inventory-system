import { resolveScheduleDayType, type DayStatus } from './payroll-calculation'
import { supabase } from './supabase'

export const DEFAULT_INCENTIVE_REGULAR_SALES_THRESHOLD = 10000
export const DEFAULT_INCENTIVE_HOLIDAY_SALES_THRESHOLD = 20000
export const DEFAULT_INCENTIVE_BASE_AMOUNT = 100
export const DEFAULT_INCENTIVE_INCREMENT_AMOUNT = 50
export const DEFAULT_INCENTIVE_INCREMENT_SALES = 5000

export type LocationIncentiveRow = {
  incentive_regular_sales_threshold?: number | null
  incentive_holiday_sales_threshold?: number | null
  incentive_base_amount?: number | null
}

export type LocationIncentiveSettings = {
  regularSalesThreshold: number
  holidaySalesThreshold: number
  baseAmount: number
  incrementAmount: number
  incrementSales: number
  usesCustomRegularThreshold: boolean
  usesCustomHolidayThreshold: boolean
  usesCustomBaseAmount: boolean
}

export function resolveLocationIncentiveSettings(
  row?: LocationIncentiveRow | null
): LocationIncentiveSettings {
  const regular = Number(row?.incentive_regular_sales_threshold)
  const holiday = Number(row?.incentive_holiday_sales_threshold)
  const base = Number(row?.incentive_base_amount)

  return {
    regularSalesThreshold:
      row?.incentive_regular_sales_threshold != null && Number.isFinite(regular) && regular > 0
        ? regular
        : DEFAULT_INCENTIVE_REGULAR_SALES_THRESHOLD,
    holidaySalesThreshold:
      row?.incentive_holiday_sales_threshold != null && Number.isFinite(holiday) && holiday > 0
        ? holiday
        : DEFAULT_INCENTIVE_HOLIDAY_SALES_THRESHOLD,
    baseAmount:
      row?.incentive_base_amount != null && Number.isFinite(base) && base >= 0
        ? base
        : DEFAULT_INCENTIVE_BASE_AMOUNT,
    incrementAmount: DEFAULT_INCENTIVE_INCREMENT_AMOUNT,
    incrementSales: DEFAULT_INCENTIVE_INCREMENT_SALES,
    usesCustomRegularThreshold: row?.incentive_regular_sales_threshold != null,
    usesCustomHolidayThreshold: row?.incentive_holiday_sales_threshold != null,
    usesCustomBaseAmount: row?.incentive_base_amount != null,
  }
}

export function hasCustomIncentiveSettings(row?: LocationIncentiveRow | null): boolean {
  const settings = resolveLocationIncentiveSettings(row)
  return (
    settings.usesCustomRegularThreshold ||
    settings.usesCustomHolidayThreshold ||
    settings.usesCustomBaseAmount
  )
}

/** Tiered daily sales incentive using branch settings or system defaults. */
export function computeDailyIncentive(
  grossSales: number,
  isHoliday: boolean,
  settings?: Pick<
    LocationIncentiveSettings,
    'regularSalesThreshold' | 'holidaySalesThreshold' | 'baseAmount' | 'incrementAmount' | 'incrementSales'
  >
): number {
  const gross = Number(grossSales) || 0
  const regularThreshold =
    settings?.regularSalesThreshold ?? DEFAULT_INCENTIVE_REGULAR_SALES_THRESHOLD
  const holidayThreshold =
    settings?.holidaySalesThreshold ?? DEFAULT_INCENTIVE_HOLIDAY_SALES_THRESHOLD
  const baseAmount = settings?.baseAmount ?? DEFAULT_INCENTIVE_BASE_AMOUNT
  const incrementAmount = settings?.incrementAmount ?? DEFAULT_INCENTIVE_INCREMENT_AMOUNT
  const incrementSales = settings?.incrementSales ?? DEFAULT_INCENTIVE_INCREMENT_SALES

  const threshold = isHoliday ? holidayThreshold : regularThreshold
  if (gross < threshold || incrementSales <= 0) return 0

  return (
    baseAmount + incrementAmount * Math.floor((gross - threshold) / incrementSales)
  )
}

function isHolidayDayType(dayType: DayStatus): boolean {
  return dayType === 'regular-holiday' || dayType === 'special-holiday'
}

export type IncentivePeriodResult = {
  totalsByStaff: Map<string, number>
  byStaffDate: Record<string, Record<string, number>>
}

export async function computeIncentivesForPeriod(params: {
  startDate: string
  endDate: string
  locationIds: string[]
  dayStatusMap: Record<string, string>
}): Promise<IncentivePeriodResult> {
  const totalsByStaff = new Map<string, number>()
  const byStaffDate: Record<string, Record<string, number>> = {}

  if (params.locationIds.length === 0) {
    return { totalsByStaff, byStaffDate }
  }

  const [{ data: dsirReports, error: dsirError }, { data: locationRows, error: locationError }] =
    await Promise.all([
      supabase
        .from('dsir_reports')
        .select('location_id, report_date, gross_sales')
        .in('location_id', params.locationIds)
        .gte('report_date', params.startDate)
        .lte('report_date', params.endDate)
        .eq('status', 'submitted'),
      supabase
        .from('locations')
        .select(
          'id, incentive_regular_sales_threshold, incentive_holiday_sales_threshold, incentive_base_amount'
        )
        .in('id', params.locationIds),
    ])

  if (dsirError) throw dsirError
  if (locationError) throw locationError

  const settingsByLocation = new Map<string, LocationIncentiveSettings>()
  for (const row of locationRows || []) {
    settingsByLocation.set(row.id, resolveLocationIncentiveSettings(row))
  }

  const grossByStoreDay = new Map<string, number>()
  for (const report of dsirReports || []) {
    const key = `${report.location_id}|${report.report_date}`
    const gross = Number(report.gross_sales) || 0
    grossByStoreDay.set(key, (grossByStoreDay.get(key) || 0) + gross)
  }

  const { data: schedules, error: schedError } = await supabase
    .from('staff_schedules')
    .select('staff_registration_id, location_id, schedule_date, day_type, is_absent')
    .in('location_id', params.locationIds)
    .gte('schedule_date', params.startDate)
    .lte('schedule_date', params.endDate)

  if (schedError) throw schedError

  const presentByStoreDay = new Map<
    string,
    Array<{ staffId: string; dayType: string | null }>
  >()

  for (const sched of schedules || []) {
    if (sched.is_absent) continue
    const key = `${sched.location_id}|${sched.schedule_date}`
    const group = presentByStoreDay.get(key) || []
    group.push({
      staffId: sched.staff_registration_id,
      dayType: sched.day_type,
    })
    presentByStoreDay.set(key, group)
  }

  for (const [storeDayKey, grossSales] of Array.from(grossByStoreDay.entries())) {
    const presentStaff = presentByStoreDay.get(storeDayKey) || []
    if (presentStaff.length === 0) continue

    const locationId = storeDayKey.slice(0, storeDayKey.indexOf('|'))
    const reportDate = storeDayKey.slice(storeDayKey.indexOf('|') + 1)
    const dayType = resolveScheduleDayType(
      reportDate,
      presentStaff[0]?.dayType,
      params.dayStatusMap
    )
    const locationSettings = settingsByLocation.get(locationId)
    const incentiveAmount = computeDailyIncentive(
      grossSales,
      isHolidayDayType(dayType),
      locationSettings
    )
    if (incentiveAmount <= 0) continue

    for (const { staffId } of presentStaff) {
      totalsByStaff.set(staffId, (totalsByStaff.get(staffId) || 0) + incentiveAmount)
      if (!byStaffDate[staffId]) byStaffDate[staffId] = {}
      byStaffDate[staffId][reportDate] =
        (byStaffDate[staffId][reportDate] || 0) + incentiveAmount
    }
  }

  return { totalsByStaff, byStaffDate }
}
