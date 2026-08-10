import { supabase, type POPurchaserTemplate } from './supabase'

const REMOVED_PURCHASER_TEMPLATE_PAYMENT_TERMS = new Set(['Payment upon order'])

function normalizePurchaserTemplatePaymentTerms(value: string | null | undefined): string {
  const trimmed = value?.trim() || ''
  return REMOVED_PURCHASER_TEMPLATE_PAYMENT_TERMS.has(trimmed) ? '' : trimmed
}

export type PoPaymentMethod = 'cash' | 'check' | 'bank_transfer'

export type PoPaymentFieldConfig = {
  showAccountName: boolean
  showAccountNumber: boolean
  requireAccountName: boolean
  requireAccountNumber: boolean
  accountNameLabel: string
  accountNumberLabel: string
  accountNamePlaceholder: string
  accountNumberPlaceholder: string
}

export function getPoPaymentFieldConfig(method: PoPaymentMethod | string | null | undefined): PoPaymentFieldConfig {
  switch (method) {
    case 'cash':
      return {
        showAccountName: false,
        showAccountNumber: false,
        requireAccountName: false,
        requireAccountNumber: false,
        accountNameLabel: 'Account name',
        accountNumberLabel: 'Account number',
        accountNamePlaceholder: '',
        accountNumberPlaceholder: '',
      }
    case 'check':
      return {
        showAccountName: true,
        showAccountNumber: true,
        requireAccountName: true,
        requireAccountNumber: false,
        accountNameLabel: 'Payee name',
        accountNumberLabel: 'Check number',
        accountNamePlaceholder: 'Name on check',
        accountNumberPlaceholder: 'Optional',
      }
    case 'bank_transfer':
    default:
      return {
        showAccountName: true,
        showAccountNumber: true,
        requireAccountName: true,
        requireAccountNumber: true,
        accountNameLabel: 'Account name',
        accountNumberLabel: 'Account number',
        accountNamePlaceholder: 'Account holder / payee',
        accountNumberPlaceholder: 'Bank account no.',
      }
  }
}

export function arePoPaymentFieldsValid(
  method: PoPaymentMethod | string | null | undefined,
  accountName?: string | null,
  accountNumber?: string | null
): boolean {
  const config = getPoPaymentFieldConfig(method)
  if (config.requireAccountName && !accountName?.trim()) return false
  if (config.requireAccountNumber && !accountNumber?.trim()) return false
  return true
}

export function sanitizePoPaymentFields(
  method: PoPaymentMethod | string | null | undefined,
  accountName?: string | null,
  accountNumber?: string | null
): { payment_account_name: string | null; payment_account_number: string | null } {
  const config = getPoPaymentFieldConfig(method)
  return {
    payment_account_name: config.showAccountName ? accountName?.trim() || null : null,
    payment_account_number: config.showAccountNumber ? accountNumber?.trim() || null : null,
  }
}

export type POPurchaserTemplateFormData = {
  template_name: string
  is_default: boolean
  purchasing_agent: string
  payment_terms: string
  payment_method: PoPaymentMethod
  payment_timing: 'before_delivery' | 'after_delivery' | 'partial'
  payment_account_name: string
  payment_account_number: string
  delivery_address: string
  delivery_contact: string
  delivery_phone: string
  approved_by: string
  approved_by_signatories: string[]
  notes: string
}

export type PoPresetFields = {
  purchasing_agent?: string
  payment_terms?: string
  payment_method?: 'cash' | 'check' | 'bank_transfer'
  payment_timing?: 'before_delivery' | 'after_delivery' | 'partial'
  payment_account_name?: string
  payment_account_number?: string
  delivery_address?: string
  delivery_contact?: string
  delivery_phone?: string
  approved_by?: string
  approved_by_signatories?: string[]
  notes?: string
}

export function normalizeSignatoryList(names: string[]): string[] {
  return Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)))
}

export function getTemplateSignatoryOptions(
  template: POPurchaserTemplate | POPurchaserTemplateFormData
): string[] {
  const fromList = normalizeSignatoryList(template.approved_by_signatories || [])
  const defaultName = template.approved_by?.trim()
  if (defaultName && !fromList.includes(defaultName)) {
    return [defaultName, ...fromList]
  }
  return fromList
}

export function templateToPoPresetFields(
  template: POPurchaserTemplate | POPurchaserTemplateFormData
): PoPresetFields {
  const signatories = getTemplateSignatoryOptions(template)
  return {
    purchasing_agent: template.purchasing_agent || undefined,
    payment_terms: normalizePurchaserTemplatePaymentTerms(template.payment_terms) || undefined,
    payment_method: template.payment_method || undefined,
    payment_timing: template.payment_timing || undefined,
    payment_account_name: template.payment_account_name || undefined,
    payment_account_number: template.payment_account_number || undefined,
    delivery_address: template.delivery_address || undefined,
    delivery_contact: template.delivery_contact || undefined,
    delivery_phone: template.delivery_phone || undefined,
    approved_by: template.approved_by || undefined,
    approved_by_signatories: signatories.length > 0 ? signatories : undefined,
    notes: template.notes || undefined,
  }
}

export function emptyPurchaserTemplateForm(): POPurchaserTemplateFormData {
  return {
    template_name: '',
    is_default: false,
    purchasing_agent: '',
    payment_terms: '',
    payment_method: 'bank_transfer',
    payment_timing: 'after_delivery',
    payment_account_name: '',
    payment_account_number: '',
    delivery_address: '',
    delivery_contact: '',
    delivery_phone: '',
    approved_by: '',
    approved_by_signatories: [],
    notes: '',
  }
}

export function templateToFormData(template: POPurchaserTemplate): POPurchaserTemplateFormData {
  const signatories = normalizeSignatoryList(template.approved_by_signatories || [])
  const approvedBy = template.approved_by?.trim() || ''
  return {
    template_name: template.template_name,
    is_default: template.is_default,
    purchasing_agent: template.purchasing_agent || '',
    payment_terms: normalizePurchaserTemplatePaymentTerms(template.payment_terms),
    payment_method: template.payment_method || 'bank_transfer',
    payment_timing: template.payment_timing || 'after_delivery',
    payment_account_name: template.payment_account_name || '',
    payment_account_number: template.payment_account_number || '',
    delivery_address: template.delivery_address || '',
    delivery_contact: template.delivery_contact || '',
    delivery_phone: template.delivery_phone || '',
    approved_by: approvedBy,
    approved_by_signatories: signatories,
    notes: template.notes || '',
  }
}

export async function loadPurchaserTemplates(brandId: string) {
  const { data, error } = await supabase
    .from('po_purchaser_templates')
    .select('*')
    .eq('brand_id', brandId)
    .order('is_default', { ascending: false })
    .order('template_name', { ascending: true })

  if (error) throw error
  return (data || []) as POPurchaserTemplate[]
}

export async function clearOtherDefaultTemplates(brandId: string, exceptId?: string) {
  let query = supabase
    .from('po_purchaser_templates')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('brand_id', brandId)
    .eq('is_default', true)

  if (exceptId) {
    query = query.neq('id', exceptId)
  }

  const { error } = await query
  if (error) throw error
}

export async function savePurchaserTemplate(
  brandId: string,
  form: POPurchaserTemplateFormData,
  editingId?: string | null
) {
  if (!form.template_name.trim()) {
    throw new Error('Template name is required.')
  }

  const signatories = normalizeSignatoryList(form.approved_by_signatories)
  const approvedBy = form.approved_by.trim() || null

  const payload = {
    brand_id: brandId,
    template_name: form.template_name.trim(),
    is_default: form.is_default,
    purchasing_agent: form.purchasing_agent.trim() || null,
    payment_terms: form.payment_terms.trim() || null,
    payment_method: form.payment_method,
    payment_timing: form.payment_timing,
    ...sanitizePoPaymentFields(form.payment_method, form.payment_account_name, form.payment_account_number),
    delivery_address: form.delivery_address.trim() || null,
    delivery_contact: form.delivery_contact.trim() || null,
    delivery_phone: form.delivery_phone.trim() || null,
    approved_by: approvedBy,
    approved_by_signatories: signatories,
    notes: form.notes.trim() || null,
    updated_at: new Date().toISOString(),
  }

  if (form.is_default) {
    await clearOtherDefaultTemplates(brandId, editingId || undefined)
  }

  if (editingId) {
    const { error } = await supabase.from('po_purchaser_templates').update(payload).eq('id', editingId)
    if (error) throw error
    return editingId
  }

  const { data, error } = await supabase
    .from('po_purchaser_templates')
    .insert([payload])
    .select('id')
    .single()

  if (error) throw error
  return data.id as string
}

export async function deletePurchaserTemplate(id: string) {
  const { error } = await supabase.from('po_purchaser_templates').delete().eq('id', id)
  if (error) throw error
}

export function getDefaultPurchaserTemplate(
  templates: POPurchaserTemplate[]
): POPurchaserTemplate | null {
  return templates.find((t) => t.is_default) || templates[0] || null
}
