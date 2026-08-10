'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Truck, Loader2, Search, Trash2 } from 'lucide-react'
import type { Brand, MaterialTransfer, RawMaterial } from '../../lib/supabase'
import { getFactoryBrand, getRetailBrands, isFactoryBrand } from '../../lib/brand-roles'
import {
  createAndPostMaterialTransfer,
  loadGfcMaterials,
  loadMaterialTransfers,
  type MaterialTransferLineInput,
} from '../../lib/material-transfer-service'
import { formatMaterialStockAvailable } from '../../lib/product-material-link'
import { getPurchaseUnitLabel, stockUnitsPerPurchase } from '../../lib/raw-material-uom'
import { getPhilippinesDate } from '../../lib/timezone'
import { formatGlPhp } from './AccountingLedgerTable'
import { AccountingTransfersListSkeleton } from './AccountingBooksSkeletons'

interface MaterialTransfersPanelProps {
  selectedBrand: Brand
  brands: Brand[]
  currentUsername?: string
  theme?: string
  readOnly?: boolean
  embedded?: boolean
}

type DraftLine = MaterialTransferLineInput & { key: string }

function materialPurchaseUnitCost(materials: RawMaterial[], materialId: string): number {
  const material = materials.find((m) => m.id === materialId)
  if (!material) return 0
  return Number(material.unit_cost) || 0
}

function formatMoney(value: number): string {
  return formatGlPhp(value)
}

function statusBadgeClass(status: string): string {
  if (status === 'posted') return 'bg-green-50 text-green-800 border-green-200'
  if (status === 'draft') return 'bg-amber-50 text-amber-800 border-amber-200'
  return 'bg-gray-100 text-gray-600 border-gray-200'
}

export function MaterialTransfersPanel({
  selectedBrand,
  brands,
  currentUsername = '',
  theme = 'blue',
  readOnly = false,
  embedded = false,
}: MaterialTransfersPanelProps) {
  const factoryBrand = getFactoryBrand(brands)
  const retailBrands = getRetailBrands(brands)
  const canCreate = !readOnly && isFactoryBrand(selectedBrand) && !!factoryBrand

  const [transfers, setTransfers] = useState<MaterialTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [toBrandId, setToBrandId] = useState(retailBrands[0]?.id || '')
  const [transferDate, setTransferDate] = useState(getPhilippinesDate())
  const [notes, setNotes] = useState('')
  const [gfcMaterials, setGfcMaterials] = useState<RawMaterial[]>([])
  const [lines, setLines] = useState<DraftLine[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const selectedToBrand = retailBrands.find((b) => b.id === toBrandId) || null

  const refresh = useCallback(async () => {
    if (!selectedBrand?.id) return
    setLoading(true)
    try {
      setTransfers(await loadMaterialTransfers(selectedBrand.id))
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
    if (!factoryBrand?.id || readOnly) {
      setGfcMaterials([])
      return
    }
    if (!selectedToBrand?.name) {
      setGfcMaterials([])
      return
    }
    let cancelled = false
    loadGfcMaterials(factoryBrand.id, selectedToBrand.id, selectedToBrand.name)
      .then((materials) => {
        if (!cancelled) setGfcMaterials(materials)
      })
      .catch((err) => {
        console.error('loadGfcMaterials:', err)
        if (!cancelled) setGfcMaterials([])
      })
    return () => {
      cancelled = true
    }
  }, [factoryBrand?.id, readOnly, selectedToBrand?.name])

  useEffect(() => {
    setLines((prev) =>
      prev.map((line) => {
        const materialId = gfcMaterials.some((m) => m.id === line.sourceMaterialId)
          ? line.sourceMaterialId
          : gfcMaterials[0]?.id || ''
        return { ...line, sourceMaterialId: materialId }
      })
    )
  }, [gfcMaterials])

  const addLine = () => {
    const first = gfcMaterials[0]
    const materialId = first?.id || ''
    setLines((prev) => [
      ...prev,
      {
        key: `line-${Date.now()}`,
        sourceMaterialId: materialId,
        quantity: 1,
      },
    ])
  }

  const submit = async () => {
    if (!factoryBrand || !toBrandId || !lines.length) return
    setSaving(true)
    try {
      await createAndPostMaterialTransfer({
        fromBrandId: factoryBrand.id,
        toBrandId,
        transferDate,
        lines: lines.map(({ sourceMaterialId, quantity }) => ({
          sourceMaterialId,
          quantity,
        })),
        notes: notes.trim() || undefined,
        createdBy: currentUsername.trim() || 'Procurement',
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
      const material = gfcMaterials.find((m) => m.id === l.sourceMaterialId)
      const unitCost = materialPurchaseUnitCost(gfcMaterials, l.sourceMaterialId)
      const qty = Number(l.quantity) || 0
      return {
        ...l,
        material,
        unitCost,
        lineCost: Math.round(qty * unitCost * 100) / 100,
      }
    })
  }, [lines, gfcMaterials])

  const totalCost = pricedPreview.reduce((sum, l) => sum + l.lineCost, 0)
  const maxPurchaseQty = (material?: RawMaterial) => {
    if (!material) return 0
    const stock = Number(material.current_stock) || 0
    return stock / stockUnitsPerPurchase(material)
  }
  const hasInvalidLines = pricedPreview.some((line) => {
    const qty = Number(line.quantity) || 0
    const maxQty = maxPurchaseQty(line.material)
    return qty <= 0 || (maxQty > 0 && qty > maxQty + 1e-9)
  })

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

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Truck className="h-5 w-5 text-indigo-600" />
              Material Inventory Transfers
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Transfer GFC materials inventory to a brand&apos;s procurement materials inventory at
              cost. Posts paired journals on both books (Due-from / Due-to).
            </p>
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

      {embedded && (
        <p className="text-sm text-gray-600">
          Raw material transfers move GFC inventory to a brand at cost and post Due-from / Due-to
          journals on both books. Create new transfers from GFC Procurement.
        </p>
      )}

      {!readOnly && !isFactoryBrand(selectedBrand) && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
          Viewing transfers for <strong>{selectedBrand.name}</strong>. Create new transfers from{' '}
          <strong>GFC</strong> Procurement.
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
            <h3 className="text-sm font-semibold text-gray-900">New material transfer</h3>
            <p className="text-xs text-gray-500 mt-0.5">At-cost transfer to brand procurement inventory.</p>
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
                  <th className="px-3 py-2">GFC material</th>
                  <th className="px-3 py-2 text-right">Qty (purchase units)</th>
                  <th className="px-3 py-2 text-right">Unit cost</th>
                  <th className="px-3 py-2 text-right">Line total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pricedPreview.map((line, idx) => (
                  <tr key={line.key}>
                    <td className="px-3 py-2">
                      <select
                        value={line.sourceMaterialId}
                        onChange={(e) => {
                          const id = e.target.value
                          setLines((prev) =>
                            prev.map((l, i) =>
                              i === idx ? { ...l, sourceMaterialId: id } : l
                            )
                          )
                        }}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        {gfcMaterials.length === 0 ? (
                          <option value="">No eligible GFC materials</option>
                        ) : (
                          gfcMaterials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.material_name}
                              {m.sku ? ` (${m.sku})` : ''} —{' '}
                              {formatMaterialStockAvailable(
                                Number(m.current_stock) || 0,
                                'purchase',
                                m
                              )}{' '}
                              avail
                            </option>
                          ))
                        )}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      {(() => {
                        const maxQty = maxPurchaseQty(line.material)
                        const qty = Number(line.quantity) || 0
                        const isOver = maxQty > 0 && qty > maxQty + 1e-9
                        return (
                          <div className="flex flex-col items-end">
                            <input
                              type="number"
                              min={0.0001}
                              max={maxQty > 0 ? maxQty : undefined}
                              step="any"
                              value={line.quantity}
                              onChange={(e) => {
                                const rawQty = Number(e.target.value) || 0
                                const quantity =
                                  maxQty > 0
                                    ? Math.max(0, Math.min(rawQty, maxQty))
                                    : Math.max(0, rawQty)
                                setLines((prev) =>
                                  prev.map((l, i) => (i === idx ? { ...l, quantity } : l))
                                )
                              }}
                              className={`w-24 border rounded px-2 py-1 text-sm text-right ${
                                isOver ? 'border-red-300 bg-red-50' : 'border-gray-300'
                              }`}
                            />
                          </div>
                        )
                      })()}
                      {line.material && (
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {getPurchaseUnitLabel(line.material)}
                        </div>
                      )}
                      {line.material && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Max: {maxPurchaseQty(line.material).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                      {formatMoney(line.unitCost)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(line.lineCost)}
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
                ))}
              </tbody>
              {pricedPreview.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 font-medium">
                    <td colSpan={3} className="px-3 py-2 text-right text-xs uppercase text-gray-600">
                      Total cost
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(totalCost)}
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
              disabled={saving || !lines.length || gfcMaterials.length === 0 || hasInvalidLines}
              onClick={submit}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${btnClass}`}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Post transfer
            </button>
          </div>
          {hasInvalidLines && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Fix invalid quantities before posting. Each line must be greater than 0 and not exceed
              max available.
            </div>
          )}
          </div>
        </section>
      )}

      {!loading && transfers.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { label: 'Transfers', sub: `${stats.posted} posted`, value: String(stats.count) },
            { label: 'Total cost', sub: 'at transfer cost', value: formatGlPhp(stats.totalCost) },
            {
              label: 'Avg per transfer',
              sub: stats.count ? 'mean cost' : '—',
              value: stats.count ? formatGlPhp(stats.totalCost / stats.count) : '—',
            },
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
            ? 'No materials transfers yet.'
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
                <th className="px-4 py-2.5 text-right">Cost</th>
                <th className="px-4 py-2.5 text-left">Status</th>
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
