// Philippines Standard Time (PST) utilities
// PST is UTC+8

export const PHILIPPINES_TIMEZONE = 'Asia/Manila'

/**
 * Convert a UTC timestamp to Philippines time
 */
export function toPhilippinesTime(utcDate: string | Date): Date {
  const date = new Date(utcDate)
  // Convert to Philippines timezone
  return new Date(date.toLocaleString("en-US", {timeZone: PHILIPPINES_TIMEZONE}))
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
