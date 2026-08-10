'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, type Brand, type FixedAsset, type FixedAssetMovement, type Supplier } from '../../lib/supabase'
import { Edit, History, Package, Search, Trash2 } from 'lucide-react'
import { Modal } from './Modal'

interface FixedAssetsPanelProps {
  selectedBrand: Brand
  suppliers: Supplier[]
  theme?: string
  createdBy?: string
  readOnlyMode?: boolean
  /** Show note that this register is shared with Accounting. */
  showAccountingLink?: boolean
}

const DEFAULT_CATEGORIES = ['Equipment', 'Furniture', 'Vehicles', 'IT', 'Other'] as const

function mergeCategoryOptions(existing: string[]): string[] {
  const merged = new Set<string>([...DEFAULT_CATEGORIES, ...existing.map((c) => c.trim()).filter(Boolean)])
  return Array.from(merged).sort((a, b) => a.localeCompare(b))
}

function parseQtyInput(value: string | number): number {
  const parsed = parseFloat(String(value).trim())
  if (Number.isNaN(parsed)) return 0
  return parsed
}

export function FixedAssetsPanel({
  selectedBrand,
  suppliers,
  theme = 'blue',
  createdBy = 'Procurement',
  readOnlyMode = false,
  showAccountingLink = false,
}: FixedAssetsPanelProps) {
  const canEdit = !readOnlyMode
  const [assets, setAssets] = useState<FixedAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<FixedAsset | null>(null)
  const [showMovementModal, setShowMovementModal] = useState(false)
  const [movementAsset, setMovementAsset] = useState<FixedAsset | null>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyAsset, setHistoryAsset] = useState<FixedAsset | null>(null)
  const [movements, setMovements] = useState<FixedAssetMovement[]>([])

  const accentBtn =
    theme === 'green'
      ? 'bg-green-600 hover:bg-green-700'
      : theme === 'red'
        ? 'bg-red-600 hover:bg-red-700'
        : theme === 'yellow'
          ? 'bg-yellow-600 hover:bg-yellow-700'
          : 'bg-blue-600 hover:bg-blue-700'

  const loadAssets = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('fixed_assets')
        .select('*, supplier:suppliers(id, name)')
        .eq('brand_id', selectedBrand.id)
        .order('asset_name')

      if (error) {
        console.error('fixed_assets:', error)
        setAssets([])
        return
      }
      setAssets((data || []) as FixedAsset[])
    } finally {
      setLoading(false)
    }
  }, [selectedBrand.id])

  const loadMovements = useCallback(async (assetId: string) => {
    const { data, error } = await supabase
      .from('fixed_asset_movements')
      .select('*')
      .eq('fixed_asset_id', assetId)
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('fixed_asset_movements:', error)
      setMovements([])
      return
    }
    setMovements((data || []) as FixedAssetMovement[])
  }, [])

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return assets
    return assets.filter((a) => {
      const haystack = [a.asset_name, a.sku, a.category, a.location, a.supplier?.name, a.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [assets, search])

  const categories = useMemo(
    () => mergeCategoryOptions(assets.map((a) => a.category || '')),
    [assets]
  )

  const handleDelete = async (asset: FixedAsset) => {
    if (
      !confirm(
        `Delete fixed asset "${asset.asset_name}"?\n\nThis removes the catalog entry only. Existing PO lines that reference it will keep their description but lose the link.`
      )
    ) {
      return
    }
    const { error } = await supabase.from('fixed_assets').delete().eq('id', asset.id)
    if (error) {
      alert(`Error deleting asset: ${error.message}`)
      return
    }
    loadAssets()
  }

  const handleSave = async (form: Partial<FixedAsset>) => {
    const payload = {
      brand_id: selectedBrand.id,
      supplier_id: form.supplier_id || null,
      asset_name: form.asset_name?.trim(),
      sku: form.sku?.trim() || null,
      category: form.category?.trim() || null,
      unit: form.unit?.trim() || 'unit',
      unit_cost: Number(form.unit_cost) || 0,
      location: form.location?.trim() || null,
      notes: form.notes?.trim() || null,
      is_active: form.is_active ?? true,
      updated_at: new Date().toISOString(),
    }

    if (!payload.asset_name) {
      alert('Asset name is required.')
      return
    }

    if (editing) {
      const oldQty = Number(editing.quantity) || 0
      const newQty = Number(form.quantity) || 0
      const qtyDelta = newQty - oldQty

      const { error } = await supabase.from('fixed_assets').update(payload).eq('id', editing.id)
      if (error) {
        alert(`Error saving asset: ${error.message}`)
        return
      }

      if (qtyDelta !== 0) {
        const { data: adjMovement, error: movErr } = await supabase
          .from('fixed_asset_movements')
          .insert({
            fixed_asset_id: editing.id,
            movement_type: 'adjustment',
            quantity: qtyDelta,
            notes: 'Quantity updated in asset profile',
            movement_date: new Date().toISOString().split('T')[0],
            created_by: createdBy,
          })
          .select('id')
          .single()
        if (movErr) {
          alert(`Asset saved but movement record failed: ${movErr.message}`)
        } else if (adjMovement?.id) {
          try {
            const { postFixedAssetMovementJournal } = await import(
              '../../lib/accounting-procurement-posting'
            )
            await postFixedAssetMovementJournal(adjMovement.id, selectedBrand.id, createdBy)
          } catch {
            /* logged to accounting_posting_errors */
          }
        }
      }
    } else {
      const { error } = await supabase.from('fixed_assets').insert([
        { ...payload, quantity: 0 },
      ])
      if (error) {
        alert(`Error adding asset: ${error.message}`)
        return
      }
    }

    setShowModal(false)
    setEditing(null)
    loadAssets()
  }

  const recordMovement = async (asset: FixedAsset, movement: Partial<FixedAssetMovement>) => {
    const qty = Number(movement.quantity) || 0
    if (movement.movement_type !== 'adjustment' && qty <= 0) {
      alert('Enter a quantity greater than zero.')
      return
    }
    if (movement.movement_type === 'adjustment' && qty === 0) {
      alert('Adjustment quantity cannot be zero.')
      return
    }
    if (movement.movement_type === 'out' && qty > Number(asset.quantity)) {
      alert(`Cannot remove more than the asset quantity (${asset.quantity} ${asset.unit}).`)
      return
    }

    const { data: newMovement, error } = await supabase
      .from('fixed_asset_movements')
      .insert({
        fixed_asset_id: asset.id,
        movement_type: movement.movement_type,
        quantity: movement.movement_type === 'adjustment' ? qty : Math.abs(qty),
        unit_cost: movement.movement_type === 'in' ? movement.unit_cost ?? asset.unit_cost : null,
        reference_type: movement.reference_type || null,
        reference_number: movement.reference_number || null,
        notes: movement.notes || null,
        movement_date: movement.movement_date || new Date().toISOString().split('T')[0],
        created_by: createdBy,
      })
      .select('id')
      .single()

    if (error) {
      alert(`Error recording movement: ${error.message}`)
      return
    }

    if (newMovement?.id) {
      try {
        const { postFixedAssetMovementJournal } = await import(
          '../../lib/accounting-procurement-posting'
        )
        await postFixedAssetMovementJournal(newMovement.id, selectedBrand.id, createdBy)
      } catch {
        /* logged to accounting_posting_errors */
      }
    }

    setShowMovementModal(false)
    setMovementAsset(null)
    loadAssets()
    if (historyAsset?.id === asset.id) {
      await loadMovements(asset.id)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-4 sm:px-5 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Fixed Assets</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Equipment and other long-term items for {selectedBrand.name}
              </p>
              {showAccountingLink ? (
                <p className="text-xs text-gray-500 mt-1">
                  Shared with Accounting → Fixed Assets. PO receiving capitalizes to GL account 1500.
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Same register used in Procurement → Fixed Assets Inventory and on purchase order lines.
                </p>
              )}
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 mt-3">
                {assets.length} {assets.length === 1 ? 'asset' : 'assets'}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:min-w-[280px]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, SKU, category…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null)
                    setShowModal(true)
                  }}
                  className={`shrink-0 px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm ${accentBtn}`}
                >
                  + Add Asset
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading fixed assets…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p>{search.trim() ? 'No assets match your search.' : 'No fixed assets yet.'}</p>
            <p className="text-xs text-gray-400 mt-1">Add assets here, then select them on purchase orders.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Asset</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Quantity</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Unit cost</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((asset) => (
                  <tr key={asset.id} className="bg-white hover:bg-gray-50/80">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{asset.asset_name}</div>
                      {asset.sku ? (
                        <div className="text-xs text-gray-400 font-mono mt-0.5">{asset.sku}</div>
                      ) : null}
                      {asset.location ? (
                        <div className="text-xs text-gray-500 mt-0.5">{asset.location}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{asset.category || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{asset.supplier?.name || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {asset.quantity} {asset.unit}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      ₱{Number(asset.unit_cost || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => {
                              setMovementAsset(asset)
                              setShowMovementModal(true)
                            }}
                            className="p-1.5 text-blue-600 hover:bg-gray-100 rounded"
                            title="Record asset movement"
                          >
                            <Package className="h-4 w-4" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={async () => {
                            setHistoryAsset(asset)
                            await loadMovements(asset.id)
                            setShowHistoryModal(true)
                          }}
                          className="p-1.5 text-purple-600 hover:bg-gray-100 rounded"
                          title="Asset movement history"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        {canEdit ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(asset)
                                setShowModal(true)
                              }}
                              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(asset)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <FixedAssetModal
          asset={editing}
          suppliers={suppliers}
          categories={categories}
          onClose={() => {
            setShowModal(false)
            setEditing(null)
          }}
          onSave={handleSave}
        />
      )}

      {showMovementModal && movementAsset && (
        <FixedAssetMovementModal
          asset={movementAsset}
          onClose={() => {
            setShowMovementModal(false)
            setMovementAsset(null)
          }}
          onSave={(movement) => recordMovement(movementAsset, movement)}
        />
      )}

      {showHistoryModal && historyAsset && (
        <FixedAssetMovementHistoryModal
          asset={historyAsset}
          movements={movements}
          onClose={() => {
            setShowHistoryModal(false)
            setHistoryAsset(null)
            setMovements([])
          }}
        />
      )}
    </div>
  )
}

function FixedAssetModal({
  asset,
  suppliers,
  categories,
  onSave,
  onClose,
}: {
  asset: FixedAsset | null
  suppliers: Supplier[]
  categories: string[]
  onSave: (form: Partial<FixedAsset>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    supplier_id: asset?.supplier_id || '',
    asset_name: asset?.asset_name || '',
    sku: asset?.sku || '',
    category: asset?.category || '',
    unit: asset?.unit || 'unit',
    unit_cost: asset?.unit_cost ?? ('' as number | string),
    quantity: asset?.quantity ?? ('' as number | string),
    location: asset?.location || '',
    notes: asset?.notes || '',
    is_active: asset?.is_active ?? true,
  })

  const valid =
    form.asset_name.trim() !== '' &&
    form.unit.trim() !== '' &&
    form.unit_cost !== '' &&
    Number(form.unit_cost) >= 0

  return (
    <Modal onClose={onClose} align="center">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-5 border-b">
          <h3 className="text-lg font-semibold">{asset ? 'Edit Fixed Asset' : 'Add Fixed Asset'}</h3>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asset name *</label>
            <input
              type="text"
              value={form.asset_name}
              onChange={(e) => setForm({ ...form, asset_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU / tag</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                list="fixed-asset-categories"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <datalist id="fixed-asset-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
            <select
              value={form.supplier_id}
              onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">— None —</option>
              {suppliers.filter((s) => s.is_active).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="unit"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit cost (₱) *</label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.unit_cost}
                onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset quantity</label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={!asset}
                title={asset ? 'Creates an adjustment record when changed' : 'Starts at 0; use PO deliveries or asset movements'}
              />
            </div>
          </div>
          {!asset ? (
            <p className="text-xs text-gray-500 -mt-2">
              Asset quantity starts at 0. Use purchase order deliveries or record asset movements to add units.
            </p>
          ) : (
            <p className="text-xs text-gray-500 -mt-2">
              Changing quantity here records an adjustment in asset movement history.
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="e.g. Main plant, Office"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Active (available on purchase orders)
          </label>
        </div>
        <div className="p-5 border-t flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() =>
              onSave({
                supplier_id: form.supplier_id || undefined,
                asset_name: form.asset_name,
                sku: form.sku,
                category: form.category,
                unit: form.unit,
                unit_cost: Number(form.unit_cost),
                quantity: Number(form.quantity) || 0,
                location: form.location,
                notes: form.notes,
                is_active: form.is_active,
              })
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}

function FixedAssetMovementModal({
  asset,
  onSave,
  onClose,
}: {
  asset: FixedAsset
  onSave: (movement: Partial<FixedAssetMovement>) => void | Promise<void>
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    movement_type: 'in' as 'in' | 'out' | 'adjustment',
    quantity: '' as string | number,
    unit_cost: (asset.unit_cost > 0 ? asset.unit_cost : '') as string | number,
    reference_number: '',
    notes: '',
    movement_date: new Date().toISOString().split('T')[0],
  })

  const qty = parseQtyInput(form.quantity)
  const signedQty =
    form.movement_type === 'adjustment'
      ? parseFloat(String(form.quantity).trim()) || 0
      : qty
  const projected =
    form.movement_type === 'out'
      ? Number(asset.quantity) - qty
      : form.movement_type === 'adjustment'
        ? Number(asset.quantity) + signedQty
        : Number(asset.quantity) + qty

  const isValid = form.movement_type === 'adjustment' ? signedQty !== 0 : qty > 0

  const handleRecord = async () => {
    if (saving || !isValid) return
    setSaving(true)
    try {
      await onSave({
        movement_type: form.movement_type,
        quantity: form.movement_type === 'adjustment' ? signedQty : qty,
        unit_cost: form.movement_type === 'in' ? Number(form.unit_cost) || 0 : undefined,
        reference_number: form.reference_number || undefined,
        notes: form.notes || undefined,
        movement_date: form.movement_date,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} align="center">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        <div className="p-5 border-b">
          <h3 className="text-lg font-semibold">Record Asset Movement</h3>
          <p className="text-sm text-gray-600 mt-0.5">{asset.asset_name}</p>
          <p className="text-xs text-gray-500 mt-1">
            Current quantity: {asset.quantity} {asset.unit}
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={form.movement_type}
              onChange={(e) =>
                setForm({
                  ...form,
                  movement_type: e.target.value as 'in' | 'out' | 'adjustment',
                  quantity: '',
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="in">Receive asset</option>
              <option value="out">Remove asset</option>
              <option value="adjustment">Quantity adjustment (+/−)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity ({asset.unit}) *
              </label>
              <input
                type="number"
                step="any"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder={form.movement_type === 'adjustment' ? 'e.g. -2 or 3' : '0'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={form.movement_date}
                onChange={(e) => setForm({ ...form, movement_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          {form.movement_type === 'in' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit cost (₱)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.unit_cost}
                onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference #</label>
            <input
              type="text"
              value={form.reference_number}
              onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          {isValid && (
            <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-2">
              Projected asset quantity: {projected.toLocaleString()} {asset.unit}
            </p>
          )}
        </div>
        <div className="p-5 border-t flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!isValid || saving}
            onClick={() => void handleRecord()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Recording…' : 'Record'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function FixedAssetMovementHistoryModal({
  asset,
  movements,
  onClose,
}: {
  asset: FixedAsset
  movements: FixedAssetMovement[]
  onClose: () => void
}) {
  const totalIn = movements.filter((m) => m.movement_type === 'in').reduce((s, m) => s + m.quantity, 0)
  const totalOut = movements.filter((m) => m.movement_type === 'out').reduce((s, m) => s + m.quantity, 0)
  const totalAdj = movements.filter((m) => m.movement_type === 'adjustment').reduce((s, m) => s + m.quantity, 0)

  return (
    <Modal onClose={onClose} align="center">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        <div className="p-5 border-b bg-gray-50">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold">Asset Movement History</h3>
              <p className="text-sm text-gray-600 mt-0.5">{asset.asset_name}</p>
              <p className="text-xs text-gray-500 mt-1">
                Current quantity: {asset.quantity} {asset.unit}
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-2xl leading-none">
              ×
            </button>
          </div>
        </div>

        <div className="p-4 border-b grid grid-cols-3 gap-3 text-center text-sm">
          <div className="bg-green-50 border border-green-100 rounded-lg p-2">
            <p className="text-xs text-gray-600">Received</p>
            <p className="font-bold text-green-700">+{totalIn.toLocaleString()}</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-lg p-2">
            <p className="text-xs text-gray-600">Removed</p>
            <p className="font-bold text-red-700">−{totalOut.toLocaleString()}</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-2">
            <p className="text-xs text-gray-600">Adjustments</p>
            <p className="font-bold text-blue-700">
              {totalAdj >= 0 ? '+' : ''}
              {totalAdj.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {movements.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-8">No asset movements recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {movements.map((m) => (
                <div key={m.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50/80">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded text-white ${
                          m.movement_type === 'in'
                            ? 'bg-green-600'
                            : m.movement_type === 'out'
                              ? 'bg-red-600'
                              : 'bg-blue-600'
                        }`}
                      >
                        {m.movement_type === 'in' ? 'RCV' : m.movement_type === 'out' ? 'REM' : 'ADJ'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(m.movement_date).toLocaleDateString()}
                      </span>
                      {m.reference_number && (
                        <span className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded">
                          {m.reference_number}
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-semibold tabular-nums ${
                        m.movement_type === 'in'
                          ? 'text-green-700'
                          : m.movement_type === 'out'
                            ? 'text-red-700'
                            : 'text-blue-700'
                      }`}
                    >
                      {m.movement_type === 'in' ? '+' : m.movement_type === 'out' ? '−' : m.quantity >= 0 ? '+' : ''}
                      {m.movement_type === 'out' ? m.quantity : m.quantity} {asset.unit}
                    </span>
                  </div>
                  {(m.reference_type || m.created_by || m.notes) && (
                    <p className="text-xs text-gray-600 mt-2">
                      {[m.reference_type, m.created_by && `by ${m.created_by}`, m.notes].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {m.unit_cost != null && m.movement_type === 'in' && (
                    <p className="text-xs text-gray-500 mt-1">
                      ₱{Number(m.unit_cost).toLocaleString()} per {asset.unit}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
