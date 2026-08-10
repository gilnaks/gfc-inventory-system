import { supabase } from './supabase'
import { isActiveSticker } from './production-sticker'
import {
  fetchBatchCostSummary,
  type FactoryBatchCostSummary,
  type FactoryBatchListItem,
} from './factory-batch-production'
import { countProducedForScheduleItem } from './factory-schedule'

async function loadScheduleBrandNames(scheduleIds: string[]) {
  if (!scheduleIds.length) {
    return new Map<string, { quantity_required: number; brand_name?: string }>()
  }

  const { data: scheduleRows } = await supabase
    .from('production_schedules')
    .select('id, quantity_required, for_brand_id')
    .in('id', scheduleIds)

  const forBrandIds = Array.from(
    new Set((scheduleRows || []).map((r) => r.for_brand_id).filter(Boolean))
  ) as string[]

  const { data: forBrands } = forBrandIds.length
    ? await supabase.from('brands').select('id, name').in('id', forBrandIds)
    : { data: [] as { id: string; name: string }[] }

  const forBrandNameById = new Map((forBrands || []).map((b) => [b.id, b.name as string]))

  return new Map(
    (scheduleRows || []).map((r) => [
      r.id as string,
      {
        quantity_required: Number(r.quantity_required) || 0,
        brand_name: r.for_brand_id
          ? forBrandNameById.get(r.for_brand_id as string)
          : undefined,
      },
    ])
  )
}

const FACTORY_BATCH_LIST_SELECT =
  'id, schedule_id, product_id, work_date, batch_number, units, status, started_at, started_by, completed_at, journal_entry_id, intercompany_transfer_id, product:products(name, sku, brands(name))'

function mapFactoryBatchListRow(row: Record<string, unknown>): FactoryBatchListItem {
  const product = row.product as { name?: string; sku?: string; brands?: { name?: string } } | null
  return {
    id: row.id as string,
    schedule_id: row.schedule_id as string,
    product_id: row.product_id as string,
    work_date: row.work_date as string,
    batch_number: row.batch_number as string,
    units: Number(row.units) || 1,
    status: row.status as FactoryBatchListItem['status'],
    started_at: row.started_at as string,
    started_by: (row.started_by as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    journal_entry_id: (row.journal_entry_id as string | null) ?? null,
    product_name: product?.name,
    sku: product?.sku,
    brand_name: product?.brands?.name,
  }
}

export type FactoryBatchHistoryItem = FactoryBatchListItem & {
  quantity_required: number
  scanned_count: number
}

export type FactoryBatchSticker = {
  id: string
  serial_number: string
  manufacture_date: string
  produced_at: string | null
  voided_at: string | null
}

export type FactoryBatchMaterialUsageLine = {
  id: string
  material_name: string
  quantity_used: number
  unit: string
  unit_cost: number
}

export type FactoryBatchDetail = {
  batch: FactoryBatchListItem
  quantity_required: number
  scanned_count: number
  stickers: FactoryBatchSticker[]
  material_usage: FactoryBatchMaterialUsageLine[]
  cost_summary: FactoryBatchCostSummary | null
}

export async function fetchBatchesForDateRange(
  fromDate: string,
  toDate: string,
  options?: { status?: FactoryBatchListItem['status'] | 'all' }
): Promise<FactoryBatchHistoryItem[]> {
  let query = supabase
    .from('factory_production_batches')
    .select(FACTORY_BATCH_LIST_SELECT)
    .gte('work_date', fromDate)
    .lte('work_date', toDate)
    .order('started_at', { ascending: false })
    .limit(200)

  if (options?.status && options.status !== 'all') {
    query = query.eq('status', options.status)
  }

  const { data, error } = await query

  if (error) {
    if (error.message.includes('factory_production_batches')) return []
    throw error
  }

  const batches = (data || []).map((row) => mapFactoryBatchListRow(row as Record<string, unknown>))
  if (!batches.length) return []

  const scheduleIds = Array.from(new Set(batches.map((b) => b.schedule_id)))

  const [scheduleMeta, scanCounts] = await Promise.all([
    loadScheduleBrandNames(scheduleIds),
    Promise.all(
      batches.map(async (b) => ({
        key: `${b.schedule_id}:${b.work_date}`,
        count: await countProducedForScheduleItem(
          { schedule_id: b.schedule_id, product_id: b.product_id },
          b.work_date
        ),
      }))
    ),
  ])

  const scanByKey = new Map(scanCounts.map((s) => [s.key, s.count]))

  return batches.map((b) => {
    const meta = scheduleMeta.get(b.schedule_id)
    return {
      ...b,
      brand_name: meta?.brand_name || b.brand_name,
      quantity_required: meta?.quantity_required ?? 0,
      scanned_count: scanByKey.get(`${b.schedule_id}:${b.work_date}`) ?? 0,
    }
  })
}

export async function fetchBatchDetail(batchId: string): Promise<FactoryBatchDetail | null> {
  const { data: batchRow, error } = await supabase
    .from('factory_production_batches')
    .select(FACTORY_BATCH_LIST_SELECT)
    .eq('id', batchId)
    .maybeSingle()

  if (error || !batchRow) return null

  const batch = mapFactoryBatchListRow(batchRow as Record<string, unknown>)

  const [scheduleMeta, scannedCount, { data: usageRows }, { data: stickerRows }] =
    await Promise.all([
      loadScheduleBrandNames([batch.schedule_id]),
      countProducedForScheduleItem(
        { schedule_id: batch.schedule_id, product_id: batch.product_id },
        batch.work_date
      ),
      supabase
        .from('factory_batch_material_usage')
        .select(
          'id, quantity_used, unit, unit_cost, material:raw_materials(material_name)'
        )
        .eq('batch_id', batchId)
        .order('created_at', { ascending: true }),
      supabase
        .from('production_sticker_logs')
        .select('id, serial_number, manufacture_date, produced_at, voided_at, created_at')
        .eq('schedule_id', batch.schedule_id)
        .eq('product_id', batch.product_id)
        .eq('manufacture_date', batch.work_date)
        .order('created_at', { ascending: true }),
    ])

  const meta = scheduleMeta.get(batch.schedule_id)
  batch.brand_name = meta?.brand_name || batch.brand_name
  const quantityRequired = meta?.quantity_required ?? 0

  const material_usage: FactoryBatchMaterialUsageLine[] = (usageRows || []).map((row) => {
    const mat = row.material as { material_name?: string } | { material_name?: string }[] | null
    const materialName = Array.isArray(mat) ? mat[0]?.material_name : mat?.material_name
    return {
      id: row.id as string,
      material_name: materialName || 'Material',
      quantity_used: Number(row.quantity_used) || 0,
      unit: (row.unit as string) || '—',
      unit_cost: Number(row.unit_cost) || 0,
    }
  })

  const stickers: FactoryBatchSticker[] = (stickerRows || [])
    .filter((row) => isActiveSticker(row) || row.voided_at)
    .map((row) => ({
      id: row.id as string,
      serial_number: (row.serial_number as string) || '—',
      manufacture_date: (row.manufacture_date as string) || batch.work_date,
      produced_at: (row.produced_at as string | null) ?? null,
      voided_at: (row.voided_at as string | null) ?? null,
    }))

  let cost_summary: FactoryBatchCostSummary | null = null
  if (batch.status === 'completed') {
    try {
      cost_summary = await fetchBatchCostSummary(batch.id, batch.product_id, batch.units)
    } catch {
      cost_summary = null
    }
  }

  return {
    batch,
    quantity_required: quantityRequired,
    scanned_count: scannedCount,
    stickers,
    material_usage,
    cost_summary,
  }
}

export function stickerScanState(sticker: FactoryBatchSticker): 'voided' | 'scanned' | 'printed' {
  if (sticker.voided_at) return 'voided'
  if (sticker.produced_at) return 'scanned'
  return 'printed'
}
