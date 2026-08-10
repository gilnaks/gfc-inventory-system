import { getPhilippinesWeekRange } from './gfc-attendance'
import { supabase } from './supabase'

export type DayStatus = 'default' | 'regular-holiday' | 'special-holiday'

const DAY_STATUS_PRIORITY: Record<DayStatus, number> = {
  default: 0,
  'special-holiday': 1,
  'regular-holiday': 2,
}

export function mergeDayStatusIntoMap(
  map: Record<string, DayStatus>,
  date: string,
  dayType: string | null | undefined
) {
  if (!dayType || dayType === 'default') return
  const incoming = dayType as DayStatus
  if (!DAY_STATUS_PRIORITY[incoming]) return
  const current = map[date] || 'default'
  if (DAY_STATUS_PRIORITY[incoming] > DAY_STATUS_PRIORITY[current]) {
    map[date] = incoming
  }
}

/** Holiday marks from staff schedule calendar for a payroll period. */
export async function fetchDayStatusMapForPeriod(
  startDate: string,
  endDate: string,
  locationIds: string[]
): Promise<Record<string, DayStatus>> {
  const map: Record<string, DayStatus> = {}
  if (locationIds.length === 0) return map

  const { data, error } = await supabase
    .from('staff_schedules')
    .select('schedule_date, day_type')
    .gte('schedule_date', startDate)
    .lte('schedule_date', endDate)
    .in('location_id', locationIds)
    .in('day_type', ['regular-holiday', 'special-holiday'])

  if (error) throw error

  for (const row of data || []) {
    mergeDayStatusIntoMap(map, row.schedule_date as string, row.day_type as string)
  }

  return map
}

export function resolveScheduleDayType(
  scheduleDate: string,
  scheduleDayType: string | null | undefined,
  dayStatusMap: Record<string, string>
): DayStatus {
  const fromMap = dayStatusMap[scheduleDate] as DayStatus | undefined
  if (fromMap && fromMap !== 'default') return fromMap
  if (scheduleDayType && scheduleDayType !== 'default') {
    return scheduleDayType as DayStatus
  }
  return fromMap || 'default'
}

export type StaffDeductions = {
  utilities: number
  shortages: number
  cashAdvances: number
  penalties: number
  others: number
}

export type PayrollScheduleRow = {
  schedule_date: string
  hours?: number | null
  is_absent?: boolean | null
  day_type?: string | null
  location?: {
    id?: string
    name?: string
    brand_id?: string
    is_factory_floor?: boolean | null
    brand?: { id?: string; name?: string }
  } | null
}

export type PayrollCalcInput = {
  hourlyRate: number
  schedules: PayrollScheduleRow[]
  dayStatusMap: Record<string, string>
  deductions?: StaffDeductions
  refunds?: number
  incentive?: number
}

export type PayrollCalcResult = {
  totalHours: number
  regularHours: number
  doublePayHours: number
  specialPayHours: number
  overtimeHours: number
  regularPay: number
  overtimePay: number
  doublePay: number
  specialPay: number
  incentivePay: number
  grossPay: number
  deductions: StaffDeductions
  refunds: number
  totalDeductions: number
  netPay: number
  minimumDailyRate: number
}

export type BrandPayAllocation = {
  brandId: string
  brandName: string
  hours: number
  grossPay: number
  totalDeductions: number
  refunds: number
  netPay: number
  withholdingsOther: number
  cashAdvancesWithheld: number
}

const EMPTY_DEDUCTIONS: StaffDeductions = {
  utilities: 0,
  shortages: 0,
  cashAdvances: 0,
  penalties: 0,
  others: 0,
}

function scheduleHours(schedule: PayrollScheduleRow): number {
  if (schedule.is_absent) return 0
  if (schedule.hours != null) {
    return Number(schedule.hours) || 0
  }
  return schedule.location?.is_factory_floor ? 0 : 11
}

export function resolvePayrollBrandId(
  schedule: PayrollScheduleRow,
  factoryBrandId?: string | null
): string | null {
  if (schedule.location?.is_factory_floor && factoryBrandId) {
    return factoryBrandId
  }
  return schedule.location?.brand_id || schedule.location?.brand?.id || null
}

export function groupSchedulesByPhilippinesWeek(
  schedules: PayrollScheduleRow[]
): Map<string, PayrollScheduleRow[]> {
  const groups = new Map<string, PayrollScheduleRow[]>()
  for (const schedule of schedules) {
    const { start } = getPhilippinesWeekRange(schedule.schedule_date)
    const group = groups.get(start) || []
    group.push(schedule)
    groups.set(start, group)
  }
  return groups
}

function mergePayrollCalcResults(
  calcs: PayrollCalcResult[],
  deductions?: StaffDeductions,
  refunds?: number,
  hourlyRate?: number,
  incentive?: number
): PayrollCalcResult {
  const merged = calcs.reduce(
    (acc, calc) => ({
      totalHours: acc.totalHours + calc.totalHours,
      regularHours: acc.regularHours + calc.regularHours,
      doublePayHours: acc.doublePayHours + calc.doublePayHours,
      specialPayHours: acc.specialPayHours + calc.specialPayHours,
      overtimeHours: acc.overtimeHours + calc.overtimeHours,
      regularPay: acc.regularPay + calc.regularPay,
      overtimePay: acc.overtimePay + calc.overtimePay,
      doublePay: acc.doublePay + calc.doublePay,
      specialPay: acc.specialPay + calc.specialPay,
      grossPay: acc.grossPay + calc.grossPay,
      minimumDailyRate: calc.minimumDailyRate,
    }),
    {
      totalHours: 0,
      regularHours: 0,
      doublePayHours: 0,
      specialPayHours: 0,
      overtimeHours: 0,
      regularPay: 0,
      overtimePay: 0,
      doublePay: 0,
      specialPay: 0,
      grossPay: 0,
      minimumDailyRate: (Number(hourlyRate) || 0) * 8,
    }
  )

  const finalDeductions = deductions ?? emptyDeductions()
  const finalRefunds = Number(refunds) || 0
  const incentivePay = Number(incentive) || 0
  const totalDeductions = Object.values(finalDeductions).reduce((sum, value) => sum + value, 0)

  return {
    ...merged,
    incentivePay,
    grossPay: merged.grossPay,
    deductions: finalDeductions,
    refunds: finalRefunds,
    totalDeductions,
    netPay: merged.grossPay + incentivePay - totalDeductions + finalRefunds,
  }
}

/** Apply weekly payroll rules (48hr OT, holiday pay) per Philippines week, then sum. */
export function calculateStaffPayrollCoreByWeeks(input: PayrollCalcInput): PayrollCalcResult {
  if (input.schedules.length === 0) {
    return calculateStaffPayrollCore(input)
  }

  const weekGroups = groupSchedulesByPhilippinesWeek(input.schedules)
  const weeklyCalcs = Array.from(weekGroups.values()).map((weekSchedules) =>
    calculateStaffPayrollCore({
      ...input,
      schedules: weekSchedules,
      deductions: emptyDeductions(),
      refunds: 0,
    })
  )

  return mergePayrollCalcResults(
    weeklyCalcs,
    input.deductions,
    input.refunds,
    input.hourlyRate,
    input.incentive
  )
}

export function calculateStaffPayrollCore(input: PayrollCalcInput): PayrollCalcResult {
  const hourlyRate = Number(input.hourlyRate) || 0
  const minimumDailyRate = hourlyRate * 8
  const overtimeHourlyRate = hourlyRate * 1.25

  let totalHours = 0
  let regularHours = 0
  let doublePayHours = 0
  let specialPayHours = 0

  input.schedules.forEach((schedule) => {
    const hours = scheduleHours(schedule)
    const dayStatus = resolveScheduleDayType(
      schedule.schedule_date,
      schedule.day_type,
      input.dayStatusMap
    )
    totalHours += hours
    const first8Hours = Math.min(8, hours)
    switch (dayStatus) {
      case 'regular-holiday':
        doublePayHours += first8Hours
        break
      case 'special-holiday':
        specialPayHours += first8Hours
        break
      default:
        regularHours += first8Hours
        break
    }
  })

  const overtimeHours = Math.max(0, totalHours - 48)

  let excessRegularDayHours = 0
  input.schedules.forEach((schedule) => {
    const hours = scheduleHours(schedule)
    const dayStatus = resolveScheduleDayType(
      schedule.schedule_date,
      schedule.day_type,
      input.dayStatusMap
    )
    if (dayStatus === 'default') {
      excessRegularDayHours += Math.max(0, hours - 8)
    }
  })

  if (totalHours >= 48) {
    const hoursNeededToReach48 = Math.max(0, 48 - regularHours)
    regularHours += Math.min(hoursNeededToReach48, excessRegularDayHours)
    regularHours = Math.min(48, regularHours)
  } else {
    regularHours += excessRegularDayHours
  }

  const regularPay = regularHours * hourlyRate
  const overtimePay = overtimeHours * overtimeHourlyRate
  const doublePay = doublePayHours * hourlyRate * 2
  const specialPay = specialPayHours * hourlyRate * 1.3
  const incentivePay = Number(input.incentive) || 0
  const grossPay = regularPay + overtimePay + doublePay + specialPay
  const totalGrossPay = grossPay + incentivePay

  const deductions: StaffDeductions = {
    utilities: Number(input.deductions?.utilities) || 0,
    shortages: Number(input.deductions?.shortages) || 0,
    cashAdvances: Number(input.deductions?.cashAdvances) || 0,
    penalties: Number(input.deductions?.penalties) || 0,
    others: Number(input.deductions?.others) || 0,
  }
  const refunds = Number(input.refunds) || 0
  const totalDeductions = Object.values(deductions).reduce((s, v) => s + v, 0)
  const netPay = totalGrossPay - totalDeductions + refunds

  return {
    totalHours,
    regularHours,
    doublePayHours,
    specialPayHours,
    overtimeHours,
    regularPay,
    overtimePay,
    doublePay,
    specialPay,
    incentivePay,
    grossPay,
    deductions,
    refunds,
    totalDeductions,
    netPay,
    minimumDailyRate,
  }
}

function allocateAmount(total: number, brandHours: Map<string, number>, totalHours: number): Map<string, number> {
  const result = new Map<string, number>()
  if (totalHours <= 0 || total <= 0) return result
  let allocated = 0
  const entries = Array.from(brandHours.entries())
  entries.forEach(([brandId, hours], idx) => {
    const isLast = idx === entries.length - 1
    const share = isLast
      ? Math.round((total - allocated) * 100) / 100
      : Math.round((total * hours) / totalHours * 100) / 100
    result.set(brandId, share)
    allocated += share
  })
  return result
}

export function allocatePayByBrand(
  schedules: PayrollScheduleRow[],
  calc: Pick<
    PayrollCalcResult,
    'grossPay' | 'incentivePay' | 'totalDeductions' | 'refunds' | 'netPay' | 'deductions'
  >,
  brandNames?: Map<string, string>,
  factoryBrandId?: string | null
): BrandPayAllocation[] {
  const brandHours = new Map<string, number>()
  schedules.forEach((schedule) => {
    const brandId = resolvePayrollBrandId(schedule, factoryBrandId)
    if (!brandId) return
    const hours = scheduleHours(schedule)
    brandHours.set(brandId, (brandHours.get(brandId) || 0) + hours)
  })

  const totalHours = Array.from(brandHours.values()).reduce((s, h) => s + h, 0)
  if (totalHours <= 0) return []

  const totalGrossPay = calc.grossPay + calc.incentivePay
  const grossMap = allocateAmount(totalGrossPay, brandHours, totalHours)
  const netMap = allocateAmount(calc.netPay, brandHours, totalHours)
  const refundsMap = allocateAmount(calc.refunds, brandHours, totalHours)
  const totalDedMap = allocateAmount(calc.totalDeductions, brandHours, totalHours)
  const cashAdvMap = allocateAmount(calc.deductions.cashAdvances, brandHours, totalHours)
  const withholdMap = allocateAmount(
    calc.deductions.utilities +
      calc.deductions.shortages +
      calc.deductions.penalties +
      calc.deductions.others,
    brandHours,
    totalHours
  )

  return Array.from(brandHours.entries()).map(([brandId, hours]) => ({
    brandId,
    brandName: brandNames?.get(brandId) || brandId,
    hours,
    grossPay: grossMap.get(brandId) || 0,
    totalDeductions: totalDedMap.get(brandId) || 0,
    refunds: refundsMap.get(brandId) || 0,
    netPay: netMap.get(brandId) || 0,
    withholdingsOther: withholdMap.get(brandId) || 0,
    cashAdvancesWithheld: cashAdvMap.get(brandId) || 0,
  }))
}

export function emptyDeductions(): StaffDeductions {
  return { ...EMPTY_DEDUCTIONS }
}
