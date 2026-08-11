import { supabase } from './supabase'

export type DsirStoreMovementType = 'transfer_receive' | 'dsir_pull_out' | 'cycle_count'

export type DsirStoreBalance = {
  id: string
  location_id: string
  brand_id: string
  flavor: string
  quantity: number
  updated_at: string
}

export type DsirStoreMovement = {
  id: string
  location_id: string
  brand_id: string
  flavor: string
  delta: number
  quantity_after: number
  movement_type: DsirStoreMovementType
  staff_registration_id: string | null
  staff_name: string | null
  dsir_report_id: string | null
  source_key: string | null
  notes: string | null
  created_at: string
}

export type TransferReceiveItem = {
  flavor: string
  quantity: number
}

export function normalizeDsirFlavor(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toUpperCase()
}

/** Stable idempotency key for a QR receive at a location on a report date. */
export function buildTransferReceiveSourceKey(
  locationId: string,
  reportDate: string,
  items: TransferReceiveItem[]
): string {
  const rows = items
    .map((item) => ({
      flavor: normalizeDsirFlavor(item.flavor),
      quantity: Math.max(0, Math.floor(Number(item.quantity) || 0)),
    }))
    .filter((item) => item.flavor && item.quantity > 0)
    .sort((a, b) => a.flavor.localeCompare(b.flavor))
  const body = rows.map((r) => `${r.flavor}:${r.quantity}`).join('|')
  return `qr:${locationId}:${reportDate}:${body}`
}

export async function getBalancesForLocation(locationId: string): Promise<DsirStoreBalance[]> {
  const { data, error } = await supabase
    .from('dsir_store_inventory')
    .select('*')
    .eq('location_id', locationId)
    .order('flavor')
  if (error) throw error
  return (data || []) as DsirStoreBalance[]
}

export async function listMovements(
  locationId: string,
  options?: { limit?: number; since?: string; until?: string }
): Promise<DsirStoreMovement[]> {
  let q = supabase
    .from('dsir_store_inventory_movements')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
  if (options?.since) {
    q = q.gte('created_at', options.since)
  }
  if (options?.until) {
    q = q.lte('created_at', options.until)
  }
  if (options?.limit) {
    q = q.limit(options.limit)
  }
  const { data, error } = await q
  if (error) throw error
  return (data || []) as DsirStoreMovement[]
}

/** Philippines calendar day bounds for a YYYY-MM-DD report_date. */
export function reportDatePhilippinesBounds(reportDate: string): { start: string; end: string } {
  const day = reportDate.split('T')[0]
  return {
    start: `${day}T00:00:00+08:00`,
    end: `${day}T23:59:59.999+08:00`,
  }
}

/** Movements for a store on a DSIR report date (by day window and/or linked report). */
export async function listMovementsForReportDay(
  locationId: string,
  reportDate: string,
  dsirReportId?: string | null
): Promise<DsirStoreMovement[]> {
  const { start, end } = reportDatePhilippinesBounds(reportDate)
  const byId = new Map<string, DsirStoreMovement>()

  const dayRows = await listMovements(locationId, { since: start, until: end, limit: 500 })
  for (const row of dayRows) byId.set(row.id, row)

  if (dsirReportId) {
    const { data, error } = await supabase
      .from('dsir_store_inventory_movements')
      .select('*')
      .eq('location_id', locationId)
      .eq('dsir_report_id', dsirReportId)
      .order('created_at', { ascending: false })
    if (error) throw error
    for (const row of (data || []) as DsirStoreMovement[]) {
      byId.set(row.id, row)
    }
  }

  // QR receives keyed by report date (even if clock skew)
  const day = reportDate.split('T')[0]
  const { data: qrRows, error: qrErr } = await supabase
    .from('dsir_store_inventory_movements')
    .select('*')
    .eq('location_id', locationId)
    .eq('movement_type', 'transfer_receive')
    .like('source_key', `qr:${locationId}:${day}:%`)
  if (qrErr) throw qrErr
  for (const row of (qrRows || []) as DsirStoreMovement[]) {
    byId.set(row.id, row)
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

/** On-hand per flavor as of end of a report date (from movement ledger). */
export async function getBalancesAsOfReportDate(
  locationId: string,
  reportDate: string
): Promise<Array<{ flavor: string; quantity: number }>> {
  const { end } = reportDatePhilippinesBounds(reportDate)
  const { data, error } = await supabase
    .from('dsir_store_inventory_movements')
    .select('flavor, quantity_after, created_at')
    .eq('location_id', locationId)
    .lte('created_at', end)
    .order('created_at', { ascending: true })
  if (error) throw error

  const byFlavor = new Map<string, number>()
  for (const row of data || []) {
    byFlavor.set(String(row.flavor), Number(row.quantity_after) || 0)
  }
  return Array.from(byFlavor.entries())
    .map(([flavor, quantity]) => ({ flavor, quantity }))
    .sort((a, b) => a.flavor.localeCompare(b.flavor))
}

async function getOrCreateBalance(
  locationId: string,
  brandId: string,
  flavor: string
): Promise<{ id: string; quantity: number }> {
  const normalized = normalizeDsirFlavor(flavor)
  const { data: existing, error: loadErr } = await supabase
    .from('dsir_store_inventory')
    .select('id, quantity')
    .eq('location_id', locationId)
    .eq('flavor', normalized)
    .maybeSingle()
  if (loadErr) throw loadErr
  if (existing?.id) {
    return { id: existing.id as string, quantity: Number(existing.quantity) || 0 }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('dsir_store_inventory')
    .insert({
      location_id: locationId,
      brand_id: brandId,
      flavor: normalized,
      quantity: 0,
    })
    .select('id, quantity')
    .single()
  if (insertErr) {
    // Race: another insert won — reload
    const { data: again, error: againErr } = await supabase
      .from('dsir_store_inventory')
      .select('id, quantity')
      .eq('location_id', locationId)
      .eq('flavor', normalized)
      .single()
    if (againErr) throw insertErr
    return { id: again.id as string, quantity: Number(again.quantity) || 0 }
  }
  return { id: inserted.id as string, quantity: Number(inserted.quantity) || 0 }
}

export type ApplyTransferReceiveResult =
  | { status: 'applied'; flavors: number; totalQty: number }
  | { status: 'duplicate' }
  | { status: 'empty' }

export async function applyTransferReceive(params: {
  locationId: string
  brandId: string
  reportDate: string
  items: TransferReceiveItem[]
  staffRegistrationId?: string | null
  staffName?: string | null
  dsirReportId?: string | null
}): Promise<ApplyTransferReceiveResult> {
  const items = params.items
    .map((item) => ({
      flavor: normalizeDsirFlavor(item.flavor),
      quantity: Math.max(0, Math.floor(Number(item.quantity) || 0)),
    }))
    .filter((item) => item.flavor && item.quantity > 0)

  if (items.length === 0) return { status: 'empty' }

  const sourceKey = buildTransferReceiveSourceKey(params.locationId, params.reportDate, items)

  const { data: existingKey } = await supabase
    .from('dsir_store_inventory_movements')
    .select('id')
    .eq('location_id', params.locationId)
    .like('source_key', `${sourceKey}::%`)
    .limit(1)
    .maybeSingle()

  if (existingKey?.id) return { status: 'duplicate' }

  let totalQty = 0
  for (const item of items) {
    const bal = await getOrCreateBalance(params.locationId, params.brandId, item.flavor)
    const nextQty = bal.quantity + item.quantity
    const { error: movErr } = await supabase.from('dsir_store_inventory_movements').insert({
      location_id: params.locationId,
      brand_id: params.brandId,
      flavor: item.flavor,
      delta: item.quantity,
      quantity_after: nextQty,
      movement_type: 'transfer_receive',
      staff_registration_id: params.staffRegistrationId || null,
      staff_name: params.staffName || null,
      dsir_report_id: params.dsirReportId || null,
      source_key: `${sourceKey}::${item.flavor}`,
      notes: 'Transfer sheet QR receive',
    })
    if (movErr) {
      // Unique violation on rescan mid-batch
      if (String(movErr.code) === '23505' || /duplicate/i.test(movErr.message || '')) {
        return { status: 'duplicate' }
      }
      throw movErr
    }
    const { error: updErr } = await supabase
      .from('dsir_store_inventory')
      .update({ quantity: nextQty, updated_at: new Date().toISOString() })
      .eq('id', bal.id)
    if (updErr) throw updErr
    totalQty += item.quantity
  }

  return { status: 'applied', flavors: items.length, totalQty }
}

export type ApplyPullOutsResult =
  | { status: 'applied'; flavors: number }
  | { status: 'already_posted' }
  | { status: 'insufficient'; flavor: string; onHand: number; pullOut: number }
  | { status: 'empty' }

export async function applyDsirPullOutsOnSubmit(params: {
  locationId: string
  brandId: string
  dsirReportId: string
  staffRegistrationId?: string | null
  staffName?: string | null
  pullOuts: TransferReceiveItem[]
}): Promise<ApplyPullOutsResult> {
  const { data: existing } = await supabase
    .from('dsir_store_inventory_movements')
    .select('id')
    .eq('dsir_report_id', params.dsirReportId)
    .eq('movement_type', 'dsir_pull_out')
    .limit(1)
    .maybeSingle()

  if (existing?.id) return { status: 'already_posted' }

  const rows = params.pullOuts
    .map((item) => ({
      flavor: normalizeDsirFlavor(item.flavor),
      quantity: Math.max(0, Math.floor(Number(item.quantity) || 0)),
    }))
    .filter((item) => item.flavor && item.quantity > 0)

  if (rows.length === 0) return { status: 'empty' }

  // Validate all before writing
  for (const row of rows) {
    const bal = await getOrCreateBalance(params.locationId, params.brandId, row.flavor)
    if (bal.quantity < row.quantity) {
      return {
        status: 'insufficient',
        flavor: row.flavor,
        onHand: bal.quantity,
        pullOut: row.quantity,
      }
    }
  }

  for (const row of rows) {
    const bal = await getOrCreateBalance(params.locationId, params.brandId, row.flavor)
    const nextQty = bal.quantity - row.quantity
    const { error: movErr } = await supabase.from('dsir_store_inventory_movements').insert({
      location_id: params.locationId,
      brand_id: params.brandId,
      flavor: row.flavor,
      delta: -row.quantity,
      quantity_after: nextQty,
      movement_type: 'dsir_pull_out',
      staff_registration_id: params.staffRegistrationId || null,
      staff_name: params.staffName || null,
      dsir_report_id: params.dsirReportId,
      source_key: `pull:${params.dsirReportId}:${row.flavor}`,
      notes: 'DSIR daily pull-out',
    })
    if (movErr) throw movErr
    const { error: updErr } = await supabase
      .from('dsir_store_inventory')
      .update({ quantity: nextQty, updated_at: new Date().toISOString() })
      .eq('id', bal.id)
    if (updErr) throw updErr
  }

  return { status: 'applied', flavors: rows.length }
}

/** Post ice cream pull-outs from a saved DSIR report if not already on the ledger. */
export async function ensureDsirPullOutsFromReport(params: {
  locationId: string
  brandId: string
  dsirReportId: string
  staffRegistrationId?: string | null
  staffName?: string | null
}): Promise<ApplyPullOutsResult> {
  const { data: iceRows, error } = await supabase
    .from('dsir_ice_cream_inventory')
    .select('flavor, pull_out')
    .eq('dsir_report_id', params.dsirReportId)
  if (error) throw error

  const pullOuts = (iceRows || [])
    .map((row) => ({
      flavor: String(row.flavor || ''),
      quantity: Math.max(0, Math.floor(Number(row.pull_out) || 0)),
    }))
    .filter((row) => row.flavor && row.quantity > 0)

  return applyDsirPullOutsOnSubmit({
    ...params,
    pullOuts,
  })
}

export type CycleCountLine = {
  flavor: string
  /** Physical count (pans). Must be >= 0. */
  countedQty: number
}

export type ApplyCycleCountResult =
  | { status: 'applied'; flavors: number; totalAbsDelta: number }
  | { status: 'empty' }
  | { status: 'invalid_notes' }

/**
 * Admin cycle count: set on-hand to counted qty per flavor.
 * Posts one `cycle_count` movement per flavor where variance ≠ 0.
 */
export async function applyCycleCount(params: {
  locationId: string
  brandId: string
  counts: CycleCountLine[]
  notes: string
  adjustedByName?: string | null
  dsirReportId?: string | null
}): Promise<ApplyCycleCountResult> {
  const notes = String(params.notes || '').trim()
  if (!notes) return { status: 'invalid_notes' }

  const lines = params.counts
    .map((row) => ({
      flavor: normalizeDsirFlavor(row.flavor),
      countedQty: Math.max(0, Math.floor(Number(row.countedQty) || 0)),
    }))
    .filter((row) => row.flavor)

  // Dedupe by flavor (last wins)
  const byFlavor = new Map<string, number>()
  for (const row of lines) byFlavor.set(row.flavor, row.countedQty)

  const batchId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  let flavors = 0
  let totalAbsDelta = 0

  for (const [flavor, countedQty] of byFlavor) {
    const bal = await getOrCreateBalance(params.locationId, params.brandId, flavor)
    const delta = countedQty - bal.quantity
    if (delta === 0) continue

    const nextQty = countedQty
    const { error: movErr } = await supabase.from('dsir_store_inventory_movements').insert({
      location_id: params.locationId,
      brand_id: params.brandId,
      flavor,
      delta,
      quantity_after: nextQty,
      movement_type: 'cycle_count',
      staff_registration_id: null,
      staff_name: params.adjustedByName || 'Dashboard admin',
      dsir_report_id: params.dsirReportId || null,
      source_key: `cycle:${params.locationId}:${batchId}:${flavor}`,
      notes,
    })
    if (movErr) throw movErr

    const { error: updErr } = await supabase
      .from('dsir_store_inventory')
      .update({ quantity: nextQty, updated_at: new Date().toISOString() })
      .eq('id', bal.id)
    if (updErr) throw updErr

    flavors += 1
    totalAbsDelta += Math.abs(delta)
  }

  if (flavors === 0) return { status: 'empty' }
  return { status: 'applied', flavors, totalAbsDelta }
}

/**
 * Seed store on-hand from a DSIR report's ice cream rows:
 * on_hand = beginning + arrival for each flavor on the report.
 */
export async function seedStoreInventoryFromDsirBegArrival(params: {
  locationId: string
  brandId: string
  dsirReportId: string
  adjustedByName?: string | null
}): Promise<ApplyCycleCountResult> {
  const { data: iceRows, error } = await supabase
    .from('dsir_ice_cream_inventory')
    .select('flavor, beginning, arrival')
    .eq('dsir_report_id', params.dsirReportId)
  if (error) throw error

  const counts: CycleCountLine[] = (iceRows || [])
    .map((row) => {
      const flavor = String(row.flavor || '')
      const beginning = Math.max(0, Math.floor(Number(row.beginning) || 0))
      const arrival = Math.max(0, Math.floor(Number(row.arrival) || 0))
      return {
        flavor,
        countedQty: beginning + arrival,
      }
    })
    .filter((row) => row.flavor)

  if (counts.length === 0) return { status: 'empty' }

  return applyCycleCount({
    locationId: params.locationId,
    brandId: params.brandId,
    counts,
    notes: 'Seed from DSIR beginning + arrival',
    adjustedByName: params.adjustedByName || 'Dashboard admin',
    dsirReportId: params.dsirReportId,
  })
}

export async function sumOnHandForLocation(locationId: string): Promise<number> {
  const balances = await getBalancesForLocation(locationId)
  return balances.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)
}
