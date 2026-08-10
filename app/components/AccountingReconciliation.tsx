'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import {
  supabase,
  ACCOUNTING_VOUCHER_PREFILL_KEY,
  type AccountingVoucher,
  type Brand,
  type AccountingVoucherSettings,
  type AccountingBankAccount,
  type AccountingAccount,
} from '../../lib/supabase'
import { loadVouchers } from '../../lib/accounting-voucher-service'
import { emptyPaymentVoucherPrefill } from '../../lib/accounting-voucher-prefill'
import { loadAccounts } from '../../lib/accounting-coa-seed'
import {
  loadBankAccounts,
  saveBankAccount,
  loadGlCashBalanceAsOfDate,
  loadCashGlTransactionsForPeriod,
  loadBankReconciliationHistory,
  loadBankReconciliationWithItems,
  loadPettyReconciliationHistory,
  type CashGlTransaction,
} from '../../lib/accounting-bank-service'
import {
  AccountingReconciliationBankSkeleton,
  AccountingReconciliationPettySkeleton,
} from './AccountingBooksSkeletons'
import { AccountingStatusBanner } from './AccountingStatusBanner'

interface Props {
  selectedBrand: Brand | null
  settings: AccountingVoucherSettings | null
  currentUsername?: string
  readOnlyMode?: boolean
  onOpenReplenishmentPv?: () => void
  onOpenJournalEntry?: (entryId: string) => void
}

function lineTotal(lines: { amount: number }[] | undefined) {
  return (lines || []).reduce((s, l) => s + (Number(l.amount) || 0), 0)
}

function formatPhp(amount: number) {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
}

function filterCashGlAccounts(
  accounts: AccountingAccount[],
  settings: AccountingVoucherSettings | null
): AccountingAccount[] {
  return accounts.filter((a) => {
    if (a.account_type !== 'asset' || !a.is_active) return false
    if (a.code === '1010') return false
    if (a.code === '1000') return true
    if (a.id === settings?.default_cash_account_id) return true
    if (/bank|g-cash|gcash/i.test(a.name)) return true
    return false
  })
}

function sourceTypeLabel(sourceType: string) {
  return sourceType.replace(/_/g, ' ')
}

export function AccountingReconciliation({
  selectedBrand,
  settings,
  currentUsername = '',
  readOnlyMode = false,
  onOpenReplenishmentPv,
  onOpenJournalEntry,
}: Props) {
  const brandId = selectedBrand?.id || ''
  const [tab, setTab] = useState<'bank' | 'petty' | 'history'>('bank')
  const [paymentVouchers, setPaymentVouchers] = useState<AccountingVoucher[]>([])
  const [pettyVouchers, setPettyVouchers] = useState<AccountingVoucher[]>([])
  const [bankAccounts, setBankAccounts] = useState<AccountingBankAccount[]>([])
  const [allAccounts, setAllAccounts] = useState<AccountingAccount[]>([])
  const [selectedBankId, setSelectedBankId] = useState('')
  const [glBookBalance, setGlBookBalance] = useState(0)
  const [cashTransactions, setCashTransactions] = useState<CashGlTransaction[]>([])
  const [statementBalance, setStatementBalance] = useState('')
  const [statementDate, setStatementDate] = useState(new Date().toISOString().split('T')[0])
  const [reconNotes, setReconNotes] = useState('')
  const [periodFrom, setPeriodFrom] = useState(`${new Date().getFullYear()}-01-01`)
  const [periodTo, setPeriodTo] = useState(new Date().toISOString().split('T')[0])
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set())
  const [cashOnHand, setCashOnHand] = useState('')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<{ msg: string; variant: 'success' | 'error' | 'info' } | null>(
    null
  )
  const [bankHistory, setBankHistory] = useState<Awaited<ReturnType<typeof loadBankReconciliationHistory>>>([])
  const [pettyHistory, setPettyHistory] = useState<
    Awaited<ReturnType<typeof loadPettyReconciliationHistory>>
  >([])
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
  const [historyDetail, setHistoryDetail] = useState<Awaited<
    ReturnType<typeof loadBankReconciliationWithItems>
  > | null>(null)
  const [newBankName, setNewBankName] = useState('')
  const [newBankAccountNumber, setNewBankAccountNumber] = useState('')
  const [newBankGlId, setNewBankGlId] = useState('')
  const [showAddBank, setShowAddBank] = useState(false)
  const [addingBank, setAddingBank] = useState(false)
  const [pettyCountDate, setPettyCountDate] = useState(new Date().toISOString().split('T')[0])
  const [savingRecon, setSavingRecon] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState<{
    msg: string
    variant: 'success' | 'error' | 'warning' | 'info'
  } | null>(null)

  const fundAmount = Number(settings?.petty_cash_fund_amount) || 5000
  const selectedBank = bankAccounts.find((b) => b.id === selectedBankId)
  const cashGlId = selectedBank?.gl_account_id

  const accountById = useMemo(() => new Map(allAccounts.map((a) => [a.id, a])), [allAccounts])
  const cashGlOptions = useMemo(
    () => filterCashGlAccounts(allAccounts, settings),
    [allAccounts, settings]
  )
  const selectedBankGlLabel = useMemo(() => {
    if (!selectedBank?.gl_account_id) return null
    const acct = accountById.get(selectedBank.gl_account_id)
    return acct ? `${acct.code} — ${acct.name}` : null
  }, [selectedBank?.gl_account_id, accountById])

  const refresh = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    try {
      const [pv, pcv, banks, accounts, bHist, pHist] = await Promise.all([
        loadVouchers(brandId, 'payment'),
        loadVouchers(brandId, 'petty_cash'),
        loadBankAccounts(brandId),
        loadAccounts(brandId),
        loadBankReconciliationHistory(brandId),
        loadPettyReconciliationHistory(brandId),
      ])
      setPaymentVouchers(pv.filter((v) => v.status === 'paid'))
      setPettyVouchers(pcv.filter((v) => v.status === 'liquidated'))
      setBankAccounts(banks)
      setAllAccounts(accounts)
      setBankHistory(bHist)
      setPettyHistory(pHist)
      if (banks.length && !selectedBankId) setSelectedBankId(banks[0].id)
      if (banks.length === 0) setShowAddBank(true)
    } finally {
      setLoading(false)
    }
  }, [brandId, selectedBankId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!brandId || !cashGlId) {
      setGlBookBalance(0)
      setCashTransactions([])
      return
    }
    void Promise.all([
      loadGlCashBalanceAsOfDate(brandId, cashGlId, statementDate),
      loadCashGlTransactionsForPeriod(brandId, cashGlId, periodFrom, periodTo),
    ]).then(([balance, txns]) => {
      setGlBookBalance(balance)
      setCashTransactions(txns)
    })
  }, [brandId, cashGlId, statementDate, periodFrom, periodTo])

  useEffect(() => {
    if (!showAddBank || newBankGlId) return
    const preferred =
      settings?.default_cash_account_id ||
      cashGlOptions.find((a) => a.code === '1000')?.id ||
      cashGlOptions[0]?.id ||
      ''
    if (preferred) setNewBankGlId(preferred)
  }, [showAddBank, newBankGlId, cashGlOptions, settings?.default_cash_account_id])

  useEffect(() => {
    setClearedIds(new Set())
  }, [selectedBankId, periodFrom, periodTo])

  useEffect(() => {
    if (!selectedHistoryId) {
      setHistoryDetail(null)
      return
    }
    void loadBankReconciliationWithItems(selectedHistoryId).then(setHistoryDetail)
  }, [selectedHistoryId])

  const visibleTransactions = cashTransactions.filter((t) => {
    if (!t.voucher_id) return true
    const pv = paymentVouchers.find((v) => v.id === t.voucher_id)
    if (!pv) return true
    if (!pv.bank_account_id) return true
    return pv.bank_account_id === selectedBankId
  })

  const clearedTotal = visibleTransactions
    .filter((t) => clearedIds.has(t.journal_entry_id))
    .reduce((s, t) => s + t.amount, 0)
  const bookActivity = visibleTransactions.reduce((s, t) => s + t.amount, 0)
  const outstanding = bookActivity - clearedTotal
  const stmtBal = parseFloat(statementBalance) || 0
  const hasStatementBalanceInput = statementBalance.trim() !== ''
  const hasClearedEntry = clearedIds.size > 0
  const canSaveBankRecon = Boolean(
    brandId && selectedBankId && hasStatementBalanceInput && hasClearedEntry
  )
  const saveBlockedReason = !selectedBankId
    ? 'Select a bank account.'
    : !hasStatementBalanceInput
      ? 'Enter statement balance from the bank statement.'
      : !hasClearedEntry
        ? 'Clear at least one journal entry that appears on the statement.'
        : null
  const adjustedBook = glBookBalance - outstanding
  const reconDiff = stmtBal - adjustedBook
  const isReconBalanced = hasStatementBalanceInput && Math.abs(reconDiff) < 0.01
  const allVisibleCleared =
    visibleTransactions.length > 0 &&
    visibleTransactions.every((t) => clearedIds.has(t.journal_entry_id))

  const toggleAllCleared = () => {
    if (allVisibleCleared) setClearedIds(new Set())
    else setClearedIds(new Set(visibleTransactions.map((t) => t.journal_entry_id)))
  }

  const canAddBank = Boolean(
    newBankName.trim() && newBankAccountNumber.trim() && newBankGlId && cashGlOptions.length
  )

  const lastReplenishmentDate = paymentVouchers
    .filter((v) => v.payee_kind === 'petty_cash_replenishment')
    .map((v) => v.voucher_date)
    .sort()
    .pop()

  const pcvSinceReplenish = pettyVouchers.filter(
    (v) => !lastReplenishmentDate || v.voucher_date > lastReplenishmentDate
  )
  const pcvExpenses = pcvSinceReplenish.reduce(
    (s, v) => s + (Number(v.actual_expense) || lineTotal(v.lines)),
    0
  )
  const physical = parseFloat(cashOnHand) || 0
  const pettyVariance = fundAmount - (physical + pcvExpenses)

  const prefillReplenishmentPv = () => {
    if (pcvExpenses <= 0) {
      setStatus({ msg: 'No PCV expenses to replenish since last replenishment.', variant: 'info' })
      return
    }
    const prefill = emptyPaymentVoucherPrefill()
    prefill.header = {
      ...prefill.header,
      payee_kind: 'petty_cash_replenishment',
      payee_name: settings?.petty_cash_custodian_name || 'Petty Cash Custodian',
      payment_for: `Petty cash replenishment — ${pcvExpenses.toFixed(2)}`,
      payment_mode: 'bank_gcash',
      bank_account_id: selectedBankId || null,
      prepared_by_name: currentUsername,
    }
    prefill.lines = [{ line_no: 1, description: 'Petty cash replenishment', amount: pcvExpenses }]
    localStorage.setItem(ACCOUNTING_VOUCHER_PREFILL_KEY, JSON.stringify(prefill))
    onOpenReplenishmentPv?.()
  }

  const addBankAccount = async () => {
    if (readOnlyMode) return
    const bankName = newBankName.trim()
    const accountNumber = newBankAccountNumber.trim()
    if (!brandId || !bankName || !accountNumber || !newBankGlId) {
      setStatus({
        msg: 'Enter bank name, account number, and select a GL cash account.',
        variant: 'error',
      })
      return
    }
    setAddingBank(true)
    try {
      const digits = accountNumber.replace(/\D/g, '')
      const account_last4 = digits.length >= 4 ? digits.slice(-4) : digits || null
      await saveBankAccount(brandId, {
        name: `${bankName} - ${accountNumber}`,
        account_last4,
        gl_account_id: newBankGlId,
      })
      setNewBankName('')
      setNewBankAccountNumber('')
      setNewBankGlId('')
      setShowAddBank(false)
      setStatus({ msg: 'Bank account saved.', variant: 'success' })
      await refresh()
    } catch (e: unknown) {
      setStatus({ msg: e instanceof Error ? e.message : 'Save failed', variant: 'error' })
    } finally {
      setAddingBank(false)
    }
  }

  const saveBankRecon = async () => {
    if (readOnlyMode) return
    if (!canSaveBankRecon) {
      const msg = saveBlockedReason || 'Complete reconciliation requirements before saving.'
      setStatus({ msg, variant: 'error' })
      setSaveFeedback({ msg, variant: 'error' })
      return
    }
    setSavingRecon(true)
    setSaveFeedback(null)
    try {
      const { data: recon, error } = await supabase
        .from('accounting_bank_reconciliations')
        .insert([
          {
            brand_id: brandId,
            bank_account_id: selectedBankId,
            statement_date: statementDate,
            statement_ending_balance: stmtBal,
            book_balance: adjustedBook,
            notes: reconNotes.trim() || null,
            reconciled_by: currentUsername,
          },
        ])
        .select()
        .single()
      if (error) throw error

      const items = visibleTransactions.map((t) => ({
        reconciliation_id: recon.id,
        voucher_id: t.voucher_id,
        journal_entry_id: t.journal_entry_id,
        description: t.entry_number + (t.memo ? ` — ${t.memo}` : ''),
        amount: t.amount,
        is_cleared: clearedIds.has(t.journal_entry_id),
      }))
      if (items.length) {
        const { error: itemsErr } = await supabase
          .from('accounting_bank_reconciliation_items')
          .insert(items)
        if (itemsErr) throw itemsErr
      }

      const successMsg = 'Bank reconciliation saved.'
      setStatus({ msg: successMsg, variant: 'success' })
      setSaveFeedback({ msg: successMsg, variant: 'success' })
      setReconNotes('')
      await refresh()
      setTab('history')
      setSelectedHistoryId(recon.id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save reconciliation.'
      setStatus({ msg, variant: 'error' })
      setSaveFeedback({ msg, variant: 'error' })
    } finally {
      setSavingRecon(false)
    }
  }

  const savePettyCount = async () => {
    if (readOnlyMode || !brandId) return
    const { error } = await supabase.from('accounting_petty_cash_reconciliations').insert([
      {
        brand_id: brandId,
        count_date: pettyCountDate,
        fund_amount: fundAmount,
        cash_on_hand: physical,
        pcv_expenses_total: pcvExpenses,
        variance: pettyVariance,
        counted_by: currentUsername,
      },
    ])
    if (error) {
      setStatus({ msg: error.message, variant: 'error' })
      return
    }
    setStatus({ msg: 'Petty cash count saved.', variant: 'success' })
    await refresh()
  }

  if (!brandId) {
    return <p className="text-sm text-gray-500">Select a brand.</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Reconciliation</h2>
        <p className="text-sm text-gray-600 mt-0.5">
          Match bank and petty cash to the books, and review past counts.
        </p>
      </div>
      <AccountingStatusBanner
        message={status?.msg ?? null}
        variant={status?.variant}
        onDismiss={() => setStatus(null)}
      />
      <div className="flex gap-2 border-b flex-wrap">
        {(['bank', 'petty', 'history'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${
              tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            {t === 'bank' ? 'Bank' : t === 'petty' ? 'Petty Cash' : 'History'}
          </button>
        ))}
      </div>

      {loading ? (
        tab === 'bank' ? (
          <AccountingReconciliationBankSkeleton />
        ) : tab === 'petty' ? (
          <AccountingReconciliationPettySkeleton />
        ) : (
          <p className="text-sm text-gray-500">Loading history…</p>
        )
      ) : tab === 'history' ? (
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium mb-2">Bank reconciliations</h3>
            <ul className="text-xs space-y-2 border rounded-lg divide-y max-h-64 overflow-y-auto">
              {bankHistory.length === 0 ? (
                <li className="p-3 text-gray-500">No saved bank reconciliations.</li>
              ) : (
                bankHistory.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedHistoryId(r.id)}
                      className={`w-full text-left p-3 hover:bg-gray-50 ${
                        selectedHistoryId === r.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      {(r as { bank_account?: { name?: string } }).bank_account?.name || 'Bank'} ·{' '}
                      {r.statement_date} · Stmt {formatPhp(Number(r.statement_ending_balance))} · Book{' '}
                      {formatPhp(Number(r.book_balance))}
                    </button>
                  </li>
                ))
              )}
            </ul>
            {historyDetail && (
              <div className="mt-3 border rounded-lg p-3 text-xs space-y-2">
                <p className="font-medium text-gray-900">
                  Items —{' '}
                  {(historyDetail.recon as { bank_account?: { name?: string } }).bank_account?.name ||
                    'Bank'}{' '}
                  · {historyDetail.recon.statement_date}
                </p>
                {historyDetail.recon.notes && (
                  <p className="text-gray-600">Notes: {historyDetail.recon.notes}</p>
                )}
                <ul className="divide-y max-h-48 overflow-y-auto">
                  {historyDetail.items.length === 0 ? (
                    <li className="py-2 text-gray-500">No line items.</li>
                  ) : (
                    historyDetail.items.map((item) => (
                      <li key={item.id} className="py-1.5 flex justify-between gap-2">
                        <span>
                          {item.is_cleared ? '✓ ' : '○ '}
                          {item.description || 'Entry'}
                        </span>
                        <span className="tabular-nums shrink-0">
                          {formatPhp(Number(item.amount))}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Petty cash counts</h3>
            <ul className="text-xs space-y-2 border rounded-lg divide-y max-h-64 overflow-y-auto">
              {pettyHistory.length === 0 ? (
                <li className="p-3 text-gray-500">No saved petty counts.</li>
              ) : (
                pettyHistory.map((r) => (
                  <li key={r.id} className="p-3">
                    {r.count_date} · Fund {formatPhp(Number(r.fund_amount))} · Variance{' '}
                    {formatPhp(Number(r.variance))}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : tab === 'bank' ? (
        <div className="space-y-5">
          {/* Bank selector */}
          <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Bank account</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select the bank to reconcile against its cash account.
                </p>
              </div>
              {!readOnlyMode && (
              <button
                type="button"
                onClick={() => setShowAddBank((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                {showAddBank ? <ChevronDown className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {showAddBank ? 'Hide add bank' : 'Add bank account'}
              </button>
              )}
            </div>

            {bankAccounts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
                No bank accounts yet. Add one below — it will link to a GL cash account (e.g. 1000 Cash in
                Bank).
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="text-xs font-medium text-gray-700 mb-1 block">Reconciling</span>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="text-sm">
                  <span className="text-xs font-medium text-gray-700 mb-1 block">Linked GL account</span>
                  <p className="border border-gray-100 rounded-lg px-3 py-2 bg-gray-50 text-gray-800 text-sm">
                    {selectedBankGlLabel || '—'}
                  </p>
                </div>
              </div>
            )}

            {showAddBank && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4 space-y-3">
                <p className="text-xs text-gray-600">
                  Each bank maps to one GL cash account. Petty cash (1010) is reconciled on the Petty Cash
                  tab.
                </p>
                {cashGlOptions.length === 0 ? (
                  <p className="text-sm text-red-700">
                    No GL cash accounts found. Seed the chart of accounts and ensure account 1000 Cash in Bank
                    exists.
                  </p>
                ) : (
                  <>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <label className="block text-sm">
                        <span className="text-xs font-medium text-gray-700 mb-1 block">Bank name</span>
                        <input
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                          value={newBankName}
                          onChange={(e) => setNewBankName(e.target.value)}
                          placeholder="e.g. BDO"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="text-xs font-medium text-gray-700 mb-1 block">Account number</span>
                        <input
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                          value={newBankAccountNumber}
                          onChange={(e) => setNewBankAccountNumber(e.target.value)}
                          placeholder="e.g. 001234567890"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="text-xs font-medium text-gray-700 mb-1 block">GL cash account</span>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                          value={newBankGlId}
                          onChange={(e) => setNewBankGlId(e.target.value)}
                          required
                        >
                          {cashGlOptions.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} — {a.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {(newBankName.trim() || newBankAccountNumber.trim()) && (
                      <p className="text-xs text-gray-500">
                        Saved as:{' '}
                        <span className="font-medium text-gray-700">
                          {newBankName.trim() || '…'} - {newBankAccountNumber.trim() || '…'}
                        </span>
                      </p>
                    )}
                  </>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={!canAddBank || addingBank}
                    onClick={() => void addBankAccount()}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {addingBank ? 'Saving…' : 'Save bank account'}
                  </button>
                </div>
              </div>
            )}
          </section>

          {bankAccounts.length > 0 && (
            <>
              {/* Statement inputs */}
              <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">Statement & period</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="block text-sm">
                    <span className="text-xs font-medium text-gray-700 mb-1 block">Activity from</span>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={periodFrom}
                      onChange={(e) => setPeriodFrom(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs font-medium text-gray-700 mb-1 block">Activity to</span>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={periodTo}
                      onChange={(e) => setPeriodTo(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs font-medium text-gray-700 mb-1 block">Statement date</span>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={statementDate}
                      onChange={(e) => setStatementDate(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs font-medium text-gray-700 mb-1 block">Statement balance</span>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={statementBalance}
                      onChange={(e) => setStatementBalance(e.target.value)}
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="text-xs font-medium text-gray-700 mb-1 block">Notes (optional)</span>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={reconNotes}
                    onChange={(e) => setReconNotes(e.target.value)}
                  />
                </label>
              </section>

              {/* Summary cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'GL balance', sub: `as of ${statementDate}`, value: formatPhp(glBookBalance) },
                  { label: 'Period activity', sub: 'net cash movement', value: formatPhp(bookActivity) },
                  { label: 'Outstanding', sub: 'uncleared items', value: formatPhp(outstanding) },
                  {
                    label: 'True cash balance',
                    sub: 'GL − outstanding',
                    value: formatPhp(adjustedBook),
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3"
                  >
                    <p className="text-xs text-gray-500">{card.label}</p>
                    <p className="text-lg font-semibold tabular-nums text-gray-900 mt-0.5">{card.value}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{card.sub}</p>
                  </div>
                ))}
              </div>

              {hasStatementBalanceInput ? (
                <div
                  className={`rounded-lg px-4 py-3 text-sm border ${
                    isReconBalanced
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  Statement {formatPhp(stmtBal)} vs true cash balance {formatPhp(adjustedBook)} — difference{' '}
                  {formatPhp(Math.abs(reconDiff))}
                  {isReconBalanced ? ' (balanced)' : ''}
                </div>
              ) : (
                <p className="text-sm text-gray-500 rounded-lg border border-dashed border-gray-200 px-4 py-3">
                  Enter statement balance from the bank statement to compare against true cash balance.
                </p>
              )}

              {/* Transactions */}
              <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b bg-gray-50">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Cash journal entries</h3>
                    <p className="text-xs text-gray-500">Tick items that appear on the bank statement.</p>
                  </div>
                  {visibleTransactions.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleAllCleared}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      {allVisibleCleared ? 'Clear all' : 'Mark all cleared'}
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white border-b text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-2.5 text-left w-12">Clear</th>
                        <th className="px-4 py-2.5 text-left">JE #</th>
                        <th className="px-4 py-2.5 text-left">Date</th>
                        <th className="px-4 py-2.5 text-left">Source</th>
                        <th className="px-4 py-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {visibleTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                            No cash GL entries in this period. Post journals or widen the date range.
                          </td>
                        </tr>
                      ) : (
                        visibleTransactions.map((t) => (
                          <tr key={t.journal_entry_id} className="hover:bg-gray-50/80">
                            <td className="px-4 py-2.5">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300"
                                checked={clearedIds.has(t.journal_entry_id)}
                                onChange={(e) => {
                                  const next = new Set(clearedIds)
                                  if (e.target.checked) next.add(t.journal_entry_id)
                                  else next.delete(t.journal_entry_id)
                                  setClearedIds(next)
                                }}
                              />
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs">
                              {onOpenJournalEntry ? (
                                <button
                                  type="button"
                                  className="text-blue-600 hover:underline"
                                  onClick={() => onOpenJournalEntry(t.journal_entry_id)}
                                >
                                  {t.entry_number}
                                </button>
                              ) : (
                                t.entry_number
                              )}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">{t.entry_date}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-600 capitalize">
                              {sourceTypeLabel(t.source_type)}
                            </td>
                            <td
                              className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                                t.amount >= 0 ? 'text-green-700' : 'text-red-700'
                              }`}
                            >
                              {formatPhp(t.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t bg-gray-50 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-gray-600">
                      Cleared {formatPhp(clearedTotal)} · Outstanding {formatPhp(outstanding)}
                    </p>
                    {!readOnlyMode && (
                    <button
                      type="button"
                      onClick={() => void saveBankRecon()}
                      disabled={savingRecon || !canSaveBankRecon}
                      title={saveBlockedReason ?? undefined}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingRecon ? 'Saving…' : 'Save reconciliation'}
                    </button>
                    )}
                  </div>
                  {!canSaveBankRecon && saveBlockedReason && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-3 py-2">
                      {saveBlockedReason}
                    </p>
                  )}
                  {saveFeedback && (
                    <div
                      className={`text-sm rounded-lg px-3 py-2 border ${
                        saveFeedback.variant === 'success'
                          ? 'bg-green-50 border-green-200 text-green-800'
                          : saveFeedback.variant === 'error'
                            ? 'bg-red-50 border-red-200 text-red-800'
                            : saveFeedback.variant === 'warning'
                              ? 'bg-amber-50 border-amber-200 text-amber-900'
                              : 'bg-blue-50 border-blue-200 text-blue-800'
                      }`}
                    >
                      {saveFeedback.msg}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Each save creates a new reconciliation record. The same journal entry may appear in
                    multiple reconciliations.
                  </p>
                </div>
              </section>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-5 max-w-3xl">
          <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Petty cash</h3>
            <p className="text-xs text-gray-600">
              Physical cash on hand plus liquidated PCV expenses since the last replenishment should
              equal {formatPhp(fundAmount)}.
            </p>
            {settings?.petty_cash_custodian_name && (
              <p className="text-xs text-gray-500">
                Custodian: {settings.petty_cash_custodian_name}
                {settings.petty_cash_custodian_title ? ` · ${settings.petty_cash_custodian_title}` : ''}
              </p>
            )}
          </section>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-gray-500">Petty cash fund</p>
              <p className="text-lg font-semibold tabular-nums mt-0.5">{formatPhp(fundAmount)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-gray-500">PCV expenses</p>
              <p className="text-lg font-semibold tabular-nums mt-0.5">{formatPhp(pcvExpenses)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                since {lastReplenishmentDate || 'no replenishment'}
              </p>
            </div>
            <div
              className={`rounded-xl border px-4 py-3 ${
                Math.abs(pettyVariance) < 0.01
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }`}
            >
              <p className="text-xs text-gray-600">Variance</p>
              <p
                className={`text-lg font-semibold tabular-nums mt-0.5 ${
                  Math.abs(pettyVariance) < 0.01 ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {formatPhp(pettyVariance)}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {Math.abs(pettyVariance) < 0.01 ? 'Balanced' : 'Needs investigation'}
              </p>
            </div>
          </div>

          <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Physical count</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-xs font-medium text-gray-700 mb-1 block">Count date</span>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={pettyCountDate}
                  onChange={(e) => setPettyCountDate(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-xs font-medium text-gray-700 mb-1 block">Cash on hand</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="0.00"
                  value={cashOnHand}
                  onChange={(e) => setCashOnHand(e.target.value)}
                />
              </label>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 text-sm space-y-1">
              <p className="flex justify-between gap-4">
                <span className="text-gray-600">Cash on hand</span>
                <span className="tabular-nums font-medium">{formatPhp(physical)}</span>
              </p>
              <p className="flex justify-between gap-4">
                <span className="text-gray-600">+ PCV expenses</span>
                <span className="tabular-nums font-medium">{formatPhp(pcvExpenses)}</span>
              </p>
              <p className="flex justify-between gap-4 border-t border-gray-200 pt-2 font-medium">
                <span>Should equal fund</span>
                <span className="tabular-nums">{formatPhp(physical + pcvExpenses)}</span>
              </p>
            </div>
          </section>

          {pcvSinceReplenish.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-900">
                  Liquidated PCVs ({pcvSinceReplenish.length})
                </h3>
              </div>
              <ul className="divide-y divide-gray-100 max-h-48 overflow-y-auto text-sm">
                {pcvSinceReplenish.map((v) => (
                  <li key={v.id} className="flex justify-between gap-3 px-4 py-2.5">
                    <span>
                      <span className="font-mono text-xs text-gray-500">{v.voucher_number}</span>
                      <span className="text-gray-400 mx-1">·</span>
                      {v.voucher_date}
                    </span>
                    <span className="tabular-nums font-medium shrink-0">
                      {formatPhp(Number(v.actual_expense) || lineTotal(v.lines))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!readOnlyMode && (
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => void savePettyCount()}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Save count
            </button>
            {Math.abs(pettyVariance) < 0.01 && pcvExpenses > 0 && (
              <button
                type="button"
                onClick={prefillReplenishmentPv}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Create replenishment PV
              </button>
            )}
          </div>
          )}
        </div>
      )}
    </div>
  )
}
