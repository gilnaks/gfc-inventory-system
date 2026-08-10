import {
  fetchAttendanceSummariesForPeriod,
  parseAttendanceHoursLabel,
  type AttendanceDailySummary,
} from './gfc-attendance'
import { resolveScheduleDayType } from './payroll-calculation'
import { gfcMainHasExplicitScheduleHours } from './gfc-main-branches'
import { getPhilippinesDate } from './timezone'

export type FactoryLocationInfo = {
  id: string
  name: string
  brand_id: string
  is_factory_floor: boolean
  brand?: { id: string; name: string } | null
}

type StaffForAttendanceMerge = {
  id: string
  staff_assignments?: Array<{
    location_id: string
    locations?: { id: string; name?: string }
  }>
}

type ScheduleRow = {
  staff_registration_id: string
  schedule_date: string
  hours?: number | null
  is_absent?: boolean | null
  day_type?: string | null
  location?: FactoryLocationInfo | null
  [key: string]: unknown
}

function resolveFactoryLocationForStaff(
  staff: StaffForAttendanceMerge,
  factoryLocations: FactoryLocationInfo[]
): FactoryLocationInfo | null {
  if (factoryLocations.length === 0) return null
  const factoryLocIds = new Set(factoryLocations.map((l) => l.id))
  const assignment = staff.staff_assignments?.find((a) => factoryLocIds.has(a.location_id))
  if (!assignment) return factoryLocations[0]
  return factoryLocations.find((l) => l.id === assignment.location_id) ?? factoryLocations[0]
}

function buildGfcStaffSchedules(
  staff: StaffForAttendanceMerge,
  staffSchedules: ScheduleRow[],
  staffAttendance: AttendanceDailySummary[],
  factoryLocation: FactoryLocationInfo | null,
  dayStatusMap: Record<string, string>,
  todayYmd: string
): ScheduleRow[] {
  const scheduleByDate = new Map(staffSchedules.map((s) => [s.schedule_date, s]))
  const attendanceByDate = new Map(
    staffAttendance
      .filter((a) => a.staff_registration_id === staff.id)
      .map((a) => [a.work_date, a])
  )

  const allDates = new Set([
    ...Array.from(scheduleByDate.keys()),
    ...Array.from(attendanceByDate.keys()),
  ])
  const rows: ScheduleRow[] = []

  for (const date of Array.from(allDates).sort()) {
    const att = attendanceByDate.get(date)
    const sched = scheduleByDate.get(date)
    const dayType = resolveScheduleDayType(date, sched?.day_type, dayStatusMap)
    const isFutureDate = date > todayYmd
    const hasScheduleHoursOverride =
      sched != null && gfcMainHasExplicitScheduleHours(sched.hours)

    let hours: number
    let isAbsent: boolean

    if (sched?.is_absent) {
      hours = 0
      isAbsent = true
    } else if (hasScheduleHoursOverride) {
      hours = Number(sched!.hours) || 0
      isAbsent = hours === 0
    } else if (isFutureDate) {
      hours = 0
      isAbsent = false
    } else {
      hours = att ? parseAttendanceHoursLabel(att.hours) : 0
      isAbsent = hours === 0
    }

    if (sched) {
      rows.push({
        ...sched,
        hours,
        is_absent: isAbsent,
        day_type: dayType,
      })
    } else if (hours > 0 && factoryLocation) {
      rows.push({
        staff_registration_id: staff.id,
        schedule_date: date,
        hours,
        is_absent: false,
        day_type: dayType,
        location: factoryLocation,
      })
    }
  }

  return rows
}

/** Replace schedule hours with biometric attendance for GFC main (factory floor) staff. */
export async function enrichSchedulesWithAttendance(params: {
  scheduleData: ScheduleRow[]
  startDate: string
  endDate: string
  gfcMainStaffIds: Set<string>
  staffData: StaffForAttendanceMerge[]
  factoryLocations: FactoryLocationInfo[]
  dayStatusMap?: Record<string, string>
  todayYmd?: string
}): Promise<ScheduleRow[]> {
  const {
    scheduleData,
    startDate,
    endDate,
    gfcMainStaffIds,
    staffData,
    factoryLocations,
    dayStatusMap = {},
    todayYmd = getPhilippinesDate(),
  } = params

  if (gfcMainStaffIds.size === 0) return scheduleData

  let attendanceSummaries: AttendanceDailySummary[] = []
  try {
    attendanceSummaries = await fetchAttendanceSummariesForPeriod(
      startDate,
      endDate,
      gfcMainStaffIds
    )
  } catch (err) {
    console.warn('Could not load attendance for payroll merge:', err)
    return scheduleData
  }

  const retailSchedules = scheduleData.filter(
    (s) => !gfcMainStaffIds.has(s.staff_registration_id)
  )

  const gfcStaffInScope = staffData.filter((s) => gfcMainStaffIds.has(s.id))
  const gfcSchedules: ScheduleRow[] = []

  for (const staffMember of gfcStaffInScope) {
    const staffSchedules = scheduleData.filter((s) => s.staff_registration_id === staffMember.id)
    const staffAttendance = attendanceSummaries.filter(
      (a) => a.staff_registration_id === staffMember.id
    )
    const factoryLocation = resolveFactoryLocationForStaff(staffMember, factoryLocations)

    gfcSchedules.push(
      ...buildGfcStaffSchedules(
        staffMember,
        staffSchedules,
        staffAttendance,
        factoryLocation,
        dayStatusMap,
        todayYmd
      )
    )
  }

  return [...retailSchedules, ...gfcSchedules].sort((a, b) => {
    const dateCmp = a.schedule_date.localeCompare(b.schedule_date)
    if (dateCmp !== 0) return dateCmp
    return a.staff_registration_id.localeCompare(b.staff_registration_id)
  })
}
