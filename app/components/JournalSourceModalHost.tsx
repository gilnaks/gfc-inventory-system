'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { JournalSourceDocKind } from '../../lib/journal-source-resolver'
import { loadVoucherById } from '../../lib/accounting-voucher-service'
import type { AccountingVoucher } from '../../lib/supabase'
import { PurchaseOrderViewModal } from './PurchaseOrderViewModal'
import { ReceivingReportViewModal } from './ReceivingReportViewModal'
import { SupplierInvoiceViewModal } from './SupplierInvoiceViewModal'
import { VoucherViewModal } from './VoucherViewModal'
import { MaterialTransferViewModal } from './MaterialTransferViewModal'
import { IntercompanyTransferViewModal } from './IntercompanyTransferViewModal'
import { MaterialCycleCountViewModal } from './MaterialCycleCountViewModal'
import { OpeningBalanceViewModal } from './OpeningBalanceViewModal'
import { ProductCycleCountViewModal } from './ProductCycleCountViewModal'
import { JournalMovementViewModal } from './JournalMovementViewModal'
import { CustomerOrderViewModal } from './CustomerOrderViewModal'
import { PayrollJournalViewModal } from './PayrollJournalViewModal'
import { FactoryBatchDetailModal } from '../factory/FactoryBatchDetailModal'
import { FactoryMaterialReleaseViewModal } from './FactoryMaterialReleaseViewModal'
import { StaffAdvanceViewModal } from './StaffAdvanceViewModal'
import { ProductOpeningStockViewModal } from './ProductOpeningStockViewModal'
import { ProductStockAdjustmentViewModal } from './ProductStockAdjustmentViewModal'
import { YearEndCloseViewModal } from './YearEndCloseViewModal'

export type JournalDocOpenRequest = {
  kind: JournalSourceDocKind
  id: string
  journalEntryId?: string
  journalSourceType?: string
}

export function JournalSourceModalHost({
  open,
  onClose,
  brandId,
  themeBtn,
  onOpenJournalEntry,
}: {
  open: JournalDocOpenRequest | null
  onClose: () => void
  brandId?: string
  themeBtn?: string
  onOpenJournalEntry?: (entryId: string) => void
}) {
  const [voucher, setVoucher] = useState<AccountingVoucher | null>(null)
  const [voucherLoading, setVoucherLoading] = useState(false)

  useEffect(() => {
    if (!open || (open.kind !== 'payment_voucher' && open.kind !== 'petty_cash_voucher')) {
      setVoucher(null)
      return
    }
    let cancelled = false
    setVoucherLoading(true)
    void loadVoucherById(open.id)
      .then((v) => {
        if (!cancelled) setVoucher(v)
      })
      .finally(() => {
        if (!cancelled) setVoucherLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (open?.kind === 'journal_entry' && open.id && onOpenJournalEntry) {
      onOpenJournalEntry(open.id)
      onClose()
    }
  }, [open, onOpenJournalEntry, onClose])

  if (!open || typeof document === 'undefined') return null
  if (open.kind === 'journal_entry') return null

  const portal = (node: ReactNode) => createPortal(node, document.body)

  switch (open.kind) {
    case 'purchase_order':
      return portal(<PurchaseOrderViewModal poId={open.id} onClose={onClose} />)
    case 'delivery_receipt':
      return portal(<ReceivingReportViewModal receiptId={open.id} onClose={onClose} />)
    case 'supplier_invoice':
      return portal(<SupplierInvoiceViewModal invoiceId={open.id} onClose={onClose} />)
    case 'payment_voucher':
    case 'petty_cash_voucher':
      if (voucherLoading) return null
      if (!voucher) return null
      return portal(
        <VoucherViewModal voucher={voucher} brandId={brandId} themeBtn={themeBtn} onClose={onClose} />
      )
    case 'material_transfer':
      return portal(<MaterialTransferViewModal transferId={open.id} onClose={onClose} />)
    case 'intercompany_transfer':
      return portal(<IntercompanyTransferViewModal transferId={open.id} onClose={onClose} />)
    case 'opening_balance':
      return portal(
        <OpeningBalanceViewModal
          journalEntryId={open.journalEntryId || open.id}
          onClose={onClose}
        />
      )
    case 'product_cycle_count':
      return portal(<ProductCycleCountViewModal cycleCountId={open.id} onClose={onClose} />)
    case 'product_opening_stock':
      return portal(<ProductOpeningStockViewModal productId={open.id} onClose={onClose} />)
    case 'product_stock_adjustment':
      return portal(
        <ProductStockAdjustmentViewModal adjustmentId={open.id} onClose={onClose} />
      )
    case 'material_cycle_count':
      return portal(<MaterialCycleCountViewModal cycleCountId={open.id} onClose={onClose} />)
    case 'material_movement':
      return portal(
        <JournalMovementViewModal movementId={open.id} kind="material_movement" onClose={onClose} />
      )
    case 'fixed_asset_movement':
      return portal(
        <JournalMovementViewModal
          movementId={open.id}
          kind="fixed_asset_movement"
          onClose={onClose}
        />
      )
    case 'customer_order':
      return portal(
        <CustomerOrderViewModal
          orderId={open.id}
          journalSourceType={open.journalSourceType}
          onClose={onClose}
        />
      )
    case 'payroll_run':
      return portal(<PayrollJournalViewModal payrollRunBrandTotalId={open.id} onClose={onClose} />)
    case 'production_batch':
      return portal(<FactoryBatchDetailModal batchId={open.id} onClose={onClose} />)
    case 'factory_material_release':
      return portal(<FactoryMaterialReleaseViewModal requestId={open.id} onClose={onClose} />)
    case 'staff_advance_disbursement':
      return portal(<StaffAdvanceViewModal disbursementId={open.id} onClose={onClose} />)
    case 'year_end_close':
      return portal(
        <YearEndCloseViewModal
          journalEntryId={open.journalEntryId || open.id}
          brandId={brandId}
          onClose={onClose}
        />
      )
    default:
      return null
  }
}
