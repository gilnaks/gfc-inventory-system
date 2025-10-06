'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Save, X, Users, Search, UserCheck, Calendar } from 'lucide-react'
import { StaffSchedule } from './StaffSchedule'

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
  location: {
    id: string
    name: string
    brand: {
      id: string
      name: string
    }
  }
}

interface StaffAssignmentManagerProps {
  locationId: string
  locationName: string
  currentBranchBrandName?: string
}

export function StaffAssignmentManager({ locationId, locationName, currentBranchBrandName }: StaffAssignmentManagerProps) {
  const [staffRegistrations, setStaffRegistrations] = useState<StaffRegistration[]>([])
  const [assignedStaff, setAssignedStaff] = useState<StaffRegistration[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchCode, setSearchCode] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)

  useEffect(() => {
    loadAssignedStaff()
  }, [locationId])

  const loadAssignedStaff = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('staff_assignments')
        .select(`
          *,
          staff_registration:staff_registrations(*)
        `)
        .eq('assigned_by_location_id', locationId)

      if (error) throw error

      const staff = data?.map(item => item.staff_registration).filter(Boolean) || []
      setAssignedStaff(staff as StaffRegistration[])
    } catch (error) {
      console.error('Error loading assigned staff:', error)
      setError('Failed to load assigned staff')
    } finally {
      setLoading(false)
    }
  }

  const searchStaff = async () => {
    if (!searchCode.trim()) {
      setError('Please enter a staff code')
      return
    }

    if (searchCode.length !== 8) {
      setError('Staff code must be 8 digits')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('staff_registrations')
        .select('*')
        .eq('staff_code', searchCode)
        .eq('is_active', true)
        .single()

      if (error) throw error

      if (data) {
        // Check if already assigned
        const isAlreadyAssigned = assignedStaff.some(staff => staff.id === data.id)
        if (isAlreadyAssigned) {
          setError('This staff member is already assigned to this branch')
          return
        }

        setStaffRegistrations([data])
        setShowAddForm(true)
      } else {
        setError('Staff code not found')
      }
    } catch (error) {
      console.error('Search error:', error)
      setError('Staff code not found')
    } finally {
      setLoading(false)
    }
  }

  const assignStaff = async (staffId: string) => {
    setSaving(true)
    setError('')

    try {
      const { error } = await supabase
        .from('staff_assignments')
        .insert({
          staff_registration_id: staffId,
          location_id: locationId,
          assigned_by_location_id: locationId
        })

      if (error) throw error

      setSuccess('Staff assigned successfully!')
      setShowAddForm(false)
      setSearchCode('')
      setStaffRegistrations([])
      loadAssignedStaff()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error assigning staff:', error)
      setError('Failed to assign staff')
    } finally {
      setSaving(false)
    }
  }

  const removeStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to remove this staff member from this branch?')) return

    setSaving(true)
    setError('')

    try {
      const { error } = await supabase
        .from('staff_assignments')
        .delete()
        .eq('staff_registration_id', staffId)
        .eq('assigned_by_location_id', locationId)

      if (error) throw error

      setSuccess('Staff removed successfully!')
      loadAssignedStaff()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error removing staff:', error)
      setError('Failed to remove staff')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !showAddForm) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading staff assignments...</p>
        </div>
      </div>
    )
  }

  // Show schedule modal if requested
  if (showSchedule) {
    return (
      <StaffSchedule
        locationId={locationId}
        locationName={locationName}
        currentBranchBrandName={currentBranchBrandName}
        onClose={() => setShowSchedule(false)}
      />
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <UserCheck className="h-6 w-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Staff Assignments</h3>
            <p className="text-sm text-gray-600">{locationName}</p>
          </div>
        </div>
        <button
          onClick={() => setShowSchedule(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Calendar className="h-4 w-4" />
          <span>Schedule</span>
        </button>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Add Staff Member</h4>
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Enter 8-digit staff code"
              maxLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
            />
          </div>
          <button
            onClick={searchStaff}
            disabled={loading || !searchCode.trim()}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 w-full sm:w-auto"
          >
            <Search className="h-4 w-4" />
            <span>{loading ? 'Searching...' : 'Search'}</span>
          </button>
        </div>
      </div>

      {/* Search Results */}
      {showAddForm && staffRegistrations.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Search Results</h4>
          {staffRegistrations.map((staff) => (
            <div key={staff.id} className="flex justify-between items-center p-4 border border-gray-200 rounded-lg">
              <div>
                <div className="font-medium text-gray-900">{staff.full_name}</div>
                <div className="text-sm text-gray-500">Mobile: {staff.mobile_number}</div>
                <div className="text-sm text-gray-500">Code: {staff.staff_code}</div>
              </div>
              <button
                onClick={() => assignStaff(staff.id)}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span>{saving ? 'Assigning...' : 'Assign'}</span>
              </button>
            </div>
          ))}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setShowAddForm(false)
                setStaffRegistrations([])
                setSearchCode('')
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Assigned Staff List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {assignedStaff.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No staff members assigned</p>
            <p className="text-sm text-gray-400">Search and assign staff members to this branch</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Staff Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mobile Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Staff Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {assignedStaff.map((staff) => (
                    <tr key={staff.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {staff.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {staff.mobile_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {staff.staff_code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(staff.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => removeStaff(staff.id)}
                          disabled={saving}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {assignedStaff.map((staff) => (
                <div key={staff.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {staff.full_name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {staff.mobile_number}
                      </p>
                      <p className="text-xs font-mono text-gray-600 mt-1">
                        Code: {staff.staff_code}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Assigned: {new Date(staff.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => removeStaff(staff.id)}
                      disabled={saving}
                      className="ml-3 p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md disabled:opacity-50"
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
    </div>
  )
}

