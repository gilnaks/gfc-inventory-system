'use client'
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase, type Brand, type PayrollRun, type PayrollRunBrandTotal } from '../../lib/supabase'
import {
  calculateStaffPayrollCoreByWeeks,
  fetchDayStatusMapForPeriod,
  mergeDayStatusIntoMap,
} from '../../lib/payroll-calculation'
import { computeIncentivesForPeriod } from '../../lib/payroll-incentive'
import {
  approveAndPostPayrollAccrual,
  finalizePayrollRun,
  loadPayrollRunByWeek,
  voidPayrollRun,
} from '../../lib/payroll-run-service'
import {
  aggregatePayrollDeductionsByWeek,
  buildLivePayrollEntry,
  getDeductionsForStaffFromState,
  resolveLiveDeductions,
  resolveLiveRefunds,
  savePayrollDeductionsForWeek,
  serializeDeductionsState,
  type PayrollDeductionsRecord,
} from '../../lib/payroll-deductions-service'
import { fetchOpenAdvanceBalancesByStaff } from '../../lib/staff-advance-service'
import { Calculator, Clock, DollarSign, Calendar, TrendingUp, Users, Printer, ChevronLeft, ChevronRight, CheckCircle, FileCheck, RotateCcw, MapPin } from 'lucide-react'
import { useBrands } from '../contexts/BrandsContext'
import { getFactoryBrand, isFactoryBrand } from '../../lib/brand-roles'
import {
  FranchisePerformanceFilter,
  type FranchiseFilterValue,
} from './FranchisePerformanceFilter'
import { getBrandColorKey, getBrandTagClasses } from '../../lib/brand-colors'
import {
  buildPayslipBodyHtml,
  buildPayslipDocumentHtml,
  printPayslipHtml,
  type PayslipDayStatus,
} from '../../lib/print-payslip'
import {
  dashboardThemeAccentText,
  dashboardThemeCalendarDoneButton,
  dashboardThemeCalendarHover,
  dashboardThemeCalendarInRange,
  dashboardThemeCalendarSelected,
  dashboardThemeCalendarToday,
  dashboardThemeDayWorked,
  dashboardThemeIcon,
  dashboardThemeIconBadge,
  dashboardThemePillActive,
  dashboardThemeSelectFocus,
  accountingThemeSolidButton,
} from '../../lib/accounting-theme'
import {
  getAttendancePeriodLabel,
  getAttendancePeriodRange,
  getPhilippinesWeekRange,
  listPhilippinesWeekStartsInRange,
  loadGfcMainStaff,
  loadGfcMainFactoryLocations,
  PAYROLL_PERIOD_LABELS,
  PAYROLL_PERIOD_OPTIONS,
  type AttendancePeriod,
  type PayrollPeriod,
} from '../../lib/gfc-attendance'
import {
  enrichSchedulesWithAttendance,
  type FactoryLocationInfo,
} from '../../lib/payroll-attendance'

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
  incentivePay: number
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
  dailyIncentiveBreakdown?: Record<string, number>
}

interface PayrollSummary {
  weekly: { [week: string]: PayrollData[] }
  custom: PayrollData[]
  totals: {
    weekly: number
    custom: number
  }
}

interface PayrollManagerProps {
  selectedBrand?: Brand | null
  theme?: string
  currentUsername?: string
}

function PayrollContentSkeleton({ showPayrollRun = false }: { showPayrollRun?: boolean }) {
  return (
    <>
      {showPayrollRun && (
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
          <div className="h-5 bg-gray-200 rounded w-28 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-56 animate-pulse" />
          <div className="flex flex-wrap gap-2">
            <div className="h-9 bg-gray-200 rounded w-40 animate-pulse" />
            <div className="h-9 bg-gray-200 rounded w-44 animate-pulse" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, idx) => (
          <div key={idx} className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-gray-200 rounded-lg animate-pulse">
                <div className="h-6 w-6" />
              </div>
              <div className="ml-4 flex-1">
                <div className="h-4 bg-gray-200 rounded w-20 mb-2 animate-pulse" />
                <div className="h-8 bg-gray-200 rounded w-16 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse" />
        </div>
        <div>
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[...Array(4)].map((_, i) => (
                  <th key={i} className="px-6 py-3 text-left">
                    <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[...Array(5)].map((_, rowIdx) => (
                <tr key={rowIdx}>
                  {[...Array(4)].map((_, cellIdx) => (
                    <td key={cellIdx} className="px-6 py-4 whitespace-nowrap">
                      <div className="h-6 bg-gray-200 rounded w-24 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function PayrollFullPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <div className="h-8 bg-gray-200 rounded w-32 mb-2 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-64 animate-pulse" />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex flex-wrap gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded w-24 animate-pulse" />
            ))}
          </div>
          <div className="h-10 bg-gray-200 rounded w-40 animate-pulse" />
        </div>
      </div>

      <PayrollContentSkeleton showPayrollRun />
    </div>
  )
}

export function PayrollManager({
  selectedBrand = null,
  theme = 'blue',
  currentUsername = 'system',
}: PayrollManagerProps = {}) {
  const { brands } = useBrands()
  const factoryBrand = useMemo(() => getFactoryBrand(brands), [brands])
  const isGfcMain = useMemo(() => isFactoryBrand(selectedBrand), [selectedBrand])
  const [franchiseFilter, setFranchiseFilter] = useState<FranchiseFilterValue>('all')
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
  const [periodLoading, setPeriodLoading] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod>('week')
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null)
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null)
  const [calendarDate, setCalendarDate] = useState(new Date()) // For calendar navigation
  const [showCalendar, setShowCalendar] = useState(false) // For popup calendar
  const [selectingStartDate, setSelectingStartDate] = useState(true) // Track which date is being selected
  const [calendarClosed, setCalendarClosed] = useState(true) // Track if calendar is closed
  const payrollLoadedRef = useRef(false)
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
  const [deductionsSaveStatus, setDeductionsSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved')
  const deductionsSaveSnapshotRef = useRef<string>('')
  const [companyLocationIds, setCompanyLocationIds] = useState<string[]>([])
  const [gfcMainStaffIds, setGfcMainStaffIds] = useState<Set<string>>(new Set())
  const [factoryLocations, setFactoryLocations] = useState<FactoryLocationInfo[]>([])
  const [payrollRun, setPayrollRun] = useState<PayrollRun | null>(null)
  const [payrollBrandTotals, setPayrollBrandTotals] = useState<PayrollRunBrandTotal[]>([])
  const [deductionsRefundIds, setDeductionsRefundIds] = useState<Record<string, string>>({})
  const [dsirShortageDefaults, setDsirShortageDefaults] = useState<Record<string, number>>({})
  const [advanceBalanceDefaults, setAdvanceBalanceDefaults] = useState<Record<string, number>>({})
  const [dsirDiscrepancyByStaffDate, setDsirDiscrepancyByStaffDate] = useState<Record<string, Record<string, number>>>({})
  const [shortagesManuallyEdited, setShortagesManuallyEdited] = useState<Record<string, boolean>>({})
  const [finalizingRun, setFinalizingRun] = useState(false)
  const [approvingRun, setApprovingRun] = useState(false)
  const [voidingRun, setVoidingRun] = useState(false)

  const isRunLocked = useMemo(
    () => !!payrollRun && ['approved', 'accrued', 'paid'].includes(payrollRun.status),
    [payrollRun]
  )

  useEffect(() => {
    if (!selectedBrand) {
      setStaff([])
      setPayrollData({
        weekly: {},
        custom: [],
        totals: { weekly: 0, custom: 0 },
      })
      setCompanyLocationIds([])
      setLoading(false)
      return
    }

    setSelectedStaff('all')
    setPeriodLoading(false)
    payrollLoadedRef.current = false
    void loadStaffData()
  }, [selectedBrand?.id, isGfcMain])

  useEffect(() => {
    if (!selectedBrand || staff.length === 0) return
    if (selectedPeriod === 'custom') {
      if (!customStartDate || !customEndDate || !calendarClosed) return
    }
    void loadPayrollData(staff)
  }, [selectedPeriod, customStartDate?.toISOString(), customEndDate?.toISOString(), calendarClosed, staff])

  const handlePeriodChange = (period: PayrollPeriod) => {
    setPeriodLoading(true)
    setSelectedPeriod(period)
    setShowCalendar(false)
    setCalendarClosed(true)
  }

  const closeCustomCalendar = () => {
    setShowCalendar(false)
    if (customStartDate && customEndDate) {
      setPeriodLoading(true)
    }
    setCalendarClosed(true)
  }

  // Set default custom range when switching to custom period
  useEffect(() => {
    if (selectedPeriod !== 'custom') return

    const today = new Date()
    const dayOfWeek = today.getDay()
    const diff = -dayOfWeek
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)

    setCustomStartDate(startOfWeek)
    setCustomEndDate(endOfWeek)
    setCalendarDate(startOfWeek)
  }, [selectedPeriod])

  // Ensure custom dates are always in correct order
  useEffect(() => {
    if (customStartDate && customEndDate && customStartDate > customEndDate) {
      const temp = customStartDate
      setCustomStartDate(customEndDate)
      setCustomEndDate(temp)
    }
  }, [customStartDate, customEndDate])

  const loadStaffData = async () => {
    if (!selectedBrand) return
    setLoading(true)
    try {
      let locationQuery = supabase
        .from('locations')
        .select('id, name, brand_id, brand:brands(name)')
        .eq('company_owned', true)

      if (!isGfcMain) {
        locationQuery = locationQuery.eq('brand_id', selectedBrand.id)
      }

      const { data: companyLocations, error: locationError } = await locationQuery

      if (locationError) throw locationError

      const locationIds = companyLocations?.map((loc) => loc.id) || []
      setCompanyLocationIds(locationIds)

      const [factoryLocs, gfcStaff] = await Promise.all([
        loadGfcMainFactoryLocations().catch((err) => {
          console.warn('Could not load GFC main locations for payroll:', err)
          return []
        }),
        loadGfcMainStaff().catch((err) => {
          console.warn('Could not load GFC main staff for payroll:', err)
          return []
        }),
      ])
      setFactoryLocations(factoryLocs)
      setGfcMainStaffIds(new Set(gfcStaff.map((s) => s.id)))

      if (locationIds.length === 0) {
        setStaff([])
        setLoading(false)
        return
      }

      const { data: staffData, error: staffError } = await supabase
        .from('staff_registrations')
        .select('*')
        .eq('is_active', true)

      if (staffError) throw staffError

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('staff_assignments')
        .select('id, staff_registration_id, location_id')
        .in('location_id', locationIds)

      if (assignmentsError) throw assignmentsError

      const locationsData = companyLocations || []

      const staffWithAssignments =
        staffData
          ?.map((staffMember) => ({
            ...staffMember,
            staff_assignments:
              assignmentsData
                ?.filter((assignment) => assignment.staff_registration_id === staffMember.id)
                .map((assignment) => ({
                  ...assignment,
                  locations:
                    locationsData.find((location) => location.id === assignment.location_id) ||
                    { id: assignment.location_id, name: 'Unknown Location' },
                })) || [],
          }))
          .filter((staffMember) => staffMember.staff_assignments.length > 0) || []

      setStaff(staffWithAssignments)
      if (staffWithAssignments.length === 0) {
        setLoading(false)
      }
    } catch (error) {
      console.error('Error loading staff and payroll data:', error)
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: string }).message)
          : 'Failed to load payroll data'
      setError(message || 'Failed to load payroll data')
      setLoading(false) // Only set loading to false on error
    }
  }

  const loadPayrollData = async (staffData: StaffWithAssignments[]) => {
    const requestId = ++loadRequestId.current
    if (payrollLoadedRef.current) {
      setPeriodLoading(true)
    } else {
      setLoading(true)
    }
    try {
      const startDate = getStartDate()
      const endDate = getEndDate()
      const today = new Date().toISOString().split('T')[0]

      // Use cached company location IDs
      const locationIds = companyLocationIds.length > 0 ? companyLocationIds : []

      const { data: scheduleData, error: scheduleError } = await supabase
        .from('staff_schedules')
        .select(`
          *,
          staff:staff_registrations(id, full_name, hourly_rate),
          location:locations(id, name, brand_id, is_factory_floor, brand:brands(id, name))
        `)
        .gte('schedule_date', startDate)
        .lte('schedule_date', endDate)
        .in('location_id', locationIds) // Only company-owned locations
        .order('schedule_date', { ascending: true })

      if (scheduleError) {
        console.error('Error fetching schedule data:', scheduleError)
        throw scheduleError
      }

      // Filter out future dates - only include up to today
      const filteredScheduleData = (scheduleData || []).filter(schedule => 
        schedule.schedule_date <= today
      )

      // Holiday marks from staff schedule calendar (any branch in scope)
      const dayStatusMap = await fetchDayStatusMapForPeriod(startDate, endDate, locationIds)
      filteredScheduleData.forEach((schedule) => {
        mergeDayStatusIntoMap(dayStatusMap, schedule.schedule_date, schedule.day_type)
      })

      let mergedScheduleData = filteredScheduleData
      try {
        mergedScheduleData = await enrichSchedulesWithAttendance({
          scheduleData: filteredScheduleData,
          startDate,
          endDate,
          gfcMainStaffIds,
          staffData,
          factoryLocations,
          dayStatusMap,
        })
      } catch (attendanceError) {
        console.warn('Attendance merge unavailable, using schedule hours only:', attendanceError)
      }
      
      if (requestId !== loadRequestId.current) return

      setDayStatusMap(dayStatusMap)

      const snapshot = await buildDeductionsSnapshot(startDate, endDate, staffData, mergedScheduleData)
      if (requestId !== loadRequestId.current) return

      applyDeductionsSnapshot(snapshot)

      const payroll = await calculatePayroll(
        staffData,
        mergedScheduleData,
        dayStatusMap,
        startDate,
        endDate,
        snapshot.loadedDeductions,
        snapshot.loadedRefunds
      )
      if (requestId !== loadRequestId.current) return

      setPayrollData(payroll)
      setError('')
    } catch (error) {
      if (requestId !== loadRequestId.current) return
      console.error('Error loading payroll data:', error)
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: string }).message)
          : 'Failed to load payroll data'
      setError(message || 'Failed to load payroll data')
      setPayrollData({
        weekly: {},
        custom: [],
        totals: {
          weekly: 0,
          custom: 0
        }
      })
    } finally {
      if (requestId === loadRequestId.current) {
        payrollLoadedRef.current = true
        setLoading(false)
        setPeriodLoading(false)
      }
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

  const fetchStaffDsirDiscrepancies = async (
    staffIds: string[],
    startDate: string,
    endDate: string
  ): Promise<{
    totalsByStaff: Map<string, number>
    byStaffDate: Record<string, Record<string, number>>
  }> => {
    const totalsByStaff = new Map<string, number>()
    const byStaffDate: Record<string, Record<string, number>> = {}
    if (staffIds.length === 0) return { totalsByStaff, byStaffDate }

    try {
      const { data, error } = await supabase
        .from('dsir_reports')
        .select('staff_registration_id, report_date, discrepancy')
        .in('staff_registration_id', staffIds)
        .gte('report_date', startDate)
        .lte('report_date', endDate)
        .eq('status', 'submitted')

      if (error) {
        console.error('Error fetching DSIR discrepancies:', error)
        return { totalsByStaff, byStaffDate }
      }

      data?.forEach((report) => {
        const staffId = report.staff_registration_id
        const discrepancy = Number(report.discrepancy) || 0
        if (discrepancy >= 0) return

        const amount = Math.abs(discrepancy)
        totalsByStaff.set(staffId, (totalsByStaff.get(staffId) || 0) + amount)
        if (!byStaffDate[staffId]) byStaffDate[staffId] = {}
        byStaffDate[staffId][report.report_date] = amount
      })

      return { totalsByStaff, byStaffDate }
    } catch (error) {
      console.error('Error fetching DSIR discrepancies:', error)
      return { totalsByStaff, byStaffDate }
    }
  }

  const getScheduleDataForWeek = async (startDate: string, endDate: string) => {
    const today = new Date().toISOString().split('T')[0]

    const locationIds = companyLocationIds.length > 0 ? companyLocationIds : []

    const { data: scheduleData, error: scheduleError } = await supabase
      .from('staff_schedules')
      .select(`
        *,
        staff:staff_registrations(id, full_name, hourly_rate),
        location:locations(id, name, brand_id, is_factory_floor, brand:brands(id, name))
      `)
      .gte('schedule_date', startDate)
      .lte('schedule_date', endDate)
      .in('location_id', locationIds)
      .order('schedule_date', { ascending: true })

    if (scheduleError) throw scheduleError

    const filteredScheduleData = (scheduleData || []).filter(
      (schedule) => schedule.schedule_date <= today
    )

    const statusMap = await fetchDayStatusMapForPeriod(startDate, endDate, locationIds)
    filteredScheduleData.forEach((schedule) => {
      mergeDayStatusIntoMap(statusMap, schedule.schedule_date, schedule.day_type)
    })

    return enrichSchedulesWithAttendance({
      scheduleData: filteredScheduleData,
      startDate,
      endDate,
      gfcMainStaffIds,
      staffData: staff,
      factoryLocations,
      dayStatusMap: statusMap,
    }).catch((err) => {
      console.warn('Attendance merge unavailable for payroll week:', err)
      return filteredScheduleData
    })
  }

  const getPayrollStaffIds = (
    staffData?: StaffWithAssignments[],
    scheduleData?: any[]
  ) => {
    const fromSchedule = (scheduleData || [])
      .map((schedule) => schedule.staff_registration_id)
      .filter(Boolean)
    if (fromSchedule.length > 0) {
      return Array.from(new Set(fromSchedule))
    }
    return staffData?.map((s) => s.id) || []
  }

  const loadRequestId = useRef(0)

  const buildDeductionsSnapshot = async (
    startDate: string,
    endDate: string,
    staffData?: StaffWithAssignments[],
    scheduleData?: any[]
  ) => {
    const payrollStaffIds = getPayrollStaffIds(staffData, scheduleData)
    const { byStaffDate: dsirByStaffDate } = payrollStaffIds.length > 0
      ? await fetchStaffDsirDiscrepancies(payrollStaffIds, startDate, endDate)
      : { byStaffDate: {} as Record<string, Record<string, number>> }
    const openAdvances = payrollStaffIds.length > 0
      ? await fetchOpenAdvanceBalancesByStaff(payrollStaffIds)
      : new Map<string, number>()

    const weekStarts = listPhilippinesWeekStartsInRange(startDate, endDate)
    const savedByWeek = new Map<string, Map<string, PayrollDeductionsRecord>>()

    for (const weekStart of weekStarts) {
      const { end: weekEnd } = getPhilippinesWeekRange(weekStart)
      const { data, error } = await supabase
        .from('payroll_deductions_refunds')
        .select('*')
        .eq('week_start_date', weekStart)
        .eq('week_end_date', weekEnd)

      if (error) throw error

      const byStaff = new Map<string, PayrollDeductionsRecord>()
      for (const record of (data || []) as PayrollDeductionsRecord[]) {
        byStaff.set(record.staff_id, record)
      }
      savedByWeek.set(weekStart, byStaff)
    }

    const {
      loadedDeductions,
      loadedRefunds,
      dsirDefaults,
      advanceDefaults,
      shortageOverrideFlags,
      idMap,
    } = aggregatePayrollDeductionsByWeek({
      staffIds: payrollStaffIds,
      weekStarts,
      savedByWeek,
      dsirByStaffDate,
      openAdvances,
      idMapWeekStart: selectedPeriod === 'week' ? weekStarts[0] : null,
    })

    const loadedInputValues: {[staffId: string]: {
      utilities: string
      shortages: string
      cashAdvances: string
      penalties: string
      others: string
      refunds: string
    }} = {}

    payrollStaffIds.forEach((staffId) => {
      const d = loadedDeductions[staffId] || {
        utilities: 0,
        shortages: 0,
        cashAdvances: 0,
        penalties: 0,
        others: 0,
      }
      const refunds = loadedRefunds[staffId] || 0
      const fmt = (amount: number) => (amount > 0 ? String(amount) : '')
      loadedInputValues[staffId] = {
        utilities: fmt(d.utilities),
        shortages: fmt(d.shortages),
        cashAdvances: fmt(d.cashAdvances),
        penalties: fmt(d.penalties),
        others: fmt(d.others),
        refunds: fmt(refunds),
      }
    })

    return {
      loadedDeductions,
      loadedRefunds,
      loadedInputValues,
      idMap,
      dsirDefaults,
      advanceDefaults,
      shortageOverrideFlags,
      dsirByStaffDate,
    }
  }

  const syncDeductionsSaveSnapshot = useCallback(
    (nextDeductions: typeof deductions, nextRefunds: typeof refunds, staffIds: string[]) => {
      deductionsSaveSnapshotRef.current = serializeDeductionsState(staffIds, nextDeductions, nextRefunds)
      setDeductionsSaveStatus('saved')
    },
    []
  )

  const applyDeductionsSnapshot = (snapshot: Awaited<ReturnType<typeof buildDeductionsSnapshot>>) => {
    setDeductions(snapshot.loadedDeductions)
    setRefunds(snapshot.loadedRefunds)
    setDeductionsRefundIds(snapshot.idMap)
    setInputValues(snapshot.loadedInputValues)
    setDsirShortageDefaults(snapshot.dsirDefaults)
    setAdvanceBalanceDefaults(snapshot.advanceDefaults)
    setDsirDiscrepancyByStaffDate(snapshot.dsirByStaffDate)
    setShortagesManuallyEdited(snapshot.shortageOverrideFlags)
    syncDeductionsSaveSnapshot(
      snapshot.loadedDeductions,
      snapshot.loadedRefunds,
      Object.keys(snapshot.loadedDeductions)
    )
  }

  const getDayDiscrepancy = (staffId: string, scheduleDate: string) => {
    return dsirDiscrepancyByStaffDate[staffId]?.[scheduleDate] || 0
  }

  const formatDiscrepancyBubble = (amount: number) => {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k`
    }
    return Number.isInteger(amount) ? String(amount) : amount.toFixed(0)
  }

  const getDayIncentive = (entry: PayrollData, scheduleDate: string) => {
    return entry.dailyIncentiveBreakdown?.[scheduleDate] || 0
  }

  const loadDeductionsAndRefunds = async (startDate: string, endDate: string, staffData?: StaffWithAssignments[], scheduleData?: any[], dayStatusMap?: {[key: string]: string}) => {
    try {
      const snapshot = await buildDeductionsSnapshot(startDate, endDate, staffData, scheduleData)
      applyDeductionsSnapshot(snapshot)

      if (staffData && scheduleData && dayStatusMap) {
        const payroll = await calculatePayroll(
          staffData,
          scheduleData,
          dayStatusMap,
          startDate,
          endDate,
          snapshot.loadedDeductions,
          snapshot.loadedRefunds
        )
        setPayrollData(payroll)
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

    return getAttendancePeriodRange(selectedPeriod as AttendancePeriod).start
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

    return getAttendancePeriodRange(selectedPeriod as AttendancePeriod).end
  }

  const calculateStaffPayroll = (
    staff: StaffWithAssignments,
    staffSchedules: any[],
    dayStatusMap: {[key: string]: string},
    overrides?: {
      deductions?: {
        utilities: number
        shortages: number
        cashAdvances: number
        penalties: number
        others: number
      }
      refunds?: number
      incentive?: number
    }
  ): PayrollData => {
    const staffDeductions = overrides?.deductions ?? getDeductionsForStaff(staff.id)
    const staffRefunds = overrides?.refunds ?? refunds[staff.id] ?? 0
    const calc = calculateStaffPayrollCoreByWeeks({
      hourlyRate: staff.hourly_rate || 0,
      schedules: staffSchedules,
      dayStatusMap,
      deductions: staffDeductions,
      refunds: staffRefunds,
      incentive: overrides?.incentive ?? 0,
    })

    const dayHoursMap: {[key: string]: number} = {}
    staffSchedules.forEach((schedule) => {
      if (schedule.is_absent) {
        dayHoursMap[schedule.schedule_date] = 0
        return
      }
      if (schedule.hours != null && schedule.hours !== '') {
        dayHoursMap[schedule.schedule_date] = Number(schedule.hours) || 0
        return
      }
      dayHoursMap[schedule.schedule_date] = schedule.location?.is_factory_floor ? 0 : 11
    })

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

    return {
      staffId: staff.id,
      staffName: staff.full_name,
      locationName: locations,
      date: staffSchedules[0].schedule_date,
      hours: calc.totalHours,
      hourlyRate: staff.hourly_rate || 0,
      totalPay: calc.grossPay,
      daysWorked: daysWorked,
      daysWorkedDates: daysWorkedDates,
      locationGroups: locationGroups,
      regularHours: calc.regularHours,
      doublePayHours: calc.doublePayHours,
      specialPayHours: calc.specialPayHours,
      overtimeHours: calc.overtimeHours,
      regularPay: calc.regularPay,
      doublePay: calc.doublePay,
      specialPay: calc.specialPay,
      overtimePay: calc.overtimePay,
      incentivePay: calc.incentivePay,
      minimumDailyRate: calc.minimumDailyRate,
      deductions: calc.deductions,
      refunds: calc.refunds,
      netPay: calc.netPay,
    }
  }

  const calculatePayroll = async (
    staffData: StaffWithAssignments[],
    scheduleData: any[],
    dayStatusMap: {[key: string]: string},
    startDate: string,
    endDate: string,
    deductionOverrides?: typeof deductions,
    refundOverrides?: typeof refunds
  ): Promise<PayrollSummary> => {
    const weekly: { [week: string]: PayrollData[] } = {}
    const custom: PayrollData[] = []

    // Fetch average weekly and monthly sales for all staff (with breakdown for the filtered week)
    const staffSalesData = await fetchStaffAverageWeeklySales(staffData.map(s => s.id), startDate, endDate)

    const incentiveData = await computeIncentivesForPeriod({
      startDate,
      endDate,
      locationIds: companyLocationIds,
      dayStatusMap,
    })

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

      const payrollEntry = calculateStaffPayroll(staff, staffSchedules, dayStatusMap, {
        deductions: deductionOverrides?.[staffId],
        refunds: refundOverrides?.[staffId],
        incentive: incentiveData.totalsByStaff.get(staffId) || 0,
      })
      
      // Add average weekly sales, monthly sales, and daily breakdown
      payrollEntry.averageWeeklySales = staffSalesData.weeklyAverages[staffId] || 0
      payrollEntry.averageMonthlySales = staffSalesData.monthlyAverages[staffId] || 0
      payrollEntry.dailySalesBreakdown = staffSalesData.breakdowns[staffId] || []
      payrollEntry.dailyIncentiveBreakdown = incentiveData.byStaffDate[staffId] || {}

      custom.push(payrollEntry)

      // Group by week (for weekly finalize view; multi-week periods use custom entries)
      const weekKey = getPhilippinesWeekRange(staffSchedules[0].schedule_date).start
      if (!weekly[weekKey]) weekly[weekKey] = []
      weekly[weekKey].push(payrollEntry)
    })

    const totals = {
      weekly: Object.values(weekly).flat().reduce((sum, entry) => sum + entry.totalPay, 0),
      custom: custom.reduce((sum, entry) => sum + entry.totalPay, 0)
    }

    return { weekly, custom, totals }
  }

  const activePayrollEntries = useMemo(() => {
    if (selectedPeriod === 'week') {
      return Object.values(payrollData.weekly).flat()
    }
    return payrollData.custom
  }, [selectedPeriod, payrollData])

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
    return activePayrollEntries.reduce((sum, entry) => sum + entry.hours, 0)
  }

  const getTotalOvertimeHours = useMemo(() => {
    return activePayrollEntries.reduce((sum, entry) => sum + entry.overtimeHours, 0)
  }, [activePayrollEntries])

  const getTotalDoublePayHours = useMemo(() => {
    return activePayrollEntries.reduce((sum, entry) => sum + entry.doublePayHours, 0)
  }, [activePayrollEntries])

  const getTotalSpecialPayHours = useMemo(() => {
    return activePayrollEntries.reduce((sum, entry) => sum + entry.specialPayHours, 0)
  }, [activePayrollEntries])

  const getTotalRegularHours = useMemo(() => {
    return activePayrollEntries.reduce((sum, entry) => sum + entry.regularHours, 0)
  }, [activePayrollEntries])

  const getPayrollEntries = useMemo(() => {
    let entries = [...activePayrollEntries]
    
    // Filter by selected staff
    if (selectedStaff !== 'all') {
      entries = entries.filter(entry => entry.staffId === selectedStaff)
    }
    
    // Sort by net pay from highest to lowest
    entries.sort((a, b) => b.netPay - a.netPay)
    
    return entries
  }, [activePayrollEntries, selectedStaff])

  const hasPayrollData = useMemo(() => {
    return getPayrollEntries.length > 0
  }, [getPayrollEntries])

  const getDeductionsForStaff = (staffId: string) => getDeductionsForStaffFromState(deductions, staffId)

  const getLiveDeductionsTotal = (staffId: string) => {
    const staffDeductions = getDeductionsForStaff(staffId)
    return Object.values(staffDeductions).reduce((sum, amount) => sum + amount, 0)
  }

  const getLiveRefunds = (staffId: string, fallback = 0) => {
    return refunds[staffId] ?? fallback
  }

  const getLiveNetPay = (entry: PayrollData) => {
    const totalDeductions = getLiveDeductionsTotal(entry.staffId)
    const staffRefunds = getLiveRefunds(entry.staffId, entry.refunds)
    return entry.totalPay + (entry.incentivePay || 0) - totalDeductions + staffRefunds
  }

  const getTotalDeductions = useMemo(() => {
    return activePayrollEntries.reduce(
      (sum, entry) => sum + getLiveDeductionsTotal(entry.staffId),
      0
    )
  }, [activePayrollEntries, deductions])

  const getTotalNetPay = useMemo(() => {
    return activePayrollEntries.reduce((sum, entry) => sum + getLiveNetPay(entry), 0)
  }, [activePayrollEntries, deductions, refunds])

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
    if (inputValue !== undefined && inputValue !== '') {
      return inputValue
    }
    return (currentValue === 0 || currentValue === undefined) ? '' : currentValue.toString()
  }

  const handleShortageChange = (staffId: string, value: string) => {
    setShortagesManuallyEdited((prev) => ({ ...prev, [staffId]: true }))
    updateInputValue(staffId, 'shortages', value)
  }

  const showDsirShortageHint = (staffId: string) => {
    return (
      (dsirShortageDefaults[staffId] || 0) > 0 &&
      !shortagesManuallyEdited[staffId]
    )
  }

  const stopInputPropagation = {
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onFocus: (e: React.FocusEvent) => e.stopPropagation(),
    onBlur: (e: React.FocusEvent) => e.stopPropagation(),
  }

  const renderDeductionInput = (
    staffId: string,
    field: keyof typeof inputValues[string],
    currentValue: number,
    onChange: (value: string) => void,
    highlight?: boolean
  ) => (
    <input
      type="number"
      min="0"
      step="0.01"
      placeholder="0"
      disabled={isRunLocked}
      value={getInputValue(staffId, field, currentValue)}
      onChange={(e) => onChange(e.target.value)}
      {...stopInputPropagation}
      className={`w-[4.75rem] shrink-0 rounded border px-2 py-1 text-xs text-right tabular-nums outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:bg-gray-50 disabled:text-gray-400 ${
        highlight
          ? 'border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-1 focus:ring-red-100'
          : 'border-gray-200 bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-100'
      }`}
    />
  )

  const showAdvancePvHint = (staffId: string) => (advanceBalanceDefaults[staffId] || 0) > 0

  const renderSourceBadge = (label: string, tone: 'dsir' | 'pv') => {
    const classes =
      tone === 'dsir' ? 'text-red-600 bg-red-50' : 'text-blue-700 bg-blue-50'
    return (
      <span className={`shrink-0 rounded px-1 py-px text-[9px] font-medium ${classes}`}>
        {label}
      </span>
    )
  }

  const renderDeductionsRefundsCell = (entry: PayrollData) => {
    const liveDeductions = getDeductionsForStaff(entry.staffId)
    const liveDeductionsTotal = getLiveDeductionsTotal(entry.staffId)
    const liveRefunds = getLiveRefunds(entry.staffId, entry.refunds)
    const showDsirHint = showDsirShortageHint(entry.staffId)
    const showAdvanceHint = showAdvancePvHint(entry.staffId)

    const shortagesLocked =
      showDsirHint &&
      !shortagesManuallyEdited[entry.staffId] &&
      liveDeductions.shortages === (dsirShortageDefaults[entry.staffId] || 0)

    const manualRows: Array<{
      key: 'utilities' | 'penalties' | 'others'
      label: string
    }> = [
      { key: 'utilities', label: 'Utilities' },
      { key: 'penalties', label: 'Penalties' },
      { key: 'others', label: 'Others' },
    ]

    return (
      <div className="min-w-[11rem] space-y-2">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Deductions
            </span>
            <span className="text-xs font-bold tabular-nums text-red-600">
              {formatCurrency(liveDeductionsTotal)}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1">
                <span className="truncate text-xs text-gray-600">Shortages</span>
                {showDsirHint && renderSourceBadge('DSIR', 'dsir')}
              </div>
              {shortagesLocked ? (
                <span className="w-[4.75rem] shrink-0 text-right text-xs font-semibold tabular-nums text-gray-700">
                  {formatCurrency(liveDeductions.shortages)}
                </span>
              ) : (
                renderDeductionInput(
                  entry.staffId,
                  'shortages',
                  liveDeductions.shortages,
                  (nextValue) => handleShortageChange(entry.staffId, nextValue),
                  showDsirHint
                )
              )}
            </div>

            {manualRows.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-gray-600">{label}</span>
                {renderDeductionInput(
                  entry.staffId,
                  key,
                  liveDeductions[key],
                  (value) => updateInputValue(entry.staffId, key, value)
                )}
              </div>
            ))}

            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1">
                <span className="truncate text-xs text-gray-600">Advances</span>
                {showAdvanceHint && renderSourceBadge('PV', 'pv')}
              </div>
              <span className="w-[4.75rem] shrink-0 text-right text-xs font-semibold tabular-nums text-gray-700">
                {formatCurrency(liveDeductions.cashAdvances)}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-green-600">Refund</span>
            {renderDeductionInput(
              entry.staffId,
              'refunds',
              liveRefunds,
              (value) => {
                const numericValue = parseFloat(value) || 0
                setRefunds((prev) => ({
                  ...prev,
                  [entry.staffId]: numericValue,
                }))
                updateInputValue(entry.staffId, 'refunds', value)
              }
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderPayBreakdownCell = (entry: PayrollData) => {
    const liveDeductions = getDeductionsForStaff(entry.staffId)
    const liveRefunds = getLiveRefunds(entry.staffId, entry.refunds)
    const deductionRows = [
      { label: 'Utilities', amount: liveDeductions.utilities },
      { label: 'Shortages', amount: liveDeductions.shortages },
      { label: 'Advances', amount: liveDeductions.cashAdvances },
      { label: 'Penalties', amount: liveDeductions.penalties },
      { label: 'Others', amount: liveDeductions.others },
    ].filter((row) => row.amount > 0)

    const summaryRow = (label: string, value: string, valueClass = 'text-gray-900') => (
      <div className="flex items-center justify-between gap-3">
        <span className="text-gray-600">{label}</span>
        <span className={`font-medium tabular-nums ${valueClass}`}>{value}</span>
      </div>
    )

    return (
      <div className="min-w-[14rem] max-w-md space-y-3 text-xs">
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Hours</div>
          {summaryRow('Regular', `${entry.regularHours.toFixed(1)}h`, 'text-blue-600')}
          {entry.doublePayHours > 0 &&
            summaryRow('Double', `${entry.doublePayHours.toFixed(1)}h`, 'text-orange-600')}
          {entry.specialPayHours > 0 &&
            summaryRow('Special (1.3x)', `${entry.specialPayHours.toFixed(1)}h`, 'text-violet-600')}
          {entry.overtimeHours > 0 &&
            summaryRow('Overtime', `${entry.overtimeHours.toFixed(1)}h`, 'text-red-600')}
          {summaryRow('Total', `${entry.hours.toFixed(1)}h`, dashboardThemeAccentText(theme))}
        </div>

        <div className="space-y-1 border-t border-gray-100 pt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Earnings</div>
          {summaryRow('Regular', formatCurrency(entry.regularPay), 'text-blue-600')}
          {entry.doublePay > 0 &&
            summaryRow('Double', formatCurrency(entry.doublePay), 'text-orange-600')}
          {entry.specialPay > 0 &&
            summaryRow('Special', formatCurrency(entry.specialPay), 'text-violet-600')}
          {entry.overtimePay > 0 &&
            summaryRow('Overtime', formatCurrency(entry.overtimePay), 'text-red-600')}
          {summaryRow('Total Pay', formatCurrency(entry.totalPay), 'text-blue-600')}
        </div>

        <div className="space-y-1 border-t border-gray-100 pt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Summary</div>
          {entry.incentivePay > 0 &&
            summaryRow('Incentive', `+${formatCurrency(entry.incentivePay)}`, 'text-emerald-600')}
          {deductionRows.map((row) =>
            summaryRow(row.label, `-${formatCurrency(row.amount)}`, 'text-red-600')
          )}
          {liveRefunds > 0 &&
            summaryRow('Refund', `+${formatCurrency(liveRefunds)}`, 'text-green-600')}
          <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-1">
            <span className="text-sm font-semibold text-gray-700">Net Pay</span>
            <span className="text-base font-bold tabular-nums text-blue-600">
              {formatCurrency(getLiveNetPay(entry))}
            </span>
          </div>
        </div>
      </div>
    )
  }

  const refreshPayrollRun = useCallback(async () => {
    if (selectedPeriod !== 'week') {
      setPayrollRun(null)
      setPayrollBrandTotals([])
      return
    }
    const startDate = getStartDate()
    const endDate = getEndDate()
    const { run, brandTotals } = await loadPayrollRunByWeek(startDate, endDate, {
      excludeFactoryBrandId: factoryBrand?.id,
    })
    setPayrollRun(run)
    setPayrollBrandTotals(brandTotals)
  }, [selectedPeriod, factoryBrand?.id])

  useEffect(() => {
    void refreshPayrollRun()
  }, [refreshPayrollRun])

  const persistDeductions = useCallback(
    async (options?: { silent?: boolean; reload?: boolean }) => {
      if (selectedPeriod !== 'week') return false
      if (isRunLocked) {
        if (!options?.silent) {
          setError('Deductions are locked while payroll run is approved or posted. Void the run first.')
        }
        return false
      }

      const startDate = getStartDate()
      const endDate = getEndDate()
      const weekKey = getStartDate()
      const weekEntries = payrollData.weekly[weekKey] || []

      if (weekEntries.length === 0) {
        if (!options?.silent) setError('No payroll data found for this week')
        return false
      }

      if (!options?.silent) {
        setSavingDeductions(true)
        setError('')
        setSuccess('')
      }
      setDeductionsSaveStatus('saving')

      try {
        await savePayrollDeductionsForWeek({
          startDate,
          endDate,
          staffIds: weekEntries.map((entry) => entry.staffId),
          deductions,
          refunds,
        })

        if (options?.reload !== false && staff.length > 0) {
          const scheduleData = await getScheduleDataForWeek(startDate, endDate)
          await loadDeductionsAndRefunds(startDate, endDate, staff, scheduleData, dayStatusMap)
        } else {
          syncDeductionsSaveSnapshot(
            deductions,
            refunds,
            weekEntries.map((entry) => entry.staffId)
          )
        }

        return true
      } catch (error) {
        console.error('Error saving deductions and refunds:', error)
        setDeductionsSaveStatus('unsaved')
        if (!options?.silent) setError('Failed to save deductions and refunds')
        return false
      } finally {
        if (!options?.silent) setSavingDeductions(false)
      }
    },
    [
      selectedPeriod,
      isRunLocked,
      payrollData.weekly,
      deductions,
      refunds,
      staff,
      dayStatusMap,
      syncDeductionsSaveSnapshot,
    ]
  )

  useEffect(() => {
    if (selectedPeriod !== 'week' || isRunLocked || loading || periodLoading) return

    const weekKey = getStartDate()
    const weekEntries = payrollData.weekly[weekKey] || []
    if (weekEntries.length === 0) return

    const snapshot = serializeDeductionsState(
      weekEntries.map((entry) => entry.staffId),
      deductions,
      refunds
    )
    if (snapshot === deductionsSaveSnapshotRef.current) return

    setDeductionsSaveStatus('unsaved')
    const timer = window.setTimeout(() => {
      void persistDeductions({ silent: true, reload: false })
    }, 2500)

    return () => window.clearTimeout(timer)
  }, [deductions, refunds, selectedPeriod, isRunLocked, loading, periodLoading, payrollData.weekly, persistDeductions])

  const handleFinalizePayrollRun = async () => {
    if (selectedPeriod !== 'week') return
    setFinalizingRun(true)
    setError('')
    setSuccess('')
    try {
      const saved = await persistDeductions({ silent: true, reload: false })
      if (!saved) {
        setError('Could not save deductions before finalizing payroll run.')
        return
      }

      const startDate = getStartDate()
      const endDate = getEndDate()
      const weekKey = getStartDate()
      const weekEntries = payrollData.weekly[weekKey] || []
      if (weekEntries.length === 0) {
        setError('No payroll data found for this week')
        return
      }
      const scheduleData = await getScheduleDataForWeek(startDate, endDate)
      const staffGroups: Record<string, any[]> = {}
      scheduleData.forEach((schedule) => {
        const staffId = schedule.staff_registration_id
        if (!staffGroups[staffId]) staffGroups[staffId] = []
        staffGroups[staffId].push(schedule)
      })

      const { data: deductionRecords } = await supabase
        .from('payroll_deductions_refunds')
        .select('*')
        .eq('week_start_date', startDate)
        .eq('week_end_date', endDate)

      const deductionByStaff = new Map((deductionRecords || []).map((r) => [r.staff_id, r]))

      const incentiveData = await computeIncentivesForPeriod({
        startDate,
        endDate,
        locationIds: companyLocationIds,
        dayStatusMap,
      })

      const lines = Object.entries(staffGroups).map(([staffId, schedules]) => {
        const staffMember = staff.find((s) => s.id === staffId)
        const dedRecord = deductionByStaff.get(staffId)
        return {
          staffId,
          hourlyRate: staffMember?.hourly_rate || 0,
          schedules,
          deductions: resolveLiveDeductions(staffId, deductions, dedRecord),
          refunds: resolveLiveRefunds(staffId, refunds, dedRecord?.refunds || 0),
          incentive: incentiveData.totalsByStaff.get(staffId) || 0,
          deductionsRefundId: dedRecord?.id || deductionsRefundIds[staffId] || null,
        }
      })

      await finalizePayrollRun({
        weekStartDate: startDate,
        weekEndDate: endDate,
        dayStatusMap,
        lines,
        createdBy: currentUsername,
        factoryBrandId: factoryBrand?.id,
      })
      await refreshPayrollRun()
      setSuccess('Payroll run finalized. Review brand totals, then approve to post accrual journals.')
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Failed to finalize payroll run')
    } finally {
      setFinalizingRun(false)
    }
  }

  const refreshDeductionsForCurrentWeek = async () => {
    if (selectedPeriod !== 'week' || staff.length === 0) return
    const startDate = getStartDate()
    const endDate = getEndDate()
    const scheduleData = await getScheduleDataForWeek(startDate, endDate)
    await loadDeductionsAndRefunds(startDate, endDate, staff, scheduleData, dayStatusMap)
  }

  const handleApproveAndPostAccrual = async () => {
    if (!payrollRun) return
    setApprovingRun(true)
    setError('')
    setSuccess('')
    try {
      const result = await approveAndPostPayrollAccrual(
        payrollRun.id,
        currentUsername,
        factoryBrand?.id
      )
      await refreshPayrollRun()
      await refreshDeductionsForCurrentWeek()
      setSuccess(`Accrual posted: ${result.entryNumbers.join(', ')}. Net pay is ready for disbursement in Accounting.`)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Failed to post payroll accrual')
    } finally {
      setApprovingRun(false)
    }
  }

  const handleVoidPayrollRun = async () => {
    if (!payrollRun) return
    if (!confirm('Void this payroll run and reverse accrual journals?')) return
    setVoidingRun(true)
    setError('')
    setSuccess('')
    try {
      await voidPayrollRun(payrollRun.id, currentUsername)
      await refreshPayrollRun()
      await refreshDeductionsForCurrentWeek()
      setSuccess('Payroll run voided. Deductions can be edited again.')
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Failed to void payroll run')
    } finally {
      setVoidingRun(false)
    }
  }

  const getDayColorClasses = (dayStatus: 'default' | 'regular-holiday' | 'special-holiday') => {
    switch (dayStatus) {
      case 'regular-holiday':
        return 'bg-orange-200 text-orange-900 border border-orange-300'
      case 'special-holiday':
        return 'bg-violet-200 text-violet-900 border border-violet-300'
      default:
        return dashboardThemeDayWorked('blue')
    }
  }

  const getBrandAccentBorder = (brandName?: string) => {
    switch (getBrandColorKey(brandName)) {
      case 'green':
        return 'border-l-green-500'
      case 'red':
        return 'border-l-red-500'
      case 'yellow':
        return 'border-l-yellow-500'
      default:
        return 'border-l-blue-500'
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

    if (selectedPeriod === 'week') {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`
    } else if (selectedPeriod === 'custom') {
      if (customStartDate && customEndDate) {
        return `${formatDate(customStartDate.toISOString())} - ${formatDate(customEndDate.toISOString())}`
      } else if (customStartDate) {
        return `From ${formatDate(customStartDate.toISOString())} - Select end date`
      }
      return 'Select date range'
    }

    const range = getAttendancePeriodRange(selectedPeriod as AttendancePeriod)
    return getAttendancePeriodLabel(selectedPeriod as AttendancePeriod, range)
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
    if (selectedPeriod !== 'custom' || !customStartDate || !customEndDate) {
      return false
    }

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const startOnly = new Date(customStartDate.getFullYear(), customStartDate.getMonth(), customStartDate.getDate())
    const endOnly = new Date(customEndDate.getFullYear(), customEndDate.getMonth(), customEndDate.getDate())

    return dateOnly >= startOnly && dateOnly <= endOnly
  }

  // Handle day click
  const handleDayClick = (date: Date) => {
    if (selectedPeriod !== 'custom') return

    setCalendarClosed(false)

    if (selectingStartDate) {
      setCustomStartDate(date)
      setSelectingStartDate(false)
    } else {
      if (customStartDate) {
        if (date >= customStartDate) {
          setCustomEndDate(date)
        } else {
          setCustomEndDate(customStartDate)
          setCustomStartDate(date)
        }
      } else {
        setCustomEndDate(date)
      }
      setSelectingStartDate(true)
    }
  }

  // Format the selected date for display
  const getFormattedDate = () => {
    if (selectedPeriod === 'custom') {
      if (customStartDate && customEndDate) {
        return `${customStartDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })} - ${customEndDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}`
      } else if (customStartDate) {
        return `From ${customStartDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })} - Select end date`
      }
      return 'Select date range'
    }

    const range = getAttendancePeriodRange(selectedPeriod as AttendancePeriod)
    return getAttendancePeriodLabel(selectedPeriod as AttendancePeriod, range)
  }

  const getPayslipDayStatus = (dateString: string): PayslipDayStatus =>
    getDayStatusForDate(dateString) as PayslipDayStatus

  const getPayslipPrintMeta = () => {
    const payslipDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    return { payslipDate, periodText: getDateRangeText() }
  }

  const generatePayslip = (entry: PayrollData) => {
    const { payslipDate, periodText } = getPayslipPrintMeta()
    const liveEntry = buildLivePayrollEntry(entry, deductions, refunds)
    const bodyHtml = buildPayslipBodyHtml(liveEntry, periodText, payslipDate, getPayslipDayStatus)
    const html = buildPayslipDocumentHtml(`Payslip - ${entry.staffName}`, bodyHtml)
    printPayslipHtml(html)
  }

  const printAllPayslips = () => {
    const entries = getPayrollEntries
    if (entries.length === 0) return

    const { payslipDate, periodText } = getPayslipPrintMeta()
    const bodyHtml = entries
      .map((entry, index) =>
        buildPayslipBodyHtml(
          buildLivePayrollEntry(entry, deductions, refunds),
          periodText,
          payslipDate,
          getPayslipDayStatus,
          index > 0
        )
      )
      .join('')
    const html = buildPayslipDocumentHtml('All Payslips', bodyHtml)
    printPayslipHtml(html)
  }

  if (loading) {
    return <PayrollFullPageSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-600">
            Company payroll on GFC Main books — filter by franchise for performance.
          </p>
        </div>
        {isGfcMain ? (
          <FranchisePerformanceFilter
            brands={brands}
            value={franchiseFilter}
            onChange={setFranchiseFilter}
            includeHq={false}
          />
        ) : null}
      </div>

      {/* Period Selection */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {PAYROLL_PERIOD_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriodChange(p)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  selectedPeriod === p
                    ? dashboardThemePillActive(theme)
                    : 'border border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {PAYROLL_PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {selectedPeriod === 'custom' ? (
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-700">Date Range:</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        const opening = !showCalendar
                        setShowCalendar(opening)
                        setCalendarClosed(!opening)
                      }}
                      className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors min-w-[200px]"
                    >
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-900">{getFormattedDate()}</span>
                    </button>

                    {showCalendar && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={closeCustomCalendar}
                        />

                        <div className="absolute top-full mt-2 left-0 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-20 w-80">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-gray-900">Select Date Range</h3>
                            <button
                              type="button"
                              onClick={closeCustomCalendar}
                              className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>

                          <div className="flex items-center justify-between mb-4">
                            <button
                              type="button"
                              onClick={() => {
                                const newDate = new Date(calendarDate)
                                newDate.setMonth(calendarDate.getMonth() - 1)
                                setCalendarDate(newDate)
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
                              type="button"
                              onClick={() => {
                                const newDate = new Date(calendarDate)
                                newDate.setMonth(calendarDate.getMonth() + 1)
                                setCalendarDate(newDate)
                              }}
                              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                              title="Next Month"
                            >
                              <ChevronRight className="h-4 w-4 text-gray-600" />
                            </button>
                          </div>

                          <div className="grid grid-cols-7 gap-1">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                              <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
                                {day}
                              </div>
                            ))}

                            {getCalendarDays().map((date, index) => {
                              if (!date) {
                                return <div key={`empty-${index}`} className="aspect-square" />
                              }

                              const isInCustomRange = isInSelectedWeek(date)
                              const isCustomStart =
                                customStartDate &&
                                date.getFullYear() === customStartDate.getFullYear() &&
                                date.getMonth() === customStartDate.getMonth() &&
                                date.getDate() === customStartDate.getDate()
                              const isCustomEnd =
                                customEndDate &&
                                date.getFullYear() === customEndDate.getFullYear() &&
                                date.getMonth() === customEndDate.getMonth() &&
                                date.getDate() === customEndDate.getDate()
                              const isToday = date.toDateString() === new Date().toDateString()

                              let buttonClass =
                                'aspect-square p-2 text-sm rounded-lg transition-all duration-150 font-medium'
                              if (isCustomStart || isCustomEnd) {
                                buttonClass += ` ${dashboardThemeCalendarSelected(theme)}`
                              } else if (isInCustomRange) {
                                buttonClass += ` ${dashboardThemeCalendarInRange(theme)}`
                              } else if (isToday) {
                                buttonClass += ` ${dashboardThemeCalendarToday(theme)}`
                              } else {
                                buttonClass += ` ${dashboardThemeCalendarHover(theme)}`
                              }

                              return (
                                <button
                                  type="button"
                                  key={index}
                                  onClick={() => handleDayClick(date)}
                                  className={buttonClass}
                                  title={
                                    isCustomStart
                                      ? 'Start date'
                                      : isCustomEnd
                                        ? 'End date'
                                        : isInCustomRange
                                          ? 'In selected range'
                                          : ''
                                  }
                                >
                                  {date.getDate()}
                                </button>
                              )
                            })}
                          </div>

                          <div className="mt-3 text-center">
                            <div className="flex justify-center space-x-3">
                              {(customStartDate || customEndDate) && (
                                <button
                                  type="button"
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
                                  type="button"
                                  onClick={closeCustomCalendar}
                                  className={dashboardThemeCalendarDoneButton(theme)}
                                >
                                  Done
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Range:</span> {getDateRangeText()}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Staff:</label>
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className={`border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 min-w-[150px] ${dashboardThemeSelectFocus(theme)}`}
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
      </div>

      {periodLoading ? (
        <PayrollContentSkeleton showPayrollRun={selectedPeriod === 'week'} />
      ) : (
        <>
      {selectedPeriod === 'week' && (
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Payroll run</h3>
              <p className="text-sm text-gray-600 mt-0.5">
                Status:{' '}
                <span className="font-medium capitalize text-gray-900">
                  {payrollRun?.status || 'not started'}
                </span>
                {isRunLocked && (
                  <span className="ml-2 text-xs text-amber-700">(deductions locked)</span>
                )}
                {!isRunLocked && (
                  <span
                    className={`ml-2 text-xs ${
                      deductionsSaveStatus === 'unsaved'
                        ? 'text-amber-700'
                        : deductionsSaveStatus === 'saving'
                          ? 'text-gray-500'
                          : 'text-green-700'
                    }`}
                  >
                    {deductionsSaveStatus === 'unsaved'
                      ? '(unsaved changes)'
                      : deductionsSaveStatus === 'saving'
                        ? '(saving…)'
                        : '(deductions saved)'}
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleFinalizePayrollRun}
                disabled={finalizingRun || isRunLocked || payrollRun?.status === 'paid'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                <FileCheck className="h-4 w-4" />
                {finalizingRun ? 'Finalizing…' : 'Finalize payroll run'}
              </button>
              <button
                type="button"
                onClick={handleApproveAndPostAccrual}
                disabled={
                  approvingRun ||
                  !payrollRun ||
                  !['calculated', 'approved', 'accrued'].includes(payrollRun.status)
                }
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                {approvingRun ? 'Posting…' : 'Approve & post accrual'}
              </button>
              {payrollRun && payrollRun.status !== 'void' && payrollRun.status !== 'paid' && (
                <button
                  type="button"
                  onClick={handleVoidPayrollRun}
                  disabled={voidingRun}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  {voidingRun ? 'Voiding…' : 'Void run'}
                </button>
              )}
            </div>
          </div>

          {payrollBrandTotals.length > 0 && (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Brand</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-700">Gross</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-700">Deductions</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-700">Refunds</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-700">Net pay</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Accrual JE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payrollBrandTotals
                    .filter(
                      (bt) =>
                        franchiseFilter === 'all' ||
                        franchiseFilter === 'hq' ||
                        bt.brand_id === franchiseFilter
                    )
                    .map((bt) => (
                    <tr key={bt.id}>
                      <td className="px-4 py-2 text-gray-800">
                        {(bt.brand as { name?: string } | undefined)?.name || bt.brand_id}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatCurrency(Number(bt.gross_pay) || 0)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatCurrency(Number(bt.total_deductions) || 0)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatCurrency(Number(bt.refunds) || 0)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">
                        {formatCurrency(Number(bt.net_pay) || 0)}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-600">
                        {bt.journal_entry_id_accrual ? 'Posted' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td className="px-4 py-2 font-medium text-gray-900">Franchise brands total</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">
                      {formatCurrency(
                        payrollBrandTotals.reduce((s, b) => s + (Number(b.gross_pay) || 0), 0)
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">
                      {formatCurrency(
                        payrollBrandTotals.reduce((s, b) => s + (Number(b.total_deductions) || 0), 0)
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">
                      {formatCurrency(
                        payrollBrandTotals.reduce((s, b) => s + (Number(b.refunds) || 0), 0)
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">
                      {formatCurrency(
                        payrollBrandTotals.reduce((s, b) => s + (Number(b.net_pay) || 0), 0)
                      )}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className={dashboardThemeIconBadge(theme)}>
              <Clock className={`h-6 w-6 ${dashboardThemeIcon(theme)}`} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Regular Hours</p>
              <p className="text-2xl font-semibold text-gray-900">
                {getTotalRegularHours.toFixed(1)}
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
                {getTotalDoublePayHours.toFixed(1)} hrs
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
                {getTotalSpecialPayHours.toFixed(1)} hrs
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className={dashboardThemeIconBadge(theme)}>
              <Calculator className={`h-6 w-6 ${dashboardThemeIcon(theme)}`} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Net Pay</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(getTotalNetPay)}
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
               {PAYROLL_PERIOD_LABELS[selectedPeriod]} Payroll Details
             </h3>
             <div className="flex items-center space-x-4">
               <button
                 onClick={printAllPayslips}
                 className={`flex items-center space-x-2 px-4 py-2 rounded-md ${accountingThemeSolidButton(theme)}`}
               >
                 <Printer className="h-4 w-4" />
                 <span>Print All</span>
               </button>
             </div>
           </div>
         </div>
        
        {!hasPayrollData ? (
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
                    Deductions & Refunds
                  </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Pay Breakdown
                   </th>
                 </tr>
               </thead>
               <tbody className="bg-white divide-y divide-gray-200">
                 {getPayrollEntries.map((entry, index) => (
                   <tr 
                     key={index} 
                     className="align-top hover:bg-gray-50 cursor-pointer transition-colors duration-200 hover:shadow-md"
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
                        <div className={`text-xs font-medium mt-1 pt-1 border-t border-gray-200 ${dashboardThemeAccentText(theme)}`}>
                          Avg Sales This Week: ₱{entry.averageWeeklySales.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      )}
                      {entry.averageMonthlySales !== undefined && entry.averageMonthlySales > 0 && (
                        <div className={`text-xs font-medium mt-0.5 ${dashboardThemeAccentText('blue')}`}>
                          Avg Sales This Month: ₱{entry.averageMonthlySales.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      )}
                    </td>
                     <td className="px-6 py-4 text-sm text-gray-900">
                       {Object.keys(entry.locationGroups).length === 0 ? (
                         <span className="text-xs text-gray-400 italic">No days worked</span>
                       ) : (
                       <div className="space-y-2.5 max-w-lg">
                         {Object.entries(entry.locationGroups).map(([locationName, days]) => {
                           const dayList = days as Array<{
                             date: string
                             dayName: string
                             hours: number
                             scheduleDate: string
                             brandName: string
                             isAbsent?: boolean
                           }>
                           const brandName = dayList[0]?.brandName || 'Unknown Brand'
                           const locationHours = dayList.reduce((sum, day) => sum + (day.isAbsent ? 0 : day.hours), 0)
                           const dayCount = dayList.length

                           return (
                           <div
                             key={locationName}
                             className={`rounded-lg border border-gray-200 bg-white border-l-4 ${getBrandAccentBorder(brandName)} shadow-sm overflow-hidden`}
                           >
                             <div className="flex items-start justify-between gap-3 px-3 py-2 bg-gray-50/90 border-b border-gray-100">
                               <div className="flex flex-col gap-1 min-w-0">
                                 <span className={`inline-flex self-start items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBrandTagClasses(brandName)}`}>
                                   {brandName}
                                 </span>
                                 <span className="flex items-center gap-1 text-xs font-semibold text-gray-800">
                                   <MapPin className="h-3 w-3 text-gray-400 shrink-0" />
                                   <span className="truncate">{locationName}</span>
                                 </span>
                               </div>
                               <div className="text-right shrink-0">
                                 <div className="text-xs font-semibold text-gray-700">
                                   {dayCount} {dayCount === 1 ? 'day' : 'days'}
                                 </div>
                                 <div className="text-[10px] text-gray-500">{locationHours.toFixed(0)}h total</div>
                               </div>
                             </div>
                             <div className="flex flex-wrap gap-1.5 p-2.5">
                               {dayList.map((day, dayIndex) => {
                                 const dayStatus = getDayStatusForDate(day.scheduleDate)
                                 const dayDiscrepancy = getDayDiscrepancy(entry.staffId, day.scheduleDate)
                                 const dayIncentive = getDayIncentive(entry, day.scheduleDate)
                                 const colorClasses = day.isAbsent
                                   ? 'bg-red-200 text-red-900 border border-red-300'
                                   : getDayColorClasses(dayStatus)

                                 return (
                                   <div
                                     key={dayIndex}
                                     className={`relative min-w-[54px] rounded-md px-1.5 py-1 text-center text-xs font-medium ${colorClasses}`}
                                   >
                                     {dayDiscrepancy > 0 && (
                                       <span
                                         className="absolute -top-1.5 -right-1.5 z-10 min-w-[1.125rem] rounded-full bg-red-500 px-1 py-0.5 text-[8px] font-bold leading-none text-white shadow-sm"
                                         title={`DSIR discrepancy: ₱${dayDiscrepancy.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
                                       >
                                         {formatDiscrepancyBubble(dayDiscrepancy)}
                                       </span>
                                     )}
                                     {dayIncentive > 0 && (
                                       <span
                                         className="absolute -bottom-1.5 -left-1.5 z-10 min-w-[1.125rem] rounded-full bg-emerald-500 px-1 py-0.5 text-[8px] font-bold leading-none text-white shadow-sm"
                                         title={`Incentive pay: ₱${dayIncentive.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
                                       >
                                         {formatDiscrepancyBubble(dayIncentive)}
                                       </span>
                                     )}
                                     <div className="text-[11px] font-bold leading-tight">{day.date}</div>
                                     <div className="text-[10px] opacity-80 leading-tight">{day.dayName}</div>
                                     <div className="text-[10px] font-semibold leading-tight">
                                       {day.isAbsent ? 'ABSENT' : `${day.hours}h`}
                                     </div>
                                   </div>
                                 )
                               })}
                             </div>
                           </div>
                         )})}
                       </div>
                       )}
                     </td>
                     <td
                       className="px-6 py-4 align-top text-sm text-gray-900"
                       onClick={(e) => e.stopPropagation()}
                     >
                       {renderDeductionsRefundsCell(entry)}
                     </td>
                     <td className="px-6 py-4 align-top text-sm text-gray-900">
                       {renderPayBreakdownCell(entry)}
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

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

