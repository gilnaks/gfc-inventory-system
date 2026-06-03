export type BrandColorKey = 'green' | 'red' | 'yellow' | 'gray'

export function getBrandColorKey(brandName: string | undefined): BrandColorKey {
  if (!brandName) return 'gray'

  const brand = brandName.toLowerCase()
  if (brand.includes('mychoice')) return 'green'
  if (brand.includes('gelato')) return 'red'
  if (brand.includes('sorbetes')) return 'yellow'
  return 'gray'
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
      return 'bg-gray-100 text-gray-800 border-gray-200'
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
        idleRing: 'border-slate-400 shadow-[0_0_20px_rgba(100,116,139,0.15)]',
        idleBg: 'bg-slate-50',
        idleIcon: 'text-slate-600',
        processingRing: 'border-slate-300',
        processingSpinner: 'border-slate-200 border-t-slate-600',
        progressBar: 'bg-slate-600',
        remainingText: 'text-slate-700',
      }
  }
}
