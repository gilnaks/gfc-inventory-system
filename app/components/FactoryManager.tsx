'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Brand } from '../../lib/supabase'
import { getFactoryBrand, isFactoryBrand } from '../../lib/brand-roles'
import { getBrandCategoryHeaderTheme } from '../../lib/brand-colors'
import { loadRetailBrands } from '../../lib/gfc-production-catalog'
import { useBrands } from '../contexts/BrandsContext'
import { getPhilippinesDate } from '../../lib/timezone'
import { ProductionScheduleManager } from './ProductionScheduleManager'
import { ProductionScheduleBomView } from './ProductionScheduleBomView'
import { FactoryMaterialInventory } from './FactoryMaterialInventory'
import { FactoryMaterialRequestsPanel } from './FactoryMaterialRequestsPanel'
import { FactoryBatchHistoryPanel } from './FactoryBatchHistoryPanel'
import { IntercompanyTransfersPanel } from './IntercompanyTransfersPanel'
import { FactoryComponentsPanel } from './FactoryComponentsPanel'
import type { DestinationBrandOption } from './DestinationBrandSelect'
import { getModuleReadOnlyBanner } from '../../lib/dashboard-roles'
import { ModuleReadOnlyBanner } from './ModuleEditGate'
import { ModuleLockedNotice } from './ModuleLockedNotice'
import {
  getLockReason,
  getSubTabLabel,
  isSubTabLocked,
  type ModuleAccessLock,
} from '../../lib/module-access'
import type { FactoryInventoryKind } from '../../lib/factory-inventory'
import {
  FACTORY_INVENTORY_KINDS,
  FACTORY_INVENTORY_KIND_LABELS,
} from '../../lib/factory-inventory'

const EMPTY_ACCESS_LOCKS: ModuleAccessLock[] = []

interface FactoryManagerProps {
  selectedBrand: Brand
  theme?: string
  currentUsername?: string
  readOnlyMode?: boolean
  accessLocks?: ModuleAccessLock[]
  bypassAccessLocks?: boolean
}

type FactoryTab =
  | 'schedule'
  | 'bom'
  | 'components'
  | 'history'
  | 'requests'
  | 'intercompany'
  | 'inventory'

const FACTORY_TABS: FactoryTab[] = [
  'schedule',
  'bom',
  'components',
  'history',
  'requests',
  'intercompany',
  'inventory',
]

const FACTORY_TAB_LABELS: Record<FactoryTab, string> = {
  schedule: 'Production Schedule',
  bom: 'Bill of Materials',
  components: 'Components',
  history: 'Batch History',
  requests: 'Material Requests',
  intercompany: 'Transfers',
  inventory: 'Inventory',
}

export function FactoryManager({
  selectedBrand,
  theme = 'blue',
  currentUsername,
  readOnlyMode = false,
  accessLocks = EMPTY_ACCESS_LOCKS,
  bypassAccessLocks = false,
}: FactoryManagerProps) {
  const canEdit = !readOnlyMode
  const [activeTab, setActiveTab] = useState<FactoryTab>('schedule')
  const isFactoryTabLocked = useCallback(
    (tab: FactoryTab) => !bypassAccessLocks && isSubTabLocked(accessLocks, 'factory', tab),
    [accessLocks, bypassAccessLocks]
  )
  const [inventoryKind, setInventoryKind] = useState<FactoryInventoryKind>('ingredients')
  const [scheduleDate, setScheduleDate] = useState(() => getPhilippinesDate())
  const [retailBrands, setRetailBrands] = useState<Brand[]>([])
  const [forBrandId, setForBrandId] = useState('')
  const { brands } = useBrands()
  const factoryBrand = useMemo(() => getFactoryBrand(brands), [brands])

  const destinationBrands = useMemo(() => {
    if (!factoryBrand) return retailBrands
    const retailOnly = retailBrands.filter((b) => b.id !== factoryBrand.id)
    return [factoryBrand, ...retailOnly]
  }, [factoryBrand, retailBrands])

  useEffect(() => {
    loadRetailBrands()
      .then(setRetailBrands)
      .catch((err) => console.error('loadRetailBrands:', err))
  }, [])

  useEffect(() => {
    if (!forBrandId && factoryBrand) {
      setForBrandId(factoryBrand.id)
    }
  }, [factoryBrand, forBrandId])

  // Developer locks: leave a tab that gets locked while it is open.
  useEffect(() => {
    if (!isFactoryTabLocked(activeTab)) return
    const fallback = FACTORY_TABS.find((tab) => !isFactoryTabLocked(tab))
    if (fallback) setActiveTab(fallback)
  }, [activeTab, isFactoryTabLocked])

  const forBrand = destinationBrands.find((b) => b.id === forBrandId)

  const destinationBrandOptions: DestinationBrandOption[] = useMemo(
    () => destinationBrands.map((b) => ({ id: b.id, name: b.name })),
    [destinationBrands]
  )

  const forBrandTheme = getBrandCategoryHeaderTheme(forBrand?.name)

  const tabActive =
    forBrandTheme === 'green'
      ? 'border-green-500 text-green-600'
      : forBrandTheme === 'red'
        ? 'border-red-500 text-red-600'
        : forBrandTheme === 'yellow'
          ? 'border-yellow-500 text-yellow-600'
          : 'border-blue-500 text-blue-600'

  const factoryTabs = FACTORY_TABS.filter((tab) => !isFactoryTabLocked(tab))
  const activeTabLocked = isFactoryTabLocked(activeTab)

  if (!factoryBrand) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">
        GFC Main brand is not configured. Run the GFC factory rollout migration first.
      </div>
    )
  }

  const showGfcNotice = !isFactoryBrand(selectedBrand)

  return (
    <div className="space-y-6">
      {!canEdit ? <ModuleReadOnlyBanner message={getModuleReadOnlyBanner('factory')} /> : null}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Factory</h1>
        <p className="text-sm text-gray-600">
          GFC production catalog · schedule lines tagged for destination consumer brands
        </p>
        {showGfcNotice && (
          <p className="text-xs text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2 mt-2">
            Factory runs on <strong>{factoryBrand.name}</strong> books. Your brand selector stays on{' '}
            <strong>{selectedBrand.name}</strong> for other tabs.
          </p>
        )}
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
                <span className="inline-flex items-center gap-1.5">
                  {FACTORY_TAB_LABELS[tab]}
                  {bypassAccessLocks && isSubTabLocked(accessLocks, 'factory', tab) && (
                    <span
                      className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
                      title="Locked for other roles — visible to developers only"
                    >
                      Locked
                    </span>
                  )}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 space-y-4">
          {activeTabLocked ? (
            <ModuleLockedNotice
              title={getSubTabLabel('factory', activeTab)}
              reason={getLockReason(accessLocks, 'factory', activeTab)}
            />
          ) : (
            <>
          {forBrandId ? (
            <>
              {activeTab === 'schedule' && (
                <ProductionScheduleManager
                  embedded
                  readOnlyMode={readOnlyMode}
                  brandId={factoryBrand.id}
                  forBrandId={forBrandId}
                  brandName={forBrand?.name}
                  destinationBrands={destinationBrandOptions}
                  onForBrandChange={setForBrandId}
                  theme={forBrandTheme}
                  currentUsername={currentUsername}
                  scheduleDate={scheduleDate}
                  onScheduleDateChange={setScheduleDate}
                />
              )}
              {activeTab === 'bom' && (
                <ProductionScheduleBomView
                  brandId={factoryBrand.id}
                  forBrandId={forBrandId}
                  brandName={forBrand?.name}
                  destinationBrands={destinationBrandOptions}
                  onForBrandChange={setForBrandId}
                  theme={forBrandTheme}
                  scheduleDate={scheduleDate}
                  onScheduleDateChange={setScheduleDate}
                />
              )}
              {activeTab === 'requests' && (
                <FactoryMaterialRequestsPanel
                  readOnlyMode={readOnlyMode}
                  brandId={forBrandId}
                  brandName={forBrand?.name}
                  destinationBrands={destinationBrandOptions}
                  onForBrandChange={setForBrandId}
                  theme={forBrandTheme}
                  scheduleDate={scheduleDate}
                  onScheduleDateChange={setScheduleDate}
                  currentUsername={currentUsername}
                />
              )}
            </>
          ) : (activeTab === 'schedule' || activeTab === 'bom' || activeTab === 'requests') ? (
            <p className="text-sm text-gray-500">Loading consumer brands…</p>
          ) : null}
          {activeTab === 'components' && (
            <FactoryComponentsPanel
              factoryBrand={factoryBrand}
              theme={theme}
              currentUsername={currentUsername}
              readOnlyMode={readOnlyMode}
            />
          )}
          {activeTab === 'history' && <FactoryBatchHistoryPanel embedded />}
          {activeTab === 'intercompany' && (
            <IntercompanyTransfersPanel
              selectedBrand={factoryBrand}
              brands={brands}
              theme={theme}
              currentUsername={currentUsername}
              productScope="finished_goods"
              readOnly={readOnlyMode}
            />
          )}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <nav
                className="flex flex-wrap gap-1.5 p-1 rounded-lg bg-gray-50 border border-gray-200 w-fit"
                aria-label="Inventory type"
              >
                {FACTORY_INVENTORY_KINDS.map((kind) => {
                  const active = inventoryKind === kind
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setInventoryKind(kind)}
                      className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        active
                          ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                      }`}
                    >
                      {FACTORY_INVENTORY_KIND_LABELS[kind]}
                    </button>
                  )
                })}
              </nav>
              <FactoryMaterialInventory
                key={inventoryKind}
                selectedBrand={factoryBrand}
                inventoryKind={inventoryKind}
                theme={theme}
                currentUsername={currentUsername}
                readOnlyMode={readOnlyMode}
              />
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
