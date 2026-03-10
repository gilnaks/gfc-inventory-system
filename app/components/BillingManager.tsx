'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { CreditCard, Check, Eye, Download, X, Printer, Building2, Building, Store } from 'lucide-react'
import { formatPhilippinesDateTime } from '../../lib/timezone'

interface PaidOrder {
  id: string
  location_id: string
  brand_id: string
  customer_name: string
  status: string
  total_amount: number
  delivery_type: 'delivery' | 'pickup'
  deposit_slip_url?: string
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
}

export function BillingManager({ selectedBrand, theme = 'blue' }: BillingManagerProps) {
  const [paidOrders, setPaidOrders] = useState<PaidOrder[]>([])
  const [completedOrders, setCompletedOrders] = useState<PaidOrder[]>([])
  const [fulfilledOrders, setFulfilledOrders] = useState<PaidOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<PaidOrder | null>(null)
  const [showOrderDetails, setShowOrderDetails] = useState(false)
  const [totalReceivable, setTotalReceivable] = useState(0)
  const [timeFilter, setTimeFilter] = useState<'all' | 'week' | 'month' | 'year'>('all')
  const [showReturnablePansModal, setShowReturnablePansModal] = useState(false)
  const [selectedReturnablePansImage, setSelectedReturnablePansImage] = useState<string | null>(null)
  const [selectedReturnablePansOrder, setSelectedReturnablePansOrder] = useState<PaidOrder | null>(null)
  const [showDepositSlipModal, setShowDepositSlipModal] = useState(false)
  const [selectedDepositSlipImage, setSelectedDepositSlipImage] = useState<string | null>(null)
  const [selectedDepositSlipOrder, setSelectedDepositSlipOrder] = useState<PaidOrder | null>(null)
  const [completedOrdersPage, setCompletedOrdersPage] = useState(1)
  const completedOrdersPerPage = 10

  // Helper function to get franchise icon color based on theme
  const getFranchiseIconColor = () => {
    switch (theme) {
      case 'green':
        return 'text-green-600'
      case 'red':
        return 'text-red-600'
      case 'yellow':
        return 'text-yellow-600'
      default:
        return 'text-blue-600'
    }
  }

  useEffect(() => {
    if (selectedBrand) {
      fetchPaidOrders() // Now fetches all data in one call
      setCompletedOrdersPage(1) // Reset pagination when filter changes
    }
  }, [selectedBrand, timeFilter])

  // Realtime subscription for order updates
  useEffect(() => {
    if (!selectedBrand) return

    const channel = supabase
      .channel('billing-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_orders',
          filter: `brand_id=eq.${selectedBrand.id}`
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
  }, [selectedBrand])

  const getDateRange = () => {
    const now = new Date()
    
    // Get current date in Philippines timezone
    const philippinesFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    
    const philippinesDateParts = philippinesFormatter.formatToParts(now)
    const phYear = parseInt(philippinesDateParts.find(part => part.type === 'year')!.value)
    const phMonth = parseInt(philippinesDateParts.find(part => part.type === 'month')!.value) - 1 // 0-indexed
    const phDay = parseInt(philippinesDateParts.find(part => part.type === 'day')!.value)
    
    let start: Date
    let end: Date
    
    switch (timeFilter) {
      case 'all':
        // All time - no date filtering
        start = new Date(0) // January 1, 1970
        end = new Date() // Current time
        break
      case 'week':
        // Last 7 days in Philippines timezone
        const weekStartDate = new Date(phYear, phMonth, phDay - 6)
        start = new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate(), 0, 0, 0)
        end = new Date(phYear, phMonth, phDay, 23, 59, 59, 999)
        break
      case 'month':
        // Current month in Philippines timezone
        start = new Date(phYear, phMonth, 1, 0, 0, 0)
        const lastDay = new Date(phYear, phMonth + 1, 0).getDate()
        end = new Date(phYear, phMonth, lastDay, 23, 59, 59, 999)
        break
      case 'year':
        // Current year in Philippines timezone
        start = new Date(phYear, 0, 1, 0, 0, 0)
        end = new Date(phYear, 11, 31, 23, 59, 59, 999)
        break
      default:
        start = new Date(phYear, phMonth, phDay, 0, 0, 0)
        end = new Date(phYear, phMonth, phDay, 23, 59, 59, 999)
    }
    
    
    return {
      start: start.toISOString(),
      end: end.toISOString()
    }
  }

  const fetchPaidOrders = async () => {
    if (!selectedBrand) return
    
    setLoading(true)
    try {
      const { start, end } = getDateRange()
      
      // Batch fetch all orders with a single query using .in()
      const { data: allOrders, error } = await supabase
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
        .eq('brand_id', selectedBrand.id)
        .in('status', ['paid', 'complete', 'fulfilled'])
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching orders:', error)
        return
      }
      
      if (allOrders) {
        // Filter paid orders with date range
        const paidData = allOrders.filter(order => 
          order.status === 'paid' && 
          order.created_at >= start && 
          order.created_at <= end
        )
        
        // Filter completed orders with date range
        const completedData = allOrders.filter(order => 
          order.status === 'complete' && 
          order.created_at >= start && 
          order.created_at <= end
        )
        
        // Filter fulfilled orders (no date range)
        const fulfilledData = allOrders.filter(order => order.status === 'fulfilled')
        
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

  const handleMarkComplete = async (orderId: string) => {
    if (!confirm('Are you sure you want to mark this order as complete?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('customer_orders')
        .update({
          status: 'complete',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)

      if (error) {
        console.error('Error updating order:', error)
        alert('Error updating order')
        return
      }

      // Remove from paid orders list
      setPaidOrders(prev => prev.filter(order => order.id !== orderId))
      
      // Close details modal if this order was selected
      if (selectedOrder?.id === orderId) {
        setShowOrderDetails(false)
        setSelectedOrder(null)
      }
    } catch (error) {
      console.error('Error updating order:', error)
      alert('Error updating order')
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

  // Pagination logic for completed orders
  const getCompletedOrdersForPage = () => {
    const startIndex = (completedOrdersPage - 1) * completedOrdersPerPage
    const endIndex = startIndex + completedOrdersPerPage
    return completedOrders.slice(startIndex, endIndex)
  }

  const getTotalCompletedPages = () => {
    return Math.ceil(completedOrders.length / completedOrdersPerPage)
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

  const isCompanyOwned = (order: PaidOrder) => {
    return order.location?.company_owned === true
  }

  const getSubtotalAmount = (order: PaidOrder) => {
    return order.order_details?.reduce((total, detail) => total + (detail.unit_price * detail.quantity), 0) || 0
  }

  // Compute total from order_details (matches order creation & logistics formula)
  const getOrderTotalAmount = useCallback((order: PaidOrder) => {
    const subtotal = order.order_details?.reduce((total, detail) => total + (detail.unit_price * detail.quantity), 0) || 0
    if (order.delivery_type === 'delivery') {
      return subtotal >= 10000 ? subtotal : subtotal + 500
    }
    if (order.delivery_type === 'pickup') {
      return subtotal >= 10000 ? subtotal * 0.95 : subtotal
    }
    return subtotal
  }, [])

  // Memoized revenue calculations (use computed amount from order_details to match logistics)
  const calculateTotalPaid = useMemo(() => {
    return paidOrders.reduce((total, order) => total + getOrderTotalAmount(order), 0)
  }, [paidOrders])

  const calculateTotalCompleted = useMemo(() => {
    return completedOrders.reduce((total, order) => total + getOrderTotalAmount(order), 0)
  }, [completedOrders])

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
    const completedMyChoice = completedOrders
      .filter(order => isMyChoiceCompanyOwned(order))
      .reduce((total, order) => total + getOrderTotalAmount(order), 0)
    return paidMyChoice + completedMyChoice
  }, [paidOrders, completedOrders])

  const calculateFranchiseRevenue = useMemo(() => {
    const paidFranchise = paidOrders
      .filter(order => !isMyChoiceCompanyOwned(order))
      .reduce((total, order) => total + getOrderTotalAmount(order), 0)
    const completedFranchise = completedOrders
      .filter(order => !isMyChoiceCompanyOwned(order))
      .reduce((total, order) => total + getOrderTotalAmount(order), 0)
    return paidFranchise + completedFranchise
  }, [paidOrders, completedOrders])

  const getMyChoiceCompanyOwnedOrders = useMemo(() => {
    const paidMyChoice = paidOrders.filter(order => isMyChoiceCompanyOwned(order))
    const completedMyChoice = completedOrders.filter(order => isMyChoiceCompanyOwned(order))
    return [...paidMyChoice, ...completedMyChoice]
  }, [paidOrders, completedOrders])

  const getFranchiseOrders = useMemo(() => {
    const paidFranchise = paidOrders.filter(order => !isMyChoiceCompanyOwned(order))
    const completedFranchise = completedOrders.filter(order => !isMyChoiceCompanyOwned(order))
    return [...paidFranchise, ...completedFranchise]
  }, [paidOrders, completedOrders])

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

  const printTransferSheet = (order: PaidOrder) => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Transfer Sheet - Order ${order.id.slice(0, 8)}</title>
          <style>
            * { box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
              background: white;
              color: black;
            }
            
            .receipt-container {
              max-width: 400px;
              margin: 0 auto;
              background: white;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              border-radius: 8px;
              overflow: hidden;
              display: flex;
              flex-direction: column;
            }
            
            .header {
              background: #1f2937;
              color: white;
              padding: 12px 16px;
              text-align: center;
              border-bottom: 2px solid black;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .company-name {
              font-size: 18px;
              font-weight: bold;
            }
            
            .receipt-title {
              font-size: 14px;
              opacity: 0.9;
            }
            
            .generated-date {
              font-size: 10px;
              color: #6b7280;
              text-align: center;
              flex: 1;
            }
            
            .order-info { 
              padding: 8px 12px; 
              background: white;
              border-bottom: 1px solid black;
            }
            
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              font-size: 12px;
            }
            
            .info-item {
              display: flex;
              flex-direction: column;
            }
            
            .info-label {
              font-weight: bold;
              color: #374151;
              margin-bottom: 2px;
            }
            
            .info-value {
              color: black;
              padding: 2px 6px;
              border: 1px solid black;
              font-size: 11px;
              font-weight: normal;
            }
            
            .items-section {
              background: white;
              border-bottom: 1px solid black;
            }
            
            .items-multi-column {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
            }
            
            .items-column {
              display: flex;
              flex-direction: column;
            }
            
            .items-header {
              background: #f3f4f6;
              padding: 8px 12px;
              font-weight: bold;
              font-size: 12px;
              border-bottom: 1px solid black;
            }
            
            .item-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 2px 12px;
              border-bottom: 1px solid #e5e7eb;
              font-size: 9px;
              min-height: 18px;
            }
            
            .item-checkbox {
              width: 12px;
              height: 12px;
              border: 1px solid black;
              background: white;
              cursor: pointer;
              flex-shrink: 0;
            }
            
            .item-details {
              flex: 1;
              margin-left: 6px;
            }
            
            .item-name {
              font-weight: bold;
              margin-bottom: 1px;
              font-size: 9px;
            }
            
            .item-sku {
              color: #6b7280;
              font-size: 8px;
            }
            
            .item-qty {
              font-weight: bold;
              min-width: 25px;
              text-align: center;
              font-size: 9px;
            }
            
            .notes {
              background: white;
              border: 1px solid black;
              margin: 0 12px 8px;
            }
            
            .notes-title {
              background: #f3f4f6;
              padding: 4px 8px;
              font-weight: bold;
              font-size: 11px;
              border-bottom: 1px solid black;
            }
            
            .notes-text {
              padding: 8px;
              font-size: 11px;
            }
            
            .total-section {
              background: white;
              border-top: 1px solid black;
            }
            
            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
              border-bottom: 1px solid #ccc;
            }
            
            .item-row:last-child {
              border-bottom: none;
            }
            
            .total-label {
              font-size: 11px;
              font-weight: normal;
            }
            
            .total-value {
              font-size: 11px;
              font-weight: bold;
            }
            
            .grand-total {
              border-top: 1px solid black;
              padding-top: 4px;
              margin-top: 4px;
            }
            
            .footer {
              background: #f9fafb;
              padding: 12px;
              text-align: center;
              border-top: 1px solid black;
            }
            
            .footer-text {
              font-size: 12px;
              font-weight: bold;
              margin-bottom: 4px;
            }
            
            .footer-date {
              font-size: 10px;
              color: #6b7280;
            }
            
            .notes {
              background: white;
              border: 1px solid black;
              margin: 0 12px 8px;
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div class="company-name">${order.brand?.name || 'Company'}</div>
              <div class="generated-date">Generated on ${new Date().toLocaleString()}</div>
              <div class="receipt-title">Stock Transfer Sheet</div>
            </div>
            
            <div class="order-info">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Order ID</span>
                  <span class="info-value">${order.id.slice(0, 8)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Date (PST)</span>
                  <span class="info-value">${formatPhilippinesDateTime(order.created_at, { dateStyle: 'short' })}</span>
                </div>
                <div class="info-item">
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
            
            <div class="items-section ${order.order_details?.length > 15 ? 'items-multi-column' : ''}">
              ${order.order_details?.length > 15 ? `
                <div class="items-column">
              <div class="items-header">Items</div>
                  ${order.order_details?.sort((a, b) => {
                    const categoryA = a.products?.category && a.products.category.trim() !== '' ? a.products.category : 'Uncategorized'
                    const categoryB = b.products?.category && b.products.category.trim() !== '' ? b.products.category : 'Uncategorized'
                    return categoryA.localeCompare(categoryB)
                  }).slice(0, Math.ceil(order.order_details.length / 2)).map(detail => `
                <div class="item-row">
                  <div class="item-checkbox"></div>
                  <div class="item-details">
                        <div class="item-name">${detail.products?.name || 'N/A'}</div>
                        <div class="item-sku">SKU: ${detail.products?.sku || 'N/A'} | ${detail.products?.unit || 'N/A'}</div>
                  </div>
                  <div class="item-qty">${detail.quantity}</div>
                </div>
              `).join('') || ''}
                </div>
                <div class="items-column">
                  <div class="items-header">Items</div>
                  ${order.order_details?.sort((a, b) => {
                    const categoryA = a.products?.category && a.products.category.trim() !== '' ? a.products.category : 'Uncategorized'
                    const categoryB = b.products?.category && b.products.category.trim() !== '' ? b.products.category : 'Uncategorized'
                    return categoryA.localeCompare(categoryB)
                  }).slice(Math.ceil(order.order_details.length / 2)).map(detail => `
                    <div class="item-row">
                      <div class="item-checkbox"></div>
                      <div class="item-details">
                        <div class="item-name">${detail.products?.name || 'N/A'}</div>
                        <div class="item-sku">SKU: ${detail.products?.sku || 'N/A'} | ${detail.products?.unit || 'N/A'}</div>
                      </div>
                      <div class="item-qty">${detail.quantity}</div>
                    </div>
                  `).join('') || ''}
                </div>
              ` : `
                <div class="items-header">Items</div>
                ${order.order_details?.sort((a, b) => {
                  const categoryA = a.products?.category && a.products.category.trim() !== '' ? a.products.category : 'Uncategorized'
                  const categoryB = b.products?.category && b.products.category.trim() !== '' ? b.products.category : 'Uncategorized'
                  return categoryA.localeCompare(categoryB)
                }).map(detail => `
                  <div class="item-row">
                    <div class="item-checkbox"></div>
                    <div class="item-details">
                      <div class="item-name">${detail.products?.name || 'N/A'}</div>
                      <div class="item-sku">SKU: ${detail.products?.sku || 'N/A'} | ${detail.products?.unit || 'N/A'}</div>
                    </div>
                    <div class="item-qty">${detail.quantity}</div>
                  </div>
                `).join('') || ''}
              `}
            </div>
            
            ${order.notes ? `
              <div class="notes">
                <div class="notes-title">Notes</div>
                <div class="notes-text">${order.notes}</div>
              </div>
            ` : ''}
            
            <div class="total-section">
              ${getCategoryTotals(order).map(categoryTotal => `
                <div class="total-row">
                  <span class="total-label">${categoryTotal.category}: ${categoryTotal.totalQuantity} items</span>
                  <span class="total-value">₱${categoryTotal.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              `).join('')}
              <div class="total-row">
                <span class="total-label">Subtotal</span>
                <span class="total-value">₱${getSubtotalAmount(order).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              ${order.delivery_type === 'delivery' ? `
                <div class="total-row">
                  <span class="total-label">Delivery Fee</span>
                  <span class="total-value">${getSubtotalAmount(order) >= 10000 ? 'FREE (Order over ₱10k)' : '+₱500.00'}</span>
                </div>
              ` : ''}
              ${order.delivery_type === 'pickup' && getSubtotalAmount(order) >= 10000 ? `
                <div class="total-row">
                  <span class="total-label">Pickup Discount (5%)</span>
                  <span class="total-value">-₱${(getSubtotalAmount(order) * 0.05).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              ` : ''}
              ${order.delivery_type === 'pickup' && getSubtotalAmount(order) < 10000 ? `
                <div class="total-row">
                  <span class="total-label">Pickup Discount</span>
                  <span class="total-value">Not available (Order under ₱10k)</span>
                </div>
              ` : ''}
              <div class="total-row grand-total">
                <span class="total-label">Total Amount</span>
                <span class="total-value">₱${getOrderTotalAmount(order).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            
          </div>
        </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    }
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Billing</h1>
          <p className="text-sm text-gray-600">Track unpaid orders and manage paid orders by status</p>
        </div>
      </div>

      {/* Time Filter */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Time Period:</label>
          <div className="flex space-x-2">
            {(['all', 'week', 'month', 'year'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setTimeFilter(period)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  timeFilter === period
                    ? theme === 'green' ? 'bg-green-100 text-green-700 border border-green-300' :
                      theme === 'red' ? 'bg-red-100 text-red-700 border border-red-300' :
                      theme === 'yellow' ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' :
                      'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                }`}
              >
                {period === 'all' ? 'All Time' : period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

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
              <p className="text-xs text-green-700 mt-1">{paidOrders.length + completedOrders.length} total orders</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">Paid Orders</p>
              <p className="text-2xl font-bold text-purple-900">₱{calculateTotalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-purple-700 mt-1">{paidOrders.length} paid orders</p>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg">
              <p className="text-sm text-indigo-600 font-medium">Completed Orders</p>
              <p className="text-2xl font-bold text-indigo-900">₱{calculateTotalCompleted.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-indigo-700 mt-1">{completedOrders.length} completed orders</p>
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
                          <Building2 className="h-4 w-4 mr-2 text-blue-600" />
                        ) : (
                          <Store className={`h-4 w-4 mr-2 ${getFranchiseIconColor()}`} />
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
                          <Building2 className="h-4 w-4 mr-2 text-blue-600" />
                        ) : (
                          <Store className={`h-4 w-4 mr-2 ${getFranchiseIconColor()}`} />
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-middle">
                      <div className="flex space-x-2 items-center">
                        <button
                          onClick={() => handleViewDetails(order)}
                          className={`p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out`}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {order.status === 'paid' && (
                          <button
                            onClick={() => handleMarkComplete(order.id)}
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
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-medium text-indigo-900">Completed Orders ({completedOrders.length})</h4>
            {completedOrders.length > completedOrdersPerPage && (
              <div className="text-sm text-indigo-700">
                Page {completedOrdersPage} of {getTotalCompletedPages()}
              </div>
            )}
          </div>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : completedOrders.length === 0 ? (
          <div className="p-12 text-center">
            <Check className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Completed Orders</h3>
            <p className="text-gray-600">There are no completed orders in the selected time period.</p>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getCompletedOrdersForPage().map((order) => (
                  <tr key={order.id} className="hover:bg-indigo-100 hover:shadow-md transition-all duration-75">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-middle">
                      {order.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      {formatPhilippinesDateTime(order.created_at, { dateStyle: 'short' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      <div className="flex items-center">
                        {isCompanyOwned(order) ? (
                          <Building2 className="h-4 w-4 mr-2 text-blue-600" />
                        ) : (
                          <Store className={`h-4 w-4 mr-2 ${getFranchiseIconColor()}`} />
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
        {completedOrders.length > completedOrdersPerPage && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((completedOrdersPage - 1) * completedOrdersPerPage) + 1} to {Math.min(completedOrdersPage * completedOrdersPerPage, completedOrders.length)} of {completedOrders.length} orders
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

      {fulfilledOrders.length === 0 && paidOrders.length === 0 && completedOrders.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Billing Activity</h3>
          <p className="text-gray-600">There are no paid or unpaid orders to manage.</p>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col">
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
                        <Building2 className="h-4 w-4 mr-2 text-blue-600" />
                      ) : (
                        <Store className="h-4 w-4 mr-2 text-green-600" />
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
        </div>
      )}

      {/* Returnable Pans Image Modal */}
      {showReturnablePansModal && selectedReturnablePansImage && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col">
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
        </div>
      )}

      {/* Deposit Slip Image Modal */}
      {showDepositSlipModal && selectedDepositSlipImage && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col">
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
        </div>
      )}
    </div>
  )
}
