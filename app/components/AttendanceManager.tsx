'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, type GfcAttendanceLog } from '../../lib/supabase'
import {
  ATTENDANCE_PERIOD_LABELS,
  applyBreaksToDailySummaries,
  buildDailySummaries,
  fetchAttendanceBreaksForPeriod,
  getAttendancePeriodLabel,
  getAttendancePeriodRange,
  loadGfcMainStaff,
  parseAttendanceFile,
  relinkUnmatchedPunchesForStaff,
  resolveStaffByName,
  upsertAttendanceBreak,
  upsertAttendancePunches,
  DEFAULT_ATTENDANCE_BREAK_HOURS,
  parseAttendanceHoursLabel,
  type AttendanceDailySummary,
  type AttendancePeriod,
  type GfcMainStaff,
} from '../../lib/gfc-attendance'
import { formatPhilippinesDateTime } from '../../lib/timezone'
import {
  accountingThemeSolidButton,
  dashboardThemePillActive,
  dashboardThemeSelectFocus,
} from '../../lib/accounting-theme'
import { Clock, RefreshCw, Upload } from 'lucide-react'

interface AttendanceManagerProps {
  theme?: string
  currentUsername?: string
}

const PERIOD_OPTIONS: AttendancePeriod[] = ['week', 'biweekly', 'month', 'year']

const SKELETON_CELL_WIDTHS = ['w-20', 'w-28', 'w-16', 'w-16', 'w-14', 'w-14', 'w-10'] as const

function skeletonCellWidth(index: number) {
  return SKELETON_CELL_WIDTHS[index % SKELETON_CELL_WIDTHS.length]
}

function AttendanceTableSkeleton({ rows = 8 }: { rows?: number }) {
  const columnCount = 7

  return (
    <div className="overflow-x-auto animate-pulse">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-600">
          <tr>
            {Array.from({ length: columnCount }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <div className={`h-3 bg-gray-200 rounded ${skeletonCellWidth(i)}`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: columnCount }).map((_, cellIdx) => (
                <td
                  key={cellIdx}
                  className={`px-4 py-3 ${cellIdx === columnCount - 1 ? 'text-right' : ''}`}
                >
                  <div
                    className={`h-4 bg-gray-200 rounded ${skeletonCellWidth(rowIdx + cellIdx)} ${
                      cellIdx === columnCount - 1 ? 'inline-block' : ''
                    }`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AttendanceManager({ theme = 'blue' }: AttendanceManagerProps) {
  const [period, setPeriod] = useState<AttendancePeriod>('week')
  const [staffFilterId, setStaffFilterId] = useState('')
  const [logs, setLogs] = useState<GfcAttendanceLog[]>([])
  const [breakOverrides, setBreakOverrides] = useState<
    Record<string, number>
  >({})
  const [gfcMainStaff, setGfcMainStaff] = useState<GfcMainStaff[]>([])
  const [loading, setLoading] = useState(true)
  const [staffLoading, setStaffLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [showUnmatched, setShowUnmatched] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const periodRange = useMemo(() => getAttendancePeriodRange(period), [period])
  const periodLabel = useMemo(
    () => getAttendancePeriodLabel(period, periodRange),
    [period, periodRange]
  )

  const themeBtn = accountingThemeSolidButton(theme)
  const themePillActive = dashboardThemePillActive(theme)

  const gfcMainStaffIds = useMemo(
    () => new Set(gfcMainStaff.map((s) => s.id)),
    [gfcMainStaff]
  )

  const loadStaff = useCallback(async () => {
    setStaffLoading(true)
    try {
      const staff = await loadGfcMainStaff()
      setGfcMainStaff(staff)
    } catch (e) {
      console.error('loadGfcMainStaff:', e)
    } finally {
      setStaffLoading(false)
    }
  }, [])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('gfc_attendance_logs')
        .select(
          'id, enrollment_no, terminal_no, verify_mode, device_name, work_date, punch_at, staff_registration_id, created_at, staff_registrations(full_name)'
        )
        .gte('work_date', periodRange.start)
        .lte('work_date', periodRange.end)
        .order('work_date', { ascending: false })
        .order('punch_at', { ascending: true })

      if (staffFilterId) {
        query = query.eq('staff_registration_id', staffFilterId)
      }

      const staffIdsForBreaks = staffFilterId ? [staffFilterId] : undefined

      const [logsResult, breaks] = await Promise.all([
        query,
        fetchAttendanceBreaksForPeriod(
          periodRange.start,
          periodRange.end,
          staffIdsForBreaks
        ).catch((err) => {
          console.warn('load attendance breaks:', err)
          return []
        }),
      ])

      const { data, error } = logsResult
      if (error) throw error
      setLogs((data || []) as unknown as GfcAttendanceLog[])

      const breakMap: Record<string, number> = {}
      for (const row of breaks) {
        breakMap[`${row.staff_registration_id}|${row.work_date}`] = row.break_hours
      }
      setBreakOverrides(breakMap)
    } catch (e) {
      console.error('load attendance logs:', e)
      setLogs([])
      setBreakOverrides({})
    } finally {
      setLoading(false)
    }
  }, [periodRange.start, periodRange.end, staffFilterId])

  const handleRefresh = useCallback(async () => {
    setUploadMessage(null)
    try {
      if (staffFilterId) {
        const staffMember =
          gfcMainStaff.find((s) => s.id === staffFilterId) ||
          (await loadGfcMainStaff()).find((s) => s.id === staffFilterId)

        if (staffMember) {
          const { linked, checked } = await relinkUnmatchedPunchesForStaff({
            startDate: periodRange.start,
            endDate: periodRange.end,
            staff: staffMember,
          })

          if (linked > 0) {
            setUploadMessage(
              `Linked ${linked} unmatched punch${linked === 1 ? '' : 'es'} to ${staffMember.full_name}.`
            )
          } else if (checked > 0) {
            setUploadMessage(
              `Checked ${checked} unlinked punch${checked === 1 ? '' : 'es'} in this period — none matched ${staffMember.full_name}.`
            )
          }
        }
      }

      await loadLogs()
    } catch (e) {
      console.error('refresh attendance:', e)
      setUploadMessage(e instanceof Error ? e.message : 'Refresh failed')
      setLoading(false)
    }
  }, [staffFilterId, gfcMainStaff, periodRange.start, periodRange.end, loadLogs])

  useEffect(() => {
    void loadStaff()
  }, [loadStaff])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  const { matched, unmatched } = useMemo(() => {
    const built = buildDailySummaries(
      logs.map((l) => ({
        work_date: l.work_date,
        punch_at: l.punch_at,
        staff_registration_id: l.staff_registration_id ?? null,
        device_name: l.device_name,
        enrollment_no: l.enrollment_no,
        staff_registrations: l.staff_registrations,
      })),
      gfcMainStaffIds
    )

    const breaks = Object.entries(breakOverrides).map(([key, break_hours]) => {
      const [staff_registration_id, work_date] = key.split('|')
      return { staff_registration_id, work_date, break_hours }
    })

    return {
      matched: applyBreaksToDailySummaries(built.matched, breaks),
      unmatched: built.unmatched,
    }
  }, [logs, gfcMainStaffIds, breakOverrides])

  const filteredMatched = useMemo(() => {
    if (!staffFilterId) return matched
    return matched.filter((row) => row.staff_registration_id === staffFilterId)
  }, [matched, staffFilterId])

  const handleUpload = async (file: File) => {
    setUploading(true)
    setUploadMessage(null)
    try {
      const text = await file.text()
      const parsed = parseAttendanceFile(text)
      if (parsed.length === 0) {
        setUploadMessage('No valid attendance rows found in the file.')
        return
      }

      const staff = gfcMainStaff.length > 0 ? gfcMainStaff : await loadGfcMainStaff()
      if (gfcMainStaff.length === 0) setGfcMainStaff(staff)

      const rows = parsed.map((p) => ({
        ...p,
        staff_registration_id: resolveStaffByName(p.device_name, staff),
      }))

      const unmatchedCount = rows.filter((r) => !r.staff_registration_id).length
      const { inserted, duplicates } = await upsertAttendancePunches(rows)

      setUploadMessage(
        `Uploaded ${file.name}: ${parsed.length} parsed, ${inserted} new, ${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped, ${unmatchedCount} unmatched.`
      )
      await loadLogs()
    } catch (e) {
      setUploadMessage(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleBreakSave = useCallback(
    async (row: AttendanceDailySummary, breakHours: number) => {
      if (!row.staff_registration_id) return

      const key = `${row.staff_registration_id}|${row.work_date}`
      const hadExplicitOverride = Object.prototype.hasOwnProperty.call(breakOverrides, key)
      const previous = hadExplicitOverride ? breakOverrides[key] : undefined

      setBreakOverrides((prev) => ({
        ...prev,
        [key]: breakHours,
      }))

      try {
        await upsertAttendanceBreak(row.staff_registration_id, row.work_date, breakHours)
      } catch (e) {
        console.error('save attendance break:', e)
        setBreakOverrides((prev) => {
          const next = { ...prev }
          if (hadExplicitOverride) {
            next[key] = previous as number
          } else {
            delete next[key]
          }
          return next
        })
        setUploadMessage(e instanceof Error ? e.message : 'Failed to save break hours')
      }
    },
    [breakOverrides]
  )

  const formatTime = (iso: string | null) => {
    if (!iso) return '—'
    return formatPhilippinesDateTime(iso, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const formatDate = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number)
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(Date.UTC(y, m - 1, d, 12)))
  }

  const emptyMessage = staffFilterId
    ? 'No attendance records for this staff member in the selected period.'
    : 'No matched attendance records for the selected period.'

  const isLoading = loading || staffLoading

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Attendance
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Upload biometric punches for GFC main staff and enter break hours to deduct from
            working time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.dat,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleUpload(f)
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${themeBtn}`}
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Upload TXT'}
          </button>
        </div>
      </div>

      {uploadMessage && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            uploadMessage.includes('failed') || uploadMessage.includes('No valid')
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-green-200 bg-green-50 text-green-900'
          }`}
        >
          {uploadMessage}
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  period === p
                    ? themePillActive
                    : 'border border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {ATTENDANCE_PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={loading}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${themeBtn}`}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <p className="text-sm text-gray-600">{periodLabel}</p>

        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] flex-1 sm:max-w-xs">
            <label className="block text-xs font-medium text-gray-600 mb-1">Staff</label>
            <select
              value={staffFilterId}
              onChange={(e) => setStaffFilterId(e.target.value)}
              className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white ${dashboardThemeSelectFocus(theme)}`}
            >
              <option value="">All staff</option>
              {gfcMainStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-500">
            {staffLoading ? (
              <span className="inline-block h-3 w-40 bg-gray-200 rounded animate-pulse align-middle" />
            ) : (
              <>
                {gfcMainStaff.length} GFC main staff registered
                {staffFilterId && (
                  <span className="block mt-0.5">
                    Refresh checks unlinked punches in this period and links any that match the selected staff name.
                  </span>
                )}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Daily summary</h3>
          <span className="text-xs text-gray-500">
            {isLoading ? (
              <span className="inline-block h-3 w-16 bg-gray-200 rounded animate-pulse align-middle" />
            ) : (
              <>
                {filteredMatched.length} record{filteredMatched.length === 1 ? '' : 's'}
              </>
            )}
          </span>
        </div>
        {isLoading ? (
          <AttendanceTableSkeleton rows={8} />
        ) : filteredMatched.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">{emptyMessage}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Staff</th>
                  <th className="px-4 py-3">Time In</th>
                  <th className="px-4 py-3">Time Out</th>
                  <th className="px-4 py-3">Break (hrs)</th>
                  <th className="px-4 py-3">Hours</th>
                  <th className="px-4 py-3 text-right">Punches</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMatched.map((row) => (
                  <SummaryRow
                    key={`${row.staff_registration_id}-${row.work_date}`}
                    row={row}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    onBreakSave={handleBreakSave}
                    theme={theme}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!staffFilterId && unmatched.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowUnmatched((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-amber-900 hover:bg-amber-50"
          >
            <span>Unmatched device users ({unmatched.length})</span>
            <span className="text-xs text-amber-700">{showUnmatched ? 'Hide' : 'Show'}</span>
          </button>
          {showUnmatched && (
            <div className="border-t border-amber-200 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-amber-100/50 text-left text-xs font-medium uppercase tracking-wide text-amber-800">
                  <tr>
                    <th className="px-4 py-2">Device name</th>
                    <th className="px-4 py-2">Enrollment #</th>
                    <th className="px-4 py-2 text-right">Punches in period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {unmatched.map((row) => (
                    <tr key={`${row.device_name}-${row.enrollment_no}`}>
                      <td className="px-4 py-2 text-amber-950">{row.device_name}</td>
                      <td className="px-4 py-2 text-amber-900">{row.enrollment_no}</td>
                      <td className="px-4 py-2 text-right text-amber-900">{row.punch_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryRow({
  row,
  formatDate,
  formatTime,
  onBreakSave,
  theme,
}: {
  row: AttendanceDailySummary
  formatDate: (ymd: string) => string
  formatTime: (iso: string | null) => string
  onBreakSave: (row: AttendanceDailySummary, breakHours: number) => Promise<void>
  theme: string
}) {
  const [breakInput, setBreakInput] = useState(String(row.break_hours))
  const [savingBreak, setSavingBreak] = useState(false)
  const canEditBreak = row.gross_hours != null && row.staff_registration_id != null

  useEffect(() => {
    setBreakInput(String(row.break_hours))
  }, [row.break_hours, row.work_date, row.staff_registration_id])

  const commitBreak = async () => {
    if (!canEditBreak) return
    const parsed = breakInput.trim() === '' ? 0 : Number(breakInput)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setBreakInput(String(row.break_hours))
      return
    }

    const maxBreak = row.gross_hours ? parseAttendanceHoursLabel(row.gross_hours) : Infinity
    const normalized = Math.round(Math.min(parsed, maxBreak) * 100) / 100
    if (normalized === row.break_hours) {
      setBreakInput(String(normalized))
      return
    }

    setSavingBreak(true)
    try {
      await onBreakSave(row, normalized)
      setBreakInput(String(normalized))
    } finally {
      setSavingBreak(false)
    }
  }

  const themeFocus = dashboardThemeSelectFocus(theme)

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{formatDate(row.work_date)}</td>
      <td className="px-4 py-3 font-medium text-gray-900">{row.staff_name}</td>
      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatTime(row.time_in)}</td>
      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatTime(row.time_out)}</td>
      <td className="px-4 py-3">
        {canEditBreak ? (
          <input
            type="number"
            min={0}
            step={0.25}
            inputMode="decimal"
            value={breakInput}
            disabled={savingBreak}
            onChange={(e) => setBreakInput(e.target.value)}
            onBlur={() => void commitBreak()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur()
              }
            }}
            placeholder={String(DEFAULT_ATTENDANCE_BREAK_HOURS)}
            className={`w-20 rounded-md border border-gray-300 px-2 py-1 text-sm bg-white disabled:opacity-50 ${themeFocus}`}
            title="Break hours to deduct from working hours"
          />
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-700">
        {row.hours ?? '—'}
        {row.break_hours > 0 && row.gross_hours && (
          <span className="block text-xs text-gray-400">was {row.gross_hours}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-gray-500">{row.punch_count}</td>
    </tr>
  )
}
