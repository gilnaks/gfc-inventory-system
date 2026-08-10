import {
  supabase,
  type Brand,
  type MaterialCycleCount,
  type MaterialCycleCountLine,
  type RawMaterial,
} from './supabase'
import { stockUnitsPerPurchase, formatStockAsPurchaseWithRemainder, formatStockUnitTotal, getPurchaseUnitLabel } from './raw-material-uom'

export function purchaseQtyToStockUnits(qty: number, material: RawMaterial): number {
  return qty * stockUnitsPerPurchase(material)
}

export function stockUnitsToPurchaseQty(stock: number, material: RawMaterial): number {
  const per = stockUnitsPerPurchase(material)
  return stock / per
}

export function lineVarianceStock(line: MaterialCycleCountLine): number | null {
  if (line.counted_stock == null || line.counted_stock === undefined) return null
  return Number(line.counted_stock) - Number(line.system_stock)
}

/** Variance in purchase units (same unit as physical count entry). */
export function purchaseQtyVariance(
  purchaseQty: number | null | undefined,
  systemStock: number,
  material: RawMaterial
): number | null {
  if (purchaseQty == null || purchaseQty === undefined) return null
  const systemPurchase = stockUnitsToPurchaseQty(Number(systemStock), material)
  return purchaseQty - systemPurchase
}

export function purchaseQtyVarianceFromStock(
  countedStock: number | null | undefined,
  systemStock: number,
  material: RawMaterial
): number | null {
  if (countedStock == null || countedStock === undefined) return null
  return (
    stockUnitsToPurchaseQty(Number(countedStock), material) -
    stockUnitsToPurchaseQty(Number(systemStock), material)
  )
}

export function formatPurchaseUnitQty(qty: number, material: RawMaterial): string {
  const n = Number(qty)
  if (!Number.isFinite(n)) return `0 ${getPurchaseUnitLabel(material)}`
  const abs = Math.abs(n)
  const formatted = Number.isInteger(abs) ? abs.toLocaleString() : abs.toFixed(2)
  return `${formatted} ${getPurchaseUnitLabel(material)}`
}

export function formatCycleCountQty(
  stockQty: number,
  material: RawMaterial
): { purchase: string; stockNote?: string } {
  return {
    purchase: formatStockAsPurchaseWithRemainder(stockQty, material),
    stockNote: formatStockUnitTotal(stockQty, material),
  }
}

export function formatCycleCountMovementNotes(params: {
  countDate: string
  materialName: string
  systemStock: number
  countedStock: number
  material?: RawMaterial | null
}): string {
  const { countDate, materialName, systemStock, countedStock, material } = params
  const systemLabel = material
    ? formatCycleCountQty(systemStock, material).purchase
    : String(systemStock)
  const countedLabel = material
    ? formatCycleCountQty(countedStock, material).purchase
    : String(countedStock)
  return `Cycle count ${countDate} — ${materialName}: system ${systemLabel} → counted ${countedLabel}`
}

/** Materials visible on the brand's materials inventory tab (same owner rules as procurement UI). */
export function materialsVisibleToBrand(
  materials: RawMaterial[],
  selectedBrand: Brand,
  brandNames: Set<string>
): RawMaterial[] {
  const selectedName = selectedBrand.name
  return materials.filter((m) => {
    const owners = (m.owner ?? []).map((o) => o.trim()).filter(Boolean)
    if (owners.length === 0) return true
    if (owners.includes(selectedName)) return true
    const brandOwners = owners.filter((o) => brandNames.has(o))
    if (brandOwners.length === 0) return true
    return false
  })
}

export async function fetchInProgressCycleCount(
  brandId: string
): Promise<MaterialCycleCount | null> {
  const { data, error } = await supabase
    .from('material_cycle_counts')
    .select('*')
    .eq('brand_id', brandId)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as MaterialCycleCount) || null
}

export async function fetchCycleCountHistory(
  brandId: string,
  limit = 20
): Promise<MaterialCycleCount[]> {
  const { data, error } = await supabase
    .from('material_cycle_counts')
    .select('*')
    .eq('brand_id', brandId)
    .order('count_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as MaterialCycleCount[]
}

export async function fetchCycleCountLines(
  cycleCountId: string
): Promise<MaterialCycleCountLine[]> {
  const { data, error } = await supabase
    .from('material_cycle_count_lines')
    .select('*, material:raw_materials(*)')
    .eq('cycle_count_id', cycleCountId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []) as MaterialCycleCountLine[]
}

export async function startMaterialCycleCount(options: {
  brandId: string
  materials: RawMaterial[]
  countDate?: string
  createdBy: string
  notes?: string
}): Promise<{ count: MaterialCycleCount; lines: MaterialCycleCountLine[] }> {
  const existing = await fetchInProgressCycleCount(options.brandId)
  if (existing) {
    throw new Error(
      'A cycle count is already in progress for this brand. Resume it or cancel it before starting another.'
    )
  }

  const countDate = options.countDate || new Date().toISOString().split('T')[0]

  const { data: countRow, error: countErr } = await supabase
    .from('material_cycle_counts')
    .insert({
      brand_id: options.brandId,
      count_date: countDate,
      status: 'in_progress',
      notes: options.notes?.trim() || null,
      created_by: options.createdBy,
    })
    .select('*')
    .single()

  if (countErr || !countRow) {
    throw new Error(countErr?.message || 'Failed to create cycle count')
  }

  const activeMaterials = options.materials.filter((m) => m.is_active !== false)
  const linePayload = activeMaterials.map((m) => ({
    cycle_count_id: countRow.id,
    material_id: m.id,
    system_stock: Number(m.current_stock) || 0,
  }))

  if (linePayload.length === 0) {
    await supabase.from('material_cycle_counts').delete().eq('id', countRow.id)
    throw new Error('No materials to include in this cycle count.')
  }

  const { data: lines, error: linesErr } = await supabase
    .from('material_cycle_count_lines')
    .insert(linePayload)
    .select('*, material:raw_materials(*)')

  if (linesErr) {
    await supabase.from('material_cycle_counts').delete().eq('id', countRow.id)
    throw new Error(linesErr.message)
  }

  return {
    count: countRow as MaterialCycleCount,
    lines: (lines || []) as MaterialCycleCountLine[],
  }
}

export type CycleCountLineUpdate = {
  id: string
  counted_stock: number | null
  notes?: string | null
}

export async function saveCycleCountLineDrafts(updates: CycleCountLineUpdate[]): Promise<void> {
  for (const row of updates) {
    const { error } = await supabase
      .from('material_cycle_count_lines')
      .update({
        counted_stock: row.counted_stock,
        notes: row.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    if (error) throw error
  }
}

export type PostCycleCountResult = {
  posted: number
  skipped: number
  zeroVariance: number
}

export async function postMaterialCycleCount(options: {
  cycleCountId: string
  postedBy: string
  movementDate?: string
}): Promise<PostCycleCountResult> {
  const { data: header, error: headerErr } = await supabase
    .from('material_cycle_counts')
    .select('*')
    .eq('id', options.cycleCountId)
    .single()

  if (headerErr || !header) {
    throw new Error(headerErr?.message || 'Cycle count not found')
  }
  if (header.status !== 'in_progress') {
    throw new Error('This cycle count has already been posted or cancelled.')
  }

  const lines = await fetchCycleCountLines(options.cycleCountId)
  const movementDate = options.movementDate || header.count_date
  const refNumber = `CC-${header.id.slice(0, 8).toUpperCase()}`

  let posted = 0
  let skipped = 0
  let zeroVariance = 0

  for (const line of lines) {
    if (line.counted_stock == null || line.counted_stock === undefined) {
      skipped++
      continue
    }

    const variance = lineVarianceStock(line)
    if (variance === null) {
      skipped++
      continue
    }

    if (variance === 0) {
      zeroVariance++
      continue
    }

    const materialName = line.material?.material_name || 'Material'
    const notes = formatCycleCountMovementNotes({
      countDate: header.count_date,
      materialName,
      systemStock: Number(line.system_stock),
      countedStock: Number(line.counted_stock),
      material: line.material,
    })
    const { data: movement, error: movErr } = await supabase
      .from('material_stock_movements')
      .insert({
        material_id: line.material_id,
        movement_type: 'adjustment',
        quantity: variance,
        reference_type: 'cycle_count',
        reference_id: header.id,
        reference_number: refNumber,
        notes,
        movement_date: movementDate,
        created_by: options.postedBy,
      })
      .select('id')
      .single()

    if (movErr) {
      throw new Error(`${materialName}: ${movErr.message}`)
    }

    if (movement?.id) {
      const { postMaterialMovementJournalWithNotice } = await import('./accounting-movement-posting')
      await postMaterialMovementJournalWithNotice(
        movement.id,
        header.brand_id,
        options.postedBy,
        'cycle count'
      )
    }

    const { error: lineUpdErr } = await supabase
      .from('material_cycle_count_lines')
      .update({
        adjustment_movement_id: movement?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', line.id)

    if (lineUpdErr) throw new Error(lineUpdErr.message)
    posted++
  }

  const { error: closeErr } = await supabase
    .from('material_cycle_counts')
    .update({
      status: 'posted',
      posted_by: options.postedBy,
      posted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', options.cycleCountId)
    .eq('status', 'in_progress')

  if (closeErr) throw new Error(closeErr.message)

  return { posted, skipped, zeroVariance }
}

export async function cancelMaterialCycleCount(cycleCountId: string): Promise<void> {
  const { error } = await supabase
    .from('material_cycle_counts')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', cycleCountId)
    .eq('status', 'in_progress')

  if (error) throw error
}
