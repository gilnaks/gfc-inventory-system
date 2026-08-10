import {
  postJournalFromVoucher,
  postCustomerOrderRevenue,
  postCustomerOrderCash,
  postAccrualFromDeliveryReceipt,
} from './accounting-posting-rules'
import { postPayrollRunAccrual } from './accounting-payroll-posting'
import { supabase } from './supabase'
import { postCogsForFulfilledOrder } from './accounting-cogs'
import {
  postFixedAssetMovementJournal,
  postMaterialMovementJournal,
  postProductCycleCountJournal,
} from './accounting-procurement-posting'
import { postProductionBatchJournal } from './accounting-production-posting'
import { postProductOpeningStockJournal, postProductStockAdjustmentJournal } from './accounting-product-posting'
import {
  retryFactoryMaterialReleaseJournal,
  retryFactoryWipAdjustmentJournal,
} from './accounting-factory-wip-posting'
import {
  postIntercompanyTransferJournals,
  postIntercompanyTransferSettlementGfc,
  postIntercompanyTransferSettlementRetail,
} from './accounting-intercompany-posting'
import { postMaterialTransferJournals } from './accounting-material-transfer-posting'
import { postStaffAdvanceDisbursementFromVoucher } from './accounting-staff-advance-posting'
import {
  extractPostingErrorMessage,
  loadUnresolvedErrors,
  recordPostingError,
  resolveBySource,
  type PostingErrorSourceType,
} from './accounting-posting-errors'
import type { IntercompanyTransfer, IntercompanyTransferLine } from './supabase'

async function retryOne(
  brandId: string,
  sourceType: string,
  sourceId: string,
  postedBy: string
): Promise<void> {
  switch (sourceType as PostingErrorSourceType) {
    case 'customer_order_revenue':
      await postCustomerOrderRevenue(sourceId, brandId, postedBy)
      break
    case 'customer_order_cogs':
      await postCogsForFulfilledOrder(sourceId, brandId, postedBy)
      break
    case 'customer_order_cash':
      await postCustomerOrderCash(sourceId, brandId, postedBy)
      break
    case 'delivery_receipt':
      await postAccrualFromDeliveryReceipt(sourceId, brandId, postedBy)
      break
    case 'material_movement':
    case 'material_cycle_count':
      await postMaterialMovementJournal(sourceId, brandId, postedBy)
      break
    case 'fixed_asset_movement':
      await postFixedAssetMovementJournal(sourceId, brandId, postedBy)
      break
    case 'product_cycle_count':
      await postProductCycleCountJournal(sourceId, brandId, postedBy)
      break
    case 'product_opening_stock':
      await postProductOpeningStockJournal(sourceId, brandId, postedBy)
      break
    case 'product_stock_adjustment':
      await postProductStockAdjustmentJournal(sourceId, brandId, postedBy)
      break
    case 'payment_voucher':
    case 'petty_cash_voucher':
      await postJournalFromVoucher(sourceId, postedBy)
      break
    case 'payroll_run_accrual':
      await postPayrollRunAccrual(sourceId, postedBy)
      break
    case 'payroll_run_payment': {
      const { data: bt } = await supabase
        .from('payroll_run_brand_totals')
        .select('payment_voucher_id')
        .eq('id', sourceId)
        .single()
      if (!bt?.payment_voucher_id) throw new Error('Payroll payment voucher not linked')
      await postJournalFromVoucher(bt.payment_voucher_id, postedBy)
      break
    }
    case 'production_batch':
      await postProductionBatchJournal(sourceId, brandId, postedBy)
      break
    case 'factory_material_release':
      await retryFactoryMaterialReleaseJournal(sourceId, brandId, postedBy)
      break
    case 'factory_wip_adjustment':
      await retryFactoryWipAdjustmentJournal(sourceId, brandId, postedBy)
      break
    case 'intercompany_transfer': {
      const { data: transfer } = await supabase
        .from('intercompany_transfers')
        .select('*, lines:intercompany_transfer_lines(*)')
        .eq('id', sourceId)
        .single()
      if (!transfer) throw new Error('Intercompany transfer not found')
      const { fromEntryId, toEntryId } = await postIntercompanyTransferJournals(
        transfer as IntercompanyTransfer,
        (transfer.lines || []) as IntercompanyTransferLine[],
        postedBy
      )
      await supabase
        .from('intercompany_transfers')
        .update({ journal_entry_id_from: fromEntryId, journal_entry_id_to: toEntryId })
        .eq('id', sourceId)
      break
    }
    case 'intercompany_transfer_settlement': {
      const { data: transfer } = await supabase
        .from('intercompany_transfers')
        .select('*')
        .eq('id', sourceId)
        .single()
      if (!transfer) throw new Error('Intercompany transfer not found')
      if (transfer.from_brand_id === brandId) {
        await postIntercompanyTransferSettlementGfc(transfer as IntercompanyTransfer, postedBy)
      } else if (transfer.to_brand_id === brandId) {
        await postIntercompanyTransferSettlementRetail(transfer as IntercompanyTransfer, postedBy)
      } else {
        throw new Error('Transfer does not belong to this brand')
      }
      break
    }
    case 'material_transfer': {
      const { data: transfer } = await supabase
        .from('material_transfers')
        .select('*, lines:material_transfer_lines(*)')
        .eq('id', sourceId)
        .single()
      if (!transfer) throw new Error('Material transfer not found')
      const { fromEntryId, toEntryId } = await postMaterialTransferJournals(
        transfer,
        transfer.lines || [],
        postedBy
      )
      await supabase
        .from('material_transfers')
        .update({ journal_entry_id_from: fromEntryId, journal_entry_id_to: toEntryId })
        .eq('id', sourceId)
      break
    }
    case 'staff_advance_disbursement': {
      const { data: link } = await supabase
        .from('accounting_voucher_links')
        .select(
          'voucher_id, voucher:accounting_vouchers!inner(brand_id, voucher_date, status)'
        )
        .eq('source_type', 'staff_advance_disbursement')
        .eq('source_id', sourceId)
        .maybeSingle()
      const voucherRaw = link?.voucher as
        | { brand_id: string; voucher_date: string; status: string }
        | { brand_id: string; voucher_date: string; status: string }[]
        | null
        | undefined
      const voucher = Array.isArray(voucherRaw) ? voucherRaw[0] : voucherRaw
      if (!link?.voucher_id || !voucher) throw new Error('Staff advance voucher link not found')
      await postStaffAdvanceDisbursementFromVoucher(
        sourceId,
        link.voucher_id,
        voucher.brand_id,
        postedBy,
        voucher.voucher_date
      )
      break
    }
    default:
      throw new Error(`Unknown source type: ${sourceType}`)
  }
}

export async function retryUnresolvedPostingErrors(
  brandId: string,
  postedBy: string
): Promise<{ succeeded: number; failed: number; errors: string[] }> {
  const rows = await loadUnresolvedErrors(brandId, 500)
  let succeeded = 0
  let failed = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      await retryOne(brandId, row.source_type, row.source_id, postedBy)
      await resolveBySource(brandId, row.source_type, row.source_id)
      succeeded++
    } catch (e: unknown) {
      failed++
      const msg = extractPostingErrorMessage(e)
      errors.push(`${row.source_type} ${row.source_id.slice(0, 8)}: ${msg}`)
      await recordPostingError({
        brandId,
        sourceType: row.source_type,
        sourceId: row.source_id,
        error: e,
      })
    }
  }

  return { succeeded, failed, errors }
}
