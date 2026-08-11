'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { MapPin, Plus, Edit, Trash2, Save, X, FileText, Printer, Eye, Copy, ShoppingCart } from 'lucide-react'
import { formatPhilippinesDateTime, formatPhilippinesTransferSheetDate } from '../../lib/timezone'
import { TRANSFER_SHEET_PRINT_STYLES, TRANSFER_SHEET_PRINT_SCRIPT } from '../../lib/transferSheetPrintStyles'
import { renderTransferSheetItemsBlock } from '../../lib/transferSheetPrintItems'
import { renderTransferSheetTotalsSection } from '../../lib/transferSheetPrintTotals'
import { buildTransferSheetDsirPayload } from '../../lib/transferSheetDsirQr'
import { Modal } from './Modal'
import {
  DEFAULT_INCENTIVE_BASE_AMOUNT,
  DEFAULT_INCENTIVE_HOLIDAY_SALES_THRESHOLD,
  DEFAULT_INCENTIVE_INCREMENT_AMOUNT,
  DEFAULT_INCENTIVE_INCREMENT_SALES,
  DEFAULT_INCENTIVE_REGULAR_SALES_THRESHOLD,
  hasCustomIncentiveSettings,
  resolveLocationIncentiveSettings,
} from '../../lib/payroll-incentive'

interface Location {
  id: string
  name: string
  passkey: string
  brand_id: string
  franchisee?: string
  contact_number?: string
  company_owned?: boolean
  can_access_order_features?: boolean
  is_remote?: boolean
  incentive_regular_sales_threshold?: number | null
  incentive_holiday_sales_threshold?: number | null
  incentive_base_amount?: number | null
  created_at: string
  updated_at: string
  brand?: {
    id: string
    name: string
    slug: string
  }
}

interface CustomerOrder {
  id: string
  location_id: string
  brand_id: string
  customer_name: string
  status: string
  total_amount: number
  delivery_type: 'delivery' | 'pickup'
  created_at: string
  updated_at: string
  notes?: string
  returnable_pans?: number
  deposit_slip_url?: string
  returnable_pans_image_url?: string
  location?: Location
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
    product: {
      id: string
      name: string
      sku?: string
      unit: string
      category?: string
    }
  }>
}

interface BranchManagerProps {
  selectedBrand: any | null
  theme?: string
  guestMode?: boolean
}

export function BranchManager({ selectedBrand, theme = 'blue', guestMode = false }: BranchManagerProps) {
  const [locations, setLocations] = useState<Location[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [locationOrders, setLocationOrders] = useState<CustomerOrder[]>([])
  const [showOrderHistory, setShowOrderHistory] = useState(false)
  const [showOrderDetails, setShowOrderDetails] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null)
  const [showDepositSlipModal, setShowDepositSlipModal] = useState(false)
  const [selectedDepositSlipImage, setSelectedDepositSlipImage] = useState<string | null>(null)
  const [showReturnablePansModal, setShowReturnablePansModal] = useState(false)
  const [selectedReturnablePansImage, setSelectedReturnablePansImage] = useState<string | null>(null)
  const [selectedReturnablePansOrder, setSelectedReturnablePansOrder] = useState<CustomerOrder | null>(null)
  const [incentiveModalLocation, setIncentiveModalLocation] = useState<Location | null>(null)
  const [incentiveForm, setIncentiveForm] = useState({
    regularSalesThreshold: '',
    holidaySalesThreshold: '',
    baseAmount: '',
  })
  const [savingIncentiveSettings, setSavingIncentiveSettings] = useState(false)
  const [orderModalLocation, setOrderModalLocation] = useState<Location | null>(null)
  const [newLocation, setNewLocation] = useState({
    name: '',
    passkey: '',
    franchisee: '',
    contact_number: '',
    company_owned: false,
    can_access_order_features: false,
    is_remote: false,
    brand_id: selectedBrand?.id || ''
  })

  useEffect(() => {
    if (selectedBrand) {
      loadData()
      // Update newLocation brand_id when selectedBrand changes
      setNewLocation(prev => ({ ...prev, brand_id: selectedBrand.id }))
      
      // Reset order history view when brand changes
      setShowOrderHistory(false)
      setSelectedLocation(null)
      setLocationOrders([])
      setShowOrderDetails(false)
      setSelectedOrder(null)
    }
  }, [selectedBrand])

  // Realtime subscription for order updates
  useEffect(() => {
    if (!selectedBrand) return

    const channel = supabase
      .channel('branch-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_orders',
          filter: `brand_id=eq.${selectedBrand.id}`
        },
        (payload) => {
          console.log('Branch orders realtime update:', payload)
          
          // Refresh location orders if we're viewing order history
          if (showOrderHistory && selectedLocation) {
            fetchLocationOrders(selectedLocation.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedBrand, showOrderHistory, selectedLocation])

  const loadData = async () => {
    if (!selectedBrand) return
    
    setLoading(true)
    try {
      // Fetch locations and brands in parallel
      const [locationsResult, brandsResult] = await Promise.all([
        supabase
          .from('locations')
          .select(`
            *,
            brand:brands(*)
          `)
          .eq('brand_id', selectedBrand.id)
          .order('name'),
        supabase
          .from('brands')
          .select('*')
          .order('name')
      ])
      
      if (locationsResult.error) {
        console.error('Error fetching locations:', locationsResult.error)
      } else if (locationsResult.data) {
        setLocations(locationsResult.data)
      }
      
      if (brandsResult.error) {
        console.error('Error fetching brands:', brandsResult.error)
      } else if (brandsResult.data) {
        setBrands(brandsResult.data)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newLocation.name || !newLocation.passkey || !newLocation.franchisee || !newLocation.contact_number) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const { data, error } = await supabase
        .from('locations')
        .insert([newLocation])
        .select()

      if (error) {
        console.error('Error adding location:', error)
        alert('Error adding location')
        return
      }

      if (data) {
        setLocations([...locations, data[0]])
        setNewLocation({ name: '', passkey: '', franchisee: '', contact_number: '', company_owned: false, can_access_order_features: false, is_remote: false, brand_id: selectedBrand?.id || '' })
        setShowAddForm(false)
      }
    } catch (error) {
      console.error('Error adding location:', error)
      alert('Error adding location')
    }
  }

  const handleUpdateLocation = async (location: Location) => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .update({
          name: location.name,
          passkey: location.passkey,
          franchisee: location.franchisee,
          contact_number: location.contact_number,
          company_owned: location.company_owned,
          can_access_order_features: location.can_access_order_features,
          is_remote: location.is_remote,
          brand_id: location.brand_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', location.id)
        .select()

      if (error) {
        console.error('Error updating location:', error)
        alert('Error updating location')
        return
      }

      if (data) {
        setLocations(locations.map(loc => 
          loc.id === location.id ? { ...data[0], brand: location.brand } : loc
        ))
        setEditingLocation(null)
      }
    } catch (error) {
      console.error('Error updating location:', error)
      alert('Error updating location')
    }
  }

  const handleDeleteLocation = async (locationId: string) => {
    if (!confirm('Are you sure you want to delete this location?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', locationId)

      if (error) {
        console.error('Error deleting location:', error)
        alert('Error deleting location')
        return
      }

      setLocations(locations.filter(loc => loc.id !== locationId))
    } catch (error) {
      console.error('Error deleting location:', error)
      alert('Error deleting location')
    }
  }

  const formatIncentiveAmount = (amount: number) =>
    amount.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

  const openIncentiveSettingsModal = (location: Location) => {
    const settings = resolveLocationIncentiveSettings(location)
    setIncentiveForm({
      regularSalesThreshold: String(settings.regularSalesThreshold),
      holidaySalesThreshold: String(settings.holidaySalesThreshold),
      baseAmount: String(settings.baseAmount),
    })
    setIncentiveModalLocation(location)
  }

  const closeIncentiveSettingsModal = () => {
    setIncentiveModalLocation(null)
    setSavingIncentiveSettings(false)
  }

  const normalizeIncentiveDbValue = (
    value: string,
    defaultValue: number
  ): number | null => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) return null
    return parsed === defaultValue ? null : parsed
  }

  const handleSaveIncentiveSettings = async () => {
    if (!incentiveModalLocation) return

    const regularSalesThreshold = Number(incentiveForm.regularSalesThreshold)
    const holidaySalesThreshold = Number(incentiveForm.holidaySalesThreshold)
    const baseAmount = Number(incentiveForm.baseAmount)

    if (
      !Number.isFinite(regularSalesThreshold) ||
      regularSalesThreshold <= 0 ||
      !Number.isFinite(holidaySalesThreshold) ||
      holidaySalesThreshold <= 0 ||
      !Number.isFinite(baseAmount) ||
      baseAmount < 0
    ) {
      alert('Please enter valid incentive amounts greater than zero for sales thresholds.')
      return
    }

    setSavingIncentiveSettings(true)
    try {
      const payload = {
        incentive_regular_sales_threshold: normalizeIncentiveDbValue(
          incentiveForm.regularSalesThreshold,
          DEFAULT_INCENTIVE_REGULAR_SALES_THRESHOLD
        ),
        incentive_holiday_sales_threshold: normalizeIncentiveDbValue(
          incentiveForm.holidaySalesThreshold,
          DEFAULT_INCENTIVE_HOLIDAY_SALES_THRESHOLD
        ),
        incentive_base_amount: normalizeIncentiveDbValue(
          incentiveForm.baseAmount,
          DEFAULT_INCENTIVE_BASE_AMOUNT
        ),
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('locations')
        .update(payload)
        .eq('id', incentiveModalLocation.id)
        .select(`
          *,
          brand:brands(*)
        `)
        .single()

      if (error) {
        console.error('Error saving incentive settings:', error)
        alert('Error saving incentive settings')
        return
      }

      if (data) {
        setLocations((prev) =>
          prev.map((loc) => (loc.id === data.id ? { ...data, brand: loc.brand || data.brand } : loc))
        )
        closeIncentiveSettingsModal()
      }
    } catch (error) {
      console.error('Error saving incentive settings:', error)
      alert('Error saving incentive settings')
    } finally {
      setSavingIncentiveSettings(false)
    }
  }

  const handleResetIncentiveDefaults = () => {
    setIncentiveForm({
      regularSalesThreshold: String(DEFAULT_INCENTIVE_REGULAR_SALES_THRESHOLD),
      holidaySalesThreshold: String(DEFAULT_INCENTIVE_HOLIDAY_SALES_THRESHOLD),
      baseAmount: String(DEFAULT_INCENTIVE_BASE_AMOUNT),
    })
  }

  const getOrderPortalEmbedUrl = (location: Location) =>
    `/order?embed=1&locationId=${encodeURIComponent(location.id)}&passkey=${encodeURIComponent(location.passkey)}`

  const fetchLocationOrders = async (locationId: string) => {
    setLoading(true)
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
        .eq('location_id', locationId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching orders:', error)
        return
      }

      if (data) {
        setLocationOrders(data)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewOrderHistory = async (location: Location) => {
    setSelectedLocation(location)
    setShowOrderHistory(true)
    await fetchLocationOrders(location.id)
  }

  const calculateTotalRevenue = useCallback((orders: CustomerOrder[]) => {
    return orders.reduce((total, order) => total + (order.total_amount || 0), 0)
  }, [])

  const calculateTotalPaid = useCallback((orders: CustomerOrder[]) => {
    return orders
      .filter(order => order.status === 'paid' || order.status === 'complete')
      .reduce((total, order) => total + (order.total_amount || 0), 0)
  }, [])

  const calculateTotalReceivable = useCallback((orders: CustomerOrder[]) => {
    return orders
      .filter(order => order.status === 'fulfilled')
      .reduce((total, order) => total + (order.total_amount || 0), 0)
  }, [])

  const copyToClipboard = (e: React.MouseEvent, text: string) => {
    navigator.clipboard.writeText(text)
    // Show visual feedback
    const button = e.currentTarget as HTMLButtonElement
    const originalHTML = button.innerHTML
    button.innerHTML = '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
    button.classList.add('text-green-600')
    setTimeout(() => {
      button.innerHTML = originalHTML
      button.classList.remove('text-green-600')
    }, 1500)
  }

  const getReturnablePans = (order: CustomerOrder | null) => {
    if (!order || !order.order_details) return { total: 0, hasImage: false }
    
    const returnablePansProducts = order.order_details.filter((detail) => {
      if (!order.brand && !order.location?.brand) return false
      const brandSlug = (order.brand?.slug || order.location?.brand?.slug)?.toLowerCase()
      const productCategory = detail.product?.category?.toLowerCase() || ''
      
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

  const getStatusBadge = (status: string) => {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      fulfilled: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const getTotalItems = useCallback((order: CustomerOrder) => {
    return order.order_details.reduce((total, detail) => total + detail.quantity, 0)
  }, [])

  const getTotalAmount = useCallback((order: CustomerOrder) => {
    return order.order_details.reduce((total, detail) => total + (detail.unit_price * detail.quantity), 0)
  }, [])

  const getSubtotalAmount = useCallback((order: CustomerOrder) => {
    return order.order_details.reduce((total, detail) => total + (detail.unit_price * detail.quantity), 0)
  }, [])

  const getCategoryTotals = useCallback((order: CustomerOrder) => {
    const categoryMap = new Map<string, { category: string; totalQuantity: number; totalAmount: number }>()
    
    order.order_details.forEach(detail => {
      const category = detail.product?.category || 'Uncategorized'
      const existing = categoryMap.get(category) || { category, totalQuantity: 0, totalAmount: 0 }
      
      existing.totalQuantity += detail.quantity
      existing.totalAmount += detail.unit_price * detail.quantity
      
      categoryMap.set(category, existing)
    })
    
    return Array.from(categoryMap.values())
  }, [])

  const handleViewDetails = (order: CustomerOrder) => {
    setSelectedOrder(order)
    setShowOrderDetails(true)
  }

  const handlePrintReceipt = async (order: CustomerOrder) => {
    const sortedDetails = [...order.order_details].sort((a, b) => {
      const categoryA =
        a.product?.category && a.product.category.trim() !== '' ? a.product.category : 'Uncategorized'
      const categoryB =
        b.product?.category && b.product.category.trim() !== '' ? b.product.category : 'Uncategorized'
      return categoryA.localeCompare(categoryB)
    })

    const itemsHtml = renderTransferSheetItemsBlock(
      sortedDetails.map((detail) => ({
        name: detail.product.name,
        sku: detail.product.sku,
        unit: detail.product.unit,
        quantity: detail.quantity,
        unitPrice: detail.unit_price,
      })),
      { showPrices: true }
    )

    const dsirPayloadText = buildTransferSheetDsirPayload(
      sortedDetails.map((detail) => ({
        name: detail.product.name,
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
          <title>Receipt - Order ${order.id.slice(0, 8)}</title>
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
              grandTotal: order.total_amount,
              remarks: order.notes,
              qrDataUrl: dsirQrDataUrl,
              qrCaption: 'Receive stock',
            })}
          </div>
          
          </div>
          <script>${TRANSFER_SHEET_PRINT_SCRIPT}</script>
        </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  if (showOrderHistory && selectedLocation) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Order History</h3>
            <p className="text-gray-600">{selectedLocation.name}</p>
          </div>
          <button
            onClick={() => {
              setShowOrderHistory(false)
              setSelectedLocation(null)
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <X className="h-4 w-4" />
            <span>Back to Branches</span>
          </button>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h4 className="text-lg font-medium mb-4">Branch Summary</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-600 font-medium">Total Orders</p>
              <p className="text-2xl font-bold text-blue-900">{locationOrders.length}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-600 font-medium">Total Revenue</p>
              <p className="text-2xl font-bold text-green-900">₱{calculateTotalRevenue(locationOrders).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">Total Paid</p>
              <p className="text-2xl font-bold text-purple-900">₱{calculateTotalPaid(locationOrders).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-sm text-orange-600 font-medium">Total Receivable</p>
              <p className="text-2xl font-bold text-orange-900">₱{calculateTotalReceivable(locationOrders).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
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
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Returnable Pans
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deposit Slip
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {locationOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-blue-100">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.id.slice(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {selectedLocation.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        ₱{order.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
                            return <span className="text-red-600 font-medium">{returnablePans.total} pans</span>
                          } else {
                            return <span className="text-gray-400">-</span>
                          }
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.deposit_slip_url ? (
                          <button
                            onClick={() => {
                              setSelectedDepositSlipImage(order.deposit_slip_url)
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewDetails(order)}
                            className="p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handlePrintReceipt(order)}
                            className="p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out"
                            title="Print Receipt"
                          >
                            <Printer className="h-4 w-4" />
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

        {/* Order Details Modal - Only show in order history view */}
        {showOrderDetails && selectedOrder && (
          <Modal backdropClassName="bg-gray-600/50">
            <div className="mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-900">
                  Order Details #{selectedOrder.id.slice(0, 8)}
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePrintReceipt(selectedOrder)}
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
                        selectedOrder.status === 'fulfilled' ? 'bg-orange-100 text-orange-800' :
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

                {/* Notes */}
                {selectedOrder.notes && (
                  <div className="bg-white border rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Notes</h4>
                    <p className="text-sm text-gray-600">{selectedOrder.notes}</p>
                  </div>
                )}

                {/* Order Items */}
                <div className="bg-white border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b">
                    <h4 className="text-sm font-semibold text-gray-900">Order Items</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedOrder.order_details
                          ?.sort((a, b) => {
                            // First sort by category, then by product name within category
                            const categoryCompare = (a.product?.category || '').localeCompare(b.product?.category || '')
                            if (categoryCompare !== 0) return categoryCompare
                            return (a.product?.name || '').localeCompare(b.product?.name || '')
                          })
                          ?.map((detail, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-900">{detail.product?.name || 'N/A'}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{detail.product?.sku || 'N/A'}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{detail.product?.unit || 'N/A'}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{detail.quantity}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">₱{detail.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">₱{(detail.unit_price * detail.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
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
                </h3>
                <button
                  onClick={() => {
                    setShowDepositSlipModal(false)
                    setSelectedDepositSlipImage(null)
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
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Branches</h1>
          <p className="text-sm text-gray-600">Manage branch locations and view order history</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${
            theme === 'green' ? 'bg-green-600 hover:bg-green-700' :
            theme === 'red' ? 'bg-red-600 hover:bg-red-700' :
            theme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
            'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <Plus className="h-4 w-4" />
          <span>Add Branch</span>
        </button>
      </div>

      {/* Add Branch Modal */}
      {showAddForm && (
        <Modal backdropClassName="bg-gray-600/50">
          <div className="mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Branch</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddLocation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch Name *
                </label>
                <input
                  type="text"
                  required
                  value={newLocation.name}
                  onChange={(e) => setNewLocation({...newLocation, name: e.target.value})}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent ${
                    theme === 'green' ? 'focus:ring-green-500' :
                    theme === 'red' ? 'focus:ring-red-500' :
                    theme === 'yellow' ? 'focus:ring-yellow-500' :
                    'focus:ring-blue-500'
                  }`}
                  placeholder="Enter branch name"
                />
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-4">
                  <label className="flex items-center space-x-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={newLocation.company_owned}
                      onChange={(e) => setNewLocation({...newLocation, company_owned: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span>Company Owned</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={newLocation.can_access_order_features}
                      onChange={(e) => setNewLocation({...newLocation, can_access_order_features: e.target.checked})}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <span>Features</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={newLocation.is_remote}
                      onChange={(e) => setNewLocation({...newLocation, is_remote: e.target.checked})}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span>Remote</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Passkey *
                </label>
                <input
                  type="text"
                  required
                  value={newLocation.passkey}
                  onChange={(e) => setNewLocation({...newLocation, passkey: e.target.value.replace(/\D/g, '').slice(0, 6)})}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent ${
                    theme === 'green' ? 'focus:ring-green-500' :
                    theme === 'red' ? 'focus:ring-red-500' :
                    theme === 'yellow' ? 'focus:ring-yellow-500' :
                    'focus:ring-blue-500'
                  }`}
                  placeholder="Enter 6-digit passkey"
                  maxLength={6}
                />
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Franchisee Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newLocation.franchisee}
                    onChange={(e) => setNewLocation({...newLocation, franchisee: e.target.value})}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent ${
                      theme === 'green' ? 'focus:ring-green-500' :
                      theme === 'red' ? 'focus:ring-red-500' :
                      theme === 'yellow' ? 'focus:ring-yellow-500' :
                      'focus:ring-blue-500'
                    }`}
                    placeholder="Enter franchisee name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={newLocation.contact_number}
                    onChange={(e) => setNewLocation({...newLocation, contact_number: e.target.value})}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent ${
                      theme === 'green' ? 'focus:ring-green-500' :
                      theme === 'red' ? 'focus:ring-red-500' :
                      theme === 'yellow' ? 'focus:ring-yellow-500' :
                      'focus:ring-blue-500'
                    }`}
                    placeholder="Enter contact number"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${
                    theme === 'green' ? 'bg-green-600 hover:bg-green-700' :
                    theme === 'red' ? 'bg-red-600 hover:bg-red-700' :
                    theme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
                    'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Save className="h-4 w-4" />
                  <span>Add Branch</span>
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Branches List */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div>
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Branch Name', 'Passkey', 'Franchisee', 'Contact #', 'Type', 'Remote', 'Actions'].map((header, idx) => (
                    <th key={idx} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {[...Array(5)].map((_, idx) => (
                  <tr key={idx}>
                    {[...Array(7)].map((_, cellIdx) => (
                      <td key={cellIdx} className="px-6 py-4 whitespace-nowrap">
                        <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 table-fixed">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                    Branch Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Passkey
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                    Franchisee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                    Contact #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                    Remote
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {locations.map((location) => (
                  <tr key={location.id} className="hover:bg-blue-100 h-16">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-middle">
                      {editingLocation?.id === location.id ? (
                        <input
                          type="text"
                          value={editingLocation.name}
                          onChange={(e) => setEditingLocation({...editingLocation, name: e.target.value})}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                      ) : (
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => openIncentiveSettingsModal(location)}
                            className={`text-left truncate hover:underline ${
                              theme === 'green'
                                ? 'hover:text-green-700'
                                : theme === 'red'
                                  ? 'hover:text-red-700'
                                  : theme === 'yellow'
                                    ? 'hover:text-yellow-700'
                                    : 'hover:text-blue-700'
                            }`}
                            title="Configure sales incentive settings"
                          >
                            {location.name}
                          </button>
                          {hasCustomIncentiveSettings(location) && (
                            <span className="shrink-0 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                              Custom
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      {editingLocation?.id === location.id ? (
                        <input
                          type="text"
                          value={editingLocation.passkey}
                          onChange={(e) => setEditingLocation({...editingLocation, passkey: e.target.value.replace(/\D/g, '').slice(0, 6)})}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                          maxLength={6}
                        />
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className="font-mono">{location.passkey}</span>
                          <button
                            onClick={(e) => copyToClipboard(e, location.passkey)}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                            title="Copy passkey"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      {editingLocation?.id === location.id ? (
                        <input
                          type="text"
                          value={editingLocation.franchisee || ''}
                          onChange={(e) => setEditingLocation({...editingLocation, franchisee: e.target.value})}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                      ) : (
                        location.franchisee || 'N/A'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      {editingLocation?.id === location.id ? (
                        <input
                          type="tel"
                          value={editingLocation.contact_number || ''}
                          onChange={(e) => setEditingLocation({...editingLocation, contact_number: e.target.value})}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                      ) : (
                        location.contact_number || 'N/A'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      {editingLocation?.id === location.id ? (
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={editingLocation.company_owned || false}
                            onChange={(e) => setEditingLocation({...editingLocation, company_owned: e.target.checked})}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-xs text-gray-600">Company Owned</span>
                        </label>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          location.company_owned 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {location.company_owned ? 'Company Owned' : 'Franchise'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                      {editingLocation?.id === location.id ? (
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={editingLocation.is_remote || false}
                            onChange={(e) => setEditingLocation({...editingLocation, is_remote: e.target.checked})}
                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                          />
                          <span className="text-xs text-gray-600">Remote</span>
                        </label>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          location.is_remote 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {location.is_remote ? 'Remote' : 'Local'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-middle">
                      <div className="flex space-x-2">
                        {editingLocation?.id === location.id ? (
                          <>
                            <button
                              onClick={() => handleUpdateLocation(editingLocation)}
                              className={`p-1 rounded transition-all duration-200 ease-in-out ${
                                theme === 'green' ? 'text-green-600 hover:text-green-900 hover:bg-green-50' :
                                theme === 'red' ? 'text-red-600 hover:text-red-900 hover:bg-red-50' :
                                theme === 'yellow' ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50' :
                                'text-blue-600 hover:text-blue-900 hover:bg-blue-50'
                              }`}
                              title="Save"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingLocation(null)}
                              className="p-1 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200 ease-in-out"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditingLocation(location)}
                              className={`p-1 rounded transition-all duration-200 ease-in-out ${
                                theme === 'green' ? 'text-green-600 hover:text-green-900 hover:bg-green-50' :
                                theme === 'red' ? 'text-red-600 hover:text-red-900 hover:bg-red-50' :
                                theme === 'yellow' ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50' :
                                'text-blue-600 hover:text-blue-900 hover:bg-blue-50'
                              }`}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setOrderModalLocation(location)}
                              className="p-1 rounded text-emerald-600 hover:text-emerald-900 hover:bg-emerald-50 transition-all duration-200 ease-in-out"
                              title="Open order portal"
                            >
                              <ShoppingCart className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleViewOrderHistory(location)}
                              className="p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out"
                              title="View Order History"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {!guestMode ? (
                            <button
                              onClick={() => handleDeleteLocation(location.id)}
                              className="p-1 rounded text-red-600 hover:text-red-900 hover:bg-red-50 transition-all duration-200 ease-in-out"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            ) : null}
                          </>
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

      {orderModalLocation && (
        <Modal
          onClose={() => setOrderModalLocation(null)}
          zIndex={60}
          contentClassName="p-2 sm:p-4"
          positionClassName="items-stretch"
        >
          <div className="flex h-[92vh] w-[96vw] max-w-7xl flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Order Portal</h3>
                <p className="text-sm text-gray-600">{orderModalLocation.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setOrderModalLocation(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close order portal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <iframe
              key={orderModalLocation.id}
              src={getOrderPortalEmbedUrl(orderModalLocation)}
              title={`Order portal - ${orderModalLocation.name}`}
              className="h-full w-full flex-1 border-0 bg-gray-50"
            />
          </div>
        </Modal>
      )}

      {incentiveModalLocation && (
        <Modal onClose={closeIncentiveSettingsModal} backdropClassName="bg-gray-600/50">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl border border-gray-200">
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Sales Incentive Settings</h3>
                <p className="mt-1 text-sm text-gray-600">{incentiveModalLocation.name}</p>
              </div>
              <button
                type="button"
                onClick={closeIncentiveSettingsModal}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <p className="text-sm text-gray-600">
                Set branch-specific incentive thresholds. Leave values at the system defaults unless
                this branch needs different targets.
              </p>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Regular Day — Daily Gross Sales Required
                  </label>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Default: ₱{formatIncentiveAmount(DEFAULT_INCENTIVE_REGULAR_SALES_THRESHOLD)}
                  </p>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={incentiveForm.regularSalesThreshold}
                    onChange={(e) =>
                      setIncentiveForm((prev) => ({
                        ...prev,
                        regularSalesThreshold: e.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Holiday — Daily Gross Sales Required
                  </label>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Default: ₱{formatIncentiveAmount(DEFAULT_INCENTIVE_HOLIDAY_SALES_THRESHOLD)}
                  </p>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={incentiveForm.holidaySalesThreshold}
                    onChange={(e) =>
                      setIncentiveForm((prev) => ({
                        ...prev,
                        holidaySalesThreshold: e.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Base Incentive Amount
                  </label>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Default: ₱{formatIncentiveAmount(DEFAULT_INCENTIVE_BASE_AMOUNT)} when the sales
                    threshold is reached
                  </p>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={incentiveForm.baseAmount}
                    onChange={(e) =>
                      setIncentiveForm((prev) => ({
                        ...prev,
                        baseAmount: e.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Additional incentive of ₱{formatIncentiveAmount(DEFAULT_INCENTIVE_INCREMENT_AMOUNT)}{' '}
                applies for every ₱{formatIncentiveAmount(DEFAULT_INCENTIVE_INCREMENT_SALES)} in gross
                sales above the threshold.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={handleResetIncentiveDefaults}
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Reset to defaults
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeIncentiveSettingsModal}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveIncentiveSettings}
                  disabled={savingIncentiveSettings}
                  className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                    theme === 'green'
                      ? 'bg-green-600 hover:bg-green-700'
                      : theme === 'red'
                        ? 'bg-red-600 hover:bg-red-700'
                        : theme === 'yellow'
                          ? 'bg-yellow-600 hover:bg-yellow-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {savingIncentiveSettings ? 'Saving…' : 'Save settings'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

    </div>
  )
}
