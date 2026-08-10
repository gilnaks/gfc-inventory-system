'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Printer, Truck, Loader2, Search, Trash2 } from 'lucide-react'
import { supabase, type Brand, type IntercompanyTransfer, type Product } from '../../lib/supabase'
import { getFactoryBrand, getRetailBrands, isFactoryBrand } from '../../lib/brand-roles'
import { loadGfcProductDestinations, loadGfcProducts } from '../../lib/gfc-production-catalog'
import {
  createAndPostIntercompanyTransfer,
  loadIntercompanyTransfers,
  type IntercompanyTransferLineInput,
} from '../../lib/intercompany-transfer-service'
import { computeProductAvailableStock } from '../../lib/product-bom-component'
import {
  isProductConsumableSupply,
  productCategoryDisplayName,
} from '../../lib/product-category-settings'
import { printIntercompanyDeliveryNote } from '../../lib/print-intercompany-transfer'
import { getPhilippinesDate } from '../../lib/timezone'
import { formatGlPhp } from './AccountingLedgerTable'
import { AccountingTransfersListSkeleton } from './AccountingBooksSkeletons'

export type IntercompanyProductScope = 'supplies' | 'finished_goods'

interface IntercompanyTransfersPanelProps {
  selectedBrand: Brand
  brands: Brand[]
  currentUsername?: string
  theme?: string
  productScope?: IntercompanyProductScope
  readOnly?: boolean
  embedded?: boolean
}

type DraftLine = IntercompanyTransferLineInput & { key: string }

function scopeDescription(scope: IntercompanyProductScope | undefined): string {
  if (scope === 'supplies') {
    return 'Transfer supplies and consumables (index 0) from GFC to a consumer brand at material cost. Posts paired journals on both books.'
  }
  if (scope === 'finished_goods') {
    return 'Ship finished goods with available GFC stock to a consumer brand at production cost. Only SKUs ready for transfer are listed. Posts paired journals on both books.'
  }
  return 'View intercompany transfers between GFC and consumer brands at cost. Paired journals post on both books.'
}

function scopeTitle(scope: IntercompanyProductScope | undefined): string {
  if (scope === 'finished_goods') return 'Finished Product Transfers'
  if (scope === 'supplies') return 'Supplies Transfers'
  return 'Intercompany Transfers'
}

function createdByLabel(
  scope: IntercompanyProductScope | undefined,
  currentUsername: string,
  readOnly: boolean
): string {
  const name = currentUsername.trim()
  if (name) return name
  if (readOnly) return 'Accounting'
  if (scope === 'supplies') return 'Procurement'
  if (scope === 'finished_goods') return 'Factory'
  return 'Accounting'
}

async function loadCategorySortOrders(brandId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('product_category_sort')
    .select('category_name, sort_index')
    .eq('brand_id', brandId)

  if (error) {
    console.warn('product_category_sort:', error.message)
    return {}
  }

  const orders: Record<string, number> = {}
  for (const row of data || []) {
    const display = productCategoryDisplayName(row.category_name)
    orders[display] = row.sort_index
  }
  return orders
}

function filterProductsByScope(
  products: Product[],
  sortOrders: Record<string, number>,
  scope: IntercompanyProductScope | undefined
): Product[] {
  if (!scope) return products
  return products.filter((p) => {
    const isSupply = isProductConsumableSupply(p, sortOrders)
    return scope === 'supplies' ? isSupply : !isSupply
  })
}

function filterReadyForTransfer(
  products: Product[],
  scope: IntercompanyProductScope | undefined
): Product[] {
  if (scope !== 'finished_goods') return products
  return products.filter((p) => computeProductAvailableStock(p) > 0)
}

function gfcProductUnitCost(products: Product[], productId: string): number {
  const product = products.find((p) => p.id === productId)
  return Math.max(0, Number(product?.price) || 0)
}

function statusBadgeClass(status: string): string {
  if (status === 'posted') return 'bg-green-50 text-green-800 border-green-200'
  if (status === 'draft') return 'bg-amber-50 text-amber-800 border-amber-200'
  return 'bg-gray-100 text-gray-600 border-gray-200'
}

export function IntercompanyTransfersPanel({
  selectedBrand,
  brands,
  currentUsername = '',
  theme = 'blue',
  productScope,
  readOnly = false,
  embedded = false,
}: IntercompanyTransfersPanelProps) {
  const factoryBrand = getFactoryBrand(brands)
  const retailBrands = getRetailBrands(brands)
  const canCreate =
    !readOnly &&
    isFactoryBrand(selectedBrand) &&
    !!factoryBrand &&
    !!productScope &&
    productScope !== 'finished_goods'

  const [transfers, setTransfers] = useState<IntercompanyTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [toBrandId, setToBrandId] = useState(retailBrands[0]?.id || '')
  const [transferDate, setTransferDate] = useState(getPhilippinesDate())
  const [notes, setNotes] = useState('')
  const [gfcProducts, setGfcProducts] = useState<Product[]>([])
  const [lines, setLines] = useState<DraftLine[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const refresh = useCallback(async () => {
    if (!selectedBrand?.id) return
    setLoading(true)
    try {
      setTransfers(await loadIntercompanyTransfers(selectedBrand.id))
    } finally {
      setLoading(false)
    }
  }, [selectedBrand?.id])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!toBrandId && retailBrands[0]?.id) {
      setToBrandId(retailBrands[0].id)
    }
  }, [retailBrands, toBrandId])

  useEffect(() => {
    if (!factoryBrand?.id || !toBrandId || readOnly) {
      setGfcProducts([])
      return
    }
    let cancelled = false
    Promise.all([
      loadGfcProducts(toBrandId),
      loadGfcProductDestinations(),
      loadCategorySortOrders(factoryBrand.id),
    ])
      .then(([products, destinations, sortOrders]) => {
        if (cancelled) return
        const withNames = products.map((p) => {
          const dest = destinations.get(p.id as string)
          const displayName = dest?.retail_product_name?.trim() || p.name || ''
          return {
            ...p,
            name: displayName,
            product_name: displayName,
          } as Product
        })
        const scoped = filterProductsByScope(withNames, sortOrders, productScope)
        setGfcProducts(filterReadyForTransfer(scoped, productScope))
      })
      .catch((err) => {
        console.error('loadGfcProducts:', err)
        if (!cancelled) setGfcProducts([])
      })
    return () => {
      cancelled = true
    }
  }, [factoryBrand?.id, toBrandId, productScope, readOnly])

  useEffect(() => {
    setLines((prev) =>
      prev.map((line) => {
        const productId = gfcProducts.some((p) => p.id === line.sourceProductId)
          ? line.sourceProductId
          : gfcProducts[0]?.id || ''
        return {
          ...line,
          sourceProductId: productId,
          unitCost: gfcProductUnitCost(gfcProducts, productId),
        }
      })
    )
  }, [gfcProducts])

  const addLine = () => {
    const first = gfcProducts[0]
    const productId = first?.id || ''
    setLines((prev) => [
      ...prev,
      {
        key: `line-${Date.now()}`,
        sourceProductId: productId,
        quantity: 1,
        unitCost: gfcProductUnitCost(gfcProducts, productId),
      },
    ])
  }

  const submit = async () => {
    if (!factoryBrand || !toBrandId || !lines.length) return
    setSaving(true)
    try {
      await createAndPostIntercompanyTransfer({
        fromBrandId: factoryBrand.id,
        toBrandId,
        transferDate,
        lines: lines.map((line) => ({
          ...line,
          unitCost: gfcProductUnitCost(gfcProducts, line.sourceProductId),
        })),
        notes: notes.trim() || undefined,
        createdBy: createdByLabel(productScope, currentUsername, readOnly),
      })
      setShowForm(false)
      setLines([])
      setNotes('')
      await refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to post transfer')
    } finally {
      setSaving(false)
    }
  }

  const btnClass =
    theme === 'green'
      ? 'bg-green-600 hover:bg-green-700'
      : theme === 'red'
        ? 'bg-red-600 hover:bg-red-700'
        : 'bg-blue-600 hover:bg-blue-700'

  const pricedPreview = useMemo(() => {
    return lines.map((l) => {
      const unitCost = gfcProductUnitCost(gfcProducts, l.sourceProductId)
      const qty = Number(l.quantity) || 0
      return { ...l, unitCost, unitPrice: unitCost, linePrice: Math.round(qty * unitCost * 100) / 100 }
    })
  }, [lines, gfcProducts])

  const emptyProductMessage =
    productScope === 'supplies'
      ? 'No supplies/consumables for this brand'
      : productScope === 'finished_goods'
        ? 'No finished goods ready for transfer'
        : 'No products for this brand'

  const filteredTransfers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return transfers.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false
      if (!q) return true
      const route = `${t.from_brand?.name || ''} ${t.to_brand?.name || ''}`.toLowerCase()
      return (
        t.transfer_number.toLowerCase().includes(q) ||
        route.includes(q) ||
        (t.notes || '').toLowerCase().includes(q)
      )
    })
  }, [transfers, search, statusFilter])

  const stats = useMemo(() => {
    const posted = filteredTransfers.filter((t) => t.status === 'posted')
    return {
      count: filteredTransfers.length,
      posted: posted.length,
      totalCost: filteredTransfers.reduce((s, t) => s + (Number(t.cost_amount_total) || 0), 0),
    }
  }, [filteredTransfers])

  const formTotalPrice = pricedPreview.reduce((s, l) => s + l.linePrice, 0)

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Truck className="h-5 w-5 text-indigo-600" />
              {scopeTitle(productScope)}
            </h2>
            <p className="text-sm text-gray-600 mt-1">{scopeDescription(productScope)}</p>
            {productScope === 'finished_goods' ? (
              <p className="text-xs text-gray-500 mt-1">
                Finished-goods transfers are auto-posted when production batches are completed.
              </p>
            ) : null}
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setShowForm(true)
                if (!lines.length) addLine()
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg shrink-0 ${btnClass}`}
            >
              <Plus className="h-4 w-4" />
              New transfer
            </button>
          )}
        </div>
      )}

      {embedded && productScope === 'finished_goods' && (
        <p className="text-sm text-gray-600">
          Intercompany finished-goods transfers post paired journals on GFC and the receiving brand.
          New FG transfers are created from Factory when batches complete.
        </p>
      )}

      {!readOnly && !isFactoryBrand(selectedBrand) && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
          Viewing transfers for <strong>{selectedBrand.name}</strong>. Create new transfers from{' '}
          <strong>GFC</strong> Procurement or Factory.
        </div>
      )}

      {embedded && canCreate && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setShowForm(true)
              if (!lines.length) addLine()
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg ${btnClass}`}
          >
            <Plus className="h-4 w-4" />
            New transfer
          </button>
        </div>
      )}

      {showForm && canCreate && (
        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">New intercompany transfer</h3>
            <p className="text-xs text-gray-500 mt-0.5">Transfers at production/material cost on both books.</p>
          </div>
          <div className="p-4 space-y-4 bg-gray-50/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="text-xs font-medium text-gray-700 block mb-1">To brand</span>
              <select
                value={toBrandId}
                onChange={(e) => setToBrandId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {retailBrands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-gray-700 block mb-1">Transfer date</span>
              <input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="text-sm block">
            <span className="text-xs font-medium text-gray-700 block mb-1">Notes</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Delivery note reference"
            />
          </label>

          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">GFC product</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit cost</th>
                  <th className="px-3 py-2 text-right">Line total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pricedPreview.map((line, idx) => {
                  return (
                    <tr key={line.key}>
                      <td className="px-3 py-2">
                        <select
                          value={line.sourceProductId}
                          onChange={(e) => {
                            const id = e.target.value
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx
                                  ? {
                                      ...l,
                                      sourceProductId: id,
                                      unitCost: gfcProductUnitCost(gfcProducts, id),
                                    }
                                  : l
                              )
                            )
                          }}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          {gfcProducts.length === 0 ? (
                            <option value="">{emptyProductMessage}</option>
                          ) : (
                            gfcProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.product_name || p.name} ({computeProductAvailableStock(p)} avail)
                              </option>
                            ))
                          )}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) => {
                            const quantity = Number(e.target.value) || 0
                            setLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, quantity } : l))
                            )
                          }}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                        {formatGlPhp(line.unitCost)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatGlPhp(line.linePrice)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {pricedPreview.length > 0 && (
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td colSpan={3} className="px-3 py-2.5 text-right text-xs font-medium text-gray-600">
                      Transfer total
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                      {formatGlPhp(formTotalPrice)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Add line
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !lines.length}
              onClick={submit}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${btnClass}`}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Post transfer
            </button>
          </div>
          </div>
        </section>
      )}

      {!loading && transfers.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { label: 'Transfers', sub: `${stats.posted} posted`, value: String(stats.count) },
            { label: 'Total at cost', sub: 'production / material cost', value: formatGlPhp(stats.totalCost) },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-lg font-semibold tabular-nums text-gray-900 mt-0.5">{card.value}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Filter transfers</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-700 mb-1 block">Search</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="search"
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white"
                placeholder="Number, brand, or notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-700 mb-1 block">Status</span>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="posted">Posted</option>
              <option value="draft">Draft</option>
              <option value="void">Void</option>
            </select>
          </label>
        </div>
        {(search || statusFilter) && (
          <p className="text-xs text-gray-500">
            Showing {filteredTransfers.length} of {transfers.length}.{' '}
            <button
              type="button"
              className="text-blue-600 hover:underline"
              onClick={() => {
                setSearch('')
                setStatusFilter('')
              }}
            >
              Clear filters
            </button>
          </p>
        )}
      </section>

      {loading ? (
        <AccountingTransfersListSkeleton />
      ) : filteredTransfers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-10 text-center text-sm text-gray-500">
          {transfers.length === 0
            ? 'No intercompany transfers yet.'
            : 'No transfers match your filters.'}
        </div>
      ) : (
        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Transfer history</h3>
          </div>
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white border-b text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left">Number</th>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Route</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTransfers.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/80">
                  <td className="px-4 py-2.5 font-mono text-xs font-medium">{t.transfer_number}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{t.transfer_date}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-gray-700">{t.from_brand?.name || 'GFC'}</span>
                    <span className="text-gray-400 mx-1">→</span>
                    <span className="text-gray-700">{t.to_brand?.name || '—'}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                    {formatGlPhp(Number(t.cost_amount_total))}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex capitalize rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(t.status)}`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {t.status === 'posted' && (
                      <button
                        type="button"
                        onClick={() => printIntercompanyDeliveryNote(t)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Print
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      )}
    </div>
  )
}
