'use client'

import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import type { Brand } from '../../lib/supabase'
import {
  loadAccountingPreflightStatus,
  type AccountingPreflightStatus,
} from '../../lib/accounting-preflight'
import { totalUnpostedCount } from '../../lib/accounting-preflight-checks'

export type GoLiveUnpostedTarget =
  | 'receivables'
  | 'vouchers_payment'
  | 'vouchers_petty'
  | 'payables'
  | 'backfill'

type UnpostedChip = {
  id: string
  count: number
  short: string
  title: string
  target: GoLiveUnpostedTarget
}

export function AccountingGoLiveChecklist({
  selectedBrand,
  onOpenDefaultAccounts,
  onNavigateUnposted,
}: {
  selectedBrand: Brand | null
  onOpenDefaultAccounts?: () => void
  onNavigateUnposted?: (target: GoLiveUnpostedTarget) => void
}) {
  const brandId = selectedBrand?.id || ''
  const [status, setStatus] = useState<AccountingPreflightStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    try {
      setStatus(await loadAccountingPreflightStatus(brandId))
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!brandId) return null

  if (loading) {
    return <p className="text-xs text-gray-500">Checking setup…</p>
  }

  if (!status) return null

  const unpostedTotal = totalUnpostedCount(status.unposted)
  const chipCandidates: Array<UnpostedChip | false> = [
    status.unposted.ordersRevenue > 0 && {
      id: 'orders-rev',
      count: status.unposted.ordersRevenue,
      short: 'Order revenue',
      title: 'Orders missing revenue journal',
      target: 'receivables',
    },
    status.unposted.ordersCash > 0 && {
      id: 'orders-cash',
      count: status.unposted.ordersCash,
      short: 'Order cash',
      title: 'Orders missing cash journal',
      target: 'receivables',
    },
    status.unposted.ordersCogs > 0 && {
      id: 'orders-cogs',
      count: status.unposted.ordersCogs,
      short: 'Order COGS',
      title: 'Orders missing COGS journal',
      target: 'receivables',
    },
    status.unposted.paymentVouchers > 0 && {
      id: 'pv',
      count: status.unposted.paymentVouchers,
      short: 'Paid PVs',
      title: 'Paid payment vouchers missing journal',
      target: 'vouchers_payment',
    },
    status.unposted.pettyCashVouchers > 0 && {
      id: 'pcv',
      count: status.unposted.pettyCashVouchers,
      short: 'Liquidated PCVs',
      title: 'Liquidated petty cash vouchers missing journal',
      target: 'vouchers_petty',
    },
    status.unposted.deliveryReceipts > 0 && {
      id: 'rr',
      count: status.unposted.deliveryReceipts,
      short: 'Receiving',
      title: 'Receiving reports missing journal',
      target: 'backfill',
    },
    status.unposted.materialMovements > 0 && {
      id: 'mat',
      count: status.unposted.materialMovements,
      short: 'Materials',
      title: 'Material movements missing journal',
      target: 'backfill',
    },
    status.unposted.payrollAccruals > 0 && {
      id: 'payroll',
      count: status.unposted.payrollAccruals,
      short: 'Payroll',
      title: 'Payroll accruals missing journal',
      target: 'backfill',
    },
    status.unposted.productionBatches > 0 && {
      id: 'batch',
      count: status.unposted.productionBatches,
      short: 'Production',
      title: 'Production batches missing journal',
      target: 'backfill',
    },
    status.unposted.factoryMaterialReleases > 0 && {
      id: 'release',
      count: status.unposted.factoryMaterialReleases,
      short: 'Factory',
      title: 'Factory material releases missing journal',
      target: 'backfill',
    },
  ]
  const chips = chipCandidates.filter((row): row is UnpostedChip => Boolean(row))

  const checks = [
    {
      ok: status.missingDefaultAccounts.length === 0,
      label: 'Default accounts',
      detail:
        status.missingDefaultAccounts.length === 0
          ? 'All set'
          : `Missing: ${status.missingDefaultAccounts.join(', ')}`,
      action: status.missingDefaultAccounts.length > 0 ? onOpenDefaultAccounts : undefined,
      actionLabel: 'Set defaults',
    },
    {
      ok: status.hasOpeningBalance || unpostedTotal === 0,
      label: 'Opening balances',
      detail: status.hasOpeningBalance
        ? 'Posted'
        : unpostedTotal > 0
          ? 'Post before backfill'
          : 'Optional',
    },
    {
      ok: !status.currentPeriodClosed,
      label: 'Current period',
      detail: status.currentPeriodClosed ? 'Closed — reopen below' : 'Open',
    },
    {
      ok: unpostedTotal === 0,
      label: 'Missing journals',
      detail: unpostedTotal === 0 ? 'None' : `${unpostedTotal} to post`,
    },
  ]

  const okCount = checks.filter((c) => c.ok).length
  const linkClass = 'text-blue-600 hover:underline font-medium tabular-nums'

  const handleChipClick = (e: MouseEvent, target: GoLiveUnpostedTarget) => {
    e.preventDefault()
    e.stopPropagation()
    onNavigateUnposted?.(target)
  }

  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        status.ready ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 shrink-0">Setup checklist</h3>
          <span
            className={`text-[11px] font-medium tabular-nums shrink-0 ${
              status.ready ? 'text-green-700' : 'text-amber-800'
            }`}
          >
            {okCount}/{checks.length}
            {status.ready ? ' ready' : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-xs text-blue-600 hover:underline shrink-0"
        >
          Refresh
        </button>
      </div>
      <ul className="grid sm:grid-cols-2 gap-x-3 gap-y-1">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-1.5 min-w-0 text-xs leading-snug">
            <span
              className={`mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                c.ok ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'
              }`}
              aria-hidden
            >
              {c.ok ? '✓' : '!'}
            </span>
            <div className="min-w-0 flex-1">
              <span className="font-medium text-gray-900">{c.label}</span>
              <span className="text-gray-500"> — {c.detail}</span>
              {c.action && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      c.action?.()
                    }}
                    className={linkClass}
                  >
                    {c.actionLabel}
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {chips.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-amber-200/60 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-snug">
          {chips.map((chip, i) => (
            <span key={chip.id} className="inline-flex items-center">
              {i > 0 && <span className="text-gray-300 select-none mr-1.5">·</span>}
              <button
                type="button"
                title={chip.title}
                onClick={(e) => handleChipClick(e, chip.target)}
                className={linkClass}
              >
                {chip.count} {chip.short}
              </button>
            </span>
          ))}
          {onNavigateUnposted && (
            <>
              <span className="text-gray-300 select-none mx-0.5">·</span>
              <button
                type="button"
                title="Go to backfill"
                onClick={(e) => handleChipClick(e, 'backfill')}
                className={linkClass}
              >
                Backfill
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
