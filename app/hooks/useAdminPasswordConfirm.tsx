'use client'

import { useCallback, useRef, useState } from 'react'
import { Lock } from 'lucide-react'
import { validateAdminPassword } from '../../lib/admin-auth'
import { isDashboardRole, isDeveloperRole } from '../../lib/dashboard-roles'
import { Modal } from '../components/Modal'

export type AdminPasswordConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
}

function getSessionDashboardRole() {
  if (typeof window === 'undefined') return null
  const saved = localStorage.getItem('dashboard_role')
  return isDashboardRole(saved) ? saved : null
}

/** Strip password prompts so developers see a normal confirm dialog. */
function developerConfirmText(opts: AdminPasswordConfirmOptions): string {
  const cleaned = opts.message
    .replace(/\s*Enter admin password[^\n]*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (cleaned) {
    if (/are you sure/i.test(cleaned) || cleaned.includes('?')) {
      return cleaned
    }
    return `${opts.title}\n\n${cleaned}`
  }

  return `${opts.title}\n\nAre you sure you want to continue?`
}

export function useAdminPasswordConfirm() {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<AdminPasswordConfirmOptions | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [validating, setValidating] = useState(false)
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null)

  const close = useCallback((confirmed: boolean) => {
    resolveRef.current?.(confirmed)
    resolveRef.current = null
    setOpen(false)
    setOptions(null)
    setPassword('')
    setError('')
    setValidating(false)
  }, [])

  const requestAdminPassword = useCallback((opts: AdminPasswordConfirmOptions) => {
    // Developer role: skip admin password — use a normal browser confirm
    if (isDeveloperRole(getSessionDashboardRole())) {
      return Promise.resolve(window.confirm(developerConfirmText(opts)))
    }

    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setOptions(opts)
      setPassword('')
      setError('')
      setValidating(false)
      setOpen(true)
    })
  }, [])

  const handleConfirm = async () => {
    if (!password.trim()) {
      setError('Enter the admin password.')
      return
    }

    setValidating(true)
    setError('')
    try {
      const valid = await validateAdminPassword(password)
      if (!valid) {
        setError('Invalid admin password.')
        setValidating(false)
        return
      }
      close(true)
    } catch {
      setError('Could not verify password. Please try again.')
      setValidating(false)
    }
  }

  const AdminPasswordModal =
    open && options ? (
      <Modal onClose={() => close(false)} zIndex={100} align="center">
        <div
          className="w-full max-w-md rounded-lg bg-white shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-password-dialog-title"
        >
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Lock className="h-5 w-5 text-blue-600" />
              </div>
              <h3
                id="admin-password-dialog-title"
                className="text-lg font-semibold text-gray-900"
              >
                {options.title}
              </h3>
            </div>
            <p className="mt-3 text-sm text-gray-600 whitespace-pre-line">{options.message}</p>
          </div>

          <div className="px-6 py-4 space-y-3">
            <label htmlFor="admin-password-confirm" className="block text-sm font-medium text-gray-700">
              Admin password
            </label>
            <input
              id="admin-password-confirm"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleConfirm()
                }
                if (e.key === 'Escape') close(false)
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="Enter admin passcode"
              autoFocus
              disabled={validating}
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={() => close(false)}
              disabled={validating}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={validating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {validating ? 'Verifying…' : options.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>
    ) : null

  return { requestAdminPassword, AdminPasswordModal }
}
