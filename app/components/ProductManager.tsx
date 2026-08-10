'use client'
import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode, type FocusEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { supabase, Product, Brand } from '../../lib/supabase'
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Package,
  Eye,
  EyeOff,
  FileText,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardCheck,
  Info,
} from 'lucide-react'
import { ProductsCycleCountPanel } from './ProductsCycleCountPanel'
import type { ProductCycleCountScope } from '../../lib/product-cycle-count'
import { ProductBomModal } from './ProductBomModal'
import { Modal } from './Modal'
import { ProductMaterialLinkModal } from './ProductMaterialLinkModal'
import { ProductMaterialReceiveModal } from './ProductMaterialReceiveModal'
import { ProductComponentExportModal } from './ProductComponentExportModal'
import { getPhilippinesDate } from '../../lib/timezone'
import {
  getAvailableStockTextClass,
  isAvailableCritical,
} from '../../lib/product-stock-level'
import {
  loadProductStockByBranch,
  type BranchQty,
  type ProductStockByBranch,
} from '../../lib/product-stock-by-branch'
import { isDashboardRole, isDeveloperRole } from '../../lib/dashboard-roles'
import { useAdminPasswordConfirm } from '../hooks/useAdminPasswordConfirm'
import {
  categorySortKey,
  DEFAULT_CATEGORY_PORTAL_SETTINGS,
  parseCategoryPortalRow,
  productCategoryDisplayName,
  type CategoryPortalSettings,
  isProductConsumableSupply,
  isProductBomComponent,
  isBomComponentProductCategory,
  isConsumableSupplyCategory,
  usesCategoryScopedCycleCount,
  CATEGORY_SORT_INDEX_HELP_LINES,
} from '../../lib/product-category-settings'
import {
  deleteLinkedComponentMaterials,
  ensureBomComponentMaterial,
} from '../../lib/product-bom-component'
import { isFactoryBrand } from '../../lib/brand-roles'
import { loadGfcProductDestinations } from '../../lib/gfc-production-catalog'

interface ProductManagerProps {
  selectedBrand: Brand | null
  theme?: string
  /** When true, hides production controls, add-product entry points, and row actions (dashboard guest). */
  guestMode?: boolean
  currentUsername?: string
  onNavigateToPurchasing?: () => void
}

/** Lower rank = earlier in the list. Index 0 is last (before Uncategorized). */
function categorySortRank(displayName: string, sortIndex: number | undefined): number {
  if (displayName === 'Uncategorized') return 1_000_000_000
  if (sortIndex === 0) return 900_000_000
  if (sortIndex !== undefined && sortIndex > 0) return sortIndex
  return 500_000_000
}

function categoryHeaderThemeClasses(
  theme: string,
  sortIndex: number | undefined
): { bar: string; title: string; editBtn: string; badge: string } {
  if (sortIndex === 0) {
    return {
      bar: 'bg-gray-100 border-gray-200 hover:bg-gray-50',
      title: 'text-gray-800',
      editBtn: 'text-gray-600 hover:bg-gray-200',
      badge: 'text-gray-600',
    }
  }
  const dark = isBomComponentProductCategory(sortIndex)
  if (theme === 'green') {
    return dark
      ? {
          bar: 'bg-green-200 border-green-300 hover:bg-green-100',
          title: 'text-green-950',
          editBtn: 'text-green-800 hover:bg-green-300',
          badge: 'text-green-800',
        }
      : {
          bar: 'bg-green-100 border-green-200 hover:bg-green-50',
          title: 'text-green-900',
          editBtn: 'text-green-700 hover:bg-green-200',
          badge: 'text-green-700',
        }
  }
  if (theme === 'red') {
    return dark
      ? {
          bar: 'bg-red-200 border-red-300 hover:bg-red-100',
          title: 'text-red-950',
          editBtn: 'text-red-800 hover:bg-red-300',
          badge: 'text-red-800',
        }
      : {
          bar: 'bg-red-100 border-red-200 hover:bg-red-50',
          title: 'text-red-900',
          editBtn: 'text-red-700 hover:bg-red-200',
          badge: 'text-red-700',
        }
  }
  if (theme === 'yellow') {
    return dark
      ? {
          bar: 'bg-yellow-200 border-yellow-300 hover:bg-yellow-100',
          title: 'text-yellow-950',
          editBtn: 'text-yellow-800 hover:bg-yellow-300',
          badge: 'text-yellow-800',
        }
      : {
          bar: 'bg-yellow-100 border-yellow-200 hover:bg-yellow-50',
          title: 'text-yellow-900',
          editBtn: 'text-yellow-700 hover:bg-yellow-200',
          badge: 'text-yellow-700',
        }
  }
  return dark
    ? {
        bar: 'bg-blue-200 border-blue-300 hover:bg-blue-100',
        title: 'text-blue-950',
        editBtn: 'text-blue-800 hover:bg-blue-300',
        badge: 'text-blue-800',
      }
    : {
        bar: 'bg-blue-100 border-blue-200 hover:bg-blue-50',
        title: 'text-blue-900',
        editBtn: 'text-blue-700 hover:bg-blue-200',
        badge: 'text-blue-700',
      }
}

type ProductCategoryGroup = {
  category: string
  sortIndex: number | undefined
  products: Product[]
}

function gfcInventoryDisplayName(
  gfcName: string | undefined,
  brandName: string | undefined,
  retailName: string | undefined
): string {
  if (retailName?.trim()) return retailName.trim()
  const name = gfcName?.trim() || ''
  if (brandName && name.startsWith(`${brandName} — `)) {
    return name.slice(brandName.length + 3)
  }
  return name
}

function groupProductsByCategory(
  items: Product[],
  categorySortOrders: Record<string, number>
): ProductCategoryGroup[] {
  const grouped = items.reduce(
    (acc, product) => {
      const category = productCategoryDisplayName(product.category)
      if (!acc[category]) acc[category] = []
      acc[category].push(product)
      return acc
    },
    {} as Record<string, Product[]>
  )

  return Object.keys(grouped)
    .sort((a, b) => {
      const rankA = categorySortRank(a, categorySortOrders[a])
      const rankB = categorySortRank(b, categorySortOrders[b])
      if (rankA !== rankB) return rankA - rankB
      return a.localeCompare(b)
    })
    .map((category) => ({
      category,
      sortIndex: categorySortOrders[category],
      products: grouped[category],
    }))
}

function isNewCategoryName(
  raw: string,
  existingCategories: string[],
  sortOrders: Record<string, number>
): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return false
  const display = productCategoryDisplayName(trimmed)
  if (existingCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return false
  if (sortOrders[display] !== undefined) return false
  return true
}

type ProductTableSkeletonColumn =
  | {
      width: string
      headerWidth: string
      cell: { kind: 'text'; width: string }
    }
  | {
      width: string
      headerWidth: string
      cell: { kind: 'actions'; buttonCount: number }
    }

const PRODUCT_NAME_SKELETON_WIDTHS = [
  'max-w-[7rem]',
  'max-w-[9rem]',
  'max-w-[5.5rem]',
  'max-w-[8rem]',
  'max-w-[6rem]',
  'max-w-[9.5rem]',
  'max-w-[5rem]',
  'max-w-[7.5rem]',
  'max-w-[8.5rem]',
  'max-w-[6.5rem]',
] as const

const PRODUCT_TABLE_SKELETON_COLUMNS: ProductTableSkeletonColumn[] = [
  {
    width: '18%',
    headerWidth: 'w-28',
    cell: { kind: 'text', width: 'w-full max-w-[9rem]' },
  },
  {
    width: '12%',
    headerWidth: 'w-10',
    cell: { kind: 'text', width: 'w-full max-w-[5.5rem]' },
  },
  {
    width: '8%',
    headerWidth: 'w-8',
    cell: { kind: 'text', width: 'w-full max-w-[2.75rem]' },
  },
  {
    width: '8%',
    headerWidth: 'w-10',
    cell: { kind: 'text', width: 'w-full max-w-[3.25rem]' },
  },
  {
    width: '8%',
    headerWidth: 'w-14',
    cell: { kind: 'text', width: 'w-full max-w-[2rem]' },
  },
  {
    width: '7%',
    headerWidth: 'w-8',
    cell: { kind: 'text', width: 'w-full max-w-[2rem]' },
  },
  {
    width: '7%',
    headerWidth: 'w-6',
    cell: { kind: 'text', width: 'w-full max-w-[2rem]' },
  },
  {
    width: '8%',
    headerWidth: 'w-16',
    cell: { kind: 'text', width: 'w-full max-w-[2rem]' },
  },
  {
    width: '7%',
    headerWidth: 'w-6',
    cell: { kind: 'text', width: 'w-full max-w-[2rem]' },
  },
  {
    width: '17%',
    headerWidth: 'w-14',
    cell: { kind: 'text', width: 'w-full max-w-[2rem]' },
  },
]

const PRODUCT_TABLE_ACTIONS_SKELETON_COLUMN: ProductTableSkeletonColumn = {
  width: '13%',
  headerWidth: 'w-14',
  cell: { kind: 'actions', buttonCount: 3 },
}

function productTableSkeletonColumns(guestMode: boolean) {
  if (guestMode) return PRODUCT_TABLE_SKELETON_COLUMNS

  const adminColumns = PRODUCT_TABLE_SKELETON_COLUMNS.map((col) => ({ ...col }))
  adminColumns[0] = { ...adminColumns[0], width: '16%' }
  adminColumns[1] = { ...adminColumns[1], width: '10%' }
  adminColumns[9] = { ...adminColumns[9], width: '8%' }
  return [...adminColumns, PRODUCT_TABLE_ACTIONS_SKELETON_COLUMN]
}

function ProductInventoryTableSkeleton({
  guestMode,
  rows = 10,
}: {
  guestMode: boolean
  rows?: number
}) {
  const columns = productTableSkeletonColumns(guestMode)

  return (
    <table className="w-full table-fixed divide-y divide-gray-200">
      <colgroup>
        {columns.map((col, index) => (
          <col key={`col-${index}`} style={{ width: col.width }} />
        ))}
      </colgroup>
      <thead className="bg-gray-50">
        <tr>
          {columns.map((col, index) => (
            <th
              key={`header-${index}`}
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              <div className={`h-3 rounded ${col.headerWidth} max-w-full bg-gray-200 animate-pulse`} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 bg-white">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <tr key={rowIndex}>
            {columns.map((col, cellIndex) => (
              <td key={cellIndex} className="px-6 py-2 h-10 whitespace-nowrap">
                {col.cell.kind === 'actions' ? (
                  <div className="flex items-center gap-2">
                    {Array.from({ length: col.cell.buttonCount }).map((_, buttonIndex) => (
                      <div
                        key={buttonIndex}
                        className="h-6 w-6 shrink-0 rounded bg-gray-200 animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    className={`h-5 rounded bg-gray-200 animate-pulse ${
                      cellIndex === 0
                        ? `w-full ${PRODUCT_NAME_SKELETON_WIDTHS[rowIndex % PRODUCT_NAME_SKELETON_WIDTHS.length]}`
                        : col.cell.width
                    }`}
                  />
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function categoryHeaderSkeletonClasses(theme: string) {
  const headerTheme = categoryHeaderThemeClasses(theme, 1)
  const pulseColor =
    theme === 'green'
      ? 'bg-green-300'
      : theme === 'red'
        ? 'bg-red-300'
        : theme === 'yellow'
          ? 'bg-yellow-300'
          : 'bg-blue-300'

  return { bar: headerTheme.bar, pulseColor }
}

function BranchQtyHoverTooltip({
  title,
  rows,
  emptyLabel,
  children,
  className = '',
}: {
  title: string
  rows: BranchQty[]
  emptyLabel?: string
  children: ReactNode
  className?: string
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)

  const showTooltip = (e: FocusEvent<HTMLElement> | ReactMouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top })
  }

  return (
    <>
      <span
        className={`inline-flex cursor-help ${className}`}
        onMouseEnter={showTooltip}
        onMouseLeave={() => setTooltip(null)}
        onFocus={showTooltip}
        onBlur={() => setTooltip(null)}
        tabIndex={0}
      >
        {children}
      </span>
      {tooltip &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed z-[9999] pointer-events-none -translate-x-1/2 -translate-y-full rounded-md bg-gray-900 px-2.5 py-2 text-xs text-white shadow-lg max-w-xs"
            style={{ left: tooltip.x, top: tooltip.y - 6 }}
            role="tooltip"
          >
            <p className="font-semibold mb-1">{title}</p>
            {rows.length === 0 ? (
              <p className="text-gray-300">{emptyLabel || 'No open orders by branch'}</p>
            ) : (
              <ul className="space-y-0.5">
                {rows.map((row) => (
                  <li key={row.locationId} className="flex justify-between gap-4 tabular-nums">
                    <span className="text-gray-200 truncate">{row.locationName}</span>
                    <span className="font-medium shrink-0">{row.quantity.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body
        )}
    </>
  )
}

const EMPTY_STOCK_BY_BRANCH: ProductStockByBranch = {
  byProduct: {},
  releasedTotals: [],
  reservedTotals: [],
}

export function ProductManager({
  selectedBrand,
  theme = 'blue',
  guestMode = false,
  currentUsername = '',
  onNavigateToPurchasing,
}: ProductManagerProps) {
  const { requestAdminPassword, AdminPasswordModal } = useAdminPasswordConfirm()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    category: '',
    unit: 'pcs',
    price: 0,
    initial_stock: 0,
    production: 0,
    released: 0,
    reserved: 0
  })
  const [categories, setCategories] = useState<string[]>([])
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [fetchTimeout, setFetchTimeout] = useState<NodeJS.Timeout | null>(null)
  const [updateTimeout, setUpdateTimeout] = useState<NodeJS.Timeout | null>(null)
  const [productionInputMode, setProductionInputMode] = useState(false)
  const [productionValues, setProductionValues] = useState<{[productId: string]: number}>({})
  const [savingProduction, setSavingProduction] = useState(false)
  const [showProductionReports, setShowProductionReports] = useState(false)
  const [productionReports, setProductionReports] = useState<any[]>([])
  const [loadingReports, setLoadingReports] = useState(false)
  const [selectedReport, setSelectedReport] = useState<any | null>(null)
  const [deletingItem, setDeletingItem] = useState<string | null>(null)
  const [bomProduct, setBomProduct] = useState<Product | null>(null)
  /** Ignore product realtime refetches briefly after BOM modal closes (trailing bom_* updates). */
  const suppressProductsRealtimeUntilRef = useRef(0)
  const bomRealtimeSuppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [materialLinkProduct, setMaterialLinkProduct] = useState<Product | null>(null)
  const [receiveProduct, setReceiveProduct] = useState<Product | null>(null)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [editingCategoryIndex, setEditingCategoryIndex] = useState('')
  const [categorySortOrders, setCategorySortOrders] = useState<Record<string, number>>({})
  const [categoryPortalSettings, setCategoryPortalSettings] = useState<
    Record<string, CategoryPortalSettings>
  >({})
  const [editingCategoryShowOnOrder, setEditingCategoryShowOnOrder] = useState(true)
  const [editingCategoryRemoteStore, setEditingCategoryRemoteStore] = useState(false)
  const [categoryMinStockEdits, setCategoryMinStockEdits] = useState<Record<string, number>>({})
  const [savingCategory, setSavingCategory] = useState(false)
  const [exportComponentProduct, setExportComponentProduct] = useState<Product | null>(null)
  const [cycleCountPanel, setCycleCountPanel] = useState<{
    products: Product[]
    categoryScope: ProductCycleCountScope
    scopeTitle: string
    scopeDescription: string
    groupByCategory: boolean
  } | null>(null)
  const [stockByBranch, setStockByBranch] = useState<ProductStockByBranch>(EMPTY_STOCK_BY_BRANCH)
  /** Developer can edit all product fields; others only name + price. */
  const [fullProductEdit, setFullProductEdit] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const role = localStorage.getItem('dashboard_role')
    setFullProductEdit(isDashboardRole(role) && isDeveloperRole(role))
  }, [])
  const [newCategorySortIndex, setNewCategorySortIndex] = useState('')
  const [newCategoryShowOnOrder, setNewCategoryShowOnOrder] = useState(true)
  const [newCategoryRemoteStore, setNewCategoryRemoteStore] = useState(false)
  const [addProductPrice, setAddProductPrice] = useState('')
  const [addProductInitialStock, setAddProductInitialStock] = useState('')
  const isGfcInventory = isFactoryBrand(selectedBrand)

  const resetAddProductForm = useCallback(() => {
    setNewProduct({
      name: '',
      sku: '',
      category: '',
      unit: 'pcs',
      price: 0,
      initial_stock: 0,
      production: 0,
      released: 0,
      reserved: 0,
    })
    setAddProductPrice('')
    setAddProductInitialStock('')
    setNewCategorySortIndex('')
    setNewCategoryShowOnOrder(true)
    setNewCategoryRemoteStore(false)
    setShowCategoryDropdown(false)
  }, [])

  const isAddingNewCategory = useMemo(
    () => isNewCategoryName(newProduct.category, categories, categorySortOrders),
    [newProduct.category, categories, categorySortOrders]
  )

  useEffect(() => {
    if (guestMode) {
      setEditingProduct(null)
      setProductionInputMode(false)
      setProductionValues({})
      setShowAddForm(false)
      setEditingCategory(null)
      setEditingCategoryName('')
      setEditingCategoryIndex('')
      setCategoryMinStockEdits({})
      setEditingCategoryShowOnOrder(true)
      setEditingCategoryRemoteStore(false)
    }
  }, [guestMode])

  useEffect(() => {
    if (selectedBrand) {
      // Clear any existing timeout
      if (fetchTimeout) {
        clearTimeout(fetchTimeout)
      }
      
      // Set a new timeout to debounce the request
      const timeout = setTimeout(() => {
        fetchProducts()
      }, 100) // 100ms debounce
      
      setFetchTimeout(timeout)
    }
    
    // Cleanup timeout on unmount or dependency change
    return () => {
      if (fetchTimeout) {
        clearTimeout(fetchTimeout)
      }
      if (updateTimeout) {
        clearTimeout(updateTimeout)
      }
    }
  }, [selectedBrand])

  // Realtime subscription for products changes
  useEffect(() => {
    if (!selectedBrand) return

    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'products',
          filter: `brand_id=eq.${selectedBrand.id}`
        },
        (payload) => {
          console.log('Products realtime update:', payload)

          const modalBlocksRefetch =
            editingProduct ||
            bomProduct ||
            materialLinkProduct ||
            receiveProduct ||
            exportComponentProduct
          const bomRealtimeSuppressed =
            Date.now() < suppressProductsRealtimeUntilRef.current

          // Skip refetch while editing or a product-inventory modal is open (e.g. BOM
          // quantity basis saves bom_* columns and would otherwise reload the whole list).
          if (!modalBlocksRefetch && !bomRealtimeSuppressed) {
            fetchProducts()
          } else {
            console.log('Skipping realtime refetch - product inventory modal or inline edit active')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [
    selectedBrand,
    editingProduct,
    bomProduct,
    materialLinkProduct,
    receiveProduct,
    exportComponentProduct,
  ])

  useEffect(() => {
    // Extract unique categories from products
    const uniqueCategories = Array.from(new Set(products
      .map(p => p.category)
      .filter(cat => cat && cat.trim() !== '')
    )).sort()
    setCategories(uniqueCategories)
  }, [products])

  const closeBomModal = useCallback(() => {
    setBomProduct(null)
    suppressProductsRealtimeUntilRef.current = Date.now() + 3000
    if (bomRealtimeSuppressTimerRef.current) {
      clearTimeout(bomRealtimeSuppressTimerRef.current)
    }
    bomRealtimeSuppressTimerRef.current = setTimeout(() => {
      suppressProductsRealtimeUntilRef.current = 0
      bomRealtimeSuppressTimerRef.current = null
    }, 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (bomRealtimeSuppressTimerRef.current) {
        clearTimeout(bomRealtimeSuppressTimerRef.current)
      }
    }
  }, [])

  const fetchCategorySortOrders = async (brandId: string) => {
    try {
      const { data, error } = await supabase
        .from('product_category_sort')
        .select('category_name, sort_index, show_on_order_portal, remote_store, yield_per_batch')
        .eq('brand_id', brandId)

      if (error) {
        console.warn('product_category_sort:', error.message)
        setCategorySortOrders({})
        setCategoryPortalSettings({})
        return
      }

      const orders: Record<string, number> = {}
      const portal: Record<string, CategoryPortalSettings> = {}
      for (const row of data || []) {
        const display = productCategoryDisplayName(row.category_name)
        orders[display] = row.sort_index
        portal[display] = parseCategoryPortalRow(row)
      }
      setCategorySortOrders(orders)
      setCategoryPortalSettings(portal)
    } catch (error) {
      console.error('Error fetching category sort:', error)
      setCategorySortOrders({})
    }
  }

  const startEditingCategory = (category: string) => {
    setEditingCategory(category)
    setEditingCategoryName(category === 'Uncategorized' ? '' : category)
    const index = categorySortOrders[category]
    setEditingCategoryIndex(index !== undefined ? String(index) : '')
    const edits: Record<string, number> = {}
    for (const p of products) {
      if (productCategoryDisplayName(p.category) !== category) continue
      const id = p.product_id || p.id
      if (id) edits[id] = p.minimum_stock ?? 0
    }
    setCategoryMinStockEdits(edits)
    const portal = categoryPortalSettings[category] ?? DEFAULT_CATEGORY_PORTAL_SETTINGS
    setEditingCategoryShowOnOrder(portal.show_on_order_portal)
    setEditingCategoryRemoteStore(portal.remote_store)
  }

  const cancelEditingCategory = () => {
    setEditingCategory(null)
    setEditingCategoryName('')
    setEditingCategoryIndex('')
    setCategoryMinStockEdits({})
    setEditingCategoryShowOnOrder(true)
    setEditingCategoryRemoteStore(false)
  }

  const handleSaveCategory = async (
    oldCategory: string,
    categoryProducts: Product[]
  ) => {
    if (!selectedBrand || savingCategory) return

    const trimmed = editingCategoryName.trim()
    const newCategoryValue = trimmed || null
    const newDisplay = trimmed || 'Uncategorized'
    const nameChanged = newDisplay !== oldCategory

    const indexTrimmed = editingCategoryIndex.trim()
    let newSortIndex: number | null = null
    if (indexTrimmed !== '') {
      const parsed = parseInt(indexTrimmed, 10)
      if (Number.isNaN(parsed)) {
        alert('Sort index must be a whole number.')
        return
      }
      newSortIndex = parsed
    }

    const storedIndex = categorySortOrders[oldCategory]
    const indexChanged = newSortIndex !== (storedIndex ?? null)

    const minStockChanged = categoryProducts.some((p) => {
      const id = p.id
      if (!id) return false
      return (categoryMinStockEdits[id] ?? 0) !== (p.minimum_stock ?? 0)
    })

    const storedPortal =
      categoryPortalSettings[oldCategory] ?? DEFAULT_CATEGORY_PORTAL_SETTINGS

    const portalChanged =
      editingCategoryShowOnOrder !== storedPortal.show_on_order_portal ||
      editingCategoryRemoteStore !== storedPortal.remote_store

    if (!nameChanged && !indexChanged && !minStockChanged && !portalChanged) {
      cancelEditingCategory()
      return
    }

    const productIds = categoryProducts.map((p) => p.id).filter(Boolean) as string[]
    const oldKey = categorySortKey(oldCategory)
    const newKey = categorySortKey(newDisplay)

    setSavingCategory(true)
    try {
      if (nameChanged && productIds.length > 0) {
        const { error } = await supabase
          .from('products')
          .update({ category: newCategoryValue })
          .in('id', productIds)
          .eq('brand_id', selectedBrand.id)

        if (error) throw error

        setProducts((prev) =>
          prev.map((p) =>
            productIds.includes(p.id!) ? { ...p, category: newCategoryValue } : p
          )
        )
      }

      if (nameChanged && oldKey !== newKey) {
        await supabase
          .from('product_category_sort')
          .delete()
          .eq('brand_id', selectedBrand.id)
          .eq('category_name', oldKey)
      }

      const shouldPersistCategoryRow =
        portalChanged || nameChanged || newSortIndex !== null || indexChanged

      if (shouldPersistCategoryRow) {
        const sortIndexToSave =
          newSortIndex ??
          categorySortOrders[newDisplay] ??
          categorySortOrders[oldCategory] ??
          0
        const { error: sortError } = await supabase
          .from('product_category_sort')
          .upsert(
            {
              brand_id: selectedBrand.id,
              category_name: newKey,
              sort_index: sortIndexToSave,
              show_on_order_portal: editingCategoryShowOnOrder,
              remote_store: editingCategoryRemoteStore,
              yield_per_batch: storedPortal.yield_per_batch,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'brand_id,category_name' }
          )
        if (sortError) throw sortError
      } else if (indexChanged && newSortIndex === null) {
        await supabase
          .from('product_category_sort')
          .delete()
          .eq('brand_id', selectedBrand.id)
          .eq('category_name', newKey)
      }

      setCategorySortOrders((prev) => {
        const next = { ...prev }
        if (nameChanged) delete next[oldCategory]
        if (shouldPersistCategoryRow && newSortIndex !== null) {
          next[newDisplay] = newSortIndex
        } else if (shouldPersistCategoryRow) {
          next[newDisplay] =
            newSortIndex ??
            categorySortOrders[newDisplay] ??
            categorySortOrders[oldCategory] ??
            0
        } else if (indexChanged) {
          delete next[newDisplay]
        }
        return next
      })

      setCategoryPortalSettings((prev) => {
        const next = { ...prev }
        if (nameChanged) delete next[oldCategory]
        if (shouldPersistCategoryRow) {
          next[newDisplay] = {
            show_on_order_portal: editingCategoryShowOnOrder,
            remote_store: editingCategoryRemoteStore,
            yield_per_batch: storedPortal.yield_per_batch,
          }
        }
        return next
      })

      if (minStockChanged && productIds.length > 0) {
        const minStockResults = await Promise.all(
          productIds.map((id) =>
            supabase
              .from('products')
              .update({ minimum_stock: categoryMinStockEdits[id] ?? 0 })
              .eq('id', id)
              .eq('brand_id', selectedBrand.id)
          )
        )
        const minStockError = minStockResults.find((r) => r.error)?.error
        if (minStockError) throw minStockError

        setProducts((prev) =>
          prev.map((p) => {
            const id = p.id
            if (!id || !productIds.includes(id)) return p
            return { ...p, minimum_stock: categoryMinStockEdits[id] ?? 0 }
          })
        )
      }

      cancelEditingCategory()
    } catch (error) {
      console.error('Error saving category:', error)
      alert(
        'Failed to save category. Run migrations/product-category-sort.sql, product-category-portal-settings.sql, and product-minimum-stock.sql if tables or columns are missing.'
      )
    } finally {
      setSavingCategory(false)
    }
  }

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      const target = event.target as Element
      if (showCategoryDropdown && !target.closest('.category-dropdown')) {
        setShowCategoryDropdown(false)
      }
    }

    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCategoryDropdown])

  const getBrandPrefix = (brandSlug: string) => {
    switch (brandSlug) {
      case 'gelatofilipino':
        return 'GF-'
      case 'mychoice':
        return 'MC-'
      case 'mang-sorbetes':
        return 'MS-'
      default:
        return 'PR-'
    }
  }

  const generateNextSKU = useCallback(async (brandId: string) => {
    if (!selectedBrand) return ''

    try {
      // Use a more efficient query to get the highest SKU number
      const prefix = getBrandPrefix(selectedBrand.slug)
      
      // Query only SKUs that start with our prefix, ordered by SKU descending
      const { data, error } = await supabase
        .from('products')
        .select('sku')
        .eq('brand_id', brandId)
        .not('sku', 'is', null)
        .like('sku', `${prefix}%`)
        .order('sku', { ascending: false })
        .limit(1) // Only get the highest one

      if (error) {
        console.error('Error fetching products for SKU generation:', error)
        return prefix + '001'
      }

      let maxNumber = 0

      // Find the highest number in the returned SKU
      if (data && data.length > 0) {
        const sku = data[0].sku
        if (sku && sku.startsWith(prefix)) {
          const numberPart = sku.substring(prefix.length)
          const number = parseInt(numberPart)
          if (!isNaN(number)) {
            maxNumber = number
          }
        }
      }

      // Generate next SKU
      const nextNumber = maxNumber + 1
      return prefix + nextNumber.toString().padStart(3, '0')
    } catch (error) {
      console.error('Error generating SKU:', error)
      return getBrandPrefix(selectedBrand.slug) + '001'
    }
  }, [selectedBrand])

  const fetchProducts = async () => {
    if (!selectedBrand) return
    
    setLoading(true)
    
    try {
      console.log('Fetching products for brand:', selectedBrand.name)
      
      // Query products directly instead of using the view for better performance
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          brand_id,
          name,
          sku,
          category,
          unit,
          price,
          minimum_stock,
          initial_stock,
          production,
          released,
          reserved,
          linked_material_id,
          material_inventory_uom,
          created_at,
          updated_at
        `)
        .eq('brand_id', selectedBrand.id)
        .order('name')

      if (error) {
        console.error('Error fetching products:', error)
        alert('Failed to load products. Please try refreshing the page.')
        return
      }
      const rows = data || []
      console.log('Products fetched successfully:', rows.length, 'items')

      let destinationByProductId = new Map<
        string,
        { id: string; brandName: string; retailProductName: string }
      >()
      if (isFactoryBrand(selectedBrand)) {
        const destinations = await loadGfcProductDestinations()
        destinationByProductId = new Map(
          Array.from(destinations.entries()).map(([gfcId, dest]) => [
            gfcId,
            {
              id: dest.retail_brand_id,
              brandName: dest.retail_brand_name,
              retailProductName: dest.retail_product_name,
            },
          ])
        )
      }

      const productsWithCalculations = rows.map((product) => {
        const dest = destinationByProductId.get(product.id)
        const displayName = gfcInventoryDisplayName(
          product.name,
          dest?.brandName,
          dest?.retailProductName
        )
        return {
          ...product,
          product_name: displayName,
          brand_name: dest?.brandName || selectedBrand.name,
          brand_slug: selectedBrand.slug,
          destination_brand_id: dest?.id,
          destination_brand_name: dest?.brandName,
          final_stock: (product.initial_stock || 0) + (product.production || 0) - (product.released || 0),
          available_stock:
            (product.initial_stock || 0) +
            (product.production || 0) -
            (product.released || 0) -
            (product.reserved || 0),
        }
      })

      setProducts(productsWithCalculations)
      await fetchCategorySortOrders(selectedBrand.id)
      try {
        setStockByBranch(await loadProductStockByBranch(selectedBrand.id))
      } catch (branchErr) {
        console.warn('Failed to load Rel/Res by branch:', branchErr)
        setStockByBranch(EMPTY_STOCK_BY_BRANCH)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      alert('Failed to load products. Please check your internet connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const groupedProducts = useMemo(
    () => groupProductsByCategory(products, categorySortOrders),
    [products, categorySortOrders]
  )

  const inventoryBrandGroups = useMemo(() => {
    const categories = isGfcInventory
      ? groupedProducts.filter((g) => !isBomComponentProductCategory(g.sortIndex))
      : groupedProducts
    return [
      {
        brandName: selectedBrand?.name ?? '',
        categories,
      },
    ]
  }, [groupedProducts, selectedBrand?.name, isGfcInventory])

  const factoryComponentCategoryCount = useMemo(() => {
    if (!isGfcInventory) return 0
    return groupedProducts.filter((g) => isBomComponentProductCategory(g.sortIndex)).length
  }, [groupedProducts, isGfcInventory])

  const mainCycleCountProducts = useMemo(
    () =>
      inventoryBrandGroups
        .flatMap((g) => g.categories)
        .filter((g) => !usesCategoryScopedCycleCount(g.sortIndex))
        .filter((g) => categoryPortalSettings[g.category]?.show_on_order_portal !== false)
        .flatMap((g) => g.products),
    [inventoryBrandGroups, categoryPortalSettings]
  )

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBrand) return

    const categoryTrimmed = newProduct.category.trim()
    if (!categoryTrimmed) {
      alert('Category is required.')
      return
    }

    const addingNewCategory = isNewCategoryName(
      newProduct.category,
      categories,
      categorySortOrders
    )
    const newCategoryDisplay = productCategoryDisplayName(categoryTrimmed)
    const indexTrimmed = newCategorySortIndex.trim()
    if (addingNewCategory && !indexTrimmed) {
      alert('Sort index is required for a new category.')
      return
    }
    let newCategorySortIndexValue = 0
    if (addingNewCategory) {
      const parsed = parseInt(indexTrimmed, 10)
      if (Number.isNaN(parsed)) {
        alert('Sort index must be a whole number.')
        return
      }
      newCategorySortIndexValue = parsed
    }

    const priceTrimmed = addProductPrice.trim()
    const price =
      priceTrimmed === '' ? 0 : Number.parseFloat(priceTrimmed)
    if (priceTrimmed !== '' && Number.isNaN(price)) {
      alert('Price must be a valid number.')
      return
    }

    const stockTrimmed = addProductInitialStock.trim()
    const initialStock =
      stockTrimmed === '' ? 0 : Number.parseInt(stockTrimmed, 10)
    if (stockTrimmed !== '' && Number.isNaN(initialStock)) {
      alert('Initial stock must be a whole number.')
      return
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .insert([
          {
            brand_id: selectedBrand.id,
            name: newProduct.name,
            sku: newProduct.sku || null,
            category: categoryTrimmed,
            unit: newProduct.unit,
            price,
            initial_stock: initialStock,
            production: newProduct.production,
            released: newProduct.released,
            reserved: newProduct.reserved
          }
        ])
        .select()

      if (error) {
        console.error('Error adding product:', error)
        alert('Error adding product: ' + error.message)
        return
      }

      if (data && data[0]) {
        // Optimistic UI update - add the new product to state immediately
        const newProductData = data[0]
        const computedProduct = {
          ...newProductData,
          product_id: newProductData.id,
          product_name: newProductData.name,
          final_stock: (newProductData.initial_stock || 0) + (newProductData.production || 0) - (newProductData.released || 0),
          available_stock: (newProductData.initial_stock || 0) + (newProductData.production || 0) - (newProductData.released || 0) - (newProductData.reserved || 0)
        }
        setProducts(prev => [...prev, computedProduct])

        const effectiveSortIndex = addingNewCategory
          ? newCategorySortIndexValue
          : categorySortOrders[newCategoryDisplay]
        const isComponent = isBomComponentProductCategory(effectiveSortIndex)
        const isConsumable = isConsumableSupplyCategory(effectiveSortIndex)

        resetAddProductForm()
        setShowAddForm(false)

        void (async () => {
          if (addingNewCategory) {
            const { error: sortError } = await supabase.from('product_category_sort').upsert(
            {
              brand_id: selectedBrand.id,
              category_name: categorySortKey(newCategoryDisplay),
              sort_index: newCategorySortIndexValue,
              show_on_order_portal: newCategoryShowOnOrder,
              remote_store: newCategoryRemoteStore,
              yield_per_batch: DEFAULT_CATEGORY_PORTAL_SETTINGS.yield_per_batch,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'brand_id,category_name' }
          )
          if (sortError) {
            console.error('Error saving new category settings:', sortError)
            alert(
              'Product was added, but category settings could not be saved: ' + sortError.message
            )
          } else {
            setCategorySortOrders((prev) => ({
              ...prev,
              [newCategoryDisplay]: newCategorySortIndexValue,
            }))
            setCategoryPortalSettings((prev) => ({
              ...prev,
              [newCategoryDisplay]: {
                show_on_order_portal: newCategoryShowOnOrder,
                remote_store: newCategoryRemoteStore,
                yield_per_batch: DEFAULT_CATEGORY_PORTAL_SETTINGS.yield_per_batch,
              },
            }))
            setCategories((prev) => {
              if (prev.some((c) => c.toLowerCase() === newCategoryDisplay.toLowerCase())) {
                return prev
              }
              return [...prev, newCategoryDisplay].sort((a, b) => a.localeCompare(b))
            })
          }
          }

          if (guestMode) return

          if (isComponent) {
            try {
              await ensureBomComponentMaterial(
                {
                  id: newProductData.id,
                  product_id: newProductData.id,
                  product_name: newProductData.name,
                  name: newProductData.name,
                  sku: newProductData.sku,
                  unit: newProductData.unit,
                  price: newProductData.price,
                },
                selectedBrand
              )
            } catch (componentErr) {
              console.warn('component material link:', componentErr)
            }
          }

          if (initialStock > 0 && price > 0 && !isConsumable) {
            try {
              const { postProductOpeningStockJournalWithNotice } = await import(
                '../../lib/accounting-product-posting'
              )
              await postProductOpeningStockJournalWithNotice(
                newProductData.id,
                selectedBrand.id,
                currentUsername.trim() || 'Dashboard',
                {
                  quantity: initialStock,
                  unitCost: price,
                  unit: newProduct.unit,
                  productName: newProductData.name,
                }
              )
            } catch (journalErr) {
              console.error('Product opening stock journal failed:', journalErr)
            }
          }
        })()
      }
    } catch (error) {
      console.error('Error adding product:', error)
      alert('Error adding product')
    }
  }

  const handleUpdateProduct = useCallback(async (product: Product) => {
    if (updateTimeout) {
      clearTimeout(updateTimeout)
    }

    const original = products.find((p) => p.id === product.id)
    const previousInitialStock = original?.initial_stock ?? 0
    const newInitialStock = product.initial_stock ?? 0
    const stockDelta = newInitialStock - previousInitialStock
    const categoryDisplay = productCategoryDisplayName(product.category)
    const sortIndex = categorySortOrders[categoryDisplay]
    const isConsumable = isConsumableSupplyCategory(sortIndex)
    const unitCost = Number(product.price) || 0
    const shouldPostStockAdjustment =
      fullProductEdit &&
      !guestMode &&
      selectedBrand &&
      stockDelta !== 0 &&
      !isConsumable &&
      unitCost > 0

    const timeout = setTimeout(async () => {
      try {
        const updatePayload = fullProductEdit
          ? {
              name: product.name,
              sku: product.sku,
              category: product.category,
              price: product.price,
              initial_stock: product.initial_stock,
              production: product.production,
              released: product.released,
              reserved: product.reserved,
            }
          : {
              name: product.name,
              price: product.price,
            }

        const { data, error } = await supabase
          .from('products')
          .update(updatePayload)
          .eq('id', product.id)
          .select()

        if (error) {
          console.error('Error updating product:', error)
          alert('Error updating product: ' + error.message)
          return
        }

        if (data) {
          const saved = data[0]
          setProducts(prev => prev.map(p => 
            p.id === product.id 
              ? {
                  ...p,
                  ...(fullProductEdit ? product : { name: product.name, price: product.price }),
                  ...(!fullProductEdit && saved
                    ? { name: saved.name, price: saved.price }
                    : {}),
                  product_name: fullProductEdit ? product.name : (saved?.name ?? product.name),
                  final_stock: fullProductEdit
                    ? (product.initial_stock || 0) + (product.production || 0) - (product.released || 0)
                    : p.final_stock,
                  available_stock: fullProductEdit
                    ? (product.initial_stock || 0) +
                      (product.production || 0) -
                      (product.released || 0) -
                      (product.reserved || 0)
                    : p.available_stock,
                }
              : p
          ))
          setEditingProduct(null)

          if (fullProductEdit && shouldPostStockAdjustment && selectedBrand) {
            void (async () => {
              try {
                const amount = Math.round(Math.abs(stockDelta) * unitCost * 100) / 100
                const { data: adjustment, error: adjustmentErr } = await supabase
                  .from('product_stock_adjustments')
                  .insert({
                    brand_id: selectedBrand.id,
                    product_id: product.id,
                    previous_initial_stock: previousInitialStock,
                    new_initial_stock: newInitialStock,
                    quantity_delta: stockDelta,
                    unit_cost: unitCost,
                    amount,
                    unit: product.unit || null,
                    created_by: currentUsername.trim() || 'Dashboard',
                  })
                  .select('id')
                  .single()

                if (adjustmentErr || !adjustment) {
                  throw adjustmentErr || new Error('Could not record stock adjustment.')
                }

                const { postProductStockAdjustmentJournalWithNotice } = await import(
                  '../../lib/accounting-product-posting'
                )
                await postProductStockAdjustmentJournalWithNotice(
                  adjustment.id,
                  selectedBrand.id,
                  currentUsername.trim() || 'Dashboard',
                  product.name
                )
              } catch (adjustmentErr) {
                console.error('Product stock adjustment failed:', adjustmentErr)
              }
            })()
          }
        }
      } catch (error) {
        console.error('Error updating product:', error)
        alert('Error updating product')
      }
    }, 500)

    setUpdateTimeout(timeout)
  }, [
    updateTimeout,
    products,
    guestMode,
    selectedBrand,
    categorySortOrders,
    currentUsername,
    fullProductEdit,
  ])

  const handleSaveAllProduction = async () => {
    if (!selectedBrand) return

    setSavingProduction(true)
    try {
      // First, fetch current product data to get initial_stock values
      const productIds = Object.keys(productionValues)
      const { data: currentProducts, error: fetchError } = await supabase
        .from('products')
        .select('id, initial_stock, production')
        .in('id', productIds)

      if (fetchError) throw fetchError

      const currentProductsMap = new Map(
        currentProducts?.map(p => [p.id, p]) || []
      )

      // Get today's date in Philippines timezone
      const today = getPhilippinesDate()

      // Calculate totals for daily summary
      const totalProduction = Object.values(productionValues).reduce((sum, val) => sum + (val || 0), 0)
      
      // Get product names for production details
      const { data: allProductsData } = await supabase
        .from('products')
        .select('id, name')
        .eq('brand_id', selectedBrand.id)

      // Build production details array with product names and quantities
      // Use products from state first (they have product_id or id), then fall back to fetched data
      const productionDetails = Object.entries(productionValues)
        .filter(([_, value]) => value > 0) // Only include products with production > 0
        .map(([productId, productionValue]) => {
          // First try to find in current products state
          const productFromState = products.find(p => {
            const pId = p.product_id || p.id
            return pId === productId
          })
          
          // If not found in state, try fetched data
          const productFromFetched = allProductsData?.find(p => p.id === productId)
          
          // Get product name from state or fetched data
          const productName = productFromState?.name || productFromState?.product_name || productFromFetched?.name || 'Unknown Product'
          
          return {
            product_id: productId,
            product_name: productName,
            production: productionValue || 0
          }
        })

      // Update all products: add production to initial_stock and reset production to 0
      const updatePromises = Object.entries(productionValues).map(async ([productId, productionValue]) => {
        const currentProduct = currentProductsMap.get(productId)
        if (!currentProduct) return

        const newInitialStock = (currentProduct.initial_stock || 0) + (productionValue || 0)

        const { error } = await supabase
          .from('products')
          .update({
            initial_stock: newInitialStock,
            production: 0, // Reset production after adding to initial stock
            updated_at: new Date().toISOString()
          })
          .eq('id', productId)

        if (error) {
          console.error(`Error updating product ${productId}:`, error)
          throw error
        }
      })

      await Promise.all(updatePromises)

      // Save or update daily production report
      const { data: existingReport, error: checkError } = await supabase
        .from('daily_stock_summaries')
        .select('id')
        .eq('brand_id', selectedBrand.id)
        .eq('date', today)
        .maybeSingle()

      // Check if error is something other than "no rows found"
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking for existing report:', checkError)
        // Don't throw - production was already saved
      } else if (existingReport && existingReport.id) {
        // Update existing report - merge production details
        const { data: existingReportData } = await supabase
          .from('daily_stock_summaries')
          .select('production_details')
          .eq('id', existingReport.id)
          .maybeSingle()

        const existingDetails = (existingReportData?.production_details && Array.isArray(existingReportData.production_details)) 
          ? existingReportData.production_details 
          : []
        const mergedDetails = [...existingDetails, ...productionDetails]

        const { error: updateReportError } = await supabase
          .from('daily_stock_summaries')
          .update({
            total_production: totalProduction,
            production_details: mergedDetails
          })
          .eq('id', existingReport.id)

        if (updateReportError) {
          console.error('Error updating daily report:', updateReportError)
          // Don't throw - production was already saved
        }
      } else {
        // Create new report
        const { error: createReportError } = await supabase
          .from('daily_stock_summaries')
          .insert({
            brand_id: selectedBrand.id,
            date: today,
            total_production: totalProduction,
            production_details: productionDetails
          })

        if (createReportError) {
          console.error('Error creating daily report:', createReportError)
          // Don't throw - production was already saved
        }
      }

      // Refresh products to show updated values
      await fetchProducts()

      // Exit production input mode
      setProductionInputMode(false)
      setProductionValues({})

      alert('Production values added to initial stock and saved to daily report successfully!')
    } catch (error) {
      console.error('Error saving production values:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      alert(`Failed to save production values: ${errorMessage}. Please try again.`)
    } finally {
      setSavingProduction(false)
    }
  }

  const fetchProductionReports = async () => {
    if (!selectedBrand) return

    setLoadingReports(true)
    try {
      const { data, error } = await supabase
        .from('daily_stock_summaries')
        .select('*')
        .eq('brand_id', selectedBrand.id)
        .order('date', { ascending: false })
        .limit(30)

      if (error) throw error

      setProductionReports(data || [])
    } catch (error) {
      console.error('Error fetching production reports:', error)
      alert('Failed to fetch production reports')
    } finally {
      setLoadingReports(false)
    }
  }

  const handleDeleteProductionItem = async (reportId: string, itemIndex: number) => {
    if (!selectedReport) return

    const confirmed = await requestAdminPassword({
      title: 'Delete production item',
      message:
        'Are you sure you want to delete this item from the production report?\n\nEnter admin password to confirm.',
      confirmLabel: 'Delete',
    })
    if (!confirmed) return

    setDeletingItem(`${reportId}-${itemIndex}`)
    try {
      const currentDetails = Array.isArray(selectedReport.production_details) 
        ? selectedReport.production_details 
        : []
      
      // Remove the item at the specified index
      const updatedDetails = currentDetails.filter((_: any, index: number) => index !== itemIndex)
      
      // Recalculate total production
      const newTotalProduction = updatedDetails.reduce((sum: number, item: any) => sum + (item.production || 0), 0)

      // Update the report in the database
      const { error } = await supabase
        .from('daily_stock_summaries')
        .update({
          total_production: newTotalProduction,
          production_details: updatedDetails
        })
        .eq('id', reportId)

      if (error) throw error

      // Update the selected report in state
      setSelectedReport({
        ...selectedReport,
        total_production: newTotalProduction,
        production_details: updatedDetails
      })

      // Update the report in the reports list
      setProductionReports(prevReports => 
        prevReports.map(report => 
          report.id === reportId 
            ? { ...report, total_production: newTotalProduction, production_details: updatedDetails }
            : report
        )
      )

      alert('Item deleted successfully!')
    } catch (error) {
      console.error('Error deleting production item:', error)
      alert('Failed to delete item. Please try again.')
    } finally {
      setDeletingItem(null)
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    const productToDelete = products.find((p) => (p.product_id || p.id) === productId)
    const isComponent =
      productToDelete != null &&
      isProductBomComponent(productToDelete, categorySortOrders)

    const confirmed = await requestAdminPassword({
      title: 'Delete product',
      message: isComponent
        ? 'Delete this component product from Product Inventory? The linked procurement material (Component category) will also be removed.\n\nEnter admin password to confirm.'
        : 'Are you sure you want to delete this product?\n\nEnter admin password to confirm.',
      confirmLabel: 'Delete',
    })
    if (!confirmed) return

    // Optimistic UI update - remove product immediately
    const previousProducts = products
    setProducts(products.filter(p => (p.product_id || p.id) !== productId))

    try {
      if (isComponent) {
        await deleteLinkedComponentMaterials(productId)
      }

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)

      if (error) {
        console.error('Error deleting product:', error)
        alert('Error deleting product: ' + error.message)
        // Revert optimistic update on error
        setProducts(previousProducts)
        return
      }

      console.log('Product deleted successfully')
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('Error deleting product')
      // Revert optimistic update on error
      setProducts(previousProducts)
    }
  }


  if (!selectedBrand) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Please select a brand to manage products</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {isGfcInventory ? 'Finished Goods Inventory' : 'Product Inventory'}
          </h1>
          <p className="text-sm text-gray-600">
            {isGfcInventory
              ? 'GFC finished goods inventory'
              : `Manage finished goods and stock levels for ${selectedBrand.name}`}
          </p>
          {isGfcInventory && factoryComponentCategoryCount > 0 ? (
            <p className="text-xs text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2 mt-2 max-w-xl">
              Manufacturable components are managed in <strong>Factory → Components</strong>, not
              here.
            </p>
          ) : null}
        </div>
        {!guestMode && (
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {mainCycleCountProducts.length > 0 ? (
            <button
              type="button"
              onClick={() =>
                setCycleCountPanel({
                  products: mainCycleCountProducts,
                  categoryScope: null,
                  scopeTitle: 'Product cycle count',
                  scopeDescription: 'Finished products (excludes supplies and components)',
                  groupByCategory: true,
                })
              }
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 border border-indigo-200 bg-white rounded-lg hover:bg-indigo-50 shadow-sm"
            >
              <ClipboardCheck className="h-4 w-4" />
              Cycle count
            </button>
          ) : null}
          <button
            onClick={() => {
              if (productionInputMode) {
                // Cancel production input mode
                setProductionInputMode(false)
                setProductionValues({})
              } else {
                // Enter production input mode - initialize with current production values
                const initialValues: {[productId: string]: number} = {}
                products.forEach(product => {
                  const productId = product.product_id || product.id
                  initialValues[productId] = product.production || 0
                })
                setProductionValues(initialValues)
                setProductionInputMode(true)
              }
            }}
            className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${
              productionInputMode
                ? 'bg-gray-600 hover:bg-gray-700'
                : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            <Package className="h-4 w-4" />
            <span>{productionInputMode ? 'Cancel' : 'Production'}</span>
          </button>
          {productionInputMode && (
            <button
              onClick={handleSaveAllProduction}
              disabled={savingProduction}
              className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${
                theme === 'green' ? 'bg-green-600 hover:bg-green-700' :
                theme === 'red' ? 'bg-red-600 hover:bg-red-700' :
                theme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
                'bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Save className="h-4 w-4" />
              <span>{savingProduction ? 'Saving...' : 'Save All Production'}</span>
            </button>
          )}
          <button
            onClick={() => {
              setShowProductionReports(true)
              fetchProductionReports()
            }}
            className="flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors bg-purple-600 hover:bg-purple-700"
          >
            <FileText className="h-4 w-4" />
            <span>Production Log</span>
          </button>
          <button
            onClick={async () => {
              const nextSKU = await generateNextSKU(selectedBrand.id)
              setNewProduct({
                ...newProduct,
                sku: nextSKU
              })
              setShowAddForm(true)
            }}
            className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${
              theme === 'green' ? 'bg-green-600 hover:bg-green-700' :
              theme === 'red' ? 'bg-red-600 hover:bg-red-700' :
              theme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
              'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        </div>
        )}
      </div>

      {/* Add Product Modal */}
      {showAddForm && (
        <Modal
          onClose={() => {
            setShowAddForm(false)
            resetAddProductForm()
          }}
          align="center"
        >
          <div className="bg-white rounded-lg w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Product</h3>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  resetAddProductForm()
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter product name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SKU
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={newProduct.sku}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 cursor-default"
                      placeholder="—"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category *
                    </label>
                    <div className="relative category-dropdown">
                      <input
                        type="text"
                        required
                        value={newProduct.category}
                        onChange={(e) => {
                          setNewProduct({...newProduct, category: e.target.value})
                          setShowCategoryDropdown(true)
                        }}
                        onFocus={() => setShowCategoryDropdown(true)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter or select"
                      />
                      {showCategoryDropdown && categories.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {categories.map((category) => (
                            <button
                              key={category}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setNewProduct({...newProduct, category})
                                setShowCategoryDropdown(false)
                              }}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm text-gray-900"
                            >
                              {category}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {isAddingNewCategory && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
                    <p className="text-xs text-gray-600">
                      New category — configure sort order and order portal visibility.
                    </p>
                    <div className="w-28">
                      <div className="flex items-center gap-1 mb-1">
                        <label className="text-xs font-medium text-gray-600">Index *</label>
                        <span className="relative group">
                          <button
                            type="button"
                            className="p-0.5 text-gray-400 hover:text-gray-600 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            aria-label="Sort index guide"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-52 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs leading-relaxed text-gray-600 shadow-lg group-hover:block group-focus-within:block"
                          >
                            {CATEGORY_SORT_INDEX_HELP_LINES.map((line) => (
                              <span key={line} className="block">
                                {line}
                              </span>
                            ))}
                          </span>
                        </span>
                      </div>
                      <input
                        type="number"
                        required
                        value={newCategorySortIndex}
                        onChange={(e) => setNewCategorySortIndex(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                      />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-5">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={newCategoryShowOnOrder}
                          onChange={(e) => setNewCategoryShowOnOrder(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Show on order portal</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={newCategoryRemoteStore}
                          onChange={(e) => setNewCategoryRemoteStore(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span>Remote store only</span>
                      </label>
                    </div>
                  </div>
                )}
                {/* Initial Stock, Unit, and Price in same row */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Initial Stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={addProductInitialStock}
                      onChange={(e) => setAddProductInitialStock(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                      placeholder=""
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </label>
                    <select
                      value={newProduct.unit}
                      onChange={(e) => setNewProduct({...newProduct, unit: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="pans">Pans</option>
                      <option value="pcs">Pieces</option>
                      <option value="gallons">Gallons</option>
                      <option value="liters">Liters</option>
                      <option value="kg">Kilograms</option>
                      <option value="boxes">Boxes</option>
                      <option value="bags">Bags</option>
                      <option value="g">Grams</option>
                      <option value="bottles">Bottles</option>
                      <option value="packs">Packs</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price (₱)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={addProductPrice}
                      onChange={(e) => setAddProductPrice(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                      placeholder=""
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    resetAddProductForm()
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${
                    theme === 'green' ? 'bg-green-600 hover:bg-green-700' :
                    theme === 'red' ? 'bg-red-600 hover:bg-red-700' :
                    theme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
                    'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Save className="h-4 w-4" />
                  <span>Save Product</span>
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Products List */}
      {loading ? (
        <div className="space-y-6">
          {/* Skeleton for each category */}
          {[...Array(2)].map((_, categoryIndex) => {
            const { bar, pulseColor } = categoryHeaderSkeletonClasses(theme)
            return (
            <div key={categoryIndex} className="bg-white rounded-lg border shadow-sm overflow-hidden">
              {/* Category header skeleton */}
              <div className={`px-6 py-3 border-b ${bar}`}>
                <div className="animate-pulse">
                  <div className={`h-6 rounded w-48 max-w-full ${pulseColor}`} />
                </div>
              </div>
              
              {/* Table skeleton */}
              <ProductInventoryTableSkeleton guestMode={guestMode} />
            </div>
          )})}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No products found for {selectedBrand.name}</p>
          <p className="text-sm">
            {guestMode
              ? 'Products will appear here once an administrator adds them.'
              : 'Click "Add Product" to create your first product'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {isGfcInventory &&
          inventoryBrandGroups.every((g) => g.categories.every((c) => c.products.length === 0)) ? (
            <div className="text-center py-8 text-gray-500">
              <p>No finished goods in GFC inventory</p>
              <p className="text-sm">Add products in the GFC production catalog.</p>
            </div>
          ) : (
          <div className="space-y-8">
          {inventoryBrandGroups.map((brandGroup) => {
            const groupTheme = isGfcInventory ? 'blue' : theme
            return (
            <div key={brandGroup.brandName} className="space-y-4">
              <div className="space-y-6">
          {brandGroup.categories.map(({ category, sortIndex, products: categoryProducts }) => {
            const isComponentCategory = isBomComponentProductCategory(sortIndex)
            const headerTheme = categoryHeaderThemeClasses(groupTheme, sortIndex)
            const showCategoryCycleCount =
              usesCategoryScopedCycleCount(sortIndex) &&
              categoryProducts.length > 0 &&
              (isComponentCategory ||
                categoryPortalSettings[category]?.show_on_order_portal !== false)
            return (
            <div key={`${brandGroup.brandName}-${category}`} className="bg-white rounded-lg border shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 ease-in-out">
              <div className={`px-6 py-3 border-b transition-colors duration-200 ease-in-out ${headerTheme.bar}`}>
                {editingCategory === category ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-end gap-2">
                    <div className="w-20">
                      <div className="flex items-center gap-1 mb-1.5">
                        <label className="text-xs font-medium text-gray-600">Index</label>
                        <span className="relative group">
                          <button
                            type="button"
                            className="p-0.5 text-gray-400 hover:text-gray-600 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            aria-label="Sort index guide"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-52 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs leading-relaxed text-gray-600 shadow-lg group-hover:block group-focus-within:block"
                          >
                            {CATEGORY_SORT_INDEX_HELP_LINES.map((line) => (
                              <span key={line} className="block">
                                {line}
                              </span>
                            ))}
                          </span>
                        </span>
                      </div>
                      <input
                        type="number"
                        value={editingCategoryIndex}
                        onChange={(e) => setEditingCategoryIndex(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveCategory(category, categoryProducts)
                          if (e.key === 'Escape') cancelEditingCategory()
                        }}
                        placeholder="—"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        disabled={savingCategory}
                      />
                    </div>
                    <div className="w-48 sm:w-56">
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Category name</label>
                      <input
                        type="text"
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveCategory(category, categoryProducts)
                          if (e.key === 'Escape') cancelEditingCategory()
                        }}
                        placeholder="Category name"
                        className="w-full max-w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                        autoFocus
                        disabled={savingCategory}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveCategory(category, categoryProducts)}
                      disabled={savingCategory}
                      className={`flex items-center gap-1 px-3 py-1.5 text-white text-sm rounded-lg disabled:opacity-50 ${
                        groupTheme === 'green' ? 'bg-green-600 hover:bg-green-700' :
                        groupTheme === 'red' ? 'bg-red-600 hover:bg-red-700' :
                        groupTheme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
                        'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      <Save className="h-4 w-4" />
                      {savingCategory ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditingCategory}
                      disabled={savingCategory}
                      className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-5">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={editingCategoryShowOnOrder}
                          onChange={(e) => setEditingCategoryShowOnOrder(e.target.checked)}
                          disabled={savingCategory}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Show on order portal</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={editingCategoryRemoteStore}
                          onChange={(e) => setEditingCategoryRemoteStore(e.target.checked)}
                          disabled={savingCategory}
                          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span>Remote store only</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <h3 className={`text-lg font-medium flex items-center gap-2 ${headerTheme.title}`}>
                      <span>
                        {category} ({categoryProducts.length} {categoryProducts.length === 1 ? 'product' : 'products'})
                      </span>
                      {(categoryPortalSettings[category]?.show_on_order_portal === false ||
                        categoryPortalSettings[category]?.remote_store) && (
                        <span className="flex flex-wrap gap-1.5">
                          {categoryPortalSettings[category]?.show_on_order_portal === false ? (
                            <span
                              className={`inline-flex items-center ${headerTheme.badge}`}
                              title="Hidden on order"
                            >
                              <EyeOff className="h-4 w-4" aria-label="Hidden on order" />
                            </span>
                          ) : null}
                          {categoryPortalSettings[category]?.remote_store ? (
                            <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                              Remote store only
                            </span>
                          ) : null}
                        </span>
                      )}
                    </h3>
                    {!guestMode && (
                      <div className="flex items-center gap-1 shrink-0">
                        {showCategoryCycleCount ? (
                          <button
                            type="button"
                            onClick={() =>
                              setCycleCountPanel({
                                products: categoryProducts,
                                categoryScope: category,
                                scopeTitle: `Cycle count — ${category}`,
                                scopeDescription: isComponentCategory
                                  ? `Components · ${category}`
                                  : `Supplies · ${category}`,
                                groupByCategory: false,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-700 border border-indigo-200 bg-white rounded-md hover:bg-indigo-50"
                            title={`Cycle count for ${category}`}
                          >
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            Cycle count
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => startEditingCategory(category)}
                          title="Edit category name and sort index"
                          className={`p-1.5 rounded-lg transition-colors ${headerTheme.editBtn}`}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                    Product Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Initial Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Prod
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    <BranchQtyHoverTooltip
                      title="Released by branch (all products)"
                      rows={stockByBranch.releasedTotals}
                      emptyLabel="No in-transit pans by branch"
                    >
                      <span className="underline decoration-dotted decoration-gray-400 underline-offset-2">
                        Rel
                      </span>
                    </BranchQtyHoverTooltip>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Final Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    <BranchQtyHoverTooltip
                      title="Reserved by branch (all products)"
                      rows={stockByBranch.reservedTotals}
                      emptyLabel="No reserved pans by branch"
                    >
                      <span className="underline decoration-dotted decoration-gray-400 underline-offset-2">
                        Res
                      </span>
                    </BranchQtyHoverTooltip>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Available
                  </th>
                  {!guestMode && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    {editingCategory === category ? 'Min Stock' : 'Actions'}
                  </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {categoryProducts.map((product) => {
                  const productKey = product.product_id || product.id
                  const isCategoryEditMode = editingCategory === category
                  const minStock = isCategoryEditMode
                    ? (categoryMinStockEdits[productKey] ?? product.minimum_stock ?? 0)
                    : (product.minimum_stock ?? 0)
                  const availableQty = productionInputMode
                    ? ((product.initial_stock || 0) +
                        (productionValues[productKey] || product.production || 0) -
                        (product.released || 0)) -
                      (product.reserved || 0)
                    : editingProduct?.id === productKey
                      ? ((editingProduct.initial_stock || 0) +
                          (editingProduct.production || 0) -
                          (editingProduct.released || 0)) -
                        (editingProduct.reserved || 0)
                      : product.available_stock || 0
                  const availableCritical = isAvailableCritical(availableQty, minStock)
                  const availableClass = getAvailableStockTextClass(availableQty, minStock)
                  const isConsumable = isProductConsumableSupply(product, categorySortOrders)
                  const isComponent = isProductBomComponent(product, categorySortOrders)

                  return (
                  <tr key={productKey} className="hover:bg-blue-100">
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm font-medium text-gray-900">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="text"
                          value={editingProduct.name}
                          onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                          className="w-full max-w-44 px-2 h-6 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            isConsumable
                              ? setMaterialLinkProduct(product)
                              : setBomProduct(product)
                          }
                          className="text-left px-2 py-1 -mx-2 rounded-md transition-colors text-gray-900 hover:bg-blue-200"
                          title={
                            isConsumable
                              ? 'Materials inventory link (supplies/consumable)'
                              : 'View bill of materials'
                          }
                        >
                          {product.product_name || product.name}
                          {isConsumable && product.linked_material_id ? (
                            <span className="ml-1 text-[10px] font-medium text-emerald-700">
                              linked
                            </span>
                          ) : null}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm text-gray-500">
                      {editingProduct?.id === (product.product_id || product.id) && fullProductEdit ? (
                        <input
                          type="text"
                          value={editingProduct.sku || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, sku: e.target.value})}
                          className="w-full max-w-28 px-2 h-6 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        product.sku || '-'
                      )}
                    </td>
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm text-gray-500">
                      {product.unit}
                    </td>
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm font-medium text-green-600">
                      {editingProduct?.id === productKey ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editingProduct.price === 0 ? '' : editingProduct.price || ''}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              price: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full max-w-20 px-2 h-6 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                        `₱${(product.price || 0).toFixed(2)}`
                      )}
                    </td>
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm text-gray-900">
                      {editingProduct?.id === (product.product_id || product.id) && fullProductEdit ? (
                        <input
                          type="number"
                          min="0"
                          value={editingProduct.initial_stock === 0 ? '' : editingProduct.initial_stock || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, initial_stock: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})}
                          className="w-full max-w-16 px-2 h-6 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                        product.initial_stock || 0
                      )}
                    </td>
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm text-gray-900">
                      {productionInputMode ? (
                        <input
                          type="number"
                          min="0"
                          value={productionValues[product.product_id || product.id] === 0 ? '' : productionValues[product.product_id || product.id] || ''}
                          onChange={(e) => {
                            const productId = product.product_id || product.id
                            setProductionValues({
                              ...productionValues,
                              [productId]: e.target.value === '' ? 0 : parseInt(e.target.value) || 0
                            })
                          }}
                          className="w-full max-w-16 px-2 h-6 border-2 border-blue-400 rounded text-sm text-center bg-blue-50 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : editingProduct?.id === (product.product_id || product.id) && fullProductEdit ? (
                        <input
                          type="number"
                          min="0"
                          value={editingProduct.production === 0 ? '' : editingProduct.production || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, production: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})}
                          className="w-full max-w-16 px-2 h-6 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                        product.production || 0
                      )}
                    </td>
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm text-gray-900">
                      {editingProduct?.id === (product.product_id || product.id) && fullProductEdit ? (
                        <input
                          type="number"
                          min="0"
                          value={editingProduct.released === 0 ? '' : editingProduct.released || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, released: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})}
                          className="w-full max-w-16 px-2 h-6 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : editingProduct?.id === (product.product_id || product.id) ? (
                        product.released || 0
                      ) : (
                        <BranchQtyHoverTooltip
                          title={`Released — ${product.name || product.product_name || 'Product'}`}
                          rows={stockByBranch.byProduct[productKey]?.released || []}
                          emptyLabel="No in-transit pans for this item"
                        >
                          <span>{product.released || 0}</span>
                        </BranchQtyHoverTooltip>
                      )}
                    </td>
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm font-semibold text-purple-600">
                      {productionInputMode ? (
                        (product.initial_stock || 0) + (productionValues[product.product_id || product.id] || product.production || 0) - (product.released || 0)
                      ) : editingProduct?.id === (product.product_id || product.id) && fullProductEdit ? (
                        (editingProduct.initial_stock || 0) + (editingProduct.production || 0) - (editingProduct.released || 0)
                      ) : (
                        product.final_stock || 0
                      )}
                    </td>
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm text-gray-900">
                      {editingProduct?.id === (product.product_id || product.id) && fullProductEdit ? (
                        <input
                          type="number"
                          min="0"
                          value={editingProduct.reserved === 0 ? '' : editingProduct.reserved || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, reserved: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})}
                          className="w-full max-w-16 px-2 h-6 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : editingProduct?.id === (product.product_id || product.id) ? (
                        product.reserved || 0
                      ) : (
                        <BranchQtyHoverTooltip
                          title={`Reserved — ${product.name || product.product_name || 'Product'}`}
                          rows={stockByBranch.byProduct[productKey]?.reserved || []}
                          emptyLabel="No reserved pans for this item"
                        >
                          <span>{product.reserved || 0}</span>
                        </BranchQtyHoverTooltip>
                      )}
                    </td>
                    <td
                      className={`px-6 py-2 h-10 whitespace-nowrap text-sm tabular-nums ${availableClass}`}
                      title={availableCritical ? 'Critical stock level' : undefined}
                    >
                      {availableQty}
                      {availableCritical ? '*' : ''}
                    </td>
                    {!guestMode && (
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                      {isCategoryEditMode ? (
                        <input
                          type="number"
                          min="0"
                          value={
                            categoryMinStockEdits[productKey] === 0
                              ? ''
                              : categoryMinStockEdits[productKey] ?? ''
                          }
                          onChange={(e) =>
                            setCategoryMinStockEdits({
                              ...categoryMinStockEdits,
                              [productKey]:
                                e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-full max-w-20 px-2 h-6 border border-gray-300 rounded text-sm text-center text-gray-900 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                      <div className="flex space-x-2">
                        {editingProduct?.id === (product.product_id || product.id) ? (
                          <>
                            <button
                              onClick={async () => {
                                if (!editingProduct) return
                                const confirmed = await requestAdminPassword({
                                  title: 'Save product changes',
                                  message:
                                    'Enter admin password to save changes to this product.',
                                  confirmLabel: 'Save',
                                })
                                if (confirmed) handleUpdateProduct(editingProduct)
                              }}
                              className={`p-1 rounded ${
                                theme === 'green' ? 'text-green-600 hover:text-green-900 hover:bg-green-100' :
                                theme === 'red' ? 'text-red-600 hover:text-red-900 hover:bg-red-100' :
                                theme === 'yellow' ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100' :
                                'text-blue-600 hover:text-blue-900 hover:bg-blue-100'
                              }`}
                              title="Save"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingProduct(null)}
                              className="p-1 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            {isConsumable ? (
                              <button
                                type="button"
                                onClick={() => setReceiveProduct(product)}
                                className={`p-1 rounded ${
                                  theme === 'green'
                                    ? 'text-green-600 hover:text-green-900 hover:bg-green-100'
                                    : theme === 'red'
                                      ? 'text-red-600 hover:text-red-900 hover:bg-red-100'
                                      : theme === 'yellow'
                                        ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100'
                                        : 'text-blue-600 hover:text-blue-900 hover:bg-blue-100'
                                }`}
                                title="Import materials"
                              >
                                <ArrowDownToLine className="h-4 w-4" />
                              </button>
                            ) : null}
                            {isComponent ? (
                              <button
                                type="button"
                                onClick={() => setExportComponentProduct(product)}
                                className={`p-1 rounded ${
                                  theme === 'green'
                                    ? 'text-green-600 hover:text-green-900 hover:bg-green-100'
                                    : theme === 'red'
                                      ? 'text-red-600 hover:text-red-900 hover:bg-red-100'
                                      : theme === 'yellow'
                                        ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100'
                                        : 'text-blue-600 hover:text-blue-900 hover:bg-blue-100'
                                }`}
                                title="Export component to procurement"
                              >
                                <ArrowUpFromLine className="h-4 w-4" />
                              </button>
                            ) : null}
                            <button
                              onClick={() => setEditingProduct({
                                ...product, 
                                id: product.product_id || product.id,
                                name: product.product_name || product.name
                              })}
                              className={`p-1 rounded ${
                                theme === 'green' ? 'text-green-600 hover:text-green-900 hover:bg-green-100' :
                                theme === 'red' ? 'text-red-600 hover:text-red-900 hover:bg-red-100' :
                                theme === 'yellow' ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100' :
                                'text-blue-600 hover:text-blue-900 hover:bg-blue-100'
                              }`}
                              title={fullProductEdit ? 'Edit all fields' : 'Edit name & price'}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.product_id || product.id)}
                              className="p-1 rounded text-red-600 hover:text-red-900 hover:bg-red-100"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                      )}
                    </td>
                    )}
                  </tr>
                  )
                })}
              </tbody>
            </table>
              </div>
            </div>
            )
          })}
              </div>
            </div>
          )})}
          </div>
          )}
        </div>
      )}

      {bomProduct && selectedBrand && (
        <ProductBomModal
          product={bomProduct}
          selectedBrand={selectedBrand}
          categorySortOrders={categorySortOrders}
          brandProducts={products}
          theme={theme}
          guestMode={guestMode}
          onClose={closeBomModal}
          onOpenProcurement={onNavigateToPurchasing}
        />
      )}

      {materialLinkProduct && selectedBrand && (
        <ProductMaterialLinkModal
          product={materialLinkProduct}
          selectedBrand={selectedBrand}
          categorySortOrders={categorySortOrders}
          theme={theme}
          guestMode={guestMode}
          onClose={() => setMaterialLinkProduct(null)}
          onSaved={fetchProducts}
          onOpenProcurement={onNavigateToPurchasing}
        />
      )}

      {receiveProduct && (
        <ProductMaterialReceiveModal
          product={receiveProduct}
          theme={theme}
          guestMode={guestMode}
          currentUsername={currentUsername}
          onClose={() => setReceiveProduct(null)}
          onReceived={fetchProducts}
          onOpenMaterialLink={() => {
            setReceiveProduct(null)
            setMaterialLinkProduct(receiveProduct)
          }}
        />
      )}

      {exportComponentProduct && selectedBrand && (
        <ProductComponentExportModal
          product={exportComponentProduct}
          selectedBrand={selectedBrand}
          theme={theme}
          guestMode={guestMode}
          currentUsername={currentUsername}
          requestAdminPassword={requestAdminPassword}
          onClose={() => setExportComponentProduct(null)}
          onExported={fetchProducts}
        />
      )}

      {/* Production Reports Modal */}
      {showProductionReports && (
        <Modal backdropClassName="bg-gray-600/50">
          <div className="mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Daily Production Reports</h3>
              <button
                onClick={() => {
                  setShowProductionReports(false)
                  setSelectedReport(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {loadingReports ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p className="mt-2 text-gray-600">Loading reports...</p>
              </div>
            ) : productionReports.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No production reports found</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Production</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {productionReports.map((report) => (
                        <tr key={report.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(report.date).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {report.total_production || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => setSelectedReport(report)}
                              className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                            >
                              <Eye className="h-4 w-4" />
                              <span>View Details</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Report Details Modal */}
      {selectedReport && (
        <Modal backdropClassName="bg-gray-600/50">
          <div className="mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Production Report - {new Date(selectedReport.date).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h3>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Total Production</p>
                <p className="text-2xl font-semibold text-gray-900">{selectedReport.total_production || 0}</p>
              </div>

              {/* Production Details List */}
              {selectedReport.production_details && Array.isArray(selectedReport.production_details) && selectedReport.production_details.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Production Items</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Production Quantity</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedReport.production_details.map((item: any, index: number) => (
                          <tr key={item.product_id || index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.product_name || 'Unknown Product'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.production || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <button
                                onClick={() => handleDeleteProductionItem(selectedReport.id, index)}
                                disabled={deletingItem === `${selectedReport.id}-${index}`}
                                className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                                title="Delete item"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>{deletingItem === `${selectedReport.id}-${index}` ? 'Deleting...' : 'Delete'}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-600">
                  <strong>Created:</strong> {new Date(selectedReport.created_at).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {cycleCountPanel && selectedBrand && (
        <ProductsCycleCountPanel
          selectedBrand={selectedBrand}
          products={cycleCountPanel.products}
          categoryScope={cycleCountPanel.categoryScope}
          scopeTitle={cycleCountPanel.scopeTitle}
          scopeDescription={cycleCountPanel.scopeDescription}
          groupByCategory={cycleCountPanel.groupByCategory}
          categorySortOrders={categorySortOrders}
          createdBy={currentUsername.trim() || 'Dashboard'}
          onClose={() => setCycleCountPanel(null)}
          onPosted={() => fetchProducts()}
        />
      )}

      {AdminPasswordModal}
    </div>
  )
}
