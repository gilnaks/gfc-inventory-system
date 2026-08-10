'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { AccountingJournalEntry, AccountingYearEndClose } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import { loadJournalEntryById } from '../../lib/accounting-journal-service'
import { Modal } from './Modal'
import { formatGlPhp } from './AccountingLedgerTable'

export function YearEndCloseViewModal({
  journalEntryId,
  brandId,
  onClose,
}: {
  journalEntryId: string
  brandId?: string
  onClose: () => void
}) {
  const [closeRecord, setCloseRecord] = useState<AccountingYearEndClose | null>(null)
  const [entry, setEntry] = useState<AccountingJournalEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      const [{ data: closeRow }, je] = await Promise.all([
        supabase
          .from('accounting_year_end_closes')
          .select('*')
          .eq('journal_entry_id', journalEntryId)
          .maybeSingle(),
        loadJournalEntryById(journalEntryId),
      ])
      if (cancelled) return
      if (!je) {
        setError('Year-end close journal entry not found')
        setLoading(false)
        return
      }
      if (brandId && je.brand_id !== brandId) {
        setError('Journal entry does not belong to this brand')
        setLoading(false)
        return
      }
      setCloseRecord((closeRow as AccountingYearEndClose) || null)
      setEntry(je)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [journalEntryId, brandId])

  const fiscalYear =
    closeRecord?.fiscal_year ??
    (entry?.memo?.match(/Year-end close (\d{4})/)?.[1]
      ? Number(entry.memo.match(/Year-end close (\d{4})/)![1])
      : null)

  return (
    <Modal onClose={onClose} align="center" zIndex={70}>
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            {fiscalYear ? `Year-end close ${fiscalYear}` : 'Year-end close'}
          </h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          {loading && <p className="text-gray-500">Loading…</p>}
          {error && <p className="text-red-600">{error}</p>}
          {entry && (
            <>
              <div className="text-xs space-y-1 text-gray-600">
                <p>
                  <span className="font-mono font-medium text-gray-900">{entry.entry_number}</span>
                  {' · '}
                  {entry.entry_date}
                </p>
                {closeRecord?.closed_by && <p>Closed by {closeRecord.closed_by}</p>}
                {closeRecord?.closed_at && (
                  <p>Closed {new Date(closeRecord.closed_at).toLocaleString()}</p>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Revenue and expense accounts closed to retained earnings.
              </p>
              <table className="w-full text-xs border rounded">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-2 py-1">Account</th>
                    <th className="text-right px-2 py-1">Debit</th>
                    <th className="text-right px-2 py-1">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {(entry.lines || []).map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="px-2 py-1">
                        <span className="font-mono text-gray-500 mr-1">{l.account?.code}</span>
                        {l.account?.name}
                        {l.memo && (
                          <span className="block text-[10px] text-gray-400 mt-0.5">{l.memo}</span>
                        )}
                      </td>
                      <td className="text-right px-2 py-1 tabular-nums text-green-700">
                        {Number(l.debit) > 0 ? formatGlPhp(Number(l.debit)) : '—'}
                      </td>
                      <td className="text-right px-2 py-1 tabular-nums text-red-700">
                        {Number(l.credit) > 0 ? formatGlPhp(Number(l.credit)) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
