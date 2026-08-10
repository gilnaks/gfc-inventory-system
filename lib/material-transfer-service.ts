import { supabase } from './supabase'
import type { MaterialTransfer, MaterialTransferLine, RawMaterial } from './supabase'
import { ensureIntercompanyTransferPostingReady } from './accounting-intercompany-coa'
import { postMaterialTransferJournals } from './accounting-material-transfer-posting'
import { purchaseQtyToStockUnits } from './material-cycle-count'
import { formatStockAsPurchaseWithRemainder } from './raw-material-uom'

/** `quantity` is in purchase units (box, sack, etc.). Stock movements use converted stock units. */
export type MaterialTransferLineInput = {
  sourceMaterialId: string
  quantity: number
}

async function nextTransferNumber(factoryBrandId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `MTR-${year}-`
  const { data } = await supabase
    .from('material_transfers')
    .select('transfer_number')
    .eq('from_brand_id', factoryBrandId)
    .like('transfer_number', `${prefix}%`)
    .order('transfer_number', { ascending: false })
    .limit(1)
  const last = data?.[0]?.transfer_number as string | undefined
  const seq = last ? parseInt(last.replace(prefix, ''), 10) + 1 : 1
  return `${prefix}${String(seq).padStart(4, '0')}`
}

function normalizeKey(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

function materialMatchKey(material: Pick<RawMaterial, 'sku' | 'material_name'>): string {
  const skuKey = normalizeKey(material.sku)
  if (skuKey) return `sku:${skuKey}`
  return `name:${normalizeKey(material.material_name)}`
}

function materialAllowsBrandTransfer(
  material: RawMaterial,
  fromBrandId: string,
  toBrandName: string,
  destinationMatchKeys?: Set<string>
): boolean {
  const ownerSet = new Set((material.owner || []).map((v) => normalizeKey(v)))
  // Current model: one row per owner brand, with stock held on the source (GFC) brand row.
  // Allow transfer if material is a GFC-row material and destination brand is listed in owners.
  if (material.brand_id === fromBrandId && ownerSet.has(normalizeKey(toBrandName))) return true

  // Owner-split fallback: allow when a destination brand sibling material already exists.
  if (material.brand_id === fromBrandId && destinationMatchKeys?.has(materialMatchKey(material))) {
    return true
  }

  // Backward compatibility for old multi-owner rows.
  return ownerSet.has(normalizeKey('gfc main')) && ownerSet.has(normalizeKey(toBrandName))
}

async function resolveDestinationMaterial(
  source: RawMaterial,
  toBrandId: string,
  toBrandName: string
): Promise<string> {
  const skuKey = normalizeKey(source.sku)
  const nameKey = normalizeKey(source.material_name)

  const { data: candidates } = await supabase
    .from('raw_materials')
    .select('*')
    .eq('brand_id', toBrandId)
    .eq('is_active', true)

  const rows = (candidates || []) as RawMaterial[]

  if (skuKey) {
    const bySku = rows.find((r) => normalizeKey(r.sku) === skuKey)
    if (bySku?.id) return bySku.id
  }

  if (nameKey) {
    const byName = rows.find((r) => normalizeKey(r.material_name) === nameKey)
    if (byName?.id) return byName.id
  }

  const { data: created, error } = await supabase
    .from('raw_materials')
    .insert([
      {
        brand_id: toBrandId,
        material_name: source.material_name,
        sku: source.sku || null,
        category: source.category || null,
        factory_inventory_kind: source.factory_inventory_kind || null,
        factory_request_uom: source.factory_request_uom || null,
        factory_bom_uom: source.factory_bom_uom || null,
        owner: [toBrandName],
        unit: source.unit,
        uom_base_unit: source.uom_base_unit || null,
        uom_base_per_unit: source.uom_base_per_unit ?? null,
        uom_purchase_unit: source.uom_purchase_unit || null,
        uom_stock_per_purchase: source.uom_stock_per_purchase ?? null,
        unit_cost: source.unit_cost,
        minimum_stock: 0,
        current_stock: 0,
        is_active: true,
        notes: 'Auto-created from GFC materials transfer',
      },
    ])
    .select('id')
    .single()

  if (error || !created?.id) {
    throw new Error(error?.message || 'Failed to create destination material row')
  }

  return created.id as string
}

export async function loadGfcMaterials(
  factoryBrandId: string,
  toBrandId?: string,
  toBrandName?: string
): Promise<RawMaterial[]> {
  const [gfcRes, destinationRes] = await Promise.all([
    supabase
      .from('raw_materials')
      .select('*')
      .eq('brand_id', factoryBrandId)
      .eq('is_active', true)
      .order('material_name'),
    toBrandId
      ? supabase
          .from('raw_materials')
          .select('sku, material_name')
          .eq('brand_id', toBrandId)
          .eq('is_active', true)
      : Promise.resolve({ data: [] as Array<Pick<RawMaterial, 'sku' | 'material_name'>>, error: null }),
  ])

  if (gfcRes.error) throw gfcRes.error
  const materials = (gfcRes.data || []) as RawMaterial[]
  if (!toBrandName?.trim()) return materials
  const destinationMatchKeys = new Set(
    ((destinationRes.data || []) as Array<Pick<RawMaterial, 'sku' | 'material_name'>>).map((m) =>
      materialMatchKey(m as RawMaterial)
    )
  )
  return materials.filter((m) =>
    materialAllowsBrandTransfer(m, factoryBrandId, toBrandName, destinationMatchKeys)
  )
}

export async function loadMaterialTransfers(brandId: string): Promise<MaterialTransfer[]> {
  const { data, error } = await supabase
    .from('material_transfers')
    .select(
      '*, lines:material_transfer_lines(*), from_brand:brands!material_transfers_from_brand_id_fkey(id, name), to_brand:brands!material_transfers_to_brand_id_fkey(id, name)'
    )
    .or(`from_brand_id.eq.${brandId},to_brand_id.eq.${brandId}`)
    .order('transfer_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as MaterialTransfer[]
}

export async function createAndPostMaterialTransfer(params: {
  fromBrandId: string
  toBrandId: string
  transferDate: string
  lines: MaterialTransferLineInput[]
  notes?: string
  createdBy: string
}): Promise<MaterialTransfer> {
  if (!params.lines.length) throw new Error('Add at least one line')

  await ensureIntercompanyTransferPostingReady(params.fromBrandId, params.toBrandId)

  const { data: toBrand } = await supabase
    .from('brands')
    .select('id, name')
    .eq('id', params.toBrandId)
    .single()
  if (!toBrand?.name) throw new Error('Destination brand not found')
  const { data: destinationRows } = await supabase
    .from('raw_materials')
    .select('sku, material_name')
    .eq('brand_id', params.toBrandId)
    .eq('is_active', true)
  const destinationMatchKeys = new Set(
    ((destinationRows || []) as Array<Pick<RawMaterial, 'sku' | 'material_name'>>).map((m) =>
      materialMatchKey(m as RawMaterial)
    )
  )

  const pricedLines: Array<{
    sourceMaterialId: string
    purchaseQty: number
    stockQty: number
    unitCost: number
    lineCost: number
    source: RawMaterial
    destMaterialId: string
  }> = []

  for (const line of params.lines) {
    const purchaseQty = Number(line.quantity) || 0
    if (purchaseQty <= 0) throw new Error('Quantity must be greater than zero')

    const { data: source } = await supabase
      .from('raw_materials')
      .select('*')
      .eq('id', line.sourceMaterialId)
      .single()

    if (!source) throw new Error('Source material not found')
    const sourceMaterial = source as RawMaterial

    if (
      !materialAllowsBrandTransfer(
        sourceMaterial,
        params.fromBrandId,
        toBrand.name,
        destinationMatchKeys
      )
    ) {
      throw new Error(
        `${sourceMaterial.material_name} cannot be transferred to ${toBrand.name}.`
      )
    }

    const stockQty = purchaseQtyToStockUnits(purchaseQty, sourceMaterial)
    const available = Number(sourceMaterial.current_stock) || 0
    if (available < stockQty - 1e-9) {
      throw new Error(
        `Insufficient stock for ${sourceMaterial.material_name}. Available: ${formatStockAsPurchaseWithRemainder(available, sourceMaterial)}`
      )
    }

    const unitCost = Number(sourceMaterial.unit_cost) || 0
    const lineCost = Math.round(purchaseQty * unitCost * 100) / 100
    const destMaterialId = await resolveDestinationMaterial(
      sourceMaterial,
      params.toBrandId,
      toBrand.name
    )

    pricedLines.push({
      sourceMaterialId: line.sourceMaterialId,
      purchaseQty,
      stockQty,
      unitCost,
      lineCost,
      source: sourceMaterial,
      destMaterialId,
    })
  }

  const costTotal = pricedLines.reduce((sum, l) => sum + l.lineCost, 0)
  const transferNumber = await nextTransferNumber(params.fromBrandId)

  const { data: header, error: headerErr } = await supabase
    .from('material_transfers')
    .insert([
      {
        transfer_number: transferNumber,
        from_brand_id: params.fromBrandId,
        to_brand_id: params.toBrandId,
        transfer_date: params.transferDate,
        status: 'draft',
        cost_amount_total: costTotal,
        notes: params.notes || null,
        created_by: params.createdBy,
      },
    ])
    .select()
    .single()

  if (headerErr) throw headerErr

  const transferId = header.id as string

  for (let i = 0; i < pricedLines.length; i++) {
    const line = pricedLines[i]

    await supabase.from('material_transfer_lines').insert([
      {
        transfer_id: transferId,
        line_no: i + 1,
        source_material_id: line.sourceMaterialId,
        dest_material_id: line.destMaterialId,
        sku: line.source.sku || null,
        description: line.source.material_name,
        quantity: line.purchaseQty,
        unit_cost: line.unitCost,
        line_cost: line.lineCost,
      },
    ])

    const movementDate = params.transferDate
    const refNumber = transferNumber
    const purchaseUnitCost = line.unitCost

    const { error: outErr } = await supabase.from('material_stock_movements').insert({
      material_id: line.sourceMaterialId,
      movement_type: 'out',
      quantity: line.stockQty,
      unit_cost: purchaseUnitCost > 0 ? purchaseUnitCost : null,
      reference_type: 'material_transfer',
      reference_id: transferId,
      reference_number: refNumber,
      notes: `Materials transfer to ${toBrand.name}: ${line.source.material_name}`,
      movement_date: movementDate,
      created_by: params.createdBy,
    })
    if (outErr) throw new Error(`Failed to record source stock movement: ${outErr.message}`)

    const { error: inErr } = await supabase.from('material_stock_movements').insert({
      material_id: line.destMaterialId,
      movement_type: 'in',
      quantity: line.stockQty,
      unit_cost: purchaseUnitCost > 0 ? purchaseUnitCost : null,
      reference_type: 'material_transfer',
      reference_id: transferId,
      reference_number: refNumber,
      notes: `Materials transfer from GFC: ${line.source.material_name}`,
      movement_date: movementDate,
      created_by: params.createdBy,
    })
    if (inErr) throw new Error(`Failed to record destination stock movement: ${inErr.message}`)
  }

  const { data: fullTransfer } = await supabase
    .from('material_transfers')
    .select('*, lines:material_transfer_lines(*)')
    .eq('id', transferId)
    .single()

  const { fromEntryId, toEntryId } = await postMaterialTransferJournals(
    fullTransfer as MaterialTransfer,
    (fullTransfer?.lines || []) as MaterialTransferLine[],
    params.createdBy
  )

  const { data: posted, error: postErr } = await supabase
    .from('material_transfers')
    .update({
      status: 'posted',
      journal_entry_id_from: fromEntryId,
      journal_entry_id_to: toEntryId,
      posted_at: new Date().toISOString(),
      posted_by: params.createdBy,
    })
    .eq('id', transferId)
    .select(
      '*, lines:material_transfer_lines(*), from_brand:brands!material_transfers_from_brand_id_fkey(id, name), to_brand:brands!material_transfers_to_brand_id_fkey(id, name)'
    )
    .single()

  if (postErr) throw postErr
  return posted as MaterialTransfer
}
