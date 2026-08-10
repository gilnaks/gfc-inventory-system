'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Check, Loader2, Store } from 'lucide-react'
import { Brand } from '../../lib/supabase'
import { getBrandColorKey, getBrandIconColorClass } from '../../lib/brand-colors'
import {
  getDefaultBrand,
  getRetailBrands,
  groupBrandsForSelector,
  isFactoryBrand,
  sortBrandsForSelector,
} from '../../lib/brand-roles'
import { useBrands } from '../contexts/BrandsContext'

interface BrandSelectorProps {
  value: Brand | null
  onBrandChange: (brand: Brand) => void
  fullWidth?: boolean
  /** When true, hides headquarters / factory brands (dashboard guest). */
  excludeHeadquarters?: boolean
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

function BrandOption({
  brand,
  selected,
  onSelect,
}: {
  brand: Brand
  selected: boolean
  onSelect: () => void
}) {
  const Icon = isFactoryBrand(brand) ? Building2 : Store

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors ${
        selected
          ? brandOptionActiveClass(brand.name)
          : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${brandDotClass(brand.name)}`}
        aria-hidden
      />
      <Icon className={`h-3.5 w-3.5 shrink-0 ${getBrandIconColorClass(brand.name)}`} aria-hidden />
      <span className="flex-1 text-left truncate font-medium">{brand.name}</span>
      {selected ? <Check className="h-4 w-4 shrink-0 opacity-70" aria-hidden /> : null}
    </button>
  )
}

function BrandGroup({
  label,
  brands,
  selectedId,
  onSelect,
}: {
  label: string
  brands: Brand[]
  selectedId?: string
  onSelect: (brand: Brand) => void
}) {
  if (!brands.length) return null

  return (
    <div className="py-1">
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <div role="group" aria-label={label}>
        {brands.map((brand) => (
          <BrandOption
            key={brand.id}
            brand={brand}
            selected={brand.id === selectedId}
            onSelect={() => onSelect(brand)}
          />
        ))}
      </div>
    </div>
  )
}

export function BrandSelector({
  value,
  onBrandChange,
  fullWidth = false,
  excludeHeadquarters = false,
}: BrandSelectorProps) {
  const { brands, loading } = useBrands()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectableBrands = useMemo(
    () => (excludeHeadquarters ? getRetailBrands(brands) : brands),
    [brands, excludeHeadquarters]
  )
  const sortedBrands = useMemo(() => sortBrandsForSelector(selectableBrands), [selectableBrands])
  const { headquarters, franchise } = useMemo(
    () => groupBrandsForSelector(selectableBrands),
    [selectableBrands]
  )

  useEffect(() => {
    if (sortedBrands.length === 0) return
    const match = value?.id ? sortedBrands.find((b) => b.id === value.id) : undefined
    if (match) {
      if (match.id !== value?.id || match.name !== value?.name) {
        onBrandChange(match)
      }
      return
    }
    const fallback = excludeHeadquarters
      ? sortedBrands[0]
      : getDefaultBrand(sortedBrands)
    if (fallback) onBrandChange(fallback)
  }, [sortedBrands, value?.id, value?.name, onBrandChange, excludeHeadquarters])

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

  const handleSelect = (brand: Brand) => {
    onBrandChange(brand)
    setOpen(false)
  }

  if (loading) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-500 ${
          fullWidth ? 'w-full' : ''
        }`}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
        <span>Loading…</span>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={fullWidth ? 'relative w-full' : 'relative inline-block max-w-[140px] sm:max-w-[160px]'}
    >
      <button
        type="button"
        id="brand-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full max-w-full items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-sm transition-colors hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${brandDotClass(value?.name)}`}
          aria-hidden
        />
        <span className="truncate text-left font-medium text-gray-900">
          {value?.name ?? 'Select brand'}
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-labelledby="brand-select"
          className={`absolute z-[70] mt-1 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg ${
            fullWidth ? 'left-0 right-0 w-full' : 'right-0 w-52'
          }`}
        >
          <BrandGroup
            label="Headquarters"
            brands={headquarters}
            selectedId={value?.id}
            onSelect={handleSelect}
          />
          {headquarters.length > 0 && franchise.length > 0 ? (
            <div className="mx-3 border-t border-gray-100" />
          ) : null}
          <BrandGroup
            label="Franchise"
            brands={franchise}
            selectedId={value?.id}
            onSelect={handleSelect}
          />
        </div>
      ) : null}
    </div>
  )
}
