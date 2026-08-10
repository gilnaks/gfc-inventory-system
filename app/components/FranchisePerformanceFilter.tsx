'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Check, Store } from 'lucide-react'
import { getRetailBrands, isFactoryBrand } from '../../lib/brand-roles'
import { getBrandColorKey, getBrandIconColorClass } from '../../lib/brand-colors'
import type { Brand } from '../../lib/supabase'

export type FranchiseFilterValue = 'all' | 'hq' | string

type FranchisePerformanceFilterProps = {
  brands: Brand[]
  value: FranchiseFilterValue
  onChange: (value: FranchiseFilterValue) => void
  className?: string
  /** Include "GFC / HQ" (franchise_brand_id IS NULL). Default true. */
  includeHq?: boolean
}

function brandDotClass(brandName: string | undefined): string {
  switch (getBrandColorKey(brandName)) {
    case 'green':
      return 'bg-green-500'
    case 'red':
      return 'bg-red-500'
    case 'yellow':
      return 'bg-amber-400'
    default:
      return 'bg-blue-600'
  }
}

function brandOptionActiveClass(brandName: string | undefined): string {
  switch (getBrandColorKey(brandName)) {
    case 'green':
      return 'bg-green-50 text-green-900'
    case 'red':
      return 'bg-red-50 text-red-900'
    case 'yellow':
      return 'bg-amber-50 text-amber-900'
    default:
      return 'bg-blue-50 text-blue-900'
  }
}

type FilterOption = {
  value: FranchiseFilterValue
  label: string
  brandName?: string
  icon: 'all' | 'hq' | 'store'
}

/** Shared franchise performance filter for GFC Main Accounting / Payroll / Procurement. */
export function FranchisePerformanceFilter({
  brands,
  value,
  onChange,
  className = '',
  includeHq = true,
}: FranchisePerformanceFilterProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const retail = useMemo(() => getRetailBrands(brands), [brands])
  const factory = useMemo(() => brands.find((b) => isFactoryBrand(b)), [brands])

  const options = useMemo<FilterOption[]>(() => {
    const list: FilterOption[] = [{ value: 'all', label: 'All franchises', icon: 'all' }]
    if (includeHq) {
      list.push({
        value: 'hq',
        label: 'GFC / HQ',
        brandName: factory?.name,
        icon: 'hq',
      })
    }
    for (const b of retail) {
      list.push({ value: b.id, label: b.name, brandName: b.name, icon: 'store' })
    }
    return list
  }, [retail, includeHq, factory?.name])

  const selected = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleSelect = (next: FranchiseFilterValue) => {
    onChange(next)
    setOpen(false)
  }

  const triggerDotClass =
    selected.icon === 'all'
      ? 'bg-gray-400'
      : brandDotClass(selected.brandName)

  return (
    <div
      ref={containerRef}
      className={`relative inline-block max-w-[140px] sm:max-w-[160px] ${className}`}
    >
      <button
        type="button"
        id="franchise-filter-select"
        aria-label="Franchise"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full max-w-full items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-sm transition-colors hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${triggerDotClass}`}
          aria-hidden
        />
        <span className="truncate text-left font-medium text-gray-900">
          {selected.label}
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-labelledby="franchise-filter-select"
          className="absolute right-0 z-[70] mt-1 w-52 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value
            const showDivider =
              (option.icon === 'hq' && index > 0) ||
              (option.icon === 'store' && options[index - 1]?.icon !== 'store')

            return (
              <div key={option.value}>
                {showDivider ? <div className="mx-3 border-t border-gray-100" /> : null}
                {option.icon === 'store' && options[index - 1]?.icon !== 'store' ? (
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Franchise
                  </div>
                ) : null}
                {option.icon === 'hq' ? (
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Headquarters
                  </div>
                ) : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option.value)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors ${
                    isSelected
                      ? option.icon === 'all'
                        ? 'bg-gray-50 text-gray-900'
                        : brandOptionActiveClass(option.brandName)
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      option.icon === 'all' ? 'bg-gray-400' : brandDotClass(option.brandName)
                    }`}
                    aria-hidden
                  />
                  {option.icon === 'hq' ? (
                    <Building2
                      className={`h-3.5 w-3.5 shrink-0 ${getBrandIconColorClass(option.brandName)}`}
                      aria-hidden
                    />
                  ) : option.icon === 'store' ? (
                    <Store
                      className={`h-3.5 w-3.5 shrink-0 ${getBrandIconColorClass(option.brandName)}`}
                      aria-hidden
                    />
                  ) : (
                    <Store className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                  )}
                  <span className="flex-1 text-left truncate font-medium">{option.label}</span>
                  {isSelected ? (
                    <Check className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                  ) : null}
                </button>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function franchiseFilterToJournalOptions(value: FranchiseFilterValue): {
  franchiseBrandId?: string | null
  hqOnly?: boolean
} {
  if (value === 'all') return {}
  if (value === 'hq') return { hqOnly: true }
  return { franchiseBrandId: value }
}
