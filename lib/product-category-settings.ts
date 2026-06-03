export type CategoryPortalSettings = {
  show_on_order_portal: boolean
  remote_store: boolean
  /** Units of quantity_required per 1 production batch (default 1). */
  yield_per_batch: number
}

export const DEFAULT_CATEGORY_PORTAL_SETTINGS: CategoryPortalSettings = {
  show_on_order_portal: true,
  remote_store: false,
  yield_per_batch: 1,
}

/** DB `category_name` / lookup key (empty string = uncategorized). */
export function productCategoryStorageKey(category: string | null | undefined): string {
  const trimmed = category?.trim()
  return trimmed || ''
}

export function productCategoryDisplayName(category: string | null | undefined): string {
  return productCategoryStorageKey(category) || 'Uncategorized'
}

/** Same key used when saving product_category_sort rows from dashboard display name. */
export function categorySortKey(displayName: string): string {
  return displayName === 'Uncategorized' ? '' : displayName
}

/** Category sort index 0 = supplies/consumables (no BOM; link to materials inventory). */
export function isConsumableSupplyCategory(sortIndex: number | undefined): boolean {
  return sortIndex === 0
}

/** Category sort index 100 = intermediate products used as BOM components (product inventory). */
export const BOM_COMPONENT_CATEGORY_SORT_INDEX = 100

/** Shown in Product Inventory category edit (sort index field). */
export const CATEGORY_SORT_INDEX_HELP_LINES = [
  '1–99 — products',
  '100 — components',
  '0 — supplies / consumables',
] as const

export function isBomComponentProductCategory(sortIndex: number | undefined): boolean {
  return sortIndex === BOM_COMPONENT_CATEGORY_SORT_INDEX
}

export function isProductBomComponent(
  product: { category?: string | null },
  sortOrdersByDisplayName: Record<string, number>
): boolean {
  const display = productCategoryDisplayName(product.category)
  return isBomComponentProductCategory(sortOrdersByDisplayName[display])
}

export function isProductConsumableSupply(
  product: { category?: string | null },
  sortOrdersByDisplayName: Record<string, number>
): boolean {
  const display = productCategoryDisplayName(product.category)
  return isConsumableSupplyCategory(sortOrdersByDisplayName[display])
}

export function parseCategoryPortalRow(row: {
  category_name?: string | null
  show_on_order_portal?: boolean | null
  remote_store?: boolean | null
  yield_per_batch?: number | string | null
}): CategoryPortalSettings {
  const rawYield = Number(row.yield_per_batch)
  return {
    show_on_order_portal: row.show_on_order_portal ?? true,
    remote_store: row.remote_store ?? false,
    yield_per_batch: rawYield > 0 ? rawYield : 1,
  }
}

export function getCategoryYieldPerBatch(
  productCategory: string | null | undefined,
  settingsByDisplayName: Record<string, CategoryPortalSettings>
): number {
  const settings = getCategoryPortalSettings(productCategory, settingsByDisplayName)
  return settings.yield_per_batch > 0 ? settings.yield_per_batch : 1
}

/** Schedule stores quantity_required in units; UI may enter whole batches. */
export function batchesToScheduleQty(batches: number, yieldPerBatch: number): number {
  const y = yieldPerBatch > 0 ? yieldPerBatch : 1
  const b = Number.isFinite(batches) ? batches : 0
  return Math.max(0, Math.round(b * y))
}

export function scheduleQtyToBatches(qty: number, yieldPerBatch: number): number {
  const y = yieldPerBatch > 0 ? yieldPerBatch : 1
  if (y === 1) return qty
  return qty / y
}

export function buildCategoryPortalMap(
  rows: Array<{
    category_name?: string | null
    show_on_order_portal?: boolean | null
    remote_store?: boolean | null
    yield_per_batch?: number | string | null
  }> | null
): Record<string, CategoryPortalSettings> {
  const map: Record<string, CategoryPortalSettings> = {}
  for (const row of rows || []) {
    map[productCategoryStorageKey(row.category_name)] = parseCategoryPortalRow(row)
  }
  return map
}

export function getCategoryPortalSettings(
  productCategory: string | null | undefined,
  settingsByKey: Record<string, CategoryPortalSettings>
): CategoryPortalSettings {
  return (
    settingsByKey[productCategoryStorageKey(productCategory)] ??
    DEFAULT_CATEGORY_PORTAL_SETTINGS
  )
}

/**
 * Order portal visibility:
 * - Hidden when show_on_order_portal is false.
 * - Remote branches only see categories marked remote_store.
 * - Non-remote branches see all portal-visible categories (including remote-only).
 */
export function isProductVisibleOnOrderPortal(
  productCategory: string | null | undefined,
  settingsByKey: Record<string, CategoryPortalSettings>,
  isRemoteBranch: boolean
): boolean {
  const settings = getCategoryPortalSettings(productCategory, settingsByKey)
  if (!settings.show_on_order_portal) return false
  if (isRemoteBranch) return settings.remote_store
  return true
}

export function filterProductsForOrderPortal<
  T extends { category?: string | null },
>(products: T[], settingsByKey: Record<string, CategoryPortalSettings>, isRemoteBranch: boolean): T[] {
  return products.filter((p) =>
    isProductVisibleOnOrderPortal(p.category, settingsByKey, isRemoteBranch)
  )
}
