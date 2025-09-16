'use client'
import React, { useState, useEffect } from 'react'
import { supabase, Brand } from '../../lib/supabase'
import { Calendar, TrendingUp, Package, Truck, CheckCircle, ChevronDown, ChevronRight, Eye, X } from 'lucide-react'
import { toPhilippinesTime, toPhilippinesDateString, formatPhilippinesDateTime, isSameDayInPhilippines } from '../../lib/timezone'

interface DailyStockSummary {
  id: string
  brand_id: string
  date: string
  total_production: number
  total_released: number
  total_final_stock: number
  created_at: string
  brand?: Brand
}

interface CustomerOrder {
  id: string
  location_id: string
  customer_name: string
  status: string
  total_amount: number
  created_at: string
  updated_at: string
  location?: {
    id: string
    name: string
  }
  order_details?: OrderDetail[]
}

interface OrderDetail {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  product?: {
    id: string
    name: string
    sku: string
  }
}

interface StockReportProps {
  selectedBrand?: Brand
  theme?: string
}

export default function StockReport({ selectedBrand, theme }: StockReportProps) {
  const [summaries, setSummaries] = useState<DailyStockSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set())
  const [ordersByDate, setOrdersByDate] = useState<Record<string, CustomerOrder[]>>({})
  const [allReleasedOrders, setAllReleasedOrders] = useState<CustomerOrder[]>([])
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null)
  const [loadingOrders, setLoadingOrders] = useState(false)

  const fetchSummaries = async () => {
    if (!selectedBrand) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('daily_stock_summaries')
        .select(`
          *,
          brand:brands(*)
        `)
        .eq('brand_id', selectedBrand.id)
        .order('date', { ascending: false })

      if (error) {
        console.error('Error fetching summaries:', error)
        alert('Error fetching stock summaries')
        return
      }

      setSummaries(data || [])
    } catch (error) {
      console.error('Error fetching summaries:', error)
      alert('Error fetching stock summaries')
    } finally {
      setLoading(false)
    }
  }

  const fetchAllReleasedOrders = async () => {
    if (!selectedBrand) return

    try {
      const { data, error } = await supabase
        .from('customer_orders')
        .select(`
          *,
          location:locations(*),
          order_details(
            *,
            product:products(*)
          )
        `)
        .eq('brand_id', selectedBrand.id)
        .eq('status', 'released')
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching all released orders:', error)
        return
      }

      setAllReleasedOrders(data || [])
    } catch (error) {
      console.error('Error fetching all released orders:', error)
    }
  }

  const fetchOrdersForDate = async (date: string) => {
    if (!selectedBrand) return

    setLoadingOrders(true)
    try {
      console.log('Fetching orders for date:', date, 'brand:', selectedBrand.id)
      
      // Get all released orders for this brand first, then filter by date
      const { data, error } = await supabase
        .from('customer_orders')
        .select(`
          *,
          location:locations(*),
          order_details(
            *,
            product:products(*)
          )
        `)
        .eq('brand_id', selectedBrand.id)
        .eq('status', 'released')
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching orders for date:', error)
        return
      }

      // Filter orders that were released on the specific date (using Philippines timezone)
      const filteredOrders = (data || []).filter(order => {
        try {
          // Convert order dates to Philippines timezone for comparison
          const orderUpdatedDate = order.updated_at ? toPhilippinesDateString(order.updated_at) : ''
          const orderCreatedDate = order.created_at ? toPhilippinesDateString(order.created_at) : ''
          
          console.log(`Order ${order.id.slice(-8)}: created=${orderCreatedDate}, updated=${orderUpdatedDate}, target=${date}`)
          
          // Check if the order was updated (released) on this date OR created on this date
          const matches = orderUpdatedDate === date || orderCreatedDate === date
          console.log(`  → Match: ${matches}`)
          return matches
        } catch (error) {
          console.error(`Error parsing dates for order ${order.id}:`, error)
          console.error('Order data:', order)
          return false
        }
      })

      console.log('All released orders:', data?.length || 0)
      console.log('Raw orders data:', data)
      console.log('Filtered orders for date:', filteredOrders.length)
      console.log('Filtered orders:', filteredOrders)
      
      setOrdersByDate(prev => ({
        ...prev,
        [date]: filteredOrders
      }))
    } catch (error) {
      console.error('Error fetching orders for date:', error)
    } finally {
      setLoadingOrders(false)
    }
  }

  const toggleSummaryExpansion = async (summaryId: string, date: string) => {
    const newExpanded = new Set(expandedSummaries)
    
    if (newExpanded.has(summaryId)) {
      newExpanded.delete(summaryId)
    } else {
      newExpanded.add(summaryId)
      // Always fetch fresh data when expanding
      await fetchOrdersForDate(date)
    }
    
    setExpandedSummaries(newExpanded)
  }

  useEffect(() => {
    if (selectedBrand) {
      fetchSummaries()
      fetchAllReleasedOrders()
    }
  }, [selectedBrand])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusIcon = (summary: DailyStockSummary) => {
    if (summary.total_production > 0 && summary.total_released > 0) {
      return <TrendingUp className="h-4 w-4 text-blue-500" />
    } else if (summary.total_production > 0) {
      return <Package className="h-4 w-4 text-green-500" />
    } else if (summary.total_released > 0) {
      return <Truck className="h-4 w-4 text-orange-500" />
    } else {
      return <CheckCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (summary: DailyStockSummary) => {
    if (summary.total_production > 0 && summary.total_released > 0) {
      return 'bg-blue-100 text-blue-800'
    } else if (summary.total_production > 0) {
      return 'bg-green-100 text-green-800'
    } else if (summary.total_released > 0) {
      return 'bg-orange-100 text-orange-800'
    } else {
      return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (summary: DailyStockSummary) => {
    if (summary.total_production > 0 && summary.total_released > 0) {
      return 'Active Day'
    } else if (summary.total_production > 0) {
      return 'Production Only'
    } else if (summary.total_released > 0) {
      return 'Release Only'
    } else {
      return 'No Activity'
    }
  }

  const getTotalItems = (order: CustomerOrder) => {
    return order.order_details?.reduce((total, detail) => total + detail.quantity, 0) || 0
  }

  const getTotalAmount = (order: CustomerOrder) => {
    return order.order_details?.reduce((total, detail) => total + (detail.unit_price * detail.quantity), 0) || 0
  }

  const getTotalOrdersReleased = () => {
    return allReleasedOrders.length
  }

  const getTotalAmountReleased = () => {
    return allReleasedOrders.reduce((total, order) => total + getTotalAmount(order), 0)
  }

  if (!selectedBrand) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p>Please select a brand to view stock reports</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">
            Stock Reports for {selectedBrand.name}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Daily summaries of finalized stock operations
          </p>
        </div>
        <button
          onClick={() => {
            fetchSummaries()
            fetchAllReleasedOrders()
          }}
          className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${
            theme === 'green' ? 'bg-green-600 hover:bg-green-700' :
            theme === 'red' ? 'bg-red-600 hover:bg-red-700' :
            theme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
            'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Production</p>
              <p className="text-2xl font-semibold text-gray-900">
                {summaries.reduce((sum, s) => sum + s.total_production, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Truck className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Orders Released</p>
              <p className="text-2xl font-semibold text-gray-900">
                {getTotalOrdersReleased()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Amount Released</p>
              <p className="text-2xl font-semibold text-gray-900">
                ₱{getTotalAmountReleased().toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>


      {/* Daily Summaries List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading reports...</span>
        </div>
      ) : summaries.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No stock reports found</p>
          <p className="text-sm text-gray-500 mt-2">
            Stock reports will appear here after using the "Finalize Stock" button
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                    
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Production
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Released
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Final Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Finalized At
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {summaries.map((summary) => {
                  const isExpanded = expandedSummaries.has(summary.id)
                  const orders = ordersByDate[summary.date] || []
                  
                  return (
                    <React.Fragment key={summary.id}>
                      {/* Main Summary Row */}
                      <tr className="hover:bg-blue-100">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => toggleSummaryExpansion(summary.id, summary.date)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatDate(summary.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(summary)}`}>
                            {getStatusIcon(summary)}
                            <span className="ml-1">{getStatusText(summary)}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {summary.total_production}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {summary.total_released}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                          {summary.total_final_stock}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(summary.created_at).toLocaleString()}
                        </td>
                      </tr>
                      
                      {/* Expanded Orders Rows */}
                      {isExpanded && (
                        <>
                          <tr className="bg-gray-50">
                            <td colSpan={7} className="px-6 py-3">
                              <div className="text-sm font-medium text-gray-700 mb-2">
                                Released Orders ({orders.length})
                              </div>
                              {loadingOrders ? (
                                <div className="flex items-center justify-center py-4">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                                  <span className="ml-2 text-sm text-gray-600">Loading orders...</span>
                                </div>
                              ) : orders.length === 0 ? (
                                <div className="text-sm text-gray-500 py-4">
                                  No orders were released on this date
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {orders.map((order) => (
                                    <div key={order.id} className="flex items-center justify-between bg-white rounded border p-3 hover:bg-blue-100">
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-4">
                                          <div>
                                            <div className="text-sm font-medium text-gray-900">
                                              #{order.id.slice(-8)}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              {order.location?.name}
                                            </div>
                                          </div>
                                          <div className="text-sm text-gray-600">
                                            {order.customer_name}
                                          </div>
                                          <div className="text-sm text-gray-600">
                                            {getTotalItems(order)} items
                                          </div>
                                          <div className="text-sm font-medium text-green-600">
                                            ₱{getTotalAmount(order).toFixed(2)}
                                          </div>
                                <div className="text-xs text-gray-500">
                                  {formatPhilippinesDateTime(order.updated_at)}
                                </div>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => setSelectedOrder(order)}
                                        className={`ml-4 px-3 py-1 text-xs rounded transition-all duration-200 ease-in-out ${
                                          theme === 'green' ? 'text-green-600 hover:text-green-900 hover:bg-green-50' :
                                          theme === 'red' ? 'text-red-600 hover:text-red-900 hover:bg-red-50' :
                                          theme === 'yellow' ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50' :
                                          'text-blue-600 hover:text-blue-900 hover:bg-blue-50'
                                        }`}
                                      >
                                        <Eye className="h-5 w-5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        </>
                      )}
                    </React.Fragment>
                  )
                })}
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
                Order Details - #{selectedOrder.id.slice(-8)}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Order Information */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Customer</label>
                <p className="text-sm text-gray-900">{selectedOrder.customer_name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Location</label>
                <p className="text-sm text-gray-900">{selectedOrder.location?.name}</p>
              </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date & Time (PST)</label>
              <p className="text-sm text-gray-900">{formatPhilippinesDateTime(selectedOrder.updated_at)}</p>
            </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Total Amount</label>
                <p className="text-sm font-medium text-green-600">₱{getTotalAmount(selectedOrder).toFixed(2)}</p>
              </div>
            </div>

            {/* Order Items */}
            <div className="border-t pt-4">
              <h4 className="text-md font-medium text-gray-900 mb-3">Order Items</h4>
              <div className="space-y-2">
                {selectedOrder.order_details?.map((detail) => (
                  <div key={detail.id} className="flex items-center justify-between bg-gray-50 rounded p-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {detail.product?.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        SKU: {detail.product?.sku}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-600">
                        {detail.quantity} × ₱{detail.unit_price.toFixed(2)}
                      </div>
                      <div className="text-sm font-medium text-green-600">
                        ₱{(detail.quantity * detail.unit_price).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
