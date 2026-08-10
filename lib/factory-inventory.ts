export type FactoryInventoryKind = 'ingredients' | 'packaging' | 'supplies'

export const FACTORY_INVENTORY_KINDS: FactoryInventoryKind[] = [
  'ingredients',
  'packaging',
  'supplies',
]

/** Default procurement categories (always offered in add/edit material). */
export const DEFAULT_RAW_MATERIAL_CATEGORIES = [
  'Ingredients',
  'Packaging',
  'Supplies',
  'Components',
] as const

export const FACTORY_INVENTORY_KIND_LABELS: Record<FactoryInventoryKind, string> = {
  ingredients: 'Ingredients',
  packaging: 'Packaging',
  supplies: 'Supplies',
}

export function isFactoryInventoryKind(value: unknown): value is FactoryInventoryKind {
  return value === 'ingredients' || value === 'packaging' || value === 'supplies'
}

/** True when raw material is explicitly assigned to a factory floor tab (not procurement-only). */
export function isMaterialLinkedToFactoryFloor(material: {
  factory_inventory_kind?: string | null
}): boolean {
  return isFactoryInventoryKind(material.factory_inventory_kind)
}

export function factoryKindFromCategory(category: string): FactoryInventoryKind | null {
  const normalized = category.trim().toLowerCase()
  if (normalized === 'ingredients') return 'ingredients'
  if (normalized === 'packaging') return 'packaging'
  if (normalized === 'supplies') return 'supplies'
  return null
}

export function categoryFromFactoryKind(kind: FactoryInventoryKind): string {
  return FACTORY_INVENTORY_KIND_LABELS[kind]
}

export function resolveFactoryInventoryKind(material: {
  factory_inventory_kind?: string | null
  category?: string | null
}): FactoryInventoryKind {
  if (isFactoryInventoryKind(material.factory_inventory_kind)) {
    return material.factory_inventory_kind
  }
  return factoryKindFromCategory(material.category || '') || 'ingredients'
}

export function materialMatchesFactoryInventoryKind(
  material: { factory_inventory_kind?: string | null; category?: string | null },
  kind: FactoryInventoryKind
): boolean {
  return resolveFactoryInventoryKind(material) === kind
}

export function mergeRawMaterialCategoryOptions(existing: string[]): string[] {
  const merged = new Set<string>([
    ...DEFAULT_RAW_MATERIAL_CATEGORIES,
    ...existing.map((c) => c.trim()).filter(Boolean),
  ])
  return Array.from(merged).sort((a, b) => {
    const defaultOrder = DEFAULT_RAW_MATERIAL_CATEGORIES as readonly string[]
    const ai = defaultOrder.indexOf(a)
    const bi = defaultOrder.indexOf(b)
    if (ai >= 0 && bi >= 0) return ai - bi
    if (ai >= 0) return -1
    if (bi >= 0) return 1
    return a.localeCompare(b)
  })
}

export const FACTORY_INVENTORY_META: Record<
  FactoryInventoryKind,
  {
    title: string
    labelPlaceholder: string
  }
> = {
  ingredients: {
    title: 'Ingredients',
    labelPlaceholder: 'e.g. Mango flavoring bottle #2',
  },
  packaging: {
    title: 'Packaging',
    labelPlaceholder: 'e.g. 16oz cup sleeve #4',
  },
  supplies: {
    title: 'Supplies',
    labelPlaceholder: 'e.g. Nitrile gloves box B',
  },
}
