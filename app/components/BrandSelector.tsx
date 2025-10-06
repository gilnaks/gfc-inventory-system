'use client'
import { useState, useEffect } from 'react'
import { Brand } from '../../lib/supabase'
import { useBrands } from '../contexts/BrandsContext'

interface BrandSelectorProps {
  onBrandChange: (brand: Brand) => void
}

export function BrandSelector({ onBrandChange }: BrandSelectorProps) {
  const { brands, loading } = useBrands()
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)

  useEffect(() => {
    if (brands.length > 0 && !selectedBrand) {
      setSelectedBrand(brands[0])
      onBrandChange(brands[0])
    }
  }, [brands, selectedBrand, onBrandChange])

  const handleBrandChange = (brandId: string) => {
    const brand = brands.find(b => b.id === brandId)
    if (brand) {
      setSelectedBrand(brand)
      onBrandChange(brand)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span className="text-gray-600">Loading brands...</span>
      </div>
    )
  }

  return (
    <select
      id="brand-select"
      value={selectedBrand?.id || ''}
      onChange={(e) => handleBrandChange(e.target.value)}
      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm min-w-[140px]"
    >
      {brands.map(brand => (
        <option key={brand.id} value={brand.id}>
          {brand.name}
        </option>
      ))}
    </select>
  )
}


