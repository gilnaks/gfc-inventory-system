'use client'
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit3, X, MapPin, Building2, User, Phone, Hash, Trash2, Check, Calendar, ChevronLeft, ChevronRight, RefreshCw, CalendarX, MessageSquare, Megaphone, Mail, Copy } from 'lucide-react'
import { Modal } from './Modal'
import { useAdminPasswordConfirm } from '../hooks/useAdminPasswordConfirm'
import { getBrandHighlightClasses } from '../../lib/brand-colors'
import { isFactoryBrand } from '../../lib/brand-roles'
import { isAdminLevelRole, isDashboardRole } from '../../lib/dashboard-roles'
import {
  gfcMainHasExplicitScheduleHours,
  isRetailFactoryBranch,
  normalizeLocationBrand,
  normalizeScheduleLocation,
  staffMemberIsGfcMain,
} from '../../lib/gfc-main-branches'


interface StaffRegistration {
  id: string
  full_name: string
  mobile_number: string
  staff_code: string
  is_active: boolean
  created_at: string
  updated_at: string
  hourly_rate?: number
  employment_date?: string
  leave_balance?: number
  total_warnings?: number
}

interface Location {
  id: string
  name: string
  brand_id: string
  company_owned?: boolean
  is_factory_floor?: boolean
  brand?: {
    id: string
    name: string
    brand_role?: string
    slug?: string
  }
}

interface StaffAssignment {
  id: string
  staff_registration_id: string
  location_id: string
  assigned_by_location_id: string
  created_at: string
  location: Location
  assigned_by_location: Location
}

interface StaffWithAssignments extends StaffRegistration {
  staff_assignments: StaffAssignment[]
}

interface LeaveRequest {
  id: string
  staff_registration_id: string
  location_id: string
  request_type: 'absence_sickness' | 'absence_family' | 'absence_authorized' | 'absence_personal' | 'absence_bereavement' | 'absence_vacation' | 'absence_admin'
  start_date: string
  end_date: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  admin_notes?: string
  created_at: string
  updated_at: string
  staff_registrations: StaffRegistration
  locations: Location
}

interface StaffManagerProps {
  theme?: string
}

const STAFF_NAME_SKELETON_WIDTHS = [
  'max-w-[6rem]',
  'max-w-[8rem]',
  'max-w-[5.5rem]',
  'max-w-[7rem]',
  'max-w-[6.5rem]',
  'max-w-[7.5rem]',
] as const

function StaffManagerPageSkeleton() {
  const rowPatterns = [
    { assignments: 1, leaveWide: false },
    { assignments: 2, leaveWide: true },
    { assignments: 1, leaveWide: false },
    { assignments: 3, leaveWide: false },
    { assignments: 1, leaveWide: true },
    { assignments: 2, leaveWide: false },
    { assignments: 2, leaveWide: false },
    { assignments: 1, leaveWide: true },
    { assignments: 3, leaveWide: false },
  ]

  const groupHeaderWidths = ['w-36', 'w-28', 'w-32'] as const

  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <div className="mb-2 h-8 w-48 rounded bg-gray-200" />
          <div className="h-4 w-64 rounded bg-gray-200" />
        </div>
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-x-3 sm:space-y-0">
          <div className="h-10 w-32 rounded bg-gray-200" />
          <div className="h-10 w-32 rounded bg-gray-200" />
          <div className="h-10 w-32 rounded bg-gray-200" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="w-full table-fixed divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Staff Member', 'Contact', 'Assignments', 'Leave Balance / Warnings', 'Status', 'Actions'].map(
                (header) => (
                  <th
                    key={header}
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    <div className="h-3 rounded bg-gray-200 w-20 max-w-full" />
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {[0, 1, 2].map((groupIndex) => (
              <React.Fragment key={groupIndex}>
                <tr className="bg-gray-100">
                  <td colSpan={6} className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded bg-gray-200" />
                      <div className={`h-4 rounded bg-gray-300 ${groupHeaderWidths[groupIndex]}`} />
                      <div className="h-3 w-20 rounded bg-gray-200" />
                    </div>
                  </td>
                </tr>
                {rowPatterns.slice(groupIndex * 3, groupIndex * 3 + 3).map((pattern, rowIndex) => {
                  const absoluteIndex = groupIndex * 3 + rowIndex
                  return (
                    <tr key={absoluteIndex}>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200" />
                          <div className="ml-4 min-w-0">
                            <div
                              className={`mb-1 h-4 rounded bg-gray-300 ${STAFF_NAME_SKELETON_WIDTHS[absoluteIndex % STAFF_NAME_SKELETON_WIDTHS.length]}`}
                            />
                            <div className="h-3 w-16 rounded bg-gray-200" />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 w-24 rounded bg-gray-200" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {Array.from({ length: pattern.assignments }).map((_, assignmentIndex) => (
                            <div
                              key={assignmentIndex}
                              className={`h-3 rounded bg-gray-200 ${
                                assignmentIndex === 0 ? 'w-full max-w-[8rem]' : 'w-full max-w-[6rem]'
                              }`}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div className={`h-5 rounded-full bg-gray-200 ${pattern.leaveWide ? 'w-16' : 'w-14'}`} />
                          <div className="h-5 w-12 rounded-full bg-gray-200" />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-6 w-14 rounded-full bg-gray-200" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded bg-gray-200" />
                          <div className="h-4 w-4 rounded bg-gray-200" />
                          <div className="h-4 w-4 rounded bg-gray-200" />
                          <div className="h-4 w-4 rounded bg-gray-200" />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StaffModalHistorySkeleton({
  rows = 4,
  variant = 'default',
}: {
  rows?: number
  variant?: 'default' | 'compact'
}) {
  const patterns = [
    { title: 'w-40', body: 'h-10', meta: 'w-16' },
    { title: 'w-32', body: 'h-14', meta: 'w-20' },
    { title: 'w-48', body: 'h-8', meta: 'w-14' },
    { title: 'w-36', body: 'h-12', meta: 'w-16' },
    { title: 'w-28', body: 'h-9', meta: 'w-12' },
  ]

  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, index) => {
        const pattern = patterns[index % patterns.length]
        return (
          <div
            key={index}
            className={`rounded-lg border border-gray-200 bg-gray-50 ${variant === 'compact' ? 'p-3' : 'p-4'}`}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className={`h-4 rounded bg-gray-200 ${pattern.title}`} />
              <div className={`h-3 rounded bg-gray-200 ${pattern.meta}`} />
            </div>
            <div className={`rounded bg-gray-200 ${pattern.body} w-full`} />
          </div>
        )
      })}
    </div>
  )
}

function StaffLeaveHistorySkeleton() {
  const patterns = [
    { title: 'w-36', badge: 'w-16', rows: ['w-28', 'w-24'] },
    { title: 'w-44', badge: 'w-20', rows: ['w-32', 'w-20', 'w-24'] },
    { title: 'w-32', badge: 'w-14', rows: ['w-24', 'w-28'] },
    { title: 'w-40', badge: 'w-20', rows: ['max-w-[7.5rem]', 'max-w-[5.5rem]', 'max-w-[6.5rem]'] },
  ]

  return (
    <div className="space-y-4 animate-pulse">
      {patterns.map((pattern, index) => (
        <div key={index} className="rounded-lg border border-gray-200 p-4">
          <div className="mb-3 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-5 rounded bg-gray-200 ${pattern.title}`} />
              <div className={`h-5 rounded-full bg-gray-200 ${pattern.badge}`} />
            </div>
            <div className="h-8 w-8 rounded bg-gray-200" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {pattern.rows.map((width, rowIndex) => (
              <div key={rowIndex} className={`h-3 rounded bg-gray-200 ${width}`} />
            ))}
          </div>
          <div className="mt-3 h-8 w-full rounded bg-gray-100" />
        </div>
      ))}
    </div>
  )
}

function StaffScheduleModalSkeleton() {
  const storePatterns = [
    { name: 'w-32', brand: 'w-20', cells: [1, 0, 2, 0, 1, 0, 1] },
    { name: 'w-24', brand: 'w-16', cells: [0, 1, 0, 1, 0, 2, 0] },
    { name: 'w-36', brand: 'w-24', cells: [2, 1, 0, 1, 1, 0, 0] },
    { name: 'w-28', brand: 'w-16', cells: [0, 0, 1, 0, 0, 1, 2] },
    { name: 'max-w-[7.5rem]', brand: 'w-20', cells: [1, 1, 0, 0, 1, 0, 1] },
    { name: 'max-w-[6.5rem]', brand: 'w-14', cells: [0, 2, 1, 0, 0, 1, 0] },
  ]

  return (
    <div className="animate-pulse min-w-[1264px]">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white bg-gray-50">
            <th className="w-64 min-w-64 border-r border-white px-6 py-4">
              <div className="h-4 w-16 rounded bg-gray-200" />
            </th>
            {Array.from({ length: 7 }).map((_, index) => (
              <th key={index} className="w-36 border-r border-white px-2 py-3 last:border-r-0">
                <div className="mx-auto mb-1 h-5 w-6 rounded bg-gray-200" />
                <div className="mx-auto h-3 w-10 rounded bg-gray-200" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white">
          <tr className="bg-slate-200">
            <td colSpan={8} className="px-6 py-2">
              <div className="h-3 w-24 rounded bg-slate-300" />
            </td>
          </tr>
          {storePatterns.map((store, rowIndex) => (
            <tr key={rowIndex} className="bg-white">
              <td className="w-64 min-w-64 border-r border-white px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gray-200" />
                  <div>
                    <div className={`mb-1 h-4 rounded bg-gray-300 ${store.name}`} />
                    <div className={`h-3 rounded bg-gray-200 ${store.brand}`} />
                  </div>
                </div>
              </td>
              {store.cells.map((chipCount, dayIndex) => (
                <td key={dayIndex} className="w-36 border-r border-white px-2 py-3 align-top last:border-r-0">
                  <div className="flex min-h-[3rem] flex-col gap-1">
                    {chipCount === 0 ? (
                      <div className="h-8 rounded bg-gray-100" />
                    ) : (
                      Array.from({ length: chipCount }).map((_, chipIndex) => (
                        <div
                          key={chipIndex}
                          className={`rounded bg-gray-200 ${chipIndex === 0 ? 'h-7' : 'h-6'} ${
                            chipIndex === 0 ? 'w-full max-w-[5.5rem]' : 'w-full max-w-[4.5rem]'
                          }`}
                        />
                      ))
                    )}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function StaffManager({ theme = 'blue' }: StaffManagerProps) {
  const { requestAdminPassword, AdminPasswordModal } = useAdminPasswordConfirm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [staff, setStaff] = useState<StaffWithAssignments[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [editingStaff, setEditingStaff] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  
  // Editing state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffWithAssignments | null>(null)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [isLeaveRequestModalOpen, setIsLeaveRequestModalOpen] = useState(false)
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState<LeaveRequest | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [showLeaveRequests, setShowLeaveRequests] = useState(false)
  const [isLeaveHistoryModalOpen, setIsLeaveHistoryModalOpen] = useState(false)
  const [staffLeaveHistory, setStaffLeaveHistory] = useState<LeaveRequest[]>([])
  const [selectedStaffForHistory, setSelectedStaffForHistory] = useState<StaffWithAssignments | null>(null)
  
  // Announcement state
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false)
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false)
  const [selectedStaffForMessage, setSelectedStaffForMessage] = useState<StaffWithAssignments | null>(null)
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    message: '',
    type: 'general' as 'general' | 'reminder'
  })
  const [messageForm, setMessageForm] = useState({
    title: '',
    message: '',
    type: 'notice' as 'notice' | 'warning'
  })
  const [announcementHistory, setAnnouncementHistory] = useState<any[]>([])
  const [messageHistory, setMessageHistory] = useState<any[]>([])
  const [loadingAnnouncementHistory, setLoadingAnnouncementHistory] = useState(false)
  const [loadingMessageHistory, setLoadingMessageHistory] = useState(false)
  const [loadingLeaveHistory, setLoadingLeaveHistory] = useState(false)
  const [loadingScheduleData, setLoadingScheduleData] = useState(false)
  const [announcementFieldErrors, setAnnouncementFieldErrors] = useState({ title: false, message: false })
  const [messageFieldErrors, setMessageFieldErrors] = useState({ title: false, message: false })
  
  const [editForm, setEditForm] = useState({
    full_name: '',
    mobile_number: '',
    staff_code: '',
    hourly_rate: 0,
    employment_date: '',
    leave_balance: 10,
    total_warnings: 0
  })
  
  // Assignment management
  const [isAddAssignmentOpen, setIsAddAssignmentOpen] = useState(false)
  const [newAssignment, setNewAssignment] = useState({
    brand_id: '',
    location_id: ''
  })
  
  // Staff scheduling
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [schedule, setSchedule] = useState<{[key: string]: {[key: string]: string[]}}>({})
  const [originalSchedule, setOriginalSchedule] = useState<{[key: string]: {[key: string]: string[]}}>({})
  const [staffHours, setStaffHours] = useState<{[key: string]: {[key: string]: {[key: string]: number}}}>({})
  const [originalStaffHours, setOriginalStaffHours] = useState<{[key: string]: {[key: string]: {[key: string]: number}}}>({})
  const [scheduleHoursOverridden, setScheduleHoursOverridden] = useState<Set<string>>(new Set())
  const [originalScheduleHoursOverridden, setOriginalScheduleHoursOverridden] = useState<Set<string>>(new Set())
  const [companyLocations, setCompanyLocations] = useState<Location[]>([])
  const [companyStaff, setCompanyStaff] = useState<StaffWithAssignments[]>([])
  const [isScheduleAdmin, setIsScheduleAdmin] = useState(false)
  const [todaySchedules, setTodaySchedules] = useState<{[key: string]: any}>({})
  const [showOnlyTodayStaff, setShowOnlyTodayStaff] = useState(false)
  const [dayStatus, setDayStatus] = useState<{[key: string]: 'default' | 'regular-holiday' | 'special-holiday'}>({})
  const [originalDayStatus, setOriginalDayStatus] = useState<{[key: string]: 'default' | 'regular-holiday' | 'special-holiday'}>({})
  const [absentStaff, setAbsentStaff] = useState<{[key: string]: {[key: string]: {[key: string]: boolean}}}>({}) // {locationId: {dayKey: {staffId: isAbsent}}}
  const [hoveredStaffId, setHoveredStaffId] = useState<string | null>(null) // Track hovered staff for highlighting
  const [scheduleJustSaved, setScheduleJustSaved] = useState(false) // Track if schedule was just saved
  const [selectedStaffForSchedule, setSelectedStaffForSchedule] = useState<string | null>(null) // Main staff selector for quick-add
  const scheduleModalOpenedRef = useRef(false)
  
  // New staff form
  const [newStaff, setNewStaff] = useState({
    full_name: '',
    mobile_number: '',
    staff_code: '',
    hourly_rate: 0,
    employment_date: '',
    leave_balance: 10
  })

  const colors = useMemo(() => {
    switch (theme) {
      case 'green':
        return {
          primary: 'bg-green-600 hover:bg-green-700',
          secondary: 'bg-green-100 text-green-800',
          border: 'border-green-300',
          focus: 'focus:ring-green-500 focus:border-green-500',
          danger: 'bg-red-600 hover:bg-red-700'
        }
      case 'red':
        return {
          primary: 'bg-red-600 hover:bg-red-700',
          secondary: 'bg-red-100 text-red-800',
          border: 'border-red-300',
          focus: 'focus:ring-red-500 focus:border-red-500',
          danger: 'bg-red-600 hover:bg-red-700'
        }
      case 'yellow':
        return {
          primary: 'bg-yellow-600 hover:bg-yellow-700',
          secondary: 'bg-yellow-100 text-yellow-800',
          border: 'border-yellow-300',
          focus: 'focus:ring-yellow-500 focus:border-yellow-500',
          danger: 'bg-red-600 hover:bg-red-700'
        }
      default:
        return {
          primary: 'bg-blue-600 hover:bg-blue-700',
          secondary: 'bg-blue-100 text-blue-800',
          border: 'border-blue-300',
          focus: 'focus:ring-blue-500 focus:border-blue-500',
          danger: 'bg-red-600 hover:bg-red-700'
        }
    }
  }, [theme])

  useEffect(() => {
    loadData()
    loadTodaySchedules()
    loadLeaveRequests()
    const savedRole = localStorage.getItem('dashboard_role')
    setIsScheduleAdmin(isDashboardRole(savedRole) && isAdminLevelRole(savedRole))
  }, [])

  // Load schedule when week changes (like in StaffSchedule component)
  useEffect(() => {
    if (!isScheduleModalOpen) {
      scheduleModalOpenedRef.current = false
      return
    }

    if (!scheduleModalOpenedRef.current) {
      scheduleModalOpenedRef.current = true
      return
    }

    let cancelled = false
    void (async () => {
      setLoadingScheduleData(true)
      try {
        await loadExistingSchedule()
      } finally {
        if (!cancelled) setLoadingScheduleData(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [currentWeek, isScheduleModalOpen])

  // Reset scheduleJustSaved flag when schedule changes
  useEffect(() => {
    if (scheduleJustSaved && hasScheduleChanges()) {
      setScheduleJustSaved(false)
    }
  }, [schedule, staffHours, dayStatus, absentStaff])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load staff with assignments
      const { data: staffData, error: staffError } = await supabase
        .from('staff_registrations')
        .select(`
          *,
          staff_assignments (
            id,
            location_id,
            assigned_by_location_id,
            created_at,
            location:locations!staff_assignments_location_id_fkey (
              id,
              name,
              brand_id,
              brand:brands!locations_brand_id_fkey (
                id,
                name
              )
            ),
            assigned_by_location:locations!staff_assignments_assigned_by_location_id_fkey (
              id,
              name,
              brand_id,
              brand:brands!locations_brand_id_fkey (
                id,
                name
              )
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (staffError) throw staffError

      // Load locations for assignment dropdowns
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select(`
          *,
          brand:brands!locations_brand_id_fkey (
            id,
            name
          )
        `)
        .order('name')

      if (locationsError) throw locationsError

      // Load brands
      const { data: brandsData, error: brandsError } = await supabase
        .from('brands')
        .select('*')
        .order('name')

      if (brandsError) throw brandsError

      // Sort staff by location assignments
      const sortedStaff = (staffData || []).sort((a, b) => {
        // Staff with assignments first, then by location name
        if (a.staff_assignments.length === 0 && b.staff_assignments.length > 0) return 1
        if (a.staff_assignments.length > 0 && b.staff_assignments.length === 0) return -1
        if (a.staff_assignments.length === 0 && b.staff_assignments.length === 0) {
          return a.full_name.localeCompare(b.full_name)
        }
        
        // Sort by first assignment location name
        const aLocation = a.staff_assignments[0]?.location?.name || ''
        const bLocation = b.staff_assignments[0]?.location?.name || ''
        return aLocation.localeCompare(bLocation)
      })
      
      setStaff(sortedStaff)
      setLocations(locationsData || [])
      setBrands(brandsData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Failed to load staff data')
    } finally {
      setLoading(false)
    }
  }

  const generateStaffCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  const loadLeaveRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          staff_registrations!staff_registration_id(*),
          locations!location_id(*)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      setLeaveRequests(data || [])
    } catch (error) {
      console.error('Error loading leave requests:', error)
    }
  }

  // Calculate number of days between two dates
  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 // +1 to include both start and end dates
    return diffDays
  }

  const openLeaveRequestModal = (request: LeaveRequest) => {
    setSelectedLeaveRequest(request)
    setAdminNotes(request.admin_notes || '')
    setIsLeaveRequestModalOpen(true)
  }

  const handleLeaveRequestDecision = async (status: 'approved' | 'rejected') => {
    if (!selectedLeaveRequest) return

    setSaving(true)
    try {
      // Update leave request status
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status,
          admin_notes: adminNotes.trim() || null,
          approved_at: new Date().toISOString()
        })
        .eq('id', selectedLeaveRequest.id)

      if (error) throw error

      // If approved, deduct days from staff leave balance (except for authorized absence)
      if (status === 'approved' && selectedLeaveRequest.request_type !== 'absence_authorized') {
        const daysRequested = calculateDays(selectedLeaveRequest.start_date, selectedLeaveRequest.end_date)
        const currentBalance = selectedLeaveRequest.staff_registrations.leave_balance ?? 10
        const newBalance = Math.max(0, currentBalance - daysRequested) // Ensure balance doesn't go below 0

        const { error: balanceError } = await supabase
          .from('staff_registrations')
          .update({ leave_balance: newBalance })
          .eq('id', selectedLeaveRequest.staff_registration_id)

        if (balanceError) {
          console.error('Error updating leave balance:', balanceError)
          setError('Leave request approved but failed to update balance')
          return
        }

        // Update local staff state to reflect new balance
        setStaff(prevStaff => 
          prevStaff.map(s => 
            s.id === selectedLeaveRequest.staff_registration_id 
              ? { ...s, leave_balance: newBalance }
              : s
          )
        )
      }

      // Refresh leave requests
      await loadLeaveRequests()
      setIsLeaveRequestModalOpen(false)
      setSelectedLeaveRequest(null)
      setAdminNotes('')
      setSuccess(`Leave request ${status} successfully!`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error updating leave request:', error)
      setError('Failed to update leave request')
    } finally {
      setSaving(false)
    }
  }

  const openLeaveHistoryModal = async (staff: StaffWithAssignments) => {
    setSelectedStaffForHistory(staff)
    setStaffLeaveHistory([])
    setIsLeaveHistoryModalOpen(true)
    setLoadingLeaveHistory(true)

    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          locations!location_id(*)
        `)
        .eq('staff_registration_id', staff.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setStaffLeaveHistory(data || [])
    } catch (error) {
      console.error('Error loading staff leave history:', error)
      setError('Failed to load leave history')
    } finally {
      setLoadingLeaveHistory(false)
    }
  }

  const deleteLeaveRequest = async (requestId: string, staffId: string) => {
    if (!confirm('Are you sure you want to delete this leave request? This action cannot be undone.')) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('leave_requests')
        .delete()
        .eq('id', requestId)

      if (error) throw error

      // Refresh the leave history for this staff member
      setStaffLeaveHistory(prev => prev.filter(req => req.id !== requestId))
      
      setSuccess('Leave request deleted successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error deleting leave request:', error)
      setError('Failed to delete leave request')
    } finally {
      setSaving(false)
    }
  }

  const loadAnnouncementHistory = async () => {
    setLoadingAnnouncementHistory(true)
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .is('staff_registration_id', null)
        .in('type', ['general', 'reminder'])
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setAnnouncementHistory(data || [])
    } catch (error) {
      console.error('Error loading announcement history:', error)
    } finally {
      setLoadingAnnouncementHistory(false)
    }
  }

  const loadMessageHistory = async (staffId: string) => {
    setLoadingMessageHistory(true)
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('staff_registration_id', staffId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setMessageHistory(data || [])
    } catch (error) {
      console.error('Error loading message history:', error)
    } finally {
      setLoadingMessageHistory(false)
    }
  }

  const createAnnouncement = async () => {
    const titleEmpty = !announcementForm.title.trim()
    const messageEmpty = !announcementForm.message.trim()
    
    if (titleEmpty || messageEmpty) {
      setAnnouncementFieldErrors({ title: titleEmpty, message: messageEmpty })
      setTimeout(() => setAnnouncementFieldErrors({ title: false, message: false }), 2000)
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('announcements')
        .insert({
          title: announcementForm.title.trim(),
          message: announcementForm.message.trim(),
          type: announcementForm.type,
          staff_registration_id: null,
          created_by: 'Admin',
          is_active: true
        })

      if (error) throw error

      setAnnouncementForm({ title: '', message: '', type: 'general' })
      await loadAnnouncementHistory() // Reload history
      setSuccess('General announcement created successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error creating announcement:', error)
      setError('Failed to create announcement')
    } finally {
      setSaving(false)
    }
  }

  const openAnnouncementModal = async () => {
    setAnnouncementForm({ title: '', message: '', type: 'general' })
    setAnnouncementHistory([]) // Clear previous history
    setIsAnnouncementModalOpen(true)
    await loadAnnouncementHistory()
  }

  const openMessageModal = async (staff: StaffWithAssignments) => {
    setSelectedStaffForMessage(staff)
    setMessageForm({ title: '', message: '', type: 'notice' })
    setMessageHistory([]) // Clear previous history
    setIsMessageModalOpen(true)
    await loadMessageHistory(staff.id)
  }

  const sendStaffMessage = async () => {
    if (!selectedStaffForMessage) return

    const titleEmpty = !messageForm.title.trim()
    const messageEmpty = !messageForm.message.trim()
    
    if (titleEmpty || messageEmpty) {
      setMessageFieldErrors({ title: titleEmpty, message: messageEmpty })
      setTimeout(() => setMessageFieldErrors({ title: false, message: false }), 2000)
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('announcements')
        .insert({
          title: messageForm.title.trim(),
          message: messageForm.message.trim(),
          type: messageForm.type,
          staff_registration_id: selectedStaffForMessage.id,
          created_by: 'Admin',
          is_active: true
        })

      if (error) throw error

      setMessageForm({ title: '', message: '', type: 'notice' })
      await loadMessageHistory(selectedStaffForMessage.id) // Reload history
      setSuccess(`${messageForm.type === 'warning' ? 'Warning' : 'Notice'} sent to ${selectedStaffForMessage.full_name}!`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error sending message:', error)
      setError('Failed to send message')
    } finally {
      setSaving(false)
    }
  }

  const deleteAnnouncement = async (announcementId: string) => {
    if (!confirm('Are you sure you want to delete this announcement? This action cannot be undone.')) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcementId)

      if (error) throw error

      // Reload the appropriate history
      await loadAnnouncementHistory()
      setSuccess('Announcement deleted successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error deleting announcement:', error)
      setError('Failed to delete announcement')
    } finally {
      setSaving(false)
    }
  }

  const deleteMessage = async (messageId: string, staffId: string) => {
    if (!confirm('Are you sure you want to delete this message? This action cannot be undone.')) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', messageId)

      if (error) throw error

      // Reload the message history
      await loadMessageHistory(staffId)
      setSuccess('Message deleted successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error deleting message:', error)
      setError('Failed to delete message')
    } finally {
      setSaving(false)
    }
  }

  const addStaff = async () => {
    setSaving(true)
    try {
      const staffCode = newStaff.staff_code.trim() || generateStaffCode()
      
      const { data: newStaffData, error } = await supabase
        .from('staff_registrations')
        .insert({
          full_name: newStaff.full_name.trim(),
          mobile_number: newStaff.mobile_number.trim(),
          staff_code: staffCode,
          hourly_rate: newStaff.hourly_rate,
          employment_date: newStaff.employment_date,
          leave_balance: newStaff.leave_balance,
          is_active: true
        })
        .select()
        .single()

      if (error) throw error

      // Add the new staff to the existing list instead of reloading everything
      const newStaffWithAssignments = { ...newStaffData, staff_assignments: [] }
      setStaff(prevStaff => [...prevStaff, newStaffWithAssignments])
      
      setNewStaff({ full_name: '', mobile_number: '', staff_code: '', hourly_rate: 0, employment_date: '', leave_balance: 10 })
      setIsAddModalOpen(false)
      setSuccess('Staff member added successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error adding staff:', error)
      setError('Failed to add staff member')
    } finally {
      setSaving(false)
    }
  }

  const updateStaff = async (staffId: string, field: string, value: string) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('staff_registrations')
        .update({ [field]: value.trim() })
        .eq('id', staffId)

      if (error) throw error

      // Update the specific staff member in the list instead of reloading everything
      setStaff(prevStaff => 
        prevStaff.map(staffMember => 
          staffMember.id === staffId 
            ? { ...staffMember, [field]: value, updated_at: new Date().toISOString() }
            : staffMember
        )
      )
      
      setEditingStaff(null)
      setEditingField(null)
      setEditingValue('')
      setSuccess('Staff member updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error updating staff:', error)
      setError('Failed to update staff member')
    } finally {
      setSaving(false)
    }
  }

  const deleteStaff = async (staffId: string) => {
    setSaving(true)
    try {
      // First delete all assignments
      const { error: assignmentsError } = await supabase
        .from('staff_assignments')
        .delete()
        .eq('staff_registration_id', staffId)

      if (assignmentsError) throw assignmentsError

      // Then delete the staff member
      const { error: staffError } = await supabase
        .from('staff_registrations')
        .delete()
        .eq('id', staffId)

      if (staffError) throw staffError

      // Remove the staff member from the list instead of reloading everything
      setStaff(prevStaff => prevStaff.filter(staffMember => staffMember.id !== staffId))
      
      // Close edit modal if it was open for this staff member
      if (selectedStaff && selectedStaff.id === staffId) {
        setIsEditModalOpen(false)
        setSelectedStaff(null)
      }
      
      setSuccess('Staff member deleted successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error deleting staff:', error)
      setError('Failed to delete staff member')
    } finally {
      setSaving(false)
    }
  }

  const toggleStaffStatus = async (staffId: string, currentStatus: boolean) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('staff_registrations')
        .update({ is_active: !currentStatus })
        .eq('id', staffId)

      if (error) throw error

      // Update the specific staff member's status in the list instead of reloading everything
      setStaff(prevStaff => 
        prevStaff.map(staffMember => 
          staffMember.id === staffId 
            ? { ...staffMember, is_active: !currentStatus, updated_at: new Date().toISOString() }
            : staffMember
        )
      )
      
      // Update selectedStaff if it's the same staff member
      if (selectedStaff && selectedStaff.id === staffId) {
        setSelectedStaff(prev => ({ ...prev, is_active: !currentStatus, updated_at: new Date().toISOString() }))
      }
      
      setSuccess(`Staff member ${!currentStatus ? 'activated' : 'deactivated'} successfully!`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error updating staff status:', error)
      setError('Failed to update staff status')
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (staff: StaffWithAssignments) => {
    setSelectedStaff(staff)
    setEditForm({
      full_name: staff.full_name,
      mobile_number: staff.mobile_number,
      staff_code: staff.staff_code,
      hourly_rate: staff.hourly_rate || 0,
      employment_date: staff.employment_date || '',
      leave_balance: staff.leave_balance || 10,
      total_warnings: staff.total_warnings || 0
    })
    setIsEditModalOpen(true)
  }

  const saveEditModal = async () => {
    if (!selectedStaff) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('staff_registrations')
        .update({
          full_name: editForm.full_name.trim(),
          mobile_number: editForm.mobile_number.trim(),
          staff_code: editForm.staff_code.trim(),
          hourly_rate: editForm.hourly_rate,
          employment_date: editForm.employment_date,
          leave_balance: editForm.leave_balance,
          total_warnings: editForm.total_warnings
        })
        .eq('id', selectedStaff.id)

      if (error) throw error

      // Update local state without full refresh
      setStaff(prev => prev.map(s => 
        s.id === selectedStaff.id 
          ? { ...s, ...editForm, updated_at: new Date().toISOString() }
          : s
      ))
      
      // Update selectedStaff as well
      setSelectedStaff(prev => ({ ...prev, ...editForm, updated_at: new Date().toISOString() }))
      
      setIsEditModalOpen(false)
      setSuccess('Staff member updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error updating staff:', error)
      setError('Failed to update staff member')
    } finally {
      setSaving(false)
    }
  }

  const addAssignment = async () => {
    if (!selectedStaff || !newAssignment.brand_id || !newAssignment.location_id) {
      setError('Please select both brand and location')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('staff_assignments')
        .insert({
          staff_registration_id: selectedStaff.id,
          location_id: newAssignment.location_id,
          assigned_by_location_id: newAssignment.location_id // Auto-set to same location
        })

      if (error) throw error

      // Get the location details for the new assignment
      const location = locations.find(loc => loc.id === newAssignment.location_id)
      const brand = brands.find(b => b.id === newAssignment.brand_id)
      
      if (location && brand) {
        const newAssignmentData = {
          id: Date.now().toString(), // Temporary ID for UI
          staff_registration_id: selectedStaff.id,
          location_id: newAssignment.location_id,
          assigned_by_location_id: newAssignment.location_id,
          created_at: new Date().toISOString(),
          location: {
            id: location.id,
            name: location.name,
            brand_id: brand.id,
            brand: {
              id: brand.id,
              name: brand.name
            }
          },
          assigned_by_location: {
            id: location.id,
            name: location.name,
            brand_id: brand.id,
            brand: {
              id: brand.id,
              name: brand.name
            }
          }
        }

        // Update selectedStaff with the new assignment
        if (selectedStaff) {
          setSelectedStaff(prev => ({
            ...prev,
            staff_assignments: [...prev.staff_assignments, newAssignmentData]
          }))
        }

         // Update the staff list as well
         setStaff(prevStaff => 
           prevStaff.map(staffMember => 
             staffMember.id === selectedStaff?.id 
               ? { 
                   ...staffMember, 
                   staff_assignments: [...staffMember.staff_assignments, newAssignmentData]
                 }
               : staffMember
           )
         )

         // Refresh today's schedules
         loadTodaySchedules()
       }
      
      setNewAssignment({ brand_id: '', location_id: '' })
      setIsAddAssignmentOpen(false)
      setSuccess('Assignment added successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error adding assignment:', error)
      setError('Failed to add assignment')
    } finally {
      setSaving(false)
    }
  }

  const removeAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this assignment?')) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('staff_assignments')
        .delete()
        .eq('id', assignmentId)

      if (error) throw error

      // Update selectedStaff by removing the assignment
      if (selectedStaff) {
        setSelectedStaff(prev => ({
          ...prev,
          staff_assignments: prev.staff_assignments.filter(assignment => assignment.id !== assignmentId)
        }))
      }

       // Update the staff list as well
       setStaff(prevStaff => 
         prevStaff.map(staffMember => 
           staffMember.id === selectedStaff?.id 
             ? { 
                 ...staffMember, 
                 staff_assignments: staffMember.staff_assignments.filter(assignment => assignment.id !== assignmentId)
               }
             : staffMember
         )
       )

       // Refresh today's schedules
       loadTodaySchedules()
       
       setSuccess('Assignment removed successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error removing assignment:', error)
      setError('Failed to remove assignment')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getFilteredLocations = () => {
    if (!newAssignment.brand_id || !selectedStaff) return []
    
    // Get locations that match the selected brand
    const brandLocations = locations.filter(location => location.brand_id === newAssignment.brand_id)
    
    // Get IDs of locations where the staff is already assigned
    const assignedLocationIds = selectedStaff.staff_assignments.map(assignment => assignment.location_id)
    
    // Filter out already assigned locations
    return brandLocations.filter(location => !assignedLocationIds.includes(location.id))
  }

  const handleBrandChange = (brandId: string) => {
    setNewAssignment({
      brand_id: brandId,
      location_id: '' // Reset location when brand changes
    })
  }

  const loadCompanyData = async () => {
    try {
      const savedRole = localStorage.getItem('dashboard_role')
      const isAdmin = isDashboardRole(savedRole) && isAdminLevelRole(savedRole)
      setIsScheduleAdmin(isAdmin)

      // Load both queries in parallel for faster performance
      const [locationsResult, staffResult] = await Promise.all([
        supabase
          .from('locations')
          .select('id, name, brand_id, company_owned, is_factory_floor, brand:brands!locations_brand_id_fkey(id, name, brand_role, slug)')
          .order('name'),
        
        supabase
          .from('staff_registrations')
          .select(`
            id,
            full_name,
            staff_assignments (
              id,
              location_id,
              location:locations!staff_assignments_location_id_fkey (
                id,
                name,
                brand_id,
                company_owned,
                brand:brands!locations_brand_id_fkey (
                  id,
                  name,
                  brand_role,
                  slug
                )
              )
            )
          `)
          .eq('is_active', true)
          .order('full_name')
      ])

      if (locationsResult.error) throw locationsResult.error
      if (staffResult.error) throw staffResult.error

      const normalizedLocs = (locationsResult.data || []).map((loc) =>
        normalizeScheduleLocation(loc as unknown as Location)
      )

      const gfcMainLocs = normalizedLocs
        .filter((loc) => isFactoryBrand(loc.brand ?? null))
        .sort((a, b) => a.name.localeCompare(b.name))

      const retailLocs = normalizedLocs
        .filter(
          (loc) =>
            !isFactoryBrand(loc.brand ?? null) &&
            loc.company_owned &&
            !isRetailFactoryBranch(loc)
        )
        .sort((a, b) => {
          const brandA = a.brand?.name || ''
          const brandB = b.brand?.name || ''
          if (brandA !== brandB) return brandA.localeCompare(brandB)
          return a.name.localeCompare(b.name)
        })

      const visibleLocs = isAdmin ? [...gfcMainLocs, ...retailLocs] : retailLocs
      const visibleLocationIds = new Set(visibleLocs.map((loc) => loc.id))
      const gfcLocationIds = new Set(gfcMainLocs.map((loc) => loc.id))

      const companyStaffList = ((staffResult.data || []) as unknown as StaffWithAssignments[])
        .filter((staffMember) =>
          staffMember.staff_assignments.some((assignment: StaffAssignment) =>
            visibleLocationIds.has(assignment.location_id)
          )
        )
        .filter((staffMember) => isAdmin || !staffMemberIsGfcMain(staffMember))
        .sort((a, b) => {
          const aGfc = a.staff_assignments.some((assignment) =>
            gfcLocationIds.has(assignment.location_id)
          )
          const bGfc = b.staff_assignments.some((assignment) =>
            gfcLocationIds.has(assignment.location_id)
          )
          if (aGfc !== bGfc) return aGfc ? -1 : 1
          return a.full_name.localeCompare(b.full_name)
        })

      setCompanyLocations(visibleLocs)
      setCompanyStaff(companyStaffList)
    } catch (error) {
      console.error('Error loading company data:', error)
      setError('Failed to load company staff and locations')
    }
  }

  const getWeekDates = (date: Date) => {
    const startOfWeek = new Date(date)
    startOfWeek.setDate(date.getDate() - date.getDay()) // Start from Sunday
    
    const weekDates = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      weekDates.push(day)
    }
    return weekDates
  }

  const getDayName = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  }

  const getDateNumber = (date: Date) => {
    return date.getDate()
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  // Helper function to format date in local timezone to YYYY-MM-DD
  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const loadTodaySchedules = async () => {
    try {
      const today = formatDateLocal(new Date())
      
      const { data, error } = await supabase
        .from('staff_schedules')
        .select('staff_registration_id, location_id, location:locations!staff_schedules_location_id_fkey (id, name, brand:brands (id, name))')
        .eq('schedule_date', today)

      if (error) throw error

      // Convert to a map for easy lookup
      const scheduleMap: Record<string, any> = {}
      data?.forEach(schedule => {
        scheduleMap[schedule.staff_registration_id] = schedule
      })
      
      setTodaySchedules(scheduleMap)
    } catch (error) {
      console.error('Error loading today\'s schedules:', error)
    }
  }

  const isStaffScheduledToday = (staffId: string) => {
    return todaySchedules[staffId] || null
  }

  const filteredStaff = useMemo(() => {
    if (!showOnlyTodayStaff) return staff
    
    // Filter staff to show only those scheduled today
    return staff.filter(staffMember => {
      const todaySchedule = isStaffScheduledToday(staffMember.id)
      return todaySchedule !== null
    })
  }, [staff, showOnlyTodayStaff, todaySchedules])

  const groupedStaff = useMemo(() => {
    return filteredStaff.reduce((groups, staffMember) => {
      const primaryLocation = staffMember.staff_assignments[0]?.location?.name || 'Unassigned'
      if (!groups[primaryLocation]) {
        groups[primaryLocation] = []
      }
      groups[primaryLocation].push(staffMember)
      return groups
    }, {} as Record<string, typeof staff>)
  }, [filteredStaff])

  const loadExistingSchedule = async () => {
    try {
      const weekDates = getWeekDates(currentWeek)
      const startDate = formatDateLocal(weekDates[0])
      const endDate = formatDateLocal(weekDates[6])
      
      const { data, error } = await supabase
        .from('staff_schedules')
        .select(`
          staff_registration_id,
          location_id,
          schedule_date,
          hours,
          is_absent,
          day_type,
          location:locations!staff_schedules_location_id_fkey (
            brand:brands!locations_brand_id_fkey (brand_role, slug)
          )
        `)
        .gte('schedule_date', startDate)
        .lte('schedule_date', endDate)
        .order('schedule_date')
      
      if (error) throw error
      
      // Convert database data to schedule format - optimized with single pass
      const newSchedule: {[key: string]: {[key: string]: string[]}} = {}
      const newStaffHours: {[key: string]: {[key: string]: {[key: string]: number}}} = {}
      const newDayStatus: {[key: string]: 'default' | 'regular-holiday' | 'special-holiday'} = {}
      const newAbsentStaff: {[key: string]: {[key: string]: {[key: string]: boolean}}} = {}
      const newHoursOverridden = new Set<string>()
      
      // Process all records in a single optimized loop
      data?.forEach((item) => {
        const dayKey = getScheduleKey(new Date(item.schedule_date))
        const locId = item.location_id
        const staffId = item.staff_registration_id
        
        if (locId) {
          // Initialize nested objects only when needed
          if (!newSchedule[locId]) {
            newSchedule[locId] = {}
            newStaffHours[locId] = {}
            newAbsentStaff[locId] = {}
          }
          if (!newSchedule[locId][dayKey]) {
            newSchedule[locId][dayKey] = []
            newStaffHours[locId][dayKey] = {}
            newAbsentStaff[locId][dayKey] = {}
          }
          
          // Add staff to schedule if not already included
          if (!newSchedule[locId][dayKey].includes(staffId)) {
            newSchedule[locId][dayKey].push(staffId)
          }

          // Set hours and absence data (GFC Main defaults to 0 = use fingerprint attendance)
          const locBrand = normalizeLocationBrand(
            (item.location as { brand?: unknown } | null)?.brand as Parameters<typeof isFactoryBrand>[0]
          )
          const isGfcLoc = isFactoryBrand(locBrand)
          const defaultHours = isGfcLoc ? 0 : 11
          const overrideKey = `${locId}|${dayKey}|${staffId}`
          const hasExplicitHours = isGfcLoc
            ? gfcMainHasExplicitScheduleHours(item.hours)
            : item.hours != null

          if (hasExplicitHours) {
            newHoursOverridden.add(overrideKey)
            newStaffHours[locId][dayKey][staffId] = Number(item.hours)
          } else {
            newStaffHours[locId][dayKey][staffId] = defaultHours
          }
          newAbsentStaff[locId][dayKey][staffId] = item.is_absent || false
          
          // Set day status (use the first occurrence for each day)
          if (!newDayStatus[dayKey] && item.day_type) {
            newDayStatus[dayKey] = item.day_type as 'default' | 'regular-holiday' | 'special-holiday'
          }
        }
      })
      
      // Efficient deep copy using structured clone or fallback to JSON
      const deepCopy = (obj: any) => {
        if (typeof structuredClone !== 'undefined') {
          return structuredClone(obj)
        }
        return JSON.parse(JSON.stringify(obj))
      }
      
      setSchedule(newSchedule)
      setOriginalSchedule(deepCopy(newSchedule))
      setStaffHours(newStaffHours)
      setOriginalStaffHours(deepCopy(newStaffHours))
      setScheduleHoursOverridden(newHoursOverridden)
      setOriginalScheduleHoursOverridden(new Set(newHoursOverridden))
      setDayStatus(newDayStatus)
      setOriginalDayStatus(deepCopy(newDayStatus))
      setAbsentStaff(newAbsentStaff)
    } catch (error) {
      console.error('Error loading existing schedule:', error)
      setError('Failed to load existing schedule')
    }
  }

  const openScheduleModal = async () => {
    console.log('🚀 Opening schedule modal...')
    setSuccess('')

    setCurrentWeek(new Date())
    setIsScheduleModalOpen(true)
    setLoadingScheduleData(true)

    try {
      console.log('📥 Loading company data and existing schedule...')
      await loadCompanyData()
      await loadExistingSchedule()
      console.log('✅ Schedule modal data loaded!')
    } finally {
      setLoadingScheduleData(false)
    }
  }

  const hasScheduleChanges = () => {
    // Deep compare current schedule with original schedule
    const currentKeys = Object.keys(schedule)
    const originalKeys = Object.keys(originalSchedule)
    
    // Check if number of locations changed
    if (currentKeys.length !== originalKeys.length) return true
    
    // Check each location's schedule
    for (const locationId of currentKeys) {
      const currentLocationSchedule = schedule[locationId] || {}
      const originalLocationSchedule = originalSchedule[locationId] || {}
      
      const currentDayKeys = Object.keys(currentLocationSchedule)
      const originalDayKeys = Object.keys(originalLocationSchedule)
      
      // Check if number of days changed
      if (currentDayKeys.length !== originalDayKeys.length) return true
      
      // Check each day's assignment
      for (const dayKey of currentDayKeys) {
        const currentStaffIds = currentLocationSchedule[dayKey] || []
        const originalStaffIds = originalLocationSchedule[dayKey] || []
        
        // Convert to arrays for comparison
        const currentArray = Array.isArray(currentStaffIds) ? currentStaffIds : (currentStaffIds ? [currentStaffIds] : [])
        const originalArray = Array.isArray(originalStaffIds) ? originalStaffIds : (originalStaffIds ? [originalStaffIds] : [])
        
        // Check if arrays are different
        if (currentArray.length !== originalArray.length) return true
        
        // Check if all staff IDs match
        const currentSorted = [...currentArray].sort()
        const originalSorted = [...originalArray].sort()
        
        for (let i = 0; i < currentSorted.length; i++) {
          if (currentSorted[i] !== originalSorted[i]) return true
        }

        // Check hours for all staff members (both current and original)
        const allStaffIds = Array.from(new Set([...currentArray, ...originalArray]))
        for (const staffId of allStaffIds) {
          const currentHours = getStaffHours(locationId, dayKey, staffId)
          const originalHours =
            originalStaffHours[locationId]?.[dayKey]?.[staffId] ??
            getDefaultStaffHours(locationId)
          if (currentHours !== originalHours) return true
          const overrideKey = scheduleHoursOverrideKey(locationId, dayKey, staffId)
          if (scheduleHoursOverridden.has(overrideKey) !== originalScheduleHoursOverridden.has(overrideKey)) {
            return true
          }
        }
      }
    }
    
    // Check for day status changes
    const currentDayKeys = Object.keys(dayStatus)
    const originalDayKeys = Object.keys(originalDayStatus)
    
    // Check if number of days changed
    if (currentDayKeys.length !== originalDayKeys.length) return true
    
    for (const dayKey of currentDayKeys) {
      const currentStatus = dayStatus[dayKey] || 'default'
      const originalStatus = originalDayStatus[dayKey] || 'default'
      if (currentStatus !== originalStatus) return true
    }
    
    // Check for absence changes - any change in absentStaff state indicates a change
    const currentAbsenceLocations = Object.keys(absentStaff)
    if (currentAbsenceLocations.length > 0) {
      for (const locationId of currentAbsenceLocations) {
        const locationAbsences = absentStaff[locationId] || {}
        for (const dayKey of Object.keys(locationAbsences)) {
          const dayAbsences = locationAbsences[dayKey] || {}
          // If there are any absence entries (true or false), consider it a change
          if (Object.keys(dayAbsences).length > 0) return true
        }
      }
    }
    
    return false
  }

  const updateSchedule = (locationId: string, dayKey: string, staffId: string) => {
    // Check if staff is already scheduled to another branch on this day
    if (staffId) {
      const weekDates = getWeekDates(currentWeek)
      const scheduleDate = weekDates.find(date => getScheduleKey(date) === dayKey)
      
      if (scheduleDate) {
        // Check if this staff is already scheduled to any other branch on this date
        const alreadyScheduled = Object.entries(schedule).some(([branchId, daySchedules]) => {
          if (branchId === locationId) return false // Skip current branch
          return daySchedules[dayKey]?.includes(staffId) || false
        })
        
        if (alreadyScheduled) {
          setError('Staff can only be scheduled to one branch per day')
          return
        }
      }
    }
    
    setSchedule(prev => ({
      ...prev,
      [locationId]: {
        ...prev[locationId],
        [dayKey]: [staffId]
      }
    }))
  }

  const getScheduleKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const getStoreColor = (location: Location) => {
    const brandName = location.brand?.name?.toLowerCase() || ''
    if (isFactoryBrand(location.brand ?? null)) {
      return 'bg-slate-100'
    }
    if (brandName.includes('mychoice')) {
      return 'bg-green-100' // Mychoice - Green background only
    } else if (brandName.includes('gelatofilipino')) {
      return 'bg-red-100' // Gelatofilipino - Red background only
    }
    return 'bg-gray-100' // Default
  }

  const scheduleGfcMainStaff = useMemo(
    () => companyStaff.filter((staffMember) => staffMemberIsGfcMain(staffMember)),
    [companyStaff]
  )

  const scheduleRetailStaff = useMemo(
    () => companyStaff.filter((staffMember) => !staffMemberIsGfcMain(staffMember)),
    [companyStaff]
  )

  const scheduleLocationSections = useMemo(() => {
    const gfcMainLocations = companyLocations.filter((location) => isFactoryBrand(location.brand ?? null))
    const retailLocations = companyLocations.filter((location) => !isFactoryBrand(location.brand ?? null))
    const sections: Array<{ title?: string; locations: Location[] }> = []

    if (isScheduleAdmin && gfcMainLocations.length > 0) {
      sections.push({ title: 'GFC Main', locations: gfcMainLocations })
    }
    if (retailLocations.length > 0) {
      sections.push({
        title: isScheduleAdmin && gfcMainLocations.length > 0 ? 'Retail Stores' : undefined,
        locations: retailLocations,
      })
    }

    return sections
  }, [companyLocations, isScheduleAdmin])

  const getStaffForLocation = (locationId: string) => {
    return companyStaff.filter(staff => 
      staff.staff_assignments.some(assignment => assignment.location_id === locationId)
    )
  }

  const getScheduledStaffForBranchAndDate = (locationId: string, dayKey: string) => {
    const scheduledStaffIds = schedule[locationId]?.[dayKey] || []
    if (Array.isArray(scheduledStaffIds)) {
      return scheduledStaffIds.map(staffId => 
        companyStaff.find(staff => staff.id === staffId)
      ).filter(Boolean)
    } else if (scheduledStaffIds) {
      // Handle legacy single staff ID
      const staff = companyStaff.find(staff => staff.id === scheduledStaffIds)
      return staff ? [staff] : []
    }
    return []
  }

  const addStaffToSchedule = async (staffId: string, dayKey: string, locationId: string) => {
    const currentStaff = schedule[locationId]?.[dayKey] || []
    const staffIds = Array.isArray(currentStaff) ? currentStaff : (currentStaff ? [currentStaff] : [])
    
    // Check if staff is already assigned to any other branch on the same day
    const isAlreadyAssignedElsewhere = Object.keys(schedule).some(branchId => 
      branchId !== locationId && 
      schedule[branchId]?.[dayKey]?.includes(staffId)
    )
    
    if (isAlreadyAssignedElsewhere) {
      setError('This staff member is already assigned to another branch on this day')
      return
    }
    
    if (!staffIds.includes(staffId)) {
      setSchedule(prev => ({
        ...prev,
        [locationId]: {
          ...prev[locationId],
          [dayKey]: [...staffIds, staffId]
        }
      }))

      // Initialize hours (GFC Main: 0 = fingerprint attendance; retail: 11)
      setStaffHours(prev => ({
        ...prev,
        [locationId]: {
          ...prev[locationId],
          [dayKey]: {
            ...prev[locationId]?.[dayKey],
            [staffId]: getDefaultStaffHours(locationId)
          }
        }
      }))
    }
  }

  const removeStaffFromSchedule = async (staffId: string, dayKey: string, locationId: string) => {
    const currentStaff = schedule[locationId]?.[dayKey] || []
    const staffIds = Array.isArray(currentStaff) ? currentStaff : (currentStaff ? [currentStaff] : [])
    
    setSchedule(prev => ({
      ...prev,
      [locationId]: {
        ...prev[locationId],
        [dayKey]: staffIds.filter(id => id !== staffId)
      }
    }))

    // Also remove hours for this staff
    setStaffHours(prev => ({
      ...prev,
      [locationId]: {
        ...prev[locationId],
        [dayKey]: {
          ...prev[locationId]?.[dayKey],
          [staffId]: undefined
        }
      }
    }))
  }

  const scheduleHoursOverrideKey = (locationId: string, dayKey: string, staffId: string) =>
    `${locationId}|${dayKey}|${staffId}`

  const isScheduleHoursOverridden = (locationId: string, dayKey: string, staffId: string) =>
    scheduleHoursOverridden.has(scheduleHoursOverrideKey(locationId, dayKey, staffId))

  const isGfcMainLocation = (locationId: string) => {
    const location = companyLocations.find((loc) => loc.id === locationId)
    return location ? isFactoryBrand(location.brand ?? null) : false
  }

  const getDefaultStaffHours = (locationId: string) => (isGfcMainLocation(locationId) ? 0 : 11)

  const getStaffHours = (locationId: string, dayKey: string, staffId: string) => {
    return staffHours[locationId]?.[dayKey]?.[staffId] ?? getDefaultStaffHours(locationId)
  }

  const updateStaffHours = (locationId: string, dayKey: string, staffId: string, hours: number) => {
    const overrideKey = scheduleHoursOverrideKey(locationId, dayKey, staffId)
    setScheduleHoursOverridden((prev) => {
      const next = new Set(prev)
      next.add(overrideKey)
      return next
    })
    setStaffHours(prev => ({
      ...prev,
      [locationId]: {
        ...prev[locationId],
        [dayKey]: {
          ...prev[locationId]?.[dayKey],
          [staffId]: hours
        }
      }
    }))
  }

  const isStaffAbsent = (locationId: string, dayKey: string, staffId: string) => {
    return absentStaff[locationId]?.[dayKey]?.[staffId] || false
  }

  const toggleStaffAbsence = async (locationId: string, dayKey: string, staffId: string) => {
    const currentAbsentStatus = isStaffAbsent(locationId, dayKey, staffId)
    
    // Get the staff member details
    const staffMember = companyStaff.find(s => s.id === staffId)
    if (!staffMember) return
    
    // Convert dayKey to actual date
    const dateMatch = dayKey.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (!dateMatch) return
    const absenceDate = dayKey
    const formattedDate = new Date(absenceDate).toLocaleDateString()
    
    // Confirmation for marking as absent
    if (!currentAbsentStatus) {
      const currentWarnings = staffMember.total_warnings ?? 0
      const currentBalance = staffMember.leave_balance ?? 10
      if (!confirm(`Mark ${staffMember.full_name} as absent on ${formattedDate}?\n\nThis will:\n• Set hours to 0\n• Create a warning (absence_admin)\n• Add 1 warning (${currentWarnings} → ${currentWarnings + 1})\n• Deduct 1 day from leave balance (${currentBalance} → ${currentBalance - 1} days)`)) {
        return
      }
    } else {
      // Confirmation for unmarking
      const currentWarnings = staffMember.total_warnings ?? 0
      const currentBalance = staffMember.leave_balance ?? 10
      const restoredHours = getDefaultStaffHours(locationId)
      if (!confirm(`Remove absence for ${staffMember.full_name} on ${formattedDate}?\n\nThis will:\n• Restore hours to ${restoredHours}\n• Delete the warning\n• Remove 1 warning (${currentWarnings} → ${Math.max(0, currentWarnings - 1)})\n• Refund 1 day to leave balance (${currentBalance} → ${Math.min(10, currentBalance + 1)} days)`)) {
        return
      }
    }
    
    setAbsentStaff(prev => ({
      ...prev,
      [locationId]: {
        ...prev[locationId],
        [dayKey]: {
          ...prev[locationId]?.[dayKey],
          [staffId]: !currentAbsentStatus
        }
      }
    }))

    // If marking as absent
    if (!currentAbsentStatus) {
      updateStaffHours(locationId, dayKey, staffId, 0)
      
      // Create leave request and deduct from balance
      try {
        // Create leave request
        const { data: leaveData, error: leaveError } = await supabase
          .from('leave_requests')
          .insert({
            staff_registration_id: staffId,
            location_id: locationId,
            request_type: 'absence_admin', // Admin-marked absence
            start_date: absenceDate,
            end_date: absenceDate,
            reason: 'Marked absent by admin in schedule',
            status: 'approved' // Auto-approved since admin marked it
          })
          .select()
          .single()

        if (leaveError) {
          console.error('Error creating leave request:', leaveError)
          setError('Failed to create leave request for absence')
          return
        }

        // Increment total warnings AND deduct 1 day from leave balance
        const currentWarnings = staffMember.total_warnings ?? 0
        const newWarnings = currentWarnings + 1
        const currentBalance = staffMember.leave_balance ?? 10
        const newBalance = Math.max(0, currentBalance - 1)

        const { error: updateError } = await supabase
          .from('staff_registrations')
          .update({ 
            total_warnings: newWarnings,
            leave_balance: newBalance
          })
          .eq('id', staffId)

        if (updateError) {
          console.error('Error updating warnings and balance:', updateError)
          setError('Absence marked but failed to update warnings and leave balance')
          return
        }

        // Update local staff state (both regular staff and company staff)
        setStaff(prevStaff => 
          prevStaff.map(s => 
            s.id === staffId 
              ? { ...s, total_warnings: newWarnings, leave_balance: newBalance }
              : s
          )
        )
        
        setCompanyStaff(prevStaff => 
          prevStaff.map(s => 
            s.id === staffId 
              ? { ...s, total_warnings: newWarnings, leave_balance: newBalance }
              : s
          )
        )
        
        setSuccess(`Warning assigned to ${staffMember.full_name}. Warnings: ${currentWarnings} → ${newWarnings} | Leave: ${currentBalance} → ${newBalance} days`)
        setTimeout(() => setSuccess(''), 3000)
        
        console.log('✅ Leave request created, warnings incremented, and balance deducted:', { staffId, date: absenceDate, newWarnings, newBalance })
      } catch (error) {
        console.error('Error handling absence:', error)
      }
    } else {
      // If unmarking absence, restore to branch default hours
      updateStaffHours(locationId, dayKey, staffId, getDefaultStaffHours(locationId))
      
      // Delete the auto-created leave request and refund balance
      try {
        // Find and delete the leave request for this date
        const { data: existingLeave, error: findError } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('staff_registration_id', staffId)
          .eq('start_date', absenceDate)
          .eq('end_date', absenceDate)
          .eq('reason', 'Marked absent by admin in schedule')
          .single()

        if (findError && findError.code !== 'PGRST116') {
          console.error('Error finding leave request:', findError)
          return
        }

        if (existingLeave) {
          // Delete the leave request
          const { error: deleteError } = await supabase
            .from('leave_requests')
            .delete()
            .eq('id', existingLeave.id)

          if (deleteError) {
            console.error('Error deleting leave request:', deleteError)
            setError('Absence unmarked but failed to delete leave request')
            return
          }

          // Decrement total warnings AND refund 1 day to leave balance
          const currentWarnings = staffMember.total_warnings ?? 0
          const newWarnings = Math.max(0, currentWarnings - 1) // Min 0 warnings
          const currentBalance = staffMember.leave_balance ?? 10
          const newBalance = Math.min(10, currentBalance + 1) // Max 10 days

          const { error: updateError } = await supabase
            .from('staff_registrations')
            .update({ 
              total_warnings: newWarnings,
              leave_balance: newBalance
            })
            .eq('id', staffId)

          if (updateError) {
            console.error('Error updating warnings and balance:', updateError)
            setError('Absence unmarked but failed to update warnings and leave balance')
            return
          }

          // Update local staff state (both regular staff and company staff)
          setStaff(prevStaff => 
            prevStaff.map(s => 
              s.id === staffId 
                ? { ...s, total_warnings: newWarnings, leave_balance: newBalance }
                : s
            )
          )
          
          setCompanyStaff(prevStaff => 
            prevStaff.map(s => 
              s.id === staffId 
                ? { ...s, total_warnings: newWarnings, leave_balance: newBalance }
                : s
            )
          )
          
          setSuccess(`Warning removed for ${staffMember.full_name}. Warnings: ${currentWarnings} → ${newWarnings} | Leave: ${currentBalance} → ${newBalance} days`)
          setTimeout(() => setSuccess(''), 3000)
          
          console.log('✅ Leave request deleted, warnings decremented, and balance refunded:', { staffId, date: absenceDate, newWarnings, newBalance })
        }
      } catch (error) {
        console.error('Error handling absence removal:', error)
      }
    }
  }

  const getDayStatus = (dayKey: string) => {
    return dayStatus[dayKey] || 'default'
  }

  const toggleDayHolidayStatus = (dayKey: string) => {
    setDayStatus(prev => {
      const currentStatus = prev[dayKey] || 'default'
      let nextStatus: 'default' | 'regular-holiday' | 'special-holiday'
      
      switch (currentStatus) {
        case 'default':
          nextStatus = 'regular-holiday'
          break
        case 'regular-holiday':
          nextStatus = 'special-holiday'
          break
        case 'special-holiday':
          nextStatus = 'default'
          break
        default:
          nextStatus = 'default'
      }
      
      return {
        ...prev,
        [dayKey]: nextStatus
      }
    })
  }

  const getStaffColorClasses = (dayKey: string) => {
    const status = getDayStatus(dayKey)
    
    switch (status) {
      case 'regular-holiday':
        return {
          container: 'bg-orange-200 hover:bg-orange-300 text-orange-900',
          button: 'text-orange-700 hover:text-orange-900 hover:bg-orange-400',
          label: 'text-orange-800 font-semibold',
          input: 'focus:ring-orange-500'
        }
      case 'special-holiday':
        return {
          container: 'bg-violet-200 hover:bg-violet-300 text-violet-900',
          button: 'text-violet-700 hover:text-violet-900 hover:bg-violet-400',
          label: 'text-violet-800 font-semibold',
          input: 'focus:ring-violet-500'
        }
      default: // 'default'
        return {
          container: 'bg-blue-200 hover:bg-blue-300 text-blue-900',
          button: 'text-blue-700 hover:text-blue-900 hover:bg-blue-400',
          label: 'text-blue-800 font-semibold',
          input: 'focus:ring-blue-500'
        }
    }
  }

  const saveSchedule = async () => {
    setSaving(true)
    try {
      const weekDates = getWeekDates(currentWeek)
      
      console.log('💾 Preparing to save schedule...')
      
      // Prepare schedule data for database
      const scheduleData = []
      
      // Process regular location schedules
      Object.entries(schedule).forEach(([locationId, daySchedules]) => {
        if (locationId === 'rest-day') return // Skip rest day
        
        Object.entries(daySchedules).forEach(([dayKey, staffIds]) => {
          const staffIdArray = Array.isArray(staffIds) ? staffIds : (staffIds ? [staffIds] : [])
          
          staffIdArray.forEach(staffId => {
            if (staffId) {
              // Find the date for this day key
              const scheduleDate = weekDates.find(date => getScheduleKey(date) === dayKey)
              if (scheduleDate) {
                const hours = getStaffHours(locationId, dayKey, staffId)
                const dayStatus = getDayStatus(dayKey)
                const isAbsent = isStaffAbsent(locationId, dayKey, staffId)
                const hoursForDb =
                  isAbsent
                    ? 0
                    : isGfcMainLocation(locationId) &&
                        !isScheduleHoursOverridden(locationId, dayKey, staffId) &&
                        hours === 0
                      ? null
                      : hours
                
                const recordToSave = {
                  location_id: locationId,
                  staff_registration_id: staffId,
                  schedule_date: formatDateLocal(scheduleDate),
                  hours: hoursForDb,
                  day_type: dayStatus,
                  is_absent: isAbsent
                }
                
                console.log('📝 Schedule record to save:', recordToSave)
                scheduleData.push(recordToSave)
              }
            }
          })
        })
      })
      
      console.log('📦 Total records to save:', scheduleData.length)
      
      // Clear existing schedules for this week first
      const startDate = formatDateLocal(weekDates[0])
      const endDate = formatDateLocal(weekDates[6])
      
      console.log('🗑️ Deleting existing schedules for week:', { startDate, endDate })
      
      const { error: deleteError } = await supabase
        .from('staff_schedules')
        .delete()
        .gte('schedule_date', startDate)
        .lte('schedule_date', endDate)
      
      if (deleteError) {
        console.error('❌ Delete error:', deleteError)
        throw deleteError
      }
      
      console.log('✅ Old schedules deleted')
      
      // Insert new schedule data only if there's data to insert
      if (scheduleData.length > 0) {
        console.log('💾 Inserting', scheduleData.length, 'new schedule records...')
        
        const { data: insertedData, error: insertError } = await supabase
          .from('staff_schedules')
          .insert(scheduleData)
          .select()
        
        if (insertError) {
          console.error('❌ Insert error:', insertError)
          throw insertError
        }
        
        console.log('✅ Schedules saved successfully!')
        console.log('📊 Saved records:', insertedData)
      } else {
        console.log('ℹ️ No schedule data to save')
      }
      
       // Update original schedule and hours to match current after successful save
       setOriginalSchedule(JSON.parse(JSON.stringify(schedule)))
       setOriginalStaffHours(JSON.parse(JSON.stringify(staffHours)))
       setOriginalScheduleHoursOverridden(new Set(scheduleHoursOverridden))
       setOriginalDayStatus(JSON.parse(JSON.stringify(dayStatus)))
       
       // Set schedule just saved flag
       setScheduleJustSaved(true)
       
       // Reset the flag after 3 seconds
       setTimeout(() => setScheduleJustSaved(false), 3000)
       
       console.log('🔄 Refreshing today\'s schedules...')
       // Refresh today's schedules
       loadTodaySchedules()
       
       console.log('✨ Save schedule complete!')
     } catch (error) {
      console.error('Error saving schedule:', error)
      setError('Failed to save schedule')
      setScheduleJustSaved(false)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <StaffManagerPageSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
         <div>
           <h1 className="text-xl font-semibold text-gray-900">Staff Manager</h1>
           <p className="text-sm text-gray-600">Manage staff members and assignments</p>
         </div>
         <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
           <div className="flex items-center space-x-3">
             <span className="text-sm font-medium text-gray-700">Show today only</span>
             <button
               onClick={() => setShowOnlyTodayStaff(!showOnlyTodayStaff)}
               className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                 showOnlyTodayStaff ? 'bg-blue-600' : 'bg-gray-200'
               }`}
             >
               <span
                 className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                   showOnlyTodayStaff ? 'translate-x-6' : 'translate-x-1'
                 }`}
               />
             </button>
           </div>
           <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
             <button
               onClick={openAnnouncementModal}
               className={`flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700`}
             >
               <Megaphone className="h-4 w-4" />
               <span>Announcement</span>
             </button>
             <button
               onClick={openScheduleModal}
               className={`flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700`}
             >
               <MapPin className="h-4 w-4" />
               <span>Schedule</span>
             </button>
             <button
               onClick={() => setIsAddModalOpen(true)}
               className={`flex items-center justify-center space-x-2 px-4 py-2 ${colors.primary} text-white rounded-md hover:opacity-90`}
             >
               <Plus className="h-4 w-4" />
               <span>Add Staff</span>
             </button>
           </div>
         </div>
      </div>

      {/* Leave Request Notifications */}
      {leaveRequests.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-yellow-600" />
              <h3 className="text-sm font-medium text-yellow-800">
                {leaveRequests.length} Pending Leave Request{leaveRequests.length > 1 ? 's' : ''}
              </h3>
            </div>
            <button
              onClick={() => setShowLeaveRequests(!showLeaveRequests)}
              className="text-sm text-yellow-700 hover:text-yellow-900"
            >
              {showLeaveRequests ? 'Hide' : 'View'}
            </button>
          </div>
          
          {showLeaveRequests && (
            <div className="mt-4 space-y-3">
              {leaveRequests.map((request) => (
                <div key={request.id} className="bg-white rounded-lg border border-yellow-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          {request.staff_registrations.full_name}
                        </span>
                        <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800">
                          {request.request_type === 'absence_sickness' ? 'Sickness' :
                           request.request_type === 'absence_family' ? 'Family Emergency' :
                           request.request_type === 'absence_authorized' ? 'Authorized Absence' :
                           request.request_type === 'absence_personal' ? 'Personal Leave' :
                           request.request_type === 'absence_bereavement' ? 'Bereavement Leave' :
                           request.request_type === 'absence_vacation' ? 'Vacation Leave' :
                           request.request_type === 'absence_admin' ? 'Absent' : 'Absence'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {request.locations.name} • {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-700 mt-1">
                        {request.reason}
                      </div>
                    </div>
                    <button
                      onClick={() => openLeaveRequestModal(request)}
                      className="ml-4 px-3 py-1 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Staff List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Balance / Warnings</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
               {(() => {
                 // Show message if no staff found when filtering for today
                 if (showOnlyTodayStaff && filteredStaff.length === 0) {
                   return (
                     <tr>
                       <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                         <div className="flex flex-col items-center space-y-2">
                           <MapPin className="h-8 w-8 text-gray-400" />
                           <p className="text-lg font-medium">No staff scheduled for today</p>
                           <p className="text-sm">All staff members are off today or no schedule has been set.</p>
                         </div>
                       </td>
                     </tr>
                   )
                 }
                 
                 // Render grouped staff
                 return Object.entries(groupedStaff)
                   .sort(([locationA], [locationB]) => {
                     // Sort Unassigned to the bottom, then alphabetically
                     if (locationA === 'Unassigned') return 1
                     if (locationB === 'Unassigned') return -1
                     return locationA.localeCompare(locationB)
                   })
                   .map(([locationName, staffList]) => (
                  <React.Fragment key={locationName}>
                    {/* Location Group Header */}
                    <tr className="bg-gray-100">
                      <td colSpan={6} className="px-6 py-3">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-gray-600" />
                          <span className="font-semibold text-gray-900">{locationName}</span>
                          <span className="text-sm text-gray-600">({staffList.length} staff member{staffList.length !== 1 ? 's' : ''})</span>
                        </div>
                      </td>
                    </tr>
                    {/* Staff Members in this location */}
                    {staffList
                      .sort((a, b) => a.full_name.localeCompare(b.full_name))
                      .map((staffMember) => (
                <tr key={staffMember.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <User className="h-5 w-5 text-gray-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {staffMember.full_name}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center space-x-1">
                          <Hash className="h-3 w-3" />
                          <span>{staffMember.staff_code}</span>
                          <button
                            onClick={(e) => {
                              navigator.clipboard.writeText(staffMember.staff_code)
                              // Show a temporary success message
                              const button = e.currentTarget
                              const originalHTML = button.innerHTML
                              button.innerHTML = '<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
                              button.classList.add('text-green-600')
                              setTimeout(() => {
                                button.innerHTML = originalHTML
                                button.classList.remove('text-green-600')
                              }, 1500)
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                            title="Copy staff code"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center space-x-2">
                      <Phone className="h-3 w-3" />
                      <span>{staffMember.mobile_number}</span>
                    </div>
                  </td>
                   <td className="px-6 py-4">
                     <div className="text-sm text-gray-900">
                       {staffMember.staff_assignments.length === 0 ? (
                         <span className="text-gray-500 italic">No assignments</span>
                       ) : (
                         <div className="space-y-1">
                           {staffMember.staff_assignments.map((assignment) => {
                             const todaySchedule = isStaffScheduledToday(staffMember.id)
                             const isTodayAssignment = todaySchedule && todaySchedule.location_id === assignment.location_id
                             const highlight = isTodayAssignment
                               ? getBrandHighlightClasses(assignment.location.brand?.name)
                               : null
                             
                             return (
                               <div 
                                 key={assignment.id} 
                                 className={`flex items-center space-x-2 p-1 rounded ${highlight?.row ?? ''}`}
                               >
                                 <MapPin className={`h-3 w-3 ${highlight ? highlight.icon : 'text-gray-400'}`} />
                                 <span className={`text-xs ${highlight ? highlight.text : ''}`}>
                                   {assignment.location.name} ({assignment.location.brand?.name})
                                   {isTodayAssignment && highlight && (
                                     <span className={`ml-1 ${highlight.accent}`}>• Today</span>
                                   )}
                                 </span>
                               </div>
                             )
                           })}
                         </div>
                       )}
                     </div>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap">
                     <div className="flex flex-col space-y-1">
                       <div className="flex items-center space-x-2">
                         <span className="text-xs text-gray-500">Leave:</span>
                         <div className={`px-2 py-1 text-xs font-semibold rounded-full ${
                           (staffMember.leave_balance ?? 10) > 5 
                             ? 'bg-green-100 text-green-800' 
                             : (staffMember.leave_balance ?? 10) > 2 
                             ? 'bg-yellow-100 text-yellow-800' 
                             : 'bg-red-100 text-red-800'
                         }`}>
                           {staffMember.leave_balance ?? 10} days
                         </div>
                       </div>
                       <div className="flex items-center space-x-2">
                         <span className="text-xs text-gray-500">Warnings:</span>
                         <div className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                           {staffMember.total_warnings ?? 0}
                         </div>
                       </div>
                     </div>
                   </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleStaffStatus(staffMember.id, staffMember.is_active)}
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        staffMember.is_active
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {staffMember.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openEditModal(staffMember)}
                        className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                        title="Edit staff"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openLeaveHistoryModal(staffMember)}
                        className="text-orange-600 hover:text-orange-900 flex items-center space-x-1"
                        title="View leave history"
                      >
                        <CalendarX className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openMessageModal(staffMember)}
                        className="text-purple-600 hover:text-purple-900 flex items-center space-x-1"
                        title="Send message"
                      >
                        <Mail className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                    </tr>
                    ))}
                  </React.Fragment>
                ))
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {isAddModalOpen && (
        <Modal onClose={() => setIsAddModalOpen(false)} align="center">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Add New Staff Member</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                <input
                  type="text"
                  value={newStaff.full_name}
                  onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Mobile Number *</label>
                  <input
                    type="tel"
                    value={newStaff.mobile_number}
                    onChange={(e) => setNewStaff({ ...newStaff, mobile_number: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                    maxLength={11}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Employment Date</label>
                  <input
                    type="date"
                    value={newStaff.employment_date}
                    onChange={(e) => setNewStaff({ ...newStaff, employment_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Staff Code</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newStaff.staff_code}
                      onChange={(e) => setNewStaff({ ...newStaff, staff_code: e.target.value })}
                      maxLength={8}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <button
                      onClick={() => setNewStaff({ ...newStaff, staff_code: generateStaffCode() })}
                      className="px-2 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                      title="Generate staff code"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Hourly Rate (₱)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newStaff.hourly_rate || ''}
                    onChange={(e) => setNewStaff({ ...newStaff, hourly_rate: parseFloat(e.target.value) || 0 })}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={addStaff}
                disabled={saving || !newStaff.full_name.trim() || !newStaff.mobile_number.trim() || !newStaff.employment_date || !newStaff.staff_code.trim() || !newStaff.hourly_rate}
                className={`px-4 py-2 ${colors.primary} text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {saving ? 'Adding...' : 'Add Staff'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Staff Modal */}
      {isEditModalOpen && selectedStaff && (
        <Modal onClose={() => setIsEditModalOpen(false)} align="center">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Edit Staff Member</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Staff Info Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                    <input
                      type="text"
                      value={editForm.full_name}
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter full name"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Mobile Number *</label>
                      <input
                        type="tel"
                        value={editForm.mobile_number}
                        onChange={(e) => setEditForm({ ...editForm, mobile_number: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                        maxLength={11}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter 11-digit mobile number"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Employment Date</label>
                      <input
                        type="date"
                        value={editForm.employment_date}
                        onChange={(e) => setEditForm({ ...editForm, employment_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Staff Code *</label>
                      <input
                        type="text"
                        value={editForm.staff_code}
                        onChange={(e) => setEditForm({ ...editForm, staff_code: e.target.value })}
                        maxLength={8}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Hourly Rate (₱)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.hourly_rate}
                        onChange={(e) => setEditForm({ ...editForm, hourly_rate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Leave Balance</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={editForm.leave_balance}
                        onChange={(e) => setEditForm({ ...editForm, leave_balance: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="10"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Total Warnings</label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.total_warnings}
                        onChange={(e) => setEditForm({ ...editForm, total_warnings: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Assignments */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-lg font-medium text-gray-900">Current Assignments</h5>
                    <button
                      onClick={() => setIsAddAssignmentOpen(true)}
                      className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Assignment</span>
                    </button>
                  </div>
                  {selectedStaff.staff_assignments.length === 0 ? (
                    <p className="text-gray-500 italic">No assignments</p>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                      {selectedStaff.staff_assignments.map((assignment) => (
                        <div key={assignment.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <MapPin className="h-4 w-4 text-gray-400" />
                                <span className="font-medium text-gray-900">{assignment.location.name}</span>
                              </div>
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <Building2 className="h-3 w-3" />
                                <span className="text-gray-900">{assignment.location.brand?.name}</span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Assigned on {formatDate(assignment.created_at)}
                              </div>
                            </div>
                            <button
                              onClick={() => removeAssignment(assignment.id)}
                              className="text-red-600 hover:text-red-800 p-1"
                              title="Remove assignment"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
            <div className="flex justify-between p-6 border-t border-gray-200 flex-shrink-0">
              <div className="flex space-x-3">
                <button
                  onClick={() => toggleStaffStatus(selectedStaff.id, selectedStaff.is_active)}
                  className={`px-4 py-2 ${selectedStaff.is_active ? 'bg-red-200 hover:bg-red-300 text-red-800' : colors.primary} rounded-md`}
                >
                  {selectedStaff.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={async () => {
                    const confirmed = await requestAdminPassword({
                      title: 'Delete staff member',
                      message:
                        'Delete this staff member? This will also remove all their assignments.\n\nEnter admin password to confirm.',
                      confirmLabel: 'Delete',
                    })
                    if (confirmed) deleteStaff(selectedStaff.id)
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Delete Staff
                </button>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditModal}
                  disabled={saving || !editForm.full_name.trim() || !editForm.mobile_number.trim() || !editForm.staff_code.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Assignment Modal */}
      {isAddAssignmentOpen && selectedStaff && (
        <Modal onClose={() => setIsAddAssignmentOpen(false)} align="center">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Assign Staff to Location</h3>
              <button
                onClick={() => setIsAddAssignmentOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Brand *</label>
                <select
                  value={newAssignment.brand_id}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select brand first</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Location *</label>
                <select
                  value={newAssignment.location_id}
                  onChange={(e) => setNewAssignment({ ...newAssignment, location_id: e.target.value })}
                  disabled={!newAssignment.brand_id}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {newAssignment.brand_id ? 'Select location' : 'Select brand first'}
                  </option>
                  {getFilteredLocations().length === 0 && newAssignment.brand_id ? (
                    <option value="" disabled>
                      All locations already assigned
                    </option>
                  ) : (
                    getFilteredLocations().map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Staff:</strong> {selectedStaff.full_name} ({selectedStaff.staff_code})
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Staff will be assigned to work at the selected location
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setIsAddAssignmentOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={addAssignment}
                disabled={saving || !newAssignment.brand_id || !newAssignment.location_id || getFilteredLocations().length === 0}
                className={`px-4 py-2 ${colors.primary} text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {saving ? 'Adding...' : getFilteredLocations().length === 0 ? 'No Available Locations' : 'Add Assignment'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Schedule Staff Modal */}
      {isScheduleModalOpen && (
        <Modal onClose={() => { setIsScheduleModalOpen(false); setHoveredStaffId(null); setSelectedStaffForSchedule(null) }} align="center">
          <div className="bg-white rounded-xl shadow-lg w-[calc(100vw-2rem)] max-w-screen-2xl h-[90vh] flex flex-col border border-gray-200 overflow-hidden">
            <div className="flex-shrink-0 overflow-x-auto border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between p-4 sm:p-6 min-w-[720px]">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Staff Schedule</h3>
                  <p className="text-sm text-gray-600">Schedule company staff for the current week</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {/* Main staff selector - select once, then click day slots to add */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Select staff:</label>
                  <select
                    value={selectedStaffForSchedule || ''}
                    onChange={(e) => setSelectedStaffForSchedule(e.target.value || null)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
                  >
                    <option value=""></option>
                    {isScheduleAdmin && scheduleGfcMainStaff.length > 0 && (
                      <optgroup label="GFC Main">
                        {scheduleGfcMainStaff.map((staffMember) => (
                          <option key={staffMember.id} value={staffMember.id}>{staffMember.full_name}</option>
                        ))}
                      </optgroup>
                    )}
                    {scheduleRetailStaff.length > 0 && (
                      <optgroup label={isScheduleAdmin && scheduleGfcMainStaff.length > 0 ? 'Retail' : 'Staff'}>
                        {scheduleRetailStaff.map((staffMember) => (
                          <option key={staffMember.id} value={staffMember.id}>{staffMember.full_name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const newWeek = new Date(currentWeek.getTime() - 7 * 24 * 60 * 60 * 1000)
                      setCurrentWeek(newWeek)
                    }}
                    className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 font-medium"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </button>
                  <div className="text-center">
                    <span className="text-lg font-semibold text-gray-900">
                      {currentWeek.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const newWeek = new Date(currentWeek.getTime() + 7 * 24 * 60 * 60 * 1000)
                      setCurrentWeek(newWeek)
                    }}
                    className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 font-medium"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    setIsScheduleModalOpen(false)
                    setHoveredStaffId(null)
                    setSelectedStaffForSchedule(null)
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            </div>
            
            <div className="flex-1 min-h-0 overflow-hidden bg-white">
              <div className="h-full overflow-auto p-4 sm:p-6">
                <div className="min-w-[1264px]">
                {loadingScheduleData ? (
                  <StaffScheduleModalSkeleton />
                ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-white">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 border-r border-white w-64 min-w-64">
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-gray-500" />
                          <span>STORES</span>
                        </div>
                      </th>
                      {getWeekDates(currentWeek).map((date, index) => {
                        const isTodayDate = isToday(date)
                        const dayKey = getScheduleKey(date)
                        const dayStatus = getDayStatus(dayKey)
                        const dayColorClasses = getStaffColorClasses(dayKey)
                        
                        // Get darker ring color based on day status
                        const getTodayRingColor = () => {
                          switch (dayStatus) {
                            case 'regular-holiday':
                              return 'ring-orange-600'
                            case 'special-holiday':
                              return 'ring-violet-600'
                            default:
                              return 'ring-blue-600'
                          }
                        }
                        
                        // Get text color for today based on day status
                        const getTodayTextColor = () => {
                          switch (dayStatus) {
                            case 'regular-holiday':
                              return 'text-orange-900'
                            case 'special-holiday':
                              return 'text-violet-900'
                            default:
                              return 'text-blue-900'
                          }
                        }
                        
                        return (
                          <th 
                            key={index} 
                            className={`px-2 py-3 text-center border-r border-white last:border-r-0 cursor-pointer hover:opacity-80 transition-all duration-200 w-36 ${dayColorClasses.container} ${isTodayDate ? `ring-4 ring-inset ${getTodayRingColor()}` : ''}`}
                            onClick={() => toggleDayHolidayStatus(dayKey)}
                            title={`Click to change day status: ${dayStatus === 'default' ? 'Default' : dayStatus === 'regular-holiday' ? 'Regular Holiday' : 'Special Holiday'}`}
                          >
                            <div className={`text-lg font-bold ${isTodayDate ? getTodayTextColor() : dayColorClasses.label}`}>
                              {getDateNumber(date)}
                            </div>
                            <div className={`text-sm font-semibold ${isTodayDate ? getTodayTextColor() : dayColorClasses.label}`}>
                              {getDayName(date)}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white">
                    {companyLocations.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                          <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p className="text-lg font-medium text-gray-900 mb-2">No company-owned branches found</p>
                          <p className="text-sm text-gray-500">Please add company-owned locations or contact support</p>
                        </td>
                      </tr>
                    ) : (
                      scheduleLocationSections.map((section) => (
                        <React.Fragment key={section.title || 'retail-stores'}>
                          {section.title && (
                            <tr className="bg-slate-200">
                              <td
                                colSpan={8}
                                className="px-6 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 border-r border-white"
                              >
                                {section.title}
                              </td>
                            </tr>
                          )}
                          {section.locations.map((location) => (
                        <tr key={location.id} className={`hover:bg-gray-50 transition-colors ${getStoreColor(location)}`}>
                          <td className={`px-6 py-4 text-sm font-medium text-gray-900 border-r border-white w-64 min-w-64 ${getStoreColor(location)}`}>
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Building2 className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">{location.name}</div>
                                <div className="text-xs text-gray-500">{location.brand?.name || 'Company'}</div>
                              </div>
                            </div>
                          </td>
                          {getWeekDates(currentWeek).map((date, dayIndex) => {
                            const dayKey = getScheduleKey(date)
                            const currentStaffId = schedule[location.id]?.[dayKey] || ''
                            const isTodayDate = isToday(date)
                            const dayStatus = getDayStatus(dayKey)
                            
                            // Get darker border color for today based on day status
                            const getTodayBorderColor = () => {
                              switch (dayStatus) {
                                case 'regular-holiday':
                                  return 'border-orange-600'
                                case 'special-holiday':
                                  return 'border-violet-600'
                                default:
                                  return 'border-blue-600'
                              }
                            }
                            
                            return (
                              <td key={dayIndex} className={`px-2 py-3 text-center align-top border-r border-white last:border-r-0 w-36 ${getStoreColor(location)}`}>
                                <div className="flex flex-col gap-2">
                                  {/* Click-to-add zone - uses main staff selector */}
                                  {(() => {
                                    const staffForLocation = getStaffForLocation(location.id)
                                    const currentInCell = schedule[location.id]?.[dayKey]
                                    const staffIdsInCell = Array.isArray(currentInCell) ? currentInCell : (currentInCell ? [currentInCell] : [])
                                    const canAddSelected = selectedStaffForSchedule && 
                                      staffForLocation.some(s => s.id === selectedStaffForSchedule) &&
                                      !Object.entries(schedule).some(([branchId, daySchedules]) => {
                                        const staffList = daySchedules[dayKey]
                                        return Array.isArray(staffList) ? staffList.includes(selectedStaffForSchedule) : staffList === selectedStaffForSchedule
                                      }) &&
                                      !staffIdsInCell.includes(selectedStaffForSchedule)
                                    const selectedStaffName = selectedStaffForSchedule ? companyStaff.find(s => s.id === selectedStaffForSchedule)?.full_name : null
                                    if (!canAddSelected) return null
                                    return (
                                      <div
                                        onClick={async () => {
                                          if (selectedStaffForSchedule) {
                                            await addStaffToSchedule(selectedStaffForSchedule, dayKey, location.id)
                                          }
                                        }}
                                        className={`w-full text-xs rounded px-2 py-1.5 transition-all duration-200 cursor-pointer border border-dashed bg-blue-50 border-blue-300 hover:bg-blue-100 text-blue-700 ${saving ? 'pointer-events-none opacity-60' : ''}`}
                                        title={`Click to add ${selectedStaffName}`}
                                      >
                                        + {selectedStaffName}
                                      </div>
                                    )
                                  })()}
                                  
                                  {/* Scheduled Staff List */}
                                  <div className="flex flex-col gap-2">
                                    {getScheduledStaffForBranchAndDate(location.id, dayKey).map((staff) => {
                                      if (!staff) return null
                                      
                                      const staffHours = getStaffHours(location.id, dayKey, staff.id)
                                      const isAbsent = isStaffAbsent(location.id, dayKey, staff.id)
                                      const colorClasses = getStaffColorClasses(dayKey)
                                      const isHovered = hoveredStaffId === staff.id
                                      
                                      // Get darker pastel color for hover state
                                      const getDarkerPastelColor = () => {
                                        if (isAbsent) return 'bg-red-500'
                                        const dayStatusType = getDayStatus(dayKey)
                                        switch (dayStatusType) {
                                          case 'regular-holiday':
                                            return 'bg-orange-500'
                                          case 'special-holiday':
                                            return 'bg-violet-500'
                                          default:
                                            return 'bg-blue-500'
                                        }
                                      }
                                      
                                      // Get border color based on day type
                                      const getBorderColor = () => {
                                        if (isAbsent) return 'border-red-300'
                                        const dayStatusType = getDayStatus(dayKey)
                                        switch (dayStatusType) {
                                          case 'regular-holiday':
                                            return 'border-orange-300'
                                          case 'special-holiday':
                                            return 'border-violet-300'
                                          default:
                                            return 'border-blue-300'
                                        }
                                      }
                                      
                                      return (
                                        <div 
                                          key={staff.id}
                                          onMouseEnter={() => setHoveredStaffId(staff.id)}
                                          onMouseLeave={() => setHoveredStaffId(null)}
                                          className={`group relative text-xs px-2 py-1 rounded-lg transition-all duration-200 max-w-full overflow-hidden ${
                                            isHovered
                                              ? `${getDarkerPastelColor()} text-white`
                                              : isAbsent 
                                              ? 'bg-red-200 hover:bg-red-300 text-red-900' 
                                              : colorClasses.container
                                          }`}
                                        >
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="truncate font-medium text-xs max-w-[100px]">{staff.full_name}</span>
                                            <button
                                              onClick={() => removeStaffFromSchedule(staff.id, dayKey, location.id)}
                                              disabled={saving}
                                              className={`opacity-0 group-hover:opacity-100 ${isHovered ? 'text-white hover:bg-white/20' : isAbsent ? 'text-red-700 hover:text-red-900 hover:bg-red-400' : colorClasses.button} rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold transition-all duration-200 hover:scale-110`}
                                              title="Remove from schedule"
                                            >
                                              ×
                                            </button>
                                          </div>
                                          <div className="flex items-center space-x-1">
                                            <label className={`text-xs font-medium ${isHovered ? 'text-white' : isAbsent ? 'text-red-800' : colorClasses.label}`}>Hours:</label>
                                            <input
                                              type="number"
                                              min="0"
                                              max="24"
                                              step="0.5"
                                              value={isAbsent ? 0 : staffHours}
                                              onChange={(e) => updateStaffHours(location.id, dayKey, staff.id, parseFloat(e.target.value) || 0)}
                                              className={`w-12 text-xs border-0 bg-white hover:bg-gray-50 focus:bg-white focus:outline-none ${isAbsent ? 'border-red-300 focus:ring-red-500' : ''} rounded px-1 py-0.5 text-center font-medium`}
                                              placeholder={String(getDefaultStaffHours(location.id))}
                                              disabled={saving || isAbsent}
                                            />
                                            <button
                                              onClick={() => toggleStaffAbsence(location.id, dayKey, staff.id)}
                                              disabled={saving}
                                              className={`${isAbsent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${isHovered ? 'text-white hover:bg-white/20' : isAbsent ? 'text-red-600 hover:text-red-900 hover:bg-red-400' : colorClasses.button} rounded-full w-4 h-4 flex items-center justify-center transition-all duration-200 hover:scale-110`}
                                              title={isAbsent ? 'Unmark absence (click to restore)' : 'Mark as absent (sets hours to 0)'}
                                            >
                                              <CalendarX className="h-3 w-3" />
                                            </button>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                          ))}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
                )}
                </div>
              </div>
            </div>
            
            <div className="flex-shrink-0 overflow-x-auto border-t border-gray-200 bg-white">
            <div className="flex items-center justify-between p-4 sm:p-6 min-w-[720px]">
              {/* Color Legend */}
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-200 border border-blue-300 rounded"></div>
                  <span className="text-sm text-gray-600">Regular</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-orange-200 border border-orange-300 rounded"></div>
                  <span className="text-sm text-gray-600">Double Pay</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-violet-200 border border-violet-300 rounded"></div>
                  <span className="text-sm text-gray-600">Special Holiday</span>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setIsScheduleModalOpen(false)
                    setHoveredStaffId(null)
                    setSelectedStaffForSchedule(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSchedule}
                  disabled={saving || !hasScheduleChanges()}
                  className={`px-4 py-2 text-white rounded-lg transition-all duration-200 font-medium ${
                    saving || (!hasScheduleChanges() && !scheduleJustSaved)
                      ? 'bg-gray-400 cursor-not-allowed opacity-60'
                      : scheduleJustSaved
                      ? 'bg-gray-400 cursor-not-allowed opacity-60'
                      : 'bg-green-600 hover:bg-green-700 cursor-pointer'
                  }`}
                >
                  {saving ? 'Saving...' : scheduleJustSaved ? 'Saved Changes' : 'Save Schedule'}
                </button>
              </div>
            </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Leave Request Approval Modal */}
      {isLeaveRequestModalOpen && selectedLeaveRequest && (
        <Modal onClose={() => setIsLeaveRequestModalOpen(false)} align="center">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Review Leave Request</h3>
              <button
                onClick={() => setIsLeaveRequestModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Request Details */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Request Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Staff Member:</span>
                    <p className="text-gray-900">{selectedLeaveRequest.staff_registrations.full_name}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Staff Code:</span>
                    <div className="flex items-center space-x-2">
                      <p className="text-gray-900">{selectedLeaveRequest.staff_registrations.staff_code}</p>
                      <button
                        onClick={(e) => {
                          navigator.clipboard.writeText(selectedLeaveRequest.staff_registrations.staff_code)
                          const button = e.currentTarget
                          const originalHTML = button.innerHTML
                          button.innerHTML = '<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
                          button.classList.add('text-green-600')
                          setTimeout(() => {
                            button.innerHTML = originalHTML
                            button.classList.remove('text-green-600')
                          }, 1500)
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                        title="Copy staff code"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Branch:</span>
                    <p className="text-gray-900">{selectedLeaveRequest.locations.name}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Request Type:</span>
                    <span className="ml-2 px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800">
                      {selectedLeaveRequest.request_type === 'absence_sickness' ? 'Sickness' :
                       selectedLeaveRequest.request_type === 'absence_family' ? 'Family Emergency' :
                       selectedLeaveRequest.request_type === 'absence_authorized' ? 'Authorized Absence' :
                       selectedLeaveRequest.request_type === 'absence_personal' ? 'Personal Leave' :
                       selectedLeaveRequest.request_type === 'absence_bereavement' ? 'Bereavement Leave' :
                       selectedLeaveRequest.request_type === 'absence_vacation' ? 'Vacation Leave' :
                       selectedLeaveRequest.request_type === 'absence_admin' ? 'Absent' : 'Absence'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Start Date:</span>
                    <p className="text-gray-900">{new Date(selectedLeaveRequest.start_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">End Date:</span>
                    <p className="text-gray-900">{new Date(selectedLeaveRequest.end_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Days Requested:</span>
                    <p className="text-gray-900 font-semibold">
                      {calculateDays(selectedLeaveRequest.start_date, selectedLeaveRequest.end_date)} day(s)
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Current Balance:</span>
                    <div className={`inline-block px-2 py-1 rounded-lg font-semibold ${
                      (selectedLeaveRequest.staff_registrations.leave_balance ?? 10) > 5 
                        ? 'bg-green-100 text-green-800' 
                        : (selectedLeaveRequest.staff_registrations.leave_balance ?? 10) > 2 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedLeaveRequest.staff_registrations.leave_balance ?? 10} day(s)
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <span className="font-medium text-gray-700">Reason:</span>
                  <p className="text-gray-900 mt-1">{selectedLeaveRequest.reason}</p>
                </div>
                {/* Remaining Balance After Approval */}
                {selectedLeaveRequest.status === 'pending' && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    {selectedLeaveRequest.request_type === 'absence_authorized' ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Balance After Approval:</span>
                        <div className="flex items-center space-x-2">
                          <span className="px-3 py-1 rounded-lg font-semibold bg-blue-100 text-blue-800">
                            {selectedLeaveRequest.staff_registrations.leave_balance ?? 10} day(s)
                          </span>
                          <span className="text-xs text-blue-600">(No deduction)</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Balance After Approval:</span>
                          <span className={`px-3 py-1 rounded-lg font-semibold ${
                            ((selectedLeaveRequest.staff_registrations.leave_balance ?? 10) - calculateDays(selectedLeaveRequest.start_date, selectedLeaveRequest.end_date)) > 5 
                              ? 'bg-green-100 text-green-800' 
                              : ((selectedLeaveRequest.staff_registrations.leave_balance ?? 10) - calculateDays(selectedLeaveRequest.start_date, selectedLeaveRequest.end_date)) >= 0 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {(selectedLeaveRequest.staff_registrations.leave_balance ?? 10) - calculateDays(selectedLeaveRequest.start_date, selectedLeaveRequest.end_date)} day(s)
                          </span>
                        </div>
                        {((selectedLeaveRequest.staff_registrations.leave_balance ?? 10) - calculateDays(selectedLeaveRequest.start_date, selectedLeaveRequest.end_date)) < 0 && (
                          <p className="text-xs text-red-600 mt-2">⚠️ Warning: Request exceeds available balance</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Admin Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Notes (Optional)
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add any notes about this decision..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setIsLeaveRequestModalOpen(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleLeaveRequestDecision('rejected')}
                  disabled={saving}
                  className="flex-1 px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? 'Processing...' : 'Reject'}
                </button>
                <button
                  onClick={() => handleLeaveRequestDecision('approved')}
                  disabled={saving}
                  className="flex-1 px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Processing...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Leave History Modal */}
      {isLeaveHistoryModalOpen && selectedStaffForHistory && (
        <Modal onClose={() => { setIsLeaveHistoryModalOpen(false); setSelectedStaffForHistory(null); setStaffLeaveHistory([]) }} align="center">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Leave Request History</h3>
                <div className="flex items-center space-x-2 mt-1">
                  <p className="text-sm text-gray-600">
                    {selectedStaffForHistory.full_name} • {selectedStaffForHistory.staff_code}
                  </p>
                  <button
                    onClick={(e) => {
                      navigator.clipboard.writeText(selectedStaffForHistory.staff_code)
                      const button = e.currentTarget
                      const originalHTML = button.innerHTML
                      button.innerHTML = '<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
                      button.classList.add('text-green-600')
                      setTimeout(() => {
                        button.innerHTML = originalHTML
                        button.classList.remove('text-green-600')
                      }, 1500)
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                    title="Copy staff code"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsLeaveHistoryModalOpen(false)
                  setSelectedStaffForHistory(null)
                  setStaffLeaveHistory([])
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6">
              {loadingLeaveHistory ? (
                <StaffLeaveHistorySkeleton />
              ) : staffLeaveHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No leave requests found for this staff member.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {staffLeaveHistory.map((request) => (
                    <div key={request.id} className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                      request.status === 'approved' && request.request_type === 'absence_admin'
                        ? 'border-orange-300'
                        : 'border-gray-200'
                    }`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="text-md font-semibold text-gray-900">
                              {request.request_type === 'absence_sickness' ? 'Sickness' :
                               request.request_type === 'absence_family' ? 'Family Emergency' :
                               request.request_type === 'absence_authorized' ? 'Authorized Absence' :
                               request.request_type === 'absence_personal' ? 'Personal Leave' :
                               request.request_type === 'absence_bereavement' ? 'Bereavement Leave' :
                               request.request_type === 'absence_vacation' ? 'Vacation Leave' :
                               request.request_type === 'absence_admin' ? 'Absent' : 'Absence Report'}
                            </h4>
                            <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                              request.status === 'pending' 
                                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' 
                                : request.status === 'approved' && request.request_type === 'absence_admin'
                                ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                : request.status === 'approved'
                                ? 'bg-green-100 text-green-800 border border-green-300'
                                : 'bg-red-100 text-red-800 border border-red-300'
                            }`}>
                              {request.status === 'approved' && request.request_type === 'absence_admin' ? 'Warning' : request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteLeaveRequest(request.id, request.staff_registration_id)}
                          disabled={saving}
                          className="ml-4 p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete leave request"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Branch:</span> {request.locations.name}
                        </div>
                        <div>
                          <span className="font-medium">Submitted:</span> {new Date(request.created_at).toLocaleDateString()}
                        </div>
                        <div>
                          <span className="font-medium">Start Date:</span> {new Date(request.start_date).toLocaleDateString()}
                        </div>
                        <div>
                          <span className="font-medium">End Date:</span> {new Date(request.end_date).toLocaleDateString()}
                        </div>
                        <div>
                          <span className="font-medium">Days Requested:</span> 
                          <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                            {calculateDays(request.start_date, request.end_date)} day(s)
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-gray-100 pt-3 mt-3">
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 mb-1">Reason:</p>
                          <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{request.reason}</p>
                        </div>

                        {request.admin_notes && (
                          <div className={`p-3 rounded text-sm ${
                            request.status === 'approved' 
                              ? 'bg-green-50 border border-green-200' 
                              : request.status === 'rejected'
                              ? 'bg-red-50 border border-red-200'
                              : 'bg-gray-50 border border-gray-200'
                          }`}>
                            <p className="font-medium text-gray-700 mb-1">Admin Notes:</p>
                            <p className="text-gray-600">{request.admin_notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 p-6 bg-gray-50 sticky bottom-0">
              <button
                onClick={() => {
                  setIsLeaveHistoryModalOpen(false)
                  setSelectedStaffForHistory(null)
                  setStaffLeaveHistory([])
                }}
                className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* General Announcement Modal */}
      {isAnnouncementModalOpen && (
        <Modal onClose={() => { setIsAnnouncementModalOpen(false); setAnnouncementForm({ title: '', message: '', type: 'general' }) }} align="center">
          <div className="bg-white rounded-lg shadow-xl w-[1000px] h-[700px] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">General Announcements</h3>
              <button
                onClick={() => {
                  setIsAnnouncementModalOpen(false)
                  setAnnouncementForm({ title: '', message: '', type: 'general' })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 h-full">
                {/* Create New Announcement */}
                <div className="space-y-4 flex flex-col">
                  <h4 className="font-semibold text-gray-900">Create New Announcement</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="announcementType"
                          value="general"
                          checked={announcementForm.type === 'general'}
                          onChange={(e) => setAnnouncementForm({ ...announcementForm, type: e.target.value as 'general' | 'reminder' })}
                          className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">General</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="announcementType"
                          value="reminder"
                          checked={announcementForm.type === 'reminder'}
                          onChange={(e) => setAnnouncementForm({ ...announcementForm, type: e.target.value as 'general' | 'reminder' })}
                          className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Reminder</span>
                      </label>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <input
                      type="text"
                      value={announcementForm.title}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                        announcementFieldErrors.title ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter announcement title"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                    <textarea
                      value={announcementForm.message}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                      rows={6}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                        announcementFieldErrors.message ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter announcement message"
                    />
                  </div>

                  <button
                    onClick={createAnnouncement}
                    disabled={saving}
                    className={`w-full px-4 py-2 text-white rounded-md disabled:opacity-50 ${
                      announcementForm.type === 'reminder' 
                        ? 'bg-orange-600 hover:bg-orange-700' 
                        : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    {saving ? 'Creating...' : 'Create Announcement'}
                  </button>

                  {error && (
                    <div className="text-red-600 text-sm">{error}</div>
                  )}

                  {success && (
                    <div className="text-green-600 text-sm">{success}</div>
                  )}
                </div>

                {/* Announcement History */}
                <div className="space-y-4 flex flex-col overflow-hidden">
                  <h4 className="font-semibold text-gray-900">Recent Announcements</h4>
                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {loadingAnnouncementHistory ? (
                      <StaffModalHistorySkeleton rows={5} variant="compact" />
                    ) : announcementHistory.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Megaphone className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm">No announcements yet</p>
                      </div>
                    ) : (
                      announcementHistory.map((announcement) => (
                        <div key={announcement.id} className={`${
                          announcement.type === 'reminder' 
                            ? 'bg-orange-50 border border-orange-200' 
                            : 'bg-purple-50 border border-purple-200'
                        } rounded-lg p-3`}>
                          <div className="flex items-start justify-between mb-2">
                            <h5 className={`font-semibold text-sm ${
                              announcement.type === 'reminder' 
                                ? 'text-orange-900' 
                                : 'text-purple-900'
                            }`}>{announcement.title}</h5>
                            <div className="flex items-center space-x-2">
                              <span className={`text-xs ${
                                announcement.type === 'reminder' 
                                  ? 'text-orange-600' 
                                  : 'text-purple-600'
                              }`}>
                                {new Date(announcement.created_at).toLocaleDateString()}
                              </span>
                              <button
                                onClick={() => deleteAnnouncement(announcement.id)}
                                disabled={saving}
                                className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                title="Delete announcement"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <p className={`text-sm whitespace-pre-line ${
                            announcement.type === 'reminder' 
                              ? 'text-orange-800' 
                              : 'text-purple-800'
                          }`}>{announcement.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setIsAnnouncementModalOpen(false)
                  setAnnouncementForm({ title: '', message: '', type: 'general' })
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Staff Message Modal */}
      {isMessageModalOpen && selectedStaffForMessage && (
        <Modal onClose={() => { setIsMessageModalOpen(false); setSelectedStaffForMessage(null); setMessageForm({ title: '', message: '', type: 'notice' }) }} align="center">
          <div className="bg-white rounded-lg shadow-xl w-[1000px] h-[700px] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Messages for {selectedStaffForMessage.full_name}</h3>
                <div className="flex items-center space-x-2 mt-1">
                  <p className="text-sm text-gray-600">Staff Code: {selectedStaffForMessage.staff_code}</p>
                  <button
                    onClick={(e) => {
                      navigator.clipboard.writeText(selectedStaffForMessage.staff_code)
                      const button = e.currentTarget
                      const originalHTML = button.innerHTML
                      button.innerHTML = '<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
                      button.classList.add('text-green-600')
                      setTimeout(() => {
                        button.innerHTML = originalHTML
                        button.classList.remove('text-green-600')
                      }, 1500)
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                    title="Copy staff code"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsMessageModalOpen(false)
                  setSelectedStaffForMessage(null)
                  setMessageForm({ title: '', message: '', type: 'notice' })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 h-full">
                {/* Send New Message */}
                <div className="space-y-4 flex flex-col">
                  <h4 className="font-semibold text-gray-900">Send New Message</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Message Type</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="notice"
                          checked={messageForm.type === 'notice'}
                          onChange={(e) => setMessageForm({ ...messageForm, type: e.target.value as 'notice' | 'warning' })}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">Notice</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="warning"
                          checked={messageForm.type === 'warning'}
                          onChange={(e) => setMessageForm({ ...messageForm, type: e.target.value as 'notice' | 'warning' })}
                          className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">Warning</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <input
                      type="text"
                      value={messageForm.title}
                      onChange={(e) => setMessageForm({ ...messageForm, title: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                        messageFieldErrors.title ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter message title"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                    <textarea
                      value={messageForm.message}
                      onChange={(e) => setMessageForm({ ...messageForm, message: e.target.value })}
                      rows={6}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                        messageFieldErrors.message ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter your message"
                    />
                  </div>

                  <button
                    onClick={sendStaffMessage}
                    disabled={saving}
                    className={`w-full px-4 py-2 text-white rounded-md disabled:opacity-50 ${
                      messageForm.type === 'warning' 
                        ? 'bg-red-600 hover:bg-red-700' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {saving ? 'Sending...' : `Send ${messageForm.type === 'warning' ? 'Warning' : 'Notice'}`}
                  </button>

                  {error && (
                    <div className="text-red-600 text-sm">{error}</div>
                  )}

                  {success && (
                    <div className="text-green-600 text-sm">{success}</div>
                  )}
                </div>

                {/* Message History */}
                <div className="space-y-4 flex flex-col overflow-hidden">
                  <h4 className="font-semibold text-gray-900">Message History</h4>
                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {loadingMessageHistory ? (
                      <StaffModalHistorySkeleton rows={5} variant="compact" />
                    ) : messageHistory.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Mail className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm">No messages sent yet</p>
                      </div>
                    ) : (
                      messageHistory.map((msg) => (
                        <div key={msg.id} className={`border rounded-lg p-3 ${
                          msg.type === 'warning' 
                            ? 'bg-red-50 border-red-200' 
                            : 'bg-blue-50 border-blue-200'
                        }`}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2 flex-1">
                              <h5 className={`font-semibold text-sm ${
                                msg.type === 'warning' ? 'text-red-900' : 'text-blue-900'
                              }`}>
                                {msg.title}
                              </h5>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                msg.type === 'warning' 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {msg.type === 'warning' ? 'Warning' : 'Notice'} - {selectedStaffForMessage.full_name}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`text-xs ${
                                msg.type === 'warning' ? 'text-red-600' : 'text-blue-600'
                              }`}>
                                {new Date(msg.created_at).toLocaleDateString()}
                              </span>
                              <button
                                onClick={() => deleteMessage(msg.id, selectedStaffForMessage.id)}
                                disabled={saving}
                                className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                title="Delete message"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <p className={`text-sm whitespace-pre-line ${
                            msg.type === 'warning' ? 'text-red-800' : 'text-blue-800'
                          }`}>
                            {msg.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setIsMessageModalOpen(false)
                  setSelectedStaffForMessage(null)
                  setMessageForm({ title: '', message: '', type: 'notice' })
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
      {AdminPasswordModal}
    </div>
  )
}
