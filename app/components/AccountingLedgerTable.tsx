'use client'

import {
  JournalDescriptionText,
  JournalLineMemoLink,
  JournalMemoLinks,
  JournalSupportingDocs,
} from './JournalMemoLinks'

export type GlLedgerRow = {
  entry_date: string
  entry_number: string
  journal_entry_id: string
  memo: string | null
  source_type?: string
  source_id?: string | null
  debit: number
  credit: number
  running_balance: number
}

function formatPhp(amount: number) {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
}

interface Props {
  rows: GlLedgerRow[]
  openingBalance?: number
  brandId?: string
  themeBtn?: string
  onOpenJournalEntry?: (entryId: string) => void
  emptyMessage?: string
}

export function AccountingLedgerTable({
  rows,
  openingBalance = 0,
  brandId,
  themeBtn,
  onOpenJournalEntry,
  emptyMessage = 'No posted activity for this account in the selected period.',
}: Props) {
  if (rows.length === 0 && openingBalance === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 border-b text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="text-left px-4 py-2.5">Date</th>
              <th className="text-left px-4 py-2.5">JE #</th>
              <th className="text-left px-4 py-2.5">Description</th>
              <th className="text-right px-4 py-2.5">Debit</th>
              <th className="text-right px-4 py-2.5">Credit</th>
              <th className="text-right px-4 py-2.5">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr className="bg-slate-50/80 text-gray-600">
              <td className="px-4 py-2.5 whitespace-nowrap text-xs">—</td>
              <td className="px-4 py-2.5 text-xs">—</td>
              <td className="px-4 py-2.5 text-xs font-medium">Opening balance</td>
              <td className="px-4 py-2.5 text-right">—</td>
              <td className="px-4 py-2.5 text-right">—</td>
              <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900">
                {formatPhp(openingBalance)}
              </td>
            </tr>
            {rows.map((r, i) => (
              <tr key={`${r.journal_entry_id}-${i}`} className="hover:bg-gray-50/80">
                <td className="px-4 py-2.5 whitespace-nowrap">{r.entry_date}</td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {r.journal_entry_id && onOpenJournalEntry ? (
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() => onOpenJournalEntry(r.journal_entry_id)}
                    >
                      {r.entry_number}
                    </button>
                  ) : (
                    r.entry_number
                  )}
                </td>
                <td className="px-4 py-2.5 max-w-[240px]">
                  {r.source_type && r.source_id ? (
                    <JournalMemoLinks
                      memo={r.memo}
                      sourceType={r.source_type}
                      sourceId={r.source_id}
                      journalEntryId={r.journal_entry_id}
                      compact
                    />
                  ) : (
                    <JournalDescriptionText text={r.memo} compact />
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-green-700">
                  {r.debit > 0 ? formatPhp(r.debit) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-red-700">
                  {r.credit > 0 ? formatPhp(r.credit) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                  {formatPhp(r.running_balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
    </div>
  )
}

export { formatPhp as formatGlPhp }
