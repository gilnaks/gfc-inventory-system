import { supabase } from './supabase'
import {
  formatPhilippinesWeekLabel,
  getPhilippinesWeekRange,
  loadGfcMainFactoryLocations,
  loadGfcMainStaff,
  shiftPhilippinesWeek,
} from './gfc-attendance'
import { getPhilippinesDate } from './timezone'
import {
  calculateStaffPayrollCoreByWeeks,
  fetchDayStatusMapForPeriod,
  mergeDayStatusIntoMap,
  type PayrollCalcResult,
  type PayrollScheduleRow,
  type StaffDeductions,
} from './payroll-calculation'
import { enrichSchedulesWithAttendance } from './payroll-attendance'
import { fetchOpenAdvanceBalancesByStaff } from './staff-advance-service'

export const STAFF_PAYROLL_MAX_WEEKS_BACK = 26

export type StaffPayrollDayRow = {
  scheduleDate: string
  dayName: string
  dateLabel: string
  locationName: string
  brandName: string
  hours: number
  dayType: 'default' | 'regular-holiday' | 'special-holiday'
  isAbsent: boolean
}

export type StaffWeekPayrollView = {
  weekStart: string
  weekEnd: string
  weekLabel: string
  isCurrentWeek: boolean
  staffName: string
  hourlyRate: number
  calc: PayrollCalcResult
  days: StaffPayrollDayRow[]
  locationGroups: Record<
    string,
    Array<{
      dateLabel: string
      dayName: string
      hours: number
      scheduleDate: string
      brandName: string
      isAbsent: boolean
    }>
  >
}

function scheduleHours(schedule: PayrollScheduleRow): number {
  if (schedule.is_absent) return 0
  if (schedule.hours != null) {
    return Number(schedule.hours) || 0
  }
  return schedule.location?.is_factory_floor ? 0 : 11
}

async function loadWeekDeductionsForStaff(
  staffId: string,
  weekStart: string,
  weekEnd: string,
  isCurrentWeek: boolean
): Promise<{ deductions: StaffDeductions; refunds: number }> {
  const { data: saved } = await supabase
    .from('payroll_deductions_refunds')
    .select('*')
    .eq('staff_id', staffId)
    .eq('week_start_date', weekStart)
    .eq('week_end_date', weekEnd)
    .maybeSingle()

  let shortages = Number(saved?.shortages) || 0
  let cashAdvances = Number(saved?.cash_advances) || 0

  if (shortages <= 0) {
    const { data: dsirReports } = await supabase
      .from('dsir_reports')
      .select('discrepancy')
      .eq('staff_registration_id', staffId)
      .gte('report_date', weekStart)
      .lte('report_date', weekEnd)
      .eq('status', 'submitted')

    for (const report of dsirReports || []) {
      const discrepancy = Number(report.discrepancy) || 0
      if (discrepancy < 0) shortages += Math.abs(discrepancy)
    }
  }

  if (isCurrentWeek && cashAdvances <= 0) {
    const openAdvances = await fetchOpenAdvanceBalancesByStaff([staffId])
    cashAdvances = openAdvances.get(staffId) || 0
  }

  return {
    deductions: {
      utilities: Number(saved?.utilities) || 0,
      shortages,
      cashAdvances,
      penalties: Number(saved?.penalties) || 0,
      others: Number(saved?.others) || 0,
    },
    refunds: Number(saved?.refunds) || 0,
  }
}

function buildDayRows(schedules: PayrollScheduleRow[]): StaffPayrollDayRow[] {
  const byDate = new Map<string, PayrollScheduleRow>()
  for (const schedule of schedules) {
    const existing = byDate.get(schedule.schedule_date)
    if (!existing || scheduleHours(schedule) > scheduleHours(existing)) {
      byDate.set(schedule.schedule_date, schedule)
    }
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([scheduleDate, schedule]) => {
      const dateObj = new Date(`${scheduleDate}T12:00:00`)
      return {
        scheduleDate,
        dayName: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
        dateLabel: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        locationName: schedule.location?.name || 'Unknown',
        brandName: schedule.location?.brand?.name || 'Unknown Brand',
        hours: scheduleHours(schedule),
        dayType: (schedule.day_type as StaffPayrollDayRow['dayType']) || 'default',
        isAbsent: Boolean(schedule.is_absent),
      }
    })
}

function buildLocationGroups(schedules: PayrollScheduleRow[]) {
  const locationGroups: StaffWeekPayrollView['locationGroups'] = {}

  for (const schedule of schedules) {
    const locationName = schedule.location?.name || 'Unknown'
    const brandName = schedule.location?.brand?.name || 'Unknown Brand'
    const scheduleDate = schedule.schedule_date
    const dateObj = new Date(`${scheduleDate}T12:00:00`)
    const hours = scheduleHours(schedule)
    const isAbsent = Boolean(schedule.is_absent)

    if (!locationGroups[locationName]) {
      locationGroups[locationName] = []
    }

    const existing = locationGroups[locationName].find((d) => d.scheduleDate === scheduleDate)
    if (existing) {
      existing.hours = Math.max(existing.hours, hours)
      existing.isAbsent = isAbsent
    } else {
      locationGroups[locationName].push({
        dateLabel: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dayName: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
        hours,
        scheduleDate,
        brandName,
        isAbsent,
      })
    }
  }

  for (const days of Object.values(locationGroups)) {
    days.sort((a, b) => a.scheduleDate.localeCompare(b.scheduleDate))
  }

  return locationGroups
}

export function getStaffPayrollWeekStart(anchorYmd?: string): string {
  const anchor = anchorYmd || getPhilippinesDate()
  return getPhilippinesWeekRange(anchor).start
}

export function canGoToOlderStaffPayrollWeek(weekStart: string): boolean {
  const currentStart = getStaffPayrollWeekStart()
  const oldest = shiftPhilippinesWeek(currentStart, -STAFF_PAYROLL_MAX_WEEKS_BACK)
  return weekStart > oldest
}

export function canGoToNewerStaffPayrollWeek(weekStart: string): boolean {
  const currentStart = getStaffPayrollWeekStart()
  return weekStart < currentStart
}

export async function loadStaffWeekPayroll(
  staffId: string,
  weekStartYmd: string
): Promise<StaffWeekPayrollView> {
  const { start: weekStart, end: weekEnd } = getPhilippinesWeekRange(weekStartYmd)
  const currentWeekStart = getStaffPayrollWeekStart()
  const isCurrentWeek = weekStart === currentWeekStart
  const today = getPhilippinesDate()

  const { data: staff, error: staffError } = await supabase
    .from('staff_registrations')
    .select(`
      id,
      full_name,
      hourly_rate,
      staff_assignments(
        id,
        location_id
      )
    `)
    .eq('id', staffId)
    .single()

  if (staffError || !staff) {
    throw new Error(staffError?.message || 'Could not load staff profile')
  }

  const { data: scheduleData, error: scheduleError } = await supabase
    .from('staff_schedules')
    .select(`
      *,
      location:locations(id, name, brand_id, is_factory_floor, brand:brands(id, name))
    `)
    .eq('staff_registration_id', staffId)
    .gte('schedule_date', weekStart)
    .lte('schedule_date', weekEnd)
    .order('schedule_date', { ascending: true })

  if (scheduleError) throw scheduleError

  let mergedSchedules = (scheduleData || []) as PayrollScheduleRow[]

  const [gfcStaff, factoryLocs] = await Promise.all([
    loadGfcMainStaff().catch(() => []),
    loadGfcMainFactoryLocations().catch(() => []),
  ])

  const gfcMainStaffIds = new Set(gfcStaff.map((s) => s.id))
  if (gfcMainStaffIds.has(staffId)) {
    const locationIds = Array.from(
      new Set(mergedSchedules.map((s) => s.location?.id).filter(Boolean) as string[])
    )

    let dayStatusMap = await fetchDayStatusMapForPeriod(weekStart, weekEnd, locationIds)
    mergedSchedules.forEach((schedule) => {
      mergeDayStatusIntoMap(dayStatusMap, schedule.schedule_date, schedule.day_type)
    })

    try {
      const staffForAttendance = {
        id: staff.id,
        staff_assignments: (staff.staff_assignments || []).map((assignment: {
          location_id: string
        }) => ({
          location_id: assignment.location_id,
        })),
      }

      mergedSchedules = (await enrichSchedulesWithAttendance({
        scheduleData: scheduleData || [],
        startDate: weekStart,
        endDate: weekEnd,
        gfcMainStaffIds,
        staffData: [staffForAttendance],
        factoryLocations: factoryLocs,
        dayStatusMap,
        todayYmd: today,
      })) as PayrollScheduleRow[]
    } catch {
      // fall back to schedule hours
    }
  }

  const locationIds = Array.from(
    new Set(mergedSchedules.map((s) => s.location?.id).filter(Boolean) as string[])
  )
  const dayStatusMap = await fetchDayStatusMapForPeriod(weekStart, weekEnd, locationIds)
  mergedSchedules.forEach((schedule) => {
    mergeDayStatusIntoMap(dayStatusMap, schedule.schedule_date, schedule.day_type)
  })

  const { deductions, refunds } = await loadWeekDeductionsForStaff(
    staffId,
    weekStart,
    weekEnd,
    isCurrentWeek
  )

  const earnedSchedules = mergedSchedules.filter((schedule) => schedule.schedule_date <= today)

  const calc = calculateStaffPayrollCoreByWeeks({
    hourlyRate: Number(staff.hourly_rate) || 0,
    schedules: earnedSchedules,
    dayStatusMap,
    deductions,
    refunds,
  })

  return {
    weekStart,
    weekEnd,
    weekLabel: formatPhilippinesWeekLabel(weekStart, weekEnd),
    isCurrentWeek,
    staffName: staff.full_name,
    hourlyRate: Number(staff.hourly_rate) || 0,
    calc,
    days: buildDayRows(mergedSchedules),
    locationGroups: buildLocationGroups(mergedSchedules),
  }
}
