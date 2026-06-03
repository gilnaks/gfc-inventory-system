'use client'

import { useState } from 'react'
import { Brand } from '../../lib/supabase'
import { getPhilippinesDate } from '../../lib/timezone'
import { ProductionScheduleManager } from './ProductionScheduleManager'
import { ProductionScheduleBomView } from './ProductionScheduleBomView'
import { FactoryMaterialInventory } from './FactoryMaterialInventory'
import { FactoryMaterialRequestsPanel } from './FactoryMaterialRequestsPanel'
import type { FactoryInventoryKind } from '../../lib/factory-inventory'
import { FACTORY_INVENTORY_KINDS } from '../../lib/factory-inventory'

interface FactoryManagerProps {
  selectedBrand: Brand
  theme?: string
  currentUsername?: string
}

type FactoryTab = 'schedule' | 'bom' | 'requests' | FactoryInventoryKind

const FACTORY_TAB_LABELS: Record<FactoryTab, string> = {
  schedule: 'Production Schedule',
  bom: 'Bill of Materials',
  requests: 'Material Requests',
  ingredients: 'Ingredients',
  packaging: 'Packaging',
  supplies: 'Supplies',
}

export function FactoryManager({
  selectedBrand,
  theme = 'blue',
  currentUsername,
}: FactoryManagerProps) {
  const [activeTab, setActiveTab] = useState<FactoryTab>('schedule')
  const [scheduleDate, setScheduleDate] = useState(() => getPhilippinesDate())

  const tabActive =
    theme === 'green'
      ? 'border-green-500 text-green-600'
      : theme === 'red'
        ? 'border-red-500 text-red-600'
        : theme === 'yellow'
          ? 'border-yellow-500 text-yellow-600'
          : 'border-blue-500 text-blue-600'

  const factoryTabs: FactoryTab[] = ['schedule', 'bom', 'requests', ...FACTORY_INVENTORY_KINDS]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Factory</h1>
        <p className="text-sm text-gray-600">
          Production scheduling and floor inventory for {selectedBrand.name}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <nav className="flex -mb-px overflow-x-auto" aria-label="Factory sections">
            {factoryTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap shrink-0 ${
                  activeTab === tab
                    ? tabActive
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {FACTORY_TAB_LABELS[tab]}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'schedule' && (
            <ProductionScheduleManager
              embedded
              brandId={selectedBrand.id}
              brandName={selectedBrand.name}
              theme={theme}
              currentUsername={currentUsername}
              scheduleDate={scheduleDate}
              onScheduleDateChange={setScheduleDate}
            />
          )}
          {activeTab === 'bom' && (
            <ProductionScheduleBomView
              brandId={selectedBrand.id}
              brandName={selectedBrand.name}
              theme={theme}
              scheduleDate={scheduleDate}
              onScheduleDateChange={setScheduleDate}
            />
          )}
          {activeTab === 'requests' && (
            <FactoryMaterialRequestsPanel
              brandId={selectedBrand.id}
              brandName={selectedBrand.name}
              theme={theme}
              scheduleDate={scheduleDate}
              onScheduleDateChange={setScheduleDate}
              currentUsername={currentUsername}
            />
          )}
          {FACTORY_INVENTORY_KINDS.includes(activeTab as FactoryInventoryKind) && (
            <FactoryMaterialInventory
              key={activeTab}
              selectedBrand={selectedBrand}
              inventoryKind={activeTab as FactoryInventoryKind}
              theme={theme}
              currentUsername={currentUsername}
            />
          )}
        </div>
      </div>
    </div>
  )
}
