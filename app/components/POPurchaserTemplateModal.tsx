'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Star, Trash2, X } from 'lucide-react'
import type { POPurchaserTemplate } from '../../lib/supabase'
import {
  deletePurchaserTemplate,
  emptyPurchaserTemplateForm,
  getTemplateSignatoryOptions,
  loadPurchaserTemplates,
  normalizeSignatoryList,
  savePurchaserTemplate,
  templateToFormData,
  type POPurchaserTemplateFormData,
} from '../../lib/po-purchaser-template'
import { applyPoPaymentMethodChange, PoPaymentAccountFields } from './PoPaymentAccountFields'
import { Modal } from './Modal'

type POPurchaserTemplateModalProps = {
  brandId: string
  brandName: string
  onClose: () => void
  onTemplatesChanged: () => void
}

export function POPurchaserTemplateModal({
  brandId,
  brandName,
  onClose,
  onTemplatesChanged,
}: POPurchaserTemplateModalProps) {
  const [templates, setTemplates] = useState<POPurchaserTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<POPurchaserTemplateFormData>(emptyPurchaserTemplateForm())
  const [newSignatory, setNewSignatory] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setTemplates(await loadPurchaserTemplates(brandId))
    } catch (err) {
      console.error(err)
      alert(`Could not load templates: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const startNew = () => {
    setEditingId(null)
    setNewSignatory('')
    setForm({
      ...emptyPurchaserTemplateForm(),
      is_default: templates.length === 0,
      template_name: templates.length === 0 ? 'Default' : '',
    })
  }

  const startEdit = (template: POPurchaserTemplate) => {
    setEditingId(template.id)
    setNewSignatory('')
    setForm(templateToFormData(template))
  }

  const addSignatory = () => {
    const name = newSignatory.trim()
    if (!name) return
    const signatories = normalizeSignatoryList([...form.approved_by_signatories, name])
    setForm({
      ...form,
      approved_by_signatories: signatories,
      approved_by: form.approved_by || name,
    })
    setNewSignatory('')
  }

  const removeSignatory = (name: string) => {
    const signatories = form.approved_by_signatories.filter((s) => s !== name)
    setForm({
      ...form,
      approved_by_signatories: signatories,
      approved_by: form.approved_by === name ? signatories[0] || '' : form.approved_by,
    })
  }

  const signatoryOptions = getTemplateSignatoryOptions(form)

  const handleSave = async () => {
    setSaving(true)
    try {
      await savePurchaserTemplate(brandId, form, editingId)
      await refresh()
      onTemplatesChanged()
      startNew()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (template: POPurchaserTemplate) => {
    if (!confirm(`Delete template "${template.template_name}"?`)) return
    try {
      await deletePurchaserTemplate(template.id)
      await refresh()
      onTemplatesChanged()
      if (editingId === template.id) startNew()
    } catch (err) {
      alert(`Error deleting template: ${(err as Error).message}`)
    }
  }

  return (
    <Modal onClose={onClose} zIndex={60} align="center">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        <div className="p-5 border-b flex justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold">Purchaser Templates</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Preset purchasing agent, payment, delivery, and approved-by signatories for {brandName}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium text-gray-900">Saved templates</h3>
              <button
                type="button"
                onClick={startNew}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                + New
              </button>
            </div>
            {loading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-gray-500 border border-dashed rounded-lg p-4">
                No templates yet. Create one to auto-fill new purchase orders.
              </p>
            ) : (
              <ul className="space-y-2">
                {templates.map((t) => (
                  <li
                    key={t.id}
                    className={`border rounded-lg p-3 cursor-pointer hover:bg-gray-50 ${
                      editingId === t.id ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200'
                    }`}
                    onClick={() => startEdit(t)}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm">{t.template_name}</span>
                          {t.is_default && (
                            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" aria-label="Default" />
                          )}
                        </div>
                        {(t.purchasing_agent || t.approved_by) && (
                          <p className="text-xs text-gray-600 mt-0.5">
                            {[t.purchasing_agent, t.approved_by ? `Approved: ${t.approved_by}` : '']
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(t)
                        }}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lg:col-span-3 space-y-4 border-t lg:border-t-0 lg:border-l lg:pl-5 pt-4 lg:pt-0">
            <h3 className="text-sm font-medium text-gray-900">
              {editingId ? 'Edit template' : 'New template'}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Template name *</label>
                <input
                  type="text"
                  value={form.template_name}
                  onChange={(e) => setForm({ ...form, template_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g. Main office"
                />
              </div>
              <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                />
                Use as default for new purchase orders
              </label>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Purchasing agent</label>
                <input
                  type="text"
                  value={form.purchasing_agent}
                  onChange={(e) => setForm({ ...form, purchasing_agent: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Payment</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payment terms</label>
                  <select
                    value={form.payment_terms}
                    onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">—</option>
                    <option value="COD">COD (Cash on Delivery)</option>
                    <option value="Payment before delivery">Payment before delivery</option>
                    <option value="Payment after delivery">Payment after delivery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payment method</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) =>
                      setForm(
                        applyPoPaymentMethodChange(form, e.target.value as POPurchaserTemplateFormData['payment_method'])
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
                <PoPaymentAccountFields
                  paymentMethod={form.payment_method}
                  accountName={form.payment_account_name}
                  accountNumber={form.payment_account_number}
                  onAccountNameChange={(value) => setForm({ ...form, payment_account_name: value })}
                  onAccountNumberChange={(value) => setForm({ ...form, payment_account_number: value })}
                  labelClassName="block text-xs font-medium text-gray-700 mb-1"
                  inputClassName="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Approved by (signatory)</h4>
              <p className="text-xs text-gray-500 mb-2">
                Names appear on the PO print signature block. Add approvers, then pick the default for new orders.
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newSignatory}
                  onChange={(e) => setNewSignatory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSignatory()
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Approver name"
                />
                <button
                  type="button"
                  onClick={addSignatory}
                  disabled={!newSignatory.trim()}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
              {form.approved_by_signatories.length > 0 ? (
                <ul className="flex flex-wrap gap-2 mb-3">
                  {form.approved_by_signatories.map((name) => (
                    <li
                      key={name}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 border border-gray-200 rounded-full text-sm"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => removeSignatory(name)}
                        className="p-0.5 text-gray-500 hover:text-red-600 rounded"
                        title="Remove"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500 mb-3 border border-dashed rounded-lg p-2">
                  No signatories yet. Add at least one approver name.
                </p>
              )}
              <label className="block text-xs font-medium text-gray-700 mb-1">Default approved by</label>
              {signatoryOptions.length > 0 ? (
                <select
                  value={form.approved_by}
                  onChange={(e) => setForm({ ...form, approved_by: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">— None —</option>
                  {signatoryOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={form.approved_by}
                  onChange={(e) => setForm({ ...form, approved_by: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Name on PO signature line"
                />
              )}
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Delivery</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Contact person</label>
                  <input
                    type="text"
                    value={form.delivery_contact}
                    onChange={(e) => setForm({ ...form, delivery_contact: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Contact phone</label>
                  <input
                    type="text"
                    value={form.delivery_phone}
                    onChange={(e) => setForm({ ...form, delivery_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Delivery address</label>
                  <textarea
                    value={form.delivery_address}
                    onChange={(e) => setForm({ ...form, delivery_address: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Default PO notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        <div className="p-5 border-t flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">
            Close
          </button>
          <button
            type="button"
            disabled={saving || !form.template_name.trim()}
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {saving ? 'Saving…' : editingId ? 'Update template' : 'Save template'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
