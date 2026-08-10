'use client'

import type { ReactNode } from 'react'

export function ModuleReadOnlyBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {message}
    </div>
  )
}

/** Renders children only when module edit actions are allowed for the current role. */
export function ModuleEditGate({
  canEdit,
  children,
}: {
  canEdit: boolean
  children: ReactNode
}) {
  if (!canEdit) return null
  return <>{children}</>
}
