import { supabase } from './supabase'
import type { AccountingPeriod } from './supabase'

export function periodFromDate(dateStr: string): { year: number; month: number } {
  const d = new Date(dateStr + 'T12:00:00')
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export async function ensurePeriod(brandId: string, dateStr: string): Promise<AccountingPeriod> {
  const { year, month } = periodFromDate(dateStr)
  const { data: existing } = await supabase
    .from('accounting_periods')
    .select('*')
    .eq('brand_id', brandId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  if (existing) return existing as AccountingPeriod

  const { data: created, error } = await supabase
    .from('accounting_periods')
    .insert([{ brand_id: brandId, year, month, status: 'open' }])
    .select()
    .single()
  if (error) throw error
  return created as AccountingPeriod
}

export async function loadPeriods(brandId: string): Promise<AccountingPeriod[]> {
  const { data, error } = await supabase
    .from('accounting_periods')
    .select('*')
    .eq('brand_id', brandId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  if (error) throw error
  return (data || []) as AccountingPeriod[]
}

export async function isPeriodClosed(brandId: string, dateStr: string): Promise<boolean> {
  const { year, month } = periodFromDate(dateStr)
  const { data } = await supabase
    .from('accounting_periods')
    .select('status')
    .eq('brand_id', brandId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()
  return data?.status === 'closed'
}

export async function closePeriod(periodId: string): Promise<void> {
  const { error } = await supabase
    .from('accounting_periods')
    .update({ status: 'closed' })
    .eq('id', periodId)
  if (error) throw error
}

export async function reopenPeriod(periodId: string): Promise<void> {
  const { error } = await supabase
    .from('accounting_periods')
    .update({ status: 'open' })
    .eq('id', periodId)
  if (error) throw error
}
