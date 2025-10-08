'use client'
import { useState, useEffect } from 'react'
import { supabase, Brand } from '../../lib/supabase'
import { ShoppingCart, Package, CheckCircle, Clock, XCircle, Eye, Truck, Printer, Trash2, Edit, CreditCard, Building2, Store, X } from 'lucide-react'
import { formatPhilippinesDateTime } from '../../lib/timezone'

interface Location {
  id: string
  name: string
  passkey: string
  franchisee?: string
  company_owned?: boolean
  brand?: Brand
}

interface CustomerOrder {
  id: string
  location_id: string
  brand_id: string
  customer_name: string
  customer_contact?: string
  status: 'pending' | 'approved' | 'in-transit' | 'verified' | 'fulfilled' | 'paid' | 'complete' | 'cancelled'
  total_amount: number
  delivery_type: 'delivery' | 'pickup' | 'none'
  notes?: string
  created_at: string
  updated_at: string
  returnable_pans_image_url?: string
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
    products: {
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
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState<CustomerOrder | null>(null)
  const [originalOrder, setOriginalOrder] = useState<CustomerOrder | null>(null)
  const [availableProducts, setAvailableProducts] = useState<any[]>([])
  const [overrideLoading, setOverrideLoading] = useState(false)
  const [completePage, setCompletePage] = useState(1)
  const [cancelledPage, setCancelledPage] = useState(1)
  const itemsPerPage = 10
  const [showReturnablePansModal, setShowReturnablePansModal] = useState(false)
  const [selectedReturnablePansImage, setSelectedReturnablePansImage] = useState<string | null>(null)
  const [selectedReturnablePansOrder, setSelectedReturnablePansOrder] = useState<CustomerOrder | null>(null)

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
    fetchOrders()
  }, [selectedBrand])

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
          location:locations(
            *,
            brand:brands(*)
          ),
          brand:brands(*),
          order_details(
            *,
            products:products(id, name, sku, unit, category)
          ),
          logistics_assignments(
            id,
            date,
            time_slot,
            status
          )
        `)
        .order('created_at', { ascending: false })


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
      // Get the order to check if location is company-owned
      const { data: orderData, error: orderError } = await supabase
        .from('customer_orders')
        .select(`
          *,
          location:locations(company_owned)
        `)
        .eq('id', orderId)
        .single()

      if (orderError) {
        console.error('Error fetching order:', orderError)
        alert('Failed to fetch order data')
        return
      }

      // If fulfilling order, update inventory quantities
      if (newStatus === 'fulfilled') {
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

        // Update product quantities: subtract from both initial_stock and released (items are now delivered/sold)
        for (const detail of orderDetails || []) {
          // First get current quantities
          const { data: productData, error: fetchError } = await supabase
            .from('products')
            .select('initial_stock, released')
            .eq('id', detail.product_id)
            .single()

          if (fetchError) {
            console.error('Error fetching product data:', fetchError)
            alert('Failed to fetch product data')
            return
          }

          // For fulfilled orders, subtract from both initial_stock and released (items are delivered)
          const newInitialStock = Math.max(0, (productData?.initial_stock || 0) - detail.quantity)
          const newReleased = Math.max(0, (productData?.released || 0) - detail.quantity)

          const { error: updateError } = await supabase
            .from('products')
            .update({
              initial_stock: newInitialStock,
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

      // If dispatching order (moving to in-transit), move from reserved to released
      if (newStatus === 'in-transit') {
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
          // Skip if product_id is null or undefined
          if (!detail.product_id) {
            console.warn('Skipping order detail with missing product_id:', detail)
            continue
          }

          // First get current quantities
          const { data: productData, error: fetchError } = await supabase
            .from('products')
            .select('reserved, released')
            .eq('id', detail.product_id)
            .single()

          if (fetchError) {
            console.error('Error fetching product data for product_id:', detail.product_id, fetchError)
            // Continue with other products instead of failing completely
            continue
          }

          if (!productData) {
            console.warn('Product not found for product_id:', detail.product_id)
            continue
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

      // If completing order from fulfilled status, no inventory changes needed
      if (newStatus === 'complete') {
        // For complete orders, no inventory changes are needed
        // The order is already fulfilled and inventory has been properly managed
        console.log('Order marked as complete - no inventory changes needed')
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

        // Update product quantities: remove from reserved and released (depending on order status)
        for (const detail of orderDetails || []) {
          // Skip if product_id is null or undefined
          if (!detail.product_id) {
            console.warn('Skipping order detail with missing product_id:', detail)
            continue
          }

          // First get current quantities
          const { data: productData, error: fetchError } = await supabase
            .from('products')
            .select('reserved, released')
            .eq('id', detail.product_id)
            .single()

          if (fetchError) {
            console.error('Error fetching product data for product_id:', detail.product_id, fetchError)
            // Continue with other products instead of failing completely
            continue
          }

          if (!productData) {
            console.warn('Product not found for product_id:', detail.product_id)
            continue
          }

          // Determine what to return based on current state
          // If there are released quantities, return those; otherwise return reserved
          const currentReleased = productData?.released || 0
          const currentReserved = productData?.reserved || 0
          
          let updateData: any = { updated_at: new Date().toISOString() }
          
          if (currentReleased >= detail.quantity) {
            // If there are enough released quantities, return those
            updateData.released = Math.max(0, currentReleased - detail.quantity)
          } else if (currentReserved >= detail.quantity) {
            // If there are enough reserved quantities, return those
            updateData.reserved = Math.max(0, currentReserved - detail.quantity)
          } else {
            // Handle partial quantities in both reserved and released
            const remainingToReturn = detail.quantity
            let releasedToReturn = Math.min(remainingToReturn, currentReleased)
            let reservedToReturn = remainingToReturn - releasedToReturn
            
            updateData.released = Math.max(0, currentReleased - releasedToReturn)
            updateData.reserved = Math.max(0, currentReserved - reservedToReturn)
          }

          const { error: updateError } = await supabase
            .from('products')
            .update(updateData)
            .eq('id', detail.product_id)

          if (updateError) {
            console.error('Error updating product quantities:', updateError)
            alert('Failed to update product quantities')
            return
          }
        }

        // Delete logistics assignments for cancelled orders
        const { error: logisticsError } = await supabase
          .from('logistics_assignments')
          .delete()
          .eq('order_id', orderId)

        if (logisticsError) {
          console.error('Error deleting logistics assignments:', logisticsError)
          alert('Failed to delete logistics assignments')
          return
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
    try {
      setUpdatingOrder(orderId)

      // First get the order to check its status and details
      const { data: orderData, error: orderError } = await supabase
        .from('customer_orders')
        .select(`
          *,
          order_details(
            product_id,
            quantity
          )
        `)
        .eq('id', orderId)
        .single()

      if (orderError) {
        console.error('Error fetching order:', orderError)
        alert('Failed to fetch order data')
        return
      }

      // If the order is fulfilled, add the released quantities back to initial stock
      if (orderData.status === 'fulfilled' && orderData.order_details) {
        for (const detail of orderData.order_details) {
          // Skip if product_id is null or undefined
          if (!detail.product_id) {
            console.warn('Skipping order detail with missing product_id:', detail)
            continue
          }

          // Get current product quantities
          const { data: productData, error: fetchError } = await supabase
            .from('products')
            .select('initial_stock, released')
            .eq('id', detail.product_id)
            .single()

          if (fetchError) {
            console.error('Error fetching product data for product_id:', detail.product_id, fetchError)
            // Continue with other products instead of failing completely
            continue
          }

          if (!productData) {
            console.warn('Product not found for product_id:', detail.product_id)
            continue
          }

          // Add released quantity back to initial stock and subtract from released
          const newInitialStock = (productData?.initial_stock || 0) + detail.quantity
          const newReleased = Math.max(0, (productData?.released || 0) - detail.quantity)

          const { error: updateError } = await supabase
            .from('products')
            .update({
              initial_stock: newInitialStock,
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

      // Delete returnable pans image if it exists
      if (orderData.returnable_pans_image_url) {
        try {
          // Extract filename from URL
          const urlParts = orderData.returnable_pans_image_url.split('/')
          const fileName = urlParts[urlParts.length - 1]
          
          const { error: storageError } = await supabase.storage
            .from('returnable_pans')
            .remove([fileName])

          if (storageError) {
            console.error('Error deleting returnable pans image:', storageError)
            // Don't fail the entire operation for storage errors, just log it
          }
        } catch (error) {
          console.error('Error processing returnable pans image deletion:', error)
          // Continue with order deletion even if image deletion fails
        }
      }

      // Delete logistics assignments
      const { error: logisticsError } = await supabase
        .from('logistics_assignments')
        .delete()
        .eq('order_id', orderId)

      if (logisticsError) {
        console.error('Error deleting logistics assignments:', logisticsError)
        alert('Failed to delete logistics assignments')
        return
      }

      // Delete the order details
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

  const handleDeleteCompleteOrder = async (orderId: string) => {
    try {
      setUpdatingOrder(orderId)

      // First get the order to check for related data
      const { data: orderData, error: orderError } = await supabase
        .from('customer_orders')
        .select(`
          *,
          order_details(
            product_id,
            quantity
          )
        `)
        .eq('id', orderId)
        .single()

      if (orderError) {
        console.error('Error fetching order:', orderError)
        alert('Failed to fetch order data')
        return
      }

      // Delete returnable pans image if it exists
      if (orderData.returnable_pans_image_url) {
        try {
          // Extract filename from URL
          const urlParts = orderData.returnable_pans_image_url.split('/')
          const fileName = urlParts[urlParts.length - 1]
          
          const { error: storageError } = await supabase.storage
            .from('returnable_pans')
            .remove([fileName])

          if (storageError) {
            console.error('Error deleting returnable pans image:', storageError)
            // Don't fail the entire operation for storage errors, just log it
          }
        } catch (error) {
          console.error('Error processing returnable pans image deletion:', error)
          // Continue with order deletion even if image deletion fails
        }
      }

      // Delete deposit slip image if it exists
      if (orderData.deposit_slip_url) {
        try {
          // Extract filename from URL
          const urlParts = orderData.deposit_slip_url.split('/')
          const fileName = urlParts[urlParts.length - 1]
          
          const { error: storageError } = await supabase.storage
            .from('deposit_slips')
            .remove([fileName])

          if (storageError) {
            console.error('Error deleting deposit slip image:', storageError)
            // Don't fail the entire operation for storage errors, just log it
          }
        } catch (error) {
          console.error('Error processing deposit slip image deletion:', error)
          // Continue with order deletion even if image deletion fails
        }
      }

      // Delete logistics assignments
      const { error: logisticsError } = await supabase
        .from('logistics_assignments')
        .delete()
        .eq('order_id', orderId)

      if (logisticsError) {
        console.error('Error deleting logistics assignments:', logisticsError)
        alert('Failed to delete logistics assignments')
        return
      }

      // Delete the order details
      const { error: detailsError } = await supabase
        .from('order_details')
        .delete()
        .eq('order_id', orderId)

      if (detailsError) {
        console.error('Error deleting order details:', detailsError)
        alert('Failed to delete order details')
        return
      }

      // Finally delete the order
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

      alert('Complete order deleted successfully')
    } catch (error) {
      console.error('Error deleting complete order:', error)
      alert('Failed to delete complete order')
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
      case 'in-transit':
        return <Truck className="h-4 w-4 text-orange-500" />
      case 'verified':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'fulfilled':
        return <Package className="h-4 w-4 text-green-500" />
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
      case 'in-transit':
        return 'bg-orange-100 text-orange-800'
      case 'verified':
        return 'bg-green-100 text-green-800'
      case 'fulfilled':
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

  const isOrderScheduled = (order: CustomerOrder) => {
    return order.logistics_assignments && order.logistics_assignments.length > 0
  }

  const canDispatchOrder = (order: CustomerOrder) => {
    if (!isOrderScheduled(order)) {
      return false
    }
    
    // Check if any logistics assignment date is today or has elapsed
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Start of today
    
    return order.logistics_assignments?.some(assignment => {
      const assignmentDate = new Date(assignment.date)
      assignmentDate.setHours(0, 0, 0, 0) // Start of assignment date
      return assignmentDate <= today
    }) || false
  }

  // Check if order requires returnable pans image
  const requiresReturnablePans = (order: CustomerOrder) => {
    console.log('requiresReturnablePans - Order details:', order.order_details?.length)
    console.log('requiresReturnablePans - Brand:', order.location?.brand)
    
    if (!order.order_details || !order.location?.brand) {
      console.log('requiresReturnablePans - Missing order_details or brand')
      return false
    }
    
    const brandSlug = order.location.brand.slug.toLowerCase()
    console.log('requiresReturnablePans - Brand slug:', brandSlug)
    
    const hasReturnablePansProducts = order.order_details.some((detail: any) => {
      const productCategory = detail.products?.category?.toLowerCase() || ''
      console.log('requiresReturnablePans - Product:', detail.products?.name, 'Category:', productCategory)
      
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
    
    console.log('requiresReturnablePans - Has returnable pans products:', hasReturnablePansProducts)
    return hasReturnablePansProducts
  }


  const getCategoryTotals = (order: CustomerOrder) => {
    if (!order.order_details) return []
    
    const categoryMap = new Map()
    
    order.order_details.forEach(detail => {
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

  // Helper functions for categorization and pagination
  const getOrdersByStatus = (status: string) => {
    return orders.filter(order => order.status === status)
  }

  const getPaginatedOrders = (status: string, page: number) => {
    const statusOrders = getOrdersByStatus(status)
    // Use 5 items per page for complete and cancelled orders, 10 for others
    const pageSize = (status === 'complete' || status === 'cancelled') ? 5 : itemsPerPage
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    return statusOrders.slice(startIndex, endIndex)
  }

  const getTotalPages = (status: string) => {
    const statusOrders = getOrdersByStatus(status)
    // Use 5 items per page for complete and cancelled orders, 10 for others
    const pageSize = (status === 'complete' || status === 'cancelled') ? 5 : itemsPerPage
    return Math.ceil(statusOrders.length / pageSize)
  }

  // Reusable table component for orders
  const OrderTable = ({ orders, showPagination = false, currentPage = 1, onPageChange = () => {} }: {
    orders: CustomerOrder[]
    showPagination?: boolean
    currentPage?: number
    onPageChange?: (page: number) => void
  }) => {
    if (orders.length === 0) {
      return (
        <div className="text-center py-8">
          <ShoppingCart className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">No orders found</p>
        </div>
      )
    }

    return (
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
                  Returnable
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
                    <div className="flex items-center space-x-1">
                      {order.location?.company_owned ? (
                        <div title="Company Owned">
                          <Building2 className="h-4 w-4 text-blue-600" />
                        </div>
                      ) : (
                        <div title="Franchise">
                          <Store className={`h-4 w-4 ${getFranchiseIconColor()}`} />
                        </div>
                      )}
                      <span>{order.location?.name}</span>
                    </div>
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
                          : order.delivery_type === 'pickup'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {order.delivery_type === 'delivery' ? 'Delivery' : order.delivery_type === 'pickup' ? 'Pickup' : 'None'}
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(() => {
                      const returnablePansProducts = order.order_details.filter((detail: any) => {
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
                      
                      const totalPans = returnablePansProducts.reduce((total: number, detail: any) => total + detail.quantity, 0)
                      
                      if (totalPans > 0 && order.returnable_pans_image_url) {
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
                            {totalPans} pans
                          </button>
                        )
                      } else if (totalPans > 0) {
                        return <span className="text-red-600 font-medium cursor-default">{totalPans} pans</span>
                      } else {
                        return <span className="text-gray-400">-</span>
                      }
                    })()}
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
                          onClick={() => {
                            const needsReturnablePans = requiresReturnablePans(order)
                            const hasImage = !!order.returnable_pans_image_url
                            console.log('Order:', order.id.slice(-8))
                            console.log('Needs returnable pans:', needsReturnablePans)
                            console.log('Has image:', hasImage)
                            console.log('Should be disabled:', needsReturnablePans && !hasImage)
                            
                            if (needsReturnablePans && !hasImage) {
                              alert('Returnable pans image is required before approving this order')
                              return
                            }
                            
                            updateOrderStatus(order.id, 'approved')
                          }}
                          className={`p-1 rounded ${
                            requiresReturnablePans(order) && !order.returnable_pans_image_url
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-green-600 hover:text-green-900 hover:bg-green-100'
                          }`}
                          title={
                            requiresReturnablePans(order) && !order.returnable_pans_image_url
                              ? "Returnable pans image required"
                              : "Approve Order"
                          }
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
                          onClick={() => updateOrderStatus(order.id, 'in-transit')}
                          disabled={updatingOrder === order.id || !canDispatchOrder(order)}
                          className={`p-1 rounded ${updatingOrder === order.id || !canDispatchOrder(order) ? 'text-gray-400 cursor-not-allowed' : 'text-orange-600 hover:text-orange-900 hover:bg-orange-100'}`}
                          title={!isOrderScheduled(order) ? "Schedule order in logistics tab first" : !canDispatchOrder(order) ? "Delivery date has not arrived yet" : "Dispatch Order"}
                        >
                          {updatingOrder === order.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                          ) : (
                            <Truck className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      
                      {order.status === 'verified' && (
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to mark this order as fulfilled? This action will subtract items from both initial stock and released inventory and cannot be undone.')) {
                              updateOrderStatus(order.id, 'fulfilled')
                            }
                          }}
                          disabled={updatingOrder === order.id}
                          className={`p-1 rounded ${updatingOrder === order.id ? 'text-gray-400 cursor-not-allowed' : 
                            theme === 'green' ? 'text-green-600 hover:text-green-900 hover:bg-green-100' :
                            theme === 'red' ? 'text-red-600 hover:text-red-900 hover:bg-red-100' :
                            theme === 'yellow' ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100' :
                            'text-blue-600 hover:text-blue-900 hover:bg-blue-100'
                          }`}
                          title="Mark as Fulfilled"
                        >
                          {updatingOrder === order.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                          ) : (
                            <Package className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      
                      {(order.status === 'pending' || order.status === 'approved' || order.status === 'in-transit' || order.status === 'verified') && (
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

                      {order.status === 'fulfilled' && (
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to mark this order as complete? This will skip the paid status and cannot be undone.')) {
                              updateOrderStatus(order.id, 'complete')
                            }
                          }}
                          disabled={updatingOrder === order.id}
                          className={`p-1 rounded ${updatingOrder === order.id ? 'text-gray-400 cursor-not-allowed' : 
                            theme === 'green' ? 'text-green-600 hover:text-green-900 hover:bg-green-100' :
                            theme === 'red' ? 'text-red-600 hover:text-red-900 hover:bg-red-100' :
                            theme === 'yellow' ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100' :
                            'text-blue-600 hover:text-blue-900 hover:bg-blue-100'
                          }`}
                          title="Mark as Complete"
                        >
                          {updatingOrder === order.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </button>
                      )}

                      {(order.status === 'cancelled' || order.status === 'fulfilled') && (
                        <button
                          onClick={() => {
                            const actionText = order.status === 'fulfilled' 
                              ? 'delete this fulfilled order? This will restore the released quantities back to initial stock and cannot be undone.'
                              : 'delete this order? This action cannot be undone.'
                            if (confirm(`Are you sure you want to ${actionText}`)) {
                              handleDeleteOrder(order.id)
                            }
                          }}
                          disabled={updatingOrder === order.id}
                          className={`${updatingOrder === order.id ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:text-red-900'}`}
                          title={order.status === 'fulfilled' ? 'Delete Order (Restores inventory)' : 'Delete Order'}
                        >
                          {updatingOrder === order.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      )}

                      {order.status === 'complete' && (
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this complete order? This will permanently remove the order and all related data (logistics, images, etc.) but will NOT affect inventory. This action cannot be undone.')) {
                              handleDeleteCompleteOrder(order.id)
                            }
                          }}
                          disabled={updatingOrder === order.id}
                          className={`${updatingOrder === order.id ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:text-red-900'}`}
                          title="Delete Complete Order (No inventory changes)"
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
        
        {showPagination && getTotalPages(orders[0]?.status || '') > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => onPageChange(Math.min(getTotalPages(orders[0]?.status || ''), currentPage + 1))}
                disabled={currentPage === getTotalPages(orders[0]?.status || '')}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing page <span className="font-medium">{currentPage}</span> of{' '}
                  <span className="font-medium">{getTotalPages(orders[0]?.status || '')}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => onPageChange(Math.min(getTotalPages(orders[0]?.status || ''), currentPage + 1))}
                    disabled={currentPage === getTotalPages(orders[0]?.status || '')}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    )
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
              padding: 12px 20px;
              background: white;
              color: black;
              border-bottom: 2px solid black;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .company-name { 
              font-size: 23px; 
              font-weight: bold; 
              color: black;
            }
            
            .receipt-title { 
              font-size: 15px; 
              font-weight: normal; 
              color: black;
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
            .status-fulfilled { background: black; color: white; }
            .status-cancelled { background: white; color: black; }
            
            .items { 
              padding: 8px 12px;
              flex: 1;
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
              width: 10px;
              height: 10px;
              border: 1px solid black;
              background: white;
              cursor: pointer;
            }
            
            .item-row {
              display: grid;
              grid-template-columns: 20px 2fr 1fr 1fr 1fr;
              gap: 4px;
              align-items: center;
              padding: 1px 0;
              border-bottom: 1px solid #ccc;
              font-size: 9px;
              min-height: 16px;
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
              <div class="generated-date">Generated on ${new Date().toLocaleString()}</div>
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
                  <span class="info-value">${selectedOrder.delivery_type === 'delivery' ? 'Delivery' : selectedOrder.delivery_type === 'pickup' ? 'Pickup' : 'None'}</span>
                </div>
              </div>
            </div>
            
            <div class="items ${selectedOrder.order_details.length > 15 ? 'items-multi-column' : ''}">
              ${selectedOrder.order_details.length > 15 ? `
                <div class="items-column">
                  <div class="items-header">
                    <div class="header-cell header-checkbox">✓</div>
                    <div class="header-cell header-item">Item</div>
                    <div class="header-cell header-qty">Quantity</div>
                    <div class="header-cell header-price">Price</div>
                    <div class="header-cell header-total">Total</div>
                  </div>
                  ${selectedOrder.order_details.sort((a, b) => {
                    const categoryA = a.products?.category && a.products.category.trim() !== '' ? a.products.category : 'Uncategorized'
                    const categoryB = b.products?.category && b.products.category.trim() !== '' ? b.products.category : 'Uncategorized'
                    return categoryA.localeCompare(categoryB)
                  }).slice(0, Math.ceil(selectedOrder.order_details.length / 2)).map(detail => `
                    <div class="item-row">
                      <div class="item-checkbox">
                        <div class="checkbox"></div>
                      </div>
                      <div>
                        <div class="item-name">${detail.products.name}</div>
                        <div class="item-details">
                          ${detail.products.sku ? `SKU: ${detail.products.sku}` : ''}
                        </div>
                      </div>
                      <div class="item-quantity">${detail.quantity} ${detail.products.unit}</div>
                      <div class="item-unit-price">₱${detail.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div class="item-price">₱${(detail.unit_price * detail.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                  `).join('')}
                </div>
                <div class="items-column">
                  <div class="items-header">
                    <div class="header-cell header-checkbox">✓</div>
                    <div class="header-cell header-item">Item</div>
                    <div class="header-cell header-qty">Quantity</div>
                    <div class="header-cell header-price">Price</div>
                    <div class="header-cell header-total">Total</div>
                  </div>
                  ${selectedOrder.order_details.sort((a, b) => {
                    const categoryA = a.products?.category && a.products.category.trim() !== '' ? a.products.category : 'Uncategorized'
                    const categoryB = b.products?.category && b.products.category.trim() !== '' ? b.products.category : 'Uncategorized'
                    return categoryA.localeCompare(categoryB)
                  }).slice(Math.ceil(selectedOrder.order_details.length / 2)).map(detail => `
                    <div class="item-row">
                      <div class="item-checkbox">
                        <div class="checkbox"></div>
                      </div>
                      <div>
                        <div class="item-name">${detail.products.name}</div>
                        <div class="item-details">
                          ${detail.products.sku ? `SKU: ${detail.products.sku}` : ''}
                        </div>
                      </div>
                      <div class="item-quantity">${detail.quantity} ${detail.products.unit}</div>
                      <div class="item-unit-price">₱${detail.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div class="item-price">₱${(detail.unit_price * detail.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div class="items-header">
                  <div class="header-cell header-checkbox">✓</div>
                  <div class="header-cell header-item">Item</div>
                  <div class="header-cell header-qty">Quantity</div>
                  <div class="header-cell header-price">Price</div>
                  <div class="header-cell header-total">Total</div>
                </div>
                ${selectedOrder.order_details.sort((a, b) => {
                  const categoryA = a.products?.category && a.products.category.trim() !== '' ? a.products.category : 'Uncategorized'
                  const categoryB = b.products?.category && b.products.category.trim() !== '' ? b.products.category : 'Uncategorized'
                  return categoryA.localeCompare(categoryB)
                }).map(detail => `
                  <div class="item-row">
                    <div class="item-checkbox">
                      <div class="checkbox"></div>
                    </div>
                    <div>
                      <div class="item-name">${detail.products.name}</div>
                      <div class="item-details">
                        ${detail.products.sku ? `SKU: ${detail.products.sku}` : ''}
                      </div>
                    </div>
                    <div class="item-quantity">${detail.quantity} ${detail.products.unit}</div>
                    <div class="item-unit-price">₱${detail.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div class="item-price">₱${(detail.unit_price * detail.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                `).join('')}
              `}
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
              ${selectedOrder.delivery_type === 'none' ? `
                <div class="total-row">
                  <span class="total-label">Logistics</span>
                  <span class="total-value">None (No discount, no delivery fee)</span>
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
          
          // For in-transit orders, the original quantity is in released, not reserved
          // For approved orders, the original quantity is in reserved
          const isInTransit = editingOrder.status === 'in-transit'
          
          if (isInTransit) {
            // For in-transit orders: available_stock + original quantity (since it's in released)
            const availableStock = (product.available_stock || 0) + originalQuantity
            const additionalStock = (product.released || 0) - originalQuantity // Additional released stock beyond this order
            
            if (quantityChange > availableStock + additionalStock) {
              alert(`Insufficient stock for ${product.name}. Available: ${availableStock + additionalStock}, Requested: ${quantityChange}`)
              return
            }
          } else {
            // For approved orders: available_stock + original quantity (since it's in reserved)
            const availableStock = (product.available_stock || 0) + originalQuantity
            
            if (quantityChange > availableStock) {
              alert(`Insufficient stock for ${product.name}. Available: ${availableStock}, Requested: ${quantityChange}`)
              return
            }
          }
        }
      }

      // Update inventory for all products with quantity changes
      for (const [productId, quantityChange] of Array.from(quantityChanges.entries())) {
        if (quantityChange !== 0) {
          // For in-transit orders, use released; for approved orders, use reserved
          const isInTransit = editingOrder.status === 'in-transit'
          const fieldToUpdate = isInTransit ? 'released' : 'reserved'
          
          // Get current quantities first
          const { data: currentProduct, error: fetchError } = await supabase
            .from('products')
            .select('reserved, released')
            .eq('id', productId)
            .single()

          if (fetchError) {
            console.error('Error fetching current product:', fetchError)
            alert('Failed to fetch current product data')
            return
          }

          const currentValue = isInTransit ? (currentProduct.released || 0) : (currentProduct.reserved || 0)
          const newValue = currentValue + quantityChange

          const updateData = isInTransit 
            ? { released: newValue, updated_at: new Date().toISOString() }
            : { reserved: newValue, updated_at: new Date().toISOString() }

          const { error: inventoryError } = await supabase
            .from('products')
            .update(updateData)
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
            products: product
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
    // For 'none' delivery_type, no discount and no delivery fee - total remains as subtotal

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Customer Orders</h1>
          <p className="text-sm text-gray-600">
            Manage customer orders and track their status
          </p>
        </div>
      </div>

      {/* Orders by Status */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading orders...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending Orders */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <Clock className="h-5 w-5 text-yellow-500 mr-2" />
                Pending Orders ({getOrdersByStatus('pending').length})
              </h4>
            </div>
            <OrderTable orders={getOrdersByStatus('pending')} />
          </div>

          {/* Approved Orders */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <CheckCircle className="h-5 w-5 text-blue-500 mr-2" />
                Approved Orders ({getOrdersByStatus('approved').length})
              </h4>
            </div>
            <OrderTable orders={getOrdersByStatus('approved')} />
          </div>

          {/* In-Transit Orders */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <Truck className="h-5 w-5 text-orange-500 mr-2" />
                In-Transit Orders ({getOrdersByStatus('in-transit').length})
              </h4>
            </div>
            <OrderTable orders={getOrdersByStatus('in-transit')} />
          </div>

          {/* Verified Orders */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                Verified Orders ({getOrdersByStatus('verified').length})
              </h4>
            </div>
            <OrderTable orders={getOrdersByStatus('verified')} />
          </div>

          {/* Fulfilled Orders */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <Package className="h-5 w-5 text-green-500 mr-2" />
                Fulfilled Orders ({getOrdersByStatus('fulfilled').length})
              </h4>
            </div>
            <OrderTable orders={getOrdersByStatus('fulfilled')} />
          </div>

          {/* Paid Orders */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <CreditCard className="h-5 w-5 text-purple-500 mr-2" />
                Paid Orders ({getOrdersByStatus('paid').length})
              </h4>
            </div>
            <OrderTable orders={getOrdersByStatus('paid')} />
          </div>

          {/* Complete Orders - Paginated */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <CheckCircle className="h-5 w-5 text-indigo-500 mr-2" />
                Complete Orders ({getOrdersByStatus('complete').length})
              </h4>
            </div>
            <OrderTable 
              orders={getPaginatedOrders('complete', completePage)} 
              showPagination={true}
              currentPage={completePage}
              onPageChange={setCompletePage}
            />
          </div>

          {/* Cancelled Orders - Paginated */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <XCircle className="h-5 w-5 text-red-500 mr-2" />
                Cancelled Orders ({getOrdersByStatus('cancelled').length})
              </h4>
            </div>
            <OrderTable 
              orders={getPaginatedOrders('cancelled', cancelledPage)} 
              showPagination={true}
              currentPage={cancelledPage}
              onPageChange={setCancelledPage}
            />
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                Order Details #{selectedOrder.id.slice(0, 8)}
              </h3>
              <div className="flex space-x-2">
                {(selectedOrder.status === 'approved' || selectedOrder.status === 'in-transit') && (
                  <button
                    onClick={handleOverrideOrder}
                    className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium bg-orange-100 text-orange-700 hover:bg-orange-200"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Override</span>
                  </button>
                )}
                {selectedOrder.status !== 'pending' && (selectedOrder.status !== 'approved' || isOrderScheduled(selectedOrder)) && (
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
                )}
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Order Information */}
            <div className="space-y-6 flex-1 overflow-y-auto min-h-0">
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
                      selectedOrder.status === 'in-transit' ? 'bg-orange-100 text-orange-800' :
                      selectedOrder.status === 'verified' ? 'bg-green-100 text-green-800' :
                      selectedOrder.status === 'fulfilled' ? 'bg-orange-100 text-orange-800' :
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
                    <div className="flex items-center space-x-1 mt-1">
                      {selectedOrder.location?.company_owned ? (
                        <div title="Company Owned">
                          <Building2 className="h-4 w-4 text-blue-600" />
                        </div>
                      ) : (
                        <div title="Franchise">
                          <Store className={`h-4 w-4 ${getFranchiseIconColor()}`} />
                        </div>
                      )}
                      <p className="text-sm font-semibold text-gray-900">{selectedOrder.location?.name || 'N/A'}</p>
                    </div>
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
              {/* Logistics Method and Category Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                          delivery_type: e.target.value as 'delivery' | 'pickup' | 'none'
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
                          delivery_type: e.target.value as 'delivery' | 'pickup' | 'none'
                        })}
                        className="mr-2"
                      />
                      <span className="text-sm">Pickup</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="delivery_type"
                        value="none"
                        checked={editingOrder.delivery_type === 'none'}
                        onChange={(e) => setEditingOrder({
                          ...editingOrder,
                          delivery_type: e.target.value as 'delivery' | 'pickup' | 'none'
                        })}
                        className="mr-2"
                      />
                      <span className="text-sm">None (No discount, no delivery fee)</span>
                    </label>
                  </div>
                </div>
                
                {/* Category Item Summary */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category Summary</label>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const categoryTotals = editingOrder.order_details.reduce((acc, detail) => {
                        const category = detail.products?.category || 'Uncategorized'
                        if (!acc[category]) {
                          acc[category] = { quantity: 0, amount: 0 }
                        }
                        acc[category].quantity += detail.quantity
                        acc[category].amount += detail.unit_price * detail.quantity
                        return acc
                      }, {} as Record<string, { quantity: number; amount: number }>)

                      return Object.entries(categoryTotals).map(([category, totals]) => (
                        <div key={category} className="bg-gray-100 px-3 py-1 rounded-full text-xs">
                          <span className="font-medium text-gray-900">{category}:</span>
                          <span className="text-gray-600 ml-1">{totals.quantity} items</span>
                          <span className="text-green-600 ml-1">₱{totals.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Current Order Items - Left Column */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Current Order Items</h4>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {editingOrder.order_details.map((detail) => (
                      <div key={detail.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{detail.products?.product_name || detail.products?.name || 'Unknown Product'}</div>
                          <div className="text-sm text-gray-500">₱{detail.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateProductQuantity(detail.product_id, detail.quantity - 1)}
                            className="px-2 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            -
                          </button>
                          <span className="w-12 text-center text-gray-900">{detail.quantity}</span>
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

                {/* Add Products - Right Column */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Add Products</h4>
                  <div className="max-h-96 overflow-y-auto space-y-4">
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
                          <div className="grid grid-cols-3 gap-2">
                            {products.map((product, index) => {
                              const canAdd = canAddProduct(product)
                              const originalQuantity = originalOrder?.order_details.find(d => d.product_id === product.id)?.quantity || 0
                              const availableStock = (product.available_stock || 0) + originalQuantity
                              const isAlreadyInOrder = editingOrder?.order_details.some(d => d.product_id === (product.product_id || product.id))
                              
                              return (
                                <button
                                  key={product.id || `product-${category}-${index}`}
                                  onClick={() => canAdd && addProductToOrder(product)}
                                  disabled={!canAdd}
                                  className={`p-3 text-left border rounded text-sm w-full ${
                                    isAlreadyInOrder
                                      ? 'border-orange-400 bg-orange-50 hover:bg-orange-100'
                                      : canAdd
                                      ? 'border-gray-200 hover:bg-gray-50'
                                      : 'border-gray-100 bg-gray-50 cursor-not-allowed'
                                  }`}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className={`font-medium ${canAdd ? 'text-gray-900' : 'text-gray-400'}`}>{product.product_name || product.name}</div>
                                      <div className={`${canAdd ? 'text-gray-500' : 'text-gray-400'}`}>₱{(product.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                      <div className={`text-xs ${canAdd ? 'text-gray-400' : 'text-gray-300'}`}>
                                        Available: {availableStock} / {product.initial_stock}
                                      </div>
                                    </div>
                                    {isAlreadyInOrder && (
                                      <div className="ml-2">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                          In Order
                                        </span>
                                      </div>
                                    )}
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

                {editingOrder.delivery_type === 'none' && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Logistics:</span>
                    <span className="text-sm font-medium text-gray-500">
                      None (No discount, no delivery fee)
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

      {/* Returnable Pans Image Modal */}
      {showReturnablePansModal && selectedReturnablePansImage && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                Returnable Pans Image
                {(() => {
                  const returnablePansProducts = selectedReturnablePansOrder?.order_details?.filter((detail: any) => {
                    if (!selectedReturnablePansOrder?.brand && !selectedReturnablePansOrder?.location?.brand) return false
                    const brandSlug = (selectedReturnablePansOrder?.brand?.slug || selectedReturnablePansOrder?.location?.brand?.slug)?.toLowerCase()
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
                  }) || []
                  
                  const totalPans = returnablePansProducts.reduce((total: number, detail: any) => total + detail.quantity, 0)
                  
                  return totalPans > 0 ? ` (${totalPans} pans)` : ''
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
    </div>
  )
}
