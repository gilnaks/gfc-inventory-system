'use client'
import { useState, useEffect } from 'react'
import { BrandSelector } from '../components/BrandSelector'
import { ProductManager } from '../components/ProductManager'
import { OrderManager } from '../components/OrderManager'
import { BranchManager } from '../components/BranchManager'
import { BillingManager } from '../components/BillingManager'
import { LogisticsManager } from '../components/LogisticsManager'
import { DSIRReportsViewer } from '../components/DSIRReportsViewer'
import { StaffManager } from '../components/StaffManager'
import { PayrollManager } from '../components/PayrollManager'
import { ReportsManager } from '../components/ReportsManager'
import { PurchasingManager } from '../components/PurchasingManager'
import { FactoryManager } from '../components/FactoryManager'
import { BrandsProvider } from '../contexts/BrandsContext'
import { Brand } from '../../lib/supabase'
import { Lock, Unlock, Package, ShoppingCart, MapPin, CreditCard, Truck, FileText, Users, Calculator, BarChart3, ClipboardList, Factory } from 'lucide-react'
import {
  authenticateDashboardPasscode,
  type DashboardCredentialRole,
  type DashboardAuthIdentity,
} from '../../lib/admin-auth'

const GUEST_RESTRICTED_TABS = ['billing', 'payroll', 'reports', 'purchasing'] as const
type DashboardTab = 'products' | 'orders' | 'branches' | 'billing' | 'logistics' | 'dsir' | 'staff' | 'payroll' | 'reports' | 'purchasing' | 'factory'

function isGuestRestrictedTab(tab: string): tab is (typeof GUEST_RESTRICTED_TABS)[number] {
  return (GUEST_RESTRICTED_TABS as readonly string[]).includes(tab)
}

export default function DashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isGuestSession, setIsGuestSession] = useState(false)
  const [passcode, setPasscode] = useState('')
  const [currentUsername, setCurrentUsername] = useState<string>('')
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [activeTab, setActiveTab] = useState<DashboardTab>('products')
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [initialLoading, setInitialLoading] = useState(true)

  // Check for existing session on component mount
  useEffect(() => {
    const initializeDashboard = async () => {
      setInitialLoading(true)
      
      const savedAuth = localStorage.getItem('dashboard_authenticated')
      const savedBrand = localStorage.getItem('dashboard_selected_brand')
      const savedTab = localStorage.getItem('dashboard_active_tab')
      
      const savedRole = localStorage.getItem('dashboard_role')
      const savedUsername = localStorage.getItem('dashboard_username')
      const guest =
        savedRole === 'guest' ||
        (savedRole !== 'admin' && localStorage.getItem('dashboard_guest') === 'true')

      if (savedAuth === 'true') {
        setIsAuthenticated(true)
        setIsGuestSession(guest)
        setCurrentUsername((savedUsername || savedRole || '').trim())
      }
      
      if (savedBrand) {
        try {
          setSelectedBrand(JSON.parse(savedBrand))
        } catch (error) {
          console.error('Error parsing saved brand:', error)
        }
      }
      
      const allTabs: DashboardTab[] = ['products', 'orders', 'branches', 'billing', 'logistics', 'dsir', 'staff', 'payroll', 'reports', 'purchasing', 'factory']
      if (savedTab && allTabs.includes(savedTab as DashboardTab)) {
        if (guest && isGuestRestrictedTab(savedTab)) {
          setActiveTab('products')
          localStorage.setItem('dashboard_active_tab', 'products')
        } else {
          setActiveTab(savedTab as DashboardTab)
        }
      }
      
      // Add a minimum loading time to prevent flash
      setTimeout(() => {
        setInitialLoading(false)
      }, 800)
    }

    initializeDashboard()
  }, [])

  const persistDashboardSession = ({ role, username }: DashboardAuthIdentity) => {
    const normalizedUsername = username.trim() || role
    setIsAuthenticated(true)
    setIsGuestSession(role === 'guest')
    setCurrentUsername(normalizedUsername)
    localStorage.setItem('dashboard_authenticated', 'true')
    localStorage.setItem('dashboard_role', role)
    localStorage.setItem('dashboard_username', normalizedUsername)
    if (role === 'guest') {
      localStorage.setItem('dashboard_guest', 'true')
    } else {
      localStorage.removeItem('dashboard_guest')
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const identity = await authenticateDashboardPasscode(passcode)

      if (identity) {
        persistDashboardSession(identity)
        setError('')
        setPasscode('')
      } else {
        setError('Invalid passcode. Please try again.')
        setPasscode('')
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('Authentication error. Please try again.')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setIsGuestSession(false)
    setPasscode('')
    setCurrentUsername('')
    setSelectedBrand(null)
    setActiveTab('products')
    setInitialLoading(false)
    localStorage.removeItem('dashboard_authenticated')
    localStorage.removeItem('dashboard_role')
    localStorage.removeItem('dashboard_guest')
    localStorage.removeItem('dashboard_username')
    localStorage.removeItem('dashboard_selected_brand')
    localStorage.removeItem('dashboard_active_tab')
  }

  const refreshData = () => {
    setRefreshKey(prev => prev + 1)
  }

  // Save selectedBrand to localStorage when it changes
  useEffect(() => {
    if (selectedBrand) {
      localStorage.setItem('dashboard_selected_brand', JSON.stringify(selectedBrand))
    } else {
      localStorage.removeItem('dashboard_selected_brand')
    }
  }, [selectedBrand])

  // Save activeTab to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('dashboard_active_tab', activeTab)
  }, [activeTab])

  useEffect(() => {
    if (isGuestSession && isGuestRestrictedTab(activeTab)) {
      setActiveTab('products')
    }
  }, [isGuestSession, activeTab])

  // Get brand-specific color theme
  const getBrandTheme = (brand: Brand | null) => {
    if (!brand) return 'blue'
    
    switch (brand.slug) {
      case 'mychoice':
        return 'green'
      case 'gelatofilipino':
        return 'red'
      case 'mang-sorbetes':
        return 'yellow'
      default:
        return 'blue'
    }
  }

  const currentTheme = getBrandTheme(selectedBrand)

  // Initial loading spinner
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 ${
            currentTheme === 'green' ? 'bg-green-100' :
            currentTheme === 'red' ? 'bg-red-100' :
            currentTheme === 'yellow' ? 'bg-yellow-100' :
            'bg-blue-100'
          }`}>
            <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${
              currentTheme === 'green' ? 'border-green-600' :
              currentTheme === 'red' ? 'border-red-600' :
              currentTheme === 'yellow' ? 'border-yellow-600' :
              'border-blue-600'
            }`}></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Dashboard</h2>
          <p className="text-gray-600">Please wait while we check your session...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <Lock className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
            <p className="text-gray-600 mt-2">Enter admin or guest passcode to access product management</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="passcode" className="block text-sm font-medium text-gray-700 mb-2">
                Passcode
              </label>
              <input
                type="password"
                id="passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg tracking-wider"
                placeholder="Enter 6-digit passcode"
                maxLength={10}
                required
              />
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}
            
            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Unlock className="h-5 w-5" />
              <span>Access Dashboard</span>
            </button>
          </form>
        </div>
        
        <div className="mt-8">
          <p className="text-center text-xs text-gray-500">© Gilnaks Food Corporation</p>
        </div>
      </div>
    )
  }

  return (
    <BrandsProvider>
      <div className="min-h-screen bg-gray-50">
      <style jsx>{`
        nav::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Mobile Layout */}
          <div className="flex sm:hidden flex-col gap-3">
            {/* Top row: Logo and Logout */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Package className={`h-6 w-6 ${
                  currentTheme === 'green' ? 'text-green-600' :
                  currentTheme === 'red' ? 'text-red-600' :
                  currentTheme === 'yellow' ? 'text-yellow-600' :
                  'text-blue-600'
                }`} />
                <h1 className="text-lg font-bold text-gray-900">GFC Portal</h1>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1 px-2 py-1 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <Lock className="h-4 w-4" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
            
            {/* Brand selection row */}
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-3">
                <BrandSelector onBrandChange={setSelectedBrand} />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{currentUsername || 'Unknown'}</span>
                </span>
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <div className={`w-1.5 h-1.5 rounded-full ${isGuestSession ? 'bg-amber-500' : 'bg-green-500'}`}></div>
                  <span>{isGuestSession ? 'Guest access' : 'Admin access'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:flex sm:justify-between sm:items-center">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Package className={`h-8 w-8 ${
                  currentTheme === 'green' ? 'text-green-600' :
                  currentTheme === 'red' ? 'text-red-600' :
                  currentTheme === 'yellow' ? 'text-yellow-600' :
                  'text-blue-600'
                }`} />
                <h1 className="text-2xl font-bold text-gray-900">GFC Portal</h1>
                {selectedBrand && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    currentTheme === 'green' ? 'bg-green-100 text-green-800' :
                    currentTheme === 'red' ? 'bg-red-100 text-red-800' :
                    currentTheme === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {selectedBrand.name}
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-gray-500">
                  <span className="font-medium text-gray-700">{currentUsername || 'Unknown'}</span>
                </span>
                <div className="flex items-center space-x-1 text-sm text-gray-500">
                  <div className={`w-2 h-2 rounded-full ${isGuestSession ? 'bg-amber-500' : 'bg-green-500'}`}></div>
                  <span>{isGuestSession ? 'Guest access' : 'Admin access'}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <BrandSelector onBrandChange={setSelectedBrand} />
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <Lock className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-8">
        {/* Tabs and Brand Selection */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Tabs */}
              <div className="flex-1 min-w-0">
                <div className="border-b border-gray-200">
                  <nav
                    className="-mb-px flex flex-wrap gap-x-3 gap-y-1 sm:gap-x-5 sm:gap-y-1 max-w-full"
                    aria-label="Dashboard sections"
                  >
              <button
                onClick={() => setActiveTab('products')}
                className={`py-2 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap shrink-0 ${
                  activeTab === 'products'
                    ? currentTheme === 'green' ? 'border-green-500 text-green-600' :
                      currentTheme === 'red' ? 'border-red-500 text-red-600' :
                      currentTheme === 'yellow' ? 'border-yellow-500 text-yellow-600' :
                      'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span>Inventory</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`py-2 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap shrink-0 ${
                  activeTab === 'orders'
                    ? currentTheme === 'green' ? 'border-green-500 text-green-600' :
                      currentTheme === 'red' ? 'border-red-500 text-red-600' :
                      currentTheme === 'yellow' ? 'border-yellow-500 text-yellow-600' :
                      'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span>Orders</span>
                </div>
              </button>
              {!isGuestSession && (
              <button
                onClick={() => setActiveTab('billing')}
                className={`py-2 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap shrink-0 ${
                  activeTab === 'billing'
                    ? currentTheme === 'green' ? 'border-green-500 text-green-600' :
                      currentTheme === 'red' ? 'border-red-500 text-red-600' :
                      currentTheme === 'yellow' ? 'border-yellow-500 text-yellow-600' :
                      'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span>Billing</span>
                </div>
              </button>
              )}
              <button
                onClick={() => setActiveTab('logistics')}
                className={`py-2 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap shrink-0 ${
                  activeTab === 'logistics'
                    ? currentTheme === 'green' ? 'border-green-500 text-green-600' :
                      currentTheme === 'red' ? 'border-red-500 text-red-600' :
                      currentTheme === 'yellow' ? 'border-yellow-500 text-yellow-600' :
                      'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span>Logistics</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('dsir')}
                className={`py-2 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap shrink-0 ${
                  activeTab === 'dsir'
                    ? currentTheme === 'green' ? 'border-green-500 text-green-600' :
                      currentTheme === 'red' ? 'border-red-500 text-red-600' :
                      currentTheme === 'yellow' ? 'border-yellow-500 text-yellow-600' :
                      'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span>DSIR</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('staff')}
                className={`py-2 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap shrink-0 ${
                  activeTab === 'staff'
                    ? currentTheme === 'green' ? 'border-green-500 text-green-600' :
                      currentTheme === 'red' ? 'border-red-500 text-red-600' :
                      currentTheme === 'yellow' ? 'border-yellow-500 text-yellow-600' :
                      'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span>Staff</span>
                </div>
              </button>
              {!isGuestSession && (
              <button
                onClick={() => setActiveTab('payroll')}
                className={`py-2 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap shrink-0 ${
                  activeTab === 'payroll'
                    ? currentTheme === 'green' ? 'border-green-500 text-green-600' :
                      currentTheme === 'red' ? 'border-red-500 text-red-600' :
                      currentTheme === 'yellow' ? 'border-yellow-500 text-yellow-600' :
                      'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Calculator className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span>Payroll</span>
                </div>
              </button>
              )}
              {!isGuestSession && (
              <button
                onClick={() => setActiveTab('reports')}
                className={`py-2 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap shrink-0 ${
                  activeTab === 'reports'
                    ? currentTheme === 'green' ? 'border-green-500 text-green-600' :
                      currentTheme === 'red' ? 'border-red-500 text-red-600' :
                      currentTheme === 'yellow' ? 'border-yellow-500 text-yellow-600' :
                      'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span>Reports</span>
                </div>
              </button>
              )}
              {!isGuestSession && (
              <button
                onClick={() => setActiveTab('purchasing')}
                className={`py-2 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap shrink-0 ${
                  activeTab === 'purchasing'
                    ? currentTheme === 'green' ? 'border-green-500 text-green-600' :
                      currentTheme === 'red' ? 'border-red-500 text-red-600' :
                      currentTheme === 'yellow' ? 'border-yellow-500 text-yellow-600' :
                      'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span>Procurement</span>
                </div>
              </button>
              )}
              <button
                onClick={() => setActiveTab('factory')}
                className={`py-2 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap shrink-0 ${
                  activeTab === 'factory'
                    ? currentTheme === 'green' ? 'border-green-500 text-green-600' :
                      currentTheme === 'red' ? 'border-red-500 text-red-600' :
                      currentTheme === 'yellow' ? 'border-yellow-500 text-yellow-600' :
                      'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Factory className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span>Factory</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('branches')}
                className={`py-2 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap shrink-0 ${
                  activeTab === 'branches'
                    ? currentTheme === 'green' ? 'border-green-500 text-green-600' :
                      currentTheme === 'red' ? 'border-red-500 text-red-600' :
                      currentTheme === 'yellow' ? 'border-yellow-500 text-yellow-600' :
                      'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span>Branches</span>
                </div>
              </button>
              </nav>
            </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border">
          {activeTab === 'products' && selectedBrand && (
            <div className="p-4 sm:p-6">
              <ProductManager
                key={refreshKey}
                selectedBrand={selectedBrand}
                theme={currentTheme}
                guestMode={isGuestSession}
                currentUsername={currentUsername}
                onNavigateToPurchasing={() => setActiveTab('purchasing')}
              />
            </div>
          )}
          
          {activeTab === 'orders' && (
            <div className="p-4 sm:p-6">
              <OrderManager key={refreshKey} selectedBrand={selectedBrand} onOrderUpdate={refreshData} theme={currentTheme} />
            </div>
          )}
          
          {activeTab === 'branches' && selectedBrand && (
            <div className="p-4 sm:p-6">
              <BranchManager key={refreshKey} selectedBrand={selectedBrand} theme={currentTheme} />
            </div>
          )}
          
          {!selectedBrand && activeTab === 'branches' && (
            <div className="p-4 sm:p-6 text-center py-12">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Please select a brand to manage branches</p>
            </div>
          )}

          {activeTab === 'billing' && !isGuestSession && selectedBrand && (
            <div className="p-4 sm:p-6">
              <BillingManager key={refreshKey} selectedBrand={selectedBrand} theme={currentTheme} />
            </div>
          )}
          
          {!selectedBrand && activeTab === 'billing' && !isGuestSession && (
            <div className="p-4 sm:p-6 text-center py-12">
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Please select a brand to manage billing</p>
            </div>
          )}

          {activeTab === 'logistics' && selectedBrand && (
            <div className="p-4 sm:p-6">
              <LogisticsManager key={refreshKey} selectedBrand={selectedBrand} theme={currentTheme} />
            </div>
          )}
          
          {!selectedBrand && activeTab === 'logistics' && (
            <div className="p-4 sm:p-6 text-center py-12">
              <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Please select a brand to manage logistics</p>
            </div>
          )}

          {activeTab === 'dsir' && selectedBrand && (
            <div className="p-4 sm:p-6">
              <DSIRReportsViewer
                selectedBrand={selectedBrand}
                theme={currentTheme}
                showEditItemsButton={!isGuestSession}
                showDeleteReportButton={!isGuestSession}
                showLast7DaysSummary={!isGuestSession}
                dsirViewerReadOnly={isGuestSession}
              />
            </div>
          )}
          
          {!selectedBrand && activeTab === 'dsir' && (
            <div className="p-4 sm:p-6 text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Please select a brand to view DSIR reports</p>
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="p-4 sm:p-6">
              <StaffManager theme={currentTheme} />
            </div>
          )}

          {activeTab === 'payroll' && !isGuestSession && (
            <div className="p-4 sm:p-6">
              <PayrollManager />
            </div>
          )}

          {activeTab === 'reports' && !isGuestSession && (
            <div className="p-4 sm:p-6">
              <ReportsManager selectedBrand={selectedBrand} theme={currentTheme} />
            </div>
          )}

          {activeTab === 'purchasing' && !isGuestSession && (
            <div className="p-4 sm:p-6">
              <PurchasingManager
                selectedBrand={selectedBrand}
                theme={currentTheme}
                currentUsername={currentUsername}
              />
            </div>
          )}

          {activeTab === 'factory' && selectedBrand && (
            <div className="p-4 sm:p-6">
              <FactoryManager
                key={refreshKey}
                selectedBrand={selectedBrand}
                theme={currentTheme}
                currentUsername={currentUsername}
              />
            </div>
          )}

          {!selectedBrand && activeTab === 'factory' && (
            <div className="p-4 sm:p-6 text-center py-12">
              <Factory className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Please select a brand to manage factory operations</p>
            </div>
          )}

          
          {!selectedBrand && activeTab === 'products' && (
            <div className="p-4 sm:p-6 text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Please select a brand to manage products</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </BrandsProvider>
  )
}
