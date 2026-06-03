import { supabase, type RawMaterial } from './supabase'
import type { FactoryScheduleItem } from './factory-schedule'
import {
  effectiveBomStockQtyPerProductUnit,
  fetchProductBomSettingsByProductId,
  isBomQuantityMode,
} from './product-bom'
import {
  factoryRequestQtyToStockUnits,
  getStockUnitLabel,
  isBomQtyInBase,
  type RawMaterialUomFields,
} from './raw-material-uom'

type BomRowMaterial = {
  id: string
  material_name: string
  sku?: string
  unit: string
  uom_base_unit?: string | null
  uom_base_per_unit?: number | null
  current_stock: number
  is_active?: boolean
}

function bomRowMaterial(
  row: { material?: BomRowMaterial | BomRowMaterial[] | null }
): BomRowMaterial | undefined {
  const m = row.material
  if (!m) return undefined
  return Array.isArray(m) ? m[0] : m
}

export type BomRequirementLine = {
  material_id: string
  material_name: string
  sku?: string
  unit: string
  quantity: number
  current_stock: number
}

/** Whole-number qty for factory floor requests */
export function formatBomQuantity(qty: number): string {
  if (!Number.isFinite(qty) || qty <= 0) return '0'
  return String(Math.ceil(qty))
}

export type BomStockShortage = {
  material_id: string
  material_name: string
  unit: string
  required: number
  in_stock: number
}

function formatQtyDisplay(qty: number): string {
  if (!Number.isFinite(qty)) return '0'
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(2)
}

type BomShortageLine = {
  material_id: string
  material_name: string
  unit?: string
  total_qty: number
  current_stock?: number
  pending_qty?: number
  released_qty?: number
} & RawMaterialUomFields

function bomLineCoveredStock(line: BomShortageLine): number {
  const floor = Number(line.current_stock) || 0
  const pending = Number(line.pending_qty) || 0
  const released = Number(line.released_qty) || 0
  if (isBomQtyInBase(line)) {
    return floor + pending + released
  }
  const pendingStock = factoryRequestQtyToStockUnits(pending, line)
  const releasedStock = factoryRequestQtyToStockUnits(released, line)
  return floor + pendingStock + releasedStock
}

/** Materials whose floor stock + in-flight requests cannot cover schedule BOM need. */
export function findBomStockShortages(lines: BomShortageLine[]): BomStockShortage[] {
  return lines
    .filter((line) => line.total_qty > 0)
    .filter((line) => bomLineCoveredStock(line) < line.total_qty)
    .map((line) => ({
      material_id: line.material_id,
      material_name: line.material_name,
      unit: line.unit || '—',
      required: line.total_qty,
      in_stock: Number(line.current_stock) || 0,
    }))
}

export function formatBomStockShortageMessage(
  shortages: BomStockShortage[],
  options?: { factoryFloor?: boolean }
): string {
  if (!shortages.length) return ''
  const detail = shortages
    .map(
      (s) =>
        `• ${s.material_name}: need ${formatQtyDisplay(s.required)} ${s.unit}, ${
          options?.factoryFloor ? 'on floor' : 'in stock'
        } ${formatQtyDisplay(s.in_stock)} ${s.unit}`
    )
    .join('\n')
  const stockLabel = options?.factoryFloor
    ? 'insufficient on-floor stock for factory materials'
    : 'insufficient raw material stock'
  return `Cannot save the production schedule — ${stockLabel}:\n\n${detail}`
}

export function parseWholeQuantity(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null
  return n
}

export async function fetchAggregatedBomRequirements(
  scheduleItems: Pick<FactoryScheduleItem, 'product_id' | 'quantity_required'>[]
): Promise<BomRequirementLine[]> {
  if (!scheduleItems.length) return []

  const productIds = Array.from(new Set(scheduleItems.map((s) => s.product_id)))

  const { data: bomRows, error } = await supabase
    .from('product_bom_items')
    .select(
      'product_id, quantity, quantity_mode, yield_per_batch, material:raw_materials(id, material_name, sku, unit, uom_base_unit, uom_base_per_unit, current_stock, is_active)'
    )
    .in('product_id', productIds)

  if (error) {
    console.warn('product_bom_items:', error.message)
    return []
  }

  const productBomSettings = await fetchProductBomSettingsByProductId(productIds)

  const totals = new Map<string, BomRequirementLine>()

  for (const item of scheduleItems) {
    const required = item.quantity_required
    if (!required || required <= 0) continue

    for (const row of bomRows || []) {
      if (row.product_id !== item.product_id) continue
      const mat = bomRowMaterial(row as { material?: BomRowMaterial | BomRowMaterial[] | null })
      if (!mat?.id || mat.is_active === false) continue

      const perUnitStock = effectiveBomStockQtyPerProductUnit(
        {
          quantity: Number(row.quantity) || 0,
          quantity_mode: isBomQuantityMode(
            (row as { quantity_mode?: string }).quantity_mode
          )
            ? (row as { quantity_mode: 'unit' | 'batch' }).quantity_mode
            : 'unit',
          yield_per_batch: (row as { yield_per_batch?: number | null }).yield_per_batch,
          material: mat as RawMaterial,
        },
        productBomSettings[item.product_id]
      )
      if (perUnitStock <= 0) continue

      const add = perUnitStock * required
      const existing = totals.get(mat.id)
      if (existing) {
        existing.quantity += add
      } else {
        totals.set(mat.id, {
          material_id: mat.id,
          material_name: mat.material_name || 'Material',
          sku: mat.sku,
          unit: getStockUnitLabel(mat),
          quantity: add,
          current_stock: Number(mat.current_stock) || 0,
        })
      }
    }
  }

  return Array.from(totals.values()).sort((a, b) =>
    a.material_name.localeCompare(b.material_name, undefined, { sensitivity: 'base' })
  )
}
