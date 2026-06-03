import {
  supabase,
  type Product,
  type ProductCycleCount,
  type ProductCycleCountLine,
} from './supabase'
import {
  computeProductAvailableStock,
  type ProductStockFields,
} from './product-stock-level'

export function lineVarianceAvailable(line: ProductCycleCountLine): number | null {
  if (line.counted_available == null || line.counted_available === undefined) return null
  return Number(line.counted_available) - Number(line.system_available)
}

export function formatProductCycleCountQty(
  qty: number,
  unit?: string | null
): string {
  const u = (unit || 'pcs').trim()
  if (!Number.isFinite(qty)) return `— ${u}`
  const formatted = Number.isInteger(qty)
    ? qty.toLocaleString()
    : qty.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return `${formatted} ${u}`
}

export function productAvailableAtCountStart(product: ProductStockFields): number {
  return computeProductAvailableStock(product)
}

/** NULL = main count (all non index-0 categories); string = index-0 category display name. */
export type ProductCycleCountScope = string | null

function applyCategoryScopeFilter<
  Q extends { is: (col: string, val: null) => Q; eq: (col: string, val: string) => Q },
>(query: Q, categoryScope: ProductCycleCountScope): Q {
  if (categoryScope == null) {
    return query.is('category_scope', null)
  }
  return query.eq('category_scope', categoryScope)
}

export function cycleCountScopeLabel(categoryScope: ProductCycleCountScope): string {
  return categoryScope ?? 'Main inventory'
}

export async function fetchInProgressProductCycleCount(
  brandId: string,
  categoryScope: ProductCycleCountScope = null
): Promise<ProductCycleCount | null> {
  let query = supabase
    .from('product_cycle_counts')
    .select('*')
    .eq('brand_id', brandId)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)

  query = applyCategoryScopeFilter(query, categoryScope)

  const { data, error } = await query.maybeSingle()

  if (error) throw error
  return (data as ProductCycleCount) || null
}

export async function fetchProductCycleCountHistory(
  brandId: string,
  categoryScope: ProductCycleCountScope = null,
  limit = 20
): Promise<ProductCycleCount[]> {
  let query = supabase
    .from('product_cycle_counts')
    .select('*')
    .eq('brand_id', brandId)
    .order('count_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  query = applyCategoryScopeFilter(query, categoryScope)

  const { data, error } = await query

  if (error) throw error
  return (data || []) as ProductCycleCount[]
}

export async function fetchProductCycleCountLines(
  cycleCountId: string
): Promise<ProductCycleCountLine[]> {
  const { data, error } = await supabase
    .from('product_cycle_count_lines')
    .select('*, product:products(id, name, sku, unit, category)')
    .eq('cycle_count_id', cycleCountId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []) as ProductCycleCountLine[]
}

export async function startProductCycleCount(options: {
  brandId: string
  products: Product[]
  categoryScope?: ProductCycleCountScope
  countDate?: string
  createdBy: string
  notes?: string
}): Promise<{ count: ProductCycleCount; lines: ProductCycleCountLine[] }> {
  const categoryScope = options.categoryScope ?? null
  const existing = await fetchInProgressProductCycleCount(options.brandId, categoryScope)
  if (existing) {
    const scopeLabel = cycleCountScopeLabel(categoryScope)
    throw new Error(
      `A cycle count is already in progress for ${scopeLabel}. Resume it or cancel it before starting another.`
    )
  }

  const countDate = options.countDate || new Date().toISOString().split('T')[0]

  const { data: countRow, error: countErr } = await supabase
    .from('product_cycle_counts')
    .insert({
      brand_id: options.brandId,
      count_date: countDate,
      status: 'in_progress',
      category_scope: categoryScope,
      notes: options.notes?.trim() || null,
      created_by: options.createdBy,
    })
    .select('*')
    .single()

  if (countErr || !countRow) {
    throw new Error(countErr?.message || 'Failed to create cycle count')
  }

  const linePayload = options.products
    .map((p) => {
      const productId = p.id || p.product_id
      if (!productId) return null
      return {
        cycle_count_id: countRow.id,
        product_id: productId,
        system_available: productAvailableAtCountStart(p),
      }
    })
    .filter((row): row is NonNullable<typeof row> => row != null)

  if (linePayload.length === 0) {
    await supabase.from('product_cycle_counts').delete().eq('id', countRow.id)
    throw new Error('No products to include in this cycle count.')
  }

  const { data: lines, error: linesErr } = await supabase
    .from('product_cycle_count_lines')
    .insert(linePayload)
    .select('*, product:products(id, name, sku, unit, category)')

  if (linesErr) {
    await supabase.from('product_cycle_counts').delete().eq('id', countRow.id)
    throw new Error(linesErr.message)
  }

  return {
    count: countRow as ProductCycleCount,
    lines: (lines || []) as ProductCycleCountLine[],
  }
}

export type ProductCycleCountLineUpdate = {
  id: string
  counted_available: number | null
  notes?: string | null
}

export async function saveProductCycleCountLineDrafts(
  updates: ProductCycleCountLineUpdate[]
): Promise<void> {
  for (const row of updates) {
    const { error } = await supabase
      .from('product_cycle_count_lines')
      .update({
        counted_available: row.counted_available,
        notes: row.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    if (error) throw error
  }
}

export type PostProductCycleCountResult = {
  posted: number
  skipped: number
  zeroVariance: number
}

export async function postProductCycleCount(options: {
  cycleCountId: string
  postedBy: string
}): Promise<PostProductCycleCountResult> {
  const { data: header, error: headerErr } = await supabase
    .from('product_cycle_counts')
    .select('*')
    .eq('id', options.cycleCountId)
    .single()

  if (headerErr || !header) {
    throw new Error(headerErr?.message || 'Cycle count not found')
  }
  if (header.status !== 'in_progress') {
    throw new Error('This cycle count has already been posted or cancelled.')
  }

  const lines = await fetchProductCycleCountLines(options.cycleCountId)

  let posted = 0
  let skipped = 0
  let zeroVariance = 0

  for (const line of lines) {
    if (line.counted_available == null || line.counted_available === undefined) {
      skipped++
      continue
    }

    const variance = lineVarianceAvailable(line)
    if (variance === null) {
      skipped++
      continue
    }

    if (Math.abs(variance) < 0.0001) {
      zeroVariance++
      continue
    }

    const productId = line.product_id
    const productName = line.product?.name || line.product?.product_name || 'Product'

    const { data: productRow, error: prodErr } = await supabase
      .from('products')
      .select('initial_stock, production, released, reserved')
      .eq('id', productId)
      .single()

    if (prodErr || !productRow) {
      throw new Error(`${productName}: ${prodErr?.message || 'Product not found'}`)
    }

    const newInitial = (Number(productRow.initial_stock) || 0) + variance
    const { error: updErr } = await supabase
      .from('products')
      .update({
        initial_stock: newInitial,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)

    if (updErr) {
      throw new Error(`${productName}: ${updErr.message}`)
    }

    const varianceNote = `Cycle count ${header.count_date} — available ${line.system_available} → ${line.counted_available} (initial_stock ${productRow.initial_stock} → ${newInitial})`
    const mergedNotes = [line.notes?.trim(), varianceNote].filter(Boolean).join(' · ')

    const { error: lineUpdErr } = await supabase
      .from('product_cycle_count_lines')
      .update({
        notes: mergedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', line.id)

    if (lineUpdErr) throw new Error(lineUpdErr.message)
    posted++
  }

  const { error: closeErr } = await supabase
    .from('product_cycle_counts')
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

export async function cancelProductCycleCount(cycleCountId: string): Promise<void> {
  const { error } = await supabase
    .from('product_cycle_counts')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', cycleCountId)
    .eq('status', 'in_progress')

  if (error) throw error
}
