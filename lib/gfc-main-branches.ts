import { isFactoryBrand } from './brand-roles'

export type GfcMainBranchKind = 'factory' | 'office' | 'technical'

type LocationWithBrand = {
  name?: string | null
  is_factory_floor?: boolean | null
  brand?: { brand_role?: string; slug?: string; name?: string } | Array<{ brand_role?: string; slug?: string; name?: string }> | null
}

type BrandLike = { brand_role?: string; slug?: string; name?: string }

export function normalizeLocationBrand(
  brand: BrandLike | BrandLike[] | null | undefined
): BrandLike | null {
  if (!brand) return null
  return Array.isArray(brand) ? brand[0] ?? null : brand
}

export function normalizeScheduleLocation<T extends LocationWithBrand>(location: T): T & {
  brand?: BrandLike | null
} {
  return {
    ...location,
    brand: normalizeLocationBrand(location.brand),
  }
}

/** Retail-brand factory / plant / production floors (hidden from company staff schedule). */
export function isRetailFactoryBranch(location: LocationWithBrand | null | undefined): boolean {
  if (!location) return false
  if (isFactoryBrand(normalizeLocationBrand(location.brand))) return false
  if (location.is_factory_floor) return true
  const normalized = (location.name || '').toLowerCase()
  return (
    normalized.includes('factory') ||
    normalized.includes('plant') ||
    normalized.includes('production')
  )
}

/** Legacy DB default before GFC Main used fingerprint attendance for hours. */
export const LEGACY_GFC_SCHEDULE_DEFAULT_HOURS = 11

/** Whether schedule hours were explicitly set in the admin modal (not legacy/default). */
export function gfcMainHasExplicitScheduleHours(
  hours: number | string | null | undefined
): boolean {
  if (hours == null || hours === '') return false
  return Number(hours) !== LEGACY_GFC_SCHEDULE_DEFAULT_HOURS
}

/** Classify a GFC Main location by name (factory, office, technical). */
export function classifyGfcMainBranch(
  locationName: string | undefined | null
): GfcMainBranchKind | null {
  const normalized = (locationName || '').toLowerCase().trim()
  if (!normalized) return null
  if (normalized.includes('technical')) return 'technical'
  if (normalized.includes('office')) return 'office'
  if (
    normalized.includes('factory') ||
    normalized.includes('plant') ||
    normalized.includes('production')
  ) {
    return 'factory'
  }
  return null
}

export function gfcMainBranchLabel(kind: GfcMainBranchKind): string {
  switch (kind) {
    case 'factory':
      return 'Factory'
    case 'office':
      return 'Office'
    case 'technical':
      return 'Technical'
  }
}

/** Factory portal is available to factory and office branches only. */
export function gfcMainBranchHasFactoryAccess(kind: GfcMainBranchKind | null): boolean {
  return kind === 'factory' || kind === 'office'
}

export function isGfcMainLocation(location: LocationWithBrand | null | undefined): boolean {
  if (!location) return false
  return isFactoryBrand(normalizeLocationBrand(location.brand))
}

export function staffHasGfcMainAssignments(locations: LocationWithBrand[]): boolean {
  return locations.some((location) => isGfcMainLocation(location))
}

export function getRetailAssignedLocations<T extends LocationWithBrand>(locations: T[]): T[] {
  return locations.filter((location) => !isGfcMainLocation(location))
}

export function staffMemberIsGfcMain(staff: {
  staff_assignments?: Array<{ location?: LocationWithBrand | null }>
}): boolean {
  return (staff.staff_assignments || []).some((assignment) => isGfcMainLocation(assignment.location))
}

export function staffHasFactoryPortalAssignment(staff: {
  staff_assignments?: Array<{ location?: LocationWithBrand | null }>
}): boolean {
  return (staff.staff_assignments || []).some((assignment) =>
    locationHasFactoryAccessToday(assignment.location ?? {})
  )
}

export function locationHasFactoryAccessToday(location: LocationWithBrand): boolean {
  if (!isGfcMainLocation(location)) return false
  return gfcMainBranchHasFactoryAccess(classifyGfcMainBranch(location.name))
}
