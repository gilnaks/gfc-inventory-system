'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit, Trash2, Save, X, Users, Key } from 'lucide-react'

interface StaffCode {
  id: string
  location_id: string
  staff_name: string
  staff_code: string
  is_active: boolean
  created_at: string
  updated_at: string
  staff_assignments?: StaffAssignment[]
}

interface StaffAssignment {
  id: string
  staff_code_id: string
  brand_id: string
  location_id: string
  brand: {
    id: string
    name: string
  }
  location: {
    id: string
    name: string
  }
}

interface StaffCodeManagerProps {
  locationId: string
  locationName: string
}

export function StaffCodeManager({ locationId, locationName }: StaffCodeManagerProps) {
  const [staffCodes, setStaffCodes] = useState<StaffCode[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAssignments, setShowAssignments] = useState<string | null>(null)
  const [availableBrands, setAvailableBrands] = useState<any[]>([])
  const [availableLocations, setAvailableLocations] = useState<any[]>([])

  const [newStaff, setNewStaff] = useState({
    staff_name: '',
    staff_code: '',
    is_active: true
  })

  const [editStaff, setEditStaff] = useState({
    staff_name: '',
    staff_code: '',
    is_active: true
  })

  useEffect(() => {
    loadStaffCodes()
    loadAvailableBrands()
  }, [locationId])

  const loadAvailableBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('name')

      if (error) throw error
      setAvailableBrands(data || [])
    } catch (error) {
      console.error('Error loading brands:', error)
    }
  }

  const loadAvailableLocations = async (brandId: string) => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('brand_id', brandId)
        .order('name')

      if (error) throw error
      setAvailableLocations(data || [])
    } catch (error) {
      console.error('Error loading locations:', error)
    }
  }

  const loadStaffCodes = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('staff_codes')
        .select(`
          *,
          staff_assignments(
            *,
            brand:brands(*),
            location:locations(*)
          )
        `)
        .eq('location_id', locationId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setStaffCodes(data || [])
    } catch (error) {
      console.error('Error loading staff codes:', error)
      setError('Failed to load staff codes')
    } finally {
      setLoading(false)
    }
  }

  const addStaffAssignment = async (staffCodeId: string, brandId: string, locationId: string) => {
    setSaving(true)
    setError('')

    try {
      const { error } = await supabase
        .from('staff_assignments')
        .insert({
          staff_code_id: staffCodeId,
          brand_id: brandId,
          location_id: locationId
        })

      if (error) throw error

      setSuccess('Staff assignment added successfully!')
      loadStaffCodes()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error adding staff assignment:', error)
      setError('Failed to add staff assignment')
    } finally {
      setSaving(false)
    }
  }

  const removeStaffAssignment = async (assignmentId: string) => {
    setSaving(true)
    setError('')

    try {
      const { error } = await supabase
        .from('staff_assignments')
        .delete()
        .eq('id', assignmentId)

      if (error) throw error

      setSuccess('Staff assignment removed successfully!')
      loadStaffCodes()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error removing staff assignment:', error)
      setError('Failed to remove staff assignment')
    } finally {
      setSaving(false)
    }
  }

  const generateStaffCode = () => {
    // Generate a random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    setNewStaff({ ...newStaff, staff_code: code })
  }

  const addStaffCode = async () => {
    if (!newStaff.staff_name.trim() || !newStaff.staff_code.trim()) {
      setError('Please fill in all fields')
      return
    }

    if (newStaff.staff_code.length !== 6) {
      setError('Staff code must be 6 digits')
      return
    }

    setSaving(true)
    setError('')

    try {
      const { error } = await supabase
        .from('staff_codes')
        .insert({
          location_id: locationId,
          staff_name: newStaff.staff_name.trim(),
          staff_code: newStaff.staff_code,
          is_active: newStaff.is_active
        })

      if (error) throw error

      setSuccess('Staff code added successfully!')
      setNewStaff({ staff_name: '', staff_code: '', is_active: true })
      setShowAddForm(false)
      loadStaffCodes()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error adding staff code:', error)
      setError('Failed to add staff code. Code may already exist.')
    } finally {
      setSaving(false)
    }
  }

  const updateStaffCode = async (id: string) => {
    if (!editStaff.staff_name.trim() || !editStaff.staff_code.trim()) {
      setError('Please fill in all fields')
      return
    }

    if (editStaff.staff_code.length !== 6) {
      setError('Staff code must be 6 digits')
      return
    }

    setSaving(true)
    setError('')

    try {
      const { error } = await supabase
        .from('staff_codes')
        .update({
          staff_name: editStaff.staff_name.trim(),
          staff_code: editStaff.staff_code,
          is_active: editStaff.is_active
        })
        .eq('id', id)

      if (error) throw error

      setSuccess('Staff code updated successfully!')
      setEditingId(null)
      loadStaffCodes()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error updating staff code:', error)
      setError('Failed to update staff code. Code may already exist.')
    } finally {
      setSaving(false)
    }
  }

  const deleteStaffCode = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff code?')) return

    setSaving(true)
    setError('')

    try {
      const { error } = await supabase
        .from('staff_codes')
        .delete()
        .eq('id', id)

      if (error) throw error

      setSuccess('Staff code deleted successfully!')
      loadStaffCodes()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error deleting staff code:', error)
      setError('Failed to delete staff code')
    } finally {
      setSaving(false)
    }
  }

  const toggleStaffStatus = async (id: string, currentStatus: boolean) => {
    setSaving(true)
    setError('')

    try {
      const { error } = await supabase
        .from('staff_codes')
        .update({ is_active: !currentStatus })
        .eq('id', id)

      if (error) throw error

      setSuccess(`Staff code ${!currentStatus ? 'activated' : 'deactivated'} successfully!`)
      loadStaffCodes()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error updating staff status:', error)
      setError('Failed to update staff status')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (staff: StaffCode) => {
    setEditStaff({
      staff_name: staff.staff_name,
      staff_code: staff.staff_code,
      is_active: staff.is_active
    })
    setEditingId(staff.id)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditStaff({ staff_name: '', staff_code: '', is_active: true })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading staff codes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="h-6 w-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Staff Code Management</h3>
            <p className="text-sm text-gray-600">{locationName}</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span>Add Staff Code</span>
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6 border">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Add New Staff Code</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff Name</label>
              <input
                type="text"
                value={newStaff.staff_name}
                onChange={(e) => setNewStaff({ ...newStaff, staff_name: e.target.value })}
                placeholder="Enter staff name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff Code</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newStaff.staff_code}
                  onChange={(e) => setNewStaff({ ...newStaff, staff_code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  placeholder="6-digit code"
                  maxLength={6}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={generateStaffCode}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  <Key className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex items-end space-x-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newStaff.is_active}
                  onChange={(e) => setNewStaff({ ...newStaff, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Active</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <button
              onClick={() => {
                setShowAddForm(false)
                setNewStaff({ staff_name: '', staff_code: '', is_active: true })
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={addStaffCode}
              disabled={saving}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Adding...' : 'Add Staff Code'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Staff Codes List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {staffCodes.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No staff codes found</p>
            <p className="text-sm text-gray-400">Add your first staff code to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Staff Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Staff Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assignments
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {staffCodes.map((staff) => (
                  <tr key={staff.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingId === staff.id ? (
                        <input
                          type="text"
                          value={editStaff.staff_name}
                          onChange={(e) => setEditStaff({ ...editStaff, staff_name: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        <div className="text-sm font-medium text-gray-900">{staff.staff_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingId === staff.id ? (
                        <input
                          type="text"
                          value={editStaff.staff_code}
                          onChange={(e) => setEditStaff({ ...editStaff, staff_code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                          maxLength={6}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                        />
                      ) : (
                        <div className="text-sm font-mono text-gray-900">{staff.staff_code}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingId === staff.id ? (
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={editStaff.is_active}
                            onChange={(e) => setEditStaff({ ...editStaff, is_active: e.target.checked })}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            {editStaff.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </label>
                      ) : (
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          staff.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {staff.is_active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(staff.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setShowAssignments(showAssignments === staff.id ? null : staff.id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        {staff.staff_assignments?.length || 0} assignments
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {editingId === staff.id ? (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => updateStaffCode(staff.id)}
                            disabled={saving}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => startEdit(staff)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => toggleStaffStatus(staff.id, staff.is_active)}
                            disabled={saving}
                            className={`${
                              staff.is_active 
                                ? 'text-yellow-600 hover:text-yellow-900' 
                                : 'text-green-600 hover:text-green-900'
                            } disabled:opacity-50`}
                          >
                            {staff.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => deleteStaffCode(staff.id)}
                            disabled={saving}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Staff Assignment Management */}
      {showAssignments && (
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">
            Staff Assignments - {staffCodes.find(s => s.id === showAssignments)?.staff_name}
          </h4>
          
          <div className="space-y-4">
            {/* Current Assignments */}
            <div>
              <h5 className="text-md font-medium text-gray-700 mb-2">Current Assignments</h5>
              {staffCodes.find(s => s.id === showAssignments)?.staff_assignments?.length === 0 ? (
                <p className="text-gray-500 text-sm">No assignments yet</p>
              ) : (
                <div className="space-y-2">
                  {staffCodes.find(s => s.id === showAssignments)?.staff_assignments?.map((assignment) => (
                    <div key={assignment.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="font-medium">{assignment.brand.name}</span>
                        <span className="text-gray-500 mx-2">•</span>
                        <span className="text-gray-600">{assignment.location.name}</span>
                      </div>
                      <button
                        onClick={() => removeStaffAssignment(assignment.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Assignment */}
            <div>
              <h5 className="text-md font-medium text-gray-700 mb-2">Add New Assignment</h5>
              <AssignmentForm
                staffCodeId={showAssignments}
                availableBrands={availableBrands}
                availableLocations={availableLocations}
                onBrandChange={loadAvailableLocations}
                onAdd={addStaffAssignment}
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={() => setShowAssignments(null)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
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
    </div>
  )
}

// Assignment Form Component
function AssignmentForm({ 
  staffCodeId, 
  availableBrands, 
  availableLocations, 
  onBrandChange, 
  onAdd 
}: {
  staffCodeId: string
  availableBrands: any[]
  availableLocations: any[]
  onBrandChange: (brandId: string) => void
  onAdd: (staffCodeId: string, brandId: string, locationId: string) => void
}) {
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBrand || !selectedLocation) return

    setLoading(true)
    try {
      await onAdd(staffCodeId, selectedBrand, selectedLocation)
      setSelectedBrand('')
      setSelectedLocation('')
    } catch (error) {
      console.error('Error adding assignment:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex space-x-4">
      <div className="flex-1">
        <select
          value={selectedBrand}
          onChange={(e) => {
            setSelectedBrand(e.target.value)
            setSelectedLocation('')
            onBrandChange(e.target.value)
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          required
        >
          <option value="">Select brand</option>
          {availableBrands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <select
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          required
          disabled={!selectedBrand}
        >
          <option value="">Select location</option>
          {availableLocations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={loading || !selectedBrand || !selectedLocation}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Adding...' : 'Add'}
      </button>
    </form>
  )
}
