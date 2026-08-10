'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { AccountingJournalEntry } from '../../lib/supabase'
import { loadJournalEntryById } from '../../lib/accounting-journal-service'
import { Modal } from './Modal'
import { formatGlPhp } from './AccountingLedgerTable'

export function OpeningBalanceViewModal({
  journalEntryId,
  onClose,
}: {
  journalEntryId: string
  onClose: () => void
}) {
  const [entry, setEntry] = useState<AccountingJournalEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void loadJournalEntryById(journalEntryId)
      .then((data) => {
        if (cancelled) return
        if (!data) setError('Opening balance entry not found')
        else setEntry(data)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [journalEntryId])

  return (
    <Modal onClose={onClose} align="center" zIndex={70}>
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Opening balances</h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          {loading && <p className="text-gray-500">Loading…</p>}
          {error && <p className="text-red-600">{error}</p>}
          {entry && (
            <>
              <p className="text-xs text-gray-500">
                {entry.entry_number} · {entry.entry_date}
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
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums text-green-700">
                        {Number(l.debit) > 0 ? formatGlPhp(Number(l.debit)) : '—'}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums text-red-700">
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
