import type { Brand } from './supabase'

export type BrandRole = 'factory' | 'retail'

export const FACTORY_BRAND_SLUG = 'gfc'

/** Accepts partial brand rows (joins often omit required Brand fields). */
export type BrandRoleFields = {
  brand_role?: string | null
  slug?: string | null
}

export function brandRole(brand: BrandRoleFields): BrandRole {
  if (brand.brand_role === 'factory' || brand.slug === FACTORY_BRAND_SLUG) return 'factory'
  return 'retail'
}

export function isFactoryBrand(brand: BrandRoleFields | null | undefined): boolean {
  if (!brand) return false
  return brandRole(brand) === 'factory'
}

export function isRetailBrand(brand: BrandRoleFields | null | undefined): boolean {
  return !isFactoryBrand(brand)
}

export function getFactoryBrand(brands: Brand[]): Brand | undefined {
  return brands.find((b) => isFactoryBrand(b))
}

export function getRetailBrands(brands: Brand[]): Brand[] {
  return brands.filter((b) => isRetailBrand(b))
}

export function brandRoleLabel(brand: BrandRoleFields): string {
  return isFactoryBrand(brand) ? 'Factory' : 'Retail'
}

export function brandSelectorLabel(brand: Brand): string {
  return brand.name
}

/** Default dashboard brand: GFC Main (factory), else first brand. */
export function getDefaultBrand(brands: Brand[]): Brand | undefined {
  return getFactoryBrand(brands) ?? brands[0]
}

export function groupBrandsForSelector(brands: Brand[]): {
  headquarters: Brand[]
  franchise: Brand[]
} {
  const sortByName = (a: Brand, b: Brand) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

  return {
    headquarters: brands.filter((b) => isFactoryBrand(b)).sort(sortByName),
    franchise: brands.filter((b) => isRetailBrand(b)).sort(sortByName),
  }
}

/** Factory (headquarters) brands first, then franchise brands by name. */
export function sortBrandsForSelector(brands: Brand[]): Brand[] {
  const { headquarters, franchise } = groupBrandsForSelector(brands)
  return [...headquarters, ...franchise]
}

/** Plant materials and POs must be created under the factory brand. */
export function canManagePlantMaterials(brand: Pick<Brand, 'brand_role' | 'slug'> | null | undefined): boolean {
  return isFactoryBrand(brand)
}

/** Factory / production module is only available on GFC Main. */
export function canAccessFactoryModule(brand: Pick<Brand, 'brand_role' | 'slug'> | null | undefined): boolean {
  return isFactoryBrand(brand)
}

/** Accounting / Payroll / Procurement live on GFC Main books only. */
export function canAccessAccountingModule(brand: Pick<Brand, 'brand_role' | 'slug'> | null | undefined): boolean {
  return isFactoryBrand(brand)
}

export function canAccessPayrollModule(brand: Pick<Brand, 'brand_role' | 'slug'> | null | undefined): boolean {
  return isFactoryBrand(brand)
}

export function canAccessProcurementModule(brand: Pick<Brand, 'brand_role' | 'slug'> | null | undefined): boolean {
  return isFactoryBrand(brand)
}

/**
 * Legal-entity ledger brand (GFC Main). Throws if the factory brand is missing.
 * Franchise brands remain operational; their journals post here with franchise_brand_id.
 */
export function resolveBooksBrandId(brands: Brand[]): string {
  const factory = getFactoryBrand(brands)
  if (!factory?.id) {
    throw new Error('GFC Main (factory brand) is required for accounting books')
  }
  return factory.id
}

/** Franchise tag for a journal: retail source brand, or null for pure HQ/plant. */
export function resolveFranchiseBrandId(
  sourceBrandId: string | null | undefined,
  booksBrandId: string
): string | null {
  if (!sourceBrandId || sourceBrandId === booksBrandId) return null
  return sourceBrandId
}

/** Legacy retail-brand plant materials: visible but not editable for new activity. */
export function isLegacyPlantMaterial(
  material: { brand_id?: string; factory_inventory_kind?: string | null; is_active?: boolean },
  factoryBrandId: string | undefined
): boolean {
  if (!factoryBrandId || !material.factory_inventory_kind) return false
  return material.brand_id !== factoryBrandId
}
