/** Shared theme classes for accounting UI (period filter, report tabs, buttons). */

export function accountingThemePillActive(theme: string): string {
  if (theme === 'green') return 'bg-green-100 text-green-700 border border-green-300'
  if (theme === 'red') return 'bg-red-100 text-red-700 border border-red-300'
  if (theme === 'yellow') return 'bg-yellow-100 text-yellow-700 border border-yellow-300'
  return 'bg-blue-100 text-blue-700 border border-blue-300'
}

export function accountingThemeSolidButton(theme: string): string {
  if (theme === 'green') return 'bg-green-600 hover:bg-green-700 text-white'
  if (theme === 'red') return 'bg-red-600 hover:bg-red-700 text-white'
  if (theme === 'yellow') return 'bg-yellow-600 hover:bg-yellow-700 text-white'
  return 'bg-blue-600 hover:bg-blue-700 text-white'
}

/** Filled active pill (dashboard period filters). */
export function dashboardThemePillActive(theme: string): string {
  return accountingThemeSolidButton(theme)
}

/** Custom date-range calendar: selected start/end day. */
export function dashboardThemeCalendarSelected(theme: string): string {
  if (theme === 'green') return 'bg-green-600 text-white font-bold ring-2 ring-green-400'
  if (theme === 'red') return 'bg-red-600 text-white font-bold ring-2 ring-red-400'
  if (theme === 'yellow') return 'bg-yellow-600 text-white font-bold ring-2 ring-yellow-400'
  return 'bg-blue-600 text-white font-bold ring-2 ring-blue-400'
}

/** Custom date-range calendar: days inside the selected range. */
export function dashboardThemeCalendarInRange(theme: string): string {
  if (theme === 'green') return 'bg-green-100 text-green-900 font-semibold'
  if (theme === 'red') return 'bg-red-100 text-red-900 font-semibold'
  if (theme === 'yellow') return 'bg-yellow-100 text-yellow-900 font-semibold'
  return 'bg-blue-100 text-blue-900 font-semibold'
}

/** Custom date-range calendar: today indicator. */
export function dashboardThemeCalendarToday(theme: string): string {
  if (theme === 'green') return 'ring-2 ring-green-500 text-green-600 hover:bg-gray-100'
  if (theme === 'red') return 'ring-2 ring-red-500 text-red-600 hover:bg-gray-100'
  if (theme === 'yellow') return 'ring-2 ring-yellow-500 text-yellow-700 hover:bg-gray-100'
  return 'ring-2 ring-blue-500 text-blue-600 hover:bg-gray-100'
}

/** Custom date-range calendar: default day hover. */
export function dashboardThemeCalendarHover(theme: string): string {
  if (theme === 'green') return 'hover:bg-gray-100 text-gray-700 hover:ring-1 hover:ring-green-300'
  if (theme === 'red') return 'hover:bg-gray-100 text-gray-700 hover:ring-1 hover:ring-red-300'
  if (theme === 'yellow') return 'hover:bg-gray-100 text-gray-700 hover:ring-1 hover:ring-yellow-300'
  return 'hover:bg-gray-100 text-gray-700 hover:ring-1 hover:ring-blue-300'
}

/** Custom date-range calendar: Done button. */
export function dashboardThemeCalendarDoneButton(theme: string): string {
  if (theme === 'green') return 'text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700'
  if (theme === 'red') return 'text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700'
  if (theme === 'yellow') return 'text-xs bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700'
  return 'text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700'
}

/** Days-worked cell for regular work days. */
export function dashboardThemeDayWorked(theme: string): string {
  if (theme === 'green') return 'bg-green-200 text-green-900 border border-green-300'
  if (theme === 'red') return 'bg-red-200 text-red-900 border border-red-300'
  if (theme === 'yellow') return 'bg-yellow-200 text-yellow-900 border border-yellow-300'
  return 'bg-blue-200 text-blue-900 border border-blue-300'
}

export function dashboardThemeAccentText(theme: string): string {
  if (theme === 'green') return 'text-green-600'
  if (theme === 'red') return 'text-red-600'
  if (theme === 'yellow') return 'text-yellow-600'
  return 'text-blue-600'
}

export function dashboardThemeIconBadge(theme: string): string {
  if (theme === 'green') return 'p-2 bg-green-100 rounded-lg'
  if (theme === 'red') return 'p-2 bg-red-100 rounded-lg'
  if (theme === 'yellow') return 'p-2 bg-yellow-100 rounded-lg'
  return 'p-2 bg-blue-100 rounded-lg'
}

export function dashboardThemeIcon(theme: string): string {
  return dashboardThemeAccentText(theme)
}

export function dashboardThemeSelectFocus(theme: string): string {
  if (theme === 'green') return 'focus:ring-2 focus:ring-green-500 focus:border-green-500'
  if (theme === 'red') return 'focus:ring-2 focus:ring-red-500 focus:border-red-500'
  if (theme === 'yellow') return 'focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500'
  return 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
}

export function dashboardThemeSpinner(theme: string): string {
  if (theme === 'green') return 'border-b-2 border-green-600'
  if (theme === 'red') return 'border-b-2 border-red-600'
  if (theme === 'yellow') return 'border-b-2 border-yellow-600'
  return 'border-b-2 border-blue-600'
}
