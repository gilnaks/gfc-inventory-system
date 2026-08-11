'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase, Brand } from '../../lib/supabase'
import { ShoppingCart, Package, CheckCircle, Check, Clock, XCircle, Eye, Truck, Printer, Trash2, Edit, CreditCard, Building2, Store, X, Upload, History } from 'lucide-react'
import { logCustomerOrderStatusChange, loadCustomerOrderStatusHistory } from '../../lib/customer-order-status-history'
import type { CustomerOrderStatusHistory } from '../../lib/supabase'
import { getBrandIconColorClass } from '../../lib/brand-colors'
import { formatPhilippinesDateTime, formatPhilippinesTransferSheetDate } from '../../lib/timezone'
import { TRANSFER_SHEET_PRINT_STYLES, TRANSFER_SHEET_PRINT_SCRIPT } from '../../lib/transferSheetPrintStyles'
import { renderTransferSheetItemsBlock } from '../../lib/transferSheetPrintItems'
import { renderTransferSheetTotalsSection } from '../../lib/transferSheetPrintTotals'
import { buildTransferSheetDsirPayload } from '../../lib/transferSheetDsirQr'
import {
  buildCategoryPortalMap,
  filterProductsForOrderPortal,
  type CategoryPortalSettings,
} from '../../lib/product-category-settings'
import { Modal } from './Modal'
import { useAdminPasswordConfirm } from '../hooks/useAdminPasswordConfirm'

interface Location {
  id: string
  name: string
  passkey: string
  franchisee?: string
  company_owned?: boolean
  is_remote?: boolean
  brand?: Brand
}

function isRemoteStoreLocation(location?: Location | null): boolean {
  return !!location?.is_remote
}

function logisticsLabelForOrder(order: {
  location?: Location | null
  delivery_type: CustomerOrder['delivery_type']
}): string {
  if (order.delivery_type === 'shipment') return 'Shipment'
  if (isRemoteStoreLocation(order.location)) return 'Remote'
  if (order.delivery_type === 'delivery') return 'Delivery'
  if (order.delivery_type === 'pickup') return 'Pickup'
  return 'None'
}

function logisticsBadgeClassForOrder(order: {
  location?: Location | null
  delivery_type: CustomerOrder['delivery_type']
}): string {
  if (order.delivery_type === 'shipment' || isRemoteStoreLocation(order.location)) {
    return 'bg-purple-100 text-purple-800'
  }
  if (order.delivery_type === 'delivery') return 'bg-blue-100 text-blue-800'
  if (order.delivery_type === 'pickup') return 'bg-green-100 text-green-800'
  return 'bg-gray-200 text-gray-700'
}

function shipmentBillOfLadingViewable(order: {
  location?: Location | null
  delivery_type: CustomerOrder['delivery_type']
  bill_of_lading_url?: string | null
}): boolean {
  return (
    isRemoteStoreLocation(order.location) &&
    order.delivery_type === 'shipment' &&
    !!order.bill_of_lading_url
  )
}

interface CustomerOrder {
  id: string
  location_id: string
  brand_id: string
  customer_name: string
  customer_contact?: string
  status: 'pending' | 'approved' | 'in-transit' | 'verified' | 'fulfilled' | 'paid' | 'complete' | 'cancelled'
  total_amount: number
  delivery_type: 'delivery' | 'pickup' | 'none' | 'shipment'
  notes?: string
  created_at: string
  updated_at: string
  returnable_pans_image_url?: string
  deposit_slip_url?: string
  freight_fee?: number
  bill_of_lading_url?: string | null
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
  currentUsername?: string
}

function formatOrderStatusLabel(status: string): string {
  return status.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function OrderManager({ selectedBrand, onOrderUpdate, theme = 'blue', currentUsername = '' }: OrderManagerProps) {
  const { requestAdminPassword, AdminPasswordModal } = useAdminPasswordConfirm()
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const ordersRef = useRef<CustomerOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)
  const updatingOrderRef = useRef<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState<CustomerOrder | null>(null)
  const [originalOrder, setOriginalOrder] = useState<CustomerOrder | null>(null)
  const [availableProducts, setAvailableProducts] = useState<any[]>([])
  const [overrideCategoryPortalByKey, setOverrideCategoryPortalByKey] = useState<
    Record<string, CategoryPortalSettings>
  >({})
  const [overrideLoading, setOverrideLoading] = useState(false)
  const [overrideBolFile, setOverrideBolFile] = useState<File | null>(null)
  const [overrideBolPreview, setOverrideBolPreview] = useState<string | null>(null)
  const [showBillOfLadingModal, setShowBillOfLadingModal] = useState(false)
  const [selectedBillOfLadingUrl, setSelectedBillOfLadingUrl] = useState<string | null>(null)
  const [completePage, setCompletePage] = useState(1)
  const [cancelledPage, setCancelledPage] = useState(1)
  const itemsPerPage = 10
  const [showReturnablePansModal, setShowReturnablePansModal] = useState(false)
  const [selectedReturnablePansImage, setSelectedReturnablePansImage] = useState<string | null>(null)
  const [selectedReturnablePansOrder, setSelectedReturnablePansOrder] = useState<CustomerOrder | null>(null)
  const [showDepositSlipModal, setShowDepositSlipModal] = useState(false)
  const [selectedDepositSlipImage, setSelectedDepositSlipImage] = useState<string | null>(null)
  const [selectedDepositSlipOrder, setSelectedDepositSlipOrder] = useState<CustomerOrder | null>(null)
  const [statusHistoryOrder, setStatusHistoryOrder] = useState<CustomerOrder | null>(null)
  const [statusHistory, setStatusHistory] = useState<CustomerOrderStatusHistory[]>([])
  const [loadingStatusHistory, setLoadingStatusHistory] = useState(false)

  useEffect(() => {
    if (!statusHistoryOrder) {
      setStatusHistory([])
      return
    }
    let cancelled = false
    setLoadingStatusHistory(true)
    loadCustomerOrderStatusHistory(statusHistoryOrder.id).then((rows) => {
      if (!cancelled) {
        setStatusHistory(rows)
        setLoadingStatusHistory(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [statusHistoryOrder?.id])

  // Location house/building icons follow that order's brand color
  const getLocationIconColor = (order: CustomerOrder) =>
    getBrandIconColorClass(order.brand?.name || order.location?.brand?.name)

  useEffect(() => {
    fetchOrders()
  }, [selectedBrand])

  useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  useEffect(() => {
    updatingOrderRef.current = updatingOrder
  }, [updatingOrder])

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

          if (updatingOrderRef.current) {
            console.log('Skipping realtime refetch - currently updating order')
            return
          }

          const row = payload.new as { id?: string; status?: string } | undefined
          if (row?.id && row.status) {
            const existing = ordersRef.current.find((o) => o.id === row.id)
            if (existing?.status === row.status) {
              return
            }
          }

          fetchOrders({ silent: true })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedBrand])

  const fetchOrders = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true)
    }
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

  const updateOrderStatus = async (orderId: string, newStatus: 'pending' | 'approved' | 'in-transit' | 'verified' | 'fulfilled' | 'paid' | 'complete' | 'cancelled') => {
    // Prevent double execution
    if (updatingOrder === orderId) {
      console.log('Order update already in progress for:', orderId)
      return
    }
    
    setUpdatingOrder(orderId)
    
    // Optimistic UI update - update the order in state immediately
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === orderId 
          ? { ...order, status: newStatus, updated_at: new Date().toISOString() }
          : order
      )
    )
    
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
        // Revert optimistic update on error
        fetchOrders()
        return
      }

      // If fulfilling order, update inventory quantities
      if (newStatus === 'fulfilled') {
        // Verify order is currently in in-transit status
        if (orderData.status !== 'in-transit') {
          alert(`Cannot fulfill order from ${orderData.status} status. Order must be in-transit first.`)
          fetchOrders() // Revert optimistic update
          return
        }

        // First get the order details to know which products and quantities to update
        const { data: orderDetails, error: detailsError } = await supabase
          .from('order_details')
          .select('product_id, quantity')
          .eq('order_id', orderId)

        if (detailsError) {
          console.error('Error fetching order details:', detailsError)
          alert('Failed to fetch order details')
          fetchOrders() // Revert optimistic update
          return
        }

        if (!orderDetails || orderDetails.length === 0) {
          alert('Order has no items to fulfill')
          fetchOrders() // Revert optimistic update
          return
        }

        // Batch fetch all product data with fresh values
        const productIds = orderDetails.map(d => d.product_id).filter(Boolean)
        if (productIds.length === 0) {
          alert('No valid products found in order')
          fetchOrders() // Revert optimistic update
          return
        }

        const { data: productsData, error: fetchError } = await supabase
          .from('products')
          .select('id, initial_stock, released')
          .in('id', productIds)

        if (fetchError) {
          console.error('Error fetching product data:', fetchError)
          alert('Failed to fetch product data')
          fetchOrders() // Revert optimistic update
          return
        }

        if (!productsData || productsData.length === 0) {
          alert('No product data found')
          fetchOrders() // Revert optimistic update
          return
        }

        // Create a map for quick lookup
        const productsMap = new Map(productsData.map(p => [p.id, p]))

        // Validate all quantities before making any updates
        const validationErrors: string[] = []
        for (const detail of orderDetails) {
          if (!detail.product_id) continue

          const productData = productsMap.get(detail.product_id)
          if (!productData) {
            validationErrors.push(`Product ${detail.product_id} not found`)
            continue
          }

          const currentReleased = productData.released || 0
          const currentInitialStock = productData.initial_stock || 0
          
          if (currentReleased < detail.quantity) {
            validationErrors.push(`Insufficient released quantity for product ${detail.product_id}. Released: ${currentReleased}, Required: ${detail.quantity}`)
          }
          
          if (currentInitialStock < detail.quantity) {
            validationErrors.push(`Insufficient initial stock for product ${detail.product_id}. Initial Stock: ${currentInitialStock}, Required: ${detail.quantity}`)
          }
        }

        if (validationErrors.length > 0) {
          alert(`Cannot fulfill order:\n${validationErrors.join('\n')}`)
          fetchOrders() // Revert optimistic update
          return
        }

        // All validations passed - update all products
        const updatePromises = orderDetails.map(async (detail) => {
          if (!detail.product_id) return

          const productData = productsMap.get(detail.product_id)
          if (!productData) {
            throw new Error(`Product ${detail.product_id} not found during update`)
          }

          const currentInitialStock = productData.initial_stock || 0
          const currentReleased = productData.released || 0
          
          // Calculate new values
          const newInitialStock = currentInitialStock - detail.quantity
          const newReleased = currentReleased - detail.quantity

          // Validate: ensure values don't go negative (shouldn't happen after validation, but safety check)
          if (newInitialStock < 0) {
            throw new Error(`Invalid initial_stock value for product ${detail.product_id}. Current: ${currentInitialStock}, Subtracting: ${detail.quantity}`)
          }
          
          if (newReleased < 0) {
            throw new Error(`Invalid released value for product ${detail.product_id}. Current: ${currentReleased}, Subtracting: ${detail.quantity}`)
          }

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
            throw new Error(`Failed to update product ${detail.product_id}: ${updateError.message}`)
          }
        })

        const results = await Promise.allSettled(updatePromises)
        const failed = results.filter(r => r.status === 'rejected')
        if (failed.length > 0) {
          const errorMessages = failed.map(r => r.status === 'rejected' ? r.reason?.message || 'Unknown error' : '').filter(Boolean)
          alert(`Failed to update some product quantities:\n${errorMessages.join('\n')}`)
          fetchOrders() // Revert optimistic update
          return
        }
      }

      // If dispatching order (moving to in-transit), move from reserved to released
      if (newStatus === 'in-transit') {
        // Verify order is currently in approved status (not already in-transit)
        if (orderData.status !== 'approved') {
          alert(`Cannot move order to in-transit from ${orderData.status} status. Order must be approved first.`)
          fetchOrders() // Revert optimistic update
          return
        }

        // First get the order details to know which products and quantities to update
        const { data: orderDetails, error: detailsError } = await supabase
          .from('order_details')
          .select('product_id, quantity')
          .eq('order_id', orderId)

        if (detailsError) {
          console.error('Error fetching order details:', detailsError)
          alert('Failed to fetch order details')
          fetchOrders() // Revert optimistic update
          return
        }

        if (!orderDetails || orderDetails.length === 0) {
          alert('Order has no items to dispatch')
          fetchOrders() // Revert optimistic update
          return
        }

        // Batch fetch all product data with fresh reserved/released values
        const productIds = orderDetails.map(d => d.product_id).filter(Boolean)
        if (productIds.length === 0) {
          alert('No valid products found in order')
          fetchOrders() // Revert optimistic update
          return
        }

        const { data: productsData, error: fetchError } = await supabase
          .from('products')
          .select('id, reserved, released')
          .in('id', productIds)

        if (fetchError) {
          console.error('Error fetching product data:', fetchError)
          alert('Failed to fetch product data')
          fetchOrders() // Revert optimistic update
          return
        }

        if (!productsData || productsData.length === 0) {
          alert('No product data found')
          fetchOrders() // Revert optimistic update
          return
        }

        // Create a map for quick lookup
        const productsMap = new Map(productsData.map(p => [p.id, p]))

        // Validate all quantities before making any updates
        const validationErrors: string[] = []
        for (const detail of orderDetails) {
          if (!detail.product_id) continue

          const productData = productsMap.get(detail.product_id)
          if (!productData) {
            validationErrors.push(`Product ${detail.product_id} not found`)
            continue
          }

          const currentReserved = productData.reserved || 0
          if (currentReserved < detail.quantity) {
            validationErrors.push(`Insufficient reserved quantity for product ${detail.product_id}. Reserved: ${currentReserved}, Required: ${detail.quantity}`)
          }
        }

        if (validationErrors.length > 0) {
          alert(`Cannot move order to in-transit:\n${validationErrors.join('\n')}`)
          fetchOrders() // Revert optimistic update
          return
        }

        // All validations passed - update all products
        const updatePromises = orderDetails.map(async (detail) => {
          if (!detail.product_id) return

          const productData = productsMap.get(detail.product_id)
          if (!productData) {
            throw new Error(`Product ${detail.product_id} not found during update`)
          }

          const currentReserved = productData.reserved || 0
          const currentReleased = productData.released || 0
          
          // Calculate new values
          const newReserved = currentReserved - detail.quantity
          const newReleased = currentReleased + detail.quantity

          // Validate: ensure reserved doesn't go negative (shouldn't happen after validation, but safety check)
          if (newReserved < 0) {
            throw new Error(`Invalid reserved value for product ${detail.product_id}. Current: ${currentReserved}, Subtracting: ${detail.quantity}`)
          }

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
            throw new Error(`Failed to update product ${detail.product_id}: ${updateError.message}`)
          }
        })

        const results = await Promise.allSettled(updatePromises)
        const failed = results.filter(r => r.status === 'rejected')
        if (failed.length > 0) {
          const errorMessages = failed.map(r => r.status === 'rejected' ? r.reason?.message || 'Unknown error' : '').filter(Boolean)
          alert(`Failed to update some product quantities:\n${errorMessages.join('\n')}`)
          fetchOrders() // Revert optimistic update
          return
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

        // Batch fetch all product data
        const productIds = orderDetails?.map(d => d.product_id).filter(Boolean) || []
        if (productIds.length > 0) {
          const { data: productsData, error: fetchError } = await supabase
            .from('products')
            .select('id, reserved, released')
            .in('id', productIds)

          if (fetchError) {
            console.error('Error fetching product data:', fetchError)
            // Continue with other products instead of failing completely
          } else {
            // Create a map for quick lookup
            const productsMap = new Map(productsData?.map(p => [p.id, p]))

            // Batch update all products in parallel
            const updatePromises = (orderDetails || []).map(async (detail) => {
              if (!detail.product_id) return

              const productData = productsMap.get(detail.product_id)
              if (!productData) {
                throw new Error(`Product not found for product_id: ${detail.product_id}`)
              }

              // Determine what to return based on current state
              const currentReleased = productData.released || 0
              const currentReserved = productData.reserved || 0
              
              let updateData: any = { updated_at: new Date().toISOString() }
              
              if (currentReleased >= detail.quantity) {
                // If there are enough released quantities, return those
                const newReleased = currentReleased - detail.quantity
                if (newReleased < 0) {
                  throw new Error(`Invalid released value for product ${detail.product_id}. Current: ${currentReleased}, Subtracting: ${detail.quantity}`)
                }
                updateData.released = newReleased
              } else if (currentReserved >= detail.quantity) {
                // If there are enough reserved quantities, return those
                const newReserved = currentReserved - detail.quantity
                if (newReserved < 0) {
                  throw new Error(`Invalid reserved value for product ${detail.product_id}. Current: ${currentReserved}, Subtracting: ${detail.quantity}`)
                }
                updateData.reserved = newReserved
              } else {
                // Handle partial quantities in both reserved and released
                const remainingToReturn = detail.quantity
                let releasedToReturn = Math.min(remainingToReturn, currentReleased)
                let reservedToReturn = remainingToReturn - releasedToReturn
                
                const newReleased = currentReleased - releasedToReturn
                const newReserved = currentReserved - reservedToReturn
                
                // Validate: ensure values don't go negative
                if (newReleased < 0 || newReserved < 0) {
                  throw new Error(`Invalid inventory values for product ${detail.product_id}. Released: ${currentReleased} -> ${newReleased}, Reserved: ${currentReserved} -> ${newReserved}`)
                }
                
                updateData.released = newReleased
                updateData.reserved = newReserved
              }

              const { error: updateError } = await supabase
                .from('products')
                .update(updateData)
                .eq('id', detail.product_id)

              if (updateError) {
                console.error('Error updating product quantities:', updateError)
                throw new Error(`Failed to update product ${detail.product_id}: ${updateError.message}`)
              }
            })

            const results = await Promise.allSettled(updatePromises)
            const failed = results.filter(r => r.status === 'rejected')
            if (failed.length > 0) {
              const errorMessages = failed.map(r => r.status === 'rejected' ? r.reason?.message || 'Unknown error' : '').filter(Boolean)
              alert(`Failed to update some product quantities:\n${errorMessages.join('\n')}`)
              fetchOrders() // Revert optimistic update
              return
            }
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
        // Revert optimistic update on error
        fetchOrders()
        return
      }

      await logCustomerOrderStatusChange({
        orderId,
        oldStatus: orderData.status,
        newStatus,
        changedBy: currentUsername || 'system',
      })

      const brandId = orderData.brand_id as string | undefined
      if (brandId && newStatus === 'cancelled') {
        try {
          const { reverseOrderAccountingOnCancel } = await import('../../lib/accounting-cogs')
          await reverseOrderAccountingOnCancel(orderId, brandId, 'system')
        } catch (postErr) {
          console.warn('Accounting reversal on cancel skipped or failed:', postErr)
        }
      }
      if (brandId && (newStatus === 'fulfilled' || newStatus === 'complete')) {
        try {
          const { postCustomerOrderRevenue, postCustomerOrderCash } = await import(
            '../../lib/accounting-posting-rules'
          )
          if (newStatus === 'fulfilled') {
            await postCustomerOrderRevenue(orderId, brandId, 'system')
            const { postCogsForFulfilledOrder } = await import('../../lib/accounting-cogs')
            await postCogsForFulfilledOrder(orderId, brandId, 'system')
          }
          if (newStatus === 'complete') {
            await postCustomerOrderCash(orderId, brandId, 'system')
          }
        } catch {
          // Posting errors are recorded in accounting_posting_errors for retry from Accounting.
        }
      }

      // Trigger product refresh (no need to refetch orders - already updated optimistically)
      if (onOrderUpdate) {
        onOrderUpdate()
      }
    } catch (error) {
      console.error('Error updating order status:', error)
      alert('Failed to update order status')
      // Revert optimistic update on error
      fetchOrders()
    } finally {
      setUpdatingOrder(null)
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    try {
      setUpdatingOrder(orderId)

      // Optimistic UI update - remove order from state immediately
      setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId))

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
        fetchOrders() // Revert optimistic update
        return
      }

      // If the order is fulfilled, add the released quantities back to initial stock
      if (orderData.status === 'fulfilled' && orderData.order_details) {
        // Batch fetch all products first
        const productIds = orderData.order_details
          .map(d => d.product_id)
          .filter(Boolean)
        
        if (productIds.length > 0) {
          const { data: productsData, error: fetchError } = await supabase
            .from('products')
            .select('id, initial_stock, released')
            .in('id', productIds)

          if (fetchError) {
            console.error('Error fetching products:', fetchError)
            alert('Failed to fetch product data')
            fetchOrders() // Revert optimistic update
            return
          }

          const productsMap = new Map(productsData?.map(p => [p.id, p]))

          // Update all products in parallel
          const updatePromises = orderData.order_details.map(async (detail) => {
            if (!detail.product_id) return

            const productData = productsMap.get(detail.product_id)
            if (!productData) {
              console.warn('Product not found for product_id:', detail.product_id)
              return
            }

            const newInitialStock = (productData.initial_stock || 0) + detail.quantity
            const newReleased = Math.max(0, (productData.released || 0) - detail.quantity)

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
              throw new Error('Failed to update product quantities')
            }
          })

          const results = await Promise.allSettled(updatePromises)
          const failed = results.filter(r => r.status === 'rejected')
          if (failed.length > 0) {
            alert('Failed to update some product quantities')
            fetchOrders() // Revert optimistic update
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
        fetchOrders() // Revert optimistic update
        return
      }

      // Trigger product refresh (no need to refetch orders - already removed optimistically)
      if (onOrderUpdate) {
        onOrderUpdate()
      }
    } catch (error) {
      console.error('Error deleting order:', error)
      alert('Failed to delete order')
      fetchOrders() // Revert optimistic update
    } finally {
      setUpdatingOrder(null)
    }
  }

  const handleDeleteCompleteOrder = async (orderId: string) => {
    try {
      setUpdatingOrder(orderId)

      // Optimistic UI update - remove order from state immediately
      setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId))

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
        fetchOrders() // Revert optimistic update
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
        fetchOrders() // Revert optimistic update
        return
      }

      // Trigger product refresh (no need to refetch orders - already removed optimistically)
      if (onOrderUpdate) {
        onOrderUpdate()
      }

      alert('Complete order deleted successfully')
    } catch (error) {
      console.error('Error deleting complete order:', error)
      alert('Failed to delete complete order')
      fetchOrders() // Revert optimistic update
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


  const getCategoryTotals = useCallback((order: CustomerOrder) => {
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
  }, [])

  const computeOrderGrandTotal = useCallback((order: CustomerOrder) => {
    const subtotal = order.order_details.reduce((total, detail) => {
      return total + detail.unit_price * detail.quantity
    }, 0)

    if (order.delivery_type === 'shipment') {
      return subtotal + (Number(order.freight_fee) || 0)
    }
    if (order.delivery_type === 'delivery') {
      return subtotal + (subtotal >= 10000 ? 0 : 500)
    }
    if (order.delivery_type === 'pickup' && subtotal >= 10000) {
      return subtotal - subtotal * 0.05
    }
    return subtotal
  }, [])

  const getTotalAmount = computeOrderGrandTotal

  // Memoized helper functions for categorization and pagination
  const ordersByStatus = useMemo(() => {
    return {
      pending: orders.filter(order => order.status === 'pending'),
      approved: orders.filter(order => order.status === 'approved'),
      'in-transit': orders.filter(order => order.status === 'in-transit'),
      fulfilled: orders.filter(order => order.status === 'fulfilled'),
      paid: orders.filter(order => order.status === 'paid'),
      complete: orders.filter(order => order.status === 'complete'),
      cancelled: orders.filter(order => order.status === 'cancelled')
    }
  }, [orders])

  const getOrdersByStatus = useCallback((status: string) => {
    return ordersByStatus[status as keyof typeof ordersByStatus] || []
  }, [ordersByStatus])

  const getPaginatedOrders = useCallback((status: string, page: number) => {
    const statusOrders = getOrdersByStatus(status)
    // Use 5 items per page for complete and cancelled orders, 10 for others
    const pageSize = (status === 'complete' || status === 'cancelled') ? 5 : itemsPerPage
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    return statusOrders.slice(startIndex, endIndex)
  }, [getOrdersByStatus, itemsPerPage])

  const getTotalPages = useCallback((status: string) => {
    const statusOrders = getOrdersByStatus(status)
    // Use 5 items per page for complete and cancelled orders, 10 for others
    const pageSize = (status === 'complete' || status === 'cancelled') ? 5 : itemsPerPage
    return Math.ceil(statusOrders.length / pageSize)
  }, [getOrdersByStatus, itemsPerPage])

  // Reusable table component for orders
  const OrderTable = ({ orders, showPagination = false, currentPage = 1, onPageChange = () => {}, showDepositSlipColumn = false }: {
    orders: CustomerOrder[]
    showPagination?: boolean
    currentPage?: number
    onPageChange?: (page: number) => void
    showDepositSlipColumn?: boolean
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
                {showDepositSlipColumn && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deposit Slip
                </th>
                )}
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
                          <Building2 className={`h-4 w-4 ${getLocationIconColor(order)}`} />
                        </div>
                      ) : isRemoteStoreLocation(order.location) ? (
                        <div title="Remote store">
                          <Store className={`h-4 w-4 ${getLocationIconColor(order)}`} />
                        </div>
                      ) : (
                        <div title="Franchise">
                          <Store className={`h-4 w-4 ${getLocationIconColor(order)}`} />
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
                      {shipmentBillOfLadingViewable(order) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBillOfLadingUrl(order.bill_of_lading_url || null)
                            setShowBillOfLadingModal(true)
                          }}
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:ring-2 hover:ring-purple-300 transition-shadow ${logisticsBadgeClassForOrder(order)}`}
                          title="View bill of lading"
                        >
                          {logisticsLabelForOrder(order)}
                        </button>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${logisticsBadgeClassForOrder(order)}`}
                        >
                          {logisticsLabelForOrder(order)}
                        </span>
                      )}
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
                            type="button"
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
                  {showDepositSlipColumn && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {order.deposit_slip_url ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDepositSlipImage(order.deposit_slip_url!)
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
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-100"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      
                      {order.status === 'pending' && (
                        <button
                          type="button"
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
                          type="button"
                          onClick={() => {
                            if (confirm('Are you sure you want to dispatch this order? This action will move reserved inventory to released and cannot be undone.')) {
                              updateOrderStatus(order.id, 'in-transit')
                            }
                          }}
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
                      
                      {order.status === 'in-transit' && (
                        <button
                          type="button"
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

                      {order.status === 'paid' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm('Are you sure you want to mark this order as complete?')) {
                              return
                            }
                            updateOrderStatus(order.id, 'complete')
                          }}
                          disabled={updatingOrder === order.id}
                          className={`p-1 rounded transition-all duration-200 ease-in-out ${
                            updatingOrder === order.id
                              ? 'text-gray-400 cursor-not-allowed'
                              : theme === 'green'
                                ? 'text-green-600 hover:text-green-900 hover:bg-green-50'
                                : theme === 'red'
                                  ? 'text-red-600 hover:text-red-900 hover:bg-red-50'
                                  : theme === 'yellow'
                                    ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50'
                                    : 'text-blue-600 hover:text-blue-900 hover:bg-blue-50'
                          }`}
                          title="Mark Complete"
                        >
                          {updatingOrder === order.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      
                      {(order.status === 'pending' || order.status === 'approved' || order.status === 'in-transit') && (
                        <button
                          type="button"
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
                          type="button"
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
                          type="button"
                          onClick={async () => {
                            const confirmed = await requestAdminPassword({
                              title: 'Delete order',
                              message:
                                order.status === 'fulfilled'
                                  ? 'Delete this fulfilled order? This will restore the released quantities back to initial stock and cannot be undone.\n\nEnter admin password to confirm.'
                                  : 'Delete this order? This action cannot be undone.\n\nEnter admin password to confirm.',
                              confirmLabel: 'Delete',
                            })
                            if (confirmed) handleDeleteOrder(order.id)
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
                          type="button"
                          onClick={() => setStatusHistoryOrder(order)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Status history"
                        >
                          <History className="h-4 w-4" />
                        </button>
                      )}

                      {order.status === 'complete' && (
                        <button
                          type="button"
                          onClick={async () => {
                            const confirmed = await requestAdminPassword({
                              title: 'Delete complete order',
                              message:
                                'Delete this complete order? This permanently removes the order and all related data (logistics, images, etc.) but will NOT affect inventory.\n\nEnter admin password to confirm.',
                              confirmLabel: 'Delete',
                            })
                            if (confirmed) handleDeleteCompleteOrder(order.id)
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
                type="button"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
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
                    type="button"
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
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

  const printReceipt = async () => {
    if (!selectedOrder) return

    const sortedDetails = [...selectedOrder.order_details].sort((a, b) => {
      const categoryA =
        a.products?.category && a.products.category.trim() !== '' ? a.products.category : 'Uncategorized'
      const categoryB =
        b.products?.category && b.products.category.trim() !== '' ? b.products.category : 'Uncategorized'
      return categoryA.localeCompare(categoryB)
    })

    const itemsHtml = renderTransferSheetItemsBlock(
      sortedDetails.map((detail) => ({
        name: detail.products.name,
        sku: detail.products.sku,
        unit: detail.products.unit,
        quantity: detail.quantity,
        unitPrice: detail.unit_price,
      })),
      { showPrices: true }
    )

    const dsirPayloadText = buildTransferSheetDsirPayload(
      sortedDetails.map((detail) => ({
        name: detail.products.name,
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
          <title>Receipt - Order ${selectedOrder.id.slice(0, 8)}</title>
          <style>${TRANSFER_SHEET_PRINT_STYLES}</style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div class="company-name">${selectedOrder.brand?.name || 'Company'}</div>
              <div class="generated-date">Generated on ${new Date().toLocaleString()}</div>
              <div class="receipt-title">Stock Transfer Sheet</div>
            </div>
            
            <div class="order-info">
              <div class="info-grid info-grid-cols-4">
                <div class="info-item">
                  <span class="info-label">Order ID</span>
                  <span class="info-value">${selectedOrder.id.slice(0, 8)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Date (PST)</span>
                  <span class="info-value">${formatPhilippinesTransferSheetDate(selectedOrder.created_at)}</span>
                </div>
                <div class="info-item info-item-location">
                  <span class="info-label">Location</span>
                  <span class="info-value">${selectedOrder.location?.name || 'N/A'}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Logistics</span>
                  <span class="info-value">${logisticsLabelForOrder(selectedOrder)}</span>
                </div>
              </div>
            </div>
            
            ${itemsHtml}
            
            ${renderTransferSheetTotalsSection({
              categoryTotals: getCategoryTotals(selectedOrder),
              subtotal: getSubtotalAmount(selectedOrder),
              deliveryType: selectedOrder.delivery_type,
              grandTotal: getTotalAmount(selectedOrder),
              freightFee: selectedOrder.freight_fee,
              remarks: selectedOrder.notes,
              showLogisticsNone: true,
              qrDataUrl: dsirQrDataUrl,
              qrCaption: 'Receive stock',
            })}
            
            <div class="signatories">
              <div class="signatories-row signatories-row-top">
                <div class="signatory-item">
                  <div class="signatory-label">Prepared by:</div>
                  <div class="signatory-line"></div>
                </div>
                <div class="signatory-item">
                  <div class="signatory-label">Checked by:</div>
                  <div class="signatory-line"></div>
                </div>
                <div class="signatory-item">
                  <div class="signatory-label">Departure:</div>
                  <div class="signatory-line"></div>
                </div>
                <div class="signatory-item">
                  <div class="signatory-label">Arrival:</div>
                  <div class="signatory-line"></div>
                </div>
              </div>
              <div class="signatories-row signatories-row-bottom">
                <div class="signatory-item">
                  <div class="signatory-label">Delivered by:</div>
                  <div class="signatory-line"></div>
                </div>
                <div class="signatory-item">
                  <div class="signatory-label">Received by:</div>
                  <div class="signatory-line"></div>
                </div>
                <div class="signatory-item">
                  <div class="signatory-label">Time:</div>
                  <div class="signatory-line"></div>
                </div>
                <div class="signatory-item">
                  <div class="signatory-label">Empty pans:</div>
                  <div class="signatory-line"></div>
                </div>
              </div>
            </div>
            
          </div>
          <script>${TRANSFER_SHEET_PRINT_SCRIPT}</script>
        </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  // Override functions (remote stores: shipment/none + freight; local stores: delivery/pickup/none)
  const normalizeRemoteOverrideDeliveryType = (
    deliveryType: CustomerOrder['delivery_type']
  ): 'shipment' | 'none' => (deliveryType === 'shipment' ? 'shipment' : 'none')

  const normalizeLocalOverrideDeliveryType = (
    deliveryType: CustomerOrder['delivery_type']
  ): 'delivery' | 'pickup' | 'none' => {
    if (deliveryType === 'delivery' || deliveryType === 'pickup' || deliveryType === 'none') {
      return deliveryType
    }
    return 'none'
  }

  const resetOverrideModalExtras = () => {
    setOverrideBolFile(null)
    setOverrideBolPreview(null)
    setOverrideCategoryPortalByKey({})
  }

  const handleOverrideOrder = () => {
    if (!selectedOrder) return
    const isRemote = isRemoteStoreLocation(selectedOrder.location)
    setOriginalOrder({ ...selectedOrder })

    if (isRemote) {
      const normalizedType = normalizeRemoteOverrideDeliveryType(selectedOrder.delivery_type)
      setEditingOrder({
        ...selectedOrder,
        delivery_type: normalizedType,
        freight_fee:
          normalizedType === 'shipment' ? Number(selectedOrder.freight_fee) || 0 : 0,
      })
      setOverrideBolFile(null)
      setOverrideBolPreview(selectedOrder.bill_of_lading_url || null)
    } else {
      setEditingOrder({
        ...selectedOrder,
        delivery_type: normalizeLocalOverrideDeliveryType(selectedOrder.delivery_type),
        freight_fee: 0,
        bill_of_lading_url: null,
      })
      setOverrideBolFile(null)
      setOverrideBolPreview(null)
    }

    setShowOverrideModal(true)
    fetchAvailableProducts()
  }

  const uploadBillOfLading = async (orderId: string, file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `bol-${orderId}-${Date.now()}.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from('returnable_pans')
      .upload(fileName, file, { upsert: true })
    if (uploadError) throw uploadError
    const { data: urlData } = supabase.storage.from('returnable_pans').getPublicUrl(fileName)
    return urlData.publicUrl
  }

  const fetchAvailableProducts = async () => {
    if (!selectedBrand) return

    try {
      const [productsRes, portalRes] = await Promise.all([
        supabase
          .from('inventory_summary')
          .select('*')
          .eq('brand_id', selectedBrand.id)
          .order('category, product_name'),
        supabase
          .from('product_category_sort')
          .select('category_name, show_on_order_portal, remote_store, available_to_company_owned, available_to_franchise')
          .eq('brand_id', selectedBrand.id),
      ])

      if (productsRes.error) throw productsRes.error

      const portalByKey = portalRes.error ? {} : buildCategoryPortalMap(portalRes.data)
      if (portalRes.error) {
        console.warn('product_category_sort portal settings:', portalRes.error.message)
      }
      setOverrideCategoryPortalByKey(portalByKey)
      setAvailableProducts(productsRes.data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
      alert('Failed to fetch products')
    }
  }

  const overrideModalAddProducts = useMemo(() => {
    if (!editingOrder) return []
    const isRemote = isRemoteStoreLocation(editingOrder.location)
    const isCompanyOwned = !!editingOrder.location?.company_owned
    return filterProductsForOrderPortal(availableProducts, overrideCategoryPortalByKey, {
      isRemoteBranch: isRemote,
      isCompanyOwned,
    })
  }, [availableProducts, overrideCategoryPortalByKey, editingOrder])

  const handleSaveOverride = async () => {
    if (!editingOrder || !originalOrder || !selectedBrand) return

    setOverrideLoading(true)
    try {
      // Fetch fresh order_details from database to ensure accuracy
      const { data: currentOrderDetails, error: detailsFetchError } = await supabase
        .from('order_details')
        .select('product_id, quantity')
        .eq('order_id', editingOrder.id)

      if (detailsFetchError) {
        console.error('Error fetching current order details:', detailsFetchError)
        alert('Failed to fetch current order details')
        return
      }

      // Use fresh order_details from database instead of originalOrder which might be stale
      const currentOrderDetailsMap = new Map(
        currentOrderDetails?.map(d => [d.product_id, d.quantity]) || []
      )

      // Calculate quantity differences for inventory updates
      const quantityChanges = new Map<string, number>()
      
      // Get all unique product IDs from both current and new order
      const allProductIds = new Set([
        ...(currentOrderDetails?.map(d => d.product_id) || []),
        ...editingOrder.order_details.map(d => d.product_id)
      ])
      
      // Calculate net change for each product based on current database state
      allProductIds.forEach(productId => {
        const currentQuantity = currentOrderDetailsMap.get(productId) || 0
        const newQuantity = editingOrder.order_details.find(d => d.product_id === productId)?.quantity || 0
        const netChange = newQuantity - currentQuantity
        quantityChanges.set(productId, netChange)
      })

      // Determine order status - fetch fresh from database
      const { data: orderStatusData, error: statusError } = await supabase
        .from('customer_orders')
        .select('status')
        .eq('id', editingOrder.id)
        .single()

      if (statusError) {
        console.error('Error fetching order status:', statusError)
        alert('Failed to fetch order status')
        return
      }

      const isInTransit = orderStatusData.status === 'in-transit'

      // Fetch fresh product data for stock validation
      const productIdsArray = Array.from(allProductIds)
      const { data: freshProducts, error: productsFetchError } = await supabase
        .from('products')
        .select('id, reserved, released, initial_stock, production')
        .in('id', productIdsArray)

      if (productsFetchError) {
        console.error('Error fetching products:', productsFetchError)
        alert('Failed to fetch product data')
        return
      }

      const productsMap = new Map(freshProducts?.map(p => [p.id, p]) || [])

      // Check stock availability for all changes
      for (const [productId, quantityChange] of Array.from(quantityChanges.entries())) {
        if (quantityChange > 0) {
          const product = productsMap.get(productId)
          if (!product) {
            alert(`Product not found: ${productId}`)
            return
          }

          const currentQuantity = currentOrderDetailsMap.get(productId) || 0
          
          // Calculate available stock
          const finalStock = (product.initial_stock || 0) + (product.production || 0) - (product.released || 0)
          
          if (isInTransit) {
            // For in-transit orders: the current quantity is in released
            // Available = final_stock - reserved + current_quantity (since it's in released, not reserved)
            const availableStock = finalStock - (product.reserved || 0) + currentQuantity
            
            if (quantityChange > availableStock) {
              alert(`Insufficient stock for product. Available: ${availableStock}, Requested increase: ${quantityChange}`)
              return
            }
          } else {
            // For approved orders: the current quantity is in reserved
            // Available = final_stock - reserved + current_quantity
            const availableStock = finalStock - (product.reserved || 0) + currentQuantity
            
            if (quantityChange > availableStock) {
              alert(`Insufficient stock for product. Available: ${availableStock}, Requested increase: ${quantityChange}`)
              return
            }
          }
        }
      }

      // Update inventory for all products with quantity changes
      for (const [productId, quantityChange] of Array.from(quantityChanges.entries())) {
        if (quantityChange !== 0) {
          const product = productsMap.get(productId)
          if (!product) {
            console.error('Product not found for inventory update:', productId)
            continue
          }

          if (isInTransit) {
            // For in-transit orders: update released
            const currentReleased = product.released || 0
            const newReleased = currentReleased + quantityChange
            
            // Validate: ensure released doesn't go negative
            if (newReleased < 0) {
              throw new Error(`Invalid released value for product ${productId}. Current: ${currentReleased}, Change: ${quantityChange}`)
            }

            const { error: inventoryError } = await supabase
              .from('products')
              .update({ 
                released: newReleased,
                updated_at: new Date().toISOString()
              })
              .eq('id', productId)

            if (inventoryError) {
              console.error('Error updating inventory:', inventoryError)
              throw new Error(`Failed to update released inventory for product ${productId}`)
            }
          } else {
            // For approved orders: update reserved
            const currentReserved = product.reserved || 0
            const newReserved = currentReserved + quantityChange
            
            // Validate: ensure reserved doesn't go negative
            if (newReserved < 0) {
              throw new Error(`Invalid reserved value for product ${productId}. Current: ${currentReserved}, Change: ${quantityChange}`)
            }

            const { error: inventoryError } = await supabase
              .from('products')
              .update({ 
                reserved: newReserved,
                updated_at: new Date().toISOString()
              })
              .eq('id', productId)

            if (inventoryError) {
              console.error('Error updating inventory:', inventoryError)
              throw new Error(`Failed to update reserved inventory for product ${productId}`)
            }
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

      const isRemote = isRemoteStoreLocation(editingOrder.location)
      const overrideDeliveryType = isRemote
        ? normalizeRemoteOverrideDeliveryType(editingOrder.delivery_type)
        : normalizeLocalOverrideDeliveryType(editingOrder.delivery_type)
      const freightFee = isRemote && overrideDeliveryType === 'shipment'
        ? Math.max(0, Number(editingOrder.freight_fee) || 0)
        : 0

      let billOfLadingUrl: string | null = null
      if (isRemote && overrideDeliveryType === 'shipment') {
        billOfLadingUrl = editingOrder.bill_of_lading_url || null
        if (overrideBolFile) {
          billOfLadingUrl = await uploadBillOfLading(editingOrder.id, overrideBolFile)
        }
      }

      const orderForTotal: CustomerOrder = {
        ...editingOrder,
        delivery_type: overrideDeliveryType,
        freight_fee: freightFee,
      }
      const newTotalAmount = computeOrderGrandTotal(orderForTotal)

      const { error: orderError } = await supabase
        .from('customer_orders')
        .update({
          total_amount: newTotalAmount,
          delivery_type: overrideDeliveryType,
          freight_fee: freightFee,
          bill_of_lading_url: billOfLadingUrl,
          updated_at: new Date().toISOString(),
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
        delivery_type: overrideDeliveryType,
        freight_fee: freightFee,
        bill_of_lading_url: billOfLadingUrl,
        order_details: editingOrder.order_details,
      })

      setShowOverrideModal(false)
      setEditingOrder(null)
      setOriginalOrder(null)
      resetOverrideModalExtras()
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
    return computeOrderGrandTotal(editingOrder)
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
        <div className="space-y-8">
          {/* Skeleton for each order status section */}
          {['Pending', 'Approved', 'In-Transit'].map((status, idx) => (
            <div key={idx}>
              {/* Section header skeleton */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="h-5 w-5 bg-gray-200 rounded mr-2 animate-pulse"></div>
                  <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
                </div>
              </div>
              
              {/* Table skeleton */}
              <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
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
                      {[...Array(2)].map((_, rowIdx) => (
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
          ))}
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
            <OrderTable orders={getOrdersByStatus('paid')} showDepositSlipColumn />
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
        <Modal backdropClassName="bg-gray-600/50">
          <div className="mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col overflow-hidden">
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
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${logisticsBadgeClassForOrder(selectedOrder)}`}
                    >
                      {logisticsLabelForOrder(selectedOrder)}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Location</p>
                    <div className="flex items-center space-x-1 mt-1">
                      {selectedOrder.location?.company_owned ? (
                        <div title="Company Owned">
                          <Building2 className={`h-4 w-4 ${getLocationIconColor(selectedOrder)}`} />
                        </div>
                      ) : isRemoteStoreLocation(selectedOrder.location) ? (
                        <div title="Remote store">
                          <Store className={`h-4 w-4 ${getLocationIconColor(selectedOrder)}`} />
                        </div>
                      ) : (
                        <div title="Franchise">
                          <Store className={`h-4 w-4 ${getLocationIconColor(selectedOrder)}`} />
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
                      {selectedOrder.delivery_type === 'shipment' && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Freight fee:</span>
                          <span className="text-sm text-purple-800">
                            +₱{(Number(selectedOrder.freight_fee) || 0).toLocaleString('en-PH', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
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

              {selectedOrder.bill_of_lading_url && (
                <div className="bg-white border rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Bill of Lading</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBillOfLadingUrl(selectedOrder.bill_of_lading_url || null)
                      setShowBillOfLadingModal(true)
                    }}
                    className="text-sm text-purple-700 hover:text-purple-900 underline"
                  >
                    View bill of lading
                  </button>
                </div>
              )}

              {selectedOrder.status === 'paid' && (
                <div className="bg-white border rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Deposit Slip</h4>
                  {selectedOrder.deposit_slip_url ? (
                    <div className="space-y-3">
                      <img
                        src={selectedOrder.deposit_slip_url}
                        alt="Deposit slip"
                        className="max-h-40 rounded border border-gray-200 object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDepositSlipImage(selectedOrder.deposit_slip_url!)
                          setSelectedDepositSlipOrder(selectedOrder)
                          setShowDepositSlipModal(true)
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View full size
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No deposit slip uploaded</p>
                  )}
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

      {/* Override Modal */}
      {showOverrideModal && editingOrder && (
        <Modal backdropClassName="bg-gray-600/50">
          <div className="mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 xl:w-2/3 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                Override Order #{editingOrder.id.slice(0, 8)}
              </h3>
              <button
                onClick={() => {
                  setShowOverrideModal(false)
                  setEditingOrder(null)
                  setOriginalOrder(null)
                  resetOverrideModalExtras()
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6 flex-1 overflow-y-auto min-h-0">
              {/* Logistics Method and Category Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Logistics (remote: shipment/none + freight/BOL; local: delivery/pickup/none) */}
                <div className="flex flex-wrap items-end gap-4 ml-3">
                  <div className="shrink-0">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Logistics Method
                    </label>
                    <div className="flex h-[38px] items-center gap-4">
                      {isRemoteStoreLocation(editingOrder.location) ? (
                        <>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="delivery_type"
                              value="shipment"
                              checked={editingOrder.delivery_type === 'shipment'}
                              onChange={() =>
                                setEditingOrder({
                                  ...editingOrder,
                                  delivery_type: 'shipment',
                                  freight_fee: editingOrder.freight_fee ?? 0,
                                })
                              }
                              className="mr-2"
                            />
                            <span className="text-sm">Shipment</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="delivery_type"
                              value="none"
                              checked={editingOrder.delivery_type === 'none'}
                              onChange={() => {
                                setOverrideBolFile(null)
                                setOverrideBolPreview(null)
                                setEditingOrder({
                                  ...editingOrder,
                                  delivery_type: 'none',
                                  freight_fee: 0,
                                  bill_of_lading_url: null,
                                })
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm">None</span>
                          </label>
                        </>
                      ) : (
                        <>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="delivery_type"
                              value="delivery"
                              checked={editingOrder.delivery_type === 'delivery'}
                              onChange={() =>
                                setEditingOrder({
                                  ...editingOrder,
                                  delivery_type: 'delivery',
                                })
                              }
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
                              onChange={() =>
                                setEditingOrder({
                                  ...editingOrder,
                                  delivery_type: 'pickup',
                                })
                              }
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
                              onChange={() =>
                                setEditingOrder({
                                  ...editingOrder,
                                  delivery_type: 'none',
                                })
                              }
                              className="mr-2"
                            />
                            <span className="text-sm">None</span>
                          </label>
                        </>
                      )}
                    </div>
                  </div>

                  {isRemoteStoreLocation(editingOrder.location) &&
                    editingOrder.delivery_type === 'shipment' && (
                    <>
                      <div className="w-28 shrink-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Freight fee (₱)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={
                            editingOrder.freight_fee === 0 || editingOrder.freight_fee == null
                              ? ''
                              : editingOrder.freight_fee
                          }
                          onChange={(e) =>
                            setEditingOrder({
                              ...editingOrder,
                              freight_fee:
                                e.target.value === '' ? 0 : parseFloat(e.target.value) || 0,
                            })
                          }
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bill of lading
                        </label>
                        <div className="flex h-[38px] items-center gap-2">
                          {overrideBolPreview && (
                            <div className="relative shrink-0">
                              <img
                                src={overrideBolPreview}
                                alt="Bill of lading preview"
                                className="h-9 w-9 rounded border border-gray-200 object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setOverrideBolFile(null)
                                  setOverrideBolPreview(null)
                                  setEditingOrder({
                                    ...editingOrder,
                                    bill_of_lading_url: null,
                                  })
                                }}
                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                                title="Remove image"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          )}
                          <input
                            type="file"
                            id="override-bol-upload"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              setOverrideBolFile(file)
                              const reader = new FileReader()
                              reader.onloadend = () => {
                                setOverrideBolPreview(reader.result as string)
                              }
                              reader.readAsDataURL(file)
                            }}
                          />
                          <label
                            htmlFor="override-bol-upload"
                            className="inline-flex h-[38px] items-center gap-2 px-3 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap"
                          >
                            <Upload className="h-4 w-4 shrink-0" />
                            {overrideBolPreview ? 'Change' : 'Upload'}
                          </label>
                        </div>
                      </div>
                    </>
                  )}
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
                    {overrideModalAddProducts.length === 0 ? (
                      <p className="text-sm text-gray-500">No products available to add.</p>
                    ) : (() => {
                      const productsByCategory = overrideModalAddProducts.reduce((acc, product) => {
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

                {isRemoteStoreLocation(editingOrder.location) &&
                  editingOrder.delivery_type === 'shipment' && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Freight fee:</span>
                    <span className="text-sm font-medium text-purple-800">
                      +₱{(Number(editingOrder.freight_fee) || 0).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                {!isRemoteStoreLocation(editingOrder.location) &&
                  editingOrder.delivery_type === 'delivery' && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Delivery fee:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {(() => {
                        const sub = editingOrder.order_details.reduce(
                          (t, d) => t + d.unit_price * d.quantity,
                          0
                        )
                        return sub >= 10000 ? 'FREE (Order over ₱10k)' : '+₱500.00'
                      })()}
                    </span>
                  </div>
                )}
                {!isRemoteStoreLocation(editingOrder.location) &&
                  editingOrder.delivery_type === 'pickup' &&
                  editingOrder.order_details.reduce((t, d) => t + d.unit_price * d.quantity, 0) >=
                    10000 && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Pickup discount (5%):</span>
                    <span className="text-sm font-medium text-green-600">
                      -₱
                      {(
                        editingOrder.order_details.reduce(
                          (t, d) => t + d.unit_price * d.quantity,
                          0
                        ) * 0.05
                      ).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
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
                  resetOverrideModalExtras()
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
                className="max-h-[70vh] w-auto rounded-lg border transition-transform duration-300 ease-in-out hover:scale-[2] cursor-zoom-in"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Bill of Lading Image Modal */}
      {showBillOfLadingModal && selectedBillOfLadingUrl && (
        <Modal backdropClassName="bg-gray-600/50">
          <div className="mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Bill of Lading</h3>
              <button
                type="button"
                onClick={() => {
                  setShowBillOfLadingModal(false)
                  setSelectedBillOfLadingUrl(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="text-center flex-1 flex items-center justify-center overflow-auto">
              <img
                src={selectedBillOfLadingUrl}
                alt="Bill of lading"
                className="max-h-[70vh] w-auto rounded-lg border"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Order status history modal (complete orders) */}
      {statusHistoryOrder && (
        <Modal align="center" backdropClassName="bg-black/50">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-lg">
            <div className="p-5 border-b bg-gray-50 sticky top-0 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Status history</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {statusHistoryOrder.customer_name}
                  {' · '}
                  {formatPhilippinesDateTime(statusHistoryOrder.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatusHistoryOrder(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-5">
              {loadingStatusHistory ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                </div>
              ) : statusHistory.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-6">
                  No status changes recorded for this order yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {statusHistory.map((entry, index) => (
                    <div key={entry.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-100" />
                        {index < statusHistory.length - 1 && (
                          <div className="w-0.5 flex-1 min-h-[32px] bg-indigo-200" />
                        )}
                      </div>
                      <div className="flex-1 pb-1">
                        <p className="text-sm font-medium text-gray-900">
                          {entry.old_status
                            ? `${formatOrderStatusLabel(entry.old_status)} → ${formatOrderStatusLabel(entry.new_status)}`
                            : formatOrderStatusLabel(entry.new_status)}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {entry.created_at
                            ? formatPhilippinesDateTime(entry.created_at)
                            : '—'}
                          {' · '}
                          <span className="font-medium">{entry.changed_by}</span>
                        </p>
                        {entry.notes && (
                          <p className="text-xs text-gray-500 mt-1 italic">{entry.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                {selectedDepositSlipOrder &&
                  ` - ₱${getTotalAmount(selectedDepositSlipOrder).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </h3>
              <button
                type="button"
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
      {AdminPasswordModal}
    </div>
  )
}
