import { isDeveloperRole, type DashboardRole } from './dashboard-roles'

/**
 * Developer "Lock Access": temporarily hide a dashboard module, or a single
 * sub-tab within one, while it is being worked on. Locks live in
 * module_access_locks (a row means locked) and apply to every role except
 * developer, which bypasses them and sees a "Locked" badge instead.
 *
 * UI-level gating for development only — not a security boundary.
 */
export type ModuleAccessLock = {
  moduleKey: string
  /** null locks the whole module (and all of its sub-tabs). */
  subTabKey: string | null
  reason: string | null
  lockedBy: string | null
}

export type LockableSubTab = {
  key: string
  label: string
}

export type LockableModule = {
  key: string
  label: string
  subTabs: LockableSubTab[]
}

/**
 * Mirrors the dashboard nav in app/dashboard/page.tsx and the sub-tab lists in
 * AccountingManager / PurchasingManager / FactoryManager. Only modules whose
 * sub-tabs are actually enforced declare them here.
 */
export const LOCKABLE_MODULES: LockableModule[] = [
  { key: 'analytics', label: 'Analytics', subTabs: [] },
  { key: 'products', label: 'Inventory', subTabs: [] },
  { key: 'orders', label: 'Orders', subTabs: [] },
  {
    key: 'accounting',
    label: 'Accounting',
    subTabs: [
      { key: 'receivables', label: 'Receivables' },
      { key: 'payables', label: 'Payables' },
      { key: 'supplier_invoices', label: 'Supplier Invoices' },
      { key: 'vouchers', label: 'Vouchers' },
      { key: 'journal', label: 'Journal' },
      { key: 'general_ledger', label: 'General Ledger' },
      { key: 'financial_reports', label: 'Financial Reports' },
      { key: 'reconciliation', label: 'Reconciliation' },
      { key: 'intercompany', label: 'Transfers' },
      { key: 'fixed_assets', label: 'Fixed Assets' },
    ],
  },
  {
    key: 'purchasing',
    label: 'Procurement',
    subTabs: [
      { key: 'raw_materials', label: 'Materials Inventory' },
      { key: 'fixed_assets', label: 'Fixed Assets Inventory' },
      { key: 'intercompany', label: 'Transfers' },
      { key: 'purchase_orders', label: 'Purchase Orders' },
      { key: 'receiving_reports', label: 'Receiving Reports' },
      { key: 'requisitions', label: 'Requisitions' },
      { key: 'suppliers', label: 'Suppliers' },
      { key: 'transactions', label: 'Transactions' },
    ],
  },
  {
    key: 'factory',
    label: 'Factory',
    subTabs: [
      { key: 'schedule', label: 'Production Schedule' },
      { key: 'bom', label: 'Bill of Materials' },
      { key: 'components', label: 'Components' },
      { key: 'history', label: 'Batch History' },
      { key: 'requests', label: 'Material Requests' },
      { key: 'intercompany', label: 'Transfers' },
      { key: 'inventory', label: 'Inventory' },
    ],
  },
  { key: 'logistics', label: 'Logistics', subTabs: [] },
  { key: 'dsir', label: 'DSIR', subTabs: [] },
  { key: 'staff', label: 'Staff', subTabs: [] },
  { key: 'payroll', label: 'Payroll', subTabs: [] },
  { key: 'attendance', label: 'Attendance', subTabs: [] },
  { key: 'fleet', label: 'Fleet', subTabs: [] },
  { key: 'reports', label: 'Reports', subTabs: [] },
  { key: 'branches', label: 'Branches', subTabs: [] },
]

/** Developers keep access to locked areas so they can work on them. */
export function bypassesAccessLocks(role: DashboardRole | null | undefined): boolean {
  return isDeveloperRole(role)
}

export function getLockableModule(moduleKey: string): LockableModule | undefined {
  return LOCKABLE_MODULES.find((m) => m.key === moduleKey)
}

export function getModuleLabel(moduleKey: string): string {
  return getLockableModule(moduleKey)?.label || moduleKey
}

export function getSubTabLabel(moduleKey: string, subTabKey: string): string {
  return (
    getLockableModule(moduleKey)?.subTabs.find((t) => t.key === subTabKey)?.label || subTabKey
  )
}

/** Exact row match — used by the developer panel to render toggle state. */
export function hasLock(
  locks: ModuleAccessLock[],
  moduleKey: string,
  subTabKey: string | null = null
): boolean {
  return locks.some((lock) => lock.moduleKey === moduleKey && lock.subTabKey === (subTabKey ?? null))
}

export function isModuleLocked(locks: ModuleAccessLock[], moduleKey: string): boolean {
  return hasLock(locks, moduleKey, null)
}

/** A sub-tab is locked by its own row or by its parent module being locked. */
export function isSubTabLocked(
  locks: ModuleAccessLock[],
  moduleKey: string,
  subTabKey: string
): boolean {
  return isModuleLocked(locks, moduleKey) || hasLock(locks, moduleKey, subTabKey)
}

export function findLock(
  locks: ModuleAccessLock[],
  moduleKey: string,
  subTabKey: string | null = null
): ModuleAccessLock | undefined {
  return locks.find((lock) => lock.moduleKey === moduleKey && lock.subTabKey === (subTabKey ?? null))
}

/** Reason shown on the locked notice; falls back to the module-level reason. */
export function getLockReason(
  locks: ModuleAccessLock[],
  moduleKey: string,
  subTabKey: string | null = null
): string | null {
  if (subTabKey) {
    const subTabLock = findLock(locks, moduleKey, subTabKey)
    if (subTabLock?.reason) return subTabLock.reason
  }
  return findLock(locks, moduleKey, null)?.reason || null
}

/** Drops locked entries unless the viewer bypasses locks. */
export function filterLockedSubTabs<T extends { id: string }>(
  tabs: T[],
  locks: ModuleAccessLock[],
  moduleKey: string,
  bypass: boolean
): T[] {
  if (bypass) return tabs
  return tabs.filter((tab) => !isSubTabLocked(locks, moduleKey, tab.id))
}

export function visibleSubTabKeys(
  keys: string[],
  locks: ModuleAccessLock[],
  moduleKey: string,
  bypass: boolean
): string[] {
  if (bypass) return keys
  return keys.filter((key) => !isSubTabLocked(locks, moduleKey, key))
}

/** True when the module itself is locked, or every known sub-tab is locked. */
export function isModuleFullyLocked(locks: ModuleAccessLock[], moduleKey: string): boolean {
  if (isModuleLocked(locks, moduleKey)) return true
  const subTabs = getLockableModule(moduleKey)?.subTabs || []
  if (subTabs.length === 0) return false
  return subTabs.every((tab) => hasLock(locks, moduleKey, tab.key))
}

/** Supabase row shape -> ModuleAccessLock. Unknown module keys are dropped. */
export function parseModuleAccessLockRows(
  rows: Array<{
    module_key?: string | null
    sub_tab_key?: string | null
    reason?: string | null
    locked_by?: string | null
  }> | null
): ModuleAccessLock[] {
  if (!rows) return []
  const locks: ModuleAccessLock[] = []
  for (const row of rows) {
    const moduleKey = (row.module_key || '').trim()
    if (!moduleKey) continue
    const module = getLockableModule(moduleKey)
    if (!module) continue
    const subTabKey = (row.sub_tab_key || '').trim() || null
    if (subTabKey && !module.subTabs.some((t) => t.key === subTabKey)) continue
    locks.push({
      moduleKey,
      subTabKey,
      reason: (row.reason || '').trim() || null,
      lockedBy: (row.locked_by || '').trim() || null,
    })
  }
  return locks
}
