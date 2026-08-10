import { supabase, type Brand, type Product } from './supabase'
import { FACTORY_BRAND_SLUG, getFactoryBrand } from './brand-roles'

export function getFactoryBrandIdFromList(brands: Brand[]): string | undefined {
  return getFactoryBrand(brands)?.id
}

/** GFC Main tab — show schedules / catalog across all destination brands. */
export function isFactoryScheduleAggregateView(
  forBrandId: string | undefined,
  factoryBrandId: string | undefined
): boolean {
  return Boolean(forBrandId && factoryBrandId && forBrandId === factoryBrandId)
}

/** Every retail finished-good SKU across all consumer brands. */
export async function loadGfcCatalogProducts(): Promise<Product[]> {
  const { data: retailBrands, error: brandErr } = await supabase
    .from('brands')
    .select('id')
    .eq('brand_role', 'retail')

  if (brandErr) throw brandErr
  const ids = (retailBrands || []).map((r) => r.id as string)
  if (!ids.length) return []

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .in('brand_id', ids)
    .order('name')
  if (error) throw error
  return (data || []) as Product[]
}

/** Retail-direct model has no separate plant-only FG catalog. */
export async function loadGfcPlantOnlyProducts(): Promise<Product[]> {
  return []
}

export async function loadGfcProducts(forBrandId?: string): Promise<Product[]> {
  if (!forBrandId) return loadGfcCatalogProducts()

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('brand_id', forBrandId)
    .order('name')

  if (error) throw error
  return (data || []) as Product[]
}

export async function resolveRetailProductId(
  gfcProductId: string,
  forBrandId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('products')
    .select('id, brand_id')
    .eq('id', gfcProductId)
    .maybeSingle()
  if (!data) return null
  return (data.brand_id as string) === forBrandId ? (data.id as string) : null
}

export async function resolveGfcProductIdForRetail(
  retailProductId: string
): Promise<string | null> {
  return retailProductId || null
}

export type GfcProductDestination = {
  gfc_product_id: string
  retail_brand_id: string
  retail_brand_name: string
  /** Original retail product name (no brand prefix). */
  retail_product_name: string
}

/** Consumer-facing label for GFC catalog SKUs (no brand prefix in dropdowns). */
export function gfcProductDisplayName(
  product: Pick<Product, 'id' | 'name'>,
  destinations: Map<string, GfcProductDestination>
): string {
  return destinations.get(product.id)?.retail_product_name?.trim() || product.name?.trim() || ''
}

/** Maps each GFC catalog product to its destination consumer brand. */
export async function loadGfcProductDestinations(): Promise<Map<string, GfcProductDestination>> {
  const { data: retailBrands, error: brandErr } = await supabase
    .from('brands')
    .select('id, name')
    .eq('brand_role', 'retail')

  if (brandErr) {
    console.warn('brands:', brandErr.message)
    return new Map()
  }
  const brandNameById = new Map((retailBrands || []).map((b) => [b.id as string, b.name as string]))
  const retailBrandIds = Array.from(brandNameById.keys())
  if (!retailBrandIds.length) return new Map()

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, brand_id')
    .in('brand_id', retailBrandIds)
  if (error) {
    console.warn('products:', error.message)
    return new Map()
  }

  const map = new Map<string, GfcProductDestination>()
  for (const row of products || []) {
    const productId = row.id as string
    const retailBrandId = row.brand_id as string
    map.set(productId, {
      gfc_product_id: productId,
      retail_brand_id: retailBrandId,
      retail_brand_name: brandNameById.get(retailBrandId) || 'Unassigned',
      retail_product_name: ((row.name as string) || '').trim(),
    })
  }
  return map
}

export async function loadRetailBrands(): Promise<Brand[]> {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('brand_role', 'retail')
    .neq('slug', FACTORY_BRAND_SLUG)
    .order('name')

  if (error) throw error
  return (data || []) as Brand[]
}
