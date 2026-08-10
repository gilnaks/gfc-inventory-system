'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import type { AccountingJournalSourceType } from '../../lib/supabase'
import {
  isIdHeavyMemo,
  pickJournalDescription,
  truncateJournalDescription,
  JOURNAL_DESCRIPTION_MAX_LENGTH,
} from '../../lib/journal-description'
import {
  ensureJournalEntryDescription,
  ensureJournalSourceLabel,
  fetchRelatedJournalDocs,
  getCachedJournalEntryDescription,
  getCachedJournalSourceLabel,
  isSourceTypeTrackable,
  journalEntryNeedsSourceLabel,
  parseLineMemoLink,
  resolveLineMemoLink,
  sourceTypeToDocKind,
  subscribeJournalLabelCache,
  type JournalRelatedDoc,
} from '../../lib/journal-source-resolver'
import type { JournalDocOpenRequest } from './JournalSourceModalHost'
import { JournalSupportingDocsSkeleton } from './AccountingBooksSkeletons'

const SUPPORTING_DOCS_FONT = 'font-mono text-xs tracking-tight'

export function JournalDescriptionText({
  text,
  maxLength = JOURNAL_DESCRIPTION_MAX_LENGTH,
  className = '',
  compact = false,
}: {
  text?: string | null
  maxLength?: number
  className?: string
  compact?: boolean
}) {
  const raw = text?.trim()
  if (!raw) return <span className="text-gray-400">—</span>

  const { display, isTruncated, full } = truncateJournalDescription(raw, maxLength)

  return (
    <span
      className={`inline-flex items-center gap-1 min-w-0 ${compact ? 'max-w-full' : ''} ${className}`}
    >
      <span className={`text-gray-700 ${compact ? 'truncate' : ''}`}>{display}</span>
      {isTruncated && (
        <span className="relative group shrink-0 self-center">
          <Info
            className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help"
            aria-label="Full description"
          />
          <span
            role="tooltip"
            className="pointer-events-none absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 z-50 hidden group-hover:block w-max max-w-xs rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-normal text-white shadow-lg whitespace-normal"
          >
            {full}
          </span>
        </span>
      )}
    </span>
  )
}

function hasParseableLineMemos(memos?: Array<string | null | undefined>): boolean {
  return (memos || []).some((m) => parseLineMemoLink(m) != null)
}

function shouldLoadSupportingDocs(
  sourceId: string | null | undefined,
  lineMemos?: Array<string | null | undefined>
): boolean {
  if (sourceId) return true
  return hasParseableLineMemos(lineMemos)
}

type Props = {
  memo?: string | null
  sourceType: AccountingJournalSourceType | string
  sourceId?: string | null
  journalEntryId?: string
  compact?: boolean
  className?: string
}

export function JournalMemoLinks({
  memo,
  sourceType,
  sourceId,
  journalEntryId,
  compact = false,
  className = '',
}: Props) {
  const trackable = !!sourceId && isSourceTypeTrackable(sourceType, sourceId)
  const memoText = memo?.trim() || ''
  const memoIsUsable = memoText.length > 0 && !isIdHeavyMemo(memoText)
  const needsSourceLabel =
    !trackable && journalEntryNeedsSourceLabel(memo, sourceType, sourceId)
  const trackableNeedsDescription = trackable && !getCachedJournalEntryDescription(sourceType, sourceId!)
  const [, cacheTick] = useState(0)
  const [descriptionPending, setDescriptionPending] = useState(trackableNeedsDescription)

  useEffect(() => subscribeJournalLabelCache(() => cacheTick((n) => n + 1)), [])

  const cachedDescription = trackable
    ? getCachedJournalEntryDescription(sourceType, sourceId!)
    : null
  const cachedLabel =
    sourceId && needsSourceLabel ? getCachedJournalSourceLabel(sourceType, sourceId) : null

  useEffect(() => {
    if (!trackable || cachedDescription) {
      setDescriptionPending(false)
      return
    }
    setDescriptionPending(true)
    let cancelled = false
    void ensureJournalEntryDescription(sourceType, sourceId!, journalEntryId).then(() => {
      if (!cancelled) {
        setDescriptionPending(false)
        cacheTick((n) => n + 1)
      }
    })
    return () => {
      cancelled = true
    }
  }, [trackable, sourceType, sourceId, journalEntryId, cachedDescription])

  useEffect(() => {
    if (!needsSourceLabel || !sourceId || cachedLabel) return
    let cancelled = false
    void ensureJournalSourceLabel(sourceType, sourceId).then(() => {
      if (!cancelled) cacheTick((n) => n + 1)
    })
    return () => {
      cancelled = true
    }
  }, [needsSourceLabel, sourceType, sourceId, cachedLabel])

  if (trackable) {
    if (cachedDescription) {
      return (
        <JournalDescriptionText
          text={cachedDescription}
          compact={compact}
          className={className}
        />
      )
    }
    if (descriptionPending) {
      return (
        <span
          className={`inline-block h-4 rounded bg-gray-100 animate-pulse ${
            compact ? 'w-28 max-w-full' : 'w-36'
          }`}
          aria-hidden
        />
      )
    }
    const fallback = memoIsUsable ? memoText : pickJournalDescription(memo, cachedLabel)
    return (
      <JournalDescriptionText text={fallback} compact={compact} className={className} />
    )
  }

  if (memoIsUsable) {
    return (
      <JournalDescriptionText text={memoText} compact={compact} className={className} />
    )
  }

  if (needsSourceLabel && !cachedLabel) {
    return (
      <span
        className={`inline-block h-4 rounded bg-gray-100 animate-pulse ${
          compact ? 'w-28 max-w-full' : 'w-36'
        }`}
        aria-hidden
      />
    )
  }

  const description = pickJournalDescription(memo, cachedLabel)

  return (
    <JournalDescriptionText text={description} compact={compact} className={className} />
  )
}

export function JournalLineMemoLink({ memo }: { memo?: string | null }) {
  return <JournalDescriptionText text={memo} maxLength={48} />
}

export function JournalSupportingDocs({
  sourceType,
  sourceId,
  journalEntryId,
  brandId,
  lineMemos,
  onOpenDocument,
}: {
  sourceType: AccountingJournalSourceType | string
  sourceId?: string | null
  journalEntryId?: string
  brandId?: string
  lineMemos?: Array<string | null | undefined>
  onOpenDocument: (req: JournalDocOpenRequest) => void
}) {
  const [loading, setLoading] = useState(false)
  const [allDocs, setAllDocs] = useState<JournalRelatedDoc[]>([])
  const loadedForKeyRef = useRef<string | null>(null)

  const docKind = sourceId ? sourceTypeToDocKind(sourceType) : null
  const expectsDocs = shouldLoadSupportingDocs(sourceId, lineMemos)
  const lineMemosKey = (lineMemos ?? []).map((m) => m ?? '').join('\x1e')
  const loadKey = `${sourceType}|${sourceId ?? ''}|${brandId ?? ''}|${docKind ?? ''}|${lineMemosKey}`

  useEffect(() => {
    if (!expectsDocs) {
      setAllDocs([])
      setLoading(false)
      loadedForKeyRef.current = null
      return
    }

    if (loadedForKeyRef.current === loadKey) return

    let cancelled = false
    setLoading(true)

    void (async () => {
      const [related, primaryLabel, lineLinks] = await Promise.all([
        sourceId ? fetchRelatedJournalDocs(sourceType, sourceId, brandId) : Promise.resolve([]),
        docKind && sourceId
          ? getCachedJournalSourceLabel(sourceType, sourceId) ||
            (await ensureJournalSourceLabel(sourceType, sourceId))
          : Promise.resolve(null),
        (async () => {
          const resolved: JournalRelatedDoc[] = []
          const seen = new Set<string>()
          for (const m of lineMemos || []) {
            const parsed = parseLineMemoLink(m)
            if (!parsed) continue
            const doc = await resolveLineMemoLink(parsed, brandId)
            if (!doc) continue
            const key = `${doc.kind}:${doc.id}`
            if (seen.has(key)) continue
            seen.add(key)
            resolved.push(doc)
          }
          return resolved
        })(),
      ])

      if (cancelled) return

      const docs: JournalRelatedDoc[] = []
      const seen = new Set<string>()

      if (docKind && sourceId) {
        const key = `${docKind}:${sourceId}`
        seen.add(key)
        docs.push({
          kind: docKind,
          id: sourceId,
          label: primaryLabel || 'Source document',
        })
      }

      for (const doc of [...related, ...lineLinks]) {
        const key = `${doc.kind}:${doc.id}`
        if (seen.has(key)) continue
        seen.add(key)
        docs.push(doc)
      }

      setAllDocs(docs)
      setLoading(false)
      loadedForKeyRef.current = loadKey
    })()

    return () => {
      cancelled = true
    }
  }, [expectsDocs, loadKey, sourceType, sourceId, brandId, docKind, lineMemosKey])

  if (!expectsDocs) return null
  if (loading && allDocs.length === 0) {
    return <JournalSupportingDocsSkeleton linkCount={docKind && sourceId ? 2 : 1} />
  }
  if (!allDocs.length) return null

  return (
    <div className="mb-3 pb-2 border-b border-gray-200">
      <p className={`${SUPPORTING_DOCS_FONT} uppercase tracking-wider text-gray-500 mb-1.5`}>
        Supporting documents
      </p>
      <div className={`flex flex-wrap items-center gap-y-1 ${SUPPORTING_DOCS_FONT}`}>
        {allDocs.map((doc, index) => (
          <Fragment key={`${doc.kind}-${doc.id}`}>
            {index > 0 && (
              <span className="text-gray-300 select-none px-2" aria-hidden="true">
                |
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenDocument({
                  kind: doc.kind,
                  id: doc.id,
                  journalEntryId:
                    doc.kind === 'opening_balance' || doc.kind === 'year_end_close'
                      ? journalEntryId
                      : undefined,
                  journalSourceType:
                    doc.kind === docKind && docKind === 'customer_order' ? sourceType : undefined,
                })
              }}
              className="text-blue-700 hover:text-blue-900 hover:underline text-left"
            >
              {doc.label}
            </button>
          </Fragment>
        ))}
      </div>
    </div>
  )
}
