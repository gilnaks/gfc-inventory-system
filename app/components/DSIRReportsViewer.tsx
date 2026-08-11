'use client'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { DSIRViewer } from './DSIRViewer'
import { FileText, Calendar, MapPin, User, Eye, ArrowLeft, Trash2, Edit3, RefreshCw, RotateCcw, X, Plus, ChevronLeft, ChevronRight, Columns, Package } from 'lucide-react'
import { useAdminPasswordConfirm } from '../hooks/useAdminPasswordConfirm'
import { Modal } from './Modal'
import { DSIRStoreInventoryPanel } from './DSIRStoreInventoryPanel'
import { sumOnHandForLocation } from '../../lib/dsir-store-inventory'

interface Brand {
  id: string
  name: string
}

interface Location {
  id: string
  name: string
  brand_id: string
  company_owned?: boolean
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
  /** When false, hides report delete controls (dashboard guest). */
  showDeleteReportButton?: boolean
  /** When false, hides the Branch Last 7 Days Summary block and skips its calculation. */
  showLast7DaysSummary?: boolean
  /** When true, DSIR report body is view-only (dashboard guest). */
  dsirViewerReadOnly?: boolean
}

export function DSIRReportsViewer({
  selectedBrand,
  selectedLocation,
  theme,
  showEditItemsButton = true,
  showDeleteReportButton = true,
  showLast7DaysSummary = true,
  dsirViewerReadOnly = false,
}: DSIRReportsViewerProps) {
  const { requestAdminPassword, AdminPasswordModal } = useAdminPasswordConfirm()
  const [mainTab, setMainTab] = useState<'reports' | 'inventory'>('reports')
  const [inventoryLocationId, setInventoryLocationId] = useState('')
  const [inventoryLocations, setInventoryLocations] = useState<Location[]>([])
  const [lastReportLocationId, setLastReportLocationId] = useState('')
  const [showReportInventoryModal, setShowReportInventoryModal] = useState(false)
  const [reports, setReports] = useState<DSIRReport[]>([])
  const [selectedReport, setSelectedReport] = useState<DSIRReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [reverting, setReverting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'submitted' | 'reviewed'>('all')
  const [locationTypeFilter, setLocationTypeFilter] = useState<'all' | 'company' | 'franchise'>('all')
  const [dateFilter, setDateFilter] = useState('')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalReports, setTotalReports] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const reportsPerPage = 30
  
  // Date navigation state
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [loadingNavigation, setLoadingNavigation] = useState(false)
  
  // Split view state
  const [splitViewEnabled, setSplitViewEnabled] = useState(false)
  const [secondReport, setSecondReport] = useState<DSIRReport | null>(null)
  const [availableDatesSecond, setAvailableDatesSecond] = useState<string[]>([])
  const [loadingNavigationSecond, setLoadingNavigationSecond] = useState(false)
  
  // Edit Items Modal State
  const [isEditItemsModalOpen, setIsEditItemsModalOpen] = useState(false)
  const [predefinedItems, setPredefinedItems] = useState<any[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [savingItems, setSavingItems] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', price: 0, category: '', show_in_local: true, show_in_remote: true })
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  
  // Create Report Modal State
  const [isCreateReportModalOpen, setIsCreateReportModalOpen] = useState(false)
  const [createReportDate, setCreateReportDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [createReportLocationId, setCreateReportLocationId] = useState<string>('')
  const [createReportStaffId, setCreateReportStaffId] = useState<string>('')
  const [availableLocations, setAvailableLocations] = useState<Location[]>([])
  const [availableStaff, setAvailableStaff] = useState<StaffRegistration[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [creatingReport, setCreatingReport] = useState(false)
  
  // Inventory differences tracking
  const [inventoryDifferences, setInventoryDifferences] = useState<{[reportId: string]: boolean}>({})
  
  // Last 7 days summary state
  const [last7DaysSummaryByLocation, setLast7DaysSummaryByLocation] = useState<{
    [locationId: string]: {
      locationName: string
      totalGrossSales: number
      totalDiscounts: number
      totalExpenses: number
      netSales: number
      currentStockPans: number
      reportCount: number
    }
  }>({})

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when brand/location changes
    loadReports()
  }, [selectedBrand, selectedLocation])
  
  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
    loadReports()
  }, [searchTerm, statusFilter, locationTypeFilter, dateFilter])
  
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

  useEffect(() => {
    if (createReportLocationId) {
      loadStaffForLocation(createReportLocationId)
    } else {
      setAvailableStaff([])
      setCreateReportStaffId('')
    }
  }, [createReportLocationId])

  const loadAvailableDates = useCallback(async (locationId: string) => {
    try {
      const { data, error } = await supabase
        .from('dsir_reports')
        .select('report_date')
        .eq('location_id', locationId)
        .order('report_date', { ascending: false })

      if (error) throw error

      const uniqueDates = Array.from(new Set(data?.map(r => r.report_date) || []))
      setAvailableDates(uniqueDates)
    } catch (error) {
      console.error('Error loading available dates:', error)
      setAvailableDates([])
    }
  }, [])

  const navigateToDate = useCallback(async (direction: 'prev' | 'next') => {
    if (!selectedReport || availableDates.length === 0) return

    const currentIndex = availableDates.indexOf(selectedReport.report_date)
    if (currentIndex === -1) return

    let targetIndex: number
    if (direction === 'prev') {
      targetIndex = currentIndex + 1 // Previous date (older) is at a higher index since dates are sorted desc
    } else {
      targetIndex = currentIndex - 1 // Next date (newer) is at a lower index
    }

    if (targetIndex < 0 || targetIndex >= availableDates.length) return

    const targetDate = availableDates[targetIndex]
    
    setLoadingNavigation(true)
    try {
      const { data, error } = await supabase
        .from('dsir_reports')
        .select(`
          *,
          location:locations(*),
          staff_registration:staff_registrations(*)
        `)
        .eq('location_id', selectedReport.location_id)
        .eq('report_date', targetDate)
        .limit(1)
        .single()

      if (error) throw error
      if (data) {
        setSelectedReport(data)
      }
    } catch (error) {
      console.error('Error loading report for date:', error)
      setError('Failed to load report for the selected date')
    } finally {
      setLoadingNavigation(false)
    }
  }, [selectedReport, availableDates])

  const navigateToDateSecond = useCallback(async (direction: 'prev' | 'next') => {
    if (!secondReport || availableDatesSecond.length === 0) return

    const currentIndex = availableDatesSecond.indexOf(secondReport.report_date)
    if (currentIndex === -1) return

    let targetIndex: number
    if (direction === 'prev') {
      targetIndex = currentIndex + 1
    } else {
      targetIndex = currentIndex - 1
    }

    if (targetIndex < 0 || targetIndex >= availableDatesSecond.length) return

    const targetDate = availableDatesSecond[targetIndex]
    
    setLoadingNavigationSecond(true)
    try {
      const { data, error } = await supabase
        .from('dsir_reports')
        .select(`
          *,
          location:locations(*),
          staff_registration:staff_registrations(*)
        `)
        .eq('location_id', secondReport.location_id)
        .eq('report_date', targetDate)
        .limit(1)
        .single()

      if (error) throw error
      if (data) {
        setSecondReport(data)
      }
    } catch (error) {
      console.error('Error loading second report for date:', error)
      setError('Failed to load report for the selected date')
    } finally {
      setLoadingNavigationSecond(false)
    }
  }, [secondReport, availableDatesSecond])

  const loadAvailableDatesSecond = useCallback(async (locationId: string) => {
    try {
      const { data, error } = await supabase
        .from('dsir_reports')
        .select('report_date')
        .eq('location_id', locationId)
        .order('report_date', { ascending: false })

      if (error) throw error

      const uniqueDates = Array.from(new Set(data?.map(r => r.report_date) || []))
      setAvailableDatesSecond(uniqueDates)
    } catch (error) {
      console.error('Error loading available dates for second report:', error)
      setAvailableDatesSecond([])
    }
  }, [])

  useEffect(() => {
    if (selectedReport) {
      loadAvailableDates(selectedReport.location_id)
    } else {
      setAvailableDates([])
    }
  }, [selectedReport, loadAvailableDates])

  useEffect(() => {
    if (secondReport) {
      loadAvailableDatesSecond(secondReport.location_id)
    } else {
      setAvailableDatesSecond([])
    }
  }, [secondReport, loadAvailableDatesSecond])

  // When enabling split view, auto-select the next date if available
  useEffect(() => {
    if (splitViewEnabled && selectedReport && !secondReport && availableDates.length > 1) {
      const currentIndex = availableDates.indexOf(selectedReport.report_date)
      if (currentIndex !== -1 && currentIndex + 1 < availableDates.length) {
        const nextDate = availableDates[currentIndex + 1]
        // Load the report for the next date
        supabase
          .from('dsir_reports')
          .select(`
            *,
            location:locations(*),
            staff_registration:staff_registrations(*)
          `)
          .eq('location_id', selectedReport.location_id)
          .eq('report_date', nextDate)
          .limit(1)
          .single()
          .then(({ data, error }) => {
            if (!error && data) {
              setSecondReport(data)
            }
          })
      }
    }
  }, [splitViewEnabled, selectedReport, availableDates, secondReport])

  // When disabling split view, clear the second report
  useEffect(() => {
    if (!splitViewEnabled && secondReport) {
      setSecondReport(null)
    }
  }, [splitViewEnabled, secondReport])

  const calculateLast7DaysSummary = useCallback(async () => {
    try {
      // Calculate date range for last 7 days (including today)
      const today = new Date()
      const endDate = today.toISOString().split('T')[0] // Today in YYYY-MM-DD
      const startDateObj = new Date(today)
      startDateObj.setDate(today.getDate() - 6) // 6 days ago (7 days including today)
      const startDate = startDateObj.toISOString().split('T')[0] // Start date in YYYY-MM-DD
      
      // Filter reports by last 7 days
      let filteredReports = reports.filter(report => {
        const reportDate = report.report_date
        const matchesLast7Days = reportDate >= startDate && reportDate <= endDate
        return matchesLast7Days && report.status !== 'draft'
      })
      
      // Group by location and find latest report for each location
      const summaryByLocation: {[locationId: string]: {
        locationName: string
        totalGrossSales: number
        totalDiscounts: number
        totalExpenses: number
        netSales: number
        currentStockPans: number
        reportCount: number
        latestReportDate: string
      }} = {}
      
      for (const report of filteredReports) {
        const locationId = report.location_id
        const locationName = report.location?.name || 'Unknown'
        
        if (!summaryByLocation[locationId]) {
          summaryByLocation[locationId] = {
            locationName: locationName,
            totalGrossSales: 0,
            totalDiscounts: 0,
            totalExpenses: 0,
            netSales: 0,
            currentStockPans: 0,
            reportCount: 0,
            latestReportDate: report.report_date
          }
        }
        
        // Update latest report date
        if (report.report_date > summaryByLocation[locationId].latestReportDate) {
          summaryByLocation[locationId].latestReportDate = report.report_date
        }
        
        // Add sales data and increment report count
        summaryByLocation[locationId].totalGrossSales += report.gross_sales || 0
        summaryByLocation[locationId].totalDiscounts += report.total_discounts || 0
        summaryByLocation[locationId].totalExpenses += report.total_expenses || 0
        summaryByLocation[locationId].netSales += report.net_sales || 0
        summaryByLocation[locationId].reportCount += 1
      }
      
      // Fetch current stock pans from store inventory ledger (fallback: latest DSIR ending)
      for (const [locationId, summary] of Object.entries(summaryByLocation)) {
        try {
          summaryByLocation[locationId].currentStockPans = await sumOnHandForLocation(locationId)
          continue
        } catch {
          // Table may not exist yet — fall back
        }

        const latestReport = filteredReports
          .filter(r => r.location_id === locationId)
          .sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime())[0]
        
        if (latestReport) {
          const { data: latestInventory } = await supabase
            .from('dsir_ice_cream_inventory')
            .select('ending')
            .eq('dsir_report_id', latestReport.id)
          
          if (latestInventory) {
            const totalEnding = latestInventory.reduce((sum, item) => sum + (item.ending || 0), 0)
            summaryByLocation[locationId].currentStockPans = totalEnding
          }
        }
      }
      
      setLast7DaysSummaryByLocation(summaryByLocation)
    } catch (error) {
      console.error('Error calculating last 7 days summary:', error)
    }
  }, [reports, selectedLocation])

  useEffect(() => {
    if (!showLast7DaysSummary) {
      setLast7DaysSummaryByLocation({})
      return
    }
    calculateLast7DaysSummary()
  }, [showLast7DaysSummary, calculateLast7DaysSummary])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('locations')
        .select('id, name, brand_id, company_owned')
        .eq('brand_id', selectedBrand.id)
        .eq('company_owned', true)
        .order('name')
      if (cancelled) return
      const locs = (data || []) as Location[]
      setInventoryLocations(locs)
      const preferred =
        selectedLocation?.id ||
        lastReportLocationId ||
        locs[0]?.id ||
        ''
      setInventoryLocationId((prev) => {
        if (prev && locs.some((l) => l.id === prev)) return prev
        if (preferred && locs.some((l) => l.id === preferred)) return preferred
        return locs[0]?.id || ''
      })
    })()
    return () => {
      cancelled = true
    }
  }, [selectedBrand.id, selectedLocation?.id, lastReportLocationId])

  // Keep inventory tab on the same store as the report being viewed (company-owned only)
  useEffect(() => {
    if (!selectedReport?.location_id) return
    setLastReportLocationId(selectedReport.location_id)
    if (selectedReport.location?.company_owned) {
      setInventoryLocationId(selectedReport.location_id)
    }
  }, [selectedReport?.location_id, selectedReport?.location?.company_owned])

  const loadReports = async (page = 1, append = false) => {
    if (page === 1) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }
    
    try {
      // Build the main query with all filters
      let query = supabase
        .from('dsir_reports')
        .select(`
          *,
          location:locations!inner(*),
          staff_registration:staff_registrations!inner(*)
        `, { count: 'exact' })
        .eq('location.brand_id', selectedBrand.id)

      if (selectedLocation) {
        query = query.eq('location_id', selectedLocation.id)
      }

      // Apply filters
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }
      
      if (locationTypeFilter !== 'all') {
        if (locationTypeFilter === 'company') {
          query = query.eq('location.company_owned', true)
        } else {
          query = query.eq('location.company_owned', false)
        }
      }
      
      if (dateFilter) {
        query = query.eq('report_date', dateFilter)
      }

      // Apply search filter
      if (searchTerm) {
        query = query.or(`staff_name.ilike.%${searchTerm}%,location.name.ilike.%${searchTerm}%,staff_registration.full_name.ilike.%${searchTerm}%`)
      }

      // Apply pagination
      const { data, error, count } = await query
        .order('report_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range((page - 1) * reportsPerPage, page * reportsPerPage - 1)

      if (error) throw error

      // Set pagination info
      setTotalReports(count || 0)
      setTotalPages(Math.ceil((count || 0) / reportsPerPage))
      
      if (append) {
        setReports(prev => [...prev, ...(data || [])])
      } else {
        setReports(data || [])
      }
      
      // Check for inventory differences for loaded reports
      if (data && data.length > 0) {
        await checkInventoryDifferences(data)
      }
    } catch (error) {
      console.error('Error loading DSIR reports:', error)
      setError('Failed to load DSIR reports')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadMoreReports = () => {
    if (currentPage < totalPages && !loadingMore) {
      const nextPage = currentPage + 1
      setCurrentPage(nextPage)
      loadReports(nextPage, true)
    }
  }

  const checkInventoryDifferences = async (reports: DSIRReport[]) => {
    const differences: {[reportId: string]: boolean} = {}
    
    // Group reports by location and date for batch processing
    const reportsByLocation = reports.reduce((acc, report) => {
      if (!acc[report.location_id]) {
        acc[report.location_id] = []
      }
      acc[report.location_id].push(report)
      return acc
    }, {} as {[locationId: string]: DSIRReport[]})

    // Process each location's reports in batches
    for (const [locationId, locationReports] of Object.entries(reportsByLocation)) {
      try {
        // Get all unique dates for this location
        const uniqueDates = new Set(locationReports.map(r => r.report_date))
        const dates = Array.from(uniqueDates).sort()
        
        // Batch fetch all previous reports for this location
        const { data: previousReports } = await supabase
          .from('dsir_reports')
          .select('id, report_date, location_id')
          .eq('location_id', locationId)
          .eq('status', 'submitted')
          .in('report_date', dates.map(date => {
            const d = new Date(date)
            d.setDate(d.getDate() - 1)
            return d.toISOString().split('T')[0]
          }))
          .order('report_date', { ascending: false })

        // Create a map of previous reports by date
        const previousReportsMap = new Map()
        previousReports?.forEach(prev => {
          previousReportsMap.set(prev.report_date, prev.id)
        })

        // Get all report IDs we need to check
        const currentReportIds = locationReports.map(r => r.id)
        const previousReportIds = Array.from(previousReportsMap.values())

        if (previousReportIds.length === 0) {
          // No previous reports, mark all as no differences
          locationReports.forEach(report => {
            differences[report.id] = false
          })
          continue
        }

        // Batch fetch all inventory data in 3 queries instead of 6 per report
        const [allSalesData, allIceCreamData, allMaterialsData] = await Promise.all([
          supabase
            .from('dsir_sales_inventory')
            .select('dsir_report_id, item_name, beginning_inventory, ending_inventory')
            .in('dsir_report_id', [...currentReportIds, ...previousReportIds]),
          supabase
            .from('dsir_ice_cream_inventory')
            .select('dsir_report_id, flavor, beginning, ending')
            .in('dsir_report_id', [...currentReportIds, ...previousReportIds]),
          supabase
            .from('dsir_materials_inventory')
            .select('dsir_report_id, material_name, beginning, ending')
            .in('dsir_report_id', [...currentReportIds, ...previousReportIds])
        ])

        // Process each report for this location
        for (const report of locationReports) {
          const reportDate = new Date(report.report_date)
          const previousDay = new Date(reportDate)
          previousDay.setDate(previousDay.getDate() - 1)
          const previousDayStr = previousDay.toISOString().split('T')[0]
          
          const previousReportId = previousReportsMap.get(previousDayStr)
          
          if (!previousReportId) {
            differences[report.id] = false
            continue
          }

          // Filter data for current and previous reports
          const currentSales = allSalesData.data?.filter(item => item.dsir_report_id === report.id) || []
          const previousSales = allSalesData.data?.filter(item => item.dsir_report_id === previousReportId) || []
          const currentIceCream = allIceCreamData.data?.filter(item => item.dsir_report_id === report.id) || []
          const previousIceCream = allIceCreamData.data?.filter(item => item.dsir_report_id === previousReportId) || []
          const currentMaterials = allMaterialsData.data?.filter(item => item.dsir_report_id === report.id) || []
          const previousMaterials = allMaterialsData.data?.filter(item => item.dsir_report_id === previousReportId) || []

          // Check for differences
          let hasDifference = false

          // Check sales inventory differences
          for (const currentItem of currentSales) {
            const previousItem = previousSales.find(p => p.item_name === currentItem.item_name)
            const previousEnding = previousItem?.ending_inventory || 0
            const currentBeginning = currentItem.beginning_inventory || 0
            
            if (currentBeginning !== previousEnding) {
              hasDifference = true
              break
            }
          }

          // Check ice cream inventory differences
          if (!hasDifference) {
            for (const currentItem of currentIceCream) {
              const previousItem = previousIceCream.find(p => p.flavor === currentItem.flavor)
              const previousEnding = previousItem?.ending || 0
              const currentBeginning = currentItem.beginning || 0
              
              if (currentBeginning !== previousEnding) {
                hasDifference = true
                break
              }
            }
          }

          // Check materials inventory differences - DISABLED since DIFF column is hidden for materials
          // if (!hasDifference) {
          //   for (const currentItem of currentMaterials) {
          //     const previousItem = previousMaterials.find(p => p.material_name === currentItem.material_name)
          //     const previousEnding = previousItem?.ending || 0
          //     const currentBeginning = currentItem.beginning || 0
          //     
          //     if (currentBeginning !== previousEnding) {
          //       hasDifference = true
          //       break
          //     }
          //   }
          // }

          differences[report.id] = hasDifference
        }
      } catch (error) {
        console.error(`Error checking differences for location ${locationId}:`, error)
        // Mark all reports for this location as no differences on error
        locationReports.forEach(report => {
          differences[report.id] = false
        })
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

  // Create Report Functions
  const loadLocationsForCreate = async () => {
    setLoadingLocations(true)
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('brand_id', selectedBrand.id)
        .order('name')

      if (error) throw error
      setAvailableLocations(data || [])
    } catch (error) {
      console.error('Error loading locations:', error)
      setError('Failed to load locations')
    } finally {
      setLoadingLocations(false)
    }
  }

  const loadStaffForLocation = async (locationId: string) => {
    if (!locationId) {
      setAvailableStaff([])
      return
    }

    setLoadingStaff(true)
    try {
      // Get staff assigned to this location
      const { data: assignments, error: assignmentsError } = await supabase
        .from('staff_assignments')
        .select(`
          staff_registration:staff_registrations(*)
        `)
        .eq('location_id', locationId)

      if (assignmentsError) throw assignmentsError

      const staff = assignments?.map((a: any) => a.staff_registration).filter(Boolean) || []
      setAvailableStaff(staff as StaffRegistration[])
    } catch (error) {
      console.error('Error loading staff:', error)
      setError('Failed to load staff')
    } finally {
      setLoadingStaff(false)
    }
  }

  const handleCreateReport = async () => {
    if (!createReportDate || !createReportLocationId) {
      setError('Please select a date and location')
      return
    }

    if (!createReportStaffId) {
      setError('Please select a staff member')
      return
    }

    setCreatingReport(true)
    setError('')

    try {
      // Check if report already exists
      const { data: existingReport, error: checkError } = await supabase
        .from('dsir_reports')
        .select('id')
        .eq('location_id', createReportLocationId)
        .eq('staff_registration_id', createReportStaffId)
        .eq('report_date', createReportDate)
        .single()

      if (existingReport) {
        setError('A report already exists for this date, location, and staff combination')
        setCreatingReport(false)
        return
      }

      // Get staff name
      const selectedStaff = availableStaff.find(s => s.id === createReportStaffId)
      const staffName = selectedStaff?.full_name || 'Unknown'

      // Create the report
      const { data: newReport, error: createError } = await supabase
        .from('dsir_reports')
        .insert({
          location_id: createReportLocationId,
          staff_registration_id: createReportStaffId,
          report_date: createReportDate,
          staff_name: staffName,
          status: 'draft'
        })
        .select(`
          *,
          location:locations(*),
          staff_registration:staff_registrations(*)
        `)
        .single()

      if (createError) throw createError

      setSuccess('DSIR report created successfully!')
      setIsCreateReportModalOpen(false)
      
      // Reset form
      setCreateReportDate(new Date().toISOString().split('T')[0])
      setCreateReportLocationId('')
      setCreateReportStaffId('')
      
      // Reload reports
      await loadReports()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: any) {
      console.error('Error creating report:', error)
      setError(error.message || 'Failed to create DSIR report')
    } finally {
      setCreatingReport(false)
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
      setPredefinedItems((data || []).filter((item) => item.category !== 'ice_cream'))
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
        is_active: true,
        show_in_local: newItem.show_in_local,
        show_in_remote: newItem.show_in_remote
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
      setNewItem({ name: '', price: 0, category: '', show_in_local: true, show_in_remote: true })
      setSuccess('Item added successfully!')
    } catch (error) {
      console.error('Error adding predefined item:', error)
      setError('Failed to add item')
    } finally {
      setSavingItems(false)
    }
  }

  const updatePredefinedItem = async (id: string, name: string, price: number, category: string, show_in_local: boolean, show_in_remote: boolean) => {
    const confirmed = await requestAdminPassword({
      title: 'Save item changes',
      message: 'Enter admin password to save changes to this predefined item.',
      confirmLabel: 'Save',
    })
    if (!confirmed) return

    setSavingItems(true)
    try {
      const updateData: any = { 
        name: name.trim(), 
        category,
        show_in_local,
        show_in_remote
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
        item.id === id ? { ...item, name: name.trim(), price: category === 'sales' ? price : item.price, category, show_in_local, show_in_remote } : item
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
    const confirmed = await requestAdminPassword({
      title: 'Delete item',
      message: 'Are you sure you want to delete this item?\n\nEnter admin password to confirm.',
      confirmLabel: 'Delete',
    })
    if (!confirmed) return

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
      'materials': 'Materials Inventory',
      'denominations': 'Sales Reconciliation'
    }
    return categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1)
  }

  // Reports are already filtered server-side, so we can use them directly
  const filteredReports = reports

  // Memoized grouped reports calculation
  const groupedReports = useMemo(() => {
    return filteredReports.reduce((groups, report) => {
      const date = report.report_date
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(report)
      return groups
    }, {} as { [date: string]: DSIRReport[] })
  }, [filteredReports])

  // Memoized sorted dates calculation
  const sortedDates = useMemo(() => {
    return Object.keys(groupedReports).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  }, [groupedReports])

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (selectedReport) {
    const currentIndex = availableDates.indexOf(selectedReport.report_date)
    const hasPrevDate = currentIndex !== -1 && currentIndex < availableDates.length - 1
    const hasNextDate = currentIndex !== -1 && currentIndex > 0

    const currentIndexSecond = secondReport ? availableDatesSecond.indexOf(secondReport.report_date) : -1
    const hasPrevDateSecond = currentIndexSecond !== -1 && currentIndexSecond < availableDatesSecond.length - 1
    const hasNextDateSecond = currentIndexSecond !== -1 && currentIndexSecond > 0

    return (
      <div className={`space-y-4 ${splitViewEnabled ? 'max-w-full' : 'max-w-6xl'} mx-auto px-4 sm:px-6 lg:px-8`}>
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          {/* Back to Reports Button */}
          <button
            onClick={() => {
              setSelectedReport(null)
              setSecondReport(null)
              setSplitViewEnabled(false)
              setShowReportInventoryModal(false)
              loadReports()
            }}
            className="flex items-center justify-center sm:justify-start space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 w-full sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Reports</span>
          </button>

          {/* Report Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              DSIR Report{splitViewEnabled ? 's' : ''} - {selectedReport.location?.name || 'Unknown Location'}
            </h2>
            <p className="text-sm text-gray-600">
              {formatDate(selectedReport.report_date)} • {selectedReport.staff_name || 'Unknown Staff'}
              {availableDates.length > 0 && (
                <span className="ml-2 text-gray-400">
                  ({currentIndex + 1} of {availableDates.length})
                </span>
              )}
              {splitViewEnabled && secondReport && (
                <span className="ml-4">
                  | {formatDate(secondReport.report_date)} • {secondReport.staff_name || 'Unknown Staff'}
                  {availableDatesSecond.length > 0 && (
                    <span className="ml-2 text-gray-400">
                      ({currentIndexSecond + 1} of {availableDatesSecond.length})
                    </span>
                  )}
                </span>
              )}
            </p>
          </div>

          {/* Store inventory for this DSIR date */}
          <button
            type="button"
            onClick={() => setShowReportInventoryModal(true)}
            className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 flex-shrink-0"
            title="Store inventory for this date"
          >
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">Inventory</span>
          </button>

          {/* Split View Toggle */}
          <button
            onClick={() => setSplitViewEnabled(!splitViewEnabled)}
            className={`flex items-center space-x-2 px-3 py-2 border rounded-md flex-shrink-0 ${
              splitViewEnabled 
                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' 
                : 'text-gray-600 hover:text-gray-800 border-gray-300 hover:bg-gray-50'
            }`}
            title="Toggle Split View"
          >
            <Columns className="h-4 w-4" />
          </button>

          {/* Navigation Buttons - Hidden in split view */}
          {!splitViewEnabled && (
            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                onClick={() => navigateToDate('prev')}
                disabled={!hasPrevDate || loadingNavigation}
                className="flex items-center justify-center px-3 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous Date"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigateToDate('next')}
                disabled={!hasNextDate || loadingNavigation}
                className="flex items-center justify-center px-3 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next Date"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        
        {splitViewEnabled ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* First Report */}
            <div className="border border-gray-300 rounded-lg p-4 bg-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-semibold text-gray-900">
                  {formatDate(selectedReport.report_date)}
                </h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => navigateToDate('prev')}
                    disabled={!hasPrevDate || loadingNavigation}
                    className="flex items-center justify-center px-2 py-1 text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Previous Date"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => navigateToDate('next')}
                    disabled={!hasNextDate || loadingNavigation}
                    className="flex items-center justify-center px-2 py-1 text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Next Date"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <DSIRViewer 
                report={selectedReport} 
                showEditButton={!dsirViewerReadOnly}
                forceReadOnly={dsirViewerReadOnly}
                showDiscrepancyColumns={true}
                showSalesDiscrepancyColumns={true}
                showIceCreamDiscrepancyColumns={true}
                showMaterialsDiscrepancyColumns={false}
              />
            </div>

            {/* Second Report */}
            {secondReport ? (
              <div className="border border-gray-300 rounded-lg p-4 bg-white">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-semibold text-gray-900">
                    {formatDate(secondReport.report_date)}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => navigateToDateSecond('prev')}
                      disabled={!hasPrevDateSecond || loadingNavigationSecond}
                      className="flex items-center justify-center px-2 py-1 text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Previous Date"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => navigateToDateSecond('next')}
                      disabled={!hasNextDateSecond || loadingNavigationSecond}
                      className="flex items-center justify-center px-2 py-1 text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Next Date"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <DSIRViewer 
                  report={secondReport} 
                  showEditButton={!dsirViewerReadOnly}
                  forceReadOnly={dsirViewerReadOnly}
                  showDiscrepancyColumns={true}
                  showSalesDiscrepancyColumns={true}
                  showIceCreamDiscrepancyColumns={true}
                  showMaterialsDiscrepancyColumns={false}
                />
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Columns className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No second report available</p>
                  <p className="text-sm">Select another report to compare</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <DSIRViewer 
            report={selectedReport} 
            showEditButton={!dsirViewerReadOnly}
            forceReadOnly={dsirViewerReadOnly}
            showDiscrepancyColumns={true}
            showSalesDiscrepancyColumns={true}
            showIceCreamDiscrepancyColumns={true}
            showMaterialsDiscrepancyColumns={false}
          />
        )}

        {showReportInventoryModal && (
          <Modal onClose={() => setShowReportInventoryModal(false)} align="center">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-3 shrink-0">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Package className="h-5 w-5 text-gray-600" />
                    Store inventory
                  </h3>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {selectedReport.location?.name || 'Store'} · {formatDate(selectedReport.report_date)}
                    {selectedReport.staff_name ? ` · ${selectedReport.staff_name}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReportInventoryModal(false)}
                  className="p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4 sm:p-5 overflow-y-auto min-h-0 flex-1">
                <DSIRStoreInventoryPanel
                  mode="admin"
                  embedded
                  locationId={selectedReport.location_id}
                  reportDate={selectedReport.report_date}
                  dsirReportId={selectedReport.id}
                  reportStatus={selectedReport.status}
                  allowSeedFromDsir={!dsirViewerReadOnly}
                  adjustedByName="Dashboard admin"
                />
              </div>
            </div>
          </Modal>
        )}
      </div>
    )
  }

  // Skeleton loading component
  const SkeletonRow = () => (
    <tr className="animate-pulse">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 bg-gray-200 rounded w-20"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 bg-gray-200 rounded w-32"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 bg-gray-200 rounded w-24"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-6 bg-gray-200 rounded-full w-16"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 bg-gray-200 rounded w-20"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 bg-gray-200 rounded w-24"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 bg-gray-200 rounded w-28"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="flex space-x-2 justify-end">
          <div className="h-8 w-8 bg-gray-200 rounded"></div>
          <div className="h-8 w-8 bg-gray-200 rounded"></div>
          {showDeleteReportButton && <div className="h-8 w-8 bg-gray-200 rounded"></div>}
        </div>
      </td>
    </tr>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-32 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-64"></div>
          </div>
          <div className="flex space-x-3">
            <div className="h-10 bg-gray-200 rounded w-24"></div>
            <div className="h-10 bg-gray-200 rounded w-20"></div>
          </div>
        </div>

        {/* Last 7 Days Summary Skeleton */}
        {showLast7DaysSummary && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-48 mb-3"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="space-y-1">
                    {[...Array(5)].map((_, j) => (
                      <div key={j} className="flex justify-between">
                        <div className="h-3 bg-gray-200 rounded w-20"></div>
                        <div className="h-3 bg-gray-200 rounded w-16"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* Filters Skeleton */}
        <div className="flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4 lg:items-center">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            <div className="h-10 bg-gray-200 rounded w-80"></div>
            <div className="h-10 bg-gray-200 rounded w-32"></div>
            <div className="h-10 bg-gray-200 rounded w-24"></div>
          </div>
          <div className="flex items-center space-x-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-1">
                <div className="h-4 w-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-12"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[...Array(8)].map((_, i) => (
                    <th key={i} className="px-6 py-3 text-left">
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">DSIR</h1>
          <p className="text-sm text-gray-600">
            {selectedLocation 
              ? `${selectedBrand.name} at ${selectedLocation.name}`
              : `${selectedBrand.name} — all locations`
            }
          </p>
        </div>
        {mainTab === 'reports' ? (
        <div className="flex space-x-3">
          <button
            onClick={() => {
              setIsCreateReportModalOpen(true)
              loadLocationsForCreate()
            }}
            className="flex items-center space-x-2 px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-md"
          >
            <Plus className="h-4 w-4" />
            <span>Create DSIR</span>
          </button>
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
            onClick={() => loadReports()}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
        ) : null}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setMainTab('reports')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            mainTab === 'reports'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
        >
          Reports
        </button>
        <button
          type="button"
          onClick={() => setMainTab('inventory')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            mainTab === 'inventory'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
        >
          <Package className="h-4 w-4" />
          Inventory
        </button>
      </div>

      {mainTab === 'inventory' ? (
        <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-5">
          {inventoryLocationId ? (
            <DSIRStoreInventoryPanel
              key={`inv-${inventoryLocationId}-${mainTab}`}
              mode="admin"
              locationId={inventoryLocationId}
              locations={inventoryLocations.map((l) => ({ id: l.id, name: l.name }))}
              onLocationChange={setInventoryLocationId}
              allowCycleCount={!dsirViewerReadOnly}
              adjustedByName="Dashboard admin"
            />
          ) : (
            <p className="text-sm text-gray-500">No locations found for this brand.</p>
          )}
        </div>
      ) : (
      <>
      {/* Last 7 Days Summary */}
      {showLast7DaysSummary && (
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-4">
            <h2 className="text-base font-semibold text-gray-900">Branch Last 7 Days Summary</h2>
            <div className="text-sm text-gray-600">
              Total Net Sales: <span className="font-semibold text-green-600">
                ₱{Object.values(last7DaysSummaryByLocation)
                  .reduce((total, summary) => total + summary.netSales, 0)
                  .toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Object.entries(last7DaysSummaryByLocation)
            .sort(([, a], [, b]) => b.netSales - a.netSales)
            .map(([locationId, summary]) => (
            <div key={locationId} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-700 truncate">{summary.locationName}</div>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                  {summary.reportCount} report{summary.reportCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Total Gross Sales:</span>
                  <span className="text-sm font-semibold text-blue-600">
                    ₱{summary.totalGrossSales.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Total Discounts:</span>
                  <span className="text-sm font-semibold text-orange-600">
                    ₱{summary.totalDiscounts.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Total Expenses:</span>
                  <span className="text-sm font-semibold text-red-600">
                    ₱{summary.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Store stock pans:</span>
                  <span className="text-sm font-semibold text-gray-700">{summary.currentStockPans.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center border-t border-gray-300 pt-1">
                  <span className="text-xs text-gray-600 font-semibold">Net Sales:</span>
                  <span className="text-sm font-bold text-green-600">
                    ₱{summary.netSales.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {Object.keys(last7DaysSummaryByLocation).length === 0 && (
          <div className="text-center py-4 text-sm text-gray-500">
            No data available for the last 7 days
          </div>
        )}
      </div>
      )}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4 lg:items-center">
        {/* Left side filters */}
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
          {/* Search Input */}
          <div className="w-80 flex-shrink-0">
            <input
              type="text"
              placeholder="Search by staff name or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Date Filter */}
          <div className="flex-shrink-0">
            <input
              type="date"
              placeholder="Filter by date..."
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-10 px-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Status Filter */}
          <div className="flex-shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'draft' | 'submitted' | 'reviewed')}
              className="h-10 px-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </div>
        </div>
        
        {/* Location Type Radio Buttons - Pinned to right */}
        <div className="flex items-center space-x-3 flex-shrink-0">
            <div className="flex items-center space-x-1">
              <input
                type="radio"
                id="all-locations"
                name="locationType"
                value="all"
                checked={locationTypeFilter === 'all'}
                onChange={(e) => setLocationTypeFilter(e.target.value as 'all' | 'company' | 'franchise')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <label htmlFor="all-locations" className="text-sm text-gray-700">All</label>
            </div>
            <div className="flex items-center space-x-1">
              <input
                type="radio"
                id="company-owned"
                name="locationType"
                value="company"
                checked={locationTypeFilter === 'company'}
                onChange={(e) => setLocationTypeFilter(e.target.value as 'all' | 'company' | 'franchise')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <label htmlFor="company-owned" className="text-sm text-gray-700">Company</label>
            </div>
            <div className="flex items-center space-x-1">
              <input
                type="radio"
                id="franchise"
                name="locationType"
                value="franchise"
                checked={locationTypeFilter === 'franchise'}
                onChange={(e) => setLocationTypeFilter(e.target.value as 'all' | 'company' | 'franchise')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <label htmlFor="franchise" className="text-sm text-gray-700">Franchise</label>
            </div>
        </div>
      </div>

      {/* Pagination Info */}
      {!loading && totalReports > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
          <div>
            Showing {filteredReports.length} of {totalReports} reports
            {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
          </div>
          {currentPage < totalPages && (
            <button
              onClick={loadMoreReports}
              disabled={loadingMore}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMore ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <span>Load More</span>
                  <span className="text-xs">({totalReports - filteredReports.length} remaining)</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Updated
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedDates.map((date) => (
                    <React.Fragment key={date}>
                      {/* Date Group Header */}
                      <tr className="bg-gray-100">
                        <td colSpan={8} className="px-6 py-3 text-sm font-semibold text-gray-700">
                          {formatDate(date)} ({groupedReports[date].length} report{groupedReports[date].length !== 1 ? 's' : ''})
                        </td>
                      </tr>
                      {/* Reports for this date */}
                      {groupedReports[date].map((report) => (
                        <tr key={report.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center">
                              {inventoryDifferences[report.id] && (
                                <div className="mr-2 w-2 h-2 bg-red-500 rounded-full" title="Inventory differences detected"></div>
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDateTime(report.updated_at)}
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
                              {showDeleteReportButton && (
                              <button
                                onClick={() => deleteReport(report.id)}
                                disabled={deleting === report.id}
                                className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={deleting === report.id ? 'Deleting...' : 'Delete Report'}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {sortedDates.map((date) => (
              <div key={date} className="space-y-3">
                {/* Date Group Header */}
                <div className="bg-gray-100 rounded-lg p-3">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {formatDate(date)} ({groupedReports[date].length} report{groupedReports[date].length !== 1 ? 's' : ''})
                  </h3>
                </div>
                
                {/* Reports for this date */}
                <div className="space-y-3">
                  {groupedReports[date].map((report) => (
                    <div key={report.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center mb-2">
                            {inventoryDifferences[report.id] && (
                              <div className="mr-2 w-2 h-2 bg-red-500 rounded-full" title="Inventory differences detected"></div>
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
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm text-gray-600">Last Updated:</div>
                            <div className="text-sm text-gray-500">
                              {formatDateTime(report.updated_at)}
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
                          {showDeleteReportButton && (
                          <button
                            onClick={() => deleteReport(report.id)}
                            disabled={deleting === report.id}
                            className="flex items-center justify-center px-4 py-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md border border-red-200"
                            title={deleting === report.id ? 'Deleting...' : 'Delete Report'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
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
      </>
      )}

      {/* Edit Items Modal */}
      {isEditItemsModalOpen && (
        <Modal
          onClose={() => {
            setIsEditItemsModalOpen(false)
            setNewItem({ name: '', price: 0, category: '', show_in_local: true, show_in_remote: true })
            setEditingItemId(null)
          }}
          align="center"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit Predefined Items</h3>
              <button
                onClick={() => {
                  setIsEditItemsModalOpen(false)
                  setNewItem({ name: '', price: 0, category: '', show_in_local: true, show_in_remote: true })
                  setEditingItemId(null)
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
                
                {/* Visibility Checkboxes */}
                <div className="mt-4 flex items-center space-x-6">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newItem.show_in_local}
                      onChange={(e) => setNewItem({ ...newItem, show_in_local: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Show in Local DSIR</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newItem.show_in_remote}
                      onChange={(e) => setNewItem({ ...newItem, show_in_remote: e.target.checked })}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Show in Remote DSIR</span>
                  </label>
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
                            {(items as any[]).length} item{(items as any[]).length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {(items as any[]).map((item) => (
                            <EditableItemRow
                              key={item.id}
                              item={item}
                              onUpdate={updatePredefinedItem}
                              onDelete={deletePredefinedItem}
                              saving={savingItems}
                              editingItemId={editingItemId}
                              setEditingItemId={setEditingItemId}
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
                  setNewItem({ name: '', price: 0, category: '', show_in_local: true, show_in_remote: true })
                  setEditingItemId(null)
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create DSIR Report Modal */}
      {isCreateReportModalOpen && (
        <Modal backdropClassName="bg-black/50">
          <div className="mx-auto p-5 border w-11/12 md:w-1/2 lg:w-1/3 max-w-md shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Create DSIR</h3>
              <button
                onClick={() => {
                  setIsCreateReportModalOpen(false)
                  setCreateReportDate(new Date().toISOString().split('T')[0])
                  setCreateReportLocationId('')
                  setCreateReportStaffId('')
                  setError('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3">
                <p className="text-green-800 text-sm">{success}</p>
              </div>
            )}

            <div className="space-y-4">
              {/* Date Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Report Date *
                </label>
                <input
                  type="date"
                  value={createReportDate}
                  onChange={(e) => setCreateReportDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              {/* Location Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch/Location *
                </label>
                {loadingLocations ? (
                  <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                    <span className="text-sm text-gray-500">Loading locations...</span>
                  </div>
                ) : (
                  <select
                    value={createReportLocationId}
                    onChange={(e) => setCreateReportLocationId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a location</option>
                    {availableLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Staff Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Staff *
                </label>
                {loadingStaff ? (
                  <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                    <span className="text-sm text-gray-500">Loading staff...</span>
                  </div>
                ) : (
                  <select
                    value={createReportStaffId}
                    onChange={(e) => setCreateReportStaffId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    disabled={!createReportLocationId}
                    required
                  >
                    <option value="">Select a staff member</option>
                    {availableStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.full_name} ({staff.staff_code})
                      </option>
                    ))}
                  </select>
                )}
                {createReportLocationId && availableStaff.length === 0 && !loadingStaff && (
                  <p className="mt-1 text-sm text-gray-500">No staff assigned to this location</p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsCreateReportModalOpen(false)
                  setCreateReportDate(new Date().toISOString().split('T')[0])
                  setCreateReportLocationId('')
                  setCreateReportStaffId('')
                  setError('')
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                disabled={creatingReport}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateReport}
                disabled={creatingReport}
                className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingReport ? 'Creating...' : 'Create Report'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {AdminPasswordModal}
    </div>
  )
}

// Editable Item Row Component
function EditableItemRow({ item, onUpdate, onDelete, saving, editingItemId, setEditingItemId }: { 
  item: any, 
  onUpdate: (id: string, name: string, price: number, category: string, show_in_local: boolean, show_in_remote: boolean) => void, 
  onDelete: (id: string) => void,
  saving: boolean,
  editingItemId: string | null,
  setEditingItemId: (id: string | null) => void
}) {
  const isEditing = editingItemId === item.id
  const [editName, setEditName] = useState(item.name)
  const [editPrice, setEditPrice] = useState(item.price)
  const [editCategory, setEditCategory] = useState(item.category)
  const [editShowInLocal, setEditShowInLocal] = useState(item.show_in_local ?? true)
  const [editShowInRemote, setEditShowInRemote] = useState(item.show_in_remote ?? true)

  const handleSave = () => {
    if (editName.trim() && editCategory) {
      if (editCategory === 'sales' && editPrice <= 0) {
        return // Don't save if sales category but no valid price
      }
      onUpdate(item.id, editName, editPrice, editCategory, editShowInLocal, editShowInRemote)
      setEditingItemId(null)
    }
  }

  const handleCancel = () => {
    setEditName(item.name)
    setEditPrice(item.price)
    setEditCategory(item.category)
    setEditShowInLocal(item.show_in_local ?? true)
    setEditShowInRemote(item.show_in_remote ?? true)
    setEditingItemId(null)
  }

  const handleEdit = () => {
    setEditingItemId(item.id)
  }

  const getCategoryDisplayName = (category: string) => {
    const categoryNames: { [key: string]: string } = {
      'sales': 'Sales Inventory',
      'materials': 'Materials Inventory',
      'denominations': 'Sales Reconciliation'
    }
    return categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1)
  }

  return (
    <div className="p-3 bg-white border border-gray-200 rounded-lg">
      {isEditing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="sales">Sales Inventory</option>
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
          
          {/* Visibility Checkboxes */}
          <div className="flex items-center space-x-6">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={editShowInLocal}
                onChange={(e) => setEditShowInLocal(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Show in Local DSIR</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={editShowInRemote}
                onChange={(e) => setEditShowInRemote(e.target.checked)}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Show in Remote DSIR</span>
            </label>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
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
                onClick={handleEdit}
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
          
          {/* Visibility Status */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${item.show_in_local ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
              <span className="text-xs text-gray-600">Local DSIR</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${item.show_in_remote ? 'bg-purple-500' : 'bg-gray-300'}`}></div>
              <span className="text-xs text-gray-600">Remote DSIR</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
