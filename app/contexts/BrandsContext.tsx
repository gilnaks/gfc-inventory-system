'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase, Brand } from '../../lib/supabase'

interface BrandsContextType {
  brands: Brand[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const BrandsContext = createContext<BrandsContextType | undefined>(undefined)

interface BrandsProviderProps {
  children: ReactNode
}

export function BrandsProvider({ children }: BrandsProviderProps) {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBrands = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error: fetchError } = await supabase
        .from('brands')
        .select('*')
        .order('name')
      
      if (fetchError) {
        setError(fetchError.message)
        return
      }
      
      setBrands(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch brands')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBrands()
  }, [])

  return (
    <BrandsContext.Provider value={{ brands, loading, error, refetch: fetchBrands }}>
      {children}
    </BrandsContext.Provider>
  )
}

export function useBrands() {
  const context = useContext(BrandsContext)
  if (context === undefined) {
    throw new Error('useBrands must be used within a BrandsProvider')
  }
  return context
}
