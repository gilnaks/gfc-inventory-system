'use client'

import { getBrandTagClasses } from '../../lib/brand-colors'

export type DestinationBrandOption = {
  id: string
  name: string
}

type DestinationBrandSelectProps = {
  brands: DestinationBrandOption[]
  value: string
  onChange: (brandId: string) => void
  disabled?: boolean
  className?: string
}

/** Single crisp chevron — avoids native + overlay double-draw on Windows selects. */
const CHEVRON_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%234b5563' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"

export function DestinationBrandSelect({
  brands,
  value,
  onChange,
  disabled,
  className,
}: DestinationBrandSelectProps) {
  const selected = brands.find((b) => b.id === value)
  const tagClasses = getBrandTagClasses(selected?.name)

  return (
    <div className={`relative shrink-0 ${className ?? ''}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || brands.length === 0}
        aria-label="Destination brand"
        style={{ backgroundImage: CHEVRON_BG }}
        className={`h-9 min-w-[9.5rem] max-w-[13rem] w-full pl-3 pr-8 rounded-lg border text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed appearance-none bg-no-repeat bg-[length:1rem] bg-[position:right_0.625rem_center] [&::-ms-expand]:hidden ${tagClasses}`}
      >
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  )
}
