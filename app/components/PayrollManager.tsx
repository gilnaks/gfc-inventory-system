'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Calculator, Clock, DollarSign, Calendar, TrendingUp, Users, Printer, ChevronLeft, ChevronRight, Minus, Save } from 'lucide-react'

interface StaffRegistration {
  id: string
  full_name: string
  mobile_number: string
  staff_code: string
  is_active: boolean
  created_at: string
  updated_at: string
  hourly_rate?: number
}

interface StaffWithAssignments extends StaffRegistration {
  staff_assignments: Array<{
    id: string
    location_id: string
    locations: {
      id: string
      name: string
      brand?: {
        name: string
      }
    }
    created_at: string
  }>
}

interface PayrollData {
  staffId: string
  staffName: string
  locationName: string
  date: string
  hours: number
  hourlyRate: number
  totalPay: number
  daysWorked: Array<{date: string, dayName: string, hours: number}>
  daysWorkedDates: string[]
  locationGroups: {[locationName: string]: Array<{date: string, dayName: string, hours: number, scheduleDate: string, brandName: string, isAbsent?: boolean}>}
  regularHours: number
  doublePayHours: number
  specialPayHours: number
  overtimeHours: number
  regularPay: number
  doublePay: number
  specialPay: number
  overtimePay: number
  minimumDailyRate: number
  deductions: {
    utilities: number
    shortages: number
    cashAdvances: number
    penalties: number
    others: number
  }
  refunds: number
  netPay: number
  averageWeeklySales?: number
  averageMonthlySales?: number
  dailySalesBreakdown?: Array<{date: string, sales: number}>
}

interface PayrollSummary {
  weekly: { [week: string]: PayrollData[] }
  custom: PayrollData[]
  totals: {
    weekly: number
    custom: number
  }
}

export function PayrollManager() {
  const [staff, setStaff] = useState<StaffWithAssignments[]>([])
  const [payrollData, setPayrollData] = useState<PayrollSummary>({
    weekly: {},
    custom: [],
    totals: {
      weekly: 0,
      custom: 0
    }
  })
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<'weekly' | 'custom'>('weekly')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null)
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null)
  const [calendarDate, setCalendarDate] = useState(new Date()) // For calendar navigation
  const [showCalendar, setShowCalendar] = useState(false) // For popup calendar
  const [selectingStartDate, setSelectingStartDate] = useState(true) // Track which date is being selected
  const [calendarClosed, setCalendarClosed] = useState(true) // Track if calendar is closed
  const [selectedStaff, setSelectedStaff] = useState<string>('all')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dayStatusMap, setDayStatusMap] = useState<{[key: string]: 'default' | 'regular-holiday' | 'special-holiday'}>({})
  const [deductions, setDeductions] = useState<{[staffId: string]: {
    utilities: number
    shortages: number
    cashAdvances: number
    penalties: number
    others: number
  }}>({})
  const [refunds, setRefunds] = useState<{[staffId: string]: number}>({})
  const [inputValues, setInputValues] = useState<{[staffId: string]: {
    utilities: string
    shortages: string
    cashAdvances: string
    penalties: string
    others: string
    refunds: string
  }}>({})
  const [savingDeductions, setSavingDeductions] = useState(false)

  useEffect(() => {
    // Only refresh data if calendar is closed or if it's not custom period
    if (calendarClosed || selectedPeriod !== 'custom') {
      loadStaffAndPayrollData()
    }
  }, [selectedDate.toISOString(), selectedPeriod, customStartDate?.toISOString(), customEndDate?.toISOString(), calendarClosed])

  // Separate useEffect for payroll data when staff changes
  useEffect(() => {
    if (staff.length > 0) {
      loadPayrollData(staff)
    }
  }, [staff])

  // Sync calendar date with selected date
  useEffect(() => {
    setCalendarDate(new Date(selectedDate))
  }, [selectedDate])

  // Set default selected date based on period
  useEffect(() => {
    const today = new Date()
    
    if (selectedPeriod === 'custom') {
      // For custom period, set default range to current week
      const dayOfWeek = today.getDay()
      const diff = -dayOfWeek // Sunday as start (0 = Sunday)
      const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6) // Saturday as end
      
      setCustomStartDate(startOfWeek)
      setCustomEndDate(endOfWeek)
    } else {
      // Set to today for weekly
      setSelectedDate(new Date())
    }
  }, [selectedPeriod])

  // Ensure custom dates are always in correct order
  useEffect(() => {
    if (customStartDate && customEndDate && customStartDate > customEndDate) {
      const temp = customStartDate
      setCustomStartDate(customEndDate)
      setCustomEndDate(temp)
    }
  }, [customStartDate, customEndDate])

  const loadStaffAndPayrollData = async () => {
    setLoading(true)
    try {
      // Load company-owned locations first
      const { data: companyLocations, error: locationError } = await supabase
        .from('locations')
        .select('id')
        .eq('company_owned', true)

      if (locationError) throw locationError

      const companyLocationIds = companyLocations?.map(loc => loc.id) || []

      // Load staff data
      const { data: staffData, error: staffError } = await supabase
        .from('staff_registrations')
        .select('*')
        .eq('is_active', true)

      if (staffError) throw staffError

      // Load staff assignments separately
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('staff_assignments')
        .select('id, staff_registration_id, location_id')
        .in('location_id', companyLocationIds) // Only company-owned locations

      if (assignmentsError) throw assignmentsError

      // Load locations separately
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select(`
          id,
          name,
          brand:brands(name)
        `)
        .eq('company_owned', true) // Only company-owned locations

      if (locationsError) throw locationsError

      // Combine staff data with assignments and locations
      const staffWithAssignments = staffData?.map(staff => ({
        ...staff,
        staff_assignments: assignmentsData?.filter(assignment => 
          assignment.staff_registration_id === staff.id
        ).map(assignment => ({
          ...assignment,
          locations: locationsData?.find(location => 
            location.id === assignment.location_id
          ) || { id: assignment.location_id, name: 'Unknown Location' }
        })) || []
      })).filter(staff => staff.staff_assignments.length > 0) || [] // Only staff with company-owned assignments

      setStaff(staffWithAssignments)
    } catch (error) {
      console.error('Error loading staff and payroll data:', error)
      setError('Failed to load payroll data')
    } finally {
      setLoading(false)
    }
  }

  const loadPayrollData = async (staffData: StaffWithAssignments[]) => {
    try {
      const startDate = getStartDate()
      const endDate = getEndDate()
      const today = new Date().toISOString().split('T')[0]

      // Get company-owned location IDs
      const { data: companyLocations, error: locationError } = await supabase
        .from('locations')
        .select('id')
        .eq('company_owned', true)

      if (locationError) throw locationError

      const companyLocationIds = companyLocations?.map(loc => loc.id) || []

      const { data: scheduleData, error: scheduleError } = await supabase
        .from('staff_schedules')
        .select(`
          *,
          staff:staff_registrations(id, full_name, hourly_rate),
          location:locations(id, name, brand:brands(id, name))
        `)
        .gte('schedule_date', startDate)
        .lte('schedule_date', endDate)
        .in('location_id', companyLocationIds) // Only company-owned locations
        .order('schedule_date', { ascending: true })

      if (scheduleError) {
        console.error('Error fetching schedule data:', scheduleError)
        throw scheduleError
      }

      // Filter out future dates - only include up to today
      const filteredScheduleData = (scheduleData || []).filter(schedule => 
        schedule.schedule_date <= today
      )

      // Create day status map
      const dayStatusMap: {[key: string]: 'default' | 'regular-holiday' | 'special-holiday'} = {}
      filteredScheduleData.forEach(schedule => {
        if (schedule.day_type) {
          dayStatusMap[schedule.schedule_date] = schedule.day_type
        }
      })
      
      setDayStatusMap(dayStatusMap)

      const payroll = await calculatePayroll(staffData, filteredScheduleData, dayStatusMap, startDate, endDate)
      setPayrollData(payroll)
      setError('') // Clear any previous errors

      // Load deductions and refunds from Supabase for the current week
      // This needs to be after setting payroll data to trigger a recalculation
      if (selectedPeriod === 'weekly') {
        await loadDeductionsAndRefunds(startDate, endDate, staffData, filteredScheduleData, dayStatusMap)
      }
    } catch (error) {
      console.error('Error loading payroll data:', error)
      setError('Failed to load payroll data')
      // Set empty payroll data on error
      setPayrollData({
        weekly: {},
        custom: [],
        totals: {
          weekly: 0,
          custom: 0
        }
      })
    }
  }

  const fetchStaffAverageWeeklySales = async (staffIds: string[], weekStartDate: string, weekEndDate: string) => {
    try {
      // Get the last 4 weeks of data for 4-week average calculation
      const fourWeeksAgo = new Date()
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
      const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0]
      
      // Get the last 30 days for monthly average calculation
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]
      
      // Fetch DSIR reports for these staff members in the last 4 weeks (for 4-week average)
      const { data: dsirReports4Week, error: error4Week } = await supabase
        .from('dsir_reports')
        .select('staff_registration_id, gross_sales, report_date')
        .in('staff_registration_id', staffIds)
        .gte('report_date', fourWeeksAgoStr)
        .eq('status', 'submitted')
      
      if (error4Week) {
        console.error('Error fetching DSIR reports for 4-week average:', error4Week)
      }
      
      // Fetch DSIR reports for the last 30 days (for monthly average)
      const { data: dsirReportsMonthly, error: errorMonthly } = await supabase
        .from('dsir_reports')
        .select('staff_registration_id, gross_sales, report_date')
        .in('staff_registration_id', staffIds)
        .gte('report_date', thirtyDaysAgoStr)
        .eq('status', 'submitted')
      
      if (errorMonthly) {
        console.error('Error fetching DSIR reports for monthly average:', errorMonthly)
      }
      
      // Fetch DSIR reports for the filtered week only (for breakdown and current week average)
      const { data: dsirReportsWeek, error: errorWeek } = await supabase
        .from('dsir_reports')
        .select('staff_registration_id, gross_sales, report_date')
        .in('staff_registration_id', staffIds)
        .gte('report_date', weekStartDate)
        .lte('report_date', weekEndDate)
        .eq('status', 'submitted')
        .order('report_date', { ascending: false })
      
      if (errorWeek) {
        console.error('Error fetching DSIR reports for week:', errorWeek)
      }
      
      // Group by staff for weekly breakdown (filtered week only)
      const weeklyBreakdownByStaff: {[staffId: string]: Array<{date: string, sales: number}>} = {}
      
      dsirReportsWeek?.forEach(report => {
        if (!weeklyBreakdownByStaff[report.staff_registration_id]) {
          weeklyBreakdownByStaff[report.staff_registration_id] = []
        }
        weeklyBreakdownByStaff[report.staff_registration_id].push({
          date: report.report_date,
          sales: report.gross_sales || 0
        })
      })
      
      // Group by staff for 4-week average
      const salesByStaff4Week: {[staffId: string]: number[]} = {}
      dsirReports4Week?.forEach(report => {
        if (!salesByStaff4Week[report.staff_registration_id]) {
          salesByStaff4Week[report.staff_registration_id] = []
        }
        salesByStaff4Week[report.staff_registration_id].push(report.gross_sales || 0)
      })
      
      // Group by staff for monthly average (with actual days worked)
      const salesByStaffMonthly: {[staffId: string]: Array<{date: string, sales: number}>} = {}
      dsirReportsMonthly?.forEach(report => {
        if (!salesByStaffMonthly[report.staff_registration_id]) {
          salesByStaffMonthly[report.staff_registration_id] = []
        }
        salesByStaffMonthly[report.staff_registration_id].push({
          date: report.report_date,
          sales: report.gross_sales || 0
        })
      })
      
      // Calculate averages for each staff
      const averageWeeklySalesMap: {[staffId: string]: number} = {}
      const averageMonthlySalesMap: {[staffId: string]: number} = {}
      
      // Calculate weekly average from the current week's breakdown (days worked)
      Object.entries(weeklyBreakdownByStaff).forEach(([staffId, dailySales]) => {
        if (dailySales.length > 0) {
          const totalWeekSales = dailySales.reduce((sum, day) => sum + day.sales, 0)
          // Weekly average = total sales divided by number of days worked
          averageWeeklySalesMap[staffId] = totalWeekSales / dailySales.length
        }
      })
      
      // Calculate monthly average from the last 4 weeks of data (based on actual days worked)
      Object.entries(salesByStaffMonthly).forEach(([staffId, dailySales]) => {
        if (dailySales.length > 0) {
          const totalSales = dailySales.reduce((sum, day) => sum + day.sales, 0)
          const daysWorked = dailySales.length
          // Monthly average = total sales divided by number of days worked
          averageMonthlySalesMap[staffId] = totalSales / daysWorked
        }
      })
      
      return { 
        weeklyAverages: averageWeeklySalesMap, 
        monthlyAverages: averageMonthlySalesMap,
        breakdowns: weeklyBreakdownByStaff 
      }
    } catch (error) {
      console.error('Error calculating staff average sales:', error)
      return { weeklyAverages: {}, monthlyAverages: {}, breakdowns: {} }
    }
  }

  const getScheduleDataForWeek = async (startDate: string, endDate: string) => {
    const today = new Date().toISOString().split('T')[0]

    // Get company-owned location IDs
    const { data: companyLocations, error: locationError } = await supabase
      .from('locations')
      .select('id')
      .eq('company_owned', true)

    if (locationError) throw locationError

    const companyLocationIds = companyLocations?.map(loc => loc.id) || []

    const { data: scheduleData, error: scheduleError } = await supabase
      .from('staff_schedules')
      .select(`
        *,
        staff:staff_registrations(id, full_name, hourly_rate),
        location:locations(id, name, brand:brands(id, name))
      `)
      .gte('schedule_date', startDate)
      .lte('schedule_date', endDate)
      .in('location_id', companyLocationIds)
      .order('schedule_date', { ascending: true })

    if (scheduleError) throw scheduleError

    // Filter out future dates
    const filteredScheduleData = (scheduleData || []).filter(schedule => 
      schedule.schedule_date <= today
    )

    return filteredScheduleData
  }

  const loadDeductionsAndRefunds = async (startDate: string, endDate: string, staffData?: StaffWithAssignments[], scheduleData?: any[], dayStatusMap?: {[key: string]: string}) => {
    try {
      const { data, error } = await supabase
        .from('payroll_deductions_refunds')
        .select('*')
        .eq('week_start_date', startDate)
        .eq('week_end_date', endDate)

      if (error) throw error

      if (data && data.length > 0) {
        const loadedDeductions: {[staffId: string]: {
          utilities: number
          shortages: number
          cashAdvances: number
          penalties: number
          others: number
        }} = {}
        const loadedRefunds: {[staffId: string]: number} = {}

        data.forEach(record => {
          loadedDeductions[record.staff_id] = {
            utilities: record.utilities || 0,
            shortages: record.shortages || 0,
            cashAdvances: record.cash_advances || 0,
            penalties: record.penalties || 0,
            others: record.others || 0
          }
          loadedRefunds[record.staff_id] = record.refunds || 0
        })

        // Temporarily store in a variable to pass directly to calculation
        const tempDeductions = loadedDeductions
        const tempRefunds = loadedRefunds

        setDeductions(loadedDeductions)
        setRefunds(loadedRefunds)

        // Recalculate payroll with loaded deductions and refunds
        if (staffData && scheduleData && dayStatusMap) {
          // Use setTimeout to ensure state updates are processed
          setTimeout(async () => {
            // Override the deductions and refunds for this calculation
            Object.assign(deductions, tempDeductions)
            Object.assign(refunds, tempRefunds)
            
            const payroll = await calculatePayroll(staffData, scheduleData, dayStatusMap, startDate, endDate)
            setPayrollData(payroll)
          }, 100)
        }
      } else {
        // Clear deductions and refunds if no data found
        setDeductions({})
        setRefunds({})

        // Recalculate payroll with cleared deductions and refunds
        if (staffData && scheduleData && dayStatusMap) {
          setTimeout(async () => {
            const payroll = await calculatePayroll(staffData, scheduleData, dayStatusMap, startDate, endDate)
            setPayrollData(payroll)
          }, 100)
        }
      }
    } catch (error) {
      console.error('Error loading deductions and refunds:', error)
    }
  }

  const getStartDate = () => {
    if (selectedPeriod === 'custom') {
      if (customStartDate) {
        const year = customStartDate.getFullYear()
        const month = customStartDate.getMonth()
        const day = customStartDate.getDate()
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
      return new Date().toISOString().split('T')[0]
    }
    
    const date = new Date(selectedDate)
    // Get Sunday as start of week (getDay() returns 0 for Sunday, 1 for Monday, etc.)
    const dayOfWeek = date.getDay()
    const diff = -dayOfWeek // Sunday as start (0 = Sunday)
    const startOfWeek = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff)
    const year = startOfWeek.getFullYear()
    const month = startOfWeek.getMonth()
    const day = startOfWeek.getDate()
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const getEndDate = () => {
    if (selectedPeriod === 'custom') {
      if (customEndDate) {
        const year = customEndDate.getFullYear()
        const month = customEndDate.getMonth()
        const day = customEndDate.getDate()
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
      return new Date().toISOString().split('T')[0]
    }
    
    const date = new Date(selectedDate)
    // Get Saturday as end of week (Sunday + 6 days)
    const dayOfWeekEnd = date.getDay()
    const diffEnd = 6 - dayOfWeekEnd // Sunday + 6 days = Saturday
    const endOfWeek = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diffEnd)
    const yearEnd = endOfWeek.getFullYear()
    const monthEnd = endOfWeek.getMonth()
    const dayEnd = endOfWeek.getDate()
    return `${yearEnd}-${String(monthEnd + 1).padStart(2, '0')}-${String(dayEnd).padStart(2, '0')}`
  }

  const calculateStaffPayroll = (staff: StaffWithAssignments, staffSchedules: any[], dayStatusMap: {[key: string]: string}): PayrollData => {
    const hourlyRate = staff.hourly_rate || 0
    const minimumDailyRate = hourlyRate * 8
    const minimumHourlyRate = minimumDailyRate / 8  // This equals hourlyRate
    const overtimeHourlyRate = minimumHourlyRate * 1.25
    
    // Calculate total hours and categorize by day type
    let totalHours = 0
    let regularHours = 0
    let doublePayHours = 0  // Hours for regular holiday days (first 8 hours)
    let specialPayHours = 0  // Hours for special holiday days (first 8 hours)
    
    // Create a map of dates to hours for day bubbles
    const dayHoursMap: {[key: string]: number} = {}
    
    staffSchedules.forEach(schedule => {
      // If staff is marked absent, hours should be 0
      const hours = schedule.is_absent ? 0 : (schedule.hours || 11)
      const dayStatus = dayStatusMap[schedule.schedule_date] || 'default'
      
      // Store hours for each day
      dayHoursMap[schedule.schedule_date] = hours
      
      totalHours += hours
      
      // First 8 hours of each day go to the appropriate category
      const first8Hours = Math.min(8, hours)
      
      switch (dayStatus) {
        case 'regular-holiday':
          doublePayHours += first8Hours  // First 8 hours at double pay rate
          break
        case 'special-holiday':
          specialPayHours += first8Hours  // First 8 hours at special pay rate (1.3x)
          break
        default:
          regularHours += first8Hours  // First 8 hours at regular rate
          break
      }
    })
    
    // Calculate overtime hours (overtime after 48 hours total)
    const overtimeHours = Math.max(0, totalHours - 48)
    
    // If total hours < 48, add all excess daily hours to regular hours
    if (totalHours < 48) {
      staffSchedules.forEach(schedule => {
        // If staff is marked absent, hours should be 0
        const hours = schedule.is_absent ? 0 : (schedule.hours || 11)
        const dayStatus = dayStatusMap[schedule.schedule_date] || 'default'
        const excessHours = Math.max(0, hours - 8)
        
        // Add excess hours to regular hours for all day types when total < 48
        regularHours += excessHours
      })
    }
    
    // Calculate pay following exact formulas:
    // Regular pay = Regular Hours × Hourly Rate
    const regularPay = regularHours * hourlyRate
    
    // Overtime pay = (Total Working Hours - 48 Hours) × OT Hourly Rate
    const overtimePay = overtimeHours * overtimeHourlyRate
    
    // Holiday pay calculations:
    // Regular Holiday = Double Pay Hours × Hourly Rate × 2
    // Special Holiday = Special Pay Hours × Hourly Rate × 1.30
    const doublePay = doublePayHours * hourlyRate * 2
    const specialPay = specialPayHours * hourlyRate * 1.30
    
    // Calculate total pay
    const totalPay = regularPay + overtimePay + doublePay + specialPay
    
    // Get all unique locations for this staff member
    const locations = Array.from(new Set(staffSchedules.map(s => s.location?.name || 'Unknown'))).join(', ')
    
    // Group days worked by location
    const locationGroups: {[locationName: string]: Array<{date: string, dayName: string, hours: number, scheduleDate: string, brandName: string, isAbsent?: boolean}>} = {}
    
    staffSchedules.forEach(schedule => {
      const locationName = schedule.location?.name || 'Unknown'
      const brandName = schedule.location?.brand?.name || 'Unknown Brand'
      const date = schedule.schedule_date
      const dateObj = new Date(date)
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
      const dateStr = dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
      
      if (!locationGroups[locationName]) {
        locationGroups[locationName] = []
      }
      
      locationGroups[locationName].push({
        date: dateStr,  // "Sep 30"
        dayName: dayName,  // "Tue"
        hours: dayHoursMap[date] || 0,
        scheduleDate: date,
        brandName: brandName,
        isAbsent: schedule.is_absent || false
      })
    })
    
    // Sort days within each location by date
    Object.keys(locationGroups).forEach(location => {
      locationGroups[location].sort((a, b) => new Date(a.scheduleDate).getTime() - new Date(b.scheduleDate).getTime())
    })
    
    // Get all days worked (sorted by date) with hours for backward compatibility
    const daysWorkedDates = Array.from(new Set(staffSchedules.map(s => s.schedule_date))).sort()
    const daysWorked = daysWorkedDates.map(date => {
      const dateObj = new Date(date)
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
      const dateStr = dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
      return {
        date: dateStr,  // "Sep 30"
        dayName: dayName,  // "Tue"
        hours: dayHoursMap[date] || 0
      }
    })

    // Get deductions for this staff member
    const staffDeductions = getDeductionsForStaff(staff.id)
    
    // Get refunds for this staff member
    const staffRefunds = refunds[staff.id] || 0
    
    // Calculate total deductions
    const totalDeductions = Object.values(staffDeductions).reduce((sum, amount) => sum + amount, 0)
    
    // Calculate net pay (Total Pay - Deductions + Refunds)
    const netPay = totalPay - totalDeductions + staffRefunds

    return {
      staffId: staff.id,
      staffName: staff.full_name,
      locationName: locations,
      date: staffSchedules[0].schedule_date,
      hours: totalHours,
      hourlyRate: hourlyRate,
      totalPay: totalPay,
      daysWorked: daysWorked,
      daysWorkedDates: daysWorkedDates,
      locationGroups: locationGroups,
      regularHours: regularHours,  // First 8 hours of regular days
      doublePayHours: doublePayHours,  // First 8 hours of regular holiday days
      specialPayHours: specialPayHours,  // First 8 hours of special holiday days
      overtimeHours: overtimeHours,  // Hours beyond 48 total per week
      regularPay: regularPay,
      doublePay: doublePay,
      specialPay: specialPay,
      overtimePay: overtimePay,  // Overtime pay for hours beyond 48 per week
      minimumDailyRate: minimumDailyRate,
      deductions: staffDeductions,
      refunds: staffRefunds,
      netPay: netPay
    }
  }

  const calculatePayroll = async (staffData: StaffWithAssignments[], scheduleData: any[], dayStatusMap: {[key: string]: string}, startDate: string, endDate: string): Promise<PayrollSummary> => {
    const weekly: { [week: string]: PayrollData[] } = {}
    const custom: PayrollData[] = []

    // Fetch average weekly and monthly sales for all staff (with breakdown for the filtered week)
    const staffSalesData = await fetchStaffAverageWeeklySales(staffData.map(s => s.id), startDate, endDate)

    // Group schedule data by staff
    const staffGroups: { [staffId: string]: any[] } = {}
    scheduleData.forEach(schedule => {
      const staffId = schedule.staff_registration_id
      if (!staffGroups[staffId]) {
        staffGroups[staffId] = []
      }
      staffGroups[staffId].push(schedule)
    })

    // Process each staff member's data
    Object.entries(staffGroups).forEach(([staffId, staffSchedules]) => {
      const staff = staffData.find(s => s.id === staffId)
      if (!staff) return

      const payrollEntry = calculateStaffPayroll(staff, staffSchedules, dayStatusMap)
      
      // Add average weekly sales, monthly sales, and daily breakdown
      payrollEntry.averageWeeklySales = staffSalesData.weeklyAverages[staffId] || 0
      payrollEntry.averageMonthlySales = staffSalesData.monthlyAverages[staffId] || 0
      payrollEntry.dailySalesBreakdown = staffSalesData.breakdowns[staffId] || []

      custom.push(payrollEntry)

      // Group by week
      const weekKey = getWeekKey(new Date(staffSchedules[0].schedule_date))
      if (!weekly[weekKey]) weekly[weekKey] = []
      weekly[weekKey].push(payrollEntry)
    })

    const totals = {
      weekly: Object.values(weekly).flat().reduce((sum, entry) => sum + entry.totalPay, 0),
      custom: custom.reduce((sum, entry) => sum + entry.totalPay, 0)
    }

    return { weekly, custom, totals }
  }

  const getWeekKey = (date: Date) => {
    if (selectedPeriod === 'custom') {
      // For custom period, group by the custom range
      return 'custom'
    }
    
    const startOfWeek = new Date(date)
    const dayOfWeek = date.getDay()
    const diff = -dayOfWeek // Sunday as start (0 = Sunday)
    startOfWeek.setDate(date.getDate() + diff)
    return startOfWeek.toISOString().split('T')[0]
  }

  const getMonthKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getTotalHours = () => {
    switch (selectedPeriod) {
      case 'weekly':
        return Object.values(payrollData.weekly).flat().reduce((sum, entry) => sum + entry.hours, 0)
      case 'custom':
        return payrollData.custom.reduce((sum, entry) => sum + entry.hours, 0)
      default:
        return 0
    }
  }

  const getTotalOvertimeHours = () => {
    switch (selectedPeriod) {
      case 'weekly':
        return Object.values(payrollData.weekly).flat().reduce((sum, entry) => sum + entry.overtimeHours, 0)
      case 'custom':
        return payrollData.custom.reduce((sum, entry) => sum + entry.overtimeHours, 0)
      default:
        return 0
    }
  }

  const getTotalDoublePayHours = () => {
    switch (selectedPeriod) {
      case 'weekly':
        return Object.values(payrollData.weekly).flat().reduce((sum, entry) => sum + entry.doublePayHours, 0)
      case 'custom':
        return payrollData.custom.reduce((sum, entry) => sum + entry.doublePayHours, 0)
      default:
        return 0
    }
  }

  const getTotalSpecialPayHours = () => {
    switch (selectedPeriod) {
      case 'weekly':
        return Object.values(payrollData.weekly).flat().reduce((sum, entry) => sum + entry.specialPayHours, 0)
      case 'custom':
        return payrollData.custom.reduce((sum, entry) => sum + entry.specialPayHours, 0)
      default:
        return 0
    }
  }

  const getTotalRegularHours = () => {
    switch (selectedPeriod) {
      case 'weekly':
        return Object.values(payrollData.weekly).flat().reduce((sum, entry) => sum + entry.regularHours, 0)
      case 'custom':
        return payrollData.custom.reduce((sum, entry) => sum + entry.regularHours, 0)
      default:
        return 0
    }
  }

  const getPayrollEntries = () => {
    let entries = []
    switch (selectedPeriod) {
      case 'weekly':
        entries = Object.values(payrollData.weekly).flat()
        break
      case 'custom':
        entries = payrollData.custom
        break
      default:
        entries = []
    }
    
    // Filter by selected staff
    if (selectedStaff !== 'all') {
      entries = entries.filter(entry => entry.staffId === selectedStaff)
    }
    
    // Sort by net pay from highest to lowest
    entries.sort((a, b) => b.netPay - a.netPay)
    
    return entries
  }

  const hasPayrollData = () => {
    return getPayrollEntries().length > 0
  }

  const getTotalDeductions = () => {
    switch (selectedPeriod) {
      case 'weekly':
        return Object.values(payrollData.weekly).flat().reduce((sum, entry) => sum + Object.values(entry.deductions).reduce((a, b) => a + b, 0), 0)
      case 'custom':
        return Object.values(payrollData.weekly).flat().reduce((sum, entry) => sum + Object.values(entry.deductions).reduce((a, b) => a + b, 0), 0)
      default:
        return 0
    }
  }

  const getTotalNetPay = () => {
    switch (selectedPeriod) {
      case 'weekly':
        return Object.values(payrollData.weekly).flat().reduce((sum, entry) => sum + entry.netPay, 0)
      case 'custom':
        return Object.values(payrollData.weekly).flat().reduce((sum, entry) => sum + entry.netPay, 0)
      default:
        return 0
    }
  }

  const updateDeduction = (staffId: string, deductionType: keyof typeof deductions[string], value: number) => {
    setDeductions(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        [deductionType]: value
      }
    }))
  }

  const updateInputValue = (staffId: string, deductionType: keyof typeof inputValues[string], value: string) => {
    setInputValues(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        [deductionType]: value
      }
    }))
    
    // Update the actual deduction value (but not for refunds, which is handled separately)
    if (deductionType !== 'refunds') {
      const numericValue = parseFloat(value) || 0
      updateDeduction(staffId, deductionType, numericValue)
    }
  }

  const getInputValue = (staffId: string, deductionType: keyof typeof inputValues[string], currentValue: number) => {
    const inputValue = inputValues[staffId]?.[deductionType]
    if (inputValue !== undefined) {
      return inputValue
    }
    return (currentValue === 0 || currentValue === undefined) ? '' : currentValue.toString()
  }

  const getDeductionsForStaff = (staffId: string) => {
    const staffDeductions = deductions[staffId] || {
      utilities: 0,
      shortages: 0,
      cashAdvances: 0,
      penalties: 0,
      others: 0
    }
    return {
      utilities: staffDeductions.utilities || 0,
      shortages: staffDeductions.shortages || 0,
      cashAdvances: staffDeductions.cashAdvances || 0,
      penalties: staffDeductions.penalties || 0,
      others: staffDeductions.others || 0
    }
  }

  const saveDeductionsAndRefunds = async () => {
    if (selectedPeriod !== 'weekly') return

    setSavingDeductions(true)
    setError('')
    setSuccess('')

    try {
      const startDate = getStartDate()
      const endDate = getEndDate()
      const weekKey = getWeekKey(new Date(selectedDate))

      // Get all staff entries for this week
      const weekEntries = payrollData.weekly[weekKey] || []
      
      if (weekEntries.length === 0) {
        setError('No payroll data found for this week')
        return
      }

      // Save deductions and refunds for each staff member
      for (const entry of weekEntries) {
        const staffDeductions = deductions[entry.staffId]
        const staffRefunds = refunds[entry.staffId]

        // Check if all values are 0
        const allValuesZero = (
          (!staffDeductions?.utilities || staffDeductions.utilities === 0) &&
          (!staffDeductions?.shortages || staffDeductions.shortages === 0) &&
          (!staffDeductions?.cashAdvances || staffDeductions.cashAdvances === 0) &&
          (!staffDeductions?.penalties || staffDeductions.penalties === 0) &&
          (!staffDeductions?.others || staffDeductions.others === 0) &&
          (!staffRefunds || staffRefunds === 0)
        )

        // Check if record already exists
        const { data: existingRecords } = await supabase
          .from('payroll_deductions_refunds')
          .select('id')
          .eq('staff_id', entry.staffId)
          .eq('week_start_date', startDate)
          .eq('week_end_date', endDate)
        
        const existingRecord = existingRecords && existingRecords.length > 0 ? existingRecords[0] : null

        if (allValuesZero) {
          // If all values are 0, delete the record if it exists
          if (existingRecord) {
            const { error: deleteError } = await supabase
              .from('payroll_deductions_refunds')
              .delete()
              .eq('id', existingRecord.id)

            if (deleteError) throw deleteError
          }
        } else if (staffDeductions || staffRefunds) {
          // If there are non-zero values, save them
          const recordData = {
            staff_id: entry.staffId,
            week_start_date: startDate,
            week_end_date: endDate,
            utilities: staffDeductions?.utilities || 0,
            shortages: staffDeductions?.shortages || 0,
            cash_advances: staffDeductions?.cashAdvances || 0,
            penalties: staffDeductions?.penalties || 0,
            others: staffDeductions?.others || 0,
            refunds: staffRefunds || 0,
            updated_at: new Date().toISOString()
          }

          if (!existingRecord) {
            // Record doesn't exist, create new one
            const { error: insertError } = await supabase
              .from('payroll_deductions_refunds')
              .insert(recordData)

            if (insertError) throw insertError
          } else {
            // Record exists, update it
            const { error: updateError } = await supabase
              .from('payroll_deductions_refunds')
              .update(recordData)
              .eq('id', existingRecord.id)

            if (updateError) throw updateError
          }
        }
      }

      // Just reload the deductions/refunds and recalculate, no need to reload everything
      const currentWeekEntries = payrollData.weekly[weekKey] || []
      if (currentWeekEntries.length > 0 && staff.length > 0) {
        const scheduleData = await getScheduleDataForWeek(startDate, endDate)
        await loadDeductionsAndRefunds(startDate, endDate, staff, scheduleData, dayStatusMap)
      }
    } catch (error) {
      console.error('Error saving deductions and refunds:', error)
      setError('Failed to save deductions and refunds')
    } finally {
      setSavingDeductions(false)
    }
  }

  const getDayColorClasses = (dayStatus: 'default' | 'regular-holiday' | 'special-holiday') => {
    switch (dayStatus) {
      case 'regular-holiday':
        return 'bg-orange-200 text-orange-900 border border-orange-300'
      case 'special-holiday':
        return 'bg-violet-200 text-violet-900 border border-violet-300'
      default: // 'default'
        return 'bg-blue-200 text-blue-900 border border-blue-300'
    }
  }

  const getDayStatusForDate = (dateString: string) => {
    return dayStatusMap[dateString] || 'default'
  }

  const getDateRangeText = () => {
    const startDate = getStartDate()
    const endDate = getEndDate()
    
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    }

    if (selectedPeriod === 'weekly') {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`
    } else if (selectedPeriod === 'custom') {
      if (customStartDate && customEndDate) {
        return `${formatDate(customStartDate.toISOString())} - ${formatDate(customEndDate.toISOString())}`
      } else if (customStartDate) {
        return `From ${formatDate(customStartDate.toISOString())} - Select end date`
      }
      return 'Select date range'
    }
    
    return ''
  }

  // Get calendar days for the current month (starting with Sunday)
  const getCalendarDays = () => {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    // Calculate padding for Sunday start (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = firstDay.getDay()
    const startPadding = firstDayOfWeek // Sunday = 0, so no padding needed
    const days = []
    
    // Add empty cells for padding
    for (let i = 0; i < startPadding; i++) {
      days.push(null)
    }
    
    // Add actual days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }
    
    return days
  }

  // Check if a date is in the selected week
  const isInSelectedWeek = (date: Date) => {
    if (selectedPeriod === 'custom') {
      if (customStartDate && customEndDate) {
        // Normalize dates to compare only date parts (ignore time)
        const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
        const startOnly = new Date(customStartDate.getFullYear(), customStartDate.getMonth(), customStartDate.getDate())
        const endOnly = new Date(customEndDate.getFullYear(), customEndDate.getMonth(), customEndDate.getDate())
        
        return dateOnly >= startOnly && dateOnly <= endOnly
      }
      return false
    }
    
    // Normalize the date being checked (ignore time)
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    
    const startOfWeek = new Date(selectedDate)
    const dayOfWeek = selectedDate.getDay()
    const diff = -dayOfWeek // Sunday as start (0 = Sunday)
    startOfWeek.setDate(selectedDate.getDate() + diff)
    // Normalize start of week to midnight
    startOfWeek.setHours(0, 0, 0, 0)
    
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6) // Saturday as end
    
    return dateOnly >= startOfWeek && dateOnly <= endOfWeek
  }

  // Check if a date is selected
  const isSelectedDate = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString()
  }

  // Handle day click
  const handleDayClick = (date: Date) => {
    if (selectedPeriod === 'custom') {
      // Mark calendar as open during date selection to prevent data refresh
      setCalendarClosed(false)
      
      if (selectingStartDate) {
        // First date selection - always set as start date
        setCustomStartDate(date)
        setSelectingStartDate(false)
      } else {
        // Second date selection - always ensure proper ordering
        if (customStartDate) {
          if (date >= customStartDate) {
            // Date is after or same as start - set as end
            setCustomEndDate(date)
          } else {
            // Date is before start - swap them
            setCustomEndDate(customStartDate)
            setCustomStartDate(date)
          }
        } else {
          // Fallback - set as end date
          setCustomEndDate(date)
        }
        setSelectingStartDate(true) // Reset for next time
        // Don't close calendar automatically
      }
    } else if (selectedPeriod === 'weekly') {
      // Set to the start of the week for the clicked date (Sunday)
      const startOfWeek = new Date(date)
      const dayOfWeek = date.getDay()
      const diff = -dayOfWeek // Sunday as start (0 = Sunday)
      startOfWeek.setDate(date.getDate() + diff)
      setSelectedDate(startOfWeek)
      setShowCalendar(false)
      setCalendarClosed(true) // Mark calendar as closed for weekly
    }
  }

  // Format the selected date for display
  const getFormattedDate = () => {
    if (selectedPeriod === 'weekly') {
      return `Week of ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    } else if (selectedPeriod === 'custom') {
      if (customStartDate && customEndDate) {
        return `${customStartDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        })} - ${customEndDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        })}`
      } else if (customStartDate) {
        return `From ${customStartDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        })} - Select end date`
      }
      return 'Select date range'
    }
    return selectedDate.toLocaleDateString()
  }

  const generatePayslip = (entry: PayrollData) => {
    const currentDate = new Date()
    const payslipDate = currentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    
          const periodText = getDateRangeText()

    // Generate days worked section
    const generateDaysWorked = () => {
      if (!entry.locationGroups || Object.keys(entry.locationGroups).length === 0) {
        return '<div class="no-days">No days worked recorded</div>'
      }

            let daysHTML = ''
            Object.entries(entry.locationGroups).forEach(([locationName, days]) => {
              daysHTML += `
                <div class="location-group">
                  <div class="location-header">${locationName}</div>
                  <div class="days-grid">
                    ${days.map(day => {
                      const dayStatus = getDayStatusForDate(day.scheduleDate)
                      const statusClass = dayStatus === 'regular-holiday' ? 'holiday' : 
                                        dayStatus === 'special-holiday' ? 'special' : 'regular'
                      return `
                        <div class="day-item ${statusClass}">
                          <div class="day-date">${day.date}</div>
                          <div class="day-name">${day.dayName}</div>
                          <div class="day-hours">${day.hours}h</div>
                        </div>
                      `
                    }).join('')}
                  </div>
                </div>
              `
            })
      return daysHTML
    }

    const payslipHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payslip - ${entry.staffName}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
          }
          
          .payslip {
            width: 7.5in;
            margin: 0 auto;
            background: white;
            padding: 0.15in;
            font-size: 12px;
            line-height: 1.3;
          }
          
          .header {
            text-align: center;
            margin-bottom: 10px;
          }
          
          .company-name {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 3px;
            color: #000;
          }
          
          .payslip-title {
            font-size: 16px;
            font-weight: 500;
            margin-bottom: 3px;
            color: #000;
          }
          
          .generated-date {
            font-size: 11px;
            color: #000;
          }
          
          .employee-info {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 30px;
            margin-bottom: 12px;
          }
          
          .info-item {
            text-align: center;
          }
          
          .info-label {
            font-size: 10px;
            font-weight: 600;
            color: #000;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          
          .info-value {
            font-size: 14px;
            font-weight: 600;
            color: #000;
          }
          
          .section-title {
            font-size: 14px;
            font-weight: 700;
            color: #000;
            margin: 10px 0 6px 0;
          }
          
          .days-worked {
            margin-bottom: 12px;
          }
          
          .location-group {
            margin-bottom: 8px;
            display: inline-block;
            margin-right: 20px;
            vertical-align: top;
          }
          
          .location-header {
            font-size: 13px;
            font-weight: 600;
            color: #000;
            margin-bottom: 6px;
            padding: 4px 0;
            background: #f0f0f0;
            text-align: center;
          }
          
          .days-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(55px, 1fr));
            gap: 5px;
            max-width: 200px;
            justify-content: center;
          }
          
          .day-item {
            padding: 5px;
            text-align: center;
            font-size: 12px;
            background: white;
            color: #000;
            border: 1px solid #ddd;
          }
          
          .day-item.regular {
            background: white;
            color: #000;
          }
          
          .day-item.holiday {
            background: #f0f0f0;
            color: #000;
          }
          
          .day-item.special {
            background: #e0e0e0;
            color: #000;
          }
          
          .day-date {
            font-weight: 600;
            font-size: 11px;
            margin-bottom: 3px;
          }
          
          .day-name {
            font-size: 10px;
            opacity: 0.8;
            margin-bottom: 3px;
          }
          
          .day-hours {
            font-weight: 600;
            font-size: 11px;
          }
          
          .no-days {
            text-align: center;
            color: #000;
            font-style: italic;
            padding: 10px;
            font-size: 11px;
          }
          
          .earnings-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
            font-size: 15px;
          }
          
          .earnings-table th {
            background: #f0f0f0;
            padding: 10px 14px;
            text-align: left;
            font-size: 14px;
            font-weight: 600;
            color: #000;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
          }
          
          .earnings-table th:last-child {
            text-align: right;
          }
          
          .earnings-table td {
            padding: 10px 14px;
            font-size: 15px;
            color: #000;
            border-bottom: 1px solid #eee;
          }
          
          .earnings-table .amount {
            text-align: right;
            font-weight: 600;
            color: #000;
          }
          
          
          .deductions {
            margin-bottom: 10px;
          }
          
          .deduction-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            font-size: 13px;
            color: #000;
          }
          
          .total-deductions {
            font-weight: 700;
            color: #000;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #000;
          }
          
          .net-pay {
            padding: 10px;
            text-align: center;
            background: #f0f0f0;
            border: 1px solid #000;
          }
          
          .net-pay-label {
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 4px;
            color: #000;
          }
          
          .net-pay-amount {
            font-size: 18px;
            font-weight: 700;
            color: #000;
          }
          
          .footer {
            text-align: center;
            font-size: 10px;
            color: #000;
            margin-top: 10px;
            padding-top: 6px;
            border-top: 1px solid #000;
          }
          
          .footer p {
            margin-bottom: 3px;
          }
          
          @media print {
            body {
              background: white;
              margin: 0;
              padding: 0;
            }
            .payslip {
              box-shadow: none;
              margin: 0;
              border: none;
              padding: 0.15in;
              width: 7.5in;
            }
            @page {
              margin: 0.5in;
              size: letter;
            }
          }
        </style>
      </head>
      <body>
        <div class="payslip">
          <div class="header">
            <div class="company-name">Gilnaks Food Corporation</div>
            <div class="payslip-title">PAYSLIP</div>
            <div class="generated-date">Generated on: ${payslipDate}</div>
          </div>
          
          <div class="employee-info">
            <div class="info-item">
              <div class="info-label">Employee</div>
              <div class="info-value">${entry.staffName}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Period</div>
              <div class="info-value">${periodText}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Rate</div>
              <div class="info-value">₱${entry.hourlyRate.toFixed(2)}/hr</div>
            </div>
          </div>
          
          <div class="days-worked">
            <div class="section-title">Days Worked</div>
            ${generateDaysWorked()}
          </div>
          
          <div class="section-title">Earnings Breakdown</div>
          <table class="earnings-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Hours</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Regular Hours</td>
                <td>${entry.regularHours.toFixed(1)}</td>
                <td>₱${entry.hourlyRate.toFixed(2)}</td>
                <td class="amount">₱${entry.regularPay.toFixed(2)}</td>
              </tr>
              ${entry.doublePay > 0 ? `
              <tr>
                <td>Regular Holiday (x2)</td>
                <td>${entry.doublePayHours.toFixed(1)}</td>
                <td>₱${(entry.hourlyRate * 2).toFixed(2)}</td>
                <td class="amount">₱${entry.doublePay.toFixed(2)}</td>
              </tr>
              ` : ''}
              ${entry.specialPay > 0 ? `
              <tr>
                <td>Special Holiday (1.3x)</td>
                <td>${entry.specialPayHours.toFixed(1)}</td>
                <td>₱${(entry.hourlyRate * 1.3).toFixed(2)}</td>
                <td class="amount">₱${entry.specialPay.toFixed(2)}</td>
              </tr>
              ` : ''}
                    ${entry.overtimePay > 0 ? `
                    <tr>
                      <td>Overtime (after 48 hrs)</td>
                      <td>${entry.overtimeHours.toFixed(1)}</td>
                      <td>₱${(entry.hourlyRate * 1.25).toFixed(2)}</td>
                      <td class="amount">₱${entry.overtimePay.toFixed(2)}</td>
                    </tr>
                    ` : ''}
                    <tr style="border-top: 2px solid #000; font-weight: 700;">
                      <td>TOTAL PAY</td>
                      <td></td>
                      <td></td>
                      <td class="amount">₱${entry.totalPay.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
          
          <div class="deductions">
            <div class="section-title">Deductions & Refunds</div>
            <div class="deduction-row">
              <span>Utilities</span>
              <span>₱${entry.deductions.utilities.toFixed(2)}</span>
            </div>
            <div class="deduction-row">
              <span>Shortages</span>
              <span>₱${entry.deductions.shortages.toFixed(2)}</span>
            </div>
            <div class="deduction-row">
              <span>Cash Advances</span>
              <span>₱${entry.deductions.cashAdvances.toFixed(2)}</span>
            </div>
            <div class="deduction-row">
              <span>Penalties</span>
              <span>₱${entry.deductions.penalties.toFixed(2)}</span>
            </div>
            <div class="deduction-row">
              <span>Others</span>
              <span>₱${entry.deductions.others.toFixed(2)}</span>
            </div>
            <div class="deduction-row total-deductions">
              <span>DEDUCTIONS</span>
              <span>₱${Object.values(entry.deductions).reduce((sum, amount) => sum + amount, 0).toFixed(2)}</span>
            </div>
            ${entry.refunds > 0 ? `
            <div class="deduction-row" style="color: #000; font-weight: 600; margin-top: 8px;">
              <span>Refunds</span>
              <span>+₱${entry.refunds.toFixed(2)}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="net-pay">
            <div class="net-pay-label">NET PAY</div>
            <div class="net-pay-amount">₱${entry.netPay.toFixed(2)}</div>
          </div>
          
          <div class="footer">
            <p>This payslip is computer generated and does not require a signature.</p>
            <p>For inquiries, please contact the HR department.</p>
          </div>
        </div>
      </body>
      </html>
    `

          // Create hidden iframe for printing
          const iframe = document.createElement('iframe')
          iframe.style.position = 'absolute'
          iframe.style.left = '-9999px'
          iframe.style.top = '-9999px'
          iframe.style.width = '0'
          iframe.style.height = '0'
          iframe.style.border = 'none'
          
          document.body.appendChild(iframe)
          
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
          if (iframeDoc) {
            iframeDoc.open()
            iframeDoc.write(payslipHTML)
            iframeDoc.close()
            
            // Wait for content to load, then print
            iframe.onload = () => {
              iframe.contentWindow?.focus()
              iframe.contentWindow?.print()
              
              // Clean up iframe after printing
              setTimeout(() => {
                document.body.removeChild(iframe)
              }, 1000)
            }
          }
  }

  const printAllPayslips = () => {
    const entries = getPayrollEntries()
    if (entries.length === 0) return

    const currentDate = new Date()
    const payslipDate = currentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    
    const periodText = getDateRangeText()

    // Generate all payslips
    const allPayslipsHTML = entries.map((entry, index) => {
      // Generate days worked section
      const generateDaysWorked = () => {
        if (!entry.locationGroups || Object.keys(entry.locationGroups).length === 0) {
          return '<div class="no-days">No days worked recorded</div>'
        }

        let daysHTML = ''
        Object.entries(entry.locationGroups).forEach(([locationName, days]) => {
          daysHTML += `
            <div class="location-group">
              <div class="location-header">${locationName}</div>
              <div class="days-grid">
                ${(days as any[]).map(day => {
                  const dayStatus = getDayStatusForDate(day.scheduleDate)
                  const statusClass = dayStatus === 'regular-holiday' ? 'holiday' : 
                                    dayStatus === 'special-holiday' ? 'special' : 'regular'
                  return `
                    <div class="day-item ${statusClass}">
                      <div class="day-date">${day.date}</div>
                      <div class="day-name">${day.dayName}</div>
                      <div class="day-hours">${day.hours}h</div>
                    </div>
                  `
                }).join('')}
              </div>
            </div>
          `
        })
        return daysHTML
      }

      return `
        ${index > 0 ? '<div style="page-break-before: always;"></div>' : ''}
        <div class="payslip">
          <div class="header">
            <div class="company-name">Gilnaks Food Corporation</div>
            <div class="payslip-title">PAYSLIP</div>
            <div class="generated-date">Generated on: ${payslipDate}</div>
          </div>
          
          <div class="employee-info">
            <div class="info-item">
              <div class="info-label">Employee</div>
              <div class="info-value">${entry.staffName}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Period</div>
              <div class="info-value">${periodText}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Rate</div>
              <div class="info-value">₱${entry.hourlyRate.toFixed(2)}/hr</div>
            </div>
          </div>
          
          <div class="days-worked">
            <div class="section-title">Days Worked</div>
            ${generateDaysWorked()}
          </div>
          
          <div class="section-title">Earnings Breakdown</div>
          <table class="earnings-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Hours</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Regular Hours</td>
                <td>${entry.regularHours.toFixed(1)}</td>
                <td>₱${entry.hourlyRate.toFixed(2)}</td>
                <td class="amount">₱${entry.regularPay.toFixed(2)}</td>
              </tr>
              ${entry.doublePay > 0 ? `
              <tr>
                <td>Regular Holiday (x2)</td>
                <td>${entry.doublePayHours.toFixed(1)}</td>
                <td>₱${(entry.hourlyRate * 2).toFixed(2)}</td>
                <td class="amount">₱${entry.doublePay.toFixed(2)}</td>
              </tr>
              ` : ''}
              ${entry.specialPay > 0 ? `
              <tr>
                <td>Special Holiday (1.3x)</td>
                <td>${entry.specialPayHours.toFixed(1)}</td>
                <td>₱${(entry.hourlyRate * 1.3).toFixed(2)}</td>
                <td class="amount">₱${entry.specialPay.toFixed(2)}</td>
              </tr>
              ` : ''}
              ${entry.overtimePay > 0 ? `
              <tr>
                <td>Overtime (after 48 hrs)</td>
                <td>${entry.overtimeHours.toFixed(1)}</td>
                <td>₱${(entry.hourlyRate * 1.25).toFixed(2)}</td>
                <td class="amount">₱${entry.overtimePay.toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr style="border-top: 2px solid #000; font-weight: 700;">
                <td>TOTAL PAY</td>
                <td></td>
                <td></td>
                <td class="amount">₱${entry.totalPay.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="deductions">
            <div class="section-title">Deductions & Refunds</div>
            <div class="deduction-row">
              <span>Utilities</span>
              <span>₱${entry.deductions.utilities.toFixed(2)}</span>
            </div>
            <div class="deduction-row">
              <span>Shortages</span>
              <span>₱${entry.deductions.shortages.toFixed(2)}</span>
            </div>
            <div class="deduction-row">
              <span>Cash Advances</span>
              <span>₱${entry.deductions.cashAdvances.toFixed(2)}</span>
            </div>
            <div class="deduction-row">
              <span>Penalties</span>
              <span>₱${entry.deductions.penalties.toFixed(2)}</span>
            </div>
            <div class="deduction-row">
              <span>Others</span>
              <span>₱${entry.deductions.others.toFixed(2)}</span>
            </div>
            <div class="deduction-row total-deductions">
              <span>DEDUCTIONS</span>
              <span>₱${(Object.values(entry.deductions).reduce((sum: number, amount: any) => sum + (amount || 0), 0) as number).toFixed(2)}</span>
            </div>
            ${entry.refunds > 0 ? `
            <div class="deduction-row" style="color: #000; font-weight: 600; margin-top: 8px;">
              <span>Refunds</span>
              <span>+₱${entry.refunds.toFixed(2)}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="net-pay">
            <div class="net-pay-label">NET PAY</div>
            <div class="net-pay-amount">₱${entry.netPay.toFixed(2)}</div>
          </div>
          
          <div class="footer">
            <p>This payslip is computer generated and does not require a signature.</p>
            <p>For inquiries, please contact the HR department.</p>
          </div>
        </div>
      `
    }).join('')

    const fullHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>All Payslips</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
          }
          
          .payslip {
            width: 7.5in;
            margin: 0 auto;
            background: white;
            padding: 0.15in;
            font-size: 12px;
            line-height: 1.3;
          }
          
          .header {
            text-align: center;
            margin-bottom: 10px;
          }
          
          .company-name {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 3px;
            color: #000;
          }
          
          .payslip-title {
            font-size: 16px;
            font-weight: 500;
            margin-bottom: 3px;
            color: #000;
          }
          
          .generated-date {
            font-size: 11px;
            color: #000;
          }
          
          .employee-info {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 30px;
            margin-bottom: 12px;
          }
          
          .info-item {
            text-align: center;
          }
          
          .info-label {
            font-size: 10px;
            font-weight: 600;
            color: #000;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          
          .info-value {
            font-size: 14px;
            font-weight: 600;
            color: #000;
          }
          
          .section-title {
            font-size: 14px;
            font-weight: 700;
            color: #000;
            margin: 10px 0 6px 0;
          }
          
          .days-worked {
            margin-bottom: 12px;
          }
          
          .location-group {
            margin-bottom: 8px;
            display: inline-block;
            margin-right: 20px;
            vertical-align: top;
          }
          
          .location-header {
            font-size: 13px;
            font-weight: 600;
            color: #000;
            margin-bottom: 6px;
            padding: 4px 0;
            background: #f0f0f0;
            text-align: center;
          }
          
          .days-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(55px, 1fr));
            gap: 5px;
            max-width: 200px;
            justify-content: center;
          }
          
          .day-item {
            padding: 5px;
            text-align: center;
            font-size: 12px;
            background: white;
            color: #000;
            border: 1px solid #ddd;
          }
          
          .day-item.regular {
            background: white;
            color: #000;
          }
          
          .day-item.holiday {
            background: #f0f0f0;
            color: #000;
          }
          
          .day-item.special {
            background: #e0e0e0;
            color: #000;
          }
          
          .day-date {
            font-weight: 600;
            font-size: 11px;
            margin-bottom: 3px;
          }
          
          .day-name {
            font-size: 10px;
            opacity: 0.8;
            margin-bottom: 3px;
          }
          
          .day-hours {
            font-weight: 600;
            font-size: 11px;
          }
          
          .no-days {
            text-align: center;
            color: #000;
            font-style: italic;
            padding: 10px;
            font-size: 11px;
          }
          
          .earnings-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
            font-size: 15px;
          }
          
          .earnings-table th {
            background: #f0f0f0;
            padding: 10px 14px;
            text-align: left;
            font-size: 14px;
            font-weight: 600;
            color: #000;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
          }
          
          .earnings-table th:last-child {
            text-align: right;
          }
          
          .earnings-table td {
            padding: 10px 14px;
            font-size: 15px;
            color: #000;
            border-bottom: 1px solid #eee;
          }
          
          .earnings-table .amount {
            text-align: right;
            font-weight: 600;
            color: #000;
          }
          
          .deductions {
            margin-bottom: 10px;
          }
          
          .deduction-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            font-size: 13px;
            color: #000;
          }
          
          .total-deductions {
            font-weight: 700;
            color: #000;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #000;
          }
          
          .net-pay {
            padding: 10px;
            text-align: center;
            background: #f0f0f0;
            border: 1px solid #000;
          }
          
          .net-pay-label {
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 4px;
            color: #000;
          }
          
          .net-pay-amount {
            font-size: 18px;
            font-weight: 700;
            color: #000;
          }
          
          .footer {
            text-align: center;
            font-size: 10px;
            color: #000;
            margin-top: 10px;
            padding-top: 6px;
            border-top: 1px solid #000;
          }
          
          .footer p {
            margin-bottom: 3px;
          }
          
          @media print {
            body {
              background: white;
              margin: 0;
              padding: 0;
            }
            .payslip {
              box-shadow: none;
              margin: 0;
              border: none;
              padding: 0.15in;
              width: 7.5in;
            }
            @page {
              margin: 0.5in;
              size: letter;
            }
          }
        </style>
      </head>
      <body>
        ${allPayslipsHTML}
      </body>
      </html>
    `

    // Create hidden iframe for printing
    const iframe = document.createElement('iframe')
    iframe.style.position = 'absolute'
    iframe.style.left = '-9999px'
    iframe.style.top = '-9999px'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    
    document.body.appendChild(iframe)
    
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (iframeDoc) {
      iframeDoc.open()
      iframeDoc.write(fullHTML)
      iframeDoc.close()
      
      // Wait for content to load, then print
      iframe.onload = () => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        
        // Clean up iframe after printing
        setTimeout(() => {
          document.body.removeChild(iframe)
        }, 1000)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payroll data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-600">Track staff hours and calculate payroll</p>
        </div>
      </div>

      {/* Period Selection */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Period:</label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as 'weekly' | 'custom')}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="weekly" className="text-gray-900">Weekly</option>
                <option value="custom" className="text-gray-900">Custom</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">
                {selectedPeriod === 'weekly' ? 'Week:' : 'Date Range:'}
              </label>
              
              {/* Date Display Button */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowCalendar(!showCalendar)
                    setCalendarClosed(!showCalendar) // Update calendar closed state
                  }}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors min-w-[200px]"
                >
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-900">{getFormattedDate()}</span>
                </button>
                
                {/* Popup Calendar */}
                {showCalendar && (
                  <>
                    {/* Backdrop */}
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => {
                        setShowCalendar(false)
                        setCalendarClosed(true) // Mark calendar as closed to trigger data refresh
                      }}
                    />
                    
                    {/* Calendar Popup */}
                    <div className="absolute top-full mt-2 left-0 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-20 w-80">
                      {/* Header with close button */}
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-900">Select Date</h3>
                        <button
                          onClick={() => {
                            setShowCalendar(false)
                            setCalendarClosed(true) // Mark calendar as closed to trigger data refresh
                          }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Month Navigation */}
                      <div className="flex items-center justify-between mb-4">
                        <button
                          onClick={() => {
                            const newDate = new Date(calendarDate)
                            newDate.setMonth(calendarDate.getMonth() - 1)
                            setCalendarDate(newDate)
                            
                            // Only reload data if weekly period
                            if (selectedPeriod === 'weekly') {
                              setSelectedDate(newDate)
                            }
                          }}
                          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                          title="Previous Month"
                        >
                          <ChevronLeft className="h-4 w-4 text-gray-600" />
                        </button>
                        
                        <span className="text-sm font-semibold text-gray-900">
                          {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                        
                        <button
                          onClick={() => {
                            const newDate = new Date(calendarDate)
                            newDate.setMonth(calendarDate.getMonth() + 1)
                            setCalendarDate(newDate)
                            
                            // Only reload data if weekly period
                            if (selectedPeriod === 'weekly') {
                              setSelectedDate(newDate)
                            }
                          }}
                          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                          title="Next Month"
                        >
                          <ChevronRight className="h-4 w-4 text-gray-600" />
                        </button>
                      </div>
                      
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Day headers - Start with Sunday */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
                  {day}
                </div>
              ))}
                        
                        {/* Calendar days */}
                        {getCalendarDays().map((date, index) => {
                          if (!date) {
                            return <div key={`empty-${index}`} className="aspect-square" />
                          }
                          
                          const isSelected = isSelectedDate(date)
                          const isInWeek = selectedPeriod === 'weekly' && isInSelectedWeek(date)
                          const isInCustomRange = selectedPeriod === 'custom' && isInSelectedWeek(date)
                          const isCustomStart = selectedPeriod === 'custom' && customStartDate && 
                            date.getFullYear() === customStartDate.getFullYear() &&
                            date.getMonth() === customStartDate.getMonth() &&
                            date.getDate() === customStartDate.getDate()
                          const isCustomEnd = selectedPeriod === 'custom' && customEndDate && 
                            date.getFullYear() === customEndDate.getFullYear() &&
                            date.getMonth() === customEndDate.getMonth() &&
                            date.getDate() === customEndDate.getDate()
                          const isToday = date.toDateString() === new Date().toDateString()
                          
                          // Determine the appropriate styling
                          let buttonClass = 'aspect-square p-2 text-sm rounded-lg transition-all duration-150 font-medium'
                          
                          if (selectedPeriod === 'custom') {
                            if (isCustomStart || isCustomEnd) {
                              buttonClass += ' bg-green-600 text-white font-bold ring-2 ring-green-400'
                            } else if (isInCustomRange) {
                              buttonClass += ' bg-green-100 text-green-900 font-semibold'
                            } else if (isToday) {
                              buttonClass += ' ring-2 ring-blue-500 text-blue-600 hover:bg-gray-100'
                            } else {
                              // Add subtle indication for dates that can be selected
                              buttonClass += ' hover:bg-gray-100 text-gray-700 hover:ring-1 hover:ring-green-300'
                            }
                          } else if (selectedPeriod === 'weekly') {
                            if (isSelected) {
                              buttonClass += ' bg-blue-600 text-white font-bold ring-2 ring-blue-400'
                            } else if (isInWeek) {
                              buttonClass += ' bg-blue-100 text-blue-900 font-semibold'
                            } else if (isToday) {
                              buttonClass += ' ring-2 ring-blue-500 text-blue-600 hover:bg-gray-100'
                            } else {
                              buttonClass += ' hover:bg-gray-100 text-gray-700'
                            }
                          }
                          
                          return (
                            <button
                              key={index}
                              onClick={() => handleDayClick(date)}
                              className={buttonClass}
                              title={
                                isInWeek && selectedPeriod === 'weekly' ? 'In selected week' :
                                isCustomStart ? 'Start date' :
                                isCustomEnd ? 'End date' :
                                isInCustomRange ? 'In selected range' : ''
                              }
                            >
                              {date.getDate()}
                            </button>
                          )
                        })}
                      </div>
                      
            {selectedPeriod === 'weekly' && (
              <p className="text-xs text-gray-500 mt-3 text-center">
                Click any day to select its week (Sunday-Saturday)
              </p>
            )}
            {selectedPeriod === 'custom' && (
              <div className="mt-3 text-center">
                <div className="flex justify-center space-x-3">
                  {(customStartDate || customEndDate) && (
                    <button
                      onClick={() => {
                        setCustomStartDate(null)
                        setCustomEndDate(null)
                        setSelectingStartDate(true)
                      }}
                      className="text-xs text-red-600 hover:text-red-800 underline"
                    >
                      Reset
                    </button>
                  )}
                  {customStartDate && customEndDate && (
                    <button
                      onClick={() => {
                        setShowCalendar(false)
                        setCalendarClosed(true) // Mark calendar as closed to trigger data refresh
                      }}
                      className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            )}
                    </div>
                  </>
                )}
              </div>
              
              <div className="text-sm text-gray-600">
                <span className="font-medium">Range:</span> {getDateRangeText()}
              </div>
            </div>
          </div>
          
          {/* Staff Filter */}
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Staff:</label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[150px]"
            >
              <option value="all" className="text-gray-900">All Staff</option>
              {staff.map((staffMember) => (
                <option key={staffMember.id} value={staffMember.id} className="text-gray-900">
                  {staffMember.full_name}
                </option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Regular Hours</p>
              <p className="text-2xl font-semibold text-gray-900">
                {getTotalRegularHours().toFixed(1)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Double Pay (x2)</p>
              <p className="text-2xl font-semibold text-gray-900">
                {getTotalDoublePayHours().toFixed(1)} hrs
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Clock className="h-6 w-6 text-violet-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Special Pay (1.3x)</p>
              <p className="text-2xl font-semibold text-gray-900">
                {getTotalSpecialPayHours().toFixed(1)} hrs
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calculator className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Net Pay</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(getTotalNetPay())}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
         <div className="px-6 py-4 border-b border-gray-200">
           <div className="flex items-center justify-between">
             <h3 className="text-lg font-medium text-gray-900">
               {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} Payroll Details
             </h3>
             <div className="flex items-center space-x-4">
               {/* Save Deductions & Refunds Button - Only show for weekly period */}
               {selectedPeriod === 'weekly' && (
                 <button
                   onClick={saveDeductionsAndRefunds}
                   disabled={savingDeductions}
                   className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {savingDeductions ? (
                     <>
                       <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                       <span>Saving...</span>
                     </>
                   ) : (
                     <>
                       <Save className="h-4 w-4" />
                       <span>Save Deductions & Refunds</span>
                     </>
                   )}
                 </button>
               )}
               <button
                 onClick={printAllPayslips}
                 className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
               >
                 <Printer className="h-4 w-4" />
                 <span>Print All</span>
               </button>
             </div>
           </div>
         </div>
        
        {!hasPayrollData() ? (
          <div className="p-12 text-center">
            <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No payroll data</h3>
            <p className="text-gray-600">No staff scheduled for the selected period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
               <thead className="bg-gray-50">
                 <tr>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Staff Member
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Days Worked
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Hours Breakdown
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Pay Breakdown
                   </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deductions & Refunds
                  </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Net Pay
                   </th>
                 </tr>
               </thead>
               <tbody className="bg-white divide-y divide-gray-200">
                 {getPayrollEntries().map((entry, index) => (
                   <tr 
                     key={index} 
                     className="hover:bg-gray-50 cursor-pointer transition-colors duration-200 hover:shadow-md"
                     onClick={() => generatePayslip(entry)}
                     title="Click to print payslip"
                   >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="font-medium text-gray-900">{entry.staffName}</div>
                      <div className="text-xs text-gray-600 font-medium">₱{entry.hourlyRate.toFixed(2)}/hr</div>
                      {entry.dailySalesBreakdown && entry.dailySalesBreakdown.length > 0 && (
                        <div className="mt-1 text-xs">
                          <div className="text-gray-500 font-semibold mb-0.5">Daily Sales (This Week):</div>
                          <div className="space-y-0.5 max-h-20 overflow-y-auto">
                            {entry.dailySalesBreakdown
                              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                              .map((daySale, idx) => (
                              <div key={idx} className="flex justify-between text-gray-600">
                                <span>{new Date(daySale.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}:</span>
                                <span className="font-medium">₱{daySale.sales.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {entry.averageWeeklySales !== undefined && entry.averageWeeklySales > 0 && (
                        <div className="text-xs text-blue-600 font-medium mt-1 pt-1 border-t border-gray-200">
                          Avg Sales This Week: ₱{entry.averageWeeklySales.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      )}
                      {entry.averageMonthlySales !== undefined && entry.averageMonthlySales > 0 && (
                        <div className="text-xs text-green-600 font-medium mt-0.5">
                          Avg Sales This Month: ₱{entry.averageMonthlySales.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      )}
                    </td>
                     <td className="px-6 py-4 text-sm text-gray-900">
                       <div className="space-y-3">
                         {Object.entries(entry.locationGroups).map(([locationName, days]) => (
                           <div key={locationName} className="space-y-2">
                             <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                               {locationName} - {(days as any[])[0]?.brandName || 'Unknown Brand'}
                             </div>
                              <div className="grid grid-cols-3 gap-2 max-w-md">
                               {(days as any[]).map((day, dayIndex) => {
                                 const dayStatus = getDayStatusForDate(day.scheduleDate)
                                 const colorClasses = day.isAbsent 
                                   ? 'bg-red-200 text-red-900 border border-red-300'
                                   : getDayColorClasses(dayStatus)
                                 
                                 return (
                                   <div
                                     key={dayIndex}
                                     className={`inline-flex flex-col items-center justify-center px-2 py-1 rounded-lg text-xs font-medium ${colorClasses}`}
                                   >
                                     <span className="font-semibold">{day.date}</span>
                                     <span className="text-xs opacity-75">{day.dayName} {day.hours}h</span>
                                     {day.isAbsent && <span className="text-[9px] font-semibold">ABSENT</span>}
                                   </div>
                                 )
                               })}
                             </div>
                           </div>
                         ))}
                       </div>
                     </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Regular:</span>
                          <span className="font-medium">{entry.regularHours.toFixed(1)} hrs</span>
                        </div>
                        {entry.doublePayHours > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Double (x2):</span>
                            <span className="font-medium text-orange-600">{entry.doublePayHours.toFixed(1)} hrs</span>
                          </div>
                        )}
                        {entry.specialPayHours > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Special (1.3x):</span>
                            <span className="font-medium text-violet-600">{entry.specialPayHours.toFixed(1)} hrs</span>
                          </div>
                        )}
                        {entry.overtimeHours > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Overtime:</span>
                            <span className="font-medium text-red-600">{entry.overtimeHours.toFixed(1)} hrs</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t pt-1">
                          <span className="text-gray-600 font-medium">Total:</span>
                          <span className="font-bold">{entry.hours.toFixed(1)} hrs</span>
                        </div>
                      </div>
                    </td>
                     <td className="px-6 py-4 text-sm text-gray-900">
                       <div className="space-y-1">
                         <div className="flex justify-end">
                           <span className="font-medium">{formatCurrency(entry.regularPay)}</span>
                         </div>
                         {entry.doublePay > 0 && (
                           <div className="flex justify-end">
                             <span className="font-medium text-orange-600">{formatCurrency(entry.doublePay)}</span>
                           </div>
                         )}
                         {entry.specialPay > 0 && (
                           <div className="flex justify-end">
                             <span className="font-medium text-violet-600">{formatCurrency(entry.specialPay)}</span>
                           </div>
                         )}
                         {entry.overtimePay > 0 && (
                           <div className="flex justify-end">
                             <span className="font-medium text-red-600">{formatCurrency(entry.overtimePay)}</span>
                           </div>
                         )}
                         <div className="flex justify-end border-t pt-1">
                           <span className="font-bold text-green-600">{formatCurrency(entry.totalPay)}</span>
                         </div>
                       </div>
                     </td>
                     <td className="px-6 py-4 text-sm text-gray-900">
                       <div className="space-y-2">
                         <div className="flex justify-between items-center">
                           <span className="text-gray-600 text-xs">Utilities:</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={getInputValue(entry.staffId, 'utilities', entry.deductions.utilities)}
                                onChange={(e) => updateInputValue(entry.staffId, 'utilities', e.target.value)}
                                className="w-12 text-xs border border-gray-300 rounded px-1 py-1 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                onClick={(e) => e.stopPropagation()}
                                onFocus={(e) => e.stopPropagation()}
                                onBlur={(e) => e.stopPropagation()}
                              />
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-gray-600 text-xs">Shortages:</span>
                           <input
                             type="number"
                             min="0"
                             step="0.01"
                             value={getInputValue(entry.staffId, 'shortages', entry.deductions.shortages)}
                             onChange={(e) => updateInputValue(entry.staffId, 'shortages', e.target.value)}
                             className="w-12 text-xs border border-gray-300 rounded px-1 py-1 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                             onClick={(e) => e.stopPropagation()}
                             onFocus={(e) => e.stopPropagation()}
                             onBlur={(e) => e.stopPropagation()}
                           />
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-gray-600 text-xs">Cash Advances:</span>
                           <input
                             type="number"
                             min="0"
                             step="0.01"
                             value={getInputValue(entry.staffId, 'cashAdvances', entry.deductions.cashAdvances)}
                             onChange={(e) => updateInputValue(entry.staffId, 'cashAdvances', e.target.value)}
                             className="w-12 text-xs border border-gray-300 rounded px-1 py-1 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                             onClick={(e) => e.stopPropagation()}
                             onFocus={(e) => e.stopPropagation()}
                             onBlur={(e) => e.stopPropagation()}
                           />
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-gray-600 text-xs">Penalties:</span>
                           <input
                             type="number"
                             min="0"
                             step="0.01"
                             value={getInputValue(entry.staffId, 'penalties', entry.deductions.penalties)}
                             onChange={(e) => updateInputValue(entry.staffId, 'penalties', e.target.value)}
                             className="w-12 text-xs border border-gray-300 rounded px-1 py-1 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                             onClick={(e) => e.stopPropagation()}
                             onFocus={(e) => e.stopPropagation()}
                             onBlur={(e) => e.stopPropagation()}
                           />
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-gray-600 text-xs">Others:</span>
                           <input
                             type="number"
                             min="0"
                             step="0.01"
                             value={getInputValue(entry.staffId, 'others', entry.deductions.others)}
                             onChange={(e) => updateInputValue(entry.staffId, 'others', e.target.value)}
                             className="w-12 text-xs border border-gray-300 rounded px-1 py-1 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                             onClick={(e) => e.stopPropagation()}
                             onFocus={(e) => e.stopPropagation()}
                             onBlur={(e) => e.stopPropagation()}
                           />
                         </div>
                        <div className="flex justify-between border-t pt-1">
                          <span className="text-gray-600 font-medium text-xs">Deductions:</span>
                          <span className="font-bold text-red-600 text-xs">{formatCurrency(Number(Object.values(entry.deductions).reduce((sum: number, amount: any) => sum + (amount || 0), 0)))}</span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-gray-600 text-xs">Refunds:</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={getInputValue(entry.staffId, 'refunds', entry.refunds)}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0
                              setRefunds(prev => ({
                                ...prev,
                                [entry.staffId]: value
                              }))
                              updateInputValue(entry.staffId, 'refunds', e.target.value)
                            }}
                            className="w-12 text-xs border border-gray-300 rounded px-1 py-1 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => e.stopPropagation()}
                            onBlur={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                    </td>
                     <td className="px-6 py-4 text-sm text-gray-900">
                       <div className="text-right">
                         <span className="text-lg font-bold text-blue-600">{formatCurrency(entry.netPay)}</span>
                       </div>
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <p className="text-green-800">{success}</p>
        </div>
      )}
    </div>
  )
}

