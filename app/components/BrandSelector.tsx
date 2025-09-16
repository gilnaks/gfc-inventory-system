'use client'
import { useState, useEffect } from 'react'
import { supabase, Brand } from '../../lib/supabase'

interface BrandSelectorProps {
  onBrandChange: (brand: Brand) => void
}

export function BrandSelector({ onBrandChange }: BrandSelectorProps) {
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBrands()
  }, [])

  const fetchBrands = async () => {
    try {
      console.log('Fetching brands from Supabase...')
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('name')
      
      console.log('Supabase response:', { data, error })
      
      if (error) {
        console.error('Error fetching brands:', error)
        return
      }
      
      if (data) {
        console.log('Brands loaded:', data)
        setBrands(data)
        if (data.length > 0) {
          setSelectedBrand(data[0])
          onBrandChange(data[0])
        }
      }
    } catch (error) {
      console.error('Error fetching brands:', error)
    } finally {
      setLoading(false)
    }
  }

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
    <div className="flex items-center space-x-3">
      <label htmlFor="brand-select" className="text-sm font-medium text-gray-700 whitespace-nowrap">
        Brand:
      </label>
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
    </div>
  )
}


