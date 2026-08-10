import { supabase } from './supabase'
import type { FactoryOpenedMaterial } from './supabase'
import {
  getBomDisplayUnitLabel,
  stockQtyToBomDisplayQty,
  type RawMaterialUomFields,
} from './raw-material-uom'

export type OpenedMaterialHistoryEntry = {
  id: string
  kind: 'opened' | 'production' | 'adjustment' | 'depleted' | 'discarded'
  at: string
  title: string
  subtitle?: string
  quantity: number | null
  unit: string
}

type BatchUsageRow = {
  id: string
  quantity_used: number
  unit: string
  created_at: string
  batch?: {
    batch_number?: string
    work_date?: string
    units?: number
    status?: string
    started_by?: string | null
    product?: { name?: string; sku?: string | null }
  } | null
}

export async function fetchOpenedMaterialBatchUsage(
  openedMaterialId: string
): Promise<BatchUsageRow[]> {
  const { data, error } = await supabase
    .from('factory_batch_material_usage')
    .select(
      `id, quantity_used, unit, created_at,
      batch:factory_production_batches(
        batch_number, work_date, units, status, started_by,
        product:products(name, sku)
      )`
    )
    .eq('opened_material_id', openedMaterialId)
    .order('created_at', { ascending: false })

  if (error) {
    if (error.message.includes('factory_batch_material_usage')) {
      console.warn('factory_batch_material_usage:', error.message)
      return []
    }
    throw error
  }

  return (data || []) as BatchUsageRow[]
}

export function buildOpenedMaterialHistory(
  row: FactoryOpenedMaterial,
  material: RawMaterialUomFields | undefined,
  batchRows: BatchUsageRow[]
): OpenedMaterialHistoryEntry[] {
  const displayUnit = material ? getBomDisplayUnitLabel(material) : row.unit || '—'
  const toDisplay = (stockQty: number) =>
    material ? stockQtyToBomDisplayQty(stockQty, material) : stockQty

  const openedEntry: OpenedMaterialHistoryEntry = {
    id: `opened-${row.id}`,
    kind: 'opened',
    at: row.opened_at,
    title: 'Package opened',
    subtitle: row.opened_by ? `by ${row.opened_by}` : undefined,
    quantity: toDisplay(row.quantity_opened),
    unit: displayUnit,
  }

  const productionEntries: OpenedMaterialHistoryEntry[] = batchRows.map((usage) => {
    const batch = usage.batch
    const product = batch?.product
    const productLabel = product?.sku
      ? `${product.sku} · ${product.name || 'Product'}`
      : product?.name || 'Production batch'
    const batchLabel = batch?.batch_number ? `Batch ${batch.batch_number}` : 'Production batch'
    const units = Number(batch?.units) || 0
    const subtitleParts = [
      productLabel,
      units > 0 ? `${units} unit${units === 1 ? '' : 's'}` : null,
      batch?.started_by ? `by ${batch.started_by}` : null,
      batch?.status && batch.status !== 'completed' ? batch.status : null,
    ].filter(Boolean)

    return {
      id: usage.id,
      kind: 'production' as const,
      at: usage.created_at,
      title: batchLabel,
      subtitle: subtitleParts.length > 0 ? subtitleParts.join(' · ') : undefined,
      quantity: toDisplay(Number(usage.quantity_used) || 0),
      unit: displayUnit,
    }
  })

  const productionUsedStock = batchRows.reduce(
    (sum, usage) => sum + (Number(usage.quantity_used) || 0),
    0
  )
  const remainingStock = Number(row.quantity_remaining) || 0
  const openedStock = Number(row.quantity_opened) || 0
  const writtenOffStock = Math.max(0, openedStock - remainingStock - productionUsedStock)

  const lifecycleEntries: OpenedMaterialHistoryEntry[] = []

  if (writtenOffStock > 1e-6) {
    lifecycleEntries.push({
      id: `writeoff-${row.id}`,
      kind: row.status === 'discarded' ? 'discarded' : 'adjustment',
      at: row.updated_at || row.opened_at,
      title: row.status === 'discarded' ? 'Discarded' : 'Adjusted / written off',
      subtitle:
        row.status === 'discarded'
          ? 'Remaining stock removed from WIP'
          : 'Remaining quantity corrected',
      quantity: toDisplay(writtenOffStock),
      unit: displayUnit,
    })
  } else if (row.status === 'depleted' && remainingStock <= 1e-6) {
    lifecycleEntries.push({
      id: `depleted-${row.id}`,
      kind: 'depleted',
      at: row.updated_at || row.opened_at,
      title: 'Marked empty',
      subtitle: productionUsedStock > 1e-6 ? 'All remaining used in production' : undefined,
      quantity: null,
      unit: displayUnit,
    })
  } else if (row.status === 'discarded' && remainingStock <= 1e-6 && writtenOffStock <= 1e-6) {
    lifecycleEntries.push({
      id: `discarded-${row.id}`,
      kind: 'discarded',
      at: row.updated_at || row.opened_at,
      title: 'Discarded',
      subtitle: 'Package removed from floor',
      quantity: null,
      unit: displayUnit,
    })
  }

  return [...productionEntries, ...lifecycleEntries, openedEntry].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  )
}
