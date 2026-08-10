/** Order line shape used for total computation (matches BillingManager / logistics). */
export type OrderTotalInput = {
  delivery_type?: string | null
  order_details?: Array<{ unit_price: number; quantity: number }> | null
}

export function getOrderSubtotal(order: OrderTotalInput): number {
  return (
    order.order_details?.reduce((total, detail) => total + detail.unit_price * detail.quantity, 0) ||
    0
  )
}

/** Pickup 5% discount when subtotal is ₱10,000+. */
export function getOrderPickupDiscount(order: OrderTotalInput): number {
  if (order.delivery_type !== 'pickup') return 0
  const subtotal = getOrderSubtotal(order)
  return subtotal >= 10000 ? subtotal * 0.05 : 0
}

/** Full order total including delivery/pickup rules. */
export function getOrderTotalAmount(order: OrderTotalInput): number {
  const subtotal = getOrderSubtotal(order)
  if (order.delivery_type === 'delivery') {
    return subtotal >= 10000 ? subtotal : subtotal + 500
  }
  if (order.delivery_type === 'pickup') {
    return subtotal >= 10000 ? subtotal * 0.95 : subtotal
  }
  return subtotal
}

/** Delivery fee portion (revenue split for journal posting). */
export function getOrderDeliveryIncome(order: OrderTotalInput): number {
  if (order.delivery_type !== 'delivery') return 0
  const subtotal = getOrderSubtotal(order)
  return subtotal >= 10000 ? 0 : 500
}

export function getOrderSalesRevenue(order: OrderTotalInput): number {
  return getOrderTotalAmount(order) - getOrderDeliveryIncome(order)
}
