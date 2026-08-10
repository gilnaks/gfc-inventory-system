export type BrandColorKey = 'green' | 'red' | 'yellow' | 'gray'

export function getBrandColorKey(brandName: string | undefined): BrandColorKey {
  if (!brandName) return 'gray'

  const brand = brandName.toLowerCase()
  if (brand.includes('mychoice')) return 'green'
  if (brand.includes('gelato')) return 'red'
  if (brand.includes('sorbetes')) return 'yellow'
  return 'gray'
}

/** Theme slug for category headers (green / red / yellow / blue). */
export function getBrandCategoryHeaderTheme(brandName: string | undefined): string {
  switch (getBrandColorKey(brandName)) {
    case 'green':
      return 'green'
    case 'red':
      return 'red'
    case 'yellow':
      return 'yellow'
    default:
      return 'blue'
  }
}

/** Active tab button classes for consumer-brand menus */
export function getBrandMenuTabClasses(brandName: string | undefined, active: boolean): string {
  if (!active) {
    return 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
  }
  switch (getBrandColorKey(brandName)) {
    case 'green':
      return 'bg-green-100 text-green-800 border-green-300'
    case 'red':
      return 'bg-red-100 text-red-800 border-red-300'
    case 'yellow':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    default:
      return 'bg-blue-100 text-blue-800 border-blue-300'
  }
}

export type BrandHighlightClasses = {
  row: string
  icon: string
  text: string
  accent: string
}

/** Highlight row / badge accents keyed to consumer brand (e.g. staff assignment "today"). */
export function getBrandHighlightClasses(brandName: string | undefined): BrandHighlightClasses {
  switch (getBrandColorKey(brandName)) {
    case 'green':
      return {
        row: 'bg-green-100 border border-green-300',
        icon: 'text-green-600',
        text: 'text-green-800 font-medium',
        accent: 'text-green-600 font-semibold',
      }
    case 'red':
      return {
        row: 'bg-red-100 border border-red-300',
        icon: 'text-red-600',
        text: 'text-red-800 font-medium',
        accent: 'text-red-600 font-semibold',
      }
    case 'yellow':
      return {
        row: 'bg-yellow-100 border border-yellow-300',
        icon: 'text-yellow-600',
        text: 'text-yellow-800 font-medium',
        accent: 'text-yellow-600 font-semibold',
      }
    default:
      return {
        row: 'bg-blue-100 border border-blue-300',
        icon: 'text-blue-600',
        text: 'text-blue-800 font-medium',
        accent: 'text-blue-600 font-semibold',
      }
  }
}

/** Icon text color keyed to consumer brand (location / franchise badges). */
export function getBrandIconColorClass(brandName: string | undefined): string {
  return getBrandHighlightClasses(brandName).icon
}

/** Pill / badge classes for brand labels */
export function getBrandTagClasses(brandName: string | undefined): string {
  switch (getBrandColorKey(brandName)) {
    case 'green':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'red':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'yellow':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    default:
      return 'bg-blue-100 text-blue-800 border-blue-200'
  }
}

/** Short franchise codes used in journals (GF / MC / MS). */
export type FranchiseJournalTag = 'GF' | 'MC' | 'MS' | 'HQ'

export function getFranchiseJournalTag(brand: {
  slug?: string | null
  name?: string | null
  brand_role?: string | null
} | null | undefined): FranchiseJournalTag | null {
  if (!brand) return null
  const slug = (brand.slug || '').toLowerCase()
  const name = (brand.name || '').toLowerCase()
  if (slug === 'gfc' || brand.brand_role === 'factory') return 'HQ'
  if (slug.includes('gelato') || name.includes('gelato')) return 'GF'
  if (slug.includes('mychoice') || name.includes('mychoice')) return 'MC'
  if (slug.includes('sorbetes') || name.includes('sorbetes')) return 'MS'
  return null
}

export function getFranchiseJournalTagClasses(tag: FranchiseJournalTag | null | undefined): string {
  switch (tag) {
    case 'GF':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'MC':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'MS':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'HQ':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

export function getFranchiseJournalTagTitle(tag: FranchiseJournalTag | null | undefined): string {
  switch (tag) {
    case 'GF':
      return 'Gelatofilipino'
    case 'MC':
      return 'MyChoice'
    case 'MS':
      return 'Mang Sorbetes'
    case 'HQ':
      return 'GFC / HQ'
    default:
      return ''
  }
}

export type BrandScanTheme = {
  idleRing: string
  idleBg: string
  idleIcon: string
  processingRing: string
  processingSpinner: string
  progressBar: string
  remainingText: string
}

/** Scan circle, progress bar, and related accents on factory scan screen */
export function getBrandScanTheme(brandName: string | undefined): BrandScanTheme {
  switch (getBrandColorKey(brandName)) {
    case 'green':
      return {
        idleRing: 'border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.22)]',
        idleBg: 'bg-green-50',
        idleIcon: 'text-green-600',
        processingRing: 'border-green-300',
        processingSpinner: 'border-green-200 border-t-green-600',
        progressBar: 'bg-green-500',
        remainingText: 'text-green-700',
      }
    case 'red':
      return {
        idleRing: 'border-red-400 shadow-[0_0_20px_rgba(248,113,113,0.22)]',
        idleBg: 'bg-red-50',
        idleIcon: 'text-red-600',
        processingRing: 'border-red-300',
        processingSpinner: 'border-red-200 border-t-red-600',
        progressBar: 'bg-red-500',
        remainingText: 'text-red-700',
      }
    case 'yellow':
      return {
        idleRing: 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.28)]',
        idleBg: 'bg-yellow-50',
        idleIcon: 'text-yellow-700',
        processingRing: 'border-yellow-300',
        processingSpinner: 'border-yellow-200 border-t-yellow-600',
        progressBar: 'bg-yellow-500',
        remainingText: 'text-yellow-800',
      }
    default:
      return {
        idleRing: 'border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.22)]',
        idleBg: 'bg-blue-50',
        idleIcon: 'text-blue-600',
        processingRing: 'border-blue-300',
        processingSpinner: 'border-blue-200 border-t-blue-600',
        progressBar: 'bg-blue-500',
        remainingText: 'text-blue-700',
      }
  }
}

export type BrandInventoryPanelTheme = {
  panel: string
  headerBorder: string
  icon: string
  statBorder: string
  scannedStat: string
  productionStat: string
  printedStat: string
  tableHeaderBorder: string
  tableDivide: string
  rowScanned: string
  rowProduction: string
}

/** Scanned FG inventory panel in production schedule */
export function getBrandInventoryPanelTheme(
  brandName: string | undefined
): BrandInventoryPanelTheme {
  switch (getBrandColorKey(brandName)) {
    case 'green':
      return {
        panel: 'border-green-200 bg-green-50/60',
        headerBorder: 'border-green-200/80',
        icon: 'text-green-700',
        statBorder: 'border-green-100',
        scannedStat: 'text-green-700',
        productionStat: 'text-green-800',
        printedStat: 'text-green-700',
        tableHeaderBorder: 'border-green-200/60',
        tableDivide: 'divide-green-100/80',
        rowScanned: 'text-green-700 font-medium',
        rowProduction: 'text-green-800 font-semibold',
      }
    case 'red':
      return {
        panel: 'border-red-200 bg-red-50/60',
        headerBorder: 'border-red-200/80',
        icon: 'text-red-700',
        statBorder: 'border-red-100',
        scannedStat: 'text-red-700',
        productionStat: 'text-red-800',
        printedStat: 'text-red-700',
        tableHeaderBorder: 'border-red-200/60',
        tableDivide: 'divide-red-100/80',
        rowScanned: 'text-red-700 font-medium',
        rowProduction: 'text-red-800 font-semibold',
      }
    case 'yellow':
      return {
        panel: 'border-yellow-200 bg-yellow-50/60',
        headerBorder: 'border-yellow-200/80',
        icon: 'text-yellow-800',
        statBorder: 'border-yellow-100',
        scannedStat: 'text-yellow-800',
        productionStat: 'text-yellow-900',
        printedStat: 'text-yellow-800',
        tableHeaderBorder: 'border-yellow-200/60',
        tableDivide: 'divide-yellow-100/80',
        rowScanned: 'text-yellow-800 font-medium',
        rowProduction: 'text-yellow-900 font-semibold',
      }
    default:
      return {
        panel: 'border-blue-200 bg-blue-50/60',
        headerBorder: 'border-blue-200/80',
        icon: 'text-blue-700',
        statBorder: 'border-blue-100',
        scannedStat: 'text-blue-700',
        productionStat: 'text-blue-800',
        printedStat: 'text-blue-700',
        tableHeaderBorder: 'border-blue-200/60',
        tableDivide: 'divide-blue-100/80',
        rowScanned: 'text-blue-700 font-medium',
        rowProduction: 'text-blue-800 font-semibold',
      }
  }
}
