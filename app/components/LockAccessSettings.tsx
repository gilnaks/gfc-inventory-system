'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Lock, Unlock } from 'lucide-react'
import {
  hasLock,
  isModuleLocked,
  LOCKABLE_MODULES,
  type ModuleAccessLock,
} from '../../lib/module-access'
import { lockTarget, unlockAllTargets, unlockTarget } from '../../lib/module-access-service'

type LockAccessSettingsProps = {
  locks: ModuleAccessLock[]
  currentUsername?: string
  /** Refetch after a change so every open dashboard picks it up. */
  onChanged?: () => void | Promise<void>
}

function targetId(moduleKey: string, subTabKey?: string | null) {
  return subTabKey ? `${moduleKey}:${subTabKey}` : moduleKey
}

export function LockAccessSettings({ locks, currentUsername, onChanged }: LockAccessSettingsProps) {
  const [expanded, setExpanded] = useState<string[]>([])
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const lockedCount = locks.length

  const toggleExpanded = (moduleKey: string) => {
    setExpanded((prev) =>
      prev.includes(moduleKey) ? prev.filter((key) => key !== moduleKey) : [...prev, moduleKey]
    )
  }

  const runAction = async (id: string, action: () => Promise<void>) => {
    setPending(id)
    setError(null)
    try {
      await action()
      await onChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lock')
    } finally {
      setPending(null)
    }
  }

  const toggleTarget = (moduleKey: string, subTabKey: string | null, locked: boolean) => {
    const id = targetId(moduleKey, subTabKey)
    void runAction(id, async () => {
      if (locked) {
        await unlockTarget({ moduleKey, subTabKey })
        return
      }
      await lockTarget(
        { moduleKey, subTabKey },
        { reason: reasons[moduleKey] || null, lockedBy: currentUsername || null }
      )
    })
  }

  return (
    <div className="min-w-[480px] max-w-full border-t border-gray-200 bg-gray-50 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Lock className="h-4 w-4 text-amber-600" />
            Lock Access
          </h3>
          <p className="mt-0.5 text-xs text-gray-600">
            Temporarily hide modules or sub-tabs from everyone while you work on them. Developers
            still see them, marked <span className="font-medium">Locked</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runAction('__all__', unlockAllTargets)}
          disabled={lockedCount === 0 || pending === '__all__'}
          className="shrink-0 rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === '__all__' ? 'Unlocking…' : `Unlock all${lockedCount ? ` (${lockedCount})` : ''}`}
        </button>
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      <div className="mt-3 divide-y divide-gray-200 rounded border border-gray-200 bg-white">
        {LOCKABLE_MODULES.map((module) => {
          const moduleLocked = isModuleLocked(locks, module.key)
          const isExpanded = expanded.includes(module.key)
          const lockedSubTabs = module.subTabs.filter((tab) => hasLock(locks, module.key, tab.key))
          const moduleId = targetId(module.key)

          return (
            <div key={module.key}>
              <div className="flex items-center gap-2 px-3 py-2">
                {module.subTabs.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(module.key)}
                    className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    aria-label={isExpanded ? `Collapse ${module.label}` : `Expand ${module.label}`}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                ) : (
                  <span className="w-5" aria-hidden />
                )}

                <span className="flex-1 text-sm font-medium text-gray-900">
                  {module.label}
                  {moduleLocked ? (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                      Locked
                    </span>
                  ) : lockedSubTabs.length > 0 ? (
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      {lockedSubTabs.length} of {module.subTabs.length} tabs locked
                    </span>
                  ) : null}
                </span>

                <button
                  type="button"
                  onClick={() => toggleTarget(module.key, null, moduleLocked)}
                  disabled={pending === moduleId}
                  className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium disabled:opacity-60 ${
                    moduleLocked
                      ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {pending === moduleId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : moduleLocked ? (
                    <Unlock className="h-3.5 w-3.5" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}
                  {moduleLocked ? 'Unlock' : 'Lock'}
                </button>
              </div>

              {isExpanded && module.subTabs.length > 0 ? (
                <div className="border-t border-gray-100 bg-gray-50 px-3 py-2">
                  <input
                    type="text"
                    value={reasons[module.key] || ''}
                    onChange={(event) =>
                      setReasons((prev) => ({ ...prev, [module.key]: event.target.value }))
                    }
                    placeholder="Reason (optional) — shown to developers"
                    className="mb-2 w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-400 focus:outline-none"
                  />

                  {moduleLocked ? (
                    <p className="mb-2 text-xs text-amber-700">
                      The whole module is locked, so all of its tabs are hidden.
                    </p>
                  ) : null}

                  <div className="grid gap-1 sm:grid-cols-2">
                    {module.subTabs.map((tab) => {
                      const subTabId = targetId(module.key, tab.key)
                      const subTabLocked = hasLock(locks, module.key, tab.key)

                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => toggleTarget(module.key, tab.key, subTabLocked)}
                          disabled={moduleLocked || pending === subTabId}
                          className={`flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-left text-xs ${
                            subTabLocked
                              ? 'border-amber-300 bg-amber-50 text-amber-800'
                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                          } ${moduleLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                          <span>{tab.label}</span>
                          {pending === subTabId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : subTabLocked ? (
                            <Lock className="h-3.5 w-3.5" />
                          ) : (
                            <Unlock className="h-3.5 w-3.5 text-gray-300" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <p className="mt-2 text-[11px] text-gray-500">
        Locks are global and apply immediately. They gate the UI for development only, not the data
        itself.
      </p>
    </div>
  )
}
