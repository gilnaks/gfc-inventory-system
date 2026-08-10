'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Save, X, MapPin, Building2, Key, AlertCircle, Settings, RefreshCw } from 'lucide-react'
import { Modal } from './Modal'

interface SavedBranch {
  id: string
  name: string
  passcode: string
  brand_name: string
  created_at: string
}

interface OrderSettingsProps {
  currentLocation: {
    id: string
    name: string
    passkey: string
    brand?: {
      name: string
    }
  } | null
  onBranchSwitch: (passcode: string) => void
  onClose: () => void
}

export function OrderSettings({ currentLocation, onBranchSwitch, onClose }: OrderSettingsProps) {
  const [savedBranches, setSavedBranches] = useState<SavedBranch[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newBranchPasscode, setNewBranchPasscode] = useState('')

  useEffect(() => {
    loadSavedBranches()
  }, [])

  const loadSavedBranches = async () => {
    setLoading(true)
    try {
      // Load from localStorage for now (could be moved to database later)
      const saved = localStorage.getItem('saved_branches')
      if (saved) {
        setSavedBranches(JSON.parse(saved))
      }
    } catch (error) {
      console.error('Error loading saved branches:', error)
      setError('Failed to load saved branches')
    } finally {
      setLoading(false)
    }
  }

  const saveBranches = (branches: SavedBranch[]) => {
    localStorage.setItem('saved_branches', JSON.stringify(branches))
    setSavedBranches(branches)
  }

  const addBranch = async () => {
    if (!newBranchPasscode.trim()) {
      setError('Please enter a passcode')
      return
    }

    if (newBranchPasscode.length !== 6) {
      setError('Passcode must be 6 digits')
      return
    }

    setSaving(true)
    setError('')

    try {
      // Verify the passcode exists
      const { data: locationData, error } = await supabase
        .from('locations')
        .select('*, brand:brands(*)')
        .eq('passkey', newBranchPasscode)
        .single()

      if (error) throw error

      // Check if already saved
      const isAlreadySaved = savedBranches.some(branch => branch.passcode === newBranchPasscode)
      if (isAlreadySaved) {
        setError('This branch is already saved')
        return
      }

      // Add to saved branches
      const newBranch: SavedBranch = {
        id: locationData.id,
        name: locationData.name,
        passcode: newBranchPasscode,
        brand_name: locationData.brand?.name || 'Unknown Brand',
        created_at: new Date().toISOString()
      }

      const updatedBranches = [...savedBranches, newBranch]
      saveBranches(updatedBranches)

      setSuccess('Branch added successfully!')
      setNewBranchPasscode('')
      setShowAddForm(false)
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error adding branch:', error)
      setError('Invalid passcode or branch not found')
    } finally {
      setSaving(false)
    }
  }

  const removeBranch = (passcode: string) => {
    if (!confirm('Are you sure you want to remove this branch from your saved list?')) return

    const updatedBranches = savedBranches.filter(branch => branch.passcode !== passcode)
    saveBranches(updatedBranches)
    setSuccess('Branch removed successfully!')
    setTimeout(() => setSuccess(''), 3000)
  }

  const switchToBranch = (passcode: string) => {
    onBranchSwitch(passcode)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <Modal onClose={onClose} align="center">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Settings className="h-6 w-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
            <p className="text-sm text-gray-600">Manage your saved branch passcodes</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Current Branch Info */}
      {currentLocation && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Building2 className="h-5 w-5 text-blue-600" />
            <div>
              <h4 className="text-sm font-medium text-blue-900">Currently Active Branch</h4>
              <p className="text-sm text-blue-700">
                {currentLocation.name} • {currentLocation.brand?.name}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add New Branch */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-md font-semibold text-gray-900">Add New Branch</h4>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              <span>Add Branch</span>
            </button>
          )}
        </div>

        {showAddForm && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Branch Passcode
              </label>
              <input
                type="text"
                value={newBranchPasscode}
                onChange={(e) => setNewBranchPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit passcode"
                maxLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={addBranch}
                disabled={saving || !newBranchPasscode.trim()}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Adding...' : 'Add Branch'}</span>
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setNewBranchPasscode('')
                  setError('')
                }}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Saved Branches */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h4 className="text-md font-semibold text-gray-900">Saved Branches</h4>
          <p className="text-sm text-gray-600 mt-1">
            Click on a branch to switch to it quickly
          </p>
        </div>

        {savedBranches.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No saved branches</p>
            <p className="text-sm text-gray-400">Add branches to switch between them quickly</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {savedBranches.map((branch) => (
              <div key={branch.passcode} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm font-medium text-gray-900 truncate">
                        {branch.name}
                      </h5>
                      <p className="text-sm text-gray-500">
                        {branch.brand_name}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Key className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500 font-mono">
                          {branch.passcode}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => switchToBranch(branch.passcode)}
                      className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      title="Switch to this branch"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span className="hidden sm:inline">Switch</span>
                    </button>
                    <button
                      onClick={() => removeBranch(branch.passcode)}
                      className="flex items-center space-x-1 px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                      title="Remove branch"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
      </div>
    </Modal>
  )
}
