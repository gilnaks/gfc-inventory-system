'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  supabase,
  Brand,
  RawMaterial,
  FactoryOpenedMaterial,
  FactoryOpenedMaterialBomUsage,
  FactoryMaterialRequest,
  type FactoryInventoryKind,
} from '../../lib/supabase'
import {
  FACTORY_INVENTORY_META,
  materialMatchesFactoryInventoryKind,
} from '../../lib/factory-inventory'
import { isFactoryBrand } from '../../lib/brand-roles'
import {
  releasedRequestAvailable,
  requestOpenProgress,
  validateOpenStockForReleasedRequest,
} from '../../lib/factory-material-requests'
import {
  bomBaseQtyToDisplayQty,
  bomDisplayQtyToStockQty,
  factoryRequestQtyToStockUnits,
  formatFactoryRequestQtyDisplay,
  getBomDisplayUnitLabel,
  getPurchaseUnitLabel,
  getStockUnitLabel,
  stockQtyToBomDisplayQty,
  stockUnitsPerPurchase,
  type RawMaterialUomFields,
} from '../../lib/raw-material-uom'
import {
  buildOpenedMaterialHistory,
  fetchOpenedMaterialBatchUsage,
  type OpenedMaterialHistoryEntry,
} from '../../lib/factory-opened-material-history'
import {
  effectiveBomQtyPerBatch,
  fetchProductBomSettingsByProductId,
  parseProductBomSettings,
} from '../../lib/product-bom'
import { ClipboardCheck, History, Layers, X } from 'lucide-react'
import { Modal } from './Modal'

interface FactoryMaterialInventoryProps {
  /** When omitted, shows all brands (factory floor kiosk). */
  selectedBrand?: Brand | null
  inventoryKind: FactoryInventoryKind
  theme?: string
  currentUsername?: string
  /** Mobile-first layout for /factory/inventory floor kiosk. */
  variant?: 'default' | 'floor'
  readOnlyMode?: boolean
}

type BomJoinedProduct = {
  id: string
  name: string
  sku?: string
  brand_id: string
  bom_quantity_mode?: string | null
  bom_yield_per_batch?: number | string | null
}

function bomJoinedProduct(
  row: { product?: BomJoinedProduct | BomJoinedProduct[] | null }
): BomJoinedProduct | null {
  const p = row.product
  if (!p) return null
  return Array.isArray(p) ? p[0] ?? null : p
}

function materialVisibleToBrand(material: RawMaterial, brand: Brand | null | undefined) {
  if (!brand) return true
  if (material.brand_id === brand.id) return true
  const owners = (material.owner ?? []).map((o) => o.trim()).filter(Boolean)
  return owners.includes(brand.name)
}

function formatQty(qty: number) {
  if (!Number.isFinite(qty)) return '0'
  return Number.isInteger(qty)
    ? qty.toLocaleString()
    : qty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function resolveOpenedRowMaterial(
  row: FactoryOpenedMaterial,
  catalog: RawMaterial[]
): RawMaterial | undefined {
  return row.material ?? catalog.find((m) => m.id === row.material_id)
}

/** Floor opened qty is stored in stock units; show per procurement factory BOM unit setting. */
function openedStockToDisplay(
  stockQty: number,
  material: RawMaterialUomFields | undefined
): { qty: number; unit: string } {
  if (!material) {
    return { qty: stockQty, unit: '—' }
  }
  return {
    qty: stockQtyToBomDisplayQty(stockQty, material),
    unit: getBomDisplayUnitLabel(material),
  }
}

function displayQtyToOpenedStock(
  displayQty: number,
  material: RawMaterialUomFields | undefined
): number {
  if (!material) return displayQty
  return bomDisplayQtyToStockQty(displayQty, material)
}

/** One open action = one purchase package in stock units, capped to what the release still allows. */
function openPackageStockQty(material: RawMaterial, availableRequestQty: number) {
  const perPackage = stockUnitsPerPurchase(material)
  const maxStock = factoryRequestQtyToStockUnits(
    Math.max(0, Number(availableRequestQty) || 0),
    material
  )
  if (maxStock <= 0) return perPackage
  return Math.min(perPackage, maxStock)
}

function formatOpenPackageSummary(material: RawMaterial, stockQty: number) {
  const perPackage = stockUnitsPerPurchase(material)
  const purchaseLabel = getPurchaseUnitLabel(material)
  const stockLabel = getStockUnitLabel(material)
  const isFullPackage = stockQty >= perPackage - 1e-6
  if (isFullPackage) {
    return `1 ${purchaseLabel} · ${formatQty(stockQty)} ${stockLabel}`
  }
  return `Remaining · ${formatQty(stockQty)} ${stockLabel}`
}

type OpenPackagePlan = {
  packageCount: number
  packages: number[]
  totalStockQty: number
}

/** Split available release qty into one row per package to open (full sacks + optional remainder). */
function planOpenPackages(material: RawMaterial, availableRequestQty: number): OpenPackagePlan {
  const perPackage = stockUnitsPerPurchase(material)
  const maxStock = factoryRequestQtyToStockUnits(
    Math.max(0, Number(availableRequestQty) || 0),
    material
  )
  if (maxStock <= 1e-6) {
    return { packageCount: 0, packages: [], totalStockQty: 0 }
  }

  const packages: number[] = []
  let remainingStock = maxStock
  while (remainingStock >= perPackage - 1e-6) {
    packages.push(perPackage)
    remainingStock = Math.round((remainingStock - perPackage) * 1e6) / 1e6
  }
  if (remainingStock > 1e-6) {
    packages.push(remainingStock)
  }

  return {
    packageCount: packages.length,
    packages,
    totalStockQty: packages.reduce((sum, qty) => sum + qty, 0),
  }
}

function formatOpenAllSummary(material: RawMaterial, packageCount: number, totalStockQty: number) {
  const purchaseLabel = getPurchaseUnitLabel(material)
  const stockLabel = getStockUnitLabel(material)
  const unitLabel = packageCount === 1 ? purchaseLabel : `${purchaseLabel}s`
  return `${packageCount} ${unitLabel} · ${formatQty(totalStockQty)} ${stockLabel}`
}

function historyEntryClass(kind: OpenedMaterialHistoryEntry['kind']) {
  switch (kind) {
    case 'opened':
      return 'border-emerald-200 bg-emerald-50/60'
    case 'production':
      return 'border-gray-200 bg-gray-50/80'
    case 'adjustment':
      return 'border-amber-200 bg-amber-50/60'
    case 'discarded':
      return 'border-red-200 bg-red-50/60'
    case 'depleted':
      return 'border-slate-200 bg-slate-50/80'
    default:
      return 'border-gray-200 bg-gray-50/80'
  }
}

function historyQtyPrefix(kind: OpenedMaterialHistoryEntry['kind']) {
  if (kind === 'opened') return '+'
  if (kind === 'production' || kind === 'adjustment' || kind === 'discarded') return '−'
  return ''
}

export function FactoryMaterialInventory({
  selectedBrand = null,
  inventoryKind,
  theme = 'blue',
  currentUsername = '',
  variant = 'default',
  readOnlyMode = false,
}: FactoryMaterialInventoryProps) {
  const canEdit = !readOnlyMode
  const isFloor = variant === 'floor'
  const meta = FACTORY_INVENTORY_META[inventoryKind]
  const openedBy = currentUsername.trim() || 'Factory'
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])
  const [materialRequests, setMaterialRequests] = useState<FactoryMaterialRequest[]>([])
  const [opened, setOpened] = useState<FactoryOpenedMaterial[]>([])
  const [emptied, setEmptied] = useState<FactoryOpenedMaterial[]>([])
  const [bomByMaterialId, setBomByMaterialId] = useState<
    Record<string, FactoryOpenedMaterialBomUsage[]>
  >({})
  const [loading, setLoading] = useState(true)
  const [openingRequest, setOpeningRequest] = useState<{
    requestId: string
    count: number
  } | null>(null)
  const [cycleCountOpen, setCycleCountOpen] = useState(false)
  const [cycleCountDrafts, setCycleCountDrafts] = useState<Record<string, string>>({})
  const [cycleCountSaving, setCycleCountSaving] = useState(false)
  const [historyRow, setHistoryRow] = useState<FactoryOpenedMaterial | null>(null)
  const [historyEntries, setHistoryEntries] = useState<OpenedMaterialHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [releasePackages, setReleasePackages] = useState<
    Array<Pick<FactoryOpenedMaterial, 'id' | 'factory_request_id' | 'status'>>
  >([])
  const [highlightPackageId, setHighlightPackageId] = useState<string | null>(null)
  const [openSuccess, setOpenSuccess] = useState<{
    text: string
    packageCount: number
  } | null>(null)
  const packageRefs = useRef<Record<string, HTMLElement | null>>({})

  const themeBtn =
    theme === 'green'
      ? 'bg-green-600 hover:bg-green-700'
      : theme === 'red'
        ? 'bg-red-600 hover:bg-red-700'
        : theme === 'yellow'
          ? 'bg-yellow-600 hover:bg-yellow-700'
          : 'bg-blue-600 hover:bg-blue-700'

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [matsRes, openedRes] = await Promise.all([
        supabase
          .from('raw_materials')
          .select('*')
          .eq('is_active', true)
          .order('material_name'),
        supabase
          .from('factory_opened_materials')
          .select('*, material:raw_materials(*)')
          .in('status', ['open', 'depleted'])
          .eq('inventory_kind', inventoryKind)
          .order('opened_at', { ascending: false }),
      ])

      const visibleMaterials = matsRes.error
        ? []
        : ((matsRes.data || []) as RawMaterial[]).filter(
            (m) =>
              materialVisibleToBrand(m, selectedBrand) &&
              materialMatchesFactoryInventoryKind(m, inventoryKind)
          )
      if (matsRes.error) console.error(matsRes.error)
      setRawMaterials(visibleMaterials)

      const materialIds = visibleMaterials.map((m) => m.id)
      let requests: FactoryMaterialRequest[] = []
      if (materialIds.length > 0) {
        let reqQuery = supabase
          .from('factory_material_requests')
          .select('*, material:raw_materials(id, material_name, sku, unit, current_stock, brand_id, uom_purchase_unit, uom_stock_per_purchase, factory_request_uom, factory_inventory_kind)')
          .in('material_id', materialIds)
          .in('status', ['pending', 'released'])
          .order('created_at', { ascending: false })
        const { data: reqData, error: reqErr } = await reqQuery
        if (reqErr) {
          console.warn('factory_material_requests:', reqErr.message)
        } else {
          requests = (reqData || []) as FactoryMaterialRequest[]
        }
      }
      setMaterialRequests(requests)

      if (materialIds.length > 0) {
        const { data: trackingRows } = await supabase
          .from('factory_opened_materials')
          .select('id, factory_request_id, status')
          .eq('inventory_kind', inventoryKind)
          .in('material_id', materialIds)
          .not('factory_request_id', 'is', null)
        setReleasePackages(
          (trackingRows || []) as Array<
            Pick<FactoryOpenedMaterial, 'id' | 'factory_request_id' | 'status'>
          >
        )
      } else {
        setReleasePackages([])
      }

      const allPackages = (openedRes.data || []) as FactoryOpenedMaterial[]
      const visiblePackages = allPackages.filter(
        (row) =>
          row.material &&
          materialVisibleToBrand(row.material, selectedBrand)
      )
      const visibleOpened = visiblePackages.filter((row) => row.status === 'open')
      const visibleEmptied = visiblePackages
        .filter((row) => row.status === 'depleted')
        .sort(
          (a, b) =>
            new Date(b.updated_at || b.opened_at).getTime() -
            new Date(a.updated_at || a.opened_at).getTime()
        )
        .slice(0, 100)
      setOpened(visibleOpened)
      setEmptied(visibleEmptied)

      // BOM usage is for dashboard Factory module only — not /factory floor kiosk.
      if (isFloor) {
        setBomByMaterialId({})
      } else {
        const openedMaterialIds = Array.from(
          new Set(visiblePackages.map((r) => r.material_id))
        )
        if (openedMaterialIds.length === 0) {
          setBomByMaterialId({})
        } else {
          const { data: bomRows } = await supabase
            .from('product_bom_items')
            .select(
              'material_id, quantity, quantity_mode, yield_per_batch, product:products(id, name, sku, brand_id, bom_quantity_mode, bom_yield_per_batch)'
            )
            .in('material_id', openedMaterialIds)

          const productIds = Array.from(
            new Set(
              (bomRows || [])
                .map((row) => bomJoinedProduct(row)?.id)
                .filter(Boolean) as string[]
            )
          )
          const productBomSettings = await fetchProductBomSettingsByProductId(productIds)

          const map: Record<string, FactoryOpenedMaterialBomUsage[]> = {}
          for (const row of bomRows || []) {
            const matId = row.material_id as string
            const product = bomJoinedProduct(row)
            if (!product) continue
            if (
              selectedBrand &&
              !isFactoryBrand(selectedBrand) &&
              product.brand_id !== selectedBrand.id
            ) {
              continue
            }
            const bomSettings =
              productBomSettings[product.id] ?? parseProductBomSettings(product)
            if (!map[matId]) map[matId] = []
            map[matId].push({
              product_id: product.id,
              product_name: product.name,
              sku: product.sku,
              bom_quantity: effectiveBomQtyPerBatch(
                {
                  quantity: Number(row.quantity) || 0,
                  quantity_mode: (row as { quantity_mode?: string }).quantity_mode,
                  yield_per_batch: (row as { yield_per_batch?: number | null })
                    .yield_per_batch,
                },
                bomSettings
              ),
            })
          }
          setBomByMaterialId(map)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [selectedBrand, inventoryKind, isFloor])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!highlightPackageId) return
    const el = packageRefs.current[highlightPackageId]
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    const timer = window.setTimeout(() => setHighlightPackageId(null), 4000)
    return () => window.clearTimeout(timer)
  }, [highlightPackageId, opened])

  useEffect(() => {
    if (!openSuccess) return
    const timer = window.setTimeout(() => setOpenSuccess(null), 5000)
    return () => window.clearTimeout(timer)
  }, [openSuccess])

  const requestById = useMemo(
    () => new Map(materialRequests.map((r) => [r.id, r])),
    [materialRequests]
  )

  type ReadyToOpenRow = {
    request: FactoryMaterialRequest
    material: RawMaterial
    availableRequestQty: number
  }

  const stats = useMemo(() => {
    let low = 0
    for (const row of opened) {
      const pct =
        row.quantity_opened > 0 ? row.quantity_remaining / row.quantity_opened : 0
      if (pct > 0 && pct <= 0.2) low++
    }
    return { open: opened.length, low }
  }, [opened])

  const readyToOpen = useMemo(() => {
    const rows: ReadyToOpenRow[] = []
    for (const request of materialRequests) {
      if (request.status !== 'released') continue
      const availableRequestQty = releasedRequestAvailable(request)
      if (availableRequestQty <= 0) continue
      const material = rawMaterials.find((m) => m.id === request.material_id)
      if (!material) continue
      rows.push({ request, material, availableRequestQty })
    }
    return rows.sort((a, b) => {
      const ta = new Date(a.request.released_at || a.request.created_at || 0).getTime()
      const tb = new Date(b.request.released_at || b.request.created_at || 0).getTime()
      return ta - tb
    })
  }, [materialRequests, rawMaterials])

  const handleOpenFromRequest = async (row: ReadyToOpenRow, mode: 'one' | 'all' = 'one') => {
    const { request, material, availableRequestQty } = row
    const plan = planOpenPackages(material, availableRequestQty)
    const packagesToOpen =
      mode === 'all' ? plan.packages : [openPackageStockQty(material, availableRequestQty)]

    if (packagesToOpen.length === 0) {
      alert('Nothing left to open on this release line.')
      return
    }

    const totalStockQty = packagesToOpen.reduce((sum, qty) => sum + qty, 0)
    const validation = validateOpenStockForReleasedRequest(
      totalStockQty,
      availableRequestQty,
      material
    )
    if (validation.ok === false) {
      alert(validation.message)
      return
    }
    setOpeningRequest({ requestId: request.id, count: packagesToOpen.length })
    try {
      const { data: inserted, error } = await supabase
        .from('factory_opened_materials')
        .insert(
          packagesToOpen.map((stockQty) => ({
            material_id: material.id,
            factory_request_id: request.id,
            inventory_kind: inventoryKind,
            label: null,
            quantity_opened: stockQty,
            quantity_remaining: stockQty,
            unit: material.unit,
            status: 'open',
            opened_by: openedBy,
            notes: null,
          }))
        )
        .select('id')
      if (error) {
        if (error.message.includes('factory_opened_materials')) {
          alert(
            'Run migrations/factory-opened-materials.sql, factory-opened-materials-inventory-kind.sql, and factory-material-requests-quantity-used.sql in Supabase first.'
          )
        } else {
          alert(error.message)
        }
        return
      }
      const nextUsed = Math.min(
        (Number(request.quantity_used ?? 0) || 0) + validation.requestConsumption,
        Number(request.quantity) || 0
      )
      const { error: useErr } = await supabase
        .from('factory_material_requests')
        .update({ quantity_used: nextUsed })
        .eq('id', request.id)
        .eq('status', 'released')
      if (useErr) {
        console.warn('quantity_used update:', useErr.message)
      }
      const openedDisplay = openedStockToDisplay(totalStockQty, material)
      if (packagesToOpen.length > 1) {
        setOpenSuccess({
          text: `Opened ${formatOpenAllSummary(material, packagesToOpen.length, totalStockQty)} (${formatQty(openedDisplay.qty)} ${openedDisplay.unit} on floor)`,
          packageCount: packagesToOpen.length,
        })
      } else {
        setOpenSuccess({
          text: `Opened ${formatOpenPackageSummary(material, packagesToOpen[0])} (${formatQty(openedDisplay.qty)} ${openedDisplay.unit} on floor)`,
          packageCount: 1,
        })
      }
      const firstId = inserted?.[0]?.id
      if (firstId) setHighlightPackageId(firstId)
      await loadData()
    } finally {
      setOpeningRequest(null)
    }
  }

  const openHistoryModal = async (row: FactoryOpenedMaterial) => {
    setHistoryRow(row)
    setHistoryEntries([])
    setHistoryLoading(true)
    try {
      const mat = resolveOpenedRowMaterial(row, rawMaterials)
      const batchRows = await fetchOpenedMaterialBatchUsage(row.id)
      setHistoryEntries(buildOpenedMaterialHistory(row, mat, batchRows))
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Failed to load usage history.')
      setHistoryRow(null)
    } finally {
      setHistoryLoading(false)
    }
  }

  const closeHistoryModal = () => {
    setHistoryRow(null)
    setHistoryEntries([])
    setHistoryLoading(false)
  }

  const openCycleCountModal = () => {
    if (opened.length === 0) return
    const drafts: Record<string, string> = {}
    for (const row of opened) {
      const mat = resolveOpenedRowMaterial(row, rawMaterials)
      const { qty } = openedStockToDisplay(row.quantity_remaining, mat)
      drafts[row.id] = String(qty)
    }
    setCycleCountDrafts(drafts)
    setCycleCountOpen(true)
  }

  const closeCycleCountModal = () => {
    setCycleCountOpen(false)
    setCycleCountDrafts({})
  }

  const updateRemaining = async (
    row: FactoryOpenedMaterial,
    remaining: number,
    options?: {
      status?: 'open' | 'depleted' | 'discarded'
      memoDetail?: string
      skipReload?: boolean
    }
  ): Promise<boolean> => {
    if (remaining < 0 || remaining > row.quantity_opened) {
      alert(`Remaining must be between 0 and ${formatQty(row.quantity_opened)}.`)
      return false
    }
    const oldRemaining = Number(row.quantity_remaining) || 0
    const writtenOffQty = oldRemaining - remaining
    const status =
      options?.status ?? (remaining <= 0 ? 'depleted' : 'open')
    const { error } = await supabase
      .from('factory_opened_materials')
      .update({
        quantity_remaining: remaining,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (error) {
      alert(error.message)
      return false
    }

    if (writtenOffQty > 1e-9) {
      const mat = resolveOpenedRowMaterial(row, rawMaterials)
      const brandId = selectedBrand?.id || mat?.brand_id
      if (brandId && mat) {
        const {
          resolveFactoryMaterialStockUnitCost,
          postFactoryWipAdjustmentJournalWithNotice,
        } = await import('../../lib/accounting-factory-wip-posting')
        const unitCost = await resolveFactoryMaterialStockUnitCost(mat, row.factory_request_id)
        if (unitCost > 0) {
          await postFactoryWipAdjustmentJournalWithNotice(
            row.id,
            brandId,
            writtenOffQty,
            unitCost,
            openedBy,
            options?.memoDetail
          )
        }
      }
    }

    if (!options?.skipReload) await loadData()
    return true
  }

  const submitCycleCount = async () => {
    if (opened.length === 0) return
    const updates: Array<{ row: FactoryOpenedMaterial; remainingStock: number }> = []
    for (const row of opened) {
      const mat = resolveOpenedRowMaterial(row, rawMaterials)
      const raw = cycleCountDrafts[row.id] ?? ''
      const displayRemaining = parseFloat(raw)
      if (!Number.isFinite(displayRemaining)) {
        const name = mat?.material_name || 'material'
        alert(`Enter a valid counted quantity for ${name}.`)
        return
      }
      const { qty: openedDisplay, unit } = openedStockToDisplay(row.quantity_opened, mat)
      if (displayRemaining < 0 || displayRemaining > openedDisplay) {
        const name = mat?.material_name || 'material'
        alert(
          `${name}: counted remaining must be between 0 and ${formatQty(openedDisplay)} ${unit}.`
        )
        return
      }
      const remainingStock = displayQtyToOpenedStock(displayRemaining, mat)
      const current = Number(row.quantity_remaining) || 0
      if (Math.abs(remainingStock - current) > 1e-9) {
        updates.push({ row, remainingStock })
      }
    }
    if (updates.length === 0) {
      closeCycleCountModal()
      return
    }
    setCycleCountSaving(true)
    try {
      for (const { row, remainingStock } of updates) {
        const mat = resolveOpenedRowMaterial(row, rawMaterials)
        const name = mat?.material_name || row.material?.material_name || 'material'
        const label = row.label ? ` (${row.label})` : ''
        const ok = await updateRemaining(row, remainingStock, {
          skipReload: true,
          memoDetail:
            remainingStock <= 0
              ? `Factory cycle count — emptied ${name}${label}`
              : `Factory cycle count — ${name}${label}`,
        })
        if (!ok) return
      }
      await loadData()
      closeCycleCountModal()
    } finally {
      setCycleCountSaving(false)
    }
  }

  const historyModalMat = historyRow
    ? resolveOpenedRowMaterial(historyRow, rawMaterials)
    : undefined
  const historyOpenedDisplay = historyRow
    ? openedStockToDisplay(historyRow.quantity_opened, historyModalMat)
    : null
  const historyRemainingDisplay = historyRow
    ? openedStockToDisplay(historyRow.quantity_remaining, historyModalMat)
    : null
  const historyProductionUsed = historyEntries
    .filter((e) => e.kind === 'production')
    .reduce((sum, e) => sum + (e.quantity ?? 0), 0)

  return (
    <div className={`${isFloor ? 'space-y-3 overflow-x-hidden' : 'space-y-4'}`}>
      <div
        className={`overflow-hidden ${
          isFloor
            ? 'bg-white'
            : 'rounded-xl border border-gray-200 bg-white shadow-sm'
        }`}
      >
        <div
          className={`border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white ${
            isFloor ? 'px-3 py-3' : 'px-4 py-4 sm:px-5'
          }`}
        >
          <div className={`flex flex-col gap-3 ${isFloor ? '' : 'lg:flex-row lg:items-start lg:justify-between gap-4'}`}>
            <div className="min-w-0">
              {!isFloor ? (
                <h2 className="text-lg font-semibold text-gray-900">{meta.title}</h2>
              ) : null}
              <div className={`flex flex-wrap gap-2 ${isFloor ? '' : 'mt-3'}`}>
                {readyToOpen.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                    {readyToOpen.length} ready to open
                  </span>
                )}
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                  {stats.open} on floor
                </span>
                {stats.low > 0 && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                    {stats.low} running low
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {!loading && openSuccess ? (
          <div
            className={`border-b border-emerald-100 bg-emerald-50 ${
              isFloor ? 'px-3 py-2.5' : 'px-4 py-3 sm:px-5'
            }`}
          >
            <p className="text-sm font-medium text-emerald-900">{openSuccess.text}</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              {openSuccess.packageCount === 1
                ? 'Package added to the floor below.'
                : `${openSuccess.packageCount} packages added to the floor below.`}
            </p>
          </div>
        ) : null}

        {!loading && readyToOpen.length > 0 && (
          <div
            className={`border-b border-gray-100 ${isFloor ? 'px-3 py-3' : 'px-4 py-4 sm:px-5'}`}
          >
            <ul className="space-y-2">
              {readyToOpen.map((row) => {
                  const { request, material, availableRequestQty } = row
                  const plan = planOpenPackages(material, availableRequestQty)
                  const stockQty = plan.packages[0] ?? openPackageStockQty(material, availableRequestQty)
                  const packageSummary = formatOpenPackageSummary(material, stockQty)
                  const openValidation = validateOpenStockForReleasedRequest(
                    stockQty,
                    availableRequestQty,
                    material
                  )
                  const canOpen = openValidation.ok === true
                  const canOpenAll =
                    plan.packageCount > 1 &&
                    validateOpenStockForReleasedRequest(
                      plan.totalStockQty,
                      availableRequestQty,
                      material
                    ).ok === true
                  const isOpening = openingRequest?.requestId === request.id
                  const progress = requestOpenProgress(request, releasePackages)
                  const totalDisplay = formatFactoryRequestQtyDisplay(progress.total, material)
                  const consumedDisplay = formatFactoryRequestQtyDisplay(progress.consumed, material)
                  const availDisplay = formatFactoryRequestQtyDisplay(
                    availableRequestQty,
                    material
                  )
                  const releasedLabel = request.released_at
                    ? new Date(request.released_at).toLocaleDateString()
                    : request.request_date

                  return (
                    <li
                      key={request.id}
                      className={`rounded-lg border border-emerald-200/80 bg-white shadow-sm ${
                        isFloor ? 'p-3.5' : 'p-3'
                      }`}
                    >
                      <div className={`flex flex-col gap-3 ${isFloor ? '' : 'sm:flex-row sm:items-start sm:justify-between'}`}>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 leading-snug">
                            {material.material_name}
                          </div>
                          {material.sku ? (
                            <div className="text-xs text-gray-400 font-mono mt-0.5">{material.sku}</div>
                          ) : null}
                          <div className="text-xs text-emerald-800 mt-1.5">
                            Available: {availDisplay.primary}
                            {availDisplay.stockNote ? (
                              <span className="text-gray-500"> · {availDisplay.stockNote}</span>
                            ) : null}
                          </div>
                          <div className="mt-2 max-w-md">
                            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                              <span>
                                Release progress · {consumedDisplay.primary} of {totalDisplay.primary}{' '}
                                opened
                              </span>
                              <span className="tabular-nums">{Math.round(progress.pct)}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${Math.min(100, Math.max(0, progress.pct))}%` }}
                              />
                            </div>
                            {progress.packageCount > 0 ? (
                              <p className="text-[10px] text-gray-500 mt-1">
                                {progress.packageCount} package{progress.packageCount === 1 ? '' : 's'}{' '}
                                from this release
                                {progress.openPackageCount > 0
                                  ? ` · ${progress.openPackageCount} still on floor`
                                  : ''}
                              </p>
                            ) : null}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                            Released {releasedLabel}
                            {request.requested_by ? ` · Requested by ${request.requested_by}` : ''}
                            {request.released_by ? ` · Released by ${request.released_by}` : ''}
                          </div>
                          <p className="text-xs font-medium text-gray-700 mt-2 tabular-nums">
                            Opens as {packageSummary}
                            {plan.packageCount > 1 ? (
                              <span className="text-gray-500 font-normal">
                                {' '}
                                · {plan.packageCount} packages available
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <div
                          className={`flex flex-col gap-2 ${
                            isFloor ? 'w-full' : 'sm:shrink-0 sm:items-end'
                          }`}
                        >
                          {canEdit ? (
                            <div
                              className={`flex gap-2 ${
                                isFloor ? 'flex-col w-full' : 'flex-row items-center'
                              }`}
                            >
                              <button
                                type="button"
                                disabled={isOpening || !canOpen}
                                onClick={() => handleOpenFromRequest(row, 'one')}
                                className={`font-medium text-white rounded-lg disabled:opacity-50 touch-manipulation ${themeBtn} ${
                                  isFloor
                                    ? 'w-full min-h-[48px] text-base px-4'
                                    : 'px-4 py-2 text-sm rounded-md whitespace-nowrap'
                                }`}
                              >
                                {isOpening && openingRequest.count === 1
                                  ? 'Opening…'
                                  : 'Open package'}
                              </button>
                              {canOpenAll ? (
                                <button
                                  type="button"
                                  disabled={isOpening}
                                  onClick={() => handleOpenFromRequest(row, 'all')}
                                  className={`font-medium rounded-lg border disabled:opacity-50 touch-manipulation border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 ${
                                    isFloor
                                      ? 'w-full min-h-[48px] text-base px-4'
                                      : 'px-4 py-2 text-sm rounded-md whitespace-nowrap'
                                  }`}
                                >
                                  {isOpening && openingRequest.count > 1
                                    ? `Opening ${openingRequest.count}…`
                                    : `Open all (${plan.packageCount})`}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                          {!canOpen && openValidation.ok === false ? (
                            <p className="text-[10px] text-amber-800 max-w-xs sm:text-right">
                              {openValidation.message}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  )
                })}
            </ul>
          </div>
        )}

        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : (
          <>
            <div className={isFloor ? 'px-3 pt-3' : 'px-4 pt-4 sm:px-5'}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">On the floor</h3>
                  {!isFloor ? (
                    <p className="text-xs text-gray-500 mt-0.5">Opened packages currently in use</p>
                  ) : null}
                </div>
                {canEdit && opened.length > 0 ? (
                  <button
                    type="button"
                    onClick={openCycleCountModal}
                    className={`inline-flex items-center justify-center gap-1.5 shrink-0 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium touch-manipulation hover:bg-slate-50 ${
                      isFloor ? 'min-h-[40px] px-3 text-sm' : 'px-3 py-1.5 text-xs'
                    }`}
                  >
                    <ClipboardCheck className="h-4 w-4 shrink-0" />
                    Cycle count
                  </button>
                ) : null}
              </div>
            </div>
        {opened.length === 0 ? (
          <div className={`text-center ${isFloor ? 'py-6 px-3' : 'py-8 px-4'}`}>
            <p className="text-sm text-gray-500">Nothing on the floor yet</p>
          </div>
        ) : (
          <>
            <div className={`space-y-2.5 ${isFloor ? 'px-3 py-2 space-y-1.5' : 'px-4 py-3 md:hidden'}`}>
              {opened.map((row) => {
                const m = resolveOpenedRowMaterial(row, rawMaterials)
                const remainingDisplay = openedStockToDisplay(row.quantity_remaining, m)
                const openedDisplay = openedStockToDisplay(row.quantity_opened, m)
                const pct =
                  row.quantity_opened > 0
                    ? (row.quantity_remaining / row.quantity_opened) * 100
                    : 0
                const isLow = pct > 0 && pct <= 20
                const bomUses = !isFloor ? bomByMaterialId[row.material_id] || [] : []
                const linkedRequest = row.factory_request_id
                  ? requestById.get(row.factory_request_id)
                  : undefined
                const releaseProgress = linkedRequest
                  ? requestOpenProgress(linkedRequest, releasePackages)
                  : null
                const isHighlighted = highlightPackageId === row.id

                return (
                  <article
                    key={row.id}
                    ref={(el) => {
                      packageRefs.current[row.id] = el
                    }}
                    className={`rounded-xl border bg-white shadow-sm transition-colors ${
                      isFloor ? 'rounded-lg p-2.5' : 'p-3.5'
                    } ${
                      isHighlighted
                        ? 'border-emerald-400 ring-2 ring-emerald-200'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className={`flex items-start justify-between ${isFloor ? 'gap-2' : 'gap-3'}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <p
                            className={`font-semibold text-gray-900 leading-snug min-w-0 ${
                              isFloor ? 'text-sm' : 'text-sm'
                            }`}
                          >
                            {m?.material_name || '—'}
                          </p>
                          {isFloor ? (
                            <button
                              type="button"
                              onClick={() => void openHistoryModal(row)}
                              className="shrink-0 inline-flex items-center justify-center gap-1 min-h-[28px] px-2 rounded-md border border-slate-300 bg-white text-slate-700 text-[11px] font-medium touch-manipulation hover:bg-slate-50"
                            >
                              <History className="h-3 w-3 shrink-0" />
                              History
                            </button>
                          ) : null}
                        </div>
                        {row.label ? (
                          <p className={`text-amber-800 ${isFloor ? 'text-[11px] mt-0.5' : 'text-xs mt-0.5'}`}>
                            {row.label}
                          </p>
                        ) : null}
                        {!isFloor && m?.sku ? (
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{m.sku}</p>
                        ) : null}
                      </div>
                      <p
                        className={`font-bold tabular-nums shrink-0 ${
                          isFloor ? 'text-sm' : 'text-sm'
                        } ${isLow ? 'text-amber-700' : 'text-gray-900'}`}
                      >
                        {formatQty(remainingDisplay.qty)} {remainingDisplay.unit}
                      </p>
                    </div>
                    <div className={isFloor ? 'mt-1.5' : 'mt-2.5'}>
                      <div
                        className={`flex justify-between text-gray-500 mb-1 ${
                          isFloor ? 'text-[10px]' : 'text-[10px]'
                        }`}
                      >
                        <span>Remaining</span>
                        <span className="tabular-nums">
                          {formatQty(remainingDisplay.qty)} / {formatQty(openedDisplay.qty)}{' '}
                          {remainingDisplay.unit}
                        </span>
                      </div>
                      <div
                        className={`rounded-full bg-gray-100 overflow-hidden ${
                          isFloor ? 'h-1.5' : 'h-2'
                        }`}
                      >
                        <div
                          className={`h-full rounded-full ${isLow ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                    </div>
                    {!isFloor && bomUses.length > 0 ? (
                      <p className="text-xs text-gray-600 mt-2 leading-snug">
                        <span className="text-gray-500">BOM: </span>
                        {bomUses
                          .slice(0, 2)
                          .map((b) => b.product_name)
                          .join(', ')}
                        {bomUses.length > 2 ? ` +${bomUses.length - 2}` : ''}
                      </p>
                    ) : null}
                    {linkedRequest && releaseProgress && m ? (
                      <p
                        className={`text-gray-500 leading-snug ${
                          isFloor ? 'text-[10px] mt-1' : 'text-[11px] mt-1.5'
                        }`}
                      >
                        From release{' '}
                        {linkedRequest.released_at
                          ? new Date(linkedRequest.released_at).toLocaleDateString()
                          : linkedRequest.request_date}
                        {' · '}
                        {formatFactoryRequestQtyDisplay(releaseProgress.consumed, m).primary} of{' '}
                        {formatFactoryRequestQtyDisplay(releaseProgress.total, m).primary} opened
                      </p>
                    ) : null}
                    {!isFloor ? (
                      <p className="text-[11px] text-gray-500 mt-2">
                        Opened {new Date(row.opened_at).toLocaleDateString()}
                        {row.opened_by ? ` · ${row.opened_by}` : ''}
                      </p>
                    ) : null}
                    {!isFloor ? (
                      <button
                        type="button"
                        onClick={() => void openHistoryModal(row)}
                        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-800 font-medium touch-manipulation py-2 text-xs"
                      >
                        <History className="h-4 w-4 shrink-0" />
                        History
                      </button>
                    ) : null}
                  </article>
                )
              })}
            </div>
            {!isFloor ? (
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50/80">
                <tr className="border-b border-gray-200">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Material
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Remaining
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Used in BOM
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Opened
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {opened.map((row) => {
                  const m = resolveOpenedRowMaterial(row, rawMaterials)
                  const remainingDisplay = openedStockToDisplay(row.quantity_remaining, m)
                  const openedDisplay = openedStockToDisplay(row.quantity_opened, m)
                  const pct =
                    row.quantity_opened > 0
                      ? (row.quantity_remaining / row.quantity_opened) * 100
                      : 0
                  const isLow = pct > 0 && pct <= 20
                  const bomUses = bomByMaterialId[row.material_id] || []
                  const linkedRequest = row.factory_request_id
                    ? requestById.get(row.factory_request_id)
                    : undefined
                  const isHighlighted = highlightPackageId === row.id

                  return (
                    <tr
                      key={row.id}
                      ref={(el) => {
                        packageRefs.current[row.id] = el
                      }}
                      className={`hover:bg-slate-50/80 ${
                        isHighlighted ? 'bg-emerald-50/80' : 'bg-white'
                      }`}
                    >
                      <td className="px-5 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {m?.material_name || '—'}
                        </div>
                        {m ? (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {formatFactoryRequestQtyDisplay(1, m).primary}
                          </div>
                        ) : null}
                        {row.label && (
                          <div className="text-xs text-amber-800 mt-0.5">{row.label}</div>
                        )}
                        {linkedRequest ? (
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            Release{' '}
                            {linkedRequest.released_at
                              ? new Date(linkedRequest.released_at).toLocaleDateString()
                              : linkedRequest.request_date}
                          </div>
                        ) : null}
                        {m?.sku && <div className="text-xs text-gray-400">{m.sku}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className={`text-sm font-semibold tabular-nums ${
                            isLow ? 'text-amber-700' : 'text-gray-900'
                          }`}
                        >
                          {formatQty(remainingDisplay.qty)} / {formatQty(openedDisplay.qty)}{' '}
                          {remainingDisplay.unit}
                        </div>
                        <div className="mt-1.5 h-1.5 w-full max-w-[140px] rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isLow ? 'bg-amber-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {bomUses.length === 0 ? (
                          <span className="text-xs text-gray-400">Not on any product BOM</span>
                        ) : (
                          <ul className="space-y-1">
                            {bomUses.map((b) => (
                              <li
                                key={b.product_id}
                                className="text-xs text-gray-700 flex items-start gap-1"
                              >
                                <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                                <span>
                                  {b.product_name}
                                  <span className="text-gray-400">
                                    {' '}
                                    ·{' '}
                                    {formatQty(
                                      row.material
                                        ? bomBaseQtyToDisplayQty(
                                            b.bom_quantity,
                                            row.material
                                          )
                                        : b.bom_quantity
                                    )}{' '}
                                    {row.material
                                      ? getBomDisplayUnitLabel(row.material)
                                      : 'base'}
                                    /batch
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                        <div>{new Date(row.opened_at).toLocaleDateString()}</div>
                        {row.opened_by && <div>by {row.opened_by}</div>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="inline-flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => void openHistoryModal(row)}
                            className="p-1.5 text-purple-600 hover:text-purple-800 rounded-md hover:bg-gray-100 transition-colors"
                            title="Usage history"
                            aria-label="Usage history"
                          >
                            <History size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
            ) : null}
          </>
        )}

            <div
              className={`border-t border-gray-200 mt-2 ${
                isFloor ? 'px-3 pt-3' : 'px-4 pt-6 sm:px-5'
              }`}
            >
              <h3 className="text-sm font-semibold text-gray-900">Previous empties</h3>
              {!isFloor ? (
                <p className="text-xs text-gray-500 mt-0.5">
                  Packages marked empty (last {emptied.length}
                  {emptied.length >= 100 ? '+' : ''})
                </p>
              ) : null}
            </div>
            {emptied.length === 0 ? (
              <div className={`text-center ${isFloor ? 'py-4 px-3' : 'py-8 px-4'}`}>
                <p className="text-sm text-gray-500">Nothing emptied yet</p>
              </div>
            ) : (
              <>
                <div className={`space-y-2 ${isFloor ? 'px-3 pb-4 space-y-1.5' : 'px-4 pb-4 md:hidden'}`}>
                  {emptied.map((row) => {
                    const m = resolveOpenedRowMaterial(row, rawMaterials)
                    const openedDisplay = openedStockToDisplay(row.quantity_opened, m)
                    const emptiedAt = row.updated_at || row.opened_at

                    return (
                      <article
                        key={row.id}
                        className={`border border-gray-200 bg-gray-50/80 ${
                          isFloor ? 'rounded-lg p-2.5' : 'rounded-xl p-3.5'
                        }`}
                      >
                        <div className={`flex items-start justify-between ${isFloor ? 'gap-2' : 'gap-3'}`}>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 leading-snug">
                              {m?.material_name || '—'}
                            </p>
                            {row.label ? (
                              <p className={`text-amber-800 ${isFloor ? 'text-[11px] mt-0.5' : 'text-xs mt-0.5'}`}>
                                {row.label}
                              </p>
                            ) : null}
                            <p
                              className={`text-gray-500 tabular-nums ${
                                isFloor ? 'text-[11px] mt-0.5' : 'text-xs mt-1'
                              }`}
                            >
                              Opened {formatQty(openedDisplay.qty)} {openedDisplay.unit}
                              {isFloor ? (
                                <span className="text-gray-400">
                                  {' · '}
                                  {new Date(emptiedAt).toLocaleDateString()}
                                </span>
                              ) : null}
                            </p>
                            {!isFloor ? (
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                Emptied {new Date(emptiedAt).toLocaleString()}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => void openHistoryModal(row)}
                            className={`shrink-0 inline-flex items-center justify-center touch-manipulation ${
                              isFloor
                                ? 'min-h-[28px] min-w-[28px] rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                : 'p-2 rounded-lg border border-purple-200 bg-white text-purple-700'
                            }`}
                            aria-label="Usage history"
                          >
                            <History className={isFloor ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
                {!isFloor ? (
              <div className="hidden md:block overflow-x-auto pb-4">
                <table className="min-w-full">
                  <thead className="bg-gray-50/80">
                    <tr className="border-b border-gray-200">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Material
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Opened
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Emptied
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {emptied.map((row) => {
                      const m = resolveOpenedRowMaterial(row, rawMaterials)
                      const openedDisplay = openedStockToDisplay(row.quantity_opened, m)
                      const emptiedAt = row.updated_at || row.opened_at

                      return (
                        <tr key={row.id} className="bg-white hover:bg-slate-50/80">
                          <td className="px-5 py-3">
                            <div className="text-sm font-medium text-gray-900">
                              {m?.material_name || '—'}
                            </div>
                            {m ? (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {formatFactoryRequestQtyDisplay(1, m).primary}
                              </div>
                            ) : null}
                            {row.label ? (
                              <div className="text-xs text-amber-800 mt-0.5">{row.label}</div>
                            ) : null}
                            {m?.sku ? <div className="text-xs text-gray-400">{m.sku}</div> : null}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm tabular-nums text-gray-700">
                            {formatQty(openedDisplay.qty)} {openedDisplay.unit}
                            {row.opened_by ? (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {new Date(row.opened_at).toLocaleDateString()}
                                {' · '}
                                {row.opened_by}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {new Date(row.opened_at).toLocaleDateString()}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                            {new Date(emptiedAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <button
                              type="button"
                              onClick={() => void openHistoryModal(row)}
                              className="p-1.5 text-purple-600 hover:text-purple-800 rounded-md hover:bg-gray-100 transition-colors"
                              title="Usage history"
                              aria-label="Usage history"
                            >
                              <History size={16} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
                ) : null}
              </>
            )}
          </>
        )}
      </div>

      {historyRow && historyOpenedDisplay && historyRemainingDisplay ? (
        <Modal
          onClose={closeHistoryModal}
          align="center"
          positionClassName={isFloor ? 'items-end sm:items-center' : undefined}
          contentClassName={isFloor ? 'p-0 sm:p-4' : undefined}
        >
          <div
            className={`bg-white shadow-xl w-full flex flex-col overflow-hidden ${
              isFloor
                ? 'rounded-t-2xl sm:rounded-lg max-h-[min(90dvh,640px)] sm:max-w-lg'
                : 'rounded-lg max-h-[min(85vh,640px)] max-w-lg'
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="opened-material-history-title"
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
              <div className="min-w-0">
                <h3
                  id="opened-material-history-title"
                  className="text-lg font-semibold text-gray-900"
                >
                  Usage history
                </h3>
                <p className="text-sm text-gray-600 mt-0.5">
                  {historyModalMat?.material_name ||
                    historyRow.material?.material_name ||
                    'Material'}
                  {historyRow.label ? (
                    <span className="text-amber-800"> · {historyRow.label}</span>
                  ) : null}
                </p>
                <p className="text-xs text-gray-500 mt-1 tabular-nums">
                  Opened {formatQty(historyOpenedDisplay.qty)} {historyOpenedDisplay.unit}
                  {' · '}
                  Remaining {formatQty(historyRemainingDisplay.qty)}{' '}
                  {historyRemainingDisplay.unit}
                  {historyProductionUsed > 0 ? (
                    <>
                      {' · '}
                      Used in production {formatQty(historyProductionUsed)}{' '}
                      {historyRemainingDisplay.unit}
                    </>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={closeHistoryModal}
                className="shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {historyLoading ? (
                <div className="space-y-3 animate-pulse">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 bg-gray-100 rounded-lg" />
                  ))}
                </div>
              ) : historyEntries.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  No history for this package.
                </p>
              ) : (
                <ul className="space-y-2">
                  {historyEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className={`rounded-lg border px-3 py-2.5 ${historyEntryClass(entry.kind)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{entry.title}</p>
                          {entry.subtitle ? (
                            <p className="text-xs text-gray-500 mt-0.5 truncate" title={entry.subtitle}>
                              {entry.subtitle}
                            </p>
                          ) : null}
                          <p className="text-[10px] text-gray-400 mt-1">
                            {new Date(entry.at).toLocaleString()}
                          </p>
                        </div>
                        {entry.quantity != null ? (
                          <p
                            className={`text-sm font-semibold tabular-nums shrink-0 whitespace-nowrap ${
                              entry.kind === 'opened'
                                ? 'text-emerald-800'
                                : entry.kind === 'discarded'
                                  ? 'text-red-800'
                                  : entry.kind === 'adjustment'
                                    ? 'text-amber-800'
                                    : 'text-gray-900'
                            }`}
                          >
                            {historyQtyPrefix(entry.kind)}
                            {formatQty(entry.quantity)} {entry.unit}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500 shrink-0">—</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!historyLoading && historyEntries.every((e) => e.kind === 'opened') ? (
                <p className="text-xs text-gray-500 mt-4 leading-snug">
                  Production usage is recorded when a batch is started on the factory floor and
                  materials are deducted from opened packages.
                </p>
              ) : null}
            </div>
            <div
              className={`flex justify-end px-5 py-4 border-t border-gray-200 bg-gray-50 shrink-0 ${
                isFloor
                  ? 'pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4'
                  : 'rounded-b-lg'
              }`}
            >
              <button
                type="button"
                onClick={closeHistoryModal}
                className={`text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-white touch-manipulation ${
                  isFloor ? 'min-h-[44px] px-5 w-full sm:w-auto' : 'px-4 py-2'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {cycleCountOpen ? (
        <Modal
          onClose={cycleCountSaving ? undefined : closeCycleCountModal}
          align="center"
          positionClassName={isFloor ? 'items-end sm:items-center' : undefined}
          contentClassName={isFloor ? 'p-0 sm:p-4' : undefined}
        >
          <div
            className={`bg-white shadow-xl w-full ${
              isFloor
                ? 'rounded-t-2xl sm:rounded-lg max-w-lg max-h-[min(90dvh,40rem)] flex flex-col'
                : 'rounded-lg max-w-lg max-h-[90vh] flex flex-col'
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cycle-count-title"
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
              <div className="min-w-0">
                <h3 id="cycle-count-title" className="text-lg font-semibold text-gray-900">
                  Cycle count
                </h3>
                <p className="text-sm text-gray-600 mt-0.5">
                  {meta.title} · {opened.length} package{opened.length === 1 ? '' : 's'} on the
                  floor
                </p>
              </div>
              <button
                type="button"
                onClick={closeCycleCountModal}
                disabled={cycleCountSaving}
                className="shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1 min-h-0">
              <p className="text-xs text-gray-500">
                Enter counted remaining for each opened package. Set to 0 to empty.
              </p>
              {opened.map((row) => {
                const mat = resolveOpenedRowMaterial(row, rawMaterials)
                const openedDisplay = openedStockToDisplay(row.quantity_opened, mat)
                const name = mat?.material_name || row.material?.material_name || 'Material'
                return (
                  <div
                    key={row.id}
                    className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 space-y-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-snug">{name}</p>
                      {row.label ? (
                        <p className="text-xs text-amber-800 mt-0.5">{row.label}</p>
                      ) : null}
                      <p className="text-[11px] text-gray-500 mt-0.5 tabular-nums">
                        Opened {formatQty(openedDisplay.qty)} {openedDisplay.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={`cycle-count-${row.id}`}
                        className="text-xs font-medium text-gray-600 shrink-0"
                      >
                        Remaining
                      </label>
                      <input
                        id={`cycle-count-${row.id}`}
                        type="number"
                        min={0}
                        max={openedDisplay.qty}
                        step={1}
                        value={cycleCountDrafts[row.id] ?? ''}
                        onChange={(e) =>
                          setCycleCountDrafts((prev) => ({
                            ...prev,
                            [row.id]: e.target.value,
                          }))
                        }
                        disabled={cycleCountSaving}
                        className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm tabular-nums text-center bg-white"
                      />
                      <span className="text-xs text-gray-500">{openedDisplay.unit}</span>
                      <button
                        type="button"
                        disabled={cycleCountSaving}
                        onClick={() =>
                          setCycleCountDrafts((prev) => ({ ...prev, [row.id]: '0' }))
                        }
                        className="ml-auto text-xs font-medium text-amber-800 hover:text-amber-950 disabled:opacity-50"
                      >
                        Empty
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div
              className={`flex flex-wrap items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 bg-gray-50 shrink-0 ${
                isFloor
                  ? 'pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4 rounded-b-none sm:rounded-b-lg'
                  : 'rounded-b-lg'
              }`}
            >
              <button
                type="button"
                onClick={closeCycleCountModal}
                disabled={cycleCountSaving}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitCycleCount()}
                disabled={cycleCountSaving || opened.length === 0}
                className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${themeBtn}`}
              >
                {cycleCountSaving ? 'Saving…' : 'Save count'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
