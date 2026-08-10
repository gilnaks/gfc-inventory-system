'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FactoryNav } from '../FactoryNav'
import { FactoryComponentsPanel } from '../../components/FactoryComponentsPanel'
import { getFactoryBrand } from '../../../lib/brand-roles'
import { getPhilippinesDate } from '../../../lib/timezone'
import { supabase, type Brand } from '../../../lib/supabase'

function getFactoryRequestedBy(): string {
  if (typeof window === 'undefined') return 'Factory'
  return (localStorage.getItem('dashboard_username') || '').trim() || 'Factory'
}

export default function FactoryComponentsPage() {
  const today = getPhilippinesDate()
  const [factoryBrand, setFactoryBrand] = useState<Brand | null>(null)
  const [loadingBrand, setLoadingBrand] = useState(true)

  const loadBrand = useCallback(async () => {
    setLoadingBrand(true)
    try {
      const { data, error } = await supabase.from('brands').select('*')
      if (error) throw error
      setFactoryBrand(getFactoryBrand((data || []) as Brand[]) ?? null)
    } catch (err) {
      console.error(err)
      setFactoryBrand(null)
    } finally {
      setLoadingBrand(false)
    }
  }, [])

  useEffect(() => {
    void loadBrand()
  }, [loadBrand])

  return (
    <div className="min-h-[100dvh] min-h-screen bg-slate-100 flex flex-col overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="shrink-0 bg-slate-800 text-white">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center gap-3">
          <Link
            href="/factory"
            className="flex items-center gap-1.5 min-h-[44px] shrink-0 text-slate-300 hover:text-white text-sm touch-manipulation"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Factory</span>
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="text-lg sm:text-xl font-bold leading-tight">Components</h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-0.5 tabular-nums">{today}</p>
          </div>
          <div className="w-10 sm:w-[4.5rem] shrink-0" aria-hidden />
        </div>
      </header>

      <FactoryNav />

      <main className="flex-1 max-w-4xl mx-auto w-full">
        {loadingBrand ? (
          <div className="px-3 py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : !factoryBrand ? (
          <div className="px-3 py-8 text-center text-sm text-gray-600">
            GFC Main brand is not configured.
          </div>
        ) : (
          <FactoryComponentsPanel
            factoryBrand={factoryBrand}
            theme="blue"
            currentUsername={getFactoryRequestedBy()}
            variant="floor"
          />
        )}
      </main>
    </div>
  )
}
