'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import {
  releasedRequestAvailable,
  releasedRequestMaxOpenStockUnits,
  validateOpenStockForReleasedRequest,
} from '../../lib/factory-material-requests'
import {
  bomBaseQtyToDisplayQty,
  bomDisplayQtyToStockQty,
  factoryRequestQtyToStockUnits,
  formatFactoryRequestQtyDisplay,
  getBomDisplayUnitLabel,
  stockQtyToBomDisplayQty,
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
import { History, Layers, PackageOpen, Search, SlidersHorizontal, X } from 'lucide-react'

interface FactoryMaterialInventoryProps {
  /** When omitted, shows all brands (factory floor kiosk). */
  selectedBrand?: Brand | null
  inventoryKind: FactoryInventoryKind
  theme?: string
  currentUsername?: string
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

/** Default open qty in stock units, capped to what the released request line still allows. */
function getDefaultOpenQty(material: RawMaterial, availableRequestQty: number) {
  const perPackage = Math.max(1, Math.floor(Number(material.uom_stock_per_purchase) || 1))
  const maxStock = factoryRequestQtyToStockUnits(
    Math.max(0, Number(availableRequestQty) || 0),
    material
  )
  if (maxStock <= 0) return perPackage
  return Math.min(perPackage, maxStock)
}

export function FactoryMaterialInventory({
  selectedBrand = null,
  inventoryKind,
  theme = 'blue',
  currentUsername = '',
}: FactoryMaterialInventoryProps) {
  const brandLabel = selectedBrand?.name ?? 'All brands'
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
  const [search, setSearch] = useState('')
  const [savingRequestId, setSavingRequestId] = useState<string | null>(null)
  const [openDrafts, setOpenDrafts] = useState<
    Record<string, { qty: string; label: string; notes: string }>
  >({})
  const [adjustRow, setAdjustRow] = useState<FactoryOpenedMaterial | null>(null)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustSaving, setAdjustSaving] = useState(false)
  const [historyRow, setHistoryRow] = useState<FactoryOpenedMaterial | null>(null)
  const [historyEntries, setHistoryEntries] = useState<OpenedMaterialHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

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
        if (selectedBrand?.id) {
          reqQuery = reqQuery.eq('brand_id', selectedBrand.id)
        }
        const { data: reqData, error: reqErr } = await reqQuery
        if (reqErr) {
          console.warn('factory_material_requests:', reqErr.message)
        } else {
          requests = (reqData || []) as FactoryMaterialRequest[]
        }
      }
      setMaterialRequests(requests)

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
          if (selectedBrand && product.brand_id !== selectedBrand.id) continue
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
    } finally {
      setLoading(false)
    }
  }, [selectedBrand, inventoryKind])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filterPackagesBySearch = useCallback(
    (rows: FactoryOpenedMaterial[]) => {
      const q = search.trim().toLowerCase()
      if (!q) return rows
      return rows.filter((row) => {
        const m = row.material ?? rawMaterials.find((mat) => mat.id === row.material_id)
        const haystack = [
          row.label,
          m?.material_name,
          m?.sku,
          row.opened_by,
          row.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
    },
    [search, rawMaterials]
  )

  const filteredOpened = useMemo(
    () => filterPackagesBySearch(opened),
    [opened, filterPackagesBySearch]
  )

  const filteredEmptied = useMemo(
    () => filterPackagesBySearch(emptied),
    [emptied, filterPackagesBySearch]
  )

  const stats = useMemo(() => {
    let low = 0
    for (const row of opened) {
      const pct =
        row.quantity_opened > 0 ? row.quantity_remaining / row.quantity_opened : 0
      if (pct > 0 && pct <= 0.2) low++
    }
    return { open: opened.length, low }
  }, [opened])

  type ReadyToOpenRow = {
    request: FactoryMaterialRequest
    material: RawMaterial
    availableRequestQty: number
  }

  const readyToOpen = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows: ReadyToOpenRow[] = []
    for (const request of materialRequests) {
      if (request.status !== 'released') continue
      const availableRequestQty = releasedRequestAvailable(request)
      if (availableRequestQty <= 0) continue
      const material = rawMaterials.find((m) => m.id === request.material_id)
      if (!material) continue
      const haystack = [
        material.material_name,
        material.sku,
        request.requested_by,
        request.released_by,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (q && !haystack.includes(q)) continue
      rows.push({ request, material, availableRequestQty })
    }
    return rows.sort((a, b) => {
      const ta = new Date(a.request.released_at || a.request.created_at || 0).getTime()
      const tb = new Date(b.request.released_at || b.request.created_at || 0).getTime()
      return ta - tb
    })
  }, [materialRequests, rawMaterials, search])

  const getOpenDraft = (
    requestId: string,
    material: RawMaterial,
    availableRequestQty: number
  ) => {
    const existing = openDrafts[requestId]
    if (existing) return existing
    return {
      qty: String(getDefaultOpenQty(material, availableRequestQty)),
      label: '',
      notes: '',
    }
  }

  const setOpenDraft = (
    requestId: string,
    patch: Partial<{ qty: string; label: string; notes: string }>
  ) => {
    setOpenDrafts((prev) => {
      const request = materialRequests.find((r) => r.id === requestId)
      const material = request
        ? rawMaterials.find((m) => m.id === request.material_id)
        : undefined
      const available = request ? releasedRequestAvailable(request) : 0
      const base = prev[requestId] ?? {
        qty: material ? String(getDefaultOpenQty(material, available)) : '',
        label: '',
        notes: '',
      }
      return { ...prev, [requestId]: { ...base, ...patch } }
    })
  }

  const handleOpenFromRequest = async (row: ReadyToOpenRow) => {
    const { request, material, availableRequestQty } = row
    const draft = getOpenDraft(request.id, material, availableRequestQty)
    const qty = parseFloat(draft.qty)
    const validation = validateOpenStockForReleasedRequest(
      qty,
      availableRequestQty,
      material
    )
    if (validation.ok === false) {
      alert(validation.message)
      return
    }
    setSavingRequestId(request.id)
    try {
      const { error } = await supabase.from('factory_opened_materials').insert({
        material_id: material.id,
        factory_request_id: request.id,
        inventory_kind: inventoryKind,
        label: draft.label.trim() || null,
        quantity_opened: qty,
        quantity_remaining: qty,
        unit: material.unit,
        status: 'open',
        opened_by: openedBy,
        notes: draft.notes.trim() || null,
      })
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
      setOpenDrafts((prev) => {
        const next = { ...prev }
        delete next[request.id]
        return next
      })
      await loadData()
    } finally {
      setSavingRequestId(null)
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

  const openAdjustModal = (row: FactoryOpenedMaterial) => {
    const mat = resolveOpenedRowMaterial(row, rawMaterials)
    const { qty } = openedStockToDisplay(row.quantity_remaining, mat)
    setAdjustRow(row)
    setAdjustQty(String(qty))
  }

  const closeAdjustModal = () => {
    setAdjustRow(null)
    setAdjustQty('')
  }

  const submitAdjustRemaining = async () => {
    if (!adjustRow) return
    const mat = resolveOpenedRowMaterial(adjustRow, rawMaterials)
    const displayRemaining = parseFloat(adjustQty)
    if (!Number.isFinite(displayRemaining)) {
      alert('Enter a valid quantity.')
      return
    }
    const { qty: openedDisplay, unit } = openedStockToDisplay(
      adjustRow.quantity_opened,
      mat
    )
    if (displayRemaining < 0 || displayRemaining > openedDisplay) {
      alert(`Remaining must be between 0 and ${formatQty(openedDisplay)} ${unit}.`)
      return
    }
    const remainingStock = displayQtyToOpenedStock(displayRemaining, mat)
    setAdjustSaving(true)
    try {
      const ok = await updateRemaining(adjustRow, remainingStock)
      if (ok) closeAdjustModal()
    } finally {
      setAdjustSaving(false)
    }
  }

  const updateRemaining = async (
    row: FactoryOpenedMaterial,
    remaining: number
  ): Promise<boolean> => {
    if (remaining < 0 || remaining > row.quantity_opened) {
      alert(`Remaining must be between 0 and ${formatQty(row.quantity_opened)}.`)
      return false
    }
    const status = remaining <= 0 ? 'depleted' : 'open'
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
    await loadData()
    return true
  }

  const submitMarkEmpty = async () => {
    if (!adjustRow) return
    const mat = resolveOpenedRowMaterial(adjustRow, rawMaterials)
    const name = mat?.material_name || adjustRow.material?.material_name || 'this material'
    const label = adjustRow.label ? ` (${adjustRow.label})` : ''
    if (
      !confirm(
        `Mark this opened package of ${name}${label} as empty?\nRemaining will be set to 0.`
      )
    ) {
      return
    }
    setAdjustSaving(true)
    try {
      const ok = await updateRemaining(adjustRow, 0)
      if (ok) closeAdjustModal()
    } finally {
      setAdjustSaving(false)
    }
  }

  const adjustModalMat = adjustRow
    ? resolveOpenedRowMaterial(adjustRow, rawMaterials)
    : undefined
  const adjustOpenedDisplay = adjustRow
    ? openedStockToDisplay(adjustRow.quantity_opened, adjustModalMat)
    : null

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
    .reduce((sum, e) => sum + e.quantity, 0)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-4 sm:px-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{meta.title}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {meta.description} ({brandLabel})
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
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
            <div className="relative w-full lg:w-auto lg:min-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search material, label…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>
        </div>

        {!loading && (
          <div className="border-b border-gray-100 bg-emerald-50/40 px-4 py-4 sm:px-5">
            <h3 className="text-sm font-semibold text-emerald-950 flex items-center gap-2">
              <PackageOpen className="h-4 w-4" />
              Ready to open
            </h3>
            <p className="text-xs text-emerald-900/70 mt-0.5 mb-3">
              Released from Procurement — record each package as you open it on the floor.
            </p>
            {readyToOpen.length === 0 ? (
              <p className="text-sm text-gray-500">
                {search.trim()
                  ? 'No released items match your search.'
                  : 'Nothing released yet. Request materials from the production schedule or factory dashboard, then release them in Procurement.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {readyToOpen.map((row) => {
                  const { request, material, availableRequestQty } = row
                  const draft = getOpenDraft(request.id, material, availableRequestQty)
                  const qtyNum = parseFloat(draft.qty)
                  const validQty = Number.isFinite(qtyNum) && qtyNum > 0
                  const maxOpenStock = releasedRequestMaxOpenStockUnits(
                    availableRequestQty,
                    material
                  )
                  const openValidation = validQty
                    ? validateOpenStockForReleasedRequest(
                        qtyNum,
                        availableRequestQty,
                        material
                      )
                    : null
                  const qtyTooHigh = openValidation?.ok === false
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
                      className="rounded-lg border border-emerald-200/80 bg-white p-3 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900">
                            {material.material_name}
                          </div>
                          {material.sku ? (
                            <div className="text-xs text-gray-400 font-mono">{material.sku}</div>
                          ) : null}
                          <div className="text-xs text-emerald-800 mt-1">
                            Available: {availDisplay.primary}
                            {availDisplay.stockNote ? (
                              <span className="text-gray-500"> · {availDisplay.stockNote}</span>
                            ) : null}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            Released {releasedLabel}
                            {request.requested_by ? ` · Requested by ${request.requested_by}` : ''}
                            {request.released_by ? ` · Released by ${request.released_by}` : ''}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:shrink-0">
                          <div>
                            <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">
                              Qty open ({material.unit})
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={draft.qty}
                              onChange={(e) =>
                                setOpenDraft(request.id, { qty: e.target.value })
                              }
                              className="w-full sm:w-24 px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">
                              Label
                            </label>
                            <input
                              type="text"
                              value={draft.label}
                              onChange={(e) =>
                                setOpenDraft(request.id, { label: e.target.value })
                              }
                              placeholder="Optional"
                              className="w-full sm:w-28 px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                            />
                          </div>
                          <div className="flex flex-col items-stretch sm:items-end gap-1 relative z-10">
                            <button
                              type="button"
                              disabled={savingRequestId === request.id}
                              onClick={() => handleOpenFromRequest(row)}
                              className={`px-3 py-1.5 text-sm font-medium text-white rounded-md disabled:opacity-50 touch-manipulation ${themeBtn}`}
                            >
                              {savingRequestId === request.id ? 'Opening…' : 'Record opened'}
                            </button>
                            {qtyTooHigh ? (
                              <p className="text-[10px] text-amber-800 max-w-[200px] sm:text-right">
                                Max {formatQty(maxOpenStock)} {material.unit} for this release
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
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
            <div className="px-4 pt-4 sm:px-5">
              <h3 className="text-sm font-semibold text-gray-900">On the floor</h3>
              <p className="text-xs text-gray-500 mt-0.5">Opened packages currently in use</p>
            </div>
        {filteredOpened.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-gray-600 font-medium">
              {search.trim() ? 'No opened packages match your search' : 'No opened packages on the floor'}
            </p>
            <p className="text-sm text-gray-400 mt-1">{meta.emptyHint}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                {filteredOpened.map((row) => {
                  const m = resolveOpenedRowMaterial(row, rawMaterials)
                  const remainingDisplay = openedStockToDisplay(row.quantity_remaining, m)
                  const openedDisplay = openedStockToDisplay(row.quantity_opened, m)
                  const pct =
                    row.quantity_opened > 0
                      ? (row.quantity_remaining / row.quantity_opened) * 100
                      : 0
                  const isLow = pct > 0 && pct <= 20
                  const bomUses = bomByMaterialId[row.material_id] || []

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
                        {row.label && (
                          <div className="text-xs text-amber-800 mt-0.5">{row.label}</div>
                        )}
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
                          <button
                            type="button"
                            onClick={() => openAdjustModal(row)}
                            className="p-1.5 text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100 transition-colors"
                            title="Adjust remaining"
                            aria-label="Adjust remaining"
                          >
                            <SlidersHorizontal size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

            <div className="px-4 pt-6 sm:px-5 border-t border-gray-200 mt-2">
              <h3 className="text-sm font-semibold text-gray-900">Previous empties</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Packages marked empty (last {emptied.length}
                {emptied.length >= 100 ? '+' : ''})
              </p>
            </div>
            {filteredEmptied.length === 0 ? (
              <div className="text-center py-8 px-4">
                <p className="text-sm text-gray-500">
                  {search.trim()
                    ? 'No emptied packages match your search'
                    : 'No emptied packages yet'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-4">
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
                    {filteredEmptied.map((row) => {
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
            )}
          </>
        )}
      </div>

      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-3 text-xs text-gray-600">
        <p>{meta.footer}</p>
      </div>

      {historyRow && historyOpenedDisplay && historyRemainingDisplay ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="opened-material-history-title"
          onClick={closeHistoryModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[min(85vh,640px)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
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
                      className={`rounded-lg border px-3 py-2.5 ${
                        entry.kind === 'opened'
                          ? 'border-emerald-200 bg-emerald-50/60'
                          : 'border-gray-200 bg-gray-50/80'
                      }`}
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
                        <p
                          className={`text-sm font-semibold tabular-nums shrink-0 whitespace-nowrap ${
                            entry.kind === 'opened' ? 'text-emerald-800' : 'text-gray-900'
                          }`}
                        >
                          {entry.kind === 'opened' ? '+' : '−'}
                          {formatQty(entry.quantity)} {entry.unit}
                        </p>
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
            <div className="flex justify-end px-5 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg shrink-0">
              <button
                type="button"
                onClick={closeHistoryModal}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {adjustRow && adjustOpenedDisplay ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="adjust-remaining-title"
          onClick={() => {
            if (!adjustSaving) closeAdjustModal()
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200">
              <div className="min-w-0">
                <h3 id="adjust-remaining-title" className="text-lg font-semibold text-gray-900">
                  Adjust remaining
                </h3>
                <p className="text-sm text-gray-600 mt-0.5 truncate">
                  {adjustModalMat?.material_name || adjustRow.material?.material_name || 'Material'}
                  {adjustRow.label ? (
                    <span className="text-amber-800"> · {adjustRow.label}</span>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAdjustModal}
                disabled={adjustSaving}
                className="shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-sm text-gray-600">
                Opened:{' '}
                <span className="font-medium tabular-nums text-gray-900">
                  {formatQty(adjustOpenedDisplay.qty)} {adjustOpenedDisplay.unit}
                </span>
              </p>
              <div>
                <label
                  htmlFor="adjust-remaining-qty"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Remaining ({adjustOpenedDisplay.unit})
                </label>
                <input
                  id="adjust-remaining-qty"
                  type="number"
                  min={0}
                  max={adjustOpenedDisplay.qty}
                  step="any"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  disabled={adjustSaving}
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                type="button"
                onClick={() => void submitMarkEmpty()}
                disabled={adjustSaving}
                className="px-4 py-2 text-sm font-medium text-amber-900 border border-amber-300 rounded-lg hover:bg-amber-50 disabled:opacity-50"
              >
                Mark empty
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeAdjustModal}
                  disabled={adjustSaving}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitAdjustRemaining()}
                  disabled={adjustSaving}
                  className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${themeBtn}`}
                >
                  {adjustSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
