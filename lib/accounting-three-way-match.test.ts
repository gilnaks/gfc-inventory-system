import assert from 'node:assert/strict'
import {
  runThreeWayMatch,
  computeMatchFingerprint,
  formatMatchErrors,
  formatMatchUserMessage,
  formatMatchActionMessage,
  type ReceivedQtyByPoItem,
} from './accounting-three-way-match'
import type { PurchaseOrderItem } from './supabase'

function poItem(
  id: string,
  qty: number,
  price: number,
  desc = 'Widget'
): PurchaseOrderItem {
  return {
    id,
    po_id: 'po-1',
    product_description: desc,
    quantity: qty,
    unit_price: price,
    unit: 'pc',
    quantity_received: qty,
  } as PurchaseOrderItem
}

function runTests() {
  const items = [poItem('item-1', 10, 100)]
  const received: ReceivedQtyByPoItem = { 'item-1': 10 }

  // 1. Price mismatch → exception with hint
  const priceMismatch = runThreeWayMatch({
    poItems: items,
    receivedByPoItem: received,
    invoiceLines: [
      { po_item_id: 'item-1', quantity_invoiced: 10, unit_price: 110, line_amount: 1100 },
    ],
    headerTotal: 1100,
  })
  assert.equal(priceMismatch.status, 'exception')
  assert.equal(priceMismatch.canCreateVoucher, false)
  assert.ok(priceMismatch.lines[0].resolutionHints.length > 0)
  assert.ok(formatMatchErrors(priceMismatch).includes('Unit price mismatch'))

  // 2. Invoice qty > received → exception
  const qtyMismatch = runThreeWayMatch({
    poItems: items,
    receivedByPoItem: { 'item-1': 5 },
    invoiceLines: [
      { po_item_id: 'item-1', quantity_invoiced: 10, unit_price: 100, line_amount: 1000 },
    ],
    headerTotal: 1000,
  })
  assert.equal(qtyMismatch.status, 'exception')
  assert.ok(qtyMismatch.lines[0].issues.some((i) => i.includes('exceeds received')))

  // 3. Fix invoice → matched
  const matched = runThreeWayMatch({
    poItems: items,
    receivedByPoItem: { 'item-1': 10 },
    invoiceLines: [
      { po_item_id: 'item-1', quantity_invoiced: 10, unit_price: 100, line_amount: 1000 },
    ],
    headerTotal: 1000,
  })
  assert.equal(matched.status, 'matched')
  assert.equal(matched.canCreateVoucher, true)

  // 4. Stale source change flag
  const stale = runThreeWayMatch({
    poItems: items,
    receivedByPoItem: received,
    invoiceLines: [
      { po_item_id: 'item-1', quantity_invoiced: 10, unit_price: 100, line_amount: 1000 },
    ],
    headerTotal: 1000,
    staleSourceChange: true,
  })
  assert.equal(stale.status, 'exception')
  assert.ok(stale.summaryIssues.some((i) => i.includes('Source documents changed')))

  // 5. Fingerprint changes when receipt qty changes
  const fp1 = computeMatchFingerprint(items, { 'item-1': 10 })
  const fp2 = computeMatchFingerprint(items, { 'item-1': 8 })
  assert.notEqual(fp1, fp2)

  // 6. PO qty > received = invoice (partial PO) → exception
  const partialPo = runThreeWayMatch({
    poItems: [poItem('item-1', 3, 2500, 'test-material')],
    receivedByPoItem: { 'item-1': 2 },
    invoiceLines: [
      { po_item_id: 'item-1', quantity_invoiced: 2, unit_price: 2500, line_amount: 5000 },
    ],
    headerTotal: 5000,
  })
  assert.equal(partialPo.status, 'exception')
  assert.ok(partialPo.lines[0].issues.some((i) => i.includes('Partial receipt')))

  // 7. All three qtys equal → matched
  const allEqual = runThreeWayMatch({
    poItems: [poItem('item-1', 2, 2500, 'test-material')],
    receivedByPoItem: { 'item-1': 2 },
    invoiceLines: [
      { po_item_id: 'item-1', quantity_invoiced: 2, unit_price: 2500, line_amount: 5000 },
    ],
    headerTotal: 5000,
  })
  assert.equal(allEqual.status, 'matched')
  assert.equal(allEqual.canCreateVoucher, true)

  // 8. Invoice qty > received → exception
  const invoiceOverReceived = runThreeWayMatch({
    poItems: [poItem('item-1', 2, 2500)],
    receivedByPoItem: { 'item-1': 2 },
    invoiceLines: [
      { po_item_id: 'item-1', quantity_invoiced: 3, unit_price: 2500, line_amount: 7500 },
    ],
    headerTotal: 7500,
  })
  assert.equal(invoiceOverReceived.status, 'exception')
  assert.ok(
    invoiceOverReceived.lines[0].issues.some((i) => i.includes('exceeds received'))
  )
  assert.equal(invoiceOverReceived.lines[0].issues.length, 1)

  const previewMsg = formatMatchUserMessage(invoiceOverReceived, 'preview')
  assert.ok(previewMsg.includes('exceeds received'))
  assert.ok(previewMsg.includes('Set invoice qty to match received'))
  assert.ok(!previewMsg.includes('Then save'))

  const priceOnly = runThreeWayMatch({
    poItems: [poItem('item-1', 3, 2500, 'test-ingredient')],
    receivedByPoItem: { 'item-1': 3 },
    invoiceLines: [
      { po_item_id: 'item-1', quantity_invoiced: 3, unit_price: 2600, line_amount: 7800 },
    ],
    headerTotal: 7800,
  })
  assert.equal(priceOnly.status, 'exception')
  const actionMsg = formatMatchActionMessage(priceOnly)
  assert.ok(actionMsg.includes('unit price'))
  assert.ok(!actionMsg.includes('invoice qty to match received'))

  const qtyAndPrice = runThreeWayMatch({
    poItems: [poItem('item-1', 3, 2500, 'test-ingredient')],
    receivedByPoItem: { 'item-1': 3 },
    invoiceLines: [
      { po_item_id: 'item-1', quantity_invoiced: 4, unit_price: 2600, line_amount: 10400 },
    ],
    headerTotal: 10400,
  })
  assert.equal(qtyAndPrice.status, 'exception')
  const bothMsg = formatMatchActionMessage(qtyAndPrice)
  assert.ok(bothMsg.includes('invoice qty to match received') || bothMsg.includes('Set invoice qty'))
  assert.ok(bothMsg.includes('unit price'))

  console.log('accounting-three-way-match: all scenarios passed')
}

runTests()
