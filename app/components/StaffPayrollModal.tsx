'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, DollarSign } from 'lucide-react'
import { Modal } from './Modal'
import { shiftPhilippinesWeek } from '../../lib/gfc-attendance'
import {
  canGoToNewerStaffPayrollWeek,
  canGoToOlderStaffPayrollWeek,
  getStaffPayrollWeekStart,
  loadStaffWeekPayroll,
  type StaffWeekPayrollView,
} from '../../lib/staff-payroll-view-service'

type StaffPayrollModalProps = {
  open: boolean
  onClose: () => void
  staffId: string
  staffName: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount)
}

function dayTypeLabel(dayType: string) {
  switch (dayType) {
    case 'regular-holiday':
      return 'Regular holiday (2×)'
    case 'special-holiday':
      return 'Special holiday (1.3×)'
    default:
      return null
  }
}

export function StaffPayrollModal({ open, onClose, staffId, staffName }: StaffPayrollModalProps) {
  const [weekStart, setWeekStart] = useState(() => getStaffPayrollWeekStart())
  const [payroll, setPayroll] = useState<StaffWeekPayrollView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadWeek = useCallback(async (startYmd: string) => {
    setLoading(true)
    setError('')
    try {
      const data = await loadStaffWeekPayroll(staffId, startYmd)
      setPayroll(data)
    } catch (err) {
      console.error('Error loading staff payroll:', err)
      setPayroll(null)
      setError(err instanceof Error ? err.message : 'Failed to load payroll')
    } finally {
      setLoading(false)
    }
  }, [staffId])

  useEffect(() => {
    if (!open) return
    setWeekStart(getStaffPayrollWeekStart())
  }, [open, staffId])

  useEffect(() => {
    if (!open) return
    void loadWeek(weekStart)
  }, [weekStart, open, loadWeek])

  const goToPreviousWeek = () => {
    if (!canGoToOlderStaffPayrollWeek(weekStart)) return
    setWeekStart(shiftPhilippinesWeek(weekStart, -1))
  }

  const goToNextWeek = () => {
    if (!canGoToNewerStaffPayrollWeek(weekStart)) return
    setWeekStart(shiftPhilippinesWeek(weekStart, 1))
  }

  if (!open) return null

  const calc = payroll?.calc
  const totalDeductions = calc
    ? Object.values(calc.deductions).reduce((sum, value) => sum + value, 0)
    : 0

  return (
    <Modal onClose={onClose} align="center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2 min-w-0">
            <DollarSign className="h-5 w-5 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">My Payroll</h3>
              <p className="text-xs text-gray-500 truncate">{staffName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-800 px-2 py-1"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goToPreviousWeek}
              disabled={!canGoToOlderStaffPayrollWeek(weekStart) || loading}
              className="p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"
              title="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {payroll?.weekLabel || 'Loading week...'}
              </p>
              {payroll?.isCurrentWeek && (
                <span className="inline-block mt-1 text-[10px] font-medium uppercase tracking-wide text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
                  Current week
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={goToNextWeek}
              disabled={!canGoToNewerStaffPayrollWeek(weekStart) || loading}
              className="p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"
              title="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {loading && (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
              <p className="text-sm text-gray-600">Loading payroll...</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && payroll && calc && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-gray-200 p-3 bg-white">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Total hours</p>
                  <p className="text-lg font-semibold text-gray-900 tabular-nums">
                    {calc.totalHours.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3 bg-white">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Gross pay</p>
                  <p className="text-lg font-semibold text-gray-900 tabular-nums">
                    {formatCurrency(calc.grossPay)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3 bg-white">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Deductions</p>
                  <p className="text-lg font-semibold text-red-600 tabular-nums">
                    {formatCurrency(totalDeductions)}
                  </p>
                </div>
                <div className="rounded-lg border border-blue-200 p-3 bg-blue-50">
                  <p className="text-[10px] uppercase tracking-wide text-blue-700">Net pay</p>
                  <p className="text-lg font-semibold text-blue-900 tabular-nums">
                    {formatCurrency(calc.netPay)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900">Hours breakdown</h4>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3 text-sm">
                    <div>
                      <span className="text-gray-500">Regular</span>
                      <p className="font-medium tabular-nums">{calc.regularHours.toFixed(1)}h</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Overtime</span>
                      <p className="font-medium tabular-nums">{calc.overtimeHours.toFixed(1)}h</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Double pay</span>
                      <p className="font-medium tabular-nums">{calc.doublePayHours.toFixed(1)}h</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Special pay</span>
                      <p className="font-medium tabular-nums">{calc.specialPayHours.toFixed(1)}h</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900">Pay breakdown</h4>
                  <p className="text-xs text-gray-500">₱{payroll.hourlyRate.toFixed(2)}/hr</p>
                </div>
                <div className="divide-y divide-gray-100 text-sm">
                  {[
                    { label: 'Regular pay', amount: calc.regularPay },
                    { label: 'Overtime pay (1.25×)', amount: calc.overtimePay },
                    { label: 'Double pay (2×)', amount: calc.doublePay },
                    { label: 'Special pay (1.3×)', amount: calc.specialPay },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between px-4 py-2">
                      <span className="text-gray-600">{row.label}</span>
                      <span className="font-medium tabular-nums">{formatCurrency(row.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-2 bg-gray-50 font-semibold">
                    <span>Gross pay</span>
                    <span className="tabular-nums">{formatCurrency(calc.grossPay)}</span>
                  </div>
                </div>
              </div>

              {(totalDeductions > 0 || calc.refunds > 0) && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900">Deductions & refunds</h4>
                  </div>
                  <div className="divide-y divide-gray-100 text-sm">
                    {[
                      { label: 'Utilities', amount: calc.deductions.utilities },
                      { label: 'Shortages', amount: calc.deductions.shortages },
                      { label: 'Cash advances', amount: calc.deductions.cashAdvances },
                      { label: 'Penalties', amount: calc.deductions.penalties },
                      { label: 'Others', amount: calc.deductions.others },
                    ]
                      .filter((row) => row.amount > 0)
                      .map((row) => (
                        <div key={row.label} className="flex justify-between px-4 py-2">
                          <span className="text-gray-600">{row.label}</span>
                          <span className="font-medium text-red-600 tabular-nums">
                            -{formatCurrency(row.amount)}
                          </span>
                        </div>
                      ))}
                    {calc.refunds > 0 && (
                      <div className="flex justify-between px-4 py-2">
                        <span className="text-gray-600">Refunds</span>
                        <span className="font-medium text-green-600 tabular-nums">
                          +{formatCurrency(calc.refunds)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900">Days worked</h4>
                </div>
                {payroll.days.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-gray-500 text-center">No schedule or hours this week.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {Object.entries(payroll.locationGroups).map(([locationName, days]) => (
                      <div key={locationName} className="px-4 py-3">
                        <p className="text-xs font-semibold text-gray-800 mb-2">
                          {locationName}
                          <span className="font-normal text-gray-500 ml-1">
                            ({days[0]?.brandName})
                          </span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {days.map((day) => {
                            const scheduleDay = payroll.days.find((d) => d.scheduleDate === day.scheduleDate)
                            const holiday = scheduleDay ? dayTypeLabel(scheduleDay.dayType) : null
                            return (
                              <div
                                key={day.scheduleDate}
                                className={`text-xs rounded px-2 py-1 border ${
                                  day.isAbsent
                                    ? 'bg-orange-50 border-orange-200 text-orange-800'
                                    : 'bg-gray-50 border-gray-200 text-gray-700'
                                }`}
                              >
                                <span className="font-medium">{day.dayName} {day.dateLabel}</span>
                                <span className="ml-1 tabular-nums">
                                  {day.isAbsent ? 'Absent' : `${day.hours.toFixed(1)}h`}
                                </span>
                                {holiday && (
                                  <span className="block text-[10px] text-violet-700">{holiday}</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {payroll.isCurrentWeek && (
                <p className="text-xs text-gray-500 text-center">
                  Current-week amounts may update as schedules, attendance, and deductions change before payroll is finalized.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
