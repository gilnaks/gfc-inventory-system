'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { DSIRViewer } from './DSIRViewer'
import { FileText, Calendar, MapPin, User, Eye, ArrowLeft, Trash2, Edit3, RefreshCw } from 'lucide-react'

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

interface DSIRReportsListProps {
  selectedBrand: Brand
  selectedLocation?: Location
  theme?: string
}

export function DSIRReportsList({ selectedBrand, selectedLocation, theme = 'blue' }: DSIRReportsListProps) {
  const [reports, setReports] = useState<DSIRReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedReport, setSelectedReport] = useState<DSIRReport | null>(null)
  const [dateFilter, setDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'submitted' | 'reviewed'>('all')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [reverting, setReverting] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (selectedBrand?.id) {
      loadReports()
    }
  }, [selectedBrand, selectedLocation])

  // Real-time subscription for DSIR report changes
  useEffect(() => {
    if (!selectedBrand?.id) return

    const channel = supabase
      .channel('dsir-reports-dashboard-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dsir_reports'
        },
        (payload) => {
          console.log('DSIR dashboard realtime update:', payload)
          
          if (payload.eventType === 'INSERT') {
            // Add new report to the list
            if (payload.new) {
              setReports(prev => [payload.new as DSIRReport, ...prev])
            }
          } else if (payload.eventType === 'UPDATE') {
            // Update existing report in the list
            if (payload.new) {
              setReports(prev => prev.map(report => 
                report.id === payload.new.id ? payload.new as DSIRReport : report
              ))
            }
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted report from the list
            if (payload.old) {
              setReports(prev => prev.filter(report => report.id !== payload.old.id))
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedBrand])

  const loadReports = async () => {
    if (!selectedBrand?.id) return

    setLoading(true)
    setError('')

    try {
      // First, get all locations for the selected brand
      const { data: brandLocations, error: locationsError } = await supabase
        .from('locations')
        .select('id')
        .eq('brand_id', selectedBrand.id)

      if (locationsError) throw locationsError

      if (!brandLocations || brandLocations.length === 0) {
        setReports([])
        return
      }

      const locationIds = brandLocations.map(loc => loc.id)

      let query = supabase
        .from('dsir_reports')
        .select(`
          *,
          location:locations!dsir_reports_location_id_fkey(
            id,
            name,
            brand_id
          ),
          staff_registration:staff_registrations!dsir_reports_staff_registration_id_fkey(
            id,
            full_name,
            staff_code
          )
        `)
        .in('location_id', locationIds)

      // If selectedLocation is provided, also filter by location
      if (selectedLocation?.id) {
        query = query.eq('location_id', selectedLocation.id)
      }

      const { data, error } = await query
        .order('report_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      setReports(data || [])
    } catch (error) {
      console.error('Error loading DSIR reports:', error)
      setError('Failed to load DSIR reports')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    setError('')
    try {
      await loadReports()
    } catch (error) {
      console.error('Error refreshing reports:', error)
      setError('Failed to refresh reports')
    } finally {
      setRefreshing(false)
    }
  }

  const filteredReports = reports.filter(report => {
    const matchesDate = !dateFilter || report.report_date.includes(dateFilter)
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter
    return matchesDate && matchesStatus
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
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

  const formatCurrency = (amount: number) => {
    return `₱${amount?.toLocaleString() || '0.00'}`
  }

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
        
        <DSIRViewer report={selectedReport} showEditButton={true} />
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

  if (error) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={loadReports}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">DSIR Reports</h2>
          <p className="text-sm sm:text-base text-gray-600">
            {selectedBrand.name}
            {selectedLocation ? ` - ${selectedLocation.name}` : ''} - {reports.length} reports found
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh Reports"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>


      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Date
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-1">
            <button
              onClick={() => {
                setDateFilter('')
                setStatusFilter('all')
              }}
              className="w-full px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 text-base sm:text-sm"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No DSIR reports found</p>
          <p className="text-sm text-gray-500 mt-2">
            {reports.length === 0 
              ? selectedLocation 
                ? `No reports have been created for ${selectedLocation.name} yet.`
                : 'No reports have been created for this brand yet.'
              : 'No reports match your current filters.'
            }
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredReports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                          {formatDate(report.report_date)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                          {report.location?.name || 'Unknown Location'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-gray-400 mr-2" />
                          {report.staff_name || 'Unknown Staff'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(report.status)}`}>
                          {report.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {report.status === 'draft' ? '-' : formatCurrency(report.net_sales || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-medium ${
                          report.status === 'draft' ? 'text-gray-500' :
                          (report.discrepancy || 0) > 0 ? 'text-yellow-600' : 
                          (report.discrepancy || 0) < 0 ? 'text-red-600' : 
                          'text-green-600'
                        }`}>
                          {report.status === 'draft' ? '-' : 
                           (report.discrepancy || 0) !== 0 ? formatCurrency(report.discrepancy || 0) : 'No Discrepancy'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => setSelectedReport(report)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Report"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {report.status === 'submitted' && (
                            <button
                              onClick={() => revertToDraft(report.id)}
                              disabled={reverting === report.id}
                              className="text-orange-600 hover:text-orange-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={reverting === report.id ? 'Reverting...' : 'Revert to Draft'}
                            >
                              <Edit3 className="h-4 w-4" />
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
                  </div>
                  <div className="ml-3 flex flex-col items-end space-y-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(report.status)}`}>
                      {report.status.toUpperCase()}
                    </span>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        {report.status === 'draft' ? '-' : formatCurrency(report.net_sales || 0)}
                      </div>
                      <div className={`text-xs font-medium ${
                        report.status === 'draft' ? 'text-gray-500' :
                        (report.discrepancy || 0) > 0 ? 'text-yellow-600' : 
                        (report.discrepancy || 0) < 0 ? 'text-red-600' : 
                        'text-green-600'
                      }`}>
                        Discrepancy: {report.status === 'draft' ? '-' : 
                                     (report.discrepancy || 0) !== 0 ? formatCurrency(report.discrepancy || 0) : 'No Discrepancy'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedReport(report)}
                    className="flex-1 flex items-center justify-center px-4 py-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-md border border-blue-200"
                    title="View Report"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  {report.status === 'submitted' && (
                    <button
                      onClick={() => revertToDraft(report.id)}
                      disabled={reverting === report.id}
                      className="flex items-center justify-center px-4 py-2 text-orange-600 hover:text-orange-900 hover:bg-orange-50 rounded-md border border-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={reverting === report.id ? 'Reverting...' : 'Revert to Draft'}
                    >
                      <Edit3 className="h-4 w-4" />
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
            ))}
          </div>
        </>
      )}

    </div>
  )
}
