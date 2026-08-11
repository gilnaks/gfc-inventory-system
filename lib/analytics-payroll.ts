import { supabase } from './supabase'
import {
  calculateStaffPayrollCoreByWeeks,
  emptyDeductions,
  fetchDayStatusMapForPeriod,
  mergeDayStatusIntoMap,
  type PayrollScheduleRow,
  type StaffDeductions,
} from './payroll-calculation'
import { computeIncentivesForPeriod } from './payroll-incentive'
import { deductionsFromRecord } from './payroll-run-service'

type DateRange = { start: string; end: string }

const PAGE_SIZE = 1000

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

type DeductionRow = {
  staff_id: string
  utilities: number | null
  shortages: number | null
  cash_advances: number | null
  penalties: number | null
  others: number | null
  refunds: number | null
}

/**
 * Live net payroll for a date range — same basis as the Payroll module
 * (schedules + incentives + saved deductions), not only finalized payroll_runs.
 */
export async function computeLiveNetPayrollTotal(
  range: DateRange,
  companyOwnedLocationIds: string[]
): Promise<number> {
  const [staffRows, scheduleRows, deductionRows] = await Promise.all([
    fetchAll<{ id: string; hourly_rate: unknown }>((from, to) =>
      supabase.from('staff_registrations').select('id, hourly_rate').range(from, to)
    ),
    fetchAll<
      PayrollScheduleRow & {
        staff_registration_id: string
        day_type: string | null
      }
    >((from, to) =>
      supabase
        .from('staff_schedules')
        .select(
          'staff_registration_id, schedule_date, hours, is_absent, day_type, location:locations(id, name, brand_id, is_factory_floor, brand:brands(id, name))'
        )
        .gte('schedule_date', range.start)
        .lte('schedule_date', range.end)
        .range(from, to)
    ),
    fetchAll<DeductionRow>((from, to) =>
      supabase
        .from('payroll_deductions_refunds')
        .select('staff_id, utilities, shortages, cash_advances, penalties, others, refunds')
        .gte('week_end_date', range.start)
        .lte('week_start_date', range.end)
        .range(from, to)
    ),
  ])

  if (scheduleRows.length === 0) return 0

  const rateByStaff = new Map(staffRows.map((s) => [s.id, Number(s.hourly_rate) || 0]))
  const locationIds = Array.from(
    new Set(
      scheduleRows
        .map((s) => s.location?.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  )

  const dayStatusMap = await fetchDayStatusMapForPeriod(range.start, range.end, locationIds)
  scheduleRows.forEach((schedule) => {
    mergeDayStatusIntoMap(dayStatusMap, schedule.schedule_date, schedule.day_type || 'default')
  })

  const incentiveData = await computeIncentivesForPeriod({
    startDate: range.start,
    endDate: range.end,
    locationIds: companyOwnedLocationIds,
    dayStatusMap,
  })

  const deductionsByStaff = new Map<string, StaffDeductions>()
  const refundsByStaff = new Map<string, number>()
  deductionRows.forEach((row) => {
    const fromRecord = deductionsFromRecord(row)
    const existing = deductionsByStaff.get(row.staff_id) || emptyDeductions()
    deductionsByStaff.set(row.staff_id, {
      utilities: existing.utilities + fromRecord.utilities,
      shortages: existing.shortages + fromRecord.shortages,
      cashAdvances: existing.cashAdvances + fromRecord.cashAdvances,
      penalties: existing.penalties + fromRecord.penalties,
      others: existing.others + fromRecord.others,
    })
    refundsByStaff.set(
      row.staff_id,
      (refundsByStaff.get(row.staff_id) || 0) + (Number(row.refunds) || 0)
    )
  })

  const schedulesByStaff = new Map<string, PayrollScheduleRow[]>()
  scheduleRows.forEach((row) => {
    const list = schedulesByStaff.get(row.staff_registration_id) || []
    list.push(row)
    schedulesByStaff.set(row.staff_registration_id, list)
  })

  let totalNetPay = 0
  schedulesByStaff.forEach((schedules, staffId) => {
    const calc = calculateStaffPayrollCoreByWeeks({
      hourlyRate: rateByStaff.get(staffId) || 0,
      schedules,
      dayStatusMap,
      deductions: deductionsByStaff.get(staffId) || emptyDeductions(),
      refunds: refundsByStaff.get(staffId) || 0,
      incentive: incentiveData.totalsByStaff.get(staffId) || 0,
    })
    totalNetPay += calc.netPay
  })

  return totalNetPay
}
