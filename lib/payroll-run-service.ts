import { supabase } from './supabase'
import type { PayrollRun, PayrollRunBrandTotal, PayrollRunLine } from './supabase'
import {
  allocatePayByBrand,
  calculateStaffPayrollCore,
  emptyDeductions,
  type PayrollScheduleRow,
  type StaffDeductions,
} from './payroll-calculation'
import { postPayrollRunAccrual, voidPayrollRunAccruals } from './accounting-payroll-posting'
import { recoverStaffAdvancesFromPayrollRun, rollbackStaffAdvanceRecoveryForPayrollRun } from './staff-advance-service'

function isExcludedFactoryPayrollBrand(brandId: string, factoryBrandId?: string | null) {
  return Boolean(factoryBrandId && brandId === factoryBrandId)
}

export function filterRetailPayrollBrandTotals<T extends { brand_id: string }>(
  brandTotals: T[],
  factoryBrandId?: string | null
): T[] {
  if (!factoryBrandId) return brandTotals
  return brandTotals.filter((row) => !isExcludedFactoryPayrollBrand(row.brand_id, factoryBrandId))
}

export type FinalizePayrollLineInput = {
  staffId: string
  hourlyRate: number
  schedules: PayrollScheduleRow[]
  deductions?: StaffDeductions
  refunds?: number
  incentive?: number
  deductionsRefundId?: string | null
}

export async function loadPayrollRunByWeek(
  weekStartDate: string,
  weekEndDate: string,
  options?: { excludeFactoryBrandId?: string | null }
): Promise<{
  run: PayrollRun | null
  lines: PayrollRunLine[]
  brandTotals: PayrollRunBrandTotal[]
}> {
  const { data: run } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('week_start_date', weekStartDate)
    .eq('week_end_date', weekEndDate)
    .maybeSingle()

  if (!run) {
    return { run: null, lines: [], brandTotals: [] }
  }

  const [{ data: lines }, { data: brandTotals }] = await Promise.all([
    supabase.from('payroll_run_lines').select('*').eq('payroll_run_id', run.id),
    supabase
      .from('payroll_run_brand_totals')
      .select('*, brand:brands(id, name)')
      .eq('payroll_run_id', run.id),
  ])

  return {
    run: run as PayrollRun,
    lines: (lines || []) as PayrollRunLine[],
    brandTotals: filterRetailPayrollBrandTotals(
      (brandTotals || []) as PayrollRunBrandTotal[],
      options?.excludeFactoryBrandId
    ),
  }
}

export async function finalizePayrollRun(params: {
  weekStartDate: string
  weekEndDate: string
  dayStatusMap: Record<string, string>
  lines: FinalizePayrollLineInput[]
  createdBy: string
  /** Factory (GFC) brand id — factory-floor locations post payroll here. */
  factoryBrandId?: string | null
}): Promise<PayrollRun> {
  const existing = await loadPayrollRunByWeek(params.weekStartDate, params.weekEndDate)
  if (existing.run && ['approved', 'accrued', 'paid'].includes(existing.run.status)) {
    throw new Error('Payroll run is already approved or posted. Void it before recalculating.')
  }

  const brandNameMap = new Map<string, string>()
  const brandAgg = new Map<
    string,
    {
      grossPay: number
      totalDeductions: number
      refunds: number
      netPay: number
      withholdingsOther: number
      cashAdvancesWithheld: number
    }
  >()

  const lineRows: Omit<PayrollRunLine, 'id' | 'created_at'>[] = []

  for (const line of params.lines) {
    const calc = calculateStaffPayrollCore({
      hourlyRate: line.hourlyRate,
      schedules: line.schedules,
      dayStatusMap: params.dayStatusMap,
      deductions: line.deductions,
      refunds: line.refunds,
      incentive: line.incentive,
    })

    const brandAlloc = allocatePayByBrand(line.schedules, calc, undefined, params.factoryBrandId)
    brandAlloc.forEach((b) => {
      if (isExcludedFactoryPayrollBrand(b.brandId, params.factoryBrandId)) return
      brandNameMap.set(b.brandId, b.brandName)
      const prev = brandAgg.get(b.brandId) || {
        grossPay: 0,
        totalDeductions: 0,
        refunds: 0,
        netPay: 0,
        withholdingsOther: 0,
        cashAdvancesWithheld: 0,
      }
      brandAgg.set(b.brandId, {
        grossPay: prev.grossPay + b.grossPay,
        totalDeductions: prev.totalDeductions + b.totalDeductions,
        refunds: prev.refunds + b.refunds,
        netPay: prev.netPay + b.netPay,
        withholdingsOther: prev.withholdingsOther + b.withholdingsOther,
        cashAdvancesWithheld: prev.cashAdvancesWithheld + b.cashAdvancesWithheld,
      })
    })

    lineRows.push({
      payroll_run_id: '',
      staff_id: line.staffId,
      hourly_rate_snapshot: line.hourlyRate,
      total_hours: calc.totalHours,
      regular_hours: calc.regularHours,
      overtime_hours: calc.overtimeHours,
      double_pay_hours: calc.doublePayHours,
      special_pay_hours: calc.specialPayHours,
      regular_pay: calc.regularPay,
      overtime_pay: calc.overtimePay,
      double_pay: calc.doublePay,
      special_pay: calc.specialPay,
      incentive_pay: calc.incentivePay,
      gross_pay: calc.grossPay,
      deductions_refund_id: line.deductionsRefundId || null,
      utilities: calc.deductions.utilities,
      shortages: calc.deductions.shortages,
      cash_advances: calc.deductions.cashAdvances,
      penalties: calc.deductions.penalties,
      others: calc.deductions.others,
      refunds: calc.refunds,
      total_deductions: calc.totalDeductions,
      net_pay: calc.netPay,
    })
  }

  let runId = existing.run?.id
  const now = new Date().toISOString()

  if (runId) {
    await supabase
      .from('payroll_runs')
      .update({
        status: 'calculated',
        calculated_at: now,
        created_by: params.createdBy,
        updated_at: now,
      })
      .eq('id', runId)
    await supabase.from('payroll_run_lines').delete().eq('payroll_run_id', runId)
    await supabase.from('payroll_run_brand_totals').delete().eq('payroll_run_id', runId)
  } else {
    const { data: inserted, error } = await supabase
      .from('payroll_runs')
      .insert([
        {
          week_start_date: params.weekStartDate,
          week_end_date: params.weekEndDate,
          status: 'calculated',
          calculated_at: now,
          created_by: params.createdBy,
        },
      ])
      .select()
      .single()
    if (error) throw error
    runId = inserted.id
  }

  if (lineRows.length > 0) {
    const { error: lineErr } = await supabase
      .from('payroll_run_lines')
      .insert(lineRows.map((r) => ({ ...r, payroll_run_id: runId! })))
    if (lineErr) throw lineErr
  }

  const brandRows = Array.from(brandAgg.entries()).map(([brandId, totals]) => ({
    payroll_run_id: runId!,
    brand_id: brandId,
    gross_pay: totals.grossPay,
    total_deductions: totals.totalDeductions,
    refunds: totals.refunds,
    net_pay: totals.netPay,
    withholdings_other: totals.withholdingsOther,
    cash_advances_withheld: totals.cashAdvancesWithheld,
  }))

  if (brandRows.length > 0) {
    const { error: brandErr } = await supabase.from('payroll_run_brand_totals').insert(brandRows)
    if (brandErr) throw brandErr
  }

  const { data: run, error: runErr } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('id', runId!)
    .single()
  if (runErr) throw runErr
  return run as PayrollRun
}

export async function approveAndPostPayrollAccrual(
  payrollRunId: string,
  approvedBy: string,
  factoryBrandId?: string | null
): Promise<{ entryNumbers: string[] }> {
  const { data: run } = await supabase.from('payroll_runs').select('*').eq('id', payrollRunId).single()
  if (!run) throw new Error('Payroll run not found')
  if (run.status === 'void') throw new Error('Payroll run is void')
  if (run.status === 'paid') throw new Error('Payroll run is already paid')

  const { data: brandTotals } = await supabase
    .from('payroll_run_brand_totals')
    .select('id, brand_id')
    .eq('payroll_run_id', payrollRunId)

  const retailBrandTotals = filterRetailPayrollBrandTotals(brandTotals || [], factoryBrandId)
  if (retailBrandTotals.length === 0) throw new Error('No brand totals to post')

  await supabase
    .from('payroll_runs')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: approvedBy })
    .eq('id', payrollRunId)

  const entryNumbers: string[] = []
  for (const bt of retailBrandTotals) {
    const result = await postPayrollRunAccrual(bt.id, approvedBy)
    entryNumbers.push(result.entryNumber)
  }

  const { data: unpaidBrands } = await supabase
    .from('payroll_run_brand_totals')
    .select('id, brand_id, journal_entry_id_accrual')
    .eq('payroll_run_id', payrollRunId)

  const allAccrued = filterRetailPayrollBrandTotals(unpaidBrands || [], factoryBrandId).every(
    (b) => b.journal_entry_id_accrual
  )
  if (allAccrued) {
    await supabase
      .from('payroll_runs')
      .update({ status: 'accrued', accrued_at: new Date().toISOString() })
      .eq('id', payrollRunId)
  }

  await recoverStaffAdvancesFromPayrollRun(payrollRunId)

  return { entryNumbers }
}

export async function voidPayrollRun(payrollRunId: string, postedBy: string): Promise<void> {
  const { data: run } = await supabase.from('payroll_runs').select('*').eq('id', payrollRunId).single()
  if (!run) throw new Error('Payroll run not found')

  const { data: brandTotals } = await supabase
    .from('payroll_run_brand_totals')
    .select('journal_entry_id_payment, payment_voucher_id')
    .eq('payroll_run_id', payrollRunId)

  const hasPayment = (brandTotals || []).some((b) => b.journal_entry_id_payment || b.payment_voucher_id)
  if (hasPayment) {
    throw new Error('Cannot void: payment has been posted. Reverse payment journals first.')
  }

  await voidPayrollRunAccruals(payrollRunId, postedBy)
  await rollbackStaffAdvanceRecoveryForPayrollRun(payrollRunId)

  await supabase
    .from('payroll_runs')
    .update({ status: 'void', updated_at: new Date().toISOString() })
    .eq('id', payrollRunId)
}

export function deductionsFromRecord(record?: {
  utilities?: number
  shortages?: number
  cash_advances?: number
  penalties?: number
  others?: number
} | null): StaffDeductions {
  if (!record) return emptyDeductions()
  return {
    utilities: Number(record.utilities) || 0,
    shortages: Number(record.shortages) || 0,
    cashAdvances: Number(record.cash_advances) || 0,
    penalties: Number(record.penalties) || 0,
    others: Number(record.others) || 0,
  }
}
