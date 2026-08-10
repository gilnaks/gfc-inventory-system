'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FlaskConical, Package, Wrench } from 'lucide-react'
import { FactoryMaterialInventory } from '../../components/FactoryMaterialInventory'
import { FactoryNav } from '../FactoryNav'
import type { FactoryInventoryKind } from '../../../lib/factory-inventory'
import { getPhilippinesDate } from '../../../lib/timezone'

function getFactoryRequestedBy(): string {
  if (typeof window === 'undefined') return 'Factory'
  return (localStorage.getItem('dashboard_username') || '').trim() || 'Factory'
}

const TABS = [
  { id: 'ingredients' as const, label: 'Ingredients', icon: FlaskConical },
  { id: 'packaging' as const, label: 'Packaging', icon: Package },
  { id: 'supplies' as const, label: 'Supplies', icon: Wrench },
]

export default function FactoryInventoryPage() {
  const today = getPhilippinesDate()
  const [floorInventoryKind, setFloorInventoryKind] = useState<FactoryInventoryKind>('ingredients')

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
            <h1 className="text-lg sm:text-xl font-bold leading-tight">Floor inventory</h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-0.5 tabular-nums">{today}</p>
          </div>
          <div className="w-10 sm:w-[4.5rem] shrink-0" aria-hidden />
        </div>
      </header>

      <FactoryNav />

      <div className="sticky top-[calc(52px+0.5rem)] z-10 shrink-0 bg-slate-100 border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2">
          <nav
            className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white border border-slate-200"
            aria-label="Floor inventory type"
          >
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = floorInventoryKind === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFloorInventoryKind(id)}
                  className={`inline-flex flex-col items-center justify-center gap-1 min-h-[52px] px-1.5 py-2 rounded-lg text-[11px] sm:text-sm font-medium text-center leading-tight touch-manipulation transition-colors ${
                    active
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-slate-50 active:bg-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto w-full">
        <FactoryMaterialInventory
          key={floorInventoryKind}
          inventoryKind={floorInventoryKind}
          theme="blue"
          currentUsername={getFactoryRequestedBy()}
          variant="floor"
        />
      </main>
    </div>
  )
}
