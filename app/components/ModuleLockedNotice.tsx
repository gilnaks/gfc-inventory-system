'use client'

import { Lock } from 'lucide-react'

type ModuleLockedNoticeProps = {
  title?: string
  reason?: string | null
}

/** Shown when a locked module or sub-tab is reached directly. */
export function ModuleLockedNotice({ title, reason }: ModuleLockedNoticeProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
        <Lock className="h-5 w-5 text-amber-700" aria-hidden />
      </span>
      <h3 className="text-sm font-semibold text-gray-900">
        {title ? `${title} is temporarily unavailable` : 'This section is temporarily unavailable'}
      </h3>
      <p className="max-w-sm text-sm text-gray-600">
        {reason || 'A developer locked this area while it is being worked on. Check back shortly.'}
      </p>
    </div>
  )
}
