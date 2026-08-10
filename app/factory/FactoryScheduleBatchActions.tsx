'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FactoryScheduleItem } from '../../lib/factory-schedule'
import {
  cancelProductionBatch,
  checkBatchCanStart,
  completeProductionBatch,
  fetchCompletedBatchesForSchedule,
  fetchInProgressBatchForSchedule,
  formatBatchMaterialShortageMessage,
  type FactoryBatchListItem,
  startProductionBatch,
  type BatchBomLine,
  type BatchMaterialShortage,
} from '../../lib/factory-batch-production'
import { Play, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

function getFactoryRequestedBy(): string {
  if (typeof window === 'undefined') return 'Factory'
  return (localStorage.getItem('dashboard_username') || '').trim() || 'Factory'
}

function formatQty(qty: number) {
  if (!Number.isFinite(qty)) return '0'
  return Number.isInteger(qty)
    ? String(qty)
    : qty.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

interface FactoryScheduleBatchActionsProps {
  item: FactoryScheduleItem
  workDate: string
  onChanged?: () => void | Promise<void>
  compact?: boolean
  /** When provided, skips per-row batch lookup (factory page prefetch). */
  inProgressBatchId?: string | null
  completedBatchesForSchedule?: FactoryBatchListItem[]
}

export function FactoryScheduleBatchActions({
  item,
  workDate,
  onChanged,
  compact = false,
  inProgressBatchId,
  completedBatchesForSchedule,
}: FactoryScheduleBatchActionsProps) {
  const [checkingStart, setCheckingStart] = useState(true)
  const [acting, setActing] = useState(false)
  const [inProgressId, setInProgressId] = useState<string | null>(inProgressBatchId ?? null)
  const [unitsRemaining, setUnitsRemaining] = useState(0)
  const [bomLines, setBomLines] = useState<BatchBomLine[]>([])
  const [canStart, setCanStart] = useState(false)
  const [shortages, setShortages] = useState<BatchMaterialShortage[]>([])
  const [completedBatches, setCompletedBatches] = useState<FactoryBatchListItem[]>(
    completedBatchesForSchedule ?? []
  )

  const applyCanStartCheck = useCallback(async () => {
    const check = await checkBatchCanStart(item, workDate, 1)
    setUnitsRemaining(check.unitsRemaining)
    setBomLines(check.bomLines)
    setCanStart(check.ok)
    setShortages(check.shortages)
  }, [item, workDate])

  const refreshFromServer = useCallback(async () => {
    setCheckingStart(true)
    try {
      const [inProg, completedRows] = await Promise.all([
        fetchInProgressBatchForSchedule(item.schedule_id, workDate),
        fetchCompletedBatchesForSchedule(item.schedule_id, workDate),
      ])
      const inProgId = inProg?.id ?? null
      setInProgressId(inProgId)
      setCompletedBatches(completedRows)

      if (inProgId) return

      await applyCanStartCheck()
    } finally {
      setCheckingStart(false)
    }
  }, [item.schedule_id, workDate, applyCanStartCheck])

  useEffect(() => {
    if (acting) return
    setInProgressId(inProgressBatchId ?? null)
    setCompletedBatches(completedBatchesForSchedule ?? [])
  }, [acting, inProgressBatchId, completedBatchesForSchedule])

  useEffect(() => {
    if (acting) return
    if (inProgressBatchId) {
      setCheckingStart(false)
      return
    }
    void refreshFromServer()
  }, [acting, inProgressBatchId, refreshFromServer])

  const batchFinished =
    !inProgressId && (unitsRemaining <= 0 || (completedBatches.length > 0 && !canStart && !checkingStart))

  const notifyParentAndRefresh = useCallback(async () => {
    await onChanged?.()
    await refreshFromServer()
  }, [onChanged, refreshFromServer])

  const handleStart = async () => {
    if (!confirm(`Start batch for ${item.product_name}? Materials will be deducted from the factory floor.`)) {
      return
    }
    setActing(true)
    try {
      const result = await startProductionBatch({
        item,
        workDate,
        units: 1,
        startedBy: getFactoryRequestedBy(),
      })
      if (result.ok === false) {
        alert(result.message)
        return
      }
      await notifyParentAndRefresh()
    } finally {
      setActing(false)
    }
  }

  const handleComplete = async () => {
    if (!inProgressId) return
    setActing(true)
    try {
      const result = await completeProductionBatch(inProgressId, {
        postedBy: getFactoryRequestedBy(),
      })
      if (result.ok === false) {
        alert(result.message || 'Could not complete batch')
        return
      }
      setInProgressId(null)
      await notifyParentAndRefresh()
    } finally {
      setActing(false)
    }
  }

  const handleCancel = async () => {
    if (!inProgressId) return
    if (!confirm('Cancel this batch and return materials to the floor inventory?')) return
    setActing(true)
    try {
      const result = await cancelProductionBatch(inProgressId)
      if (result.ok === false) {
        alert(result.message || 'Could not cancel batch')
        return
      }
      setInProgressId(null)
      await notifyParentAndRefresh()
    } finally {
      setActing(false)
    }
  }

  const shellClass = compact
    ? 'flex flex-col w-full min-h-[4.5rem] justify-between'
    : 'flex flex-col w-full min-h-[3.5rem]'

  if (checkingStart && !inProgressId) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Batch…
      </span>
    )
  }

  if (batchFinished) {
    const latestBatch = completedBatches[0]
    const producedCount = Math.max(item.produced, latestBatch?.units ?? 0)

    return (
      <div className={shellClass}>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full w-fit">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Batch completed
        </span>
        <p className="mt-1.5 text-[10px] text-gray-600 text-right tabular-nums">
          {producedCount} produced
          {latestBatch?.completed_at
            ? ` · ${new Date(latestBatch.completed_at).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}`
            : null}
        </p>
      </div>
    )
  }

  if (inProgressId) {
    return (
      <div className={shellClass}>
        <div className="flex flex-wrap justify-end gap-2 mt-auto">
          <button
            type="button"
            disabled={acting}
            onClick={handleComplete}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 touch-manipulation"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {acting ? 'Completing…' : 'Complete'}
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={handleCancel}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 touch-manipulation"
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={shellClass}>
      <div className="space-y-1">
        {completedBatches.length > 0 ? (
          <p className="text-[10px] text-emerald-700 max-w-[220px]">
            {completedBatches.length} completed
          </p>
        ) : null}
        {bomLines.length > 0 ? (
          <p className="text-[10px] text-gray-500 max-w-[220px]">
            Floor BOM per unit:{' '}
            {bomLines
              .slice(0, 2)
              .map((l) => `${formatQty(l.qty_per_unit)} ${l.unit}`)
              .join(', ')}
            {bomLines.length > 2 ? '…' : ''}
          </p>
        ) : checkingStart ? null : (
          <p className="text-[10px] text-gray-500">No factory-floor BOM — batch tracking only</p>
        )}
        {shortages.length > 0 ? (
          <p className="text-[10px] text-red-700 max-w-[240px] leading-snug">
            {shortages.some(
              (s) => s.reason === 'not_opened' || s.reason === 'not_linked_to_factory'
            )
              ? 'Open required materials on the floor first.'
              : 'Not enough on floor:'}{' '}
            {shortages
              .slice(0, 2)
              .map((s) => {
                if (s.reason === 'not_opened') return `${s.material_name} (not opened)`
                if (s.reason === 'not_linked_to_factory') return `${s.material_name} (not on floor)`
                return `${s.material_name} (${formatQty(s.available)}/${formatQty(s.required)})`
              })
              .join(', ')}
            {shortages.length > 2 ? '…' : ''}
          </p>
        ) : null}
      </div>
      <div className="flex justify-end pt-2 mt-auto">
        <button
          type="button"
          disabled={acting || !canStart || checkingStart}
          onClick={handleStart}
          title={
            !canStart && shortages.length
              ? formatBatchMaterialShortageMessage(shortages)
              : undefined
          }
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-indigo-700 text-white hover:bg-indigo-800 disabled:opacity-50 touch-manipulation shrink-0"
        >
          <Play className="h-3.5 w-3.5" />
          {acting ? 'Starting…' : 'Start batch'}
        </button>
      </div>
    </div>
  )
}
