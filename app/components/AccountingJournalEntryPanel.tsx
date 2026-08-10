'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { AccountingJournalEntry } from '../../lib/supabase'
import { loadJournalEntryById, reverseJournalEntry } from '../../lib/accounting-journal-service'
import { Modal } from './Modal'
import {
  JournalLineMemoLink,
  JournalMemoLinks,
  JournalSupportingDocs,
} from './JournalMemoLinks'
import {
  JournalSourceModalHost,
  type JournalDocOpenRequest,
} from './JournalSourceModalHost'
import { formatGlPhp } from './AccountingLedgerTable'
import { journalSourceTagClass } from './AccountingJournal'
import { useBrands } from '../contexts/BrandsContext'
import {
  getFranchiseJournalTag,
  getFranchiseJournalTagClasses,
  getFranchiseJournalTagTitle,
} from '../../lib/brand-colors'

export function AccountingJournalEntryPanel({
  entryId,
  currentUsername,
  brandId,
  themeBtn,
  readOnlyMode = false,
  onReversed,
  onClose,
  onOpenJournalEntry,
}: {
  entryId: string
  currentUsername: string
  brandId?: string
  themeBtn?: string
  readOnlyMode?: boolean
  onReversed?: () => void
  onClose: () => void
  onOpenJournalEntry?: (entryId: string) => void
}) {
  const [entry, setEntry] = useState<AccountingJournalEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [reversing, setReversing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openDoc, setOpenDoc] = useState<JournalDocOpenRequest | null>(null)
  const { brands } = useBrands()

  const franchiseTag = useMemo(() => {
    if (!entry) return null
    if (entry.franchise_brand_id) {
      const brand = brands.find((b) => b.id === entry.franchise_brand_id)
      return getFranchiseJournalTag(brand)
    }
    return 'HQ' as const
  }, [entry, brands])

  const handleOpenDocument = useCallback(
    (req: JournalDocOpenRequest) => {
      if (req.kind === 'journal_entry' && onOpenJournalEntry) {
        onOpenJournalEntry(req.id)
        return
      }
      setOpenDoc(req)
    },
    [onOpenJournalEntry]
  )

  useEffect(() => {
    setLoading(true)
    void loadJournalEntryById(entryId)
      .then(setEntry)
      .finally(() => setLoading(false))
  }, [entryId])

  const handleReverse = async () => {
    if (!entry || entry.status !== 'posted') return
    if (!confirm(`Reverse ${entry.entry_number}? This posts an offsetting entry.`)) return
    setReversing(true)
    setError(null)
    try {
      await reverseJournalEntry(entry.id, currentUsername)
      onReversed?.()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reversal failed')
    } finally {
      setReversing(false)
    }
  }

  const lineMemos = (entry?.lines || []).map((l) => l.memo)

  return (
    <>
      <JournalSourceModalHost
        open={openDoc}
        onClose={() => setOpenDoc(null)}
        brandId={brandId}
        themeBtn={themeBtn}
        onOpenJournalEntry={onOpenJournalEntry}
      />
      <Modal onClose={onClose} zIndex={60} align="center">
        <div className="bg-white rounded-lg max-w-lg w-full max-h-[85vh] overflow-y-auto">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Journal entry</h3>
            <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            {loading && <p className="text-sm text-gray-500">Loading…</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {entry && (
              <>
                <div className="text-sm space-y-1">
                  <p className="flex flex-wrap items-center gap-2">
                    {franchiseTag ? (
                      <span
                        className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${getFranchiseJournalTagClasses(franchiseTag)}`}
                        title={getFranchiseJournalTagTitle(franchiseTag)}
                      >
                        {franchiseTag}
                      </span>
                    ) : null}
                    <span className="font-medium">{entry.entry_number}</span>
                    <span className="text-gray-500">· {entry.entry_date}</span>
                  </p>
                  <div className="mt-1">
                    <p className="text-xs text-gray-500 mb-0.5">Description</p>
                    <JournalMemoLinks
                      memo={entry.memo}
                      sourceType={entry.source_type}
                      sourceId={entry.source_id}
                      journalEntryId={entry.id}
                    />
                  </div>
                  <p className="text-xs text-gray-500 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${journalSourceTagClass(entry.source_type)}`}
                    >
                      {entry.source_type.replace(/_/g, ' ')}
                    </span>
                    <span>· {entry.status}</span>
                    {entry.posted_at && (
                      <span>
                        · posted{' '}
                        {new Date(entry.posted_at).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </p>
                </div>
                <JournalSupportingDocs
                  sourceType={entry.source_type}
                  sourceId={entry.source_id}
                  journalEntryId={entry.id}
                  brandId={brandId}
                  lineMemos={lineMemos}
                  onOpenDocument={handleOpenDocument}
                />
                <table className="w-full text-xs border rounded">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-2 py-1">Account</th>
                      <th className="text-left px-2 py-1">Description</th>
                      <th className="text-right px-2 py-1">Debit</th>
                      <th className="text-right px-2 py-1">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(entry.lines || []).map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="px-2 py-1">
                          {l.account?.code} {l.account?.name}
                        </td>
                        <td className="px-2 py-1">
                          <JournalLineMemoLink memo={l.memo} />
                        </td>
                        <td className="text-right px-2 py-1 tabular-nums">
                          {Number(l.debit) > 0 ? formatGlPhp(Number(l.debit)) : '—'}
                        </td>
                        <td className="text-right px-2 py-1 tabular-nums">
                          {Number(l.credit) > 0 ? formatGlPhp(Number(l.credit)) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {entry.status === 'posted' && !readOnlyMode && (
                  <button
                    type="button"
                    disabled={reversing}
                    onClick={() => void handleReverse()}
                    className="text-sm px-3 py-1.5 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
                  >
                    {reversing ? 'Reversing…' : 'Reverse entry'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}
