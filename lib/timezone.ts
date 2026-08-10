// Philippines Standard Time (PST) utilities
// PST is UTC+8

export const PHILIPPINES_TIMEZONE = 'Asia/Manila'

/**
 * Convert a UTC timestamp to Philippines time
 */
export function toPhilippinesTime(utcDate: string | Date): Date {
  const date = new Date(utcDate)
  // Get the timezone offset for Philippines (UTC+8)
  const philippinesOffset = 8 * 60 // 8 hours in minutes
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000)
  const philippinesTime = new Date(utcTime + (philippinesOffset * 60000))
  return philippinesTime
}

/**
 * Get current date in Philippines timezone as YYYY-MM-DD string
 */
export function getPhilippinesDate(): string {
  const now = new Date()
  return now.toLocaleDateString("en-CA", {timeZone: PHILIPPINES_TIMEZONE})
}

/**
 * Get current date and time in Philippines timezone as string
 */
export function getPhilippinesDateTime(): string {
  const now = new Date()
  return now.toLocaleString("en-US", {timeZone: PHILIPPINES_TIMEZONE})
}

/**
 * Convert a date to Philippines timezone and return as YYYY-MM-DD
 */
export function toPhilippinesDateString(date: string | Date): string {
  const phDate = toPhilippinesTime(date)
  return phDate.toLocaleDateString("en-CA")
}

/**
 * Format a date for display in Philippines timezone
 */
export function formatPhilippinesDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const phDate = toPhilippinesTime(date)
  return phDate.toLocaleDateString("en-US", {
    timeZone: PHILIPPINES_TIMEZONE,
    ...options
  })
}

/**
 * Format a date and time for display in Philippines timezone
 */
export function formatPhilippinesDateTime(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const phDate = toPhilippinesTime(date)
  return phDate.toLocaleString("en-US", {
    timeZone: PHILIPPINES_TIMEZONE,
    ...options
  })
}

/** Transfer sheet / print: e.g. Dec 02, 2026 (Philippines time) */
export function formatPhilippinesTransferSheetDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: PHILIPPINES_TIMEZONE,
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

/**
 * Get the start of day in Philippines timezone
 */
export function getPhilippinesStartOfDay(date?: string | Date): Date {
  const targetDate = date ? toPhilippinesTime(date) : new Date()
  const year = targetDate.getFullYear()
  const month = targetDate.getMonth()
  const day = targetDate.getDate()
  
  // Create date at 00:00:00 in Philippines timezone
  return new Date(year, month, day, 0, 0, 0, 0)
}

/**
 * Get the end of day in Philippines timezone
 */
export function getPhilippinesEndOfDay(date?: string | Date): Date {
  const targetDate = date ? toPhilippinesTime(date) : new Date()
  const year = targetDate.getFullYear()
  const month = targetDate.getMonth()
  const day = targetDate.getDate()
  
  // Create date at 23:59:59 in Philippines timezone
  return new Date(year, month, day, 23, 59, 59, 999)
}

/**
 * Check if two dates are on the same day in Philippines timezone
 */
export function isSameDayInPhilippines(date1: string | Date, date2: string | Date): boolean {
  const phDate1 = toPhilippinesTime(date1)
  const phDate2 = toPhilippinesTime(date2)
  
  return phDate1.getFullYear() === phDate2.getFullYear() &&
         phDate1.getMonth() === phDate2.getMonth() &&
         phDate1.getDate() === phDate2.getDate()
}

const MANILA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000

/** Wall-clock date/time in Asia/Manila as a UTC instant (for DB timestamp comparisons). */
export function manilaDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms) - MANILA_UTC_OFFSET_MS)
}

function addCalendarDays(year: number, month: number, day: number, days: number) {
  const t = Date.UTC(year, month - 1, day + days)
  const dt = new Date(t)
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() }
}

/** 0 = Sunday … 6 = Saturday for a Manila calendar day. */
function getManilaWeekday(year: number, month: number, day: number): number {
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: PHILIPPINES_TIMEZONE,
    weekday: 'short',
  }).format(manilaDateTimeToUtc(year, month, day, 12))
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

function manilaCalendarDayFromInstant(instant: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PHILIPPINES_TIMEZONE }).format(
    new Date(instant)
  )
}

export type BillingTimeFilter = 'all' | 'week' | 'month' | 'year'

/** Inclusive UTC ISO range for billing/receivables period filters (Philippines calendar). */
export function getPhilippinesBillingPeriodRange(filter: BillingTimeFilter): {
  start: string
  end: string
} {
  if (filter === 'all') {
    return { start: new Date(0).toISOString(), end: new Date().toISOString() }
  }

  const [y, m, d] = getPhilippinesDate().split('-').map(Number)

  switch (filter) {
    case 'week': {
      const weekday = getManilaWeekday(y, m, d)
      const weekStart = addCalendarDays(y, m, d, -weekday)
      const weekEnd = addCalendarDays(weekStart.year, weekStart.month, weekStart.day, 6)
      return {
        start: manilaDateTimeToUtc(weekStart.year, weekStart.month, weekStart.day).toISOString(),
        end: manilaDateTimeToUtc(weekEnd.year, weekEnd.month, weekEnd.day, 23, 59, 59, 999).toISOString(),
      }
    }
    case 'month': {
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
      return {
        start: manilaDateTimeToUtc(y, m, 1).toISOString(),
        end: manilaDateTimeToUtc(y, m, lastDay, 23, 59, 59, 999).toISOString(),
      }
    }
    case 'year':
      return {
        start: manilaDateTimeToUtc(y, 1, 1).toISOString(),
        end: manilaDateTimeToUtc(y, 12, 31, 23, 59, 59, 999).toISOString(),
      }
    default:
      return {
        start: manilaDateTimeToUtc(y, m, d).toISOString(),
        end: manilaDateTimeToUtc(y, m, d, 23, 59, 59, 999).toISOString(),
      }
  }
}

export function isTimestampInBillingPeriod(
  isoTimestamp: string | undefined,
  start: string,
  end: string,
  filter: BillingTimeFilter
): boolean {
  if (filter === 'all') return true
  if (!isoTimestamp) return false
  return isoTimestamp >= start && isoTimestamp <= end
}

function formatManilaYmdForRange(ymd: string, includeYear: boolean): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: PHILIPPINES_TIMEZONE,
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  }).format(manilaDateTimeToUtc(y, m, d, 12))
}

function formatManilaInclusiveDateRange(startYmd: string, endYmd: string): string {
  if (startYmd === endYmd) return formatManilaYmdForRange(startYmd, true)

  const startYear = startYmd.slice(0, 4)
  const startMonth = startYmd.slice(5, 7)
  const endYear = endYmd.slice(0, 4)
  const endMonth = endYmd.slice(5, 7)

  if (startYear === endYear && startMonth === endMonth) {
    return `${formatManilaYmdForRange(startYmd, false)} – ${formatManilaYmdForRange(endYmd, true)}`
  }
  if (startYear === endYear) {
    return `${formatManilaYmdForRange(startYmd, false)} – ${formatManilaYmdForRange(endYmd, true)}`
  }
  return `${formatManilaYmdForRange(startYmd, true)} – ${formatManilaYmdForRange(endYmd, true)}`
}

/** Human-readable inclusive range for the billing period filter hint. */
export function getPhilippinesBillingPeriodLabel(filter: BillingTimeFilter): string {
  if (filter === 'all') return 'All records'
  const { start, end } = getPhilippinesBillingPeriodRange(filter)
  return formatManilaInclusiveDateRange(
    manilaCalendarDayFromInstant(start),
    manilaCalendarDayFromInstant(end)
  )
}

/** Date-only fields (YYYY-MM-DD) compared on the Philippines calendar. */
export function isDateStringInBillingPeriod(
  dateStr: string | undefined,
  filter: BillingTimeFilter
): boolean {
  if (filter === 'all') return true
  if (!dateStr) return false
  const { start, end } = getPhilippinesBillingPeriodRange(filter)
  const day = dateStr.split('T')[0]
  const startDay = manilaCalendarDayFromInstant(start)
  const endDay = manilaCalendarDayFromInstant(end)
  return day >= startDay && day <= endDay
}
