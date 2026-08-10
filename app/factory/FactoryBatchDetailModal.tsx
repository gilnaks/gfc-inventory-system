'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, Loader2, Barcode, Play } from 'lucide-react'
import { Modal } from '../components/Modal'
import {
  fetchBatchDetail,
  stickerScanState,
  type FactoryBatchDetail,
  type FactoryBatchSticker,
} from '../../lib/factory-batch-history'
import { getBrandTagClasses } from '../../lib/brand-colors'

function formatQty(qty: number) {
  if (!Number.isFinite(qty)) return '0'
  return Number.isInteger(qty)
    ? String(qty)
    : qty.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === 'completed'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : status === 'in_progress'
        ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
        : 'bg-slate-100 text-slate-700 border-slate-200'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${styles}`}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

function StickerStateBadge({ sticker }: { sticker: FactoryBatchSticker }) {
  const state = stickerScanState(sticker)
  const styles =
    state === 'scanned'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : state === 'voided'
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-slate-50 text-slate-600 border-slate-200'
  const label = state === 'scanned' ? 'Scanned' : state === 'voided' ? 'Voided' : 'Printed'
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${styles}`}>{label}</span>
  )
}

function StickerQr({ serial }: { serial: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const QRCode = (await import('qrcode')).default
        const url = await QRCode.toDataURL(serial, { width: 96, margin: 1 })
        if (!cancelled) setQrDataUrl(url)
      } catch {
        if (!cancelled) setQrDataUrl(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [serial])

  if (!qrDataUrl) {
    return (
      <div className="h-24 w-24 mx-auto flex items-center justify-center bg-slate-50 rounded border border-slate-100">
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={qrDataUrl} alt={`QR for ${serial}`} className="h-24 w-24 mx-auto rounded" />
  )
}

export function FactoryBatchDetailModal({
  batchId,
  onClose,
}: {
  batchId: string
  onClose: () => void
}) {
  const [detail, setDetail] = useState<FactoryBatchDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const result = await fetchBatchDetail(batchId)
        if (cancelled) return
        if (!result) {
          setError('Batch not found')
        } else {
          setDetail(result)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load batch')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [batchId])

  const batch = detail?.batch

  return (
    <Modal onClose={onClose} align="center" zIndex={70}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[min(90dvh,42rem)] overflow-hidden flex flex-col shadow-xl border border-slate-200">
        <div className="p-4 border-b border-slate-100 flex justify-between items-start gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {batch?.batch_number ? `Batch ${batch.batch_number}` : 'Production batch'}
            </h2>
            {batch?.product_name ? (
              <p className="text-sm text-gray-600 mt-0.5 truncate">{batch.product_name}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-gray-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-5">
          {loading && (
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading batch details…
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {detail && batch ? (
            <>
              <section className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={batch.status} />
                  {batch.brand_name ? (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getBrandTagClasses(batch.brand_name)}`}
                    >
                      {batch.brand_name}
                    </span>
                  ) : null}
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <dt className="text-gray-500">Work date</dt>
                    <dd className="font-medium tabular-nums">{batch.work_date}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Units produced</dt>
                    <dd className="font-medium tabular-nums">{batch.units}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Scan progress</dt>
                    <dd className="font-medium tabular-nums">
                      {detail.scanned_count}
                      {detail.quantity_required > 0 ? ` / ${detail.quantity_required}` : ''}
                    </dd>
                  </div>
                  {batch.sku ? (
                    <div>
                      <dt className="text-gray-500">SKU</dt>
                      <dd className="font-mono font-medium">{batch.sku}</dd>
                    </div>
                  ) : null}
                  <div className="col-span-2">
                    <dt className="text-gray-500">Started</dt>
                    <dd className="font-medium">
                      {formatTime(batch.started_at)}
                      {batch.started_by ? ` · ${batch.started_by}` : ''}
                    </dd>
                  </div>
                  {batch.completed_at ? (
                    <div className="col-span-2">
                      <dt className="text-gray-500">
                        {batch.status === 'cancelled' ? 'Cancelled' : 'Completed'}
                      </dt>
                      <dd className="font-medium">{formatTime(batch.completed_at)}</dd>
                    </div>
                  ) : null}
                </dl>

                {batch.status === 'in_progress' ? (
                  <Link
                    href={`/factory/scan?schedule=${batch.schedule_id}`}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 touch-manipulation px-4"
                  >
                    <Play className="h-4 w-4" />
                    Continue scanning
                  </Link>
                ) : null}
              </section>

              {detail.material_usage.length > 0 ? (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
                    Materials used
                  </h3>
                  <ul className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                    {detail.material_usage.map((line) => (
                      <li
                        key={line.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm bg-white"
                      >
                        <span className="min-w-0 truncate text-gray-900">{line.material_name}</span>
                        <span className="shrink-0 tabular-nums text-gray-600 text-xs">
                          {formatQty(line.quantity_used)} {line.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {detail.cost_summary ? (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
                    Cost summary
                  </h3>
                  <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-slate-50 border border-slate-100 py-2 px-1">
                      <dt className="text-gray-500">Actual</dt>
                      <dd className="font-semibold tabular-nums mt-0.5">
                        ₱{formatMoney(detail.cost_summary.actualCost)}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 py-2 px-1">
                      <dt className="text-gray-500">Theoretical</dt>
                      <dd className="font-semibold tabular-nums mt-0.5">
                        ₱{formatMoney(detail.cost_summary.theoreticalCost)}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 py-2 px-1">
                      <dt className="text-gray-500">Variance</dt>
                      <dd
                        className={`font-semibold tabular-nums mt-0.5 ${
                          detail.cost_summary.variance > 0
                            ? 'text-red-700'
                            : detail.cost_summary.variance < 0
                              ? 'text-emerald-700'
                              : 'text-gray-900'
                        }`}
                      >
                        ₱{formatMoney(detail.cost_summary.variance)}
                      </dd>
                    </div>
                  </dl>
                </section>
              ) : null}

              <section>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 flex items-center gap-1.5">
                    <Barcode className="h-3.5 w-3.5" />
                    Stickers &amp; QR codes
                  </h3>
                  <span className="text-xs text-gray-500 tabular-nums">{detail.stickers.length}</span>
                </div>
                {detail.stickers.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center rounded-lg border border-dashed border-slate-200">
                    No stickers printed for this batch date.
                  </p>
                ) : (
                  <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {detail.stickers.map((sticker) => (
                      <li
                        key={sticker.id}
                        className="rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-center"
                      >
                        <StickerQr serial={sticker.serial_number} />
                        <code className="block text-[10px] font-mono text-gray-900 mt-2 break-all leading-tight">
                          {sticker.serial_number}
                        </code>
                        <div className="mt-1.5 flex flex-col items-center gap-1">
                          <StickerStateBadge sticker={sticker} />
                          {sticker.produced_at ? (
                            <span className="text-[9px] text-gray-500 tabular-nums">
                              {formatTime(sticker.produced_at)}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
