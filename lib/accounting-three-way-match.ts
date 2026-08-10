import type { PurchaseOrderItem, SupplierInvoiceLine } from './supabase'

export type ThreeWayMatchLineResult = {
  poItemId: string
  description: string
  poQty: number
  receivedQty: number
  invoiceQty: number
  poPrice: number
  invoicePrice: number
  lineAmount: number
  issues: string[]
  resolutionHints: string[]
}

export type ThreeWayMatchSummary = {
  status: 'matched' | 'exception'
  lines: ThreeWayMatchLineResult[]
  headerTotal: number
  lineTotal: number
  canCreateVoucher: boolean
  summaryIssues: string[]
  summaryResolutionHints: string[]
  fingerprint: string
  staleSourceChange?: boolean
}

export type ThreeWayMatchResult = ThreeWayMatchSummary

const EPS = 0.0001
const MONEY_EPS = 0.01

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function pricesMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < EPS
}

function moneyMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < MONEY_EPS
}

function qtyMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < EPS
}

export type ReceivedQtyByPoItem = Record<string, number>

export function buildReceivedQtyMap(
  poItems: PurchaseOrderItem[],
  drItems: Array<{ po_item_id: string; quantity_received: number; quantity_damaged?: number }>
): ReceivedQtyByPoItem {
  const map: ReceivedQtyByPoItem = {}
  for (const item of poItems) {
    map[item.id] = Number(item.quantity_received) || 0
  }
  for (const dr of drItems) {
    if (!map[dr.po_item_id]) map[dr.po_item_id] = 0
    if (map[dr.po_item_id] === 0) {
      map[dr.po_item_id] +=
        (Number(dr.quantity_received) || 0) + (Number(dr.quantity_damaged) || 0)
    }
  }
  return map
}

export function computeMatchFingerprint(
  poItems: PurchaseOrderItem[],
  receivedByPoItem: ReceivedQtyByPoItem
): string {
  const parts = poItems
    .map((item) => ({
      id: item.id,
      qty: Number(item.quantity) || 0,
      price: Number(item.unit_price) || 0,
      received: receivedByPoItem[item.id] ?? 0,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
  return JSON.stringify(parts)
}

export function runThreeWayMatch(input: {
  poItems: PurchaseOrderItem[]
  receivedByPoItem: ReceivedQtyByPoItem
  invoiceLines: Pick<SupplierInvoiceLine, 'po_item_id' | 'quantity_invoiced' | 'unit_price' | 'line_amount'>[]
  headerTotal: number
  staleSourceChange?: boolean
  finalReceiptIncomplete?: boolean
}): ThreeWayMatchResult {
  const {
    poItems,
    receivedByPoItem,
    invoiceLines,
    headerTotal,
    staleSourceChange,
    finalReceiptIncomplete,
  } = input
  const fingerprint = computeMatchFingerprint(poItems, receivedByPoItem)
  const poItemMap = new Map(poItems.map((i) => [i.id, i]))
  const lines: ThreeWayMatchLineResult[] = []
  const summaryIssues: string[] = []
  const summaryResolutionHints: string[] = []

  if (staleSourceChange) {
    summaryIssues.push('Source documents changed since last match.')
    summaryResolutionHints.push(
      'Review PO and receiving report in Procurement, then re-save the supplier invoice.'
    )
  }

  if (finalReceiptIncomplete) {
    const hasShortage = poItems.some(
      (item) => (receivedByPoItem[item.id] ?? 0) < (Number(item.quantity) || 0)
    )
    if (hasShortage) {
      summaryIssues.push(
        'Final receipt recorded with unreceived quantities — verify invoice amount.'
      )
      summaryResolutionHints.push(
        'The PO was closed with a short shipment. Ensure the supplier invoice reflects only goods billed, or request a credit note for unreceived items.'
      )
    }
  }

  if (invoiceLines.length === 0) {
    summaryIssues.push('At least one invoice line is required.')
    summaryResolutionHints.push('Add invoice lines for received PO items before saving.')
  }

  let lineTotal = 0
  for (const invLine of invoiceLines) {
    const poItem = poItemMap.get(invLine.po_item_id)
    const issues: string[] = []
    const resolutionHints: string[] = []

    if (!poItem) {
      issues.push('PO line not found.')
      resolutionHints.push('Remove invalid line or select a valid PO item.')
      lines.push({
        poItemId: invLine.po_item_id,
        description: 'Unknown',
        poQty: 0,
        receivedQty: 0,
        invoiceQty: Number(invLine.quantity_invoiced) || 0,
        poPrice: 0,
        invoicePrice: Number(invLine.unit_price) || 0,
        lineAmount: Number(invLine.line_amount) || 0,
        issues,
        resolutionHints,
      })
      continue
    }

    const poQty = Number(poItem.quantity) || 0
    const receivedQty = receivedByPoItem[poItem.id] ?? 0
    const invoiceQty = Number(invLine.quantity_invoiced) || 0
    const poPrice = Number(poItem.unit_price) || 0
    const invoicePrice = Number(invLine.unit_price) || 0
    const expectedLineAmount = roundMoney(invoiceQty * invoicePrice)
    const lineAmount = Number(invLine.line_amount) || 0
    lineTotal += lineAmount

    if (invoiceQty <= 0) {
      issues.push('Invoice quantity must be greater than zero.')
      resolutionHints.push('Enter the quantity shown on the supplier invoice for this line.')
    } else {
      if (invoiceQty > receivedQty + EPS) {
        issues.push(`Invoice qty (${invoiceQty}) exceeds received (${receivedQty}).`)
        resolutionHints.push(
          'Set invoice qty to match received, or record additional receipt in Procurement.'
        )
      } else if (invoiceQty + EPS < receivedQty) {
        issues.push(`Invoice qty (${invoiceQty}) is less than received (${receivedQty}).`)
        resolutionHints.push('Increase invoice qty or correct the receiving report in Procurement.')
      } else if (receivedQty + EPS < poQty) {
        issues.push(`Partial receipt: ${receivedQty} of ${poQty} ordered (${invoiceQty} invoiced).`)
        resolutionHints.push(
          'Record remaining receipt, or amend PO qty in Procurement if the order changed.'
        )
      } else if (!qtyMatch(poQty, invoiceQty)) {
        issues.push(`PO qty (${poQty}) does not match invoice (${invoiceQty}).`)
        resolutionHints.push('Update PO qty in Procurement or fix invoice qty.')
      }

      if (receivedQty > poQty + EPS) {
        issues.push(`Received qty (${receivedQty}) exceeds PO qty (${poQty}).`)
        resolutionHints.push('Correct the receiving report or PO quantity in Procurement.')
      }
    }
    if (!pricesMatch(poPrice, invoicePrice)) {
      issues.push(`Unit price mismatch: PO ${poPrice} vs invoice ${invoicePrice}.`)
      resolutionHints.push(
        'Fix invoice unit price or update PO unit price in Procurement → Purchase Orders.'
      )
    }
    if (!moneyMatch(expectedLineAmount, lineAmount)) {
      issues.push(`Line amount ${lineAmount} does not equal qty × price (${expectedLineAmount}).`)
      resolutionHints.push('Fix invoice line amount or adjust qty/price so they multiply correctly.')
    }

    lines.push({
      poItemId: poItem.id,
      description: poItem.product_description,
      poQty,
      receivedQty,
      invoiceQty,
      poPrice,
      invoicePrice,
      lineAmount,
      issues,
      resolutionHints,
    })
  }

  if (!moneyMatch(lineTotal, headerTotal)) {
    summaryIssues.push(
      `Header total (${headerTotal}) does not match sum of lines (${roundMoney(lineTotal)}).`
    )
    summaryResolutionHints.push('Fix invoice line amounts or header total so they agree.')
  }

  const hasLineIssues = lines.some((l) => l.issues.length > 0)
  const status =
    summaryIssues.length === 0 && !hasLineIssues && lines.length > 0 ? 'matched' : 'exception'

  return {
    status,
    lines,
    headerTotal,
    lineTotal: roundMoney(lineTotal),
    canCreateVoucher: status === 'matched',
    summaryIssues,
    summaryResolutionHints,
    fingerprint,
    staleSourceChange: staleSourceChange || undefined,
  }
}

export function matchIssueNeedsPoAmendment(issue: string): boolean {
  return issue.includes('PO qty') || issue.includes('Partial receipt')
}

export function matchResultNeedsPoAmendment(result: ThreeWayMatchResult | null): boolean {
  if (!result) return false
  return result.lines.some((line) => line.issues.some(matchIssueNeedsPoAmendment))
}

export function parseMatchSummary(raw: unknown): ThreeWayMatchSummary | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as ThreeWayMatchSummary
  if (o.status !== 'matched' && o.status !== 'exception') return null
  if (!Array.isArray(o.lines)) return null
  return o
}

export function formatMatchErrors(result: ThreeWayMatchResult): string {
  const parts: string[] = []

  for (let i = 0; i < result.summaryIssues.length; i++) {
    parts.push(result.summaryIssues[i])
    const hint = result.summaryResolutionHints[i]
    if (hint) parts.push(`  ${hint}`)
  }

  for (const line of result.lines) {
    if (line.issues.length === 0) continue
    parts.push(`${line.description}: ${line.issues.join('; ')}`)
    const hints = Array.from(new Set(line.resolutionHints.filter(Boolean)))
    if (hints.length === 1) {
      parts.push(`  ${hints[0]}`)
    }
  }

  return parts.join('\n')
}

/** One-line match message for invoice modal (preview and saved). */
export function formatMatchUserMessage(
  result: ThreeWayMatchResult,
  mode: 'preview' | 'saved'
): string {
  const lineIssues = result.lines.filter((l) => l.issues.length > 0)
  const hasIssues = lineIssues.length > 0 || result.summaryIssues.length > 0

  if (!hasIssues) {
    return mode === 'preview' ? 'Save invoice to confirm match.' : ''
  }

  const line = lineIssues[0]
  if (line) {
    const primary = line.issues[0]
    const action = line.resolutionHints.find(Boolean)
    const more =
      lineIssues.length > 1 ? ` (+${lineIssues.length - 1} more line${lineIssues.length > 2 ? 's' : ''})` : ''
    if (action) {
      return `${line.description}: ${primary}${more} ${action}`
    }
    return `${line.description}: ${primary}${more}.`
  }

  const issue = result.summaryIssues[0]
  const hint = result.summaryResolutionHints[0]
  if (mode === 'preview') {
    return hint ? `${issue} ${hint}` : issue || 'Fix line items.'
  }
  return hint ? `${issue} ${hint}` : issue || 'Resolve match issues before payment.'
}

function pickLineActionHints(line: ThreeWayMatchLineResult): string[] {
  const hints: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < line.issues.length; i++) {
    const hint = line.resolutionHints[i]
    if (hint && !seen.has(hint)) {
      seen.add(hint)
      hints.push(hint)
    }
  }
  return hints
}

/** Action hints for summary panel when line status column shows the mismatch. */
export function formatMatchActionMessages(result: ThreeWayMatchResult): string[] {
  const activeLines = result.lines.filter((l) => l.invoiceQty > 0 && l.issues.length > 0)
  if (activeLines.length === 0) {
    const fallback = result.summaryResolutionHints[0] || result.summaryIssues[0]
    return fallback ? [fallback] : []
  }

  const hints = new Set<string>()
  for (const line of activeLines) {
    for (const hint of pickLineActionHints(line)) {
      hints.add(hint)
    }
  }
  return [...hints]
}

/** @deprecated Prefer formatMatchActionMessages for multi-line display */
export function formatMatchActionMessage(result: ThreeWayMatchResult): string {
  return formatMatchActionMessages(result).join(' ')
}
