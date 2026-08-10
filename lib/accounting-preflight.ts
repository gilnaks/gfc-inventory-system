import { supabase } from './supabase'
import type { AccountingVoucherSettings } from './supabase'
import { ensureVoucherSettings } from './accounting-voucher-service'
import { loadOpeningBalanceEntry } from './accounting-opening-balance'
import { isPeriodClosed } from './accounting-period-service'
import {
  missingDefaultAccountLabels,
  totalUnpostedCount,
  type PreflightUnpostedCounts,
} from './accounting-preflight-checks'

export {
  REQUIRED_DEFAULT_ACCOUNTS,
  missingDefaultAccountLabels,
  totalUnpostedCount,
  type PreflightUnpostedCounts,
} from './accounting-preflight-checks'

export type AccountingPreflightStatus = {
  missingDefaultAccounts: string[]
  hasOpeningBalance: boolean
  currentPeriodClosed: boolean
  unposted: PreflightUnpostedCounts
  ready: boolean
}

export async function loadAccountingPreflightStatus(brandId: string): Promise<AccountingPreflightStatus> {
  const settings = await ensureVoucherSettings(brandId)
  const missingDefaultAccounts = missingDefaultAccountLabels(settings)
  const opening = await loadOpeningBalanceEntry(brandId)
  const today = new Date().toISOString().split('T')[0]
  const currentPeriodClosed = await isPeriodClosed(brandId, today)

  const [
    paymentVouchers,
    pettyCashVouchers,
    ordersRevenue,
    ordersCash,
    ordersCogs,
    deliveryReceipts,
    payrollAccruals,
    productionBatches,
    factoryMaterialReleases,
  ] = await Promise.all([
    countQuery(
      supabase
        .from('accounting_vouchers')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .eq('voucher_type', 'payment')
        .eq('status', 'paid')
        .is('journal_entry_id', null)
    ),
    countQuery(
      supabase
        .from('accounting_vouchers')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .eq('voucher_type', 'petty_cash')
        .eq('status', 'liquidated')
        .is('journal_entry_id', null)
    ),
    countQuery(
      supabase
        .from('customer_orders')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .in('status', ['fulfilled', 'paid', 'complete'])
        .is('journal_entry_id_revenue', null)
    ),
    countQuery(
      supabase
        .from('customer_orders')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .eq('status', 'complete')
        .is('journal_entry_id_cash', null)
    ),
    countQuery(
      supabase
        .from('customer_orders')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .in('status', ['fulfilled', 'paid', 'complete'])
        .is('journal_entry_id_cogs', null)
    ),
    countUnpostedDeliveryReceipts(brandId),
    countQuery(
      supabase
        .from('payroll_run_brand_totals')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .is('journal_entry_id_accrual', null)
    ),
    countQuery(
      supabase
        .from('factory_production_batches')
        .select('id, product:products!inner(brand_id)', { count: 'exact', head: true })
        .eq('product.brand_id', brandId)
        .is('journal_entry_id', null)
        .gt('units', 0)
    ),
    countUnpostedFactoryMaterialReleases(brandId),
  ])

  const materialMovements = await countUnpostedMaterialMovements(brandId)

  const unposted: PreflightUnpostedCounts = {
    paymentVouchers,
    pettyCashVouchers,
    ordersRevenue,
    ordersCash,
    ordersCogs,
    deliveryReceipts,
    materialMovements,
    payrollAccruals,
    productionBatches,
    factoryMaterialReleases,
  }

  const unpostedTotal = Object.values(unposted).reduce((s, n) => s + n, 0)
  const ready =
    missingDefaultAccounts.length === 0 &&
    !currentPeriodClosed &&
    (opening != null || unpostedTotal === 0)

  return {
    missingDefaultAccounts,
    hasOpeningBalance: opening != null,
    currentPeriodClosed,
    unposted,
    ready,
  }
}

async function countQuery(
  q: PromiseLike<{ count: number | null; error: { message: string } | null }>
): Promise<number> {
  const { count, error } = await q
  if (error) return 0
  return count ?? 0
}

async function countUnpostedDeliveryReceipts(brandId: string): Promise<number> {
  const { data: pos, error: poErr } = await supabase
    .from('purchase_orders')
    .select('id')
    .eq('brand_id', brandId)
  if (poErr || !pos?.length) return 0

  const poIds = pos.map((p) => p.id)
  const { count, error } = await supabase
    .from('delivery_receipts')
    .select('id', { count: 'exact', head: true })
    .is('journal_entry_id', null)
    .in('po_id', poIds)
  if (error) return 0
  return count ?? 0
}

async function countUnpostedMaterialMovements(brandId: string): Promise<number> {
  const { data: rows } = await supabase
    .from('material_stock_movements')
    .select('id, reference_type, material:raw_materials!inner(brand_id)')
    .eq('material.brand_id', brandId)
  const skip = new Set(['delivery_receipt', 'purchase_order', 'material_transfer', 'factory_request'])
  let count = 0
  for (const row of rows || []) {
    if (row.reference_type && skip.has(row.reference_type)) continue
    const { data: existingJe } = await supabase
      .from('accounting_journal_entries')
      .select('id')
      .eq('brand_id', brandId)
      .eq('source_type', 'material_movement')
      .eq('source_id', row.id)
      .eq('status', 'posted')
      .maybeSingle()
    if (!existingJe?.id) count++
  }
  return count
}

async function countUnpostedFactoryMaterialReleases(brandId: string): Promise<number> {
  const { data: movements } = await supabase
    .from('material_stock_movements')
    .select('id, reference_id, material:raw_materials!inner(brand_id)')
    .eq('reference_type', 'factory_request')
    .eq('material.brand_id', brandId)

  let count = 0
  for (const mov of movements || []) {
    const requestId = mov.reference_id as string
    if (!requestId) continue
    const { data: request } = await supabase
      .from('factory_material_requests')
      .select('journal_entry_id')
      .eq('id', requestId)
      .maybeSingle()
    if (request?.journal_entry_id) continue
    const { data: existingJe } = await supabase
      .from('accounting_journal_entries')
      .select('id')
      .eq('brand_id', brandId)
      .eq('source_type', 'factory_material_release')
      .eq('source_id', requestId)
      .eq('status', 'posted')
      .maybeSingle()
    if (!existingJe?.id) count++
  }
  return count
}
