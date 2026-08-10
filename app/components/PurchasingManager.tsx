'use client'
import { Fragment, useCallback, useMemo, useState, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  supabase,
  Brand,
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  POPayment,
  DeliveryReceipt,
  DeliveryReceiptItem,
  PurchaseRequisition,
  PurchaseRequisitionItem,
  RawMaterial,
  FixedAsset,
  MaterialStockMovement,
  POStatusHistory,
  FactoryMaterialRequest,
  Product,
  POPurchaserTemplate,
  type FactoryInventoryKind,
  PROCUREMENT_PO_EDIT_KEY,
} from '../../lib/supabase'
import { Modal } from './Modal'
import { POPurchaserTemplateModal } from './POPurchaserTemplateModal'
import { ReceivingReportViewModal } from './ReceivingReportViewModal'
import {
  loadInvoiceMatchSummaryByPoIds,
  derivePaymentTimingFromTerms,
  isPaymentAfterDeliveryPo,
  matchSummaryNeedsPoAmendment,
  type PoInvoiceMatchSummary,
} from '../../lib/supplier-invoice-service'
import { InvoiceMatchIssuesPanel, InvoiceMatchStatusChip } from './ProcurementInvoiceMatchStatus'
import {
  getDefaultPurchaserTemplate,
  loadPurchaserTemplates,
  templateToPoPresetFields,
  arePoPaymentFieldsValid,
  sanitizePoPaymentFields,
  type PoPresetFields,
} from '../../lib/po-purchaser-template'
import {
  applyPoPaymentMethodChange,
  PoPaymentAccountFields,
} from './PoPaymentAccountFields'
import {
  isFactoryInventoryKind,
  FACTORY_INVENTORY_KINDS,
  FACTORY_INVENTORY_KIND_LABELS,
  mergeRawMaterialCategoryOptions,
} from '../../lib/factory-inventory'
import {
  FACTORY_REQUEST_MATERIAL_SELECT,
  factoryRequestQtyToStockUnits,
  formatFactoryRequestQtyDisplay,
  formatFactoryReleaseConfirmMessage,
  formatFactoryReleaseInsufficientStockMessage,
  baseUnitCost,
  formatStockAsPurchaseWithRemainder,
  formatStockUnitTotal,
  formatUnitHierarchyCost,
  resolveFactoryRequestMaterial,
  stockUnitCost,
  type FactoryBomUom,
  type FactoryRequestUom,
  isFactoryBomUom,
} from '../../lib/raw-material-uom'
import {
  canPrintReceivingReportBlank,
  openReceivingReportBlankPrintWindow,
} from '../../lib/print-receiving-report'
import {
  buildReceiptSuccessMessage,
  deriveReceiptCondition,
  formatConditionLabel,
  conditionBadgeClass,
  isPoFullyReceived,
  projectPoItemsAfterReceipt,
  resolvePoStatusAfterReceipt,
  validateReceiptLines,
  type ReceiptLineInput,
} from '../../lib/receiving-condition-service'
import { loadGfcMainStaff, type GfcMainStaff } from '../../lib/gfc-attendance'
import { useBrands } from '../contexts/BrandsContext'
import {
  canManagePlantMaterials,
  getFactoryBrand,
  isLegacyPlantMaterial,
} from '../../lib/brand-roles'
import {
  FranchisePerformanceFilter,
  type FranchiseFilterValue,
} from './FranchisePerformanceFilter'
import { isComponentMaterialCategory, syncComponentCostFromBom } from '../../lib/product-bom-component'
import { Package, History, Edit, Trash2, Clock, Boxes, Info, Search, Tag, ClipboardCheck, Eye, X, Lock, Printer, Upload, CheckCircle2, Circle, FileText } from 'lucide-react'
import { MaterialsCycleCountPanel } from './MaterialsCycleCountPanel'
import { MaterialTransfersPanel } from './MaterialTransfersPanel'
import { FixedAssetsPanel } from './FixedAssetsPanel'
import { getModuleReadOnlyBanner } from '../../lib/dashboard-roles'
import { ModuleEditGate, ModuleReadOnlyBanner } from './ModuleEditGate'
import { ModuleLockedNotice } from './ModuleLockedNotice'
import {
  getLockReason,
  getSubTabLabel,
  isSubTabLocked,
  type ModuleAccessLock,
} from '../../lib/module-access'

const EMPTY_ACCESS_LOCKS: ModuleAccessLock[] = []

interface PurchasingManagerProps {
  selectedBrand?: Brand | null
  theme?: string
  currentUsername?: string
  onNavigateToAccounting?: () => void
  readOnlyMode?: boolean
  accessLocks?: ModuleAccessLock[]
  bypassAccessLocks?: boolean
}

type Tab =
  | 'suppliers'
  | 'requisitions'
  | 'purchase_orders'
  | 'receiving_reports'
  | 'transactions'
  | 'raw_materials'
  | 'fixed_assets'
  | 'intercompany'

const PROCUREMENT_TABS: Tab[] = [
  'raw_materials',
  'fixed_assets',
  'intercompany',
  'purchase_orders',
  'receiving_reports',
  'requisitions',
  'suppliers',
  'transactions',
]

type POFormData = {
  supplier_id: string
  order_date: string
  expected_delivery_date: string
  purchasing_agent: string
  approved_by: string
  payment_terms: string
  payment_method: 'cash' | 'check' | 'bank_transfer'
  payment_timing: 'before_delivery' | 'after_delivery' | 'partial'
  payment_account_name: string
  payment_account_number: string
  delivery_address: string
  delivery_contact: string
  delivery_phone: string
  notes: string
}

function mergePoPresetIntoForm(
  prev: Partial<POFormData>,
  preset: PoPresetFields,
  options?: { keepPurchasingAgent?: string }
): Partial<POFormData> {
  return {
    ...prev,
    purchasing_agent: options?.keepPurchasingAgent || preset.purchasing_agent || prev.purchasing_agent || '',
    payment_terms: preset.payment_terms ?? prev.payment_terms ?? '',
    payment_method: preset.payment_method ?? prev.payment_method ?? 'bank_transfer',
    payment_timing: preset.payment_timing ?? prev.payment_timing ?? 'after_delivery',
    payment_account_name: preset.payment_account_name ?? prev.payment_account_name ?? '',
    payment_account_number: preset.payment_account_number ?? prev.payment_account_number ?? '',
    delivery_address: preset.delivery_address ?? prev.delivery_address ?? '',
    delivery_contact: preset.delivery_contact ?? prev.delivery_contact ?? '',
    delivery_phone: preset.delivery_phone ?? prev.delivery_phone ?? '',
    approved_by: preset.approved_by ?? prev.approved_by ?? '',
    notes: preset.notes ?? prev.notes ?? '',
  }
}

export function ownerBrandSlugMapFromBrands(brands: Brand[]) {
  return brands.reduce<Record<string, string>>((acc, brand) => {
    acc[brand.name] = brand.slug
    return acc
  }, {})
}

function isGfcMainOwnerOption(owner: string, ownerBrandSlugMap: Record<string, string>) {
  return (
    ownerBrandSlugMap[owner] === 'gfc' ||
    owner.trim().toLowerCase() === 'gfc main'
  )
}

export function sortOwnerOptions(names: string[], ownerBrandSlugMap: Record<string, string>) {
  return [...names].sort((a, b) => {
    const aGfcMain = isGfcMainOwnerOption(a, ownerBrandSlugMap)
    const bGfcMain = isGfcMainOwnerOption(b, ownerBrandSlugMap)
    if (aGfcMain !== bGfcMain) return aGfcMain ? -1 : 1
    return a.localeCompare(b)
  })
}

function getOwnerThemeClasses(owner: string, ownerBrandSlugMap: Record<string, string>) {
  if (isGfcMainOwnerOption(owner, ownerBrandSlugMap)) {
    return {
      chip: 'bg-blue-50 text-blue-800 border-blue-100',
      chipButton: 'hover:bg-blue-100 text-blue-600 hover:text-blue-900',
      option: 'hover:bg-blue-50 text-blue-700',
      groupHeader: 'bg-blue-50/90 text-blue-900',
      accentBorder: 'border-l-blue-500',
      badge: 'bg-blue-100 text-blue-800',
    }
  }

  const slug = ownerBrandSlugMap[owner]
  if (slug === 'mychoice') {
    return {
      chip: 'bg-green-50 text-green-800 border-green-100',
      chipButton: 'hover:bg-green-100 text-green-600 hover:text-green-900',
      option: 'hover:bg-green-50 text-green-900',
      groupHeader: 'bg-green-50/90 text-green-900',
      accentBorder: 'border-l-green-500',
      badge: 'bg-green-100 text-green-800',
    }
  }
  if (slug === 'gelatofilipino') {
    return {
      chip: 'bg-red-50 text-red-800 border-red-100',
      chipButton: 'hover:bg-red-100 text-red-600 hover:text-red-900',
      option: 'hover:bg-red-50 text-red-900',
      groupHeader: 'bg-red-50/90 text-red-900',
      accentBorder: 'border-l-red-500',
      badge: 'bg-red-100 text-red-800',
    }
  }
  if (slug === 'mang-sorbetes') {
    return {
      chip: 'bg-yellow-50 text-yellow-800 border-yellow-100',
      chipButton: 'hover:bg-yellow-100 text-yellow-600 hover:text-yellow-900',
      option: 'hover:bg-yellow-50 text-yellow-900',
      groupHeader: 'bg-yellow-50/90 text-yellow-900',
      accentBorder: 'border-l-yellow-500',
      badge: 'bg-yellow-100 text-yellow-800',
    }
  }
  return {
    chip: 'bg-blue-50 text-blue-800 border-blue-100',
    chipButton: 'hover:bg-blue-100 text-blue-600 hover:text-blue-900',
    option: 'hover:bg-gray-100 text-gray-900',
    groupHeader: 'bg-slate-50 text-slate-800',
    accentBorder: 'border-l-slate-400',
    badge: 'bg-slate-200 text-slate-700',
  }
}

function materialMatchesSearch(material: RawMaterial, query: string) {
  const haystack = [
    material.material_name,
    material.sku,
    material.category,
    material.supplier?.name,
    ...(material.owner ?? []),
    material.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function derivePaymentMethodFromTerms(terms: string): 'cash' | 'check' | 'bank_transfer' {
  const normalized = terms.toLowerCase()
  if (normalized.includes('cod') || normalized.includes('cash')) return 'cash'
  if (normalized.includes('check') || normalized.includes('cheque')) return 'check'
  return 'bank_transfer'
}

const PO_NUMBER_INPUT_NO_SPINNER =
  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

export function parseWholeQuantityInput(value: string) {
  const cleaned = String(value ?? '').replace(/,/g, '').trim()
  const parsed = parseInt(cleaned, 10)
  if (Number.isNaN(parsed) || parsed < 0) return 0
  return parsed
}

/** Money / unit-cost input: strips commas, keeps up to 2 decimal places. */
export function parseMoneyInput(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return 0
    return Math.round(value * 100) / 100
  }
  const cleaned = String(value ?? '').replace(/,/g, '').trim()
  if (!cleaned) return 0
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.round(parsed * 100) / 100
}

function getPurchaseUnit(material: Partial<RawMaterial>) {
  return material.uom_purchase_unit?.trim() || material.unit || ''
}

async function loadPoLineItemCatalog(brandId: string, supplierId: string | null) {
  let matsQuery = supabase
    .from('raw_materials')
    .select('*')
    .eq('brand_id', brandId)
    .eq('is_active', true)
    .order('material_name')
  let assetsQuery = supabase
    .from('fixed_assets')
    .select('*')
    .eq('brand_id', brandId)
    .eq('is_active', true)
    .order('asset_name')

  if (supplierId) {
    matsQuery = matsQuery.or(`supplier_id.eq.${supplierId},supplier_id.is.null`)
    assetsQuery = assetsQuery.or(`supplier_id.eq.${supplierId},supplier_id.is.null`)
  } else {
    matsQuery = matsQuery.is('supplier_id', null)
    assetsQuery = assetsQuery.is('supplier_id', null)
  }

  const [matsRes, assetsRes] = await Promise.all([matsQuery, assetsQuery])
  return {
    materials: (matsRes.data ?? []) as RawMaterial[],
    fixedAssets: (assetsRes.data ?? []) as FixedAsset[],
  }
}

function normalizePoSupplierId(supplierId?: string | null) {
  return supplierId?.trim() ? supplierId.trim() : null
}

function getStockUnitsPerPurchase(material: Partial<RawMaterial>) {
  const value = Math.floor(Number(material.uom_stock_per_purchase) || 1)
  return value > 0 ? value : 1
}

function factoryRequestHasSufficientStock(
  req: FactoryMaterialRequest,
  rawMaterials: RawMaterial[]
): boolean {
  const mat = resolveFactoryRequestMaterial(req, rawMaterials)
  if (!mat) return false
  const stock = Number(mat.current_stock) || 0
  const stockOut = factoryRequestQtyToStockUnits(Number(req.quantity), mat)
  return stock >= stockOut
}

function FactoryRequestInventoryStockCell({
  req,
  rawMaterials,
}: {
  req: FactoryMaterialRequest
  rawMaterials: RawMaterial[]
}) {
  const mat = resolveFactoryRequestMaterial(req, rawMaterials)
  if (!mat) return <span className="text-gray-400">—</span>

  const stockUnits = Math.max(0, Number(mat.current_stock) || 0)
  const stockOut = factoryRequestQtyToStockUnits(Number(req.quantity), mat)
  const inStock = stockUnits > 0
  const sufficient = stockUnits >= stockOut

  return (
    <div>
      <span
        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
          !inStock
            ? 'bg-red-100 text-red-800'
            : sufficient
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-900'
        }`}
      >
        {!inStock ? 'Out of stock' : sufficient ? 'In stock' : 'Insufficient'}
      </span>
      <div className="text-[11px] text-gray-600 tabular-nums mt-0.5 whitespace-nowrap">
        {formatStockAsPurchaseWithRemainder(stockUnits, mat)}
      </div>
      <div className="text-[10px] text-gray-400 tabular-nums whitespace-nowrap">
        {formatStockUnitTotal(stockUnits, mat)}
      </div>
    </div>
  )
}

function getStockUnitCost(material: Partial<RawMaterial>) {
  const purchaseCost = Number(material.unit_cost) || 0
  return purchaseCost / getStockUnitsPerPurchase(material)
}

/** Hide materials owned only by other brands (not shared with selected brand). */
function isExclusiveToOtherBrands(
  owners: string[],
  selectedBrandName: string,
  brandNames: Set<string>
) {
  const trimmed = owners.map((o) => o.trim()).filter(Boolean)
  if (trimmed.length === 0) return false
  if (trimmed.includes(selectedBrandName)) return false
  const brandOwners = trimmed.filter((o) => brandNames.has(o))
  if (brandOwners.length === 0) return false
  return true
}

type RawMaterialOwnerGroup = {
  owner: string
  totalCount: number
  totalValue: number
  categories: { category: string; materials: RawMaterial[] }[]
}

function sortMaterialsByName(list: RawMaterial[]) {
  return [...list].sort((a, b) => a.material_name.localeCompare(b.material_name))
}

function groupMaterialsByCategory(materials: RawMaterial[]) {
  const groups: Record<string, RawMaterial[]> = {}
  for (const material of materials) {
    const category = material.category?.trim() || 'Uncategorized'
    if (!groups[category]) groups[category] = []
    groups[category].push(material)
  }
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({
      category,
      materials: sortMaterialsByName(items),
    }))
}

function groupRawMaterialsByOwner(
  materials: RawMaterial[],
  selectedBrand: Brand,
  brands: Brand[]
): RawMaterialOwnerGroup[] {
  const brandNames = new Set(brands.map((b) => b.name))
  const selectedName = selectedBrand.name

  const visible = materials.filter((m) => {
    const owners = (m.owner ?? []).map((o) => o.trim()).filter(Boolean)
    return !isExclusiveToOtherBrands(owners, selectedName, brandNames)
  })

  const groups: Record<string, RawMaterial[]> = {}
  for (const material of visible) {
    const owners = (material.owner ?? []).map((o) => o.trim()).filter(Boolean)
    // Hide exclusive brand owner groups that aren't the selected brand.
    // - Brand owners: only group under selected brand (if included)
    // - Non-brand owners: keep as-is
    const brandOwners = owners.filter((o) => brandNames.has(o))
    const customOwners = owners.filter((o) => !brandNames.has(o))
    const keys =
      owners.length === 0
        ? ['No owner']
        : [
            ...customOwners,
            ...(brandOwners.includes(selectedName) ? [selectedName] : []),
          ].length > 0
          ? [...customOwners, ...(brandOwners.includes(selectedName) ? [selectedName] : [])]
          : ['No owner']
    for (const owner of keys) {
      if (!groups[owner]) groups[owner] = []
      if (!groups[owner].some((m) => m.id === material.id)) {
        groups[owner].push(material)
      }
    }
  }

  const customOwners = Object.keys(groups)
    .filter((k) => k !== 'No owner' && !brandNames.has(k))
    .sort((a, b) => a.localeCompare(b))

  const ownerOrder = [
    selectedName,
    ...customOwners,
    'No owner',
  ]

  const ordered: RawMaterialOwnerGroup[] = []
  const seen = new Set<string>()
  const pushOwnerGroup = (owner: string) => {
    const ownerMaterials = groups[owner]
    if (!ownerMaterials?.length || seen.has(owner)) return
    seen.add(owner)
    ordered.push({
      owner,
      totalCount: ownerMaterials.length,
      totalValue: ownerMaterials.reduce(
        (sum, material) => sum + Number(material.current_stock || 0) * getStockUnitCost(material),
        0
      ),
      categories: groupMaterialsByCategory(ownerMaterials),
    })
  }

  for (const key of ownerOrder) pushOwnerGroup(key)
  for (const key of Object.keys(groups).sort((a, b) => a.localeCompare(b))) {
    pushOwnerGroup(key)
  }
  return ordered
}

function HoverTooltipIcon({
  label,
  ariaLabel,
  tooltipClassName = 'max-w-xs',
  children,
}: {
  label: string
  ariaLabel: string
  tooltipClassName?: string
  children: React.ReactNode
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)

  const showTooltip = (e: React.FocusEvent<HTMLSpanElement> | React.MouseEvent<HTMLSpanElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top })
  }

  return (
    <>
      <span
        className="shrink-0 inline-flex rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        onMouseEnter={showTooltip}
        onMouseLeave={() => setTooltip(null)}
        onFocus={showTooltip}
        onBlur={() => setTooltip(null)}
        tabIndex={0}
        role="img"
        aria-label={ariaLabel}
      >
        {children}
      </span>
      {tooltip &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`fixed z-[9999] pointer-events-none -translate-x-1/2 -translate-y-full rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg ${tooltipClassName}`}
            style={{ left: tooltip.x, top: tooltip.y - 6 }}
          >
            {label}
          </div>,
          document.body
        )}
    </>
  )
}

function MultiOwnerIndicator({ owners }: { owners: string[] }) {
  const label = owners.join(', ')
  return (
    <HoverTooltipIcon label={label} ariaLabel={`Owners: ${label}`}>
      <Boxes className="h-4 w-4 text-gray-500 cursor-help" />
    </HoverTooltipIcon>
  )
}

function MaterialUnitHierarchyIndicator({ material }: { material: RawMaterial }) {
  const isComponent = isComponentMaterialCategory(material.category)
  const purchaseUnit =
    getPurchaseUnit(material) || (isComponent ? '(production unit)' : '(purchase unit)')
  const stockUnit = material.unit || '(stock unit)'
  const baseUnit = material.uom_base_unit?.trim() || '(base unit)'
  const stockPerPurchase = getStockUnitsPerPurchase(material)
  const basePerStock = Math.max(1, Math.floor(Number(material.uom_base_per_unit) || 1))
  const basePerPurchase = stockPerPurchase * basePerStock
  const purchaseCost = Number(material.unit_cost) || 0
  const stockCost = stockUnitCost(material)
  const baseCost = baseUnitCost(material)
  const primaryUnitLabel = isComponent ? 'Production' : 'Purchase'

  const notes = material.notes?.trim()
  const label = [
    `Units:`,
    `1 ${purchaseUnit} = ${stockPerPurchase} ${stockUnit}`,
    `1 ${stockUnit} = ${basePerStock} ${baseUnit}`,
    `1 ${purchaseUnit} = ${basePerPurchase} ${baseUnit}`,
    ``,
    `Costing:`,
    `${primaryUnitLabel}: ₱${formatUnitHierarchyCost(purchaseCost)} / ${purchaseUnit}`,
    `Stock: ₱${formatUnitHierarchyCost(stockCost)} / ${stockUnit}`,
    `Base: ₱${formatUnitHierarchyCost(baseCost)} / ${baseUnit}`,
    ...(notes ? ['', 'Notes:', notes] : []),
  ].join('\n')

  return (
    <HoverTooltipIcon
      label={label}
      ariaLabel={`Unit hierarchy and costing for ${material.material_name}`}
      tooltipClassName="max-w-sm whitespace-pre-wrap"
    >
      <Info className="h-4 w-4 text-gray-500 cursor-help" />
    </HoverTooltipIcon>
  )
}

/** Terminal PO statuses that may be deleted from the procurement list (in addition to draft). */
const DELETABLE_COMPLETED_PO_STATUSES: PurchaseOrder['status'][] = [
  'delivered',
  'paid',
  'closed',
  'cancelled',
]

function poIsAmendOnly(status: PurchaseOrder['status']): boolean {
  return status !== 'draft' && status !== 'pending_approval'
}

function canEditPurchaseOrder(
  po: PurchaseOrder,
  invMatch?: PoInvoiceMatchSummary
): boolean {
  if (po.status === 'draft' || po.status === 'pending_approval') return true
  if (!poIsAmendOnly(po.status)) return false
  return matchSummaryNeedsPoAmendment(invMatch)
}

function canClosePurchaseOrder(
  po: PurchaseOrder,
  invMatch?: PoInvoiceMatchSummary
): boolean {
  if (!['delivered', 'paid', 'in_transit'].includes(po.status)) return false
  if (invMatch?.status !== 'paid') return false
  if (po.status === 'in_transit') {
    return poItemsHaveReceipts(po.items || []) || isPoFullyReceived(po.items || [])
  }
  return true
}

function canMarkDelivered(po: PurchaseOrder): boolean {
  if (po.status !== 'in_transit') return false
  return isPoFullyReceived(po.items || [])
}

function canPrintPurchaseOrder(po: PurchaseOrder): boolean {
  return po.status !== 'cancelled'
}

function poItemsHaveReceipts(items: Partial<PurchaseOrderItem>[]): boolean {
  return items.some((item) => (Number(item.quantity_received) || 0) > 0)
}

/** Terminal requisition statuses that may be deleted from the procurement list. */
const DELETABLE_COMPLETED_PR_STATUSES: PurchaseRequisition['status'][] = [
  'converted',
  'rejected',
]

export function PurchasingManager({
  selectedBrand,
  theme = 'blue',
  currentUsername = '',
  onNavigateToAccounting,
  readOnlyMode = false,
  accessLocks = EMPTY_ACCESS_LOCKS,
  bypassAccessLocks = false,
}: PurchasingManagerProps) {
  const canEdit = !readOnlyMode
  const isProcurementTabLocked = useCallback(
    (tab: Tab) => !bypassAccessLocks && isSubTabLocked(accessLocks, 'purchasing', tab),
    [accessLocks, bypassAccessLocks]
  )
  const movementCreatedBy = currentUsername.trim() || 'Procurement'
  const { brands } = useBrands()
  const factoryBrand = useMemo(() => getFactoryBrand(brands), [brands])
  const plantMaterialsManagedHere = canManagePlantMaterials(selectedBrand)
  const [franchiseFilter, setFranchiseFilter] = useState<FranchiseFilterValue>('all')
  const isMaterialReadOnly = (material: RawMaterial) =>
    !plantMaterialsManagedHere &&
    isLegacyPlantMaterial(material, factoryBrand?.id)
  const [activeTab, setActiveTab] = useState<Tab>('raw_materials')
  
  // Suppliers state
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  
  // Purchase Orders state
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [showPOModal, setShowPOModal] = useState(false)
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null)
  const [poItems, setPOItems] = useState<Partial<PurchaseOrderItem>[]>([])
  const [supplierCatalog, setSupplierCatalog] = useState<RawMaterial[]>([])
  const [purchaserTemplates, setPurchaserTemplates] = useState<POPurchaserTemplate[]>([])
  const [showPurchaserTemplateModal, setShowPurchaserTemplateModal] = useState(false)
  
  // Payments state (read-only — recording is in Accounting)
  const [payments, setPayments] = useState<POPayment[]>([])
  
  // Deliveries state
  const [deliveries, setDeliveries] = useState<DeliveryReceipt[]>([])
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  const [selectedPOForDelivery, setSelectedPOForDelivery] = useState<PurchaseOrder | null>(null)
  const [invoiceMatchByPoId, setInvoiceMatchByPoId] = useState<Record<string, PoInvoiceMatchSummary>>({})
  const [receivingSearchTerm, setReceivingSearchTerm] = useState('')
  const [receivingMatchFilter, setReceivingMatchFilter] = useState<
    'all' | 'exception' | 'awaiting' | 'matched'
  >('all')
  const [receivingPage, setReceivingPage] = useState(1)
  const [viewingReceivingReportId, setViewingReceivingReportId] = useState<string | null>(null)
  
  // PO Details Modal state
  const [showPODetailsModal, setShowPODetailsModal] = useState(false)
  const [selectedPOForDetails, setSelectedPOForDetails] = useState<PurchaseOrder | null>(null)
  
  // Purchase Requisitions state
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([])
  const [showPRModal, setShowPRModal] = useState(false)
  const [convertingPR, setConvertingPR] = useState<PurchaseRequisition | null>(null)
  const [showConvertPRModal, setShowConvertPRModal] = useState(false)
  const [showPRDetailsModal, setShowPRDetailsModal] = useState(false)
  const [selectedPRForDetails, setSelectedPRForDetails] = useState<PurchaseRequisition | null>(null)
  
  // Raw Materials Inventory state
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])
  const [showMaterialModal, setShowMaterialModal] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null)
  const [showStockMovementModal, setShowStockMovementModal] = useState(false)
  const [selectedMaterialForMovement, setSelectedMaterialForMovement] = useState<RawMaterial | null>(null)
  const [showMovementHistory, setShowMovementHistory] = useState(false)
  const [selectedMaterialForHistory, setSelectedMaterialForHistory] = useState<RawMaterial | null>(null)
  const [movementHistory, setMovementHistory] = useState<MaterialStockMovement[]>([])
  const [factoryMaterialRequests, setFactoryMaterialRequests] = useState<FactoryMaterialRequest[]>([])
  const [inventoryProducts, setInventoryProducts] = useState<Product[]>([])
  const [releasingRequestId, setReleasingRequestId] = useState<string | null>(null)
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null)
  const [highlightedMaterialId, setHighlightedMaterialId] = useState<string | null>(null)
  const [rawMaterialsSearch, setRawMaterialsSearch] = useState('')
  const [rawMaterialsLoading, setRawMaterialsLoading] = useState(false)
  const [showCycleCountPanel, setShowCycleCountPanel] = useState(false)
  const inventoryRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Pagination
  const [currentPOPage, setCurrentPOPage] = useState(1)
  const [transactionPagination, setTransactionPagination] = useState<{ [supplierId: string]: number }>({})
  const PO_PER_PAGE = 10
  const RECEIVING_PER_PAGE = 10
  const TRANSACTIONS_PER_SUPPLIER = 5
  
  // Supplier Lead Times
  const [supplierLeadTimes, setSupplierLeadTimes] = useState<{ [supplierId: string]: { avgDays: number; completedPOs: number } }>({})

  
  const refreshPurchaserTemplates = async () => {
    if (!selectedBrand?.id) {
      setPurchaserTemplates([])
      return
    }
    try {
      setPurchaserTemplates(await loadPurchaserTemplates(selectedBrand.id))
    } catch (err) {
      console.error('Error loading purchaser templates:', err)
    }
  }

  useEffect(() => {
    loadSuppliers()
    loadPurchaseOrders()
    loadPayments()
    loadDeliveries()
    loadRequisitions()
    loadRawMaterials()
    loadFactoryMaterialRequests()
    loadInventoryProducts()
    refreshPurchaserTemplates()
  }, [selectedBrand])

  const openNewPO = () => {
    if (!canEdit) return
    setEditingPO(null)
    setPOItems([])
    setShowPOModal(true)
  }

  const openPOForEdit = (po: PurchaseOrder) => {
    if (!canEdit) return
    setEditingPO(po)
    setPOItems(po.items || [])
    setShowPOModal(true)
  }

  useEffect(() => {
    if (typeof window === 'undefined' || purchaseOrders.length === 0) return
    const poId = localStorage.getItem(PROCUREMENT_PO_EDIT_KEY)
    if (!poId) return
    localStorage.removeItem(PROCUREMENT_PO_EDIT_KEY)
    const po = purchaseOrders.find((row) => row.id === poId)
    if (!po) return
    setActiveTab('purchase_orders')
    if (canEdit && canEditPurchaseOrder(po, invoiceMatchByPoId[po.id])) {
      openPOForEdit(po)
    }
  }, [purchaseOrders, invoiceMatchByPoId, canEdit])
  
  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPOPage(1)
  }, [statusFilter, searchTerm])

  useEffect(() => {
    setReceivingPage(1)
  }, [receivingSearchTerm, receivingMatchFilter])

  useEffect(() => {
    if (!highlightedMaterialId || activeTab !== 'raw_materials') return
    inventoryRowRefs.current[highlightedMaterialId]?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    })
  }, [highlightedMaterialId, activeTab])
  
  // Calculate supplier lead times when suppliers tab is active
  useEffect(() => {
    if (activeTab === 'suppliers') {
      calculateSupplierLeadTimes()
    }
  }, [activeTab, selectedBrand])

  // Developer locks: leave a tab that gets locked while it is open.
  useEffect(() => {
    if (!isProcurementTabLocked(activeTab)) return
    const fallback = PROCUREMENT_TABS.find((tab) => !isProcurementTabLocked(tab))
    if (fallback) setActiveTab(fallback)
  }, [activeTab, isProcurementTabLocked])
  
  // =============================================
  // LOAD DATA FUNCTIONS
  // =============================================
  
  const loadSuppliers = async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name')
    if (data) setSuppliers(data)
  }
  
  const loadPurchaseOrders = async () => {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:suppliers(*),
        requisition:purchase_requisitions(id, pr_number),
        payments:po_payments(*)
      `)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error loading purchase orders:', error)
      return
    }

    const poList = (data || []) as PurchaseOrder[]
    if (poList.length === 0) {
      setPurchaseOrders([])
      return
    }

    const poIds = poList.map(po => po.id)
    const { data: itemsData, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select('*, material:raw_materials(*), fixed_asset:fixed_assets(*)')
      .in('po_id', poIds)

    if (itemsError) {
      console.error('Error loading purchase order items:', itemsError)
    }

    const itemsByPoId: Record<string, PurchaseOrderItem[]> = {}
    ;(itemsData || []).forEach((item) => {
      if (!itemsByPoId[item.po_id]) itemsByPoId[item.po_id] = []
      itemsByPoId[item.po_id].push(item as PurchaseOrderItem)
    })

    const purchaseOrdersWithItems = poList.map((po) => ({
      ...po,
      items: itemsByPoId[po.id] || []
    }))

    const fullyReceivedInTransit = purchaseOrdersWithItems.filter(
      (po) => po.status === 'in_transit' && isPoFullyReceived(po.items || [])
    )
    if (fullyReceivedInTransit.length > 0) {
      await Promise.all(
        fullyReceivedInTransit.map((po) =>
          supabase.from('purchase_orders').update({ status: 'delivered' }).eq('id', po.id)
        )
      )
      for (const po of fullyReceivedInTransit) {
        po.status = 'delivered'
      }
    }

    const statusMap = await loadInvoiceMatchSummaryByPoIds(poIds, selectedBrand?.id)
    setInvoiceMatchByPoId(statusMap)

    setPurchaseOrders(purchaseOrdersWithItems as PurchaseOrder[])
  }
  
  const loadPayments = async () => {
    const { data, error } = await supabase
      .from('po_payments')
      .select(`
        *,
        purchase_order:purchase_orders(po_number, status, supplier:suppliers(id, name))
      `)
      .order('payment_date', { ascending: false })
    
    if (data) setPayments(data as POPayment[])
  }
  
  const loadDeliveries = async () => {
    // Get all POs
    const { data: pos } = await supabase
      .from('purchase_orders')
      .select('id, po_number, supplier_id, status')
    
    if (!pos || pos.length === 0) {
      setDeliveries([])
      return
    }
    
    const poIds = pos.map(p => p.id)
    
    // Get deliveries without nested relationships
    const { data: deliveriesData, error } = await supabase
      .from('delivery_receipts')
      .select('*')
      .in('po_id', poIds)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error loading deliveries:', error)
      return
    }
    
    if (!deliveriesData || deliveriesData.length === 0) {
      setDeliveries([])
      return
    }
    
    // Get suppliers
    const supplierIds = pos.map(p => p.supplier_id).filter(Boolean)
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, name')
      .in('id', supplierIds)
    
    // Manually join the data
    const deliveriesWithDetails = deliveriesData.map(delivery => {
      const po = pos.find(p => p.id === delivery.po_id)
      const supplier = suppliers?.find(s => s.id === po?.supplier_id)
      
      return {
        ...delivery,
        purchase_order: {
          po_number: po?.po_number || '',
          status: po?.status || 'draft',
          supplier: {
            id: supplier?.id || '',
            name: supplier?.name || ''
          }
        }
      }
    })
    
    setDeliveries(deliveriesWithDetails as any)
  }
  
  const loadRequisitions = async () => {
    const { data, error } = await supabase
      .from('purchase_requisitions')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (data) setRequisitions(data)
  }
  
  const loadRawMaterials = async () => {
    setRawMaterialsLoading(true)
    try {
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*, supplier:suppliers(*)')
        .order('supplier_id', { ascending: true, nullsFirst: false })
        .order('material_name')

      if (error) {
        console.error('Error loading raw materials:', error)
        return
      }

      if (data) setRawMaterials(data as RawMaterial[])
    } finally {
      setRawMaterialsLoading(false)
    }
  }

  const loadInventoryProducts = async () => {
    if (!selectedBrand?.id) {
      setInventoryProducts([])
      return
    }

    const { data, error } = await supabase
      .from('inventory_summary')
      .select('product_id, product_name, sku, unit, category, brand_id')
      .eq('brand_id', selectedBrand.id)
      .order('category', { ascending: true })
      .order('product_name', { ascending: true })

    if (error) {
      console.error('Error loading inventory products for raw material linking:', error)
      setInventoryProducts([])
      return
    }

    if (data) {
      const mappedProducts: Product[] = data
        .filter((row) => Boolean(row.product_id))
        .map((row) => ({
          id: row.product_id,
          product_id: row.product_id,
          brand_id: row.brand_id,
          product_name: row.product_name,
          sku: row.sku || undefined,
          unit: row.unit,
          category: row.category || undefined,
        }))
      setInventoryProducts(mappedProducts)
    }
  }

  const loadFactoryMaterialRequests = async () => {
    const { data } = await supabase
      .from('factory_material_requests')
      .select(`*, material:raw_materials(${FACTORY_REQUEST_MATERIAL_SELECT})`)
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) setFactoryMaterialRequests(data as FactoryMaterialRequest[])
  }

  const releaseFactoryMaterialRequest = async (req: FactoryMaterialRequest) => {
    if (!canEdit) return
    const mat = resolveFactoryRequestMaterial(req, rawMaterials)
    const stock = mat ? Number(mat.current_stock) : 0
    const requestQty = Number(req.quantity)
    const stockOut = mat ? factoryRequestQtyToStockUnits(requestQty, mat) : requestQty
    if (stock < stockOut) {
      alert(
        mat
          ? formatFactoryReleaseInsufficientStockMessage(requestQty, mat)
          : 'Insufficient stock.'
      )
      return
    }
    if (
      !confirm(
        mat
          ? formatFactoryReleaseConfirmMessage(
              requestQty,
              mat,
              mat.material_name || req.material?.material_name || 'material'
            )
          : `Release ${requestQty} to factory?`
      )
    ) {
      return
    }
    setReleasingRequestId(req.id)
    try {
      const { data: factoryMovement, error: movErr } = await supabase
        .from('material_stock_movements')
        .insert({
          material_id: req.material_id,
          movement_type: 'out',
          quantity: stockOut,
          reference_type: 'factory_request',
          reference_id: req.id,
          reference_number: `FMR-${req.id.slice(0, 8)}`,
          notes: `Factory floor release${req.requested_by ? ` — requested by ${req.requested_by}` : ''}`,
          movement_date: new Date().toISOString().split('T')[0],
          created_by: movementCreatedBy,
        })
        .select('id')
        .single()
      if (movErr) {
        alert(movErr.message)
        return
      }
      const postingBrandId = mat?.brand_id || factoryBrand?.id || selectedBrand?.id
      if (factoryMovement?.id && postingBrandId) {
        const { postFactoryMaterialReleaseJournalWithNotice } = await import(
          '../../lib/accounting-factory-wip-posting'
        )
        await postFactoryMaterialReleaseJournalWithNotice(
          req.id,
          factoryMovement.id,
          postingBrandId,
          movementCreatedBy
        )
      }
      const { error: updErr } = await supabase
        .from('factory_material_requests')
        .update({
          status: 'released',
          released_at: new Date().toISOString(),
          released_by: movementCreatedBy,
        })
        .eq('id', req.id)
      if (updErr) {
        alert(updErr.message)
        return
      }
      await loadRawMaterials()
      await loadFactoryMaterialRequests()
    } finally {
      setReleasingRequestId(null)
    }
  }

  const cancelFactoryMaterialRequest = async (req: FactoryMaterialRequest) => {
    if (!canEdit) return
    if (req.status !== 'pending') return
    if (!confirm('Cancel this factory material request? It will be removed from the pending queue.')) return
    setCancellingRequestId(req.id)
    try {
      const { data, error } = await supabase
        .from('factory_material_requests')
        .update({ status: 'cancelled' })
        .eq('id', req.id)
        .eq('status', 'pending')
        .select('id')
      if (error) {
        alert(error.message)
        return
      }
      if (!data?.length) {
        alert('This request is no longer pending (it may have been released or cancelled already).')
      }
      await loadFactoryMaterialRequests()
    } finally {
      setCancellingRequestId(null)
    }
  }

  const loadMovementHistory = async (materialId: string) => {
    const { data, error } = await supabase
      .from('material_stock_movements')
      .select('*')
      .eq('material_id', materialId)
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false })
    
    if (data) setMovementHistory(data)
  }
  
  const calculateSupplierLeadTimes = async () => {
    // Get all completed/delivered POs with their status history
    const { data: completedPOs } = await supabase
      .from('purchase_orders')
      .select('id, supplier_id, created_at')
      .in('status', ['delivered', 'paid', 'closed'])
    
    if (!completedPOs || completedPOs.length === 0) return
    
    const leadTimeData: { [supplierId: string]: { totalDays: number; count: number } } = {}
    
    for (const po of completedPOs) {
      if (!po.supplier_id) continue
      // Get status history for this PO
      const { data: history } = await supabase
        .from('po_status_history')
        .select('new_status, created_at')
        .eq('po_id', po.id)
        .order('created_at', { ascending: true })
      
      if (!history || history.length === 0) continue
      
      // Find when PO was created (approved/order_confirmed) and when delivered
      const startStatus = history.find(h => ['approved', 'order_confirmed'].includes(h.new_status))
      const deliveredStatus = history.find(h => h.new_status === 'delivered')
      
      if (startStatus && deliveredStatus) {
        const startDate = new Date(startStatus.created_at!)
        const endDate = new Date(deliveredStatus.created_at!)
        const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        
        if (!leadTimeData[po.supplier_id]) {
          leadTimeData[po.supplier_id] = { totalDays: 0, count: 0 }
        }
        leadTimeData[po.supplier_id].totalDays += diffDays
        leadTimeData[po.supplier_id].count += 1
      }
    }
    
    // Calculate averages
    const avgLeadTimes: { [supplierId: string]: { avgDays: number; completedPOs: number } } = {}
    for (const [supplierId, data] of Object.entries(leadTimeData)) {
      avgLeadTimes[supplierId] = {
        avgDays: Math.round(data.totalDays / data.count),
        completedPOs: data.count
      }
    }
    
    setSupplierLeadTimes(avgLeadTimes)
  }
  
  // =============================================
  // VIEW PO DETAILS FUNCTION
  // =============================================
  
  const viewPODetails = async (poId: string) => {
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('*, supplier:suppliers(*), requisition:purchase_requisitions(id, pr_number), items:purchase_order_items(*, material:raw_materials(*), fixed_asset:fixed_assets(*)), payments:po_payments(*)')
      .eq('id', poId)
      .single()
    
    if (po) {
      setSelectedPOForDetails(po as PurchaseOrder)
      setShowPODetailsModal(true)
    }
  }

  const viewPRDetails = async (prId: string) => {
    const { data: pr, error } = await supabase
      .from('purchase_requisitions')
      .select('*, items:purchase_requisition_items(*)')
      .eq('id', prId)
      .single()

    if (error) {
      console.error('Error loading requisition details:', error)
      alert(`Could not load requisition details: ${error.message}`)
      return
    }

    if (pr) {
      setSelectedPRForDetails(pr as PurchaseRequisition)
      setShowPRDetailsModal(true)
    }
  }

  const openReferencedRequisition = (prId: string) => {
    setActiveTab('requisitions')
    viewPRDetails(prId)
  }
  
  // =============================================
  // PRINT FUNCTIONS
  // =============================================
  
  const printPO = async (po: PurchaseOrder) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    let printItems = po.items || []
    if (printItems.length === 0) {
      const { data: fetchedItems, error: fetchedItemsError } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('po_id', po.id)
        .order('created_at', { ascending: true })

      if (fetchedItemsError) {
        console.error('Error loading PO items for print:', fetchedItemsError)
      } else {
        printItems = (fetchedItems || []) as PurchaseOrderItem[]
      }
    }

    const itemsTable = printItems.map((item, index) => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${item.product_description}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.unit}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">₱${item.unit_price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">₱${(item.quantity * item.unit_price).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
      </tr>
    `).join('')
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Order - ${po.po_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #111827;
          }
          .company-name {
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.4px;
          }
          .doc-info {
            text-align: right;
          }
          .doc-title {
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 4px;
          }
          .po-number {
            font-size: 14px;
            font-weight: 600;
          }
          body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #111827;
            padding: 0.5in 0.5in 0.5in 0.25in;
            margin: 0;
            background: #fff;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 14px;
          }
          .info-section {
            border: 1px solid #d1d5db;
            padding: 10px;
            background: #fff;
          }
          .section-title {
            font-weight: 700;
            font-size: 11px;
            text-transform: uppercase;
            margin-bottom: 6px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 3px;
            color: #374151;
          }
          .info-line { margin-bottom: 4px; }
          .info-label {
            color: #6b7280;
            font-size: 11px;
            margin-right: 4px;
          }
          .info-value { font-weight: 600; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
          }
          th, td {
            border: 1px solid #d1d5db;
            padding: 7px 6px;
          }
          th {
            background: #f3f4f6;
            font-size: 10px;
            text-transform: uppercase;
            font-weight: 700;
          }
          td { font-size: 11px; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .totals {
            margin-top: 10px;
            margin-left: auto;
            width: 300px;
            border: 1px solid #d1d5db;
            padding: 10px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
          }
          .grand-total {
            border-top: 1px solid #d1d5db;
            margin-top: 6px;
            padding-top: 6px;
            font-weight: 700;
            font-size: 13px;
          }
          .notes {
            margin-top: 10px;
            border: 1px solid #d1d5db;
            padding: 10px;
          }
          .signatures {
            display: flex;
            gap: 24px;
            margin-top: 38px;
            page-break-inside: avoid;
          }
          .signature-box { flex: 1; }
          .signature-line {
            border-top: 1px solid #111827;
            margin-top: 28px;
            padding-top: 4px;
            font-size: 11px;
          }
          .signature-label {
            font-size: 10px;
            color: #6b7280;
            text-transform: uppercase;
          }
          .footer {
            text-align: center;
            margin-top: 14px;
            padding-top: 8px;
            border-top: 1px solid #e5e7eb;
            font-size: 9px;
            color: #6b7280;
          }
          @page { size: letter; margin: 0.5in 0.5in 0.5in 0.25in; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company-name">GILNAKS FOOD CORPORATION</div>
          </div>
          <div class="doc-info">
            <div class="doc-title">PURCHASE ORDER</div>
            <div class="po-number">${po.po_number}</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-section">
            <div class="section-title">Supplier / Billing Address</div>
            <div class="info-line"><span class="info-label">Name:</span><span class="info-value">${po.supplier?.name || 'No supplier'}</span></div>
            ${po.supplier?.contact_person ? `<div class="info-line"><span class="info-label">Contact:</span><span class="info-value">${po.supplier.contact_person}</span></div>` : ''}
            ${po.supplier?.phone ? `<div class="info-line"><span class="info-label">Phone:</span><span class="info-value">${po.supplier.phone}</span></div>` : ''}
            ${po.supplier?.address ? `<div class="info-line"><span class="info-label">Address:</span><span class="info-value">${po.supplier.address}</span></div>` : `<div class="info-line"><span class="info-label">Address:</span><span class="info-value">N/A</span></div>`}
          </div>
          <div class="info-section">
            <div class="section-title">Payment Information</div>
            <div class="info-line"><span class="info-label">Terms:</span><span class="info-value">${po.payment_terms || 'Net 30 days'}</span></div>
            <div class="info-line"><span class="info-label">Method:</span><span class="info-value">${po.payment_method?.replace('_', ' ') || 'N/A'}</span></div>
            ${po.payment_account_name ? `<div class="info-line"><span class="info-label">Account name:</span><span class="info-value">${po.payment_account_name}</span></div>` : ''}
            ${po.payment_account_number ? `<div class="info-line"><span class="info-label">Account no.:</span><span class="info-value">${po.payment_account_number}</span></div>` : ''}
            <div class="info-line"><span class="info-label">Timing:</span><span class="info-value">${po.payment_timing?.replace('_', ' ') || 'N/A'}</span></div>
          </div>
          <div class="info-section">
            <div class="section-title">Purchase Order Details</div>
            <div class="info-line"><span class="info-label">Order Date:</span><span class="info-value">${new Date(po.order_date).toLocaleDateString()}</span></div>
            <div class="info-line"><span class="info-label">Expected Delivery:</span><span class="info-value">${po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : 'TBD'}</span></div>
            <div class="info-line"><span class="info-label">Prepared by:</span><span class="info-value">${po.purchasing_agent || 'N/A'}</span></div>
            ${po.approved_by ? `<div class="info-line"><span class="info-label">Approved by:</span><span class="info-value">${po.approved_by}</span></div>` : ''}
            <div class="info-line"><span class="info-label">Status:</span><span class="info-value">${(po.status || 'draft').replace('_', ' ')}</span></div>
          </div>
          <div class="info-section">
            <div class="section-title">Delivery Address</div>
            <div class="info-line"><span class="info-label">Address:</span><span class="info-value">${po.delivery_address || 'N/A'}</span></div>
            <div class="info-line"><span class="info-label">Contact:</span><span class="info-value">${po.delivery_contact || 'N/A'}</span></div>
            <div class="info-line"><span class="info-label">Phone:</span><span class="info-value">${po.delivery_phone || 'N/A'}</span></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 34px;">#</th>
              <th>Product Description</th>
              <th style="width: 62px;" class="text-center">Qty</th>
              <th style="width: 64px;" class="text-center">Unit</th>
              <th style="width: 110px;" class="text-right">Unit Price</th>
              <th style="width: 120px;" class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsTable}
          </tbody>
        </table>

        <div class="totals">
          ${po.tax_amount > 0 ? `
          <div class="total-row"><span>Subtotal</span><span>₱${po.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
          <div class="total-row"><span>Tax</span><span>₱${po.tax_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
          ` : ''}
          <div class="total-row grand-total"><span>TOTAL AMOUNT</span><span>₱${po.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
        </div>

        ${po.notes ? `
        <div class="notes">
          <div class="section-title">Notes</div>
          <div>${po.notes}</div>
        </div>
        ` : ''}

        <div class="signatures">
          <div class="signature-box">
            <div class="signature-line">${po.purchasing_agent || ''}</div>
            <div class="signature-label">Prepared by</div>
          </div>
          <div class="signature-box">
            <div class="signature-line">${po.approved_by || ''}</div>
            <div class="signature-label">Approved by</div>
          </div>
          <div class="signature-box">
            <div class="signature-line">${po.approved_date ? new Date(po.approved_date).toLocaleDateString() : ''}</div>
            <div class="signature-label">Approved Date</div>
          </div>
        </div>

        <div class="footer">
          Generated on ${new Date().toLocaleString()}
        </div>
        
        <script>
          window.addEventListener('afterprint', function () {
            window.close();
          });
          window.addEventListener('load', function () {
            setTimeout(function () {
              window.print();
            }, 150);
          });
        </script>
      </body>
      </html>
    `
    
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
  }

  const printReceivingReportBlank = async (po: PurchaseOrder) => {
    let printItems = po.items || []
    if (printItems.length === 0) {
      const { data: fetchedItems, error: fetchedItemsError } = await supabase
        .from('purchase_order_items')
        .select('*, material:raw_materials(*)')
        .eq('po_id', po.id)
        .order('created_at', { ascending: true })

      if (fetchedItemsError) {
        console.error('Error loading PO items for receiving report print:', fetchedItemsError)
        alert('Could not load PO items for printing.')
        return
      }
      printItems = (fetchedItems || []) as PurchaseOrderItem[]
    }

    const ok = openReceivingReportBlankPrintWindow(po, printItems)
    if (!ok) alert('Allow pop-ups to print the receiving report.')
  }
  
  // =============================================
  // SUPPLIER CRUD FUNCTIONS
  // =============================================
  
  const saveSupplier = async (supplier: Partial<Supplier>) => {
    if (!canEdit) return
    if (editingSupplier) {
      const { error } = await supabase
        .from('suppliers')
        .update(supplier)
        .eq('id', editingSupplier.id)
    } else {
      const { error } = await supabase
        .from('suppliers')
        .insert([supplier])
    }
    
    setShowSupplierModal(false)
    setEditingSupplier(null)
    loadSuppliers()
  }
  
  const deleteSupplier = async (id: string) => {
    if (!canEdit) return
    if (!confirm('Are you sure you want to delete this supplier?')) return
    
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id)
    
    loadSuppliers()
  }
  
  // =============================================
  // PURCHASE ORDER FUNCTIONS
  // =============================================
  
  const generatePONumber = () => {
    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const random = Math.floor(Math.random() * 9000) + 1000
    return `PO-${year}${random}`
  }
  
  const savePurchaseOrder = async (poData: Partial<POFormData>) => {
    if (!canEdit) return
    if (!selectedBrand) return

    const paymentFields = sanitizePoPaymentFields(
      poData.payment_method,
      poData.payment_account_name,
      poData.payment_account_number
    )

    const normalizedPoData = {
      ...poData,
      ...paymentFields,
      supplier_id: normalizePoSupplierId(poData.supplier_id),
      payment_timing: derivePaymentTimingFromTerms(
        poData.payment_terms,
        poData.payment_timing
      ),
    }

    if (editingPO) {
      const amendOnly = poIsAmendOnly(editingPO.status)
      const existingItems = editingPO.items || []

      if (amendOnly && !matchSummaryNeedsPoAmendment(invoiceMatchByPoId[editingPO.id])) {
        alert('This purchase order has no PO quantity or price mismatch to fix.')
        return
      }

      if (amendOnly) {
        for (const item of poItems) {
          const received = Number(item.quantity_received) || 0
          const qty = Number(item.quantity) || 0
          if (received > 0 && qty < received) {
            alert(
              `Quantity for "${item.product_description}" cannot be less than already received (${received}).`
            )
            return
          }
        }

        const { error: headerError } = await supabase
          .from('purchase_orders')
          .update(normalizedPoData)
          .eq('id', editingPO.id)

        if (headerError) {
          alert(`Error updating PO: ${headerError.message}`)
          return
        }

        const keptIds = new Set(
          poItems.map((item) => item.id).filter((id): id is string => Boolean(id))
        )

        for (const existing of existingItems) {
          if (keptIds.has(existing.id)) continue
          const received = Number(existing.quantity_received) || 0
          if (received > 0) {
            alert(
              `Cannot remove "${existing.product_description}" — ${received} already received.`
            )
            return
          }
          await supabase.from('purchase_order_items').delete().eq('id', existing.id)
        }

        for (const item of poItems) {
          const unitPrice =
            typeof item.unit_price === 'string'
              ? parseFloat(item.unit_price) || 0
              : Number(item.unit_price) || 0
          const quantity = Number(item.quantity) || 0

          if (item.id) {
            const { error } = await supabase
              .from('purchase_order_items')
              .update({ quantity, unit_price: unitPrice })
              .eq('id', item.id)
            if (error) {
              alert(`Error updating line item: ${error.message}`)
              return
            }
          } else {
            const { error } = await supabase.from('purchase_order_items').insert({
              product_description: item.product_description,
              quantity,
              unit: item.unit,
              unit_price: unitPrice,
              notes: item.notes || null,
              material_id: item.fixed_asset_id ? null : item.material_id || null,
              fixed_asset_id: item.material_id ? null : item.fixed_asset_id || null,
              po_id: editingPO.id,
            })
            if (error) {
              alert(`Error adding line item: ${error.message}`)
              return
            }
          }
        }
      } else {
        const { error } = await supabase
          .from('purchase_orders')
          .update(normalizedPoData)
          .eq('id', editingPO.id)

        if (error) {
          alert(`Error updating PO: ${error.message}`)
          return
        }

        if (poItems.length > 0) {
          await supabase.from('purchase_order_items').delete().eq('po_id', editingPO.id)

          const itemsToInsert = poItems.map((item) => ({
            ...item,
            unit_price:
              typeof item.unit_price === 'string'
                ? parseFloat(item.unit_price) || 0
                : item.unit_price,
            material_id: item.fixed_asset_id ? null : item.material_id || null,
            fixed_asset_id: item.material_id ? null : item.fixed_asset_id || null,
            po_id: editingPO.id,
          }))
          const { error: itemsError } = await supabase
            .from('purchase_order_items')
            .insert(itemsToInsert)
          if (itemsError) {
            alert(`Error updating items: ${itemsError.message}`)
            return
          }
        }
      }
    } else {
      // Create new PO - Clean up empty strings to null for optional fields
      const po = {
        po_number: generatePONumber(),
        supplier_id: normalizedPoData.supplier_id,
        brand_id: selectedBrand.id,
        order_date: poData.order_date || new Date().toISOString().split('T')[0],
        expected_delivery_date: poData.expected_delivery_date || null,
        purchasing_agent: poData.purchasing_agent,
        approved_by: poData.approved_by?.trim() || null,
        payment_terms: poData.payment_terms || null,
        payment_method: poData.payment_method || 'bank_transfer',
        payment_timing: derivePaymentTimingFromTerms(
          poData.payment_terms,
          poData.payment_timing
        ),
        ...sanitizePoPaymentFields(
          poData.payment_method,
          poData.payment_account_name,
          poData.payment_account_number
        ),
        delivery_address: poData.delivery_address || null,
        delivery_contact: poData.delivery_contact || null,
        delivery_phone: poData.delivery_phone || null,
        notes: poData.notes || null,
        status: 'draft',
        subtotal: 0,
        tax_amount: 0,
        total_amount: 0,
        paid_amount: 0,
        balance_amount: 0
      }
      
      console.log('Creating PO with data:', po)
      
      const { data: newPO, error } = await supabase
        .from('purchase_orders')
        .insert([po])
        .select()
        .single()
      
      if (error) {
        console.error('Error creating PO:', error)
        alert(`Error creating PO: ${error.message}`)
        return
      }
      
      console.log('PO created successfully:', newPO)
      
      if (newPO && poItems.length > 0) {
        const itemsToInsert = poItems.map(item => ({
          product_description: item.product_description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: typeof item.unit_price === 'string' ? parseFloat(item.unit_price) || 0 : item.unit_price,
          notes: item.notes || null,
          material_id: item.fixed_asset_id ? null : item.material_id || null,
          fixed_asset_id: item.material_id ? null : item.fixed_asset_id || null,
          po_id: newPO.id
        }))
        
        console.log('Inserting items:', itemsToInsert)
        
        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(itemsToInsert)
        
        if (itemsError) {
          console.error('Error inserting items:', itemsError)
          alert(`Error adding items: ${itemsError.message}`)
        }
      }
    }
    
    setShowPOModal(false)
    setEditingPO(null)
    setPOItems([])
    loadPurchaseOrders()
  }
  
  const updatePOStatus = async (poId: string, newStatus: string) => {
    if (!canEdit) return
    // If closing PO, check if delivery receipt exists
    if (newStatus === 'closed') {
      const invMatch = invoiceMatchByPoId[poId]
      if (invMatch?.status !== 'paid') {
        const { data: latestInvoice } = await supabase
          .from('supplier_invoices')
          .select('status')
          .eq('po_id', poId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latestInvoice?.status !== 'paid') {
          alert(
            'Cannot close PO: Payment has not been recorded in Accounting.\n\nEnter the supplier invoice, create a payment voucher, and mark it as paid first.'
          )
          return
        }
      }

      const { data: deliveries } = await supabase
        .from('delivery_receipts')
        .select('id, delivery_receipt_url')
        .eq('po_id', poId)
      
      if (!deliveries || deliveries.length === 0) {
        alert('Cannot close PO: No delivery receipt recorded.\n\nPlease record a delivery first.')
        return
      }
      
      const hasReceipt = deliveries.some(d => d.delivery_receipt_url && d.delivery_receipt_url.trim() !== '')
      if (!hasReceipt) {
        alert('Cannot close PO: Delivery receipt URL is missing.\n\nPlease add the delivery receipt attachment before closing.')
        return
      }
    }
    
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: newStatus })
      .eq('id', poId)
    
    if (error) {
      alert(`Error updating PO status: ${error.message}`)
      return
    }
    
    loadPurchaseOrders()
  }
  
  const deletePurchaseOrder = async (id: string, poNumber: string) => {
    if (!canEdit) return
    if (!confirm(`Delete PO ${poNumber}?\n\nThis will permanently delete:\n• Purchase order\n• All items\n• Payment records\n• Delivery receipts\n• Status history\n\nThis cannot be undone.`)) return
    
    const { error } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', id)
    
    if (error) {
      alert(`Error deleting PO: ${error.message}`)
    } else {
      loadPurchaseOrders()
    }
  }

  const deletePurchaseRequisition = async (pr: PurchaseRequisition) => {
    if (!canEdit) return
    const linkedPO = purchaseOrders.find((po) => po.pr_id === pr.id)
    const linkedNote = linkedPO
      ? `\n\nLinked PO ${linkedPO.po_number} will remain; its requisition reference will be cleared.`
      : ''
    if (
      !confirm(
        `Delete requisition ${pr.pr_number}?\n\nThis will permanently delete the requisition and all line items.${linkedNote}\n\nThis cannot be undone.`
      )
    ) {
      return
    }

    const { error } = await supabase
      .from('purchase_requisitions')
      .delete()
      .eq('id', pr.id)

    if (error) {
      alert(`Error deleting requisition: ${error.message}`)
    } else {
      if (selectedPRForDetails?.id === pr.id) {
        setShowPRDetailsModal(false)
        setSelectedPRForDetails(null)
      }
      loadRequisitions()
      loadPurchaseOrders()
    }
  }
  
  // =============================================
  // DELIVERY FUNCTIONS
  // =============================================
  
  const generateDeliveryNumber = () => {
    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const random = Math.floor(Math.random() * 9000) + 1000
    return `DR-${year}${random}`
  }
  
  const saveDelivery = async (
    deliveryData: Partial<DeliveryReceipt>,
    items: Array<{
      po_item_id: string
      quantity_received: number
      quantity_damaged?: number
      notes?: string
    }>
  ) => {
    if (!canEdit) return
    if (!selectedPOForDelivery) return
    const priorMatch = invoiceMatchByPoId[selectedPOForDelivery.id]
    const condition = deliveryData.condition || 'good'

    const delivery = {
      po_id: selectedPOForDelivery.id,
      receipt_number: generateDeliveryNumber(),
      delivery_date: deliveryData.delivery_date || new Date().toISOString().split('T')[0],
      received_by: deliveryData.received_by || '',
      condition,
      notes: deliveryData.notes || null,
      inspection_notes: deliveryData.inspection_notes || null,
      delivery_receipt_url: deliveryData.delivery_receipt_url || null,
    }

    const { data: newDelivery, error } = await supabase
      .from('delivery_receipts')
      .insert([delivery])
      .select()
      .single()

    if (error) {
      console.error('Error creating delivery:', error)
      alert(`Error recording delivery: ${error.message}`)
      return
    }

    if (newDelivery && items.length > 0) {
      const deliveryItems = items.map((item) => ({
        delivery_receipt_id: newDelivery.id,
        po_item_id: item.po_item_id,
        quantity_received: item.quantity_received,
        quantity_damaged: item.quantity_damaged || 0,
        notes: item.notes || null,
      }))

      const { error: itemsError } = await supabase
        .from('delivery_receipt_items')
        .insert(deliveryItems)

      if (itemsError) {
        console.error('Error creating delivery items:', itemsError)
        alert(`Error recording delivery items: ${itemsError.message}`)
        return
      }
    }

    const brandId = selectedPOForDelivery.brand_id || selectedBrand?.id
    const deliveryId = newDelivery.id
    const poItems = selectedPOForDelivery.items || []
    const projectedItems = projectPoItemsAfterReceipt(poItems, items)
    const newStatus = resolvePoStatusAfterReceipt(projectedItems, condition)

    const poUpdates: Record<string, string> = {}
    if (selectedPOForDelivery.status !== newStatus) {
      poUpdates.status = newStatus
    }
    if (
      newStatus === 'delivered' &&
      !selectedPOForDelivery.actual_delivery_date
    ) {
      poUpdates.actual_delivery_date = delivery.delivery_date
    }
    if (Object.keys(poUpdates).length > 0) {
      const { error: poUpdateErr } = await supabase
        .from('purchase_orders')
        .update(poUpdates)
        .eq('id', selectedPOForDelivery.id)
      if (poUpdateErr) {
        console.error('Error updating PO after receipt:', poUpdateErr)
      }
    }

    const lineValidation = validateReceiptLines(
      items.map((item) => {
        const poItem = poItems.find((i) => i.id === item.po_item_id)
        const ordered = Number(poItem?.quantity) || 0
        const previously = Number(poItem?.quantity_received) || 0
        const remaining = Math.max(0, ordered - previously)
        return {
          po_item_id: item.po_item_id,
          ordered_quantity: ordered,
          previously_received: previously,
          remaining_quantity: remaining,
          quantity_received: item.quantity_received,
          quantity_damaged: item.quantity_damaged || 0,
        }
      })
    )

    setShowDeliveryModal(false)
    setSelectedPOForDelivery(null)
    loadDeliveries()
    loadPurchaseOrders()
    loadRawMaterials()

    if (deliveryId && brandId) {
      try {
        const { postAccrualFromDeliveryReceipt } = await import('../../lib/accounting-posting-rules')
        await postAccrualFromDeliveryReceipt(deliveryId, brandId, movementCreatedBy)
      } catch (e) {
        console.error('Delivery accrual posting failed:', e)
      }
    } else if (deliveryId) {
      console.error('Delivery recorded but brand_id missing — accrual journal was not posted.')
    }

    alert(`✅ ${buildReceiptSuccessMessage(condition, lineValidation)}`)

    if (isPaymentAfterDeliveryPo(selectedPOForDelivery)) {
      alert(
        `Accounting Payables: ${selectedPOForDelivery.po_number} has received goods.\n\nOpen Accounting → Payables to enter the supplier invoice and run 3-way match before payment (COD / pay after delivery).`
      )
    }

    if (
      priorMatch &&
      (priorMatch.status === 'matched' ||
        priorMatch.status === 'vouchered' ||
        priorMatch.status === 'exception')
    ) {
      alert(
        `Supplier invoice ${priorMatch.invoice_number} in Accounting may need re-resolution — received quantities changed. Open Accounting → Supplier Invoices and re-save the invoice.`
      )
    }
  }
  
  // =============================================
  // FILTER FUNCTIONS
  // =============================================
  
  const filteredPurchaseOrders = purchaseOrders.filter(po => {
    const matchesStatus = statusFilter === 'all' || po.status === statusFilter
    const matchesSearch = po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (po.supplier?.name || 'no supplier').toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })
  
  // Pagination for Purchase Orders
  const totalPOPages = Math.ceil(filteredPurchaseOrders.length / PO_PER_PAGE)
  const paginatedPurchaseOrders = filteredPurchaseOrders.slice(
    (currentPOPage - 1) * PO_PER_PAGE,
    currentPOPage * PO_PER_PAGE
  )

  const brandPurchaseOrders = useMemo(() => {
    if (!selectedBrand) return purchaseOrders
    if (plantMaterialsManagedHere) {
      if (franchiseFilter === 'all') return purchaseOrders
      if (franchiseFilter === 'hq') {
        return purchaseOrders.filter((po) => po.brand_id === selectedBrand.id)
      }
      return purchaseOrders.filter((po) => po.brand_id === franchiseFilter)
    }
    return purchaseOrders.filter((po) => po.brand_id === selectedBrand.id)
  }, [purchaseOrders, selectedBrand, plantMaterialsManagedHere, franchiseFilter])

  const posAwaitingReceiving = useMemo(() => {
    return brandPurchaseOrders.filter((po) => {
      if (!['in_transit', 'delivered', 'paid'].includes(po.status)) return false
      const items = po.items || []
      if (items.length === 0) return po.status === 'in_transit'
      return items.some((item) => (Number(item.quantity_received) || 0) < (Number(item.quantity) || 0))
    })
  }, [brandPurchaseOrders])

  const pendingFactoryMaterialRequestCount = useMemo(
    () => factoryMaterialRequests.filter((r) => r.status === 'pending').length,
    [factoryMaterialRequests]
  )

  const receivingTabStats = useMemo(() => {
    const brandPoIds = new Set(brandPurchaseOrders.map((po) => po.id))
    const brandDeliveries = deliveries.filter((d) => brandPoIds.has(d.po_id))
    let exceptions = 0
    for (const delivery of brandDeliveries) {
      if (invoiceMatchByPoId[delivery.po_id]?.status === 'exception') exceptions++
    }
    return {
      awaiting: posAwaitingReceiving.length,
      recorded: brandDeliveries.length,
      exceptions,
    }
  }, [brandPurchaseOrders, deliveries, posAwaitingReceiving, invoiceMatchByPoId])

  const filteredReceivingReports = useMemo(() => {
    const brandPoIds = new Set(brandPurchaseOrders.map((po) => po.id))
    const query = receivingSearchTerm.trim().toLowerCase()
    const receivingReportNewestFirst = (a: DeliveryReceipt, b: DeliveryReceipt) => {
      const aRecorded = new Date(a.created_at || a.delivery_date || 0).getTime()
      const bRecorded = new Date(b.created_at || b.delivery_date || 0).getTime()
      if (bRecorded !== aRecorded) return bRecorded - aRecorded
      return (b.receipt_number || '').localeCompare(a.receipt_number || '')
    }
    return deliveries
      .filter((d) => brandPoIds.has(d.po_id))
      .filter((d) => {
        const match = invoiceMatchByPoId[d.po_id]
        if (receivingMatchFilter === 'exception') return match?.status === 'exception'
        if (receivingMatchFilter === 'awaiting') return !match
        if (receivingMatchFilter === 'matched') {
          return match?.status === 'matched' || match?.status === 'vouchered'
        }
        return true
      })
      .filter((d) => {
        if (!query) return true
        const delivery = d as DeliveryReceipt & {
          purchase_order?: { po_number?: string; supplier?: { name?: string } }
        }
        return (
          delivery.receipt_number?.toLowerCase().includes(query) ||
          delivery.received_by?.toLowerCase().includes(query) ||
          delivery.purchase_order?.po_number?.toLowerCase().includes(query) ||
          delivery.purchase_order?.supplier?.name?.toLowerCase().includes(query)
        )
      })
      .sort(receivingReportNewestFirst)
  }, [deliveries, brandPurchaseOrders, receivingSearchTerm, receivingMatchFilter, invoiceMatchByPoId])

  const totalReceivingPages = Math.max(1, Math.ceil(filteredReceivingReports.length / RECEIVING_PER_PAGE))
  const paginatedReceivingReports = filteredReceivingReports.slice(
    (receivingPage - 1) * RECEIVING_PER_PAGE,
    receivingPage * RECEIVING_PER_PAGE
  )

  const openReceivingForPo = (po: PurchaseOrder) => {
    if (!canEdit) return
    setSelectedPOForDelivery(po)
    setShowDeliveryModal(true)
  }
  
  // =============================================
  // STATUS BADGE FUNCTION
  // =============================================
  
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      draft: { color: 'gray', label: 'Draft' },
      pending_approval: { color: 'yellow', label: 'Pending Approval' },
      approved: { color: 'blue', label: 'Approved' },
      order_confirmed: { color: 'indigo', label: 'Order Confirmed' },
      in_transit: { color: 'purple', label: 'In Transit' },
      delivered: { color: 'green', label: 'Delivered' },
      paid: { color: 'teal', label: 'Paid' },
      closed: { color: 'gray', label: 'Closed' },
      cancelled: { color: 'red', label: 'Cancelled' }
    }
    
    const config = statusConfig[status] || { color: 'gray', label: status }
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${config.color}-100 text-${config.color}-800`}>
        {config.label}
      </span>
    )
  }
  
  const ownerBrandSlugMap = useMemo(() => ownerBrandSlugMapFromBrands(brands), [brands])

  const rawMaterialsByOwner = useMemo(() => {
    if (!selectedBrand) return [] as RawMaterialOwnerGroup[]
    const query = rawMaterialsSearch.trim().toLowerCase()
    const filtered = query
      ? rawMaterials.filter((m) => materialMatchesSearch(m, query))
      : rawMaterials
    // On GFC Main, Components live in their own table below.
    const forMainTable = plantMaterialsManagedHere
      ? filtered.filter((m) => !isComponentMaterialCategory(m.category))
      : filtered
    return groupRawMaterialsByOwner(forMainTable, selectedBrand, brands)
  }, [rawMaterials, selectedBrand, brands, rawMaterialsSearch, plantMaterialsManagedHere])

  const gfcComponentMaterials = useMemo(() => {
    if (!selectedBrand || !plantMaterialsManagedHere) return [] as RawMaterial[]
    const query = rawMaterialsSearch.trim().toLowerCase()
    const brandNames = new Set(brands.map((b) => b.name))
    const selectedName = selectedBrand.name
    return sortMaterialsByName(
      rawMaterials.filter((m) => {
        if (!isComponentMaterialCategory(m.category)) return false
        if (query && !materialMatchesSearch(m, query)) return false
        const owners = (m.owner ?? []).map((o) => o.trim()).filter(Boolean)
        return !isExclusiveToOtherBrands(owners, selectedName, brandNames)
      })
    )
  }, [rawMaterials, selectedBrand, brands, rawMaterialsSearch, plantMaterialsManagedHere])

  const sharedOwnersByMaterialId = useMemo(() => {
    const normalize = (value: string | null | undefined) => (value || '').trim().toLowerCase()
    const ownersByKey = new Map<string, Set<string>>()

    for (const row of rawMaterials) {
      const key = `${normalize(row.material_name)}|${normalize(row.sku)}|${normalize(row.unit)}`
      if (!ownersByKey.has(key)) ownersByKey.set(key, new Set<string>())
      const ownerSet = ownersByKey.get(key)!
      for (const owner of row.owner || []) {
        const clean = owner.trim()
        if (clean) ownerSet.add(clean)
      }
    }

    const byMaterialId: Record<string, string[]> = {}
    for (const row of rawMaterials) {
      const key = `${normalize(row.material_name)}|${normalize(row.sku)}|${normalize(row.unit)}`
      byMaterialId[row.id] = Array.from(ownersByKey.get(key) || []).sort((a, b) =>
        a.localeCompare(b)
      )
    }
    return byMaterialId
  }, [rawMaterials])

  const rawMaterialsInventoryStats = useMemo(() => {
    let total = 0
    let low = 0
    let out = 0
    const tally = (m: RawMaterial) => {
      total++
      if (m.current_stock <= 0) out++
      else if (m.current_stock <= m.minimum_stock) low++
    }
    for (const group of rawMaterialsByOwner) {
      for (const cat of group.categories) {
        for (const m of cat.materials) tally(m)
      }
    }
    for (const m of gfcComponentMaterials) tally(m)
    return { total, low, out }
  }, [rawMaterialsByOwner, gfcComponentMaterials])

  const procurementTabs: { id: Tab; label: string; badge?: ReactNode }[] = [
    {
      id: 'raw_materials',
      label: 'Materials Inventory',
      badge:
        plantMaterialsManagedHere && pendingFactoryMaterialRequestCount > 0 ? (
          <span className="inline-flex min-w-[1.25rem] h-5 px-1.5 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold">
            {pendingFactoryMaterialRequestCount}
          </span>
        ) : null,
    },
    { id: 'fixed_assets', label: 'Fixed Assets Inventory' },
    { id: 'intercompany', label: 'Transfers' },
    { id: 'purchase_orders', label: 'Purchase Orders' },
    {
      id: 'receiving_reports',
      label: 'Receiving Reports',
      badge:
        posAwaitingReceiving.length > 0 ? (
          <span className="inline-flex min-w-[1.25rem] h-5 px-1.5 items-center justify-center rounded-full bg-green-100 text-green-800 text-[10px] font-semibold">
            {posAwaitingReceiving.length}
          </span>
        ) : null,
    },
    { id: 'requisitions', label: 'Requisitions' },
    { id: 'suppliers', label: 'Suppliers' },
    { id: 'transactions', label: 'Transactions' },
  ]

  const visibleProcurementTabs = procurementTabs.filter(({ id }) => !isProcurementTabLocked(id))
  const activeTabLocked = isProcurementTabLocked(activeTab)

  // =============================================
  // RENDER FUNCTIONS
  // =============================================
  
  if (!selectedBrand) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-600">Manage purchase orders and supplier transactions</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <p className="text-gray-500 text-center py-8">Please select a brand to manage purchase orders</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {!canEdit ? <ModuleReadOnlyBanner message={getModuleReadOnlyBanner('procurement')} /> : null}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Procurement</h1>
          <p className="text-sm text-gray-600">
            Materials and fixed assets inventory, suppliers, purchase orders, and receiving reports
          </p>
        </div>
        {plantMaterialsManagedHere ? (
          <FranchisePerformanceFilter
            brands={brands}
            value={franchiseFilter}
            onChange={setFranchiseFilter}
          />
        ) : null}
      </div>
      
      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <nav className="flex -mb-px">
            {visibleProcurementTabs.map(({ id, label, badge }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {label}
                  {bypassAccessLocks && isSubTabLocked(accessLocks, 'purchasing', id) && (
                    <span
                      className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
                      title="Locked for other roles — visible to developers only"
                    >
                      Locked
                    </span>
                  )}
                  {badge}
                </span>
              </button>
            ))}
          </nav>
        </div>
        
        {/* Tab Content */}
        <div className="p-6">
          {activeTabLocked ? (
            <ModuleLockedNotice
              title={getSubTabLabel('purchasing', activeTab)}
              reason={getLockReason(accessLocks, 'purchasing', activeTab)}
            />
          ) : (
            <>
          {/* PURCHASE ORDERS TAB */}
          {activeTab === 'purchase_orders' && (
            <div className="space-y-4">
              {!plantMaterialsManagedHere && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 p-3 text-sm text-indigo-950">
                  Create purchase orders for <strong>{selectedBrand.name}</strong> here. Plant material POs are managed
                  under <strong>GFC</strong>; legacy plant rows on this brand remain visible for receiving and history.
                </div>
              )}
              {/* Toolbar */}
              <div className="flex justify-between items-center gap-4">
                <div className="flex gap-4 flex-1">
                  <input
                    type="text"
                    placeholder="Search PO number or supplier..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="approved">Approved</option>
                    <option value="order_confirmed">Order Confirmed</option>
                    <option value="in_transit">In Transit</option>
                    <option value="delivered">Delivered</option>
                    <option value="paid">Paid</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <ModuleEditGate canEdit={canEdit}>
                <button
                  type="button"
                  onClick={() => setShowPurchaserTemplateModal(true)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Purchaser templates
                </button>
                <button
                  onClick={openNewPO}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  + Create PO
                </button>
                </ModuleEditGate>
              </div>
              
              {/* PO List */}
              <div className="space-y-3">
                {paginatedPurchaseOrders.map((po) => (
                  <div key={po.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{po.po_number}</h3>
                          {getStatusBadge(po.status)}
                          {(() => {
                            const hasReceived = (po.items || []).some(
                              (i) => (Number(i.quantity_received) || 0) > 0
                            )
                            const invMatch = invoiceMatchByPoId[po.id]
                            const invStatus = invMatch?.status
                            if (!hasReceived) return null
                            if (invStatus === 'exception') {
                              return (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                                  Invoice exception
                                </span>
                              )
                            }
                            if (invStatus === 'paid') {
                              return (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                                  Paid
                                </span>
                              )
                            }
                            if (invStatus === 'matched' || invStatus === 'vouchered') {
                              return (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                                  Ready for payment
                                </span>
                              )
                            }
                            return (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                Awaiting supplier invoice
                              </span>
                            )
                          })()}
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                          <div>
                            <span className="text-gray-500">Supplier:</span>
                            <span className="ml-2 font-medium">{po.supplier?.name || 'No supplier'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Order Date:</span>
                            <span className="ml-2">{new Date(po.order_date).toLocaleDateString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Total Amount:</span>
                            <span className="ml-2 font-medium">₱{po.total_amount.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Balance:</span>
                            <span className="ml-2 font-medium text-red-600">₱{po.balance_amount.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Purchasing Agent:</span>
                            <span className="ml-2">{po.purchasing_agent}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Payment:</span>
                            <span className="ml-2">{po.payment_timing.replace('_', ' ')}</span>
                          </div>
                          {po.pr_id && (
                            <div>
                              <span className="text-gray-500">Reference PR:</span>
                              <button
                                type="button"
                                onClick={() => openReferencedRequisition(po.pr_id!)}
                                className="ml-2 text-blue-600 hover:text-blue-800 hover:underline font-medium"
                              >
                                {po.requisition?.pr_number || po.pr_id}
                              </button>
                            </div>
                          )}
                          {po.expected_delivery_date && (
                            <div>
                              <span className="text-gray-500">Expected:</span>
                              <span className="ml-2">{new Date(po.expected_delivery_date).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {/* Print Button - available once PO exists (except cancelled) */}
                        {canPrintPurchaseOrder(po) && (
                          <button
                            onClick={() => printPO(po)}
                            className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            Print PO
                          </button>
                        )}
                        
                        {/* Status Actions */}
                        {canEdit && po.status === 'draft' && (
                          <button
                            onClick={() => updatePOStatus(po.id, 'pending_approval')}
                            className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                          >
                            Submit for Approval
                          </button>
                        )}
                        {canEdit && po.status === 'pending_approval' && (
                          <>
                            <button
                              onClick={() => updatePOStatus(po.id, 'approved')}
                              className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => updatePOStatus(po.id, 'draft')}
                              className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {canEdit && po.status === 'approved' && (
                          <button
                            onClick={() => updatePOStatus(po.id, 'order_confirmed')}
                            className="px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                          >
                            Confirm Order
                          </button>
                        )}
                        {canEdit && po.status === 'order_confirmed' && (
                          <button
                            onClick={() => updatePOStatus(po.id, 'in_transit')}
                            className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                          >
                            Mark In Transit
                          </button>
                        )}
                        {canEdit && canMarkDelivered(po) && (
                          <button
                            onClick={() => updatePOStatus(po.id, 'delivered')}
                            className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            Mark Delivered
                          </button>
                        )}
                        {canEdit && canClosePurchaseOrder(po, invoiceMatchByPoId[po.id]) && (
                          <button
                            onClick={() => updatePOStatus(po.id, 'closed')}
                            className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            Close PO
                          </button>
                        )}
                        
                        {/* Edit / Delete */}
                        {canEdit && canEditPurchaseOrder(po, invoiceMatchByPoId[po.id]) && (
                          <button
                            onClick={() => openPOForEdit(po)}
                            className={`px-3 py-1 text-xs rounded hover:opacity-90 ${
                              matchSummaryNeedsPoAmendment(invoiceMatchByPoId[po.id])
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {matchSummaryNeedsPoAmendment(invoiceMatchByPoId[po.id])
                              ? 'Fix match'
                              : 'Edit'}
                          </button>
                        )}
                        {canEdit && po.status === 'draft' && (
                          <button
                            onClick={() => deletePurchaseOrder(po.id, po.po_number)}
                            className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            Delete
                          </button>
                        )}
                        
                        {/* Delete completed / cancelled POs */}
                        {canEdit && DELETABLE_COMPLETED_PO_STATUSES.includes(po.status) && (
                          <button
                            onClick={() => deletePurchaseOrder(po.id, po.po_number)}
                            className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Items Preview */}
                    {po.items && po.items.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-gray-500 mb-2">Items ({po.items.length}):</p>
                        <div className="space-y-1">
                          {po.items.slice(0, 3).map((item) => (
                            <div key={item.id} className="text-xs text-gray-600 flex justify-between">
                              <span>{item.product_description}</span>
                              <span>{item.quantity} {item.unit} × ₱{item.unit_price.toLocaleString()}</span>
                            </div>
                          ))}
                          {po.items.length > 3 && (
                            <p className="text-xs text-gray-400">+{po.items.length - 3} more items</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {filteredPurchaseOrders.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <p>No purchase orders found</p>
                    <p className="text-sm mt-1">Create your first purchase order to get started</p>
                  </div>
                )}
              </div>
              
              {/* Pagination Controls */}
              {totalPOPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-4">
                  <button
                    onClick={() => setCurrentPOPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPOPage === 1}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <div className="flex gap-1">
                    {Array.from({ length: totalPOPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPOPage(page)}
                        className={`px-3 py-1 text-sm border rounded ${
                          currentPOPage === page 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPOPage(prev => Math.min(totalPOPages, prev + 1))}
                    disabled={currentPOPage === totalPOPages}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                  <span className="text-sm text-gray-600 ml-2">
                    Page {currentPOPage} of {totalPOPages} ({filteredPurchaseOrders.length} total)
                  </span>
                </div>
              )}
            </div>
          )}
          
          {/* RECEIVING REPORTS TAB */}
          {activeTab === 'receiving_reports' && (
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Receiving Reports</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Record goods receipt when items arrive. Accounting runs 3-way match before payment.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-medium text-green-800">
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    {receivingTabStats.awaiting} awaiting
                  </span>
                  <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700">
                    {receivingTabStats.recorded} recorded
                  </span>
                  {receivingTabStats.exceptions > 0 && (
                    <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-800">
                      {receivingTabStats.exceptions} exception{receivingTabStats.exceptions === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-green-200 bg-green-50/40 overflow-hidden">
                <div className="px-3 py-2 border-b border-green-200/80 bg-green-50 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-green-900">
                    Awaiting receipt
                  </h3>
                  <span className="text-xs text-green-800 tabular-nums">{posAwaitingReceiving.length}</span>
                </div>
                {posAwaitingReceiving.length === 0 ? (
                  <p className="text-sm text-gray-500 px-3 py-5 text-center">
                    No purchase orders waiting for a receiving report.
                  </p>
                ) : (
                  <div className="overflow-x-auto bg-white">
                    <table className="w-full text-sm min-w-[720px]">
                      <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">PO / Supplier</th>
                          <th className="text-left px-3 py-2 font-medium w-36">Progress</th>
                          <th className="text-left px-3 py-2 font-medium">PO status</th>
                          <th className="text-left px-3 py-2 font-medium">Invoice match</th>
                          <th className="text-right px-3 py-2 font-medium w-44">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {posAwaitingReceiving.map((po) => {
                          const items = po.items || []
                          const totalOrdered = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
                          const totalReceived = items.reduce(
                            (s, i) => s + (Number(i.quantity_received) || 0),
                            0
                          )
                          const progressPct =
                            totalOrdered > 0
                              ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100))
                              : 0
                          const invMatch = invoiceMatchByPoId[po.id]
                          const showMatchWarning =
                            invMatch?.status === 'exception' ||
                            ((invMatch?.status === 'matched' || invMatch?.status === 'vouchered') &&
                              totalReceived > 0 &&
                              totalReceived < totalOrdered)
                          return (
                            <tr key={po.id} className="hover:bg-gray-50/80 align-top">
                              <td className="px-3 py-2.5">
                                <p className="font-medium text-gray-900">{po.po_number}</p>
                                <p className="text-xs text-gray-500 truncate max-w-[220px]">
                                  {po.supplier?.name || 'No supplier'}
                                </p>
                                {showMatchWarning && (
                                  <div className="mt-1.5 max-w-md">
                                    <InvoiceMatchIssuesPanel summary={invMatch} compact />
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden min-w-[4rem]">
                                    <div
                                      className="h-full bg-green-600 rounded-full"
                                      style={{ width: `${progressPct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs tabular-nums text-gray-600 whitespace-nowrap">
                                    {totalReceived}/{totalOrdered || '—'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5">{getStatusBadge(po.status)}</td>
                              <td className="px-3 py-2.5">
                                <InvoiceMatchStatusChip summary={invMatch} />
                              </td>
                              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  {canPrintReceivingReportBlank(po) && (
                                    <button
                                      type="button"
                                      onClick={() => void printReceivingReportBlank(po)}
                                      className="p-1.5 text-purple-700 border border-purple-200 rounded-md hover:bg-purple-50"
                                      title="Print blank receiving report"
                                    >
                                      <Printer className="h-4 w-4" />
                                    </button>
                                  )}
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => openReceivingForPo(po)}
                                      className="px-2.5 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700"
                                    >
                                      Record
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700 shrink-0">
                    Recorded ({filteredReceivingReports.length})
                  </h3>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto sm:max-w-xl">
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search receipt, PO, supplier…"
                        value={receivingSearchTerm}
                        onChange={(e) => setReceivingSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(
                        [
                          ['all', 'All'],
                          ['exception', 'Exceptions'],
                          ['awaiting', 'No invoice'],
                          ['matched', 'Ready'],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setReceivingMatchFilter(id)}
                          className={`text-xs px-2 py-1 rounded-md border ${
                            receivingMatchFilter === id
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {filteredReceivingReports.length === 0 ? (
                  <p className="text-sm text-gray-500 px-3 py-8 text-center bg-white">
                    {receivingMatchFilter === 'all'
                      ? 'No receiving reports recorded yet.'
                      : `No receiving reports match this filter.`}
                  </p>
                ) : (
                  <div className="overflow-x-auto bg-white">
                    <table className="w-full text-sm min-w-[760px]">
                      <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Receipt</th>
                          <th className="text-left px-3 py-2 font-medium">PO / Supplier</th>
                          <th className="text-left px-3 py-2 font-medium">Delivery</th>
                          <th className="text-left px-3 py-2 font-medium">Condition</th>
                          <th className="text-left px-3 py-2 font-medium">Match</th>
                          <th className="text-right px-3 py-2 font-medium w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedReceivingReports.map((delivery) => {
                          const d = delivery as DeliveryReceipt & {
                            purchase_order?: { po_number?: string; supplier?: { name?: string } }
                          }
                          const invMatch = invoiceMatchByPoId[d.po_id]
                          return (
                            <tr
                              key={d.id}
                              className={`hover:bg-gray-50/80 ${invMatch?.status === 'exception' ? 'bg-red-50/50' : ''}`}
                            >
                              <td className="px-3 py-2 font-mono text-xs text-gray-800">
                                {d.receipt_number}
                              </td>
                              <td className="px-3 py-2">
                                <p className="font-medium text-gray-900">
                                  {d.purchase_order?.po_number || '—'}
                                </p>
                                <p className="text-xs text-gray-500 truncate max-w-[200px]">
                                  {d.purchase_order?.supplier?.name || '—'}
                                </p>
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-600">
                                <p>
                                  {d.delivery_date
                                    ? new Date(d.delivery_date).toLocaleDateString()
                                    : '—'}
                                </p>
                                <p className="text-gray-500 truncate max-w-[140px]">
                                  {d.received_by || '—'}
                                </p>
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-block px-1.5 py-0.5 text-[11px] font-medium rounded ${conditionBadgeClass(d.condition)}`}
                                >
                                  {formatConditionLabel(d.condition)}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <InvoiceMatchStatusChip summary={invMatch} />
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => setViewingReceivingReportId(d.id)}
                                  className="p-1.5 text-blue-700 border border-gray-300 rounded-md hover:bg-gray-50"
                                  title="View receiving report"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {totalReceivingPages > 1 && (
                  <div className="flex justify-center items-center gap-2 px-3 py-2 border-t border-gray-200 bg-gray-50">
                    <button
                      type="button"
                      onClick={() => setReceivingPage((p) => Math.max(1, p - 1))}
                      disabled={receivingPage === 1}
                      className="px-2.5 py-1 text-xs border rounded-md hover:bg-white disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-gray-600 tabular-nums">
                      Page {receivingPage} of {totalReceivingPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReceivingPage((p) => Math.min(totalReceivingPages, p + 1))}
                      disabled={receivingPage === totalReceivingPages}
                      className="px-2.5 py-1 text-xs border rounded-md hover:bg-white disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUPPLIERS TAB */}
          {activeTab === 'suppliers' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Suppliers</h2>
                <ModuleEditGate canEdit={canEdit}>
                <button
                  onClick={() => {
                    setEditingSupplier(null)
                    setShowSupplierModal(true)
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  + Add Supplier
                </button>
                </ModuleEditGate>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suppliers.map((supplier) => {
                  // Count products for this supplier
                  const productCount = rawMaterials.filter(m => m.supplier_id === supplier.id).length
                  const leadTime = supplierLeadTimes[supplier.id]
                  
                  return (
                  <div key={supplier.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{supplier.name}</h3>
                          {productCount > 0 && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                              {productCount} product{productCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {supplier.contact_person && (
                          <p className="text-sm text-gray-600">{supplier.contact_person}</p>
                        )}
                        
                        {typeof supplier.lead_time_days === 'number' && supplier.lead_time_days > 0 && (
                          <div className="mt-2 mb-1">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                              <Clock size={14} className="text-blue-600" />
                              <div className="text-xs">
                                <span className="font-semibold text-blue-900">{supplier.lead_time_days} days</span>
                                <span className="text-blue-700"> configured lead time</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Lead Time Badge */}
                        {leadTime && (
                          <div className="mt-2 mb-1">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                              <Clock size={14} className="text-green-600" />
                              <div className="text-xs">
                                <span className="font-semibold text-green-900">{leadTime.avgDays} days</span>
                                <span className="text-green-700"> average lead time</span>
                                <span className="text-green-600 ml-1">({leadTime.completedPOs} POs)</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                          <div className="mt-2 space-y-1 text-sm">
                            {supplier.phone && (
                              <p className="text-gray-600 flex items-center gap-2">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                {supplier.phone}
                              </p>
                            )}
                            {supplier.email && (
                              <p className="text-gray-600 flex items-center gap-2">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {supplier.email}
                              </p>
                            )}
                            {supplier.payment_terms && (
                              <p className="text-gray-600 flex items-center gap-2">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                                {supplier.payment_terms}
                              </p>
                            )}
                          </div>
                      </div>
                      <div className="flex gap-2">
                        {canEdit && (
                          <button
                            onClick={() => {
                              setEditingSupplier(supplier)
                              setShowSupplierModal(true)
                            }}
                            className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            Edit
                          </button>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => deleteSupplier(supplier.id)}
                            className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            </div>
          )}
          
          {/* TRANSACTIONS TAB */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Transaction History</h2>
              <p className="text-xs text-gray-500">Payments and deliveries grouped by supplier</p>
              
              <div className="space-y-3">
                {/* Group by Supplier */}
                {(() => {
                  // Create supplier groups
                  const supplierGroups: { [key: string]: { name: string; pos: { [key: string]: { poNumber: string; status?: string; payments: any[]; deliveries: any[] } } } } = {}
                  
                  // Group payments by supplier and PO
                  payments.forEach((payment: any) => {
                    const supplierId = payment.purchase_order?.supplier?.id || 'unknown'
                    const supplierName = payment.purchase_order?.supplier?.name || 'Unknown Supplier'
                    const poId = payment.po_id
                    const poNumber = payment.purchase_order?.po_number || 'N/A'
                    
                    if (!supplierGroups[supplierId]) {
                      supplierGroups[supplierId] = { name: supplierName, pos: {} }
                    }
                    if (!supplierGroups[supplierId].pos[poId]) {
                      supplierGroups[supplierId].pos[poId] = { poNumber, status: payment.purchase_order?.status, payments: [], deliveries: [] }
                    }
                    if (!supplierGroups[supplierId].pos[poId].status && payment.purchase_order?.status) {
                      supplierGroups[supplierId].pos[poId].status = payment.purchase_order.status
                    }
                    supplierGroups[supplierId].pos[poId].payments.push(payment)
                  })
                  
                  // Group deliveries by supplier and PO
                  deliveries.forEach((delivery: any) => {
                    const supplierId = delivery.purchase_order?.supplier?.id || 'unknown'
                    const supplierName = delivery.purchase_order?.supplier?.name || 'Unknown Supplier'
                    const poId = delivery.po_id
                    const poNumber = delivery.purchase_order?.po_number || 'N/A'
                    
                    if (!supplierGroups[supplierId]) {
                      supplierGroups[supplierId] = { name: supplierName, pos: {} }
                    }
                    if (!supplierGroups[supplierId].pos[poId]) {
                      supplierGroups[supplierId].pos[poId] = { poNumber, status: delivery.purchase_order?.status, payments: [], deliveries: [] }
                    }
                    if (!supplierGroups[supplierId].pos[poId].status && delivery.purchase_order?.status) {
                      supplierGroups[supplierId].pos[poId].status = delivery.purchase_order.status
                    }
                    supplierGroups[supplierId].pos[poId].deliveries.push(delivery)
                  })
                  
                  return Object.entries(supplierGroups).map(([supplierId, supplier]) => {
                    const posArray = Object.entries(supplier.pos)
                    const currentPage = transactionPagination[supplierId] || 1
                    const totalPages = Math.ceil(posArray.length / TRANSACTIONS_PER_SUPPLIER)
                    const paginatedPOs = posArray.slice(
                      (currentPage - 1) * TRANSACTIONS_PER_SUPPLIER,
                      currentPage * TRANSACTIONS_PER_SUPPLIER
                    )
                    
                    return (
                      <div key={supplierId} className="border border-gray-200 rounded-lg bg-white">
                        {/* Supplier Header */}
                        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                          <h3 className="font-semibold text-lg text-gray-900">{supplier.name}</h3>
                          <p className="text-xs text-gray-500">{Object.keys(supplier.pos).length} PO{Object.keys(supplier.pos).length !== 1 ? 's' : ''}</p>
                        </div>
                        
                        {/* POs under this supplier */}
                        <div className="p-4 space-y-3">
                          {paginatedPOs.map(([poId, poData]) => (
                          <div key={poId} className="border border-gray-200 rounded-md p-3">
                            {/* PO Number and View Button */}
                            <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-gray-900">{poData.poNumber}</h4>
                                {poData.status && getStatusBadge(poData.status)}
                              </div>
                              <button
                                onClick={() => viewPODetails(poId)}
                                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                              >
                                View PO
                              </button>
                            </div>
                            
                            {/* Payments and Deliveries Side by Side */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                              {/* Payments */}
                              <div>
                                <h5 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                  Payments ({poData.payments.length})
                                </h5>
                                {poData.payments.length > 0 ? (
                                  <div className="space-y-1.5">
                                      {poData.payments.map((payment: any) => (
                                        <div key={payment.id} className="bg-green-50 border border-green-200 rounded p-2">
                                          <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                              <p className="text-xs font-medium">{payment.payment_number}</p>
                                              <p className="text-xs text-gray-600">{new Date(payment.payment_date).toLocaleDateString()}</p>
                                              <p className="text-xs text-gray-600">{payment.payment_method}</p>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-sm font-bold text-green-600">₱{payment.amount.toLocaleString()}</p>
                                              {payment.proof_of_payment_url && (
                                                <a
                                                  href={payment.proof_of_payment_url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                                >
                                                  Payment Receipt
                                                </a>
                                              )}
                                              {onNavigateToAccounting && payment.purchase_order && (
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                  Payment voucher: enter supplier invoice in Accounting
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400">No payments</p>
                                )}
                              </div>
                              
                              {/* Receiving Reports */}
                              <div>
                                <h5 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                  Receiving Reports ({poData.deliveries.length})
                                </h5>
                                {poData.deliveries.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {poData.deliveries.map((delivery: any) => (
                                      <div key={delivery.id} className="bg-blue-50 border border-blue-200 rounded p-2">
                                        <div className="flex justify-between items-start">
                                          <div className="flex-1">
                                            <p className="text-xs font-medium">{delivery.receipt_number}</p>
                                            <p className="text-xs text-gray-600">{new Date(delivery.delivery_date).toLocaleDateString()}</p>
                                            <p className="text-xs text-gray-600">By: {delivery.received_by}</p>
                                          </div>
                                          <div className="text-right">
                                            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${conditionBadgeClass(delivery.condition)}`}>
                                              {formatConditionLabel(delivery.condition)}
                                            </span>
                                            {delivery.delivery_receipt_url && (
                                              <a
                                                href={delivery.delivery_receipt_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block mt-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                              >
                                                Delivery Receipt
                                              </a>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400">No deliveries</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Pagination Controls for this supplier */}
                        {totalPages > 1 && (
                          <div className="flex justify-center items-center gap-2 mt-4 pt-3 border-t">
                            <button
                              onClick={() => setTransactionPagination(prev => ({
                                ...prev,
                                [supplierId]: Math.max(1, (prev[supplierId] || 1) - 1)
                              }))}
                              disabled={currentPage === 1}
                              className="px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Prev
                            </button>
                            <span className="text-xs text-gray-600">
                              {currentPage} / {totalPages}
                            </span>
                            <button
                              onClick={() => setTransactionPagination(prev => ({
                                ...prev,
                                [supplierId]: Math.min(totalPages, (prev[supplierId] || 1) + 1)
                              }))}
                              disabled={currentPage === totalPages}
                              className="px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  )
                })()}
                
                {payments.length === 0 && deliveries.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <p>No transactions recorded yet</p>
                    <p className="text-sm mt-1">Payments and deliveries will appear here</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* REQUISITIONS TAB */}
          {activeTab === 'requisitions' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Purchase Requisitions</h2>
                <ModuleEditGate canEdit={canEdit}>
                <button
                  onClick={() => setShowPRModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  + Create Requisition
                </button>
                </ModuleEditGate>
              </div>
              
              <div className="space-y-3">
                {requisitions.map((pr) => (
                  (() => {
                    const linkedPO = purchaseOrders.find((po) => po.pr_id === pr.id)
                    return (
                  <div id={`pr-${pr.id}`} key={pr.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{pr.pr_number}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            pr.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                            pr.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                            pr.status === 'approved' ? 'bg-green-100 text-green-800' :
                            pr.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {pr.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                          <div>
                            <span className="text-gray-500">Requested by:</span>
                            <span className="ml-2 font-medium">{pr.requested_by}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Request Date:</span>
                            <span className="ml-2">{new Date(pr.request_date).toLocaleDateString()}</span>
                          </div>
                          {pr.department && (
                            <div>
                              <span className="text-gray-500">Department:</span>
                              <span className="ml-2">{pr.department}</span>
                            </div>
                          )}
                          {pr.required_date && (
                            <div>
                              <span className="text-gray-500">Required by:</span>
                              <span className="ml-2">{new Date(pr.required_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          {pr.purpose && (
                            <div className="col-span-2">
                              <span className="text-gray-500">Purpose:</span>
                              <span className="ml-2">{pr.purpose}</span>
                            </div>
                          )}
                          {linkedPO && (
                            <div>
                              <span className="text-gray-500">Linked PO:</span>
                              <button
                                type="button"
                                onClick={() => viewPODetails(linkedPO.id)}
                                className="ml-2 text-blue-600 hover:text-blue-800 hover:underline font-medium"
                              >
                                {linkedPO.po_number}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => viewPRDetails(pr.id)}
                          className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          View Details
                        </button>
                        {canEdit && pr.status === 'draft' && (
                          <button
                            onClick={async () => {
                              if (!canEdit) return
                              await supabase
                                .from('purchase_requisitions')
                                .update({ status: 'submitted' })
                                .eq('id', pr.id)
                              loadRequisitions()
                            }}
                            className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                          >
                            Submit
                          </button>
                        )}
                        {canEdit && pr.status === 'submitted' && (
                          <button
                            onClick={async () => {
                              if (!canEdit) return
                              await supabase
                                .from('purchase_requisitions')
                                .update({ status: 'approved' })
                                .eq('id', pr.id)
                              loadRequisitions()
                            }}
                            className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            Approve
                          </button>
                        )}
                        {canEdit && pr.status === 'approved' && (
                          <button
                            onClick={async () => {
                              if (!canEdit) return
                              // Load PR items
                              const { data: items } = await supabase
                                .from('purchase_requisition_items')
                                .select('*')
                                .eq('pr_id', pr.id)
                              
                              if (items && items.length > 0) {
                                // Convert PR items to PO items format
                                const poItems = items.map(item => ({
                                  product_description: item.product_description,
                                  quantity: item.quantity,
                                  unit: item.unit,
                                  unit_price: item.estimated_price || 0
                                }))
                                
                                setConvertingPR(pr)
                                setPOItems(poItems)
                                setShowConvertPRModal(true)
                              } else {
                                alert('No items found in this requisition')
                              }
                            }}
                            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            Create PO
                          </button>
                        )}
                        {canEdit && DELETABLE_COMPLETED_PR_STATUSES.includes(pr.status) && (
                          <button
                            onClick={() => deletePurchaseRequisition(pr)}
                            className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                    )
                  })()
                ))}
                
                {requisitions.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <p>No requisitions found</p>
                    <p className="text-sm mt-1">Create your first purchase requisition to get started</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* MATERIALS INVENTORY TAB */}
          {activeTab === 'raw_materials' && (
            <div className="space-y-4">
              {!plantMaterialsManagedHere && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 p-4 text-sm text-indigo-950">
                  <strong>Plant materials are managed under GFC.</strong> Legacy plant rows below are read-only and
                  deplete naturally. Add materials and manage this brand&apos;s own purchases here; use{' '}
                  <strong>GFC</strong> for factory floor inventory and cycle counts.
                </div>
              )}
              {plantMaterialsManagedHere ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4">
                <h2 className="text-base font-semibold text-amber-950">Factory material requests</h2>
                <p className="text-xs text-amber-900/80 mt-1 mb-3">
                  Production staff submit requests from <span className="font-medium">/factory</span>. Release deducts from
                  materials inventory (same as stock out).
                </p>
                {factoryMaterialRequests.filter((r) => r.status === 'pending').length === 0 ? (
                  <p className="text-sm text-amber-900/70">No pending factory requests.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-amber-200/80 bg-white">
                    <table className="min-w-full text-sm">
                      <thead className="bg-amber-100/60 text-left text-xs font-medium text-amber-950 uppercase">
                        <tr>
                          <th className="px-3 py-2">Material</th>
                          <th className="px-3 py-2">Qty</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Requested by</th>
                          <th className="px-3 py-2">Inventory</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100">
                        {factoryMaterialRequests
                          .filter((r) => r.status === 'pending')
                          .map((req) => (
                            <tr
                              key={req.id}
                              className={`cursor-default transition-colors ${
                                highlightedMaterialId === req.material_id
                                  ? 'bg-amber-100'
                                  : 'bg-white hover:bg-amber-50/80'
                              }`}
                              onMouseEnter={() => setHighlightedMaterialId(req.material_id)}
                              onMouseLeave={() => setHighlightedMaterialId(null)}
                            >
                              <td className="px-3 py-2 font-medium text-gray-900">
                                {req.material?.material_name || rawMaterials.find((m) => m.id === req.material_id)?.material_name || '—'}
                              </td>
                              <td className="px-3 py-2">
                                {(() => {
                                  const mat = resolveFactoryRequestMaterial(req, rawMaterials)
                                  if (!mat) return req.quantity
                                  const { primary, stockNote } = formatFactoryRequestQtyDisplay(
                                    Number(req.quantity),
                                    mat
                                  )
                                  return (
                                    <div>
                                      <span className="tabular-nums">{primary}</span>
                                      {stockNote ? (
                                        <div className="text-[11px] text-gray-500">{stockNote}</div>
                                      ) : null}
                                    </div>
                                  )
                                })()}
                              </td>
                              <td className="px-3 py-2 text-gray-600">{req.request_date}</td>
                              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                                {req.requested_by?.trim() || '—'}
                              </td>
                              <td className="px-3 py-2">
                                <FactoryRequestInventoryStockCell req={req} rawMaterials={rawMaterials} />
                              </td>
                              <td className="px-3 py-2 text-right">
                                {canEdit ? (
                                  <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => cancelFactoryMaterialRequest(req)}
                                      disabled={
                                        releasingRequestId === req.id || cancellingRequestId === req.id
                                      }
                                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                    >
                                      {cancellingRequestId === req.id ? 'Cancelling…' : 'Cancel'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => releaseFactoryMaterialRequest(req)}
                                      disabled={
                                        releasingRequestId === req.id ||
                                        cancellingRequestId === req.id ||
                                        !factoryRequestHasSufficientStock(req, rawMaterials)
                                      }
                                      title={
                                        !factoryRequestHasSufficientStock(req, rawMaterials)
                                          ? 'Insufficient warehouse stock'
                                          : undefined
                                      }
                                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-50"
                                    >
                                      {releasingRequestId === req.id ? 'Releasing…' : 'Release to factory'}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">View only</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              ) : null}

              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-4 sm:px-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Materials Inventory</h2>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Grouped by owner and category for {selectedBrand.name}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                          {rawMaterialsInventoryStats.total} materials
                        </span>
                        {rawMaterialsInventoryStats.low > 0 && (
                          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800">
                            {rawMaterialsInventoryStats.low} low stock
                          </span>
                        )}
                        {rawMaterialsInventoryStats.out > 0 && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">
                            {rawMaterialsInventoryStats.out} out of stock
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:min-w-[320px]">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        <input
                          type="search"
                          value={rawMaterialsSearch}
                          onChange={(e) => setRawMaterialsSearch(e.target.value)}
                          placeholder="Search name, SKU, supplier…"
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                      </div>
                      {plantMaterialsManagedHere && canEdit && (
                        <button
                          type="button"
                          onClick={() => setShowCycleCountPanel(true)}
                          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 border border-indigo-200 bg-white rounded-lg hover:bg-indigo-50 shadow-sm"
                        >
                          <ClipboardCheck className="h-4 w-4" />
                          Cycle count
                        </button>
                      )}
                      <ModuleEditGate canEdit={canEdit}>
                      <button
                        onClick={() => {
                          setEditingMaterial(null)
                          setShowMaterialModal(true)
                        }}
                        className="shrink-0 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
                      >
                        + Add Material
                      </button>
                      </ModuleEditGate>
                    </div>
                  </div>
                </div>

                {rawMaterialsLoading ? (
                  <div className="overflow-x-auto animate-pulse">
                    <table className="min-w-full">
                      <thead className="bg-gray-50/80">
                        <tr className="border-b border-gray-200">
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Material</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Supplier</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Purchase Unit</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Min</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Unit cost</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Value</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {Array.from({ length: 6 }).map((_, idx) => (
                          <tr key={`raw-material-skeleton-${idx}`} className="bg-white">
                            <td className="px-5 py-3">
                              <div className="h-4 w-44 rounded bg-gray-200 mb-2"></div>
                              <div className="h-3 w-24 rounded bg-gray-100"></div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="h-4 w-28 rounded bg-gray-200"></div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="h-5 w-20 rounded-full bg-gray-200"></div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="h-4 w-16 rounded bg-gray-200 ml-auto"></div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="h-4 w-12 rounded bg-gray-200 ml-auto"></div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="h-4 w-16 rounded bg-gray-200 ml-auto"></div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="h-4 w-20 rounded bg-gray-200 ml-auto"></div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="h-8 w-28 rounded bg-gray-200 ml-auto"></div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : rawMaterials.length === 0 ? (
                  <div className="text-center py-14 px-4">
                    <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">No materials added yet</p>
                    <p className="text-sm text-gray-400 mt-1">Add your first material to start tracking</p>
                  </div>
                ) : rawMaterialsByOwner.length === 0 ? (
                  <div className="text-center py-14 px-4">
                    <Search className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">
                      {rawMaterialsSearch.trim()
                        ? 'No materials match your search'
                        : gfcComponentMaterials.length > 0
                          ? 'No other materials'
                          : `No materials for ${selectedBrand.name}`}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      {rawMaterialsSearch.trim()
                        ? 'Try a different keyword or clear the search.'
                        : gfcComponentMaterials.length > 0
                          ? 'Factory components are listed in the table below.'
                          : 'Items owned exclusively by another brand are hidden here.'}
                    </p>
                    {rawMaterialsSearch.trim() && (
                      <button
                        type="button"
                        onClick={() => setRawMaterialsSearch('')}
                        className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50/80 sticky top-0 z-[1]">
                        <tr className="border-b border-gray-200">
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Material
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Supplier
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Purchase Unit
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Min
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Unit cost
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Value
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rawMaterialsByOwner.map(({ owner, totalCount, totalValue, categories }) => {
                          const ownerTheme = getOwnerThemeClasses(owner, ownerBrandSlugMap)
                          return (
                            <Fragment key={`group-${owner}`}>
                              <tr className={`${ownerTheme.groupHeader} border-y border-gray-200/80`}>
                                <td colSpan={6} className="p-0">
                                  <div
                                    className={`flex items-center gap-2 px-5 py-2.5 border-l-4 ${ownerTheme.accentBorder}`}
                                  >
                                    <span className="text-sm font-semibold tracking-tight">{owner}</span>
                                    <span
                                      className={`shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full ${ownerTheme.badge}`}
                                    >
                                      {totalCount} {totalCount === 1 ? 'item' : 'items'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-right whitespace-nowrap align-middle">
                                  <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                                    Total
                                  </div>
                                  <div className="text-sm font-semibold text-blue-700 tabular-nums">
                                    ₱
                                    {totalValue.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5" />
                              </tr>
                              {categories.map(({ category, materials }) => (
                                <Fragment key={`${owner}-${category}`}>
                                  <tr className="bg-gray-50/50">
                                    <td colSpan={8} className="p-0">
                                      <div className="flex items-center gap-2 px-5 py-2 ml-3 border-l-2 border-gray-200">
                                        <Tag className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                        <span className="text-xs font-semibold text-gray-600">{category}</span>
                                        <span className="text-xs text-gray-400">
                                          {materials.length} {materials.length === 1 ? 'material' : 'materials'}
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                  {materials.map((material) => {
                                    const stockStatus =
                                      material.current_stock <= 0
                                        ? 'out'
                                        : material.current_stock <= material.minimum_stock
                                          ? 'low'
                                          : 'normal'
                                    const isHighlighted = highlightedMaterialId === material.id
                                    const purchaseStockDisplay = formatStockAsPurchaseWithRemainder(
                                      material.current_stock,
                                      material
                                    )
                                    const minimumStockDisplay = formatStockAsPurchaseWithRemainder(
                                      material.minimum_stock,
                                      material
                                    )

                                    return (
                                      <tr
                                        key={`${owner}-${category}-${material.id}`}
                                        ref={(el) => {
                                          inventoryRowRefs.current[material.id] = el
                                        }}
                                        className={`transition-colors ${
                                          isHighlighted
                                            ? 'bg-amber-100'
                                            : 'bg-white hover:bg-amber-50/80'
                                        }`}
                                      >
                                        <td className="px-5 py-3 whitespace-nowrap">
                                          <div className="flex items-center gap-2 pl-3">
                                            <div className="min-w-0">
                                              <div className="text-sm font-medium text-gray-900 truncate max-w-[220px] sm:max-w-none">
                                                {material.material_name}
                                              </div>
                                              {material.sku && (
                                                <div className="text-xs text-gray-400 mt-0.5">{material.sku}</div>
                                              )}
                                            </div>
                                            {(sharedOwnersByMaterialId[material.id]?.length ?? 0) > 1 && (
                                              <MultiOwnerIndicator owners={sharedOwnersByMaterialId[material.id]} />
                                            )}
                                            <MaterialUnitHierarchyIndicator material={material} />
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <div className="text-sm text-gray-700">
                                            {material.supplier ? (
                                              <span className="text-purple-700 font-medium">
                                                {material.supplier.name}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400">—</span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <span
                                            className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                                              stockStatus === 'out'
                                                ? 'bg-red-100 text-red-800'
                                                : stockStatus === 'low'
                                                  ? 'bg-amber-100 text-amber-900'
                                                  : 'bg-emerald-100 text-emerald-800'
                                            }`}
                                          >
                                            {stockStatus === 'out'
                                              ? 'Out of stock'
                                              : stockStatus === 'low'
                                                ? 'Low stock'
                                                : 'In stock'}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                          <div className="text-sm font-semibold text-gray-900 tabular-nums">
                                            {purchaseStockDisplay}
                                          </div>
                                          <div className="text-[11px] text-gray-400 tabular-nums">
                                            {formatStockUnitTotal(material.current_stock, material)}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                          <div className="text-sm text-gray-500 tabular-nums">
                                            {minimumStockDisplay}
                                          </div>
                                          <div className="text-[11px] text-gray-400 tabular-nums">
                                            {formatStockUnitTotal(material.minimum_stock, material)}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                          <div className="text-sm text-gray-600 tabular-nums">
                                            ₱
                                            {material.unit_cost.toLocaleString(undefined, {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })}
                                          </div>
                                          <div className="text-[11px] text-gray-400">
                                            / {getPurchaseUnit(material)}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                          <div className="text-sm font-semibold text-blue-700 tabular-nums">
                                            ₱
                                            {(material.current_stock * getStockUnitCost(material)).toLocaleString(
                                              undefined,
                                              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-center">
                                          <div className="inline-flex items-center gap-0.5">
                                            {canEdit && (
                                              <button
                                                onClick={() => {
                                                  setSelectedMaterialForMovement(material)
                                                  setShowStockMovementModal(true)
                                                }}
                                                className="p-1.5 text-blue-600 hover:text-blue-800 rounded-md hover:bg-gray-100 transition-colors"
                                                title="Stock In/Out"
                                              >
                                                <Package size={15} />
                                              </button>
                                            )}
                                            <button
                                              onClick={async () => {
                                                setSelectedMaterialForHistory(material)
                                                await loadMovementHistory(material.id)
                                                setShowMovementHistory(true)
                                              }}
                                              className="p-1.5 text-purple-600 hover:text-purple-800 rounded-md hover:bg-gray-100 transition-colors"
                                              title="History"
                                            >
                                              <History size={15} />
                                            </button>
                                            {canEdit && !isMaterialReadOnly(material) && (
                                              <button
                                                onClick={() => {
                                                  setEditingMaterial(material)
                                                  setShowMaterialModal(true)
                                                }}
                                                className="p-1.5 text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100 transition-colors"
                                                title="Edit"
                                              >
                                                <Edit size={15} />
                                              </button>
                                            )}
                                            {canEdit && !isMaterialReadOnly(material) && (
                                            <button
                                              onClick={async () => {
                                                if (!canEdit) return
                                                if (Number(material.current_stock) > 0) {
                                                  alert(
                                                    `Cannot delete "${material.material_name}" while stock is on hand (${material.current_stock} ${material.unit}).\n\nPost a stock-out or adjustment first to clear inventory.`
                                                  )
                                                  return
                                                }
                                                if (
                                                  !confirm(
                                                    `Delete "${material.material_name}"?\n\nThis will also delete all stock movement history.`
                                                  )
                                                )
                                                  return

                                                const { error } = await supabase
                                                  .from('raw_materials')
                                                  .delete()
                                                  .eq('id', material.id)

                                                if (error) {
                                                  alert(`Error deleting material: ${error.message}`)
                                                } else {
                                                  loadRawMaterials()
                                                }
                                              }}
                                              className="p-1.5 text-red-600 hover:text-red-800 rounded-md hover:bg-gray-100 transition-colors"
                                              title="Delete"
                                            >
                                              <Trash2 size={15} />
                                            </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </Fragment>
                              ))}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {plantMaterialsManagedHere && !rawMaterialsLoading ? (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-4 py-4 sm:px-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50/80 to-white">
                    <h2 className="text-lg font-semibold text-gray-900">Components</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Factory-produced materials managed under GFC Main. Add/edit from Factory →
                      Components.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-800">
                        {gfcComponentMaterials.length}{' '}
                        {gfcComponentMaterials.length === 1 ? 'component' : 'components'}
                      </span>
                    </div>
                  </div>
                  {gfcComponentMaterials.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <Package className="h-9 w-9 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium">
                        {rawMaterialsSearch.trim()
                          ? 'No components match your search'
                          : 'No components yet'}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {rawMaterialsSearch.trim()
                          ? 'Try a different keyword or clear the search.'
                          : 'Create components from Factory → Components.'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-gray-50/80 sticky top-0 z-[1]">
                          <tr className="border-b border-gray-200">
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              Component
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              Production Unit
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              Min
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              <span className="inline-flex items-center justify-end gap-1">
                                Unit cost
                                <HoverTooltipIcon
                                  label="From BOM"
                                  ariaLabel="Unit cost is from BOM"
                                >
                                  <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                                </HoverTooltipIcon>
                              </span>
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              Value
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {gfcComponentMaterials.map((material) => {
                            const stockStatus =
                              material.current_stock <= 0
                                ? 'out'
                                : material.current_stock <= material.minimum_stock
                                  ? 'low'
                                  : 'normal'
                            const isHighlighted = highlightedMaterialId === material.id
                            const purchaseStockDisplay = formatStockAsPurchaseWithRemainder(
                              material.current_stock,
                              material
                            )
                            const minimumStockDisplay = formatStockAsPurchaseWithRemainder(
                              material.minimum_stock,
                              material
                            )

                            return (
                              <tr
                                key={`component-${material.id}`}
                                ref={(el) => {
                                  inventoryRowRefs.current[material.id] = el
                                }}
                                className={`transition-colors ${
                                  isHighlighted
                                    ? 'bg-amber-100'
                                    : 'bg-white hover:bg-amber-50/80'
                                }`}
                              >
                                <td className="px-5 py-3 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium text-gray-900 truncate max-w-[220px] sm:max-w-none">
                                        {material.material_name}
                                      </div>
                                      {material.sku ? (
                                        <div className="text-xs text-gray-400 mt-0.5">
                                          {material.sku}
                                        </div>
                                      ) : null}
                                    </div>
                                    {(sharedOwnersByMaterialId[material.id]?.length ?? 0) > 1 && (
                                      <MultiOwnerIndicator
                                        owners={sharedOwnersByMaterialId[material.id]}
                                      />
                                    )}
                                    <MaterialUnitHierarchyIndicator material={material} />
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span
                                    className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                                      stockStatus === 'out'
                                        ? 'bg-red-100 text-red-800'
                                        : stockStatus === 'low'
                                          ? 'bg-amber-100 text-amber-900'
                                          : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {stockStatus === 'out'
                                      ? 'Out of stock'
                                      : stockStatus === 'low'
                                        ? 'Low stock'
                                        : 'In stock'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                  <div className="text-sm font-semibold text-gray-900 tabular-nums">
                                    {purchaseStockDisplay}
                                  </div>
                                  <div className="text-[11px] text-gray-400 tabular-nums">
                                    {formatStockUnitTotal(material.current_stock, material)}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                  <div className="text-sm text-gray-500 tabular-nums">
                                    {minimumStockDisplay}
                                  </div>
                                  <div className="text-[11px] text-gray-400 tabular-nums">
                                    {formatStockUnitTotal(material.minimum_stock, material)}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                  <div className="text-sm text-gray-600 tabular-nums">
                                    ₱
                                    {Number(material.unit_cost || 0).toLocaleString('en-US', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </div>
                                  <div className="text-[11px] text-gray-400">
                                    / {getPurchaseUnit(material)}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                  <div className="text-sm font-semibold text-blue-700 tabular-nums">
                                    ₱
                                    {(
                                      material.current_stock * getStockUnitCost(material)
                                    ).toLocaleString('en-US', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  <div className="inline-flex items-center gap-0.5">
                                    {canEdit && (
                                      <button
                                        onClick={() => {
                                          setSelectedMaterialForMovement(material)
                                          setShowStockMovementModal(true)
                                        }}
                                        className="p-1.5 text-blue-600 hover:text-blue-800 rounded-md hover:bg-gray-100 transition-colors"
                                        title="Stock In/Out"
                                      >
                                        <Package size={15} />
                                      </button>
                                    )}
                                    <button
                                      onClick={async () => {
                                        setSelectedMaterialForHistory(material)
                                        await loadMovementHistory(material.id)
                                        setShowMovementHistory(true)
                                      }}
                                      className="p-1.5 text-purple-600 hover:text-purple-800 rounded-md hover:bg-gray-100 transition-colors"
                                      title="History"
                                    >
                                      <History size={15} />
                                    </button>
                                    {canEdit && !isMaterialReadOnly(material) && (
                                      <button
                                        onClick={() => {
                                          setEditingMaterial(material)
                                          setShowMaterialModal(true)
                                        }}
                                        className="p-1.5 text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100 transition-colors"
                                        title="Edit"
                                      >
                                        <Edit size={15} />
                                      </button>
                                    )}
                                    {canEdit && !isMaterialReadOnly(material) && (
                                      <button
                                        onClick={async () => {
                                          if (!canEdit) return
                                          if (Number(material.current_stock) > 0) {
                                            alert(
                                              `Cannot delete "${material.material_name}" while stock is on hand (${material.current_stock} ${material.unit}).\n\nPost a stock-out or adjustment first to clear inventory.`
                                            )
                                            return
                                          }
                                          if (
                                            !confirm(
                                              `Delete "${material.material_name}"?\n\nThis will also delete all stock movement history.`
                                            )
                                          )
                                            return

                                          const { error } = await supabase
                                            .from('raw_materials')
                                            .delete()
                                            .eq('id', material.id)

                                          if (error) {
                                            alert(`Error deleting material: ${error.message}`)
                                          } else {
                                            loadRawMaterials()
                                          }
                                        }}
                                        className="p-1.5 text-red-600 hover:text-red-800 rounded-md hover:bg-gray-100 transition-colors"
                                        title="Delete"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'fixed_assets' && selectedBrand && (
            <div className="p-4 sm:p-6 space-y-3">
              <p className="text-sm text-gray-600">
                Same fixed assets register as{' '}
                <span className="font-medium text-gray-800">Accounting → Fixed Assets</span>
                . Add assets here, select them on purchase orders, and receiving updates quantity and posts to
                account <span className="font-mono text-xs">1500</span>.
                {onNavigateToAccounting ? (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={onNavigateToAccounting}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Open Accounting
                    </button>
                  </>
                ) : null}
              </p>
              <FixedAssetsPanel
                selectedBrand={selectedBrand}
                suppliers={suppliers}
                theme={theme}
                createdBy={currentUsername.trim() || 'Procurement'}
                readOnlyMode={!canEdit}
                showAccountingLink
              />
            </div>
          )}

          {activeTab === 'intercompany' && selectedBrand && (
            <MaterialTransfersPanel
              selectedBrand={selectedBrand}
              brands={brands}
              theme={theme}
              currentUsername={currentUsername}
              readOnly={readOnlyMode}
            />
          )}
            </>
          )}
        </div>
      </div>

      {/* MODALS */}
      {showPOModal && canEdit && (
        <POModal
          po={editingPO}
          items={poItems}
          setItems={setPOItems}
          suppliers={suppliers}
          brandId={selectedBrand?.id || ''}
          purchaserTemplates={purchaserTemplates}
          amendMode={Boolean(editingPO && poIsAmendOnly(editingPO.status))}
          onManagePurchaserTemplates={() => setShowPurchaserTemplateModal(true)}
          onSave={savePurchaseOrder}
          onClose={() => {
            setShowPOModal(false)
            setEditingPO(null)
            setPOItems([])
          }}
        />
      )}

      {showPurchaserTemplateModal && canEdit && selectedBrand && (
        <POPurchaserTemplateModal
          brandId={selectedBrand.id}
          brandName={selectedBrand.name}
          onClose={() => setShowPurchaserTemplateModal(false)}
          onTemplatesChanged={refreshPurchaserTemplates}
        />
      )}
      
      {showSupplierModal && canEdit && (
        <SupplierModal
          supplier={editingSupplier}
          brandId={selectedBrand?.id || ''}
          onSave={saveSupplier}
          onClose={() => {
            setShowSupplierModal(false)
            setEditingSupplier(null)
          }}
        />
      )}
      
      {showDeliveryModal && canEdit && selectedPOForDelivery && (
        <DeliveryModal
          po={selectedPOForDelivery}
          invoiceMatch={invoiceMatchByPoId[selectedPOForDelivery.id]}
          onSave={saveDelivery}
          onClose={() => {
            setShowDeliveryModal(false)
            setSelectedPOForDelivery(null)
          }}
        />
      )}

      {viewingReceivingReportId && (
        <ReceivingReportViewModal
          receiptId={viewingReceivingReportId}
          onClose={() => setViewingReceivingReportId(null)}
        />
      )}
      
      {showPRDetailsModal && selectedPRForDetails && (
        (() => {
          const linkedPO = purchaseOrders.find((po) => po.pr_id === selectedPRForDetails.id)
          return (
        <PRDetailsModal
          pr={selectedPRForDetails}
          linkedPO={linkedPO}
          onOpenPurchaseOrder={(poId) => {
            setShowPRDetailsModal(false)
            setSelectedPRForDetails(null)
            viewPODetails(poId)
          }}
          onClose={() => {
            setShowPRDetailsModal(false)
            setSelectedPRForDetails(null)
          }}
        />
          )
        })()
      )}

      {showPRModal && canEdit && (
        <PRModal
          brandId={selectedBrand?.id || ''}
          onSave={async (prData) => {
            if (!canEdit) return
            // Generate PR number
            const date = new Date()
            const year = date.getFullYear().toString().slice(-2)
            const random = Math.floor(Math.random() * 9000) + 1000
            const pr_number = `PR-${year}${random}`
            
            // Separate items from pr data
            const { items, ...prFields } = prData
            
            const pr = {
              pr_number,
              brand_id: selectedBrand?.id,
              requested_by: prFields.requested_by,
              department: prFields.department || null,
              request_date: new Date().toISOString().split('T')[0],
              required_date: prFields.required_date || null,
              purpose: prFields.purpose || null,
              notes: prFields.notes || null,
              status: 'draft'
            }
            
            console.log('Creating PR:', pr)
            
            const { data: newPR, error } = await supabase
              .from('purchase_requisitions')
              .insert([pr])
              .select()
              .single()
            
            if (error) {
              console.error('Error creating PR:', error)
              alert(`Error creating PR: ${error.message}`)
              return
            }
            
            // Insert PR items
            if (newPR && items && items.length > 0) {
              const itemsToInsert = items.map((item: any) => ({
                pr_id: newPR.id,
                product_description: item.product_description,
                quantity: item.quantity,
                unit: item.unit,
                estimated_price: typeof item.estimated_price === 'string' ? parseFloat(item.estimated_price) || null : item.estimated_price || null,
                notes: item.notes || null
              }))
              
              console.log('Inserting PR items:', itemsToInsert)
              
              const { error: itemsError } = await supabase
                .from('purchase_requisition_items')
                .insert(itemsToInsert)
              
              if (itemsError) {
                console.error('Error inserting PR items:', itemsError)
                alert(`Error adding items: ${itemsError.message}`)
              }
            }
            
            setShowPRModal(false)
            loadRequisitions()
            alert(`Requisition ${pr_number} created successfully!`)
          }}
          onClose={() => setShowPRModal(false)}
        />
      )}
      
      {showConvertPRModal && canEdit && convertingPR && (
        <ConvertPRtoPOModal
          pr={convertingPR}
          items={poItems}
          setItems={setPOItems}
          suppliers={suppliers}
          brandId={selectedBrand?.id || ''}
          purchaserTemplates={purchaserTemplates}
          onManagePurchaserTemplates={() => setShowPurchaserTemplateModal(true)}
          onSave={async (poData) => {
            if (!canEdit) return
            if (!selectedBrand) return
            
            const po = {
              ...poData,
              supplier_id: normalizePoSupplierId(poData.supplier_id),
              brand_id: selectedBrand.id,
              pr_id: convertingPR.id,
              po_number: generatePONumber(),
              status: 'draft',
              subtotal: 0,
              tax_amount: 0,
              total_amount: 0,
              paid_amount: 0,
              balance_amount: 0
            }
            
            console.log('Creating PO from PR:', po)
            
            const { data: newPO, error } = await supabase
              .from('purchase_orders')
              .insert([po])
              .select()
              .single()
            
            if (error) {
              console.error('Error creating PO:', error)
              alert(`Error creating PO: ${error.message}`)
              return
            }
            
            if (newPO && poItems.length > 0) {
              const itemsToInsert = poItems.map(item => ({
                product_description: item.product_description,
                quantity: item.quantity,
                unit: item.unit,
                unit_price: typeof item.unit_price === 'string' ? parseFloat(item.unit_price) || 0 : item.unit_price,
                notes: item.notes || null,
                material_id: item.fixed_asset_id ? null : item.material_id || null,
                fixed_asset_id: item.material_id ? null : item.fixed_asset_id || null,
                po_id: newPO.id
              }))
              
              console.log('Inserting PO items:', itemsToInsert)
              
              const { error: itemsError } = await supabase
                .from('purchase_order_items')
                .insert(itemsToInsert)
              
              if (itemsError) {
                console.error('Error inserting items:', itemsError)
                alert(`Error adding items: ${itemsError.message}`)
                return
              }
            }
            
            // Update PR status to converted
            await supabase
              .from('purchase_requisitions')
              .update({ status: 'converted' })
              .eq('id', convertingPR.id)
            
            setShowConvertPRModal(false)
            setConvertingPR(null)
            setPOItems([])
            loadPurchaseOrders()
            loadRequisitions()
            alert(`PO ${newPO.po_number} created successfully from ${convertingPR.pr_number}!`)
          }}
          onClose={() => {
            setShowConvertPRModal(false)
            setConvertingPR(null)
            setPOItems([])
          }}
        />
      )}
      
      {showMaterialModal && canEdit && (
        <MaterialModal
          material={editingMaterial}
          brandId={selectedBrand?.id || ''}
          allMaterials={rawMaterials}
          suppliers={suppliers}
          existingCategories={Array.from(new Set(
            rawMaterials
              .map((m) => m.category?.trim())
              .filter((category): category is string => Boolean(category))
          )).sort((a, b) => a.localeCompare(b))}
          ownerOptions={sortOwnerOptions(
            Array.from(
              new Set([
                ...brands.map((b) => b.name),
                ...rawMaterials
                  .flatMap((m) => (m.owner ?? []).map((owner) => owner.trim()))
                  .filter((owner) => Boolean(owner)),
              ])
            ),
            ownerBrandSlugMap
          )}
          ownerBrandSlugMap={ownerBrandSlugMap}
          onSave={async (materialData) => {
            if (!canEdit) return
            // Parse string values to numbers
            const dataToSave = {
              ...materialData,
              supplier_id: materialData.supplier_id?.trim() ? materialData.supplier_id : null,
              unit_cost:
                typeof materialData.unit_cost === 'string'
                  ? parseMoneyInput(materialData.unit_cost)
                  : parseMoneyInput(materialData.unit_cost),
              minimum_stock:
                typeof materialData.minimum_stock === 'string'
                  ? parseWholeQuantityInput(materialData.minimum_stock)
                  : Math.max(0, Math.floor(Number(materialData.minimum_stock) || 0)),
              current_stock:
                typeof materialData.current_stock === 'string'
                  ? parseWholeQuantityInput(materialData.current_stock)
                  : Math.max(0, Math.floor(Number(materialData.current_stock) || 0)),
              uom_base_per_unit:
                typeof materialData.uom_base_per_unit === 'string'
                  ? Math.max(1, parseWholeQuantityInput(materialData.uom_base_per_unit))
                  : Math.max(1, Math.floor(Number(materialData.uom_base_per_unit) || 1)),
              uom_stock_per_purchase:
                typeof materialData.uom_stock_per_purchase === 'string'
                  ? Math.max(1, parseWholeQuantityInput(materialData.uom_stock_per_purchase))
                  : Math.max(1, Math.floor(Number(materialData.uom_stock_per_purchase) || 1)),
              uom_base_unit: materialData.uom_base_unit || materialData.unit,
              uom_purchase_unit: materialData.uom_purchase_unit || materialData.unit,
              linked_product_id: editingMaterial?.linked_product_id || null,
              factory_inventory_kind: isFactoryInventoryKind(materialData.factory_inventory_kind)
                ? materialData.factory_inventory_kind
                : null,
              factory_request_uom: isFactoryInventoryKind(materialData.factory_inventory_kind)
                ? materialData.factory_request_uom === 'purchase'
                  ? 'purchase'
                  : 'stock'
                : null,
              factory_bom_uom: isFactoryInventoryKind(materialData.factory_inventory_kind)
                ? isFactoryBomUom(materialData.factory_bom_uom)
                  ? materialData.factory_bom_uom
                  : 'base'
                : null,
            }

            const isComponentSave = isComponentMaterialCategory(dataToSave.category)
            if (isComponentSave && editingMaterial?.linked_product_id) {
              try {
                dataToSave.unit_cost = await syncComponentCostFromBom(
                  editingMaterial.linked_product_id
                )
              } catch (err) {
                console.warn('syncComponentCostFromBom:', err)
                dataToSave.unit_cost = 0
              }
            }
            
            if (editingMaterial) {
              // Keep owner-split material settings in sync across brands while
              // preserving per-record ownership and stock balances.
              const oldName = (editingMaterial.material_name || '').trim()
              const oldSku = (editingMaterial.sku || '').trim()
              const oldUnit = (editingMaterial.unit || '').trim()

              let siblingQuery = supabase
                .from('raw_materials')
                .select('id, brand_id, owner, material_name, sku, unit')
                .eq('material_name', oldName)
                .eq('unit', oldUnit)
                .limit(200)

              if (oldSku) {
                siblingQuery = siblingQuery.eq('sku', oldSku)
              } else {
                siblingQuery = siblingQuery.or('sku.is.null,sku.eq.')
              }

              const { data: familyRows, error: siblingErr } = await siblingQuery
              if (siblingErr) {
                console.warn('Failed to load sibling material rows:', siblingErr.message)
              } else {
                const family = (familyRows || []) as Array<{
                  id: string
                  brand_id: string | null
                  owner: string[] | null
                }>
                const familyIds = family.map((row) => row.id)
                const {
                  current_stock: _skipCurrentStock,
                  owner: _skipOwner,
                  brand_id: _skipBrandId,
                  ...sharedSettings
                } = dataToSave as Partial<RawMaterial>

                if (familyIds.length > 0) {
                  const { error: syncErr } = await supabase
                    .from('raw_materials')
                    .update(sharedSettings)
                    .in('id', familyIds)
                  if (syncErr) {
                    alert(
                      `Material updated, but syncing settings to other owner rows failed: ${syncErr.message}`
                    )
                    return
                  }
                } else {
                  const { error: fallbackErr } = await supabase
                    .from('raw_materials')
                    .update(sharedSettings)
                    .eq('id', editingMaterial.id)
                  if (fallbackErr) {
                    alert(`Error updating material: ${fallbackErr.message}`)
                    return
                  }
                }

                // Owner chips in edit should add missing owner rows only.
                // Never duplicate rows and never clone stock balances.
                const requestedOwners = Array.from(
                  new Set(
                    (((dataToSave.owner as string[] | undefined) || [])
                      .map((o) => o.trim())
                      .filter(Boolean))
                  )
                )
                const existingOwnerKey = new Set(
                  family
                    .map((row) => (row.owner && row.owner[0] ? row.owner[0].trim().toLowerCase() : ''))
                    .filter(Boolean)
                )

                for (const ownerName of requestedOwners) {
                  const key = ownerName.toLowerCase()
                  if (existingOwnerKey.has(key)) continue

                  const ownerBrand = brands.find((b) => b.name === ownerName)
                  const ownerBrandId = ownerBrand?.id || selectedBrand?.id || null
                  const { error: createOwnerErr } = await supabase.from('raw_materials').insert([
                    {
                      ...sharedSettings,
                      brand_id: ownerBrandId,
                      owner: [ownerName],
                      current_stock: 0,
                    },
                  ])
                  if (createOwnerErr) {
                    alert(
                      `Material settings updated, but adding owner ${ownerName} failed: ${createOwnerErr.message}`
                    )
                    return
                  }
                }
              }
            } else {
              const initialStock = Number(dataToSave.current_stock) || 0
              const ownerNames = ((dataToSave.owner as string[] | undefined) || [])
                .map((o) => o.trim())
                .filter(Boolean)
              const ownerRows = Array.from(new Set(ownerNames))

              const insertedRows: Array<{ id: string; brand_id: string | null; owner: string }> = []
              for (const ownerName of ownerRows) {
                const ownerBrand = brands.find((b) => b.name === ownerName)
                const ownerBrandId = ownerBrand?.id || selectedBrand?.id || null

                const { data: existingOwnerRow } = await supabase
                  .from('raw_materials')
                  .select('id')
                  .eq('material_name', String(dataToSave.material_name || '').trim())
                  .eq('unit', String(dataToSave.unit || '').trim())
                  .eq('brand_id', ownerBrandId)
                  .contains('owner', [ownerName])
                  .limit(1)
                  .maybeSingle()
                if (existingOwnerRow?.id) continue

                const { data: newMaterial, error } = await supabase
                  .from('raw_materials')
                  .insert([
                    {
                      ...dataToSave,
                      brand_id: ownerBrandId,
                      owner: [ownerName],
                      current_stock: initialStock > 0 ? 0 : initialStock,
                    },
                  ])
                  .select('id, brand_id')
                  .single()

                if (error || !newMaterial?.id) {
                  alert(`Error adding material for owner ${ownerName}: ${error?.message || 'Unknown error'}`)
                  return
                }
                insertedRows.push({
                  id: newMaterial.id as string,
                  brand_id: (newMaterial.brand_id as string | null) || null,
                  owner: ownerName,
                })
              }

              if (initialStock > 0 && insertedRows.length > 0) {
                const targetForOpening =
                  insertedRows.find((row) => row.brand_id === selectedBrand?.id) || insertedRows[0]

                const { data: openingMovement, error: movErr } = await supabase
                  .from('material_stock_movements')
                  .insert({
                    material_id: targetForOpening.id,
                    movement_type: 'in',
                    quantity: initialStock,
                    unit_cost: dataToSave.unit_cost,
                    reference_type: 'initial_stock',
                    reference_number: 'Opening stock',
                    notes:
                      insertedRows.length > 1
                        ? `Initial stock on material create (${targetForOpening.owner})`
                        : 'Initial stock on material create',
                    movement_date: new Date().toISOString().split('T')[0],
                    created_by: movementCreatedBy,
                  })
                  .select('id')
                  .single()

                if (movErr) {
                  alert(`Material added but opening stock movement failed: ${movErr.message}`)
                } else if (openingMovement?.id && targetForOpening.brand_id) {
                  const { postMaterialMovementJournalWithNotice } = await import(
                    '../../lib/accounting-movement-posting'
                  )
                  await postMaterialMovementJournalWithNotice(
                    openingMovement.id,
                    targetForOpening.brand_id,
                    movementCreatedBy,
                    'opening stock'
                  )
                }
              }
            }
            
            setShowMaterialModal(false)
            setEditingMaterial(null)
            loadRawMaterials()
          }}
          onClose={() => {
            setShowMaterialModal(false)
            setEditingMaterial(null)
          }}
        />
      )}
      
      {showCycleCountPanel && canEdit && selectedBrand && (
        <MaterialsCycleCountPanel
          selectedBrand={selectedBrand}
          brands={brands}
          rawMaterials={rawMaterials}
          createdBy={movementCreatedBy}
          onClose={() => setShowCycleCountPanel(false)}
          onPosted={() => loadRawMaterials()}
        />
      )}

      {showStockMovementModal && canEdit && selectedMaterialForMovement && (
        <StockMovementModal
          material={selectedMaterialForMovement}
          onSave={async (movementData) => {
            if (!canEdit) return
            const baseMovementData = { ...movementData }

            if (
              baseMovementData.movement_type === 'out' &&
              selectedMaterialForMovement.linked_product_id
            ) {
              const transferQty = Number(baseMovementData.quantity) || 0
              if (transferQty > 0) {
                const { data: linkedProduct, error: linkedProductError } = await supabase
                  .from('products')
                  .select('id, name, initial_stock')
                  .eq('id', selectedMaterialForMovement.linked_product_id)
                  .single()

                if (linkedProductError || !linkedProduct) {
                  alert(
                    `Error loading linked product inventory: ${linkedProductError?.message || 'Product not found'}`
                  )
                  return
                }

                const productInitial = Number(linkedProduct.initial_stock) || 0
                const productFinal = productInitial + transferQty

                const transferMovementData: Partial<MaterialStockMovement> = {
                  ...baseMovementData,
                  created_by: movementCreatedBy,
                  reference_type: 'transfer_to_product_inventory',
                  reference_id: linkedProduct.id,
                  reference_number: linkedProduct.name || baseMovementData.reference_number,
                  notes: [
                    baseMovementData.notes?.trim(),
                    `Transferred to product inventory: ${linkedProduct.name || 'Linked product'}`,
                    `Product inventory stock: initial ${productInitial} -> final ${productFinal}`,
                  ]
                    .filter(Boolean)
                    .join(' | '),
                }

                const { data: transferMovement, error: movementError } = await supabase
                  .from('material_stock_movements')
                  .insert([{ ...transferMovementData, material_id: selectedMaterialForMovement.id }])
                  .select('id')
                  .single()

                if (movementError) {
                  alert(`Error recording movement: ${movementError.message}`)
                  return
                }

                if (transferMovement?.id) {
                  const brandId =
                    selectedBrand?.id || selectedMaterialForMovement.brand_id
                  if (brandId) {
                    const { postMaterialMovementJournalWithNotice } = await import(
                      '../../lib/accounting-movement-posting'
                    )
                    await postMaterialMovementJournalWithNotice(
                      transferMovement.id,
                      brandId,
                      movementCreatedBy,
                      'transfer to product inventory'
                    )
                  }
                }

                const { error: transferError } = await supabase
                  .from('products')
                  .update({ initial_stock: productFinal })
                  .eq('id', linkedProduct.id)

                if (transferError) {
                  alert(
                    `Movement recorded, but transfer to product inventory failed: ${transferError.message}\n` +
                    `Please adjust inventory manually.`
                  )
                }

                setShowStockMovementModal(false)
                setSelectedMaterialForMovement(null)
                loadRawMaterials()
                return
              }
            }

            const { data: newMovement, error } = await supabase
              .from('material_stock_movements')
              .insert([
                {
                  ...baseMovementData,
                  material_id: selectedMaterialForMovement.id,
                  created_by: movementCreatedBy,
                },
              ])
              .select('id')
              .single()
            
            if (error) {
              alert(`Error recording movement: ${error.message}`)
              return
            }

            if (newMovement?.id) {
              const brandId = selectedBrand?.id || selectedMaterialForMovement.brand_id
              if (brandId) {
                const { postMaterialMovementJournalWithNotice } = await import(
                  '../../lib/accounting-movement-posting'
                )
                await postMaterialMovementJournalWithNotice(
                  newMovement.id,
                  brandId,
                  movementCreatedBy,
                  'stock movement'
                )
              }
            }
            
            setShowStockMovementModal(false)
            setSelectedMaterialForMovement(null)
            loadRawMaterials()
          }}
          onClose={() => {
            setShowStockMovementModal(false)
            setSelectedMaterialForMovement(null)
          }}
        />
      )}
      
      {showMovementHistory && selectedMaterialForHistory && (
        <MovementHistoryModal
          material={selectedMaterialForHistory}
          movements={movementHistory}
          onClose={() => {
            setShowMovementHistory(false)
            setSelectedMaterialForHistory(null)
            setMovementHistory([])
          }}
        />
      )}
      
      {showPODetailsModal && selectedPOForDetails && (
        <PODetailsModal
          po={selectedPOForDetails}
          onOpenRequisition={openReferencedRequisition}
          onClose={() => {
            setShowPODetailsModal(false)
            setSelectedPOForDetails(null)
          }}
        />
      )}
    </div>
  )
}

// =============================================
// SUPPLIER MODAL
// =============================================

function SupplierModal({ supplier, brandId, onSave, onClose }: {
  supplier: Supplier | null
  brandId: string
  onSave: (supplier: Partial<Supplier>) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    name: supplier?.name || '',
    contact_person: supplier?.contact_person || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    payment_terms: supplier?.payment_terms || '',
    payment_method: supplier?.payment_method || 'bank_transfer',
    bank_name: supplier?.bank_name || '',
    bank_account_number: supplier?.bank_account_number || '',
    bank_account_name: supplier?.bank_account_name || '',
    lead_time_days: supplier?.lead_time_days ?? 0,
    notes: supplier?.notes || '',
    is_active: supplier?.is_active ?? true
  })
  
  const [supplierProducts, setSupplierProducts] = useState<RawMaterial[]>([])
  const [showProducts, setShowProducts] = useState(false)
  
  useEffect(() => {
    if (supplier?.id) {
      loadSupplierProducts()
    }
  }, [supplier?.id])
  
  const loadSupplierProducts = async () => {
    if (!supplier?.id) return
    const { data } = await supabase
      .from('raw_materials')
      .select('*')
      .eq('brand_id', brandId)
      .eq('supplier_id', supplier.id)
      .eq('is_active', true)
      .order('material_name')
    
    if (data) setSupplierProducts(data)
  }
  
  return (
    <Modal onClose={onClose} align="center">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold">
            {supplier ? 'Edit Supplier' : 'Add Supplier'}
          </h2>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Supplier Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Contact Person</label>
              <input
                type="text"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Payment Terms</label>
              <select
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Terms</option>
                <option value="COD">COD (Cash on Delivery)</option>
                <option value="Payment upon order">Payment upon order</option>
                <option value="Payment before delivery">Payment before delivery</option>
                <option value="Payment after delivery">Payment after delivery</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Supplier Lead Time (days)</label>
              <input
                type="number"
                min={0}
                value={formData.lead_time_days}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    lead_time_days: Math.max(0, parseInt(e.target.value || '0', 10) || 0),
                  })
                }
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Payment Method</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Bank Name</label>
              <input
                type="text"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Account Number</label>
              <input
                type="text"
                value={formData.bank_account_number}
                onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Account Name</label>
              <input
                type="text"
                value={formData.bank_account_name}
                onChange={(e) => setFormData({ ...formData, bank_account_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
            
            {/* Supplier Products List */}
            {supplier && supplierProducts.length > 0 && (
              <div className="col-span-2">
                <button
                  onClick={() => setShowProducts(!showProducts)}
                  type="button"
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium text-sm flex items-center justify-between"
                >
                  <span>Products from this Supplier ({supplierProducts.length})</span>
                  <span>{showProducts ? 'â–¼' : 'â–¶'}</span>
                </button>
                
                {showProducts && (
                  <div className="mt-3 border border-gray-200 rounded-md p-3 bg-gray-50 max-h-60 overflow-y-auto">
                    <div className="space-y-2">
                      {supplierProducts.map((product) => (
                        <div key={product.id} className="bg-white border border-gray-200 rounded p-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{product.material_name}</p>
                              {product.category && (
                                <p className="text-xs text-gray-500">{product.category}</p>
                              )}
                            </div>
                            <div className="text-right ml-3">
                              <p className="font-semibold text-sm">₱{product.unit_cost.toLocaleString()}</p>
                              <p className="text-xs text-gray-500">per {getPurchaseUnit(product)}</p>
                            </div>
                          </div>
                          {product.current_stock > 0 && (
                            <p className="text-xs text-gray-500 mt-1">Current stock: {product.current_stock} {product.unit}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="p-6 border-t flex items-center justify-between gap-3 sticky bottom-0 bg-white">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm font-medium">Active</span>
          </label>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(formData)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Supplier
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// =============================================
// PO MODAL
// =============================================

function POModal({
  po,
  items,
  setItems,
  suppliers,
  onSave,
  onClose,
  brandId,
  purchaserTemplates,
  onManagePurchaserTemplates,
  amendMode = false,
}: {
  po: PurchaseOrder | null
  items: Partial<PurchaseOrderItem>[]
  setItems: (items: Partial<PurchaseOrderItem>[]) => void
  suppliers: Supplier[]
  onSave: (poData: Partial<POFormData>) => void | Promise<void>
  onClose: () => void
  brandId: string
  purchaserTemplates: POPurchaserTemplate[]
  onManagePurchaserTemplates: () => void
  amendMode?: boolean
}) {
  const appliedDefaultTemplateRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [approvedByOptions, setApprovedByOptions] = useState<string[]>([])
  const [formData, setFormData] = useState<Partial<POFormData>>({
    supplier_id: po?.supplier_id || '',
    order_date: po?.order_date || new Date().toISOString().split('T')[0],
    expected_delivery_date: po?.expected_delivery_date || '',
    purchasing_agent: po?.purchasing_agent || '',
    approved_by: po?.approved_by || '',
    payment_terms: po?.payment_terms || '',
    payment_method: po?.payment_method || 'bank_transfer',
    payment_timing: po?.payment_timing || 'after_delivery',
    payment_account_name: po?.payment_account_name || '',
    payment_account_number: po?.payment_account_number || '',
    delivery_address: po?.delivery_address || '',
    delivery_contact: po?.delivery_contact || '',
    delivery_phone: po?.delivery_phone || '',
    notes: po?.notes || '',
  })

  const applyPurchaserTemplate = (template: POPurchaserTemplate) => {
    const preset = templateToPoPresetFields(template)
    setApprovedByOptions(preset.approved_by_signatories || [])
    setFormData((prev) => mergePoPresetIntoForm(prev, preset))
  }

  useEffect(() => {
    if (po || appliedDefaultTemplateRef.current) return
    const def = getDefaultPurchaserTemplate(purchaserTemplates)
    if (!def) return
    appliedDefaultTemplateRef.current = true
    const preset = templateToPoPresetFields(def)
    setApprovedByOptions(preset.approved_by_signatories || [])
    setFormData((prev) => mergePoPresetIntoForm(prev, preset))
  }, [po, purchaserTemplates])
  
  const [catalog, setCatalog] = useState<RawMaterial[]>([])
  const [fixedAssetCatalog, setFixedAssetCatalog] = useState<FixedAsset[]>([])
  const [showCatalog, setShowCatalog] = useState(false)
  const [catalogKind, setCatalogKind] = useState<'materials' | 'fixed_assets'>('materials')
  const selectedSupplier = suppliers.find((s) => s.id === formData.supplier_id)
  
  // Load line-item catalog (no-supplier items when PO has no supplier)
  useEffect(() => {
    loadSupplierCatalog(formData.supplier_id || null)
    if (formData.supplier_id && selectedSupplier && !po) {
      const updates: Partial<POFormData> = {}
      if (selectedSupplier.payment_terms) {
        const terms = selectedSupplier.payment_terms
        updates.payment_terms = terms
        updates.payment_timing = derivePaymentTimingFromTerms(terms)
        updates.payment_method = derivePaymentMethodFromTerms(terms)
      }
      if (Object.keys(updates).length > 0) {
        setFormData((prev) => {
          const merged = { ...prev, ...updates } as POFormData
          if (
            updates.payment_method &&
            updates.payment_method !== prev.payment_method
          ) {
            return applyPoPaymentMethodChange(merged, updates.payment_method)
          }
          return merged
        })
      }
    }
  }, [formData.supplier_id])

  useEffect(() => {
    if (formData.supplier_id) setCatalogKind('materials')
  }, [formData.supplier_id])

  // Auto-calculate expected delivery date using supplier lead time (new POs only)
  useEffect(() => {
    if (po) return
    if (!formData.supplier_id || !formData.order_date) return
    const selectedSupplier = suppliers.find((s) => s.id === formData.supplier_id)
    const leadDays = selectedSupplier?.lead_time_days ?? 0
    if (!leadDays || leadDays <= 0) return

    const base = new Date(formData.order_date)
    if (Number.isNaN(base.getTime())) return
    base.setDate(base.getDate() + leadDays)
    const expected = base.toISOString().split('T')[0]

    // Only fill when empty to avoid overwriting a user override
    if (!formData.expected_delivery_date) {
      setFormData((prev) => ({ ...prev, expected_delivery_date: expected }))
    }
  }, [po, formData.supplier_id, formData.order_date])
  
  const loadSupplierCatalog = async (supplierId: string | null) => {
    const { materials, fixedAssets } = await loadPoLineItemCatalog(brandId, supplierId)
    setCatalog(materials)
    setFixedAssetCatalog(fixedAssets)
  }

  const showFixedAssetsInPo = true

  const poItemSelectValue = (item: Partial<PurchaseOrderItem>) => {
    if (item.material_id) return `m:${item.material_id}`
    if (item.fixed_asset_id) return `f:${item.fixed_asset_id}`
    return ''
  }

  const addFromMaterialCatalog = (material: RawMaterial) => {
    const exists = items.some((item) => item.material_id === material.id)
    if (exists) {
      alert(`"${material.material_name}" is already in the order`)
      return
    }

    setItems([
      ...items,
      {
        product_description: material.material_name,
        quantity: 1,
        unit: getPurchaseUnit(material),
        unit_price: material.unit_cost,
        material_id: material.id,
        fixed_asset_id: undefined,
        material,
        fixed_asset: undefined,
        fromCatalog: true,
      },
    ])
  }

  const addFromFixedAssetCatalog = (asset: FixedAsset) => {
    const exists = items.some((item) => item.fixed_asset_id === asset.id)
    if (exists) {
      alert(`"${asset.asset_name}" is already in the order`)
      return
    }

    setItems([
      ...items,
      {
        product_description: asset.asset_name,
        quantity: 1,
        unit: asset.unit || 'unit',
        unit_price: asset.unit_cost,
        material_id: undefined,
        fixed_asset_id: asset.id,
        material: undefined,
        fixed_asset: asset,
        fromCatalog: true,
      },
    ])
  }
  
  // Validate if all items have required data
  const areItemsValid = items.length > 0 && items.every(item => 
    item.product_description && 
    item.product_description.trim() !== '' &&
    item.quantity && 
    item.quantity > 0 &&
    item.unit && 
    item.unit.trim() !== '' &&
    item.unit_price !== undefined && 
    item.unit_price >= 0
  )
  
  const isFormValid =
    formData.purchasing_agent &&
    formData.purchasing_agent.trim() !== '' &&
    arePoPaymentFieldsValid(
      formData.payment_method,
      formData.payment_account_name,
      formData.payment_account_number
    ) &&
    areItemsValid

  const handleSave = async () => {
    if (saving || !isFormValid) return
    setSaving(true)
    try {
      await onSave(formData)
    } finally {
      setSaving(false)
    }
  }

  const poCatalogEmptyHint = formData.supplier_id
    ? 'Add materials in Procurement and link to this supplier'
    : 'Add materials or fixed assets from the catalog, or select a supplier'
  
  const addItem = () => {
    setItems([
      ...items,
      {
        product_description: '',
        quantity: 1,
        unit: 'pcs',
        unit_price: '' as any,
        material_id: null,
        fixed_asset_id: null,
      },
    ])
  }
  
  const removeItem = (index: number) => {
    const item = items[index]
    const received = Number(item?.quantity_received) || 0
    if (amendMode && received > 0) {
      alert(`Cannot remove "${item?.product_description}" — ${received} already received.`)
      return
    }
    setItems(items.filter((_, i) => i !== index))
  }
  
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }
  
  const handleCatalogLineSelect = (index: number, value: string) => {
    if (!value) {
      handleProductClear(index)
      return
    }
    if (value.startsWith('m:')) {
      const materialId = value.slice(2)
      const material = catalog.find((m) => m.id === materialId) ?? (items[index] as PurchaseOrderItem).material
      if (!material) return
      const newItems = [...items]
      newItems[index] = {
        ...newItems[index],
        product_description: material.material_name,
        unit: getPurchaseUnit(material),
        unit_price: material.unit_cost,
        material_id: material.id,
        fixed_asset_id: undefined,
        material,
        fixed_asset: undefined,
        fromCatalog: true,
      }
      setItems(newItems)
      return
    }
    if (value.startsWith('f:')) {
      if (!showFixedAssetsInPo) return
      const assetId = value.slice(2)
      const asset =
        fixedAssetCatalog.find((a) => a.id === assetId) ?? (items[index] as PurchaseOrderItem).fixed_asset
      if (!asset) return
      const newItems = [...items]
      newItems[index] = {
        ...newItems[index],
        product_description: asset.asset_name,
        unit: asset.unit || 'unit',
        unit_price: asset.unit_cost,
        material_id: undefined,
        fixed_asset_id: asset.id,
        material: undefined,
        fixed_asset: asset,
        fromCatalog: true,
      }
      setItems(newItems)
    }
  }

  const getAvailableMaterialsForRow = (currentIndex: number) => {
    const currentItem = items[currentIndex]
    const selectedIds = items
      .map((item, i) => (i !== currentIndex ? item.material_id : null))
      .filter(Boolean) as string[]
    let available = catalog.filter(
      (m) => !selectedIds.includes(m.id) || m.id === currentItem?.material_id
    )
    if (
      currentItem?.material_id &&
      currentItem.material &&
      !available.find((m) => m.id === currentItem.material_id)
    ) {
      available = [...available, currentItem.material]
    }
    return available
  }

  const getAvailableFixedAssetsForRow = (currentIndex: number) => {
    if (!showFixedAssetsInPo) return []
    const currentItem = items[currentIndex]
    const selectedIds = items
      .map((item, i) => (i !== currentIndex ? item.fixed_asset_id : null))
      .filter(Boolean) as string[]
    let available = fixedAssetCatalog.filter(
      (a) => !selectedIds.includes(a.id) || a.id === currentItem?.fixed_asset_id
    )
    if (
      currentItem?.fixed_asset_id &&
      currentItem.fixed_asset &&
      !available.find((a) => a.id === currentItem.fixed_asset_id)
    ) {
      available = [...available, currentItem.fixed_asset]
    }
    return available
  }

  const handleProductClear = (index: number) => {
    const newItems = [...items]
    newItems[index] = {
      ...newItems[index],
      product_description: '',
      unit: 'pcs',
      unit_price: '' as any,
      material_id: null,
      fixed_asset_id: null,
      material: undefined,
      fixed_asset: undefined,
      fromCatalog: false,
    }
    setItems(newItems)
  }

  const catalogCount = showFixedAssetsInPo
    ? catalog.length + fixedAssetCatalog.length
    : catalog.length
  
  return (
    <Modal onClose={onClose} align="center">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b shrink-0">
          <div className="flex flex-wrap justify-between items-start gap-3">
            <h2 className="text-xl font-semibold">
              {po
                ? amendMode
                  ? `Amend PO - ${po.po_number}`
                  : `Edit PO - ${po.po_number}`
                : 'Create Purchase Order'}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {purchaserTemplates.length > 0 && (
                <select
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value
                    if (!id) return
                    const template = purchaserTemplates.find((t) => t.id === id)
                    if (template) applyPurchaserTemplate(template)
                    e.target.value = ''
                  }}
                >
                  <option value="">Apply template…</option>
                  {purchaserTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.template_name}
                      {t.is_default ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={onManagePurchaserTemplates}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Manage templates
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
          {amendMode && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              This PO is already approved or received. You can adjust quantities and unit prices to
              align with receiving reports and supplier invoices. Quantities cannot go below what has
              already been received, and received line items cannot be removed.
            </div>
          )}
          {/* Basic Information */}
          <div>
            <h3 className="font-medium mb-3">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Supplier</label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  disabled={amendMode && poItemsHaveReceipts(items)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">No supplier</option>
                  {suppliers.filter(s => s.is_active).map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                {!formData.supplier_id && (
                  <p className="mt-1 text-xs text-gray-600">
                    Order lines can use materials or fixed assets matching this PO&apos;s supplier (or with no supplier assigned).
                    Fixed assets are the same register as Accounting → Fixed Assets; receiving posts to GL 1500.
                  </p>
                )}
                {selectedSupplier?.lead_time_days && selectedSupplier.lead_time_days > 0 && (
                  <p className="mt-1 text-xs text-blue-700">
                    Estimated lead time: {selectedSupplier.lead_time_days} calendar day{selectedSupplier.lead_time_days === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Purchasing Agent *
                  {!formData.purchasing_agent && <span className="text-red-500 text-xs ml-1">(required)</span>}
                </label>
                <input
                  type="text"
                  value={formData.purchasing_agent}
                  onChange={(e) => setFormData({ ...formData, purchasing_agent: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    !formData.purchasing_agent 
                      ? 'border-red-300 focus:ring-red-500' 
                      : 'focus:ring-blue-500'
                  }`}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Approved by (signatory)</label>
                {approvedByOptions.length > 0 ? (
                  <select
                    value={formData.approved_by || ''}
                    onChange={(e) => setFormData({ ...formData, approved_by: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">—</option>
                    {approvedByOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.approved_by || ''}
                    onChange={(e) => setFormData({ ...formData, approved_by: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Name on PO signature line"
                  />
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Shown on printed PO. Configure options in Purchaser templates.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Order Date *</label>
                <input
                  type="date"
                  value={formData.order_date}
                  onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Expected Delivery *
                  {!formData.expected_delivery_date && <span className="text-red-500 text-xs ml-1">(required)</span>}
                </label>
                <input
                  type="date"
                  value={formData.expected_delivery_date}
                  onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    !formData.expected_delivery_date
                      ? 'border-red-300 focus:ring-red-500'
                      : 'focus:ring-blue-500'
                  }`}
                  required
                />
              </div>
            </div>
          </div>
          
          {/* Payment Information */}
          <div>
            <h3 className="font-medium mb-3">Payment Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Payment Terms</label>
                <select
                  value={formData.payment_terms}
                  onChange={(e) => {
                    const terms = e.target.value
                    const nextMethod = derivePaymentMethodFromTerms(terms)
                    setFormData((prev) => {
                      const base = {
                        ...prev,
                        payment_terms: terms,
                        payment_timing: derivePaymentTimingFromTerms(terms),
                        payment_method: nextMethod,
                      } as POFormData
                      return nextMethod !== prev.payment_method
                        ? applyPoPaymentMethodChange(base, nextMethod)
                        : base
                    })
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Terms</option>
                  <option value="COD">COD (Cash on Delivery)</option>
                  <option value="Payment before delivery">Payment before delivery</option>
                  <option value="Payment after delivery">Payment after delivery</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Payment Method</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) =>
                    setFormData(
                      applyPoPaymentMethodChange(formData as POFormData, e.target.value as POFormData['payment_method'])
                    )
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <PoPaymentAccountFields
                paymentMethod={formData.payment_method}
                accountName={formData.payment_account_name || ''}
                accountNumber={formData.payment_account_number || ''}
                onAccountNameChange={(value) => setFormData({ ...formData, payment_account_name: value })}
                onAccountNumberChange={(value) => setFormData({ ...formData, payment_account_number: value })}
              />
            </div>
          </div>
          
          {/* Delivery Information */}
          <div>
            <h3 className="font-medium mb-3">Delivery Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Contact Person</label>
                <input
                  type="text"
                  value={formData.delivery_contact}
                  onChange={(e) => setFormData({ ...formData, delivery_contact: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="row-span-2">
                <label className="block text-sm font-medium mb-1">Delivery Address</label>
                <textarea
                  value={formData.delivery_address}
                  onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={formData.delivery_phone}
                  onChange={(e) => setFormData({ ...formData, delivery_phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          
          {/* Items */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-medium text-gray-900">Order Items</h3>
                {!areItemsValid && items.length === 0 && (
                  <p className="text-xs text-red-500 mt-0.5">Add at least one item</p>
                )}
                {!areItemsValid && items.length > 0 && (
                  <p className="text-xs text-red-500 mt-0.5">Complete all item details</p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {catalogCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCatalog(!showCatalog)}
                    className="px-4 py-2 text-sm font-medium bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    {showCatalog ? 'Hide Catalog' : `Catalog (${catalogCount})`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={addItem}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  + Add Item
                </button>
              </div>
            </div>
            
            {/* Catalog: materials + fixed assets (supplier filter applies to both) */}
            {showCatalog && catalogCount > 0 && (
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-md p-3">
                {showFixedAssetsInPo && (
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setCatalogKind('materials')}
                      className={`px-2 py-1 text-xs rounded ${
                        catalogKind === 'materials'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700'
                      }`}
                    >
                      Materials ({catalog.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCatalogKind('fixed_assets')}
                      className={`px-2 py-1 text-xs rounded ${
                        catalogKind === 'fixed_assets'
                          ? 'bg-slate-700 text-white'
                          : 'bg-white border border-gray-300 text-gray-700'
                      }`}
                    >
                      Fixed assets ({fixedAssetCatalog.length})
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-600 mb-2">Click to add from catalog:</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {!showFixedAssetsInPo || catalogKind === 'materials'
                    ? catalog.map((material) => {
                        const alreadyAdded = items.some((item) => item.material_id === material.id)
                        return (
                          <button
                            key={material.id}
                            type="button"
                            onClick={() => addFromMaterialCatalog(material)}
                            disabled={alreadyAdded}
                            className={`w-full text-left border rounded px-3 py-2 ${
                              alreadyAdded
                                ? 'bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed'
                                : 'bg-white border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <span className="text-sm font-medium text-gray-900">
                                  {material.material_name}
                                </span>
                                {material.category && (
                                  <span className="text-xs text-gray-500 ml-2">• {material.category}</span>
                                )}
                                {alreadyAdded && (
                                  <span className="text-xs text-green-600 ml-2">âœ“ Added</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-600">
                                {material.current_stock > 0 && (
                                  <span>
                                    {material.current_stock} {material.unit}
                                  </span>
                                )}
                                <span className="font-semibold">
                                  ₱{material.unit_cost.toLocaleString()}/{getPurchaseUnit(material)}
                                </span>
                              </div>
                            </div>
                          </button>
                        )
                      })
                    : fixedAssetCatalog.map((asset) => {
                        const alreadyAdded = items.some((item) => item.fixed_asset_id === asset.id)
                        return (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => addFromFixedAssetCatalog(asset)}
                            disabled={alreadyAdded}
                            className={`w-full text-left border rounded px-3 py-2 ${
                              alreadyAdded
                                ? 'bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed'
                                : 'bg-white border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <span className="text-sm font-medium text-gray-900">{asset.asset_name}</span>
                                {asset.category && (
                                  <span className="text-xs text-gray-500 ml-2">• {asset.category}</span>
                                )}
                                {alreadyAdded && (
                                  <span className="text-xs text-green-600 ml-2">âœ“ Added</span>
                                )}
                              </div>
                              <span className="text-xs font-semibold text-gray-600">
                                ₱{Number(asset.unit_cost || 0).toLocaleString()}/{asset.unit}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                </div>
              </div>
            )}
            
            {/* Items List */}
            {items.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-gray-500">No items added</p>
                <p className="text-xs text-gray-400 mt-1">Click "Add Item" above</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => {
                  const receivedQty = Number(item.quantity_received) || 0
                  const lineLocked = amendMode && Boolean(item.id)
                  const minQty = amendMode && receivedQty > 0 ? receivedQty : 1
                  return (
                  <div 
                    key={item.id || index} 
                    className="bg-gray-50 border border-gray-200 rounded-md p-3"
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                        {item.material_id && (
                          <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">
                            Materials inventory
                          </span>
                        )}
                        {item.fixed_asset_id && (
                          <span className="text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            Fixed asset
                          </span>
                        )}
                        {receivedQty > 0 && (
                          <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            Received: {receivedQty}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(index)}
                        disabled={amendMode && receivedQty > 0}
                        className="text-gray-400 hover:text-red-600 text-lg leading-none disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                    
                    {/* Item Fields - Single Row */}
                    <div className="grid grid-cols-12 gap-2">
                      {/* Product - Dropdown of supplier's registered products */}
                      <div className="col-span-5">
                        <label className="block text-xs text-gray-600 mb-1">
                          Product
                        </label>
                        <select
                          value={poItemSelectValue(item)}
                          onChange={(e) => handleCatalogLineSelect(index, e.target.value)}
                          disabled={lineLocked}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                          required
                        >
                          <option value="">Select line item...</option>
                          {getAvailableMaterialsForRow(index).length > 0 && (
                            <optgroup label="Materials">
                              {getAvailableMaterialsForRow(index).map((material) => (
                                <option key={`m-${material.id}`} value={`m:${material.id}`}>
                                  {material.material_name}
                                  {material.unit_cost > 0 &&
                                    ` — ₱${material.unit_cost.toLocaleString()}/${getPurchaseUnit(material)}`}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {showFixedAssetsInPo && getAvailableFixedAssetsForRow(index).length > 0 && (
                            <optgroup label="Fixed assets">
                              {getAvailableFixedAssetsForRow(index).map((asset) => (
                                <option key={`f-${asset.id}`} value={`f:${asset.id}`}>
                                  {asset.asset_name}
                                  {asset.unit_cost > 0 &&
                                    ` — ₱${Number(asset.unit_cost).toLocaleString()}/${asset.unit}`}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {catalog.length === 0 &&
                            (!showFixedAssetsInPo || fixedAssetCatalog.length === 0) && (
                            <option value="" disabled>
                              {poCatalogEmptyHint}
                            </option>
                          )}
                        </select>
                      </div>
                      
                      {/* Quantity */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">
                          Qty
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, 'quantity', parseWholeQuantityInput(e.target.value))
                          }
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 text-center"
                          min={minQty}
                          step="1"
                          inputMode="numeric"
                          required
                        />
                      </div>
                      
                      {/* Unit */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">
                          Unit
                        </label>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => updateItem(index, 'unit', e.target.value)}
                          className={`w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 ${
                            (item as any).fromCatalog ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                          }`}
                          readOnly={(item as any).fromCatalog}
                          required
                        />
                      </div>
                      
                      {/* Unit Price */}
                      <div className="col-span-3">
                        <label className="block text-xs text-gray-600 mb-1">
                          Price
                        </label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₱</span>
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                            className={`w-full pl-6 pr-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 ${PO_NUMBER_INPUT_NO_SPINNER} ${
                              (item as any).fromCatalog && !amendMode ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                            }`}
                            placeholder="0.00"
                            readOnly={(item as any).fromCatalog && !amendMode}
                            min="0"
                            step="0.01"
                            required
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Item Total */}
                    <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                      <span className="text-xs text-gray-500">Subtotal</span>
                      <span className="text-sm font-semibold text-gray-900">
                        ₱{((item.quantity || 0) * (item.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
            
            {/* Grand Total */}
            {items.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Total</p>
                    <p className="text-xs text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    ₱{items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
        </div>
        
        <div className="p-6 border-t flex justify-end gap-3 shrink-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isFormValid && !saving
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!isFormValid || saving}
            title={
              !isFormValid
                ? 'Please fill in supplier, purchasing agent, and add at least one valid item'
                : ''
            }
          >
            {saving
              ? po
                ? 'Updating…'
                : 'Creating…'
              : po
                ? amendMode
                  ? 'Save amendments'
                  : 'Update PO'
                : 'Create PO'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// =============================================
// DELIVERY MODAL
// =============================================

type DeliveryModalLine = {
  po_item_id: string
  product_description: string
  ordered_quantity: number
  previously_received: number
  remaining_quantity: number
  quantity_received: number
  quantity_damaged: number
  unit: string
  stockUnit?: string
  stockPerPurchase?: number
  notes: string
  material_id?: string
  fixed_asset_id?: string
}

function buildDeliveryModalLines(po: PurchaseOrder): DeliveryModalLine[] {
  return (po.items || [])
    .map((item) => {
      const material = item.material
      const purchaseUnit = material ? getPurchaseUnit(material) : item.unit
      const stockPerPurchase = material ? getStockUnitsPerPurchase(material) : 1
      const ordered = Number(item.quantity) || 0
      const previouslyReceived = Number(item.quantity_received) || 0
      const remaining = Math.max(0, ordered - previouslyReceived)
      return {
        po_item_id: item.id,
        product_description: item.product_description,
        ordered_quantity: ordered,
        previously_received: previouslyReceived,
        remaining_quantity: remaining,
        quantity_received: remaining,
        quantity_damaged: 0,
        unit: purchaseUnit || item.unit,
        stockUnit: material?.unit,
        stockPerPurchase,
        notes: '',
        material_id: item.material_id,
        fixed_asset_id: item.fixed_asset_id,
      }
    })
    .filter((item) => item.remaining_quantity > 0)
}

const RECEIPT_CONDITION_OPTIONS = [
  { value: 'good', label: 'Complete' },
  { value: 'partial', label: 'Partial' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'incomplete', label: 'Incomplete' },
] as const

const MAX_RECEIPT_FILE_BYTES = 10 * 1024 * 1024

function DeliveryModal({ po, invoiceMatch, onSave, onClose }: {
  po: PurchaseOrder
  invoiceMatch?: PoInvoiceMatchSummary
  onSave: (
    delivery: Partial<DeliveryReceipt>,
    items: Array<{
      po_item_id: string
      quantity_received: number
      quantity_damaged?: number
      notes?: string
    }>
  ) => void | Promise<void>
  onClose: () => void
}) {
  const [formData, setFormData] = useState<Partial<DeliveryReceipt>>({
    delivery_date: new Date().toISOString().split('T')[0],
    received_by: '',
    condition: 'good',
    notes: '',
    inspection_notes: '',
    delivery_receipt_url: '',
  })

  const [deliveryItems, setDeliveryItems] = useState<DeliveryModalLine[]>(() => buildDeliveryModalLines(po))
  const [incompleteConfirmed, setIncompleteConfirmed] = useState(false)
  const [conditionWarnings, setConditionWarnings] = useState<string[]>([])
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [gfcMainStaff, setGfcMainStaff] = useState<GfcMainStaff[]>([])
  const [showReceivedByDropdown, setShowReceivedByDropdown] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const staffNameOptions = useMemo(
    () => gfcMainStaff.map((member) => member.full_name).sort((a, b) => a.localeCompare(b)),
    [gfcMainStaff]
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const staff = await loadGfcMainStaff()
        if (!cancelled) setGfcMainStaff(staff)
      } catch (e) {
        console.error('loadGfcMainStaff:', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const receiptLineInputs: ReceiptLineInput[] = useMemo(
    () =>
      deliveryItems.map((item) => ({
        po_item_id: item.po_item_id,
        ordered_quantity: item.ordered_quantity,
        previously_received: item.previously_received,
        remaining_quantity: item.remaining_quantity,
        quantity_received: item.quantity_received,
        quantity_damaged: item.quantity_damaged,
      })),
    [deliveryItems]
  )

  const lineValidation = useMemo(
    () => validateReceiptLines(receiptLineInputs),
    [receiptLineInputs]
  )

  useEffect(() => {
    const userIncomplete = incompleteConfirmed ? ('incomplete' as const) : null
    const { condition, warnings } = deriveReceiptCondition(receiptLineInputs, userIncomplete)
    setFormData((prev) => (prev.condition === condition ? prev : { ...prev, condition }))
    setConditionWarnings(warnings)
  }, [receiptLineInputs, incompleteConfirmed])

  useEffect(() => {
    if (!receiptFile || !receiptFile.type.startsWith('image/')) {
      setReceiptPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(receiptFile)
    setReceiptPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [receiptFile])

  const poProgress = useMemo(() => {
    const items = po.items || []
    const totalOrdered = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
    const totalPreviouslyReceived = items.reduce(
      (s, i) => s + (Number(i.quantity_received) || 0),
      0
    )
    const receivingGood = deliveryItems.reduce((s, i) => s + i.quantity_received, 0)
    const receivingDamaged = deliveryItems.reduce((s, i) => s + i.quantity_damaged, 0)
    const receivingNow = receivingGood + receivingDamaged
    const afterReceipt = totalPreviouslyReceived + receivingNow
    const progressPct =
      totalOrdered > 0 ? Math.min(100, Math.round((afterReceipt / totalOrdered) * 100)) : 0
    return {
      totalOrdered,
      totalPreviouslyReceived,
      receivingGood,
      receivingDamaged,
      receivingNow,
      afterReceipt,
      progressPct,
    }
  }, [po.items, deliveryItems])

  const updateDeliveryItem = (index: number, field: string, value: unknown) => {
    setDeliveryItems((prev) => {
      const next = [...prev]
      const line = { ...next[index], [field]: value }
      if (field === 'quantity_received' || field === 'quantity_damaged') {
        const good = field === 'quantity_received' ? (value as number) : line.quantity_received
        const damaged = field === 'quantity_damaged' ? (value as number) : line.quantity_damaged
        const maxTotal = line.remaining_quantity
        if (good + damaged > maxTotal) {
          if (field === 'quantity_received') {
            line.quantity_received = Math.max(0, maxTotal - damaged)
          } else {
            line.quantity_damaged = Math.max(0, maxTotal - good)
          }
        }
      }
      next[index] = line
      return next
    })
    if (field !== 'notes') setIncompleteConfirmed(false)
  }

  const fillAllRemaining = () => {
    setIncompleteConfirmed(false)
    setDeliveryItems((prev) =>
      prev.map((item) => ({
        ...item,
        quantity_received: Math.max(0, item.remaining_quantity - item.quantity_damaged),
      }))
    )
  }

  const clearAllQuantities = () => {
    setIncompleteConfirmed(false)
    setDeliveryItems((prev) =>
      prev.map((item) => ({ ...item, quantity_received: 0, quantity_damaged: 0 }))
    )
  }

  const handleConditionSelect = (value: DeliveryReceipt['condition']) => {
    if (value === 'incomplete') {
      setIncompleteConfirmed(true)
      setFormData((prev) => ({ ...prev, condition: 'incomplete' }))
    } else {
      setIncompleteConfirmed(false)
      setFormData((prev) => ({ ...prev, condition: value }))
    }
  }

  const handleReceiptFile = (file: File | null) => {
    if (!file) {
      setReceiptFile(null)
      return
    }
    if (file.size > MAX_RECEIPT_FILE_BYTES) {
      alert('File must be under 10 MB.')
      return
    }
    setReceiptFile(file)
  }

  const hasReceiver = Boolean(formData.received_by?.trim())
  const hasAttachment = receiptFile !== null
  const isFormValid = hasReceiver && lineValidation.valid && hasAttachment

  const validationSteps = [
    { key: 'receiver', label: 'Receiver name entered', done: hasReceiver },
    { key: 'items', label: 'Valid line quantities entered', done: lineValidation.hasPositiveQty && lineValidation.errors.length === 0 },
    { key: 'attachment', label: 'Receipt attachment uploaded', done: hasAttachment },
  ]

  const handleSubmit = async () => {
    if (!receiptFile || uploading || saving || !isFormValid) return

    const finalCondition = deriveReceiptCondition(
      receiptLineInputs,
      incompleteConfirmed ? 'incomplete' : null
    ).condition

    if (finalCondition === 'incomplete' && lineValidation.totalOutstandingAfter > 0) {
      const ok = confirm(
        `Mark as final shipment?\n\n${lineValidation.totalOutstandingAfter} unit(s) will remain unreceived on this PO. The PO will be marked Delivered — verify the supplier invoice amount in Accounting.`
      )
      if (!ok) return
    }

    try {
      setUploading(true)

      const fileExt = receiptFile.name.split('.').pop()
      const fileName = `${po.po_number}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('delivery_receipts')
        .upload(fileName, receiptFile)

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('delivery_receipts')
        .getPublicUrl(fileName)

      const deliveryData = {
        ...formData,
        condition: finalCondition,
        delivery_receipt_url: urlData.publicUrl,
      }

      const itemsToSave = deliveryItems
        .filter((item) => item.quantity_received > 0 || item.quantity_damaged > 0)
        .map((item) => ({
          po_item_id: item.po_item_id,
          quantity_received: item.quantity_received,
          quantity_damaged: item.quantity_damaged,
          notes: item.notes || undefined,
        }))

      setUploading(false)
      setSaving(true)
      await onSave(deliveryData, itemsToSave)
    } catch (error) {
      console.error('Error recording delivery:', error)
      alert('Failed to record delivery. Please try again.')
    } finally {
      setUploading(false)
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} align="center">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        <div className="px-4 py-3 border-b flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-green-700 shrink-0" />
              <h2 className="text-lg font-semibold text-gray-900">Record Receiving Report</h2>
            </div>
            <p className="text-sm text-gray-600 mt-0.5 truncate">
              {po.po_number} · {po.supplier?.name || 'No supplier'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading || saving}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b bg-gray-50/80 shrink-0 space-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
            <span>
              PO progress:{' '}
              <span className="font-medium text-gray-900 tabular-nums">
                {poProgress.totalPreviouslyReceived}/{poProgress.totalOrdered || '—'}
              </span>{' '}
              received
            </span>
            {poProgress.receivingNow > 0 && (
              <span className="text-green-800">
                +{poProgress.receivingGood} good
                {poProgress.receivingDamaged > 0 && `, +${poProgress.receivingDamaged} damaged`}
                {' '}this receipt →{' '}
                <span className="font-medium tabular-nums">
                  {poProgress.afterReceipt}/{poProgress.totalOrdered || '—'}
                </span>
              </span>
            )}
            {lineValidation.totalOutstandingAfter > 0 && (
              <span className="text-amber-800 tabular-nums">
                {lineValidation.totalOutstandingAfter} still outstanding after save
              </span>
            )}
            <InvoiceMatchStatusChip summary={invoiceMatch} />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600 rounded-full transition-all duration-300"
                style={{ width: `${poProgress.progressPct}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-gray-600 w-10 text-right">
              {poProgress.progressPct}%
            </span>
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <InvoiceMatchIssuesPanel summary={invoiceMatch} compact />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Receipt details
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Delivery date *
                </label>
                <input
                  type="date"
                  value={formData.delivery_date}
                  onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Received by *
                </label>
                <div className="relative category-dropdown">
                  <input
                    type="text"
                    value={formData.received_by}
                    onChange={(e) => {
                      setFormData({ ...formData, received_by: e.target.value })
                      setShowReceivedByDropdown(true)
                    }}
                    onFocus={() => setShowReceivedByDropdown(true)}
                    onBlur={() => {
                      setTimeout(() => setShowReceivedByDropdown(false), 100)
                    }}
                    className={`w-full px-2.5 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      !hasReceiver ? 'border-amber-300 focus:ring-amber-400' : 'border-gray-300'
                    }`}
                    placeholder="Enter or select staff"
                    required
                  />
                  {showReceivedByDropdown && staffNameOptions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {staffNameOptions.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setFormData({ ...formData, received_by: name })
                            setShowReceivedByDropdown(false)
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm text-gray-900"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Condition *
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {RECEIPT_CONDITION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleConditionSelect(opt.value)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                        formData.condition === opt.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {conditionWarnings.map((warning) => (
                  <p key={warning} className="text-[11px] text-amber-700 mt-1.5">
                    {warning}
                  </p>
                ))}
                {incompleteConfirmed && lineValidation.totalOutstandingAfter > 0 && (
                  <p className="text-[11px] text-orange-700 mt-1.5">
                    Final shipment — PO will be marked Delivered with{' '}
                    {lineValidation.totalOutstandingAfter} unreceived unit(s).
                  </p>
                )}
              </div>
            </div>

            <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Receipt attachment *
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="sr-only"
                onChange={(e) => handleReceiptFile(e.target.files?.[0] || null)}
              />
              {!receiptFile ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault()
                    setDragActive(true)
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    setDragActive(false)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragActive(false)
                    handleReceiptFile(e.dataTransfer.files?.[0] || null)
                  }}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    dragActive
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400 hover:bg-white'
                  }`}
                >
                  <Upload className="h-6 w-6 mx-auto text-gray-400 mb-1.5" />
                  <p className="text-sm text-gray-700">Drop file or click to browse</p>
                  <p className="text-xs text-gray-500 mt-0.5">PDF or image · Max 10 MB</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden bg-white">
                  {receiptPreviewUrl ? (
                    <div className="bg-gray-100 flex justify-center max-h-32">
                      <img
                        src={receiptPreviewUrl}
                        alt="Receipt preview"
                        className="max-h-32 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-4 bg-gray-50">
                      <FileText className="h-8 w-8 text-gray-400 shrink-0" />
                      <span className="text-sm text-gray-600">PDF document</span>
                    </div>
                  )}
                  <div className="px-3 py-2 border-t flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{receiptFile.name}</p>
                      <p className="text-xs text-gray-500 tabular-nums">
                        {(receiptFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="text-xs text-red-600 hover:text-red-800 shrink-0 px-2 py-1 rounded hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-2.5 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Inspection notes, delivery remarks, or discrepancies…"
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Items to receive
              </p>
              {deliveryItems.length > 0 && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={fillAllRemaining}
                    className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
                  >
                    Fill remaining
                  </button>
                  <button
                    type="button"
                    onClick={clearAllQuantities}
                    className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-500"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {deliveryItems.length === 0 ? (
              <div className="border rounded-lg px-4 py-8 text-center text-sm text-gray-500 bg-gray-50">
                All PO line items are fully received. No quantities left to record.
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="bg-gray-50 border-b text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium min-w-[140px]">Item</th>
                      <th className="text-right px-3 py-2 font-medium w-16">Ordered</th>
                      <th className="text-right px-3 py-2 font-medium w-16">Prev.</th>
                      <th className="text-right px-3 py-2 font-medium w-16">Remain</th>
                      <th className="text-center px-3 py-2 font-medium w-20 bg-green-50/80 text-green-900">
                        Good
                      </th>
                      <th className="text-center px-3 py-2 font-medium w-20 bg-red-50/80 text-red-900">
                        Damaged
                      </th>
                      <th className="text-left px-3 py-2 font-medium min-w-[12rem] w-48">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deliveryItems.map((item, index) => {
                      const lineTotal = item.quantity_received + item.quantity_damaged
                      const isUnderRemaining =
                        lineTotal > 0 && lineTotal < item.remaining_quantity
                      const isOverRemaining = lineTotal > item.remaining_quantity
                      return (
                        <tr
                          key={item.po_item_id}
                          className={
                            isOverRemaining
                              ? 'bg-red-50/60'
                              : isUnderRemaining
                                ? 'bg-amber-50/40'
                                : undefined
                          }
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-start gap-1.5">
                              <span className="leading-snug">{item.product_description}</span>
                              {item.material_id && (
                                <span
                                  className="text-[10px] text-green-700 bg-green-50 px-1 py-0.5 rounded shrink-0"
                                  title="Updates materials inventory"
                                >
                                  M
                                </span>
                              )}
                              {item.fixed_asset_id && (
                                <span
                                  className="text-[10px] text-slate-700 bg-slate-100 px-1 py-0.5 rounded shrink-0"
                                  title="Updates fixed assets register"
                                >
                                  FA
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-500 mt-0.5">{item.unit}</p>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                            {item.ordered_quantity}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                            {item.previously_received}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-800">
                            {item.remaining_quantity}
                          </td>
                          <td className="px-3 py-2 bg-green-50/40 text-center">
                            <input
                              type="number"
                              min={0}
                              max={item.remaining_quantity}
                              step={1}
                              value={item.quantity_received}
                              onChange={(e) =>
                                updateDeliveryItem(
                                  index,
                                  'quantity_received',
                                  parseWholeQuantityInput(e.target.value)
                                )
                              }
                              className={`w-16 px-1.5 py-1 border rounded text-center text-sm tabular-nums focus:outline-none focus:ring-2 ${PO_NUMBER_INPUT_NO_SPINNER} ${
                                isOverRemaining
                                  ? 'border-red-400 focus:ring-red-400'
                                  : 'focus:ring-green-500'
                              }`}
                            />
                          </td>
                          <td className="px-3 py-2 bg-red-50/40 text-center">
                            <input
                              type="number"
                              min={0}
                              max={Math.max(0, item.remaining_quantity - item.quantity_received)}
                              step={1}
                              value={item.quantity_damaged}
                              onChange={(e) =>
                                updateDeliveryItem(
                                  index,
                                  'quantity_damaged',
                                  parseWholeQuantityInput(e.target.value)
                                )
                              }
                              className={`w-16 px-1.5 py-1 border rounded text-center text-sm tabular-nums focus:outline-none focus:ring-2 ${PO_NUMBER_INPUT_NO_SPINNER} focus:ring-red-400`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.notes}
                              onChange={(e) => updateDeliveryItem(index, 'notes', e.target.value)}
                              placeholder="Optional"
                              className="w-full px-2 py-1 border rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-gray-500 mt-1.5">
              Good qty updates inventory (M). Damaged qty counts toward PO received but is not added to stock.
            </p>
          </div>
        </div>

        <div className="px-4 py-3 border-t bg-gray-50 shrink-0">
          {!isFormValid && !uploading && !saving && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs">
              {validationSteps.map((step) => (
                <li
                  key={step.key}
                  className={`flex items-center gap-1 ${
                    step.done ? 'text-green-700' : 'text-gray-500'
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {step.label}
                </li>
              ))}
              {lineValidation.errors.map((err) => (
                <li key={err} className="text-red-600 w-full">
                  {err}
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading || saving}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              className={`px-4 py-1.5 text-sm rounded-md font-medium ${
                isFormValid && !uploading && !saving
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              disabled={!isFormValid || uploading || saving || deliveryItems.length === 0}
            >
              {uploading
                ? 'Uploading receipt…'
                : saving
                  ? 'Recording…'
                  : `Record report${poProgress.receivingNow > 0 ? ` (${poProgress.receivingGood} good${poProgress.receivingDamaged > 0 ? `, ${poProgress.receivingDamaged} dmg` : ''})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// =============================================
// PURCHASE REQUISITION MODAL
// =============================================

function PRModal({ brandId, onSave, onClose }: {
  brandId: string
  onSave: (prData: any) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    requested_by: '',
    department: '',
    required_date: '',
    purpose: '',
    notes: ''
  })
  
  const [items, setItems] = useState<Array<{
    product_description: string
    quantity: number
    unit: string
    estimated_price: number | string
    notes: string
  }>>([])
  
  const addItem = () => {
    setItems([...items, { product_description: '', quantity: 1, unit: 'pcs', estimated_price: '', notes: '' }])
  }
  
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }
  
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }
  
  const isValid = formData.requested_by.trim() !== '' && items.length > 0 && 
    items.every(item => item.product_description.trim() !== '' && item.quantity > 0)
  
  return (
    <Modal onClose={onClose} align="center">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold">Create Purchase Requisition</h2>
          <p className="text-sm text-gray-600 mt-1">Submit a request for purchase</p>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="font-medium mb-3">Requisition Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Requested By *
                  {!formData.requested_by && <span className="text-red-500 text-xs ml-1">(required)</span>}
                </label>
                <input
                  type="text"
                  value={formData.requested_by}
                  onChange={(e) => setFormData({ ...formData, requested_by: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    !formData.requested_by 
                      ? 'border-red-300 focus:ring-red-500' 
                      : 'focus:ring-blue-500'
                  }`}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Required Date</label>
                <input
                  type="date"
                  value={formData.required_date}
                  onChange={(e) => setFormData({ ...formData, required_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Purpose</label>
                <textarea
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
            </div>
          </div>
          
          {/* Items */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-medium text-gray-900">Requested Items</h3>
                {items.length === 0 && (
                  <p className="text-xs text-red-500 mt-0.5">Add at least one item</p>
                )}
              </div>
              <button
                onClick={addItem}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                + Add Item
              </button>
            </div>
            
            {/* Items List */}
            {items.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-gray-500">No items added</p>
                <p className="text-xs text-gray-400 mt-1">Click "Add Item" above</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div 
                    key={index} 
                    className="bg-gray-50 border border-gray-200 rounded-md p-3"
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                      {items.length > 1 && (
                        <button
                          onClick={() => removeItem(index)}
                          className="text-gray-400 hover:text-red-600 text-lg leading-none"
                          title="Remove"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    
                    {/* Item Fields - Single Row */}
                    <div className="grid grid-cols-12 gap-2">
                      {/* Product Description */}
                      <div className="col-span-5">
                        <label className="block text-xs text-gray-600 mb-1">
                          Product
                        </label>
                        <input
                          type="text"
                          value={item.product_description}
                          onChange={(e) => updateItem(index, 'product_description', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                          required
                        />
                      </div>
                      
                      {/* Quantity */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">
                          Qty
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseWholeQuantityInput(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 text-center"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          required
                        />
                      </div>
                      
                      {/* Unit */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">
                          Unit
                        </label>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => updateItem(index, 'unit', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                          required
                        />
                      </div>
                      
                      {/* Estimated Price */}
                      <div className="col-span-3">
                        <label className="block text-xs text-gray-600 mb-1">
                          Est. Price
                        </label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₱</span>
                          <input
                            type="number"
                            value={item.estimated_price}
                            onChange={(e) => updateItem(index, 'estimated_price', parseWholeQuantityInput(e.target.value))}
                            className="w-full pl-6 pr-2 py-2 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                            placeholder="0.00"
                            min="0"
                            step="1"
                            inputMode="numeric"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Summary */}
            {items.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Estimated Total</p>
                    <p className="text-xs text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    ₱{items.reduce((sum, item) => {
                      const price = typeof item.estimated_price === 'string' ? parseFloat(item.estimated_price) || 0 : item.estimated_price || 0
                      return sum + ((item.quantity || 0) * price)
                    }, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Additional Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
          </div>
        </div>
        
        <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ ...formData, items: items })}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isValid 
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!isValid}
            title={!isValid ? 'Please fill in requestor name and add at least one valid item' : ''}
          >
            Create Requisition
          </button>
        </div>
      </div>
    </Modal>
  )
}

// =============================================
// CONVERT PR TO PO MODAL
// =============================================

function ConvertPRtoPOModal({
  pr,
  items,
  setItems,
  suppliers,
  brandId,
  purchaserTemplates,
  onManagePurchaserTemplates,
  onSave,
  onClose,
}: {
  pr: PurchaseRequisition
  items: Partial<PurchaseOrderItem>[]
  setItems: (items: Partial<PurchaseOrderItem>[]) => void
  suppliers: Supplier[]
  brandId: string
  purchaserTemplates: POPurchaserTemplate[]
  onManagePurchaserTemplates: () => void
  onSave: (poData: Partial<POFormData>) => void | Promise<void>
  onClose: () => void
}) {
  const appliedDefaultTemplateRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [approvedByOptions, setApprovedByOptions] = useState<string[]>([])
  const [formData, setFormData] = useState<Partial<POFormData>>({
    supplier_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: pr.required_date || '',
    purchasing_agent: pr.requested_by,
    approved_by: '',
    payment_terms: '',
    payment_method: 'bank_transfer',
    payment_timing: 'after_delivery',
    payment_account_name: '',
    payment_account_number: '',
    delivery_address: '',
    delivery_contact: '',
    delivery_phone: '',
    notes: pr.purpose || '',
  })
  const selectedSupplier = suppliers.find((s) => s.id === formData.supplier_id)

  const applyPurchaserTemplate = (template: POPurchaserTemplate) => {
    const preset = templateToPoPresetFields(template)
    setApprovedByOptions(preset.approved_by_signatories || [])
    setFormData((prev) =>
      mergePoPresetIntoForm(prev, preset, {
        keepPurchasingAgent: pr.requested_by || prev.purchasing_agent,
      })
    )
  }

  useEffect(() => {
    if (appliedDefaultTemplateRef.current) return
    const def = getDefaultPurchaserTemplate(purchaserTemplates)
    if (!def) return
    appliedDefaultTemplateRef.current = true
    const preset = templateToPoPresetFields(def)
    setApprovedByOptions(preset.approved_by_signatories || [])
    setFormData((prev) =>
      mergePoPresetIntoForm(prev, preset, {
        keepPurchasingAgent: pr.requested_by || prev.purchasing_agent,
      })
    )
  }, [purchaserTemplates, pr.requested_by])
  
  const [catalog, setCatalog] = useState<RawMaterial[]>([])
  const [fixedAssetCatalog, setFixedAssetCatalog] = useState<FixedAsset[]>([])
  const [showCatalog, setShowCatalog] = useState(false)
  const [catalogKind, setCatalogKind] = useState<'materials' | 'fixed_assets'>('materials')
  
  useEffect(() => {
    loadSupplierCatalog(formData.supplier_id || null)
    if (formData.supplier_id && selectedSupplier) {
      const updates: Partial<POFormData> = {}
      if (selectedSupplier.payment_terms) {
        const terms = selectedSupplier.payment_terms
        updates.payment_terms = terms
        updates.payment_timing = derivePaymentTimingFromTerms(terms)
        updates.payment_method = derivePaymentMethodFromTerms(terms)
      }
      if (Object.keys(updates).length > 0) {
        setFormData((prev) => {
          const merged = { ...prev, ...updates } as POFormData
          if (
            updates.payment_method &&
            updates.payment_method !== prev.payment_method
          ) {
            return applyPoPaymentMethodChange(merged, updates.payment_method)
          }
          return merged
        })
      }
    }
  }, [formData.supplier_id])

  useEffect(() => {
    if (formData.supplier_id) setCatalogKind('materials')
  }, [formData.supplier_id])
  
  const loadSupplierCatalog = async (supplierId: string | null) => {
    const { materials, fixedAssets } = await loadPoLineItemCatalog(brandId, supplierId)
    setCatalog(materials)
    setFixedAssetCatalog(fixedAssets)
  }

  const showFixedAssetsInPo = true

  const poItemSelectValue = (item: Partial<PurchaseOrderItem>) => {
    if (item.material_id) return `m:${item.material_id}`
    if (item.fixed_asset_id) return `f:${item.fixed_asset_id}`
    return ''
  }

  const addFromMaterialCatalog = (material: RawMaterial) => {
    const exists = items.some((item) => item.material_id === material.id)
    if (exists) {
      alert(`"${material.material_name}" is already in the order`)
      return
    }

    setItems([
      ...items,
      {
        product_description: material.material_name,
        quantity: 1,
        unit: getPurchaseUnit(material),
        unit_price: material.unit_cost,
        material_id: material.id,
        fixed_asset_id: undefined,
        material,
        fixed_asset: undefined,
        fromCatalog: true,
      },
    ])
  }

  const addFromFixedAssetCatalog = (asset: FixedAsset) => {
    const exists = items.some((item) => item.fixed_asset_id === asset.id)
    if (exists) {
      alert(`"${asset.asset_name}" is already in the order`)
      return
    }

    setItems([
      ...items,
      {
        product_description: asset.asset_name,
        quantity: 1,
        unit: asset.unit || 'unit',
        unit_price: asset.unit_cost,
        material_id: undefined,
        fixed_asset_id: asset.id,
        material: undefined,
        fixed_asset: asset,
        fromCatalog: true,
      },
    ])
  }
  
  const addItem = () => {
    setItems([
      ...items,
      {
        product_description: '',
        quantity: 1,
        unit: 'pcs',
        unit_price: '' as any,
        material_id: null,
        fixed_asset_id: null,
      },
    ])
  }
  
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }
  
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const handleCatalogLineSelect = (index: number, value: string) => {
    if (!value) {
      handleProductClear(index)
      return
    }
    if (value.startsWith('m:')) {
      const materialId = value.slice(2)
      const material = catalog.find((m) => m.id === materialId) ?? (items[index] as PurchaseOrderItem).material
      if (!material) return
      const newItems = [...items]
      newItems[index] = {
        ...newItems[index],
        product_description: material.material_name,
        unit: getPurchaseUnit(material),
        unit_price: material.unit_cost,
        material_id: material.id,
        fixed_asset_id: undefined,
        material,
        fixed_asset: undefined,
        fromCatalog: true,
      }
      setItems(newItems)
      return
    }
    if (value.startsWith('f:')) {
      if (!showFixedAssetsInPo) return
      const assetId = value.slice(2)
      const asset =
        fixedAssetCatalog.find((a) => a.id === assetId) ?? (items[index] as PurchaseOrderItem).fixed_asset
      if (!asset) return
      const newItems = [...items]
      newItems[index] = {
        ...newItems[index],
        product_description: asset.asset_name,
        unit: asset.unit || 'unit',
        unit_price: asset.unit_cost,
        material_id: undefined,
        fixed_asset_id: asset.id,
        material: undefined,
        fixed_asset: asset,
        fromCatalog: true,
      }
      setItems(newItems)
    }
  }

  const getAvailableMaterialsForRow = (currentIndex: number) => {
    const currentItem = items[currentIndex]
    const selectedIds = items
      .map((item, i) => (i !== currentIndex ? item.material_id : null))
      .filter(Boolean) as string[]
    let available = catalog.filter(
      (m) => !selectedIds.includes(m.id) || m.id === currentItem?.material_id
    )
    if (
      currentItem?.material_id &&
      currentItem.material &&
      !available.find((m) => m.id === currentItem.material_id)
    ) {
      available = [...available, currentItem.material]
    }
    return available
  }

  const getAvailableFixedAssetsForRow = (currentIndex: number) => {
    if (!showFixedAssetsInPo) return []
    const currentItem = items[currentIndex]
    const selectedIds = items
      .map((item, i) => (i !== currentIndex ? item.fixed_asset_id : null))
      .filter(Boolean) as string[]
    let available = fixedAssetCatalog.filter(
      (a) => !selectedIds.includes(a.id) || a.id === currentItem?.fixed_asset_id
    )
    if (
      currentItem?.fixed_asset_id &&
      currentItem.fixed_asset &&
      !available.find((a) => a.id === currentItem.fixed_asset_id)
    ) {
      available = [...available, currentItem.fixed_asset]
    }
    return available
  }

  const handleProductClear = (index: number) => {
    const newItems = [...items]
    newItems[index] = {
      ...newItems[index],
      product_description: '',
      unit: 'pcs',
      unit_price: '' as any,
      material_id: null,
      fixed_asset_id: null,
      material: undefined,
      fixed_asset: undefined,
      fromCatalog: false,
    }
    setItems(newItems)
  }

  const catalogCount = showFixedAssetsInPo
    ? catalog.length + fixedAssetCatalog.length
    : catalog.length
  
  const areItemsValid = items.length > 0 && items.every(item => 
    item.product_description && 
    item.product_description.trim() !== '' &&
    item.quantity && 
    item.quantity > 0 &&
    item.unit && 
    item.unit.trim() !== '' &&
    item.unit_price !== undefined && 
    item.unit_price >= 0
  )
  
  const isFormValid =
    formData.purchasing_agent &&
    formData.purchasing_agent.trim() !== '' &&
    formData.expected_delivery_date &&
    formData.expected_delivery_date.trim() !== '' &&
    arePoPaymentFieldsValid(
      formData.payment_method,
      formData.payment_account_name,
      formData.payment_account_number
    ) &&
    areItemsValid

  const handleSave = async () => {
    if (saving || !isFormValid) return
    setSaving(true)
    try {
      await onSave(formData)
    } finally {
      setSaving(false)
    }
  }

  const poCatalogEmptyHint = formData.supplier_id
    ? 'Add materials in Procurement and link to this supplier'
    : 'Add materials or fixed assets from the catalog, or select a supplier'
  
  return (
    <Modal onClose={onClose} align="center">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex flex-wrap justify-between items-start gap-3">
            <div>
              <h2 className="text-xl font-semibold">Create PO from Requisition</h2>
              <p className="text-sm text-gray-600 mt-1">Converting {pr.pr_number} to Purchase Order</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {purchaserTemplates.length > 0 && (
                <select
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value
                    if (!id) return
                    const template = purchaserTemplates.find((t) => t.id === id)
                    if (template) applyPurchaserTemplate(template)
                    e.target.value = ''
                  }}
                >
                  <option value="">Apply template…</option>
                  {purchaserTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.template_name}
                      {t.is_default ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={onManagePurchaserTemplates}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Manage templates
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* PR Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="font-medium text-gray-900 mb-2">Requisition Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">PR Number:</span>
                <span className="ml-2 font-medium">{pr.pr_number}</span>
              </div>
              <div>
                <span className="text-gray-600">Requested by:</span>
                <span className="ml-2 font-medium">{pr.requested_by}</span>
              </div>
              {pr.department && (
                <div>
                  <span className="text-gray-600">Department:</span>
                  <span className="ml-2 font-medium">{pr.department}</span>
                </div>
              )}
              {pr.required_date && (
                <div>
                  <span className="text-gray-600">Required by:</span>
                  <span className="ml-2 font-medium">{new Date(pr.required_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Supplier Selection */}
          <div>
            <h3 className="font-medium mb-3">Purchase Order Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Supplier</label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No supplier</option>
                  {suppliers.filter(s => s.is_active).map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                {!formData.supplier_id && (
                  <p className="mt-1 text-xs text-gray-600">
                    Order lines can use materials or fixed assets matching this PO&apos;s supplier (or with no supplier assigned).
                    Fixed assets are the same register as Accounting → Fixed Assets; receiving posts to GL 1500.
                  </p>
                )}
                {selectedSupplier?.lead_time_days && selectedSupplier.lead_time_days > 0 && (
                  <p className="mt-1 text-xs text-blue-700">
                    Estimated lead time: {selectedSupplier.lead_time_days} calendar day{selectedSupplier.lead_time_days === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Order Date</label>
                <input
                  type="date"
                  value={formData.order_date}
                  onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Expected Delivery *
                  {!formData.expected_delivery_date && <span className="text-red-500 text-xs ml-1">(required)</span>}
                </label>
                <input
                  type="date"
                  value={formData.expected_delivery_date}
                  onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    !formData.expected_delivery_date
                      ? 'border-red-300 focus:ring-red-500'
                      : 'focus:ring-blue-500'
                  }`}
                  required
                />
              </div>
              
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Payment Terms</label>
                <select
                  value={formData.payment_terms}
                  onChange={(e) => {
                    const terms = e.target.value
                    const nextMethod = derivePaymentMethodFromTerms(terms)
                    setFormData((prev) => {
                      const base = {
                        ...prev,
                        payment_terms: terms,
                        payment_timing: derivePaymentTimingFromTerms(terms),
                        payment_method: nextMethod,
                      } as POFormData
                      return nextMethod !== prev.payment_method
                        ? applyPoPaymentMethodChange(base, nextMethod)
                        : base
                    })
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Terms</option>
                  <option value="COD">COD (Cash on Delivery)</option>
                  <option value="Payment before delivery">Payment before delivery</option>
                  <option value="Payment after delivery">Payment after delivery</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Payment Method</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) =>
                    setFormData(
                      applyPoPaymentMethodChange(formData as POFormData, e.target.value as POFormData['payment_method'])
                    )
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <PoPaymentAccountFields
                paymentMethod={formData.payment_method}
                accountName={formData.payment_account_name || ''}
                accountNumber={formData.payment_account_number || ''}
                onAccountNameChange={(value) => setFormData({ ...formData, payment_account_name: value })}
                onAccountNumberChange={(value) => setFormData({ ...formData, payment_account_number: value })}
              />
              <div>
                <label className="block text-sm font-medium mb-1">Purchasing agent</label>
                <input
                  type="text"
                  value={formData.purchasing_agent}
                  onChange={(e) => setFormData({ ...formData, purchasing_agent: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Approved by (signatory)</label>
                {approvedByOptions.length > 0 ? (
                  <select
                    value={formData.approved_by || ''}
                    onChange={(e) => setFormData({ ...formData, approved_by: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">—</option>
                    {approvedByOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.approved_by || ''}
                    onChange={(e) => setFormData({ ...formData, approved_by: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Name on PO signature line"
                  />
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-3">Delivery Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Contact person</label>
                <input
                  type="text"
                  value={formData.delivery_contact}
                  onChange={(e) => setFormData({ ...formData, delivery_contact: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contact phone</label>
                <input
                  type="text"
                  value={formData.delivery_phone}
                  onChange={(e) => setFormData({ ...formData, delivery_phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Delivery address</label>
                <textarea
                  value={formData.delivery_address}
                  onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          
          {/* Items from PR */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-medium text-gray-900">Order Items</h3>
                <p className="text-xs text-gray-500 mt-0.5">Review and adjust prices from requisition</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {catalogCount > 0 && (
                  <button
                    onClick={() => setShowCatalog(!showCatalog)}
                    type="button"
                    className="px-4 py-2 text-sm font-medium bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    {showCatalog ? 'Hide Catalog' : `Catalog (${catalogCount})`}
                  </button>
                )}
                <button
                  onClick={addItem}
                  type="button"
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  + Add Item
                </button>
              </div>
            </div>
            
            {/* Catalog: materials + fixed assets (supplier filter applies to both) */}
            {showCatalog && catalogCount > 0 && (
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-md p-3">
                {showFixedAssetsInPo && (
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setCatalogKind('materials')}
                      className={`px-2 py-1 text-xs rounded ${
                        catalogKind === 'materials'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700'
                      }`}
                    >
                      Materials ({catalog.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCatalogKind('fixed_assets')}
                      className={`px-2 py-1 text-xs rounded ${
                        catalogKind === 'fixed_assets'
                          ? 'bg-slate-700 text-white'
                          : 'bg-white border border-gray-300 text-gray-700'
                      }`}
                    >
                      Fixed assets ({fixedAssetCatalog.length})
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-600 mb-2">Click to add from catalog:</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {!showFixedAssetsInPo || catalogKind === 'materials'
                    ? catalog.map((material) => {
                        const alreadyAdded = items.some((item) => item.material_id === material.id)
                        return (
                          <button
                            key={material.id}
                            type="button"
                            onClick={() => addFromMaterialCatalog(material)}
                            disabled={alreadyAdded}
                            className={`w-full text-left border rounded px-3 py-2 ${
                              alreadyAdded
                                ? 'bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed'
                                : 'bg-white border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <span className="text-sm font-medium text-gray-900">
                                  {material.material_name}
                                </span>
                                {material.category && (
                                  <span className="text-xs text-gray-500 ml-2">• {material.category}</span>
                                )}
                                {alreadyAdded && (
                                  <span className="text-xs text-green-600 ml-2">âœ“ Added</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-600">
                                {material.current_stock > 0 && (
                                  <span>
                                    {material.current_stock} {material.unit}
                                  </span>
                                )}
                                <span className="font-semibold">
                                  ₱{material.unit_cost.toLocaleString()}/{getPurchaseUnit(material)}
                                </span>
                              </div>
                            </div>
                          </button>
                        )
                      })
                    : fixedAssetCatalog.map((asset) => {
                        const alreadyAdded = items.some((item) => item.fixed_asset_id === asset.id)
                        return (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => addFromFixedAssetCatalog(asset)}
                            disabled={alreadyAdded}
                            className={`w-full text-left border rounded px-3 py-2 ${
                              alreadyAdded
                                ? 'bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed'
                                : 'bg-white border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <span className="text-sm font-medium text-gray-900">{asset.asset_name}</span>
                                {asset.category && (
                                  <span className="text-xs text-gray-500 ml-2">• {asset.category}</span>
                                )}
                                {alreadyAdded && (
                                  <span className="text-xs text-green-600 ml-2">âœ“ Added</span>
                                )}
                              </div>
                              <span className="text-xs font-semibold text-gray-600">
                                ₱{Number(asset.unit_cost || 0).toLocaleString()}/{asset.unit}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                      {item.material_id && (
                        <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">
                          Materials inventory
                        </span>
                      )}
                      {item.fixed_asset_id && (
                        <span className="text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          Fixed asset
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(index)}
                      className="text-gray-400 hover:text-red-600 text-lg leading-none"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <label className="block text-xs text-gray-600 mb-1">Product</label>
                      <select
                        value={poItemSelectValue(item)}
                        onChange={(e) => handleCatalogLineSelect(index, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 bg-white"
                        required
                      >
                        <option value="">Select line item...</option>
                        {getAvailableMaterialsForRow(index).length > 0 && (
                          <optgroup label="Materials">
                            {getAvailableMaterialsForRow(index).map((material) => (
                              <option key={`m-${material.id}`} value={`m:${material.id}`}>
                                {material.material_name}
                                {material.unit_cost > 0 &&
                                  ` — ₱${material.unit_cost.toLocaleString()}/${getPurchaseUnit(material)}`}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {showFixedAssetsInPo && getAvailableFixedAssetsForRow(index).length > 0 && (
                          <optgroup label="Fixed assets">
                            {getAvailableFixedAssetsForRow(index).map((asset) => (
                              <option key={`f-${asset.id}`} value={`f:${asset.id}`}>
                                {asset.asset_name}
                                {asset.unit_cost > 0 &&
                                  ` — ₱${Number(asset.unit_cost).toLocaleString()}/${asset.unit}`}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {catalog.length === 0 &&
                          (!showFixedAssetsInPo || fixedAssetCatalog.length === 0) && (
                          <option value="" disabled>
                            {poCatalogEmptyHint}
                          </option>
                        )}
                      </select>
                    </div>
                    
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">Qty</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(index, 'quantity', parseWholeQuantityInput(e.target.value))
                        }
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 text-center"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        required
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">Unit</label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 ${
                          (item as any).fromCatalog ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                        }`}
                        readOnly={(item as any).fromCatalog}
                        required
                      />
                    </div>
                    
                    <div className="col-span-3">
                      <label className="block text-xs text-gray-600 mb-1">Price</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₱</span>
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', parseWholeQuantityInput(e.target.value))}
                          className={`w-full pl-6 pr-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 ${PO_NUMBER_INPUT_NO_SPINNER} ${
                            (item as any).fromCatalog ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                          }`}
                          readOnly={(item as any).fromCatalog}
                          min="0"
                          step="1"
                          required
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-xs text-gray-500">Subtotal</span>
                    <span className="text-sm font-semibold text-gray-900">
                      ₱{((item.quantity || 0) * (item.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            {items.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Total</p>
                    <p className="text-xs text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    ₱{items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
        </div>
        
        <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isFormValid && !saving
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!isFormValid || saving}
            title={!isFormValid ? 'Please select supplier and ensure all items are valid' : ''}
          >
            {saving ? 'Creating…' : 'Create Purchase Order'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// =============================================
// MATERIAL MODAL
// =============================================

export type MaterialModalPresets = {
  category?: string
  lockCategory?: boolean
  factoryInventoryKind?: '' | FactoryInventoryKind
  owners?: string[]
  titleAdd?: string
  titleEdit?: string
  buttonAdd?: string
  buttonEdit?: string
  /** Hide owner, supplier, unit cost, min PU, and initial PU (component add flow). */
  compact?: boolean
}

export function MaterialModal({
  material,
  brandId,
  allMaterials,
  suppliers,
  existingCategories,
  ownerOptions,
  ownerBrandSlugMap,
  presets,
  onSave,
  onClose,
}: {
  material: RawMaterial | null
  brandId: string
  allMaterials: RawMaterial[]
  suppliers: Supplier[]
  existingCategories: string[]
  ownerOptions: string[]
  ownerBrandSlugMap: Record<string, string>
  presets?: MaterialModalPresets
  onSave: (material: Partial<RawMaterial>) => void | Promise<void>
  onClose: () => void
}) {
  const canRemoveOwner = !material
  const canAddOwner = true
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false)
  const [ownerInput, setOwnerInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [bomCostLoading, setBomCostLoading] = useState(false)
  const initialStockPerPurchase = Math.max(
    1,
    parseWholeQuantityInput(String(material?.uom_stock_per_purchase || '1'))
  )
  const defaultCategory = presets?.category?.trim() || ''
  const lockCategory = Boolean(presets?.lockCategory && defaultCategory)
  const compact = Boolean(presets?.compact)
  const [formData, setFormData] = useState({
    supplier_id: material?.supplier_id || '',
    material_name: material?.material_name || '',
    sku: material?.sku || '',
    category: material?.category || defaultCategory,
    factory_inventory_kind:
      material?.factory_inventory_kind && isFactoryInventoryKind(material.factory_inventory_kind)
        ? material.factory_inventory_kind
        : presets?.factoryInventoryKind && isFactoryInventoryKind(presets.factoryInventoryKind)
          ? presets.factoryInventoryKind
          : ('' as '' | FactoryInventoryKind),
    factory_request_uom:
      material?.factory_request_uom === 'purchase' ? 'purchase' : ('stock' as FactoryRequestUom),
    factory_bom_uom:
      material?.factory_bom_uom === 'stock'
        ? 'stock'
        : ('base' as FactoryBomUom),
    owner: material?.owner?.length
      ? material.owner
      : presets?.owners?.length
        ? [...presets.owners]
        : ([] as string[]),
    unit: material?.unit || '',
    uom_base_unit: material?.uom_base_unit || '',
    uom_base_per_unit: material?.uom_base_per_unit || (1 as any),
    uom_purchase_unit: material?.uom_purchase_unit || '',
    uom_stock_per_purchase: material?.uom_stock_per_purchase || (1 as any),
    unit_cost: compact
      ? (material?.unit_cost ?? 0)
      : material?.unit_cost || ('' as any),
    minimum_purchase_units: compact
      ? material?.minimum_stock !== undefined && material?.minimum_stock !== null
        ? Math.floor((material.minimum_stock || 0) / initialStockPerPurchase)
        : 0
      : material?.minimum_stock !== undefined && material?.minimum_stock !== null
        ? Math.floor((material.minimum_stock || 0) / initialStockPerPurchase)
        : ('' as any),
    initial_purchase_units: compact
      ? 0
      : material?.current_stock !== undefined && material?.current_stock !== null
        ? Math.floor((material.current_stock || 0) / initialStockPerPurchase)
        : ('' as any),
    notes: material?.notes || '',
    is_active: material?.is_active ?? true
  })
  
  const hasWholeNumber = (value: string | number | null | undefined, min: number) => {
    const parsed = parseWholeQuantityInput(String(value ?? ''))
    return parsed >= min
  }

  const categoryOptions = useMemo(
    () => mergeRawMaterialCategoryOptions(existingCategories),
    [existingCategories]
  )

  const treatAsComponent =
    compact ||
    isComponentMaterialCategory(formData.category) ||
    isComponentMaterialCategory(material?.category)

  const isValid =
    formData.material_name.trim() !== '' &&
    formData.owner.length > 0 &&
    formData.category.trim() !== '' &&
    formData.uom_purchase_unit.trim() !== '' &&
    formData.unit.trim() !== '' &&
    formData.uom_stock_per_purchase !== '' &&
    hasWholeNumber(formData.uom_stock_per_purchase, 1) &&
    formData.uom_base_unit.trim() !== '' &&
    formData.uom_base_per_unit !== '' &&
    hasWholeNumber(formData.uom_base_per_unit, 1) &&
    (treatAsComponent
      ? true
      : formData.unit_cost !== '' &&
        hasWholeNumber(formData.unit_cost, 0) &&
        formData.minimum_purchase_units !== '' &&
        hasWholeNumber(formData.minimum_purchase_units, 0) &&
        (material
          ? true
          : formData.initial_purchase_units !== '' &&
            hasWholeNumber(formData.initial_purchase_units, 0)))

  const addOwner = (value: string) => {
    const next = value.trim()
    if (!next || formData.owner.includes(next)) return false
    setFormData({ ...formData, owner: [...formData.owner, next] })
    setOwnerInput('')
    return true
  }

  const ownerChips = useMemo(() => {
    if (!material) return formData.owner
    const nameKey = (material.material_name || '').trim().toLowerCase()
    const skuKey = (material.sku || '').trim().toLowerCase()
    const unitKey = (material.unit || '').trim().toLowerCase()
    const owners = new Set<string>()
    for (const row of allMaterials) {
      if ((row.material_name || '').trim().toLowerCase() !== nameKey) continue
      if ((row.sku || '').trim().toLowerCase() !== skuKey) continue
      if ((row.unit || '').trim().toLowerCase() !== unitKey) continue
      for (const owner of row.owner || []) {
        const clean = owner.trim()
        if (clean) owners.add(clean)
      }
    }
    // Include in-form selections immediately (before save) so newly picked owners
    // appear as chips right away in edit mode.
    for (const owner of formData.owner) {
      const clean = owner.trim()
      if (clean) owners.add(clean)
    }
    return Array.from(owners).sort((a, b) => a.localeCompare(b))
  }, [material, allMaterials, formData.owner])
  const filteredOwnerOptions = ownerOptions.filter((owner) => {
    if (ownerChips.includes(owner)) return false
    const q = ownerInput.trim().toLowerCase()
    if (!q) return true
    return owner.toLowerCase().includes(q)
  })

  const stockUnitLabel = formData.unit.trim() || '(stock unit)'
  const purchaseUnitLabel =
    formData.uom_purchase_unit.trim() ||
    (treatAsComponent ? '(production unit)' : '(purchase unit)')
  const primaryUnitName = treatAsComponent ? 'Production Unit' : 'Purchase Unit'
  const baseUnitLabel = formData.uom_base_unit.trim() || '(base unit)'
  const stockPerPurchase = Math.max(1, parseWholeQuantityInput(String(formData.uom_stock_per_purchase || '1')))
  const basePerStock = Math.max(1, parseWholeQuantityInput(String(formData.uom_base_per_unit || '1')))
  const basePerPurchase = stockPerPurchase * basePerStock
  const purchaseUnitCost = parseMoneyInput(formData.unit_cost)
  // Use the same conversion factors shown in the hierarchy text (avoids tiny
  // per-base costs rounding to ₱0.00 from mismatched floor/parse paths).
  const stockUnitCostDisplay = purchaseUnitCost / stockPerPurchase
  const baseUnitCostDisplay = purchaseUnitCost / basePerPurchase

  useEffect(() => {
    if (!treatAsComponent) return
    const linkedId = material?.linked_product_id
    if (!linkedId) return
    let cancelled = false
    setBomCostLoading(true)
    void (async () => {
      try {
        const { computeProductUnitCost } = await import('../../lib/product-bom')
        const cost = Math.max(0, Number(await computeProductUnitCost(linkedId)) || 0)
        if (!cancelled) {
          setFormData((prev) => ({ ...prev, unit_cost: cost }))
        }
      } catch (err) {
        console.warn('computeProductUnitCost:', err)
      } finally {
        if (!cancelled) setBomCostLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [treatAsComponent, material?.linked_product_id])

  const handleSave = async () => {
    if (saving || !isValid) return
    const stockPerPurchaseForSave = Math.max(
      1,
      parseWholeQuantityInput(String(formData.uom_stock_per_purchase || '1'))
    )
    const minimumPurchaseUnits = parseWholeQuantityInput(String(formData.minimum_purchase_units || '0'))
    const initialPurchaseUnits = parseWholeQuantityInput(String(formData.initial_purchase_units || '0'))
    const {
      minimum_purchase_units: _minimumPurchaseUnits,
      initial_purchase_units: _initialPurchaseUnits,
      ...materialPayload
    } = formData

    setSaving(true)
    try {
      await onSave({
        ...materialPayload,
        category: lockCategory ? defaultCategory : materialPayload.category,
        supplier_id: materialPayload.supplier_id?.trim() ? materialPayload.supplier_id : null,
        factory_inventory_kind: isFactoryInventoryKind(materialPayload.factory_inventory_kind)
          ? materialPayload.factory_inventory_kind
          : null,
        factory_request_uom: isFactoryInventoryKind(materialPayload.factory_inventory_kind)
          ? materialPayload.factory_request_uom === 'purchase'
            ? 'purchase'
            : 'stock'
          : null,
        factory_bom_uom: isFactoryInventoryKind(materialPayload.factory_inventory_kind)
          ? isFactoryBomUom(materialPayload.factory_bom_uom)
            ? materialPayload.factory_bom_uom
            : 'base'
          : null,
        minimum_stock: minimumPurchaseUnits * stockPerPurchaseForSave,
        current_stock: initialPurchaseUnits * stockPerPurchaseForSave,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} align="center">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl font-semibold shrink-0">
              {material
                ? presets?.titleEdit || 'Edit Material'
                : presets?.titleAdd || 'Add Material'}
            </h2>
            {ownerChips.length > 0 && !compact && (
              <div className="flex flex-wrap justify-end gap-1.5 min-w-0">
                {ownerChips.map((owner) => (
                  <span
                    key={owner}
                    className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-md text-xs font-medium border ${getOwnerThemeClasses(owner, ownerBrandSlugMap).chip}`}
                  >
                    {owner}
                    {canRemoveOwner ? (
                      <button
                        type="button"
                        className={`p-0.5 rounded ${getOwnerThemeClasses(owner, ownerBrandSlugMap).chipButton}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setFormData({
                            ...formData,
                            owner: formData.owner.filter((o) => o !== owner),
                          })
                        }}
                        aria-label={`Remove owner ${owner}`}
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Material Name *
              </label>
              <input
                type="text"
                value={formData.material_name}
                onChange={(e) => setFormData({ ...formData, material_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {compact ? (
            <div>
              <label className="block text-sm font-medium mb-1">SKU</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            ) : null}

            {!compact ? (
            <div>
              <label className="block text-sm font-medium mb-1">
                <span className="inline-flex items-center gap-1.5">
                  Owner *
                  {!canRemoveOwner ? <Lock className="h-3.5 w-3.5 text-gray-500" aria-hidden /> : null}
                </span>
              </label>
              <div className="owner-dropdown space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1 min-w-0">
                    {ownerChips.length > 0 && (
                      <span
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-[1] text-sm font-medium text-gray-600 pointer-events-none tabular-nums"
                        aria-hidden
                      >
                        {ownerChips.length} selected
                      </span>
                    )}
                    <input
                      type="text"
                      value={ownerInput}
                      onChange={(e) => {
                        setOwnerInput(e.target.value)
                        setShowOwnerDropdown(true)
                      }}
                      onFocus={() => setShowOwnerDropdown(true)}
                      onBlur={() => {
                        setTimeout(() => setShowOwnerDropdown(false), 150)
                      }}
                      onKeyDown={(e) => {
                        if (!canAddOwner) return
                        if (e.key !== 'Enter' && e.key !== ',') return
                        e.preventDefault()
                        addOwner(ownerInput)
                      }}
                      disabled={!canAddOwner}
                      className={`w-full py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                        formData.owner.length > 0 ? 'pl-[5.75rem] pr-3' : 'px-3'
                      }`}
                      placeholder={
                        formData.owner.length > 0
                          ? 'Type or pick another'
                          : 'Type or pick an owner'
                      }
                      aria-label={
                        formData.owner.length > 0
                          ? `${formData.owner.length} owners selected. Type or pick another owner.`
                          : 'Type or pick an owner'
                      }
                      required={canAddOwner && formData.owner.length === 0}
                    />
                    {canAddOwner && showOwnerDropdown && filteredOwnerOptions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {filteredOwnerOptions.map((owner) => (
                          <button
                            key={owner}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              addOwner(owner)
                              setShowOwnerDropdown(false)
                            }}
                        className={`w-full text-left px-3 py-2 text-sm ${getOwnerThemeClasses(owner, ownerBrandSlugMap).option}`}
                          >
                            {owner}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!canAddOwner || !ownerInput.trim()}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addOwner(ownerInput)}
                    className="shrink-0 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
                {!canRemoveOwner ? (
                  <p className="text-xs text-gray-500">
                    Existing owners are locked. You can add new owners, but removal must be done by
                    deleting that owner&apos;s material row from their inventory list.
                  </p>
                ) : null}
              </div>
            </div>
            ) : null}
            
            {!compact ? (
            <div>
              <label className="block text-sm font-medium mb-1">
                Preferred Supplier <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">No Supplier / General</option>
                {suppliers.filter(s => s.is_active).map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Link this material to a supplier for quick PO creation</p>
            </div>
            ) : null}
            
            {!compact ? (
            <div>
              <label className="block text-sm font-medium mb-1">SKU</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            ) : null}

            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Category *</label>
                  <div className="relative category-dropdown">
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => {
                        if (lockCategory) return
                        setFormData({ ...formData, category: e.target.value })
                        setShowCategoryDropdown(true)
                      }}
                      onFocus={() => {
                        if (!lockCategory) setShowCategoryDropdown(true)
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowCategoryDropdown(false), 100)
                      }}
                      readOnly={lockCategory}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        lockCategory ? 'bg-gray-50 text-gray-700' : ''
                      }`}
                      placeholder="Enter or select category"
                      required
                    />
                    {!lockCategory && showCategoryDropdown && categoryOptions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {categoryOptions.map((category) => (
                          <button
                            key={category}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormData({ ...formData, category })
                              setShowCategoryDropdown(false)
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
                <div>
                  <label className="block text-sm font-medium mb-1">{primaryUnitName} *</label>
                  <input
                    type="text"
                    value={formData.uom_purchase_unit}
                    onChange={(e) => setFormData({ ...formData, uom_purchase_unit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={treatAsComponent ? 'e.g. batch, tray, pan' : 'e.g. sack, box, case'}
                    required
                  />
                </div>
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                <div className="font-semibold mb-1">Unit Hierarchy</div>
                <div>
                  1 {purchaseUnitLabel} = {stockPerPurchase} {stockUnitLabel}
                </div>
                <div>
                  1 {stockUnitLabel} = {basePerStock} {baseUnitLabel}
                </div>
                <div className="font-semibold mt-1">
                  1 {purchaseUnitLabel} = {basePerPurchase} {baseUnitLabel}
                </div>
                <div className="mt-2 border-t border-blue-200 pt-2">
                  <div>
                    Cost per {purchaseUnitLabel}: ₱{formatUnitHierarchyCost(purchaseUnitCost)}
                    {treatAsComponent ? (
                      <span className="text-blue-700/70"> (BOM)</span>
                    ) : null}
                  </div>
                  <div>
                    Cost per {stockUnitLabel}: ₱{formatUnitHierarchyCost(stockUnitCostDisplay)}
                  </div>
                  <div>
                    Cost per {baseUnitLabel}: ₱{formatUnitHierarchyCost(baseUnitCostDisplay)}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-sm font-medium text-gray-800 mb-1">Units Setup</p>
              <p className="text-xs text-gray-500 mb-3">
                Set {primaryUnitName}, Stock Unit, and Base Unit.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Stock Unit *</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="kg, liters, pieces"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Stock per {primaryUnitName} *
                  </label>
                  <input
                    type="number"
                    value={formData.uom_stock_per_purchase}
                    onChange={(e) => setFormData({ ...formData, uom_stock_per_purchase: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    step="1"
                    placeholder="e.g. 25"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Base Unit *</label>
                  <input
                    type="text"
                    value={formData.uom_base_unit}
                    onChange={(e) => setFormData({ ...formData, uom_base_unit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. g, ml, pc"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Base per Stock Unit *</label>
                  <input
                    type="number"
                    value={formData.uom_base_per_unit}
                    onChange={(e) => setFormData({ ...formData, uom_base_per_unit: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    step="1"
                    placeholder="e.g. 1000"
                    required
                  />
                </div>
              </div>
            </div>
            
            {treatAsComponent ? (
            <div className="col-span-2">
              <label className="mb-1 inline-flex items-center gap-1.5 text-sm font-medium text-gray-800">
                Unit cost (₱)
                <HoverTooltipIcon label="From BOM" ariaLabel="Unit cost is from BOM">
                  <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                </HoverTooltipIcon>
              </label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-900 tabular-nums">
                {bomCostLoading
                  ? '…'
                  : material?.linked_product_id
                    ? `₱${formatUnitHierarchyCost(purchaseUnitCost)}`
                    : '₱0.00 — set BOM after create'}
              </div>
            </div>
            ) : (
            <div className="col-span-2 grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Purchase Unit Cost (₱) *</label>
                <input
                  type="number"
                  value={formData.unit_cost}
                  onChange={(e) => setFormData({ ...formData, unit_cost: parseMoneyInput(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="1"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Minimum PU Level *</label>
                <input
                  type="number"
                  value={formData.minimum_purchase_units}
                  onChange={(e) => setFormData({ ...formData, minimum_purchase_units: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  placeholder="0"
                  step="1"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Initial Purchase Unit *</label>
                <input
                  type="number"
                  value={formData.initial_purchase_units}
                  onChange={(e) => setFormData({ ...formData, initial_purchase_units: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  placeholder="0"
                  step="1"
                  required={!material}
                  disabled={!!material}
                />
              </div>
            </div>
            )}
            
            <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[7.25rem]"
                  rows={3}
                />
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Link to Factory</label>
                  <select
                    value={formData.factory_inventory_kind}
                    onChange={(e) => {
                      const value = e.target.value
                      if (!value) {
                        setFormData({
                          ...formData,
                          factory_inventory_kind: '',
                          factory_request_uom: 'stock',
                          factory_bom_uom: 'base',
                        })
                        return
                      }
                      setFormData({
                        ...formData,
                        factory_inventory_kind: value as FactoryInventoryKind,
                        factory_request_uom: formData.factory_request_uom || 'stock',
                        factory_bom_uom: formData.factory_bom_uom || 'base',
                      })
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm ${
                      formData.factory_inventory_kind ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    <option value="" className="text-gray-400">
                      Not linked
                    </option>
                    {FACTORY_INVENTORY_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {FACTORY_INVENTORY_KIND_LABELS[kind]}
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0 ${
                    formData.factory_inventory_kind ? '' : 'opacity-50 pointer-events-none'
                  }`}
                >
                  <fieldset disabled={!formData.factory_inventory_kind} className="min-w-0">
                    <legend className="text-sm font-medium text-gray-800 mb-1.5">
                      Factory request unit
                    </legend>
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                        <input
                          type="radio"
                          name="factory_request_uom"
                          value="purchase"
                          checked={formData.factory_request_uom === 'purchase'}
                          disabled={!formData.factory_inventory_kind}
                          onChange={() =>
                            setFormData({ ...formData, factory_request_uom: 'purchase' })
                          }
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          {treatAsComponent ? 'Production unit' : 'Purchase unit'}
                          <span className="block text-xs text-gray-500">{purchaseUnitLabel}</span>
                        </span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                        <input
                          type="radio"
                          name="factory_request_uom"
                          value="stock"
                          checked={formData.factory_request_uom === 'stock'}
                          disabled={!formData.factory_inventory_kind}
                          onChange={() =>
                            setFormData({ ...formData, factory_request_uom: 'stock' })
                          }
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          Stock unit
                          <span className="block text-xs text-gray-500">{stockUnitLabel}</span>
                        </span>
                      </label>
                    </div>
                  </fieldset>
                  <fieldset disabled={!formData.factory_inventory_kind} className="min-w-0">
                    <legend className="text-sm font-medium text-gray-800 mb-1.5">
                      Factory BOM unit
                    </legend>
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                        <input
                          type="radio"
                          name="factory_bom_uom"
                          value="stock"
                          checked={formData.factory_bom_uom === 'stock'}
                          disabled={!formData.factory_inventory_kind}
                          onChange={() =>
                            setFormData({ ...formData, factory_bom_uom: 'stock' })
                          }
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          Stock unit
                          <span className="block text-xs text-gray-500">{stockUnitLabel}</span>
                        </span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                        <input
                          type="radio"
                          name="factory_bom_uom"
                          value="base"
                          checked={formData.factory_bom_uom === 'base'}
                          disabled={!formData.factory_inventory_kind}
                          onChange={() =>
                            setFormData({ ...formData, factory_bom_uom: 'base' })
                          }
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          Base unit
                          <span className="block text-xs text-gray-500">{baseUnitLabel}</span>
                        </span>
                      </label>
                    </div>
                  </fieldset>
                </div>
              </div>
            </div>
            
          </div>
        </div>
        
        <div className="p-6 border-t shrink-0 bg-white flex flex-wrap items-end justify-between gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.06)]">
          <div className="flex flex-wrap items-end gap-6 min-w-0 flex-1">
            <label className="flex items-center shrink-0 sm:mb-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium">Active</span>
            </label>
          </div>
          <div className="flex gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              className={`px-4 py-2 rounded-lg ${
                isValid && !saving
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              disabled={!isValid || saving}
            >
              {saving
                ? material
                  ? 'Updating…'
                  : 'Adding…'
                : material
                  ? presets?.buttonEdit || 'Update Material'
                  : presets?.buttonAdd || 'Add Material'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// =============================================
// STOCK MOVEMENT MODAL
// =============================================

function StockMovementModal({ material, onSave, onClose }: {
  material: RawMaterial
  onSave: (movement: Partial<MaterialStockMovement>) => void | Promise<void>
  onClose: () => void
}) {
  const isLinkedToInventory = Boolean(material.linked_product_id)
  const purchaseUnit = getPurchaseUnit(material) || 'PU'
  const stockPerPurchase = getStockUnitsPerPurchase(material)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    movement_type: 'in' as 'in' | 'out' | 'adjustment',
    quantity: '' as string | number,
    unit_cost: (material.unit_cost > 0 ? material.unit_cost : '') as string | number,
    reference_type: '',
    reference_number: '',
    notes: '',
    movement_date: new Date().toISOString().split('T')[0],
    created_by: ''
  })

  const parseQuantityInput = (raw: string | number): number => {
    const s = String(raw ?? '').trim()
    if (!s) return 0
    const n = parseInt(s, 10)
    return Number.isFinite(n) ? n : 0
  }

  const quantityNum = parseQuantityInput(formData.quantity)
  const quantityInStockUnits = quantityNum * stockPerPurchase
  const signedPurchaseQty =
    formData.movement_type === 'adjustment'
      ? (() => {
          const s = String(formData.quantity ?? '').trim()
          if (!s || s === '-') return 0
          const n = parseInt(s, 10)
          return Number.isFinite(n) ? n : 0
        })()
      : quantityNum
  const projectedStockUnits =
    formData.movement_type === 'out'
      ? material.current_stock - quantityInStockUnits
      : formData.movement_type === 'adjustment'
        ? material.current_stock + signedPurchaseQty * stockPerPurchase
        : material.current_stock + quantityInStockUnits
  const isValid =
    formData.movement_type === 'adjustment' ? quantityNum !== 0 : quantityNum > 0

  useEffect(() => {
    if (!isLinkedToInventory && formData.movement_type === 'out') {
      setFormData((prev) => ({ ...prev, movement_type: 'in', quantity: '' }))
    }
  }, [isLinkedToInventory, formData.movement_type])

  const parseUnitCostForSave = (): number | null => {
    const raw = formData.unit_cost
    if (raw === '' || raw === null || raw === undefined) return null
    const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  }

  const handleRecord = async () => {
    if (saving || !isValid) return
    if (!isLinkedToInventory && formData.movement_type === 'out') {
      alert('Stock Out is only allowed for linked materials.')
      return
    }
    setSaving(true)
    try {
      await onSave({
        ...formData,
        quantity: quantityInStockUnits,
        unit_cost: formData.movement_type === 'in' ? parseUnitCostForSave() : null,
      })
    } finally {
      setSaving(false)
    }
  }
  
  return (
    <Modal onClose={onClose} align="center">
      <div className="bg-white rounded-lg max-w-lg w-full">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Stock Movement</h2>
          <p className="text-sm text-gray-600 mt-1">{material.material_name}</p>
          <p className="text-xs text-gray-500">
            On hand: {formatStockAsPurchaseWithRemainder(material.current_stock, material)}
          </p>
          {quantityNum !== 0 || (formData.movement_type === 'adjustment' && String(formData.quantity).trim() && String(formData.quantity).trim() !== '-') ? (
            <p className="text-xs text-gray-500 mt-1">
              After movement: {formatStockAsPurchaseWithRemainder(Math.max(0, projectedStockUnits), material)}
            </p>
          ) : null}
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Movement Type *</label>
            <select
              value={formData.movement_type}
              onChange={(e) => setFormData({ ...formData, movement_type: e.target.value as any, quantity: '' })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="in">Stock In (Purchase/Receipt)</option>
              {isLinkedToInventory && <option value="out">Stock Out (Transfer to Inventory)</option>}
              <option value="adjustment">Adjustment (+ to add, - to subtract)</option>
            </select>
            {!isLinkedToInventory && (
              <p className="text-[11px] text-amber-600 mt-1">
                Stock Out is available only for materials linked to an inventory product.
              </p>
            )}
          </div>
          
          <div
            className={`grid gap-4 ${formData.movement_type === 'in' ? 'grid-cols-2' : 'grid-cols-1'}`}
          >
            <div>
              <label className="block text-sm font-medium mb-1">
                Quantity * ({purchaseUnit})
                {formData.movement_type === 'adjustment' && (
                  <span className="block text-xs font-normal text-gray-500 mt-0.5">
                    Negative to subtract, positive to add
                  </span>
                )}
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => {
                  const v = e.target.value
                  if (formData.movement_type === 'adjustment') {
                    if (v === '' || v === '-' || /^-?\d+$/.test(v)) {
                      setFormData({ ...formData, quantity: v })
                    }
                  } else if (v === '' || /^\d+$/.test(v)) {
                    setFormData({ ...formData, quantity: v })
                  }
                }}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={formData.movement_type === 'adjustment' ? undefined : 1}
                step={1}
                inputMode="numeric"
                placeholder={
                  formData.movement_type === 'adjustment' ? 'e.g. 5 or -3' : 'Qty'
                }
                required
              />
              <p className="text-[11px] text-gray-500 mt-1">
                1 {purchaseUnit} = {stockPerPurchase} {material.unit}
              </p>
            </div>

            {formData.movement_type === 'in' && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Purchase Unit Cost (₱/{purchaseUnit})
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.unit_cost}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '' || /^\d*\.?\d*$/.test(v)) {
                      setFormData({ ...formData, unit_cost: v })
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Cost per ${purchaseUnit}`}
                />
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Movement Date</label>
            <input
              type="date"
              value={formData.movement_date}
              onChange={(e) => setFormData({ ...formData, movement_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Reference Number</label>
            <input
              type="text"
              value={formData.reference_number}
              onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="PO number, batch number, etc."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Reason for movement, additional details..."
            />
          </div>
          
          {quantityNum !== 0 && formData.movement_type === 'adjustment' && (
            <p className="text-xs text-gray-600">
              {quantityNum > 0
                ? `+${quantityNum} ${purchaseUnit} (increase)`
                : `${quantityNum} ${purchaseUnit} (decrease)`}
            </p>
          )}
        </div>
        
        <div className="p-6 border-t flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleRecord()}
            className={`px-4 py-2 rounded-lg ${
              isValid && !saving
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!isValid || saving}
          >
            {saving ? 'Recording…' : 'Record Movement'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// =============================================
// MOVEMENT HISTORY MODAL
// =============================================

function MovementHistoryModal({ material, movements, onClose }: {
  material: RawMaterial
  movements: MaterialStockMovement[]
  onClose: () => void
}) {
  const purchaseUnit = getPurchaseUnit(material) || 'PU'
  const stockPerPurchase = getStockUnitsPerPurchase(material)
  const toPurchaseUnits = (stockUnits: number) => stockUnits / stockPerPurchase

  const movementStockDelta = (movement: MaterialStockMovement) => {
    if (movement.movement_type === 'in') return movement.quantity
    if (movement.movement_type === 'out') return -movement.quantity
    return movement.quantity
  }

  const formatSignedPurchaseQty = (movement: MaterialStockMovement) => {
    const purchaseQty = toPurchaseUnits(movement.quantity)
    const formatted = Math.abs(purchaseQty).toLocaleString(undefined, { maximumFractionDigits: 2 })
    if (movement.movement_type === 'in') return `+${formatted}`
    if (movement.movement_type === 'out') return `-${formatted}`
    return purchaseQty >= 0 ? `+${formatted}` : `-${formatted}`
  }

  const formatSignedStockQty = (stockUnits: number) => {
    const formatted = Math.abs(stockUnits).toLocaleString()
    return stockUnits >= 0 ? `+${formatted}` : `-${formatted}`
  }

  const MOVEMENTS_PER_PAGE = 10
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setCurrentPage(1)
  }, [material.id, movements.length])

  // Calculate statistics
  const totalStockIn = movements.filter(m => m.movement_type === 'in').reduce((sum, m) => sum + m.quantity, 0)
  const totalStockOut = movements.filter(m => m.movement_type === 'out').reduce((sum, m) => sum + m.quantity, 0)
  const totalAdjustments = movements.filter(m => m.movement_type === 'adjustment').reduce((sum, m) => sum + m.quantity, 0)
  const totalValue = movements
    .filter((m) => m.movement_type === 'in' && m.unit_cost)
    .reduce(
      (sum, m) => sum + (toPurchaseUnits(m.quantity) * (m.unit_cost || 0)),
      0
    )
  const avgCost = totalStockIn > 0 ? totalValue / toPurchaseUnits(totalStockIn) : 0
  
  // Running balance (movements are newest-first)
  const movementsWithBalance = movements.map((movement, index) => {
    let balanceAfter = material.current_stock
    for (let j = 0; j < index; j++) {
      balanceAfter -= movementStockDelta(movements[j])
    }
    const balanceBefore = balanceAfter - movementStockDelta(movement)
    return {
      ...movement,
      balanceBefore,
      balanceAfter,
    }
  })

  const totalPages = Math.max(1, Math.ceil(movementsWithBalance.length / MOVEMENTS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * MOVEMENTS_PER_PAGE
  const endIndex = Math.min(startIndex + MOVEMENTS_PER_PAGE, movementsWithBalance.length)
  const paginatedMovements = movementsWithBalance.slice(startIndex, endIndex)
  
  return (
    <Modal onClose={onClose} align="center">
      <div className="bg-white rounded-md max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gray-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Movement History</h2>
              <p className="text-sm text-gray-600 mt-1">{material.material_name}</p>
              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                <span>SKU: {material.sku || 'N/A'}</span>
                <span>Category: {material.category || 'N/A'}</span>
                <span>
                  Current: {toPurchaseUnits(material.current_stock).toLocaleString(undefined, { maximumFractionDigits: 2 })} {purchaseUnit}
                  <span className="text-gray-400"> ({material.current_stock.toLocaleString()} {material.unit})</span>
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
        
        {/* Summary Stats */}
        <div className="p-4 bg-white border-b">
          <div className="grid grid-cols-5 gap-3">
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Stock In</p>
              <p className="text-lg font-bold text-green-600">
                +{toPurchaseUnits(totalStockIn).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500">{purchaseUnit}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Stock Out</p>
              <p className="text-lg font-bold text-red-600">
                -{toPurchaseUnits(totalStockOut).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500">{purchaseUnit}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Net Change</p>
              <p className="text-lg font-bold text-gray-900">
                {toPurchaseUnits(totalStockIn - totalStockOut + totalAdjustments).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-xs text-gray-500">{purchaseUnit}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Total Value</p>
              <p className="text-lg font-bold text-blue-600">₱{totalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
              <p className="text-xs text-gray-500">purchased</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Avg Cost</p>
              <p className="text-lg font-bold text-gray-900">₱{avgCost.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
              <p className="text-xs text-gray-500">per {material.unit}</p>
            </div>
          </div>
        </div>
        
        {/* Movement List */}
        <div className="flex-1 overflow-y-auto p-6">
          {movements.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-md border border-gray-200">
              <p className="text-gray-500">No movement history</p>
              <p className="text-xs text-gray-400 mt-1">Transactions will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedMovements.map((movement, index) => (
                <div 
                  key={movement.id} 
                  className="bg-gray-50 border border-gray-200 rounded-md p-3 hover:bg-gray-100 transition-colors"
                >
                  {/* Row 1: Type, Date, Quantity */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        movement.movement_type === 'in' ? 'bg-green-600 text-white' :
                        movement.movement_type === 'out' ? 'bg-red-600 text-white' :
                        'bg-blue-600 text-white'
                      }`}>
                        {movement.movement_type === 'in' ? 'IN' :
                         movement.movement_type === 'out' ? 'OUT' :
                         'ADJ'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(movement.movement_date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </span>
                      {movement.reference_number && (
                        <span className="text-xs text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-300">
                          {movement.reference_number}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className={`text-base font-bold ${
                          movement.movement_type === 'in' ? 'text-green-600' :
                          movement.movement_type === 'out' ? 'text-red-600' :
                          movement.quantity >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatSignedPurchaseQty(movement)} {purchaseUnit}
                        </span>
                        <div className="text-xs text-gray-500">
                          ({formatSignedStockQty(movement.quantity)} {material.unit})
                        </div>
                        {movement.unit_cost && movement.movement_type === 'in' && (
                          <div className="text-xs text-gray-600">
                            ₱{movement.unit_cost.toLocaleString()} × {toPurchaseUnits(movement.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })} {purchaseUnit}
                            {' = '}₱{(toPurchaseUnits(movement.quantity) * movement.unit_cost).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Row 2: Details */}
                  {(movement.notes || movement.reference_type || movement.created_by) && (
                    <div className="text-xs text-gray-600 mb-2 flex gap-4">
                      {movement.reference_type && (
                        <span>Type: {movement.reference_type}</span>
                      )}
                      {movement.created_by && (
                        <span>By: {movement.created_by}</span>
                      )}
                      {movement.notes && (
                        <span className="flex-1">"{movement.notes}"</span>
                      )}
                    </div>
                  )}
                  
                  {/* Row 3: Balance */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">Balance:</span>
                      <span className="font-medium text-gray-700">
                        {toPurchaseUnits(movement.balanceBefore).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-gray-400">{'\u2192'}</span>
                      <span className="font-bold text-gray-900">
                        {toPurchaseUnits(movement.balanceAfter).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-gray-500">{purchaseUnit}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(movement.created_at || '').toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            {movements.length === 0
              ? '0 total movements'
              : `Showing ${startIndex + 1}-${endIndex} of ${movements.length} movement${movements.length !== 1 ? 's' : ''}`}
          </div>
          <div className="flex items-center gap-2">
            {movements.length > MOVEMENTS_PER_PAGE && (
              <>
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={safeCurrentPage === 1}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500 px-1">
                  Page {safeCurrentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// =============================================
// PR DETAILS MODAL
// =============================================

function getPRStatusBadgeClasses(status: PurchaseRequisition['status']) {
  if (status === 'draft') return 'bg-gray-100 text-gray-800'
  if (status === 'submitted') return 'bg-yellow-100 text-yellow-800'
  if (status === 'approved') return 'bg-green-100 text-green-800'
  if (status === 'rejected') return 'bg-red-100 text-red-800'
  return 'bg-blue-100 text-blue-800'
}

function PRDetailsModal({ pr, linkedPO, onOpenPurchaseOrder, onClose }: {
  pr: PurchaseRequisition
  linkedPO?: PurchaseOrder
  onOpenPurchaseOrder: (poId: string) => void
  onClose: () => void
}) {
  const items = (pr.items || []) as PurchaseRequisitionItem[]
  const estimatedTotal = items.reduce((sum, item) => {
    return sum + (item.quantity || 0) * (item.estimated_price || 0)
  }, 0)

  return (
    <Modal onClose={onClose} align="center">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b bg-gray-50 sticky top-0 z-10">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{pr.pr_number}</h2>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPRStatusBadgeClasses(pr.status)}`}>
                  {pr.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Purchase Requisition</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <h3 className="font-medium mb-3">Requisition Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Requested by</p>
                <p className="font-medium">{pr.requested_by}</p>
              </div>
              <div>
                <p className="text-gray-500">Request Date</p>
                <p className="font-medium">{new Date(pr.request_date).toLocaleDateString()}</p>
              </div>
              {pr.department && (
                <div>
                  <p className="text-gray-500">Department</p>
                  <p className="font-medium">{pr.department}</p>
                </div>
              )}
              {pr.required_date && (
                <div>
                  <p className="text-gray-500">Required by</p>
                  <p className="font-medium">{new Date(pr.required_date).toLocaleDateString()}</p>
                </div>
              )}
              {pr.purpose && (
                <div className="col-span-2">
                  <p className="text-gray-500">Purpose</p>
                  <p className="font-medium">{pr.purpose}</p>
                </div>
              )}
              {linkedPO && (
                <div className="col-span-2">
                  <p className="text-gray-500">Linked Purchase Order</p>
                  <button
                    type="button"
                    onClick={() => onOpenPurchaseOrder(linkedPO.id)}
                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {linkedPO.po_number}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-3">Items ({items.length})</h3>
            {items.length > 0 ? (
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">#</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Product</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">Qty</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">Unit</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Est. Price</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item, index) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                        <td className="px-3 py-2 font-medium">{item.product_description}</td>
                        <td className="px-3 py-2 text-center">{item.quantity}</td>
                        <td className="px-3 py-2 text-center">{item.unit}</td>
                        <td className="px-3 py-2 text-right">
                          ₱{(item.estimated_price || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          ₱{((item.quantity || 0) * (item.estimated_price || 0)).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No items on this requisition.</p>
            )}

            {items.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300 flex justify-between items-center">
                <p className="font-medium text-gray-700">Estimated Total</p>
                <p className="text-xl font-bold">
                  ₱{estimatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>

          {pr.notes && (
            <div>
              <h3 className="font-medium mb-2">Notes</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-700">
                {pr.notes}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50 sticky bottom-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}

// =============================================
// PO DETAILS MODAL
// =============================================

function PODetailsModal({ po, onClose, onOpenRequisition }: {
  po: PurchaseOrder
  onOpenRequisition: (prId: string) => void
  onClose: () => void
}) {
  const [statusHistory, setStatusHistory] = useState<POStatusHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  
  useEffect(() => {
    loadStatusHistory()
  }, [po.id])
  
  const loadStatusHistory = async () => {
    setLoadingHistory(true)
    const { data, error } = await supabase
      .from('po_status_history')
      .select('*')
      .eq('po_id', po.id)
      .order('created_at', { ascending: true })
    
    if (data) {
      setStatusHistory(data)
    }
    setLoadingHistory(false)
  }
  
  const calculateDuration = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffMs = end.getTime() - start.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h`
    } else if (diffHours > 0) {
      return `${diffHours}h`
    } else {
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      return `${diffMins}m`
    }
  }
  
  const getStatusColorClasses = (status: string) => {
    const colorClasses: Record<string, { dot: string; line: string; text: string; badge: string }> = {
      draft: { 
        dot: 'bg-gray-500 ring-gray-100', 
        line: 'bg-gray-200', 
        text: 'text-gray-900',
        badge: 'bg-gray-100 text-gray-700'
      },
      pending_approval: { 
        dot: 'bg-yellow-500 ring-yellow-100', 
        line: 'bg-yellow-200', 
        text: 'text-yellow-900',
        badge: 'bg-yellow-100 text-yellow-700'
      },
      approved: { 
        dot: 'bg-blue-500 ring-blue-100', 
        line: 'bg-blue-200', 
        text: 'text-blue-900',
        badge: 'bg-blue-100 text-blue-700'
      },
      order_confirmed: { 
        dot: 'bg-indigo-500 ring-indigo-100', 
        line: 'bg-indigo-200', 
        text: 'text-indigo-900',
        badge: 'bg-indigo-100 text-indigo-700'
      },
      in_transit: { 
        dot: 'bg-purple-500 ring-purple-100', 
        line: 'bg-purple-200', 
        text: 'text-purple-900',
        badge: 'bg-purple-100 text-purple-700'
      },
      delivered: { 
        dot: 'bg-green-500 ring-green-100', 
        line: 'bg-green-200', 
        text: 'text-green-900',
        badge: 'bg-green-100 text-green-700'
      },
      paid: { 
        dot: 'bg-teal-500 ring-teal-100', 
        line: 'bg-teal-200', 
        text: 'text-teal-900',
        badge: 'bg-teal-100 text-teal-700'
      },
      closed: { 
        dot: 'bg-gray-500 ring-gray-100', 
        line: 'bg-gray-200', 
        text: 'text-gray-900',
        badge: 'bg-gray-100 text-gray-700'
      },
      cancelled: { 
        dot: 'bg-red-500 ring-red-100', 
        line: 'bg-red-200', 
        text: 'text-red-900',
        badge: 'bg-red-100 text-red-700'
      }
    }
    return colorClasses[status] || colorClasses.draft
  }
  
  return (
    <Modal onClose={onClose} align="center">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b bg-gray-50 sticky top-0 z-10">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold">{po.po_number}</h2>
              <p className="text-sm text-gray-600 mt-1">{po.supplier?.name || 'No supplier'}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status and Key Info */}
          <div className="flex items-center justify-between">
            <div>
              <span className={`px-3 py-1 text-sm font-medium rounded ${
                po.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                po.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' :
                po.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                po.status === 'order_confirmed' ? 'bg-indigo-100 text-indigo-800' :
                po.status === 'in_transit' ? 'bg-purple-100 text-purple-800' :
                po.status === 'delivered' ? 'bg-green-100 text-green-800' :
                po.status === 'paid' ? 'bg-teal-100 text-teal-800' :
                po.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                'bg-red-100 text-red-800'
              }`}>
                {po.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">₱{po.total_amount.toLocaleString()}</p>
              {po.balance_amount > 0 && (
                <p className="text-sm text-red-600">Balance: ₱{po.balance_amount.toLocaleString()}</p>
              )}
            </div>
          </div>
          
          {/* PO Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Order Date</p>
              <p className="font-medium">{new Date(po.order_date).toLocaleDateString()}</p>
            </div>
            {po.expected_delivery_date && (
              <div>
                <p className="text-gray-500">Expected Delivery</p>
                <p className="font-medium">{new Date(po.expected_delivery_date).toLocaleDateString()}</p>
              </div>
            )}
            <div>
              <p className="text-gray-500">Purchasing Agent</p>
              <p className="font-medium">{po.purchasing_agent}</p>
            </div>
            {po.approved_by && (
              <div>
                <p className="text-gray-500">Approved By</p>
                <p className="font-medium">{po.approved_by}</p>
              </div>
            )}
            <div>
              <p className="text-gray-500">Payment Terms</p>
              <p className="font-medium">{po.payment_terms || 'Net 30 days'}</p>
            </div>
            <div>
              <p className="text-gray-500">Payment Method</p>
              <p className="font-medium">{po.payment_method?.replace('_', ' ') || 'N/A'}</p>
            </div>
            {po.payment_account_name && (
              <div>
                <p className="text-gray-500">Account Name</p>
                <p className="font-medium">{po.payment_account_name}</p>
              </div>
            )}
            {po.payment_account_number && (
              <div>
                <p className="text-gray-500">Account Number</p>
                <p className="font-medium">{po.payment_account_number}</p>
              </div>
            )}
            {(po.delivery_address || po.delivery_contact || po.delivery_phone) && (
              <>
                {po.delivery_contact && (
                  <div>
                    <p className="text-gray-500">Delivery Contact</p>
                    <p className="font-medium">{po.delivery_contact}</p>
                  </div>
                )}
                {po.delivery_phone && (
                  <div>
                    <p className="text-gray-500">Delivery Phone</p>
                    <p className="font-medium">{po.delivery_phone}</p>
                  </div>
                )}
                {po.delivery_address && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Delivery Address</p>
                    <p className="font-medium whitespace-pre-wrap">{po.delivery_address}</p>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Status History Timeline */}
          {!loadingHistory && statusHistory.length > 0 && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={20} className="text-blue-600" />
                <h3 className="font-semibold text-gray-900">Status Timeline</h3>
              </div>
              <div className="space-y-3">
                {statusHistory.map((history, index) => {
                  const nextHistory = statusHistory[index + 1]
                  const duration = nextHistory 
                    ? calculateDuration(history.created_at!, nextHistory.created_at!)
                    : po.status === history.new_status && index === statusHistory.length - 1
                      ? calculateDuration(history.created_at!, new Date().toISOString())
                      : null
                  const colorClasses = getStatusColorClasses(history.new_status)
                  
                  return (
                    <div key={history.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ring-4 ${colorClasses.dot}`}></div>
                        {index < statusHistory.length - 1 && (
                          <div className={`w-0.5 h-full min-h-[40px] ${colorClasses.line}`}></div>
                        )}
                      </div>
                      <div className="flex-1 pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className={`font-medium text-sm ${colorClasses.text}`}>
                              {history.new_status.replace(/_/g, ' ').toUpperCase()}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              {new Date(history.created_at!).toLocaleString()} • by {history.changed_by}
                            </p>
                            {history.notes && (
                              <p className="text-xs text-gray-600 mt-1 italic">"{history.notes}"</p>
                            )}
                          </div>
                          {duration && (
                            <div className="ml-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded ${colorClasses.badge}`}>
                                {duration}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {statusHistory.length > 0 && (
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Total processing time:</span> {' '}
                    {calculateDuration(
                      statusHistory[0].created_at!,
                      po.status === 'closed' || po.status === 'cancelled'
                        ? statusHistory[statusHistory.length - 1].created_at!
                        : new Date().toISOString()
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Supplier Details */}
          {po.supplier && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <h3 className="font-medium mb-2">Supplier Information</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Name</p>
                  <p className="font-medium">{po.supplier.name}</p>
                </div>
                {po.supplier.contact_person && (
                  <div>
                    <p className="text-gray-500">Contact Person</p>
                    <p className="font-medium">{po.supplier.contact_person}</p>
                  </div>
                )}
                {po.supplier.phone && (
                  <div>
                    <p className="text-gray-500">Phone</p>
                    <p className="font-medium">{po.supplier.phone}</p>
                  </div>
                )}
                {po.supplier.email && (
                  <div>
                    <p className="text-gray-500">Email</p>
                    <p className="font-medium">{po.supplier.email}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {po.pr_id && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="font-medium mb-2 text-blue-900">Reference Requisition</h3>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenRequisition(po.pr_id!)
                }}
                className="text-sm text-blue-700 hover:text-blue-900 hover:underline font-medium"
              >
                {po.requisition?.pr_number || po.pr_id}
              </button>
            </div>
          )}
          
          {/* Items */}
          <div>
            <h3 className="font-medium mb-3">Order Items</h3>
            <div className="space-y-2">
              {po.items?.map((item, index) => (
                <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{item.product_description}</p>
                        {item.material_id && (
                          <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">
                            Materials inventory
                          </span>
                        )}
                        {item.fixed_asset_id && (
                          <span className="text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            Fixed asset
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {item.quantity} {item.unit} × ₱{item.unit_price.toLocaleString()}
                      </p>
                    </div>
                    <p className="font-semibold">₱{(item.quantity * item.unit_price).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300">
              <div className="flex justify-between items-center">
                <p className="font-medium">Total</p>
                <p className="text-xl font-bold">₱{po.total_amount.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          {/* Delivery History */}
          {po.id && (
            <DeliveryHistorySection poId={po.id} />
          )}
          
          {/* Payment History */}
          {po.payments && po.payments.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Payment History</h3>
              <div className="space-y-2">
                {po.payments.map((payment) => (
                  <div key={payment.id} className="bg-green-50 border border-green-200 rounded-md p-3">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{payment.payment_number}</p>
                        <p className="text-xs text-gray-600">
                          {new Date(payment.payment_date).toLocaleDateString()} - {payment.payment_method}
                        </p>
                        {payment.proof_of_payment_url && (
                          <a 
                            href={payment.proof_of_payment_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
                          >
                            ðŸ“Ž View Payment Receipt
                          </a>
                        )}
                      </div>
                      <p className="font-bold text-green-600">₱{payment.amount.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Notes */}
          {po.notes && (
            <div>
              <h3 className="font-medium mb-2">Notes</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-700">
                {po.notes}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 sticky bottom-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}

// =============================================
// DELIVERY HISTORY SECTION
// =============================================

function DeliveryHistorySection({ poId }: { poId: string }) {
  const [deliveries, setDeliveries] = useState<DeliveryReceipt[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    loadDeliveries()
  }, [poId])
  
  const loadDeliveries = async () => {
    const { data } = await supabase
      .from('delivery_receipts')
      .select('*')
      .eq('po_id', poId)
      .order('created_at', { ascending: false })
    
    if (data) setDeliveries(data)
    setLoading(false)
  }
  
  if (loading) return <div className="text-sm text-gray-500">Loading deliveries...</div>
  if (deliveries.length === 0) return null
  
  return (
    <div>
      <h3 className="font-medium mb-3">Delivery History</h3>
      <div className="space-y-2">
        {deliveries.map((delivery) => (
          <div key={delivery.id} className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-medium text-sm">{delivery.receipt_number}</p>
                <p className="text-xs text-gray-600">
                  {new Date(delivery.delivery_date).toLocaleDateString()} - Received by {delivery.received_by}
                </p>
                <p className="text-xs text-gray-600 flex items-center gap-1.5 flex-wrap">
                  Condition:
                  <span
                    className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded ${conditionBadgeClass(delivery.condition)}`}
                  >
                    {formatConditionLabel(delivery.condition)}
                  </span>
                </p>
                {delivery.delivery_receipt_url && (
                  <a 
                    href={delivery.delivery_receipt_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    ðŸ“Ž View Delivery Receipt
                  </a>
                )}
                {!delivery.delivery_receipt_url && (
                  <span className="text-xs text-red-500 mt-1 inline-block">
                    âš ï¸ No receipt attached
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function stashProcurementPoEdit(poId: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(PROCUREMENT_PO_EDIT_KEY, poId)
}
