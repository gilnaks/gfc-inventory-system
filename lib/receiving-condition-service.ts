import type { DeliveryReceipt, PurchaseOrder, PurchaseOrderItem } from './supabase'

export type ReceiptCondition = DeliveryReceipt['condition']

export type ReceiptLineInput = {
  po_item_id: string
  ordered_quantity: number
  previously_received: number
  remaining_quantity: number
  quantity_received: number
  quantity_damaged: number
}

export type ReceiptLineValidation = {
  valid: boolean
  errors: string[]
  hasPositiveQty: boolean
  totalGood: number
  totalDamaged: number
  totalOutstandingAfter: number
}

export type DerivedConditionResult = {
  condition: ReceiptCondition
  warnings: string[]
}

const CONDITION_LABELS: Record<ReceiptCondition, string> = {
  good: 'Complete',
  partial: 'Partial',
  damaged: 'Damaged',
  incomplete: 'Incomplete',
}

const CONDITION_BADGE_CLASSES: Record<ReceiptCondition, string> = {
  good: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  damaged: 'bg-red-100 text-red-800',
  incomplete: 'bg-orange-100 text-orange-800',
}

export function formatConditionLabel(condition: ReceiptCondition | string | null | undefined): string {
  if (!condition) return '—'
  return CONDITION_LABELS[condition as ReceiptCondition] || String(condition)
}

export function conditionBadgeClass(condition: ReceiptCondition | string | null | undefined): string {
  if (!condition) return 'bg-gray-100 text-gray-700'
  return CONDITION_BADGE_CLASSES[condition as ReceiptCondition] || 'bg-gray-100 text-gray-700'
}

export function computeLineRemaining(
  ordered: number,
  previouslyReceived: number
): number {
  return Math.max(0, (Number(ordered) || 0) - (Number(previouslyReceived) || 0))
}

export function computeLineRemainingFromPoItem(item: Pick<PurchaseOrderItem, 'quantity' | 'quantity_received'>): number {
  return computeLineRemaining(Number(item.quantity) || 0, Number(item.quantity_received) || 0)
}

export function validateReceiptLines(lines: ReceiptLineInput[]): ReceiptLineValidation {
  const errors: string[] = []
  let totalGood = 0
  let totalDamaged = 0
  let totalOutstandingAfter = 0
  let hasPositiveQty = false

  for (const line of lines) {
    const good = Math.max(0, Number(line.quantity_received) || 0)
    const damaged = Math.max(0, Number(line.quantity_damaged) || 0)
    const remaining = Math.max(0, Number(line.remaining_quantity) || 0)
    const totalThisReceipt = good + damaged

    totalGood += good
    totalDamaged += damaged

    if (totalThisReceipt > 0) hasPositiveQty = true

    if (totalThisReceipt > remaining) {
      errors.push(
        `Line exceeds remaining quantity (${totalThisReceipt} > ${remaining} available).`
      )
    }

    totalOutstandingAfter += Math.max(0, remaining - totalThisReceipt)
  }

  if (!hasPositiveQty) {
    errors.push('Enter at least one good or damaged quantity.')
  }

  return {
    valid: errors.length === 0,
    errors,
    hasPositiveQty,
    totalGood,
    totalDamaged,
    totalOutstandingAfter,
  }
}

export function deriveReceiptCondition(
  lines: ReceiptLineInput[],
  userCondition?: ReceiptCondition | null
): DerivedConditionResult {
  const warnings: string[] = []
  const hasDamaged = lines.some((l) => (Number(l.quantity_damaged) || 0) > 0)
  const hasShort = lines.some((l) => {
    const good = Number(l.quantity_received) || 0
    const damaged = Number(l.quantity_damaged) || 0
    const remaining = Number(l.remaining_quantity) || 0
    return good + damaged > 0 && good + damaged < remaining
  })
  const allRemainingFilled = lines.every((l) => {
    const good = Number(l.quantity_received) || 0
    const damaged = Number(l.quantity_damaged) || 0
    const remaining = Number(l.remaining_quantity) || 0
    return remaining === 0 || good + damaged >= remaining
  })

  let condition: ReceiptCondition

  if (userCondition === 'incomplete') {
    condition = 'incomplete'
    if (allRemainingFilled && !hasDamaged) {
      warnings.push('All remaining quantities are filled — "Incomplete" may not apply.')
    }
  } else if (hasDamaged) {
    condition = 'damaged'
    if (userCondition && userCondition !== 'damaged') {
      warnings.push(`Condition adjusted to Damaged because damaged quantities were entered.`)
    }
  } else if (hasShort) {
    condition = 'partial'
    if (userCondition === 'good') {
      warnings.push('Some lines are below remaining qty — condition set to Partial.')
    } else if (userCondition && userCondition !== 'partial') {
      warnings.push(`Condition adjusted to Partial because quantities are below remaining.`)
    }
  } else {
    condition = 'good'
    if (userCondition && userCondition !== 'good') {
      warnings.push('All remaining quantities filled with no damage — condition set to Complete.')
    }
  }

  if (userCondition && userCondition !== condition && userCondition !== 'incomplete') {
    // incomplete handled above; other overrides were auto-corrected with warnings
  }

  return { condition, warnings }
}

export function isPoFullyReceived(
  items: Array<Pick<PurchaseOrderItem, 'quantity' | 'quantity_received'>>
): boolean {
  if (items.length === 0) return false
  return items.every(
    (item) => (Number(item.quantity_received) || 0) >= (Number(item.quantity) || 0)
  )
}

/** PO items after this receipt is applied (simulated). */
export function projectPoItemsAfterReceipt(
  poItems: PurchaseOrderItem[],
  receiptLines: Array<{ po_item_id: string; quantity_received: number; quantity_damaged?: number }>
): PurchaseOrderItem[] {
  const deltaByPoItem = new Map<string, number>()
  for (const line of receiptLines) {
    const delta =
      (Number(line.quantity_received) || 0) + (Number(line.quantity_damaged) || 0)
    if (delta <= 0) continue
    deltaByPoItem.set(line.po_item_id, (deltaByPoItem.get(line.po_item_id) || 0) + delta)
  }

  return poItems.map((item) => ({
    ...item,
    quantity_received:
      (Number(item.quantity_received) || 0) + (deltaByPoItem.get(item.id) || 0),
  }))
}

export function resolvePoStatusAfterReceipt(
  poItems: Array<Pick<PurchaseOrderItem, 'quantity' | 'quantity_received'>>,
  condition: ReceiptCondition
): PurchaseOrder['status'] {
  if (condition === 'incomplete') return 'delivered'
  if (isPoFullyReceived(poItems)) return 'delivered'
  return 'in_transit'
}

export function countOutstandingUnits(
  items: Array<Pick<PurchaseOrderItem, 'quantity' | 'quantity_received'>>
): number {
  return items.reduce((sum, item) => {
    const remaining = Math.max(
      0,
      (Number(item.quantity) || 0) - (Number(item.quantity_received) || 0)
    )
    return sum + remaining
  }, 0)
}

export function buildReceiptSuccessMessage(
  condition: ReceiptCondition,
  validation: Pick<ReceiptLineValidation, 'totalGood' | 'totalDamaged' | 'totalOutstandingAfter'>
): string {
  const parts = ['Delivery recorded successfully.']
  if (validation.totalGood > 0) {
    parts.push(`${validation.totalGood} good unit(s) added to inventory.`)
  }
  if (validation.totalDamaged > 0) {
    parts.push(`${validation.totalDamaged} damaged unit(s) recorded (not added to inventory).`)
  }
  if (condition === 'partial' && validation.totalOutstandingAfter > 0) {
    parts.push(`${validation.totalOutstandingAfter} unit(s) still outstanding — more receipts expected.`)
  }
  if (condition === 'incomplete' && validation.totalOutstandingAfter > 0) {
    parts.push(
      `PO marked delivered with ${validation.totalOutstandingAfter} unreceived unit(s) — verify supplier invoice in Accounting.`
    )
  }
  return parts.join(' ')
}

export function hasPoShortages(
  items: Array<Pick<PurchaseOrderItem, 'quantity' | 'quantity_received'>>
): boolean {
  return items.some(
    (item) => (Number(item.quantity_received) || 0) < (Number(item.quantity) || 0)
  )
}

export function latestReceiptIsIncomplete(
  deliveryReceipts: Array<Pick<DeliveryReceipt, 'condition' | 'delivery_date' | 'created_at'>>
): boolean {
  if (deliveryReceipts.length === 0) return false
  const sorted = [...deliveryReceipts].sort((a, b) => {
    const aTime = new Date(a.created_at || a.delivery_date || 0).getTime()
    const bTime = new Date(b.created_at || b.delivery_date || 0).getTime()
    return bTime - aTime
  })
  return sorted[0]?.condition === 'incomplete'
}
