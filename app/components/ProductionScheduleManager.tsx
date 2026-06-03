'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
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
  PlusCircle,
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
  isProductConsumableSupply,
  scheduleQtyToBatches,
} from '../../lib/product-category-settings'
import {
  fetchProductIdsWithBomItems,
  parseProductBomSettings,
  scheduleYieldPerBatch,
  type ProductBomSettings,
} from '../../lib/product-bom'

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
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          decrement()
        }}
        disabled={disabled || safeValue <= min}
        className="px-2 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-gray-100"
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
        className="w-12 px-1 py-1 text-center text-sm tabular-nums text-gray-900 border border-gray-300 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          increment()
        }}
        disabled={disabled}
        className="px-2 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-gray-100"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  )
}

/** Desktop grid for schedule list rows (Product · Printed · Batch · Notes · Print [· Remove]). */
const SCHEDULE_LIST_GRID_EDITABLE =
  'lg:grid-cols-[minmax(13rem,2fr)_5.5rem_8.75rem_minmax(6rem,10rem)_7.25rem_2.75rem]'
const SCHEDULE_LIST_GRID_READONLY =
  'lg:grid-cols-[minmax(13rem,2fr)_5.5rem_8.75rem_minmax(6rem,10rem)_7.25rem]'

function ScheduleListSkeleton({ editable }: { editable: boolean }) {
  const headerGrid = editable ? SCHEDULE_LIST_GRID_EDITABLE : SCHEDULE_LIST_GRID_READONLY
  const rowGrid = editable
    ? `grid-cols-1 ${SCHEDULE_LIST_GRID_EDITABLE}`
    : `grid-cols-1 ${SCHEDULE_LIST_GRID_READONLY}`

  return (
    <div className="overflow-x-auto -mx-px animate-pulse">
      <div className="divide-y divide-gray-200 min-w-[46rem]">
        <div
          className={`hidden lg:grid items-center gap-x-5 px-5 py-2.5 bg-gray-50 border-b border-gray-200 text-[10px] font-medium text-gray-500 uppercase tracking-wide ${headerGrid}`}
        >
          <span className="pl-1">Product</span>
          <span className="text-center">Printed</span>
          <span className="text-center">Batch</span>
          <span className="px-1">Notes</span>
          <span className="text-center">Print</span>
          {editable ? <span className="text-center sr-only">Remove</span> : null}
        </div>
        {[1, 2, 3].map((row) => (
          <div key={row} className="bg-white">
            <div className={`grid items-center gap-x-5 gap-y-3 px-5 py-3.5 ${rowGrid}`}>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 items-center min-w-0">
                <div className="h-4 w-4 bg-gray-200 rounded shrink-0 row-span-2" />
                <div className="min-w-0 col-start-2 space-y-1">
                  <div className="h-3.5 bg-gray-200 rounded w-[78%]" />
                  <div className="h-2.5 bg-gray-100 rounded w-2/5 lg:hidden" />
                  <div className="h-2.5 bg-gray-100 rounded w-1/2 lg:hidden" />
                </div>
              </div>
              <div className="justify-self-center h-5 w-14 bg-indigo-100 rounded-full" />
              <div className="justify-self-center inline-flex items-center gap-1.5">
                <div className="h-7 w-7 bg-red-100 rounded" />
                <div className="h-7 w-12 bg-gray-100 rounded border border-gray-200" />
                <div className="h-7 w-7 bg-green-100 rounded" />
              </div>
              <div className="h-7 bg-gray-100 rounded w-full max-w-full" />
              <div className="flex justify-center min-h-[1.75rem]">
                <div className="h-7 w-[4.5rem] bg-indigo-200 rounded" />
              </div>
              {editable ? (
                <div className="flex justify-center">
                  <div className="h-4 w-4 bg-red-100 rounded" />
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
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
  quantity_required: number
  batch_number: string
  notes?: string
  printed_count: number
  stickers: StickerLog[]
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
        quantity_required: i.quantity_required,
        notes: i.notes ?? null,
        batch_number: i.batch_number,
      }))
      .sort((a, b) => a.product_id.localeCompare(b.product_id))
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
  const savedById = new Map(saved.map((s) => [s.product_id, s]))
  for (const item of items) {
    const prev = savedById.get(item.product_id)
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
  brandId: string
  brandName?: string
  theme?: string
  currentUsername?: string
  /** When true, renders inline in a tab instead of a full-screen modal. */
  embedded?: boolean
  scheduleDate?: string
  onScheduleDateChange?: (date: string) => void
}

export function ProductionScheduleManager({
  onClose,
  brandId,
  brandName,
  theme = 'blue',
  currentUsername = '',
  embedded = false,
  scheduleDate: scheduleDateProp,
  onScheduleDateChange,
}: ProductionScheduleManagerProps) {
  const requestedBy = currentUsername.trim() || 'Factory'
  const today = getPhilippinesDate()
  const [internalScheduleDate, setInternalScheduleDate] = useState(today)
  const scheduleDate = scheduleDateProp ?? internalScheduleDate
  const setScheduleDate = onScheduleDateChange ?? setInternalScheduleDate
  const isPastSchedule = scheduleDate < today
  const isScheduleEditable = !isPastSchedule
  const [items, setItems] = useState<ProductionScheduleItem[]>([])
  const [savedSnapshot, setSavedSnapshot] = useState(() => scheduleItemsSnapshot([]))
  const [allProducts, setAllProducts] = useState<(Product & { brand_name: string })[]>([])
  const [categorySortOrders, setCategorySortOrders] = useState<Record<string, number>>({})
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

  const scheduleProductIds = useMemo(
    () => Array.from(new Set(items.map((i) => i.product_id).filter(Boolean))),
    [items]
  )

  const hasUnsavedChanges = useMemo(
    () => scheduleItemsSnapshot(items) !== savedSnapshot,
    [items, savedSnapshot]
  )

  const refreshFactoryMaterialRequestQtys = useCallback(async () => {
    const { released, pending } = await fetchFactoryRequestQtysByMaterial(scheduleDate, {
      brandId,
    })
    setReleasedQtyByMaterial(released)
    setPendingQtyByMaterial(pending)
  }, [scheduleDate, brandId])

  const refreshStickerRequests = useCallback(async () => {
    const rows = await fetchPendingStickerRequests(scheduleDate, { brandId })
    setPendingStickerQtyByScheduleId(buildPendingStickerQtyByScheduleId(rows))
  }, [scheduleDate, brandId])

  useEffect(() => {
    fetchAllProducts()
    fetchFloorStaff()
    refreshFactoryMaterialRequestQtys()
    refreshStickerRequests()
  }, [scheduleDate, brandId, refreshFactoryMaterialRequestQtys, refreshStickerRequests])

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
  }, [scheduleDate, brandId, allProducts, loading])

  useEffect(() => {
    fetchBomForProducts(scheduleProductIds)
  }, [scheduleProductIds.join('|')])

  const addableProducts = useMemo(
    () =>
      allProducts.filter((p) => {
        const idx = categorySortOrders[categoryDisplayName(p.category)]
        return idx !== undefined && idx > 0
      }),
    [allProducts, categorySortOrders]
  )

  const yieldForProductId = (productId: string) =>
    scheduleYieldPerBatch(productBomSettingsById[productId])

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
      } else if (!productIdsWithBom.has(p.id)) {
        reasons[p.id] = 'No BOM'
      }
    }
    return reasons
  }, [addableProducts, productIdsWithBom, categorySortOrders])

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
    if (!brandId) return
    setLoading(true)
    setAllProducts([])
    try {
      const [productsRes, sortRes] = await Promise.all([
        supabase
          .from('products')
          .select(
            'id, brand_id, name, sku, category, unit, minimum_stock, initial_stock, production, released, reserved, bom_quantity_mode, bom_yield_per_batch, brands(name)'
          )
          .eq('brand_id', brandId)
          .order('name'),
        supabase
          .from('product_category_sort')
          .select('category_name, sort_index')
          .eq('brand_id', brandId),
      ])

      if (productsRes.error) throw productsRes.error

      const productsWithBrand = (productsRes.data || []).map((p: any) => ({
        ...p,
        brand_name: p.brands?.name || brandName || 'Unknown',
      }))
      setAllProducts(productsWithBrand)

      const bomSettings: Record<string, ProductBomSettings> = {}
      const productIds: string[] = []
      for (const p of productsWithBrand) {
        productIds.push(p.id)
        bomSettings[p.id] = parseProductBomSettings(p)
      }
      setProductBomSettingsById(bomSettings)
      setProductIdsWithBom(await fetchProductIdsWithBomItems(productIds))

      if (sortRes.error) {
        console.warn('product_category_sort:', sortRes.error.message)
        setCategorySortOrders({})
      } else {
        const orders: Record<string, number> = {}
        for (const row of sortRes.data || []) {
          orders[categoryDisplayName(row.category_name)] = row.sort_index
        }
        setCategorySortOrders(orders)
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

  const fetchSchedule = async () => {
    if (!scheduleDate) return
    setScheduleLoading(true)
    try {
      const currentBrandProductIds = allProducts.map((p) => p.id)
      if (currentBrandProductIds.length === 0) {
        setItems([])
        setSavedSnapshot(scheduleItemsSnapshot([]))
        setSchedulePersistStatus(null)
        return
      }

      const { data: scheduleData, error } = await supabase
        .from('production_schedules')
        .select('id, product_id, quantity_required, batch_number, notes, status')
        .eq('schedule_date', scheduleDate)
        .in('product_id', currentBrandProductIds)
        .in('status', ['draft', 'active'])

      if (error) throw error

      if (!scheduleData || scheduleData.length === 0) {
        setItems([])
        setSavedSnapshot(scheduleItemsSnapshot([]))
        setSchedulePersistStatus(null)
        return
      }

      const statuses = new Set(
        scheduleData.map((r: { status?: string }) => r.status).filter(Boolean)
      )
      setSchedulePersistStatus(statuses.has('draft') ? 'draft' : 'active')

      const productIds = scheduleData.map(s => s.product_id)
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, sku, brand_id, brands(name)')
        .in('id', productIds)
        .eq('brand_id', brandId)

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
        return [{
          schedule_id: row.id,
          product_id: row.product_id,
          product_name: prod?.name || 'Unknown',
          sku: prod?.sku,
          brand_name: prod?.brand_name || 'Unknown',
          quantity_required: row.quantity_required,
          batch_number: batchNum,
          notes: row.notes,
          printed_count: activeCount,
          stickers,
        }]
      })
      setItems(scheduleItems)
      setSavedSnapshot(scheduleItemsSnapshot(scheduleItems))
    } catch (err) {
      console.error('Error fetching schedule:', err)
      setItems([])
      setSavedSnapshot(scheduleItemsSnapshot([]))
      setSchedulePersistStatus(null)
    } finally {
      setScheduleLoading(false)
    }
  }

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
    setItems(prev => {
      const existing = prev.find(i => i.product_id === selectedProduct)
      if (existing) {
        return prev.map(i =>
          i.product_id === selectedProduct
            ? { ...i, quantity_required: i.quantity_required + qty }
            : i
        )
      }
      return [...prev, {
        schedule_id: '',
        product_id: selectedProduct,
        product_name: product.name || '',
        sku: product.sku,
        brand_name: product.brand_name,
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

    setItems((prev) => prev.filter((i) => i.product_id !== item.product_id))
  }

  const handleUpdateScheduleBatches = (productId: string, batches: number) => {
    const yieldPerBatch = yieldForProductId(productId)
    const quantity = batchesToScheduleQty(batches, yieldPerBatch)
    setItems((prev) =>
      prev.map((i) =>
        i.product_id === productId ? { ...i, quantity_required: quantity } : i
      )
    )
  }

  const handleUpdateNotes = (productId: string, notes: string) => {
    setItems(prev => prev.map(i =>
      i.product_id === productId ? { ...i, notes: notes || undefined } : i
    ))
  }

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
      .eq('status', 'active')
      .maybeSingle()
    return data?.id
  }

  const persistScheduleRows = async (
    status: ProductionScheduleStatus
  ): Promise<boolean> => {
    if (!scheduleDate || status === 'cancelled') return false
    const currentBrandProductIds = allProducts.map((p) => p.id)
    try {
      const idByProduct = new Map<string, string>()
      for (const item of items) {
        const product = allProducts.find((p) => p.id === item.product_id)
        const batchNum =
          item.batch_number ||
          (product ? generateBatchNumber(product) : `BATCH-${scheduleDate.replace(/-/g, '')}`)
        const { data, error } = await supabase
          .from('production_schedules')
          .upsert(
            {
              product_id: item.product_id,
              schedule_date: scheduleDate,
              quantity_required: item.quantity_required,
              batch_number: batchNum,
              notes: item.notes || null,
              status,
            },
            { onConflict: 'product_id,schedule_date' }
          )
          .select('id, product_id')

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
          idByProduct.set(row.product_id as string, row.id as string)
        }
      }

      const { data: existing } = await supabase
        .from('production_schedules')
        .select('id, product_id')
        .eq('schedule_date', scheduleDate)
        .in('product_id', currentBrandProductIds)
        .in('status', ['draft', 'active'])

      for (const row of existing || []) {
        if (!items.some((i) => i.product_id === row.product_id)) {
          await supabase.from('production_schedules').delete().eq('id', row.id)
        }
      }

      const nextItems = items.map((i) => ({
        ...i,
        schedule_id: idByProduct.get(i.product_id) || i.schedule_id,
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
      const productIds = allProducts.map((p) => p.id)
      if (productIds.length > 0) {
        const { error } = await supabase
          .from('production_schedules')
          .update({ status: 'cancelled' })
          .eq('schedule_date', scheduleDate)
          .in('product_id', productIds)
          .eq('status', 'draft')
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
          brandId,
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
    setPrintingAllId(item.product_id)
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
        await fetchSchedule()
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
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200">
      <div className="flex flex-wrap items-center gap-4 min-w-0">
        {!embedded && (
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Production Schedule
          </h2>
        )}
        <input
          type="date"
          value={scheduleDate}
          onChange={(e) => setScheduleDate(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        />
        {embedded && brandName && (
          <span className="text-sm text-gray-500">{brandName}</span>
        )}
      </div>
      {!embedded && onClose && (
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 shrink-0">
          <X className="h-6 w-6" />
        </button>
      )}
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

        {isScheduleEditable && schedulePersistStatus === 'draft' && !hasUnsavedChanges ? (
          <p className="mb-4 text-sm text-indigo-900 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
            <span className="font-medium">Draft schedule</span> — material requests can be sent to
            Procurement. Confirm with <span className="font-medium">Save schedule</span> when on-floor stock
            is sufficient. Printing is disabled until confirmed.
          </p>
        ) : null}

        {isScheduleEditable && isScheduleConfirmed ? (
          <p className="mb-4 text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            Schedule confirmed for this date — you can print stickers.
          </p>
        ) : null}

        <div className="mb-5 space-y-4">
          <div
            className={
              isScheduleEditable
                ? 'grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch'
                : 'grid grid-cols-1'
            }
          >
            {isScheduleEditable ? (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 min-w-0">
                <h4 className="text-sm font-medium text-gray-800 mb-3">Add Product</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-1.5 items-center">
                    <label className="text-xs text-gray-500 col-start-1 row-start-1">Product</label>
                    <label className="text-xs text-gray-500 col-start-2 row-start-1">Batch</label>
                    <span className="col-start-3 row-start-1 h-[1.125rem] shrink-0" aria-hidden />
                    <div className="col-start-1 row-start-2 min-w-0 h-9 [&>div]:h-full [&_button]:h-full">
                      <StockLevelProductPicker
                        value={selectedProduct}
                        onChange={setSelectedProduct}
                        productsByCategory={addableProductsByCategory}
                        scheduleQty={selectedAddScheduleQty}
                        disabled={addableProducts.length === 0}
                        disabledProductIds={pickerDisabledProductIds}
                        disabledProductTitle="No BOM"
                        disabledProductReasonById={pickerDisabledReasonById}
                      />
                    </div>
                    <div className="col-start-2 row-start-2 h-9 flex items-stretch [&>div]:h-full [&_button]:h-full [&_input]:h-full [&_input]:py-0">
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
                      className={`col-start-3 row-start-2 inline-flex h-9 items-center justify-center gap-2 px-4 text-sm font-medium text-white rounded-lg disabled:opacity-50 shrink-0 ${themeClasses}`}
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  </div>
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
              </div>
            ) : null}

            <div
              className={`p-4 bg-slate-50 rounded-lg border border-slate-200 min-w-0 flex flex-col ${
                isScheduleEditable ? '' : 'lg:max-w-none'
              }`}
            >
              <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2 mb-1 shrink-0">
                <Users className="h-4 w-4 text-slate-600 shrink-0" />
                Factory staff on floor
              </h3>
              <p className="text-xs text-gray-500 mb-3 shrink-0">
                From{' '}
                <a href="/factory" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  /factory
                </a>{' '}
                for {scheduleDate}.
              </p>
              <div className="flex-1 min-h-0">
                {floorStaff.length === 0 ? (
                  <p className="text-sm text-gray-400">No staff on the floor for this date.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2 content-start">
                    {floorStaff.map((row) => (
                      <li
                        key={row.id}
                        className="inline-flex items-center px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs text-gray-900"
                      >
                        {row.full_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div
            className={`grid gap-4 items-start ${
              isScheduleEditable || items.length > 0
                ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]'
                : 'grid-cols-1'
            }`}
          >
            <div className="min-w-0 rounded-lg border border-gray-200 bg-white overflow-hidden">
              {loading || scheduleLoading ? (
                <ScheduleListSkeleton editable={isScheduleEditable} />
              ) : items.length === 0 ? (
                <div className="text-center py-12 px-4 text-gray-500">
                  <p>No products in schedule for {scheduleDate}</p>
                  <p className="text-sm mt-1">
                    {isScheduleEditable
                      ? 'Add products using the form above'
                      : 'This date has no scheduled products'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-px">
                <div className="divide-y divide-gray-200 min-w-[46rem]">
                  <div
                    className={`hidden lg:grid items-center gap-x-5 px-5 py-2.5 bg-gray-50 border-b border-gray-200 text-[10px] font-medium text-gray-500 uppercase tracking-wide ${
                      isScheduleEditable ? SCHEDULE_LIST_GRID_EDITABLE : SCHEDULE_LIST_GRID_READONLY
                    }`}
                  >
                    <span className="pl-1">Product</span>
                    <span className="text-center">Printed</span>
                    <span className="text-center">Batch</span>
                    <span className="px-1">Notes</span>
                    <span className="text-center">Print</span>
                    {isScheduleEditable ? <span className="text-center sr-only">Remove</span> : null}
                  </div>
                  {items.map((item) => {
                    const itemYield = yieldForProductId(item.product_id)
                    const itemBatches = scheduleQtyToBatches(item.quantity_required, itemYield)
                    const remaining = getRequiredRemainingCount(item)
                    const pendingStickerCount = getPendingStickerCount(item)
                    const requestedRemaining = getRequestedRemainingCount(item)
                    const expanded = !!expandedProductIds[item.product_id]
                    const isPrintingAll = printingAllId === item.product_id
                    const activeStickers = item.stickers.filter(isActiveSticker)
                    const voidedStickers = item.stickers.filter((s) => s.voided_at)
                    const activePrinted = activeStickers.length
                    const requiredSlots = Array.from({ length: item.quantity_required }, (_, i) => ({
                      unit: i + 1,
                      sticker: activeStickers[i] as StickerLog | undefined,
                    }))
                    const extraStickers = activeStickers.slice(item.quantity_required)

                    const rowGridClass = isScheduleEditable
                      ? `grid-cols-1 ${SCHEDULE_LIST_GRID_EDITABLE}`
                      : `grid-cols-1 ${SCHEDULE_LIST_GRID_READONLY}`

                    return (
                      <div key={item.product_id} className="bg-white">
                        <div
                          className={`grid items-center gap-x-5 gap-y-3 px-5 py-3.5 hover:bg-gray-50 ${rowGridClass}`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleExpanded(item.product_id)}
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
                              <span className="text-xs text-gray-400 truncate block lg:hidden">
                                {item.brand_name}
                              </span>
                              <span className="text-xs text-gray-500 truncate block lg:hidden">
                                SKU: {item.sku || '—'}
                              </span>
                            </div>
                          </button>
                          <span className="text-xs tabular-nums text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full justify-self-center whitespace-nowrap">
                            {activePrinted}/{item.quantity_required}
                            {pendingStickerCount > 0 ? (
                              <span className="text-amber-700"> +{pendingStickerCount}</span>
                            ) : null}
                          </span>
                          <div className="justify-self-center">
                            {isScheduleEditable ? (
                              <ScheduleBatchStepper
                                value={itemBatches}
                                onChange={(n) =>
                                  handleUpdateScheduleBatches(item.product_id, n)
                                }
                                min={0}
                                step={1}
                                allowDecimal={itemYield > 1}
                              />
                            ) : (
                              <span className="text-sm tabular-nums text-gray-900 block text-center">
                                {itemYield > 1 && itemBatches % 1 !== 0
                                  ? itemBatches.toFixed(2)
                                  : itemBatches}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 justify-self-stretch">
                            {isScheduleEditable ? (
                              <input
                                type="text"
                                placeholder="Notes"
                                value={item.notes || ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  handleUpdateNotes(item.product_id, e.target.value)
                                }
                                className="w-full max-w-full px-2 py-1 border rounded text-xs"
                              />
                            ) : (
                              <span className="text-xs text-gray-500 truncate block">
                                {item.notes || '—'}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-center min-h-[1.75rem]">
                            {canShowPrintActions(item) ? (
                              <div className="flex flex-col items-center gap-1">
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
                                        : undefined
                                  }
                                  className="flex items-center gap-1 px-2 py-1 bg-indigo-500 text-white rounded text-xs hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                >
                                  <Printer className="h-3 w-3 shrink-0" />
                                  <span className="hidden md:inline">Print all </span>({remaining})
                                </button>
                              </div>
                            ) : null}
                          </div>
                          {isScheduleEditable ? (
                            <div className="flex justify-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item)}
                                className="text-red-600 hover:text-red-800 p-1"
                                title="Remove from schedule"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : null}
                        </div>

                        {expanded ? (
                          <div className="px-4 pb-4 pt-3 bg-slate-50/80 border-t border-gray-100">
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
                                          : undefined
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                                    >
                                      <Printer className="h-3 w-3 shrink-0" />
                                      Print requested ({requestedRemaining})
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
                                <span
                                  className="text-center truncate min-w-0 px-1 normal-case font-mono text-gray-700"
                                  title={item.batch_number}
                                >
                                  {item.batch_number}
                                </span>
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
                                      {sticker && !sticker.voided_at ? (
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
                                            : undefined
                                        }
                                        className="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
                                      >
                                        <Printer className="h-3 w-3 shrink-0" />
                                        {sticker ? 'Reprint' : 'Print'}
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
                                            : undefined
                                        }
                                        className="flex items-center gap-1 px-2 py-1 bg-amber-600 text-white rounded text-xs hover:bg-amber-700 disabled:opacity-50"
                                      >
                                        <Printer className="h-3 w-3 shrink-0" />
                                        Print
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
                                      <button
                                        type="button"
                                        onClick={() => void handlePrintSticker(item, sticker)}
                                        disabled={printingStickerKey !== null || isPrintingAll}
                                        className="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
                                      >
                                        <Printer className="h-3 w-3 shrink-0" />
                                        Reprint
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
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 text-white rounded text-xs font-medium hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
                                >
                                  <PlusCircle className="h-3 w-3 shrink-0" />
                                  Print additional
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
                            key={item.product_id}
                            className="rounded-md border border-gray-100 bg-gray-50/80 p-2"
                          >
                            <p className="text-xs font-medium text-gray-900 mb-1.5 truncate" title={item.product_name}>
                              <span className="text-gray-500">{item.sku || '—'}</span>
                              {' · '}
                              {item.product_name}
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

        <div className="mt-5 pt-4 border-t border-gray-200 flex flex-wrap justify-end gap-3">
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
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-6 mx-auto p-5 border w-[calc(100%-1.5rem)] max-w-7xl shadow-lg rounded-lg bg-white max-h-[92vh] overflow-y-auto">
        {body}
      </div>
    </div>
  )
}
