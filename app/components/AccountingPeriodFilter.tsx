'use client'

import { accountingThemePillActive } from '../../lib/accounting-theme'
import {
  getPhilippinesBillingPeriodLabel,
  type BillingTimeFilter,
} from '../../lib/timezone'

const PERIOD_LABELS: Record<BillingTimeFilter, string> = {
  all: 'All Time',
  week: 'Week',
  month: 'Month',
  year: 'Year',
}

type AccountingPeriodFilterProps = {
  value: BillingTimeFilter
  onChange: (value: BillingTimeFilter) => void
  theme?: string
}

export function AccountingPeriodFilter({ value, onChange, theme = 'blue' }: AccountingPeriodFilterProps) {
  const activeClass = accountingThemePillActive(theme)

  return (
    <div className="flex flex-wrap gap-2">
      {(['all', 'week', 'month', 'year'] as const).map((period) => (
        <button
          key={period}
          type="button"
          title={
            period === 'week'
              ? `Sunday–Saturday: ${getPhilippinesBillingPeriodLabel('week')}`
              : period === 'month'
                ? getPhilippinesBillingPeriodLabel('month')
                : period === 'year'
                  ? getPhilippinesBillingPeriodLabel('year')
                  : undefined
          }
          onClick={() => onChange(period)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            value === period
              ? activeClass
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
          }`}
        >
          {PERIOD_LABELS[period]}
        </button>
      ))}
    </div>
  )
}
