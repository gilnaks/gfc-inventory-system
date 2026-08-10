import { supabase } from './supabase'

export type StaffAdvanceDisbursement = {
  id: string
  staff_id: string
  brand_id: string
  voucher_id?: string | null
  amount: number
  amount_recovered: number
  status: 'pending' | 'open' | 'partial' | 'recovered' | 'void'
  disbursed_date: string
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export async function fetchStaffForBrandAdvances(
  brandId: string,
  includeAllCompanyOwned = false
): Promise<Array<{ id: string; full_name: string }>> {
  let locationQuery = supabase.from('locations').select('id').eq('company_owned', true)
  if (!includeAllCompanyOwned) {
    locationQuery = locationQuery.eq('brand_id', brandId)
  }

  const { data: locations, error: locError } = await locationQuery

  if (locError) throw locError

  const locationIds = (locations || []).map((l) => l.id as string)
  if (locationIds.length === 0) return []

  const { data: assignments, error: assignError } = await supabase
    .from('staff_assignments')
    .select('staff_registration_id')
    .in('location_id', locationIds)

  if (assignError) throw assignError

  const staffIds = Array.from(new Set((assignments || []).map((a) => a.staff_registration_id as string)))
  if (staffIds.length === 0) return []

  const { data: staff, error: staffError } = await supabase
    .from('staff_registrations')
    .select('id, full_name')
    .eq('is_active', true)
    .in('id', staffIds)
    .order('full_name')

  if (staffError) throw staffError
  return (staff || []) as Array<{ id: string; full_name: string }>
}

export async function fetchOpenAdvanceBalancesByStaff(
  staffIds: string[]
): Promise<Map<string, number>> {
  const balances = new Map<string, number>()
  if (staffIds.length === 0) return balances

  const { data, error } = await supabase
    .from('staff_advance_disbursements')
    .select('staff_id, amount, amount_recovered, status')
    .in('staff_id', staffIds)
    .in('status', ['open', 'partial'])

  if (error) throw error

  for (const row of data || []) {
    const balance = Math.max(0, Number(row.amount) - Number(row.amount_recovered))
    if (balance <= 0) continue
    const staffId = row.staff_id as string
    balances.set(staffId, (balances.get(staffId) || 0) + balance)
  }

  return balances
}

export async function createStaffAdvanceDisbursement(params: {
  staffId: string
  brandId: string
  amount: number
  disbursedDate: string
  notes?: string
  status?: StaffAdvanceDisbursement['status']
}): Promise<StaffAdvanceDisbursement> {
  const amount = Number(params.amount) || 0
  if (amount <= 0) throw new Error('Advance amount must be greater than zero')

  const { data, error } = await supabase
    .from('staff_advance_disbursements')
    .insert({
      staff_id: params.staffId,
      brand_id: params.brandId,
      amount,
      amount_recovered: 0,
      status: params.status ?? 'pending',
      disbursed_date: params.disbursedDate,
      notes: params.notes || null,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message || 'Could not create staff advance disbursement')
  return data as StaffAdvanceDisbursement
}

export async function linkStaffAdvanceVoucher(
  disbursementId: string,
  voucherId: string
): Promise<void> {
  const { error } = await supabase
    .from('staff_advance_disbursements')
    .update({ voucher_id: voucherId })
    .eq('id', disbursementId)

  if (error) throw error
}

export async function activateStaffAdvanceDisbursement(disbursementId: string): Promise<void> {
  const { error } = await supabase
    .from('staff_advance_disbursements')
    .update({ status: 'open' })
    .eq('id', disbursementId)
    .in('status', ['pending', 'open'])

  if (error) throw new Error(error.message || 'Could not activate staff advance disbursement')
}

export async function voidPendingStaffAdvancesForVoucher(voucherId: string): Promise<void> {
  const { data: links, error: linksError } = await supabase
    .from('accounting_voucher_links')
    .select('source_id')
    .eq('voucher_id', voucherId)
    .eq('source_type', 'staff_advance_disbursement')

  if (linksError) throw linksError

  for (const link of links || []) {
    const { error } = await supabase
      .from('staff_advance_disbursements')
      .update({ status: 'void' })
      .eq('id', link.source_id as string)
      .eq('status', 'pending')

    if (error) throw error
  }
}

export async function voidStaffAdvanceDisbursement(disbursementId: string): Promise<void> {
  const { error } = await supabase
    .from('staff_advance_disbursements')
    .update({ status: 'void' })
    .eq('id', disbursementId)
    .neq('status', 'void')

  if (error) throw error
}

/** Called when a staff advance disbursement journal is reversed — removes it from payroll recovery. */
export async function voidStaffAdvanceDisbursementForReversedJournal(
  journalEntryId: string
): Promise<void> {
  const { data: entry, error: entryError } = await supabase
    .from('accounting_journal_entries')
    .select('source_type, source_id')
    .eq('id', journalEntryId)
    .maybeSingle()

  if (entryError) throw entryError
  if (!entry || entry.source_type !== 'staff_advance_disbursement' || !entry.source_id) return

  await voidStaffAdvanceDisbursement(entry.source_id as string)
}

export async function rollbackStaffAdvanceRecoveryForPayrollRun(payrollRunId: string): Promise<void> {
  const { data: lines, error: linesError } = await supabase
    .from('payroll_run_lines')
    .select('staff_id, cash_advances')
    .eq('payroll_run_id', payrollRunId)

  if (linesError) throw linesError

  for (const line of lines || []) {
    let remaining = Number(line.cash_advances) || 0
    if (remaining <= 0) continue

    const { data: advances, error: advError } = await supabase
      .from('staff_advance_disbursements')
      .select('id, amount, amount_recovered, status')
      .eq('staff_id', line.staff_id)
      .gt('amount_recovered', 0)
      .order('disbursed_date', { ascending: false })

    if (advError) throw advError

    for (const advance of advances || []) {
      if (remaining <= 0) break

      const recovered = Number(advance.amount_recovered) || 0
      if (recovered <= 0) continue

      const rollback = Math.min(remaining, recovered)
      const newRecovered = recovered - rollback
      const amount = Number(advance.amount) || 0
      const status =
        newRecovered <= 0
          ? 'open'
          : newRecovered >= amount
            ? 'recovered'
            : 'partial'

      const { error: updateError } = await supabase
        .from('staff_advance_disbursements')
        .update({
          amount_recovered: newRecovered,
          status: advance.status === 'void' ? 'void' : status,
        })
        .eq('id', advance.id)

      if (updateError) throw updateError
      remaining -= rollback
    }
  }
}

export async function attachStaffAdvanceDisbursementToVoucher(params: {
  voucherId: string
  staffId: string
  brandId: string
  amount: number
  disbursedDate: string
  notes?: string
}): Promise<StaffAdvanceDisbursement> {
  const disbursement = await createStaffAdvanceDisbursement({
    staffId: params.staffId,
    brandId: params.brandId,
    amount: params.amount,
    disbursedDate: params.disbursedDate,
    notes: params.notes,
    status: 'pending',
  })

  try {
    const { error: linkErr } = await supabase.from('accounting_voucher_links').insert([
      {
        voucher_id: params.voucherId,
        source_type: 'staff_advance_disbursement',
        source_id: disbursement.id,
        link_role: 'primary',
      },
    ])
    if (linkErr) throw linkErr

    await linkStaffAdvanceVoucher(disbursement.id, params.voucherId)
    return disbursement
  } catch (error) {
    await voidStaffAdvanceDisbursement(disbursement.id)
    throw error
  }
}

export async function recoverStaffAdvancesFromPayrollRun(payrollRunId: string): Promise<void> {
  const { data: lines, error: linesError } = await supabase
    .from('payroll_run_lines')
    .select('staff_id, cash_advances')
    .eq('payroll_run_id', payrollRunId)

  if (linesError) throw linesError

  for (const line of lines || []) {
    let remaining = Number(line.cash_advances) || 0
    if (remaining <= 0) continue

    const { data: openAdvances, error: advError } = await supabase
      .from('staff_advance_disbursements')
      .select('id, amount, amount_recovered')
      .eq('staff_id', line.staff_id)
      .in('status', ['open', 'partial'])
      .order('disbursed_date', { ascending: true })

    if (advError) throw advError

    for (const advance of openAdvances || []) {
      if (remaining <= 0) break

      const balance = Math.max(0, Number(advance.amount) - Number(advance.amount_recovered))
      if (balance <= 0) continue

      const applied = Math.min(remaining, balance)
      const newRecovered = Number(advance.amount_recovered) + applied
      const fullyRecovered = newRecovered >= Number(advance.amount)

      const { error: updateError } = await supabase
        .from('staff_advance_disbursements')
        .update({
          amount_recovered: newRecovered,
          status: fullyRecovered ? 'recovered' : 'partial',
        })
        .eq('id', advance.id)

      if (updateError) throw updateError
      remaining -= applied
    }
  }
}
