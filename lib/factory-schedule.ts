import { supabase } from './supabase'
import { isActiveSticker } from './production-sticker'
import { getPhilippinesDate } from './timezone'

export type FactoryScheduleItem = {
  schedule_id: string
  product_id: string
  product_name: string
  sku?: string
  brand_name: string
  batch_number: string
  notes?: string
  quantity_required: number
  printed: number
  produced: number
}

export type FactoryScannedSerial = {
  id: string
  serial_number: string
  produced_at: string
}

function productBrandName(
  brands: { name: string } | { name: string }[] | null | undefined
): string {
  if (!brands) return '—'
  const brand = Array.isArray(brands) ? brands[0] : brands
  return brand?.name || '—'
}

function matchesScheduleRow(
  row: { product_id: string; schedule_id?: string | null },
  item: { schedule_id: string; product_id: string }
) {
  return (
    row.product_id === item.product_id &&
    (row.schedule_id === item.schedule_id || !row.schedule_id)
  )
}

function producedOnScheduleDate(producedAt: string, scheduleDate: string) {
  const ph = new Date(producedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  return ph === scheduleDate
}

function defaultBatchNumber(scheduleDate: string, sku?: string): string {
  const skuPart = (sku || '').replace(/-/g, '')
  return `BATCH-${scheduleDate.replace(/-/g, '')}${skuPart ? '-' + skuPart : ''}`
}

export async function loadTodayFactorySchedule(
  scheduleDate = getPhilippinesDate()
): Promise<FactoryScheduleItem[]> {
  const { data: scheduleData } = await supabase
    .from('production_schedules')
    .select('id, product_id, quantity_required, batch_number, notes')
    .eq('schedule_date', scheduleDate)
    .eq('status', 'active')

  if (!scheduleData?.length) return []

  const pids = scheduleData.map((s) => s.product_id)
  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku, brands(name)')
    .in('id', pids)

  const prodMap = new Map(
    (products || []).map((p) => [
      p.id as string,
      {
        name: p.name as string,
        sku: p.sku as string | undefined,
        brand_name: productBrandName(
          p.brands as { name: string } | { name: string }[] | null | undefined
        ),
      },
    ])
  )

  const { data: printed } = await supabase
    .from('production_sticker_logs')
    .select('product_id, schedule_id, voided_at')
    .eq('manufacture_date', scheduleDate)
    .is('voided_at', null)

  const prodSince = new Date()
  prodSince.setDate(prodSince.getDate() - 2)
  const { data: producedLogs } = await supabase
    .from('production_sticker_logs')
    .select('product_id, schedule_id, produced_at, voided_at')
    .not('produced_at', 'is', null)
    .is('voided_at', null)
    .gte('produced_at', prodSince.toISOString())

  return scheduleData
    .map((row) => {
      const p = prodMap.get(row.product_id)
      const printedN =
        printed?.filter(
          (x) =>
            isActiveSticker(x) &&
            x.product_id === row.product_id &&
            (x.schedule_id === row.id || !x.schedule_id)
        ).length ?? 0
      const producedN =
        producedLogs?.filter(
          (x) =>
            isActiveSticker(x) &&
            matchesScheduleRow(
              { product_id: x.product_id, schedule_id: x.schedule_id },
              { schedule_id: row.id, product_id: row.product_id }
            ) && producedOnScheduleDate(x.produced_at as string, scheduleDate)
        ).length ?? 0
      return {
        schedule_id: row.id,
        product_id: row.product_id,
        product_name: p?.name || '—',
        sku: p?.sku,
        brand_name: p?.brand_name || '—',
        batch_number:
          (row as { batch_number?: string }).batch_number ||
          defaultBatchNumber(scheduleDate, p?.sku),
        notes: (row as { notes?: string | null }).notes?.trim() || undefined,
        quantity_required: row.quantity_required,
        printed: printedN,
        produced: producedN,
      }
    })
    .sort((a, b) => {
      const byBrand = a.brand_name.localeCompare(b.brand_name, undefined, { sensitivity: 'base' })
      if (byBrand !== 0) return byBrand
      return a.product_name.localeCompare(b.product_name, undefined, { sensitivity: 'base' })
    })
}

export function groupScheduleByBrand(
  items: FactoryScheduleItem[]
): { brandName: string; items: FactoryScheduleItem[] }[] {
  const map = new Map<string, FactoryScheduleItem[]>()
  for (const item of items) {
    const key = item.brand_name
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map(([brandName, groupItems]) => ({ brandName, items: groupItems }))
}

export async function loadScannedSerialsForScheduleItem(
  item: Pick<FactoryScheduleItem, 'schedule_id' | 'product_id'>,
  scheduleDate = getPhilippinesDate()
): Promise<FactoryScannedSerial[]> {
  const prodSince = new Date()
  prodSince.setDate(prodSince.getDate() - 2)

  const { data, error } = await supabase
    .from('production_sticker_logs')
    .select('id, serial_number, produced_at, schedule_id, product_id, voided_at')
    .eq('product_id', item.product_id)
    .not('produced_at', 'is', null)
    .is('voided_at', null)
    .gte('produced_at', prodSince.toISOString())
    .order('produced_at', { ascending: false })

  if (error || !data) return []

  return data
    .filter(
      (row) =>
        isActiveSticker(row) &&
        matchesScheduleRow(row, item) &&
        row.produced_at &&
        producedOnScheduleDate(row.produced_at, scheduleDate)
    )
    .map((row) => ({
      id: row.id,
      serial_number: row.serial_number,
      produced_at: row.produced_at as string,
    }))
}

/** Saved production schedule rows for one brand on a given date (no sticker data). */
export async function loadBrandProductionSchedule(
  brandId: string,
  scheduleDate: string
): Promise<FactoryScheduleItem[]> {
  const { data: products } = await supabase
    .from('products')
    .select('id')
    .eq('brand_id', brandId)

  const productIds = (products || []).map((p: { id: string }) => p.id)
  if (productIds.length === 0) return []

  const { data: scheduleData, error } = await supabase
    .from('production_schedules')
    .select('id, product_id, quantity_required, batch_number, notes')
    .eq('schedule_date', scheduleDate)
    .in('status', ['draft', 'active'])
    .in('product_id', productIds)

  if (error) {
    console.warn('production_schedules:', error.message)
    return []
  }
  if (!scheduleData?.length) return []

  const scheduledIds = scheduleData.map((s) => s.product_id)
  const { data: productRows } = await supabase
    .from('products')
    .select('id, name, sku, brands(name)')
    .in('id', scheduledIds)
    .eq('brand_id', brandId)

  const prodMap = new Map(
    (productRows || []).map((p) => [
      p.id as string,
      {
        name: p.name as string,
        sku: p.sku as string | undefined,
        brand_name: productBrandName(
          p.brands as { name: string } | { name: string }[] | null | undefined
        ),
      },
    ])
  )

  const { data: printed } = await supabase
    .from('production_sticker_logs')
    .select('product_id, schedule_id, voided_at')
    .eq('manufacture_date', scheduleDate)
    .is('voided_at', null)

  const prodSince = new Date()
  prodSince.setDate(prodSince.getDate() - 2)
  const { data: producedLogs } = await supabase
    .from('production_sticker_logs')
    .select('product_id, schedule_id, produced_at, voided_at')
    .not('produced_at', 'is', null)
    .is('voided_at', null)
    .gte('produced_at', prodSince.toISOString())

  const rows = scheduleData
    .map((row) => {
      const p = prodMap.get(row.product_id)
      if (!p) return null
      const printedN =
        printed?.filter(
          (x) =>
            isActiveSticker(x) &&
            x.product_id === row.product_id &&
            (x.schedule_id === row.id || !x.schedule_id)
        ).length ?? 0
      const producedN =
        producedLogs?.filter(
          (x) =>
            isActiveSticker(x) &&
            matchesScheduleRow(
              { product_id: x.product_id, schedule_id: x.schedule_id },
              { schedule_id: row.id, product_id: row.product_id }
            ) && producedOnScheduleDate(x.produced_at as string, scheduleDate)
        ).length ?? 0
      const item: FactoryScheduleItem = {
        schedule_id: row.id,
        product_id: row.product_id,
        product_name: p.name,
        sku: p.sku,
        brand_name: p.brand_name,
        batch_number:
          (row as { batch_number?: string }).batch_number ||
          defaultBatchNumber(scheduleDate, p.sku),
        notes: (row as { notes?: string | null }).notes?.trim() || undefined,
        quantity_required: row.quantity_required,
        printed: printedN,
        produced: producedN,
      }
      return item
    })
    .filter((row): row is FactoryScheduleItem => row !== null)

  return rows.sort((a, b) =>
    a.product_name.localeCompare(b.product_name, undefined, { sensitivity: 'base' })
  )
}

export function isScheduleItemScanComplete(
  item: Pick<FactoryScheduleItem, 'produced' | 'quantity_required'>
): boolean {
  return item.quantity_required > 0 && item.produced >= item.quantity_required
}

export function pickScheduleForProduct(
  items: FactoryScheduleItem[],
  productId: string,
  scheduleId?: string | null
): FactoryScheduleItem | undefined {
  if (scheduleId) {
    const exact = items.find((i) => i.schedule_id === scheduleId)
    if (exact) return exact
  }
  return items.find((i) => i.product_id === productId)
}
