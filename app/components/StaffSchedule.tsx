'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ChevronLeft, ChevronRight, X, Calendar, Users, Building2, ChevronDown } from 'lucide-react'

interface StaffRegistration {
  id: string
  full_name: string
  mobile_number: string
  staff_code: string
  is_active: boolean
}

interface SavedBranch {
  id: string
  name: string
  passcode: string
  brand_name: string
  created_at: string
}

interface StaffAssignment {
  id: string
  location_id: string
  staff_registration_id: string
  staff_registration: StaffRegistration
}

interface StaffSchedule {
  id: string
  location_id: string
  staff_registration_id: string
  schedule_date: string
  staff_registration?: StaffRegistration
}

interface StaffScheduleProps {
  locationId: string
  locationName: string
  currentBranchBrandName?: string
  onClose?: () => void
}

export function StaffSchedule({ locationId, locationName, currentBranchBrandName, onClose }: StaffScheduleProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [savedBranches, setSavedBranches] = useState<SavedBranch[]>([])
  const [allBranches, setAllBranches] = useState<SavedBranch[]>([])
  const [branchStaffAssignments, setBranchStaffAssignments] = useState<{[branchId: string]: StaffAssignment[]}>({})
  const [schedules, setSchedules] = useState<StaffSchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Helper function to format date in local timezone to YYYY-MM-DD
  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Get the start of the week (Sunday) for the current date
  const getWeekStart = (date: Date) => {
    const start = new Date(date)
    start.setDate(date.getDate() - date.getDay())
    return start
  }

  // Get the week dates (Sunday to Saturday)
  const getWeekDates = (date: Date) => {
    const start = getWeekStart(date)
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const weekDates = getWeekDates(currentDate)

  useEffect(() => {
    loadSavedBranches()
  }, [locationId])

  useEffect(() => {
    // Create combined branches list including current branch
    const currentBranch: SavedBranch = {
      id: locationId,
      name: locationName,
      passcode: '', // Not needed for staff schedule
      brand_name: currentBranchBrandName || 'Unknown Brand',
      created_at: new Date().toISOString()
    }
    
    // Check if current branch is already in saved branches to avoid duplicates
    const isCurrentBranchSaved = savedBranches.some(branch => branch.id === locationId)
    
    if (isCurrentBranchSaved) {
      setAllBranches(savedBranches)
    } else {
      setAllBranches([currentBranch, ...savedBranches])
    }
  }, [savedBranches, locationId, locationName, currentBranchBrandName])

  useEffect(() => {
    if (allBranches.length > 0) {
      loadBranchStaffAssignments()
      loadSchedules()
    }
  }, [allBranches, currentDate])

  const loadSavedBranches = async () => {
    try {
      // Load from localStorage
      const saved = localStorage.getItem('saved_branches')
      if (saved) {
        const branches = JSON.parse(saved)
        setSavedBranches(branches)
      }
    } catch (error) {
      console.error('Error loading saved branches:', error)
      setError('Failed to load saved branches')
    }
  }

  const loadBranchStaffAssignments = async () => {
    try {
      const assignments: {[branchId: string]: StaffAssignment[]} = {}
      
      for (const branch of allBranches) {
        const { data, error } = await supabase
          .from('staff_assignments')
          .select(`
            id,
            location_id,
            staff_registration_id,
            staff_registration:staff_registrations!staff_registration_id(*)
          `)
          .eq('location_id', branch.id)

        if (error) throw error

        assignments[branch.id] = (data || []).map((item: any) => ({
          ...item,
          staff_registration: Array.isArray(item.staff_registration) ? item.staff_registration[0] : item.staff_registration
        }))
      }
      
      setBranchStaffAssignments(assignments)
    } catch (error) {
      console.error('Error loading branch staff assignments:', error)
      setError('Failed to load staff assignments')
    }
  }

  const loadSchedules = async () => {
    setLoading(true)
    try {
      const weekStart = getWeekStart(currentDate)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)

      if (allBranches.length === 0) {
        setSchedules([])
        return
      }

      const branchIds = allBranches.map(branch => branch.id)
      
      const { data, error } = await supabase
        .from('staff_schedules')
        .select(`
          *,
          staff_registration:staff_registrations(*)
        `)
        .in('location_id', branchIds)
        .gte('schedule_date', formatDateLocal(weekStart))
        .lte('schedule_date', formatDateLocal(weekEnd))
        // Load all schedules to properly detect existing records

      if (error) throw error

      setSchedules(data || [])
    } catch (error) {
      console.error('Error loading schedules:', error)
      setError('Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentDate(newDate)
  }

  const getScheduleForStaffAndDate = (staffId: string, date: string, branchId: string) => {
    return schedules.find(s => 
      s.staff_registration_id === staffId && 
      s.schedule_date === date &&
      s.location_id === branchId
    )
  }

  const getAssignedStaffForBranch = (branchId: string) => {
    return branchStaffAssignments[branchId] || []
  }

  const getScheduledStaffForBranchAndDate = (branchId: string, date: string) => {
    return schedules.filter(s => 
      s.location_id === branchId && 
      s.schedule_date === date
    ).map(s => s.staff_registration).filter(Boolean)
  }

  const addStaffToSchedule = async (staffId: string, date: string, branchId: string) => {
    setSaving(true)
    try {
      // First, check if staff is already scheduled to ANY branch on this date
      const { data: existingSchedules, error: checkError } = await supabase
        .from('staff_schedules')
        .select('*, location:locations(name)')
        .eq('staff_registration_id', staffId)
        .eq('schedule_date', date)

      if (checkError) throw checkError

      if (existingSchedules && existingSchedules.length > 0) {
        const existingSchedule = existingSchedules[0]
        
        // If they're already scheduled to a different branch, show error
        if (existingSchedule.location_id !== branchId) {
          setError(`Staff is already scheduled to ${existingSchedule.location?.name || 'another branch'} on this date. Staff can only be scheduled to one branch per day.`)
          return
        }
        
        // Already scheduled to the same branch on this date — nothing to change.
      } else {
        // If no existing schedule, create a new one
        const { error: insertError } = await supabase
          .from('staff_schedules')
          .insert({
            location_id: branchId,
            staff_registration_id: staffId,
            schedule_date: date
          })

        if (insertError) throw insertError
      }

      // Reload schedules
      await loadSchedules()
    } catch (error) {
      console.error('Error adding staff to schedule:', error)
      if (error.code === '23505') {
        setError('Staff is already scheduled for this date and location')
      } else {
        setError('Failed to add staff to schedule')
      }
    } finally {
      setSaving(false)
    }
  }

  const removeStaffFromSchedule = async (staffId: string, date: string, branchId: string) => {
    const existingSchedule = getScheduleForStaffAndDate(staffId, date, branchId)
    
    if (!existingSchedule) return
    
    setSaving(true)
    try {
      // Remove the schedule
      const { error } = await supabase
        .from('staff_schedules')
        .delete()
        .eq('id', existingSchedule.id)
      
      if (error) throw error

      // Reload schedules
      await loadSchedules()
    } catch (error) {
      console.error('Error removing staff from schedule:', error)
      setError('Failed to remove staff from schedule')
    } finally {
      setSaving(false)
    }
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

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading staff schedule...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-screen-2xl mx-auto p-4">
      <div className="bg-white rounded-xl shadow-lg w-full border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Staff Schedule</h1>
            <p className="text-sm text-gray-600">Schedule company staff for the current week</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between p-6 bg-white border-b border-gray-200">
        <button
          onClick={() => navigateWeek('prev')}
          className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 font-medium"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Previous</span>
        </button>
        
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-900">
            {formatDate(currentDate)}
          </h3>
          <p className="text-sm text-gray-500 mt-1">Company Staff Schedule</p>
        </div>
        
        <button
          onClick={() => navigateWeek('next')}
          className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 font-medium"
        >
          <span>Next</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Schedule Grid */}
      <div className="overflow-x-auto bg-white">
        <table className="w-full min-w-max">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 border-r border-gray-200 w-64 min-w-64">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <span>STORES</span>
                </div>
              </th>
              {weekDates.map((date) => {
                const isTodayDate = isToday(date)
                return (
                  <th key={date.toISOString()} className={`px-4 py-4 text-center border-r border-gray-200 last:border-r-0 w-48 min-w-48 ${isTodayDate ? 'bg-blue-50 border-l-2 border-r-2 border-blue-300' : ''}`}>
                    <div className={`text-sm font-semibold ${isTodayDate ? 'text-blue-700' : 'text-gray-700'}`}>
                      {formatDay(date)}
                    </div>
                    <div className={`text-xs font-medium ${isTodayDate ? 'text-blue-600' : 'text-gray-500'}`}>
                      {formatDayName(date)}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {allBranches.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium text-gray-900 mb-2">No branches found</p>
                  <p className="text-sm text-gray-500">Add branches in settings to manage their staff schedules</p>
                </td>
              </tr>
            ) : (
              allBranches.map((branch, index) => (
                <tr 
                  key={branch.id} 
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 border-r border-gray-200 bg-gray-50 w-64 min-w-64">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{branch.name}</div>
                        <div className="text-xs text-gray-500">{branch.brand_name}</div>
                      </div>
                    </div>
                  </td>
                  {weekDates.map((date) => {
                    const dateStr = date.toISOString().split('T')[0]
                    const assignedStaff = getAssignedStaffForBranch(branch.id)
                    const scheduledStaff = getScheduledStaffForBranchAndDate(branch.id, dateStr)
                    const isTodayDate = isToday(date)
                    
                    return (
                      <td key={dateStr} className={`px-4 py-4 text-center border-r border-gray-200 last:border-r-0 w-48 min-w-48 ${isTodayDate ? 'bg-blue-50 border-l-2 border-r-2 border-blue-300' : ''}`}>
                        <div className="space-y-3">
                          {/* Staff Dropdown */}
                          <select 
                            className="w-full text-sm border-0 bg-gray-100 hover:bg-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg px-3 py-2 transition-all duration-200 shadow-sm"
                            value=""
                            onChange={async (e) => {
                              if (e.target.value) {
                                await addStaffToSchedule(e.target.value, dateStr, branch.id)
                                e.target.value = ""
                              }
                            }}
                            disabled={saving}
                          >
                            <option value="">+</option>
                            {assignedStaff.map((assignment) => {
                              const staff = assignment.staff_registration
                              const existingSchedule = schedules.find(s => 
                                s.staff_registration_id === staff.id && 
                                s.schedule_date === dateStr &&
                                s.location_id === branch.id
                              )
                              
                              // Check if staff is already scheduled to ANY branch on this date
                              const scheduledToAnyBranch = schedules.find(s => 
                                s.staff_registration_id === staff.id && 
                                s.schedule_date === dateStr
                              )
                              
                              // Don't show staff who are already scheduled to any branch on this date
                              if (scheduledToAnyBranch) return null
                              
                              return (
                                <option key={staff.id} value={staff.id}>
                                  {staff.full_name}
                                </option>
                              )
                            })}
                          </select>
                          
                          {/* Scheduled Staff List */}
                          <div className="space-y-2">
                            {scheduledStaff.map((staff) => {
                              if (!staff) return null
                              
                              return (
                                <div 
                                  key={staff.id}
                                  className="group relative text-sm px-3 py-2 rounded-lg flex items-center justify-between bg-blue-100 hover:bg-blue-200 text-blue-800 transition-all duration-200 shadow-sm"
                                >
                                  <span className="truncate font-medium">{staff.full_name}</span>
                                  <button
                                    onClick={() => removeStaffFromSchedule(staff.id, dateStr, branch.id)}
                                    disabled={saving}
                                    className="opacity-0 group-hover:opacity-100 ml-2 text-blue-600 hover:text-blue-800 hover:bg-blue-300 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold transition-all duration-200"
                                    title="Remove from schedule"
                                  >
                                    ×
                                  </button>
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

      {/* Footer - Auto-save indicator */}
      <div className="flex items-center justify-center p-6 border-t border-gray-200 bg-white">
        <div className="flex items-center space-x-3 text-sm text-gray-600">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="font-medium">Auto-save enabled</span>
          <span className="text-gray-400">•</span>
          <span>Changes are saved automatically</span>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 m-6">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 m-6">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Success</h3>
              <div className="mt-2 text-sm text-green-700">{success}</div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
