'use client'
import { useState, useEffect, useCallback, useRef, type RefObject } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import { resolveStickerIdFromCode, recordProductionScan } from '../../../lib/factory-scan'
import {
  loadTodayFactorySchedule,
  loadScannedSerialsForScheduleItem,
  pickScheduleForProduct,
  groupScheduleByBrand,
  isScheduleItemScanComplete,
  type FactoryScheduleItem,
  type FactoryScannedSerial,
} from '../../../lib/factory-schedule'
import {
  createFactoryStickerRequest,
  fetchPendingStickerRequests,
  pendingStickerQtyByScheduleId as buildPendingStickerQtyByScheduleId,
} from '../../../lib/factory-sticker-requests'
import { ProgressFractionCircle } from '../../components/ProgressFractionCircle'
import { ScheduleNotesBlock } from '../ScheduleNotesBlock'
import { getBrandTagClasses, getBrandScanTheme } from '../../../lib/brand-colors'
import { getPhilippinesDate } from '../../../lib/timezone'
import {
  ArrowLeft,
  Barcode,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Package,
  Tag,
  X,
  XCircle,
} from 'lucide-react'

function getFactoryRequestedBy(): string {
  if (typeof window === 'undefined') return 'Factory'
  return (localStorage.getItem('dashboard_username') || '').trim() || 'Factory'
}

function RequestAdditionalStickers({
  item,
  pendingQty,
  onRequested,
}: {
  item: FactoryScheduleItem
  pendingQty: number
  onRequested: () => Promise<void>
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [qty, setQty] = useState('1')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const closeModal = () => {
    setModalOpen(false)
    setQty('1')
    setNotes('')
  }

  const handleSubmit = async () => {
    const n = parseInt(qty, 10)
    if (n < 1) {
      alert('Enter at least 1 sticker.')
      return
    }
    if (
      !confirm(
        `Request ${n} additional sticker${n === 1 ? '' : 's'} for ${item.product_name}? It will appear in Production Schedule for printing.`
      )
    ) {
      return
    }

    setSubmitting(true)
    try {
      await createFactoryStickerRequest({
        scheduleId: item.schedule_id,
        productId: item.product_id,
        scheduleDate: getPhilippinesDate(),
        quantity: n,
        requestedBy: getFactoryRequestedBy(),
        notes: notes.trim() || undefined,
      })
      await onRequested()
      closeModal()
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3 text-left hover:bg-slate-50 active:bg-slate-100 touch-manipulation transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Tag className="h-4 w-4 shrink-0 text-slate-600" />
          <span className="text-sm font-medium text-gray-900">Request additional stickers</span>
        </div>
        {pendingQty > 0 ? (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 tabular-nums">
            {pendingQty} pending
          </span>
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
        )}
      </button>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sticker-request-title"
          onClick={submitting ? undefined : closeModal}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-4 py-4 border-b border-slate-100">
              <div className="min-w-0">
                <h2 id="sticker-request-title" className="text-base font-semibold text-gray-900">
                  Request additional stickers
                </h2>
                <p className="text-sm text-gray-600 mt-1 truncate">{item.product_name}</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-gray-500 hover:bg-slate-100 active:bg-slate-200 touch-manipulation disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 py-4 space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                For damaged, lost, or extra labels. Admin will see this on today&apos;s Production
                Schedule to print.
              </p>
              {pendingQty > 0 ? (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {pendingQty} sticker{pendingQty === 1 ? '' : 's'} already waiting to be printed.
                </p>
              ) : null}

              <div>
                <label
                  htmlFor="sticker-request-qty"
                  className="block text-xs font-medium text-gray-600 mb-1.5"
                >
                  Quantity
                </label>
                <input
                  id="sticker-request-qty"
                  type="number"
                  min={1}
                  step={1}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-lg text-base text-gray-900"
                />
              </div>

              <div>
                <label
                  htmlFor="sticker-request-notes"
                  className="block text-xs font-medium text-gray-600 mb-1.5"
                >
                  Reason (optional)
                </label>
                <input
                  id="sticker-request-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. damaged label"
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-lg text-base text-gray-900"
                />
              </div>
            </div>

            <div className="flex gap-2 px-4 py-4 border-t border-slate-100 bg-slate-50/80">
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-gray-700 hover:bg-slate-50 disabled:opacity-50 touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 touch-manipulation"
              >
                {submitting ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function formatScannedTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function ScannerView({
  item,
  processing,
  feedback,
  scanCode,
  scannedSerials,
  loadingScanned,
  inputRef,
  onScanCodeChange,
  onSubmit,
  onFocusInput,
  onChangeItem,
  pendingStickerQty,
  onStickerRequestRefresh,
}: {
  item: FactoryScheduleItem
  processing: boolean
  feedback: { type: 'success' | 'error'; message: string } | null
  scanCode: string
  scannedSerials: FactoryScannedSerial[]
  loadingScanned: boolean
  inputRef: RefObject<HTMLInputElement | null>
  onScanCodeChange: (v: string) => void
  onSubmit: () => void
  onFocusInput: () => void
  onChangeItem: () => void
  pendingStickerQty: number
  onStickerRequestRefresh: () => Promise<void>
}) {
  const brandTheme = getBrandScanTheme(item.brand_name)
  const isComplete = isScheduleItemScanComplete(item)

  const progressPct =
    item.quantity_required > 0
      ? Math.min(100, Math.round((item.produced / item.quantity_required) * 100))
      : 0

  const status: 'idle' | 'processing' | 'success' | 'error' | 'complete' = processing
    ? 'processing'
    : feedback?.type === 'success'
      ? 'success'
      : feedback?.type === 'error'
        ? 'error'
        : isComplete
          ? 'complete'
          : 'idle'

  const successRing = 'border-slate-600 shadow-[0_0_20px_rgba(71,85,105,0.22)]'
  const successBg = 'bg-slate-100'
  const successIcon = 'text-slate-700'
  const successText = 'text-slate-800'

  const ringClass =
    status === 'processing'
      ? brandTheme.processingRing
      : status === 'success' || status === 'complete'
        ? successRing
        : status === 'error'
          ? 'border-red-400 shadow-[0_0_20px_rgba(248,113,113,0.25)]'
          : brandTheme.idleRing

  const circleBg =
    status === 'success' || status === 'complete'
      ? successBg
      : status === 'error'
        ? 'bg-red-50'
        : brandTheme.idleBg

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">
              {isComplete ? 'Complete' : 'Producing'}
            </p>
            <h1 className="text-lg font-bold text-gray-900 leading-snug mt-0.5">{item.product_name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getBrandTagClasses(item.brand_name)}`}
              >
                {item.brand_name}
              </span>
              {item.sku ? (
                <span className="text-gray-500 text-xs font-mono truncate">{item.sku}</span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onChangeItem}
            className="shrink-0 min-h-[40px] px-3 py-2 rounded-lg text-xs font-medium text-gray-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 touch-manipulation"
          >
            Change
          </button>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Today in production</span>
            <span className="tabular-nums text-gray-700 font-medium">
              {item.produced} / {item.quantity_required}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${brandTheme.progressBar}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <ScheduleNotesBlock notes={item.notes} />
      </div>

      <form
        className="sr-only"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        aria-hidden
      >
        <input
          ref={inputRef}
          type="text"
          value={scanCode}
          onChange={(e) => onScanCodeChange(e.target.value)}
          onBlur={() => setTimeout(onFocusInput, 50)}
          autoFocus
          autoComplete="off"
          tabIndex={0}
        />
      </form>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col items-center">
        <button
          type="button"
          onClick={onFocusInput}
          className={`relative flex h-36 w-36 items-center justify-center rounded-full border-4 transition-all duration-300 touch-manipulation ${circleBg} ${ringClass} ${
            status === 'idle' ? 'animate-pulse' : ''
          }`}
          aria-label={
            status === 'complete'
              ? 'Production scan complete'
              : 'Scan area — tap if scanner stopped responding'
          }
        >
          {status === 'processing' && (
            <div
              className={`h-10 w-10 animate-spin rounded-full border-2 ${brandTheme.processingSpinner}`}
            />
          )}
          {(status === 'success' || status === 'complete') && (
            status === 'complete' ? (
              <CheckCircle2 className={`h-14 w-14 ${successIcon}`} strokeWidth={1.75} />
            ) : (
              <ProgressFractionCircle
                current={item.produced}
                total={item.quantity_required}
                strokeClass={successIcon}
              />
            )
          )}
          {status === 'error' && <XCircle className="h-14 w-14 text-red-500" strokeWidth={1.75} />}
          {status === 'idle' && (
            <Barcode className={`h-14 w-14 ${brandTheme.idleIcon}`} strokeWidth={1.5} />
          )}
        </button>

        <p
          className={`mt-5 text-center text-sm font-medium max-w-[280px] ${
            status === 'success' || status === 'complete'
              ? successText
              : status === 'error'
                ? 'text-red-800'
                : 'text-gray-700'
          }`}
        >
          {status === 'processing' && 'Processing…'}
          {status === 'success' && feedback?.message}
          {status === 'complete' && 'Complete'}
          {status === 'error' && feedback?.message}
          {status === 'idle' && 'Scan sticker'}
        </p>
        {status === 'idle' && (
          <p className="mt-1 text-center text-xs text-gray-500">Scanner is ready — no tap needed</p>
        )}
        {status === 'complete' && (
          <p className="mt-1 text-center text-xs text-gray-500">
            All {item.quantity_required} unit{item.quantity_required === 1 ? '' : 's'} scanned for today
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 text-center">
        <p className="text-[10px] uppercase tracking-wide text-gray-500">
          {isComplete ? 'Status' : 'Remaining'}
        </p>
        <p
          className={`text-2xl font-bold tabular-nums mt-0.5 ${
            isComplete ? 'text-emerald-700' : brandTheme.remainingText
          }`}
        >
          {isComplete ? 'Complete' : Math.max(0, item.quantity_required - item.produced)}
        </p>
      </div>

      <RequestAdditionalStickers
        item={item}
        pendingQty={pendingStickerQty}
        onRequested={onStickerRequestRefresh}
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Scanned serials
          </h2>
          <span className="text-xs tabular-nums text-gray-500 shrink-0">
            {loadingScanned ? '…' : scannedSerials.length}
          </span>
        </div>
        {loadingScanned && scannedSerials.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-400">Loading…</p>
        ) : scannedSerials.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            No serials scanned yet for this item today.
          </p>
        ) : (
          <ul className="max-h-52 overflow-y-auto divide-y divide-slate-100">
            {scannedSerials.map((row, index) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-[10px] tabular-nums text-gray-400 w-5 shrink-0 text-right">
                    {scannedSerials.length - index}
                  </span>
                  <code className="text-xs font-mono text-gray-900 truncate">{row.serial_number}</code>
                </div>
                <span className="text-[10px] text-gray-500 tabular-nums shrink-0">
                  {formatScannedTime(row.produced_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function SelectionIntro({
  loading,
  itemCount,
}: {
  loading: boolean
  itemCount: number
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
      <div className="min-w-0">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 leading-snug flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <Package className="h-5 w-5 shrink-0 text-slate-600" strokeWidth={2} aria-hidden />
          </span>
          Choose a product
        </h2>
        <p className="text-sm text-gray-600 mt-3 leading-relaxed">
          Tap the item you&apos;re producing on the floor. Sticker scanning starts on the next
          screen.
        </p>
        {loading ? (
          <p className="text-xs text-gray-400 mt-2">Loading schedule…</p>
        ) : itemCount > 0 ? (
          <p className="text-xs text-gray-500 mt-2 tabular-nums">
            {itemCount} {itemCount === 1 ? 'item' : 'items'} on today&apos;s schedule
          </p>
        ) : null}
      </div>
    </div>
  )
}

function SchedulePicker({
  items,
  loading,
  onSelect,
  pendingByScheduleId,
}: {
  items: FactoryScheduleItem[]
  loading: boolean
  onSelect: (scheduleId: string) => void
  pendingByScheduleId: Record<string, number>
}) {
  if (loading) {
    return null
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm text-center py-10 px-4">
        <ClipboardList className="h-10 w-10 text-slate-500 mx-auto mb-3" />
        <p className="text-gray-600 text-sm">
          No production scheduled for today. Ask admin to set it in Dashboard → Production Schedule.
        </p>
        <Link
          href="/factory"
          className="inline-flex mt-6 min-h-[44px] items-center text-slate-700 hover:text-gray-900 text-sm font-medium"
        >
          Back to factory
        </Link>
      </div>
    )
  }

  const brandGroups = groupScheduleByBrand(items)

  return (
    <div className="space-y-5">
      {brandGroups.map(({ brandName, items: groupItems }) => (
        <section key={brandName} className="space-y-2">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getBrandTagClasses(brandName)}`}
          >
            {brandName}
          </span>
          <div className="space-y-2">
            {groupItems.map((item) => {
              const complete = isScheduleItemScanComplete(item)
              const pendingStickers = pendingByScheduleId[item.schedule_id] ?? 0
              return (
              <button
                key={item.schedule_id}
                type="button"
                onClick={() => onSelect(item.schedule_id)}
                className={`w-full text-left rounded-xl border shadow-sm p-4 touch-manipulation transition-colors ${
                  complete
                    ? 'border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 active:bg-emerald-100/80'
                    : 'border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 leading-snug">{item.product_name}</p>
                      {complete ? (
                        <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" aria-hidden />
                          Complete
                        </span>
                      ) : null}
                      {pendingStickers > 0 ? (
                        <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-200 tabular-nums">
                          <Tag className="h-3 w-3" aria-hidden />
                          +{pendingStickers} print
                        </span>
                      ) : null}
                    </div>
                    <p className="text-gray-500 text-xs mt-1">
                      {item.sku ? <span className="font-mono">{item.sku}</span> : null}
                      {item.sku ? ' · ' : null}
                      <span className="font-mono">{item.batch_number}</span>
                    </p>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-slate-50 border border-slate-100 py-2 px-1">
                        <dt className="text-[10px] uppercase tracking-wide text-gray-500">Req</dt>
                        <dd className="text-sm font-semibold text-gray-900 tabular-nums">
                          {item.quantity_required}
                        </dd>
                      </div>
                      <div className="rounded-md bg-slate-50 border border-slate-100 py-2 px-1">
                        <dt className="text-[10px] uppercase tracking-wide text-gray-500">Printed</dt>
                        <dd className="text-sm font-semibold text-gray-900 tabular-nums">
                          {item.printed}
                        </dd>
                      </div>
                      <div className="rounded-md bg-slate-50 border border-slate-100 py-2 px-1">
                        <dt className="text-[10px] uppercase tracking-wide text-gray-500">In prod</dt>
                        <dd className="text-sm font-semibold text-emerald-700 tabular-nums">
                          {item.produced}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <ProgressFractionCircle
                    current={item.produced}
                    total={item.quantity_required}
                    size="sm"
                    strokeClass={complete ? 'text-emerald-600' : 'text-slate-600'}
                  />
                </div>
                <ScheduleNotesBlock notes={item.notes} />
              </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

export default function FactoryScanPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const scheduleParam = searchParams.get('schedule')
  const initialCode = searchParams.get('code') || searchParams.get('id') || ''
  const today = getPhilippinesDate()

  const [scheduleItems, setScheduleItems] = useState<FactoryScheduleItem[]>([])
  const [loadingSchedule, setLoadingSchedule] = useState(true)
  const [scanCode, setScanCode] = useState('')
  const [processing, setProcessing] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [scannedSerials, setScannedSerials] = useState<FactoryScannedSerial[]>([])
  const [loadingScanned, setLoadingScanned] = useState(false)
  const [pendingStickerQtyByScheduleId, setPendingStickerQtyByScheduleId] = useState<
    Record<string, number>
  >({})
  const processingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const initialProcessed = useRef(false)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeItem = scheduleParam
    ? scheduleItems.find((i) => i.schedule_id === scheduleParam)
    : undefined

  const showScanner = Boolean(scheduleParam && activeItem)

  const focusInput = useCallback(() => {
    if (!showScanner) return
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [showScanner])

  const refreshScannedSerials = useCallback(async (item: FactoryScheduleItem) => {
    setLoadingScanned(true)
    try {
      const rows = await loadScannedSerialsForScheduleItem(item, today)
      setScannedSerials(rows)
    } finally {
      setLoadingScanned(false)
    }
  }, [today])

  const refreshSchedule = useCallback(async () => {
    setLoadingSchedule(true)
    try {
      const items = await loadTodayFactorySchedule(today)
      setScheduleItems(items)
      return items
    } finally {
      setLoadingSchedule(false)
    }
  }, [today])

  const refreshStickerRequests = useCallback(async () => {
    const rows = await fetchPendingStickerRequests(today)
    setPendingStickerQtyByScheduleId(buildPendingStickerQtyByScheduleId(rows))
  }, [today])

  useEffect(() => {
    void refreshStickerRequests()
  }, [refreshStickerRequests])

  useEffect(() => {
    const onFocus = () => {
      void refreshStickerRequests()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshStickerRequests])

  useEffect(() => {
    if (!activeItem) {
      setScannedSerials([])
      return
    }
    void refreshScannedSerials(activeItem)
  }, [activeItem, refreshScannedSerials])

  useEffect(() => {
    refreshSchedule()
  }, [refreshSchedule])

  const selectSchedule = useCallback(
    (scheduleId: string) => {
      const params = new URLSearchParams()
      params.set('schedule', scheduleId)
      router.push(`/factory/scan?${params.toString()}`)
    },
    [router]
  )

  const clearSchedule = useCallback(() => {
    router.push('/factory/scan')
  }, [router])

  const submitCode = useCallback(
    async (raw: string) => {
      const code = raw.trim()
      if (!code || processingRef.current || !activeItem) return

      processingRef.current = true
      setProcessing(true)
      setFeedback(null)

      try {
        const stickerId = await resolveStickerIdFromCode(code)
        if (!stickerId) {
          setFeedback({ type: 'error', message: 'Unknown sticker code' })
          return
        }

        const result = await recordProductionScan(stickerId, {
          expectedProductId: activeItem.product_id,
          expectedProductName: activeItem.product_name,
        })
        setFeedback({ type: result.ok ? 'success' : 'error', message: result.message })
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
        if (result.ok) {
          await refreshSchedule()
          await refreshScannedSerials(activeItem)
          feedbackTimerRef.current = setTimeout(() => setFeedback(null), 2200)
        }
      } finally {
        processingRef.current = false
        setProcessing(false)
        setScanCode('')
        focusInput()
      }
    },
    [activeItem, focusInput, refreshSchedule, refreshScannedSerials]
  )

  useEffect(() => {
    if (!showScanner) return
    focusInput()
    const onFocus = () => focusInput()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [showScanner, focusInput])

  useEffect(() => {
    if (!initialCode || initialProcessed.current || loadingSchedule) return

    const run = async () => {
      let targetScheduleId = scheduleParam

      if (!targetScheduleId) {
        const stickerId = await resolveStickerIdFromCode(initialCode)
        if (!stickerId) {
          initialProcessed.current = true
          router.replace('/factory/scan')
          return
        }

        const { data: sticker } = await supabase
          .from('production_sticker_logs')
          .select('product_id, schedule_id')
          .eq('id', stickerId)
          .maybeSingle()

        const match = sticker?.product_id
          ? pickScheduleForProduct(scheduleItems, sticker.product_id, sticker.schedule_id)
          : undefined

        if (!match) {
          initialProcessed.current = true
          router.replace('/factory/scan')
          return
        }

        router.replace(`/factory/scan?schedule=${match.schedule_id}`)
        return
      }

      const item = scheduleItems.find((i) => i.schedule_id === targetScheduleId)
      if (!item) return

      initialProcessed.current = true
      await submitCode(initialCode)
      router.replace(`/factory/scan?schedule=${item.schedule_id}`)
    }

    void run()
  }, [initialCode, loadingSchedule, scheduleParam, scheduleItems, router, submitCode])

  return (
    <div className="min-h-[100dvh] min-h-screen bg-slate-100 flex flex-col pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="shrink-0 bg-slate-800 text-white">
        <div className="max-w-lg mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Link
            href="/factory"
            className="flex items-center gap-2 min-h-[44px] text-slate-300 hover:text-white text-sm touch-manipulation"
          >
            <ArrowLeft className="h-4 w-4" />
            Factory
          </Link>
          <div className="text-right min-w-0">
            <h1 className="text-lg font-bold leading-tight">Record production</h1>
            <p className="text-slate-300 text-xs tabular-nums">{today}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-lg mx-auto w-full px-3 sm:px-4 py-4 sm:py-6">
        {scheduleParam && !loadingSchedule && scheduleItems.length > 0 && !activeItem ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm text-center py-10 px-4">
            <p className="text-gray-600 text-sm mb-4">That schedule item is no longer on today&apos;s list.</p>
            <button
              type="button"
              onClick={clearSchedule}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-700 text-white text-sm hover:bg-slate-800"
            >
              Choose another item
            </button>
          </div>
        ) : !showScanner ? (
          <div className="space-y-4 sm:space-y-5">
            <SelectionIntro loading={loadingSchedule} itemCount={scheduleItems.length} />
            {loadingSchedule ? (
              <p className="text-gray-500 text-center py-8 text-sm">Loading today&apos;s schedule…</p>
            ) : (
              <SchedulePicker
                items={scheduleItems}
                loading={loadingSchedule}
                onSelect={selectSchedule}
                pendingByScheduleId={pendingStickerQtyByScheduleId}
              />
            )}
          </div>
        ) : (
          <ScannerView
            item={activeItem!}
            processing={processing}
            feedback={feedback}
            scanCode={scanCode}
            scannedSerials={scannedSerials}
            loadingScanned={loadingScanned}
            inputRef={inputRef}
            onScanCodeChange={setScanCode}
            onSubmit={() => submitCode(scanCode)}
            onFocusInput={focusInput}
            onChangeItem={clearSchedule}
            pendingStickerQty={pendingStickerQtyByScheduleId[activeItem!.schedule_id] ?? 0}
            onStickerRequestRefresh={refreshStickerRequests}
          />
        )}
      </main>
    </div>
  )
}
