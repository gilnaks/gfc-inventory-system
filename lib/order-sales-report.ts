import { productCategoryDisplayName } from './product-category-settings'
import {
  getOrderPickupDiscount,
  getOrderTotalAmount,
  type OrderTotalInput,
} from './order-totals'

export type OrderSalesLineProduct = {
  id?: string
  name?: string | null
  sku?: string | null
  unit?: string | null
  category?: string | null
}

export type OrderSalesOrderDetail = {
  quantity?: number | null
  unit_price?: number | null
  products?: OrderSalesLineProduct | null
  product?: OrderSalesLineProduct | null
}

export type OrderSalesOrderInput = {
  id?: string
  status?: string | null
  delivery_type?: string | null
  total_amount?: number | null
  created_at?: string
  location?: {
    id?: string
    name?: string | null
    company_owned?: boolean | null
  } | null
  order_details?: OrderSalesOrderDetail[] | null
}

export type OrderSalesProductLine = {
  productId: string
  name: string
  sku: string
  qty: number
  amount: number
}

export type OrderSalesCategoryDetail = {
  name: string
  qty: number
  amount: number
  products: OrderSalesProductLine[]
}

export type OrderSalesLocationDetail = {
  locationId: string
  locationName: string
  locationTotal: number
  categories: OrderSalesCategoryDetail[]
}

export type OrderSalesFranchiseReceivables = {
  discount: number
  payable: number
  paidAmt: number
  balance: number
}

export type OrderSalesSummaryRow = {
  locationId: string
  locationName: string
  amountsByCategory: Record<string, number>
  locationTotal: number
  franchise?: OrderSalesFranchiseReceivables
}

export type OrderSalesReportData = {
  categories: string[]
  summaryRows: OrderSalesSummaryRow[]
  categoryTotals: Record<string, number>
  grandTotal: number
  locations: OrderSalesLocationDetail[]
  /** When true, summary matrix includes Discount / Payable / Paid Amt / Balance after Total. */
  includeFranchiseReceivables: boolean
  franchiseTotals?: OrderSalesFranchiseReceivables
}

function lineProduct(detail: OrderSalesOrderDetail): OrderSalesLineProduct | null {
  return detail.products || detail.product || null
}

function sortCategories(
  names: string[],
  categorySortOrders?: Record<string, number>
): string[] {
  return [...names].sort((a, b) => {
    const ai = categorySortOrders?.[a]
    const bi = categorySortOrders?.[b]
    const aHas = typeof ai === 'number'
    const bHas = typeof bi === 'number'
    if (aHas && bHas && ai !== bi) return ai - bi
    if (aHas && !bHas) return -1
    if (!aHas && bHas) return 1
    return a.localeCompare(b)
  })
}

function toOrderTotalInput(order: OrderSalesOrderInput): OrderTotalInput {
  return {
    delivery_type: order.delivery_type,
    order_details: (order.order_details || []).map((d) => ({
      unit_price: Number(d.unit_price) || 0,
      quantity: Number(d.quantity) || 0,
    })),
  }
}

function emptyFranchise(): OrderSalesFranchiseReceivables {
  return { discount: 0, payable: 0, paidAmt: 0, balance: 0 }
}

/**
 * Aggregate filtered customer orders into a location × category summary matrix
 * and per-location category → product breakdowns.
 *
 * When `includeFranchiseReceivables` is true (franchise-only or mixed All filter), each summary
 * row also gets Discount / Payable / Paid Amt / Balance after Total.
 */
export function buildOrderSalesReport(
  orders: OrderSalesOrderInput[],
  categorySortOrders?: Record<string, number>,
  options?: { includeFranchiseReceivables?: boolean }
): OrderSalesReportData {
  const includeFranchiseReceivables = !!options?.includeFranchiseReceivables

  type ProductAgg = { productId: string; name: string; sku: string; qty: number; amount: number }
  type LocAgg = {
    locationId: string
    locationName: string
    byCategory: Map<string, { qty: number; amount: number; products: Map<string, ProductAgg> }>
    franchise: OrderSalesFranchiseReceivables
  }

  const byLocation = new Map<string, LocAgg>()

  for (const order of orders) {
    const locationId = order.location?.id || 'unknown'
    const locationName = (order.location?.name || 'Unknown').trim() || 'Unknown'
    let loc = byLocation.get(locationId)
    if (!loc) {
      loc = {
        locationId,
        locationName,
        byCategory: new Map(),
        franchise: emptyFranchise(),
      }
      byLocation.set(locationId, loc)
    }

    if (includeFranchiseReceivables) {
      const totalInput = toOrderTotalInput(order)
      const payable = getOrderTotalAmount(totalInput)
      const discount = getOrderPickupDiscount(totalInput)
      const status = (order.status || '').toLowerCase()
      loc.franchise.discount += discount
      loc.franchise.payable += payable
      if (status === 'paid' || status === 'complete') {
        loc.franchise.paidAmt += payable
      } else if (status === 'fulfilled') {
        loc.franchise.balance += payable
      }
    }

    for (const detail of order.order_details || []) {
      const qty = Number(detail.quantity) || 0
      const unitPrice = Number(detail.unit_price) || 0
      if (qty === 0 && unitPrice === 0) continue
      const amount = qty * unitPrice
      if (amount === 0 && qty === 0) continue

      const product = lineProduct(detail)
      const category = productCategoryDisplayName(product?.category)
      const productId = product?.id || `unknown:${product?.name || 'item'}`
      const productName = (product?.name || 'Unknown product').trim() || 'Unknown product'
      const sku = (product?.sku || '').trim()

      let cat = loc.byCategory.get(category)
      if (!cat) {
        cat = { qty: 0, amount: 0, products: new Map() }
        loc.byCategory.set(category, cat)
      }
      cat.qty += qty
      cat.amount += amount

      let prod = cat.products.get(productId)
      if (!prod) {
        prod = { productId, name: productName, sku, qty: 0, amount: 0 }
        cat.products.set(productId, prod)
      }
      prod.qty += qty
      prod.amount += amount
      if (!prod.sku && sku) prod.sku = sku
      if (prod.name === 'Unknown product' && productName !== 'Unknown product') {
        prod.name = productName
      }
    }
  }

  const categorySet = new Set<string>()
  for (const loc of byLocation.values()) {
    for (const name of loc.byCategory.keys()) categorySet.add(name)
  }
  const categories = sortCategories([...categorySet], categorySortOrders)

  const summaryRows: OrderSalesSummaryRow[] = []
  const locations: OrderSalesLocationDetail[] = []
  const categoryTotals: Record<string, number> = {}
  for (const c of categories) categoryTotals[c] = 0
  const franchiseTotals = emptyFranchise()

  const sortedLocs = [...byLocation.values()].sort((a, b) =>
    a.locationName.localeCompare(b.locationName)
  )

  for (const loc of sortedLocs) {
    const amountsByCategory: Record<string, number> = {}
    let locationTotal = 0
    const categoryDetails: OrderSalesCategoryDetail[] = []

    for (const catName of categories) {
      const cat = loc.byCategory.get(catName)
      const amount = cat?.amount || 0
      const qty = cat?.qty || 0
      amountsByCategory[catName] = amount
      locationTotal += amount
      categoryTotals[catName] = (categoryTotals[catName] || 0) + amount

      if (!cat || (amount === 0 && qty === 0)) continue

      const products = [...cat.products.values()]
        .filter((p) => p.amount !== 0 || p.qty !== 0)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({
          productId: p.productId,
          name: p.name,
          sku: p.sku,
          qty: p.qty,
          amount: p.amount,
        }))

      categoryDetails.push({
        name: catName,
        qty,
        amount,
        products,
      })
    }

    for (const [catName, cat] of loc.byCategory) {
      if (categories.includes(catName)) continue
      if (cat.amount === 0 && cat.qty === 0) continue
      locationTotal += cat.amount
      categoryDetails.push({
        name: catName,
        qty: cat.qty,
        amount: cat.amount,
        products: [...cat.products.values()]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((p) => ({
            productId: p.productId,
            name: p.name,
            sku: p.sku,
            qty: p.qty,
            amount: p.amount,
          })),
      })
    }

    categoryDetails.sort((a, b) => {
      const ai = categories.indexOf(a.name)
      const bi = categories.indexOf(b.name)
      if (ai >= 0 && bi >= 0) return ai - bi
      if (ai >= 0) return -1
      if (bi >= 0) return 1
      return a.name.localeCompare(b.name)
    })

    if (locationTotal === 0 && categoryDetails.length === 0 && loc.franchise.payable === 0) {
      continue
    }

    if (includeFranchiseReceivables) {
      franchiseTotals.discount += loc.franchise.discount
      franchiseTotals.payable += loc.franchise.payable
      franchiseTotals.paidAmt += loc.franchise.paidAmt
      franchiseTotals.balance += loc.franchise.balance
    }

    summaryRows.push({
      locationId: loc.locationId,
      locationName: loc.locationName,
      amountsByCategory,
      locationTotal,
      ...(includeFranchiseReceivables ? { franchise: { ...loc.franchise } } : {}),
    })

    locations.push({
      locationId: loc.locationId,
      locationName: loc.locationName,
      locationTotal,
      categories: categoryDetails,
    })
  }

  const grandTotal = summaryRows.reduce((sum, row) => sum + row.locationTotal, 0)

  return {
    categories,
    summaryRows,
    categoryTotals,
    grandTotal,
    locations,
    includeFranchiseReceivables,
    ...(includeFranchiseReceivables ? { franchiseTotals } : {}),
  }
}

export function formatOrderSalesMoney(amount: number): string {
  return amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Blank when zero — matches the classic matrix screenshot style. */
export function formatOrderSalesMatrixCell(amount: number): string {
  if (!amount) return ''
  return formatOrderSalesMoney(amount)
}
