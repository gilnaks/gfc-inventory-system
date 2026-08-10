'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, type AccountingAccount, type AccountingAccountType, type Brand } from '../../lib/supabase'
import { loadAccounts } from '../../lib/accounting-coa-seed'
import { Plus, Search, Settings } from 'lucide-react'
import { AccountingBooksTableSkeleton } from './AccountingBooksSkeletons'

const ACCOUNT_TYPES: AccountingAccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense']

const TYPE_LABELS: Record<AccountingAccountType, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expenses',
}

const TYPE_BADGE_CLASS: Record<AccountingAccountType, string> = {
  asset: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  liability: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  equity: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  revenue: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  expense: 'bg-rose-50 text-rose-700 ring-rose-600/20',
}

interface Props {
  selectedBrand: Brand | null
  onOpenDefaultAccounts?: () => void
  /** Hide title block when rendered inside a modal. */
  embedded?: boolean
}

export function AccountingChartOfAccounts({
  selectedBrand,
  onOpenDefaultAccounts,
  embedded = false,
}: Props) {
  const brandId = selectedBrand?.id || ''
  const [accounts, setAccounts] = useState<AccountingAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<AccountingAccount> | null>(null)
  const [search, setSearch] = useState('')
  const [glBalances, setGlBalances] = useState<Map<string, number>>(new Map())

  const refresh = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    try {
      const [accts, { data: glRows }] = await Promise.all([
        loadAccounts(brandId, false),
        supabase.from('accounting_gl_balances').select('account_id, balance').eq('brand_id', brandId),
      ])
      setAccounts(accts)
      const balanceMap = new Map<string, number>()
      for (const row of glRows || []) {
        const id = row.account_id as string
        balanceMap.set(id, (balanceMap.get(id) || 0) + (Number(row.balance) || 0))
      }
      setGlBalances(balanceMap)
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter((a) => {
      const haystack = [a.code, a.name, a.account_type].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [accounts, search])

  const groupedAccounts = useMemo(() => {
    const groups = new Map<AccountingAccountType, AccountingAccount[]>()
    for (const type of ACCOUNT_TYPES) {
      groups.set(type, [])
    }
    for (const account of filteredAccounts) {
      const type = account.account_type as AccountingAccountType
      if (groups.has(type)) {
        groups.get(type)!.push(account)
      }
    }
    return ACCOUNT_TYPES.map((type) => ({
      type,
      label: TYPE_LABELS[type],
      accounts: (groups.get(type) || []).sort((a, b) => a.code.localeCompare(b.code)),
    })).filter((g) => g.accounts.length > 0)
  }, [filteredAccounts])

  const activeCount = useMemo(() => accounts.filter((a) => a.is_active).length, [accounts])

  const saveAccount = async () => {
    if (!brandId || !form?.code?.trim() || !form.name?.trim()) return
    setSaving(true)
    try {
      const row = {
        brand_id: brandId,
        code: form.code.trim(),
        name: form.name.trim(),
        account_type: form.account_type || 'expense',
        normal_balance:
          form.normal_balance ||
          (['asset', 'expense'].includes(form.account_type || 'expense') ? 'debit' : 'credit'),
        is_active: form.is_active !== false,
        is_system: false,
      }
      if (form.id) {
        const { error } = await supabase.from('accounting_accounts').update(row).eq('id', form.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('accounting_accounts').insert([row])
        if (error) throw error
      }
      setForm(null)
      await refresh()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to save account')
    } finally {
      setSaving(false)
    }
  }

  const openNewForm = () => {
    setForm({
      code: '',
      name: '',
      account_type: 'expense',
      normal_balance: 'debit',
      is_active: true,
    })
  }

  if (!brandId) {
    return <p className="text-sm text-gray-500">Select a brand to manage accounts.</p>
  }

  return (
    <div className="space-y-4">
      <div
        className={
          embedded
            ? 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
            : 'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3'
        }
      >
        {!embedded ? (
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Chart of Accounts</h2>
            <p className="text-sm text-gray-600 mt-0.5">Manage accounts for this brand.</p>
          </div>
        ) : (
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, name, or type…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!embedded && (
            <div className="relative flex-1 min-w-[200px] sm:min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search accounts…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
          )}
          {embedded ? (
            <span className="text-xs text-gray-500 tabular-nums px-2">
              {activeCount} active · {accounts.length} total
            </span>
          ) : null}
          {onOpenDefaultAccounts && (
            <button
              type="button"
              onClick={onOpenDefaultAccounts}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Settings className="h-4 w-4" />
              Default accounts
            </button>
          )}
          <button
            type="button"
            onClick={openNewForm}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add account
          </button>
        </div>
      </div>

      {form && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">
              {form.id ? 'Edit account' : 'New account'}
            </h3>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="text-xs text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block text-sm">
              <span className="text-gray-600 text-xs font-medium mb-1 block">Code</span>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                placeholder="e.g. 1200"
                value={form.code || ''}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-gray-600 text-xs font-medium mb-1 block">Name</span>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                placeholder="Account name"
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 text-xs font-medium mb-1 block">Type</span>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                value={form.account_type || 'expense'}
                onChange={(e) => {
                  const account_type = e.target.value as AccountingAccountType
                  setForm({
                    ...form,
                    account_type,
                    normal_balance: ['asset', 'expense'].includes(account_type) ? 'debit' : 'credit',
                  })
                }}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active !== false}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <span className="text-gray-700">Active account</span>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveAccount()}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : form.id ? 'Save changes' : 'Create account'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <AccountingBooksTableSkeleton columnCount={5} rows={12} lastColumnActions />
      ) : groupedAccounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-6 py-12 text-center">
          <p className="text-sm font-medium text-gray-700">
            {search ? 'No accounts match your search' : 'No accounts yet'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {search ? 'Try a different code or name.' : 'Add your first GL account to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedAccounts.map(({ type, label, accounts: typeAccounts }) => (
            <section key={type} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TYPE_BADGE_CLASS[type]}`}
                  >
                    {label}
                  </span>
                  <span className="text-xs text-gray-500">{typeAccounts.length} accounts</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead className="bg-white border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium w-28">Code</th>
                      <th className="text-left px-4 py-2.5 font-medium">Name</th>
                      <th className="text-center px-4 py-2.5 font-medium w-24">Balance</th>
                      <th className="text-center px-4 py-2.5 font-medium w-20">Active</th>
                      <th className="text-right px-4 py-2.5 font-medium w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {typeAccounts.map((a) => (
                      <tr
                        key={a.id}
                        className={`hover:bg-gray-50/80 ${!a.is_active ? 'opacity-55' : ''}`}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs font-medium text-gray-800">
                          {a.code}
                        </td>
                        <td className="px-4 py-2.5 text-gray-900">
                          {a.name}
                          {a.is_system ? (
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">
                              System
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs tabular-nums text-gray-800">
                          {glBalances.has(a.id)
                            ? `₱${(glBalances.get(a.id) || 0).toLocaleString('en-PH', {
                                minimumFractionDigits: 2,
                              })}`
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={`inline-flex h-2 w-2 rounded-full ${
                              a.is_active ? 'bg-emerald-500' : 'bg-gray-300'
                            }`}
                            title={a.is_active ? 'Active' : 'Inactive'}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {!a.is_system && (
                            <button
                              type="button"
                              className="text-xs font-medium text-blue-600 hover:text-blue-800"
                              onClick={() => setForm(a)}
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
