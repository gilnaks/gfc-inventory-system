'use client'

import { useState } from 'react'
import { X, Upload } from 'lucide-react'
import type { AccountingVoucher, AccountingVoucherLine } from '../../lib/supabase'
import { Modal } from './Modal'
import { uploadPaymentVoucherProof } from '../../lib/upload-payment-voucher-proof'

function lineTotal(lines: AccountingVoucherLine[]) {
  return lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
}

export function MarkPaymentVoucherPaidModal({
  voucher,
  brandId,
  themeBtn,
  onClose,
  onConfirm,
}: {
  voucher: AccountingVoucher
  brandId: string
  themeBtn?: string
  onClose: () => void
  onConfirm: (proofUrl: string) => Promise<void>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const total = lineTotal(voucher.lines || [])

  const handleFileChange = (next: File | null) => {
    if (!next) {
      setFile(null)
      return
    }
    if (next.size > 10 * 1024 * 1024) {
      alert('File must be under 10 MB.')
      return
    }
    setFile(next)
  }

  const handleSubmit = async () => {
    if (!file || uploading) return
    setUploading(true)
    try {
      const proofUrl = await uploadPaymentVoucherProof(brandId, voucher.voucher_number, file)
      await onConfirm(proofUrl)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal onClose={onClose} align="center" zIndex={80}>
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Mark payment voucher paid</h2>
          <button type="button" onClick={onClose} disabled={uploading}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <div className="rounded-md bg-gray-50 border px-3 py-2 space-y-1">
            <p className="font-medium">{voucher.voucher_number}</p>
            <p className="text-gray-600">{voucher.payee_name || '—'}</p>
            <p className="text-gray-900 font-medium tabular-nums">
              ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-700">
              Proof of payment <span className="text-red-600">*</span>
            </label>
            <p className="text-xs text-gray-500">
              Upload bank transfer screenshot, deposit slip, or check image (PDF, JPG, PNG — max 10 MB).
            </p>
            <label className="flex items-center gap-2 cursor-pointer border border-dashed rounded-md px-3 py-3 hover:bg-gray-50">
              <Upload className="h-4 w-4 text-gray-500 shrink-0" />
              <span className="text-sm text-gray-700 truncate">
                {file ? file.name : 'Choose file…'}
              </span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
            </label>
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!file || uploading}
            className={`px-3 py-1.5 text-sm text-white rounded-md disabled:opacity-50 ${themeBtn || 'bg-green-600 hover:bg-green-700'}`}
          >
            {uploading ? 'Uploading…' : 'Mark paid'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
