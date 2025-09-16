'use client'
import { useState, useEffect } from 'react'
import { supabase, Brand } from '../../lib/supabase'
import { ShoppingCart, Package, CheckCircle, Clock, XCircle, Eye, Truck, Printer, Trash2 } from 'lucide-react'
import { formatPhilippinesDateTime } from '../../lib/timezone'

interface Location {
  id: string
  name: string
  passkey: string
  franchisee?: string
}

interface CustomerOrder {
  id: string
  location_id: string
  brand_id: string
  customer_name: string
  customer_contact?: string
  status: 'pending' | 'approved' | 'released' | 'cancelled'
  total_amount: number
  notes?: string
  created_at: string
  updated_at: string
  location: Location
  brand: Brand
  order_details: OrderDetail[]
}

interface OrderDetail {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  product: {
    id: string
    name: string
    sku?: string
    unit: string
  }
}

interface OrderManagerProps {
  selectedBrand: Brand | null
  onOrderUpdate?: () => void
  theme?: string
}

export function OrderManager({ selectedBrand, onOrderUpdate, theme = 'blue' }: OrderManagerProps) {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchOrders()
  }, [statusFilter, selectedBrand])

  // Realtime subscription for customer orders changes
  useEffect(() => {
    if (!selectedBrand) return

    const channel = supabase
      .channel('customer-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'customer_orders',
          filter: `brand_id=eq.${selectedBrand.id}`
        },
        (payload) => {
          console.log('Customer orders realtime update:', payload)
          
          // Only refetch if we're not currently updating an order
          // This prevents the realtime update from interfering with ongoing operations
          if (!updatingOrder) {
            fetchOrders()
          } else {
            console.log('Skipping realtime refetch - currently updating order')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedBrand, updatingOrder])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('customer_orders')
        .select(`
          *,
          location:locations(*),
          brand:brands(*),
          order_details(
            *,
            product:products(id, name, sku, unit)
          )
        `)
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (selectedBrand) {
        query = query.eq('brand_id', selectedBrand.id)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching orders:', error)
        return
      }

      if (data) {
        setOrders(data)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    // Prevent double execution
    if (updatingOrder === orderId) {
      console.log('Order update already in progress for:', orderId)
      return
    }
    
    setUpdatingOrder(orderId)
    
    try {
      // If releasing order, update product quantities
      if (newStatus === 'released') {
        // First get the order details to know which products and quantities to update
        const { data: orderDetails, error: detailsError } = await supabase
          .from('order_details')
          .select('product_id, quantity')
          .eq('order_id', orderId)

        if (detailsError) {
          console.error('Error fetching order details:', detailsError)
          alert('Failed to fetch order details')
          return
        }

        // Update product quantities: move from reserved to released
        for (const detail of orderDetails || []) {
          // First get current quantities
          const { data: productData, error: fetchError } = await supabase
            .from('products')
            .select('reserved, released')
            .eq('id', detail.product_id)
            .single()

          if (fetchError) {
            console.error('Error fetching product data:', fetchError)
            alert('Failed to fetch product data')
            return
          }

          const newReserved = Math.max(0, (productData?.reserved || 0) - detail.quantity)
          const newReleased = (productData?.released || 0) + detail.quantity

          const { error: updateError } = await supabase
            .from('products')
            .update({
              reserved: newReserved,
              released: newReleased,
              updated_at: new Date().toISOString()
            })
            .eq('id', detail.product_id)

          if (updateError) {
            console.error('Error updating product quantities:', updateError)
            alert('Failed to update product quantities')
            return
          }
        }
      }

      // If cancelling order, return reserved quantities to available
      if (newStatus === 'cancelled') {
        // First get the order details to know which products and quantities to update
        const { data: orderDetails, error: detailsError } = await supabase
          .from('order_details')
          .select('product_id, quantity')
          .eq('order_id', orderId)

        if (detailsError) {
          console.error('Error fetching order details:', detailsError)
          alert('Failed to fetch order details')
          return
        }

        // Update product quantities: remove from reserved
        for (const detail of orderDetails || []) {
          // First get current reserved quantity
          const { data: productData, error: fetchError } = await supabase
            .from('products')
            .select('reserved')
            .eq('id', detail.product_id)
            .single()

          if (fetchError) {
            console.error('Error fetching product data:', fetchError)
            alert('Failed to fetch product data')
            return
          }

          const newReserved = Math.max(0, (productData?.reserved || 0) - detail.quantity)

          const { error: updateError } = await supabase
            .from('products')
            .update({
              reserved: newReserved,
              updated_at: new Date().toISOString()
            })
            .eq('id', detail.product_id)

          if (updateError) {
            console.error('Error updating product quantities:', updateError)
            alert('Failed to update product quantities')
            return
          }
        }
      }

      // Update the order status
      const { error } = await supabase
        .from('customer_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId)

      if (error) {
        console.error('Error updating order status:', error)
        alert('Failed to update order status')
        return
      }

      // Refresh orders and trigger product refresh
      fetchOrders()
      if (onOrderUpdate) {
        onOrderUpdate()
      }
    } catch (error) {
      console.error('Error updating order status:', error)
      alert('Failed to update order status')
    } finally {
      setUpdatingOrder(null)
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) return

    try {
      setUpdatingOrder(orderId)

      // First delete the order details
      const { error: detailsError } = await supabase
        .from('order_details')
        .delete()
        .eq('order_id', orderId)

      if (detailsError) {
        console.error('Error deleting order details:', detailsError)
        alert('Failed to delete order details')
        return
      }

      // Then delete the order
      const { error } = await supabase
        .from('customer_orders')
        .delete()
        .eq('id', orderId)

      if (error) {
        console.error('Error deleting order:', error)
        alert('Failed to delete order')
        return
      }

      // Refresh orders and trigger product refresh
      fetchOrders()
      if (onOrderUpdate) {
        onOrderUpdate()
      }
    } catch (error) {
      console.error('Error deleting order:', error)
      alert('Failed to delete order')
    } finally {
      setUpdatingOrder(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-blue-500" />
      case 'released':
        return <Truck className="h-4 w-4 text-green-500" />
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-blue-100 text-blue-800'
      case 'released':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTotalItems = (order: CustomerOrder) => {
    return order.order_details.reduce((total, detail) => total + detail.quantity, 0)
  }

  const getTotalAmount = (order: CustomerOrder) => {
    return order.order_details.reduce((total, detail) => total + (detail.unit_price * detail.quantity), 0)
  }

  const printReceipt = () => {
    if (!selectedOrder) return

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - Order ${selectedOrder.id.slice(0, 8)}</title>
          <style>
            
            * { box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 10px; 
              background: white;
              color: black;
              line-height: 1.4;
            }
            
            .receipt-container {
              max-width: 100%;
              width: 100%;
              margin: 0;
              background: white;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              border-radius: 8px;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              min-height: 100vh;
            }
            
            .header { 
              text-align: center; 
              padding: 16px 20px;
              background: white;
              color: black;
              border-bottom: 2px solid black;
            }
            
            .company-name { 
              font-size: 23px; 
              font-weight: bold; 
              margin-bottom: 4px;
              color: black;
            }
            
            .receipt-title { 
              font-size: 15px; 
              font-weight: normal; 
              color: black;
            }
            
            .order-info { 
              padding: 8px 12px; 
              background: white;
              border-bottom: 1px solid black;
            }
            
            .info-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
              gap: 4px 12px;
            }
            
            .info-item {
              display: flex;
              flex-direction: column;
            }
            
            .info-label { 
              font-weight: normal; 
              color: #666;
              font-size: 12px;
              text-transform: uppercase;
              margin-bottom: 1px;
            }
            
            .info-value { 
              font-weight: normal; 
              color: black;
              font-size: 13px;
            }
            
            .status-badge {
              display: inline-block;
              padding: 2px 6px;
              border: 1px solid black;
              font-size: 11px;
              font-weight: normal;
              text-transform: uppercase;
            }
            
            .status-pending { background: white; color: black; }
            .status-approved { background: white; color: black; }
            .status-released { background: black; color: white; }
            .status-cancelled { background: white; color: black; }
            
            .items { 
              padding: 8px 12px;
              flex: 1;
            }
            
            .items-title {
              font-size: 13px;
              font-weight: bold;
              margin-bottom: 6px;
              color: black;
              text-transform: uppercase;
            }
            
            .items-header {
              display: grid;
              grid-template-columns: 30px 2fr 1fr 1fr 1fr;
              gap: 8px;
              padding: 4px 0;
              border-bottom: 1px solid black;
              margin-bottom: 4px;
            }
            
            .header-cell {
              font-size: 11px;
              font-weight: bold;
              color: black;
              text-transform: uppercase;
            }
            
            .header-checkbox { text-align: center; }
            .header-item { text-align: left; }
            .header-qty { text-align: center; }
            .header-price { text-align: center; }
            .header-total { text-align: right; }
            
            .item-checkbox {
              text-align: center;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            
            .checkbox {
              width: 14px;
              height: 14px;
              border: 1px solid black;
              background: white;
              cursor: pointer;
            }
            
            .item-row {
              display: grid;
              grid-template-columns: 30px 2fr 1fr 1fr 1fr;
              gap: 8px;
              align-items: center;
              padding: 4px 0;
              border-bottom: 1px solid #ccc;
            }
            
            .item-row:last-child {
              border-bottom: none;
            }
            
            .item-name {
              font-weight: normal;
              color: black;
              margin-bottom: 1px;
              font-size: 12px;
            }
            
            .item-details {
              font-size: 10px;
              color: #666;
            }
            
            .item-quantity {
              text-align: center;
              font-weight: normal;
              color: black;
              font-size: 12px;
            }
            
            .item-unit-price {
              text-align: center;
              font-weight: normal;
              color: black;
              font-size: 12px;
            }
            
            .item-price {
              text-align: right;
              font-weight: bold;
              color: black;
              font-size: 12px;
            }
            
            .total-section { 
              padding: 8px 12px;
              background: white;
              border-top: 1px solid black;
            }
            
            .total-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 4px;
            }
            
            .total-label {
              font-weight: normal;
              color: black;
              font-size: 12px;
            }
            
            .total-value {
              font-weight: normal;
              color: black;
              font-size: 12px;
            }
            
            .grand-total {
              border-top: 1px solid black;
              padding-top: 4px;
              margin-top: 4px;
            }
            
            .grand-total .total-label {
              font-size: 13px;
              font-weight: bold;
            }
            
            .grand-total .total-value {
              font-size: 14px;
              font-weight: bold;
              color: black;
            }
            
            .footer { 
              text-align: center; 
              padding: 6px 12px;
              background: black;
              color: white;
              margin-top: auto;
            }
            
            .footer-text {
              font-size: 11px;
              margin-bottom: 2px;
            }
            
            .footer-date {
              font-size: 10px;
            }
            
            .notes {
              padding: 6px 12px;
              background: white;
              border: 1px solid black;
              margin: 0 12px 8px;
            }
            
            .notes-title {
              font-weight: bold;
              color: black;
              margin-bottom: 2px;
              font-size: 11px;
            }
            
            .notes-text {
              color: black;
              font-size: 11px;
            }
            
            @media print { 
              body { margin: 0; padding: 0; }
              .receipt-container { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div class="company-name">${selectedOrder.brand?.name || 'Company'}</div>
              <div class="receipt-title">Order Receipt</div>
            </div>
            
            <div class="order-info">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Order ID</span>
                  <span class="info-value">${selectedOrder.id.slice(0, 8)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Date (PST)</span>
                  <span class="info-value">${formatPhilippinesDateTime(selectedOrder.created_at, { dateStyle: 'short' })}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Location</span>
                  <span class="info-value">${selectedOrder.location?.name || 'N/A'}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Franchisee</span>
                  <span class="info-value">${selectedOrder.location?.franchisee || 'N/A'}</span>
                </div>
              </div>
            </div>
            
            <div class="items">
              <div class="items-header">
                <div class="header-cell header-checkbox">✓</div>
                <div class="header-cell header-item">Item</div>
                <div class="header-cell header-qty">Quantity</div>
                <div class="header-cell header-price">Unit Price</div>
                <div class="header-cell header-total">Total</div>
              </div>
              ${selectedOrder.order_details.map(detail => `
                <div class="item-row">
                  <div class="item-checkbox">
                    <div class="checkbox"></div>
                  </div>
                  <div>
                    <div class="item-name">${detail.product.name}</div>
                    <div class="item-details">
                      ${detail.product.sku ? `SKU: ${detail.product.sku}` : ''}
                    </div>
                  </div>
                  <div class="item-quantity">${detail.quantity} ${detail.product.unit}</div>
                  <div class="item-unit-price">₱${detail.unit_price.toFixed(2)}</div>
                  <div class="item-price">₱${(detail.unit_price * detail.quantity).toFixed(2)}</div>
                </div>
              `).join('')}
            </div>
            
            ${selectedOrder.notes ? `
              <div class="notes">
                <div class="notes-title">Notes</div>
                <div class="notes-text">${selectedOrder.notes}</div>
              </div>
            ` : ''}
            
            <div class="total-section">
              <div class="total-row">
                <span class="total-label">Total Items</span>
                <span class="total-value">${getTotalItems(selectedOrder)}</span>
              </div>
              <div class="total-row grand-total">
                <span class="total-label">Total Amount</span>
                <span class="total-value">₱${getTotalAmount(selectedOrder).toFixed(2)}</span>
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
      printWindow.close()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Customer Orders</h3>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status Filter
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="released">Released</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading orders...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No orders found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-blue-100">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          #{order.id.slice(-8)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.brand?.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.location?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        <span className="ml-1 capitalize">{order.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatPhilippinesDateTime(order.created_at, { dateStyle: 'short' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getTotalItems(order)} items
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      ₱{getTotalAmount(order).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className={`p-1 rounded ${
                            theme === 'green' ? 'text-green-600 hover:text-green-900 hover:bg-green-100' :
                            theme === 'red' ? 'text-red-600 hover:text-red-900 hover:bg-red-100' :
                            theme === 'yellow' ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100' :
                            'text-blue-600 hover:text-blue-900 hover:bg-blue-100'
                          }`}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        
                        {order.status === 'pending' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'approved')}
                            disabled={updatingOrder === order.id}
                            className={`p-1 rounded ${updatingOrder === order.id ? 'text-gray-400 cursor-not-allowed' : 'text-green-600 hover:text-green-900 hover:bg-green-100'}`}
                            title="Approve Order"
                          >
                            {updatingOrder === order.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        
                        {order.status === 'approved' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'released')}
                            disabled={updatingOrder === order.id}
                            className={`p-1 rounded ${updatingOrder === order.id ? 'text-gray-400 cursor-not-allowed' : 
                              theme === 'green' ? 'text-green-600 hover:text-green-900 hover:bg-green-100' :
                              theme === 'red' ? 'text-red-600 hover:text-red-900 hover:bg-red-100' :
                              theme === 'yellow' ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100' :
                              'text-blue-600 hover:text-blue-900 hover:bg-blue-100'
                            }`}
                            title="Release Order"
                          >
                            {updatingOrder === order.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                            ) : (
                              <Truck className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        
                        {(order.status === 'pending' || order.status === 'approved') && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'cancelled')}
                            disabled={updatingOrder === order.id}
                            className={`${updatingOrder === order.id ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:text-red-900'}`}
                            title="Cancel Order"
                          >
                            {updatingOrder === order.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                          </button>
                        )}

                        {(order.status === 'cancelled' || order.status === 'released') && (
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            disabled={updatingOrder === order.id}
                            className={`${updatingOrder === order.id ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:text-red-900'}`}
                            title="Delete Order"
                          >
                            {updatingOrder === order.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Franchisee Details #{selectedOrder.id.slice(-8)}
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={printReceipt}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium ${
                    theme === 'green' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                    theme === 'red' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                    theme === 'yellow' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                    'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Receipt</span>
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Location</label>
                  <p className="text-sm text-gray-900">{selectedOrder.location?.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Franchisee</label>
                  <p className="text-sm text-gray-900">{selectedOrder.location?.franchisee || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date & Time (PST)</label>
                  <p className="text-sm text-gray-900">
                    {formatPhilippinesDateTime(selectedOrder.created_at)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Brand</label>
                  <p className="text-sm text-gray-900">{selectedOrder.brand?.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                    {getStatusIcon(selectedOrder.status)}
                    <span className="ml-1 capitalize">{selectedOrder.status}</span>
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Amount</label>
                  <p className="text-lg font-semibold text-gray-900">₱{getTotalAmount(selectedOrder).toFixed(2)}</p>
                </div>
              </div>
              
              {selectedOrder.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedOrder.notes}</p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Order Items</label>
                <div className="space-y-2">
                  {selectedOrder.order_details.map((detail) => (
                    <div key={detail.id} className="p-3 bg-gray-50 rounded-lg hover:bg-blue-200">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{detail.product.name}</p>
                          {detail.product.sku && (
                            <p className="text-xs text-gray-500">SKU: {detail.product.sku}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">₱{(detail.unit_price * detail.quantity).toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-sm text-gray-600">
                        <span>{detail.quantity} {detail.product.unit}</span>
                        <span>₱{detail.unit_price.toFixed(2)} per {detail.product.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Items:</span>
                    <span className="font-semibold">{getTotalItems(selectedOrder)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Amount:</span>
                    <span className="text-lg font-bold text-gray-900">₱{getTotalAmount(selectedOrder).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
