import { supabase } from './supabase'
import {
  parseModuleAccessLockRows,
  type ModuleAccessLock,
} from './module-access'

export const MODULE_ACCESS_LOCKS_TABLE = 'module_access_locks'

export type ModuleAccessLockTarget = {
  moduleKey: string
  subTabKey?: string | null
}

/** Missing table (not migrated yet) must not break the dashboard. */
function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42P01') return true
  return /module_access_locks/i.test(error.message || '') && /does not exist/i.test(error.message || '')
}

export async function fetchModuleAccessLocks(): Promise<ModuleAccessLock[]> {
  const { data, error } = await supabase
    .from(MODULE_ACCESS_LOCKS_TABLE)
    .select('module_key, sub_tab_key, reason, locked_by')

  if (error) {
    if (isMissingTableError(error)) return []
    console.error('Error loading module access locks:', error)
    return []
  }

  return parseModuleAccessLockRows(data)
}

export async function lockTarget(
  target: ModuleAccessLockTarget,
  options?: { reason?: string | null; lockedBy?: string | null }
): Promise<void> {
  const subTabKey = target.subTabKey || null
  const { error } = await supabase.from(MODULE_ACCESS_LOCKS_TABLE).insert({
    module_key: target.moduleKey,
    sub_tab_key: subTabKey,
    reason: options?.reason?.trim() || null,
    locked_by: options?.lockedBy?.trim() || null,
  })

  // Unique index means an existing lock is already the desired state.
  if (error && error.code !== '23505') {
    console.error('Error locking module access target:', error)
    throw error
  }
}

export async function unlockTarget(target: ModuleAccessLockTarget): Promise<void> {
  const subTabKey = target.subTabKey || null
  let query = supabase
    .from(MODULE_ACCESS_LOCKS_TABLE)
    .delete()
    .eq('module_key', target.moduleKey)

  query = subTabKey ? query.eq('sub_tab_key', subTabKey) : query.is('sub_tab_key', null)

  const { error } = await query
  if (error) {
    console.error('Error unlocking module access target:', error)
    throw error
  }
}

export async function unlockAllTargets(): Promise<void> {
  const { error } = await supabase
    .from(MODULE_ACCESS_LOCKS_TABLE)
    .delete()
    .not('module_key', 'is', null)

  if (error) {
    console.error('Error clearing module access locks:', error)
    throw error
  }
}
