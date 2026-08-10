'use client'
import { useState, useEffect, useMemo } from 'react'
import { BrandSelector } from '../components/BrandSelector'
import { ProductManager } from '../components/ProductManager'
import { OrderManager } from '../components/OrderManager'
import { BranchManager } from '../components/BranchManager'
import { AccountingManager } from '../components/AccountingManager'
import { LogisticsManager } from '../components/LogisticsManager'
import { DSIRReportsViewer } from '../components/DSIRReportsViewer'
import { StaffManager } from '../components/StaffManager'
import { PayrollManager } from '../components/PayrollManager'
import { ReportsManager } from '../components/ReportsManager'
import { PurchasingManager, stashProcurementPoEdit } from '../components/PurchasingManager'
import { FactoryManager } from '../components/FactoryManager'
import { AttendanceManager } from '../components/AttendanceManager'
import { FleetTrackingManager } from '../components/FleetTrackingManager'
import { AdminCredentialsModal } from '../components/AdminCredentialsModal'
import { ModuleLockedNotice } from '../components/ModuleLockedNotice'
import { useModuleAccessLocks } from '../hooks/useModuleAccessLocks'
import {
  bypassesAccessLocks,
  getLockReason,
  getModuleLabel,
  isModuleLocked,
} from '../../lib/module-access'
import { BrandsProvider } from '../contexts/BrandsContext'
import { Brand, ACCOUNTING_ACTIVE_SUBTAB_KEY } from '../../lib/supabase'
import { isFactoryBrand, canAccessAccountingModule, canAccessPayrollModule, canAccessProcurementModule } from '../../lib/brand-roles'
import {
  Lock,
  LogOut,
  Unlock,
  Package,
  ShoppingCart,
  MapPin,
  Truck,
  FileText,
  Users,
  Calculator,
  BarChart3,
  ClipboardList,
  Factory,
  Clock,
  Receipt,
  Menu,
  Navigation,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  authenticateDashboardPasscode,
  type DashboardCredentialRole,
  type DashboardAuthIdentity,
} from '../../lib/admin-auth'
import {
  canAccessAccountingTab,
  canEditAccountingModule,
  canEditFactoryModule,
  canEditProcurementModule,
  getDashboardAccessTypeLabel,
  getDashboardExclusiveModuleLabel,
  getDashboardRoleColors,
  getDashboardRoleLabel,
  isAdminLevelRole,
  isDashboardRole,
  isGuestRole,
} from '../../lib/dashboard-roles'

const GUEST_RESTRICTED_TABS = ['accounting', 'payroll', 'reports', 'purchasing', 'attendance', 'fleet'] as const
const GFC_HIDDEN_TABS = ['products', 'orders', 'logistics', 'dsir', 'reports', 'branches'] as const
type DashboardTab = 'products' | 'orders' | 'branches' | 'accounting' | 'logistics' | 'dsir' | 'staff' | 'payroll' | 'reports' | 'purchasing' | 'factory' | 'attendance' | 'fleet'

type DashboardNavItem = {
  id: DashboardTab
  label: string
  icon: LucideIcon
  onSelect: () => void
  /** Developer-only: locked for everyone else, kept visible with a badge. */
  locked?: boolean
}

function isGfcHiddenTab(tab: DashboardTab): boolean {
  return (GFC_HIDDEN_TABS as readonly string[]).includes(tab)
}

function isGuestRestrictedTab(tab: string): tab is (typeof GUEST_RESTRICTED_TABS)[number] {
  return (GUEST_RESTRICTED_TABS as readonly string[]).includes(tab)
}

const headerControlClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-sm'

const headerButtonClass = `${headerControlClass} font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`

function UserSessionInfo({
  username,
  roleLabel,
  roleDotClass,
  onClick,
}: {
  username: string
  roleLabel: string
  roleDotClass: string
  onClick: () => void
}) {
  const displayName = username.trim() || 'Unknown'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${headerControlClass} min-w-0 max-w-[11rem] flex-col items-end gap-0.5 py-1.5 sm:max-w-none sm:flex-row sm:items-center sm:gap-1.5 sm:py-1.5 cursor-pointer transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
      title={`${displayName} · ${roleLabel}`}
      aria-label={`Signed in as ${displayName}, ${roleLabel}. Open GFC Admin Office.`}
    >
      <span className="truncate max-w-full text-right sm:text-left font-medium text-gray-900 leading-tight">
        {displayName}
      </span>
      <span className="hidden sm:block h-3 w-px shrink-0 bg-gray-200" aria-hidden />
      <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-gray-500 leading-tight">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${roleDotClass}`} aria-hidden />
        <span className="truncate">{roleLabel}</span>
      </span>
    </button>
  )
}

function LockedTabBadge() {
  return (
    <span
      className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
      title="Locked for other roles — visible to developers only"
    >
      Locked
    </span>
  )
}

export default function DashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [dashboardRole, setDashboardRole] = useState<DashboardCredentialRole | null>(null)
  const [isGuestSession, setIsGuestSession] = useState(false)
  const isAdminLevelUser = !!dashboardRole && isAdminLevelRole(dashboardRole)
  const canEditAccounting = canEditAccountingModule(dashboardRole)
  const canEditProcurement = canEditProcurementModule(dashboardRole)
  const canEditFactory = canEditFactoryModule(dashboardRole)
  const sessionRoleLabel = dashboardRole ? getDashboardRoleLabel(dashboardRole) : 'Unknown'
  const sessionRoleDotClass = getDashboardRoleColors(dashboardRole).dot
  const [passcode, setPasscode] = useState('')
  const [currentUsername, setCurrentUsername] = useState<string>('')
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [activeTab, setActiveTab] = useState<DashboardTab>('products')
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0)
  const [initialLoading, setInitialLoading] = useState(true)
  const [hasMounted, setHasMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showCredentialsModal, setShowCredentialsModal] = useState(false)
  const { locks: moduleAccessLocks, refresh: refreshModuleAccessLocks } = useModuleAccessLocks()
  const canBypassAccessLocks = bypassesAccessLocks(dashboardRole)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  // Check for existing session on component mount
  useEffect(() => {
    const initializeDashboard = async () => {
      setInitialLoading(true)
      
      const savedAuth = localStorage.getItem('dashboard_authenticated')
      const savedBrand = localStorage.getItem('dashboard_selected_brand')
      const savedTab = localStorage.getItem('dashboard_active_tab')
      
      const savedRole = localStorage.getItem('dashboard_role')
      const savedUsername = localStorage.getItem('dashboard_username')
      const guest = isDashboardRole(savedRole)
        ? isGuestRole(savedRole)
        : localStorage.getItem('dashboard_guest') === 'true'

      if (savedAuth === 'true') {
        setIsAuthenticated(true)
        if (isDashboardRole(savedRole)) {
          setDashboardRole(savedRole)
          setIsGuestSession(isGuestRole(savedRole))
        } else {
          setDashboardRole(null)
          setIsGuestSession(guest)
        }
        setCurrentUsername((savedUsername || savedRole || '').trim())
      }
      
      if (savedBrand) {
        try {
          setSelectedBrand(JSON.parse(savedBrand))
        } catch (error) {
          console.error('Error parsing saved brand:', error)
        }
      }
      
      const allTabs: DashboardTab[] = ['products', 'orders', 'branches', 'accounting', 'logistics', 'dsir', 'staff', 'payroll', 'reports', 'purchasing', 'factory', 'attendance', 'fleet']
      let tabToApply = savedTab
      if (savedTab === 'billing') {
        tabToApply = 'accounting'
        localStorage.setItem('dashboard_active_tab', 'accounting')
        localStorage.setItem(ACCOUNTING_ACTIVE_SUBTAB_KEY, 'receivables')
      }
      if (tabToApply && allTabs.includes(tabToApply as DashboardTab)) {
        const blockedForGuest = guest && isGuestRestrictedTab(tabToApply)
        const blockedAccounting =
          tabToApply === 'accounting' &&
          !(isDashboardRole(savedRole) && canAccessAccountingTab(savedRole))
        if (blockedForGuest || blockedAccounting) {
          setActiveTab('products')
          localStorage.setItem('dashboard_active_tab', 'products')
        } else {
          if (tabToApply === 'accounting') {
            localStorage.setItem(ACCOUNTING_ACTIVE_SUBTAB_KEY, 'receivables')
          }
          setActiveTab(tabToApply as DashboardTab)
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
    setDashboardRole(role)
    setIsGuestSession(isGuestRole(role))
    setCurrentUsername(normalizedUsername)
    localStorage.setItem('dashboard_authenticated', 'true')
    localStorage.setItem('dashboard_role', role)
    localStorage.setItem('dashboard_username', normalizedUsername)
    if (isGuestRole(role)) {
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
    setDashboardRole(null)
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

  /** Remount ProductManager only (stock/reserved) without remounting OrderManager. */
  const refreshInventory = () => {
    setInventoryRefreshKey(prev => prev + 1)
  }

  /** Accounting opens on Receivables; voucher prefill can override sub-tab after mount. */
  const openAccounting = () => {
    localStorage.setItem(ACCOUNTING_ACTIVE_SUBTAB_KEY, 'receivables')
    setActiveTab('accounting')
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
      setActiveTab(isFactoryBrand(selectedBrand) ? 'factory' : 'products')
    }
  }, [isGuestSession, activeTab, selectedBrand])

  useEffect(() => {
    if (activeTab === 'accounting' && !canAccessAccountingTab(dashboardRole)) {
      setActiveTab(isFactoryBrand(selectedBrand) ? 'factory' : 'products')
    }
  }, [activeTab, dashboardRole, selectedBrand])

  const isGfcMain = isFactoryBrand(selectedBrand)

  useEffect(() => {
    if (isGfcMain && isGfcHiddenTab(activeTab)) {
      setActiveTab('factory')
    }
    if (
      !isGfcMain &&
      (activeTab === 'factory' ||
        activeTab === 'attendance' ||
        activeTab === 'fleet' ||
        activeTab === 'accounting' ||
        activeTab === 'payroll' ||
        activeTab === 'purchasing')
    ) {
      setActiveTab('products')
    }
  }, [isGfcMain, activeTab])

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

  const navTabActiveClass =
    currentTheme === 'green'
      ? 'border-green-500 text-green-600'
      : currentTheme === 'red'
        ? 'border-red-500 text-red-600'
        : currentTheme === 'yellow'
          ? 'border-yellow-500 text-yellow-600'
          : 'border-blue-500 text-blue-600'

  const navTabClass = (tab: DashboardTab) =>
    `flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap shrink-0 transition-colors ${
      activeTab === tab
        ? navTabActiveClass
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`

  const mobileNavItemClass = (tab: DashboardTab) => {
    const active =
      currentTheme === 'green'
        ? 'bg-green-50 text-green-700'
        : currentTheme === 'red'
          ? 'bg-red-50 text-red-700'
          : currentTheme === 'yellow'
            ? 'bg-yellow-50 text-yellow-700'
            : 'bg-blue-50 text-blue-700'

    return `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      activeTab === tab ? active : 'text-gray-700 hover:bg-gray-50'
    }`
  }

  const dashboardNavItems = useMemo((): DashboardNavItem[] => {
    const selectTab = (tab: DashboardTab) => () => {
      setActiveTab(tab)
      setMobileMenuOpen(false)
    }

    const items: DashboardNavItem[] = []

    if (!isGfcMain) {
      items.push({ id: 'products', label: 'Inventory', icon: Package, onSelect: selectTab('products') })
      items.push({ id: 'orders', label: 'Orders', icon: ShoppingCart, onSelect: selectTab('orders') })
    }
    if (isGfcMain && canAccessAccountingTab(dashboardRole) && canAccessAccountingModule(selectedBrand)) {
      items.push({
        id: 'accounting',
        label: 'Accounting',
        icon: Receipt,
        onSelect: () => {
          localStorage.setItem(ACCOUNTING_ACTIVE_SUBTAB_KEY, 'receivables')
          setActiveTab('accounting')
          setMobileMenuOpen(false)
        },
      })
    }
    if (!isGfcMain) {
      items.push({ id: 'logistics', label: 'Logistics', icon: Truck, onSelect: selectTab('logistics') })
      items.push({ id: 'dsir', label: 'DSIR', icon: FileText, onSelect: selectTab('dsir') })
    }
    items.push({ id: 'staff', label: 'Staff', icon: Users, onSelect: selectTab('staff') })
    if (isGfcMain && !isGuestSession && canAccessPayrollModule(selectedBrand)) {
      items.push({ id: 'payroll', label: 'Payroll', icon: Calculator, onSelect: selectTab('payroll') })
    }
    if (isGfcMain && !isGuestSession) {
      items.push({ id: 'attendance', label: 'Attendance', icon: Clock, onSelect: selectTab('attendance') })
      items.push({ id: 'fleet', label: 'Fleet', icon: Navigation, onSelect: selectTab('fleet') })
    }
    if (!isGuestSession && !isGfcMain) {
      items.push({ id: 'reports', label: 'Reports', icon: BarChart3, onSelect: selectTab('reports') })
    }
    if (isGfcMain && !isGuestSession && canAccessProcurementModule(selectedBrand)) {
      items.push({ id: 'purchasing', label: 'Procurement', icon: ClipboardList, onSelect: selectTab('purchasing') })
    }
    if (isGfcMain) {
      items.push({ id: 'factory', label: 'Factory', icon: Factory, onSelect: selectTab('factory') })
    }
    if (!isGfcMain) {
      items.push({ id: 'branches', label: 'Branches', icon: MapPin, onSelect: selectTab('branches') })
    }

    // Developer locks: hidden for everyone, badged for developers.
    return items.reduce<DashboardNavItem[]>((visible, item) => {
      const locked = isModuleLocked(moduleAccessLocks, item.id)
      if (!locked) {
        visible.push(item)
      } else if (canBypassAccessLocks) {
        visible.push({ ...item, locked: true })
      }
      return visible
    }, [])
  }, [isGfcMain, dashboardRole, isGuestSession, selectedBrand, moduleAccessLocks, canBypassAccessLocks])

  const activeTabLocked = !canBypassAccessLocks && isModuleLocked(moduleAccessLocks, activeTab)

  useEffect(() => {
    if (!activeTabLocked) return
    const fallback = dashboardNavItems.find((item) => item.id !== activeTab)
    setActiveTab(fallback ? fallback.id : isFactoryBrand(selectedBrand) ? 'factory' : 'products')
  }, [activeTabLocked, activeTab, dashboardNavItems, selectedBrand])

  useEffect(() => {
    if (!mobileMenuOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    const handleResize = () => {
      if (window.innerWidth >= 640) setMobileMenuOpen(false)
    }

    window.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', handleResize)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', handleResize)
    }
  }, [mobileMenuOpen])

  if (!hasMounted) {
    return <div className="min-h-screen bg-gray-50" suppressHydrationWarning />
  }

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
            <p className="text-gray-600 mt-2">Enter your passcode to access the dashboard</p>
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
      <div className="sticky top-0 z-30 bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Mobile Layout */}
          <div
            className={`relative flex flex-col gap-2.5 sm:hidden ${
              mobileMenuOpen ? 'z-50' : ''
            }`}
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Package
                  className={`h-6 w-6 shrink-0 ${
                    currentTheme === 'green'
                      ? 'text-green-600'
                      : currentTheme === 'red'
                        ? 'text-red-600'
                        : currentTheme === 'yellow'
                          ? 'text-yellow-600'
                          : 'text-blue-600'
                  }`}
                  aria-hidden
                />
                <h1 className="truncate text-lg font-bold text-gray-900">GFC Portal</h1>
              </div>
              <UserSessionInfo
                username={currentUsername}
                roleLabel={sessionRoleLabel}
                roleDotClass={sessionRoleDotClass}
                onClick={() => setShowCredentialsModal(true)}
              />
            </div>

            <div className="flex items-center justify-between gap-3 min-h-9">
              <div className="min-w-0 flex-1">
                <BrandSelector
                  value={selectedBrand}
                  onBrandChange={setSelectedBrand}
                  excludeHeadquarters={isGuestSession}
                />
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" aria-hidden />
                ) : (
                  <Menu className="h-5 w-5" aria-hidden />
                )}
              </button>
            </div>

            {mobileMenuOpen ? (
              <button
                type="button"
                className="fixed inset-0 z-40 bg-black/30"
                aria-label="Close menu"
                onClick={() => setMobileMenuOpen(false)}
              />
            ) : null}

            <div
              className={`absolute left-0 right-0 top-full z-50 overflow-visible border-b border-gray-200 bg-white shadow-lg ${
                mobileMenuOpen ? '' : 'pointer-events-none invisible'
              }`}
              aria-hidden={!mobileMenuOpen}
            >
              <div className="flex max-h-[calc(100dvh-5.5rem)] flex-col gap-4 p-4">
                <nav
                  className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
                  aria-label="Dashboard sections"
                >
                  {dashboardNavItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={item.onSelect}
                        className={mobileNavItemClass(item.id)}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        <span>{item.label}</span>
                        {item.locked ? <LockedTabBadge /> : null}
                      </button>
                    )
                  })}
                </nav>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    handleLogout()
                  }}
                  className={`${headerButtonClass} w-full shrink-0 justify-center`}
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:flex sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <Package className={`h-8 w-8 shrink-0 ${
                currentTheme === 'green' ? 'text-green-600' :
                currentTheme === 'red' ? 'text-red-600' :
                currentTheme === 'yellow' ? 'text-yellow-600' :
                'text-blue-600'
              }`} />
              <h1 className="text-2xl font-bold text-gray-900">GFC Portal</h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <BrandSelector
                value={selectedBrand}
                onBrandChange={setSelectedBrand}
                excludeHeadquarters={isGuestSession}
              />
              <UserSessionInfo
                username={currentUsername}
                roleLabel={sessionRoleLabel}
                roleDotClass={sessionRoleDotClass}
                onClick={() => setShowCredentialsModal(true)}
              />
              <button type="button" onClick={handleLogout} className={headerButtonClass}>
                <LogOut className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-8">
        {/* App navigation tabs — desktop only */}
        <div className="mb-6 hidden sm:block">
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <nav
              className="flex flex-wrap -mb-px border-b border-gray-200 px-1 sm:px-2"
              aria-label="Dashboard sections"
            >
              {dashboardNavItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onSelect}
                    className={navTabClass(item.id)}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{item.label}</span>
                    {item.locked ? <LockedTabBadge /> : null}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border">
          {activeTabLocked ? (
            <ModuleLockedNotice
              title={getModuleLabel(activeTab)}
              reason={getLockReason(moduleAccessLocks, activeTab)}
            />
          ) : (
            <>
          {activeTab === 'products' && selectedBrand && (
            <div className="p-4 sm:p-6">
              <ProductManager
                key={inventoryRefreshKey}
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
              <OrderManager
                selectedBrand={selectedBrand}
                onOrderUpdate={refreshInventory}
                theme={currentTheme}
                currentUsername={currentUsername}
              />
            </div>
          )}
          
          {activeTab === 'branches' && selectedBrand && (
            <div className="p-4 sm:p-6">
              <BranchManager key={refreshKey} selectedBrand={selectedBrand} theme={currentTheme} guestMode={isGuestSession} />
            </div>
          )}
          
          {!selectedBrand && activeTab === 'branches' && (
            <div className="p-4 sm:p-6 text-center py-12">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Please select a brand to manage branches</p>
            </div>
          )}

          {activeTab === 'accounting' &&
            canAccessAccountingTab(dashboardRole) &&
            isGfcMain &&
            selectedBrand && (
            <div className="p-4 sm:p-6">
              <AccountingManager
                key={refreshKey}
                selectedBrand={selectedBrand}
                theme={currentTheme}
                currentUsername={currentUsername}
                currentRoleLabel={sessionRoleLabel}
                readOnlyMode={!canEditAccounting}
                onGoToProcurement={(poId) => {
                  stashProcurementPoEdit(poId)
                  setActiveTab('purchasing')
                }}
                accessLocks={moduleAccessLocks}
                bypassAccessLocks={canBypassAccessLocks}
              />
            </div>
          )}
          
          {!selectedBrand && activeTab === 'accounting' && canAccessAccountingTab(dashboardRole) && (
            <div className="p-4 sm:p-6 text-center py-12">
              <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Please select a brand to use accounting</p>
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

          {activeTab === 'payroll' && !isGuestSession && isGfcMain && selectedBrand && (
            <div className="p-4 sm:p-6">
              <PayrollManager
                selectedBrand={selectedBrand}
                theme={currentTheme}
                currentUsername={currentUsername}
              />
            </div>
          )}

          {!selectedBrand && activeTab === 'payroll' && !isGuestSession && (
            <div className="p-4 sm:p-6 text-center py-12">
              <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Please select a brand to view payroll</p>
            </div>
          )}

          {activeTab === 'attendance' && isGfcMain && !isGuestSession && (
            <div className="p-4 sm:p-6">
              <AttendanceManager theme={currentTheme} currentUsername={currentUsername} />
            </div>
          )}

          {activeTab === 'fleet' && isGfcMain && !isGuestSession && (
            <div className="p-4 sm:p-6">
              <FleetTrackingManager canManage={isAdminLevelUser} />
            </div>
          )}

          {activeTab === 'reports' && !isGuestSession && (
            <div className="p-4 sm:p-6">
              <ReportsManager
                selectedBrand={selectedBrand}
                theme={currentTheme}
                currentUsername={currentUsername}
                currentRoleLabel={sessionRoleLabel}
              />
            </div>
          )}

          {activeTab === 'purchasing' && isAdminLevelUser && isGfcMain && selectedBrand && (
            <div className="p-4 sm:p-6">
              <PurchasingManager
                selectedBrand={selectedBrand}
                theme={currentTheme}
                currentUsername={currentUsername}
                readOnlyMode={!canEditProcurement}
                onNavigateToAccounting={openAccounting}
                accessLocks={moduleAccessLocks}
                bypassAccessLocks={canBypassAccessLocks}
              />
            </div>
          )}

          {!selectedBrand && activeTab === 'purchasing' && isAdminLevelUser && (
            <div className="p-4 sm:p-6 text-center py-12">
              <ClipboardList className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Please select a brand to manage procurement</p>
            </div>
          )}

          {activeTab === 'factory' && selectedBrand && (
            <div className="p-4 sm:p-6">
              <FactoryManager
                key={refreshKey}
                selectedBrand={selectedBrand}
                theme={currentTheme}
                currentUsername={currentUsername}
                readOnlyMode={!canEditFactory}
                accessLocks={moduleAccessLocks}
                bypassAccessLocks={canBypassAccessLocks}
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
            </>
          )}
        </div>
      </div>
      </div>
      {showCredentialsModal ? (
        <AdminCredentialsModal
          onClose={() => setShowCredentialsModal(false)}
          sessionRole={dashboardRole}
          currentUsername={currentUsername}
          moduleAccessLocks={moduleAccessLocks}
          onModuleAccessLocksChanged={refreshModuleAccessLocks}
        />
      ) : null}
    </BrandsProvider>
  )
}
