'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { MapPin, Plus, Edit, Trash2, Save, X, FileText, Printer, Eye, Copy } from 'lucide-react'
import { formatPhilippinesDateTime } from '../../lib/timezone'

interface Location {
  id: string
  name: string
  passkey: string
  brand_id: string
  franchisee?: string
  contact_number?: string
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
  created_at: string
  updated_at: string
  notes?: string
  location?: Location
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
    }
  }>
}

interface BranchManagerProps {
  selectedBrand: any | null
  theme?: string
}

export function BranchManager({ selectedBrand, theme = 'blue' }: BranchManagerProps) {
  const [locations, setLocations] = useState<Location[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [locationOrders, setLocationOrders] = useState<CustomerOrder[]>([])
  const [showOrderHistory, setShowOrderHistory] = useState(false)
  const [newLocation, setNewLocation] = useState({
    name: '',
    passkey: '',
    franchisee: '',
    contact_number: '',
    brand_id: selectedBrand?.id || ''
  })

  useEffect(() => {
    if (selectedBrand) {
      fetchLocations()
      fetchBrands()
      // Update newLocation brand_id when selectedBrand changes
      setNewLocation(prev => ({ ...prev, brand_id: selectedBrand.id }))
    }
  }, [selectedBrand])

  const fetchLocations = async () => {
    if (!selectedBrand) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('locations')
        .select(`
          *,
          brand:brands(*)
        `)
        .eq('brand_id', selectedBrand.id)
        .order('name')
      
      if (error) {
        console.error('Error fetching locations:', error)
        return
      }
      
      if (data) {
        setLocations(data)
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('name')
      
      if (error) {
        console.error('Error fetching brands:', error)
        return
      }
      
      if (data) {
        setBrands(data)
      }
    } catch (error) {
      console.error('Error fetching brands:', error)
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
        setNewLocation({ name: '', passkey: '', franchisee: '', contact_number: '', brand_id: selectedBrand?.id || '' })
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
            product:products(id, name, sku, unit)
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

  const calculateTotalRevenue = (orders: CustomerOrder[]) => {
    return orders.reduce((total, order) => total + (order.total_amount || 0), 0)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // You could add a toast notification here if desired
      console.log('Passkey copied to clipboard:', text)
    } catch (err) {
      console.error('Failed to copy passkey:', err)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      released: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const getTotalItems = (order: CustomerOrder) => {
    return order.order_details.reduce((total, detail) => total + detail.quantity, 0)
  }

  const getTotalAmount = (order: CustomerOrder) => {
    return order.order_details.reduce((total, detail) => total + (detail.unit_price * detail.quantity), 0)
  }

  const handlePrintReceipt = (order: CustomerOrder) => {
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
              <div class="company-name">${order.brand?.name || 'Company'}</div>
              <div class="receipt-title">Order Receipt</div>
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
              ${order.order_details.map(detail => `
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
          
            ${order.notes ? `
              <div class="notes">
                <div class="notes-title">Notes</div>
                <div class="notes-text">${order.notes}</div>
              </div>
            ` : ''}
            
            <div class="total-section">
              <div class="total-row">
                <span class="total-label">Total Items</span>
                <span class="total-value">${getTotalItems(order)}</span>
              </div>
              <div class="total-row grand-total">
                <span class="total-label">Total Amount</span>
                <span class="total-value">₱${getTotalAmount(order).toFixed(2)}</span>
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
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
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
              <p className="text-2xl font-bold text-green-900">₱{calculateTotalRevenue(locationOrders).toFixed(2)}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">Franchisee</p>
              <p className="text-lg font-semibold text-purple-900">{selectedLocation.franchisee || 'N/A'}</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-sm text-orange-600 font-medium">Contact</p>
              <p className="text-lg font-semibold text-orange-900">{selectedLocation.contact_number || 'N/A'}</p>
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
                      Items
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
                        {order.customer_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        ₱{order.total_amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.order_details?.length || 0} items
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
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
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Branch Manager</h3>
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
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-lg rounded-md bg-white">
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
        </div>
      )}

      {/* Branches List */}
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
                    Branch Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Passkey
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Franchisee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {locations.map((location) => (
                  <tr key={location.id} className="hover:bg-blue-100">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {editingLocation?.id === location.id ? (
                        <input
                          type="text"
                          value={editingLocation.name}
                          onChange={(e) => setEditingLocation({...editingLocation, name: e.target.value})}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                      ) : (
                        location.name
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
                            onClick={() => copyToClipboard(location.passkey)}
                            className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                              theme === 'green' ? 'text-green-600 hover:text-green-700' :
                              theme === 'red' ? 'text-red-600 hover:text-red-700' :
                              theme === 'yellow' ? 'text-yellow-600 hover:text-yellow-700' :
                              'text-blue-600 hover:text-blue-700'
                            }`}
                            title="Copy passkey"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                              onClick={() => handleViewOrderHistory(location)}
                              className="p-1 rounded text-green-600 hover:text-green-900 hover:bg-green-50 transition-all duration-200 ease-in-out"
                              title="View Order History"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteLocation(location.id)}
                              className="p-1 rounded text-red-600 hover:text-red-900 hover:bg-red-50 transition-all duration-200 ease-in-out"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
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
    </div>
  )
}
