import { supabase } from './supabase'
import type { FactoryStickerRequest } from './supabase'

export function pendingStickerQty(request: FactoryStickerRequest): number {
  if (request.status !== 'pending') return 0
  return Math.max(0, request.quantity - (request.quantity_fulfilled ?? 0))
}

export function pendingStickerQtyByScheduleId(
  requests: FactoryStickerRequest[]
): Record<string, number> {
  const map: Record<string, number> = {}
  for (const req of requests) {
    const qty = pendingStickerQty(req)
    if (qty <= 0) continue
    map[req.schedule_id] = (map[req.schedule_id] ?? 0) + qty
  }
  return map
}

export function stickerPrintTarget(
  quantityRequired: number,
  scheduleId: string,
  pendingByScheduleId: Record<string, number>
): number {
  return quantityRequired + (pendingByScheduleId[scheduleId] ?? 0)
}

export function extraStickersPrinted(
  stickersPrinted: number,
  quantityRequired: number
): number {
  return Math.max(0, stickersPrinted - quantityRequired)
}

export function newExtraStickersPrinted(
  stickersBefore: number,
  stickersAfter: number,
  quantityRequired: number
): number {
  const beforeExtra = extraStickersPrinted(stickersBefore, quantityRequired)
  const afterExtra = extraStickersPrinted(stickersAfter, quantityRequired)
  return Math.max(0, afterExtra - beforeExtra)
}

export async function fetchPendingStickerRequests(
  scheduleDate: string,
  options?: { brandId?: string; scheduleIds?: string[] }
): Promise<FactoryStickerRequest[]> {
  let query = supabase
    .from('factory_sticker_requests')
    .select('*')
    .eq('schedule_date', scheduleDate)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (options?.scheduleIds?.length) {
    query = query.in('schedule_id', options.scheduleIds)
  }

  const { data, error } = await query
  if (error) {
    if (
      error.message.includes('factory_sticker_requests') ||
      error.message.includes('does not exist') ||
      error.message.includes('schema cache')
    ) {
      console.warn('factory_sticker_requests:', error.message)
      return []
    }
    throw error
  }

  let rows = (data || []) as FactoryStickerRequest[]
  if (options?.brandId) {
    const productIds = Array.from(new Set(rows.map((r) => r.product_id)))
    if (productIds.length === 0) return []

    const { data: products } = await supabase
      .from('products')
      .select('id')
      .in('id', productIds)
      .eq('brand_id', options.brandId)

    const allowed = new Set((products || []).map((p: { id: string }) => p.id))
    rows = rows.filter((r) => allowed.has(r.product_id))
  }

  return rows.filter((r) => pendingStickerQty(r) > 0)
}

export async function createFactoryStickerRequest(input: {
  scheduleId: string
  productId: string
  scheduleDate: string
  quantity: number
  requestedBy?: string
  notes?: string
}): Promise<FactoryStickerRequest> {
  const qty = Math.floor(input.quantity)
  if (!input.scheduleId || qty < 1) {
    throw new Error('Enter a valid quantity')
  }

  const { data, error } = await supabase
    .from('factory_sticker_requests')
    .insert({
      schedule_id: input.scheduleId,
      product_id: input.productId,
      schedule_date: input.scheduleDate,
      quantity: qty,
      requested_by: input.requestedBy?.trim() || 'Factory',
      notes: input.notes?.trim() || null,
      status: 'pending',
      quantity_fulfilled: 0,
    })
    .select('*')
    .single()

  if (error) {
    if (
      error.message.includes('factory_sticker_requests') ||
      error.message.includes('does not exist') ||
      error.message.includes('schema cache')
    ) {
      throw new Error(
        'Sticker request tables are not set up yet. Run migrations/factory-sticker-requests.sql in Supabase first.'
      )
    }
    throw error
  }

  return data as FactoryStickerRequest
}

export async function fulfillStickerRequests(
  scheduleId: string,
  count: number
): Promise<void> {
  const qty = Math.floor(count)
  if (!scheduleId || qty < 1) return

  const { data, error } = await supabase
    .from('factory_sticker_requests')
    .select('*')
    .eq('schedule_id', scheduleId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('fulfillStickerRequests:', error.message)
    return
  }

  let remaining = qty
  const now = new Date().toISOString()

  for (const row of (data || []) as FactoryStickerRequest[]) {
    if (remaining <= 0) break
    const open = pendingStickerQty(row)
    if (open <= 0) continue

    const apply = Math.min(open, remaining)
    const nextFulfilled = (row.quantity_fulfilled ?? 0) + apply
    const fulfilled = nextFulfilled >= row.quantity

    const { error: updateError } = await supabase
      .from('factory_sticker_requests')
      .update({
        quantity_fulfilled: nextFulfilled,
        status: fulfilled ? 'fulfilled' : 'pending',
        fulfilled_at: fulfilled ? now : null,
      })
      .eq('id', row.id)

    if (updateError) {
      console.warn('fulfillStickerRequests update:', updateError.message)
      return
    }

    remaining -= apply
  }
}
