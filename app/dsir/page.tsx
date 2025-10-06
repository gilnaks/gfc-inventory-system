'use client'
import { useState, useEffect } from 'react'
import { supabase, Brand } from '../../lib/supabase'
import { DSIRForm } from '../components/DSIRForm'
import { DSIRViewer } from '../components/DSIRViewer'
import { FileText, Lock, User, Phone, Building2, AlertCircle, UserPlus, LogIn, ShoppingCart } from 'lucide-react'

interface Location {
  id: string
  name: string
  passkey: string
  franchisee?: string
  company_owned?: boolean
  brand_id?: string
  brand?: Brand
}

interface StaffRegistration {
  id: string
  full_name: string
  mobile_number: string
  staff_code: string
  is_active: boolean
  created_at: string
  updated_at: string
  staff_assignments?: StaffAssignment[]
}

interface StaffAssignment {
  id: string
  staff_registration_id: string
  location_id: string
  assigned_by_location_id: string
  location: Location
}

interface StaffSchedule {
  id: string
  location_id: string
  staff_registration_id: string
  schedule_date: string
  location?: Location
}

interface DSIRReport {
  id: string
  location_id: string
  staff_registration_id: string
  staff_code_id?: string // For compatibility with DSIRForm
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

type ViewMode = 'register' | 'login' | 'form' | 'view' | 'viewer' | 'dsir_choice' | 'schedule_view'

export default function DSIRPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('login')
  const [staffInfo, setStaffInfo] = useState<StaffRegistration | null>(null)
  const [assignedLocations, setAssignedLocations] = useState<Location[]>([])
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [currentReport, setCurrentReport] = useState<DSIRReport | null>(null)
  const [staffSchedules, setStaffSchedules] = useState<StaffSchedule[]>([])
  const [scheduledLocations, setScheduledLocations] = useState<Location[]>([])
  const [todayDSIR, setTodayDSIR] = useState<DSIRReport | null>(null)
  const [hasSubmittedDSIR, setHasSubmittedDSIR] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [loadingAssignments, setLoadingAssignments] = useState(false)

  // Registration form
  const [registrationForm, setRegistrationForm] = useState({
    full_name: '',
    mobile_number: '',
    staff_code: ''
  })

  // Login form
  const [loginForm, setLoginForm] = useState({
    staff_code: ''
  })

  useEffect(() => {
    checkExistingSession()
  }, [])

  // Save current report to localStorage whenever it changes
  useEffect(() => {
    saveCurrentReport(currentReport)
  }, [currentReport])

  // Real-time subscription for DSIR report changes
  useEffect(() => {
    if (!staffInfo) return

    const channel = supabase
      .channel('dsir-reports-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dsir_reports'
        },
        (payload) => {
          console.log('DSIR report realtime update:', payload)
          
          // Check if this affects today's DSIR for the current location
          if (payload.new && typeof payload.new === 'object' && 'location_id' in payload.new && 'report_date' in payload.new) {
            if (payload.new.location_id === selectedLocation?.id) {
              const today = new Date().toISOString().split('T')[0]
              const reportDate = payload.new.report_date
              
              if (reportDate === today) {
                // This is today's DSIR for this location, update the state
                if (payload.eventType === 'UPDATE') {
                  setTodayDSIR(payload.new as DSIRReport)
                  // If the report was reverted to draft, also update currentReport if it's the same
                  if (currentReport && currentReport.id === payload.new.id) {
                    setCurrentReport(payload.new as DSIRReport)
                  }
                } else if (payload.eventType === 'DELETE') {
                  setTodayDSIR(null)
                }
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [staffInfo, currentReport])

  const checkExistingSession = async () => {
    // Prevent multiple calls
    if (sessionChecked) {
      console.log('Session already checked, skipping')
      return
    }
    
    setSessionChecked(true)
    setInitialLoading(true)
    
    // Check for existing session
    const savedAuth = localStorage.getItem('dsir_authenticated')
    const savedStaffInfo = localStorage.getItem('dsir_staff_info')
    const savedLocation = localStorage.getItem('dsir_selected_location')
    const savedReport = localStorage.getItem('dsir_current_report')
    
    console.log('checkExistingSession called:', { savedAuth, savedStaffInfo: !!savedStaffInfo, savedLocation: !!savedLocation, savedReport: !!savedReport })
    
    if (savedAuth === 'true' && savedStaffInfo) {
      try {
        const staffData = JSON.parse(savedStaffInfo)
        setStaffInfo(staffData)
        setLoadingAssignments(true)
        
        // Load assigned locations and schedules for this staff
        await Promise.all([
          loadStaffAssignments(staffData.id),
          loadStaffSchedules(staffData.id)
        ])
        
        setLoadingAssignments(false)
        
        // Restore selected location if valid
        if (savedLocation) {
          const locationData = JSON.parse(savedLocation)
          setSelectedLocation(locationData)
        }
        
        // Always go to schedule view after session restoration
        setViewMode('schedule_view')
      } catch (error) {
        console.error('Error parsing saved session:', error)
        clearSession()
      }
    }
    
    setTimeout(() => {
      setInitialLoading(false)
    }, 800)
  }

  const loadStaffAssignments = async (staffRegistrationId: string) => {
    try {
      const { data, error } = await supabase
        .from('staff_assignments')
        .select(`
          *,
          location:locations!staff_assignments_location_id_fkey(
            *,
            brand:brands(*)
          )
        `)
        .eq('staff_registration_id', staffRegistrationId)

      if (error) throw error

      const locations = (data?.map(item => item.location).filter(Boolean) || []) as unknown as Location[]
      setAssignedLocations(locations)
    } catch (error) {
      console.error('Error loading staff assignments:', error)
      setError('Failed to load staff assignments')
    }
  }

  const loadStaffSchedules = async (staffRegistrationId: string) => {
    try {
      const today = new Date()
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay()) // Start of week (Sunday)
      
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6) // End of week (Saturday)

      const { data, error } = await supabase
        .from('staff_schedules')
        .select(`
          *,
          location:locations(
            *,
            brand:brands(*)
          )
        `)
        .eq('staff_registration_id', staffRegistrationId)
        .gte('schedule_date', weekStart.toISOString().split('T')[0])
        .lte('schedule_date', weekEnd.toISOString().split('T')[0])

      if (error) throw error

      setStaffSchedules(data || [])
      
      // Get unique locations where staff is scheduled
      const locations = (data || [])
        .map(schedule => schedule.location)
        .filter((location, index, self) => 
          location && self.findIndex(l => l?.id === location.id) === index
        ) as Location[]
      
      setScheduledLocations(locations)
    } catch (error) {
      console.error('Error loading staff schedules:', error)
      setError('Failed to load staff schedules')
    }
  }

  const generateStaffCode = () => {
    // Generate a random 8-digit code
    const code = Math.floor(10000000 + Math.random() * 90000000).toString()
    setRegistrationForm({ ...registrationForm, staff_code: code })
  }

  const registerStaff = async () => {
    if (!registrationForm.full_name.trim() || !registrationForm.mobile_number.trim() || !registrationForm.staff_code.trim()) {
      setError('Please fill in all fields')
      return
    }

    if (registrationForm.staff_code.length !== 8) {
      setError('Staff code must be 8 digits')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('staff_registrations')
        .insert({
          full_name: registrationForm.full_name.trim(),
          mobile_number: registrationForm.mobile_number.trim(),
          staff_code: registrationForm.staff_code
        })
        .select()
        .single()

      if (error) throw error

      setSuccess('Registration successful! Your 8-digit code is: ' + registrationForm.staff_code)
      setRegistrationForm({ full_name: '', mobile_number: '', staff_code: '' })
      
      // Switch to login view
      setTimeout(() => {
        setViewMode('login')
        setSuccess('')
      }, 3000)
    } catch (error) {
      console.error('Registration error:', error)
      setError('Registration failed. Staff code may already exist.')
    } finally {
      setLoading(false)
    }
  }

  const loginStaff = async () => {
    if (!loginForm.staff_code.trim()) {
      setError('Please enter your 8-digit staff code')
      return
    }

    if (loginForm.staff_code.length !== 8) {
      setError('Staff code must be 8 digits')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('staff_registrations')
        .select(`
          *,
          staff_assignments(
            *,
            location:locations!staff_assignments_location_id_fkey(
              *,
              brand:brands(*)
            )
          )
        `)
        .eq('staff_code', loginForm.staff_code)
        .eq('is_active', true)
        .single()

      if (error) throw error

      if (data) {
        setStaffInfo(data)
        setLoadingAssignments(true)
        
        // Save session
        localStorage.setItem('dsir_authenticated', 'true')
        localStorage.setItem('dsir_staff_info', JSON.stringify(data))
        
        // Load assigned locations and schedules
        await Promise.all([
          loadStaffAssignments(data.id),
          loadStaffSchedules(data.id)
        ])
        
        setLoadingAssignments(false)
        
        // Always show schedule view first after login
        setViewMode('schedule_view')
        
        // Mark session as checked to prevent interference from checkExistingSession
        setSessionChecked(true)
        
        setSuccess('Login successful!')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError('Invalid staff code')
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('Invalid staff code')
    } finally {
      setLoading(false)
    }
  }

  const selectLocation = async (location: Location) => {
    setSelectedLocation(location)
    localStorage.setItem('dsir_selected_location', JSON.stringify(location))
    
    // Check if there's already a DSIR for today
    await checkTodayDSIR(location)
    
    setViewMode('dsir_choice')
  }

  const checkTodayDSIR = async (location: Location) => {
    if (!staffInfo) return

    const today = new Date().toISOString().split('T')[0]
    
    try {
      // Check for today's DSIR (shared by all staff at this location)
      const { data, error } = await supabase
        .from('dsir_reports')
        .select(`
          *,
          location:locations(
            *,
            brand:brands(*)
          ),
          staff_registration:staff_registrations(*)
        `)
        .eq('location_id', location.id)
        .eq('report_date', today)
        .single()

      if (data && !error) {
        setTodayDSIR(data)
      } else {
        setTodayDSIR(null)
      }

      // Check for any submitted DSIRs at this location (excluding today's DSIR)
      const { data: submittedData, error: submittedError } = await supabase
        .from('dsir_reports')
        .select('id')
        .eq('location_id', location.id)
        .eq('status', 'submitted')
        .neq('report_date', today) // Exclude today's DSIR
        .limit(1)

      if (submittedData && submittedData.length > 0) {
        setHasSubmittedDSIR(true)
      } else {
        setHasSubmittedDSIR(false)
      }
    } catch (error) {
      // No DSIR for today
      setTodayDSIR(null)
      setHasSubmittedDSIR(false)
    }
  }

  const getWeekDates = () => {
    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay()) // Start of week (Sunday)
    
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    })
  }

  const formatDay = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      day: 'numeric' 
    })
  }

  const formatDayName = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short' 
    }).toUpperCase()
  }

  const getScheduleForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return staffSchedules.filter(schedule => schedule.schedule_date === dateStr)
  }

  const isLocationScheduledToday = (location: Location) => {
    const today = new Date().toISOString().split('T')[0]
    return staffSchedules.some(schedule => 
      schedule.location_id === location.id && 
      schedule.schedule_date === today
    )
  }

  const getBrandColor = (brandName: string | undefined) => {
    if (!brandName) return 'gray'
    
    const brand = brandName.toLowerCase()
    if (brand.includes('mychoice')) return 'green'
    if (brand.includes('gelato')) return 'red'
    if (brand.includes('sorbetes')) return 'yellow'
    return 'gray'
  }

  const getBrandButtonColors = (brandName: string | undefined) => {
    const color = getBrandColor(brandName)
    
    switch (color) {
      case 'green':
        return {
          border: 'border-green-500',
          bg: 'bg-green-50',
          hover: 'hover:bg-green-100 hover:border-green-600',
          icon: 'text-green-600',
          title: 'text-green-900',
          subtitle: 'text-green-700',
          status: 'text-green-600'
        }
      case 'red':
        return {
          border: 'border-red-300',
          bg: 'bg-red-50',
          hover: 'hover:bg-red-100 hover:border-red-400',
          icon: 'text-red-600',
          title: 'text-red-900',
          subtitle: 'text-red-700',
          status: 'text-red-600'
        }
      case 'yellow':
        return {
          border: 'border-yellow-300',
          bg: 'bg-yellow-50',
          hover: 'hover:bg-yellow-100 hover:border-yellow-400',
          icon: 'text-yellow-600',
          title: 'text-yellow-900',
          subtitle: 'text-yellow-700',
          status: 'text-yellow-600'
        }
      default:
        return {
          border: 'border-gray-300',
          bg: 'bg-gray-50',
          hover: 'hover:bg-gray-100 hover:border-gray-400',
          icon: 'text-gray-600',
          title: 'text-gray-900',
          subtitle: 'text-gray-700',
          status: 'text-gray-600'
        }
    }
  }

  const getBrandHeaderColors = (brandName: string | undefined) => {
    const color = getBrandColor(brandName)
    
    switch (color) {
      case 'green':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'red':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'yellow':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const checkExistingReport = async () => {
    if (!selectedLocation || !staffInfo) return

    const today = new Date().toISOString().split('T')[0]
    
    try {
      const { data, error } = await supabase
        .from('dsir_reports')
        .select(`
          *,
          location:locations(
            *,
            brand:brands(*)
          ),
          staff_registration:staff_registrations(*)
        `)
        .eq('location_id', selectedLocation.id)
        .eq('report_date', today)
        .single()

      if (data) {
        setCurrentReport(data)
        saveCurrentReport(data)
        setViewMode('viewer')
      } else {
        // No existing report for today, create new one
        await createNewReport()
      }
    } catch (error) {
      // No existing report, create new one
      await createNewReport()
    }
  }

  const createNewReport = async () => {
    if (!selectedLocation || !staffInfo) return

    const today = new Date().toISOString().split('T')[0]
    
    try {
      const { data, error } = await supabase
        .from('dsir_reports')
        .insert({
          location_id: selectedLocation.id,
          staff_registration_id: staffInfo.id,
          report_date: today,
          staff_name: staffInfo.full_name,
          status: 'draft'
        })
        .select(`
          *,
          location:locations(
            *,
            brand:brands(*)
          ),
          staff_registration:staff_registrations(*)
        `)
        .single()

      if (error) throw error

      setCurrentReport(data)
      setTodayDSIR(data)
      saveCurrentReport(data)
      setViewMode('viewer')
    } catch (error) {
      console.error('Error creating report:', error)
      setError('Failed to create new report')
    }
  }

  const handleCreateNewDSIR = async () => {
    await checkExistingReport()
  }

  const handleViewRecentDSIR = async () => {
    // Load the most recent submitted DSIR by this staff member for this location (excluding today's DSIR)
    if (!selectedLocation || !staffInfo) return

    const today = new Date().toISOString().split('T')[0]

    try {
      const { data, error } = await supabase
        .from('dsir_reports')
        .select(`
          *,
          location:locations(
            *,
            brand:brands(*)
          ),
          staff_registration:staff_registrations(*)
        `)
        .eq('location_id', selectedLocation.id)
        .eq('status', 'submitted')
        .neq('report_date', today) // Exclude today's DSIR
        .order('report_date', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        setCurrentReport(data)
        saveCurrentReport(data)
        setViewMode('viewer')
      } else {
        setError('No recent submitted DSIR found from previous days')
      }
    } catch (error) {
      console.error('Error loading recent DSIR:', error)
      setError('No recent submitted DSIR found from previous days')
    }
  }

  const handleOrderRedirect = () => {
    if (!selectedLocation) return
    
    // Store the location passcode in sessionStorage for automatic login
    sessionStorage.setItem('locationPasscode', selectedLocation.passkey)
    sessionStorage.setItem('selectedLocationId', selectedLocation.id)
    
    // Redirect to order page
    window.location.href = '/order'
  }

  const logout = () => {
    clearSession()
  }

  const clearSession = () => {
    setStaffInfo(null)
    setAssignedLocations([])
    setSelectedLocation(null)
    setCurrentReport(null)
    setTodayDSIR(null)
    setHasSubmittedDSIR(false)
    setError('')
    setSuccess('')
    setViewMode('login')
    setSessionChecked(false) // Reset session check flag
    setLoadingAssignments(false) // Reset loading assignments flag
    
    // Clear localStorage
    localStorage.removeItem('dsir_authenticated')
    localStorage.removeItem('dsir_staff_info')
    localStorage.removeItem('dsir_selected_location')
    localStorage.removeItem('dsir_current_report')
  }

  const saveCurrentReport = (report: DSIRReport | null) => {
    if (report) {
      localStorage.setItem('dsir_current_report', JSON.stringify(report))
    } else {
      localStorage.removeItem('dsir_current_report')
    }
  }

  const handleReportUpdate = (updatedReport: DSIRReport) => {
    setCurrentReport(updatedReport)
    // Update todayDSIR if this is today's report
    if (todayDSIR && todayDSIR.id === updatedReport.id) {
      setTodayDSIR(updatedReport)
    }
    // The useEffect will automatically save it to localStorage
  }

  const handleReportSubmitted = async () => {
    // After submission, refresh the DSIR data and redirect to options
    if (selectedLocation) {
      await checkTodayDSIR(selectedLocation)
      // Since we just submitted a DSIR, we know there's at least one submitted DSIR
      setHasSubmittedDSIR(true)
    }
    setViewMode('dsir_choice')
  }

  // Loading screen
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading DSIR System</h2>
          <p className="text-gray-600">Please wait while we check your session...</p>
        </div>
      </div>
    )
  }

  // Loading assignments screen
  if (loadingAssignments && staffInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Your Schedule</h2>
          <p className="text-gray-600">Please wait while we load your assignments and schedule...</p>
        </div>
      </div>
    )
  }


  // Show schedule view if logged in
  if (viewMode === 'schedule_view' && staffInfo) {
    const weekDates = getWeekDates()
    const today = new Date().toISOString().split('T')[0]
    
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 space-y-3 sm:space-y-0">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 leading-tight">Your Weekly Schedule</h1>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Welcome, {staffInfo.full_name} • {formatDate(new Date())}
                  </p>
                </div>
              </div>
              <button
                onClick={logout}
                className="px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex-shrink-0 self-start sm:self-auto"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Schedule Content */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Weekly Schedule Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
            <div className="bg-yellow-100 border-b border-yellow-200 p-4">
              <div className="text-center">
                <h4 className="text-lg font-bold text-yellow-800">YOUR WEEKLY SCHEDULE</h4>
                <p className="text-sm text-yellow-700">{formatDate(new Date()).toUpperCase()}</p>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-300">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-300">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-r border-gray-300">
                      DAY
                    </th>
                    {weekDates.map((date) => {
                      const dateStr = date.toISOString().split('T')[0]
                      const isToday = dateStr === today
                      
                      return (
                        <th key={date.toISOString()} className={`px-3 py-3 text-center border-r border-gray-300 last:border-r-0 ${isToday ? 'border-2 border-blue-500' : ''}`}>
                          <div className={`text-lg font-semibold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                            {formatDay(date)}
                          </div>
                          <div className="text-xs text-red-600 font-medium">
                            {formatDayName(date)}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300">
                      SCHEDULED BRANCHES
                    </td>
                    {weekDates.map((date) => {
                      const dateStr = date.toISOString().split('T')[0]
                      const daySchedules = getScheduleForDate(date)
                      const isToday = dateStr === today
                      
                      return (
                        <td key={dateStr} className={`px-3 py-3 text-center border-r border-gray-300 last:border-r-0 ${isToday ? 'bg-blue-50 border-2 border-blue-500' : ''}`}>
                          {daySchedules.length > 0 ? (
                            <div className="space-y-1">
                              {daySchedules.map((schedule) => {
                                const brandColors = getBrandButtonColors(schedule.location?.brand?.name)
                                return (
                                  <div key={schedule.id} className={`text-xs px-2 py-1 rounded ${brandColors.bg} ${brandColors.title} border ${brandColors.border}`}>
                                    <div className="font-medium">{schedule.location?.name}</div>
                                    <div className={`text-xs ${brandColors.subtitle}`}>
                                      {schedule.location?.brand?.name}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">No schedule</div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Branch Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Branch for DSIR</h3>
            <p className="text-sm text-gray-600 mb-6">
              Choose a branch where you are scheduled to work today to submit your DSIR report.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignedLocations.map((location) => {
                const isScheduledToday = isLocationScheduledToday(location)
                const isClickable = isScheduledToday
                const brandColors = getBrandButtonColors(location.brand?.name)
                
                return (
                  <button
                    key={location.id}
                    onClick={() => isClickable ? selectLocation(location) : undefined}
                    disabled={!isClickable}
                    className={`p-4 border rounded-lg text-left transition-colors ${
                      isClickable
                        ? `${brandColors.border} ${brandColors.bg} ${brandColors.hover} cursor-pointer`
                        : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Building2 className={`h-5 w-5 ${isClickable ? brandColors.icon : 'text-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium ${isClickable ? brandColors.title : 'text-gray-500'}`}>
                          {location.name}
                        </div>
                        <div className={`text-sm ${isClickable ? brandColors.subtitle : 'text-gray-400'}`}>
                          {location.brand?.name}
                        </div>
                        <div className={`text-xs mt-1 ${isClickable ? brandColors.status : 'text-gray-400'}`}>
                          {isClickable ? '✓ Scheduled today' : 'Not scheduled today'}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            
            {scheduledLocations.length === 0 && (
              <div className="text-center py-8">
                <div className="text-gray-500 mb-2">No branches scheduled for today</div>
                <div className="text-sm text-gray-400">
                  You don't have any scheduled shifts today. Contact your supervisor if this is incorrect.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Show DSIR choice screen after branch selection
  if (viewMode === 'dsir_choice' && staffInfo && selectedLocation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-purple-100 mb-6">
              <FileText className="h-8 w-8 text-purple-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">DSIR Options</h2>
            <div className="mt-2 flex items-center justify-center space-x-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getBrandHeaderColors(selectedLocation.brand?.name)}`}>
                {selectedLocation.brand?.name}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-sm text-gray-600">{selectedLocation.name}</span>
            </div>
          </div>

          <div className="space-y-4">
            {todayDSIR ? (
              // Show existing DSIR for today
              <button
                onClick={() => {
                  setCurrentReport(todayDSIR)
                  setViewMode('viewer')
                }}
                className="w-full flex items-center justify-between p-6 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-blue-500 transition-colors"
              >
                <div className="text-left">
                  <div className="font-medium text-gray-900">Today's DSIR</div>
                  <div className="text-sm text-gray-500">
                    {todayDSIR.status === 'draft' ? 'Continue editing your draft report' : 'View your submitted report'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Status: {todayDSIR.status.toUpperCase()}
                  </div>
                </div>
                <div className="text-blue-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              </button>
            ) : (
              // Show create new DSIR button
              <button
                onClick={handleCreateNewDSIR}
                className="w-full flex items-center justify-between p-6 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-green-500 transition-colors"
              >
                <div className="text-left">
                  <div className="font-medium text-gray-900">Create New DSIR</div>
                  <div className="text-sm text-gray-500">Start a new daily sales & inventory report</div>
          </div>
                <div className="text-green-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
              </button>
            )}


            <button
              onClick={handleOrderRedirect}
              className="w-full flex items-center justify-between p-6 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-orange-500 transition-colors"
            >
              <div className="text-left">
                <div className="font-medium text-gray-900">Place Order</div>
                <div className="text-sm text-gray-500">Access the order management system</div>
              </div>
              <div className="text-orange-600">
                <ShoppingCart className="w-5 h-5" />
              </div>
            </button>
          </div>

          <div className="text-center space-y-2">
            <button
              onClick={() => setViewMode('schedule_view')}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              ← Back to Schedule
            </button>
            <div>
            <button
              onClick={logout}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Logout
            </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show report form if logged in and location selected
  if (staffInfo && selectedLocation && currentReport) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 space-y-3 sm:space-y-0">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 leading-tight">Daily Sales & Inventory Report</h1>
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getBrandHeaderColors(selectedLocation.brand?.name)}`}>
                      {selectedLocation.brand?.name}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-xs sm:text-sm text-gray-600">{staffInfo.full_name}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-xs sm:text-sm text-gray-600">{currentReport.report_date}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  currentReport.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                  currentReport.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {currentReport.status.toUpperCase()}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode('dsir_choice')}
                    className="px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex-shrink-0"
                  >
                    Back to Options
                  </button>
                  <button
                    onClick={logout}
                    className="px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex-shrink-0"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Report Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DSIRViewer 
            report={currentReport}
            onReportUpdate={handleReportUpdate}
            currentStaffName={staffInfo?.full_name}
            onReportSubmitted={handleReportSubmitted}
            showDiscrepancyColumns={false}
          />
        </div>
      </div>
    )
  }


  // Show unassigned message if logged in but no locations assigned
  if (staffInfo && assignedLocations.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-orange-100 mb-6">
              <User className="h-8 w-8 text-orange-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Account Not Assigned</h2>
            <p className="mt-2 text-sm text-gray-600">
              Your account is not yet assigned to any branches
            </p>
          </div>

          <div className="bg-white py-8 px-6 shadow rounded-lg">
            <div className="text-center space-y-4">
              <div className="text-lg font-medium text-gray-900">
                Welcome, {staffInfo.full_name}!
              </div>
              <div className="text-sm text-gray-600">
                Your account has been created successfully, but you haven't been assigned to any branches yet.
              </div>
              <div className="text-sm text-gray-600">
                Please contact your franchisee or administrator to get assigned to a branch.
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <div className="text-sm text-blue-800">
                  <strong>Your Staff Code:</strong> {staffInfo.staff_code}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Share this code with your franchisee for branch assignment
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={logout}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show registration form
  if (viewMode === 'register') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
              <UserPlus className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Staff Registration</h2>
            <p className="mt-2 text-sm text-gray-600">
              Register to get your 8-digit staff code
            </p>
          </div>

          <div className="bg-white py-8 px-6 shadow rounded-lg">
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); registerStaff(); }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={registrationForm.full_name}
                  onChange={(e) => setRegistrationForm({ ...registrationForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={registrationForm.mobile_number}
                  onChange={(e) => setRegistrationForm({ ...registrationForm, mobile_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your mobile number"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  8-Digit Staff Code
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={registrationForm.staff_code}
                    onChange={(e) => setRegistrationForm({ ...registrationForm, staff_code: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="8-digit code"
                    maxLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={generateStaffCode}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    Generate
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center space-x-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center space-x-2 text-green-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{success}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Registering...' : 'Register'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setViewMode('login')}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Already have a code? Login here
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show login form (default)
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-6">
            <LogIn className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">DSIR Login</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your 8-digit staff code to access the Daily Sales & Inventory Report
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow rounded-lg">
          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); loginStaff(); }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                8-Digit Staff Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={loginForm.staff_code}
                  onChange={(e) => setLoginForm({ ...loginForm, staff_code: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                  placeholder="Enter 8-digit staff code"
                  maxLength={8}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center space-x-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center space-x-2 text-green-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !loginForm.staff_code}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setViewMode('register')}
              className="text-sm text-green-600 hover:text-green-800"
            >
              Don't have a code? Register here
            </button>
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-500">
            Contact your franchisee to get assigned to branches after registration
          </p>
        </div>
      </div>
    </div>
  )
}