export function ProgressFractionCircle({
  current,
  total,
  size = 'lg',
  strokeClass = 'text-slate-600',
}: {
  current: number
  total: number
  size?: 'sm' | 'lg'
  strokeClass?: string
}) {
  const safeTotal = Math.max(0, total)
  const safeCurrent = Math.max(0, current)
  const pct = safeTotal > 0 ? Math.min(1, safeCurrent / safeTotal) : 0
  const cfg =
    size === 'sm'
      ? { box: 'h-14 w-14', r: 24, stroke: 5, text: 'text-xs', center: 30, view: 60 }
      : { box: 'h-28 w-28', r: 52, stroke: 8, text: 'text-xl', center: 60, view: 120 }
  const circumference = 2 * Math.PI * cfg.r
  const dash = circumference * pct

  return (
    <div
      className={`relative shrink-0 ${cfg.box}`}
      aria-label={`${safeCurrent} of ${safeTotal} in production`}
    >
      <svg className={`${cfg.box} -rotate-90`} viewBox={`0 0 ${cfg.view} ${cfg.view}`}>
        <circle
          cx={cfg.center}
          cy={cfg.center}
          r={cfg.r}
          fill="none"
          stroke="currentColor"
          strokeWidth={cfg.stroke}
          className="text-slate-200"
        />
        <circle
          cx={cfg.center}
          cy={cfg.center}
          r={cfg.r}
          fill="none"
          stroke="currentColor"
          strokeWidth={cfg.stroke}
          strokeLinecap="round"
          className={strokeClass}
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-bold tabular-nums leading-none ${cfg.text} text-slate-800`}>
          {safeCurrent}/{safeTotal}
        </span>
      </div>
    </div>
  )
}
