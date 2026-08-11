'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { CreditCard, Check, Eye, Download, X, Printer, Building2, Building, Store } from 'lucide-react'
import {
  formatPhilippinesDateTime,
  formatPhilippinesTransferSheetDate,
  getPhilippinesBillingPeriodRange,
  isTimestampInBillingPeriod,
  type BillingTimeFilter,
} from '../../lib/timezone'
import { AccountingPeriodFilter } from './AccountingPeriodFilter'
import { TRANSFER_SHEET_PRINT_STYLES, TRANSFER_SHEET_PRINT_SCRIPT } from '../../lib/transferSheetPrintStyles'
import { renderTransferSheetItemsBlock } from '../../lib/transferSheetPrintItems'
import { renderTransferSheetTotalsSection } from '../../lib/transferSheetPrintTotals'
import { buildTransferSheetDsirPayload } from '../../lib/transferSheetDsirQr'
import { getOrderTotalAmount } from '../../lib/order-totals'
import { Modal } from './Modal'
import type { AccountingBankAccount } from '../../lib/supabase'
import { getBrandIconColorClass } from '../../lib/brand-colors'

interface PaidOrder {
  id: string
  location_id: string
  brand_id: string
  customer_name: string
  status: string
  total_amount: number
  delivery_type: 'delivery' | 'pickup'
  deposit_slip_url?: string
  deposit_slip_uploaded_at?: string
  returnable_pans_image_url?: string
  notes?: string
  created_at: string
  updated_at: string
  location?: {
    id: string
    name: string
    franchisee?: string
    contact_number?: string
    company_owned?: boolean
    brand?: {
      id: string
      name: string
      slug?: string
    }
  }
  brand?: {
    id: string
    name: string
    slug?: string
  }
  order_details?: Array<{
    id: string
    product_id: string
    quantity: number
    unit_price: number
    products: {
      id: string
      name: string
      sku?: string
      unit: string
      category?: string
    }
  }>
}

interface BillingManagerProps {
  selectedBrand: any | null
  theme?: string
  /** When embedded in Accounting, hide duplicate page title. */
  embeddedInAccounting?: boolean
  /** Controlled period filter (Accounting embed). */
  timeFilter?: BillingTimeFilter
  onTimeFilterChange?: (filter: BillingTimeFilter) => void
  currentUsername?: string
  readOnlyMode?: boolean
  /**
   * When set (GFC Main books view), load customer orders for this franchise brand
   * instead of selectedBrand. Pass null with companyWideOrders to load all retail brands.
   */
  franchiseBrandId?: string | null
  /** Load orders across all retail brands (ignore selectedBrand.eq). */
  companyWideOrders?: boolean
}

export function BillingManager({
  selectedBrand,
  theme = 'blue',
  embeddedInAccounting = false,
  timeFilter: timeFilterProp,
  onTimeFilterChange,
  currentUsername = '',
  readOnlyMode = false,
  franchiseBrandId,
  companyWideOrders = false,
}: BillingManagerProps) {
  const canEdit = !readOnlyMode
  const [paidOrders, setPaidOrders] = useState<PaidOrder[]>([])
  const [completedOrders, setCompletedOrders] = useState<PaidOrder[]>([])
  const [fulfilledOrders, setFulfilledOrders] = useState<PaidOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<PaidOrder | null>(null)
  const [showOrderDetails, setShowOrderDetails] = useState(false)
  const [totalReceivable, setTotalReceivable] = useState(0)
  const [internalTimeFilter, setInternalTimeFilter] = useState<BillingTimeFilter>('year')
  const timeFilter = timeFilterProp ?? internalTimeFilter
  const setTimeFilter = onTimeFilterChange ?? setInternalTimeFilter
  const showOwnTimeFilter = !embeddedInAccounting
  const [showReturnablePansModal, setShowReturnablePansModal] = useState(false)
  const [selectedReturnablePansImage, setSelectedReturnablePansImage] = useState<string | null>(null)
  const [markCompleteOrderId, setMarkCompleteOrderId] = useState<string | null>(null)
  const [markCompleteBanks, setMarkCompleteBanks] = useState<AccountingBankAccount[]>([])
  const [markCompleteBankId, setMarkCompleteBankId] = useState('')
  const [markCompleteLoading, setMarkCompleteLoading] = useState(false)
  const [markCompleteSaving, setMarkCompleteSaving] = useState(false)
  const [selectedReturnablePansOrder, setSelectedReturnablePansOrder] = useState<PaidOrder | null>(null)
  const [showDepositSlipModal, setShowDepositSlipModal] = useState(false)
  const [selectedDepositSlipImage, setSelectedDepositSlipImage] = useState<string | null>(null)
  const [selectedDepositSlipOrder, setSelectedDepositSlipOrder] = useState<PaidOrder | null>(null)
  const [completedOrdersPage, setCompletedOrdersPage] = useState(1)
  const [showCompanyOwnedCompleted, setShowCompanyOwnedCompleted] = useState(false)
  const completedOrdersPerPage = 10

  const isCompanyOwned = useCallback((order: PaidOrder) => {
    return order.location?.company_owned === true
  }, [])

  const getDepositSlipUploadedAt = (order: PaidOrder): string | null => {
    if (order.deposit_slip_uploaded_at) return order.deposit_slip_uploaded_at
    if (!order.deposit_slip_url) return null
    const match = order.deposit_slip_url.match(/_(\d{13})\./)
    if (match) return new Date(Number(match[1])).toISOString()
    return order.updated_at ?? null
  }

  const getCompletedOrderPaymentTimestamp = useCallback((order: PaidOrder): string | undefined => {
    if (order.deposit_slip_uploaded_at) return order.deposit_slip_uploaded_at
    if (!order.deposit_slip_url) return undefined
    const match = order.deposit_slip_url.match(/_(\d{13})\./)
    if (match) return new Date(Number(match[1])).toISOString()
    return undefined
  }, [])

  const periodFilteredCompletedOrders = useMemo(() => {
    const { start, end } = getPhilippinesBillingPeriodRange(timeFilter)
    return completedOrders.filter((order) =>
      isTimestampInBillingPeriod(getCompletedOrderPaymentTimestamp(order), start, end, timeFilter)
    )
  }, [completedOrders, timeFilter, getCompletedOrderPaymentTimestamp])

  const visibleCompletedOrders = useMemo(() => {
    if (showCompanyOwnedCompleted) return periodFilteredCompletedOrders
    return periodFilteredCompletedOrders.filter((order) => !isCompanyOwned(order))
  }, [periodFilteredCompletedOrders, showCompanyOwnedCompleted, isCompanyOwned])

  const companyOwnedCompletedCount = useMemo(
    () => periodFilteredCompletedOrders.filter(isCompanyOwned).length,
    [periodFilteredCompletedOrders, isCompanyOwned]
  )

  const locationBrandName = (order: PaidOrder) =>
    order.brand?.name || order.location?.brand?.name

  // Location house/building icons follow that order's brand color
  const getLocationIconColor = (order: PaidOrder) =>
    getBrandIconColorClass(locationBrandName(order))

  useEffect(() => {
    if (selectedBrand || companyWideOrders || franchiseBrandId) {
      fetchPaidOrders() // Now fetches all data in one call
      setCompletedOrdersPage(1) // Reset pagination when filter changes
    }
  }, [selectedBrand, timeFilter, franchiseBrandId, companyWideOrders])

  useEffect(() => {
    setCompletedOrdersPage(1)
  }, [showCompanyOwnedCompleted])

  // Realtime subscription for order updates
  useEffect(() => {
    if (!selectedBrand && !companyWideOrders && !franchiseBrandId) return

    const channel = supabase
      .channel('billing-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_orders',
          ...(franchiseBrandId
            ? { filter: `brand_id=eq.${franchiseBrandId}` }
            : !companyWideOrders && selectedBrand
              ? { filter: `brand_id=eq.${selectedBrand.id}` }
              : {}),
        },
        (payload) => {
          console.log('Billing orders realtime update:', payload)
          
          // Refresh billing data when orders are updated
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
            fetchPaidOrders() // Now fetches all data in one call
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedBrand, franchiseBrandId, companyWideOrders])

  const fetchPaidOrders = async () => {
    if (!selectedBrand && !companyWideOrders && !franchiseBrandId) return
    
    setLoading(true)
    try {
      const { start, end } = getPhilippinesBillingPeriodRange(timeFilter)
      
      // Batch fetch all orders with a single query using .in()
      let query = supabase
        .from('customer_orders')
        .select(`
          *,
          location:locations(*, brand:brands(*)),
          brand:brands(*),
          order_details(
            *,
            products:products(id, name, sku, unit, category)
          )
        `)
        .in('status', ['paid', 'complete', 'fulfilled'])
        .order('created_at', { ascending: false })

      if (franchiseBrandId) {
        query = query.eq('brand_id', franchiseBrandId)
      } else if (!companyWideOrders && selectedBrand) {
        query = query.eq('brand_id', selectedBrand.id)
      }

      const { data: allOrders, error } = await query
      
      if (error) {
        console.error('Error fetching orders:', error)
        return
      }
      
      if (allOrders) {
        // Paid: when order entered paid status (updated_at)
        const paidData = allOrders.filter(
          (order) =>
            order.status === 'paid' &&
            isTimestampInBillingPeriod(order.updated_at, start, end, timeFilter)
        )

        const completedData = allOrders.filter((order) => order.status === 'complete')
        
        const fulfilledData = allOrders.filter(
          (order) =>
            order.status === 'fulfilled' &&
            isTimestampInBillingPeriod(order.updated_at, start, end, timeFilter)
        )
        
        setPaidOrders(paidData)
        setCompletedOrders(completedData)
        setFulfilledOrders(fulfilledData)
        
        // Calculate receivable from fulfilled orders
        const receivable = fulfilledData.reduce((total, order) => total + getOrderTotalAmount(order), 0)
        setTotalReceivable(receivable)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchReleasedOrders = async () => {
    // This function is no longer needed as data is fetched in fetchPaidOrders
    // Kept for backwards compatibility
  }

  const fetchTotalReceivable = async () => {
    // This function is no longer needed as data is fetched in fetchPaidOrders
    // Kept for backwards compatibility
  }

  const openMarkCompleteModal = async (orderId: string) => {
    const order = paidOrders.find((o) => o.id === orderId)
    const brandId = order?.brand_id
    if (!brandId) {
      alert('Order brand not found')
      return
    }
    setMarkCompleteOrderId(orderId)
    setMarkCompleteBankId('')
    setMarkCompleteLoading(true)
    try {
      const [{ loadBankAccounts }, { ensureVoucherSettings }] = await Promise.all([
        import('../../lib/accounting-bank-service'),
        import('../../lib/accounting-voucher-service'),
      ])
      const [banks, settings] = await Promise.all([
        loadBankAccounts(brandId),
        ensureVoucherSettings(brandId),
      ])
      const activeBanks = banks.filter((b) => b.is_active !== false)
      setMarkCompleteBanks(activeBanks)
      const { getCashDefaultAccountId } = await import('../../lib/resolve-cash-default-account')
      const preferredGl = getCashDefaultAccountId(settings, 'customer_order_cash')
      const pref =
        (preferredGl && activeBanks.find((b) => b.gl_account_id === preferredGl)) ||
        activeBanks[0]
      setMarkCompleteBankId(pref?.id || '')
    } catch (err) {
      console.error('Failed to load banks for mark complete:', err)
      alert('Failed to load bank accounts')
      setMarkCompleteOrderId(null)
    } finally {
      setMarkCompleteLoading(false)
    }
  }

  const closeMarkCompleteModal = () => {
    if (markCompleteSaving) return
    setMarkCompleteOrderId(null)
    setMarkCompleteBanks([])
    setMarkCompleteBankId('')
  }

  const handleMarkComplete = async () => {
    const orderId = markCompleteOrderId
    if (!orderId) return
    if (!markCompleteBankId && markCompleteBanks.length > 0) {
      alert('Select a bank account for this collection.')
      return
    }

    setMarkCompleteSaving(true)
    try {
      const { data: beforeOrder } = await supabase
        .from('customer_orders')
        .select('status')
        .eq('id', orderId)
        .single()

      const { error } = await supabase
        .from('customer_orders')
        .update({
          status: 'complete',
          collection_bank_account_id: markCompleteBankId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      if (error) {
        console.error('Error updating order:', error)
        alert('Error updating order')
        return
      }

      const { logCustomerOrderStatusChange } = await import(
        '../../lib/customer-order-status-history'
      )
      await logCustomerOrderStatusChange({
        orderId,
        oldStatus: beforeOrder?.status ?? 'paid',
        newStatus: 'complete',
        changedBy: currentUsername || 'billing',
      })

      const order = paidOrders.find((o) => o.id === orderId)
      const brandId = order?.brand_id
      if (brandId) {
        try {
          const { postCustomerOrderCash } = await import('../../lib/accounting-posting-rules')
          await postCustomerOrderCash(orderId, brandId, 'billing', {
            bankAccountId: markCompleteBankId || null,
          })
        } catch {
          // Posting errors are recorded in accounting_posting_errors for retry from Accounting.
        }
      }

      setPaidOrders((prev) => prev.filter((o) => o.id !== orderId))

      if (selectedOrder?.id === orderId) {
        setShowOrderDetails(false)
        setSelectedOrder(null)
      }

      setMarkCompleteOrderId(null)
      setMarkCompleteBanks([])
      setMarkCompleteBankId('')
    } catch (error) {
      console.error('Error updating order:', error)
      alert('Error updating order')
    } finally {
      setMarkCompleteSaving(false)
    }
  }

  const handleViewDetails = (order: PaidOrder) => {
    setSelectedOrder(order)
    setShowOrderDetails(true)
  }

  const getTotalItems = (order: PaidOrder) => {
    return order.order_details?.reduce((total, detail) => total + detail.quantity, 0) || 0
  }

  const getReturnablePans = (order: PaidOrder) => {
    if (!order.order_details) return { total: 0, hasImage: false }
    
    const returnablePansProducts = order.order_details.filter((detail) => {
      if (!order.brand && !order.location?.brand) return false
      const brandSlug = (order.brand?.slug || order.location?.brand?.slug)?.toLowerCase()
      const productCategory = detail.products?.category?.toLowerCase() || ''
      
      switch (brandSlug) {
        case 'gelatofilipino':
          return productCategory === 'gelato'
        case 'mychoice':
          return productCategory === 'ice cream'
        case 'mang-sorbetes':
          return productCategory === 'sorbetes'
        default:
          return false
      }
    })
    
    const totalPans = returnablePansProducts.reduce((total, detail) => total + detail.quantity, 0)
    const hasImage = !!order.returnable_pans_image_url
    
    return { total: totalPans, hasImage }
  }

  const getCategoryTotals = useCallback((order: PaidOrder) => {
    if (!order.order_details) return []
    
    const categoryMap = new Map()
    
    order.order_details.forEach(detail => {
      // Debug: log the product data to see what's being fetched
      console.log('Product data:', detail.products)
      
      // Check if category exists and is not null/undefined/empty
      const category = detail.products?.category && detail.products.category.trim() !== '' 
        ? detail.products.category 
        : 'Uncategorized'
        
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          totalQuantity: 0,
          totalAmount: 0
        })
      }
      
      const categoryTotal = categoryMap.get(category)
      categoryTotal.totalQuantity += detail.quantity
      categoryTotal.totalAmount += detail.unit_price * detail.quantity
    })
    
    return Array.from(categoryMap.values())
  }, [])

  const getTotalAmount = useCallback((order: PaidOrder) => {
    return order.order_details?.reduce((total, detail) => total + (detail.unit_price * detail.quantity), 0) || 0
  }, [])

  // Pagination logic for completed orders (respects company-owned visibility filter)
  const getCompletedOrdersForPage = () => {
    const startIndex = (completedOrdersPage - 1) * completedOrdersPerPage
    const endIndex = startIndex + completedOrdersPerPage
    return visibleCompletedOrders.slice(startIndex, endIndex)
  }

  const getTotalCompletedPages = () => {
    return Math.ceil(visibleCompletedOrders.length / completedOrdersPerPage)
  }

  // Show 1-10 page buttons by default; sliding window when more pages exist
  const getVisiblePageNumbers = () => {
    const total = getTotalCompletedPages()
    const maxVisibleButtons = 10
    if (total <= maxVisibleButtons) {
      return Array.from({ length: total }, (_, i) => i + 1)
    }
    const windowStart = Math.floor((completedOrdersPage - 1) / maxVisibleButtons) * maxVisibleButtons + 1
    const windowEnd = Math.min(windowStart + maxVisibleButtons - 1, total)
    return Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i)
  }

  const handleCompletedPageChange = (page: number) => {
    setCompletedOrdersPage(page)
  }

  const getSubtotalAmount = (order: PaidOrder) => {
    return order.order_details?.reduce((total, detail) => total + (detail.unit_price * detail.quantity), 0) || 0
  }

  // Memoized revenue calculations (use computed amount from order_details to match logistics)
  const calculateTotalPaid = useMemo(() => {
    return paidOrders.reduce((total, order) => total + getOrderTotalAmount(order), 0)
  }, [paidOrders])

  const calculateTotalCompleted = useMemo(() => {
    return periodFilteredCompletedOrders.reduce((total, order) => total + getOrderTotalAmount(order), 0)
  }, [periodFilteredCompletedOrders])

  const calculateTotalRevenue = useMemo(() => {
    return calculateTotalPaid + calculateTotalCompleted
  }, [calculateTotalPaid, calculateTotalCompleted])

  // Helper functions for MyChoice company-owned separation
  const isMyChoiceCompanyOwned = (order: PaidOrder) => {
    return order.brand?.name?.toLowerCase().includes('mychoice') && order.location?.company_owned === true
  }

  const calculateMyChoiceCompanyOwnedRevenue = useMemo(() => {
    const paidMyChoice = paidOrders
      .filter(order => isMyChoiceCompanyOwned(order))
      .reduce((total, order) => total + getOrderTotalAmount(order), 0)
    const completedMyChoice = periodFilteredCompletedOrders
      .filter(order => isMyChoiceCompanyOwned(order))
      .reduce((total, order) => total + getOrderTotalAmount(order), 0)
    return paidMyChoice + completedMyChoice
  }, [paidOrders, periodFilteredCompletedOrders])

  const calculateFranchiseRevenue = useMemo(() => {
    const paidFranchise = paidOrders
      .filter(order => !isMyChoiceCompanyOwned(order))
      .reduce((total, order) => total + getOrderTotalAmount(order), 0)
    const completedFranchise = periodFilteredCompletedOrders
      .filter(order => !isMyChoiceCompanyOwned(order))
      .reduce((total, order) => total + getOrderTotalAmount(order), 0)
    return paidFranchise + completedFranchise
  }, [paidOrders, periodFilteredCompletedOrders])

  const getMyChoiceCompanyOwnedOrders = useMemo(() => {
    const paidMyChoice = paidOrders.filter(order => isMyChoiceCompanyOwned(order))
    const completedMyChoice = periodFilteredCompletedOrders.filter(order => isMyChoiceCompanyOwned(order))
    return [...paidMyChoice, ...completedMyChoice]
  }, [paidOrders, periodFilteredCompletedOrders])

  const getFranchiseOrders = useMemo(() => {
    const paidFranchise = paidOrders.filter(order => !isMyChoiceCompanyOwned(order))
    const completedFranchise = periodFilteredCompletedOrders.filter(order => !isMyChoiceCompanyOwned(order))
    return [...paidFranchise, ...completedFranchise]
  }, [paidOrders, periodFilteredCompletedOrders])

  const calculateMyChoiceCompanyOwnedPaid = () => {
    return paidOrders
      .filter(order => isMyChoiceCompanyOwned(order))
      .reduce((total, order) => total + getOrderTotalAmount(order), 0)
  }

  const calculateFranchisePaid = () => {
    return paidOrders
      .filter(order => !isMyChoiceCompanyOwned(order))
      .reduce((total, order) => total + getOrderTotalAmount(order), 0)
  }

  const calculateMyChoiceCompanyOwnedReceivable = () => {
    return fulfilledOrders
      .filter(order => isMyChoiceCompanyOwned(order))
      .reduce((total, order) => total + getOrderTotalAmount(order), 0)
  }

  const calculateFranchiseReceivable = () => {
    return fulfilledOrders
      .filter(order => !isMyChoiceCompanyOwned(order))
      .reduce((total, order) => total + getOrderTotalAmount(order), 0)
  }

  const printTransferSheet = async (order: PaidOrder) => {
    const sortedDetails = [...(order.order_details || [])].sort((a, b) => {
      const categoryA =
        a.products?.category && a.products.category.trim() !== '' ? a.products.category : 'Uncategorized'
      const categoryB =
        b.products?.category && b.products.category.trim() !== '' ? b.products.category : 'Uncategorized'
      return categoryA.localeCompare(categoryB)
    })

    const itemsHtml = renderTransferSheetItemsBlock(
      sortedDetails.map((detail) => ({
        name: detail.products?.name || 'N/A',
        sku: detail.products?.sku,
        unit: detail.products?.unit,
        quantity: detail.quantity,
      }))
    )

    const dsirPayloadText = buildTransferSheetDsirPayload(
      sortedDetails.map((detail) => ({
        name: detail.products?.name || '',
        quantity: detail.quantity,
      }))
    )
    let dsirQrDataUrl = ''
    if (dsirPayloadText) {
      const QRCode = (await import('qrcode')).default
      dsirQrDataUrl = await QRCode.toDataURL(dsirPayloadText, { width: 360, margin: 1 })
    }

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Transfer Sheet - Order ${order.id.slice(0, 8)}</title>
          <style>${TRANSFER_SHEET_PRINT_STYLES}</style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div class="company-name">${order.brand?.name || 'Company'}</div>
              <div class="generated-date">Generated on ${new Date().toLocaleString()}</div>
              <div class="receipt-title">Stock Transfer Sheet</div>
            </div>
            
            <div class="order-info">
              <div class="info-grid info-grid-cols-5">
                <div class="info-item">
                  <span class="info-label">Order ID</span>
                  <span class="info-value">${order.id.slice(0, 8)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Date (PST)</span>
                  <span class="info-value">${formatPhilippinesTransferSheetDate(order.created_at)}</span>
                </div>
                <div class="info-item info-item-location">
                  <span class="info-label">Location</span>
                  <span class="info-value">${order.location?.name || 'N/A'}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Franchisee</span>
                  <span class="info-value">${order.location?.franchisee || 'N/A'}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Logistics</span>
                  <span class="info-value">${order.delivery_type === 'delivery' ? 'Delivery' : 'Pickup'}</span>
                </div>
              </div>
            </div>
            
            ${itemsHtml}
            
            ${renderTransferSheetTotalsSection({
              categoryTotals: getCategoryTotals(order),
              subtotal: getSubtotalAmount(order),
              deliveryType: order.delivery_type,
              grandTotal: getOrderTotalAmount(order),
              remarks: order.notes,
              qrDataUrl: dsirQrDataUrl,
              qrCaption: 'Receive stock',
            })}
            
          </div>
          <script>${TRANSFER_SHEET_PRINT_SCRIPT}</script>
        </body>
        </html>
      `)
      printWindow.document.close()
    }
  }


  return (
    <div className={embeddedInAccounting ? 'space-y-4' : 'space-y-6'}>
      {!embeddedInAccounting && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Billing</h1>
            <p className="text-sm text-gray-600">Track unpaid orders and manage paid orders by status</p>
          </div>
        </div>
      )}

      {showOwnTimeFilter && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <AccountingPeriodFilter value={timeFilter} onChange={setTimeFilter} theme={theme} />
        </div>
      )}

      {/* Summary */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
          </div>
          
          {/* Summary cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="bg-gray-50 p-4 rounded-lg">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2 animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded w-32 mb-2 animate-pulse"></div>
                <div className="h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
              </div>
            ))}
          </div>
          
          {/* Table skeleton */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
            </div>
            <div>
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {[...Array(7)].map((_, i) => (
                      <th key={i} className="px-6 py-3 text-left">
                        <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {[...Array(3)].map((_, rowIdx) => (
                    <tr key={rowIdx}>
                      {[...Array(7)].map((_, cellIdx) => (
                        <td key={cellIdx} className="px-6 py-4 whitespace-nowrap">
                          <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-medium">Summary</h4>
          </div>
          
          {/* MyChoice Company-Owned Summary */}
          {selectedBrand?.name?.toLowerCase().includes('mychoice') && (
          <div className="mb-6">
            {/* Company Owned Section */}
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600 font-medium">Total Company Owned Revenue</p>
                  <p className="text-2xl font-bold text-green-900">₱{calculateMyChoiceCompanyOwnedRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-xs text-green-700 mt-1">{getMyChoiceCompanyOwnedOrders.length} company orders</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-600 font-medium">Total Paid</p>
                  <p className="text-2xl font-bold text-blue-900">₱{calculateMyChoiceCompanyOwnedPaid().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-xs text-blue-700 mt-1">Ready for completion</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-orange-600 font-medium">Total Receivable</p>
                  <p className="text-2xl font-bold text-orange-900">₱{calculateMyChoiceCompanyOwnedReceivable().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-xs text-orange-700 mt-1">{fulfilledOrders.filter(order => isMyChoiceCompanyOwned(order)).length} unpaid orders</p>
                </div>
              </div>
            </div>

            {/* Franchise Section */}
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600 font-medium">Total Franchise Revenue</p>
                  <p className="text-2xl font-bold text-green-900">₱{calculateFranchiseRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-xs text-green-700 mt-1">{getFranchiseOrders.length} franchise orders</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-600 font-medium">Total Paid</p>
                  <p className="text-2xl font-bold text-blue-900">₱{calculateFranchisePaid().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-xs text-blue-700 mt-1">Ready for completion</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-orange-600 font-medium">Total Receivable</p>
                  <p className="text-2xl font-bold text-orange-900">₱{calculateFranchiseReceivable().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-xs text-orange-700 mt-1">{fulfilledOrders.filter(order => !isMyChoiceCompanyOwned(order)).length} unpaid orders</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* General Summary for other brands */}
        {!selectedBrand?.name?.toLowerCase().includes('mychoice') && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-600 font-medium">Total Revenue</p>
              <p className="text-2xl font-bold text-green-900">₱{calculateTotalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-green-700 mt-1">{paidOrders.length + periodFilteredCompletedOrders.length} total orders</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">Paid Orders</p>
              <p className="text-2xl font-bold text-purple-900">₱{calculateTotalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-purple-700 mt-1">{paidOrders.length} paid orders</p>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg">
              <p className="text-sm text-indigo-600 font-medium">Completed Orders</p>
              <p className="text-2xl font-bold text-indigo-900">₱{calculateTotalCompleted.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-indigo-700 mt-1">{periodFilteredCompletedOrders.length} completed orders</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-sm text-orange-600 font-medium">Total Receivable</p>
              <p className="text-2xl font-bold text-orange-900">₱{totalReceivable.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-orange-700 mt-1">{fulfilledOrders.length} unpaid orders</p>
            </div>
          </div>
        )}
        </div>
      )}

      {/* Fulfilled Orders (Unpaid) */}
      {fulfilledOrders.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-orange-50">
            <h4 className="text-lg font-medium text-orange-900">Unpaid Orders (Receivable)</h4>
          </div>
          <div className="overflow-x-auto overflow-y-visible">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Returnable Pans
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {fulfilledOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-orange-100 hover:shadow-md transition-all duration-75">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-middle">
                      {order.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      {formatPhilippinesDateTime(order.created_at, { dateStyle: 'short' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      <div className="flex items-center">
                        {isCompanyOwned(order) ? (
                          <Building2 className={`h-4 w-4 mr-2 ${getLocationIconColor(order)}`} />
                        ) : (
                          <Store className={`h-4 w-4 mr-2 ${getLocationIconColor(order)}`} />
                        )}
                        <span>{order.location?.name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600 align-middle">
                      ₱{getOrderTotalAmount(order).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      {(() => {
                        const returnablePans = getReturnablePans(order)
                        if (returnablePans.total > 0 && returnablePans.hasImage) {
                          return (
                            <button
                              onClick={() => {
                                setSelectedReturnablePansImage(order.returnable_pans_image_url)
                                setSelectedReturnablePansOrder(order)
                                setShowReturnablePansModal(true)
                              }}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                              title="Click to view returnable pans image"
                            >
                              {returnablePans.total} pans
                            </button>
                          )
                        } else if (returnablePans.total > 0) {
                          return <span className="text-red-600 font-medium cursor-default">{returnablePans.total} pans</span>
                        } else {
                          return <span className="text-gray-400">-</span>
                        }
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-middle">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        Awaiting Payment
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-middle">
                      <div className="flex space-x-2 items-center">
                        <button
                          onClick={() => handleViewDetails(order)}
                          className={`p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out`}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Paid Orders List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-purple-50">
          <h4 className="text-lg font-medium text-purple-900">Paid Orders ({paidOrders.length})</h4>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : paidOrders.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Paid Orders</h3>
            <p className="text-gray-600">There are no paid orders in the selected time period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Returnable Pans
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Deposit Slip
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                    Payment date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paidOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-blue-100 hover:shadow-md transition-all duration-75">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-middle">
                      {order.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      {formatPhilippinesDateTime(order.created_at, { dateStyle: 'short' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      <div className="flex items-center">
                        {isCompanyOwned(order) ? (
                          <Building2 className={`h-4 w-4 mr-2 ${getLocationIconColor(order)}`} />
                        ) : (
                          <Store className={`h-4 w-4 mr-2 ${getLocationIconColor(order)}`} />
                        )}
                        <span>{order.location?.name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-middle">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        order.status === 'paid' ? 'bg-purple-100 text-purple-800' :
                        order.status === 'complete' ? 'bg-indigo-100 text-indigo-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 align-middle">
                      ₱{getOrderTotalAmount(order).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      {(() => {
                        const returnablePans = getReturnablePans(order)
                        if (returnablePans.total > 0 && returnablePans.hasImage) {
                          return (
                            <button
                              onClick={() => {
                                setSelectedReturnablePansImage(order.returnable_pans_image_url)
                                setSelectedReturnablePansOrder(order)
                                setShowReturnablePansModal(true)
                              }}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                              title="Click to view returnable pans image"
                            >
                              {returnablePans.total} pans
                            </button>
                          )
                        } else if (returnablePans.total > 0) {
                          return <span className="text-red-600 font-medium cursor-default">{returnablePans.total} pans</span>
                        } else {
                          return <span className="text-gray-400">-</span>
                        }
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-middle">
                      {order.deposit_slip_url ? (
                        <button
                        onClick={() => {
                          setSelectedDepositSlipImage(order.deposit_slip_url)
                          setSelectedDepositSlipOrder(order)
                          setShowDepositSlipModal(true)
                        }}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-gray-400">No slip</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 align-middle">
                      {(() => {
                        const uploadedAt = getDepositSlipUploadedAt(order)
                        if (!uploadedAt) return <span className="text-gray-400">—</span>
                        return formatPhilippinesDateTime(uploadedAt, { dateStyle: 'short' })
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-middle">
                      <div className="flex space-x-2 items-center">
                        <button
                          onClick={() => handleViewDetails(order)}
                          className={`p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out`}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {order.status === 'paid' && canEdit && (
                          <button
                            onClick={() => void openMarkCompleteModal(order.id)}
                            className={`p-1 rounded transition-all duration-200 ease-in-out ${
                              theme === 'green' ? 'text-green-600 hover:text-green-900 hover:bg-green-50' :
                              theme === 'red' ? 'text-red-600 hover:text-red-900 hover:bg-red-50' :
                              theme === 'yellow' ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50' :
                              'text-blue-600 hover:text-blue-900 hover:bg-blue-50'
                            }`}
                            title="Mark Complete"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Completed Orders List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-indigo-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h4 className="text-lg font-medium text-indigo-900">
              Completed Orders ({visibleCompletedOrders.length}
              {!showCompanyOwnedCompleted && companyOwnedCompletedCount > 0
                ? ` · ${companyOwnedCompletedCount} company owned hidden`
                : ''}
              )
            </h4>
            <div className="flex flex-wrap items-center gap-4">
              {companyOwnedCompletedCount > 0 && (
                <label className="inline-flex items-center gap-2 text-sm text-indigo-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showCompanyOwnedCompleted}
                    onChange={(e) => setShowCompanyOwnedCompleted(e.target.checked)}
                    className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Show company owned
                </label>
              )}
              {visibleCompletedOrders.length > completedOrdersPerPage && (
                <div className="text-sm text-indigo-700">
                  Page {completedOrdersPage} of {getTotalCompletedPages()}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : periodFilteredCompletedOrders.length === 0 ? (
          <div className="p-12 text-center">
            <Check className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Completed Orders</h3>
            <p className="text-gray-600">There are no completed orders in the selected time period.</p>
          </div>
        ) : visibleCompletedOrders.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Franchise Completed Orders</h3>
            <p className="text-gray-600">
              All {companyOwnedCompletedCount} completed order
              {companyOwnedCompletedCount === 1 ? '' : 's'} in this period are company owned. Enable
              &quot;Show company owned&quot; to include them.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Returnable Pans
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Deposit Slip
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                    Payment date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getCompletedOrdersForPage().map((order) => (
                  <tr key={order.id} className="hover:bg-indigo-100 hover:shadow-md transition-all duration-75">
                    <td
                      className="px-2 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-middle max-w-[4rem] truncate"
                      title={order.id}
                    >
                      {order.id.slice(0, 8)}…
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      {formatPhilippinesDateTime(order.created_at, { dateStyle: 'short' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      <div className="flex items-center">
                        {isCompanyOwned(order) ? (
                          <Building2 className={`h-4 w-4 mr-2 ${getLocationIconColor(order)}`} />
                        ) : (
                          <Store className={`h-4 w-4 mr-2 ${getLocationIconColor(order)}`} />
                        )}
                        <span>{order.location?.name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-middle">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        Complete
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 align-middle">
                      ₱{getOrderTotalAmount(order).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      {(() => {
                        const returnablePans = getReturnablePans(order)
                        if (returnablePans.total > 0 && returnablePans.hasImage) {
                          return (
                            <button
                              onClick={() => {
                                setSelectedReturnablePansImage(order.returnable_pans_image_url)
                                setSelectedReturnablePansOrder(order)
                                setShowReturnablePansModal(true)
                              }}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                              title="Click to view returnable pans image"
                            >
                              {returnablePans.total} pans
                            </button>
                          )
                        } else if (returnablePans.total > 0) {
                          return <span className="text-red-600 font-medium cursor-default">{returnablePans.total} pans</span>
                        } else {
                          return <span className="text-gray-400">-</span>
                        }
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-middle">
                      {order.deposit_slip_url ? (
                        <button
                        onClick={() => {
                          setSelectedDepositSlipImage(order.deposit_slip_url)
                          setSelectedDepositSlipOrder(order)
                          setShowDepositSlipModal(true)
                        }}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 align-middle">
                      {(() => {
                        const uploadedAt = getDepositSlipUploadedAt(order)
                        if (!uploadedAt) return <span className="text-gray-400">—</span>
                        return formatPhilippinesDateTime(uploadedAt, { dateStyle: 'short' })
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-middle">
                      <div className="flex space-x-2 items-center">
                        <button
                          onClick={() => handleViewDetails(order)}
                          className={`p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out`}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {visibleCompletedOrders.length > completedOrdersPerPage && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((completedOrdersPage - 1) * completedOrdersPerPage) + 1} to {Math.min(completedOrdersPage * completedOrdersPerPage, visibleCompletedOrders.length)} of {visibleCompletedOrders.length} orders
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleCompletedPageChange(completedOrdersPage - 1)}
                  disabled={completedOrdersPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="flex items-center space-x-1">
                  {getVisiblePageNumbers().map((page) => (
                    <button
                      key={page}
                      onClick={() => handleCompletedPageChange(page)}
                      className={`px-3 py-1 text-sm border rounded-md ${
                        page === completedOrdersPage
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => handleCompletedPageChange(completedOrdersPage + 1)}
                  disabled={completedOrdersPage === getTotalCompletedPages()}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
          )}
        </div>

      {fulfilledOrders.length === 0 && paidOrders.length === 0 && periodFilteredCompletedOrders.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Billing Activity</h3>
          <p className="text-gray-600">There are no paid or unpaid orders to manage.</p>
        </div>
      )}

      {/* Mark Complete — bank picker */}
      {markCompleteOrderId && (
        <Modal backdropClassName="bg-gray-600/50">
          <div className="mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Mark order complete</h3>
              <button
                type="button"
                onClick={closeMarkCompleteModal}
                disabled={markCompleteSaving}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Choose the bank that received this deposit. Defaults to the Cash account bank when available.
            </p>
            {markCompleteLoading ? (
              <p className="text-sm text-gray-500 py-4">Loading banks…</p>
            ) : (
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Bank account
                <select
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={markCompleteBankId}
                  onChange={(e) => setMarkCompleteBankId(e.target.value)}
                  disabled={markCompleteSaving}
                >
                  {markCompleteBanks.length === 0 && (
                    <option value="">Use default Cash (no banks configured)</option>
                  )}
                  {markCompleteBanks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.account_last4 ? ` ···${b.account_last4}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeMarkCompleteModal}
                disabled={markCompleteSaving}
                className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleMarkComplete()}
                disabled={markCompleteLoading || markCompleteSaving}
                className={`px-4 py-2 text-sm rounded text-white disabled:opacity-50 ${
                  theme === 'green'
                    ? 'bg-green-600 hover:bg-green-700'
                    : theme === 'red'
                      ? 'bg-red-600 hover:bg-red-700'
                      : theme === 'yellow'
                        ? 'bg-yellow-600 hover:bg-yellow-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {markCompleteSaving ? 'Saving…' : 'Mark complete'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <Modal backdropClassName="bg-gray-600/50">
          <div className="mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Order Details #{selectedOrder.id.slice(0, 8)}
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setShowOrderDetails(false)
                    setSelectedOrder(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Order Information */}
            <div className="flex-1 overflow-y-auto space-y-6">
              {/* Order Header */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Created Date</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">{formatPhilippinesDateTime(selectedOrder.created_at, { dateStyle: 'short', timeStyle: 'short' })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                      selectedOrder.status === 'paid' ? 'bg-purple-100 text-purple-800' :
                      selectedOrder.status === 'complete' ? 'bg-indigo-100 text-indigo-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Logistics</p>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                      selectedOrder.delivery_type === 'delivery' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {selectedOrder.delivery_type === 'delivery' ? 'Delivery' : 'Pickup'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Location</p>
                    <div className="flex items-center mt-1">
                      {isCompanyOwned(selectedOrder) ? (
                        <Building2 className={`h-4 w-4 mr-2 ${getLocationIconColor(selectedOrder)}`} />
                      ) : (
                        <Store className={`h-4 w-4 mr-2 ${getLocationIconColor(selectedOrder)}`} />
                      )}
                      <p className="text-sm font-semibold text-gray-900">{selectedOrder.location?.name || 'N/A'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Total Amount</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">₱{getOrderTotalAmount(selectedOrder).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Category Totals</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {getCategoryTotals(selectedOrder).map((categoryTotal, index) => (
                        <div key={index} className="bg-white rounded p-2 border text-center">
                          <p className="text-xs font-medium text-gray-900">{categoryTotal.category}</p>
                          <p className="text-xs text-gray-600">{categoryTotal.totalQuantity} items</p>
                          <p className="text-xs font-semibold text-green-600">₱{categoryTotal.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Pricing Breakdown */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Pricing Breakdown</p>
                    <div className="bg-white rounded p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Subtotal:</span>
                        <span className="text-sm text-gray-900">₱{getSubtotalAmount(selectedOrder).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      {selectedOrder.delivery_type === 'delivery' && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Delivery Fee:</span>
                          {getSubtotalAmount(selectedOrder) >= 10000 ? (
                            <span className="text-sm text-green-600">FREE (Order over ₱10k)</span>
                          ) : (
                            <span className="text-sm text-gray-900">+₱500.00</span>
                          )}
                        </div>
                      )}
                      {selectedOrder.delivery_type === 'pickup' && getSubtotalAmount(selectedOrder) >= 10000 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Pickup Discount (5%):</span>
                          <span className="text-sm text-green-600">-₱{(getSubtotalAmount(selectedOrder) * 0.05).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {selectedOrder.delivery_type === 'pickup' && getSubtotalAmount(selectedOrder) < 10000 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Pickup Discount:</span>
                          <span className="text-sm text-gray-500">Not available (Order under ₱10k)</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="text-sm font-semibold text-gray-900">Total Amount:</span>
                        <span className="text-sm font-semibold text-green-600">₱{getOrderTotalAmount(selectedOrder).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Deposit Slip */}
              {selectedOrder.deposit_slip_url && (
                <div className="bg-white border rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                    <Download className="h-4 w-4 mr-2" />
                    Deposit Slip
                  </h4>
                  <div className="flex items-center space-x-4">
                    <img
                      src={selectedOrder.deposit_slip_url}
                      alt="Deposit Slip"
                      className="w-20 h-20 object-cover rounded border"
                    />
                    <div>
                      <p className="text-sm text-gray-600">Deposit slip uploaded</p>
                      <button
                        onClick={() => {
                          setSelectedDepositSlipImage(selectedOrder.deposit_slip_url)
                          setSelectedDepositSlipOrder(selectedOrder)
                          setShowDepositSlipModal(true)
                        }}
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm mt-1"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View full size
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Items - Full List */}
              {selectedOrder.order_details && selectedOrder.order_details.length > 0 && (
                <div className="bg-white border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b">
                    <h4 className="text-sm font-semibold text-gray-900">Order Items ({selectedOrder.order_details.length})</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Product
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quantity
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Price
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedOrder.order_details
                          .sort((a, b) => {
                            // First sort by category, then by product name within category
                            const categoryCompare = (a.products.category || '').localeCompare(b.products.category || '')
                            if (categoryCompare !== 0) return categoryCompare
                            return a.products.name.localeCompare(b.products.name)
                          })
                          .map((detail) => (
                          <tr key={detail.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{detail.products.name}</div>
                                {detail.products.sku && (
                                  <div className="text-xs text-gray-500">SKU: {detail.products.sku}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {detail.quantity} {detail.products.unit}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              ₱{detail.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              ₱{(detail.unit_price * detail.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

          </div>
        </Modal>
      )}

      {/* Returnable Pans Image Modal */}
      {showReturnablePansModal && selectedReturnablePansImage && (
        <Modal backdropClassName="bg-gray-600/50">
          <div className="mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                Returnable Pans Image
                {(() => {
                  const returnablePans = getReturnablePans(selectedReturnablePansOrder)
                  return returnablePans.total > 0 ? ` (${returnablePans.total} pans)` : ''
                })()}
              </h3>
              <button
                onClick={() => {
                  setShowReturnablePansModal(false)
                  setSelectedReturnablePansImage(null)
                  setSelectedReturnablePansOrder(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="text-center flex-1 flex items-center justify-center overflow-auto">
              <img
                src={selectedReturnablePansImage}
                alt="Returnable pans"
                className="max-h-[70vh] w-auto rounded-lg border"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Deposit Slip Image Modal */}
      {showDepositSlipModal && selectedDepositSlipImage && (
        <Modal backdropClassName="bg-gray-600/50">
          <div className="mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                Deposit Slip
                {selectedDepositSlipOrder && ` - ₱${getOrderTotalAmount(selectedDepositSlipOrder).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </h3>
              <button
                onClick={() => {
                  setShowDepositSlipModal(false)
                  setSelectedDepositSlipImage(null)
                  setSelectedDepositSlipOrder(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="text-center flex-1 flex items-center justify-center overflow-auto">
              <img
                src={selectedDepositSlipImage}
                alt="Deposit slip"
                className="max-h-[70vh] w-auto rounded-lg border"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
