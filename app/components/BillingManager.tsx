'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { CreditCard, Check, Eye, Download, X, Printer } from 'lucide-react'
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
  notes?: string
  created_at: string
  updated_at: string
  location?: {
    id: string
    name: string
    franchisee?: string
    contact_number?: string
  }
  brand?: {
    id: string
    name: string
  }
  order_details?: Array<{
    id: string
    product_id: string
    quantity: number
    unit_price: number
    product: {
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
  const [releasedOrders, setReleasedOrders] = useState<PaidOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<PaidOrder | null>(null)
  const [showOrderDetails, setShowOrderDetails] = useState(false)
  const [totalReceivable, setTotalReceivable] = useState(0)
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month' | 'year'>('month')

  useEffect(() => {
    if (selectedBrand) {
      fetchPaidOrders()
      fetchReleasedOrders()
      fetchTotalReceivable()
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
            fetchPaidOrders()
            fetchReleasedOrders()
            fetchTotalReceivable()
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
      case 'day':
        // Today in Philippines timezone: 00:00:00 to 23:59:59
        start = new Date(phYear, phMonth, phDay, 0, 0, 0)
        end = new Date(phYear, phMonth, phDay, 23, 59, 59, 999)
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
      
      const { data, error } = await supabase
        .from('customer_orders')
        .select(`
          *,
          location:locations(*),
          brand:brands(*),
          order_details(
            *,
            product:products(id, name, sku, unit, category)
          )
        `)
        .eq('brand_id', selectedBrand.id)
        .in('status', ['paid', 'complete'])
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching paid orders:', error)
        return
      }
      
      if (data) {
        setPaidOrders(data)
      }
    } catch (error) {
      console.error('Error fetching paid orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchReleasedOrders = async () => {
    if (!selectedBrand) return
    
    try {
      const { data, error } = await supabase
        .from('customer_orders')
        .select(`
          *,
          location:locations(*),
          brand:brands(*),
          order_details(
            *,
            product:products(id, name, sku, unit, category)
          )
        `)
        .eq('brand_id', selectedBrand.id)
        .eq('status', 'released')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      if (data) {
        setReleasedOrders(data)
      }
    } catch (error) {
      console.error('Error fetching released orders:', error)
    }
  }

  const fetchTotalReceivable = async () => {
    if (!selectedBrand) return
    
    try {
      const { data, error } = await supabase
        .from('customer_orders')
        .select('total_amount')
        .eq('brand_id', selectedBrand.id)
        .eq('status', 'released')
      
      if (error) throw error
      
      const receivable = data?.reduce((total, order) => total + (order.total_amount || 0), 0) || 0
      setTotalReceivable(receivable)
    } catch (error) {
      console.error('Error fetching receivables:', error)
    }
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

  const getCategoryTotals = (order: PaidOrder) => {
    if (!order.order_details) return []
    
    const categoryMap = new Map()
    
    order.order_details.forEach(detail => {
      // Debug: log the product data to see what's being fetched
      console.log('Product data:', detail.product)
      
      // Check if category exists and is not null/undefined/empty
      const category = detail.product?.category && detail.product.category.trim() !== '' 
        ? detail.product.category 
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
  }

  const getTotalAmount = (order: PaidOrder) => {
    return order.order_details?.reduce((total, detail) => total + (detail.unit_price * detail.quantity), 0) || 0
  }

  const getSubtotalAmount = (order: PaidOrder) => {
    return order.order_details?.reduce((total, detail) => total + (detail.unit_price * detail.quantity), 0) || 0
  }

  const calculateTotalRevenue = () => {
    return paidOrders.reduce((total, order) => total + (order.total_amount || 0), 0)
  }

  const calculateTotalPaid = () => {
    return paidOrders.reduce((total, order) => total + (order.total_amount || 0), 0)
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
              padding: 16px;
              text-align: center;
              border-bottom: 2px solid black;
            }
            
            .company-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 4px;
            }
            
            .receipt-title {
              font-size: 14px;
              opacity: 0.9;
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
              padding: 4px 12px;
              border-bottom: 1px solid #e5e7eb;
              font-size: 11px;
            }
            
            .item-checkbox {
              width: 14px;
              height: 14px;
              border: 1px solid black;
              background: white;
              cursor: pointer;
            }
            
            .item-details {
              flex: 1;
              margin-left: 8px;
            }
            
            .item-name {
              font-weight: bold;
              margin-bottom: 2px;
            }
            
            .item-sku {
              color: #6b7280;
              font-size: 10px;
            }
            
            .item-qty {
              font-weight: bold;
              min-width: 30px;
              text-align: center;
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
            
            <div class="items-section">
              <div class="items-header">Items</div>
              ${order.order_details?.map(detail => `
                <div class="item-row">
                  <div class="item-checkbox"></div>
                  <div class="item-details">
                    <div class="item-name">${detail.product?.name || 'N/A'}</div>
                    <div class="item-sku">SKU: ${detail.product?.sku || 'N/A'} | ${detail.product?.unit || 'N/A'}</div>
                  </div>
                  <div class="item-qty">${detail.quantity}</div>
                </div>
              `).join('') || ''}
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
                <span class="total-value">₱${order.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            
            <div class="footer">
              <div class="footer-text">Thank you for your order!</div>
              <div class="footer-date">Generated on ${new Date().toLocaleString()}</div>
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
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Billing Manager</h3>
          <p className="text-gray-600">Track unpaid orders and manage paid orders by status</p>
        </div>
      </div>

      {/* Time Filter */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Time Period:</label>
          <div className="flex space-x-2">
            {(['day', 'week', 'month', 'year'] as const).map((period) => (
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
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h4 className="text-lg font-medium mb-4">Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600 font-medium">Total Revenue</p>
            <p className="text-2xl font-bold text-green-900">₱{calculateTotalRevenue().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-green-700 mt-1">{paidOrders.length} paid orders</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600 font-medium">Total Paid</p>
            <p className="text-2xl font-bold text-blue-900">₱{calculateTotalPaid().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-blue-700 mt-1">Ready for completion</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-orange-600 font-medium">Total Receivable</p>
            <p className="text-2xl font-bold text-orange-900">₱{totalReceivable.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-orange-700 mt-1">{releasedOrders.length} unpaid orders</p>
          </div>
        </div>
      </div>

      {/* Released Orders (Unpaid) */}
      {releasedOrders.length > 0 && (
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
                    Items
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
                {releasedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-orange-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-middle">
                      {order.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      {formatPhilippinesDateTime(order.created_at, { dateStyle: 'short' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      {order.location?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600 align-middle">
                      ₱{order.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      {getTotalItems(order)} items
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
        <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
          <h4 className="text-lg font-medium text-blue-900">Paid & Completed Orders</h4>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : paidOrders.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Paid Orders</h3>
            <p className="text-gray-600">There are no paid or completed orders in the selected time period.</p>
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
                    Items
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
                  <tr key={order.id} className="hover:bg-blue-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-middle">
                      {order.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      {formatPhilippinesDateTime(order.created_at, { dateStyle: 'short' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      {order.location?.name || 'N/A'}
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
                      ₱{order.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      {getTotalItems(order)} items
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-middle">
                      {order.deposit_slip_url ? (
                        <a
                          href={order.deposit_slip_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          View
                        </a>
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

      {releasedOrders.length === 0 && paidOrders.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Billing Activity</h3>
          <p className="text-gray-600">There are no paid or unpaid orders to manage.</p>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
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
            <div className="space-y-6">
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
                    <p className="text-sm font-semibold text-gray-900 mt-1">{selectedOrder.location?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Total Amount</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">₱{selectedOrder.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
                        <span className="text-sm font-semibold text-green-600">₱{selectedOrder.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                      <a
                        href={selectedOrder.deposit_slip_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm mt-1"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View full size
                      </a>
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
                            Unit Price
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedOrder.order_details.map((detail) => (
                          <tr key={detail.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{detail.product.name}</div>
                                {detail.product.sku && (
                                  <div className="text-xs text-gray-500">SKU: {detail.product.sku}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {detail.quantity} {detail.product.unit}
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
    </div>
  )
}
