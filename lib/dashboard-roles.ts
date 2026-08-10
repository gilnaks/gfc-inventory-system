/** Dashboard login roles stored in admin_credentials.role and localStorage dashboard_role. */
export const DASHBOARD_ROLES = [
  'admin',
  'guest',
  'developer',
  'accounting_manager',
  'procurement_manager',
  'production_manager',
] as const

export type DashboardRole = (typeof DASHBOARD_ROLES)[number]

export function isDashboardRole(value: unknown): value is DashboardRole {
  return typeof value === 'string' && (DASHBOARD_ROLES as readonly string[]).includes(value)
}

export function isGuestRole(role: DashboardRole): boolean {
  return role === 'guest'
}

/** Non-guest roles with full tab access (payroll, procurement, accounting tab, etc.). */
export function isAdminLevelRole(role: DashboardRole): boolean {
  return !isGuestRole(role)
}

export function canAccessAccountingTab(role: DashboardRole | null | undefined): boolean {
  return !!role && isAdminLevelRole(role)
}

/** Developer and module managers can edit; admin is view-only in these modules. */
export function canEditAccountingModule(role: DashboardRole | null | undefined): boolean {
  if (!role) return false
  return role === 'developer' || role === 'accounting_manager'
}

/** Reserved for developer-only behavior (e.g. skip admin password confirms). */
export function isDeveloperRole(role: DashboardRole | null | undefined): boolean {
  return role === 'developer'
}

export function canEditProcurementModule(role: DashboardRole | null | undefined): boolean {
  if (!role) return false
  return role === 'developer' || role === 'procurement_manager'
}

export function canEditFactoryModule(role: DashboardRole | null | undefined): boolean {
  if (!role) return false
  return role === 'developer' || role === 'production_manager'
}

/** Admin password modal — any admin-level role except guest. Developers skip via confirm dialog. */
export function canUseAdminPassword(role: DashboardRole | null | undefined): boolean {
  return !!role && isAdminLevelRole(role)
}

/** Developer skips the admin password modal and uses a normal confirm instead. */
export function skipsAdminPasswordConfirm(role: DashboardRole | null | undefined): boolean {
  return isDeveloperRole(role)
}

export function getDashboardRoleLabel(role: DashboardRole): string {
  switch (role) {
    case 'admin':
      return 'Admin'
    case 'guest':
      return 'Office Assistant'
    case 'developer':
      return 'Developer'
    case 'accounting_manager':
      return 'Accounting Manager'
    case 'procurement_manager':
      return 'Procurement Manager'
    case 'production_manager':
      return 'Factory Manager'
    default:
      return role
  }
}

/** Admin vs guest access tier for the office users modal. */
export function getDashboardAccessTypeLabel(role: DashboardRole): 'Admin' | 'Guest' {
  return isGuestRole(role) ? 'Guest' : 'Admin'
}

/** Module a role can edit; null when none applies. */
export function getDashboardExclusiveModuleLabel(role: DashboardRole): string | null {
  switch (role) {
    case 'guest':
    case 'admin':
      return null
    case 'developer':
      return 'Unrestricted'
    case 'accounting_manager':
      return 'Accounting'
    case 'procurement_manager':
      return 'Procurement'
    case 'production_manager':
      return 'Factory'
    default:
      return null
  }
}

/** Visual scope for access tags and the session status dot. */
export type DashboardRoleScope =
  | 'guest'
  | 'admin'
  | 'accounting'
  | 'procurement'
  | 'production'
  | 'unrestricted'

export type DashboardRoleColorClasses = {
  dot: string
  tag: string
}

const DASHBOARD_SCOPE_COLORS: Record<DashboardRoleScope, DashboardRoleColorClasses> = {
  guest: {
    dot: 'bg-amber-500',
    tag: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  admin: {
    dot: 'bg-green-500',
    tag: 'border-green-200 bg-green-50 text-green-800',
  },
  accounting: {
    dot: 'bg-blue-500',
    tag: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  procurement: {
    dot: 'bg-violet-500',
    tag: 'border-violet-200 bg-violet-50 text-violet-800',
  },
  production: {
    dot: 'bg-orange-500',
    tag: 'border-orange-200 bg-orange-50 text-orange-800',
  },
  unrestricted: {
    dot: 'bg-gray-600',
    tag: 'border-gray-300 bg-gray-100 text-gray-800',
  },
}

export function getDashboardRoleScope(role: DashboardRole | null | undefined): DashboardRoleScope {
  switch (role) {
    case 'guest':
      return 'guest'
    case 'accounting_manager':
      return 'accounting'
    case 'procurement_manager':
      return 'procurement'
    case 'production_manager':
      return 'production'
    case 'admin':
    case 'developer':
      return 'admin'
    default:
      return 'admin'
  }
}

export function getDashboardRoleScopeColors(scope: DashboardRoleScope): DashboardRoleColorClasses {
  return DASHBOARD_SCOPE_COLORS[scope]
}

export function getDashboardRoleColors(
  role: DashboardRole | null | undefined
): DashboardRoleColorClasses {
  return getDashboardRoleScopeColors(getDashboardRoleScope(role))
}

/** Module-only scope for the second tag in the office users modal. */
export function getDashboardModuleScope(role: DashboardRole): DashboardRoleScope | null {
  switch (role) {
    case 'guest':
    case 'admin':
      return null
    case 'developer':
      return 'unrestricted'
    case 'accounting_manager':
      return 'accounting'
    case 'procurement_manager':
      return 'procurement'
    case 'production_manager':
      return 'production'
    default:
      return null
  }
}

export function getModuleReadOnlyBanner(module: 'accounting' | 'procurement' | 'factory'): string {
  switch (module) {
    case 'accounting':
      return 'View-only access — accounting changes require Accounting Manager role.'
    case 'procurement':
      return 'View-only access — procurement changes require Procurement Manager role.'
    case 'factory':
      return 'View-only access — factory changes require Factory Manager role.'
  }
}
