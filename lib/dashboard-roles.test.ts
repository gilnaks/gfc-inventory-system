import {
  canAccessAccountingTab,
  canEditAccountingModule,
  canEditFactoryModule,
  canEditProcurementModule,
  getDashboardAccessTypeLabel,
  getDashboardExclusiveModuleLabel,
  getDashboardRoleColors,
  getDashboardRoleLabel,
  getDashboardRoleScope,
  isAdminLevelRole,
  isDashboardRole,
  isDeveloperRole,
  isGuestRole,
  skipsAdminPasswordConfirm,
} from './dashboard-roles'

describe('dashboard-roles', () => {
  it('recognizes all roles', () => {
    expect(isDashboardRole('admin')).toBe(true)
    expect(isDashboardRole('developer')).toBe(true)
    expect(isDashboardRole('accounting_manager')).toBe(true)
    expect(isDashboardRole('procurement_manager')).toBe(true)
    expect(isDashboardRole('production_manager')).toBe(true)
    expect(isDashboardRole('guest')).toBe(true)
    expect(isDashboardRole('unknown')).toBe(false)
  })

  it('treats only guest as non-admin-level', () => {
    expect(isGuestRole('guest')).toBe(true)
    expect(isAdminLevelRole('developer')).toBe(true)
    expect(isAdminLevelRole('accounting_manager')).toBe(true)
    expect(isAdminLevelRole('guest')).toBe(false)
  })

  it('allows admin-level roles to open accounting tab', () => {
    expect(canAccessAccountingTab('procurement_manager')).toBe(true)
    expect(canAccessAccountingTab('guest')).toBe(false)
    expect(canAccessAccountingTab(null)).toBe(false)
  })

  it('restricts module edit buttons by manager role', () => {
    expect(canEditAccountingModule('accounting_manager')).toBe(true)
    expect(canEditAccountingModule('procurement_manager')).toBe(false)
    expect(canEditAccountingModule('developer')).toBe(true)
    expect(canEditAccountingModule('admin')).toBe(false)

    expect(canEditProcurementModule('procurement_manager')).toBe(true)
    expect(canEditProcurementModule('accounting_manager')).toBe(false)
    expect(canEditProcurementModule('developer')).toBe(true)
    expect(canEditProcurementModule('admin')).toBe(false)

    expect(canEditFactoryModule('production_manager')).toBe(true)
    expect(canEditFactoryModule('procurement_manager')).toBe(false)
    expect(canEditFactoryModule('developer')).toBe(true)
    expect(canEditFactoryModule('admin')).toBe(false)
  })

  it('lets developer skip admin password confirms', () => {
    expect(isDeveloperRole('developer')).toBe(true)
    expect(skipsAdminPasswordConfirm('developer')).toBe(true)
    expect(skipsAdminPasswordConfirm('admin')).toBe(false)
    expect(skipsAdminPasswordConfirm('guest')).toBe(false)
  })

  it('labels roles for the session badge', () => {
    expect(getDashboardRoleLabel('developer')).toBe('Developer')
    expect(getDashboardRoleLabel('accounting_manager')).toBe('Accounting Manager')
    expect(getDashboardRoleLabel('guest')).toBe('Office Assistant')
  })

  it('maps access tier and exclusive module for the office users modal', () => {
    expect(getDashboardAccessTypeLabel('guest')).toBe('Guest')
    expect(getDashboardAccessTypeLabel('admin')).toBe('Admin')
    expect(getDashboardAccessTypeLabel('accounting_manager')).toBe('Admin')

    expect(getDashboardExclusiveModuleLabel('guest')).toBeNull()
    expect(getDashboardExclusiveModuleLabel('admin')).toBeNull()
    expect(getDashboardExclusiveModuleLabel('developer')).toBe('Unrestricted')
    expect(getDashboardExclusiveModuleLabel('accounting_manager')).toBe('Accounting')
    expect(getDashboardExclusiveModuleLabel('procurement_manager')).toBe('Procurement')
    expect(getDashboardExclusiveModuleLabel('production_manager')).toBe('Factory')
  })

  it('assigns scope colors for access tags and the session dot', () => {
    expect(getDashboardRoleScope('guest')).toBe('guest')
    expect(getDashboardRoleScope('admin')).toBe('admin')
    expect(getDashboardRoleScope('accounting_manager')).toBe('accounting')
    expect(getDashboardRoleScope('procurement_manager')).toBe('procurement')
    expect(getDashboardRoleScope('production_manager')).toBe('production')

    expect(getDashboardRoleColors('guest').dot).toBe('bg-amber-500')
    expect(getDashboardRoleColors('admin').dot).toBe('bg-green-500')
    expect(getDashboardRoleColors('accounting_manager').dot).toBe('bg-blue-500')
    expect(getDashboardRoleColors('procurement_manager').dot).toBe('bg-violet-500')
    expect(getDashboardRoleColors('production_manager').dot).toBe('bg-orange-500')
  })
})
