import { supabase } from './supabase'
import {
  isDashboardRole,
  type DashboardRole,
} from './dashboard-roles'

export type DashboardCredentialRole = DashboardRole
export type DashboardAuthIdentity = {
  role: DashboardCredentialRole
  username: string
}

export function isDashboardCredentialRole(value: unknown): value is DashboardCredentialRole {
  return isDashboardRole(value)
}

function parseDashboardAuthIdentity(data: unknown): DashboardAuthIdentity | null {
  if (typeof data === 'string' && isDashboardCredentialRole(data)) {
    // Backward-compatible fallback for older RPC versions that return role only.
    return {
      role: data,
      username: data,
    }
  }

  if (!data || typeof data !== 'object') {
    return null
  }

  const maybeData = data as { role?: unknown; username?: unknown }
  if (!isDashboardCredentialRole(maybeData.role)) {
    return null
  }

  const normalizedUsername =
    typeof maybeData.username === 'string' && maybeData.username.trim().length > 0
      ? maybeData.username.trim()
      : maybeData.role

  return {
    role: maybeData.role,
    username: normalizedUsername,
  }
}

/** Dashboard login — returns identity from admin_credentials or null if invalid. */
export async function authenticateDashboardPasscode(
  passcode: string
): Promise<DashboardAuthIdentity | null> {
  const trimmed = passcode.trim()
  if (!trimmed) return null

  const { data, error } = await supabase.rpc('authenticate_dashboard_passcode', {
    input_passcode: trimmed,
  })

  if (error) {
    console.error('Error authenticating dashboard passcode:', error)
    throw error
  }

  return parseDashboardAuthIdentity(data)
}

/** Sensitive actions (edit/delete) — any admin-level role passcode; guest returns false. */
export async function validateAdminPassword(passcode: string): Promise<boolean> {
  const trimmed = passcode.trim()
  if (!trimmed) return false

  const { data, error } = await supabase.rpc('validate_admin_passcode', {
    input_passcode: trimmed,
  })

  if (error) {
    console.error('Error validating admin password:', error)
    throw error
  }

  return !!data
}

export type AdminCredentialSummary = {
  username: string
  role: string
  is_active: boolean
}

/** Usernames and roles only — no passcodes. */
export async function loadAdminCredentials(): Promise<AdminCredentialSummary[]> {
  const { data, error } = await supabase.rpc('get_admin_credentials')

  if (error) {
    console.error('Error loading admin credentials:', error)
    throw error
  }

  return (data || []).map((row: { username?: string; role?: string; is_active?: boolean }) => ({
    username: (row.username || '').trim(),
    role: (row.role || '').trim(),
    is_active: row.is_active !== false,
  }))
}
