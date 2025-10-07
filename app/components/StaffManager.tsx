'use client'
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit3, X, MapPin, Building2, User, Phone, Hash, Trash2, Check, Calendar, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'


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
}

interface Location {
  id: string
  name: string
  brand_id: string
  brand?: {
    id: string
    name: string
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

interface StaffManagerProps {
  theme?: string
}

export function StaffManager({ theme = 'blue' }: StaffManagerProps) {
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
  const [editForm, setEditForm] = useState({
    full_name: '',
    mobile_number: '',
    staff_code: '',
    hourly_rate: 0,
    employment_date: ''
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
  const [companyLocations, setCompanyLocations] = useState<Location[]>([])
  const [companyStaff, setCompanyStaff] = useState<StaffWithAssignments[]>([])
  const [todaySchedules, setTodaySchedules] = useState<{[key: string]: any}>({})
  const [showOnlyTodayStaff, setShowOnlyTodayStaff] = useState(false)
  const [dayStatus, setDayStatus] = useState<{[key: string]: 'default' | 'regular-holiday' | 'special-holiday'}>({})
  const [originalDayStatus, setOriginalDayStatus] = useState<{[key: string]: 'default' | 'regular-holiday' | 'special-holiday'}>({})
  
  // New staff form
  const [newStaff, setNewStaff] = useState({
    full_name: '',
    mobile_number: '',
    staff_code: '',
    hourly_rate: 0,
    employment_date: ''
  })

  const getThemeColors = () => {
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
  }

  const colors = getThemeColors()

  useEffect(() => {
    loadData()
    loadTodaySchedules()
  }, [])

  // Load schedule when week changes (like in StaffSchedule component)
  useEffect(() => {
    if (isScheduleModalOpen) {
      loadExistingSchedule()
    }
  }, [currentWeek, isScheduleModalOpen])


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
          is_active: true
        })
        .select()
        .single()

      if (error) throw error

      // Add the new staff to the existing list instead of reloading everything
      const newStaffWithAssignments = { ...newStaffData, staff_assignments: [] }
      setStaff(prevStaff => [...prevStaff, newStaffWithAssignments])
      
      setNewStaff({ full_name: '', mobile_number: '', staff_code: '', hourly_rate: 0, employment_date: '' })
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
    if (!confirm('Are you sure you want to delete this staff member? This will also remove all their assignments.')) return

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
      employment_date: staff.employment_date || ''
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
          employment_date: editForm.employment_date
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
      // Load both queries in parallel for faster performance
      const [locationsResult, staffResult] = await Promise.all([
        supabase
          .from('locations')
          .select(`
            *,
            brand:brands!locations_brand_id_fkey (
              id,
              name
            )
          `)
          .eq('company_owned', true)
          .order('name'),
        
        supabase
          .from('staff_registrations')
          .select(`
            *,
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
                  name
                )
              )
            )
          `)
          .eq('is_active', true)
          .order('full_name')
      ])

      if (locationsResult.error) throw locationsResult.error
      if (staffResult.error) throw staffResult.error

      // Filter for company-owned locations only, excluding factory branches
      const companyLocs = locationsResult.data?.filter(loc => 
        !loc.name.toLowerCase().includes('factory')
      ) || []

      const companyLocationIds = new Set(companyLocs.map(loc => loc.id))

      // Filter staff assigned to company-owned locations only
      const companyStaffList = staffResult.data?.filter(staff => 
        staff.staff_assignments.some(assignment => 
          assignment.location?.company_owned && 
          companyLocationIds.has(assignment.location_id)
        )
      ) || []

      setCompanyLocations(companyLocs)
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

  const loadTodaySchedules = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      
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

  const getFilteredStaff = () => {
    if (!showOnlyTodayStaff) return staff
    
    // Filter staff to show only those scheduled today
    return staff.filter(staffMember => {
      const todaySchedule = isStaffScheduledToday(staffMember.id)
      return todaySchedule !== null
    })
  }

  const loadExistingSchedule = async () => {
    try {
      const weekDates = getWeekDates(currentWeek)
      const startDate = weekDates[0].toISOString().split('T')[0]
      const endDate = weekDates[6].toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('staff_schedules')
        .select(`
          *,
          location:locations!staff_schedules_location_id_fkey (
            id,
            name
          ),
          staff:staff_registrations!staff_schedules_staff_registration_id_fkey (
            id,
            full_name
          )
        `)
        .gte('schedule_date', startDate)
        .lte('schedule_date', endDate)
        .order('schedule_date')
      
      if (error) throw error
      
      // Convert database data to schedule format
      const newSchedule: {[key: string]: {[key: string]: string[]}} = {}
      const newStaffHours: {[key: string]: {[key: string]: {[key: string]: number}}} = {}
      const newDayStatus: {[key: string]: 'default' | 'regular-holiday' | 'special-holiday'} = {}
      
      data?.forEach(item => {
        const dayKey = getScheduleKey(new Date(item.schedule_date))
        
        if (item.location_id) {
          if (!newSchedule[item.location_id]) {
            newSchedule[item.location_id] = {}
          }
          if (!newSchedule[item.location_id][dayKey]) {
            newSchedule[item.location_id][dayKey] = []
          }
          if (!newSchedule[item.location_id][dayKey].includes(item.staff_registration_id)) {
            newSchedule[item.location_id][dayKey].push(item.staff_registration_id)
          }

          // Load hours data
          if (!newStaffHours[item.location_id]) {
            newStaffHours[item.location_id] = {}
          }
          if (!newStaffHours[item.location_id][dayKey]) {
            newStaffHours[item.location_id][dayKey] = {}
          }
          newStaffHours[item.location_id][dayKey][item.staff_registration_id] = item.hours || 11
          
          // Load day status (use the first occurrence for each day)
          if (!newDayStatus[dayKey] && item.day_type) {
            newDayStatus[dayKey] = item.day_type as 'default' | 'regular-holiday' | 'special-holiday'
          }
        }
      })
      
      setSchedule(newSchedule)
      setOriginalSchedule(JSON.parse(JSON.stringify(newSchedule))) // Deep copy for comparison
      setStaffHours(newStaffHours)
      setOriginalStaffHours(JSON.parse(JSON.stringify(newStaffHours))) // Deep copy for comparison
      setDayStatus(newDayStatus)
      setOriginalDayStatus(JSON.parse(JSON.stringify(newDayStatus))) // Deep copy for comparison
    } catch (error) {
      console.error('Error loading existing schedule:', error)
      setError('Failed to load existing schedule')
    }
  }

  const openScheduleModal = async () => {
    setSuccess('') // Clear any previous success message
    
    // Open modal immediately for better UX
    setIsScheduleModalOpen(true)
    
    // Load data in parallel for faster loading
    await Promise.all([
      loadCompanyData(),
      loadExistingSchedule()
    ])
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
          const originalHours = originalStaffHours[locationId]?.[dayKey]?.[staffId] || 8
          if (currentHours !== originalHours) return true
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
    if (brandName.includes('mychoice')) {
      return 'bg-green-100' // Mychoice - Green background only
    } else if (brandName.includes('gelatofilipino')) {
      return 'bg-red-100' // Gelatofilipino - Red background only
    }
    return 'bg-gray-100' // Default
  }

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

      // Initialize hours for this staff member (default to 11 hours)
      setStaffHours(prev => ({
        ...prev,
        [locationId]: {
          ...prev[locationId],
          [dayKey]: {
            ...prev[locationId]?.[dayKey],
            [staffId]: 11
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

  const getStaffHours = (locationId: string, dayKey: string, staffId: string) => {
    return staffHours[locationId]?.[dayKey]?.[staffId] || 11 // Default to 11 hours
  }

  const updateStaffHours = (locationId: string, dayKey: string, staffId: string, hours: number) => {
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
          container: 'bg-orange-200 hover:bg-orange-300 text-orange-900 border border-orange-300',
          button: 'text-orange-700 hover:text-orange-900 hover:bg-orange-400',
          label: 'text-orange-800 font-semibold',
          input: 'focus:ring-orange-500 border-orange-300'
        }
      case 'special-holiday':
        return {
          container: 'bg-violet-200 hover:bg-violet-300 text-violet-900 border border-violet-300',
          button: 'text-violet-700 hover:text-violet-900 hover:bg-violet-400',
          label: 'text-violet-800 font-semibold',
          input: 'focus:ring-violet-500 border-violet-300'
        }
      default: // 'default'
        return {
          container: 'bg-blue-200 hover:bg-blue-300 text-blue-900 border border-blue-300',
          button: 'text-blue-700 hover:text-blue-900 hover:bg-blue-400',
          label: 'text-blue-800 font-semibold',
          input: 'focus:ring-blue-500 border-blue-300'
        }
    }
  }

  const saveSchedule = async () => {
    setSaving(true)
    try {
      const weekDates = getWeekDates(currentWeek)
      
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
                scheduleData.push({
                  location_id: locationId,
                  staff_registration_id: staffId,
                  schedule_date: scheduleDate.toISOString().split('T')[0],
                  hours: hours,
                  day_type: dayStatus
                })
              }
            }
          })
        })
      })
      
      // Clear existing schedules for this week first
      const startDate = weekDates[0].toISOString().split('T')[0]
      const endDate = weekDates[6].toISOString().split('T')[0]
      
      const { error: deleteError } = await supabase
        .from('staff_schedules')
        .delete()
        .gte('schedule_date', startDate)
        .lte('schedule_date', endDate)
      
      if (deleteError) throw deleteError
      
      // Insert new schedule data only if there's data to insert
      if (scheduleData.length > 0) {
        const { error: insertError } = await supabase
          .from('staff_schedules')
          .insert(scheduleData)
        
        if (insertError) throw insertError
      }
      
       // Update original schedule and hours to match current after successful save
       setOriginalSchedule(JSON.parse(JSON.stringify(schedule)))
       setOriginalStaffHours(JSON.parse(JSON.stringify(staffHours)))
       setOriginalDayStatus(JSON.parse(JSON.stringify(dayStatus)))
       
       // Refresh today's schedules
       loadTodaySchedules()
     } catch (error) {
      console.error('Error saving schedule:', error)
      setError('Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading staff data...</p>
        </div>
      </div>
    )
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

      {/* Staff List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
               {(() => {
                 // Get filtered staff (all or today only)
                 const filteredStaff = getFilteredStaff()
                 
                 // Group staff by their primary assignment location
                 const groupedStaff = filteredStaff.reduce((groups, staffMember) => {
                  const primaryLocation = staffMember.staff_assignments[0]?.location?.name || 'Unassigned'
                  if (!groups[primaryLocation]) {
                    groups[primaryLocation] = []
                  }
                  groups[primaryLocation].push(staffMember)
                  return groups
                }, {} as Record<string, typeof staff>)

                 // Show message if no staff found when filtering for today
                 if (showOnlyTodayStaff && filteredStaff.length === 0) {
                   return (
                     <tr>
                       <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
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
                 return Object.entries(groupedStaff).map(([locationName, staffList]) => (
                  <React.Fragment key={locationName}>
                    {/* Location Group Header */}
                    <tr className="bg-gray-100">
                      <td colSpan={5} className="px-6 py-3">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-gray-600" />
                          <span className="font-semibold text-gray-900">{locationName}</span>
                          <span className="text-sm text-gray-600">({staffList.length} staff member{staffList.length !== 1 ? 's' : ''})</span>
                        </div>
                      </td>
                    </tr>
                    {/* Staff Members in this location */}
                    {staffList.map((staffMember) => (
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
                             
                             return (
                               <div 
                                 key={assignment.id} 
                                 className={`flex items-center space-x-2 p-1 rounded ${
                                   isTodayAssignment 
                                     ? 'bg-blue-100 border border-blue-300' 
                                     : ''
                                 }`}
                               >
                                 <MapPin className={`h-3 w-3 ${isTodayAssignment ? 'text-blue-600' : 'text-gray-400'}`} />
                                 <span className={`text-xs ${isTodayAssignment ? 'text-blue-800 font-medium' : ''}`}>
                                   {assignment.location.name} ({assignment.location.brand?.name})
                                   {isTodayAssignment && (
                                     <span className="ml-1 text-blue-600 font-semibold">• Today</span>
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
                    <button
                      onClick={() => openEditModal(staffMember)}
                      className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                      title="Edit staff"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
        </div>
      )}

      {/* Edit Staff Modal */}
      {isEditModalOpen && selectedStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Staff Code *</label>
                      <input
                        type="text"
                        value={editForm.staff_code}
                        onChange={(e) => setEditForm({ ...editForm, staff_code: e.target.value })}
                        maxLength={8}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
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
                                <span className="font-medium">{assignment.location.name}</span>
                              </div>
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <Building2 className="h-3 w-3" />
                                <span>{assignment.location.brand?.name}</span>
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
                  onClick={() => deleteStaff(selectedStaff.id)}
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
        </div>
      )}

      {/* Add Assignment Modal */}
      {isAddAssignmentOpen && selectedStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
        </div>
      )}

      {/* Schedule Staff Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-screen-2xl w-full h-[90vh] flex flex-col border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
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
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden bg-white">
              <div className="h-full overflow-y-auto overflow-x-hidden p-6">
                <div className="min-h-0">
                <table className="w-full table-fixed">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 border-r border-gray-200 w-64 min-w-64">
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
                        
                        return (
                          <th 
                            key={index} 
                            className={`px-2 py-3 text-center border-r border-gray-200 last:border-r-0 cursor-pointer hover:opacity-80 transition-all duration-200 w-36 ${dayColorClasses.container} ${isTodayDate ? 'ring-4 ring-inset ring-blue-600' : ''}`}
                            onClick={() => toggleDayHolidayStatus(dayKey)}
                            title={`Click to change day status: ${dayStatus === 'default' ? 'Default' : dayStatus === 'regular-holiday' ? 'Regular Holiday' : 'Special Holiday'}`}
                          >
                            <div className={`text-lg font-bold ${isTodayDate ? 'text-blue-900' : dayColorClasses.label}`}>
                              {getDateNumber(date)}
                            </div>
                            <div className={`text-sm font-semibold ${isTodayDate ? 'text-blue-900' : dayColorClasses.label}`}>
                              {getDayName(date)}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {companyLocations.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                          <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p className="text-lg font-medium text-gray-900 mb-2">No company-owned branches found</p>
                          <p className="text-sm text-gray-500">Please add company-owned locations or contact support</p>
                        </td>
                      </tr>
                    ) : (
                      companyLocations.map((location) => (
                        <tr key={location.id} className={`hover:bg-gray-50 transition-colors ${getStoreColor(location)}`}>
                          <td className={`px-6 py-4 text-sm font-medium text-gray-900 border-r border-gray-200 w-64 min-w-64 ${getStoreColor(location)}`}>
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
                            return (
                              <td key={dayIndex} className={`px-2 py-3 text-center border-r border-gray-200 last:border-r-0 w-36 ${getStoreColor(location)} ${isTodayDate ? 'border-l-2 border-r-2 border-blue-300' : ''}`}>
                                <div className="space-y-2">
                                  {/* Staff Dropdown */}
                                  <select 
                                    className="w-full text-xs border-0 bg-gray-100 hover:bg-gray-200 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 rounded px-2 py-1 transition-all duration-200 shadow-sm"
                                    value=""
                                    onChange={async (e) => {
                                      if (e.target.value) {
                                        await addStaffToSchedule(e.target.value, dayKey, location.id)
                                        e.target.value = ""
                                      }
                                    }}
                                    disabled={saving}
                                  >
                                    <option value="">+</option>
                                    {getStaffForLocation(location.id).map((staff) => {
                                      // Check if staff is already scheduled to ANY branch on this day
                                      const alreadyScheduledToAnyBranch = Object.entries(schedule).some(([branchId, daySchedules]) => {
                                        const staffList = daySchedules[dayKey]
                                        return Array.isArray(staffList) ? staffList.includes(staff.id) : staffList === staff.id
                                      })
                                      
                                      // Don't show staff who are already scheduled to any branch
                                      if (alreadyScheduledToAnyBranch) return null
                                      
                                      return (
                                        <option key={staff.id} value={staff.id}>
                                          {staff.full_name}
                                        </option>
                                      )
                                    })}
                                  </select>
                                  
                                  {/* Scheduled Staff List */}
                                  <div className="space-y-2">
                                    {getScheduledStaffForBranchAndDate(location.id, dayKey).map((staff) => {
                                      if (!staff) return null
                                      
                                      const staffHours = getStaffHours(location.id, dayKey, staff.id)
                                      const colorClasses = getStaffColorClasses(dayKey)
                                      
                                      return (
                                        <div 
                                          key={staff.id}
                                          className={`group relative text-xs px-2 py-1 rounded-lg ${colorClasses.container} transition-all duration-200 max-w-full overflow-hidden`}
                                        >
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="truncate font-medium text-xs max-w-[100px]">{staff.full_name}</span>
                                            <button
                                              onClick={() => removeStaffFromSchedule(staff.id, dayKey, location.id)}
                                              disabled={saving}
                                              className={`opacity-0 group-hover:opacity-100 ${colorClasses.button} rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold transition-all duration-200 hover:scale-110`}
                                              title="Remove from schedule"
                                            >
                                              ×
                                            </button>
                                          </div>
                                          <div className="flex items-center space-x-1">
                                            <label className={`text-xs ${colorClasses.label} font-medium`}>Hours:</label>
                                            <input
                                              type="number"
                                              min="0"
                                              max="24"
                                              step="0.5"
                                              value={staffHours}
                                              onChange={(e) => updateStaffHours(location.id, dayKey, staff.id, parseFloat(e.target.value) || 0)}
                                              className={`w-12 text-xs border-2 bg-white hover:bg-gray-50 focus:bg-white focus:ring-1 ${colorClasses.input} rounded px-1 py-0.5 text-center font-medium`}
                                              placeholder="11"
                                              disabled={saving}
                                            />
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
                      ))
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-white flex-shrink-0">
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
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSchedule}
                  disabled={saving || !hasScheduleChanges()}
                  className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium ${
                    hasScheduleChanges() 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  {saving ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
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
    </div>
  )
}
