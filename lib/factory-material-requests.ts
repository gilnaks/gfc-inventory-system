import type { FactoryMaterialRequest } from './supabase'
import {
  factoryRequestQtyToStockUnits,
  formatFactoryRequestQtyDisplay,
  getStockUnitLabel,
  openStockQtyToRequestUnits,
  type RawMaterialUomFields,
} from './raw-material-uom'

const REQUEST_QTY_SLACK = 1e-5
const STOCK_QTY_SLACK = 0.01

export function releasedRequestAvailable(req: FactoryMaterialRequest): number {
  if (req.status !== 'released') return 0
  const total = Number(req.quantity) || 0
  const used = Number(req.quantity_used ?? 0) || 0
  const available = Math.round((total - used) * 1e6) / 1e6
  return available > REQUEST_QTY_SLACK ? available : 0
}

/** Max open qty in stock units for what remains on a released request line. */
export function releasedRequestMaxOpenStockUnits(
  availableRequestQty: number,
  material: RawMaterialUomFields
): number {
  const stock = factoryRequestQtyToStockUnits(availableRequestQty, material)
  return Math.round(Math.max(0, stock) * 1e6) / 1e6
}

function openQtyExceededMessage(
  availableRequestQty: number,
  maxOpenStock: number,
  material: RawMaterialUomFields
): string {
  const availDisplay = formatFactoryRequestQtyDisplay(availableRequestQty, material)
  return `Only ${availDisplay.primary} released (${maxOpenStock.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  })} ${getStockUnitLabel(material)} max for this line).`
}

export function validateOpenStockForReleasedRequest(
  openStockQty: number,
  availableRequestQty: number,
  material: RawMaterialUomFields
): { ok: true; requestConsumption: number } | { ok: false; message: string } {
  const qty = Number(openStockQty)
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, message: 'Enter a valid quantity greater than 0.' }
  }

  const available = Math.max(0, Number(availableRequestQty) || 0)
  if (available <= REQUEST_QTY_SLACK) {
    return { ok: false, message: 'Nothing left to open on this release line.' }
  }

  const maxOpenStock = releasedRequestMaxOpenStockUnits(available, material)
  const needRequest = openStockQtyToRequestUnits(qty, material)

  if (needRequest <= REQUEST_QTY_SLACK) {
    return { ok: false, message: 'Enter a valid quantity greater than 0.' }
  }

  if (needRequest > available + REQUEST_QTY_SLACK) {
    return {
      ok: false,
      message: openQtyExceededMessage(available, maxOpenStock, material),
    }
  }

  if (qty > maxOpenStock + STOCK_QTY_SLACK && needRequest > available + REQUEST_QTY_SLACK) {
    return {
      ok: false,
      message: openQtyExceededMessage(available, maxOpenStock, material),
    }
  }

  return {
    ok: true,
    requestConsumption: Math.min(needRequest, available),
  }
}

/** Oldest released request with enough remaining quantity for an open-package action. */
export function findReleasedRequestForOpen(
  requests: FactoryMaterialRequest[],
  materialId: string,
  openStockQty: number,
  material: RawMaterialUomFields
): FactoryMaterialRequest | null {
  if (!openStockQty || openStockQty <= 0) return null
  const needRequest = openStockQtyToRequestUnits(openStockQty, material)
  if (needRequest <= 0) return null
  const candidates = requests
    .filter((r) => r.material_id === materialId && r.status === 'released')
    .sort(
      (a, b) =>
        new Date(a.released_at || a.created_at || 0).getTime() -
        new Date(b.released_at || b.created_at || 0).getTime()
    )
  return (
    candidates.find((r) => {
      const available = releasedRequestAvailable(r)
      return available + REQUEST_QTY_SLACK >= needRequest
    }) ?? null
  )
}

export function totalReleasedAvailable(
  requests: FactoryMaterialRequest[],
  materialId: string
): number {
  return requests
    .filter((r) => r.material_id === materialId && r.status === 'released')
    .reduce((sum, r) => sum + releasedRequestAvailable(r), 0)
}

export function hasPendingRequest(
  requests: FactoryMaterialRequest[],
  materialId: string
): boolean {
  return requests.some((r) => r.material_id === materialId && r.status === 'pending')
}
