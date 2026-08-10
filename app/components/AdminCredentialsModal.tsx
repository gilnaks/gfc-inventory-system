'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { loadAdminCredentials, type AdminCredentialSummary } from '../../lib/admin-auth'
import {
  getDashboardAccessTypeLabel,
  getDashboardExclusiveModuleLabel,
  getDashboardModuleScope,
  getDashboardRoleLabel,
  getDashboardRoleScopeColors,
  isDashboardRole,
  type DashboardRole,
  type DashboardRoleScope,
} from '../../lib/dashboard-roles'
import { bypassesAccessLocks, type ModuleAccessLock } from '../../lib/module-access'
import { LockAccessSettings } from './LockAccessSettings'
import { Modal } from './Modal'

function AccessTag({
  label,
  scope,
}: {
  label: string
  scope: DashboardRoleScope
}) {
  const colors = getDashboardRoleScopeColors(scope)

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${colors.tag}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colors.dot}`} aria-hidden />
      {label}
    </span>
  )
}

function AccessCell({ role }: { role: string }) {
  if (!isDashboardRole(role)) return <span className="text-gray-400">—</span>

  const access = getDashboardAccessTypeLabel(role)
  const module = getDashboardExclusiveModuleLabel(role)
  const moduleScope = getDashboardModuleScope(role)
  const accessScope: DashboardRoleScope = access === 'Guest' ? 'guest' : 'admin'

  return (
    <div className="flex flex-nowrap items-center gap-1.5">
      <AccessTag label={access} scope={accessScope} />
      {module && moduleScope ? <AccessTag label={module} scope={moduleScope} /> : null}
    </div>
  )
}

export function AdminCredentialsModal({
  onClose,
  sessionRole,
  currentUsername,
  moduleAccessLocks = [],
  onModuleAccessLocksChanged,
}: {
  onClose: () => void
  sessionRole?: DashboardRole | null
  currentUsername?: string
  moduleAccessLocks?: ModuleAccessLock[]
  onModuleAccessLocksChanged?: () => void | Promise<void>
}) {
  const [rows, setRows] = useState<AdminCredentialSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void loadAdminCredentials()
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load users')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Modal onClose={onClose} align="center">
      <div className="mx-auto flex w-full max-w-xl flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl max-h-[min(90vh,640px)]">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">GFC Admin Office</h2>
            <p className="mt-1 text-sm text-gray-600">Portal users and access</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">Loading users…</p>
          ) : error ? (
            <p className="px-5 py-8 text-center text-sm text-red-600">{error}</p>
          ) : rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">No users found.</p>
          ) : (
            <table className="w-full min-w-[480px] text-sm">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">User</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">Role</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, index) => (
                  <tr key={`${row.username}-${row.role}-${index}`} className={row.is_active ? '' : 'text-gray-400'}>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {row.username || '—'}
                      {!row.is_active ? (
                        <span className="ml-1.5 text-xs font-normal text-gray-400">(inactive)</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {isDashboardRole(row.role) ? getDashboardRoleLabel(row.role) : row.role || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <AccessCell role={row.role} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {bypassesAccessLocks(sessionRole) ? (
            <LockAccessSettings
              locks={moduleAccessLocks}
              currentUsername={currentUsername}
              onChanged={onModuleAccessLocksChanged}
            />
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
