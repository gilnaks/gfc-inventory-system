import { supabase } from './supabase'
import type { Brand } from './supabase'
import { getFactoryBrand, resolveBooksBrandId, resolveFranchiseBrandId } from './brand-roles'

let cachedBooksBrandId: string | null = null

/** Load GFC Main brand id (cached for the session). */
export async function getBooksBrandId(): Promise<string> {
  if (cachedBooksBrandId) return cachedBooksBrandId
  const { data, error } = await supabase
    .from('brands')
    .select('id, name, slug, brand_role')
    .or('slug.eq.gfc,brand_role.eq.factory')
    .limit(5)
  if (error) throw error
  const brands = (data || []) as Brand[]
  const id = resolveBooksBrandId(brands)
  cachedBooksBrandId = id
  return id
}

/** Clear cache (tests / brand seed refresh). */
export function clearBooksBrandIdCache() {
  cachedBooksBrandId = null
}

export { resolveBooksBrandId, resolveFranchiseBrandId, getFactoryBrand }
