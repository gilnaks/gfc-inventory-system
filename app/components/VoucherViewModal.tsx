'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { AccountingVoucher, AccountingVoucherLine } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import { Modal } from './Modal'
import { VoucherProcurementSupportingDocs } from './VoucherProcurementSupportingDocs'

function lineTotal(lines: AccountingVoucherLine[]) {
  return lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
}

function statusBadgeClass(status: string) {
  if (status === 'cancelled') return 'bg-gray-100 text-gray-600'
  if (status === 'draft') return 'bg-gray-100 text-gray-700'
  if (status === 'submitted') return 'bg-yellow-100 text-yellow-800'
  if (status === 'approved') return 'bg-blue-100 text-blue-800'
  if (status === 'paid' || status === 'liquidated') return 'bg-green-100 text-green-800'
  if (status === 'released') return 'bg-purple-100 text-purple-800'
  return 'bg-gray-100 text-gray-700'
}

export function VoucherViewModal({
  voucher,
  brandId,
  themeBtn,
  jeNumber,
  onClose,
  onPrint,
  onOpenJe,
  zIndex = 70,
}: {
  voucher: AccountingVoucher
  brandId?: string
  themeBtn?: string
  jeNumber?: string
  onClose: () => void
  onPrint?: () => void
  onOpenJe?: () => void
  zIndex?: number
}) {
  const total = lineTotal(voucher.lines || [])
  const [bankLabel, setBankLabel] = useState<string | null>(null)

  useEffect(() => {
    if (voucher.voucher_type !== 'payment' || !voucher.bank_account_id) {
      setBankLabel(null)
      return
    }
    void supabase
      .from('accounting_bank_accounts')
      .select('name, account_last4')
      .eq('id', voucher.bank_account_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          setBankLabel(null)
          return
        }
        const last4 = data.account_last4 ? ` ····${data.account_last4}` : ''
        setBankLabel(`${data.name}${last4}`)
      })
  }, [voucher.voucher_type, voucher.bank_account_id])

  return (
    <Modal onClose={onClose} align="center" zIndex={zIndex}>
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">{voucher.voucher_number}</h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <p>
            <span className={`text-xs px-2 py-0.5 rounded ${statusBadgeClass(voucher.status)}`}>
              {voucher.status}
            </span>{' '}
            {voucher.voucher_date} · {voucher.payee_name || '—'}
          </p>
          {voucher.voucher_type === 'payment' && bankLabel && (
            <p className="text-gray-600">Bank: {bankLabel}</p>
          )}
          {voucher.voucher_type === 'payment' && voucher.payment_mode && (
            <p className="text-gray-600 capitalize">
              Payment mode: {voucher.payment_mode.replace(/_/g, ' ')}
            </p>
          )}
          {jeNumber && onOpenJe && (
            <p>
              Journal:{' '}
              <button type="button" className="text-blue-600 font-mono text-xs" onClick={onOpenJe}>
                {jeNumber}
              </button>
            </p>
          )}
          <table className="w-full text-xs border rounded">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-2 py-1">Description</th>
                <th className="text-right px-2 py-1">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(voucher.lines || []).map((l) => (
                <tr key={l.id || l.line_no} className="border-t">
                  <td className="px-2 py-1">{l.description}</td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    ₱{Number(l.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-right font-medium">
            Total: ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </p>
          {voucher.voucher_type === 'payment' && voucher.proof_of_payment_url && (
            <p>
              Proof of payment:{' '}
              <a
                href={voucher.proof_of_payment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-xs"
              >
                View attachment
              </a>
            </p>
          )}
          {voucher.voucher_type === 'payment' && (voucher.links?.length ?? 0) > 0 && (
            <VoucherProcurementSupportingDocs
              links={voucher.links || []}
              brandId={brandId}
              themeBtn={themeBtn}
              divider="above"
            />
          )}
          {onPrint && (
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onPrint} className="text-xs px-3 py-1.5 border rounded">
                Print
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
