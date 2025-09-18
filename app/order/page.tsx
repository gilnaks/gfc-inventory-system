'use client'
import { useState, useEffect } from 'react'
import { supabase, Brand, Product } from '../../lib/supabase'
import { ShoppingCart, MapPin, Plus, Minus, Check, LogOut, X, FileText, Edit3, Home, IceCream, Printer } from 'lucide-react'
import { formatPhilippinesDateTime } from '../../lib/timezone'

interface Location {
  id: string
  name: string
  passkey: string
  brand_id: string
  brand?: Brand
}

interface OrderItem {
  product_id: string
  quantity: number
  product: Product
}

type CartItem = OrderItem

type ViewMode = 'home' | 'products' | 'modify'

export default function OrderPage() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [passcode, setPasscode] = useState('')
  const [location, setLocation] = useState<Location | null>(null)
  
  // Data state
  const [products, setProducts] = useState<Product[]>([])
  const [cartItems, setCartItems] = useState<OrderItem[]>([])
  const [pendingOrder, setPendingOrder] = useState<any>(null)
  const [pastOrders, setPastOrders] = useState<any[]>([])
  
  // UI state
  const [currentView, setCurrentView] = useState<ViewMode>('home')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPastOrders, setShowPastOrders] = useState(false)
  const [showCartModal, setShowCartModal] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingOrderId, setUploadingOrderId] = useState<string | null>(null)
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('delivery')

  // Initialize on mount
  useEffect(() => {
    const initializeApp = async () => {
      setInitialLoading(true)
      
    const savedAuth = localStorage.getItem('order_authenticated')
    const savedLocation = localStorage.getItem('order_location')
    
    if (savedAuth === 'true' && savedLocation) {
      try {
        const locationData = JSON.parse(savedLocation)
        setLocation(locationData)
        setIsAuthenticated(true)
        
          // Load all data in parallel
          await Promise.all([
            checkPendingOrders(locationData.id),
            fetchPastOrders(locationData.id),
        fetchProducts(locationData.brand_id)
          ])
      } catch (error) {
        console.error('Error parsing saved data:', error)
          clearSession()
        }
      }
      
      // Add a minimum loading time to prevent flash
      setTimeout(() => {
        setInitialLoading(false)
      }, 800)
    }

    initializeApp()
  }, [])

  // Real-time subscription for order updates
  useEffect(() => {
    if (!location) return

    const channel = supabase
      .channel('order-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_orders',
          filter: `location_id=eq.${location.id}`
        },
        (payload) => {
          console.log('Order update received:', payload)
          
          // Refresh orders when any order is updated
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
            checkPendingOrders(location.id)
            fetchPastOrders(location.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [location])

  // Prevent navigation to products view when there's a pending order
  useEffect(() => {
    if (pendingOrder && currentView === 'products') {
      setCurrentView('home')
    }
  }, [pendingOrder, currentView])

  // Real-time product updates
  useEffect(() => {
    if (!location?.brand_id) return

    const channel = supabase
      .channel('order-products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `brand_id=eq.${location.brand_id}`
        },
        () => {
          if (!loading) {
            fetchProducts(location.brand_id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [location?.brand_id, loading])

  const getBrandTheme = (location: Location | null) => {
    if (!location?.brand) return 'blue'
    switch (location.brand.slug) {
      case 'mychoice': return 'green'
      case 'gelatofilipino': return 'red'
      case 'mang-sorbetes': return 'yellow'
      default: return 'blue'
    }
  }

  const currentTheme = getBrandTheme(location)

  const clearSession = () => {
    setIsAuthenticated(false)
    setLocation(null)
    setProducts([])
    setCartItems([])
    setPendingOrder(null)
    setCurrentView('home')
    setError('')
    setSuccess('')
    setInitialLoading(false)
    localStorage.removeItem('order_authenticated')
    localStorage.removeItem('order_location')
    localStorage.removeItem('order_cart_draft')
  }

  const handleLocationAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*, brand:brands(*)')
        .eq('passkey', passcode)
        .single()
      
      if (error) throw error
      
        setLocation(data)
        setIsAuthenticated(true)
        localStorage.setItem('order_authenticated', 'true')
        localStorage.setItem('order_location', JSON.stringify(data))
      
      await Promise.all([
        checkPendingOrders(data.id),
        fetchPastOrders(data.id),
        fetchProducts(data.brand_id)
      ])
    } catch (error) {
      setError('Invalid location passcode. Please try again.')
      setPasscode('')
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async (brandId: string) => {
    try {
      const { data, error } = await supabase
        .from('inventory_summary')
        .select('*')
        .eq('brand_id', brandId)
        .order('category, product_name')
      
      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const checkPendingOrders = async (locationId: string) => {
    try {
      const { data, error } = await supabase
        .from('customer_orders')
        .select(`
          id, status, created_at, total_amount, delivery_type, deposit_slip_url,
          order_details (
            id, product_id, quantity, unit_price,
            products (id, name, price, unit, category)
          )
        `)
        .eq('location_id', locationId)
        .in('status', ['pending', 'approved', 'released', 'paid'])
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (error) throw error
      
      if (data && data.length > 0) {
        setPendingOrder(data[0])
      } else {
        setPendingOrder(null)
      }
    } catch (error) {
      console.error('Error checking pending orders:', error)
    }
  }

  const fetchPastOrders = async (locationId: string) => {
    try {
      const { data, error } = await supabase
        .from('customer_orders')
        .select(`
          id, status, created_at, total_amount, delivery_type, deposit_slip_url,
          order_details (
            id, product_id, quantity, unit_price,
            products (id, name, price, unit, category)
          )
        `)
        .eq('location_id', locationId)
        .in('status', ['released', 'paid', 'complete', 'cancelled'])
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setPastOrders(data || [])
    } catch (error) {
      console.error('Error fetching past orders:', error)
    }
  }

  const getAvailableStock = (product: Product) => {
    return product.available_stock || 0
  }

  const getCartItemAvailableStock = (item: CartItem) => {
    // First try to find the product in the current products state (which should be fresh)
    const currentProduct = products.find(p => (p.product_id || p.id) === item.product_id)
    if (currentProduct) {
      // If we're in modify mode, we need to add back the current order's reserved quantity
      // because the user should be able to modify their own order
      if (currentView === 'modify' && pendingOrder) {
        // Find the original quantity of this item in the pending order
        const originalOrderItem = pendingOrder.order_details?.find((detail: any) => 
          detail.product_id === item.product_id
        )
        if (originalOrderItem) {
          // Add back the original reserved quantity to make it available for modification
          return (currentProduct.available_stock || 0) + originalOrderItem.quantity
        }
      }
      return currentProduct.available_stock || 0
    }
    // Fallback to the product data in the cart item
    return getAvailableStock(item.product)
  }

  const addToCart = (product: Product) => {
    const productId = product.product_id || product.id
    const existingItem = cartItems.find(item => item.product_id === productId)
    
    if (existingItem) {
      setCartItems(prev => prev.map(item => 
        item.product_id === productId 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCartItems(prev => [...prev, { product_id: productId, quantity: 1, product }])
    }
  }

  const updateCartQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCartItems(prev => prev.filter(item => item.product_id !== productId))
          } else {
      setCartItems(prev => prev.map(item => 
        item.product_id === productId 
          ? { ...item, quantity: newQuantity }
          : item
      ))
    }
  }

  const removeFromCart = (productId: string) => {
    setCartItems(prev => prev.filter(item => item.product_id !== productId))
  }

  const calculateTotal = () => {
    const subtotal = cartItems.reduce((total, item) => total + (item.product.price || 0) * item.quantity, 0)
    
    if (deliveryType === 'delivery') {
      // Delivery fee is waived if total exceeds 10k
      return subtotal >= 10000 ? subtotal : subtotal + 500
    } else {
      // Pickup discount only applies if total exceeds 10k
      return subtotal >= 10000 ? subtotal * 0.95 : subtotal
    }
  }

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => total + (item.product.price || 0) * item.quantity, 0)
  }

  const calculateItemCount = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0)
  }

  // Group products by category
  const getProductsByCategory = () => {
    const grouped = products.reduce((acc, product) => {
      const category = product.category || 'Other'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(product)
      return acc
    }, {} as Record<string, Product[]>)
    
    // Sort products within each category alphabetically by product name
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => {
        const nameA = (a.product_name || a.name || '').toLowerCase()
        const nameB = (b.product_name || b.name || '').toLowerCase()
        return nameA.localeCompare(nameB)
      })
    })
    
    // Sort categories alphabetically
    const sortedGrouped: Record<string, Product[]> = {}
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
      // Put 'Other' category at the end
      if (a === 'Other') return 1
      if (b === 'Other') return -1
      return a.toLowerCase().localeCompare(b.toLowerCase())
    })
    
    sortedCategories.forEach(category => {
      sortedGrouped[category] = grouped[category]
    })
    
    return sortedGrouped
  }

  const validateStockAvailability = async () => {
    const stockErrors = []
    
    // Fetch fresh product data to ensure we have the latest stock levels
    if (location?.brand_id) {
      try {
        const { data: freshProducts, error } = await supabase
        .from('inventory_summary')
        .select('*')
          .eq('brand_id', location.brand_id)
        
        if (error) throw error
        
        // Update products state with fresh data
        setProducts(freshProducts || [])
        
        // Update cart items with fresh product data
        const updatedCartItems = cartItems.map(item => {
          const freshProduct = freshProducts?.find(p => (p.product_id || p.id) === item.product_id)
          return freshProduct ? { ...item, product: freshProduct } : item
        })
        setCartItems(updatedCartItems)
        
        // Validate against fresh data
        for (const item of updatedCartItems) {
          const freshProduct = freshProducts?.find(p => (p.product_id || p.id) === item.product_id)
          if (freshProduct) {
            let availableStock = freshProduct.available_stock || 0
            
            // If we're in modify mode, add back the original order's reserved quantity
            if (currentView === 'modify' && pendingOrder) {
              const originalOrderItem = pendingOrder.order_details?.find((detail: any) => 
                detail.product_id === item.product_id
              )
              if (originalOrderItem) {
                availableStock += originalOrderItem.quantity
              }
            }
            
            if (item.quantity > availableStock) {
              stockErrors.push(`${freshProduct.product_name || freshProduct.name}: Requested ${item.quantity}, Available ${availableStock}`)
            }
          }
      }
    } catch (error) {
        console.error('Error fetching fresh product data:', error)
        // Fallback to current product data if fetch fails
        for (const item of cartItems) {
          const availableStock = getCartItemAvailableStock(item)
          if (item.quantity > availableStock) {
            stockErrors.push(`${item.product.product_name || item.product.name}: Requested ${item.quantity}, Available ${availableStock}`)
          }
        }
      }
    }
    
    return stockErrors
  }

  const handleSubmitOrder = async () => {
    if (!location || cartItems.length === 0) {
      setError('Please add items to your order.')
      return
    }

    // Validate stock availability before submitting
    const stockErrors = await validateStockAvailability()
    if (stockErrors.length > 0) {
      setError(`Insufficient stock for the following items:\n${stockErrors.join('\n')}`)
        return
      }
      
    setLoading(true)
        setError('')

    try {

      // Reserve inventory
      for (const item of cartItems) {
        const { error } = await supabase
          .from('products')
          .update({ 
            reserved: (item.product.reserved || 0) + item.quantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.product_id)
        
        if (error) throw error
      }

      // Create order
      const totalAmount = calculateTotal()
      const { data: orderData, error: orderError } = await supabase
        .from('customer_orders')
        .insert([{
          location_id: location.id,
          brand_id: location.brand_id,
          customer_name: `${location.name} Order`,
          status: 'pending',
          total_amount: totalAmount,
          delivery_type: deliveryType
        }])
        .select()

      if (orderError) throw orderError

      // Create order details
      const orderDetails = cartItems.map(item => ({
        order_id: orderData[0].id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.product.price || 0
      }))

      const { error: detailsError } = await supabase
        .from('order_details')
        .insert(orderDetails)

      if (detailsError) throw detailsError

      setSuccess('Order submitted successfully!')
      setCartItems([])
      await checkPendingOrders(location.id)
      setCurrentView('home')
      setShowCartModal(false)
    } catch (error) {
      console.error('Error submitting order:', error)
      setError('Failed to submit order. Please try again.')
    } finally {
        setLoading(false)
    }
  }

  const handleUpdateOrder = async () => {
    if (!pendingOrder || cartItems.length === 0) return

    // Validate stock availability before updating
    const stockErrors = await validateStockAvailability()
    if (stockErrors.length > 0) {
      setError(`Insufficient stock for the following items:\n${stockErrors.join('\n')}`)
      return
    }

    setLoading(true)
    setError('')

    try {
      // Get current reserved values from database for all affected products
      const allProductIds = new Set([
        ...(pendingOrder.order_details?.map((item: any) => item.product_id) || []),
        ...cartItems.map(item => item.product_id)
      ])
      
      const { data: currentProducts, error: fetchError } = await supabase
        .from('products')
        .select('id, reserved')
        .in('id', Array.from(allProductIds))
      
      if (fetchError) throw fetchError
      
      const currentReserved = new Map(
        currentProducts?.map(p => [p.id, p.reserved || 0]) || []
      )

      // Create a map to track the net change for each product
      const netChanges = new Map<string, number>()
      
      // Calculate net changes: new quantity - old quantity for each product
      if (pendingOrder.order_details) {
        for (const oldItem of pendingOrder.order_details) {
          const oldQuantity = oldItem.quantity
          const newItem = cartItems.find(item => item.product_id === oldItem.product_id)
          const newQuantity = newItem ? newItem.quantity : 0
          const netChange = newQuantity - oldQuantity
          netChanges.set(oldItem.product_id, netChange)
        }
      }
      
      // Add any new products that weren't in the original order
      for (const item of cartItems) {
        if (!netChanges.has(item.product_id)) {
          netChanges.set(item.product_id, item.quantity)
        }
      }

      // Update reserved values based on net changes
      for (const [productId, netChange] of Array.from(netChanges.entries())) {
        if (netChange !== 0) {
          const currentReservedValue = currentReserved.get(productId) || 0
          const newReservedValue = Math.max(0, currentReservedValue + netChange)
          
          const { error: updateError } = await supabase
            .from('products')
            .update({ 
              reserved: newReservedValue,
              updated_at: new Date().toISOString()
            })
            .eq('id', productId)
          
          if (updateError) throw updateError
        }
      }

      // Delete existing order details
      await supabase
        .from('order_details')
        .delete()
        .eq('order_id', pendingOrder.id)

      // Insert new order details
      const orderDetails = cartItems.map(item => ({
        order_id: pendingOrder.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.product.price || 0
      }))

      await supabase
        .from('order_details')
        .insert(orderDetails)

      // Update order total and delivery type
      const totalAmount = calculateTotal()
      await supabase
        .from('customer_orders')
        .update({ 
          total_amount: totalAmount,
          delivery_type: deliveryType
        })
        .eq('id', pendingOrder.id)

      setSuccess('Order updated successfully!')
      setCartItems([])
      await checkPendingOrders(location!.id)
      setCurrentView('home')
      setShowCartModal(false)
    } catch (error) {
      console.error('Error updating order:', error)
      setError('Failed to update order. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const startModifyOrder = () => {
    if (pendingOrder?.order_details && pendingOrder.status === 'pending') {
      const cartItems = pendingOrder.order_details.map((detail: any) => ({
        product_id: detail.product_id,
        quantity: detail.quantity,
        product: detail.products
      }))
      setCartItems(cartItems)
      setDeliveryType(pendingOrder.delivery_type || 'delivery')
      setCurrentView('modify')
    }
  }

  const startNewOrder = () => {
    // Only allow new orders if there's no pending or approved order
    if (!pendingOrder) {
      setCurrentView('products')
    }
  }

  const getTotalItems = (order: any) => {
    return order.order_details.reduce((total: number, detail: any) => total + detail.quantity, 0)
  }

  const getTotalAmount = (order: any) => {
    return order.order_details.reduce((total: number, detail: any) => total + (detail.unit_price * detail.quantity), 0)
  }

  const handlePhotoUpload = async (orderId: string, file: File) => {
    setUploadingPhoto(true)
    setUploadingOrderId(orderId)
    
    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${orderId}_${Date.now()}.${fileExt}`
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('deposit-slips')
        .upload(fileName, file)
      
      if (uploadError) throw uploadError
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('deposit-slips')
        .getPublicUrl(fileName)
      
      // Update order with deposit slip URL and change status to 'paid'
      const { error: updateError } = await supabase
        .from('customer_orders')
        .update({ 
          deposit_slip_url: publicUrl,
          status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
      
      if (updateError) throw updateError
      
      setSuccess('Deposit slip uploaded successfully! Order status updated to Paid.')
      
      // Refresh orders
      if (location) {
        await Promise.all([
          checkPendingOrders(location.id),
          fetchPastOrders(location.id)
        ])
      }
    } catch (error) {
      console.error('Error uploading photo:', error)
      setError('Failed to upload deposit slip. Please try again.')
    } finally {
      setUploadingPhoto(false)
      setUploadingOrderId(null)
    }
  }

  const printReceipt = (order: any) => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - Order ${order.id.slice(0, 8)}</title>
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
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
              border-radius: 12px;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              min-height: 100vh;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .header { 
              text-align: center; 
              padding: 24px 20px;
              background: ${currentTheme === 'green' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' :
                           currentTheme === 'red' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' :
                           currentTheme === 'yellow' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' :
                           'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'};
              color: white;
              border-bottom: none;
            }
            
            .company-name { 
              font-size: 26px; 
              font-weight: 700; 
              margin-bottom: 6px;
              color: white;
              letter-spacing: 0.025em;
            }
            
            .receipt-title { 
              font-size: 16px; 
              font-weight: 400; 
              color: rgba(255, 255, 255, 0.9);
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            
            .order-info { 
              padding: 16px 20px; 
              background: #f8fafc;
              border-bottom: 1px solid #e2e8f0;
            }
            
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
              gap: 12px 16px;
            }
            
            .info-item {
              display: flex;
              flex-direction: column;
              text-align: center;
            }
            
            .info-label { 
              font-weight: 600; 
              color: #6b7280;
              font-size: 11px;
              text-transform: uppercase;
              margin-bottom: 4px;
              letter-spacing: 0.025em;
            }
            
            .info-value { 
              font-weight: 600; 
              color: #111827;
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
              padding: 16px 20px;
              flex: 1;
              background: white;
            }
            
            .items-title {
              font-size: 14px;
              font-weight: 700;
              margin-bottom: 12px;
              color: #111827;
              text-transform: uppercase;
              letter-spacing: 0.025em;
            }
            
            .items-header {
              display: grid;
              grid-template-columns: 2fr 1fr 1fr 1fr;
              gap: 12px;
              padding: 8px 0;
              border-bottom: 2px solid #e5e7eb;
              margin-bottom: 8px;
              background: #f9fafb;
            }
            
            .header-cell {
              font-size: 12px;
              font-weight: 600;
              color: #374151;
              text-transform: uppercase;
              letter-spacing: 0.025em;
            }
            
            .header-item { text-align: left; }
            .header-qty { text-align: center; }
            .header-price { text-align: center; }
            .header-total { text-align: right; }
            
            .item-row {
              display: grid;
              grid-template-columns: 2fr 1fr 1fr 1fr;
              gap: 12px;
              align-items: center;
              padding: 8px 0;
              border-bottom: 1px solid #f3f4f6;
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
            
            .category-summary {
              padding: 12px 16px;
              background: #f8fafc;
              border-top: 1px solid #e2e8f0;
              margin-bottom: 8px;
            }
            
            .category-title {
              font-size: 13px;
              font-weight: 600;
              color: #374151;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.025em;
            }
            
            .category-row {
              display: grid;
              grid-template-columns: 2fr 1fr 1fr;
              gap: 8px;
              align-items: center;
              padding: 4px 0;
              border-bottom: 1px solid #e2e8f0;
            }
            
            .category-row:last-child {
              border-bottom: none;
            }
            
            .category-label {
              font-size: 12px;
              color: #374151;
              font-weight: 500;
            }
            
            .category-quantity {
              font-size: 11px;
              color: #6b7280;
              text-align: center;
            }
            
            .category-amount {
              font-size: 12px;
              color: #374151;
              font-weight: 600;
              text-align: right;
            }
            
            .total-section { 
              padding: 12px 16px;
              background: white;
              border-top: 2px solid #e2e8f0;
            }
            
            .total-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 6px;
              padding: 2px 0;
            }
            
            .total-label {
              font-weight: 500;
              color: #374151;
              font-size: 12px;
            }
            
            .total-value {
              font-weight: 600;
              color: #374151;
              font-size: 12px;
            }
            
            .grand-total {
              border-top: 2px solid #374151;
              padding-top: 8px;
              margin-top: 8px;
              font-weight: 700;
            }
            
            .grand-total .total-label {
              font-size: 14px;
              font-weight: 700;
              color: #111827;
            }
            
            .grand-total .total-value {
              font-size: 14px;
              font-weight: 700;
              color: #111827;
            }
            
            .footer { 
              text-align: center; 
              padding: 16px 20px;
              background: #f8fafc;
              color: #6b7280;
              margin-top: auto;
              border-top: 1px solid #e2e8f0;
            }
            
            .footer-text {
              font-size: 13px;
              margin-bottom: 4px;
              font-weight: 600;
              color: #374151;
            }
            
            .footer-date {
              font-size: 11px;
              color: #6b7280;
            }
            
            .notes {
              padding: 12px 16px;
              background: #fef3c7;
              border: 1px solid #f59e0b;
              margin: 8px 16px;
              border-radius: 6px;
            }
            
            .notes-title {
              font-weight: 600;
              color: #92400e;
              margin-bottom: 4px;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.025em;
            }
            
            .notes-text {
              color: #78350f;
              font-size: 12px;
              line-height: 1.4;
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
              <div class="company-name">${order.brand?.name || location?.brand?.name || 'GFC'}</div>
              <div class="receipt-title">Order Receipt</div>
            </div>
            
            <div class="order-info">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Order ID</span>
                  <span class="info-value">${order.id.slice(0, 8)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Date</span>
                  <span class="info-value">${formatPhilippinesDateTime(order.created_at, { dateStyle: 'short' })}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Location</span>
                  <span class="info-value">${order.location?.name || location?.name || 'N/A'}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Logistics</span>
                  <span class="info-value">${order.delivery_type === 'delivery' ? 'Delivery' : 'Pickup'}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Status</span>
                  <span class="info-value">${order.status}</span>
                </div>
              </div>
            </div>
            
            <div class="items">
              <div class="items-header">
                <div class="header-cell header-item">Item</div>
                <div class="header-cell header-qty">Quantity</div>
                <div class="header-cell header-price">Unit Price</div>
                <div class="header-cell header-total">Total</div>
              </div>
              ${order.order_details.map((detail: any) => `
                <div class="item-row">
                  <div>
                    <div class="item-name">${detail.product?.name || detail.products?.name}</div>
                    <div class="item-details">
                      ${(detail.product?.sku || detail.products?.sku) ? `SKU: ${detail.product?.sku || detail.products?.sku}` : ''}
                    </div>
                  </div>
                  <div class="item-quantity">${detail.quantity} ${detail.product?.unit || detail.products?.unit}</div>
                  <div class="item-unit-price">₱${detail.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div class="item-price">₱${(detail.unit_price * detail.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
              `).join('')}
            </div>
            
            ${order.notes ? `
              <div class="notes">
                <div class="notes-title">Notes</div>
                <div class="notes-text">${order.notes}</div>
              </div>
            ` : ''}
            
            <div class="category-summary">
              ${(() => {
                const categoryTotals: { [key: string]: { quantity: number; amount: number } } = {}
                order.order_details.forEach(detail => {
                  const category = detail.product?.category || detail.products?.category || 'General'
                  if (!categoryTotals[category]) {
                    categoryTotals[category] = { quantity: 0, amount: 0 }
                  }
                  categoryTotals[category].quantity += detail.quantity
                  categoryTotals[category].amount += detail.unit_price * detail.quantity
                })
                return Object.entries(categoryTotals).map(([category, totals]) => `
                  <div class="category-row">
                    <span class="category-label">${category}</span>
                    <span class="category-quantity">${totals.quantity} items</span>
                    <span class="category-amount">₱${totals.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                `).join('')
              })()}
            </div>
            
            <div class="total-section">
              ${(() => {
                const subtotal = order.order_details.reduce((sum, detail) => sum + (detail.unit_price * detail.quantity), 0)
                let deliveryFee = 0
                let pickupDiscount = 0
                let total = subtotal
                
                if (order.delivery_type === 'delivery') {
                  if (subtotal < 10000) {
                    deliveryFee = 500
                    total = subtotal + 500
                  }
                } else if (order.delivery_type === 'pickup' && subtotal >= 10000) {
                  pickupDiscount = subtotal * 0.05
                  total = subtotal - pickupDiscount
                }
                
                return `
                  <div class="total-row">
                    <span class="total-label">Subtotal</span>
                    <span class="total-value">₱${subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  ${order.delivery_type === 'delivery' ? `
                    <div class="total-row">
                      <span class="total-label">Delivery Fee</span>
                      <span class="total-value">${subtotal >= 10000 ? 'FREE (Order over ₱10k)' : '+₱500.00'}</span>
                    </div>
                  ` : ''}
                  ${order.delivery_type === 'pickup' && subtotal >= 10000 ? `
                    <div class="total-row">
                      <span class="total-label">Pickup Discount (5%)</span>
                      <span class="total-value">-₱${pickupDiscount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ` : ''}
                  ${order.delivery_type === 'pickup' && subtotal < 10000 ? `
                    <div class="total-row">
                      <span class="total-label">Pickup Discount</span>
                      <span class="total-value">Not available (Order under ₱10k)</span>
                    </div>
                  ` : ''}
                  <div class="total-row grand-total">
                    <span class="total-label">Total Amount</span>
                    <span class="total-value">₱${total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                `
              })()}
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

  // Initial loading spinner
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 ${
            currentTheme === 'green' ? 'bg-green-100' :
            currentTheme === 'red' ? 'bg-red-100' :
            currentTheme === 'yellow' ? 'bg-yellow-100' :
            'bg-blue-100'
          }`}>
            <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${
              currentTheme === 'green' ? 'border-green-600' :
              currentTheme === 'red' ? 'border-red-600' :
              currentTheme === 'yellow' ? 'border-yellow-600' :
              'border-blue-600'
            }`}></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Order System</h2>
          <p className="text-gray-600">Please wait while we check your session...</p>
        </div>
      </div>
    )
  }

  // Authentication view
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${
              currentTheme === 'green' ? 'bg-green-100' :
              currentTheme === 'red' ? 'bg-red-100' :
              currentTheme === 'yellow' ? 'bg-yellow-100' :
              'bg-blue-100'
            }`}>
              <MapPin className={`h-6 w-6 ${
                currentTheme === 'green' ? 'text-green-600' :
                currentTheme === 'red' ? 'text-red-600' :
                currentTheme === 'yellow' ? 'text-yellow-600' :
                'text-blue-600'
              }`} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">GFC Order Portal</h2>
            <p className="text-gray-600 mt-2">Enter your location passcode to continue</p>
          </div>
          
          <form onSubmit={handleLocationAuth} className="space-y-6">
            <div>
              <label htmlFor="passcode" className="block text-sm font-medium text-gray-700 mb-2">
                Location Passcode
              </label>
              <input
                type="text"
                id="passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 text-center text-lg tracking-wider ${
                  currentTheme === 'green' ? 'focus:ring-green-500 focus:border-green-500' :
                  currentTheme === 'red' ? 'focus:ring-red-500 focus:border-red-500' :
                  currentTheme === 'yellow' ? 'focus:ring-yellow-500 focus:border-yellow-500' :
                  'focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="Enter 6-digit code"
                maxLength={6}
                required
              />
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm whitespace-pre-line">{error}</p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center space-x-2 px-4 py-3 text-white rounded-lg transition-colors font-medium disabled:opacity-50 ${
                currentTheme === 'green' ? 'bg-green-600 hover:bg-green-700' :
                currentTheme === 'red' ? 'bg-red-600 hover:bg-red-700' :
                currentTheme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
                'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
              <MapPin className="h-5 w-5" />
              )}
              <span>{loading ? 'Signing in...' : 'Continue to Order'}</span>
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Success message
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${
            currentTheme === 'green' ? 'bg-green-100' :
            currentTheme === 'red' ? 'bg-red-100' :
            currentTheme === 'yellow' ? 'bg-yellow-100' :
            'bg-blue-100'
          }`}>
            <Check className={`h-6 w-6 ${
              currentTheme === 'green' ? 'text-green-600' :
              currentTheme === 'red' ? 'text-red-600' :
              currentTheme === 'yellow' ? 'text-yellow-600' :
              'text-blue-600'
            }`} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
          <p className="text-gray-600 mb-6">{success}</p>
            <button
              onClick={() => {
              setSuccess('')
              setCurrentView('home')
              }}
              className={`w-full px-4 py-3 text-white rounded-lg transition-colors ${
                currentTheme === 'green' ? 'bg-green-600 hover:bg-green-700' :
                currentTheme === 'red' ? 'bg-red-600 hover:bg-red-700' :
                currentTheme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
                'bg-blue-600 hover:bg-blue-700'
              }`}
            >
            Continue
            </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <IceCream className={`h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0 ${
                  currentTheme === 'green' ? 'text-green-600' :
                  currentTheme === 'red' ? 'text-red-600' :
                  currentTheme === 'yellow' ? 'text-yellow-600' :
                  'text-blue-600'
                }`} />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{location?.brand?.name || 'Order System'}</h1>
                <p className="text-xs sm:text-sm text-gray-500 flex items-center">
                  <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
                  <span className="truncate">{location?.name}</span>
                </p>
              </div>
              </div>
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              {currentView !== 'home' && (
                <button
                  onClick={() => setCurrentView('home')}
                  className="flex items-center space-x-1 px-2 sm:px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-xs sm:text-sm"
                >
                  <Home className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Home</span>
                </button>
              )}
              <button
                onClick={() => setShowPastOrders(true)}
                className="flex items-center space-x-1 px-2 sm:px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-xs sm:text-sm"
              >
                <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Past Orders</span>
              </button>
              <button
                onClick={clearSession}
                className="flex items-center space-x-1 px-2 sm:px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-xs sm:text-sm"
              >
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Home View */}
        {currentView === 'home' && (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 whitespace-pre-line">{error}</p>
          </div>
        )}

            {pendingOrder ? (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className={`flex items-center justify-between p-4 rounded-lg mb-6 ${
                  pendingOrder.status === 'approved' 
                    ? 'bg-green-50 border border-green-200' 
                    : pendingOrder.status === 'released'
                    ? 'bg-orange-50 border border-orange-200'
                    : pendingOrder.status === 'paid'
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-yellow-50 border border-yellow-200'
            }`}>
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                      {pendingOrder.status === 'approved' ? (
                        <Check className="h-5 w-5 text-green-400" />
                      ) : pendingOrder.status === 'released' ? (
                        <div className="h-5 w-5 rounded-full bg-orange-400"></div>
                      ) : pendingOrder.status === 'paid' ? (
                        <div className="h-5 w-5 rounded-full bg-blue-400"></div>
                      ) : (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-400"></div>
                    )}
                  </div>
                  <div className="ml-3">
                      <h3 className={`text-lg font-medium ${
                        pendingOrder.status === 'approved' ? 'text-green-800' 
                        : pendingOrder.status === 'released' ? 'text-orange-800'
                        : pendingOrder.status === 'paid' ? 'text-blue-800'
                        : 'text-yellow-800'
                    }`}>
                        {pendingOrder.status === 'approved' ? 'Order Approved' 
                         : pendingOrder.status === 'released' ? 'Order Released'
                         : pendingOrder.status === 'paid' ? 'Payment Received'
                         : 'Pending Order'}
                    </h3>
                      <p className={`text-sm ${
                        pendingOrder.status === 'approved' ? 'text-green-700' 
                        : pendingOrder.status === 'released' ? 'text-orange-700'
                        : pendingOrder.status === 'paid' ? 'text-blue-700'
                        : 'text-yellow-700'
                      }`}>
                        {pendingOrder.status === 'approved' 
                          ? 'Your order has been approved and is being processed.'
                          : pendingOrder.status === 'released'
                          ? 'Your order has been released. Please complete payment to proceed.'
                          : pendingOrder.status === 'paid'
                          ? 'Payment received. Your order is being prepared for completion.'
                          : 'Your order is pending approval. You can modify it if needed.'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">₱{pendingOrder.total_amount?.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</p>
                    <p className="text-sm text-gray-500">Order #{pendingOrder.id.slice(-8)}</p>
                </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Order Items</h4>
                  {pendingOrder.order_details?.map((detail: any) => (
                    <div key={detail.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{detail.products.name}</p>
                        <p className="text-sm text-gray-600">₱{detail.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per {detail.products.unit}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">{detail.quantity} {detail.products.unit}</p>
                        <p className="text-sm text-gray-600">₱{(detail.quantity * detail.unit_price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  ))}
                  
                  {/* Order Summary with Delivery Fee/Discount */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Subtotal:</span>
                        <span className="text-sm text-gray-600">₱{getTotalAmount(pendingOrder).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      {pendingOrder.delivery_type === 'delivery' && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Delivery Fee:</span>
                          {getTotalAmount(pendingOrder) >= 10000 ? (
                            <span className="text-sm text-green-600">FREE (Order over ₱10k)</span>
                          ) : (
                            <span className="text-sm text-gray-600">+₱500.00</span>
                          )}
                        </div>
                      )}
                      {pendingOrder.delivery_type === 'pickup' && getTotalAmount(pendingOrder) >= 10000 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Pickup Discount (5%):</span>
                          <span className="text-sm text-green-600">-₱{(getTotalAmount(pendingOrder) * 0.05).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {pendingOrder.delivery_type === 'pickup' && getTotalAmount(pendingOrder) < 10000 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Pickup Discount:</span>
                          <span className="text-sm text-gray-500">Not available (Order under ₱10k)</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="font-medium text-base">Total:</span>
                        <span className="font-semibold text-green-600 text-lg">₱{pendingOrder.total_amount?.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex space-x-4">
                  {pendingOrder.status === 'pending' && (
                  <button
                      onClick={startModifyOrder}
                      className={`flex items-center space-x-2 px-6 py-3 text-white rounded-lg transition-colors ${
                        currentTheme === 'green' ? 'bg-green-600 hover:bg-green-700' :
                        currentTheme === 'red' ? 'bg-red-600 hover:bg-red-700' :
                        currentTheme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
                        'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      <Edit3 className="h-4 w-4" />
                      <span>Modify Order</span>
                  </button>
                )}
                  {pendingOrder.status === 'released' && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
                      <div className="text-center sm:text-left">
                        <p className="text-sm text-gray-600">
                          Your order has been released. Please upload your deposit slip to complete payment.
                        </p>
                      </div>
                      <div className="flex justify-center sm:justify-end gap-2">
                        {pendingOrder.deposit_slip_url && (
                          <button
                            onClick={() => window.open(pendingOrder.deposit_slip_url, '_blank')}
                            className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors min-h-[44px] sm:min-h-0 w-full sm:w-auto justify-center"
                          >
                            <svg className="h-4 w-4 sm:h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span className="text-sm sm:text-base">View</span>
                          </button>
                        )}
                        <input
                          type="file"
                          id="deposit-slip-upload"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              handlePhotoUpload(pendingOrder.id, file)
                            }
                          }}
                          className="hidden"
                          disabled={uploadingPhoto && uploadingOrderId === pendingOrder.id}
                        />
                        <label
                          htmlFor="deposit-slip-upload"
                          className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors cursor-pointer min-h-[44px] sm:min-h-0 w-full sm:w-auto justify-center ${
                            uploadingPhoto && uploadingOrderId === pendingOrder.id
                              ? 'bg-gray-400 cursor-not-allowed'
                              : currentTheme === 'green' ? 'bg-green-600 hover:bg-green-700' :
                                currentTheme === 'red' ? 'bg-red-600 hover:bg-red-700' :
                                currentTheme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
                                'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {uploadingPhoto && uploadingOrderId === pendingOrder.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 sm:h-5 w-5 border-b-2 border-white"></div>
                              <span className="text-sm sm:text-base">Uploading...</span>
                            </>
                          ) : (
                            <>
                              <svg className="h-4 w-4 sm:h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              <span className="text-sm sm:text-base">Upload Deposit Slip</span>
                            </>
                          )}
                        </label>
                      </div>
                    </div>
                  )}
                  {pendingOrder.status === 'approved' && (
                    <div className="text-center w-full">
                      <p className="text-sm text-gray-600 mb-4">
                        You have an approved order. Please wait for it to be processed before creating a new order.
                      </p>
                    </div>
                  )}
                  {pendingOrder.status === 'paid' && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
                      <div className="text-center sm:text-left">
                        <p className="text-sm text-gray-600">
                          Payment received. Your order is being prepared for completion.
                        </p>
                      </div>
                      <div className="flex justify-center sm:justify-end gap-2">
                        {pendingOrder.deposit_slip_url && (
                          <button
                            onClick={() => window.open(pendingOrder.deposit_slip_url, '_blank')}
                            className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors min-h-[44px] sm:min-h-0 w-full sm:w-auto justify-center"
                          >
                            <svg className="h-4 w-4 sm:h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span className="text-sm sm:text-base">View</span>
                          </button>
                        )}
                        <input
                          type="file"
                          id="deposit-slip-reupload"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              handlePhotoUpload(pendingOrder.id, file)
                            }
                          }}
                          className="hidden"
                          disabled={uploadingPhoto && uploadingOrderId === pendingOrder.id}
                        />
                        <label
                          htmlFor="deposit-slip-reupload"
                          className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors cursor-pointer min-h-[44px] sm:min-h-0 w-full sm:w-auto justify-center ${
                            uploadingPhoto && uploadingOrderId === pendingOrder.id
                              ? 'bg-gray-400 cursor-not-allowed'
                              : currentTheme === 'green' ? 'bg-green-600 hover:bg-green-700' :
                                currentTheme === 'red' ? 'bg-red-600 hover:bg-red-700' :
                                currentTheme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
                                'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {uploadingPhoto && uploadingOrderId === pendingOrder.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 sm:h-5 w-5 border-b-2 border-white"></div>
                              <span className="text-sm sm:text-base">Uploading...</span>
                            </>
                          ) : (
                            <>
                              <svg className="h-4 w-4 sm:h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              <span className="text-sm sm:text-base">Re-upload Deposit Slip</span>
                            </>
                          )}
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Released Orders with Balance */}
                {pastOrders.filter(order => order.status === 'released').length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Outstanding Balance</h3>
                      <span className="text-sm text-gray-500">{pastOrders.filter(order => order.status === 'released').length} order(s)</span>
                    </div>
                    
                    {pastOrders.filter(order => order.status === 'released').map((order) => (
                      <div key={order.id} className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-orange-900">Order #{order.id.slice(-8)}</h4>
                            <p className="text-sm text-orange-700">
                              Released on {new Date(order.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-orange-900">₱{order.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <p className="text-sm text-orange-700">Balance Due</p>
                          </div>
                        </div>
                        
                        <div className="mt-4 space-y-3">
                          <div className="text-sm text-orange-700">
                            <p>Please upload your deposit slip to complete payment</p>
                            <div className="mt-2 text-xs text-orange-600">
                              {order.delivery_type === 'delivery' ? 'Delivery Order' : 'Pickup Order'}
                              {getTotalAmount(order) >= 10000 && order.delivery_type === 'delivery' && ' • Free delivery (Order over ₱10k)'}
                              {getTotalAmount(order) >= 10000 && order.delivery_type === 'pickup' && ' • 5% discount applied'}
                            </div>
                          </div>
                          <label className={`flex items-center justify-center space-x-2 px-3 py-2 sm:px-4 sm:py-2 text-white rounded-lg transition-colors cursor-pointer w-full sm:w-auto min-h-[44px] sm:min-h-0 ${
                            currentTheme === 'green' ? 'bg-green-600 hover:bg-green-700 active:bg-green-800' :
                            currentTheme === 'red' ? 'bg-red-600 hover:bg-red-700 active:bg-red-800' :
                            currentTheme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700 active:bg-yellow-800' :
                            'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                          }`}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  handlePhotoUpload(order.id, file)
                                }
                              }}
                              className="hidden"
                              disabled={uploadingPhoto && uploadingOrderId === order.id}
                            />
                            {uploadingPhoto && uploadingOrderId === order.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white"></div>
                            ) : (
                              <>
                                <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <span className="text-sm font-medium">Upload Deposit Slip</span>
                              </>
                            )}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* No Pending Orders */}
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                  <ShoppingCart className={`mx-auto h-16 w-16 mb-4 ${
                    currentTheme === 'green' ? 'text-green-400' :
                    currentTheme === 'red' ? 'text-red-400' :
                    currentTheme === 'yellow' ? 'text-yellow-400' :
                    'text-blue-400'
                  }`} />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">No Pending Orders</h2>
                  <p className="text-gray-600 mb-6">You can start a new order by clicking the button below.</p>
                  <button
                    onClick={startNewOrder}
                    className={`flex items-center space-x-2 px-6 py-3 text-white rounded-lg transition-colors mx-auto ${
                      currentTheme === 'green' ? 'bg-green-600 hover:bg-green-700' :
                      currentTheme === 'red' ? 'bg-red-600 hover:bg-red-700' :
                      currentTheme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
                      'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <Plus className="h-4 w-4" />
                    <span>Start New Order</span>
                  </button>
                </div>
              </>
            )}
            </div>
          )}

        {/* Products View - Only show if no pending order */}
        {currentView === 'products' && !pendingOrder && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
            <div className="lg:col-span-2 min-w-0">
              <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6 truncate">{location?.brand?.name} Products</h2>
                <div className="space-y-6">
                  {Object.entries(getProductsByCategory()).map(([category, categoryProducts]) => (
                    <div key={category}>
                      <h3 className={`text-sm font-semibold mb-3 px-4 py-3 border-l-4 rounded-r-md ${
                        currentTheme === 'green' ? 'border-green-500 bg-green-100 text-green-800' :
                        currentTheme === 'red' ? 'border-red-500 bg-red-100 text-red-800' :
                        currentTheme === 'yellow' ? 'border-yellow-500 bg-yellow-100 text-yellow-800' :
                        'border-blue-500 bg-blue-100 text-blue-800'
                      }`}>
                        {category}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {categoryProducts.map(product => {
                          const productId = product.product_id || product.id
                          const isInCart = cartItems.some(item => item.product_id === productId)
                          const cartQuantity = cartItems.find(item => item.product_id === productId)?.quantity || 0
                          const availableStock = getAvailableStock(product)
                          
                          return (
                            <div key={productId} className={`border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors min-w-0 ${
                              isInCart ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                            }`}>
                              <div className="flex justify-between items-start mb-2 min-w-0">
                                <h4 className="font-medium text-gray-900 text-sm sm:text-base pr-2 truncate min-w-0 flex-1">{product.product_name || product.name}</h4>
                                <div className="flex items-center space-x-2 flex-shrink-0">
                                  {cartQuantity > 0 && (
                                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                                      {cartQuantity}
                                    </span>
                                  )}
                                  <span className="text-xs sm:text-sm text-gray-500">{product.unit}</span>
                                </div>
                              </div>
                              <p className="text-base sm:text-lg font-semibold text-green-600 mb-2 sm:mb-3">₱{(product.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                              <div className="flex justify-between items-center min-w-0">
                                <span className={`text-xs sm:text-sm font-medium ${availableStock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  Stock: {availableStock}
                                </span>
                      <button
                                  onClick={() => addToCart(product)}
                                  disabled={availableStock === 0 || (isInCart && cartQuantity >= availableStock)}
                                  className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors flex-shrink-0 ${
                                    availableStock > 0 && (!isInCart || cartQuantity < availableStock)
                                      ? currentTheme === 'green' ? 'bg-green-600 text-white hover:bg-green-700' :
                          currentTheme === 'red' ? 'bg-red-600 text-white hover:bg-red-700' :
                          currentTheme === 'yellow' ? 'bg-yellow-600 text-white hover:bg-yellow-700' :
                          'bg-blue-600 text-white hover:bg-blue-700'
                                      : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        }`}
                      >
                                  {availableStock === 0 ? 'Out' : 
                                   isInCart && cartQuantity >= availableStock ? 'Max' :
                                   isInCart ? 'More' : 'Add'}
                      </button>
                  </div>
                          </div>
                          )
                        })}
                          </div>
                          </div>
                  ))}
                          </div>
                        </div>
                      </div>
                      
            {/* Desktop Cart - Hidden on mobile */}
            <div className="hidden lg:block lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-8">
                <h3 className="text-lg font-semibold mb-4">Cart ({calculateItemCount()} items)</h3>
                
                {cartItems.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No items in cart</p>
                    <button
                      onClick={() => setShowCartModal(true)}
                      className={`w-full flex items-center justify-center space-x-2 px-4 py-3 text-white rounded-lg transition-colors ${
                        currentTheme === 'green' ? 'bg-green-600 hover:bg-green-700' :
                        currentTheme === 'red' ? 'bg-red-600 hover:bg-red-700' :
                        currentTheme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
                        'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      <ShoppingCart className="h-5 w-5" />
                      <span>View Cart</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 mb-6">
                      {cartItems.map(item => {
                        const availableStock = getCartItemAvailableStock(item)
                        const hasIssue = item.quantity > availableStock
                        
                        return (
                          <div key={item.product_id} className={`flex justify-between items-center p-3 rounded-lg ${
                            hasIssue ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                          }`}>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{item.product.product_name || item.product.name}</p>
                              <p className="text-xs text-gray-500">₱{(item.product.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per {item.product.unit}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <button
                                  onClick={() => updateCartQuantity(item.product_id, item.quantity - 1)}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className={`text-sm w-8 text-center ${hasIssue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)}
                                  disabled={item.quantity >= availableStock}
                                  className="p-1 text-gray-400 hover:text-gray-600 disabled:text-gray-300"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                            </div>
                              <p className={`text-xs mt-1 ${hasIssue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                Max: {availableStock} | Total: ₱{((item.product.price || 0) * item.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            </div>
                            <button
                              onClick={() => removeFromCart(item.product_id)}
                              className="text-red-500 hover:text-red-700 ml-2"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )
                      })}
                      </div>
                    
                    <div className="border-t pt-4">
                      {/* Delivery Type Selection */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Type</label>
                        <div className="flex space-x-4">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="deliveryType"
                              value="delivery"
                              checked={deliveryType === 'delivery'}
                              onChange={(e) => setDeliveryType(e.target.value as 'delivery')}
                              className="mr-2"
                            />
                            <span className="text-sm">Delivery (+₱500)</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="deliveryType"
                              value="pickup"
                              checked={deliveryType === 'pickup'}
                              onChange={(e) => setDeliveryType(e.target.value as 'pickup')}
                              className="mr-2"
                            />
                            <span className="text-sm">Pickup (5% off)</span>
                          </label>
                        </div>
                      </div>

                      {/* Subtotal and Total */}
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Subtotal:</span>
                          <span className="text-sm text-gray-600">₱{calculateSubtotal().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        {deliveryType === 'delivery' && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Delivery Fee:</span>
                            {calculateSubtotal() >= 10000 ? (
                              <span className="text-sm text-green-600">FREE (Order over ₱10k)</span>
                            ) : (
                              <span className="text-sm text-gray-600">+₱500.00</span>
                            )}
                          </div>
                        )}
                        {deliveryType === 'pickup' && calculateSubtotal() >= 10000 && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Pickup Discount (5%):</span>
                            <span className="text-sm text-green-600">-₱{(calculateSubtotal() * 0.05).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {deliveryType === 'pickup' && calculateSubtotal() < 10000 && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-500">Pickup Discount:</span>
                            <span className="text-sm text-gray-500">Not available (Order under ₱10k)</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center border-t pt-2">
                          <span className="font-medium">Total:</span>
                          <span className="font-semibold text-green-600 text-lg">₱{calculateTotal().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setShowCartModal(true)}
                        className={`w-full flex items-center justify-center space-x-2 px-4 py-3 text-white rounded-lg transition-colors ${
                          currentTheme === 'green' ? 'bg-green-600 hover:bg-green-700' :
                          currentTheme === 'red' ? 'bg-red-600 hover:bg-red-700' :
                          currentTheme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
                          'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        <ShoppingCart className="h-5 w-5" />
                        <span>View Cart</span>
                      </button>
                            </div>
                  </>
                  )}
                </div>
                      </div>
                        </div>
                      )}

        {/* Mobile Floating Cart - Only shown on mobile during products view */}
        {currentView === 'products' && !pendingOrder && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40">
            <div className="px-2 py-2">
              <div className="flex justify-between items-center mb-2 min-w-0">
                <span className="font-medium text-sm truncate">Items: {calculateItemCount()} • {deliveryType === 'delivery' ? 'Delivery' : 'Pickup'}</span>
                <span className="font-bold text-base text-green-600 flex-shrink-0 ml-2">₱{calculateTotal().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
              <button
                onClick={() => setShowCartModal(true)}
                disabled={pendingOrder}
                className={`w-full flex items-center justify-center space-x-1 px-2 py-2 rounded-lg transition-colors text-xs sm:text-sm min-w-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                  currentTheme === 'green' ? 'bg-green-600 hover:bg-green-700 text-white' :
                  currentTheme === 'red' ? 'bg-red-600 hover:bg-red-700 text-white' :
                  currentTheme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700 text-white' :
                  'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="truncate">View Cart</span>
              </button>
            </div>
          </div>
        )}

        {/* Add bottom padding on mobile to account for floating cart */}
        {currentView === 'products' && !pendingOrder && (
          <div className="lg:hidden pb-20"></div>
        )}

        {/* Modify Order View */}
        {currentView === 'modify' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
            <div className="lg:col-span-2 min-w-0">
              <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6 truncate">Modify Order - Draft Mode</h2>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                  <p className="text-yellow-800 text-xs sm:text-sm">
                    <strong>Note:</strong> Changes are saved as draft. Click "Update Order" to save changes permanently.
                  </p>
                </div>
                <div className="space-y-6">
                  {Object.entries(getProductsByCategory()).map(([category, categoryProducts]) => (
                    <div key={category}>
                      <h3 className={`text-sm font-semibold mb-3 px-4 py-3 border-l-4 rounded-r-md ${
                        currentTheme === 'green' ? 'border-green-500 bg-green-100 text-green-800' :
                        currentTheme === 'red' ? 'border-red-500 bg-red-100 text-red-800' :
                        currentTheme === 'yellow' ? 'border-yellow-500 bg-yellow-100 text-yellow-800' :
                        'border-blue-500 bg-blue-100 text-blue-800'
                      }`}>
                        {category}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {categoryProducts.map(product => {
                      const productId = product.product_id || product.id
                          const isInCart = cartItems.some(item => item.product_id === productId)
                          const cartQuantity = cartItems.find(item => item.product_id === productId)?.quantity || 0
                          const availableStock = getAvailableStock(product)
                      
                      return (
                            <div key={productId} className={`border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors min-w-0 ${
                              isInCart ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                            }`}>
                              <div className="flex justify-between items-start mb-2 min-w-0">
                                <h4 className="font-medium text-gray-900 text-sm sm:text-base pr-2 truncate min-w-0 flex-1">{product.product_name || product.name}</h4>
                                <div className="flex items-center space-x-2 flex-shrink-0">
                                  {cartQuantity > 0 && (
                                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                                      {cartQuantity}
                              </span>
                            )}
                                  <span className="text-xs sm:text-sm text-gray-500">{product.unit}</span>
                          </div>
                        </div>
                              <p className="text-base sm:text-lg font-semibold text-green-600 mb-2 sm:mb-3">₱{(product.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                              <div className="flex justify-between items-center min-w-0">
                                <span className={`text-xs sm:text-sm font-medium ${availableStock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  Stock: {availableStock}
                          </span>
                        <button
                                  onClick={() => addToCart(product)}
                                  disabled={availableStock === 0 || (isInCart && cartQuantity >= availableStock)}
                                  className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors flex-shrink-0 ${
                                    availableStock > 0 && (!isInCart || cartQuantity < availableStock)
                                      ? currentTheme === 'green' ? 'bg-green-600 text-white hover:bg-green-700' :
                                  currentTheme === 'red' ? 'bg-red-600 text-white hover:bg-red-700' :
                                  currentTheme === 'yellow' ? 'bg-yellow-600 text-white hover:bg-yellow-700' :
                                  'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          }`}
                        >
                                  {availableStock === 0 ? 'Out' : 
                                   isInCart && cartQuantity >= availableStock ? 'Max' :
                                   isInCart ? 'More' : 'Add'}
                        </button>
                        </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Desktop Cart - Hidden on mobile */}
            <div className="hidden lg:block lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-8">
                <h3 className="text-lg font-semibold mb-4">Order Draft ({calculateItemCount()} items)</h3>
              
                {cartItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No items in draft</p>
              ) : (
                <>
                    <div className="space-y-3 mb-6">
                      {cartItems.map(item => {
                        const availableStock = getCartItemAvailableStock(item)
                        const hasIssue = item.quantity > availableStock
                      
                      return (
                          <div key={item.product_id} className={`flex justify-between items-center p-3 rounded-lg ${
                            hasIssue ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                          }`}>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{item.product.product_name || item.product.name}</p>
                            <p className="text-xs text-gray-500">₱{(item.product.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per {item.product.unit}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <button
                                  onClick={() => updateCartQuantity(item.product_id, item.quantity - 1)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                                <span className={`text-sm w-8 text-center ${hasIssue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                                {item.quantity}
                              </span>
                              <button
                                  onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)}
                                  disabled={item.quantity >= availableStock}
                                  className="p-1 text-gray-400 hover:text-gray-600 disabled:text-gray-300"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                              <p className={`text-xs mt-1 ${hasIssue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                              Max: {availableStock} | Total: ₱{((item.product.price || 0) * item.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <button
                              onClick={() => removeFromCart(item.product_id)}
                            className="text-red-500 hover:text-red-700 ml-2"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-medium">Total:</span>
                        <span className="font-semibold text-green-600 text-lg">₱{calculateTotal().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    
                    <button
                        onClick={() => setShowCartModal(true)}
                        className={`w-full flex items-center justify-center space-x-2 px-4 py-3 text-white rounded-lg transition-colors ${
                        currentTheme === 'green' ? 'bg-green-600 hover:bg-green-700' :
                        currentTheme === 'red' ? 'bg-red-600 hover:bg-red-700' :
                        currentTheme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
                        'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                        <Edit3 className="h-5 w-5" />
                        <span>View Changes</span>
                    </button>
                  </div>
                </>
              )}
              </div>
            </div>
          </div>
        )}

        {/* Mobile Floating Cart for Modify Order - Only shown on mobile during modify view */}
        {currentView === 'modify' && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40">
            <div className="px-2 py-2">
              <div className="flex justify-between items-center mb-2 min-w-0">
                <span className="font-medium text-sm truncate">Draft: {calculateItemCount()} items • {deliveryType === 'delivery' ? 'Delivery' : 'Pickup'}</span>
                <span className="font-bold text-base text-green-600 flex-shrink-0 ml-2">₱{calculateTotal().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
              <button
                onClick={() => setShowCartModal(true)}
                className={`w-full flex items-center justify-center space-x-1 px-2 py-2 rounded-lg transition-colors text-xs sm:text-sm min-w-0 ${
                  currentTheme === 'green' ? 'bg-green-600 hover:bg-green-700 text-white' :
                  currentTheme === 'red' ? 'bg-red-600 hover:bg-red-700 text-white' :
                  currentTheme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700 text-white' :
                  'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <Edit3 className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="truncate">View Changes</span>
              </button>
      </div>
          </div>
        )}

        {/* Add bottom padding on mobile to account for floating cart in modify view */}
        {currentView === 'modify' && (
          <div className="lg:hidden pb-20"></div>
                )}
              </div>

      {/* Cart Modal - Only show if no pending order or in modify mode */}
      {showCartModal && (!pendingOrder || currentView === 'modify') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-lg sm:rounded-lg w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b min-w-0 flex-shrink-0">
              <h2 className="text-base sm:text-lg font-semibold truncate min-w-0 flex-1">
                {currentView === 'modify' ? 'Order Draft' : 'Your Cart'} ({calculateItemCount()} items)
              </h2>
              <button
                onClick={() => setShowCartModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-3 sm:p-4 flex-1 overflow-y-auto min-h-0">
              {cartItems.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No items in {currentView === 'modify' ? 'draft' : 'cart'}</p>
              ) : (
                <div className="space-y-3">
                  {cartItems.map(item => {
                    const availableStock = getCartItemAvailableStock(item)
                    const hasIssue = item.quantity > availableStock
                    
                    return (
                      <div key={item.product_id} className={`flex justify-between items-center p-2 sm:p-3 rounded-lg min-w-0 ${
                        hasIssue ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                      }`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.product.product_name || item.product.name}</p>
                          <p className="text-xs text-gray-500">₱{(item.product.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per {item.product.unit}</p>
                          <div className="flex items-center space-x-2 mt-1">
                          <button
                              onClick={() => updateCartQuantity(item.product_id, item.quantity - 1)}
                              className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                            <span className={`text-sm w-6 sm:w-8 text-center ${hasIssue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                            {item.quantity}
                          </span>
                          <button
                              onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)}
                              disabled={item.quantity >= availableStock}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:text-gray-300 flex-shrink-0"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                          <p className={`text-xs mt-1 ${hasIssue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                            Max: {availableStock} | Total: ₱{((item.product.price || 0) * item.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <button
                          onClick={() => removeFromCart(item.product_id)}
                          className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0"
                        >
                          <X className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {cartItems.length > 0 && (
              <div className="p-3 sm:p-4 border-t bg-gray-50 flex-shrink-0">
                {/* Delivery Type Selection */}
                <div className="mb-3 sm:mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Type</label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="deliveryTypeModal"
                        value="delivery"
                        checked={deliveryType === 'delivery'}
                        onChange={(e) => setDeliveryType(e.target.value as 'delivery')}
                        className="mr-2"
                      />
                      <span className="text-sm">Delivery (+₱500)</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="deliveryTypeModal"
                        value="pickup"
                        checked={deliveryType === 'pickup'}
                        onChange={(e) => setDeliveryType(e.target.value as 'pickup')}
                        className="mr-2"
                      />
                      <span className="text-sm">Pickup (5% off)</span>
                    </label>
                  </div>
                </div>

                {/* Subtotal and Total */}
                <div className="space-y-2 mb-3 sm:mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Subtotal:</span>
                    <span className="text-sm text-gray-600">₱{calculateSubtotal().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {deliveryType === 'delivery' && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Delivery Fee:</span>
                      {calculateSubtotal() >= 10000 ? (
                        <span className="text-sm text-green-600">FREE (Order over ₱10k)</span>
                      ) : (
                        <span className="text-sm text-gray-600">+₱500.00</span>
                      )}
                    </div>
                  )}
                  {deliveryType === 'pickup' && calculateSubtotal() >= 10000 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Pickup Discount (5%):</span>
                      <span className="text-sm text-green-600">-₱{(calculateSubtotal() * 0.05).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {deliveryType === 'pickup' && calculateSubtotal() < 10000 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Pickup Discount:</span>
                      <span className="text-sm text-gray-500">Not available (Order under ₱10k)</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="font-medium text-sm sm:text-base">Total:</span>
                    <span className="font-semibold text-green-600 text-base sm:text-lg flex-shrink-0 ml-2">₱{calculateTotal().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
                
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4">
                    <p className="text-red-800 text-xs sm:text-sm whitespace-pre-line">{error}</p>
                  </div>
                )}
                
                <div className="space-y-2">
                  {currentView === 'modify' ? (
                    <>
                <button
                        onClick={handleUpdateOrder}
                        disabled={loading || cartItems.length === 0}
                        className={`w-full flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 sm:py-3 text-white rounded-lg disabled:opacity-50 transition-colors text-sm sm:text-base ${
                    currentTheme === 'green' ? 'bg-green-600 hover:bg-green-700' :
                    currentTheme === 'red' ? 'bg-red-600 hover:bg-red-700' :
                    currentTheme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
                    'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loading ? (
                          <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white flex-shrink-0"></div>
                        ) : (
                          <Edit3 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                        )}
                        <span className="truncate">{loading ? 'Updating...' : 'Update Order'}</span>
                </button>
                      
                      <button
                        onClick={() => {
                          setCartItems([])
                          setCurrentView('home')
                          setShowCartModal(false)
                        }}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm sm:text-base"
                      >
                        Cancel Changes
                      </button>
                    </>
                  ) : (
                <button
                  onClick={handleSubmitOrder}
                      disabled={loading || cartItems.length === 0}
                      className={`w-full flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 sm:py-3 text-white rounded-lg disabled:opacity-50 transition-colors text-sm sm:text-base ${
                    currentTheme === 'green' ? 'bg-green-600 hover:bg-green-700' :
                    currentTheme === 'red' ? 'bg-red-600 hover:bg-red-700' :
                    currentTheme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
                    'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loading ? (
                        <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white flex-shrink-0"></div>
                      ) : (
                        <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                      )}
                      <span className="truncate">{loading ? 'Submitting...' : 'Submit Order'}</span>
                </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Past Orders Modal */}
      {showPastOrders && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <h2 className="text-lg font-semibold">Past Orders</h2>
              <button
                onClick={() => setShowPastOrders(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto min-h-0">
              {pastOrders.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No past orders found</p>
              ) : (
                <div className="space-y-4">
                  {pastOrders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-medium text-gray-900">Order #{order.id.slice(-8)}</h3>
                          <p className="text-sm text-gray-500">
                            {new Date(order.created_at).toLocaleDateString()} at {new Date(order.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            order.status === 'released' 
                              ? 'bg-green-100 text-green-800' 
                              : order.status === 'paid'
                              ? 'bg-blue-100 text-blue-800'
                              : order.status === 'complete'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                          <p className="text-lg font-semibold text-gray-900 mt-1">
                            ₱{order.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {order.order_details.map((detail: any) => (
                          <div key={detail.id} className="flex justify-between items-center text-sm">
                            <span className="text-gray-900">{detail.products.name}</span>
                            <span className="text-gray-600">
                              {detail.quantity} × ₱{detail.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = ₱{(detail.quantity * detail.unit_price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                        
                        {/* Order Summary with Delivery Fee/Discount */}
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-600">Subtotal:</span>
                              <span className="text-gray-600">₱{getTotalAmount(order).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            {order.delivery_type === 'delivery' && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Delivery Fee:</span>
                                {getTotalAmount(order) >= 10000 ? (
                                  <span className="text-green-600">FREE (Order over ₱10k)</span>
                                ) : (
                                  <span className="text-gray-600">+₱500.00</span>
                                )}
                              </div>
                            )}
                            {order.delivery_type === 'pickup' && getTotalAmount(order) >= 10000 && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Pickup Discount (5%):</span>
                                <span className="text-green-600">-₱{(getTotalAmount(order) * 0.05).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            {order.delivery_type === 'pickup' && getTotalAmount(order) < 10000 && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Pickup Discount:</span>
                                <span className="text-gray-500">Not available (Order under ₱10k)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => printReceipt(order)}
                            className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                              currentTheme === 'green' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                              currentTheme === 'red' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                              currentTheme === 'yellow' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                              'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                          >
                            <Printer className="h-4 w-4" />
                            <span>Print Receipt</span>
                          </button>
                          
                          {order.status === 'paid' && order.deposit_slip_url && (
                            <a
                              href={order.deposit_slip_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                            >
                              <span>View Deposit Slip</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="bg-white border-t py-4 mt-8">
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          <p className="text-center text-xs text-gray-500">© Gilnaks Food Corporation</p>
        </div>
      </div>
    </div>
  )
}