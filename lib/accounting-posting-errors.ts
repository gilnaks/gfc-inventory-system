import { supabase } from './supabase'
import type { AccountingPostingError } from './supabase'

const MAX_MESSAGE_LEN = 2000

export type PostingErrorSourceType =
  | 'customer_order_revenue'
  | 'customer_order_cash'
  | 'customer_order_cogs'
  | 'delivery_receipt'
  | 'material_movement'
  | 'fixed_asset_movement'
  | 'material_cycle_count'
  | 'product_cycle_count'
  | 'payment_voucher'
  | 'petty_cash_voucher'
  | 'payroll_run_accrual'
  | 'payroll_run_payment'
  | 'production_batch'
  | 'factory_material_release'
  | 'factory_wip_adjustment'
  | 'product_opening_stock'
  | 'product_stock_adjustment'
  | 'intercompany_transfer'
  | 'intercompany_transfer_settlement'
  | 'material_transfer'
  | 'staff_advance_disbursement'

function truncateMessage(msg: string): string {
  return msg.length > MAX_MESSAGE_LEN ? msg.slice(0, MAX_MESSAGE_LEN) : msg
}

/** Normalize thrown values (including Supabase Postgrest errors) for display and logging. */
export function extractPostingErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (
    e &&
    typeof e === 'object' &&
    'message' in e &&
    typeof (e as { message: unknown }).message === 'string'
  ) {
    const msg = (e as { message: string }).message
    const details =
      'details' in e && typeof (e as { details: unknown }).details === 'string'
        ? (e as { details: string }).details
        : ''
    return details ? `${msg} (${details})` : msg
  }
  if (typeof e === 'string' && e.trim()) return e
  return 'Unknown posting error'
}

export async function recordPostingError(params: {
  brandId: string
  sourceType: string
  sourceId: string
  error: unknown
}): Promise<void> {
  const message = truncateMessage(extractPostingErrorMessage(params.error))

  const { data: existing } = await supabase
    .from('accounting_posting_errors')
    .select('id')
    .eq('brand_id', params.brandId)
    .eq('source_type', params.sourceType)
    .eq('source_id', params.sourceId)
    .is('resolved_at', null)
    .maybeSingle()

  if (existing?.id) {
    await supabase
      .from('accounting_posting_errors')
      .update({ error_message: message, created_at: new Date().toISOString() })
      .eq('id', existing.id)
    return
  }

  await supabase.from('accounting_posting_errors').insert([
    {
      brand_id: params.brandId,
      source_type: params.sourceType,
      source_id: params.sourceId,
      error_message: message,
    },
  ])
}

export async function resolveBySource(
  brandId: string,
  sourceType: string,
  sourceId: string
): Promise<void> {
  await supabase
    .from('accounting_posting_errors')
    .update({ resolved_at: new Date().toISOString() })
    .eq('brand_id', brandId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .is('resolved_at', null)
}

export async function countUnresolvedErrors(brandId: string): Promise<number> {
  const { count, error } = await supabase
    .from('accounting_posting_errors')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId)
    .is('resolved_at', null)
  if (error) return 0
  return count ?? 0
}

export async function loadUnresolvedErrors(
  brandId: string,
  limit = 20
): Promise<AccountingPostingError[]> {
  const { data, error } = await supabase
    .from('accounting_posting_errors')
    .select('*')
    .eq('brand_id', brandId)
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []) as AccountingPostingError[]
}

export async function withPostingErrorLog<T>(
  brandId: string,
  sourceType: string,
  sourceId: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const result = await fn()
    await resolveBySource(brandId, sourceType, sourceId)
    return result
  } catch (e) {
    await recordPostingError({ brandId, sourceType, sourceId, error: e })
    throw e
  }
}
