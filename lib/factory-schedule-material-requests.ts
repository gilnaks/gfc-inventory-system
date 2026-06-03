import { supabase } from './supabase'
import {
  computeFactoryRequestQtyForShortfall,
  type RawMaterialUomFields,
} from './raw-material-uom'

export type ProductionScheduleStatus = 'draft' | 'active' | 'cancelled'

export type ScheduleBomRequestLine = {
  material_id: string
  /** Total BOM requirement for the schedule, in stock units. */
  required_stock: number
  /** Opened factory floor remaining, in stock units. */
  floor_stock: number
  /** Existing pending request totals for this date, in request UOM. */
  pending_request_qty?: number
  /** Existing released (not yet fully used) totals, in request UOM. */
  released_request_qty?: number
}

export async function createMaterialRequestsForScheduleBom(
  lines: ScheduleBomRequestLine[],
  options: {
    scheduleDate: string
    brandId: string
    requestedBy: string
  }
): Promise<{ created: number; skipped: number }> {
  if (!lines.length) return { created: 0, skipped: 0 }

  const materialIds = Array.from(new Set(lines.map((l) => l.material_id)))

  const { data: materialRows } = await supabase
    .from('raw_materials')
    .select(
      'id, unit, uom_purchase_unit, uom_stock_per_purchase, factory_request_uom, factory_inventory_kind'
    )
    .in('id', materialIds)

  const materialById = new Map(
    (materialRows || []).map((row) => [row.id as string, row as RawMaterialUomFields])
  )

  const { data: pendingRows } = await supabase
    .from('factory_material_requests')
    .select('material_id')
    .eq('schedule_date', options.scheduleDate)
    .eq('status', 'pending')
    .in('material_id', materialIds)

  const pendingIds = new Set((pendingRows || []).map((r) => r.material_id as string))
  const toInsert: Array<{
    material_id: string
    quantity: number
    request_date: string
    schedule_date: string
    brand_id: string
    status: 'pending'
    requested_by: string
  }> = []

  let skipped = 0
  for (const line of lines) {
    const mat = materialById.get(line.material_id)
    if (!mat) continue

    const quantity = computeFactoryRequestQtyForShortfall({
      requiredStock: line.required_stock,
      floorStock: line.floor_stock,
      pendingRequestQty: line.pending_request_qty,
      releasedRequestQty: line.released_request_qty,
      material: mat,
    })

    if (quantity <= 0) continue

    if (pendingIds.has(line.material_id)) {
      skipped += 1
      continue
    }

    toInsert.push({
      material_id: line.material_id,
      quantity,
      request_date: options.scheduleDate,
      schedule_date: options.scheduleDate,
      brand_id: options.brandId,
      status: 'pending',
      requested_by: options.requestedBy,
    })
  }

  if (toInsert.length === 0) return { created: 0, skipped }

  const { error } = await supabase.from('factory_material_requests').insert(toInsert)
  if (error) throw error
  return { created: toInsert.length, skipped }
}

/** @deprecated Use createMaterialRequestsForScheduleBom with full BOM lines. */
export async function createMaterialRequestsForShortages(
  lines: ScheduleBomRequestLine[],
  options: {
    scheduleDate: string
    brandId: string
    requestedBy: string
  }
): Promise<{ created: number; skipped: number }> {
  return createMaterialRequestsForScheduleBom(lines, options)
}

/** Manual factory material request (not tied to schedule BOM auto-send). */
export async function createManualFactoryMaterialRequest(params: {
  materialId: string
  quantity: number
  scheduleDate: string
  brandId: string
  requestedBy: string
}): Promise<void> {
  const quantity = Math.max(0, Math.floor(Number(params.quantity) || 0))
  if (quantity <= 0) throw new Error('Enter a whole number quantity greater than 0.')

  const { error } = await supabase.from('factory_material_requests').insert({
    material_id: params.materialId,
    quantity,
    request_date: params.scheduleDate,
    schedule_date: params.scheduleDate,
    brand_id: params.brandId,
    status: 'pending',
    requested_by: params.requestedBy.trim() || 'Factory',
  })

  if (error) throw error
}

export async function cancelPendingMaterialRequest(requestId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('factory_material_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id')

  if (error) throw error
  return (data?.length ?? 0) > 0
}
