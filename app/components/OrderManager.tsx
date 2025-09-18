'use client'
import { useState, useEffect } from 'react'
import { supabase, Brand } from '../../lib/supabase'
import { ShoppingCart, Package, CheckCircle, Clock, XCircle, Eye, Truck, Printer, Trash2, Edit } from 'lucide-react'
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
  status: 'pending' | 'approved' | 'released' | 'paid' | 'complete' | 'cancelled'
  total_amount: number
  delivery_type: 'delivery' | 'pickup'
  notes?: string
  created_at: string
  updated_at: string
  location: Location
  brand: Brand
  order_details: OrderDetail[]
  logistics_assignments?: LogisticsAssignment[]
}

interface LogisticsAssignment {
  id: string
  date: string
  time_slot: 'morning' | 'afternoon'
  status: string
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
      product_name?: string
      sku?: string
      unit: string
      category?: string
      price?: number
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
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState<CustomerOrder | null>(null)
  const [originalOrder, setOriginalOrder] = useState<CustomerOrder | null>(null)
  const [availableProducts, setAvailableProducts] = useState<any[]>([])
  const [overrideLoading, setOverrideLoading] = useState(false)

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
            product:products(id, name, sku, unit, category)
          ),
          logistics_assignments(
            id,
            date,
            time_slot,
            status
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
      case 'paid':
        return 'bg-purple-100 text-purple-800'
      case 'complete':
        return 'bg-indigo-100 text-indigo-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTotalItems = (order: CustomerOrder) => {
    return order.order_details.reduce((total, detail) => total + detail.quantity, 0)
  }


  const getCategoryTotals = (order: CustomerOrder) => {
    if (!order.order_details) return []
    
    const categoryMap = new Map()
    
    order.order_details.forEach(detail => {
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

  const getTotalAmount = (order: CustomerOrder) => {
    const subtotal = order.order_details.reduce((total, detail) => {
      return total + (detail.unit_price * detail.quantity)
    }, 0)

    let total = subtotal

    if (order.delivery_type === 'delivery') {
      total += subtotal >= 10000 ? 0 : 500
    } else if (order.delivery_type === 'pickup' && subtotal >= 10000) {
      total -= subtotal * 0.05
    }

    return total
  }

  const getSubtotalAmount = (order: CustomerOrder) => {
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
            
            .signatories {
              margin-top: 20px;
              padding-top: 15px;
              border-top: 1px solid #ddd;
            }
            
            .signatories-row {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr 0.5fr;
              gap: 15px;
              margin-bottom: 15px;
            }
            
            .signatory-item {
              text-align: center;
            }
            
            .signatory-item.returned-pans {
              min-width: 80px;
            }
            
            .signatory-label {
              font-size: 11px;
              color: #333;
              margin-bottom: 25px;
              font-weight: 500;
            }
            
            .signatory-line {
              border-bottom: 1px solid #333;
              height: 20px;
              margin-bottom: 5px;
            }
            
            .signatory-line.small {
              height: 20px;
              width: 60px;
              margin: 0 auto 5px auto;
            }
            
            .signatory-name {
              font-size: 10px;
              color: #666;
              font-style: italic;
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
              <div class="receipt-title">Stock Transfer Sheet</div>
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
                  <span class="info-label">Status</span>
                  <span class="info-value">${selectedOrder.status}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Logistics</span>
                  <span class="info-value">${selectedOrder.delivery_type === 'delivery' ? 'Delivery' : 'Pickup'}</span>
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
                  <div class="item-unit-price">₱${detail.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div class="item-price">₱${(detail.unit_price * detail.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
              ${getCategoryTotals(selectedOrder).map(categoryTotal => `
                <div class="total-row">
                  <span class="total-label">${categoryTotal.category}: ${categoryTotal.totalQuantity} items</span>
                  <span class="total-value">₱${categoryTotal.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              `).join('')}
              <div class="total-row">
                <span class="total-label">Subtotal</span>
                <span class="total-value">₱${getSubtotalAmount(selectedOrder).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              ${selectedOrder.delivery_type === 'delivery' ? `
                <div class="total-row">
                  <span class="total-label">Delivery Fee</span>
                  <span class="total-value">${getSubtotalAmount(selectedOrder) >= 10000 ? 'FREE (Order over ₱10k)' : '+₱500.00'}</span>
                </div>
              ` : ''}
              ${selectedOrder.delivery_type === 'pickup' && getSubtotalAmount(selectedOrder) >= 10000 ? `
                <div class="total-row">
                  <span class="total-label">Pickup Discount (5%)</span>
                  <span class="total-value">-₱${(getSubtotalAmount(selectedOrder) * 0.05).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              ` : ''}
              ${selectedOrder.delivery_type === 'pickup' && getSubtotalAmount(selectedOrder) < 10000 ? `
                <div class="total-row">
                  <span class="total-label">Pickup Discount</span>
                  <span class="total-value">Not available (Order under ₱10k)</span>
                </div>
              ` : ''}
              <div class="total-row grand-total">
                <span class="total-label">Total Amount</span>
                <span class="total-value">₱${getTotalAmount(selectedOrder).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            
            <div class="signatories">
              <div class="signatories-row">
                <div class="signatory-item">
                  <div class="signatory-label">Prepared by:</div>
                  <div class="signatory-line"></div>
                </div>
                <div class="signatory-item">
                  <div class="signatory-label">Delivered by:</div>
                  <div class="signatory-line"></div>
                </div>
                <div class="signatory-item">
                  <div class="signatory-label">Received by:</div>
                  <div class="signatory-line"></div>
                </div>
                <div class="signatory-item returned-pans">
                  <div class="signatory-label">Returned pans:</div>
                  <div class="signatory-line small"></div>
                </div>
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

  // Override functions
  const handleOverrideOrder = () => {
    if (!selectedOrder) return
    setOriginalOrder({ ...selectedOrder })
    setEditingOrder({ ...selectedOrder })
    setShowOverrideModal(true)
    fetchAvailableProducts()
  }

  const fetchAvailableProducts = async () => {
    if (!selectedBrand) return
    
    try {
      const { data, error } = await supabase
        .from('inventory_summary')
        .select('*')
        .eq('brand_id', selectedBrand.id)
        .order('category, product_name')

      if (error) throw error
      setAvailableProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
      alert('Failed to fetch products')
    }
  }

  const handleSaveOverride = async () => {
    if (!editingOrder || !originalOrder || !selectedBrand) return

    setOverrideLoading(true)
    try {

      // Calculate quantity differences for inventory updates
      const quantityChanges = new Map<string, number>()
      
      // Get all unique product IDs from both original and new order
      const allProductIds = new Set([
        ...originalOrder.order_details.map(d => d.product_id),
        ...editingOrder.order_details.map(d => d.product_id)
      ])
      
      // Calculate net change for each product
      allProductIds.forEach(productId => {
        const originalQuantity = originalOrder.order_details.find(d => d.product_id === productId)?.quantity || 0
        const newQuantity = editingOrder.order_details.find(d => d.product_id === productId)?.quantity || 0
        const netChange = newQuantity - originalQuantity
        quantityChanges.set(productId, netChange)
      })

      // Check stock availability for all changes
      for (const [productId, quantityChange] of Array.from(quantityChanges.entries())) {
        if (quantityChange > 0) {
          // Adding quantity - check if we have enough stock
          let product = availableProducts.find(p => p.id === productId)
          
          if (!product) {
            // Try finding by product_id as well
            product = availableProducts.find(p => p.product_id === productId)
            
            if (!product) {
              alert(`Product not found: ${productId}`)
              return
            }
          }

          const originalQuantity = originalOrder.order_details.find(d => d.product_id === productId)?.quantity || 0
          
          // Use available_stock from inventory_summary + original order quantity
          // We add back the original order quantity because it's already counted in the available_stock calculation
          const availableStock = (product.available_stock || 0) + originalQuantity
          
          if (quantityChange > availableStock) {
            alert(`Insufficient stock for ${product.name}. Available: ${availableStock}, Requested: ${quantityChange}`)
            return
          }
        }
      }

      // Update inventory for all products with quantity changes
      for (const [productId, quantityChange] of Array.from(quantityChanges.entries())) {
        if (quantityChange !== 0) {
          // Get current reserved quantity first
          const { data: currentProduct, error: fetchError } = await supabase
            .from('products')
            .select('reserved')
            .eq('id', productId)
            .single()

          if (fetchError) {
            console.error('Error fetching current product:', fetchError)
            alert('Failed to fetch current product data')
            return
          }

          const newReserved = (currentProduct.reserved || 0) + quantityChange

          const { error: inventoryError } = await supabase
            .from('products')
            .update({
              reserved: newReserved
            })
            .eq('id', productId)

          if (inventoryError) {
            console.error('Error updating inventory:', inventoryError)
            alert('Failed to update inventory')
            return
          }
        }
      }

      // Update order details
      const { error: detailsError } = await supabase
        .from('order_details')
        .delete()
        .eq('order_id', editingOrder.id)

      if (detailsError) throw detailsError

      // Insert new order details
      if (editingOrder.order_details.length > 0) {
        const { error: insertError } = await supabase
          .from('order_details')
          .insert(editingOrder.order_details.map(detail => ({
            order_id: editingOrder.id,
            product_id: detail.product_id,
            quantity: detail.quantity,
            unit_price: detail.unit_price
          })))

        if (insertError) throw insertError
      }

      // Calculate new total amount
      const newTotalAmount = calculateOverrideTotal()
      
      // Update order
      const { error: orderError } = await supabase
        .from('customer_orders')
        .update({
          total_amount: newTotalAmount,
          delivery_type: editingOrder.delivery_type,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingOrder.id)

      if (orderError) throw orderError

      // Refresh data first to get updated order from database
      await fetchOrders()
      if (onOrderUpdate) onOrderUpdate()
      
      // Update selectedOrder with new total amount immediately
      console.log('Override - New total calculated:', newTotalAmount)
      console.log('Override - Editing order details:', editingOrder.order_details)
      console.log('Override - Delivery type:', editingOrder.delivery_type)
      
      setSelectedOrder({
        ...selectedOrder,
        total_amount: newTotalAmount,
        delivery_type: editingOrder.delivery_type,
        order_details: editingOrder.order_details
      })
      
      setShowOverrideModal(false)
      setEditingOrder(null)
      setOriginalOrder(null)
      alert('Order updated successfully!')
    } catch (error) {
      console.error('Error updating order:', error)
      alert('Failed to update order')
    } finally {
      setOverrideLoading(false)
    }
  }

  const addProductToOrder = (product: any) => {
    if (!editingOrder) return

    // Use product_id from inventory_summary view
    const productId = product.product_id || product.id
    const existingDetail = editingOrder.order_details.find(detail => detail.product_id === productId)
    const newQuantity = existingDetail ? existingDetail.quantity + 1 : 1
    
    // Check stock availability using inventory_summary data
    const originalQuantity = originalOrder.order_details.find(d => d.product_id === productId)?.quantity || 0
    const availableStock = (product.available_stock || 0) + originalQuantity
    
    if (newQuantity > availableStock) {
      alert(`Insufficient stock for ${product.product_name || product.name}. Available: ${availableStock}, Requested: ${newQuantity}`)
      return
    }
    
    if (existingDetail) {
      // Increase quantity if product already exists
      setEditingOrder({
        ...editingOrder,
        order_details: editingOrder.order_details.map(detail =>
          detail.product_id === productId
            ? { ...detail, quantity: newQuantity }
            : detail
        )
      })
    } else {
      // Add new product
      setEditingOrder({
        ...editingOrder,
        order_details: [
          ...editingOrder.order_details,
          {
            id: `temp-${Date.now()}`,
            order_id: editingOrder.id,
            product_id: productId,
            quantity: 1,
            unit_price: product.price || 0,
            product: product
          }
        ]
      })
    }
  }

  const removeProductFromOrder = (productId: string) => {
    if (!editingOrder) return

    setEditingOrder({
      ...editingOrder,
      order_details: editingOrder.order_details.filter(detail => detail.product_id !== productId)
    })
  }

  const updateProductQuantity = (productId: string, quantity: number) => {
    if (!editingOrder || quantity < 0) return

    if (quantity === 0) {
      removeProductFromOrder(productId)
      return
    }

    // Check stock availability for quantity increases
    const product = availableProducts.find(p => (p.product_id || p.id) === productId)
    if (product) {
      const originalQuantity = originalOrder.order_details.find(d => d.product_id === productId)?.quantity || 0
      const availableStock = (product.available_stock || 0) + originalQuantity
      
      if (quantity > availableStock) {
        alert(`Insufficient stock for ${product.product_name || product.name}. Available: ${availableStock}, Requested: ${quantity}`)
        return
      }
    }

    setEditingOrder({
      ...editingOrder,
      order_details: editingOrder.order_details.map(detail =>
        detail.product_id === productId
          ? { ...detail, quantity }
          : detail
      )
    })
  }

  const calculateOverrideTotal = () => {
    if (!editingOrder) return 0

    const subtotal = editingOrder.order_details.reduce((total, detail) => {
      return total + detail.unit_price * detail.quantity
    }, 0)

    let total = subtotal

    if (editingOrder.delivery_type === 'delivery') {
      total += subtotal >= 10000 ? 0 : 500
    } else if (editingOrder.delivery_type === 'pickup' && subtotal >= 10000) {
      total -= subtotal * 0.05
    }

    return total
  }

  const canIncreaseQuantity = (productId: string) => {
    if (!editingOrder || !originalOrder) return false

    const product = availableProducts.find(p => (p.product_id || p.id) === productId)
    if (!product) return false

    const originalQuantity = originalOrder.order_details.find(d => d.product_id === productId)?.quantity || 0
    const currentQuantity = editingOrder.order_details.find(d => d.product_id === productId)?.quantity || 0
    
    // Use available_stock from inventory_summary + original order quantity
    // We add back the original order quantity because it's already counted in the available_stock calculation
    const availableStock = (product.available_stock || 0) + originalQuantity
    
    return currentQuantity < availableStock
  }

  const canAddProduct = (product: any) => {
    if (!editingOrder || !originalOrder) return false

    const productId = product.product_id || product.id
    const originalQuantity = originalOrder.order_details.find(d => d.product_id === productId)?.quantity || 0
    const currentQuantity = editingOrder.order_details.find(d => d.product_id === productId)?.quantity || 0
    
    // Use available_stock from inventory_summary + original order quantity
    // We add back the original order quantity because it's already counted in the available_stock calculation
    const availableStock = (product.available_stock || 0) + originalQuantity
    
    return currentQuantity < availableStock
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
                    Logistics
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
                      <div className="space-y-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          order.delivery_type === 'delivery' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {order.delivery_type === 'delivery' ? 'Delivery' : 'Pickup'}
                        </span>
                        {order.logistics_assignments && order.logistics_assignments.length > 0 && (
                          <div className="text-xs text-gray-500">
                            {order.logistics_assignments.map((assignment, index) => (
                              <div key={assignment.id} className="flex items-center space-x-1">
                                <span className="text-gray-400">•</span>
                                <span>{new Date(assignment.date).toLocaleDateString()}</span>
                                <span className="capitalize">({assignment.time_slot})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      ₱{getTotalAmount(order).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-100"
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
                            onClick={() => {
                              if (confirm('Are you sure you want to cancel this order? This action will return reserved stock to available inventory and cannot be undone.')) {
                                updateOrderStatus(order.id, 'cancelled')
                              }
                            }}
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
                Order Details #{selectedOrder.id.slice(0, 8)}
              </h3>
              <div className="flex space-x-2">
                {selectedOrder.status === 'approved' && (
                  <button
                    onClick={handleOverrideOrder}
                    className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium bg-orange-100 text-orange-700 hover:bg-orange-200"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Override</span>
                  </button>
                )}
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
                  <span>Print Transfer Sheet</span>
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
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
                      selectedOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      selectedOrder.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                      selectedOrder.status === 'released' ? 'bg-orange-100 text-orange-800' :
                      selectedOrder.status === 'paid' ? 'bg-purple-100 text-purple-800' :
                      selectedOrder.status === 'complete' ? 'bg-indigo-100 text-indigo-800' :
                      selectedOrder.status === 'cancelled' ? 'bg-red-100 text-red-800' :
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
                    <p className="text-sm font-semibold text-gray-900 mt-1">₱{getTotalAmount(selectedOrder).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <span className="text-sm font-semibold text-gray-900">Total Amount:</span>
                        <span className="text-sm font-semibold text-green-600">₱{getTotalAmount(selectedOrder).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="bg-white border rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Notes</h4>
                  <p className="text-sm text-gray-700">{selectedOrder.notes}</p>
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

      {/* Override Modal */}
      {showOverrideModal && editingOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 xl:w-2/3 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                Override Order #{editingOrder.id.slice(0, 8)}
              </h3>
              <button
                onClick={() => {
                  setShowOverrideModal(false)
                  setEditingOrder(null)
                  setOriginalOrder(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6 flex-1 overflow-y-auto min-h-0">
              {/* Logistics Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Logistics Method</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="delivery_type"
                      value="delivery"
                      checked={editingOrder.delivery_type === 'delivery'}
                      onChange={(e) => setEditingOrder({
                        ...editingOrder,
                        delivery_type: e.target.value as 'delivery' | 'pickup'
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm">Delivery</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="delivery_type"
                      value="pickup"
                      checked={editingOrder.delivery_type === 'pickup'}
                      onChange={(e) => setEditingOrder({
                        ...editingOrder,
                        delivery_type: e.target.value as 'delivery' | 'pickup'
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm">Pickup</span>
                  </label>
                </div>
              </div>

              {/* Current Order Items */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-3">Current Order Items</h4>
                <div className="space-y-2">
                  {editingOrder.order_details.map((detail) => (
                    <div key={detail.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{detail.product?.product_name || detail.product?.name || 'Unknown Product'}</div>
                        <div className="text-sm text-gray-500">₱{detail.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateProductQuantity(detail.product_id, detail.quantity - 1)}
                          className="px-2 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          -
                        </button>
                        <span className="w-12 text-center">{detail.quantity}</span>
                        <button
                          onClick={() => updateProductQuantity(detail.product_id, detail.quantity + 1)}
                          disabled={!canIncreaseQuantity(detail.product_id)}
                          className={`px-2 py-1 text-sm rounded ${
                            canIncreaseQuantity(detail.product_id)
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeProductFromOrder(detail.product_id)}
                          className="px-2 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Products */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-3">Add Products</h4>
                <div className="max-h-60 overflow-y-auto space-y-4">
                  {(() => {
                    // Group products by category
                    const productsByCategory = availableProducts.reduce((acc, product) => {
                      const category = product.category || 'Uncategorized'
                      if (!acc[category]) {
                        acc[category] = []
                      }
                      acc[category].push(product)
                      return acc
                    }, {} as Record<string, any[]>)

                    return Object.entries(productsByCategory).map(([category, products]: [string, any[]]) => (
                      <div key={category} className="space-y-2">
                        <h5 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-1">
                          {category}
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {products.map((product) => {
                            const canAdd = canAddProduct(product)
                            const originalQuantity = originalOrder?.order_details.find(d => d.product_id === product.id)?.quantity || 0
                            const availableStock = (product.available_stock || 0) + originalQuantity
                            
                            return (
                              <button
                                key={product.id}
                                onClick={() => canAdd && addProductToOrder(product)}
                                disabled={!canAdd}
                                className={`p-2 text-left border rounded text-sm ${
                                  canAdd
                                    ? 'border-gray-200 hover:bg-gray-50'
                                    : 'border-gray-100 bg-gray-50 cursor-not-allowed'
                                }`}
                              >
                                <div className={`font-medium ${canAdd ? 'text-gray-900' : 'text-gray-400'}`}>{product.product_name || product.name}</div>
                                <div className={`${canAdd ? 'text-gray-500' : 'text-gray-400'}`}>₱{(product.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div className={`text-xs ${canAdd ? 'text-gray-400' : 'text-gray-300'}`}>
                                  Available: {availableStock} / {product.initial_stock}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              </div>

              {/* Order Total */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-medium text-gray-900 mb-3">Order Summary</h4>
                
                {/* Subtotal */}
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Subtotal:</span>
                  <span className="text-sm font-medium text-gray-900">
                    ₱{editingOrder.order_details.reduce((total, detail) => total + (detail.unit_price * detail.quantity), 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Delivery Fee or Pickup Discount */}
                {editingOrder.delivery_type === 'delivery' && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Delivery Fee:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {editingOrder.order_details.reduce((total, detail) => total + (detail.unit_price * detail.quantity), 0) >= 10000 
                        ? 'FREE (Order over ₱10k)' 
                        : '+₱500.00'
                      }
                    </span>
                  </div>
                )}

                {editingOrder.delivery_type === 'pickup' && editingOrder.order_details.reduce((total, detail) => total + (detail.unit_price * detail.quantity), 0) >= 10000 && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Pickup Discount (5%):</span>
                    <span className="text-sm font-medium text-green-600">
                      -₱{(editingOrder.order_details.reduce((total, detail) => total + (detail.unit_price * detail.quantity), 0) * 0.05).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {editingOrder.delivery_type === 'pickup' && editingOrder.order_details.reduce((total, detail) => total + (detail.unit_price * detail.quantity), 0) < 10000 && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Pickup Discount:</span>
                    <span className="text-sm font-medium text-gray-500">
                      Not available (Order under ₱10k)
                    </span>
                  </div>
                )}

                {/* Total Amount */}
                <div className="flex justify-between items-center pt-2 border-t border-gray-300">
                  <span className="text-lg font-medium text-gray-900">Total Amount:</span>
                  <span className="text-lg font-bold text-green-600">
                    ₱{calculateOverrideTotal().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t bg-gray-50 -mx-5 -mb-5 px-5 pb-5 flex-shrink-0">
              <button
                onClick={() => {
                  setShowOverrideModal(false)
                  setEditingOrder(null)
                  setOriginalOrder(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setEditingOrder({
                    ...editingOrder,
                    total_amount: calculateOverrideTotal()
                  })
                  handleSaveOverride()
                }}
                disabled={overrideLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50"
              >
                {overrideLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
