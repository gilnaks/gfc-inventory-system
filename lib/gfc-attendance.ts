import { supabase } from './supabase'
import { getPhilippinesDate, manilaDateTimeToUtc, PHILIPPINES_TIMEZONE } from './timezone'
import { FACTORY_BRAND_SLUG } from './brand-roles'

export type GfcMainStaff = {
  id: string
  full_name: string
}

export type ParsedAttendancePunch = {
  enrollment_no: number
  terminal_no: number | null
  verify_mode: number | null
  device_name: string
  work_date: string
  punch_at: string
}

export type AttendanceDailySummary = {
  work_date: string
  staff_registration_id: string | null
  staff_name: string
  time_in: string | null
  time_out: string | null
  /** Net working hours after break deduction. */
  hours: string | null
  /** Raw hours from first/last punch before break deduction. */
  gross_hours: string | null
  /** Manual break hours entered by admin. */
  break_hours: number
  punch_count: number
}

export type AttendanceBreakRow = {
  staff_registration_id: string
  work_date: string
  break_hours: number
}

export type UnmatchedAttendanceGroup = {
  device_name: string
  enrollment_no: number
  punch_count: number
}

export type AttendancePeriod = 'week' | 'biweekly' | 'month' | 'year'

export const ATTENDANCE_PERIOD_LABELS: Record<AttendancePeriod, string> = {
  week: 'This week',
  biweekly: 'Biweekly',
  month: 'Month',
  year: 'Year',
}

export type PayrollPeriod = AttendancePeriod | 'custom'

export const PAYROLL_PERIOD_LABELS: Record<PayrollPeriod, string> = {
  ...ATTENDANCE_PERIOD_LABELS,
  custom: 'Custom',
}

export const PAYROLL_PERIOD_OPTIONS: PayrollPeriod[] = [
  'week',
  'biweekly',
  'month',
  'year',
  'custom',
]

const ATTENDANCE_HEADER = /^no[\s\t]+tmno/i
const ATTENDANCE_DATETIME_RE = /(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s*$/

/** Normalize person / device names for attendance matching. */
export function normalizeAttendanceName(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u00a0\u200b\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function parseAttendanceLine(line: string): ParsedAttendancePunch | null {
  const trimmed = line.trim()
  if (!trimmed || ATTENDANCE_HEADER.test(trimmed)) return null

  const dtMatch = trimmed.match(ATTENDANCE_DATETIME_RE)
  if (!dtMatch) return null

  const beforeDate = trimmed.slice(0, trimmed.length - dtMatch[0].length).trim()
  const tabSeparated = beforeDate.includes('\t')
  const cols = tabSeparated
    ? beforeDate.split('\t').map((c) => c.trim())
    : beforeDate.split(/\s+/).filter(Boolean)

  if (cols.length < 4) return null

  const enrollment_no = parseInt(cols[2], 10)
  const terminal_no = parseInt(cols[1], 10)
  if (!Number.isFinite(enrollment_no)) return null

  let device_name: string
  let verify_mode: number | null

  if (tabSeparated) {
    // ZKTeco: No, TMNo, EnNo, Name, GMNo, Mode
    device_name = cols[3] || ''
    verify_mode = cols.length > 5 ? parseInt(cols[5], 10) : null
  } else {
    // Space-separated export: name may span multiple tokens before GMNo + Mode
    device_name = cols.length >= 6 ? cols.slice(3, -2).join(' ') : cols[3] || ''
    verify_mode = cols.length > 0 ? parseInt(cols[cols.length - 1], 10) : null
  }

  if (!device_name) return null

  const y = parseInt(dtMatch[1], 10)
  const mo = parseInt(dtMatch[2], 10)
  const d = parseInt(dtMatch[3], 10)
  const hh = parseInt(dtMatch[4], 10)
  const mm = parseInt(dtMatch[5], 10)
  const ss = parseInt(dtMatch[6], 10)
  const work_date = `${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}`
  const punch_at = manilaDateTimeToUtc(y, mo, d, hh, mm, ss).toISOString()

  return {
    enrollment_no,
    terminal_no: Number.isFinite(terminal_no) ? terminal_no : null,
    verify_mode: Number.isFinite(verify_mode ?? NaN) ? verify_mode : null,
    device_name: device_name.trim(),
    work_date,
    punch_at,
  }
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d + days)
  const dt = new Date(t)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function getManilaWeekdayFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: PHILIPPINES_TIMEZONE,
    weekday: 'short',
  }).format(manilaDateTimeToUtc(y, m, d, 12))
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return map[label] ?? 0
}

/** Sunday–Saturday week containing anchorYmd (Philippines calendar). */
export function getPhilippinesWeekRange(anchorYmd: string): { start: string; end: string } {
  const weekday = getManilaWeekdayFromYmd(anchorYmd)
  const start = addDaysYmd(anchorYmd, -weekday)
  const end = addDaysYmd(start, 6)
  return { start, end }
}

/** Sunday week starts for each Philippines calendar week overlapping a date range. */
export function listPhilippinesWeekStartsInRange(startYmd: string, endYmd: string): string[] {
  const starts: string[] = []
  let weekStart = getPhilippinesWeekRange(startYmd).start
  while (weekStart <= endYmd) {
    starts.push(weekStart)
    weekStart = addDaysYmd(weekStart, 7)
  }
  return starts
}

export function shiftPhilippinesWeek(anchorYmd: string, weeks: number): string {
  return addDaysYmd(anchorYmd, weeks * 7)
}

export function formatPhilippinesWeekLabel(startYmd: string, endYmd: string): string {
  const fmt = (ymd: string, includeYear: boolean) => {
    const [y, m, d] = ymd.split('-').map(Number)
    return new Intl.DateTimeFormat('en-US', {
      timeZone: PHILIPPINES_TIMEZONE,
      month: 'short',
      day: 'numeric',
      ...(includeYear ? { year: 'numeric' } : {}),
    }).format(manilaDateTimeToUtc(y, m, d, 12))
  }

  if (startYmd === endYmd) return fmt(startYmd, true)
  const sameYear = startYmd.slice(0, 4) === endYmd.slice(0, 4)
  const sameMonth = sameYear && startYmd.slice(5, 7) === endYmd.slice(5, 7)
  if (sameMonth) return `${fmt(startYmd, false)} – ${fmt(endYmd, true)}`
  if (sameYear) return `${fmt(startYmd, false)} – ${fmt(endYmd, true)}`
  return `${fmt(startYmd, true)} – ${fmt(endYmd, true)}`
}

/** Inclusive date range for attendance period filters (Philippines calendar). */
export function getAttendancePeriodRange(period: AttendancePeriod): { start: string; end: string } {
  const today = getPhilippinesDate()

  switch (period) {
    case 'week':
      return getPhilippinesWeekRange(today)
    case 'biweekly': {
      const thisWeek = getPhilippinesWeekRange(today)
      const start = shiftPhilippinesWeek(thisWeek.start, -1)
      return { start, end: thisWeek.end }
    }
    case 'month': {
      const [y, m] = today.split('-').map(Number)
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
      const mm = String(m).padStart(2, '0')
      return {
        start: `${y}-${mm}-01`,
        end: `${y}-${mm}-${String(lastDay).padStart(2, '0')}`,
      }
    }
    case 'year': {
      const y = today.slice(0, 4)
      return { start: `${y}-01-01`, end: `${y}-12-31` }
    }
  }
}

export function getAttendancePeriodLabel(
  period: AttendancePeriod,
  range: { start: string; end: string }
): string {
  switch (period) {
    case 'week':
    case 'biweekly':
      return formatPhilippinesWeekLabel(range.start, range.end)
    case 'month': {
      const [y, m] = range.start.split('-').map(Number)
      return new Intl.DateTimeFormat('en-US', {
        timeZone: PHILIPPINES_TIMEZONE,
        month: 'long',
        year: 'numeric',
      }).format(manilaDateTimeToUtc(y, m, 1, 12))
    }
    case 'year':
      return range.start.slice(0, 4)
  }
}

export function parseAttendanceFile(text: string): ParsedAttendancePunch[] {
  const lines = text.split(/\r?\n/)
  const results: ParsedAttendancePunch[] = []

  for (const line of lines) {
    const parsed = parseAttendanceLine(line)
    if (parsed) results.push(parsed)
  }

  return results
}

export type GfcMainLocation = {
  id: string
  name: string
  brand_id: string
  is_factory_floor: boolean
  brand?: { id: string; name: string } | null
}

/** GFC Main (factory headquarters) brand ids. */
export async function fetchGfcMainBrandIds(): Promise<string[]> {
  const { data: bySlug, error: slugError } = await supabase
    .from('brands')
    .select('id')
    .eq('slug', FACTORY_BRAND_SLUG)

  if (slugError) throw slugError
  const ids = (bySlug || []).map((b) => b.id as string)
  if (ids.length > 0) return ids

  const { data: byRole, error: roleError } = await supabase
    .from('brands')
    .select('id')
    .eq('brand_role', 'factory')

  if (roleError) throw roleError
  return (byRole || []).map((b) => b.id as string)
}

/** Company-owned GFC Main brand location ids (all branches, not only factory floor). */
export async function fetchGfcMainLocationIds(): Promise<string[]> {
  const brandIds = await fetchGfcMainBrandIds()
  if (brandIds.length === 0) return []

  const { data, error } = await supabase
    .from('locations')
    .select('id')
    .eq('company_owned', true)
    .in('brand_id', brandIds)

  if (error) throw error
  return (data || []).map((l) => l.id as string)
}

export async function loadGfcMainFactoryLocations(): Promise<GfcMainLocation[]> {
  const brandIds = await fetchGfcMainBrandIds()
  if (brandIds.length === 0) return []

  const { data, error } = await supabase
    .from('locations')
    .select('id, name, brand_id, is_factory_floor, brand:brands(id, name)')
    .eq('company_owned', true)
    .in('brand_id', brandIds)
    .order('name')

  if (error) throw error
  return (data || []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    brand_id: row.brand_id as string,
    is_factory_floor: Boolean(row.is_factory_floor),
    brand: Array.isArray(row.brand) ? row.brand[0] ?? null : row.brand ?? null,
  }))
}

/** Active staff assigned to any GFC Main company-owned branch. */
export async function loadGfcMainStaff(): Promise<GfcMainStaff[]> {
  const locIds = await fetchGfcMainLocationIds()
  if (locIds.length === 0) return []

  const { data: assigns, error: assignErr } = await supabase
    .from('staff_assignments')
    .select('staff_registration_id')
    .in('location_id', locIds)

  if (assignErr) throw assignErr

  const regIds = Array.from(
    new Set((assigns || []).map((a) => a.staff_registration_id as string))
  )
  if (regIds.length === 0) return []

  const { data: regs, error: regErr } = await supabase
    .from('staff_registrations')
    .select('id, full_name')
    .in('id', regIds)
    .eq('is_active', true)
    .order('full_name')

  if (regErr) throw regErr
  return (regs || []) as GfcMainStaff[]
}

export function resolveStaffByName(deviceName: string, staff: GfcMainStaff[]): string | null {
  const normalized = normalizeAttendanceName(deviceName)
  if (!normalized || staff.length === 0) return null

  const exactMatches = staff.filter(
    (s) => normalizeAttendanceName(s.full_name) === normalized
  )
  if (exactMatches.length >= 1) return exactMatches[0].id

  const firstNameMatches = staff.filter((s) => {
    const first = normalizeAttendanceName(s.full_name).split(' ')[0]
    return first === normalized
  })
  if (firstNameMatches.length === 1) return firstNameMatches[0].id

  const startsWithMatches = staff.filter((s) =>
    normalizeAttendanceName(s.full_name).startsWith(normalized)
  )
  if (startsWithMatches.length === 1) return startsWithMatches[0].id

  return null
}

function formatHoursDecimal(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0h'
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

/** Convert decimal hours to attendance display label (15-minute precision). */
export function formatAttendanceHoursFromDecimal(hours: number): string {
  const totalMinutes = floorMinutesToAttendanceIncrement(Math.max(0, hours) * 60)
  return formatHoursDecimal(totalMinutes)
}

/** Net working hours after subtracting manual break time. */
export function netHoursAfterBreak(
  grossHoursLabel: string | null,
  breakHours: number
): string | null {
  if (!grossHoursLabel) return null
  const grossMinutes = parseAttendanceHoursLabel(grossHoursLabel) * 60
  const breakMinutes = Math.max(0, breakHours) * 60
  const netMinutes = floorMinutesToAttendanceIncrement(
    Math.max(0, grossMinutes - breakMinutes)
  )
  return formatHoursDecimal(netMinutes)
}

export const ATTENDANCE_HOURS_ROUND_MINUTES = 15

/** Default break deducted from gross hours when no manual override is saved. */
export const DEFAULT_ATTENDANCE_BREAK_HOURS = 1

function rawMinutesBetweenIso(startIso: string, endIso: string): number {
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (diffMs <= 0) return 0
  return Math.floor(diffMs / 60000)
}

/** Floor worked minutes down to the nearest 15-minute block. */
export function floorMinutesToAttendanceIncrement(totalMinutes: number): number {
  if (totalMinutes <= 0) return 0
  return (
    Math.floor(totalMinutes / ATTENDANCE_HOURS_ROUND_MINUTES) *
    ATTENDANCE_HOURS_ROUND_MINUTES
  )
}

/** Decimal hours between two punch timestamps (floored to 15-minute blocks). */
export function hoursBetweenIso(startIso: string, endIso: string): number {
  const flooredMinutes = floorMinutesToAttendanceIncrement(
    rawMinutesBetweenIso(startIso, endIso)
  )
  return flooredMinutes / 60
}

/** Parse attendance display label (e.g. "8h 30m") to decimal hours. */
export function parseAttendanceHoursLabel(hours: string | null): number {
  if (!hours) return 0
  const match = hours.trim().match(/^(\d+)h(?:\s+(\d+)m)?$/)
  if (!match) return 0
  const h = parseInt(match[1], 10)
  const m = match[2] ? parseInt(match[2], 10) : 0
  return h + m / 60
}

function formatHoursBetween(startIso: string, endIso: string): string {
  const totalMinutes = floorMinutesToAttendanceIncrement(
    rawMinutesBetweenIso(startIso, endIso)
  )
  return formatHoursDecimal(totalMinutes)
}

type PunchRow = {
  work_date: string
  punch_at: string
  staff_registration_id: string | null
  device_name: string
  enrollment_no: number
  staff_registrations?: { full_name: string } | null
}

export function buildDailySummaries(
  logs: PunchRow[],
  gfcMainStaffIds: Set<string>
): { matched: AttendanceDailySummary[]; unmatched: UnmatchedAttendanceGroup[] } {
  const matchedGroups = new Map<string, PunchRow[]>()
  const unmatchedGroups = new Map<string, { enrollment_no: number; punches: PunchRow[] }>()

  for (const log of logs) {
    const staffId = log.staff_registration_id
    if (staffId && gfcMainStaffIds.has(staffId)) {
      const key = `${staffId}|${log.work_date}`
      const group = matchedGroups.get(key) || []
      group.push(log)
      matchedGroups.set(key, group)
    } else if (!staffId) {
      const key = `${log.device_name.toLowerCase()}|${log.enrollment_no}`
      const existing = unmatchedGroups.get(key) || {
        enrollment_no: log.enrollment_no,
        punches: [],
      }
      existing.punches.push(log)
      unmatchedGroups.set(key, existing)
    }
  }

  const matched: AttendanceDailySummary[] = []
  for (const [, punches] of Array.from(matchedGroups.entries())) {
    punches.sort((a, b) => a.punch_at.localeCompare(b.punch_at))
    const first = punches[0]
    const last = punches[punches.length - 1]
    const staffName =
      first.staff_registrations?.full_name ||
      punches.find((p) => p.staff_registrations?.full_name)?.staff_registrations?.full_name ||
      first.device_name

    const grossHours =
      punches.length > 1 ? formatHoursBetween(first.punch_at, last.punch_at) : null

    matched.push({
      work_date: first.work_date,
      staff_registration_id: first.staff_registration_id,
      staff_name: staffName,
      time_in: first.punch_at,
      time_out: punches.length > 1 ? last.punch_at : null,
      gross_hours: grossHours,
      break_hours: 0,
      hours: grossHours,
      punch_count: punches.length,
    })
  }

  matched.sort((a, b) => {
    const dateCmp = b.work_date.localeCompare(a.work_date)
    if (dateCmp !== 0) return dateCmp
    return a.staff_name.localeCompare(b.staff_name)
  })

  const unmatched: UnmatchedAttendanceGroup[] = Array.from(unmatchedGroups.entries()).map(
    ([, group]) => ({
      device_name: group.punches[0].device_name,
      enrollment_no: group.enrollment_no,
      punch_count: group.punches.length,
    })
  )
  unmatched.sort((a, b) => a.device_name.localeCompare(b.device_name))

  return { matched, unmatched }
}

export async function upsertAttendancePunches(
  punches: Array<ParsedAttendancePunch & { staff_registration_id: string | null }>,
  chunkSize = 500
): Promise<{ inserted: number; duplicates: number }> {
  let inserted = 0
  let duplicates = 0

  for (let i = 0; i < punches.length; i += chunkSize) {
    const chunk = punches.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('gfc_attendance_logs')
      .upsert(chunk, { onConflict: 'enrollment_no,punch_at' })
      .select('id')

    if (error) throw error
    inserted += data?.length ?? 0
    duplicates += chunk.length - (data?.length ?? 0)
  }

  return { inserted, duplicates }
}

/** Link unlinked punches in a period whose device name matches the given staff member. */
export async function relinkUnmatchedPunchesForStaff(params: {
  startDate: string
  endDate: string
  staff: GfcMainStaff
}): Promise<{ linked: number; checked: number }> {
  const { data, error } = await supabase
    .from('gfc_attendance_logs')
    .select('id, device_name')
    .gte('work_date', params.startDate)
    .lte('work_date', params.endDate)
    .is('staff_registration_id', null)

  if (error) throw error

  const rows = data || []
  const idsToLink = rows
    .filter((row) => resolveStaffByName(row.device_name, [params.staff]) === params.staff.id)
    .map((row) => row.id as string)

  if (idsToLink.length === 0) {
    return { linked: 0, checked: rows.length }
  }

  const chunkSize = 200
  for (let i = 0; i < idsToLink.length; i += chunkSize) {
    const chunk = idsToLink.slice(i, i + chunkSize)
    const { error: updateError } = await supabase
      .from('gfc_attendance_logs')
      .update({ staff_registration_id: params.staff.id })
      .in('id', chunk)

    if (updateError) throw updateError
  }

  return { linked: idsToLink.length, checked: rows.length }
}

type AttendancePunchRow = {
  work_date: string
  punch_at: string
  staff_registration_id: string | null
  device_name: string
  enrollment_no: number
  staff_registrations?: { full_name: string } | null
}

export function applyBreaksToDailySummaries(
  summaries: AttendanceDailySummary[],
  breaks: AttendanceBreakRow[]
): AttendanceDailySummary[] {
  const breakMap = new Map(
    breaks.map((b) => [`${b.staff_registration_id}|${b.work_date}`, Number(b.break_hours) || 0])
  )

  return summaries.map((row) => {
    const key =
      row.staff_registration_id != null ? `${row.staff_registration_id}|${row.work_date}` : null
    const grossHours = row.gross_hours ?? row.hours
    let breakHours = 0

    if (key != null && grossHours) {
      const grossDecimal = parseAttendanceHoursLabel(grossHours)
      if (breakMap.has(key)) {
        breakHours = Math.min(breakMap.get(key) ?? 0, grossDecimal)
      } else {
        breakHours = Math.min(DEFAULT_ATTENDANCE_BREAK_HOURS, grossDecimal)
      }
    }

    return {
      ...row,
      gross_hours: grossHours,
      break_hours: breakHours,
      hours: netHoursAfterBreak(grossHours, breakHours),
    }
  })
}

/** Fetch manual break hours for GFC main staff in a date range. */
export async function fetchAttendanceBreaksForPeriod(
  startDate: string,
  endDate: string,
  staffIds?: string[]
): Promise<AttendanceBreakRow[]> {
  let query = supabase
    .from('gfc_attendance_breaks')
    .select('staff_registration_id, work_date, break_hours')
    .gte('work_date', startDate)
    .lte('work_date', endDate)

  if (staffIds && staffIds.length > 0) {
    query = query.in('staff_registration_id', staffIds)
  }

  const { data, error } = await query
  if (error) throw error

  return (data || []).map((row) => ({
    staff_registration_id: row.staff_registration_id as string,
    work_date: row.work_date as string,
    break_hours: Number(row.break_hours) || 0,
  }))
}

/** Save or clear manual break hours for a staff member on a given date. */
export async function upsertAttendanceBreak(
  staffRegistrationId: string,
  workDate: string,
  breakHours: number
): Promise<void> {
  const normalizedBreakHours = Math.max(0, Math.round(breakHours * 100) / 100)

  const { error } = await supabase.from('gfc_attendance_breaks').upsert(
    {
      staff_registration_id: staffRegistrationId,
      work_date: workDate,
      break_hours: normalizedBreakHours,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'staff_registration_id,work_date' }
  )

  if (error) throw error
}

/** Fetch matched daily attendance summaries for GFC main staff in a date range. */
export async function fetchAttendanceSummariesForPeriod(
  startDate: string,
  endDate: string,
  gfcMainStaffIds: Set<string>
): Promise<AttendanceDailySummary[]> {
  if (gfcMainStaffIds.size === 0) return []

  const staffIds = Array.from(gfcMainStaffIds)
  const { data, error } = await supabase
    .from('gfc_attendance_logs')
    .select(
      'work_date, punch_at, staff_registration_id, device_name, enrollment_no, staff_registrations(full_name)'
    )
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .in('staff_registration_id', staffIds)
    .order('work_date', { ascending: true })
    .order('punch_at', { ascending: true })

  if (error) throw error

  const { matched } = buildDailySummaries((data || []) as unknown as AttendancePunchRow[], gfcMainStaffIds)

  let breaks: AttendanceBreakRow[] = []
  try {
    breaks = await fetchAttendanceBreaksForPeriod(startDate, endDate, staffIds)
  } catch (err) {
    console.warn('Could not load attendance breaks:', err)
  }

  return applyBreaksToDailySummaries(matched, breaks)
}
