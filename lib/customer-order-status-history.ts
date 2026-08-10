import { supabase, type CustomerOrderStatusHistory } from './supabase'

export async function logCustomerOrderStatusChange(params: {
  orderId: string
  oldStatus: string | null | undefined
  newStatus: string
  changedBy: string
  notes?: string
}): Promise<void> {
  const old = params.oldStatus ?? null
  if (old === params.newStatus) return

  const { error } = await supabase.from('customer_order_status_history').insert({
    order_id: params.orderId,
    old_status: old,
    new_status: params.newStatus,
    changed_by: params.changedBy.trim() || 'system',
    notes: params.notes ?? null,
  })

  if (error) {
    console.warn('Failed to log customer order status change:', error)
  }
}

export async function loadCustomerOrderStatusHistory(
  orderId: string
): Promise<CustomerOrderStatusHistory[]> {
  const { data, error } = await supabase
    .from('customer_order_status_history')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to load customer order status history:', error)
    return []
  }
  return data ?? []
}
