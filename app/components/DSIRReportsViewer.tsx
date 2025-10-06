'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { DSIRViewer } from './DSIRViewer'
import { FileText, Calendar, MapPin, User, Eye, ArrowLeft, Trash2, Edit3, RefreshCw, RotateCcw, X } from 'lucide-react'

interface Brand {
  id: string
  name: string
}

interface Location {
  id: string
  name: string
  brand_id: string
}

interface StaffRegistration {
  id: string
  full_name: string
  staff_code: string
}

interface DSIRReport {
  id: string
  location_id: string
  staff_registration_id: string
  report_date: string
  store_hours: string
  staff_name: string
  initial: string
  gross_sales: number
  total_discounts: number
  total_expenses: number
  net_sales: number
  total_cash: number
  discrepancy: number
  status: 'draft' | 'submitted' | 'reviewed'
  notes: string
  created_at: string
  updated_at: string
  location: Location
  staff_registration: StaffRegistration
}

interface DSIRReportsViewerProps {
  selectedBrand: Brand
  selectedLocation?: Location
  theme?: string
  showEditItemsButton?: boolean
}

export function DSIRReportsViewer({ selectedBrand, selectedLocation, theme, showEditItemsButton = true }: DSIRReportsViewerProps) {
  const [reports, setReports] = useState<DSIRReport[]>([])
  const [selectedReport, setSelectedReport] = useState<DSIRReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [reverting, setReverting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'submitted' | 'reviewed'>('all')
  
  // Edit Items Modal State
  const [isEditItemsModalOpen, setIsEditItemsModalOpen] = useState(false)
  const [predefinedItems, setPredefinedItems] = useState<any[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [savingItems, setSavingItems] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', price: 0, category: '' })
  
  // Inventory differences tracking
  const [inventoryDifferences, setInventoryDifferences] = useState<{[reportId: string]: boolean}>({})

  useEffect(() => {
    loadReports()
  }, [selectedBrand, selectedLocation])

  // Close report view when brand changes
  useEffect(() => {
    if (selectedReport) {
      setSelectedReport(null)
    }
  }, [selectedBrand])

  useEffect(() => {
    if (isEditItemsModalOpen) {
      loadPredefinedItems()
    }
  }, [isEditItemsModalOpen])

  const loadReports = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('dsir_reports')
        .select(`
          *,
          location:locations!inner(*)
        `)
        .eq('location.brand_id', selectedBrand.id)

      if (selectedLocation) {
        query = query.eq('location_id', selectedLocation.id)
      }

      const { data, error } = await query.order('report_date', { ascending: false }).order('created_at', { ascending: false })

      if (error) throw error
      setReports(data || [])
      
      // Check for inventory differences for each report
      if (data && data.length > 0) {
        await checkInventoryDifferences(data)
      }
    } catch (error) {
      console.error('Error loading DSIR reports:', error)
      setError('Failed to load DSIR reports')
    } finally {
      setLoading(false)
    }
  }

  const checkInventoryDifferences = async (reports: DSIRReport[]) => {
    const differences: {[reportId: string]: boolean} = {}
    
    for (const report of reports) {
      try {
        // Calculate previous day date
        const reportDate = new Date(report.report_date)
        const previousDay = new Date(reportDate)
        previousDay.setDate(previousDay.getDate() - 1)
        const previousDayStr = previousDay.toISOString().split('T')[0]

        // Find the previous day's DSIR report for the same location
        const { data: previousReportData } = await supabase
          .from('dsir_reports')
          .select('id')
          .eq('location_id', report.location_id)
          .eq('report_date', previousDayStr)
          .eq('status', 'submitted')
          .order('created_at', { ascending: false })
          .limit(1)
        
        const previousReport = previousReportData?.[0] || null

        if (previousReport) {
          // Load previous day's ending inventory and current day's beginning inventory
          const [previousSales, currentSales, previousIceCream, currentIceCream, previousMaterials, currentMaterials] = await Promise.all([
            supabase
              .from('dsir_sales_inventory')
              .select('item_name, ending_inventory')
              .eq('dsir_report_id', previousReport.id),
            supabase
              .from('dsir_sales_inventory')
              .select('item_name, beginning_inventory')
              .eq('dsir_report_id', report.id),
            supabase
              .from('dsir_ice_cream_inventory')
              .select('flavor, ending')
              .eq('dsir_report_id', previousReport.id),
            supabase
              .from('dsir_ice_cream_inventory')
              .select('flavor, beginning')
              .eq('dsir_report_id', report.id),
            supabase
              .from('dsir_materials_inventory')
              .select('material_name, ending')
              .eq('dsir_report_id', previousReport.id),
            supabase
              .from('dsir_materials_inventory')
              .select('material_name, beginning')
              .eq('dsir_report_id', report.id)
          ])

          // Check for differences in sales inventory
          let hasDifference = false
          
          for (const currentItem of currentSales.data || []) {
            const previousItem = previousSales.data?.find(p => p.item_name === currentItem.item_name)
            const previousEnding = previousItem?.ending_inventory || 0
            const currentBeginning = currentItem.beginning_inventory || 0
            
            if (currentBeginning !== previousEnding) {
              hasDifference = true
              break
            }
          }

          // Check for differences in ice cream inventory
          if (!hasDifference) {
            for (const currentItem of currentIceCream.data || []) {
              const previousItem = previousIceCream.data?.find(p => p.flavor === currentItem.flavor)
              const previousEnding = previousItem?.ending || 0
              const currentBeginning = currentItem.beginning || 0
              
              if (currentBeginning !== previousEnding) {
                hasDifference = true
                break
              }
            }
          }

          // Check for differences in materials inventory
          if (!hasDifference) {
            for (const currentItem of currentMaterials.data || []) {
              const previousItem = previousMaterials.data?.find(p => p.material_name === currentItem.material_name)
              const previousEnding = previousItem?.ending || 0
              const currentBeginning = currentItem.beginning || 0
              
              if (currentBeginning !== previousEnding) {
                hasDifference = true
                break
              }
            }
          }

          differences[report.id] = hasDifference
        } else {
          differences[report.id] = false
        }
      } catch (error) {
        console.error(`Error checking differences for report ${report.id}:`, error)
        differences[report.id] = false
      }
    }

    setInventoryDifferences(differences)
  }

  const deleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this DSIR report? This action cannot be undone.')) {
      return
    }

    setDeleting(reportId)
    setError('')

    try {
      const { error } = await supabase
        .from('dsir_reports')
        .delete()
        .eq('id', reportId)

      if (error) throw error

      // Remove from local state
      setReports(prev => prev.filter(report => report.id !== reportId))
      setSuccess('DSIR report deleted successfully!')
    } catch (error) {
      console.error('Error deleting DSIR report:', error)
      setError('Failed to delete DSIR report')
    } finally {
      setDeleting(null)
    }
  }

  const revertToDraft = async (reportId: string) => {
    if (!confirm('Are you sure you want to revert this DSIR report back to draft? The staff member will be able to edit it again.')) {
      return
    }

    setReverting(reportId)
    setError('')

    try {
      const { error } = await supabase
        .from('dsir_reports')
        .update({ 
          status: 'draft',
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId)

      if (error) throw error

      // Update local state
      setReports(prev => prev.map(report => 
        report.id === reportId 
          ? { ...report, status: 'draft' as const, updated_at: new Date().toISOString() }
          : report
      ))
    } catch (error) {
      console.error('Error reverting DSIR report:', error)
      setError('Failed to revert DSIR report to draft')
    } finally {
      setReverting(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-yellow-100 text-yellow-800'
      case 'submitted':
        return 'bg-blue-100 text-blue-800'
      case 'reviewed':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return `₱${amount?.toLocaleString() || '0.00'}`
  }

  const formatNetSales = (report: DSIRReport) => {
    if (report.status === 'draft') {
      return '-'
    }
    return formatCurrency(report.net_sales)
  }

  const formatDiscrepancy = (report: DSIRReport) => {
    if (report.status === 'draft') {
      return { text: '-', color: 'text-gray-900' }
    }
    
    const discrepancy = report.discrepancy || 0
    if (discrepancy === 0) {
      return { text: 'No Discrepancy', color: 'text-green-600' }
    } else if (discrepancy < 0) {
      return { text: formatCurrency(discrepancy), color: 'text-red-600' }
    } else {
      return { text: formatCurrency(discrepancy), color: 'text-yellow-600' }
    }
  }

  // Predefined Items Management Functions
  const loadPredefinedItems = async () => {
    setLoadingItems(true)
    try {
      const { data, error } = await supabase
        .from('dsir_predefined_items')
        .select('*')
        .eq('brand_id', selectedBrand.id)
        .eq('is_active', true)
        .order('category, name')

      if (error) throw error
      setPredefinedItems(data || [])
    } catch (error) {
      console.error('Error loading predefined items:', error)
      setError('Failed to load predefined items')
    } finally {
      setLoadingItems(false)
    }
  }

  const addPredefinedItem = async () => {
    if (!newItem.name.trim() || !newItem.category) {
      setError('Please enter a valid item name and category')
      return
    }
    
    if (newItem.category === 'sales' && newItem.price <= 0) {
      setError('Please enter a valid price for sales inventory items')
      return
    }

    setSavingItems(true)
    try {
      const insertData: any = {
        name: newItem.name.trim(),
        category: newItem.category,
        brand_id: selectedBrand.id,
        is_active: true
      }
      
      // Only include price for sales inventory
      if (newItem.category === 'sales') {
        insertData.price = newItem.price
      }
      
      const { data, error } = await supabase
        .from('dsir_predefined_items')
        .insert(insertData)
        .select()

      if (error) throw error

      setPredefinedItems(prev => [...prev, ...data])
      setNewItem({ name: '', price: 0, category: '' })
      setSuccess('Item added successfully!')
    } catch (error) {
      console.error('Error adding predefined item:', error)
      setError('Failed to add item')
    } finally {
      setSavingItems(false)
    }
  }

  const updatePredefinedItem = async (id: string, name: string, price: number, category: string) => {
    setSavingItems(true)
    try {
      const updateData: any = { 
        name: name.trim(), 
        category 
      }
      
      // Only include price for sales inventory
      if (category === 'sales') {
        updateData.price = price
      }
      
      const { error } = await supabase
        .from('dsir_predefined_items')
        .update(updateData)
        .eq('id', id)

      if (error) throw error

      setPredefinedItems(prev => prev.map(item => 
        item.id === id ? { ...item, name: name.trim(), price: category === 'sales' ? price : item.price, category } : item
      ))
      setSuccess('Item updated successfully!')
    } catch (error) {
      console.error('Error updating predefined item:', error)
      setError('Failed to update item')
    } finally {
      setSavingItems(false)
    }
  }

  const deletePredefinedItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return
    }

    setSavingItems(true)
    try {
      const { error } = await supabase
        .from('dsir_predefined_items')
        .delete()
        .eq('id', id)

      if (error) throw error

      setPredefinedItems(prev => prev.filter(item => item.id !== id))
      setSuccess('Item deleted successfully!')
    } catch (error) {
      console.error('Error deleting predefined item:', error)
      setError('Failed to delete item')
    } finally {
      setSavingItems(false)
    }
  }

  // Group items by category
  const getGroupedItems = () => {
    const grouped = predefinedItems.reduce((acc, item) => {
      const category = item.category || 'uncategorized'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(item)
      return acc
    }, {} as { [key: string]: any[] })

    // Sort items within each category by name
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => a.name.localeCompare(b.name))
    })

    return grouped
  }

  // Get category display name
  const getCategoryDisplayName = (category: string) => {
    const categoryNames: { [key: string]: string } = {
      'sales': 'Sales Inventory',
      'ice_cream': 'Ice Cream Flavors',
      'materials': 'Materials Inventory',
      'denominations': 'Sales Reconciliation'
    }
    return categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1)
  }

  const filteredReports = reports.filter(report => {
    const matchesSearch = 
      report.staff_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.location?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.id.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter
    
    return matchesSearch && matchesStatus
  }).sort((a, b) => {
    // Sort by report_date first, then by created_at as fallback
    const dateA = new Date(a.report_date || a.created_at)
    const dateB = new Date(b.report_date || b.created_at)
    return dateB.getTime() - dateA.getTime() // Most recent first
  })

  if (selectedReport) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <button
            onClick={() => {
              setSelectedReport(null)
              loadReports()
            }}
            className="flex items-center justify-center sm:justify-start space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 w-full sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Reports</span>
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              DSIR Report - {selectedReport.location?.name || 'Unknown Location'}
            </h2>
            <p className="text-sm text-gray-600">
              {formatDate(selectedReport.report_date)} • {selectedReport.staff_name || 'Unknown Staff'}
            </p>
          </div>
        </div>
        
        <DSIRViewer report={selectedReport} showEditButton={true} showDiscrepancyColumns={true} />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading DSIR reports...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">DSIR Reports</h1>
          <p className="text-sm text-gray-600">
            {selectedLocation 
              ? `View and manage DSIR reports for ${selectedBrand.name} at ${selectedLocation.name}`
              : `View and manage DSIR reports for ${selectedBrand.name} across all locations`
            }
          </p>
        </div>
        <div className="flex space-x-3">
          {showEditItemsButton && (
            <button
              onClick={() => setIsEditItemsModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md"
            >
              <Edit3 className="h-4 w-4" />
              <span>Edit Items</span>
            </button>
          )}
          <button
            onClick={loadReports}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by staff name, location, or report ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'draft' | 'submitted' | 'reviewed')}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No DSIR reports found</p>
          <p className="text-sm text-gray-400">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'No reports have been created yet'
            }
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white shadow overflow-hidden sm:rounded-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Staff
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Net Sales
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Discrepancy
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredReports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          {formatDate(report.report_date)}
                          {inventoryDifferences[report.id] && (
                            <div className="ml-2 w-2 h-2 bg-red-500 rounded-full" title="Inventory differences detected"></div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {report.location?.name || 'Unknown Location'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {report.staff_name || 'Unknown Staff'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(report.status)}`}>
                          {report.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNetSales(report)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={formatDiscrepancy(report).color}>
                          {formatDiscrepancy(report).text}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setSelectedReport(report)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Report"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {(report.status === 'submitted' || report.status === 'reviewed') && (
                            <button
                              onClick={() => revertToDraft(report.id)}
                              disabled={reverting === report.id}
                              className="text-orange-600 hover:text-orange-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={reverting === report.id ? 'Reverting...' : 'Revert to Draft'}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteReport(report.id)}
                            disabled={deleting === report.id}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={deleting === report.id ? 'Deleting...' : 'Delete Report'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-3">
            {filteredReports.map((report) => (
              <div key={report.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center mb-2">
                      <Calendar className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900">
                        {formatDate(report.report_date)}
                      </span>
                      {inventoryDifferences[report.id] && (
                        <div className="ml-2 w-2 h-2 bg-red-500 rounded-full" title="Inventory differences detected"></div>
                      )}
                    </div>
                    <div className="flex items-center mb-2">
                      <MapPin className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                      <span className="text-sm text-gray-600 truncate">
                        {report.location?.name || 'Unknown Location'}
                      </span>
                    </div>
                    <div className="flex items-center mb-2">
                      <User className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                      <span className="text-sm text-gray-600 truncate">
                        {report.staff_name || 'Unknown Staff'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-600">Net Sales:</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {formatNetSales(report)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-600">Discrepancy:</div>
                      <div className={`text-sm font-semibold ${formatDiscrepancy(report).color}`}>
                        {formatDiscrepancy(report).text}
                      </div>
                    </div>
                  </div>
                  <div className="ml-3 flex flex-col items-end">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(report.status)}`}>
                      {report.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <button
                    onClick={() => setSelectedReport(report)}
                    className="flex items-center justify-center px-4 py-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-md border border-blue-200"
                    title="View Report"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Report
                  </button>
                  <div className="flex items-center space-x-2">
                    {(report.status === 'submitted' || report.status === 'reviewed') && (
                      <button
                        onClick={() => revertToDraft(report.id)}
                        disabled={reverting === report.id}
                        className="flex items-center justify-center px-4 py-2 text-orange-600 hover:text-orange-900 hover:bg-orange-50 rounded-md border border-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={reverting === report.id ? 'Reverting...' : 'Revert to Draft'}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteReport(report.id)}
                      disabled={deleting === report.id}
                      className="flex items-center justify-center px-4 py-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={deleting === report.id ? 'Deleting...' : 'Delete Report'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Success</h3>
              <div className="mt-2 text-sm text-green-700">{success}</div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Items Modal */}
      {isEditItemsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit Predefined Items</h3>
              <button
                onClick={() => {
                  setIsEditItemsModalOpen(false)
                  setNewItem({ name: '', price: 0, category: '' })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {/* Add New Item */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-md font-medium text-gray-900 mb-4">Add New Item</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select category</option>
                      <option value="sales">Sales Inventory</option>
                      <option value="ice_cream">Ice Cream Flavors</option>
                      <option value="materials">Materials Inventory</option>
                      <option value="denominations">Sales Reconciliation</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Item Name</label>
                    <input
                      type="text"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter item name"
                    />
                  </div>
                  {newItem.category === 'sales' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Price (₱)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newItem.price}
                        onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                  <div className="flex items-end">
                    <button
                      onClick={addPredefinedItem}
                      disabled={savingItems || !newItem.name.trim() || (newItem.category === 'sales' && newItem.price <= 0) || !newItem.category}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingItems ? 'Adding...' : 'Add Item'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">Current Items</h4>
                {loadingItems ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading items...</p>
                  </div>
                ) : predefinedItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No predefined items found</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(getGroupedItems()).map(([category, items]) => (
                      <div key={category} className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <h5 className="text-lg font-semibold text-gray-800">
                            {getCategoryDisplayName(category)}
                          </h5>
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {items.length} item{items.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {items.map((item) => (
                            <EditableItemRow
                              key={item.id}
                              item={item}
                              onUpdate={updatePredefinedItem}
                              onDelete={deletePredefinedItem}
                              saving={savingItems}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsEditItemsModalOpen(false)
                  setNewItem({ name: '', price: 0, category: '' })
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Editable Item Row Component
function EditableItemRow({ item, onUpdate, onDelete, saving }: { 
  item: any, 
  onUpdate: (id: string, name: string, price: number, category: string) => void, 
  onDelete: (id: string) => void,
  saving: boolean 
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(item.name)
  const [editPrice, setEditPrice] = useState(item.price)
  const [editCategory, setEditCategory] = useState(item.category)

  const handleSave = () => {
    if (editName.trim() && editCategory) {
      if (editCategory === 'sales' && editPrice <= 0) {
        return // Don't save if sales category but no valid price
      }
      onUpdate(item.id, editName, editPrice, editCategory)
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setEditName(item.name)
    setEditPrice(item.price)
    setEditCategory(item.category)
    setIsEditing(false)
  }

  const getCategoryDisplayName = (category: string) => {
    const categoryNames: { [key: string]: string } = {
      'sales': 'Sales Inventory',
      'ice_cream': 'Ice Cream Flavors',
      'materials': 'Materials Inventory',
      'denominations': 'Sales Reconciliation'
    }
    return categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1)
  }

  return (
    <div className="p-3 bg-white border border-gray-200 rounded-lg">
      {isEditing ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="sales">Sales Inventory</option>
              <option value="ice_cream">Ice Cream Flavors</option>
              <option value="materials">Materials Inventory</option>
              <option value="denominations">Sales Reconciliation</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Item Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          {editCategory === 'sales' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Price (₱)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          )}
          <div className="flex items-end space-x-2">
            <button
              onClick={handleSave}
              disabled={saving || !editName.trim() || (editCategory === 'sales' && editPrice <= 0) || !editCategory}
              className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-3 py-2 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Item Name</span>
              <p className="text-sm font-medium text-gray-900">{item.name}</p>
            </div>
            {item.category === 'sales' && (
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Price</span>
                <p className="text-sm font-medium text-gray-900">₱{item.price.toFixed(2)}</p>
              </div>
            )}
          </div>
          <div className="flex space-x-2 ml-4">
            <button
              onClick={() => setIsEditing(true)}
              disabled={saving}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(item.id)}
              disabled={saving}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
