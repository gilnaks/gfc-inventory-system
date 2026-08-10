'use client'

export function AccountingStatusBanner({
  message,
  variant = 'info',
  onDismiss,
}: {
  message: string | null
  variant?: 'success' | 'error' | 'info' | 'warning'
  onDismiss?: () => void
}) {
  if (!message) return null
  const styles =
    variant === 'success'
      ? 'bg-green-50 border-green-200 text-green-800'
      : variant === 'error'
        ? 'bg-red-50 border-red-200 text-red-800'
        : variant === 'warning'
          ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-blue-50 border-blue-200 text-blue-800'
  return (
    <div className={`flex items-start justify-between gap-3 px-4 py-3 border rounded-lg text-sm ${styles}`}>
      <p className="flex-1">{message}</p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-xs underline shrink-0">
          Dismiss
        </button>
      )}
    </div>
  )
}
