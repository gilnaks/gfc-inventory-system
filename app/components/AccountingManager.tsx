'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  supabase,
  type AccountingVoucher,
  type AccountingVoucherLine,
  type AccountingVoucherLink,
  type AccountingVoucherPrefill,
  type AccountingVoucherSettings,
  type AccountingVoucherType,
  type AccountingAccount,
  type Brand,
  type POPayment,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type AccountingVoucherSourceType,
  type SupplierInvoice,
  type Supplier,
  ACCOUNTING_ACTIVE_SUBTAB_KEY,
  ACCOUNTING_VOUCHER_PREFILL_KEY,
  ACCOUNTING_VOUCHER_VIEW_KEY,
} from '../../lib/supabase'
import { BillingManager } from './BillingManager'
import { ModuleLockedNotice } from './ModuleLockedNotice'
import {
  getLockReason,
  getSubTabLabel,
  isSubTabLocked,
  type ModuleAccessLock,
} from '../../lib/module-access'
import { AccountingPayables, type PayableRow } from './AccountingPayables'
import { isFactoryBrand } from '../../lib/brand-roles'
import {
  FranchisePerformanceFilter,
  franchiseFilterToJournalOptions,
  type FranchiseFilterValue,
} from './FranchisePerformanceFilter'
import { Modal } from './Modal'
import { AccountingChartOfAccounts } from './AccountingChartOfAccounts'
import { AccountingJournal } from './AccountingJournal'
import { AccountingGeneralLedger } from './AccountingGeneralLedger'
import { AccountingReconciliation } from './AccountingReconciliation'
import { AccountingReports } from './AccountingReports'
import { loadAccounts } from '../../lib/accounting-coa-seed'
import { postJournalFromVoucher } from '../../lib/accounting-posting-rules'
import { batchPrimaryVoucherRefs, loadJournalNumbersByVoucherIds, voucherLookupKey } from '../../lib/accounting-voucher-batch'
import { backfillMissingJournals, formatBackfillSummary } from '../../lib/accounting-backfill'
import { AccountingPeriodFilter } from './AccountingPeriodFilter'
import { accountingThemePillActive } from '../../lib/accounting-theme'
import { AccountingStatusBanner } from './AccountingStatusBanner'
import { AccountingJournalEntryPanel } from './AccountingJournalEntryPanel'
import { VoucherViewModal } from './VoucherViewModal'
import { MarkPaymentVoucherPaidModal } from './MarkPaymentVoucherPaidModal'
import {
  PAYMENT_VOUCHER_BANK_REQUIRED_MSG,
  paymentVoucherMissingBankAccount,
} from '../../lib/resolve-payment-voucher-credit-account'
import { AccountingManualJournal } from './AccountingManualJournal'
import { AccountingOpeningBalances } from './AccountingOpeningBalances'
import { AccountingFiscalPeriodSettings } from './AccountingFiscalPeriodSettings'
import { AccountingGoLiveChecklist } from './AccountingGoLiveChecklist'
import type { GoLiveUnpostedTarget } from './AccountingGoLiveChecklist'
import {
  countUnresolvedErrors,
  loadUnresolvedErrors,
} from '../../lib/accounting-posting-errors'
import { retryUnresolvedPostingErrors } from '../../lib/accounting-posting-retry'
import type { AccountingPostingError } from '../../lib/supabase'
import {
  getPhilippinesBillingPeriodLabel,
  getPhilippinesBillingPeriodRange,
  isTimestampInBillingPeriod,
  isDateStringInBillingPeriod,
  type BillingTimeFilter,
} from '../../lib/timezone'
import {
  ensureVoucherSettings,
  loadVouchers,
  saveVoucher,
  saveVoucherSettings,
  updateVoucherStatus,
  loadVoucherById,
  findPrimaryVoucherForSource,
} from '../../lib/accounting-voucher-service'
import {
  emptyPaymentVoucherPrefill,
  emptyPettyCashPrefill,
  defaultVoucherLines,
  parseStoredPrefill,
  buildPrefillFromPayrollBrandTotal,
  buildPrefillFromMatchedInvoice,
  buildPrefillFromIntercompanyTransfer,
  buildPrefillFromPendingStaffAdvance,
  formatPoLabel,
} from '../../lib/accounting-voucher-prefill'
import {
  applyDefaultVoucherLineAccounts,
  filterVoucherLineDebitAccounts,
  resolveVoucherLineDefaultAccountId,
} from '../../lib/accounting-voucher-line-accounts'
import {
  attachStaffAdvanceDisbursementToVoucher,
  fetchStaffForBrandAdvances,
} from '../../lib/staff-advance-service'
import {
  loadSupplierInvoices,
  loadSupplierInvoiceById,
  loadInvoiceContext,
  loadMatchedInvoiceVoucherData,
  buildProcurementPayablePoRow,
  isProcurementPaymentDueCategory,
  loadPrimaryDeliveryReceiptsByPoIds,
  type ProcurementPayablePoRow,
} from '../../lib/supplier-invoice-service'
import { SupplierInvoiceModal, SupplierInvoiceStatusBadge } from './SupplierInvoiceModal'
import { SupplierInvoiceViewModal } from './SupplierInvoiceViewModal'
import { PurchaseOrderViewModal } from './PurchaseOrderViewModal'
import { ReceivingReportViewModal } from './ReceivingReportViewModal'
import {
  VoucherProcurementSupportingDocs,
  procurementDocFlagsFromLinks,
} from './VoucherProcurementSupportingDocs'
import { openPaymentVoucherPrintWindow } from '../../lib/print-payment-voucher'
import { openPettyCashVoucherPrintWindow } from '../../lib/print-petty-cash-voucher'
import { BookOpen, Coins, CreditCard, Info, Loader2, Package, Plus, Printer, Settings, Truck, X } from 'lucide-react'
import { getModuleReadOnlyBanner } from '../../lib/dashboard-roles'
import { ModuleEditGate, ModuleReadOnlyBanner } from './ModuleEditGate'
import { useBrands } from '../contexts/BrandsContext'
import { ensureAllIntercompanySetup } from '../../lib/accounting-intercompany-coa'
import { IntercompanyTransfersPanel } from './IntercompanyTransfersPanel'
import { MaterialTransfersPanel } from './MaterialTransfersPanel'
import { FixedAssetsPanel } from './FixedAssetsPanel'
import { PaymentVoucherPrefillSkeleton } from './AccountingBooksSkeletons'
import { accountingDocLinkClass } from '../../lib/accounting-doc-link-styles'
import { DEFAULT_ACCOUNT_FIELDS } from '../../lib/accounting-default-accounts'

type AccountingSubTab =
  | 'receivables'
  | 'payables'
  | 'supplier_invoices'
  | 'vouchers'
  | 'journal'
  | 'general_ledger'
  | 'financial_reports'
  | 'reconciliation'
  | 'intercompany'
  | 'fixed_assets'

type TransferView = 'finished_goods' | 'materials'
type VoucherView = 'payment' | 'petty_cash'

type SettingsModalSection = 'journal' | 'coa' | 'payment_voucher' | 'petty_cash'

const EMPTY_ACCESS_LOCKS: ModuleAccessLock[] = []

const ACCOUNTING_SUB_TABS: AccountingSubTab[] = [
  'receivables',
  'payables',
  'supplier_invoices',
  'vouchers',
  'journal',
  'general_ledger',
  'financial_reports',
  'reconciliation',
  'intercompany',
  'fixed_assets',
]

function voucherViewForType(type: AccountingVoucherType): VoucherView {
  return type === 'payment' ? 'payment' : 'petty_cash'
}

function resolveSavedAccountingSubTab(saved: string | null): AccountingSubTab {
  if (saved === 'payment_vouchers' || saved === 'petty_cash_vouchers') return 'vouchers'
  if (saved === 'chart_of_accounts') return 'receivables'
  if (saved && ACCOUNTING_SUB_TABS.includes(saved as AccountingSubTab)) {
    return saved as AccountingSubTab
  }
  return 'receivables'
}

function normalizeAccountingSubTab(
  saved: string | null,
  isLocked?: (tab: AccountingSubTab) => boolean
): AccountingSubTab {
  const resolved = resolveSavedAccountingSubTab(saved)
  if (!isLocked || !isLocked(resolved)) return resolved
  return ACCOUNTING_SUB_TABS.find((tab) => !isLocked(tab)) || resolved
}

function initialVoucherView(savedSubTab: string | null, savedView: string | null): VoucherView {
  if (savedSubTab === 'petty_cash_vouchers') return 'petty_cash'
  if (savedView === 'petty_cash' || savedView === 'payment') return savedView
  return 'payment'
}

type TransactionRow = PayableRow

type InvoiceListFilter = 'all' | 'exception' | 'matched' | 'paid'

function PayeeHoverCell({ label, branchName }: { label: string; branchName?: string }) {
  const display = label || '—'
  const branch = branchName?.trim()
  if (!branch || branch === display) {
    return <span>{display}</span>
  }
  return (
    <span className="inline-block cursor-default">
      <span className="group-hover:hidden">{display}</span>
      <span className="hidden group-hover:inline">{branch}</span>
    </span>
  )
}

async function resolveVoucherPayeeBranchNames(
  vouchers: AccountingVoucher[]
): Promise<Record<string, string>> {
  const orderIds: string[] = []
  for (const v of vouchers) {
    const link = v.links?.find((l) => l.source_type === 'customer_order')
    if (link) orderIds.push(link.source_id)
  }
  if (!orderIds.length) return {}

  const { data } = await supabase
    .from('customer_orders')
    .select('id, location:locations(name)')
    .in('id', orderIds)

  const branchByOrderId = new Map(
    (data || []).map((o) => [
      o.id,
      (o as { location?: { name?: string } }).location?.name?.trim() || '',
    ])
  )

  const out: Record<string, string> = {}
  for (const v of vouchers) {
    const link = v.links?.find((l) => l.source_type === 'customer_order')
    const branch = link ? branchByOrderId.get(link.source_id) : ''
    if (branch) out[v.id] = branch
  }
  return out
}

interface AccountingManagerProps {
  selectedBrand: Brand | null
  currentUsername?: string
  currentRoleLabel?: string
  theme?: string
  onGoToProcurement?: (poId: string) => void
  readOnlyMode?: boolean
  accessLocks?: ModuleAccessLock[]
  bypassAccessLocks?: boolean
}

function lineTotal(lines: AccountingVoucherLine[]) {
  return lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
}

function statusBadgeClass(status: string) {
  if (status === 'cancelled') return 'bg-gray-100 text-gray-600'
  if (status === 'draft') return 'bg-gray-100 text-gray-700'
  if (status === 'submitted') return 'bg-yellow-100 text-yellow-800'
  if (status === 'approved') return 'bg-blue-100 text-blue-800'
  if (status === 'paid' || status === 'liquidated') return 'bg-green-100 text-green-800'
  if (status === 'released') return 'bg-purple-100 text-purple-800'
  return 'bg-gray-100 text-gray-700'
}

const ACCOUNTING_PAGE_SIZE = 10

function paginateSlice<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  return {
    slice: items.slice(start, start + pageSize),
    totalPages,
    safePage,
    rangeStart: items.length === 0 ? 0 : start + 1,
    rangeEnd: Math.min(safePage * pageSize, items.length),
  }
}

function getVisiblePageNumbers(currentPage: number, totalPages: number) {
  const maxVisibleButtons = 10
  if (totalPages <= maxVisibleButtons) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const windowStart = Math.floor((currentPage - 1) / maxVisibleButtons) * maxVisibleButtons + 1
  const windowEnd = Math.min(windowStart + maxVisibleButtons - 1, totalPages)
  return Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i)
}

const SKELETON_CELL_WIDTHS = ['w-16', 'w-24', 'w-28', 'w-20', 'w-32', 'w-24', 'w-20'] as const

function skeletonCellWidth(index: number) {
  return SKELETON_CELL_WIDTHS[index % SKELETON_CELL_WIDTHS.length]
}

function AccountingTableSkeleton({
  columnCount,
  rows = ACCOUNTING_PAGE_SIZE,
  tableMinWidthClass = 'w-full',
  lastColumnActions = false,
}: {
  columnCount: number
  rows?: number
  tableMinWidthClass?: string
  lastColumnActions?: boolean
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className={`w-full text-sm table-fixed ${tableMinWidthClass} animate-pulse`}>
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {Array.from({ length: columnCount }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <div className={`h-4 bg-gray-200 rounded max-w-full ${skeletonCellWidth(i)}`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: columnCount }).map((_, cellIdx) => {
                const isActions = cellIdx === columnCount - 1
                return (
                  <td key={cellIdx} className="px-4 py-3">
                    {isActions ? (
                      <div className="flex justify-end gap-1.5">
                        {lastColumnActions ? (
                          <>
                            <div className="h-7 w-12 bg-gray-200 rounded" />
                            <div className="h-7 w-14 bg-gray-200 rounded" />
                          </>
                        ) : (
                          <>
                            <div className="h-7 w-7 bg-gray-200 rounded" />
                            <div className="h-7 w-12 bg-gray-200 rounded" />
                            <div className="h-7 w-14 bg-gray-200 rounded" />
                          </>
                        )}
                      </div>
                    ) : (
                      <div
                        className={`h-4 bg-gray-200 rounded max-w-full ${skeletonCellWidth(rowIdx + cellIdx)}`}
                      />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AccountingTablePagination({
  page,
  totalItems,
  pageSize,
  itemLabel,
  activePageClass,
  onPageChange,
}: {
  page: number
  totalItems: number
  pageSize: number
  itemLabel: string
  activePageClass: string
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  if (totalItems <= pageSize) return null

  const rangeStart = (safePage - 1) * pageSize + 1
  const rangeEnd = Math.min(safePage * pageSize, totalItems)
  const visiblePages = getVisiblePageNumbers(safePage, totalPages)

  return (
    <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-gray-700">
          Showing {rangeStart} to {rangeEnd} of {totalItems} {itemLabel}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage === 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <div className="flex items-center gap-1 flex-wrap">
            {visiblePages.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`px-3 py-1 text-sm border rounded-md ${
                  p === safePage
                    ? `${activePageClass} text-white border-transparent`
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage === totalPages}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

export function AccountingManager({
  selectedBrand,
  currentUsername = '',
  currentRoleLabel = '',
  theme = 'blue',
  onGoToProcurement,
  readOnlyMode = false,
  accessLocks = EMPTY_ACCESS_LOCKS,
  bypassAccessLocks = false,
}: AccountingManagerProps) {
  const canEdit = !readOnlyMode
  const isAccountingSubTabLocked = useCallback(
    (tab: AccountingSubTab) =>
      !bypassAccessLocks && isSubTabLocked(accessLocks, 'accounting', tab),
    [accessLocks, bypassAccessLocks]
  )
  const brandId = selectedBrand?.id || ''
  const isGfcMain = isFactoryBrand(selectedBrand)
  const { brands } = useBrands()
  const [franchiseFilter, setFranchiseFilter] = useState<FranchiseFilterValue>('all')
  const franchiseJournalOpts = useMemo(
    () => franchiseFilterToJournalOptions(franchiseFilter),
    [franchiseFilter]
  )
  const [subTab, setSubTab] = useState<AccountingSubTab>('receivables')
  const [settings, setSettings] = useState<AccountingVoucherSettings | null>(null)
  const [paymentVouchers, setPaymentVouchers] = useState<AccountingVoucher[]>([])
  const [pettyVouchers, setPettyVouchers] = useState<AccountingVoucher[]>([])
  const [payables, setPayables] = useState<PayableRow[]>([])
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([])
  const [supplierInvoicesPage, setSupplierInvoicesPage] = useState(1)
  const [invoiceListFilter, setInvoiceListFilter] = useState<InvoiceListFilter>('all')
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<SupplierInvoice | null>(null)
  const [initialPoForInvoice, setInitialPoForInvoice] = useState<string | undefined>()
  const [periodFilter, setPeriodFilter] = useState<BillingTimeFilter>('year')
  const [initialLoading, setInitialLoading] = useState(true)
  const [updatingVoucherId, setUpdatingVoucherId] = useState<string | null>(null)
  const [vouchersPage, setVouchersPage] = useState(1)
  const [voucherPayeeBranchById, setVoucherPayeeBranchById] = useState<Record<string, string>>({})
  const hasLoadedOnceRef = useRef(false)
  const brandIdRef = useRef(brandId)
  brandIdRef.current = brandId
  const [modalType, setModalType] = useState<AccountingVoucherType | null>(null)
  const [editingVoucher, setEditingVoucher] = useState<AccountingVoucher | null>(null)
  const [formHeader, setFormHeader] = useState<Partial<AccountingVoucher>>({})
  const [formLines, setFormLines] = useState<AccountingVoucherLine[]>([])
  const [formLinks, setFormLinks] = useState<AccountingVoucherLink[]>([])
  const [saving, setSaving] = useState(false)
  const [expenseAccounts, setExpenseAccounts] = useState<AccountingAccount[]>([])
  const [allAccounts, setAllAccounts] = useState<AccountingAccount[]>([])
  const [voucherPrefillContext, setVoucherPrefillContext] = useState<{
    sourceType: AccountingVoucherSourceType
    poItems?: PurchaseOrderItem[]
  } | null>(null)
  const [voucherPrefillLoading, setVoucherPrefillLoading] = useState(false)
  const [jeNumberByVoucherId, setJeNumberByVoucherId] = useState<Record<string, string>>({})
  const [statusBanner, setStatusBanner] = useState<{
    msg: string
    variant: 'success' | 'error' | 'info'
  } | null>(null)
  const [viewVoucher, setViewVoucher] = useState<AccountingVoucher | null>(null)
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null)
  const [viewPoId, setViewPoId] = useState<string | null>(null)
  const [viewReceiptId, setViewReceiptId] = useState<string | null>(null)
  const [invoiceVoucherById, setInvoiceVoucherById] = useState<
    Record<string, { voucherId: string; voucherNumber: string }>
  >({})
  const [deliveryReceiptByPoId, setDeliveryReceiptByPoId] = useState<
    Record<string, { id: string; receipt_number: string }>
  >({})
  const [viewJeId, setViewJeId] = useState<string | null>(null)
  const [journalListRefreshToken, setJournalListRefreshToken] = useState(0)
  const [backfilling, setBackfilling] = useState(false)
  const [transferView, setTransferView] = useState<TransferView>('finished_goods')
  const [voucherView, setVoucherView] = useState<VoucherView>('payment')
  const [settingsModal, setSettingsModal] = useState<SettingsModalSection | null>(null)
  const [settingsModalFooter, setSettingsModalFooter] = useState<ReactNode>(null)
  const pendingGoLiveNavRef = useRef<GoLiveUnpostedTarget | null>(null)
  const [showStaffAdvanceModal, setShowStaffAdvanceModal] = useState(false)
  const [staffAdvanceOptions, setStaffAdvanceOptions] = useState<Array<{ id: string; full_name: string }>>([])
  const [staffAdvanceStaffId, setStaffAdvanceStaffId] = useState('')
  const [staffAdvanceAmount, setStaffAdvanceAmount] = useState('')
  const [staffAdvanceNotes, setStaffAdvanceNotes] = useState('')
  const [loadingStaffAdvanceOptions, setLoadingStaffAdvanceOptions] = useState(false)
  const staffAdvanceOptionsCacheRef = useRef<{
    brandId: string
    isGfcMain: boolean
    list: Array<{ id: string; full_name: string }>
  } | null>(null)
  const [pendingStaffAdvance, setPendingStaffAdvance] = useState<{
    staffId: string
    staffName: string
    amount: number
    notes?: string
  } | null>(null)
  const [showChartOfAccountsModal, setShowChartOfAccountsModal] = useState(false)
  const [postingErrorCount, setPostingErrorCount] = useState(0)
  const [postingErrors, setPostingErrors] = useState<AccountingPostingError[]>([])
  const [showPostingErrors, setShowPostingErrors] = useState(false)
  const [retryingPosting, setRetryingPosting] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [markPaidVoucher, setMarkPaidVoucher] = useState<AccountingVoucher | null>(null)

  const loadSuppliers = useCallback(async () => {
    const { data } = await supabase.from('suppliers').select('*').order('name')
    setSuppliers((data || []) as Supplier[])
  }, [])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  const refreshPostingErrors = useCallback(async () => {
    if (!brandId) {
      setPostingErrorCount(0)
      setPostingErrors([])
      return
    }
    const count = await countUnresolvedErrors(brandId)
    setPostingErrorCount(count)
    if (count > 0) {
      setPostingErrors(await loadUnresolvedErrors(brandId, 5))
    } else {
      setPostingErrors([])
      setShowPostingErrors(false)
    }
  }, [brandId])

  useEffect(() => {
    const savedSubTab = localStorage.getItem(ACCOUNTING_ACTIVE_SUBTAB_KEY)
    const savedVoucherView = localStorage.getItem(ACCOUNTING_VOUCHER_VIEW_KEY)
    const prefill = parseStoredPrefill(localStorage.getItem(ACCOUNTING_VOUCHER_PREFILL_KEY))
    if (prefill) {
      localStorage.removeItem(ACCOUNTING_VOUCHER_PREFILL_KEY)
      openPrefillModal(prefill)
      const view = voucherViewForType(prefill.voucherType)
      setSubTab('vouchers')
      setVoucherView(view)
      localStorage.setItem(ACCOUNTING_ACTIVE_SUBTAB_KEY, 'vouchers')
      localStorage.setItem(ACCOUNTING_VOUCHER_VIEW_KEY, view)
      return
    }
    setSubTab(normalizeAccountingSubTab(savedSubTab, isAccountingSubTabLocked))
    setVoucherView(initialVoucherView(savedSubTab, savedVoucherView))
  }, [])

  const setSubTabPersist = (tab: AccountingSubTab) => {
    setSubTab(tab)
    localStorage.setItem(ACCOUNTING_ACTIVE_SUBTAB_KEY, tab)
  }

  // Developer locks: leave a sub-tab that gets locked while it is open.
  useEffect(() => {
    if (!isAccountingSubTabLocked(subTab)) return
    const fallback = ACCOUNTING_SUB_TABS.find((tab) => !isAccountingSubTabLocked(tab))
    if (!fallback) return
    setSubTab(fallback)
    localStorage.setItem(ACCOUNTING_ACTIVE_SUBTAB_KEY, fallback)
  }, [subTab, isAccountingSubTabLocked])

  useEffect(() => {
    setStatusBanner((prev) =>
      prev?.variant === 'success' || prev?.variant === 'info' ? null : prev
    )
  }, [subTab, voucherView, brandId])

  const setVoucherViewPersist = (view: VoucherView) => {
    setVoucherView(view)
    localStorage.setItem(ACCOUNTING_VOUCHER_VIEW_KEY, view)
    setVouchersPage(1)
  }

  useEffect(() => {
    if (settingsModal !== null) return
    const target = pendingGoLiveNavRef.current
    if (!target || target === 'backfill') return
    pendingGoLiveNavRef.current = null
    if (target === 'receivables') setSubTabPersist('receivables')
    else if (target === 'payables') setSubTabPersist('payables')
    else if (target === 'vouchers_payment') {
      setSubTabPersist('vouchers')
      setVoucherViewPersist('payment')
    } else if (target === 'vouchers_petty') {
      setSubTabPersist('vouchers')
      setVoucherViewPersist('petty_cash')
    }
  }, [settingsModal])

  const handleGoLiveUnpostedNav = useCallback((target: GoLiveUnpostedTarget) => {
    if (target === 'backfill') {
      const el = document.getElementById('accounting-historical-backfill')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2')
      window.setTimeout(() => {
        el?.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2')
      }, 1600)
      return
    }
    pendingGoLiveNavRef.current = target
    setSettingsModalFooter(null)
    setSettingsModal(null)
  }, [])

  const goToVouchers = (type: AccountingVoucherType) => {
    setSubTabPersist('vouchers')
    setVoucherViewPersist(voucherViewForType(type))
  }

  const openStaffAdvanceModal = () => {
    if (!brandId) return
    setStaffAdvanceStaffId('')
    setStaffAdvanceAmount('')
    setStaffAdvanceNotes('')
    setShowStaffAdvanceModal(true)

    const cached = staffAdvanceOptionsCacheRef.current
    if (cached && cached.brandId === brandId && cached.isGfcMain === isGfcMain) {
      setStaffAdvanceOptions(cached.list)
      setLoadingStaffAdvanceOptions(false)
      return
    }

    setLoadingStaffAdvanceOptions(true)
    void fetchStaffForBrandAdvances(brandId, isGfcMain)
      .then((staff) => {
        staffAdvanceOptionsCacheRef.current = { brandId, isGfcMain, list: staff }
        setStaffAdvanceOptions(staff)
      })
      .catch(() => {
        alert('Could not load staff list.')
      })
      .finally(() => {
        setLoadingStaffAdvanceOptions(false)
      })
  }

  const handleOpenStaffAdvanceVoucher = () => {
    if (!brandId || !staffAdvanceStaffId) return
    const amount = Math.round(Number(staffAdvanceAmount) || 0)
    if (amount <= 0) {
      alert('Enter a valid advance amount.')
      return
    }
    const staffMember = staffAdvanceOptions.find((s) => s.id === staffAdvanceStaffId)
    const staffName = staffMember?.full_name || 'Staff'
    const disbursedDate = new Date().toISOString().split('T')[0]
    setPendingStaffAdvance({
      staffId: staffAdvanceStaffId,
      staffName,
      amount,
      notes: staffAdvanceNotes || undefined,
    })
    setShowStaffAdvanceModal(false)
    openPrefillModal(
      buildPrefillFromPendingStaffAdvance({
        staff_name: staffName,
        amount,
        disbursed_date: disbursedDate,
      })
    )
    if (settings) {
      setFormHeader((h) => ({
        ...h,
        approved_by_name: settings.approved_by_name,
        approved_by_title: settings.approved_by_title,
      }))
    }
  }

  const loadSettings = useCallback(async () => {
    if (!brandId) return
    if (brands.length) {
      try {
        await ensureAllIntercompanySetup(brands)
      } catch (e) {
        console.warn('Intercompany COA setup:', e)
      }
    }
    const s = await ensureVoucherSettings(brandId)
    setSettings(s)
    const accounts = await loadAccounts(brandId)
    setAllAccounts(accounts)
    setExpenseAccounts(filterVoucherLineDebitAccounts(accounts))
  }, [brandId, brands])

  const refreshVoucherLists = useCallback(async () => {
    if (!brandId) return
    const forBrand = brandId
    const [pv, pcv] = await Promise.all([
      loadVouchers(forBrand, 'payment'),
      loadVouchers(forBrand, 'petty_cash'),
    ])
    if (brandIdRef.current !== forBrand) return
    setPaymentVouchers(pv)
    setPettyVouchers(pcv)
    setVoucherPayeeBranchById(await resolveVoucherPayeeBranchNames([...pv, ...pcv]))
    const ids = [...pv, ...pcv].map((v) => v.id)
    setJeNumberByVoucherId(await loadJournalNumbersByVoucherIds(ids))
  }, [brandId])

  const loadPayablesHub = useCallback(async () => {
    const forBrand = brandId
    if (!forBrand) return
    const { start, end } = getPhilippinesBillingPeriodRange(periodFilter)
    const rows: TransactionRow[] = []

    const { data: paymentsRaw } = await supabase
      .from('po_payments')
      .select('*, purchase_order:purchase_orders(id, po_number, brand_id, supplier:suppliers(name))')
      .order('payment_date', { ascending: false })
      .limit(200)

    const payments = (paymentsRaw || []).filter(
      (p) => (p as { purchase_order?: { brand_id?: string } }).purchase_order?.brand_id === forBrand
    ).slice(0, 50)

    const voucherLinkPairs: Array<{ sourceType: string; sourceId: string }> = []

    for (const p of payments) {
      if (
        !isTimestampInBillingPeriod(
          p.updated_at ?? p.created_at,
          start,
          end,
          periodFilter
        )
      ) {
        continue
      }
      const po = (p as POPayment & { purchase_order: PurchaseOrder }).purchase_order
      voucherLinkPairs.push({ sourceType: 'po_payment', sourceId: p.id })
      rows.push({
        id: `pay-${p.id}`,
        sourceType: 'po_payment',
        sourceId: p.id,
        category: 'Procurement payment',
        reference: p.payment_number,
        payee: po?.supplier?.name || 'Supplier',
        amount: Number(p.amount) || 0,
        date: p.payment_date,
        voucherLink: { sourceType: 'po_payment', sourceId: p.id },
      })
    }

    const { data: pos } = await supabase
      .from('purchase_orders')
      .select(
        'id, po_number, order_date, updated_at, status, payment_terms, payment_timing, total_amount, supplier:suppliers(name), items:purchase_order_items(quantity, quantity_received, unit_price)'
      )
      .eq('brand_id', forBrand)
      .in('status', ['approved', 'order_confirmed', 'in_transit', 'delivered', 'paid'])
      .order('updated_at', { ascending: false })
      .limit(200)

    const { data: invoiceRows } = await supabase
      .from('supplier_invoices')
      .select(
        'id, po_id, status, invoice_number, total_amount, invoice_date, updated_at, purchase_order:purchase_orders(po_number, order_date), supplier:suppliers(name)'
      )
      .eq('brand_id', forBrand)
      .order('updated_at', { ascending: false })

    type PayableLatestInvoice = {
      status: string
      id: string
      invoice_number: string
      total_amount: number
      invoice_date: string
      updated_at?: string
      supplier?: { name?: string }
    }
    const latestInvoiceByPoId = new Map<string, PayableLatestInvoice>()
    for (const inv of invoiceRows || []) {
      if (!latestInvoiceByPoId.has(inv.po_id)) {
        const supplierRaw = inv.supplier as { name?: string } | { name?: string }[] | null
        latestInvoiceByPoId.set(inv.po_id, {
          id: inv.id,
          status: inv.status,
          invoice_number: inv.invoice_number,
          total_amount: Number(inv.total_amount) || 0,
          invoice_date: inv.invoice_date,
          updated_at: inv.updated_at || undefined,
          supplier: Array.isArray(supplierRaw) ? supplierRaw[0] : supplierRaw || undefined,
        })
      }
    }

    const poIds = (pos || []).map((p) => p.id)
    const poIdsWithReceipt = new Set<string>()
    if (poIds.length > 0) {
      const { data: drRows } = await supabase
        .from('delivery_receipts')
        .select('po_id')
        .in('po_id', poIds)
      for (const dr of drRows || []) {
        if (dr.po_id) poIdsWithReceipt.add(dr.po_id)
      }
    }

    for (const po of pos || []) {
      const payable = buildProcurementPayablePoRow(
        po as ProcurementPayablePoRow,
        latestInvoiceByPoId.get(po.id) || null,
        { hasDeliveryReceipt: poIdsWithReceipt.has(po.id) }
      )
      if (!payable) continue

      if (payable.voucherLink) {
        voucherLinkPairs.push({
          sourceType: payable.voucherLink.sourceType,
          sourceId: payable.voucherLink.sourceId,
        })
      }

      rows.push({
        id:
          payable.kind === 'exception'
            ? `exc-${payable.sourceId}`
            : payable.kind === 'ready'
              ? `ready-${payable.sourceId}`
              : `po-${payable.sourceId}`,
        sourceType: payable.sourceType,
        sourceId: payable.sourceId,
        category: payable.category,
        reference: payable.reference,
        payee: payable.payee,
        amount: payable.amount,
        date: payable.date,
        voucherLink: payable.voucherLink,
      })
    }

    const { data: payrollBrandTotals } = await supabase
      .from('payroll_run_brand_totals')
      .select(
        'id, net_pay, journal_entry_id_accrual, journal_entry_id_payment, payroll_run:payroll_runs(week_start_date, week_end_date, status), brand:brands(name)'
      )
      .eq('brand_id', forBrand)
      .not('journal_entry_id_accrual', 'is', null)
      .is('journal_entry_id_payment', null)
      .order('created_at', { ascending: false })
      .limit(40)

    for (const bt of payrollBrandTotals || []) {
      const runRaw = bt.payroll_run as
        | { week_start_date: string; week_end_date: string; status: string }
        | { week_start_date: string; week_end_date: string; status: string }[]
        | null
      const run = Array.isArray(runRaw) ? runRaw[0] : runRaw
      if (!run || run.status === 'void') continue
      const netPay = Number(bt.net_pay) || 0
      if (netPay <= 0) continue
      if (!isDateStringInBillingPeriod(run.week_end_date, periodFilter)) continue
      const brandName = (bt.brand as { name?: string } | null)?.name || 'Brand'
      voucherLinkPairs.push({ sourceType: 'payroll_run_brand_total', sourceId: bt.id })
      rows.push({
        id: `pbt-${bt.id}`,
        sourceType: 'payroll_run_brand_total',
        sourceId: bt.id,
        category: 'Payroll — net pay',
        reference: `${run.week_start_date} – ${run.week_end_date}`,
        payee: `Payroll — ${brandName}`,
        amount: netPay,
        date: run.week_end_date,
        voucherLink: { sourceType: 'payroll_run_brand_total', sourceId: bt.id },
      })
    }

    const voucherRefs = await batchPrimaryVoucherRefs(voucherLinkPairs)
    const withVouchers = rows.map((row) => {
      const ref = voucherRefs[voucherLookupKey(row)]
      return {
        ...row,
        voucherNumber: ref?.voucherNumber,
        voucherId: ref?.voucherId,
      }
    })

    if (brandIdRef.current === forBrand) {
      setPayables(withVouchers)
    }
  }, [brandId, periodFilter])

  const loadSupplierInvoicesList = useCallback(async () => {
    const forBrand = brandId
    if (!forBrand) return
    const list = await loadSupplierInvoices(forBrand)
    const poIds = Array.from(new Set(list.map((inv) => inv.po_id).filter(Boolean)))
    const [refs, drByPo] = await Promise.all([
      batchPrimaryVoucherRefs(list.map((inv) => ({ sourceType: 'supplier_invoice', sourceId: inv.id }))),
      loadPrimaryDeliveryReceiptsByPoIds(poIds),
    ])
    const byId: Record<string, { voucherId: string; voucherNumber: string }> = {}
    for (const inv of list) {
      const ref = refs[`supplier_invoice:${inv.id}`]
      if (ref) {
        byId[inv.id] = ref
      } else if (inv.payment_voucher_id) {
        byId[inv.id] = { voucherId: inv.payment_voucher_id, voucherNumber: '' }
      }
    }
    if (brandIdRef.current === forBrand) {
      setSupplierInvoices(list)
      setInvoiceVoucherById(byId)
      setDeliveryReceiptByPoId(drByPo)
    }
  }, [brandId])

  const loadAll = useCallback(
    async (options?: { showInitialLoading?: boolean }) => {
      if (!brandId) return
      const loadingForBrand = brandId
      const showSpinner = options?.showInitialLoading ?? !hasLoadedOnceRef.current
      if (showSpinner) setInitialLoading(true)
      try {
        await loadSettings()
        if (brandIdRef.current !== loadingForBrand) return
        await refreshVoucherLists()
        if (brandIdRef.current !== loadingForBrand) return
        await loadPayablesHub()
        if (brandIdRef.current !== loadingForBrand) return
        await loadSupplierInvoicesList()
        if (brandIdRef.current === loadingForBrand) {
          hasLoadedOnceRef.current = true
        }
      } finally {
        if (showSpinner && brandIdRef.current === loadingForBrand) {
          setInitialLoading(false)
        }
      }
    },
    [brandId, loadSettings, refreshVoucherLists, loadPayablesHub, loadSupplierInvoicesList]
  )

  const patchVoucherInLists = (id: string, patch: Partial<AccountingVoucher>) => {
    const merge = (list: AccountingVoucher[]) =>
      list.map((row) => (row.id === id ? { ...row, ...patch } : row))
    setPaymentVouchers((prev) => merge(prev))
    setPettyVouchers((prev) => merge(prev))
  }

  useEffect(() => {
    setVouchersPage(1)

    if (!brandId) {
      setInitialLoading(false)
      setPayables([])
      setSupplierInvoices([])
      setPaymentVouchers([])
      setPettyVouchers([])
      setVoucherPayeeBranchById({})
      hasLoadedOnceRef.current = false
      return
    }

    hasLoadedOnceRef.current = false
    setPayables([])
    setSupplierInvoices([])
    setPaymentVouchers([])
    setPettyVouchers([])
    setVoucherPayeeBranchById({})
    void loadAll({ showInitialLoading: true })
  }, [brandId, loadAll])

  useEffect(() => {
    void refreshPostingErrors()
  }, [refreshPostingErrors])

  useEffect(() => {
    if (!brandId || !hasLoadedOnceRef.current) return
    void loadPayablesHub()
  }, [periodFilter, brandId, loadPayablesHub])

  const enrichVoucherLines = useCallback(
    (
      lines: AccountingVoucherLine[],
      links: AccountingVoucherLink[],
      ctx: { sourceType: AccountingVoucherSourceType; poItems?: PurchaseOrderItem[] } | null
    ) => {
      if (!settings || !allAccounts.length) return lines
      return applyDefaultVoucherLineAccounts(lines, {
        sourceType: ctx?.sourceType || 'supplier',
        links,
        settings,
        accounts: allAccounts,
        poItems: ctx?.poItems,
      })
    },
    [settings, allAccounts]
  )

  const inferVoucherSourceTypeFromLinks = (links: AccountingVoucherLink[]): AccountingVoucherSourceType => {
    const primary = links.find((l) => l.link_role === 'primary') || links[0]
    return primary?.source_type || 'supplier'
  }

  const openPrefillModal = (prefill: AccountingVoucherPrefill, poItems?: PurchaseOrderItem[]) => {
    const ctx = { sourceType: prefill.sourceType, poItems }
    setVoucherPrefillContext(ctx)
    setModalType(prefill.voucherType)
    setEditingVoucher(null)
    setFormHeader({
      voucher_type: prefill.voucherType,
      voucher_date: new Date().toISOString().split('T')[0],
      status: 'draft',
      prepared_by: currentUsername,
      prepared_by_name: currentUsername,
      ...prefill.header,
    })
    const baseLines = prefill.lines.length ? prefill.lines : defaultVoucherLines()
    setFormLines(enrichVoucherLines(baseLines, prefill.links, ctx))
    setFormLinks(prefill.links)
  }

  const openNewVoucher = (type: AccountingVoucherType) => {
    const prefill = type === 'payment' ? emptyPaymentVoucherPrefill() : emptyPettyCashPrefill()
    openPrefillModal(prefill)
    if (settings) {
      setFormHeader((h) => ({
        ...h,
        approved_by_name: settings.approved_by_name,
        approved_by_title: settings.approved_by_title,
        liquidated_by_name: settings.liquidated_by_name,
        liquidated_by_title: settings.liquidated_by_title,
      }))
    }
  }

  const openEditVoucher = (v: AccountingVoucher) => {
    const links = v.links || []
    const ctx = { sourceType: inferVoucherSourceTypeFromLinks(links) }
    setVoucherPrefillContext(ctx)
    setModalType(v.voucher_type)
    setEditingVoucher(v)
    setFormHeader({ ...v })
    const baseLines = v.lines?.length ? [...v.lines] : defaultVoucherLines()
    setFormLines(enrichVoucherLines(baseLines, links, ctx))
    setFormLinks(links)
  }

  const closeModal = () => {
    setModalType(null)
    setEditingVoucher(null)
    setPendingStaffAdvance(null)
    setVoucherPrefillContext(null)
    setVoucherPrefillLoading(false)
  }

  const openVoucherFromMatchedInvoice = (invoiceId: string) => {
    setShowInvoiceModal(false)
    setVoucherPrefillLoading(true)
    setModalType('payment')
    setEditingVoucher(null)
    setFormHeader({
      voucher_type: 'payment',
      voucher_date: new Date().toISOString().split('T')[0],
      status: 'draft',
      prepared_by: currentUsername,
      prepared_by_name: currentUsername,
    })
    setFormLines(defaultVoucherLines())
    setFormLinks([])
    setVoucherPrefillContext({ sourceType: 'supplier_invoice' })
    goToVouchers('payment')

    void (async () => {
      try {
        const data = await loadMatchedInvoiceVoucherData(invoiceId)
        if (!data) {
          alert('Could not load invoice.')
          closeModal()
          return
        }
        if (data.invoice.status !== 'matched' && data.invoice.status !== 'vouchered') {
          alert(
            `Invoice is ${data.invoice.status}. Resolve match issues before creating a payment voucher.`
          )
          closeModal()
          return
        }
        openPrefillModal(
          buildPrefillFromMatchedInvoice(data.invoice, data.po, data.deliveryReceipts),
          data.po.items
        )
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Could not load invoice for payment voucher.')
        closeModal()
      } finally {
        setVoucherPrefillLoading(false)
      }
    })()
  }

  useEffect(() => {
    if (!modalType || !settings || !allAccounts.length) return
    setFormLines((prev) => enrichVoucherLines(prev, formLinks, voucherPrefillContext))
    // formLinks intentionally omitted — only backfill accounts when settings/accounts become available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalType, settings, allAccounts, voucherPrefillContext, enrichVoucherLines])

  const openMarkPaidModal = (v: AccountingVoucher) => {
    if (paymentVoucherMissingBankAccount(v)) {
      setStatusBanner({ msg: PAYMENT_VOUCHER_BANK_REQUIRED_MSG, variant: 'error' })
      return
    }
    setMarkPaidVoucher(v)
  }

  const handleSaveVoucher = async () => {
    if (!brandId || !modalType) return
    if (
      modalType === 'payment' &&
      paymentVoucherMissingBankAccount({
        voucher_type: 'payment',
        payment_mode: formHeader.payment_mode,
        bank_account_id: formHeader.bank_account_id,
      })
    ) {
      setStatusBanner({
        msg: 'Check and bank payments require a bank account on the voucher.',
        variant: 'error',
      })
      return
    }
    setSaving(true)
    try {
      const total = lineTotal(formLines)
      const header = {
        ...formHeader,
        voucher_type: modalType,
        amount_requested:
          modalType === 'petty_cash' ? formHeader.amount_requested ?? total : formHeader.amount_requested,
        ...(modalType === 'payment' ? procurementDocFlagsFromLinks(formLinks) : {}),
      }
      const isNewStaffAdvance =
        !!pendingStaffAdvance &&
        modalType === 'payment' &&
        formHeader.payee_kind === 'staff_advance' &&
        !editingVoucher
      const linksToSave = isNewStaffAdvance ? [] : formLinks

      const saved = await saveVoucher(
        brandId,
        { ...header, id: editingVoucher?.id },
        formLines,
        linksToSave,
        currentUsername
      )

      if (isNewStaffAdvance && pendingStaffAdvance) {
        const amount = total > 0 ? total : pendingStaffAdvance.amount
        await attachStaffAdvanceDisbursementToVoucher({
          voucherId: saved.id,
          staffId: pendingStaffAdvance.staffId,
          brandId,
          amount,
          disbursedDate: formHeader.voucher_date || new Date().toISOString().split('T')[0],
          notes: pendingStaffAdvance.notes,
        })
      }

      setPendingStaffAdvance(null)
      closeModal()
      await refreshVoucherLists()
      void loadPayablesHub()
      void loadSupplierInvoicesList()
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : e && typeof e === 'object' && 'message' in e
            ? String((e as { message?: string }).message || 'Failed to save voucher')
            : 'Failed to save voucher'
      const hint =
        message.includes('payee_kind') || message.includes('staff_advance')
          ? ' Run migrations/gfc-staff-advances.sql on Supabase if this is a new install.'
          : ''
      setStatusBanner({ msg: `${message}${hint}`, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleRetryPost = async (v: AccountingVoucher) => {
    setUpdatingVoucherId(v.id)
    setStatusBanner(null)
    try {
      const { entryNumber } = await postJournalFromVoucher(v.id, currentUsername)
      setStatusBanner({ msg: `Journal posted: ${entryNumber}`, variant: 'success' })
      await refreshVoucherLists()
    } catch (e: unknown) {
      setStatusBanner({
        msg: e instanceof Error ? e.message : 'Journal post failed',
        variant: 'error',
      })
    } finally {
      setUpdatingVoucherId(null)
    }
  }

  const handleVoidVoucher = async (v: AccountingVoucher) => {
    if (v.journal_entry_id) {
      setStatusBanner({ msg: 'Cannot void: journal already posted.', variant: 'error' })
      return
    }
    if (!confirm(`Void ${v.voucher_number}?`)) return
    setUpdatingVoucherId(v.id)
    try {
      await updateVoucherStatus(v.id, 'cancelled')
      await refreshVoucherLists()
      void loadPayablesHub()
      void loadSupplierInvoicesList()
      setStatusBanner({ msg: `${v.voucher_number} voided.`, variant: 'info' })
    } catch (e: unknown) {
      setStatusBanner({
        msg: e instanceof Error ? e.message : 'Void failed',
        variant: 'error',
      })
    } finally {
      setUpdatingVoucherId(null)
    }
  }

  const openViewVoucher = async (v: AccountingVoucher) => {
    const full = await loadVoucherById(v.id)
    setViewVoucher(full || v)
  }

  const openViewVoucherById = async (voucherId: string) => {
    const full = await loadVoucherById(voucherId)
    if (full) setViewVoucher(full)
  }

  const handleStatus = async (
    v: AccountingVoucher,
    next: string,
    extraFields: Partial<AccountingVoucher> = {}
  ) => {
    if ((next === 'paid' || next === 'liquidated') && lineTotal(v.lines || []) <= 0) {
      setStatusBanner({ msg: 'Add line items with amounts before posting payment.', variant: 'error' })
      return
    }
    if (next === 'paid' && paymentVoucherMissingBankAccount(v)) {
      setStatusBanner({ msg: PAYMENT_VOUCHER_BANK_REQUIRED_MSG, variant: 'error' })
      return
    }
    const now = new Date().toISOString()
    const extra: Partial<AccountingVoucher> = {
      status: next as AccountingVoucher['status'],
      ...extraFields,
    }
    if (next === 'submitted') extra.submitted_at = now
    if (next === 'approved') {
      extra.approved_at = now
      extra.approved_by_name = v.approved_by_name || settings?.approved_by_name
      extra.approved_by_title = v.approved_by_title || settings?.approved_by_title
    }
    if (next === 'liquidated') extra.liquidated_at = now

    const previousPayment = paymentVouchers
    const previousPetty = pettyVouchers
    patchVoucherInLists(v.id, extra)
    setUpdatingVoucherId(v.id)
    try {
      await updateVoucherStatus(v.id, next, extra)
      if (next === 'paid' || next === 'liquidated') {
        try {
          const { entryNumber } = await postJournalFromVoucher(v.id, currentUsername)
          setStatusBanner({ msg: `Journal entry posted: ${entryNumber}`, variant: 'success' })
        } catch (postErr: unknown) {
          setStatusBanner({
            msg:
              postErr instanceof Error
                ? `Status saved but journal post failed: ${postErr.message}`
                : 'Status saved but journal post failed',
            variant: 'error',
          })
          await refreshPostingErrors()
        }
      }
      await refreshVoucherLists()
      await refreshPostingErrors()
      void loadPayablesHub()
      void loadSupplierInvoicesList()
    } catch (e: unknown) {
      setPaymentVouchers(previousPayment)
      setPettyVouchers(previousPetty)
      setStatusBanner({
        msg: e instanceof Error ? e.message : 'Status update failed',
        variant: 'error',
      })
    } finally {
      setUpdatingVoucherId(null)
    }
  }

  const handlePrint = (v: AccountingVoucher) => {
    if (!settings) return
    const lines = v.lines || []
    const ok =
      v.voucher_type === 'payment'
        ? openPaymentVoucherPrintWindow(v, lines, settings)
        : openPettyCashVoucherPrintWindow(v, lines, settings)
    if (!ok) alert('Allow pop-ups to print vouchers.')
  }

  const createFromTransaction = async (row: TransactionRow, type: AccountingVoucherType) => {
    if (row.voucherNumber) {
      if (!confirm(`A voucher ${row.voucherNumber} may already exist. Create another?`)) return
    }
    try {
      if (row.sourceType === 'po_payment' || row.sourceType === 'purchase_order') {
        alert(
          'Procurement payments require a matched supplier invoice.\n\nGo to Supplier Invoices, enter the supplier invoice, complete the 3-way match, then create the payment voucher from there.'
        )
        setSubTabPersist('supplier_invoices')
        if (row.sourceType === 'purchase_order') {
          setInitialPoForInvoice(row.sourceId)
          setEditingInvoice(null)
          setShowInvoiceModal(true)
        }
        return
      }
      if (
        row.sourceType === 'supplier_invoice_exception' ||
        row.sourceType === 'supplier_invoice_ready'
      ) {
        await resolvePayableInvoice(
          row.sourceId,
          row.sourceType === 'supplier_invoice_ready' ? 'create_pv' : 'resolve'
        )
        return
      }
      if (row.sourceType === 'intercompany_transfer') {
        const { data: transfer } = await supabase
          .from('intercompany_transfers')
          .select(
            '*, from_brand:brands!intercompany_transfers_from_brand_id_fkey(id, name), to_brand:brands!intercompany_transfers_to_brand_id_fkey(id, name)'
          )
          .eq('id', row.sourceId)
          .single()
        if (transfer) {
          openPrefillModal(buildPrefillFromIntercompanyTransfer(transfer))
        }
      } else if (row.sourceType === 'payroll_run_brand_total') {
        const { data: bt } = await supabase
          .from('payroll_run_brand_totals')
          .select(
            'id, net_pay, payroll_run:payroll_runs(week_start_date, week_end_date, created_by), brand:brands(name)'
          )
          .eq('id', row.sourceId)
          .single()
        if (bt) {
          const runRaw = bt.payroll_run as
            | { week_start_date: string; week_end_date: string; created_by?: string | null }
            | { week_start_date: string; week_end_date: string; created_by?: string | null }[]
            | null
          const run = Array.isArray(runRaw) ? runRaw[0] : runRaw
          openPrefillModal(
            buildPrefillFromPayrollBrandTotal({
              id: bt.id,
              week_start_date: run?.week_start_date || '',
              week_end_date: run?.week_end_date || '',
              brand_name: (bt.brand as { name?: string } | null)?.name || 'Brand',
              net_pay: Number(bt.net_pay) || 0,
              created_by: run?.created_by,
            })
          )
        }
      }
      goToVouchers(type)
    } catch {
      alert('Could not load transaction details.')
    }
  }

  const themeBtn =
    theme === 'green'
      ? 'bg-green-600 hover:bg-green-700'
      : theme === 'red'
        ? 'bg-red-600 hover:bg-red-700'
        : 'bg-blue-600 hover:bg-blue-700'

  const themePageActive =
    theme === 'green'
      ? 'bg-green-600'
      : theme === 'red'
        ? 'bg-red-600'
        : theme === 'yellow'
          ? 'bg-yellow-600'
          : 'bg-blue-600'

  const themeFilterActive = accountingThemePillActive(theme)

  const handleBackfill = async () => {
    if (!brandId) return
    if (!confirm('Post missing journals for the selected period? This is idempotent.')) return
    setBackfilling(true)
    try {
      const result = await backfillMissingJournals(brandId, periodFilter, currentUsername)
      setStatusBanner({
        msg: formatBackfillSummary(result),
        variant: result.errors.length ? 'error' : 'success',
      })
      await refreshVoucherLists()
    } catch (e: unknown) {
      setStatusBanner({
        msg: e instanceof Error ? e.message : 'Backfill failed',
        variant: 'error',
      })
    } finally {
      setBackfilling(false)
    }
  }

  const handleSaveSettings = async (s: AccountingVoucherSettings) => {
    await saveVoucherSettings(s)
    await loadSettings()
    setStatusBanner({ msg: 'Settings saved.', variant: 'success' })
    setSettingsModal(null)
    setSettingsModalFooter(null)
  }

  const exceptionInvoiceCount = useMemo(
    () => supplierInvoices.filter((i) => i.status === 'exception').length,
    [supplierInvoices]
  )

  const procurementPaymentDueCount = useMemo(
    () =>
      payables.filter((row) => !row.voucherNumber && isProcurementPaymentDueCategory(row.category))
        .length,
    [payables]
  )

  const filteredSupplierInvoices = useMemo(() => {
    if (invoiceListFilter === 'all') return supplierInvoices
    if (invoiceListFilter === 'matched') {
      return supplierInvoices.filter((i) => i.status === 'matched' || i.status === 'vouchered')
    }
    return supplierInvoices.filter((i) => i.status === invoiceListFilter)
  }, [supplierInvoices, invoiceListFilter])

  const paginatedSupplierInvoices = useMemo(
    () => paginateSlice(filteredSupplierInvoices, supplierInvoicesPage, ACCOUNTING_PAGE_SIZE),
    [filteredSupplierInvoices, supplierInvoicesPage]
  )

  useEffect(() => {
    setSupplierInvoicesPage(1)
  }, [invoiceListFilter])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredSupplierInvoices.length / ACCOUNTING_PAGE_SIZE))
    if (supplierInvoicesPage > totalPages) setSupplierInvoicesPage(totalPages)
  }, [filteredSupplierInvoices.length, supplierInvoicesPage])

  const openInvoiceModal = (invoice?: SupplierInvoice | null, poId?: string) => {
    setEditingInvoice(invoice || null)
    setInitialPoForInvoice(poId)
    setShowInvoiceModal(true)
  }

  const createVoucherFromInvoice = async (invoice: SupplierInvoice) => {
    const linked = invoiceVoucherById[invoice.id]
    if (linked) {
      await openViewVoucherById(linked.voucherId)
      return
    }
    if (invoice.payment_voucher_id) {
      await openViewVoucherById(invoice.payment_voucher_id)
      return
    }
    const existing = await findPrimaryVoucherForSource('supplier_invoice', invoice.id)
    if (existing) {
      setViewVoucher(existing)
      return
    }
    openVoucherFromMatchedInvoice(invoice.id)
  }

  const resolvePayableInvoice = async (invoiceId: string, action: 'resolve' | 'create_pv') => {
    if (action === 'create_pv') {
      const linked = invoiceVoucherById[invoiceId]
      if (linked) {
        await openViewVoucherById(linked.voucherId)
        return
      }
      const existing = await findPrimaryVoucherForSource('supplier_invoice', invoiceId)
      if (existing) {
        setViewVoucher(existing)
        return
      }
      openVoucherFromMatchedInvoice(invoiceId)
      return
    }
    const inv = await loadSupplierInvoiceById(invoiceId)
    if (!inv) {
      alert('Could not load invoice.')
      return
    }
    openInvoiceModal(inv)
    setSubTabPersist('supplier_invoices')
  }

  const activeVoucherType: AccountingVoucherType | null =
    subTab === 'vouchers' ? (voucherView === 'payment' ? 'payment' : 'petty_cash') : null

  const filteredVouchers = useMemo(() => {
    if (!activeVoucherType) return []
    const list = activeVoucherType === 'payment' ? paymentVouchers : pettyVouchers
    return [...list].sort((a, b) => {
      const dateCmp = (b.voucher_date || '').localeCompare(a.voucher_date || '')
      if (dateCmp !== 0) return dateCmp
      return (b.voucher_number || '').localeCompare(a.voucher_number || '')
    })
  }, [paymentVouchers, pettyVouchers, activeVoucherType])

  useEffect(() => {
    if (activeVoucherType) setVouchersPage(1)
  }, [activeVoucherType])

  const paginatedVouchers = useMemo(
    () => paginateSlice(filteredVouchers, vouchersPage, ACCOUNTING_PAGE_SIZE),
    [filteredVouchers, vouchersPage]
  )

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredVouchers.length / ACCOUNTING_PAGE_SIZE))
    if (vouchersPage > totalPages) setVouchersPage(totalPages)
  }, [filteredVouchers.length, vouchersPage])

  const subTabActiveClass =
    theme === 'green'
      ? 'border-green-500 text-green-600'
      : theme === 'red'
        ? 'border-red-500 text-red-600'
        : theme === 'yellow'
          ? 'border-yellow-500 text-yellow-600'
          : 'border-blue-500 text-blue-600'

  const subTabInactiveClass =
    'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'

  const allSubTabs: { id: AccountingSubTab; label: string }[] = [
    { id: 'receivables', label: 'Receivables' },
    { id: 'payables', label: 'Payables' },
    { id: 'supplier_invoices', label: 'Supplier Invoices' },
    { id: 'vouchers', label: 'Vouchers' },
    { id: 'journal', label: 'Journal' },
    { id: 'general_ledger', label: 'General Ledger' },
    { id: 'financial_reports', label: 'Financial Reports' },
    { id: 'reconciliation', label: 'Reconciliation' },
    { id: 'intercompany', label: 'Transfers' },
    { id: 'fixed_assets', label: 'Fixed Assets' },
  ]

  const subTabs = allSubTabs.filter(({ id }) => !isAccountingSubTabLocked(id))
  const activeSubTabLocked = isAccountingSubTabLocked(subTab)

  const openReplenishmentFromRecon = () => {
    const prefill = parseStoredPrefill(localStorage.getItem(ACCOUNTING_VOUCHER_PREFILL_KEY))
    if (prefill) {
      localStorage.removeItem(ACCOUNTING_VOUCHER_PREFILL_KEY)
      openPrefillModal(prefill)
      goToVouchers(prefill.voucherType)
    }
  }

  const renderVoucherListTab = (type: AccountingVoucherType) => {
    const isPayment = type === 'payment'
    return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {isPayment ? 'Payment vouchers' : 'Petty cash'}
          </h2>
          <p className="text-sm text-gray-600 mt-0.5">
            {isPayment
              ? 'Pay suppliers, staff advances, and reimbursements.'
              : 'Small cash advances, release, and liquidation.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <ModuleEditGate canEdit={canEdit}>
          <button
            type="button"
            onClick={() => setSettingsModal(isPayment ? 'payment_voucher' : 'petty_cash')}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
          {isPayment ? (
            <button
              type="button"
              onClick={() => openStaffAdvanceModal()}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              Staff advance
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => openNewVoucher(type)}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm text-white rounded-lg ${themeBtn}`}
          >
            <Plus className="h-4 w-4" />
            {isPayment ? 'New PV' : 'New PCV'}
          </button>
          </ModuleEditGate>
        </div>
      </div>
      {initialLoading ? (
        <AccountingTableSkeleton columnCount={7} />
      ) : filteredVouchers.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-200 rounded-lg">
          {isPayment
            ? 'No payment vouchers yet. Use New PV to create one.'
            : 'No petty cash vouchers yet. Use New PCV to create one.'}
        </p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Number</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Payee</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">Amount</th>
                <th className="text-center px-4 py-3 font-medium text-gray-700">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">JE #</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedVouchers.slice.map((v) => {
                const isPcv = v.voucher_type === 'petty_cash'
                const amt = isPcv
                  ? Number(v.amount_requested) || lineTotal(v.lines || [])
                  : lineTotal(v.lines || [])
                const jeNum = jeNumberByVoucherId[v.id]
                const needsRetry =
                  (v.status === 'paid' || v.status === 'liquidated') && !v.journal_entry_id && !jeNum
                return (
                  <tr
                    key={v.id}
                    className={`hover:bg-gray-50 ${updatingVoucherId === v.id ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{v.voucher_number}</td>
                    <td className="px-4 py-3 text-gray-700">{v.voucher_date}</td>
                    <td className="px-4 py-3 text-gray-700 group">
                      <PayeeHoverCell
                        label={v.payee_name || '—'}
                        branchName={voucherPayeeBranchById[v.id]}
                      />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                      ₱{amt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${statusBadgeClass(v.status)}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-700">
                      {jeNum ? (
                        <button
                          type="button"
                          className="text-blue-600 hover:underline"
                          onClick={() => v.journal_entry_id && setViewJeId(v.journal_entry_id)}
                        >
                          {jeNum}
                        </button>
                      ) : needsRetry ? (
                        <span className="text-amber-700">Missing</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5 flex-wrap items-center">
                        {updatingVoucherId === v.id && (
                          <span className="text-[10px] text-gray-500">Updating…</span>
                        )}
                        {v.status !== 'draft' && (
                          <button
                            type="button"
                            onClick={() => void openViewVoucher(v)}
                            disabled={updatingVoucherId === v.id}
                            className="text-xs px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                          >
                            View
                          </button>
                        )}
                        {canEdit && needsRetry && (
                          <button
                            type="button"
                            onClick={() => void handleRetryPost(v)}
                            disabled={updatingVoucherId === v.id}
                            className="text-xs px-2 py-1 bg-amber-100 rounded disabled:opacity-50"
                          >
                            Retry post
                          </button>
                        )}
                        {canEdit && (v.status === 'draft' || v.status === 'submitted') && (
                          <button
                            type="button"
                            onClick={() => void handleVoidVoucher(v)}
                            disabled={updatingVoucherId === v.id}
                            className="text-xs px-2 py-1 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
                          >
                            Void
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handlePrint(v)}
                          disabled={updatingVoucherId === v.id}
                          className="text-xs px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                          title="Print"
                        >
                          <Printer className="h-3.5 w-3.5 inline" />
                        </button>
                        {canEdit && v.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => openEditVoucher(v)}
                            disabled={updatingVoucherId === v.id}
                            className="text-xs px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                          >
                            Edit
                          </button>
                        )}
                        {canEdit && v.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => handleStatus(v, 'submitted')}
                            disabled={updatingVoucherId === v.id}
                            className="text-xs px-2 py-1 bg-yellow-100 rounded disabled:opacity-50"
                          >
                            Submit
                          </button>
                        )}
                        {canEdit && v.status === 'submitted' && (
                          <button
                            type="button"
                            onClick={() => handleStatus(v, 'approved')}
                            disabled={updatingVoucherId === v.id}
                            className="text-xs px-2 py-1 bg-blue-100 rounded disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                        {canEdit && !isPcv && v.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => openMarkPaidModal(v)}
                            disabled={updatingVoucherId === v.id}
                            className="text-xs px-2 py-1 bg-green-100 rounded disabled:opacity-50"
                          >
                            Paid
                          </button>
                        )}
                        {canEdit && isPcv && v.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleStatus(v, 'released')}
                            disabled={updatingVoucherId === v.id}
                            className="text-xs px-2 py-1 bg-purple-100 rounded disabled:opacity-50"
                          >
                            Released
                          </button>
                        )}
                        {canEdit && isPcv && v.status === 'released' && (
                          <button
                            type="button"
                            onClick={() => handleStatus(v, 'liquidated')}
                            disabled={updatingVoucherId === v.id}
                            className="text-xs px-2 py-1 bg-green-100 rounded disabled:opacity-50"
                          >
                            Liquidate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <AccountingTablePagination
            page={vouchersPage}
            totalItems={filteredVouchers.length}
            pageSize={ACCOUNTING_PAGE_SIZE}
            itemLabel="vouchers"
            activePageClass={themePageActive}
            onPageChange={setVouchersPage}
          />
        </div>
      )}
    </div>
    )
  }

  if (!selectedBrand) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Accounting</h1>
          <p className="text-sm text-gray-600">
            Financial transactions and reporting. Filter by franchise to review performance.
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <p className="text-gray-500 text-center py-8">Please select a brand to use Accounting.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!canEdit ? <ModuleReadOnlyBanner message={getModuleReadOnlyBanner('accounting')} /> : null}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Accounting</h1>
          <p className="text-sm text-gray-600">
            Financial transactions and reporting. Filter by franchise to review performance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {isGfcMain ? (
            <FranchisePerformanceFilter
              brands={brands}
              value={franchiseFilter}
              onChange={setFranchiseFilter}
            />
          ) : null}
          <ModuleEditGate canEdit={canEdit}>
            <button
              type="button"
              onClick={() => setShowChartOfAccountsModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 shrink-0"
            >
              <BookOpen className="h-4 w-4" />
              Chart of Accounts
            </button>
          </ModuleEditGate>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <nav
          className="flex flex-wrap -mb-px border-b border-gray-200 px-1 sm:px-2"
          aria-label="Accounting sections"
        >
            {subTabs.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSubTabPersist(id)}
                className={`px-3 sm:px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap shrink-0 transition-colors ${
                  subTab === id ? subTabActiveClass : subTabInactiveClass
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {label}
                  {bypassAccessLocks && isSubTabLocked(accessLocks, 'accounting', id) && (
                    <span
                      className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
                      title="Locked for other roles — visible to developers only"
                    >
                      Locked
                    </span>
                  )}
                  {id === 'payables' && procurementPaymentDueCount > 0 && (
                    <span className="inline-flex min-w-[1.25rem] h-5 px-1.5 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold">
                      {procurementPaymentDueCount}
                    </span>
                  )}
                </span>
              </button>
            ))}
        </nav>

        {activeSubTabLocked ? (
          <ModuleLockedNotice
            title={getSubTabLabel('accounting', subTab)}
            reason={getLockReason(accessLocks, 'accounting', subTab)}
          />
        ) : (
          <>
        {(subTab === 'receivables' ||
          subTab === 'payables' ||
          subTab === 'journal' ||
          subTab === 'general_ledger' ||
          subTab === 'financial_reports') && (
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <AccountingPeriodFilter
              value={periodFilter}
              onChange={(next) => {
                setPeriodFilter(next)
              }}
              theme={theme}
            />
            {subTab === 'journal' && (
              <ModuleEditGate canEdit={canEdit}>
              <button
                type="button"
                onClick={() => setSettingsModal('journal')}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 shrink-0"
              >
                <Settings className="h-4 w-4" />
                Journal settings
              </button>
              </ModuleEditGate>
            )}
          </div>
        )}

        <div className="p-4 sm:p-6 space-y-4">
          {postingErrorCount > 0 && (
            <div className="space-y-2">
              <AccountingStatusBanner
                message={`${postingErrorCount} journal posting error${postingErrorCount === 1 ? '' : 's'} need attention.`}
                variant="warning"
              />
              <div className="flex flex-wrap items-center gap-2 px-1">
                <ModuleEditGate canEdit={canEdit}>
                <button
                  type="button"
                  disabled={retryingPosting}
                  onClick={async () => {
                    if (!brandId) return
                    setRetryingPosting(true)
                    try {
                      const result = await retryUnresolvedPostingErrors(brandId, currentUsername)
                      await refreshPostingErrors()
                      await refreshVoucherLists()
                      setStatusBanner({
                        msg:
                          result.failed > 0
                            ? `Retry: ${result.succeeded} succeeded, ${result.failed} failed. ${result.errors.slice(0, 2).join('; ')}`
                            : `Retry complete: ${result.succeeded} posting${result.succeeded === 1 ? '' : 's'} resolved.`,
                        variant: result.failed > 0 ? 'error' : 'success',
                      })
                    } catch (e: unknown) {
                      setStatusBanner({
                        msg: e instanceof Error ? e.message : 'Retry failed',
                        variant: 'error',
                      })
                    } finally {
                      setRetryingPosting(false)
                    }
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200 disabled:opacity-50"
                >
                  {retryingPosting ? 'Retrying…' : 'Retry all'}
                </button>
                </ModuleEditGate>
                <button
                  type="button"
                  className="text-xs text-amber-800 underline"
                  onClick={() => setShowPostingErrors((v) => !v)}
                >
                  {showPostingErrors ? 'Hide details' : 'Show details'}
                </button>
              </div>
              {showPostingErrors && postingErrors.length > 0 && (
                <ul className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
                  {postingErrors.map((err) => (
                    <li key={err.id}>
                      <span className="font-medium">{err.source_type.replace(/_/g, ' ')}</span>
                      {' · '}
                      {err.error_message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <AccountingStatusBanner
            message={statusBanner?.msg ?? null}
            variant={statusBanner?.variant}
            onDismiss={() => setStatusBanner(null)}
          />
          {subTab === 'receivables' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Receivables</h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  Customer order accounts receivable.
                </p>
              </div>
              <BillingManager
                selectedBrand={selectedBrand}
                theme={theme}
                embeddedInAccounting
                timeFilter={periodFilter}
                onTimeFilterChange={setPeriodFilter}
                currentUsername={currentUsername}
                readOnlyMode={readOnlyMode}
                companyWideOrders={franchiseFilter === 'all' || franchiseFilter === 'hq'}
                franchiseBrandId={
                  franchiseFilter !== 'all' && franchiseFilter !== 'hq' ? franchiseFilter : null
                }
              />
            </div>
          )}

          {subTab === 'payables' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Payables</h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  Bills to pay — purchases waiting on an invoice, plus payroll. Period:{' '}
                  <span className="font-medium text-gray-800">
                    {getPhilippinesBillingPeriodLabel(periodFilter)}
                  </span>
                </p>
              </div>
              <AccountingPayables
                payables={payables}
                loading={initialLoading}
                periodFilter={periodFilter}
                readOnlyMode={readOnlyMode}
                hideHeaderDescription
                onEnterInvoice={(poId) => openInvoiceModal(null, poId)}
                onResolveException={(invoiceId) => void resolvePayableInvoice(invoiceId, 'resolve')}
                onCreatePvFromInvoice={(invoiceId) => void resolvePayableInvoice(invoiceId, 'create_pv')}
                onViewInvoice={(invoiceId) => setViewInvoiceId(invoiceId)}
                onViewVoucher={(voucherId) => void openViewVoucherById(voucherId)}
                onPayPayroll={(row) => void createFromTransaction(row, 'payment')}
                onGoToSupplierInvoices={() => setSubTabPersist('supplier_invoices')}
              />
            </div>
          )}

          {subTab === 'supplier_invoices' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Supplier Invoices</h2>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Record supplier bills and match them to the purchase order and delivery before paying.
                  </p>
                </div>
                <ModuleEditGate canEdit={canEdit}>
                <button
                  type="button"
                  onClick={() => openInvoiceModal()}
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm text-white rounded-lg ${themeBtn}`}
                >
                  <Plus className="h-4 w-4" />
                  Enter Invoice
                </button>
                </ModuleEditGate>
              </div>

              {exceptionInvoiceCount > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span>
                    <strong>{exceptionInvoiceCount}</strong>{' '}
                    {exceptionInvoiceCount === 1 ? 'invoice has' : 'invoices have'} match exceptions — resolve
                    variances before creating payment vouchers.
                  </span>
                  <button
                    type="button"
                    onClick={() => setInvoiceListFilter('exception')}
                    className="text-xs px-2.5 py-1 border border-red-300 rounded-md hover:bg-red-100 shrink-0"
                  >
                    Show exceptions
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['all', 'All'],
                    ['exception', 'Exceptions'],
                    ['matched', 'Matched'],
                    ['paid', 'Paid'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setInvoiceListFilter(id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      invoiceListFilter === id
                        ? themeFilterActive
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                    }`}
                  >
                    {label}
                    {id === 'exception' && exceptionInvoiceCount > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px]">
                        {exceptionInvoiceCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {initialLoading ? (
                <AccountingTableSkeleton columnCount={8} lastColumnActions />
              ) : filteredSupplierInvoices.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-200 rounded-lg">
                  {invoiceListFilter === 'all'
                    ? 'No supplier invoices yet. Enter an invoice against a PO with received goods.'
                    : `No ${invoiceListFilter} invoices in this filter.`}
                </p>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm min-w-[920px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Invoice #</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">PO</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Receiving report</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Supplier</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-700">Amount</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Date</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedSupplierInvoices.slice.map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number}</td>
                          <td className="px-4 py-3">
                            {inv.po_id && inv.purchase_order?.po_number ? (
                              <button
                                type="button"
                                onClick={() => setViewPoId(inv.po_id)}
                                className={accountingDocLinkClass}
                              >
                                {formatPoLabel(inv.purchase_order.po_number)}
                              </button>
                            ) : (
                              <span className="text-gray-700">
                                {inv.purchase_order?.po_number || '—'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const dr = inv.po_id ? deliveryReceiptByPoId[inv.po_id] : undefined
                              if (!dr) return <span className="text-gray-400">—</span>
                              return (
                                <button
                                  type="button"
                                  onClick={() => setViewReceiptId(dr.id)}
                                  className={accountingDocLinkClass}
                                >
                                  {dr.receipt_number}
                                </button>
                              )
                            })()}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {inv.supplier?.name || '—'}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            ₱{Number(inv.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{inv.invoice_date || '—'}</td>
                          <td className="px-4 py-3">
                            <SupplierInvoiceStatusBadge status={inv.status} />
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {(() => {
                              const linkedVoucher = invoiceVoucherById[inv.id]
                              const hasLinkedPv =
                                !!linkedVoucher ||
                                inv.status === 'vouchered' ||
                                inv.status === 'paid'

                              if (inv.status === 'exception') {
                                return canEdit ? (
                                  <button
                                    type="button"
                                    onClick={() => openInvoiceModal(inv)}
                                    className="text-xs px-2.5 py-1 border border-red-300 text-red-700 rounded-md hover:bg-red-50"
                                  >
                                    Resolve
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setViewInvoiceId(inv.id)}
                                    className="text-xs px-2.5 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                                  >
                                    View
                                  </button>
                                )
                              }

                              if (hasLinkedPv) {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setViewInvoiceId(inv.id)}
                                    className="text-xs px-2.5 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                                  >
                                    View
                                  </button>
                                )
                              }

                              if (inv.status === 'draft' || inv.status === 'matched') {
                                return (
                                  <>
                                    {canEdit ? (
                                    <button
                                      type="button"
                                      onClick={() => openInvoiceModal(inv)}
                                      className="text-xs px-2.5 py-1 mr-1 border border-gray-300 rounded-md hover:bg-gray-50"
                                    >
                                      Edit
                                    </button>
                                    ) : null}
                                    {canEdit && inv.status === 'matched' && (
                                      <button
                                        type="button"
                                        onClick={() => void createVoucherFromInvoice(inv)}
                                        className="text-xs px-2.5 py-1 border border-green-600 text-green-700 rounded-md hover:bg-green-50"
                                      >
                                        Create PV
                                      </button>
                                    )}
                                    {!canEdit ? (
                                      <button
                                        type="button"
                                        onClick={() => setViewInvoiceId(inv.id)}
                                        className="text-xs px-2.5 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                                      >
                                        View
                                      </button>
                                    ) : null}
                                  </>
                                )
                              }

                              return (
                                <button
                                  type="button"
                                  onClick={() => setViewInvoiceId(inv.id)}
                                  className="text-xs px-2.5 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                  View
                                </button>
                              )
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <AccountingTablePagination
                    page={supplierInvoicesPage}
                    totalItems={filteredSupplierInvoices.length}
                    pageSize={ACCOUNTING_PAGE_SIZE}
                    itemLabel="invoices"
                    activePageClass={themePageActive}
                    onPageChange={setSupplierInvoicesPage}
                  />
                </div>
              )}
            </div>
          )}

          {subTab === 'vouchers' && (
            <div className="space-y-4">
              <nav className="flex gap-1 border-b border-gray-200">
                {(
                  [
                    ['payment', 'Payment vouchers', CreditCard],
                    ['petty_cash', 'Petty cash', Coins],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setVoucherViewPersist(id)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      voucherView === id ? subTabActiveClass : subTabInactiveClass
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </button>
                ))}
              </nav>
              {renderVoucherListTab(voucherView === 'payment' ? 'payment' : 'petty_cash')}
            </div>
          )}

          {subTab === 'journal' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Journal</h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  Review posted entries and add manual adjustments when needed.
                </p>
              </div>
              <AccountingManualJournal
                selectedBrand={selectedBrand}
                currentUsername={currentUsername}
                readOnlyMode={readOnlyMode}
                onPosted={() => {
                  setJournalListRefreshToken((n) => n + 1)
                  setStatusBanner({ msg: 'Manual journal posted.', variant: 'success' })
                }}
                onOpenJournalEntry={(id) => setViewJeId(id)}
              />
              <AccountingJournal
                selectedBrand={selectedBrand}
                timeFilter={periodFilter}
                currentUsername={currentUsername}
                themeBtn={themeBtn}
                refreshToken={journalListRefreshToken}
                onOpenJournalEntry={(id) => setViewJeId(id)}
                franchiseBrandId={franchiseJournalOpts.franchiseBrandId}
                hqOnly={franchiseJournalOpts.hqOnly}
              />
            </div>
          )}
          {subTab === 'general_ledger' && (
            <AccountingGeneralLedger
              selectedBrand={selectedBrand}
              timeFilter={periodFilter}
              themeBtn={themeBtn}
              onOpenJournalEntry={(id) => setViewJeId(id)}
            />
          )}
          {subTab === 'financial_reports' && (
            <AccountingReports
              selectedBrand={selectedBrand}
              timeFilter={periodFilter}
              theme={theme}
              currentUsername={currentUsername}
              currentRoleLabel={currentRoleLabel}
              onOpenJournalEntry={(id) => setViewJeId(id)}
            />
          )}
          {subTab === 'reconciliation' && (
            <AccountingReconciliation
              selectedBrand={selectedBrand}
              settings={settings}
              currentUsername={currentUsername}
              readOnlyMode={readOnlyMode}
              onOpenReplenishmentPv={openReplenishmentFromRecon}
              onOpenJournalEntry={(id) => setViewJeId(id)}
            />
          )}
          {subTab === 'intercompany' && selectedBrand && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Transfers</h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  Move finished goods or raw materials between brands and locations.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {(
                  [
                    ['finished_goods', 'Finished products', Truck, 'Send finished goods to other brands'],
                    ['materials', 'Raw materials', Package, 'Move factory materials between locations'],
                  ] as const
                ).map(([id, label, Icon, hint]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTransferView(id)}
                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                      transferView === id
                        ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          transferView === id ? 'text-blue-700' : 'text-gray-500'
                        }`}
                      />
                      <p
                        className={`text-sm font-semibold ${
                          transferView === id ? 'text-blue-800' : 'text-gray-900'
                        }`}
                      >
                        {label}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-6">{hint}</p>
                  </button>
                ))}
              </div>
              {transferView === 'finished_goods' ? (
                <IntercompanyTransfersPanel
                  selectedBrand={selectedBrand}
                  brands={brands}
                  currentUsername={currentUsername}
                  theme={theme}
                  productScope="finished_goods"
                  readOnly
                  embedded
                />
              ) : (
                <MaterialTransfersPanel
                  selectedBrand={selectedBrand}
                  brands={brands}
                  currentUsername={currentUsername}
                  theme={theme}
                  readOnly
                  embedded
                />
              )}
            </div>
          )}
          {subTab === 'fixed_assets' && selectedBrand && (
            <FixedAssetsPanel
              selectedBrand={selectedBrand}
              suppliers={suppliers}
              theme={theme}
              createdBy={currentUsername.trim() || 'Accounting'}
              readOnlyMode={readOnlyMode}
            />
          )}
        </div>
          </>
        )}
      </div>

      {viewVoucher && (
        <VoucherViewModal
          voucher={viewVoucher}
          brandId={brandId}
          themeBtn={themeBtn}
          jeNumber={viewVoucher.journal_entry_id ? jeNumberByVoucherId[viewVoucher.id] : undefined}
          onClose={() => {
            setViewVoucher(null)
            setViewJeId(null)
          }}
          onPrint={() => handlePrint(viewVoucher)}
          onOpenJe={() => viewVoucher.journal_entry_id && setViewJeId(viewVoucher.journal_entry_id)}
        />
      )}

      {markPaidVoucher && brandId && (
        <MarkPaymentVoucherPaidModal
          voucher={markPaidVoucher}
          brandId={brandId}
          themeBtn={themeBtn}
          onClose={() => setMarkPaidVoucher(null)}
          onConfirm={async (proofUrl) => {
            const v = markPaidVoucher
            setMarkPaidVoucher(null)
            await handleStatus(v, 'paid', { proof_of_payment_url: proofUrl })
          }}
        />
      )}

      {viewInvoiceId && (
        <SupplierInvoiceViewModal
          invoiceId={viewInvoiceId}
          onClose={() => setViewInvoiceId(null)}
        />
      )}

      {viewPoId && (
        <PurchaseOrderViewModal poId={viewPoId} onClose={() => setViewPoId(null)} />
      )}

      {viewReceiptId && (
        <ReceivingReportViewModal
          receiptId={viewReceiptId}
          onClose={() => setViewReceiptId(null)}
        />
      )}

      {viewJeId && (
        <AccountingJournalEntryPanel
          entryId={viewJeId}
          currentUsername={currentUsername}
          brandId={brandId}
          themeBtn={themeBtn}
          readOnlyMode={readOnlyMode}
          onOpenJournalEntry={(id) => setViewJeId(id)}
          onReversed={() => {
            setJournalListRefreshToken((n) => n + 1)
            void refreshVoucherLists()
            setStatusBanner({ msg: 'Journal reversed.', variant: 'success' })
          }}
          onClose={() => setViewJeId(null)}
        />
      )}

      {modalType && (
        <VoucherFormModal
          type={modalType}
          header={formHeader}
          lines={formLines}
          links={formLinks}
          brandId={brandId}
          themeBtn={themeBtn}
          expenseAccounts={expenseAccounts}
          allAccounts={allAccounts}
          defaultLineDebitAccountId={
            settings && allAccounts.length
              ? resolveVoucherLineDefaultAccountId({
                  sourceType: voucherPrefillContext?.sourceType || 'supplier',
                  line: { line_no: 1, description: '', amount: 0 },
                  lineIndex: formLines.length,
                  poItems: voucherPrefillContext?.poItems,
                  settings,
                  accounts: allAccounts,
                })
              : null
          }
          onHeaderChange={setFormHeader}
          onLinesChange={setFormLines}
          onClose={closeModal}
          onSave={handleSaveVoucher}
          saving={saving}
          prefillLoading={voucherPrefillLoading}
          isEdit={!!editingVoucher}
          settings={settings}
        />
      )}

      {showChartOfAccountsModal && (
        <AccountingSettingsModal
          title="Chart of Accounts"
          description={`Manage GL accounts for ${selectedBrand.name}`}
          onClose={() => setShowChartOfAccountsModal(false)}
          size="xl"
          zIndex={50}
        >
          <AccountingChartOfAccounts
            embedded
            selectedBrand={selectedBrand}
            onOpenDefaultAccounts={() => setSettingsModal('coa')}
          />
        </AccountingSettingsModal>
      )}

      {settingsModal && settings && (
        <AccountingSettingsModal
          zIndex={showChartOfAccountsModal && settingsModal === 'coa' ? 60 : 50}
          title={
            settingsModal === 'journal'
              ? 'Journal settings'
              : settingsModal === 'coa'
                ? 'Default accounts'
                : settingsModal === 'payment_voucher'
                  ? 'Payment voucher settings'
                  : 'Petty cash settings'
          }
          description={
            settingsModal === 'journal'
              ? 'Setup, opening balances, and backfill.'
              : settingsModal === 'coa'
                ? 'Accounts used when the system posts journals.'
                : settingsModal === 'payment_voucher'
                  ? 'Company details and PV print signatories.'
                  : 'Company details, PCV signatories, and petty cash fund.'
          }
          onClose={() => {
            setSettingsModal(null)
            setSettingsModalFooter(null)
          }}
          size={
            settingsModal === 'journal'
              ? 'lg'
              : settingsModal === 'coa'
                ? 'lg'
                : settingsModal === 'payment_voucher' || settingsModal === 'petty_cash'
                  ? 'sm'
                  : 'md'
          }
          scrollBody={settingsModal !== 'coa'}
          footer={settingsModalFooter}
        >
          <VoucherSettingsForm
            section={settingsModal}
            settings={settings}
            accounts={allAccounts}
            selectedBrand={selectedBrand}
            currentUsername={currentUsername}
            themeBtn={themeBtn}
            backfilling={backfilling}
            onOpenJournalEntry={(id) => setViewJeId(id)}
            onOpenDefaultAccounts={() => setSettingsModal('coa')}
            onNavigateUnposted={handleGoLiveUnpostedNav}
            onBackfill={handleBackfill}
            onSave={handleSaveSettings}
            onFooterChange={setSettingsModalFooter}
          />
        </AccountingSettingsModal>
      )}

      {showStaffAdvanceModal && (
        <AccountingSettingsModal
          title="Staff cash advance"
          description="Opens a payment voucher for the advance. Mark the PV paid to post to Staff Advances (1150); payroll recovery applies after payment."
          onClose={() => setShowStaffAdvanceModal(false)}
          size="sm"
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowStaffAdvanceModal(false)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  loadingStaffAdvanceOptions ||
                  !staffAdvanceStaffId ||
                  staffAdvanceOptions.length === 0 ||
                  !(Number(staffAdvanceAmount) > 0)
                }
                onClick={handleOpenStaffAdvanceVoucher}
                className={`px-3 py-1.5 text-sm rounded-md text-white disabled:opacity-50 ${themeBtn}`}
              >
                Open payment voucher
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Staff member</label>
              <select
                className="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-50"
                value={staffAdvanceStaffId}
                onChange={(e) => setStaffAdvanceStaffId(e.target.value)}
                disabled={loadingStaffAdvanceOptions || staffAdvanceOptions.length === 0}
              >
                <option value="">
                  {loadingStaffAdvanceOptions
                    ? 'Loading staff…'
                    : staffAdvanceOptions.length === 0
                      ? 'No staff on company-owned locations for this brand'
                      : 'Select staff…'}
                </option>
                {staffAdvanceOptions.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
              <input
                type="number"
                min="1"
                step="1"
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={staffAdvanceAmount}
                onChange={(e) => setStaffAdvanceAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={staffAdvanceNotes}
                onChange={(e) => setStaffAdvanceNotes(e.target.value)}
              />
            </div>
          </div>
        </AccountingSettingsModal>
      )}

      {showInvoiceModal && brandId && (
        <SupplierInvoiceModal
          brandId={brandId}
          invoice={editingInvoice}
          initialPoId={initialPoForInvoice}
          themeBtn={themeBtn}
          onClose={() => {
            setShowInvoiceModal(false)
            setEditingInvoice(null)
            setInitialPoForInvoice(undefined)
          }}
          onSaved={(inv) => {
            void loadSupplierInvoicesList()
            void loadPayablesHub()
            setEditingInvoice(inv)
          }}
          onCreateVoucher={(inv) => void createVoucherFromInvoice(inv)}
          onGoToProcurement={
            onGoToProcurement
              ? (poId) => {
                  setShowInvoiceModal(false)
                  onGoToProcurement(poId)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}

const DEFAULT_ACCOUNT_KEYS = DEFAULT_ACCOUNT_FIELDS

function AccountingSettingsModal({
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
  scrollBody = true,
  zIndex = 50,
}: {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  scrollBody?: boolean
  zIndex?: number
}) {
  const widthClass =
    size === 'sm'
      ? 'max-w-sm'
      : size === 'lg'
        ? 'max-w-3xl'
        : size === 'xl'
          ? 'max-w-5xl'
          : 'max-w-xl'
  return (
    <Modal onClose={onClose} align="center" zIndex={zIndex} contentClassName="p-4 sm:p-6">
      <div
        className={`bg-white rounded-xl shadow-xl overflow-hidden ${widthClass} w-full flex flex-col ${
          scrollBody ? 'max-h-[92vh]' : ''
        }`}
      >
        <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-start gap-3 shrink-0 bg-gray-50/80">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {description && <p className="text-sm text-gray-600 mt-0.5">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-200/80"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div
          className={`p-4 min-h-0 ${
            scrollBody ? 'flex-1 overflow-y-auto overflow-x-hidden' : 'shrink-0 overflow-visible'
          }`}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 p-4 border-t flex justify-end bg-white rounded-b-lg">{footer}</div>
        )}
      </div>
    </Modal>
  )
}

const PAYMENT_VOUCHER_SETTING_KEYS = [
  { key: 'company_name' as const, label: 'Company name' },
  { key: 'company_address' as const, label: 'Address' },
  { key: 'approved_by_name' as const, label: 'PV approved by' },
  { key: 'approved_by_title' as const, label: 'PV approver title' },
]

const PETTY_CASH_SETTING_KEYS = [
  { key: 'company_name' as const, label: 'Company name' },
  { key: 'company_address' as const, label: 'Address' },
  { key: 'petty_cash_custodian_name' as const, label: 'PCV custodian' },
  { key: 'petty_cash_custodian_title' as const, label: 'PCV custodian title' },
  { key: 'liquidated_by_name' as const, label: 'Liquidated by' },
  { key: 'liquidated_by_title' as const, label: 'Liquidator title' },
  { key: 'petty_cash_fund_amount' as const, label: 'Petty cash fund (₱)' },
]

function VoucherSettingsForm({
  section,
  settings,
  accounts,
  selectedBrand,
  currentUsername,
  themeBtn,
  backfilling,
  onBackfill,
  onSave,
  onOpenJournalEntry,
  onOpenDefaultAccounts,
  onNavigateUnposted,
  onFooterChange,
}: {
  section: SettingsModalSection
  settings: AccountingVoucherSettings
  accounts: AccountingAccount[]
  selectedBrand: Brand | null
  currentUsername: string
  themeBtn: string
  backfilling: boolean
  onBackfill: () => Promise<void>
  onSave: (s: AccountingVoucherSettings) => Promise<void>
  onOpenJournalEntry?: (entryId: string) => void
  onOpenDefaultAccounts?: () => void
  onNavigateUnposted?: (target: GoLiveUnpostedTarget) => void
  onFooterChange?: (footer: ReactNode | null) => void
}) {
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  useEffect(() => setForm(settings), [settings])

  const saveForm = async () => {
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!onFooterChange) return
    if (section === 'journal') {
      onFooterChange(null)
      return
    }
    onFooterChange(
      <button
        type="button"
        disabled={saving}
        onClick={() => void saveForm()}
        className={`px-4 py-2 text-white rounded-lg text-sm disabled:opacity-50 ${themeBtn}`}
      >
        {saving ? 'Saving…' : 'Save settings'}
      </button>
    )
  }, [section, saving, themeBtn, onFooterChange, form])

  if (section === 'journal') {
    return (
      <div className="space-y-3">
        <AccountingGoLiveChecklist
          selectedBrand={selectedBrand}
          onOpenDefaultAccounts={onOpenDefaultAccounts}
          onNavigateUnposted={onNavigateUnposted}
        />
        <div id="accounting-historical-backfill" className="rounded-lg border border-gray-200 p-3 space-y-3">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Backfill</h3>
            <p className="text-xs text-gray-600 mt-0.5">
              Post missing journals for vouchers, orders, payroll, and other activity in the
              current period.
            </p>
          </div>
          <button
            type="button"
            disabled={backfilling}
            onClick={() => void onBackfill()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {backfilling ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Running backfill…
              </>
            ) : (
              'Run backfill'
            )}
          </button>
        </div>
        <AccountingOpeningBalances
          selectedBrand={selectedBrand}
          currentUsername={currentUsername}
          onOpenJournalEntry={onOpenJournalEntry}
        />
        <AccountingFiscalPeriodSettings
          selectedBrand={selectedBrand}
          currentUsername={currentUsername}
          onOpenJournalEntry={onOpenJournalEntry}
        />
      </div>
    )
  }

  if (section === 'coa') {
    return (
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3 min-w-0">
        {DEFAULT_ACCOUNT_KEYS.map(({ key, label, usage, side }, index) => {
          const rightCol = index % 2 === 1
          return (
            <div key={key} className="min-w-0">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-0.5 min-w-0">
                <span className="truncate">{label}</span>
                <span
                  className={`shrink-0 rounded px-1 py-px text-[10px] font-semibold uppercase tracking-wide ${
                    side === 'debit'
                      ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200'
                      : side === 'credit'
                        ? 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200'
                        : 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200'
                  }`}
                >
                  {side === 'both' ? 'Dr / Cr' : side === 'debit' ? 'Debit' : 'Credit'}
                </span>
                <span className="relative group inline-flex shrink-0">
                  <Info
                    className="h-3.5 w-3.5 text-gray-400 cursor-help"
                    aria-label={usage}
                  />
                  <span
                    role="tooltip"
                    className={`pointer-events-none absolute top-full z-30 mt-1.5 w-52 max-w-[min(13rem,calc(100vw-2rem))] rounded-md bg-gray-900 px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${
                      rightCol ? 'right-0' : 'left-0'
                    }`}
                  >
                    {usage}
                  </span>
                </span>
              </label>
              <select
                className="w-full max-w-full min-w-0 border rounded px-2 py-1.5 text-sm"
                value={(form[key] as string) || ''}
                onChange={(e) => setForm({ ...form, [key]: e.target.value || null })}
              >
                <option value="">— Select —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} {a.name}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    )
  }

  const fieldKeys =
    section === 'payment_voucher' ? PAYMENT_VOUCHER_SETTING_KEYS : PETTY_CASH_SETTING_KEYS

  return (
    <div className="space-y-4">
      {fieldKeys.map(({ key, label }) => (
        <div key={key}>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">{label}</label>
          <input
            className="w-full border rounded px-2 py-1.5 text-sm"
            type={key === 'petty_cash_fund_amount' ? 'number' : 'text'}
            value={form[key] ?? (key === 'petty_cash_fund_amount' ? 5000 : '')}
            onChange={(e) =>
              setForm({
                ...form,
                [key]:
                  key === 'petty_cash_fund_amount'
                    ? parseFloat(e.target.value) || 0
                    : e.target.value,
              })
            }
          />
        </div>
      ))}
    </div>
  )
}

function VoucherFormModal({
  type,
  header,
  lines,
  links,
  brandId,
  themeBtn,
  expenseAccounts,
  allAccounts,
  defaultLineDebitAccountId,
  onHeaderChange,
  onLinesChange,
  onClose,
  onSave,
  saving,
  prefillLoading = false,
  isEdit,
  settings,
}: {
  type: AccountingVoucherType
  header: Partial<AccountingVoucher>
  lines: AccountingVoucherLine[]
  links: AccountingVoucherLink[]
  brandId?: string
  themeBtn?: string
  expenseAccounts: AccountingAccount[]
  allAccounts: AccountingAccount[]
  defaultLineDebitAccountId?: string | null
  onHeaderChange: (h: Partial<AccountingVoucher>) => void
  onLinesChange: (l: AccountingVoucherLine[]) => void
  onClose: () => void
  onSave: () => void
  saving: boolean
  prefillLoading?: boolean
  isEdit: boolean
  settings: AccountingVoucherSettings | null
}) {
  const total = lineTotal(lines)
  const isPayment = type === 'payment'
  const [bankAccounts, setBankAccounts] = useState<{ id: string; name: string }[]>([])

  const lineDebitAccountOptions = (() => {
    const byId = new Map(expenseAccounts.map((a) => [a.id, a]))
    for (const line of lines) {
      const id = line.debit_account_id
      if (!id || byId.has(id)) continue
      const orphan = allAccounts.find((a) => a.id === id)
      if (orphan) byId.set(id, orphan)
    }
    return Array.from(byId.values()).sort((a, b) =>
      String(a.code).localeCompare(String(b.code), undefined, { numeric: true })
    )
  })()

  useEffect(() => {
    if (!brandId || !isPayment) return
    void import('../../lib/accounting-bank-service').then(({ loadBankAccounts }) =>
      loadBankAccounts(brandId).then((rows) =>
        setBankAccounts(rows.map((b) => ({ id: b.id, name: b.name })))
      )
    )
  }, [brandId, isPayment])

  const hasProcurementLinks = links.some((l) =>
    ['supplier_invoice', 'purchase_order', 'delivery_receipt', 'po_payment'].includes(l.source_type)
  )

  const reindexLines = (rows: AccountingVoucherLine[]) =>
    rows.map((line, i) => ({ ...line, line_no: i + 1 }))

  const updateLine = (idx: number, field: keyof AccountingVoucherLine, value: string | number) => {
    const next = [...lines]
    next[idx] = { ...next[idx], [field]: value }
    onLinesChange(next)
  }

  const addLine = () => {
    onLinesChange(
      reindexLines([
        ...lines,
        {
          line_no: lines.length + 1,
          description: '',
          amount: 0,
          debit_account_id: defaultLineDebitAccountId || undefined,
        },
      ])
    )
  }

  const removeLine = (idx: number) => {
    if (lines.length <= 1) return
    onLinesChange(reindexLines(lines.filter((_, i) => i !== idx)))
  }

  return (
    <Modal onClose={onClose} align="center">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            {isEdit ? 'Edit' : 'New'} {isPayment ? 'Payment Voucher' : 'Petty Cash Voucher'}
          </h2>
          <button type="button" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 space-y-5 flex-1 overflow-y-auto">
          {prefillLoading && isPayment ? (
            <PaymentVoucherPrefillSkeleton />
          ) : (
            <>
          {hasProcurementLinks && (
            <VoucherProcurementSupportingDocs
              links={links}
              brandId={brandId}
              themeBtn={themeBtn}
            />
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Date</label>
              <input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={header.voucher_date || ''} onChange={(e) => onHeaderChange({ ...header, voucher_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Department</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm" value={header.department || ''} onChange={(e) => onHeaderChange({ ...header, department: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Requested by</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm" value={header.requested_by || ''} onChange={(e) => onHeaderChange({ ...header, requested_by: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Payee</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm" value={header.payee_name || ''} onChange={(e) => onHeaderChange({ ...header, payee_name: e.target.value })} />
            </div>
          </div>

          {isPayment ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-700">Payment for</label>
                <input className="w-full border rounded px-2 py-1.5 text-sm" value={header.payment_for || ''} onChange={(e) => onHeaderChange({ ...header, payment_for: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select className="border rounded px-2 py-1.5 text-sm" value={header.payee_kind || 'supplier'} onChange={(e) => onHeaderChange({ ...header, payee_kind: e.target.value as AccountingVoucher['payee_kind'] })}>
                  <option value="supplier">Supplier</option>
                  <option value="reimbursement">Reimbursement</option>
                  <option value="petty_cash_replenishment">Petty cash replenishment</option>
                  <option value="invoice">Invoice</option>
                  <option value="payroll">Payroll</option>
                  <option value="intercompany">Intercompany</option>
                  <option value="staff_advance">Staff advance</option>
                  <option value="other">Other</option>
                </select>
                <select className="border rounded px-2 py-1.5 text-sm" value={header.payment_mode || 'cash'} onChange={(e) => onHeaderChange({ ...header, payment_mode: e.target.value as AccountingVoucher['payment_mode'] })}>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="bank_gcash">Bank / G-Cash</option>
                </select>
              </div>
              {isPayment &&
                (header.payment_mode === 'check' || header.payment_mode === 'bank_gcash') && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-700">Bank account</label>
                    <select
                      className="w-full border rounded px-2 py-1.5 text-sm"
                      value={header.bank_account_id || ''}
                      onChange={(e) =>
                        onHeaderChange({ ...header, bank_account_id: e.target.value || null })
                      }
                    >
                      <option value="">— Select bank —</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              {!hasProcurementLinks && (
                <VoucherProcurementSupportingDocs
                  links={links}
                  brandId={brandId}
                  themeBtn={themeBtn}
                />
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-700">Purpose</label>
                <textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={header.purpose || ''} onChange={(e) => onHeaderChange({ ...header, purpose: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-700">Amount requested</label>
                  <input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={header.amount_requested ?? total} onChange={(e) => onHeaderChange({ ...header, amount_requested: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-700">Amount released</label>
                  <input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={header.amount_released ?? ''} onChange={(e) => onHeaderChange({ ...header, amount_released: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-700">Date released</label>
                  <input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={header.date_released || ''} onChange={(e) => onHeaderChange({ ...header, date_released: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 pt-1">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-medium text-gray-700">Line items</label>
              <button type="button" onClick={addLine} className="text-xs text-blue-600 hover:text-blue-800">+ Add line</button>
            </div>
            <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input
                  className={`border rounded px-2 py-1 text-sm ${isPayment ? 'col-span-4' : 'col-span-5'}`}
                  placeholder="Description"
                  value={line.description}
                  onChange={(e) => updateLine(idx, 'description', e.target.value)}
                />
                <select
                  className={`border rounded px-1 py-1 text-xs ${isPayment ? 'col-span-3' : 'col-span-4'}`}
                  value={line.debit_account_id || ''}
                  onChange={(e) => updateLine(idx, 'debit_account_id', e.target.value)}
                  title="Expense / debit account"
                >
                  <option value="">Account…</option>
                  {lineDebitAccountOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} {a.name}
                    </option>
                  ))}
                </select>
                {isPayment && (
                  <input
                    className="col-span-2 border rounded px-2 py-1 text-sm"
                    placeholder="Ref doc"
                    value={line.reference_doc || ''}
                    onChange={(e) => updateLine(idx, 'reference_doc', e.target.value)}
                  />
                )}
                <input
                  type="number"
                  className="col-span-2 border rounded px-2 py-1 text-sm text-right"
                  value={line.amount}
                  onChange={(e) => updateLine(idx, 'amount', parseFloat(e.target.value) || 0)}
                />
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  disabled={lines.length <= 1}
                  className="col-span-1 flex items-center justify-end p-1 text-red-600 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={lines.length <= 1 ? 'At least one line required' : 'Remove line'}
                  aria-label="Remove line"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            </div>
            <p className="text-sm font-medium text-right pt-1">Total: ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-700">Notes</label>
            <textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={header.notes || ''} onChange={(e) => onHeaderChange({ ...header, notes: e.target.value })} />
          </div>
            </>
          )}
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
          {prefillLoading ? (
            <div className="h-[38px] w-24 bg-gray-200 rounded-lg animate-pulse" aria-hidden />
          ) : (
          <button type="button" onClick={onSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

/** Called from dashboard / procurement / payroll to open accounting with prefill. */
export function stashAccountingVoucherPrefill(prefill: AccountingVoucherPrefill) {
  localStorage.setItem(ACCOUNTING_VOUCHER_PREFILL_KEY, JSON.stringify(prefill))
  localStorage.setItem(ACCOUNTING_ACTIVE_SUBTAB_KEY, 'vouchers')
  localStorage.setItem(ACCOUNTING_VOUCHER_VIEW_KEY, voucherViewForType(prefill.voucherType))
}
