import { describe, expect, it } from 'vitest'
import {
  formatBrandRouteJournalMemo,
  formatCustomerOrderJournalMemo,
  formatDeliveryReceiptJournalMemo,
  formatFactoryMaterialReleaseJournalMemo,
  formatFactoryWipAdjustmentJournalMemo,
  formatPaymentVoucherJournalMemo,
  formatPayrollAccrualJournalMemo,
  formatPettyCashVoucherJournalMemo,
  formatProductionBatchJournalMemo,
  formatProductOpeningStockJournalMemo,
  formatProductStockAdjustmentJournalMemo,
  formatReversalJournalMemo,
  formatStaffAdvanceJournalMemo,
  formatStockMovementJournalMemo,
} from './journal-description'

describe('formatPaymentVoucherJournalMemo', () => {
  it('includes supplier and PO number', () => {
    expect(formatPaymentVoucherJournalMemo('ABC Trading', '123456')).toBe(
      'ABC Trading - PO-123456'
    )
  })

  it('falls back to supplier only when no PO', () => {
    expect(formatPaymentVoucherJournalMemo('ABC Trading', null)).toBe('ABC Trading')
  })
})

describe('journal description formatters', () => {
  it('formats petty cash voucher as purpose', () => {
    expect(formatPettyCashVoucherJournalMemo('Office supplies', null)).toBe('Office supplies')
  })

  it('formats delivery receipt with supplier and PO', () => {
    expect(formatDeliveryReceiptJournalMemo('ABC Trading', 'PO-123456')).toBe(
      'ABC Trading - PO-123456'
    )
  })

  it('formats brand route transfers', () => {
    expect(formatBrandRouteJournalMemo('GFC Main', 'Store A')).toBe('GFC Main -> Store A')
  })

  it('formats customer order as location - order id', () => {
    expect(
      formatCustomerOrderJournalMemo('', {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        location: { name: 'SM Megamall' },
      })
    ).toBe('SM Megamall - a1b2c3d4')
  })

  it('formats payroll accrual', () => {
    expect(formatPayrollAccrualJournalMemo('GFC Main', '2026-07-14', '2026-07-20')).toBe(
      'GFC Main (2026-07-14–2026-07-20)'
    )
  })

  it('formats production batch', () => {
    expect(formatProductionBatchJournalMemo('BATCH-42', 'Ube Ice Cream')).toBe(
      'Ube Ice Cream (batch-42)'
    )
  })

  it('formats factory release with qty and unit', () => {
    expect(formatFactoryMaterialReleaseJournalMemo('Flour', 50, 'kg')).toBe('Flour - 50 kg')
  })

  it('formats factory shrink', () => {
    expect(formatFactoryWipAdjustmentJournalMemo('Flour', 'Opened bag')).toBe('Flour (Opened bag)')
  })

  it('formats staff advance as staff name', () => {
    expect(formatStaffAdvanceJournalMemo('Maria Santos')).toBe('Maria Santos')
  })

  it('formats stock movement', () => {
    expect(formatStockMovementJournalMemo('in', 'Flour')).toBe('Stock in - Flour')
  })

  it('formats product opening stock with qty and unit cost', () => {
    expect(formatProductOpeningStockJournalMemo('Ube Ice Cream', 5, 'pcs', 1000)).toBe(
      'Ube Ice Cream 5 pcs @ ₱1,000.00'
    )
  })

  it('formats product stock adjustment with signed qty delta', () => {
    expect(formatProductStockAdjustmentJournalMemo('Ube Ice Cream', -3, 'pcs', 1000)).toBe(
      'Ube Ice Cream -3 pcs @ ₱1,000.00'
    )
  })

  it('formats reversal', () => {
    expect(formatReversalJournalMemo('JE-00012')).toBe('Reversal - JE-00012')
  })
})
