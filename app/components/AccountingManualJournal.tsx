'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import type { AccountingAccount, AccountingAccountType, AccountingJournalEntry, Brand } from '../../lib/supabase'
import { loadAccounts } from '../../lib/accounting-coa-seed'
import {
  loadJournalEntries,
  saveManualDraftJournal,
  postDraftJournal,
  type DraftJournalLine,
} from '../../lib/accounting-journal-service'
import { validateBalanced } from '../../lib/accounting-journal-balance'
import { AccountingStatusBanner } from './AccountingStatusBanner'
import { JournalDescriptionText } from './JournalMemoLinks'
import { formatGlPhp } from './AccountingLedgerTable'

interface Props {
  selectedBrand: Brand | null
  currentUsername: string
  defaultExpanded?: boolean
  readOnlyMode?: boolean
  onPosted?: () => void
  onOpenJournalEntry?: (entryId: string) => void
}

const ACCOUNT_TYPE_ORDER: AccountingAccountType[] = [
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
]

const ACCOUNT_TYPE_LABELS: Record<AccountingAccountType, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expenses',
}

function emptyLine(no: number): DraftJournalLine {
  return { account_id: '', debit: 0, credit: 0, line_no: no, memo: '' }
}

export function AccountingManualJournal({
  selectedBrand,
  currentUsername,
  defaultExpanded = false,
  readOnlyMode = false,
  onPosted,
  onOpenJournalEntry,
}: Props) {
  if (readOnlyMode) {
    return null
  }
  const brandId = selectedBrand?.id || ''
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [accounts, setAccounts] = useState<AccountingAccount[]>([])
  const [drafts, setDrafts] = useState<AccountingJournalEntry[]>([])
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [memo, setMemo] = useState('')
  const [lines, setLines] = useState<DraftJournalLine[]>([emptyLine(1), emptyLine(2)])
  const [editingId, setEditingId] = useState<string | undefined>()
  const [status, setStatus] = useState<{ msg: string; variant: 'success' | 'error' | 'info' } | null>(
    null
  )
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    if (!brandId) return
    const [accts, entries] = await Promise.all([
      loadAccounts(brandId),
      loadJournalEntries(brandId, { status: 'draft', includeDrafts: true }),
    ])
    setAccounts(accts)
    setDrafts(entries.filter((e) => e.source_type === 'manual'))
  }, [brandId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!expanded) {
      setStatus((prev) =>
        prev?.variant === 'success' || prev?.variant === 'info' ? null : prev
      )
    }
  }, [expanded])

  const accountsByType = useMemo(() => {
    const map = new Map<AccountingAccountType, AccountingAccount[]>()
    for (const type of ACCOUNT_TYPE_ORDER) map.set(type, [])
    for (const a of accounts) {
      const list = map.get(a.account_type) || []
      list.push(a)
      map.set(a.account_type, list)
    }
    return map
  }, [accounts])

  const balance = useMemo(() => validateBalanced(lines), [lines])
  const validLineCount = lines.filter((l) => l.account_id && (Number(l.debit) || Number(l.credit))).length
  const canSaveDraft = validLineCount >= 2

  const updateLine = (idx: number, patch: Partial<DraftJournalLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  const resetForm = () => {
    setEditingId(undefined)
    setMemo('')
    setLines([emptyLine(1), emptyLine(2)])
  }

  const saveDraft = async () => {
    if (!brandId) return
    if (!canSaveDraft) {
      setStatus({ msg: 'Add at least two lines with an account and amount.', variant: 'error' })
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      const valid = lines.filter((l) => l.account_id && (Number(l.debit) || Number(l.credit)))
      await saveManualDraftJournal({
        brandId,
        entryDate,
        memo,
        lines: valid,
        createdBy: currentUsername,
        existingId: editingId,
      })
      setStatus({ msg: 'Draft saved.', variant: 'success' })
      resetForm()
      await refresh()
    } catch (e: unknown) {
      setStatus({ msg: e instanceof Error ? e.message : 'Save failed', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const postDraft = async (id: string) => {
    setSaving(true)
    try {
      await postDraftJournal(id, currentUsername)
      setStatus({ msg: 'Journal posted to GL.', variant: 'success' })
      onPosted?.()
      await refresh()
    } catch (e: unknown) {
      setStatus({ msg: e instanceof Error ? e.message : 'Post failed', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const loadDraftIntoForm = (e: AccountingJournalEntry) => {
    setExpanded(true)
    setEditingId(e.id)
    setEntryDate(e.entry_date)
    setMemo(e.memo || '')
    setLines(
      (e.lines || []).map((l, i) => ({
        account_id: l.account_id,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        line_no: i + 1,
        memo: l.memo || '',
      }))
    )
  }

  if (!brandId) return null

  return (
    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 text-left transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900">Manual journal entry</h3>
          <p className="text-xs text-gray-600 mt-0.5">Post when debits and credits match.</p>
        </div>
        {drafts.length > 0 && (
          <span className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-medium">
            {drafts.length} draft{drafts.length === 1 ? '' : 's'}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-5 border-t border-gray-100 space-y-4 bg-gray-50/40">
          <AccountingStatusBanner
            message={status?.msg ?? null}
            variant={status?.variant}
            onDismiss={() => setStatus(null)}
          />

          <div className="grid sm:grid-cols-3 gap-3 pt-2">
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-gray-500">Draft total debits</p>
              <p className="text-lg font-semibold tabular-nums text-green-700 mt-0.5">
                {formatGlPhp(balance.debit)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-gray-500">Draft total credits</p>
              <p className="text-lg font-semibold tabular-nums text-red-700 mt-0.5">
                {formatGlPhp(balance.credit)}
              </p>
            </div>
            <div
              className={`rounded-xl border px-4 py-3 ${
                balance.ok
                  ? 'border-green-200 bg-green-50'
                  : 'border-amber-200 bg-amber-50'
              }`}
            >
              <p className="text-xs text-gray-600">Balance check</p>
              <p
                className={`text-sm font-semibold mt-0.5 ${
                  balance.ok ? 'text-green-800' : 'text-amber-900'
                }`}
              >
                {balance.ok
                  ? 'Ready to post'
                  : balance.debit === 0 && balance.credit === 0
                    ? 'Enter amounts'
                    : `Off by ${formatGlPhp(Math.abs(balance.debit - balance.credit))}`}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">
              {editingId ? 'Edit draft' : 'New draft'}
            </h4>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-xs font-medium text-gray-700 mb-1 block">Entry date</span>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-xs font-medium text-gray-700 mb-1 block">Description</span>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="e.g. Accrued expense adjustment"
                />
              </label>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-gray-50 border-b text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-2.5">Account</th>
                    <th className="text-right px-3 py-2.5 w-32">Debit</th>
                    <th className="text-right px-3 py-2.5 w-32">Credit</th>
                    <th className="w-10" aria-hidden />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {lines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2">
                        <select
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                          value={line.account_id}
                          onChange={(e) => updateLine(idx, { account_id: e.target.value })}
                        >
                          <option value="">Select account…</option>
                          {ACCOUNT_TYPE_ORDER.map((type) => {
                            const group = accountsByType.get(type) || []
                            if (!group.length) return null
                            return (
                              <optgroup key={type} label={ACCOUNT_TYPE_LABELS[type]}>
                                {group.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.code} — {a.name}
                                  </option>
                                ))}
                              </optgroup>
                            )
                          })}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right tabular-nums"
                          placeholder="0.00"
                          min={0}
                          step="0.01"
                          value={line.debit || ''}
                          onChange={(e) =>
                            updateLine(idx, {
                              debit: parseFloat(e.target.value) || 0,
                              credit: parseFloat(e.target.value) ? 0 : line.credit,
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right tabular-nums"
                          placeholder="0.00"
                          min={0}
                          step="0.01"
                          value={line.credit || ''}
                          onChange={(e) =>
                            updateLine(idx, {
                              credit: parseFloat(e.target.value) || 0,
                              debit: parseFloat(e.target.value) ? 0 : line.debit,
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30 rounded"
                          disabled={lines.length <= 2}
                          onClick={() => lines.length > 2 && setLines(lines.filter((_, i) => i !== idx))}
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-600">Totals</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-green-700">
                      {formatGlPhp(balance.debit)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-red-700">
                      {formatGlPhp(balance.credit)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                onClick={() => setLines([...lines, emptyLine(lines.length + 1)])}
              >
                <Plus className="h-3.5 w-3.5" />
                Add line
              </button>
              <div className="flex-1" />
              {editingId && (
                <button
                  type="button"
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
                  onClick={resetForm}
                >
                  Cancel edit
                </button>
              )}
              <button
                type="button"
                disabled={saving || !canSaveDraft}
                onClick={() => void saveDraft()}
                className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId ? 'Update draft' : 'Save draft'}
              </button>
            </div>
          </div>

          {drafts.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h4 className="text-sm font-semibold text-gray-900">Saved drafts</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Edit or post when debits equal credits.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead className="border-b text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="text-left px-4 py-2.5">JE #</th>
                      <th className="text-left px-4 py-2.5">Date</th>
                      <th className="text-left px-4 py-2.5">Description</th>
                      <th className="text-right px-4 py-2.5">Amount</th>
                      <th className="text-right px-4 py-2.5 w-36">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {drafts.map((d) => {
                      const dBal = validateBalanced(
                        (d.lines || []).map((l, i) => ({
                          account_id: l.account_id,
                          debit: Number(l.debit) || 0,
                          credit: Number(l.credit) || 0,
                          line_no: i + 1,
                        }))
                      )
                      return (
                        <tr key={d.id} className="hover:bg-gray-50/80">
                          <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">
                            {onOpenJournalEntry ? (
                              <button
                                type="button"
                                className="text-blue-600 hover:underline"
                                onClick={() => onOpenJournalEntry(d.id)}
                              >
                                {d.entry_number}
                              </button>
                            ) : (
                              d.entry_number
                            )}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums whitespace-nowrap text-gray-700">
                            {d.entry_date}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 max-w-[200px]">
                            <JournalDescriptionText text={d.memo} compact maxLength={40} />
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            <span className="tabular-nums font-medium">{formatGlPhp(dBal.debit)}</span>
                            {!dBal.ok && (
                              <span className="block text-[11px] text-amber-700">Unbalanced</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              className="text-xs font-medium text-blue-600 hover:underline mr-3"
                              onClick={() => loadDraftIntoForm(d)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-green-700 hover:underline disabled:opacity-40"
                              disabled={saving || !dBal.ok}
                              title={!dBal.ok ? 'Balance debits and credits before posting' : undefined}
                              onClick={() => void postDraft(d.id)}
                            >
                              Post
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
