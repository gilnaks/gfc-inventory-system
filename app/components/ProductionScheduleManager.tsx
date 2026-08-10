'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase, Product } from '../../lib/supabase'
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Save,
  Printer,
  Users,
  Layers,
  ChevronDown,
  ChevronUp,
  Package,
  FileText,
  Ban,
  RotateCcw,
} from 'lucide-react'
import { getPhilippinesDate } from '../../lib/timezone'
import {
  compareProductsByStockLevel,
  computeProductAvailableStock,
  getProductStockLevel,
  getStockLevelSortRank,
} from '../../lib/product-stock-level'
import {
  ScheduleAddStockSimulation,
  StockLevelProductPicker,
} from './StockLevelProductPicker'
import {
  findBomStockShortages,
  formatBomStockShortageMessage,
} from '../../lib/factory-bom-requirements'
import { createMaterialRequestsForScheduleBom } from '../../lib/factory-schedule-material-requests'
import {
  fetchPendingStickerRequests,
  fulfillStickerRequests,
  newExtraStickersPrinted,
  pendingStickerQtyByScheduleId as buildPendingStickerQtyByScheduleId,
  stickerPrintTarget,
} from '../../lib/factory-sticker-requests'
import {
  countActiveStickers,
  isActiveSticker,
  voidProductionSticker,
} from '../../lib/production-sticker'
import type { ProductionScheduleStatus } from '../../lib/supabase'
import {
  bomDisplayQtyToStockForLine,
  fetchBomLinesByProductId,
  fetchFactoryRequestQtysByMaterial,
  formatBomQtyWithUnit,
  requestQtyToBomDisplayUnits,
} from '../../lib/production-schedule-bom'
import {
  batchesToScheduleQty,
  buildCategoryPortalMap,
  getCategoryYieldPerBatch,
  isProductConsumableSupply,
  parseCategoryPortalRow,
  productCategoryDisplayName,
  productCategoryStorageKey,
  scheduleQtyToBatches,
  type CategoryPortalSettings,
} from '../../lib/product-category-settings'
import {
  fetchProductBomItemsByProductId,
  fetchProductBomSettingsByProductId,
  fetchProductIdsWithBomItems,
  scheduleYieldPerBatch,
  type ProductBomSettings,
} from '../../lib/product-bom'
import { loadBomComponentProductsForBrand } from '../../lib/product-bom-component'
import {
  loadGfcCatalogProducts,
  loadGfcProducts,
  loadRetailBrands,
  isFactoryScheduleAggregateView,
} from '../../lib/gfc-production-catalog'
import {
  fetchBatchesForSchedulesOnDate,
  revertProductionBatchToInProgress,
  type FactoryBatchListItem,
} from '../../lib/factory-batch-production'
import {
  getBrandTagClasses,
} from '../../lib/brand-colors'
import {
  DestinationBrandSelect,
  type DestinationBrandOption,
} from './DestinationBrandSelect'
import { Modal } from './Modal'
import { ProgressFractionCircle } from './ProgressFractionCircle'

function categoryDisplayName(category: string | null | undefined): string {
  return category?.trim() ? category.trim() : 'Uncategorized'
}

function categorySortRank(displayName: string, sortIndex: number | undefined): number {
  if (displayName === 'Uncategorized') return 1_000_000_000
  if (sortIndex === 0) return 900_000_000
  if (sortIndex !== undefined && sortIndex > 0) return sortIndex
  return 500_000_000
}

function ScheduleBatchStepper({
  value,
  onChange,
  min = 0,
  step = 1,
  disabled = false,
  allowDecimal = false,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  step?: number
  disabled?: boolean
  allowDecimal?: boolean
}) {
  const safeValue = Number.isFinite(value) ? value : min

  const applyChange = (next: number) => {
    const clamped = Math.max(min, allowDecimal ? next : Math.round(next))
    onChange(clamped)
  }

  const decrement = () => {
    applyChange(safeValue - step)
  }

  const increment = () => {
    applyChange(safeValue + step)
  }

  const handleInputChange = (raw: string) => {
    if (raw.trim() === '') {
      applyChange(min)
      return
    }
    const parsed = allowDecimal ? parseFloat(raw) : parseInt(raw, 10)
    if (!Number.isFinite(parsed)) return
    applyChange(parsed)
  }

  const inputValue =
    allowDecimal && safeValue % 1 !== 0 ? String(safeValue) : String(safeValue)

  return (
    <div className="inline-flex h-8 items-center gap-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          decrement()
        }}
        disabled={disabled || safeValue <= min}
        className="inline-flex h-8 min-w-[2rem] items-center justify-center px-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-gray-100"
        aria-label="Decrease"
      >
        -
      </button>
      <input
        type="number"
        min={min}
        step={allowDecimal ? 'any' : 1}
        value={inputValue}
        disabled={disabled}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.currentTarget.blur()}
        onChange={(e) => handleInputChange(e.target.value)}
        className="h-8 w-12 px-1 text-center text-sm tabular-nums text-gray-900 border border-gray-300 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          increment()
        }}
        disabled={disabled}
        className="inline-flex h-8 min-w-[2rem] items-center justify-center px-2 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-gray-100"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  )
}

/** Desktop grid for schedule list rows (Product · Progress · Qty · Floor batch · Notes · Print · Remove). */
const SCHEDULE_LIST_GRID_EDITABLE =
  'lg:grid-cols-[minmax(0,2fr)_4.5rem_minmax(7.25rem,8rem)_minmax(5.5rem,6.5rem)_minmax(0,1.25fr)_minmax(0,5.75rem)_2.25rem]'
const SCHEDULE_LIST_GRID_READONLY =
  'lg:grid-cols-[minmax(0,2fr)_4.5rem_minmax(7.25rem,8rem)_minmax(5.5rem,6.5rem)_minmax(0,1.25fr)_minmax(0,5.75rem)]'

const SCHEDULE_SKELETON_GRID_EDITABLE =
  'lg:grid-cols-[minmax(0,2fr)_4.5rem_minmax(7.25rem,8rem)_minmax(5.5rem,6.5rem)_minmax(0,1.25fr)_minmax(0,5.75rem)_2.25rem]'
const SCHEDULE_SKELETON_GRID_READONLY =
  'lg:grid-cols-[minmax(0,2fr)_4.5rem_minmax(7.25rem,8rem)_minmax(5.5rem,6.5rem)_minmax(0,1.25fr)_minmax(0,5.75rem)]'

function ScheduleListSkeleton({ editable }: { editable: boolean }) {
  const gridCols = editable ? SCHEDULE_SKELETON_GRID_EDITABLE : SCHEDULE_SKELETON_GRID_READONLY

  return (
    <div className="animate-pulse max-w-full overflow-hidden divide-y divide-gray-200">
      <div
        className={`hidden lg:grid items-center gap-x-4 px-4 py-2.5 bg-gray-50 border-b border-gray-200 ${gridCols}`}
      >
        <span className="h-2.5 bg-gray-200 rounded w-12" />
        <span className="justify-self-center h-2.5 bg-gray-200 rounded w-10" />
        <span className="justify-self-center h-2.5 bg-gray-200 rounded w-8" />
        <span className="justify-self-center h-2.5 bg-gray-200 rounded w-12" />
        <span className="h-2.5 bg-gray-200 rounded w-10" />
        <span className="justify-self-center h-2.5 bg-gray-200 rounded w-8" />
        {editable ? <span className="justify-self-center h-2.5 bg-gray-200 rounded w-4" /> : null}
      </div>
      {[1, 2].map((row) => (
        <div
          key={row}
          className={`grid items-center gap-x-4 gap-y-3 px-4 py-3 min-w-0 grid-cols-1 ${gridCols}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-3.5 w-3.5 bg-gray-200 rounded shrink-0" />
            <div className="h-3 bg-gray-200 rounded w-[min(100%,11rem)] min-w-0" />
          </div>
          <div className="justify-self-center h-14 w-14 bg-gray-100 rounded-full shrink-0" />
          <div className="flex h-8 items-center justify-center pr-2">
            <div className="h-8 w-[7rem] bg-gray-100 rounded shrink-0" />
          </div>
          <div className="hidden lg:flex h-8 items-center justify-center">
            <div className="h-5 w-16 bg-slate-100 rounded-full shrink-0" />
          </div>
          <div className="flex h-8 items-center pl-3">
            <div className="h-8 bg-gray-100 rounded w-full min-w-0" />
          </div>
          <div className="flex h-8 items-center justify-center">
            <div className="h-8 w-16 bg-indigo-200 rounded shrink-0" />
          </div>
          {editable ? (
            <div className="justify-self-center h-3.5 w-3.5 bg-red-100 rounded shrink-0" />
          ) : null}
        </div>
      ))}
    </div>
  )
}

interface StickerLog {
  id: string
  serial_number: string
  manufacture_date: string
  produced_at?: string | null
  voided_at?: string | null
}

function formatProductionScannedAt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Serial list inside expanded schedule row: serial | sku | production | actions */
const SERIAL_PANEL_GRID =
  'grid grid-cols-[minmax(0,1fr)_5.5rem_9.5rem_7rem] items-center gap-x-3 sm:gap-x-4'

function countScannedStickers(stickers: StickerLog[]): number {
  return stickers.filter((s) => isActiveSticker(s) && s.produced_at).length
}

function primaryFactoryBatchForSchedule(
  batches: FactoryBatchListItem[] | undefined
): FactoryBatchListItem | null {
  if (!batches?.length) return null
  return (
    batches.find((b) => b.status === 'in_progress') ??
    batches.find((b) => b.status === 'completed') ??
    null
  )
}

function FactoryProductionBatchStatusBadge({
  batch,
  compact = false,
}: {
  batch: FactoryBatchListItem | null
  compact?: boolean
}) {
  if (!batch) {
    return (
      <span
        className={`inline-flex items-center shrink-0 rounded-full font-semibold uppercase tracking-wide border bg-slate-100 text-slate-600 border-slate-200 ${
          compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
        }`}
      >
        Not started
      </span>
    )
  }

  const styles =
    batch.status === 'completed'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : batch.status === 'in_progress'
        ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
        : 'bg-slate-100 text-slate-700 border-slate-200'

  const label =
    batch.status === 'completed'
      ? 'Completed'
      : batch.status === 'in_progress'
        ? 'In progress'
        : batch.status.replace('_', ' ')

  return (
    <span
      className={`inline-flex items-center shrink-0 rounded-full font-semibold uppercase tracking-wide border ${styles} ${
        compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
      }`}
      title={
        batch.units > 0
          ? `${label} · ${batch.units} unit${batch.units === 1 ? '' : 's'}`
          : label
      }
    >
      {label}
    </span>
  )
}

function SerialProductionCell({ sticker }: { sticker?: StickerLog }) {
  return (
    <div className="flex justify-center items-center w-full px-1">
      {sticker?.voided_at ? (
        <span className="text-xs text-red-600 italic text-center">Voided</span>
      ) : sticker?.produced_at ? (
        <time
          className="text-xs text-gray-700 tabular-nums text-center leading-snug"
          dateTime={sticker.produced_at}
          title={sticker.produced_at}
        >
          {formatProductionScannedAt(sticker.produced_at)}
        </time>
      ) : (
        <span className="text-xs text-gray-400 italic text-center">
          {sticker ? 'Not scanned' : '—'}
        </span>
      )}
    </div>
  )
}

interface ProductionScheduleItem {
  schedule_id: string
  product_id: string
  product_name: string
  sku?: string
  brand_name: string
  for_brand_id?: string
  quantity_required: number
  batch_number: string
  notes?: string
  printed_count: number
  stickers: StickerLog[]
}

function scheduleItemKey(
  item: Pick<ProductionScheduleItem, 'product_id' | 'for_brand_id' | 'schedule_id'>
): string {
  if (item.schedule_id) return item.schedule_id
  if (item.for_brand_id) return `${item.for_brand_id}:${item.product_id}`
  return item.product_id
}

function openStickerPrintWindow(
  item: Pick<ProductionScheduleItem, 'product_name' | 'sku' | 'brand_name' | 'batch_number' | 'notes'>,
  serialNumber: string,
  manufactureDate: string,
  qrDataUrl: string,
  title = 'Print Sticker'
) {
  const formatDateYearLast = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (match) return `${match[2]}-${match[3]}-${match[1]}`
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    const mm = String(parsed.getMonth() + 1).padStart(2, '0')
    const dd = String(parsed.getDate()).padStart(2, '0')
    const yyyy = String(parsed.getFullYear())
    return `${mm}-${dd}-${yyyy}`
  }

  const formattedMfgDate = formatDateYearLast(manufactureDate)
  const expiryDate = (() => {
    const mfg = new Date(manufactureDate)
    if (Number.isNaN(mfg.getTime())) return '-'
    mfg.setDate(mfg.getDate() + 400)
    const mm = String(mfg.getMonth() + 1).padStart(2, '0')
    const dd = String(mfg.getDate()).padStart(2, '0')
    const yyyy = String(mfg.getFullYear())
    return `${mm}-${dd}-${yyyy}`
  })()
  const printWindow = window.open('', '_blank')
  if (!printWindow) return
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @page { size: 60mm 40mm; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: sans-serif; }
        .sticker-sheet { width: 60mm; height: 40mm; padding: 2mm; overflow: hidden; page-break-inside: avoid; display: flex; flex-direction: column; position: relative; }
        .sticker { flex: 1; min-height: 0; display: flex; flex-direction: row; align-items: flex-start; gap: 2mm; }
        .sticker .info { flex: 1; min-width: 0; font-size: 10px; line-height: 1.25; align-self: flex-start; display: flex; flex-direction: column; gap: 1mm; }
        .sticker .name { font-weight: bold; font-size: 14px; text-transform: uppercase; white-space: normal; overflow: visible; text-overflow: clip; word-break: break-word; overflow-wrap: anywhere; line-height: 1.05; margin-bottom: 2mm; }
        .sticker .meta { font-size: 8px; font-weight: 700; color: #333; overflow: hidden; text-overflow: ellipsis; }
        .sticker .serial { white-space: nowrap; overflow: visible; text-overflow: clip; font-size: 8px; letter-spacing: 0; }
        .sticker .tail { margin-top: auto; margin-bottom: auto; display: flex; flex-direction: column; gap: 0.4mm; }
        .corner-note { position: absolute; top: 1mm; right: 2mm; font-size: 7px; font-weight: 700; text-transform: uppercase; color: #111; white-space: nowrap; }
        .bottom-row { margin-top: 2mm; display: flex; justify-content: space-between; align-items: baseline; gap: 2mm; }
        .brand-mark { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #111; white-space: nowrap; line-height: 1; }
        .company-mark { font-size: 7px; font-weight: 700; text-transform: uppercase; color: #111; white-space: nowrap; line-height: 1; }
        .sticker .qr-wrap { flex-shrink: 0; align-self: flex-end; margin-top: auto; }
        .sticker img { display: block; width: 108px; height: 108px; }
      </style>
    </head>
    <body>
      <div class="sticker-sheet">
        <div class="corner-note">KEEP FROZEN</div>
        <div class="sticker">
          <div class="info">
            <div class="name">${item.product_name}</div>
            <div class="tail">
              <div class="meta serial">${serialNumber}</div>
              <div class="meta">${item.batch_number}</div>
              ${item.notes ? `<div class="meta">Notes: ${item.notes}</div>` : ''}
              <div class="meta">Mfg: ${formattedMfgDate}</div>
              <div class="meta">Expiry: ${expiryDate}</div>
              <div class="meta">SKU: ${item.sku || '-'}</div>
            </div>
          </div>
          <div class="qr-wrap">
            <img src="${qrDataUrl}" width="108" height="108" alt="QR" />
          </div>
        </div>
        <div class="bottom-row">
          <div class="brand-mark">${item.brand_name || '-'}</div>
          <div class="company-mark">GILNAKS FOOD CORPORATION</div>
        </div>
      </div>
    </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 250)
}

function openMultiStickerPrintWindow(
  item: Pick<ProductionScheduleItem, 'product_name' | 'sku' | 'brand_name' | 'batch_number' | 'notes'>,
  stickers: { serialNumber: string; manufactureDate: string; qrDataUrl: string }[],
  title: string
) {
  const formatDateYearLast = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (match) return `${match[2]}-${match[3]}-${match[1]}`
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    const mm = String(parsed.getMonth() + 1).padStart(2, '0')
    const dd = String(parsed.getDate()).padStart(2, '0')
    const yyyy = String(parsed.getFullYear())
    return `${mm}-${dd}-${yyyy}`
  }

  const stickerHtml = stickers
    .map(
      ({ serialNumber, manufactureDate, qrDataUrl }) => {
        const formattedMfgDate = formatDateYearLast(manufactureDate)
        const expiryDate = (() => {
          const mfg = new Date(manufactureDate)
          if (Number.isNaN(mfg.getTime())) return '-'
          mfg.setDate(mfg.getDate() + 400)
          const mm = String(mfg.getMonth() + 1).padStart(2, '0')
          const dd = String(mfg.getDate()).padStart(2, '0')
          const yyyy = String(mfg.getFullYear())
          return `${mm}-${dd}-${yyyy}`
        })()

        return `
        <div class="sticker-sheet">
          <div class="corner-note">KEEP FROZEN</div>
          <div class="sticker">
            <div class="info">
              <div class="name">${item.product_name}</div>
              <div class="tail">
                <div class="meta serial">${serialNumber}</div>
                <div class="meta">${item.batch_number}</div>
                ${item.notes ? `<div class="meta">Notes: ${item.notes}</div>` : ''}
                <div class="meta">Mfg: ${formattedMfgDate}</div>
                <div class="meta">Expiry: ${expiryDate}</div>
                <div class="meta">SKU: ${item.sku || '-'}</div>
              </div>
            </div>
            <div class="qr-wrap">
              <img src="${qrDataUrl}" width="108" height="108" alt="QR" />
            </div>
          </div>
          <div class="bottom-row">
            <div class="brand-mark">${item.brand_name || '-'}</div>
            <div class="company-mark">GILNAKS FOOD CORPORATION</div>
          </div>
        </div>
      `
      }
    )
    .join('')

  const printWindow = window.open('', '_blank')
  if (!printWindow) return
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @page { size: 60mm 40mm; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: sans-serif; }
        .sticker-sheet { width: 60mm; height: 40mm; padding: 2mm; overflow: hidden; page-break-inside: avoid; page-break-after: always; display: flex; flex-direction: column; position: relative; }
        .sticker-sheet:last-child { page-break-after: auto; }
        .sticker { flex: 1; min-height: 0; display: flex; flex-direction: row; align-items: flex-start; gap: 2mm; }
        .sticker .info { flex: 1; min-width: 0; font-size: 10px; line-height: 1.25; align-self: flex-start; display: flex; flex-direction: column; gap: 1mm; }
        .sticker .name { font-weight: bold; font-size: 14px; text-transform: uppercase; white-space: normal; overflow: visible; text-overflow: clip; word-break: break-word; overflow-wrap: anywhere; line-height: 1.05; margin-bottom: 2mm; }
        .sticker .meta { font-size: 8px; font-weight: 700; color: #333; overflow: hidden; text-overflow: ellipsis; }
        .sticker .serial { white-space: nowrap; overflow: visible; text-overflow: clip; font-size: 8px; letter-spacing: 0; }
        .sticker .tail { margin-top: auto; margin-bottom: auto; display: flex; flex-direction: column; gap: 0.4mm; }
        .corner-note { position: absolute; top: 1mm; right: 2mm; font-size: 7px; font-weight: 700; text-transform: uppercase; color: #111; white-space: nowrap; }
        .bottom-row { margin-top: 2mm; display: flex; justify-content: space-between; align-items: baseline; gap: 2mm; }
        .brand-mark { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #111; white-space: nowrap; line-height: 1; }
        .company-mark { font-size: 7px; font-weight: 700; text-transform: uppercase; color: #111; white-space: nowrap; line-height: 1; }
        .sticker .qr-wrap { flex-shrink: 0; align-self: flex-end; margin-top: auto; }
        .sticker img { display: block; width: 108px; height: 108px; }
      </style>
    </head>
    <body>${stickerHtml}</body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 250)
}

type ScheduleSnapshotRow = {
  product_id: string
  for_brand_id: string | null
  quantity_required: number
  notes: string | null
  batch_number: string
}

/** Snapshot of fields persisted by Save Schedule (excludes printed_count). */
function scheduleItemsSnapshot(items: ProductionScheduleItem[]): string {
  return JSON.stringify(
    items
      .map((i) => ({
        product_id: i.product_id,
        for_brand_id: i.for_brand_id ?? null,
        quantity_required: i.quantity_required,
        notes: i.notes ?? null,
        batch_number: i.batch_number,
      }))
      .sort((a, b) => {
        const keyA = `${a.for_brand_id ?? ''}:${a.product_id}`
        const keyB = `${b.for_brand_id ?? ''}:${b.product_id}`
        return keyA.localeCompare(keyB)
      })
  )
}

function parseScheduleSnapshot(json: string): ScheduleSnapshotRow[] {
  try {
    return JSON.parse(json) as ScheduleSnapshotRow[]
  } catch {
    return []
  }
}

/** True when current items are a subset of saved rows with identical fields (removals only). */
function isDeletionOnlyScheduleChange(
  items: ProductionScheduleItem[],
  savedSnapshot: string
): boolean {
  const saved = parseScheduleSnapshot(savedSnapshot)
  if (saved.length <= items.length) return false
  const savedById = new Map(
    saved.map((s) => [`${s.for_brand_id ?? ''}:${s.product_id}`, s])
  )
  for (const item of items) {
    const prev = savedById.get(`${item.for_brand_id ?? ''}:${item.product_id}`)
    if (!prev) return false
    if (prev.quantity_required !== item.quantity_required) return false
    if ((prev.notes ?? null) !== (item.notes ?? null)) return false
    if (prev.batch_number !== item.batch_number) return false
  }
  return true
}

interface FloorStaffRow {
  id: string
  staff_registration_id: string
  full_name: string
}

interface ProductBomLine {
  material_id: string
  material_name: string
  sku?: string
  unit: string
  qty_per_unit: number
  current_stock: number
  factory_inventory_kind?: string | null
  uom_purchase_unit?: string | null
  uom_stock_per_purchase?: number | string | null
  factory_request_uom?: string | null
}

interface ComputedBomLine extends ProductBomLine {
  total_qty: number
  released_qty?: number
  pending_qty?: number
}

const BOM_SIDEBAR_NUM_COL = 'w-[4rem]'
const BOM_SIDEBAR_MATERIAL_COL = 'py-1 text-left font-medium pr-1 min-w-0'
const BOM_SIDEBAR_REQ_COL =
  'py-1 text-right font-medium tabular-nums w-[4rem] pl-1 pr-0'
const BOM_SIDEBAR_STOCK_COL =
  'py-1 text-right font-medium tabular-nums w-[4rem] pl-0 pr-0'

function BomMaterialsTableSkeleton({
  highlightStockShortage = false,
  rows = 4,
}: {
  highlightStockShortage?: boolean
  rows?: number
}) {
  return (
    <table className="w-full text-xs table-fixed animate-pulse">
      <colgroup>
        <col />
        <col className={BOM_SIDEBAR_NUM_COL} />
        {highlightStockShortage ? <col className={BOM_SIDEBAR_NUM_COL} /> : null}
      </colgroup>
      <thead>
        <tr className="text-gray-500 border-b border-gray-100">
          <th className={BOM_SIDEBAR_MATERIAL_COL}>Material</th>
          <th className={BOM_SIDEBAR_REQ_COL}>Req</th>
          {highlightStockShortage ? <th className={BOM_SIDEBAR_STOCK_COL}>Stock</th> : null}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, i) => (
          <tr key={i} className="border-b border-gray-50 last:border-0">
            <td className={`${BOM_SIDEBAR_MATERIAL_COL} py-2`}>
              <div className="h-3 bg-gray-200 rounded w-[85%]" />
            </td>
            <td className={`${BOM_SIDEBAR_REQ_COL} py-2`}>
              <div className="h-3 bg-gray-200 rounded w-14 ml-auto" />
            </td>
            {highlightStockShortage ? (
              <td className={`${BOM_SIDEBAR_STOCK_COL} py-2`}>
                <div className="h-3 bg-gray-200 rounded w-14 ml-auto" />
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ProductionScheduleBomSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <section>
        <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
          Running total
        </h5>
        <BomMaterialsTableSkeleton highlightStockShortage rows={3} />
      </section>
      <section className="pt-2 border-t border-gray-100">
        <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
          By SKU
        </h5>
        <div className="rounded-md border border-gray-100 bg-gray-50/80 p-2">
          <div className="h-3 bg-gray-200 rounded w-[65%] mb-1.5" />
          <BomMaterialsTableSkeleton rows={1} />
        </div>
      </section>
    </div>
  )
}

function BomMaterialsTable({
  lines,
  emptyLabel = 'No BOM defined',
  highlightStockShortage = false,
}: {
  lines: ComputedBomLine[]
  emptyLabel?: string
  highlightStockShortage?: boolean
}) {
  if (lines.length === 0) {
    return <p className="text-xs text-gray-400 py-1">{emptyLabel}</p>
  }
  return (
    <table className="w-full text-xs table-fixed">
      <colgroup>
        <col />
        <col className={BOM_SIDEBAR_NUM_COL} />
        {highlightStockShortage ? <col className={BOM_SIDEBAR_NUM_COL} /> : null}
      </colgroup>
      <thead>
        <tr className="text-gray-500 border-b border-gray-100">
          <th className={BOM_SIDEBAR_MATERIAL_COL}>Material</th>
          <th className={BOM_SIDEBAR_REQ_COL}>Req</th>
          {highlightStockShortage ? <th className={BOM_SIDEBAR_STOCK_COL}>Stock</th> : null}
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => {
          const stock = Number(line.current_stock) || 0
          const released = Number(line.released_qty) || 0
          const pending = Number(line.pending_qty) || 0
          const coveredStock = stock + released + pending
          const fullyCovered =
            highlightStockShortage &&
            line.total_qty > 0 &&
            coveredStock >= line.total_qty
          const stockShort =
            highlightStockShortage &&
            line.total_qty > 0 &&
            coveredStock < line.total_qty
          return (
            <tr
              key={line.material_id}
              className={`border-b border-gray-50 last:border-0 ${
                stockShort
                  ? 'bg-red-50/90'
                  : fullyCovered
                    ? 'bg-emerald-50/80'
                    : ''
              }`}
            >
              <td className={`${BOM_SIDEBAR_MATERIAL_COL} text-gray-900`}>
                <span className="block break-words leading-snug">
                  {line.material_name}
                </span>
                {highlightStockShortage && (line.pending_qty ?? 0) > 0 ? (
                  <span className="text-[10px] text-amber-700 font-medium">
                    {formatBomQtyWithUnit(line.pending_qty ?? 0, line.unit)} pending
                  </span>
                ) : null}
              </td>
              <td className={`${BOM_SIDEBAR_REQ_COL} text-gray-900 whitespace-nowrap`}>
                {formatBomQtyWithUnit(line.total_qty, line.unit)}
              </td>
              {highlightStockShortage ? (
                <td
                  className={`${BOM_SIDEBAR_STOCK_COL} whitespace-nowrap ${
                    stockShort ? 'text-red-700 font-medium' : 'text-gray-700'
                  }`}
                >
                  {formatBomQtyWithUnit(stock, line.unit)}
                </td>
              ) : null}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

interface ProductionScheduleManagerProps {
  onClose?: () => void
  /** GFC factory brand id (product catalog). */
  brandId: string
  /** Destination consumer brand for this schedule view. */
  forBrandId: string
  brandName?: string
  destinationBrands?: DestinationBrandOption[]
  onForBrandChange?: (brandId: string) => void
  theme?: string
  currentUsername?: string
  /** When true, renders inline in a tab instead of a full-screen modal. */
  embedded?: boolean
  /** When true, hides schedule editing controls (role-based view-only). */
  readOnlyMode?: boolean
  scheduleDate?: string
  onScheduleDateChange?: (date: string) => void
}

export function ProductionScheduleManager({
  onClose,
  brandId,
  forBrandId,
  brandName,
  destinationBrands,
  onForBrandChange,
  theme = 'blue',
  currentUsername = '',
  embedded = false,
  readOnlyMode = false,
  scheduleDate: scheduleDateProp,
  onScheduleDateChange,
}: ProductionScheduleManagerProps) {
  const requestedBy = currentUsername.trim() || 'Factory'
  const today = getPhilippinesDate()
  const [internalScheduleDate, setInternalScheduleDate] = useState(today)
  const scheduleDate = scheduleDateProp ?? internalScheduleDate
  const setScheduleDate = onScheduleDateChange ?? setInternalScheduleDate
  const isPastSchedule = scheduleDate < today
  const isScheduleEditable = !readOnlyMode && !isPastSchedule
  const [items, setItems] = useState<ProductionScheduleItem[]>([])
  const [savedSnapshot, setSavedSnapshot] = useState(() => scheduleItemsSnapshot([]))
  const [allProducts, setAllProducts] = useState<(Product & { brand_name: string })[]>([])
  /** Full GFC catalog ids for schedule load/save on GFC Main (includes retail-mapped SKUs). */
  const [scheduleCatalogProductIds, setScheduleCatalogProductIds] = useState<string[]>([])
  const [categorySortOrders, setCategorySortOrders] = useState<Record<string, number>>({})
  const [categoryPortalSettings, setCategoryPortalSettings] = useState<
    Record<string, CategoryPortalSettings>
  >({})
  const [categoryPortalSettingsByBrand, setCategoryPortalSettingsByBrand] = useState<
    Record<string, Record<string, CategoryPortalSettings>>
  >({})
  const [productBomSettingsById, setProductBomSettingsById] = useState<
    Record<string, ProductBomSettings>
  >({})
  const [productIdsWithBom, setProductIdsWithBom] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [addQuantity, setAddQuantity] = useState('1')
  const [printingStickerKey, setPrintingStickerKey] = useState<string | null>(null)
  const [printingAllId, setPrintingAllId] = useState<string | null>(null)
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({})
  const [floorStaff, setFloorStaff] = useState<FloorStaffRow[]>([])
  const [bomByProductId, setBomByProductId] = useState<Record<string, ProductBomLine[]>>({})
  const [bomLoading, setBomLoading] = useState(false)
  const [releasedQtyByMaterial, setReleasedQtyByMaterial] = useState<Record<string, number>>({})
  const [pendingQtyByMaterial, setPendingQtyByMaterial] = useState<Record<string, number>>({})
  const [schedulePersistStatus, setSchedulePersistStatus] =
    useState<ProductionScheduleStatus | null>(null)
  const [pendingStickerQtyByScheduleId, setPendingStickerQtyByScheduleId] = useState<
    Record<string, number>
  >({})
  const [productionBatchesByScheduleId, setProductionBatchesByScheduleId] = useState<
    Record<string, FactoryBatchListItem[]>
  >({})
  const [revertingBatchId, setRevertingBatchId] = useState<string | null>(null)
  const isAggregateBrandView = isFactoryScheduleAggregateView(forBrandId, brandId)

  const scheduleScopeProductIds = useMemo(() => {
    const pickerIds = allProducts.map((p) => p.id).filter(Boolean) as string[]
    if (!isAggregateBrandView) return pickerIds
    // GFC Main view: schedule covers retail catalog FGs plus factory picker products
    // (e.g. Components). Using catalog-only IDs dropped saved component rows on reload.
    const ids = new Set<string>([...scheduleCatalogProductIds, ...pickerIds])
    return Array.from(ids)
  }, [isAggregateBrandView, scheduleCatalogProductIds, allProducts])

  const scheduleProductIds = useMemo(
    () => Array.from(new Set(items.map((i) => i.product_id).filter(Boolean))),
    [items]
  )

  const hasUnsavedChanges = useMemo(
    () => scheduleItemsSnapshot(items) !== savedSnapshot,
    [items, savedSnapshot]
  )
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges)
  const scheduleFetchSeqRef = useRef(0)
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges
  }, [hasUnsavedChanges])

  const scheduleProductionTotals = useMemo(() => {
    let required = 0
    let scanned = 0
    for (const item of items) {
      required += item.quantity_required
      scanned += countScannedStickers(item.stickers)
    }
    const pct = required > 0 ? Math.min(100, Math.round((scanned / required) * 100)) : 0
    return { required, scanned, pct, done: required > 0 && scanned >= required }
  }, [items])

  const refreshFactoryMaterialRequestQtys = useCallback(async () => {
    const { released, pending } = await fetchFactoryRequestQtysByMaterial(scheduleDate)
    setReleasedQtyByMaterial(released)
    setPendingQtyByMaterial(pending)
  }, [scheduleDate])

  const refreshStickerRequests = useCallback(async () => {
    const rows = await fetchPendingStickerRequests(scheduleDate, {
      forBrandId,
      factoryBrandId: brandId,
    })
    setPendingStickerQtyByScheduleId(buildPendingStickerQtyByScheduleId(rows))
  }, [scheduleDate, forBrandId, brandId])

  const refreshProductionBatches = useCallback(async (scheduleIds: string[]) => {
    if (!scheduleDate || !scheduleIds.length) {
      setProductionBatchesByScheduleId({})
      return
    }
    try {
      const batches = await fetchBatchesForSchedulesOnDate(scheduleIds, scheduleDate)
      const map: Record<string, FactoryBatchListItem[]> = {}
      for (const batch of batches) {
        if (!map[batch.schedule_id]) map[batch.schedule_id] = []
        map[batch.schedule_id].push(batch)
      }
      setProductionBatchesByScheduleId(map)
    } catch (err) {
      console.error('fetchBatchesForSchedulesOnDate:', err)
      setProductionBatchesByScheduleId({})
    }
  }, [scheduleDate])

  const handleRevertProductionBatch = async (batch: FactoryBatchListItem, productName: string) => {
    if (
      !confirm(
        `Revert the completed production batch for ${productName} back to in progress?\n\nThis undoes completion stock (component materials / finished goods transfer) and reverses accounting entries so factory scanning can continue. Floor BOM already used for this batch stays deducted.`
      )
    ) {
      return
    }
    setRevertingBatchId(batch.id)
    try {
      const result = await revertProductionBatchToInProgress(batch.id, { postedBy: requestedBy })
      if (!result.ok) {
        alert(result.message || 'Could not revert batch')
        return
      }
      await refreshProductionBatches(items.map((i) => i.schedule_id).filter(Boolean))
    } finally {
      setRevertingBatchId(null)
    }
  }

  useEffect(() => {
    fetchAllProducts()
    fetchFloorStaff()
    refreshFactoryMaterialRequestQtys()
    refreshStickerRequests()
  }, [scheduleDate, brandId, forBrandId, refreshFactoryMaterialRequestQtys, refreshStickerRequests])

  useEffect(() => {
    const onFocus = () => {
      refreshFactoryMaterialRequestQtys()
      refreshStickerRequests()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshFactoryMaterialRequestQtys, refreshStickerRequests])

  useEffect(() => {
    if (loading) return
    fetchSchedule()
  }, [scheduleDate, brandId, forBrandId, allProducts, loading])

  useEffect(() => {
    fetchBomForProducts(scheduleProductIds)
  }, [scheduleProductIds.join('|')])

  const addableProducts = useMemo(
    () =>
      allProducts.filter((p) => {
        if (isProductConsumableSupply(p, categorySortOrders)) return false
        return true
      }),
    [allProducts, categorySortOrders]
  )

  const yieldForProductId = useCallback(
    (productId: string) => {
      const bomYield = scheduleYieldPerBatch(productBomSettingsById[productId])
      if (bomYield > 1) return bomYield
      const product = allProducts.find((p) => p.id === productId)
      if (product) {
        const portalSettings =
          isAggregateBrandView && product.brand_id
            ? categoryPortalSettingsByBrand[product.brand_id] || categoryPortalSettings
            : categoryPortalSettings
        const categoryYield = getCategoryYieldPerBatch(product.category, portalSettings)
        if (categoryYield > 1) return categoryYield
      }
      return bomYield
    },
    [
      productBomSettingsById,
      allProducts,
      categoryPortalSettings,
      categoryPortalSettingsByBrand,
      isAggregateBrandView,
    ]
  )

  const selectedProductHasBom = selectedProduct
    ? productIdsWithBom.has(selectedProduct)
    : false

  const selectedAddYield = selectedProduct ? yieldForProductId(selectedProduct) : 1
  const selectedAddBatches = parseInt(addQuantity, 10) || 0
  const selectedAddScheduleQty = batchesToScheduleQty(selectedAddBatches, selectedAddYield)

  const addableProductsByCategory = useMemo(() => {
    const grouped = addableProducts.reduce(
      (acc, p) => {
        const cat = categoryDisplayName(p.category)
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(p)
        return acc
      },
      {} as Record<string, (Product & { brand_name: string })[]>
    )

    for (const list of Object.values(grouped)) {
      list.sort(compareProductsByStockLevel)
    }

    return Object.keys(grouped)
      .sort((a, b) => {
        const worstRank = (cat: string) => {
          const products = grouped[cat]
          if (!products.length) return 2
          return Math.min(
            ...products.map((p) =>
              getStockLevelSortRank(
                getProductStockLevel(
                  computeProductAvailableStock(p),
                  p.minimum_stock ?? 0
                )
              )
            )
          )
        }
        const stockA = worstRank(a)
        const stockB = worstRank(b)
        if (stockA !== stockB) return stockA - stockB
        const rankA = categorySortRank(a, categorySortOrders[a])
        const rankB = categorySortRank(b, categorySortOrders[b])
        if (rankA !== rankB) return rankA - rankB
        return a.localeCompare(b)
      })
      .map((category) => ({ category, products: grouped[category] }))
  }, [addableProducts, categorySortOrders])

  const pickerDisabledProductIds = useMemo(() => {
    const disabled = new Set<string>()
    for (const p of addableProducts) {
      if (isProductConsumableSupply(p, categorySortOrders)) {
        disabled.add(p.id)
        continue
      }
      if (!productIdsWithBom.has(p.id)) disabled.add(p.id)
    }
    return disabled
  }, [addableProducts, productIdsWithBom, categorySortOrders])

  const pickerDisabledReasonById = useMemo(() => {
    const reasons: Record<string, string> = {}
    for (const p of addableProducts) {
      if (isProductConsumableSupply(p, categorySortOrders)) {
        reasons[p.id] = 'Supplies — use Product Inventory material link'
      }
    }
    return reasons
  }, [addableProducts, categorySortOrders])

  useEffect(() => {
    if (selectedProduct && !productIdsWithBom.has(selectedProduct)) {
      setSelectedProduct('')
    }
  }, [selectedProduct, productIdsWithBom])

  const fetchBomForProducts = async (productIds: string[]) => {
    if (productIds.length === 0) {
      setBomByProductId({})
      setBomLoading(false)
      return
    }
    setBomLoading(true)
    try {
      const map = await fetchBomLinesByProductId(productIds, { factoryFloorOnly: embedded })
      setBomByProductId(map)
    } catch (err) {
      console.error('Error fetching BOM:', err)
      setBomByProductId({})
    } finally {
      setBomLoading(false)
      void refreshFactoryMaterialRequestQtys()
    }
  }

  const enrichBomLine = (line: ComputedBomLine): ComputedBomLine => ({
    ...line,
    released_qty: requestQtyToBomDisplayUnits(
      releasedQtyByMaterial[line.material_id],
      line
    ),
    pending_qty: requestQtyToBomDisplayUnits(pendingQtyByMaterial[line.material_id], line),
  })

  const computeLinesForItem = (item: ProductionScheduleItem): ComputedBomLine[] => {
    const lines = bomByProductId[item.product_id] || []
    return lines
      .map((line) =>
        enrichBomLine({
          ...line,
          total_qty: line.qty_per_unit * item.quantity_required,
        })
      )
      .sort((a, b) => a.material_name.localeCompare(b.material_name))
  }

  const runningBom = useMemo(() => {
    const totals = new Map<string, ComputedBomLine>()
    for (const item of items) {
      for (const line of computeLinesForItem(item)) {
        const existing = totals.get(line.material_id)
        if (existing) {
          existing.total_qty += line.total_qty
        } else {
          totals.set(line.material_id, { ...line })
        }
      }
    }
    return Array.from(totals.values())
      .map(enrichBomLine)
      .sort((a, b) => a.material_name.localeCompare(b.material_name))
  }, [items, bomByProductId, releasedQtyByMaterial, pendingQtyByMaterial])

  const perSkuBom = useMemo(
    () =>
      items.map((item) => ({
        item,
        lines: computeLinesForItem(item),
      })),
    [items, bomByProductId, releasedQtyByMaterial, pendingQtyByMaterial]
  )

  const bomStockShortages = useMemo(
    () => findBomStockShortages(runningBom),
    [runningBom]
  )

  const bomStockSatisfied =
    items.length === 0 || (!bomLoading && bomStockShortages.length === 0)

  const deletionOnlyChange = useMemo(
    () => hasUnsavedChanges && isDeletionOnlyScheduleChange(items, savedSnapshot),
    [hasUnsavedChanges, items, savedSnapshot]
  )

  /** Line removals can be saved without re-checking BOM; draft confirm still needs stock coverage. */
  const canConfirmSchedule = useMemo(() => {
    if (bomLoading) return false
    if (deletionOnlyChange) return true
    if (hasUnsavedChanges) {
      return items.length === 0 || bomStockShortages.length === 0
    }
    if (schedulePersistStatus === 'draft' && items.length > 0) {
      return bomStockShortages.length === 0
    }
    return false
  }, [
    bomLoading,
    deletionOnlyChange,
    hasUnsavedChanges,
    items.length,
    schedulePersistStatus,
    bomStockShortages.length,
  ])

  const fetchAllProducts = async () => {
    if (!brandId || !forBrandId) return
    setLoading(true)
    setAllProducts([])
    try {
      const categorySortSelect =
        'category_name, sort_index, show_on_order_portal, remote_store, yield_per_batch'
      const shouldLoadGfcComponents = !isAggregateBrandView && brandId !== forBrandId
      const [pickerProducts, sortRes, catalogProducts, retailBrands, gfcComponentsLoad] =
        await Promise.all([
          loadGfcProducts(forBrandId),
          supabase
            .from('product_category_sort')
            .select(categorySortSelect)
            .eq('brand_id', brandId),
          isAggregateBrandView ? loadGfcCatalogProducts() : Promise.resolve(null),
          isAggregateBrandView ? loadRetailBrands() : Promise.resolve(null),
          shouldLoadGfcComponents
            ? loadBomComponentProductsForBrand(brandId)
            : Promise.resolve({ products: [], categorySortOrders: {} }),
        ])
      const factoryBrandName =
        destinationBrands?.find((b) => b.id === brandId)?.name || brandName || 'GFC Main'
      const pickerIds = new Set(pickerProducts.map((p) => p.id))
      const mergedPickerProducts = [
        ...pickerProducts,
        ...gfcComponentsLoad.products
          .filter((p) => p.id && !pickerIds.has(p.id))
          .map((p) => ({
            ...p,
            brand_id: brandId,
            name: p.product_name || p.name || '',
            product_name: p.product_name || p.name || '',
          })),
      ]
      const catalogIds = (catalogProducts || []).map((p) => p.id)
      setScheduleCatalogProductIds(
        isAggregateBrandView ? catalogIds : mergedPickerProducts.map((p) => p.id)
      )

      const productsWithBrand = mergedPickerProducts.map((p) => {
        const displayName = p.name || ''
        const isGfcComponent = p.brand_id === brandId && brandId !== forBrandId
        return {
          ...p,
          name: displayName,
          product_name: displayName,
          brand_name: isGfcComponent
            ? factoryBrandName
            : isAggregateBrandView
              ? brandName || 'GFC Main'
              : brandName || 'Unknown',
        }
      })
      const bomProductIds = productsWithBrand.map((p) => p.id)
      setAllProducts(productsWithBrand)

      const [bomItemsByProduct, productIdsWithBom] = await Promise.all([
        fetchProductBomItemsByProductId(bomProductIds),
        fetchProductIdsWithBomItems(bomProductIds),
      ])
      const bomSettings = await fetchProductBomSettingsByProductId(
        bomProductIds,
        bomItemsByProduct
      )
      setProductBomSettingsById(bomSettings)
      setProductIdsWithBom(productIdsWithBom)

      if (sortRes.error) {
        console.warn('product_category_sort:', sortRes.error.message)
        setCategorySortOrders({})
        setCategoryPortalSettings({})
      } else {
        const orders: Record<string, number> = { ...gfcComponentsLoad.categorySortOrders }
        for (const row of sortRes.data || []) {
          orders[productCategoryDisplayName(row.category_name)] = row.sort_index
        }
        setCategorySortOrders(orders)
        setCategoryPortalSettings(buildCategoryPortalMap(sortRes.data))
      }

      if (isAggregateBrandView && retailBrands?.length) {
        const retailBrandIds = retailBrands.map((b) => b.id as string)
        const { data: retailSortRows, error: retailSortErr } = await supabase
          .from('product_category_sort')
          .select(`brand_id, ${categorySortSelect}`)
          .in('brand_id', retailBrandIds)
        if (retailSortErr) {
          console.warn('product_category_sort (retail):', retailSortErr.message)
          setCategoryPortalSettingsByBrand({})
        } else {
          const byBrand: Record<string, Record<string, CategoryPortalSettings>> = {}
          for (const row of retailSortRows || []) {
            const bid = row.brand_id as string
            if (!byBrand[bid]) byBrand[bid] = {}
            byBrand[bid][productCategoryStorageKey(row.category_name)] =
              parseCategoryPortalRow(row)
          }
          setCategoryPortalSettingsByBrand(byBrand)
        }
      } else {
        setCategoryPortalSettingsByBrand({})
      }
    } catch (err) {
      console.error('Error fetching products:', err)
      alert('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const fetchFloorStaff = async () => {
    if (!scheduleDate) return
    try {
      const { data, error } = await supabase
        .from('factory_daily_staff')
        .select('id, staff_registration_id, staff_registrations(full_name)')
        .eq('work_date', scheduleDate)
        .order('created_at', { ascending: true })

      if (error) {
        console.warn('factory_daily_staff:', error.message)
        setFloorStaff([])
        return
      }

      setFloorStaff(
        (data || []).map((r: any) => ({
          id: r.id,
          staff_registration_id: r.staff_registration_id,
          full_name: r.staff_registrations?.full_name || 'Staff',
        }))
      )
    } catch (err) {
      console.error('Error fetching factory staff:', err)
      setFloorStaff([])
    }
  }

  const fetchSchedule = async (options?: { background?: boolean; force?: boolean }) => {
    if (!scheduleDate || !forBrandId) return
    const seq = ++scheduleFetchSeqRef.current
    if (!options?.background) {
      setScheduleLoading(true)
      // Keep current rows visible during forced refresh after save (avoids empty skeleton flash).
      if (!options?.force) {
        setItems([])
        setSavedSnapshot(scheduleItemsSnapshot([]))
        setSchedulePersistStatus(null)
      }
    }
    try {
      if (scheduleScopeProductIds.length === 0) {
        if (seq !== scheduleFetchSeqRef.current) return
        if (hasUnsavedChangesRef.current && !options?.force) return
        setItems([])
        setSavedSnapshot(scheduleItemsSnapshot([]))
        setSchedulePersistStatus(null)
        return
      }

      let scheduleQuery = supabase
        .from('production_schedules')
        .select('id, product_id, quantity_required, batch_number, notes, status, for_brand_id')
        .eq('schedule_date', scheduleDate)
        .in('product_id', scheduleScopeProductIds)
        .in('status', ['draft', 'active'])

      if (!isAggregateBrandView) {
        scheduleQuery = scheduleQuery.eq('for_brand_id', forBrandId)
      }

      const { data: scheduleData, error } = await scheduleQuery

      if (error) throw error

      if (!scheduleData || scheduleData.length === 0) {
        if (seq !== scheduleFetchSeqRef.current) return
        if (hasUnsavedChangesRef.current && !options?.force) return
        setItems([])
        setSavedSnapshot(scheduleItemsSnapshot([]))
        setSchedulePersistStatus(null)
        return
      }

      const statuses = new Set(
        scheduleData.map((r: { status?: string }) => r.status).filter(Boolean)
      )
      const fetchedPersistStatus: ProductionScheduleStatus = statuses.has('draft')
        ? 'draft'
        : 'active'

      const forBrandIds = Array.from(
        new Set(
          scheduleData
            .map((r: { for_brand_id?: string | null }) => r.for_brand_id)
            .filter(Boolean)
        )
      ) as string[]
      const { data: forBrandsData } = forBrandIds.length
        ? await supabase.from('brands').select('id, name').in('id', forBrandIds)
        : { data: [] as { id: string; name: string }[] }
      const forBrandNameById = new Map(
        (forBrandsData || []).map((b) => [b.id as string, b.name as string])
      )

      const productIds = scheduleData.map(s => s.product_id)
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, sku, brand_id, brands(name)')
        .in('id', productIds)

      const productMap = new Map((productsData || []).map((p: any) => [
        p.id,
        { name: p.name, sku: p.sku, brand_name: p.brands?.name || 'Unknown' }
      ]))

      const { data: stickerData } = await supabase
        .from('production_sticker_logs')
        .select(
          'id, product_id, schedule_id, serial_number, manufacture_date, produced_at, voided_at, created_at'
        )
        .eq('manufacture_date', scheduleDate)
        .order('created_at', { ascending: true })

      const scheduleItems = scheduleData.flatMap((row: any) => {
        const prod = productMap.get(row.product_id)
        if (!prod) return []
        const stickers: StickerLog[] = (stickerData || [])
          .filter(
            (p: any) =>
              p.product_id === row.product_id &&
              (p.schedule_id === row.id || !p.schedule_id) &&
              p.serial_number
          )
          .map((p: any) => ({
            id: p.id,
            serial_number: p.serial_number,
            manufacture_date: p.manufacture_date,
            produced_at: p.produced_at ?? null,
            voided_at: p.voided_at ?? null,
          }))
        const activeCount = countActiveStickers(stickers)
        const batchNum = row.batch_number || `BATCH-${scheduleDate.replace(/-/g, '')}-${(prod?.sku || '').replace(/-/g, '')}`
        const rowForBrandId = row.for_brand_id as string | undefined
        const destBrandName = rowForBrandId
          ? forBrandNameById.get(rowForBrandId) || brandName || 'Unknown'
          : brandName || prod?.brand_name || 'Unknown'
        const displayName = prod?.name || 'Unknown'
        return [{
          schedule_id: row.id,
          product_id: row.product_id,
          product_name: displayName,
          sku: prod?.sku,
          brand_name: destBrandName,
          for_brand_id: rowForBrandId,
          quantity_required: row.quantity_required,
          batch_number: batchNum,
          notes: row.notes,
          printed_count: activeCount,
          stickers,
        }]
      })
      if (isAggregateBrandView) {
        scheduleItems.sort((a, b) => {
          const byBrand = a.brand_name.localeCompare(b.brand_name, undefined, {
            sensitivity: 'base',
          })
          if (byBrand !== 0) return byBrand
          return a.product_name.localeCompare(b.product_name, undefined, {
            sensitivity: 'base',
          })
        })
      }

      if (seq !== scheduleFetchSeqRef.current) return
      if (hasUnsavedChangesRef.current && !options?.force) return

      setSchedulePersistStatus(fetchedPersistStatus)
      setItems(scheduleItems)
      setSavedSnapshot(scheduleItemsSnapshot(scheduleItems))
      void refreshProductionBatches(scheduleItems.map((i) => i.schedule_id).filter(Boolean))
    } catch (err) {
      console.error('Error fetching schedule:', err)
      if (seq !== scheduleFetchSeqRef.current) return
      if (hasUnsavedChangesRef.current && !options?.force) return
      setItems([])
      setSavedSnapshot(scheduleItemsSnapshot([]))
      setSchedulePersistStatus(null)
    } finally {
      if (!options?.background && seq === scheduleFetchSeqRef.current) {
        setScheduleLoading(false)
      }
    }
  }

  useEffect(() => {
    const refreshInBackground = () => {
      if (document.visibilityState !== 'visible' || loading) return
      void fetchSchedule({ background: true })
    }
    window.addEventListener('focus', refreshInBackground)
    document.addEventListener('visibilitychange', refreshInBackground)
    return () => {
      window.removeEventListener('focus', refreshInBackground)
      document.removeEventListener('visibilitychange', refreshInBackground)
    }
  }, [loading, scheduleDate, forBrandId, brandId, allProducts, scheduleScopeProductIds])

  const generateBatchNumber = (product: { sku?: string }) => {
    const skuPart = (product.sku || '').replace(/-/g, '')
    return `BATCH-${scheduleDate.replace(/-/g, '')}${skuPart ? '-' + skuPart : ''}`
  }

  const handleAddProduct = async () => {
    const batches = parseInt(addQuantity, 10) || 1
    if (!selectedProduct || batches < 1) return
    const product = addableProducts.find(p => p.id === selectedProduct)
    if (!product) return
    if (!productIdsWithBom.has(selectedProduct)) {
      alert('Configure a bill of materials for this product before adding it to the schedule.')
      return
    }

    const yieldPerBatch = yieldForProductId(selectedProduct)
    const qty = batchesToScheduleQty(batches, yieldPerBatch)
    if (qty < 1) return

    const batchNum = generateBatchNumber(product)
    const itemForBrandId = isAggregateBrandView
      ? product.brand_id || brandId
      : forBrandId
    const itemBrandName = isAggregateBrandView
      ? product.brand_name || brandName || 'GFC'
      : brandName || product.brand_name
    setItems(prev => {
      const existing = prev.find(
        (i) =>
          i.product_id === selectedProduct &&
          (i.for_brand_id || forBrandId) === itemForBrandId
      )
      if (existing) {
        return prev.map((i) =>
          i.product_id === selectedProduct &&
          (i.for_brand_id || forBrandId) === itemForBrandId
            ? { ...i, quantity_required: i.quantity_required + qty }
            : i
        )
      }
      return [...prev, {
        schedule_id: '',
        product_id: selectedProduct,
        product_name: product.name || '',
        sku: product.sku,
        brand_name: itemBrandName,
        for_brand_id: itemForBrandId,
        quantity_required: qty,
        batch_number: batchNum,
        printed_count: 0,
        stickers: [],
      }]
    })
    setSelectedProduct('')
    setAddQuantity('1')
  }

  const handleRemoveItem = (item: ProductionScheduleItem) => {
    const label = item.product_name || item.sku || 'This product'
    const activeCount = countActiveStickers(item.stickers)
    let message = 'Remove this product from the schedule?'
    if (activeCount > 0) {
      const count = activeCount
      message = `${label} already has ${count} printed sticker${count === 1 ? '' : 's'}.\n\nRemove it from the schedule anyway? You must save the schedule for this to take effect. Printed stickers will stay in the system.`
    }

    if (!confirm(message)) return

    const key = scheduleItemKey(item)
    setItems((prev) => prev.filter((i) => scheduleItemKey(i) !== key))
  }

  const handleUpdateScheduleBatches = (item: ProductionScheduleItem, batches: number) => {
    const yieldPerBatch = yieldForProductId(item.product_id)
    const quantity = batchesToScheduleQty(batches, yieldPerBatch)
    const key = scheduleItemKey(item)
    setItems((prev) =>
      prev.map((i) =>
        scheduleItemKey(i) === key ? { ...i, quantity_required: quantity } : i
      )
    )
  }

  const handleUpdateNotes = (item: ProductionScheduleItem, notes: string) => {
    const key = scheduleItemKey(item)
    setItems((prev) =>
      prev.map((i) =>
        scheduleItemKey(i) === key ? { ...i, notes: notes || undefined } : i
      )
    )
  }

  const resolveItemForBrandId = (item: ProductionScheduleItem) =>
    item.for_brand_id || forBrandId

  const generateSerialNumber = (releaseId: string, manufactureDate: string) => {
    const datePart = manufactureDate.replace(/-/g, '')
    const shortId = releaseId.replace(/-/g, '').slice(0, 8).toUpperCase()
    return `GFC-${datePart}-${shortId}`
  }

  const toggleExpanded = (productId: string) => {
    setExpandedProductIds((prev) => ({ ...prev, [productId]: !prev[productId] }))
  }

  const hasNewPrintCapacity = (item: ProductionScheduleItem) => {
    const active = countActiveStickers(item.stickers)
    return (
      active <
      stickerPrintTarget(
        item.quantity_required,
        item.schedule_id,
        pendingStickerQtyByScheduleId
      )
    )
  }

  const isScheduleConfirmed = schedulePersistStatus === 'active' && !hasUnsavedChanges

  const isNewPrintBlocked = (item: ProductionScheduleItem) => {
    if (!item.schedule_id || schedulePersistStatus !== 'active') return true
    if (hasUnsavedChanges && !isPrintingFactoryRequestedStickers(item)) return true
    return false
  }

  const isAdditionalPrintBlocked = (item: ProductionScheduleItem) =>
    !item.schedule_id || schedulePersistStatus !== 'active'

  const canPrintAdditionalSticker = (item: ProductionScheduleItem) =>
    !isAdditionalPrintBlocked(item)

  const saveBeforePrintTitle =
    schedulePersistStatus === 'draft'
      ? 'Confirm the schedule (Save Schedule) before printing new stickers'
      : 'Save the schedule before printing new stickers'

  const getRemainingCount = (item: ProductionScheduleItem) => {
    const target = stickerPrintTarget(
      item.quantity_required,
      item.schedule_id,
      pendingStickerQtyByScheduleId
    )
    return Math.max(0, target - countActiveStickers(item.stickers))
  }

  const getRequiredRemainingCount = (item: ProductionScheduleItem) =>
    Math.max(0, item.quantity_required - countActiveStickers(item.stickers))

  const getPendingStickerCount = (item: ProductionScheduleItem) =>
    pendingStickerQtyByScheduleId[item.schedule_id] ?? 0

  const getRequestedRemainingCount = (item: ProductionScheduleItem) => {
    const requiredRemaining = getRequiredRemainingCount(item)
    return Math.min(
      getPendingStickerCount(item),
      Math.max(0, getRemainingCount(item) - requiredRemaining)
    )
  }

  const isPrintingFactoryRequestedStickers = (item: ProductionScheduleItem) =>
    countActiveStickers(item.stickers) >= item.quantity_required &&
    getPendingStickerCount(item) > 0

  const canShowPrintActions = (item: ProductionScheduleItem) =>
    isScheduleEditable || getRequestedRemainingCount(item) > 0

  const resolveScheduleId = async (item: ProductionScheduleItem) => {
    if (item.schedule_id) return item.schedule_id
    const { data } = await supabase
      .from('production_schedules')
      .select('id')
      .eq('product_id', item.product_id)
      .eq('schedule_date', scheduleDate)
      .eq('for_brand_id', resolveItemForBrandId(item))
      .eq('status', 'active')
      .maybeSingle()
    return data?.id
  }

  const persistScheduleRows = async (
    status: ProductionScheduleStatus
  ): Promise<boolean> => {
    if (!scheduleDate || status === 'cancelled') return false
    const currentBrandProductIds = scheduleScopeProductIds
    try {
      const idByProduct = new Map<string, string>()
      for (const item of items) {
        const product = allProducts.find((p) => p.id === item.product_id)
        const batchNum =
          item.batch_number ||
          (product ? generateBatchNumber(product) : `BATCH-${scheduleDate.replace(/-/g, '')}`)
        const itemForBrandId = resolveItemForBrandId(item)
        const { data, error } = await supabase
          .from('production_schedules')
          .upsert(
            {
              product_id: item.product_id,
              schedule_date: scheduleDate,
              for_brand_id: itemForBrandId,
              quantity_required: item.quantity_required,
              batch_number: batchNum,
              notes: item.notes || null,
              status,
            },
            { onConflict: 'product_id,schedule_date,for_brand_id' }
          )
          .select('id, product_id, for_brand_id')

        if (error) {
          if (error.message.includes('status')) {
            alert(
              'Run migrations/production-schedule-draft-material-requests.sql in Supabase first.'
            )
          } else {
            throw error
          }
          return false
        }
        for (const row of data || []) {
          const mapKey = `${row.for_brand_id as string}:${row.product_id as string}`
          idByProduct.set(mapKey, row.id as string)
        }
      }

      let existingQuery = supabase
        .from('production_schedules')
        .select('id, product_id, for_brand_id')
        .eq('schedule_date', scheduleDate)
        .in('product_id', currentBrandProductIds)
        .in('status', ['draft', 'active'])

      if (!isAggregateBrandView) {
        existingQuery = existingQuery.eq('for_brand_id', forBrandId)
      }

      const { data: existing } = await existingQuery

      for (const row of existing || []) {
        const rowForBrandId = row.for_brand_id as string
        if (
          !items.some(
            (i) =>
              i.product_id === row.product_id &&
              resolveItemForBrandId(i) === rowForBrandId
          )
        ) {
          const { error: deleteError } = await supabase
            .from('production_schedules')
            .delete()
            .eq('id', row.id)
          if (deleteError) throw deleteError
        }
      }

      const nextItems = items.map((i) => ({
        ...i,
        schedule_id:
          idByProduct.get(`${resolveItemForBrandId(i)}:${i.product_id}`) || i.schedule_id,
      }))
      setItems(nextItems)
      setSavedSnapshot(scheduleItemsSnapshot(nextItems))
      setSchedulePersistStatus(status)
      return true
    } catch (err) {
      console.error('Error persisting schedule:', err)
      alert(
        'Failed to save schedule: ' + (err instanceof Error ? err.message : String(err))
      )
      return false
    }
  }

  const handleSaveDraft = async () => {
    if (!scheduleDate || items.length === 0) return
    setSaving(true)
    try {
      const ok = await persistScheduleRows('draft')
      if (ok) {
        alert('Production schedule saved as draft.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleCancelDraft = async () => {
    if (!scheduleDate) return
    if (
      !confirm(
        'Cancel this draft schedule? Saved draft lines for this date will be marked cancelled.'
      )
    ) {
      return
    }
    setSaving(true)
    try {
      if (scheduleScopeProductIds.length > 0) {
        let cancelQuery = supabase
          .from('production_schedules')
          .update({ status: 'cancelled' })
          .eq('schedule_date', scheduleDate)
          .in('product_id', scheduleScopeProductIds)
          .eq('status', 'draft')
        if (!isAggregateBrandView) {
          cancelQuery = cancelQuery.eq('for_brand_id', forBrandId)
        }
        const { error } = await cancelQuery
        if (error) {
          if (error.message.includes('status')) {
            alert(
              'Run migrations/production-schedule-draft-material-requests.sql in Supabase first.'
            )
            return
          }
          throw error
        }
      }
      setItems([])
      setSavedSnapshot(scheduleItemsSnapshot([]))
      setSchedulePersistStatus(null)
      alert('Draft schedule cancelled.')
    } catch (err) {
      console.error(err)
      alert('Failed to cancel draft.')
    } finally {
      setSaving(false)
    }
  }

  const handleRequestMaterials = async () => {
    if (!scheduleDate || items.length === 0) return
    if (bomLoading) {
      alert('Please wait for bill of materials to finish loading.')
      return
    }
    if (bomStockShortages.length === 0) {
      alert('No material shortfalls — you can save the schedule directly.')
      return
    }
    setSaving(true)
    try {
      const ok = await persistScheduleRows('draft')
      if (!ok) return
      const { created, skipped } = await createMaterialRequestsForScheduleBom(
        runningBom.map((line) => ({
          material_id: line.material_id,
          required_stock: bomDisplayQtyToStockForLine(line.total_qty, line),
          floor_stock: bomDisplayQtyToStockForLine(Number(line.current_stock) || 0, line),
          pending_request_qty: pendingQtyByMaterial[line.material_id] || 0,
          released_request_qty: releasedQtyByMaterial[line.material_id] || 0,
        })),
        {
          scheduleDate,
          brandId: isAggregateBrandView ? brandId : forBrandId,
          requestedBy,
        }
      )
      await refreshFactoryMaterialRequestQtys()
      if (created === 0 && skipped > 0) {
        alert(
          'Draft saved. Pending requests already exist for all short materials — see Material Requests tab.'
        )
      } else {
        alert(
          `Draft saved. ${created} material request${created === 1 ? '' : 's'} sent to Procurement${skipped ? ` (${skipped} already pending)` : ''}.`
        )
      }
    } catch (err) {
      console.error(err)
      alert(
        'Failed to request materials: ' +
          (err instanceof Error ? err.message : String(err))
      )
    } finally {
      setSaving(false)
    }
  }

  const handlePrintSticker = async (
    item: ProductionScheduleItem,
    existing?: StickerLog,
    options?: { additional?: boolean }
  ) => {
    const printKey = existing?.id ?? `new-${item.product_id}-${options?.additional ? 'add' : 'req'}`
    setPrintingStickerKey(printKey)
    try {
      const QRCode = (await import('qrcode')).default

      if (existing) {
        if (existing.voided_at) return
        const qrDataUrl = await QRCode.toDataURL(existing.serial_number, { width: 108, margin: 1 })
        openStickerPrintWindow(
          item,
          existing.serial_number,
          existing.manufacture_date,
          qrDataUrl,
          `Reprint — ${item.product_name}`
        )
        return
      }

      const activeBefore = countActiveStickers(item.stickers)
      const isAdditional =
        options?.additional === true || activeBefore >= item.quantity_required

      if (isAdditional) {
        if (isAdditionalPrintBlocked(item)) {
          alert(saveBeforePrintTitle)
          return
        }
        if (!options?.additional && !hasNewPrintCapacity(item)) return
      } else {
        if (isNewPrintBlocked(item)) {
          alert(saveBeforePrintTitle)
          return
        }
        if (!hasNewPrintCapacity(item)) return
      }

      const manufactureDate = getPhilippinesDate()
      const stickerId = crypto.randomUUID()
      const serialNumber = generateSerialNumber(stickerId, manufactureDate)
      const scheduleId = await resolveScheduleId(item)
      if (!scheduleId) {
        alert(saveBeforePrintTitle)
        return
      }

      const { error: insertError } = await supabase.from('production_sticker_logs').insert({
        id: stickerId,
        product_id: item.product_id,
        schedule_id: scheduleId,
        batch_number: item.batch_number,
        manufacture_date: manufactureDate,
        serial_number: serialNumber,
      })

      if (insertError) throw insertError

      const qrDataUrl = await QRCode.toDataURL(serialNumber, { width: 108, margin: 1 })
      openStickerPrintWindow(
        item,
        serialNumber,
        manufactureDate,
        qrDataUrl,
        options?.additional ? `Additional — ${item.product_name}` : undefined
      )
      const extraPrinted = newExtraStickersPrinted(
        activeBefore,
        activeBefore + 1,
        item.quantity_required
      )
      if (extraPrinted > 0) {
        await fulfillStickerRequests(scheduleId, extraPrinted)
        await refreshStickerRequests()
      }
      await fetchSchedule()
    } catch (err) {
      console.error('Error printing:', err)
      alert('Failed to print sticker: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setPrintingStickerKey(null)
    }
  }

  const handleVoidSticker = async (sticker: StickerLog, item: ProductionScheduleItem) => {
    if (sticker.voided_at) return
    const label = sticker.serial_number || 'this sticker'
    if (
      !confirm(
        `Void ${label}?\n\nIt cannot be scanned. If it was counted toward today's schedule or production inventory, that count will be reversed.`
      )
    ) {
      return
    }
    try {
      await voidProductionSticker(sticker.id)
      await refreshStickerRequests()
      await fetchSchedule()
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    }
  }

  const handlePrintAdditional = async (item: ProductionScheduleItem) => {
    await handlePrintSticker(item, undefined, { additional: true })
  }

  const handlePrintStickers = async (item: ProductionScheduleItem, count: number) => {
    if (count <= 0 || !hasNewPrintCapacity(item)) return
    if (isNewPrintBlocked(item)) {
      alert(saveBeforePrintTitle)
      return
    }
    setPrintingAllId(scheduleItemKey(item))
    try {
      const manufactureDate = getPhilippinesDate()
      const scheduleId = await resolveScheduleId(item)
      if (!scheduleId) {
        alert(saveBeforePrintTitle)
        return
      }

      const QRCode = (await import('qrcode')).default
      const toPrint: { stickerId: string; serialNumber: string; qrDataUrl: string }[] = []

      for (let i = 0; i < count; i++) {
        const stickerId = crypto.randomUUID()
        const serialNumber = generateSerialNumber(stickerId, manufactureDate)
        const qrDataUrl = await QRCode.toDataURL(serialNumber, { width: 108, margin: 1 })
        toPrint.push({ stickerId, serialNumber, qrDataUrl })
      }

      for (const { stickerId, serialNumber } of toPrint) {
        const { error: insertError } = await supabase.from('production_sticker_logs').insert({
          id: stickerId,
          product_id: item.product_id,
          schedule_id: scheduleId,
          batch_number: item.batch_number,
          manufacture_date: manufactureDate,
          serial_number: serialNumber,
        })
        if (insertError) throw insertError
      }

      openMultiStickerPrintWindow(
        item,
        toPrint.map(({ serialNumber, qrDataUrl }) => ({
          serialNumber,
          manufactureDate,
          qrDataUrl,
        })),
        `Print Stickers — ${item.product_name}`
      )
      const stickersBefore = countActiveStickers(item.stickers)
      const extraPrinted = newExtraStickersPrinted(
        stickersBefore,
        stickersBefore + count,
        item.quantity_required
      )
      if (extraPrinted > 0) {
        await fulfillStickerRequests(scheduleId, extraPrinted)
        await refreshStickerRequests()
      }
      await fetchSchedule()
    } catch (err) {
      console.error('Error printing stickers:', err)
      alert('Failed to print stickers: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setPrintingAllId(null)
    }
  }

  const handlePrintAll = async (item: ProductionScheduleItem) => {
    await handlePrintStickers(item, getRequiredRemainingCount(item))
  }

  const handlePrintRequested = async (item: ProductionScheduleItem) => {
    await handlePrintStickers(item, getRequestedRemainingCount(item))
  }

  const handleSave = async () => {
    if (!scheduleDate) return
    if (!canConfirmSchedule) {
      if (bomLoading) {
        alert('Please wait for bill of materials to finish loading.')
        return
      }
      if (bomStockShortages.length > 0 && !deletionOnlyChange) {
        alert(
          `${formatBomStockShortageMessage(bomStockShortages, { factoryFloor: embedded })}\n\nUse Request materials or save as draft first.`
        )
        return
      }
      if (!hasUnsavedChanges && schedulePersistStatus !== 'draft') {
        alert('No changes to save.')
        return
      }
      return
    }
    setSaving(true)
    try {
      const ok = await persistScheduleRows('active')
      if (ok) {
        alert('Production schedule confirmed and saved.')
        await fetchSchedule({ force: true })
      }
    } finally {
      setSaving(false)
    }
  }

  const themeClasses = {
    green: 'bg-green-600 hover:bg-green-700',
    red: 'bg-red-600 hover:bg-red-700',
    yellow: 'bg-yellow-600 hover:bg-yellow-700',
    blue: 'bg-blue-600 hover:bg-blue-700'
  }[theme]

  const header = (
    <div className="mb-4 pb-4 border-b border-gray-200 space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {!embedded && (
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 shrink-0">
            <Calendar className="h-5 w-5" />
            Production Schedule
          </h2>
        )}
        <input
          type="date"
          value={scheduleDate}
          onChange={(e) => setScheduleDate(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 shrink-0"
        />
        {destinationBrands && destinationBrands.length > 0 && onForBrandChange ? (
          <DestinationBrandSelect
            brands={destinationBrands}
            value={forBrandId}
            onChange={onForBrandChange}
          />
        ) : brandName ? (
          <span className="text-sm text-gray-500 shrink-0">
            {isAggregateBrandView ? 'All destination brands' : brandName}
          </span>
        ) : null}

        {isScheduleEditable ? (
          <>
            <span className="hidden md:block w-px h-7 bg-gray-200 shrink-0" aria-hidden />
            <div className="flex flex-wrap items-center gap-2 min-w-[min(100%,240px)] flex-1 basis-[280px]">
              <div className="min-w-[min(100%,200px)] flex-1 h-9 [&>div]:h-full [&_button]:h-full">
                <StockLevelProductPicker
                  value={selectedProduct}
                  onChange={setSelectedProduct}
                  productsByCategory={addableProductsByCategory}
                  scheduleQty={selectedAddScheduleQty}
                  disabled={addableProducts.length === 0}
                  disabledProductIds={pickerDisabledProductIds}
                  disabledProductReasonById={pickerDisabledReasonById}
                />
              </div>
              <div className="h-9 flex items-stretch shrink-0 [&>div]:h-full [&_button]:h-full [&_input]:h-full [&_input]:py-0">
                <ScheduleBatchStepper
                  value={Math.max(1, selectedAddBatches || 1)}
                  onChange={(n) => setAddQuantity(String(Math.max(1, n)))}
                  min={1}
                  step={1}
                  disabled={addableProducts.length === 0}
                />
              </div>
              <button
                type="button"
                onClick={handleAddProduct}
                disabled={
                  addableProducts.length === 0 ||
                  !selectedProduct ||
                  !selectedProductHasBom
                }
                className={`inline-flex h-9 items-center justify-center gap-1.5 px-3 text-sm font-medium text-white rounded-lg disabled:opacity-50 shrink-0 ${themeClasses}`}
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          </>
        ) : null}

        <span className="hidden md:block w-px h-7 bg-gray-200 shrink-0" aria-hidden />
        <div
          className="flex items-center gap-2 min-w-0 flex-[1_1_auto] basis-[160px]"
          title={`Factory staff on floor for ${scheduleDate} (from /factory)`}
        >
          <Users className="h-4 w-4 text-slate-500 shrink-0" aria-hidden />
          {floorStaff.length === 0 ? (
            <span className="text-xs text-gray-400">No staff on floor</span>
          ) : (
            <ul className="flex flex-wrap gap-1.5 min-w-0">
              {floorStaff.map((row) => (
                <li
                  key={row.id}
                  className="inline-flex items-center px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-full text-xs text-gray-800"
                >
                  {row.full_name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {!embedded && onClose ? (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 shrink-0 ml-auto"
          >
            <X className="h-6 w-6" />
          </button>
        ) : null}
      </div>

      {isScheduleEditable && selectedProduct ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {selectedAddYield > 1 && selectedAddBatches > 0 ? (
            <p className="text-xs text-indigo-700">
              {selectedAddBatches} batch{selectedAddBatches === 1 ? '' : 'es'} × {selectedAddYield} ={' '}
              {selectedAddScheduleQty} qty
            </p>
          ) : null}
          <ScheduleAddStockSimulation
            product={addableProducts.find((p) => p.id === selectedProduct)}
            batches={selectedAddBatches}
            scheduleQty={selectedAddScheduleQty}
          />
        </div>
      ) : null}
    </div>
  )

  const body = (
    <>
        {header}

        {isPastSchedule ? (
          <p className="mb-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Viewing a past schedule — read-only. Switch to today or a future date to add products or save
            changes.
          </p>
        ) : null}

        <div className="mb-5 space-y-4">
          <div
            className={`grid gap-4 items-start ${
              isScheduleEditable || items.length > 0
                ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]'
                : 'grid-cols-1'
            }`}
          >
            {!loading && !scheduleLoading && items.length > 0 ? (
              <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white px-4 py-3">
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <p className="text-sm text-gray-700 tabular-nums">
                    <span
                      className={`text-base font-semibold ${
                        scheduleProductionTotals.done
                          ? 'text-emerald-700'
                          : scheduleProductionTotals.scanned > 0
                            ? 'text-indigo-700'
                            : 'text-gray-900'
                      }`}
                    >
                      {scheduleProductionTotals.scanned}
                    </span>
                    <span className="text-gray-400 font-medium">
                      /{scheduleProductionTotals.required}
                    </span>
                    <span className="ml-1.5 text-xs text-gray-500">scanned</span>
                  </p>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      scheduleProductionTotals.done ? 'text-emerald-700' : 'text-gray-600'
                    }`}
                  >
                    {scheduleProductionTotals.pct}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${
                      scheduleProductionTotals.done
                        ? 'bg-emerald-500'
                        : scheduleProductionTotals.scanned > 0
                          ? 'bg-indigo-500'
                          : 'bg-slate-300'
                    }`}
                    style={{ width: `${scheduleProductionTotals.pct}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className="min-w-0 rounded-lg border border-gray-200 bg-white overflow-hidden">
              {(loading || scheduleLoading) && items.length === 0 ? (
                <ScheduleListSkeleton editable={isScheduleEditable} />
              ) : items.length === 0 ? (
                <div className="text-center py-12 px-4 text-gray-500">
                  <p>No products in schedule for {scheduleDate}</p>
                  <p className="text-sm mt-1">
                    {isScheduleEditable
                      ? 'Add a product using the picker above'
                      : 'This date has no scheduled products'}
                  </p>
                </div>
              ) : (
                <div className="w-full min-w-0 overflow-hidden">
                <div className="divide-y divide-gray-200">
                  <div
                    className={`hidden lg:grid items-center gap-x-4 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[10px] font-medium text-gray-500 uppercase tracking-wide ${
                      isScheduleEditable ? SCHEDULE_LIST_GRID_EDITABLE : SCHEDULE_LIST_GRID_READONLY
                    }`}
                  >
                    <span className="pl-1 min-w-0">Product</span>
                    <span className="text-center">Progress</span>
                    <span className="text-center pr-2 self-center">Qty</span>
                    <span className="text-center self-center">Floor batch</span>
                    <span className="px-1 min-w-0 pl-3 self-center">Notes</span>
                    <span className="text-center self-center">Print</span>
                    {isScheduleEditable ? <span className="text-center sr-only">Remove</span> : null}
                  </div>
                  {items.map((item) => {
                    const itemKey = scheduleItemKey(item)
                    const itemYield = yieldForProductId(item.product_id)
                    const itemBatches = scheduleQtyToBatches(item.quantity_required, itemYield)
                    const remaining = getRequiredRemainingCount(item)
                    const pendingStickerCount = getPendingStickerCount(item)
                    const requestedRemaining = getRequestedRemainingCount(item)
                    const expanded = !!expandedProductIds[itemKey]
                    const isPrintingAll = printingAllId === itemKey
                    const activeStickers = item.stickers.filter(isActiveSticker)
                    const voidedStickers = item.stickers.filter((s) => s.voided_at)
                    const scannedCount = countScannedStickers(item.stickers)
                    const requiredSlots = Array.from({ length: item.quantity_required }, (_, i) => ({
                      unit: i + 1,
                      sticker: activeStickers[i] as StickerLog | undefined,
                    }))
                    const extraStickers = activeStickers.slice(item.quantity_required)
                    const productionBatch = primaryFactoryBatchForSchedule(
                      productionBatchesByScheduleId[item.schedule_id]
                    )

                    const rowGridClass = isScheduleEditable
                      ? `grid-cols-1 ${SCHEDULE_LIST_GRID_EDITABLE}`
                      : `grid-cols-1 ${SCHEDULE_LIST_GRID_READONLY}`

                    return (
                      <div key={itemKey} className="bg-white">
                        <div
                          className={`grid items-center gap-x-4 gap-y-3 px-4 py-3.5 hover:bg-gray-50 min-w-0 ${rowGridClass}`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleExpanded(itemKey)}
                            className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 items-center min-w-0 text-left"
                          >
                            {expanded ? (
                              <ChevronUp className="h-4 w-4 text-gray-500 shrink-0 row-span-2" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-500 shrink-0 row-span-2" />
                            )}
                            <div className="min-w-0 col-start-2 space-y-0.5">
                              <span className="text-sm font-medium text-gray-900 truncate block">
                                {item.product_name}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 lg:hidden">
                                <FactoryProductionBatchStatusBadge
                                  batch={productionBatch}
                                  compact
                                />
                              </div>
                              <span
                                className={`text-xs text-gray-400 truncate block ${isAggregateBrandView ? '' : 'lg:hidden'}`}
                              >
                                {item.brand_name}
                              </span>
                              <span className="text-xs text-gray-500 truncate block lg:hidden">
                                SKU: {item.sku || '—'}
                              </span>
                            </div>
                          </button>
                          <div className="flex flex-col items-center justify-center gap-0.5 justify-self-center">
                            <ProgressFractionCircle
                              current={scannedCount}
                              total={item.quantity_required}
                              size="sm"
                              strokeClass={
                                item.quantity_required > 0 && scannedCount >= item.quantity_required
                                  ? 'text-emerald-600'
                                  : scannedCount > 0
                                    ? 'text-indigo-600'
                                    : 'text-slate-400'
                              }
                            />
                            {pendingStickerCount > 0 ? (
                              <span className="text-[10px] font-semibold tabular-nums text-amber-700">
                                +{pendingStickerCount}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex min-w-0 items-center justify-center self-center pr-2">
                            {isScheduleEditable ? (
                              <ScheduleBatchStepper
                                value={itemBatches}
                                onChange={(n) => handleUpdateScheduleBatches(item, n)}
                                min={0}
                                step={1}
                                allowDecimal={itemYield > 1}
                              />
                            ) : (
                              <span className="text-sm tabular-nums text-gray-900">
                                {itemYield > 1 && itemBatches % 1 !== 0
                                  ? itemBatches.toFixed(2)
                                  : itemBatches}
                              </span>
                            )}
                          </div>
                          <div className="hidden lg:flex min-w-0 items-center justify-center self-center">
                            <FactoryProductionBatchStatusBadge batch={productionBatch} />
                          </div>
                          <div className="flex min-w-0 items-center self-center pl-3">
                            {isScheduleEditable ? (
                              <input
                                type="text"
                                value={item.notes || ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleUpdateNotes(item, e.target.value)}
                                className="h-8 w-full max-w-full px-2 border rounded text-xs leading-none"
                              />
                            ) : (
                              <span className="text-xs text-gray-500 truncate">
                                {item.notes || '—'}
                              </span>
                            )}
                          </div>
                          <div className="flex min-w-0 items-center justify-center self-center">
                            {canShowPrintActions(item) ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handlePrintAll(item)
                                }}
                                disabled={
                                  remaining <= 0 ||
                                  isNewPrintBlocked(item) ||
                                  isPrintingAll ||
                                  printingStickerKey !== null
                                }
                                title={
                                  remaining <= 0
                                    ? pendingStickerCount > 0
                                      ? 'All scheduled stickers printed — use Print requested below'
                                      : 'All stickers printed'
                                    : isNewPrintBlocked(item)
                                      ? saveBeforePrintTitle
                                      : `Print all (${remaining})`
                                }
                                aria-label={`Print all (${remaining})`}
                                className="inline-flex h-8 max-w-full items-center justify-center gap-1 px-1.5 bg-indigo-500 text-white rounded text-xs hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Printer className="h-3 w-3 shrink-0" />
                                <span className="truncate">Print ({remaining})</span>
                              </button>
                            ) : null}
                          </div>
                          {isScheduleEditable ? (
                            <div className="flex items-center justify-center self-center min-w-0">
                              {scannedCount === 0 ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRemoveItem(item)
                                  }}
                                  className="text-red-600 hover:text-red-800 p-1 shrink-0"
                                  title="Remove from schedule"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        {expanded ? (
                          <div className="px-4 pb-4 pt-3 bg-slate-50/80 border-t border-gray-100">
                            {(() => {
                              const productionBatches =
                                productionBatchesByScheduleId[item.schedule_id] || []
                              const inProgressBatch = productionBatches.find(
                                (b) => b.status === 'in_progress'
                              )
                              const completedBatch = productionBatches.find(
                                (b) => b.status === 'completed'
                              )
                              const activeBatch = inProgressBatch ?? completedBatch

                              return (
                                <div className="mb-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                          Factory production batch
                                        </p>
                                        <FactoryProductionBatchStatusBadge
                                          batch={activeBatch}
                                          compact
                                        />
                                      </div>
                                      {activeBatch ? (
                                        <p className="text-sm text-gray-700 mt-1">
                                          {activeBatch.units} unit
                                          {activeBatch.units === 1 ? '' : 's'}
                                          {activeBatch.started_by
                                            ? ` · started by ${activeBatch.started_by}`
                                            : ''}
                                          {activeBatch.completed_at
                                            ? ` · completed ${new Date(activeBatch.completed_at).toLocaleString([], {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit',
                                              })}`
                                            : activeBatch.started_at
                                              ? ` · started ${new Date(activeBatch.started_at).toLocaleString([], {
                                                  month: 'short',
                                                  day: 'numeric',
                                                  hour: 'numeric',
                                                  minute: '2-digit',
                                                })}`
                                              : ''}
                                        </p>
                                      ) : (
                                        <p className="text-sm text-gray-500 mt-1">
                                          No batch started on the factory floor yet.
                                        </p>
                                      )}
                                    </div>
                                    {completedBatch && !inProgressBatch ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleRevertProductionBatch(
                                            completedBatch,
                                            item.product_name
                                          )
                                        }
                                        disabled={revertingBatchId === completedBatch.id}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-medium text-gray-700 hover:bg-slate-50 disabled:opacity-50 shrink-0"
                                      >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        {revertingBatchId === completedBatch.id
                                          ? 'Reverting…'
                                          : 'Revert to in progress'}
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              )
                            })()}
                            {pendingStickerCount > 0 ? (
                              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p>
                                    Factory requested{' '}
                                    <span className="font-semibold tabular-nums">
                                      {pendingStickerCount}
                                    </span>{' '}
                                    additional sticker{pendingStickerCount === 1 ? '' : 's'}.
                                    {requestedRemaining > 0
                                      ? ` ${requestedRemaining} still need printing.`
                                      : ' All requested stickers have been printed.'}
                                  </p>
                                  {requestedRemaining > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => void handlePrintRequested(item)}
                                      disabled={
                                        isAdditionalPrintBlocked(item) ||
                                        isPrintingAll ||
                                        printingStickerKey !== null
                                      }
                                      title={
                                        isAdditionalPrintBlocked(item)
                                          ? saveBeforePrintTitle
                                          : `Print requested (${requestedRemaining})`
                                      }
                                      aria-label={`Print requested (${requestedRemaining})`}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                                    >
                                      <Printer className="h-3 w-3 shrink-0" />
                                      Print ({requestedRemaining})
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                              <div
                                className={`${SERIAL_PANEL_GRID} px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wide text-gray-500`}
                              >
                                <span>Serial</span>
                                <span className="text-center">SKU</span>
                                <span className="text-center">Scanned</span>
                                <span className="text-right">Actions</span>
                              </div>
                              <ul className="divide-y divide-slate-100">
                                {requiredSlots.map(({ unit, sticker }) => (
                                  <li
                                    key={`unit-${unit}`}
                                    className={`${SERIAL_PANEL_GRID} px-4 py-2.5`}
                                  >
                                    <div className="min-w-0 flex items-center gap-2">
                                      <span className="text-xs text-gray-400 tabular-nums w-5 shrink-0 text-right">
                                        {unit}
                                      </span>
                                      {sticker ? (
                                        <code className="text-xs text-gray-900 font-mono truncate">
                                          {sticker.serial_number}
                                        </code>
                                      ) : (
                                        <span className="text-xs text-gray-400 italic">Not printed</span>
                                      )}
                                    </div>
                                    <span
                                      className="text-xs text-gray-600 font-mono truncate text-center px-1"
                                      title={item.sku || undefined}
                                    >
                                      {item.sku || '—'}
                                    </span>
                                    <SerialProductionCell sticker={sticker} />
                                    <div className="flex justify-end gap-1">
                                      {sticker && !sticker.voided_at && !sticker.produced_at ? (
                                        <button
                                          type="button"
                                          onClick={() => void handleVoidSticker(sticker, item)}
                                          disabled={printingStickerKey !== null || isPrintingAll}
                                          title="Void sticker"
                                          aria-label="Void sticker"
                                          className="inline-flex items-center justify-center min-w-[1.75rem] min-h-[1.75rem] p-1 border border-red-200 text-red-700 rounded text-xs hover:bg-red-50 disabled:opacity-50"
                                        >
                                          <Ban className="h-3.5 w-3.5 shrink-0" />
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        onClick={() => void handlePrintSticker(item, sticker)}
                                        disabled={
                                          (!sticker &&
                                            (isNewPrintBlocked(item) ||
                                              !hasNewPrintCapacity(item))) ||
                                          printingStickerKey !== null ||
                                          isPrintingAll
                                        }
                                        title={
                                          !sticker && isNewPrintBlocked(item)
                                            ? saveBeforePrintTitle
                                            : sticker
                                              ? 'Reprint'
                                              : 'Print'
                                        }
                                        aria-label={sticker ? 'Reprint sticker' : 'Print sticker'}
                                        className="inline-flex items-center justify-center min-w-[1.75rem] min-h-[1.75rem] p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                                      >
                                        <Printer className="h-3.5 w-3.5 shrink-0" />
                                      </button>
                                    </div>
                                  </li>
                                ))}
                                {Array.from({ length: requestedRemaining }, (_, i) => (
                                  <li
                                    key={`requested-${i}`}
                                    className={`${SERIAL_PANEL_GRID} px-4 py-2.5 bg-amber-50/60`}
                                  >
                                    <div className="min-w-0 flex items-center gap-2">
                                      <span className="text-[10px] text-amber-700 tabular-nums w-5 shrink-0 text-right">
                                        +{i + 1}
                                      </span>
                                      <span className="text-xs text-amber-800 italic">
                                        Factory requested — not printed
                                      </span>
                                    </div>
                                    <span
                                      className="text-xs text-gray-600 font-mono truncate text-center px-1"
                                      title={item.sku || undefined}
                                    >
                                      {item.sku || '—'}
                                    </span>
                                    <span className="text-xs text-gray-400 italic text-center">
                                      —
                                    </span>
                                    <div className="flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => void handlePrintSticker(item)}
                                        disabled={
                                          isAdditionalPrintBlocked(item) ||
                                          !hasNewPrintCapacity(item) ||
                                          printingStickerKey !== null ||
                                          isPrintingAll
                                        }
                                        title={
                                          isAdditionalPrintBlocked(item)
                                            ? saveBeforePrintTitle
                                            : 'Print'
                                        }
                                        aria-label="Print sticker"
                                        className="inline-flex items-center justify-center min-w-[1.75rem] min-h-[1.75rem] p-1 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                                      >
                                        <Printer className="h-3.5 w-3.5 shrink-0" />
                                      </button>
                                    </div>
                                  </li>
                                ))}
                                {extraStickers.map((sticker, idx) => (
                                  <li
                                    key={sticker.id}
                                    className={`${SERIAL_PANEL_GRID} px-4 py-2.5 bg-amber-50/40`}
                                  >
                                    <div className="min-w-0 flex items-center gap-2">
                                      <span className="text-[10px] text-amber-700 shrink-0">
                                        +{idx + 1}
                                      </span>
                                      <code className="text-xs text-gray-900 font-mono truncate">
                                        {sticker.serial_number}
                                      </code>
                                    </div>
                                    <span
                                      className="text-xs text-gray-600 font-mono truncate text-center px-1"
                                      title={item.sku || undefined}
                                    >
                                      {item.sku || '—'}
                                    </span>
                                    <SerialProductionCell sticker={sticker} />
                                    <div className="flex justify-end gap-1">
                                      {!sticker.produced_at ? (
                                        <button
                                          type="button"
                                          onClick={() => void handleVoidSticker(sticker, item)}
                                          disabled={printingStickerKey !== null || isPrintingAll}
                                          title="Void sticker"
                                          aria-label="Void sticker"
                                          className="inline-flex items-center justify-center min-w-[1.75rem] min-h-[1.75rem] p-1 border border-red-200 text-red-700 rounded text-xs hover:bg-red-50 disabled:opacity-50"
                                        >
                                          <Ban className="h-3.5 w-3.5 shrink-0" />
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        onClick={() => void handlePrintSticker(item, sticker)}
                                        disabled={printingStickerKey !== null || isPrintingAll}
                                        title="Reprint"
                                        aria-label="Reprint sticker"
                                        className="inline-flex items-center justify-center min-w-[1.75rem] min-h-[1.75rem] p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                                      >
                                        <Printer className="h-3.5 w-3.5 shrink-0" />
                                      </button>
                                    </div>
                                  </li>
                                ))}
                                {voidedStickers.length > 0 ? (
                                  <>
                                    <li
                                      className={`${SERIAL_PANEL_GRID} px-4 py-2 bg-red-50 border-t border-red-100 text-[10px] font-semibold uppercase text-red-800`}
                                    >
                                      <span className="col-span-4">Voided stickers</span>
                                    </li>
                                    {voidedStickers.map((sticker) => (
                                      <li
                                        key={`voided-${sticker.id}`}
                                        className={`${SERIAL_PANEL_GRID} px-4 py-2.5 bg-red-50/40 opacity-75`}
                                      >
                                        <div className="min-w-0 flex items-center gap-2">
                                          <code className="text-xs text-gray-500 font-mono truncate line-through">
                                            {sticker.serial_number}
                                          </code>
                                        </div>
                                        <span
                                          className="text-xs text-gray-500 font-mono truncate text-center px-1"
                                          title={item.sku || undefined}
                                        >
                                          {item.sku || '—'}
                                        </span>
                                        <SerialProductionCell sticker={sticker} />
                                      </li>
                                    ))}
                                  </>
                                ) : null}
                              </ul>
                            </div>
                            {canPrintAdditionalSticker(item) ? (
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs text-gray-500">
                                  Print extra labels beyond the schedule or factory requests.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => void handlePrintAdditional(item)}
                                  disabled={printingStickerKey !== null || isPrintingAll}
                                  title="Print additional"
                                  aria-label="Print additional sticker"
                                  className="inline-flex items-center justify-center min-w-[1.75rem] min-h-[1.75rem] p-1 bg-slate-700 text-white rounded hover:bg-slate-800 disabled:opacity-50 shrink-0"
                                >
                                  <Printer className="h-3.5 w-3.5 shrink-0" />
                                </button>
                              </div>
                            ) : null}
                            {isNewPrintBlocked(item) && hasNewPrintCapacity(item) ? (
                              <p className="text-xs text-amber-700 mt-2">{saveBeforePrintTitle}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
                </div>
              )}
            </div>

            <div className="min-w-0 rounded-lg border border-gray-200 bg-white overflow-hidden flex flex-col max-h-[min(58vh,540px)] lg:max-h-[min(68vh,620px)]">
              <div className="px-3 py-2.5 border-b border-gray-200 bg-gray-50 shrink-0">
                <h4 className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-slate-600" />
                  Bill of Materials
                </h4>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {items.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">
                    Add production items to see material requirements.
                  </p>
                ) : bomLoading ? (
                  <ProductionScheduleBomSkeleton />
                ) : (
                  <>
                    <section>
                      <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                        Running total
                      </h5>
                      <BomMaterialsTable
                        lines={runningBom}
                        emptyLabel={
                          embedded
                            ? 'No factory-linked materials in BOMs'
                            : 'No materials in BOMs'
                        }
                        highlightStockShortage
                      />
                      {bomStockShortages.length > 0 ? (
                        <p className="text-xs text-red-700 mt-2 leading-snug">
                          Confirm blocked — {bomStockShortages.length} factory material
                          {bomStockShortages.length === 1 ? '' : 's'} short on{' '}
                          {embedded ? 'floor' : ''} stock. Use{' '}
                          <span className="font-medium">Request materials</span> or save as draft.
                        </p>
                      ) : null}
                    </section>
                    <section className="pt-3 border-t border-gray-100">
                      <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                        By SKU
                      </h5>
                      <div className="space-y-3">
                        {perSkuBom.map(({ item, lines }) => (
                          <div
                            key={scheduleItemKey(item)}
                            className="rounded-md border border-gray-100 bg-gray-50/80 p-2"
                          >
                            <p className="text-xs font-medium text-gray-900 mb-1.5 truncate" title={item.product_name}>
                              <span className="text-gray-500">{item.sku || '—'}</span>
                              {' · '}
                              {item.product_name}
                              {isAggregateBrandView ? (
                                <span className="text-gray-400 font-normal"> · {item.brand_name}</span>
                              ) : null}
                              <span className="text-gray-500 font-normal">
                                {' '}
                                (×{item.quantity_required})
                              </span>
                            </p>
                            <BomMaterialsTable lines={lines} />
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-h-[2.25rem]">
            {items.length > 0 && isScheduleConfirmed ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                Confirmed
              </span>
            ) : items.length > 0 &&
              schedulePersistStatus === 'draft' &&
              !hasUnsavedChanges ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-200">
                Draft
              </span>
            ) : items.length > 0 && hasUnsavedChanges ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                Unsaved
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-3 ml-auto">
          {!embedded && onClose && (
            <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
              Close
            </button>
          )}
          {isScheduleEditable ? (
            <>
              {schedulePersistStatus === 'draft' && !hasUnsavedChanges ? (
                <button
                  type="button"
                  onClick={handleCancelDraft}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-red-700 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  Cancel draft
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving || !hasUnsavedChanges || items.length === 0}
                className="flex items-center gap-2 px-4 py-2 text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save as draft'}
              </button>
              {!bomStockSatisfied && bomStockShortages.length > 0 && items.length > 0 ? (
                <button
                  type="button"
                  onClick={handleRequestMaterials}
                  disabled={saving || bomLoading}
                  title="Save draft and send procurement requests for short materials"
                  className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${themeClasses}`}
                >
                  <Package className="h-4 w-4" />
                  {saving ? 'Sending…' : 'Request materials'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !canConfirmSchedule}
                title={
                  !canConfirmSchedule && !bomLoading && bomStockShortages.length > 0 && !deletionOnlyChange
                    ? embedded
                      ? 'Insufficient on-floor stock — request materials or save as draft'
                      : 'Insufficient stock — request materials or save as draft'
                    : !canConfirmSchedule &&
                        !hasUnsavedChanges &&
                        schedulePersistStatus !== 'draft'
                      ? 'No changes to save'
                      : bomLoading
                        ? 'Loading bill of materials…'
                        : undefined
                }
                className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  canConfirmSchedule && !saving ? themeClasses : 'bg-gray-400'
                }`}
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save schedule'}
              </button>
            </>
          ) : null}
          </div>
        </div>
    </>
  )

  if (embedded) {
    return (
      <div className="min-w-0">
        {body}
      </div>
    )
  }

  return (
    <Modal backdropClassName="bg-gray-600/50">
      <div className="mx-auto p-5 border w-[calc(100%-1.5rem)] max-w-7xl shadow-lg rounded-lg bg-white max-h-[92vh] overflow-y-auto">
        {body}
      </div>
    </Modal>
  )
}
