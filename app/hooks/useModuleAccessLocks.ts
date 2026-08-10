'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { ModuleAccessLock } from '../../lib/module-access'
import {
  fetchModuleAccessLocks,
  MODULE_ACCESS_LOCKS_TABLE,
} from '../../lib/module-access-service'

export type UseModuleAccessLocksResult = {
  locks: ModuleAccessLock[]
  loading: boolean
  refresh: () => Promise<void>
}

/**
 * Developer lock state for the whole dashboard. Loads once, then follows
 * realtime changes so a lock applies without a refresh; also refetches when the
 * tab regains focus in case the realtime socket dropped.
 */
export function useModuleAccessLocks(): UseModuleAccessLocksResult {
  const [locks, setLocks] = useState<ModuleAccessLock[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    const next = await fetchModuleAccessLocks()
    if (mountedRef.current) setLocks(next)
  }, [])

  useEffect(() => {
    mountedRef.current = true

    const load = async () => {
      await refresh()
      if (mountedRef.current) setLoading(false)
    }
    void load()

    const channel = supabase
      .channel('module-access-locks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: MODULE_ACCESS_LOCKS_TABLE },
        () => {
          void refresh()
        }
      )
      .subscribe()

    const onFocus = () => {
      void refresh()
    }
    window.addEventListener('focus', onFocus)

    return () => {
      mountedRef.current = false
      window.removeEventListener('focus', onFocus)
      void supabase.removeChannel(channel)
    }
  }, [refresh])

  return { locks, loading, refresh }
}
