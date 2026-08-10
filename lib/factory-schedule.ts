import { supabase } from './supabase'
import { isActiveSticker } from './production-sticker'
import { getPhilippinesDate } from './timezone'
import { isFactoryScheduleAggregateView } from './gfc-production-catalog'

export type FactoryScheduleItem = {
  schedule_id: string
  product_id: string
  product_name: string
  sku?: string
  /** Destination consumer brand (for_brand_id display name). */
  brand_name: string
  for_brand_id?: string
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

type ScheduleRow = {
  id: string
  product_id: string
  quantity_required: number
  batch_number?: string
  notes?: string | null
  for_brand_id?: string | null
}

async function buildScheduleItems(
  scheduleData: ScheduleRow[],
  scheduleDate: string,
  _statusFilter: 'active' | 'draft_or_active'
): Promise<FactoryScheduleItem[]> {
  if (!scheduleData.length) return []

  const pids = scheduleData.map((s) => s.product_id)
  const forBrandIds = Array.from(
    new Set(scheduleData.map((s) => s.for_brand_id).filter(Boolean))
  ) as string[]

  const prodSince = new Date()
  prodSince.setDate(prodSince.getDate() - 2)

  const [{ data: products }, { data: forBrands }, { data: printed }, { data: producedLogs }] =
    await Promise.all([
      supabase.from('products').select('id, name, sku, brand_id, brands(name)').in('id', pids),
      forBrandIds.length
        ? supabase.from('brands').select('id, name').in('id', forBrandIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      supabase
        .from('production_sticker_logs')
        .select('product_id, schedule_id, voided_at')
        .eq('manufacture_date', scheduleDate)
        .is('voided_at', null),
      supabase
        .from('production_sticker_logs')
        .select('product_id, schedule_id, produced_at, voided_at')
        .not('produced_at', 'is', null)
        .is('voided_at', null)
        .gte('produced_at', prodSince.toISOString()),
    ])

  const forBrandMap = new Map((forBrands || []).map((b) => [b.id, b.name]))

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

  const scheduleByProduct = new Map<string, ScheduleRow[]>()
  for (const row of scheduleData) {
    const list = scheduleByProduct.get(row.product_id)
    if (list) list.push(row)
    else scheduleByProduct.set(row.product_id, [row])
  }

  const printedCount = new Map<string, number>()
  const producedCount = new Map<string, number>()

  for (const sticker of printed || []) {
    if (!isActiveSticker(sticker)) continue
    const productId = sticker.product_id as string
    const stickerScheduleId = sticker.schedule_id as string | null | undefined
    const targets = stickerScheduleId
      ? scheduleData.filter((row) => row.id === stickerScheduleId && row.product_id === productId)
      : scheduleByProduct.get(productId) || []
    for (const row of targets) {
      printedCount.set(row.id, (printedCount.get(row.id) || 0) + 1)
    }
  }

  for (const sticker of producedLogs || []) {
    if (!isActiveSticker(sticker)) continue
    if (!sticker.produced_at || !producedOnScheduleDate(sticker.produced_at as string, scheduleDate)) {
      continue
    }
    const productId = sticker.product_id as string
    const stickerScheduleId = sticker.schedule_id as string | null | undefined
    const targets = stickerScheduleId
      ? scheduleData.filter((row) => row.id === stickerScheduleId && row.product_id === productId)
      : scheduleByProduct.get(productId) || []
    for (const row of targets) {
      if (
        matchesScheduleRow(
          { product_id: productId, schedule_id: stickerScheduleId },
          { schedule_id: row.id, product_id: row.product_id }
        )
      ) {
        producedCount.set(row.id, (producedCount.get(row.id) || 0) + 1)
      }
    }
  }

  return scheduleData
    .map((row) => {
      const p = prodMap.get(row.product_id)
      const destName = row.for_brand_id
        ? forBrandMap.get(row.for_brand_id) || '—'
        : p?.brand_name || '—'
      return {
        schedule_id: row.id,
        product_id: row.product_id,
        product_name: p?.name || '—',
        sku: p?.sku,
        brand_name: destName,
        for_brand_id: row.for_brand_id || undefined,
        batch_number: row.batch_number || defaultBatchNumber(scheduleDate, p?.sku),
        notes: row.notes?.trim() || undefined,
        quantity_required: row.quantity_required,
        printed: printedCount.get(row.id) ?? 0,
        produced: producedCount.get(row.id) ?? 0,
      }
    })
    .sort((a, b) => {
      const byBrand = a.brand_name.localeCompare(b.brand_name, undefined, { sensitivity: 'base' })
      if (byBrand !== 0) return byBrand
      return a.product_name.localeCompare(b.product_name, undefined, { sensitivity: 'base' })
    })
}

export async function loadTodayFactorySchedule(
  scheduleDate = getPhilippinesDate()
): Promise<FactoryScheduleItem[]> {
  const { data: scheduleData } = await supabase
    .from('production_schedules')
    .select('id, product_id, quantity_required, batch_number, notes, for_brand_id')
    .eq('schedule_date', scheduleDate)
    .eq('status', 'active')

  return buildScheduleItems((scheduleData || []) as ScheduleRow[], scheduleDate, 'active')
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

/** Scanned finished-goods count for a schedule line (matches factory floor / schedule UI). */
export async function countProducedForScheduleItem(
  item: Pick<FactoryScheduleItem, 'schedule_id' | 'product_id'>,
  scheduleDate: string
): Promise<number> {
  const serials = await loadScannedSerialsForScheduleItem(item, scheduleDate)
  return serials.length
}

/** GFC schedule lines for a destination consumer brand on a given date (or all brands on GFC Main). */
export async function loadGfcScheduleForBrand(
  forBrandId: string,
  scheduleDate: string,
  factoryBrandId?: string
): Promise<FactoryScheduleItem[]> {
  const { data: gfcBrand } = await supabase.from('brands').select('id').eq('slug', 'gfc').maybeSingle()
  if (!gfcBrand?.id) return []

  const aggregateView = isFactoryScheduleAggregateView(forBrandId, factoryBrandId ?? gfcBrand.id)

  let productIds: string[] = []
  if (aggregateView) {
    const { data: retailBrands } = await supabase
      .from('brands')
      .select('id')
      .eq('brand_role', 'retail')
    const retailIds = (retailBrands || []).map((r) => r.id as string)
    if (!retailIds.length) return []
    const { data: retailProducts } = await supabase
      .from('products')
      .select('id')
      .in('brand_id', retailIds)
    productIds = (retailProducts || []).map((r) => r.id as string)
  } else {
    const { data: retailProducts } = await supabase
      .from('products')
      .select('id')
      .eq('brand_id', forBrandId)
    productIds = (retailProducts || []).map((r) => r.id as string)
  }

  if (!productIds.length) return []

  let scheduleQuery = supabase
    .from('production_schedules')
    .select('id, product_id, quantity_required, batch_number, notes, for_brand_id')
    .eq('schedule_date', scheduleDate)
    .in('product_id', productIds)
    .in('status', ['draft', 'active'])

  if (!aggregateView) {
    scheduleQuery = scheduleQuery.eq('for_brand_id', forBrandId)
  }

  const { data: scheduleData, error } = await scheduleQuery

  if (error) {
    console.warn('production_schedules:', error.message)
    return []
  }

  return buildScheduleItems((scheduleData || []) as ScheduleRow[], scheduleDate, 'draft_or_active')
}

/** @deprecated Use loadGfcScheduleForBrand */
export async function loadBrandProductionSchedule(
  brandId: string,
  scheduleDate: string
): Promise<FactoryScheduleItem[]> {
  return loadGfcScheduleForBrand(brandId, scheduleDate)
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
