import { supabase } from './supabase'

export type DashboardCredentialRole = 'admin' | 'guest'
export type DashboardAuthIdentity = {
  role: DashboardCredentialRole
  username: string
}

export function isDashboardCredentialRole(value: unknown): value is DashboardCredentialRole {
  return value === 'admin' || value === 'guest'
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

/** Sensitive actions (edit/delete) — admin role passcodes only. */
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
