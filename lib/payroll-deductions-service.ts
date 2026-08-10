import { supabase } from './supabase'
import { getPhilippinesWeekRange } from './gfc-attendance'
import { getPhilippinesDate } from './timezone'
import { deductionsFromRecord } from './payroll-run-service'
import type { StaffDeductions } from './payroll-calculation'

export type PayrollDeductions = {
  utilities: number
  shortages: number
  cashAdvances: number
  penalties: number
  others: number
}

export type PayrollDeductionsRecord = {
  id: string
  staff_id: string
  utilities?: number
  shortages?: number
  cash_advances?: number
  penalties?: number
  others?: number
  refunds?: number
}

export function emptyPayrollDeductions(): PayrollDeductions {
  return {
    utilities: 0,
    shortages: 0,
    cashAdvances: 0,
    penalties: 0,
    others: 0,
  }
}

export function dsirShortageTotalForWeek(
  byStaffDate: Record<string, Record<string, number>>,
  staffId: string,
  weekStart: string,
  weekEnd: string
): number {
  const byDate = byStaffDate[staffId]
  if (!byDate) return 0

  return Object.entries(byDate).reduce((sum, [date, amount]) => {
    if (date >= weekStart && date <= weekEnd) return sum + amount
    return sum
  }, 0)
}

/** Sum shortages/advances using the same per-week rules as weekly payroll. */
export function aggregatePayrollDeductionsByWeek(params: {
  staffIds: string[]
  weekStarts: string[]
  savedByWeek: Map<string, Map<string, PayrollDeductionsRecord>>
  dsirByStaffDate: Record<string, Record<string, number>>
  openAdvances: Map<string, number>
  todayYmd?: string
  idMapWeekStart?: string | null
}): {
  loadedDeductions: Record<string, PayrollDeductions>
  loadedRefunds: Record<string, number>
  dsirDefaults: Record<string, number>
  advanceDefaults: Record<string, number>
  shortageOverrideFlags: Record<string, boolean>
  idMap: Record<string, string>
} {
  const todayYmd = params.todayYmd || getPhilippinesDate()
  const loadedDeductions: Record<string, PayrollDeductions> = {}
  const loadedRefunds: Record<string, number> = {}
  const dsirDefaults: Record<string, number> = {}
  const advanceDefaults: Record<string, number> = {}
  const shortageOverrideFlags: Record<string, boolean> = {}
  const idMap: Record<string, string> = {}

  for (const staffId of params.staffIds) {
    let totalUtilities = 0
    let totalShortages = 0
    let totalCashAdvances = 0
    let totalPenalties = 0
    let totalOthers = 0
    let totalRefunds = 0
    let dsirDefaultSum = 0
    let hasCurrentWeek = false

    for (const weekStart of params.weekStarts) {
      const { end: weekEnd } = getPhilippinesWeekRange(weekStart)
      const saved = params.savedByWeek.get(weekStart)?.get(staffId)
      const weekDsir = dsirShortageTotalForWeek(
        params.dsirByStaffDate,
        staffId,
        weekStart,
        weekEnd
      )
      const savedShortage = Number(saved?.shortages) || 0

      if (savedShortage > 0 && savedShortage !== weekDsir) {
        shortageOverrideFlags[staffId] = true
      }

      totalShortages += savedShortage > 0 ? savedShortage : weekDsir
      if (weekDsir > 0) dsirDefaultSum += weekDsir

      const isCurrentWeek = todayYmd >= weekStart && todayYmd <= weekEnd
      if (isCurrentWeek) {
        hasCurrentWeek = true
        totalCashAdvances += params.openAdvances.get(staffId) || 0
      } else {
        totalCashAdvances += Number(saved?.cash_advances) || 0
      }

      totalUtilities += Number(saved?.utilities) || 0
      totalPenalties += Number(saved?.penalties) || 0
      totalOthers += Number(saved?.others) || 0
      totalRefunds += Number(saved?.refunds) || 0
    }

    if (dsirDefaultSum > 0) {
      dsirDefaults[staffId] = dsirDefaultSum
    }

    const openBalance = params.openAdvances.get(staffId) || 0
    if (openBalance > 0 && hasCurrentWeek) {
      advanceDefaults[staffId] = openBalance
    }

    loadedDeductions[staffId] = {
      utilities: totalUtilities,
      shortages: totalShortages,
      cashAdvances: totalCashAdvances,
      penalties: totalPenalties,
      others: totalOthers,
    }
    loadedRefunds[staffId] = totalRefunds

    if (params.idMapWeekStart) {
      const id = params.savedByWeek.get(params.idMapWeekStart)?.get(staffId)?.id
      if (id) idMap[staffId] = id
    }
  }

  return {
    loadedDeductions,
    loadedRefunds,
    dsirDefaults,
    advanceDefaults,
    shortageOverrideFlags,
    idMap,
  }
}

export function getDeductionsForStaffFromState(
  deductions: Record<string, PayrollDeductions>,
  staffId: string
): PayrollDeductions {
  return deductions[staffId] || emptyPayrollDeductions()
}

export function resolveLiveDeductions(
  staffId: string,
  deductions: Record<string, PayrollDeductions>,
  dedRecord?: PayrollDeductionsRecord | null
): StaffDeductions {
  const fromState = deductions[staffId]
  if (fromState) {
    return {
      utilities: fromState.utilities || 0,
      shortages: fromState.shortages || 0,
      cashAdvances: fromState.cashAdvances || 0,
      penalties: fromState.penalties || 0,
      others: fromState.others || 0,
    }
  }
  return deductionsFromRecord(dedRecord)
}

export function resolveLiveRefunds(
  staffId: string,
  refunds: Record<string, number>,
  fallback = 0
): number {
  return refunds[staffId] ?? fallback
}

export function buildLivePayrollEntry<
  T extends {
    staffId: string
    totalPay: number
    incentivePay?: number
    deductions: PayrollDeductions
    refunds: number
    netPay: number
  },
>(entry: T, deductions: Record<string, PayrollDeductions>, refunds: Record<string, number>): T {
  const staffDeductions = getDeductionsForStaffFromState(deductions, entry.staffId)
  const staffRefunds = resolveLiveRefunds(entry.staffId, refunds, entry.refunds)
  const totalDeductions = Object.values(staffDeductions).reduce((sum, amount) => sum + amount, 0)
  const incentivePay = Number(entry.incentivePay) || 0
  return {
    ...entry,
    deductions: staffDeductions,
    refunds: staffRefunds,
    netPay: entry.totalPay + incentivePay - totalDeductions + staffRefunds,
  }
}

export function serializeDeductionsState(
  staffIds: string[],
  deductions: Record<string, PayrollDeductions>,
  refunds: Record<string, number>
): string {
  const payload = [...staffIds]
    .sort()
    .map((id) => ({
      id,
      d: deductions[id] || emptyPayrollDeductions(),
      r: refunds[id] || 0,
    }))
  return JSON.stringify(payload)
}

export async function savePayrollDeductionsForWeek(params: {
  startDate: string
  endDate: string
  staffIds: string[]
  deductions: Record<string, PayrollDeductions>
  refunds: Record<string, number>
}): Promise<void> {
  const { startDate, endDate, staffIds, deductions, refunds } = params

  for (const staffId of staffIds) {
    const staffDeductions = deductions[staffId]
    const staffRefunds = refunds[staffId]

    const allValuesZero =
      (!staffDeductions?.utilities || staffDeductions.utilities === 0) &&
      (!staffDeductions?.shortages || staffDeductions.shortages === 0) &&
      (!staffDeductions?.cashAdvances || staffDeductions.cashAdvances === 0) &&
      (!staffDeductions?.penalties || staffDeductions.penalties === 0) &&
      (!staffDeductions?.others || staffDeductions.others === 0) &&
      (!staffRefunds || staffRefunds === 0)

    const { data: existingRecords } = await supabase
      .from('payroll_deductions_refunds')
      .select('id')
      .eq('staff_id', staffId)
      .eq('week_start_date', startDate)
      .eq('week_end_date', endDate)

    const existingRecord = existingRecords && existingRecords.length > 0 ? existingRecords[0] : null

    if (allValuesZero) {
      if (existingRecord) {
        const { error: deleteError } = await supabase
          .from('payroll_deductions_refunds')
          .delete()
          .eq('id', existingRecord.id)
        if (deleteError) throw deleteError
      }
      continue
    }

    const recordData = {
      staff_id: staffId,
      week_start_date: startDate,
      week_end_date: endDate,
      utilities: staffDeductions?.utilities || 0,
      shortages: staffDeductions?.shortages || 0,
      cash_advances: staffDeductions?.cashAdvances || 0,
      penalties: staffDeductions?.penalties || 0,
      others: staffDeductions?.others || 0,
      refunds: staffRefunds || 0,
      updated_at: new Date().toISOString(),
    }

    if (!existingRecord) {
      const { error: insertError } = await supabase
        .from('payroll_deductions_refunds')
        .insert(recordData)
      if (insertError) throw insertError
    } else {
      const { error: updateError } = await supabase
        .from('payroll_deductions_refunds')
        .update(recordData)
        .eq('id', existingRecord.id)
      if (updateError) throw updateError
    }
  }
}
