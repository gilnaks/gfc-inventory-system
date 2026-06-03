'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  computeProductAvailableStock,
  computeProductFinalStock,
  formatAvailableForDisplay,
  getProductStockLevel,
  getStockLevelRowClass,
  getStockLevelTextClass,
  type ProductStockFields,
} from '../../lib/product-stock-level'

type PickerProduct = ProductStockFields & {
  id?: string
  sku?: string | null
  name?: string | null
}

function SimulationArrow() {
  return (
    <span className="text-gray-400 shrink-0" aria-hidden>
      →
    </span>
  )
}

export function ScheduleAddStockSimulation({
  product,
  batches = 0,
  scheduleQty = 0,
}: {
  product: ProductStockFields | null | undefined
  /** Batch count from the add form stepper. */
  batches?: number
  /** Production quantity after yield (units added to final / available). */
  scheduleQty?: number
}) {
  if (!product) return null

  const batchCount = Math.max(0, batches)
  const prodQty = Math.max(0, scheduleQty)
  const simulatedFinal = computeProductFinalStock(product) + prodQty
  const simulatedAvailable = computeProductAvailableStock(product) + prodQty
  const min = product.minimum_stock ?? 0
  const level = getProductStockLevel(simulatedAvailable, min)

  return (
    <p className="text-[10px] tabular-nums text-gray-600 flex flex-wrap items-center gap-x-1 gap-y-0.5">
      <span>
        Batch <span className="font-medium text-gray-900">{batchCount}</span>
      </span>
      <SimulationArrow />
      <span>
        Prod qty <span className="font-medium text-gray-900">{prodQty}</span>
      </span>
      <SimulationArrow />
      <span>
        Final <span className="font-medium text-purple-700">{simulatedFinal}</span>
      </span>
      <SimulationArrow />
      <span className={getStockLevelTextClass(level)}>
        Available {formatAvailableForDisplay(simulatedAvailable, min)}
      </span>
    </p>
  )
}

export function StockLevelProductPicker({
  value,
  onChange,
  productsByCategory,
  scheduleQty = 0,
  disabled = false,
  disabledProductIds,
  disabledProductTitle = 'Not available',
  disabledProductReasonById,
  emptyLabel = 'No eligible products',
  placeholder = 'Select product...',
}: {
  value: string
  onChange: (productId: string) => void
  productsByCategory: { category: string; products: PickerProduct[] }[]
  /** Units to add in this schedule line — used for stock level coloring in the trigger. */
  scheduleQty?: number
  disabled?: boolean
  disabledProductIds?: ReadonlySet<string>
  disabledProductTitle?: string
  /** Per-product tooltip/label when disabled (overrides disabledProductTitle). */
  disabledProductReasonById?: Readonly<Record<string, string>>
  emptyLabel?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const flatProducts = useMemo(
    () => productsByCategory.flatMap((g) => g.products),
    [productsByCategory]
  )

  const selected = flatProducts.find((p) => p.id === value)

  const addQty = Math.max(0, scheduleQty)
  const currentFinal = selected ? computeProductFinalStock(selected) : 0
  const currentAvailable = selected ? computeProductAvailableStock(selected) : 0
  const simulatedFinal = currentFinal + addQty
  const simulatedAvailable = currentAvailable + addQty
  const selectedMin = selected?.minimum_stock ?? 0
  const selectedLevel = selected
    ? getProductStockLevel(simulatedAvailable, selectedMin)
    : null

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const isEmpty = flatProducts.length === 0

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled || isEmpty}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60"
      >
        <span
          className={`min-w-0 truncate ${
            selectedLevel ? getStockLevelTextClass(selectedLevel) : 'text-gray-500'
          }`}
        >
          {isEmpty
            ? emptyLabel
            : selected
              ? `${selected.sku || '-'} - ${selected.name}`
              : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && !isEmpty ? (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {productsByCategory.map(({ category, products }) => (
            <div key={category}>
              <div className="sticky top-0 z-10 bg-white px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 border-b border-gray-200">
                {category}
              </div>
              <ul>
                {products.map((p) => {
                  if (!p.id) return null
                  const isProductDisabled = disabledProductIds?.has(p.id) ?? false
                  const disabledReason =
                    (p.id && disabledProductReasonById?.[p.id]) || disabledProductTitle
                  const available = computeProductAvailableStock(p)
                  const min = p.minimum_stock ?? 0
                  const level = getProductStockLevel(available, min)
                  const isSelected = value === p.id
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={isProductDisabled}
                        title={isProductDisabled ? disabledProductTitle : undefined}
                        onClick={() => {
                          if (isProductDisabled) return
                          onChange(p.id!)
                          setOpen(false)
                        }}
                        className={`flex w-full flex-col items-start px-2 py-1.5 text-left text-sm ${
                          isProductDisabled
                            ? 'cursor-not-allowed bg-white'
                            : getStockLevelRowClass(level, isSelected)
                        }`}
                      >
                        <span
                          className={`truncate w-full ${
                            isProductDisabled ? 'text-gray-400' : getStockLevelTextClass(level)
                          }`}
                        >
                          {p.sku || '-'} - {p.name}
                          {isProductDisabled ? (
                            <span className="font-normal"> · {disabledReason}</span>
                          ) : null}
                        </span>
                        <span
                          className={`text-[10px] tabular-nums ${
                            isProductDisabled ? 'text-gray-400' : getStockLevelTextClass(level)
                          }`}
                        >
                          Available {formatAvailableForDisplay(available, min)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
