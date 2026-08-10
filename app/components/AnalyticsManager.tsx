'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  Factory,
  IceCream2,
  LineChart as LineChartIcon,
  Package,
  PieChart as PieChartIcon,
  Receipt,
  RefreshCw,
  ShoppingCart,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ANALYTICS_PRESETS,
  getPresetRange,
  loadAnalytics,
  type AnalyticsData,
  type AnalyticsPreset,
  type AnalyticsRange,
  type KpiValue,
} from '../../lib/analytics-service'
import { getBrandChartPalette } from '../../lib/brand-colors'
import { getRetailBrands } from '../../lib/brand-roles'
import { useBrands } from '../contexts/BrandsContext'

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const FALLBACK_CHART_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2']

function peso(value: number, decimals = 0): string {
  return `₱${value.toLocaleString('en-PH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

function pesoCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `₱${(value / 1_000).toFixed(0)}k`
  return `₱${value.toFixed(0)}`
}

function fmtInt(value: number): string {
  return Math.round(value).toLocaleString()
}

function rangeLabel(range: AnalyticsRange): string {
  const fmt = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number)
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
      new Date(Date.UTC(y, m - 1, d))
    )
  }
  return `${fmt(range.start)} – ${fmt(range.end)}`
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function DeltaChip({ kpi, invert = false }: { kpi: KpiValue; invert?: boolean }) {
  if (kpi.previous === 0) {
    return <span className="text-[11px] font-medium text-gray-400">vs prev —</span>
  }
  const pct = ((kpi.current - kpi.previous) / Math.abs(kpi.previous)) * 100
  const improved = invert ? pct < 0 : pct > 0
  const flat = Math.abs(pct) < 0.05
  const Icon = pct >= 0 ? ArrowUpRight : ArrowDownRight
  const colorClass = flat
    ? 'bg-gray-100 text-gray-600'
    : improved
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-red-50 text-red-600'

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${colorClass}`}
      title="Compared with the previous period of the same length"
    >
      <Icon className="h-3 w-3" aria-hidden />
      {Math.abs(pct) >= 100 ? Math.abs(pct).toFixed(0) : Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function KpiCard({
  label,
  kpi,
  icon: Icon,
  iconClass,
  format,
  invertDelta = false,
}: {
  label: string
  kpi: KpiValue
  icon: LucideIcon
  iconClass: string
  format: (value: number) => string
  invertDelta?: boolean
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-1 truncate text-2xl font-bold text-gray-900" title={format(kpi.current)}>
        {format(kpi.current)}
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        <DeltaChip kpi={kpi} invert={invertDelta} />
        <span className="text-[11px] text-gray-400">vs previous period</span>
      </div>
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  right,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  icon?: LucideIcon
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {Icon ? (
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
          ) : null}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p> : null}
          </div>
        </div>
        {right}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, note }: { icon: LucideIcon; title: string; note: string }) {
  return (
    <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-6 py-8 text-center">
      <Icon className="mb-2 h-8 w-8 text-gray-300" aria-hidden />
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-gray-400">{note}</p>
    </div>
  )
}

function RankBadge({ rank }: { rank: number }) {
  const style =
    rank === 1
      ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
      : rank === 2
        ? 'bg-gray-200 text-gray-700 ring-1 ring-gray-300'
        : rank === 3
          ? 'bg-orange-100 text-orange-800 ring-1 ring-orange-200'
          : 'bg-gray-100 text-gray-500'
  return (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${style}`}>
      {rank}
    </span>
  )
}

function BarListRow({
  label,
  sub,
  value,
  ratio,
  barClass,
}: {
  label: string
  sub?: string
  value: string
  ratio: number
  barClass: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-gray-800" title={label}>
          {label}
          {sub ? <span className="ml-1.5 text-xs font-normal text-gray-400">{sub}</span> : null}
        </p>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">{value}</p>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${Math.max(2, Math.min(100, ratio * 100))}%` }}
        />
      </div>
    </div>
  )
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <SkeletonBlock className="h-80 lg:col-span-2" />
        <SkeletonBlock className="h-80" />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <SkeletonBlock className="h-72" />
        <SkeletonBlock className="h-72" />
        <SkeletonBlock className="h-72" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <SkeletonBlock className="h-72" />
        <SkeletonBlock className="h-72" />
      </div>
    </div>
  )
}

const currencyTooltipFormatter = (value: number | string) => peso(Number(value), 2)

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AnalyticsManager() {
  const { brands } = useBrands()
  const retailBrands = useMemo(() => getRetailBrands(brands), [brands])

  const [preset, setPreset] = useState<AnalyticsPreset>('30d')
  const [customRange, setCustomRange] = useState<AnalyticsRange>(() => getPresetRange(30))
  const [franchiseBrandId, setFranchiseBrandId] = useState<string>('')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const range = useMemo<AnalyticsRange>(() => {
    if (preset === 'custom') return customRange
    const presetDef = ANALYTICS_PRESETS.find((p) => p.key === preset)
    return getPresetRange(presetDef?.days ?? 30)
  }, [preset, customRange])

  useEffect(() => {
    if (range.start > range.end) return
    let cancelled = false
    setLoading(true)
    setError(null)
    loadAnalytics(range, { franchiseBrandId: franchiseBrandId || null })
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load analytics')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [range.start, range.end, franchiseBrandId, reloadKey])

  const retry = useCallback(() => setReloadKey((key) => key + 1), [])

  const revenueMixTotal = (data?.revenueByBrand || []).reduce((total, slice) => total + slice.total, 0)

  const locationsByFranchise = useMemo(() => {
    if (!data?.locationRankings.length) return []
    const groups: Array<{
      brandId: string
      brandName: string
      brandSlug: string | null
      locations: typeof data.locationRankings
      totalOrderRevenue: number
      maxSales: number
    }> = []
    const indexByBrand = new Map<string, number>()
    data.locationRankings.forEach((location) => {
      const brandKey = location.brandId || location.brandName
      let index = indexByBrand.get(brandKey)
      if (index === undefined) {
        index = groups.length
        indexByBrand.set(brandKey, index)
        groups.push({
          brandId: brandKey,
          brandName: location.brandName,
          brandSlug: location.brandSlug,
          locations: [],
          totalOrderRevenue: 0,
          maxSales: 0,
        })
      }
      groups[index].locations.push(location)
      groups[index].totalOrderRevenue += location.orderRevenue
      groups[index].maxSales = Math.max(groups[index].maxSales, location.orderRevenue)
    })
    return groups
  }, [data?.locationRankings])

  const companyOwnedByBrand = useMemo(() => {
    if (!data?.companyOwnedDsirRankings.length) return []
    const groups: Array<{
      brandId: string
      brandName: string
      brandSlug: string | null
      locations: typeof data.companyOwnedDsirRankings
      totalNetSales: number
      maxSales: number
    }> = []
    const indexByBrand = new Map<string, number>()
    data.companyOwnedDsirRankings.forEach((location) => {
      const brandKey = location.brandId || location.brandName
      let index = indexByBrand.get(brandKey)
      if (index === undefined) {
        index = groups.length
        indexByBrand.set(brandKey, index)
        groups.push({
          brandId: brandKey,
          brandName: location.brandName,
          brandSlug: location.brandSlug,
          locations: [],
          totalNetSales: 0,
          maxSales: 0,
        })
      }
      groups[index].locations.push(location)
      groups[index].totalNetSales += location.netSales
      groups[index].maxSales = Math.max(groups[index].maxSales, location.netSales)
    })
    // Prefer MyChoice then Gelato order when both exist.
    return groups.sort((a, b) => {
      const rank = (slug: string | null, name: string) => {
        const key = `${slug || ''} ${name}`.toLowerCase()
        if (key.includes('mychoice')) return 0
        if (key.includes('gelato')) return 1
        if (key.includes('sorbetes')) return 2
        return 3
      }
      const diff = rank(a.brandSlug, a.brandName) - rank(b.brandSlug, b.brandName)
      if (diff !== 0) return diff
      return b.totalNetSales - a.totalNetSales
    })
  }, [data?.companyOwnedDsirRankings])

  const staffByStore = useMemo(() => {
    if (!data?.staffRankings.length) return []
    const groups: Array<{
      locationId: string
      locationName: string
      brandName: string
      staff: typeof data.staffRankings
      maxSales: number
    }> = []
    const indexByLocation = new Map<string, number>()
    data.staffRankings.forEach((staff) => {
      let index = indexByLocation.get(staff.locationId)
      if (index === undefined) {
        index = groups.length
        indexByLocation.set(staff.locationId, index)
        groups.push({
          locationId: staff.locationId,
          locationName: staff.locationName,
          brandName: staff.brandName,
          staff: [],
          maxSales: 0,
        })
      }
      groups[index].staff.push(staff)
      groups[index].maxSales = Math.max(groups[index].maxSales, staff.sales)
    })
    return groups
  }, [data?.staffRankings])

  const selectedFranchise = useMemo(
    () => retailBrands.find((brand) => brand.id === franchiseBrandId) || null,
    [retailBrands, franchiseBrandId]
  )
  const selectedPalette = useMemo(
    () => (selectedFranchise ? getBrandChartPalette(selectedFranchise) : null),
    [selectedFranchise]
  )

  const brandColorFor = useCallback(
    (brand: { slug?: string | null; name?: string | null } | string, index = 0) => {
      const palette = getBrandChartPalette(brand)
      if (palette.primary !== '#2563eb') return palette.primary
      return FALLBACK_CHART_COLORS[index % FALLBACK_CHART_COLORS.length]
    },
    []
  )

  /** Readable label color from a brand palette (avoid pale yellow text on white). */
  const brandLabelColor = useCallback((brand: { slug?: string | null; name?: string | null } | string) => {
    const palette = getBrandChartPalette(brand)
    if (palette.secondary === '#eab308') return palette.primary
    if (palette.secondary === '#171717') return palette.primary
    return palette.secondary
  }, [])

  const franchiseFilterClass = selectedPalette
    ? 'rounded-lg border bg-white px-2.5 py-2 text-xs font-medium shadow-sm focus:outline-none'
    : 'rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-gray-700 shadow-sm focus:border-blue-400 focus:outline-none'

  const trendPrimary = selectedPalette?.primary || '#2563eb'
  const trendSecondary = selectedPalette?.secondary || '#7c3aed'

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header + filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 sm:text-xl">
            <Activity
              className="h-5 w-5"
              style={{ color: selectedPalette?.primary || '#2563eb' }}
              aria-hidden
            />
            Business Analytics
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Overall health of GFC and its franchises · {rangeLabel(range)}
            {selectedFranchise ? (
              <span className="ml-1 font-medium" style={{ color: selectedPalette?.primary }}>
                · {selectedFranchise.name}
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
            {ANALYTICS_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPreset(p.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  preset === p.key
                    ? 'text-white shadow'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                style={
                  preset === p.key
                    ? { backgroundColor: selectedPalette?.primary || '#2563eb' }
                    : undefined
                }
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setCustomRange(range)
                setPreset('custom')
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                preset === 'custom'
                  ? 'text-white shadow'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              style={
                preset === 'custom'
                  ? { backgroundColor: selectedPalette?.primary || '#2563eb' }
                  : undefined
              }
            >
              Custom
            </button>
          </div>

          {preset === 'custom' ? (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1 shadow-sm">
              <input
                type="date"
                value={customRange.start}
                max={customRange.end}
                onChange={(e) => setCustomRange((r) => ({ ...r, start: e.target.value }))}
                className="rounded border-0 p-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={customRange.end}
                min={customRange.start}
                onChange={(e) => setCustomRange((r) => ({ ...r, end: e.target.value }))}
                className="rounded border-0 p-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          ) : null}

          <select
            value={franchiseBrandId}
            onChange={(e) => setFranchiseBrandId(e.target.value)}
            className={franchiseFilterClass}
            style={
              selectedPalette && selectedFranchise
                ? {
                    borderColor: selectedPalette.primary,
                    color: brandLabelColor(selectedFranchise),
                    backgroundColor: selectedPalette.soft,
                  }
                : undefined
            }
            aria-label="Filter by franchise"
          >
            <option value="">All franchises</option>
            {retailBrands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={retry}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
          <AlertTriangle className="h-8 w-8 text-red-400" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-red-800">Failed to load analytics</p>
            <p className="mt-0.5 text-xs text-red-600">{error}</p>
          </div>
          <button
            type="button"
            onClick={retry}
            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      ) : loading || !data ? (
        <AnalyticsSkeleton />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Net Sales (DSIR)"
              kpi={data.kpis.netSales}
              icon={Banknote}
              iconClass="bg-blue-50 text-blue-600"
              format={(v) => peso(v)}
            />
            <KpiCard
              label="Gross Sales"
              kpi={data.kpis.grossSales}
              icon={BarChart3}
              iconClass="bg-indigo-50 text-indigo-600"
              format={(v) => peso(v)}
            />
            <KpiCard
              label="Order Revenue"
              kpi={data.kpis.orderRevenue}
              icon={ShoppingCart}
              iconClass="bg-violet-50 text-violet-600"
              format={(v) => peso(v)}
            />
            <KpiCard
              label="Orders"
              kpi={data.kpis.ordersCount}
              icon={Receipt}
              iconClass="bg-fuchsia-50 text-fuchsia-600"
              format={fmtInt}
            />
            <KpiCard
              label="Cash Collected"
              kpi={data.kpis.cashCollected}
              icon={Wallet}
              iconClass="bg-emerald-50 text-emerald-600"
              format={(v) => peso(v)}
            />
            <KpiCard
              label="Net Payroll"
              kpi={data.kpis.netPayroll}
              icon={Users}
              iconClass="bg-rose-50 text-rose-600"
              format={(v) => peso(v)}
              invertDelta
            />
            <KpiCard
              label="Active Franchises"
              kpi={data.kpis.activeFranchises}
              icon={Building2}
              iconClass="bg-cyan-50 text-cyan-600"
              format={fmtInt}
            />
            <KpiCard
              label="Production Units"
              kpi={data.kpis.productionUnits}
              icon={Factory}
              iconClass="bg-orange-50 text-orange-600"
              format={fmtInt}
            />
          </div>

          {/* Sales trend + revenue mix */}
          <div className="grid gap-3 lg:grid-cols-3">
            <ChartCard
              title="Sales Trend"
              subtitle="Daily store net sales (DSIR) and wholesale order revenue"
              icon={LineChartIcon}
              className="lg:col-span-2"
            >
              <ResponsiveContainer width="100%" height={290}>
                <AreaChart data={data.salesTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="analyticsNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={trendPrimary} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={trendPrimary} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="analyticsOrders" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={trendSecondary} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={trendSecondary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={pesoCompact}
                    width={52}
                  />
                  <Tooltip formatter={currencyTooltipFormatter} labelStyle={{ color: '#111827', fontWeight: 600 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="netSales"
                    name="Store Net Sales"
                    stroke={trendPrimary}
                    strokeWidth={2}
                    fill="url(#analyticsNet)"
                  />
                  <Area
                    type="monotone"
                    dataKey="orderRevenue"
                    name="Order Revenue"
                    stroke={trendSecondary}
                    strokeWidth={2}
                    fill="url(#analyticsOrders)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Revenue Mix"
              subtitle="Store net sales + order revenue by franchise"
              icon={PieChartIcon}
            >
              {data.revenueByBrand.length === 0 ? (
                <EmptyState
                  icon={PieChartIcon}
                  title="No revenue recorded"
                  note="Submitted DSIR reports and paid orders in this period will appear here."
                />
              ) : (
                <div className="flex h-full flex-col">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={data.revenueByBrand}
                        dataKey="total"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {data.revenueByBrand.map((slice, index) => (
                          <Cell
                            key={slice.brandId}
                            fill={brandColorFor({ slug: slice.slug, name: slice.name }, index)}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={currencyTooltipFormatter} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-2">
                    {data.revenueByBrand.map((slice, index) => {
                      const color = brandColorFor({ slug: slice.slug, name: slice.name }, index)
                      return (
                      <div key={slice.brandId} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                            style={{ backgroundColor: color }}
                            aria-hidden
                          />
                          <span
                            className="truncate font-semibold"
                            style={{ color: brandLabelColor({ slug: slice.slug, name: slice.name }) }}
                          >
                            {slice.name}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums text-gray-500">
                          {peso(slice.total)}
                          <span className="ml-1 text-gray-400">
                            ({revenueMixTotal > 0 ? ((slice.total / revenueMixTotal) * 100).toFixed(0) : 0}%)
                          </span>
                        </span>
                      </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </ChartCard>
          </div>

          {/* Top flavors / store items / order products */}
          <div className="grid gap-3 lg:grid-cols-3">
            <ChartCard
              title="Top Flavors"
              subtitle="Store consumption from DSIR ice cream inventory"
              icon={IceCream2}
            >
              {data.topFlavors.length === 0 ? (
                <EmptyState
                  icon={IceCream2}
                  title="No flavor movement"
                  note="Flavor consumption is derived from DSIR ice cream inventory counts."
                />
              ) : (
                <div className="space-y-3">
                  {data.topFlavors.map((flavor, index) => (
                    <BarListRow
                      key={flavor.flavor}
                      label={flavor.flavor}
                      value={`${fmtInt(flavor.consumed)} units`}
                      ratio={flavor.consumed / (data.topFlavors[0]?.consumed || 1)}
                      barClass={index === 0 ? 'bg-blue-500' : 'bg-blue-300'}
                    />
                  ))}
                </div>
              )}
            </ChartCard>

            <ChartCard title="Top Store Items" subtitle="DSIR item sales by revenue" icon={Package}>
              {data.topStoreItems.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No store item sales"
                  note="Item-level sales come from submitted DSIR sales inventory."
                />
              ) : (
                <div className="space-y-3">
                  {data.topStoreItems.map((item, index) => (
                    <BarListRow
                      key={item.name}
                      label={item.name}
                      sub={`${fmtInt(item.quantity)} sold`}
                      value={peso(item.amount)}
                      ratio={item.amount / (data.topStoreItems[0]?.amount || 1)}
                      barClass={index === 0 ? 'bg-emerald-500' : 'bg-emerald-300'}
                    />
                  ))}
                </div>
              )}
            </ChartCard>

            <ChartCard
              title="Top Wholesale Products"
              subtitle="Customer order lines by revenue"
              icon={ShoppingCart}
            >
              {data.topOrderProducts.length === 0 ? (
                <EmptyState
                  icon={ShoppingCart}
                  title="No product orders"
                  note="Paid, complete or fulfilled customer orders will rank products here."
                />
              ) : (
                <div className="space-y-3">
                  {data.topOrderProducts.map((item, index) => (
                    <BarListRow
                      key={item.name}
                      label={item.name}
                      sub={`${fmtInt(item.quantity)} pcs`}
                      value={peso(item.amount)}
                      ratio={item.amount / (data.topOrderProducts[0]?.amount || 1)}
                      barClass={index === 0 ? 'bg-violet-500' : 'bg-violet-300'}
                    />
                  ))}
                </div>
              )}
            </ChartCard>
          </div>

          {/* Factory + materials */}
          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard
              title="Weekly Factory Output"
              subtitle="Units produced per week"
              icon={Factory}
              right={
                data.factoryBatchCount > 0 ? (
                  <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                    {fmtInt(data.factoryBatchCount)} batches
                  </span>
                ) : null
              }
            >
              {data.factoryWeekly.length === 0 ? (
                <EmptyState
                  icon={Factory}
                  title="No production data recorded yet"
                  note="Weekly output appears once daily stock summaries or factory batches are recorded in this period."
                />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <ComposedChart data={data.factoryWeekly} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => v.toLocaleString()}
                      width={48}
                    />
                    <Tooltip formatter={(value: number | string) => fmtInt(Number(value))} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="production" name="Produced" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    {data.factoryBatchCount > 0 ? (
                      <Line
                        type="monotone"
                        dataKey="batchUnits"
                        name="Batch Units"
                        stroke="#0891b2"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    ) : null}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard
              title="Material Usage"
              subtitle="Factory batch material consumption"
              icon={Boxes}
              right={
                data.materialUsageTotalCost > 0 ? (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                    {peso(data.materialUsageTotalCost)} total
                  </span>
                ) : null
              }
            >
              {data.materialUsage.length === 0 ? (
                <EmptyState
                  icon={Boxes}
                  title="No material usage recorded yet"
                  note="Usage appears once factory batches start logging material consumption in this period."
                />
              ) : (
                <div className="space-y-3">
                  {data.materialUsage.map((material, index) => (
                    <BarListRow
                      key={material.material}
                      label={material.material}
                      sub={`${material.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${material.unit}`}
                      value={material.cost > 0 ? peso(material.cost) : '—'}
                      ratio={
                        (material.cost || material.quantity) /
                        ((data.materialUsage[0]?.cost || data.materialUsage[0]?.quantity) || 1)
                      }
                      barClass={index === 0 ? 'bg-orange-500' : 'bg-orange-300'}
                    />
                  ))}
                </div>
              )}
            </ChartCard>
          </div>

          {/* Payments */}
          <ChartCard
            title="Payments & Cash Flow"
            subtitle="Store cash and order collections vs voucher disbursements"
            icon={Wallet}
          >
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-xs font-medium text-emerald-700">Store Cash Collected</p>
                <p className="mt-0.5 text-lg font-bold text-emerald-900">{peso(data.payments.storeCash)}</p>
              </div>
              <div className="rounded-lg bg-violet-50 p-3">
                <p className="text-xs font-medium text-violet-700">Order Payments</p>
                <p className="mt-0.5 text-lg font-bold text-violet-900">{peso(data.payments.orderPayments)}</p>
              </div>
              <div className="rounded-lg bg-rose-50 p-3">
                <p className="text-xs font-medium text-rose-700">
                  Voucher Outflow{data.payments.voucherCount > 0 ? ` (${data.payments.voucherCount})` : ''}
                </p>
                <p className="mt-0.5 text-lg font-bold text-rose-900">
                  {data.payments.voucherCount > 0 ? peso(data.payments.voucherOutflow) : 'None recorded'}
                </p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={data.payments.trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={pesoCompact}
                  width={52}
                />
                <Tooltip formatter={currencyTooltipFormatter} labelStyle={{ color: '#111827', fontWeight: 600 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="storeCash" name="Store Cash" stackId="in" fill="#10b981" maxBarSize={22} />
                <Bar
                  dataKey="orderPayments"
                  name="Order Payments"
                  stackId="in"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
                <Line
                  type="monotone"
                  dataKey="voucherOutflow"
                  name="Voucher Outflow"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Location rankings by franchise (portal orders) */}
          <div>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Building2 className="h-4 w-4 text-gray-500" aria-hidden />
                  Location Rankings by Franchise
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Every branch ranked within its franchise by portal order revenue
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                {data.locationRankings.length} locations · {locationsByFranchise.length} franchises
              </span>
            </div>

            {locationsByFranchise.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No location activity"
                note="Locations rank by paid, complete, or fulfilled portal orders within the selected period."
              />
            ) : (
              <div className="grid items-stretch gap-3 lg:grid-cols-3">
                {locationsByFranchise.map((franchise) => {
                  const franchiseColor = brandColorFor(
                    { slug: franchise.brandSlug, name: franchise.brandName }
                  )
                  return (
                    <ChartCard
                      key={franchise.brandId}
                      title={franchise.brandName}
                      subtitle={`${franchise.locations.length} locations · ${peso(franchise.totalOrderRevenue)} orders`}
                      className="h-[420px]"
                      right={
                        <span
                          className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
                          style={{ backgroundColor: franchiseColor }}
                          aria-hidden
                        />
                      }
                    >
                      <div className="h-full space-y-1 overflow-y-auto pr-1">
                        {franchise.locations.map((location, index) => (
                          <div
                            key={location.locationId}
                            className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
                          >
                            <RankBadge rank={index + 1} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-3">
                                <p className="truncate text-sm font-medium text-gray-800" title={location.name}>
                                  {location.name}
                                  {index === 0 && location.orderRevenue > 0 ? (
                                    <Trophy className="ml-1 inline h-3.5 w-3.5 text-amber-500" aria-hidden />
                                  ) : null}
                                </p>
                                <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                                  {peso(location.orderRevenue)}
                                </p>
                              </div>
                              <div className="mt-0.5 flex items-center justify-between gap-3">
                                <p className="truncate text-[11px] text-gray-400">
                                  {location.franchisee ? `${location.franchisee} · ` : ''}
                                  {location.companyOwned ? 'Company-owned' : 'Franchise'}
                                  {location.orderCount === 0
                                    ? ' · No orders yet'
                                    : ` · ${location.orderCount} order${location.orderCount === 1 ? '' : 's'}`}
                                </p>
                                <p className="shrink-0 text-[11px] tabular-nums text-gray-400">
                                  {location.orderDays > 0
                                    ? `${peso(location.avgDailyOrders)}/day · ${location.orderDays}d`
                                    : '—'}
                                </p>
                              </div>
                              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-100">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.max(
                                      location.orderRevenue > 0 ? 2 : 0,
                                      (location.orderRevenue / (franchise.maxSales || 1)) * 100
                                    )}%`,
                                    backgroundColor: franchiseColor,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ChartCard>
                  )
                })}
              </div>
            )}
          </div>

          {/* Company-owned locations via DSIR, per brand */}
          <div>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Building2 className="h-4 w-4 text-gray-500" aria-hidden />
                  Company-Owned Location Rankings
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Company-owned branches ranked by DSIR net sales, separated by brand
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                {data.companyOwnedDsirRankings.length} locations · {companyOwnedByBrand.length} brands
              </span>
            </div>

            {companyOwnedByBrand.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No company-owned locations"
                note="Company-owned branches rank here by submitted DSIR net sales."
              />
            ) : (
              <div
                className={`grid items-stretch gap-3 ${
                  companyOwnedByBrand.length === 1
                    ? 'lg:grid-cols-1'
                    : companyOwnedByBrand.length === 2
                      ? 'lg:grid-cols-2'
                      : 'lg:grid-cols-3'
                }`}
              >
                {companyOwnedByBrand.map((brand) => {
                  const brandColor = brandColorFor({ slug: brand.brandSlug, name: brand.brandName })
                  return (
                    <ChartCard
                      key={brand.brandId}
                      title={brand.brandName}
                      subtitle={`${brand.locations.length} company-owned · ${peso(brand.totalNetSales)} net`}
                      className="h-[420px]"
                      right={
                        <span
                          className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
                          style={{ backgroundColor: brandColor }}
                          aria-hidden
                        />
                      }
                    >
                      <div className="h-full space-y-1 overflow-y-auto pr-1">
                        {brand.locations.map((location, index) => (
                          <div
                            key={location.locationId}
                            className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
                          >
                            <RankBadge rank={index + 1} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-3">
                                <p className="truncate text-sm font-medium text-gray-800" title={location.name}>
                                  {location.name}
                                  {index === 0 && location.netSales > 0 ? (
                                    <Trophy className="ml-1 inline h-3.5 w-3.5 text-amber-500" aria-hidden />
                                  ) : null}
                                </p>
                                <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                                  {peso(location.netSales)}
                                </p>
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                                <span className="text-gray-500">Gross {peso(location.grossSales)}</span>
                                <span className="text-gray-300">·</span>
                                <span className="text-emerald-700">Cash {peso(location.cashCollected)}</span>
                                <span className="text-gray-300">·</span>
                                <span
                                  className={
                                    Math.abs(location.discrepancy) > 0.009
                                      ? location.discrepancy > 0
                                        ? 'font-medium text-amber-700'
                                        : 'font-medium text-red-600'
                                      : 'text-gray-400'
                                  }
                                >
                                  Discrepancy {peso(location.discrepancy)}
                                </span>
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                                <span>
                                  Avg Big {location.avgBigCups.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                </span>
                                <span className="text-gray-300">·</span>
                                <span>
                                  Avg Small {location.avgSmallCups.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                </span>
                                {location.reportDays > 0 ? (
                                  <>
                                    <span className="text-gray-300">·</span>
                                    <span className="text-gray-400">
                                      Total {fmtInt(location.bigCupQty)}B / {fmtInt(location.smallCupQty)}S
                                    </span>
                                  </>
                                ) : null}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                                <span className="font-medium text-violet-700">
                                  Cost/Big {location.avgCostPerBigCup > 0 ? peso(location.avgCostPerBigCup, 2) : '—'}
                                </span>
                                <span className="text-gray-300">·</span>
                                <span className="font-medium text-violet-700">
                                  Cost/Small {location.avgCostPerSmallCup > 0 ? peso(location.avgCostPerSmallCup, 2) : '—'}
                                </span>
                                <span className="text-gray-300">·</span>
                                <span className="text-gray-500">
                                  {fmtInt(location.pansDelivered)} pans
                                  {location.salesPerPan > 0 ? ` · ${peso(location.salesPerPan, 2)}/pan` : ''}
                                </span>
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-sky-700">
                                <span className="font-medium">
                                  Actual Big/pan{' '}
                                  {location.avgBigCupsPerPan > 0
                                    ? location.avgBigCupsPerPan.toLocaleString(undefined, {
                                        maximumFractionDigits: 1,
                                      })
                                    : '—'}
                                </span>
                                <span className="text-gray-300">·</span>
                                <span className="font-medium">
                                  Actual Small/pan{' '}
                                  {location.avgSmallCupsPerPan > 0
                                    ? location.avgSmallCupsPerPan.toLocaleString(undefined, {
                                        maximumFractionDigits: 1,
                                      })
                                    : '—'}
                                </span>
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-cyan-800">
                                <span className="font-medium" title="If all cup sales were sold as big cups only">
                                  All-big/pan{' '}
                                  {location.allBigOnlyPerPan > 0
                                    ? location.allBigOnlyPerPan.toLocaleString(undefined, {
                                        maximumFractionDigits: 1,
                                      })
                                    : '—'}
                                </span>
                                <span className="text-gray-300">·</span>
                                <span className="font-medium" title="If all cup sales were sold as small cups only">
                                  All-small/pan{' '}
                                  {location.allSmallOnlyPerPan > 0
                                    ? location.allSmallOnlyPerPan.toLocaleString(undefined, {
                                        maximumFractionDigits: 1,
                                      })
                                    : '—'}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center justify-between gap-3">
                                <p className="truncate text-[11px] text-gray-400">
                                  {location.franchisee || 'Company-owned'}
                                  {location.reportDays === 0 ? ' · No DSIR yet' : ''}
                                </p>
                                <p className="shrink-0 text-[11px] tabular-nums text-gray-400">
                                  {location.reportDays > 0
                                    ? `${peso(location.avgDailySales)}/day · ${location.reportDays}d`
                                    : '—'}
                                </p>
                              </div>
                              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-100">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.max(
                                      location.netSales > 0 ? 2 : 0,
                                      (location.netSales / (brand.maxSales || 1)) * 100
                                    )}%`,
                                    backgroundColor: brandColor,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ChartCard>
                  )
                })}
              </div>
            )}
          </div>

          {/* Staff rankings: overall + by store */}
          <div className="grid items-stretch gap-3 lg:grid-cols-2">
            <ChartCard
              title="Overall Staff Rankings"
              subtitle="Total DSIR gross sales across all stores"
              icon={Trophy}
              className="h-[480px]"
              right={
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                  {data.staffRankingsOverall.length} staff
                </span>
              }
            >
              {data.staffRankingsOverall.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No staff activity"
                  note="Staff rank by total gross sales across all stores in this period."
                />
              ) : (
                <div className="h-full space-y-1 overflow-y-auto pr-1">
                  {data.staffRankingsOverall.map((staff, index) => {
                    const maxOverall = data.staffRankingsOverall[0]?.sales || 1
                    return (
                      <div
                        key={staff.staffId}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
                      >
                        <RankBadge rank={index + 1} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="truncate text-sm font-medium text-gray-800" title={staff.name}>
                              {staff.name}
                              {index === 0 ? (
                                <Trophy className="ml-1 inline h-3.5 w-3.5 text-amber-500" aria-hidden />
                              ) : null}
                            </p>
                            <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                              {peso(staff.sales)}
                            </p>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                            <span className="font-medium text-emerald-700">
                              Incentive {peso(staff.incentive)}
                            </span>
                            <span className="text-gray-300">·</span>
                            <span
                              className={
                                Math.abs(staff.discrepancy) > 0.009
                                  ? staff.discrepancy > 0
                                    ? 'font-medium text-amber-700'
                                    : 'font-medium text-red-600'
                                  : 'text-gray-400'
                              }
                            >
                              Discrepancy {peso(staff.discrepancy)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-3">
                            <p className="truncate text-[11px] text-gray-400">
                              {staff.days} selling day{staff.days === 1 ? '' : 's'}
                              {staff.hours > 0 ? ` · ${staff.hours.toLocaleString()} hrs` : ''}
                              {staff.storeCount > 1
                                ? ` · ${staff.storeCount} stores`
                                : staff.topStoreName
                                  ? ` · ${staff.topStoreName}`
                                  : ''}
                            </p>
                            {staff.salesPerHour > 0 ? (
                              <p className="shrink-0 text-[11px] tabular-nums text-gray-400">
                                {peso(staff.salesPerHour)}/hr
                              </p>
                            ) : null}
                          </div>
                          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{
                                width: `${Math.max(2, (staff.sales / maxOverall) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ChartCard>

            <ChartCard
              title="Staff Rankings by Store"
              subtitle="Staff ranked within each location by DSIR gross sales"
              icon={Users}
              className="h-[480px]"
              right={
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                  {data.staffRankings.length} entries · {staffByStore.length} stores
                </span>
              }
            >
              {staffByStore.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No staff activity"
                  note="Staff rank by gross sales on the DSIR reports they submitted at each store."
                />
              ) : (
                <div className="h-full space-y-4 overflow-y-auto pr-1">
                  {staffByStore.map((store) => {
                    const storeColor = brandColorFor(store.brandName)
                    return (
                      <div key={store.locationId}>
                        <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-gray-100 pb-1.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">{store.locationName}</p>
                            <p className="truncate text-[11px] font-medium" style={{ color: storeColor }}>
                              {store.brandName}
                            </p>
                          </div>
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ backgroundColor: `${storeColor}18`, color: storeColor }}
                          >
                            {store.staff.length} staff
                          </span>
                        </div>
                        <div className="space-y-1">
                          {store.staff.map((staff, index) => (
                            <div
                              key={`${staff.staffId}-${staff.locationId}`}
                              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
                            >
                              <RankBadge rank={index + 1} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-3">
                                  <p className="truncate text-sm font-medium text-gray-800" title={staff.name}>
                                    {staff.name}
                                    {index === 0 ? (
                                      <Trophy className="ml-1 inline h-3.5 w-3.5 text-amber-500" aria-hidden />
                                    ) : null}
                                  </p>
                                  <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                                    {peso(staff.sales)}
                                  </p>
                                </div>
                                <div className="mt-0.5 flex items-center justify-between gap-3">
                                  <p className="truncate text-[11px] text-gray-400">
                                    {staff.days} selling day{staff.days === 1 ? '' : 's'}
                                    {staff.hours > 0 ? ` · ${staff.hours.toLocaleString()} hrs` : ''}
                                  </p>
                                  {staff.salesPerHour > 0 ? (
                                    <p className="shrink-0 text-[11px] tabular-nums text-gray-400">
                                      {peso(staff.salesPerHour)}/hr
                                    </p>
                                  ) : null}
                                </div>
                                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-100">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.max(2, (staff.sales / (store.maxSales || 1)) * 100)}%`,
                                      backgroundColor: storeColor,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ChartCard>
          </div>

          <p className="text-center text-[11px] text-gray-400">
            Financial figures are computed from submitted DSIR reports and paid customer orders.
            Factory, material and voucher sections populate automatically as those records are created.
          </p>
        </>
      )}
    </div>
  )
}
