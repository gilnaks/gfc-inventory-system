import { supabase } from './supabase'
import { periodRangeFromFilter } from './accounting-reports'
import type { BillingTimeFilter } from './timezone'
import { formatBackfillSummary, type BackfillResult } from './accounting-backfill-summary'

export { formatBackfillSummary, type BackfillResult } from './accounting-backfill-summary'
import {
  postJournalFromVoucher,
  postCustomerOrderRevenue,
  postCustomerOrderCash,
  postAccrualFromDeliveryReceipt,
} from './accounting-posting-rules'
import { postMaterialMovementJournal } from './accounting-procurement-posting'
import { postCogsForFulfilledOrder } from './accounting-cogs'
import { postPayrollRunAccrual } from './accounting-payroll-posting'
import { postProductionBatchJournal } from './accounting-production-posting'
import { postFactoryMaterialReleaseJournal } from './accounting-factory-wip-posting'
import {
  postIntercompanyTransferJournals,
} from './accounting-intercompany-posting'
import { postMaterialTransferJournals } from './accounting-material-transfer-posting'

const SKIP_MATERIAL_REF_TYPES = new Set([
  'delivery_receipt',
  'purchase_order',
  'material_transfer',
  'factory_request',
])

export async function backfillMissingJournals(
  brandId: string,
  timeFilter: BillingTimeFilter,
  postedBy: string
): Promise<BackfillResult> {
  const { fromDate, toDate } = periodRangeFromFilter(timeFilter)
  const result: BackfillResult = {
    vouchers: 0,
    ordersRevenue: 0,
    ordersCash: 0,
    ordersCogs: 0,
    deliveries: 0,
    materialMovements: 0,
    payrollAccruals: 0,
    productionBatches: 0,
    factoryMaterialReleases: 0,
    intercompanyTransfers: 0,
    materialTransfers: 0,
    errors: [],
  }

  const { data: paidPv } = await supabase
    .from('accounting_vouchers')
    .select('id')
    .eq('brand_id', brandId)
    .eq('voucher_type', 'payment')
    .eq('status', 'paid')
    .is('journal_entry_id', null)
    .gte('voucher_date', fromDate)
    .lte('voucher_date', toDate)

  for (const v of paidPv || []) {
    try {
      await postJournalFromVoucher(v.id, postedBy)
      result.vouchers++
    } catch (e: unknown) {
      result.errors.push(`PV ${v.id}: ${e instanceof Error ? e.message : 'failed'}`)
    }
  }

  const { data: liqPcv } = await supabase
    .from('accounting_vouchers')
    .select('id')
    .eq('brand_id', brandId)
    .eq('voucher_type', 'petty_cash')
    .eq('status', 'liquidated')
    .is('journal_entry_id', null)
    .gte('voucher_date', fromDate)
    .lte('voucher_date', toDate)

  for (const v of liqPcv || []) {
    try {
      await postJournalFromVoucher(v.id, postedBy)
      result.vouchers++
    } catch (e: unknown) {
      result.errors.push(`PCV ${v.id}: ${e instanceof Error ? e.message : 'failed'}`)
    }
  }

  const { data: orders } = await supabase
    .from('customer_orders')
    .select('id, status, journal_entry_id_revenue, journal_entry_id_cash, journal_entry_id_cogs')
    .eq('brand_id', brandId)
    .gte('updated_at', `${fromDate}T00:00:00`)
    .lte('updated_at', `${toDate}T23:59:59`)

  for (const o of orders || []) {
    if (
      ['fulfilled', 'paid', 'complete'].includes(o.status) &&
      !o.journal_entry_id_revenue
    ) {
      try {
        await postCustomerOrderRevenue(o.id, brandId, postedBy)
        result.ordersRevenue++
      } catch (e: unknown) {
        result.errors.push(`Order revenue ${o.id}: ${e instanceof Error ? e.message : 'failed'}`)
      }
    }
    if (
      ['fulfilled', 'paid', 'complete'].includes(o.status) &&
      !o.journal_entry_id_cogs
    ) {
      try {
        await postCogsForFulfilledOrder(o.id, brandId, postedBy)
        result.ordersCogs++
      } catch (e: unknown) {
        result.errors.push(`Order COGS ${o.id}: ${e instanceof Error ? e.message : 'failed'}`)
      }
    }
    if (o.status === 'complete' && !o.journal_entry_id_cash) {
      try {
        await postCustomerOrderCash(o.id, brandId, postedBy)
        result.ordersCash++
      } catch (e: unknown) {
        result.errors.push(`Order cash ${o.id}: ${e instanceof Error ? e.message : 'failed'}`)
      }
    }
  }

  const { data: brandPos } = await supabase
    .from('purchase_orders')
    .select('id')
    .eq('brand_id', brandId)
  const brandPoIds = new Set((brandPos || []).map((p) => p.id))

  const { data: drs } = await supabase
    .from('delivery_receipts')
    .select('id, po_id')
    .is('journal_entry_id', null)
    .gte('delivery_date', fromDate)
    .lte('delivery_date', toDate)

  for (const dr of drs || []) {
    if (!brandPoIds.has(dr.po_id)) continue
    try {
      await postAccrualFromDeliveryReceipt(dr.id, brandId, postedBy)
      result.deliveries++
    } catch (e: unknown) {
      result.errors.push(`DR ${dr.id}: ${e instanceof Error ? e.message : 'failed'}`)
    }
  }

  const { data: materialIds } = await supabase
    .from('material_stock_movements')
    .select('id, reference_type, movement_date, material:raw_materials!inner(brand_id)')
    .eq('material.brand_id', brandId)
    .gte('movement_date', fromDate)
    .lte('movement_date', toDate)

  for (const row of materialIds || []) {
    if (row.reference_type && SKIP_MATERIAL_REF_TYPES.has(row.reference_type)) continue
    const { data: existingJe } = await supabase
      .from('accounting_journal_entries')
      .select('id')
      .eq('brand_id', brandId)
      .eq('source_type', 'material_movement')
      .eq('source_id', row.id)
      .eq('status', 'posted')
      .maybeSingle()
    if (existingJe?.id) continue
    try {
      await postMaterialMovementJournal(row.id, brandId, postedBy)
      result.materialMovements++
    } catch (e: unknown) {
      result.errors.push(`Material ${row.id.slice(0, 8)}: ${e instanceof Error ? e.message : 'failed'}`)
    }
  }

  const { data: factoryMovements } = await supabase
    .from('material_stock_movements')
    .select('id, reference_id, movement_date, material:raw_materials!inner(brand_id)')
    .eq('reference_type', 'factory_request')
    .eq('material.brand_id', brandId)
    .gte('movement_date', fromDate)
    .lte('movement_date', toDate)

  for (const mov of factoryMovements || []) {
    const requestId = mov.reference_id as string
    if (!requestId) continue
    const { data: request } = await supabase
      .from('factory_material_requests')
      .select('journal_entry_id')
      .eq('id', requestId)
      .maybeSingle()
    if (request?.journal_entry_id) continue
    const { data: existingReleaseJe } = await supabase
      .from('accounting_journal_entries')
      .select('id')
      .eq('brand_id', brandId)
      .eq('source_type', 'factory_material_release')
      .eq('source_id', requestId)
      .eq('status', 'posted')
      .maybeSingle()
    if (existingReleaseJe?.id) continue
    try {
      const id = await postFactoryMaterialReleaseJournal(
        requestId,
        mov.id as string,
        brandId,
        postedBy
      )
      if (id) result.factoryMaterialReleases++
    } catch (e: unknown) {
      result.errors.push(
        `Factory release ${requestId.slice(0, 8)}: ${e instanceof Error ? e.message : 'failed'}`
      )
    }
  }

  const { data: payrollTotals } = await supabase
    .from('payroll_run_brand_totals')
    .select('id, payroll_run:payroll_runs!inner(week_start_date, week_end_date)')
    .eq('brand_id', brandId)
    .is('journal_entry_id_accrual', null)

  for (const bt of payrollTotals || []) {
    const run = bt.payroll_run as { week_start_date?: string; week_end_date?: string } | null
    if (!run?.week_end_date || run.week_end_date < fromDate || run.week_start_date! > toDate) continue
    try {
      await postPayrollRunAccrual(bt.id, postedBy)
      result.payrollAccruals++
    } catch (e: unknown) {
      result.errors.push(`Payroll ${bt.id.slice(0, 8)}: ${e instanceof Error ? e.message : 'failed'}`)
    }
  }

  const { data: batches } = await supabase
    .from('factory_production_batches')
    .select('id, work_date, units, product:products!inner(brand_id)')
    .eq('product.brand_id', brandId)
    .is('journal_entry_id', null)
    .gte('work_date', fromDate)
    .lte('work_date', toDate)
    .gt('units', 0)

  for (const batch of batches || []) {
    try {
      const id = await postProductionBatchJournal(batch.id, brandId, postedBy)
      if (id) result.productionBatches++
    } catch (e: unknown) {
      result.errors.push(
        `Production ${batch.id.slice(0, 8)}: ${e instanceof Error ? e.message : 'failed'}`
      )
    }
  }

  const { data: icTransfers } = await supabase
    .from('intercompany_transfers')
    .select('*, lines:intercompany_transfer_lines(*)')
    .or(`from_brand_id.eq.${brandId},to_brand_id.eq.${brandId}`)
    .eq('status', 'posted')
    .gte('transfer_date', fromDate)
    .lte('transfer_date', toDate)

  for (const transfer of icTransfers || []) {
    if (transfer.journal_entry_id_from || transfer.journal_entry_id_to) continue
    try {
      const { fromEntryId, toEntryId } = await postIntercompanyTransferJournals(
        transfer,
        transfer.lines || [],
        postedBy
      )
      await supabase
        .from('intercompany_transfers')
        .update({ journal_entry_id_from: fromEntryId, journal_entry_id_to: toEntryId })
        .eq('id', transfer.id)
      result.intercompanyTransfers++
    } catch (e: unknown) {
      result.errors.push(
        `IC transfer ${transfer.id.slice(0, 8)}: ${e instanceof Error ? e.message : 'failed'}`
      )
    }
  }

  const { data: matTransfers } = await supabase
    .from('material_transfers')
    .select('*, lines:material_transfer_lines(*)')
    .or(`from_brand_id.eq.${brandId},to_brand_id.eq.${brandId}`)
    .eq('status', 'posted')
    .gte('transfer_date', fromDate)
    .lte('transfer_date', toDate)

  for (const transfer of matTransfers || []) {
    if (transfer.journal_entry_id_from || transfer.journal_entry_id_to) continue
    try {
      const { fromEntryId, toEntryId } = await postMaterialTransferJournals(
        transfer,
        transfer.lines || [],
        postedBy
      )
      await supabase
        .from('material_transfers')
        .update({ journal_entry_id_from: fromEntryId, journal_entry_id_to: toEntryId })
        .eq('id', transfer.id)
      result.materialTransfers++
    } catch (e: unknown) {
      result.errors.push(
        `Material transfer ${transfer.id.slice(0, 8)}: ${e instanceof Error ? e.message : 'failed'}`
      )
    }
  }

  return result
}
