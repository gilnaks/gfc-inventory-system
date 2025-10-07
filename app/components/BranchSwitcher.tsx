'use client'
import { useState, useEffect } from 'react'
import { X, Building2, Key, Settings } from 'lucide-react'

interface SavedBranch {
  id: string
  name: string
  passcode: string
  brand_name: string
  created_at: string
}

interface BranchSwitcherProps {
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
  onOpenSettings: () => void
}

export function BranchSwitcher({ currentLocation, onBranchSwitch, onClose, onOpenSettings }: BranchSwitcherProps) {
  const [savedBranches, setSavedBranches] = useState<SavedBranch[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadSavedBranches()
  }, [])

  const loadSavedBranches = async () => {
    setLoading(true)
    try {
      // Load from localStorage
      const saved = localStorage.getItem('saved_branches')
      if (saved) {
        setSavedBranches(JSON.parse(saved))
      }
    } catch (error) {
      console.error('Error loading saved branches:', error)
    } finally {
      setLoading(false)
    }
  }

  const switchToBranch = (passcode: string) => {
    onBranchSwitch(passcode)
    onClose()
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading branches...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Switch Branch</h3>
              <p className="text-sm text-gray-600">Choose a saved branch to switch to</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Current Branch */}
          {currentLocation && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <Building2 className="h-5 w-5 text-blue-600" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">Currently Active</h4>
                  <p className="text-sm text-blue-700">
                    {currentLocation.name} • {currentLocation.brand?.name}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Saved Branches */}
          {savedBranches.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No saved branches</p>
              <p className="text-sm text-gray-400">Add branches in settings to switch between them quickly</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedBranches.map((branch) => (
                <div key={branch.passcode} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
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
                    <button
                      onClick={() => switchToBranch(branch.passcode)}
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Switch
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                onOpenSettings()
                onClose()
              }}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              <Settings className="h-4 w-4" />
              <span>Manage Saved Branches</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
