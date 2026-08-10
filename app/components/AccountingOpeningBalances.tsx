'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AccountingAccount, Brand } from '../../lib/supabase'
import { ensureCoreGlAccountDefaults, loadAccounts } from '../../lib/accounting-coa-seed'
import { ensureVoucherSettings } from '../../lib/accounting-voucher-service'
import {
  loadOpeningBalanceEntry,
  postOpeningBalance,
  type OpeningBalanceLineInput,
} from '../../lib/accounting-opening-balance'
import { periodRangeFromFilter } from '../../lib/accounting-reports'

type RowState = OpeningBalanceLineInput & { code: string; name: string }

function emptyRow(): RowState {
  return { account_id: '', code: '', name: '', debit: 0, credit: 0 }
}

function defaultOpeningRows(
  accounts: Awaited<ReturnType<typeof loadAccounts>>,
  cashAccountId?: string | null
): RowState[] {
  const cash =
    accounts.find((a) => a.id === cashAccountId) ||
    accounts.find((a) => a.code === '1000')
  const equity = accounts.find((a) => a.code === '3000')
  const rows: RowState[] = []
  if (cash) {
    rows.push({
      account_id: cash.id,
      code: cash.code,
      name: cash.name,
      debit: 0,
      credit: 0,
    })
  }
  if (equity) {
    rows.push({
      account_id: equity.id,
      code: equity.code,
      name: equity.name,
      debit: 0,
      credit: 0,
    })
  }
  return rows.length ? rows : [emptyRow(), emptyRow()]
}

export function AccountingOpeningBalances({
  selectedBrand,
  currentUsername,
  onPosted,
  onOpenJournalEntry,
}: {
  selectedBrand: Brand | null
  currentUsername: string
  onPosted?: (entryNumber: string) => void
  onOpenJournalEntry?: (entryId: string) => void
}) {
  const brandId = selectedBrand?.id || ''
  const [accounts, setAccounts] = useState<AccountingAccount[]>([])
  const [rows, setRows] = useState<RowState[]>([emptyRow(), emptyRow()])
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [postedEntry, setPostedEntry] = useState<{ id: string; entry_number: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    try {
      await ensureCoreGlAccountDefaults(brandId)
      const [accts, existing, settings] = await Promise.all([
        loadAccounts(brandId, false),
        loadOpeningBalanceEntry(brandId),
        ensureVoucherSettings(brandId),
      ])
      setAccounts(accts)
      const accountById = new Map(accts.map((a) => [a.id, a]))

      if (existing) {
        setPostedEntry({ id: existing.id, entry_number: existing.entry_number })
        setEntryDate(existing.entry_date)
        const postedRows = (existing.lines || [])
          .filter((l) => (Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0)
          .map((l) => {
            const acct = accountById.get(l.account_id)
            return {
              account_id: l.account_id,
              code: acct?.code || l.account?.code || '',
              name: acct?.name || l.account?.name || '',
              debit: Number(l.debit) || 0,
              credit: Number(l.credit) || 0,
            }
          })
        setRows(postedRows.length ? postedRows : [emptyRow()])
      } else {
        setPostedEntry(null)
        const { fromDate } = periodRangeFromFilter('year')
        setEntryDate(fromDate)
        setRows(defaultOpeningRows(accts, settings.default_cash_account_id))
      }
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + (Number(r.debit) || 0), 0)
    const credit = rows.reduce((s, r) => s + (Number(r.credit) || 0), 0)
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.005 && debit > 0 }
  }, [rows])

  const usedAccountIds = useMemo(
    () => new Set(rows.map((r) => r.account_id).filter(Boolean)),
    [rows]
  )

  const updateRow = (idx: number, patch: Partial<RowState>) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r
        const next = { ...r, ...patch }
        if (patch.account_id) {
          const acct = accounts.find((a) => a.id === patch.account_id)
          next.code = acct?.code || ''
          next.name = acct?.name || ''
        }
        if (patch.debit != null && patch.debit > 0) next.credit = 0
        if (patch.credit != null && patch.credit > 0) next.debit = 0
        return next
      })
    )
  }

  const handleSave = async () => {
    if (!brandId || postedEntry) return
    setSaving(true)
    setError(null)
    try {
      const entry = await postOpeningBalance({
        brandId,
        entryDate,
        lines: rows.map((r) => ({
          account_id: r.account_id,
          debit: r.debit,
          credit: r.credit,
        })),
        postedBy: currentUsername,
      })
      setPostedEntry({ id: entry.id, entry_number: entry.entry_number })
      onPosted?.(entry.entry_number)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to post opening balances')
    } finally {
      setSaving(false)
    }
  }

  if (!brandId) return null

  return (
    <div className="rounded-lg border border-gray-200 p-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Opening balances</h3>
          <p className="text-xs text-gray-600 mt-0.5">
            Starting balances for cash, assets, and equity. One entry per brand.
          </p>
        </div>
        {!postedEntry && (
          <div className="shrink-0">
            <label className="block text-xs font-medium text-gray-600 mb-0.5">As-of date</label>
            <input
              type="date"
              className="border rounded-lg px-2 py-1.5 text-sm"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading accounts…</p>
      ) : (
        <>
          {postedEntry && (
            <p className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              Posted as{' '}
              {onOpenJournalEntry ? (
                <button
                  type="button"
                  className="font-mono underline"
                  onClick={() => onOpenJournalEntry(postedEntry.id)}
                >
                  {postedEntry.entry_number}
                </button>
              ) : (
                <span className="font-mono">{postedEntry.entry_number}</span>
              )}
              {' · '}
              {entryDate}. Reverse in Journal to change.
            </p>
          )}

          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Account</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-700 w-28">Debit</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-700 w-28">Credit</th>
                  {!postedEntry && <th className="w-8" aria-hidden />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((r, idx) => (
                  <tr key={`${r.account_id}-${idx}`}>
                    <td className="px-3 py-1.5">
                      {postedEntry ? (
                        <span className="text-sm">
                          <span className="font-mono text-xs text-gray-500">{r.code}</span>{' '}
                          {r.name}
                        </span>
                      ) : (
                        <select
                          className="w-full border rounded-lg px-2 py-1 text-sm"
                          value={r.account_id}
                          onChange={(e) => updateRow(idx, { account_id: e.target.value })}
                        >
                          <option value="">Select account…</option>
                          {accounts.map((a) => (
                            <option
                              key={a.id}
                              value={a.id}
                              disabled={usedAccountIds.has(a.id) && a.id !== r.account_id}
                            >
                              {a.code} {a.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {postedEntry ? (
                        <span className="block text-right tabular-nums text-sm">
                          {r.debit > 0
                            ? `₱${r.debit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                            : '—'}
                        </span>
                      ) : (
                        <input
                          type="number"
                          className="w-full border rounded-lg px-2 py-1 text-sm text-right tabular-nums"
                          min={0}
                          step="0.01"
                          value={r.debit || ''}
                          onChange={(e) =>
                            updateRow(idx, { debit: parseFloat(e.target.value) || 0 })
                          }
                        />
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {postedEntry ? (
                        <span className="block text-right tabular-nums text-sm">
                          {r.credit > 0
                            ? `₱${r.credit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                            : '—'}
                        </span>
                      ) : (
                        <input
                          type="number"
                          className="w-full border rounded-lg px-2 py-1 text-sm text-right tabular-nums"
                          min={0}
                          step="0.01"
                          value={r.credit || ''}
                          onChange={(e) =>
                            updateRow(idx, { credit: parseFloat(e.target.value) || 0 })
                          }
                        />
                      )}
                    </td>
                    {!postedEntry && (
                      <td className="px-1 py-1.5 text-center">
                        <button
                          type="button"
                          className="text-red-600 text-sm leading-none disabled:opacity-30"
                          disabled={rows.length <= 1}
                          onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label="Remove line"
                        >
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!postedEntry && (
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={() => setRows((prev) => [...prev, emptyRow()])}
            >
              + Add account
            </button>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-sm ${totals.balanced ? 'text-green-700' : 'text-red-700'}`}>
              Debits ₱{totals.debit.toLocaleString('en-PH', { minimumFractionDigits: 2 })} · Credits
              ₱{totals.credit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              {totals.balanced ? ' (balanced)' : ' (not balanced)'}
            </p>
            {!postedEntry && (
              <button
                type="button"
                disabled={saving || !totals.balanced}
                onClick={() => void handleSave()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 shrink-0"
              >
                {saving ? 'Posting…' : 'Save opening balances'}
              </button>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </>
      )}
    </div>
  )
}
