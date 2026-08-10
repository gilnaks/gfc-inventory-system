import { Fragment } from 'react'

const SKELETON_CELL_WIDTHS = ['w-16', 'w-24', 'w-28', 'w-20', 'w-32', 'w-24', 'w-20'] as const

function skeletonCellWidth(index: number) {
  return SKELETON_CELL_WIDTHS[index % SKELETON_CELL_WIDTHS.length]
}

export function AccountingBooksTableSkeleton({
  columnCount,
  rows = 8,
  tableMinWidthClass = 'min-w-[520px]',
  lastColumnActions = false,
}: {
  columnCount: number
  rows?: number
  tableMinWidthClass?: string
  lastColumnActions?: boolean
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden animate-pulse">
      <table className={`w-full text-sm ${tableMinWidthClass}`}>
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {Array.from({ length: columnCount }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <div className={`h-4 bg-gray-200 rounded ${skeletonCellWidth(i)}`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: columnCount }).map((_, cellIdx) => {
                const isActions = lastColumnActions && cellIdx === columnCount - 1
                return (
                  <td key={cellIdx} className="px-4 py-3">
                    {isActions ? (
                      <div className="flex justify-end gap-1.5">
                        <div className="h-7 w-7 bg-gray-200 rounded" />
                        <div className="h-7 w-12 bg-gray-200 rounded" />
                      </div>
                    ) : (
                      <div
                        className={`h-4 bg-gray-200 rounded ${skeletonCellWidth(rowIdx + cellIdx)}`}
                      />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AccountingJournalListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 h-20 bg-gray-100" />
        ))}
      </div>
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-24" />
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="h-10 bg-gray-200 rounded-lg" />
          <div className="h-10 bg-gray-200 rounded-lg" />
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex flex-wrap justify-between gap-3 border-b border-gray-100 last:border-0">
            <div className="h-4 bg-gray-200 rounded w-24" />
            <div className="h-4 bg-gray-200 rounded w-20" />
            <div className="h-3 bg-gray-200 rounded w-28" />
            <div className="h-4 bg-gray-200 rounded w-full max-w-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function JournalSupportingDocsSkeleton({ linkCount = 2 }: { linkCount?: number }) {
  return (
    <div className="mb-3 pb-2 border-b border-gray-200 animate-pulse font-mono text-xs" aria-hidden>
      <div className="h-3 w-36 bg-gray-200 rounded mb-1.5" />
      <div className="flex flex-wrap items-center gap-y-1.5 font-mono text-xs">
        {Array.from({ length: linkCount }).map((_, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <span className="text-gray-200 select-none px-2" aria-hidden="true">
                |
              </span>
            )}
            <div
              className={`h-3.5 bg-gray-200 rounded ${i === 0 ? 'w-32' : i === 1 ? 'w-24' : 'w-28'}`}
            />
          </Fragment>
        ))}
      </div>
    </div>
  )
}

export function AccountingReportsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 h-20 bg-gray-100" />
        ))}
      </div>
      <div className="h-12 bg-gray-200 rounded-lg" />
      <AccountingBooksTableSkeleton columnCount={4} rows={10} tableMinWidthClass="w-full" />
    </div>
  )
}

export function AccountingIncomeStatementSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 h-20 bg-gray-100" />
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {[0, 1].map((col) => (
          <div key={col} className="rounded-xl border border-gray-200 h-48 bg-gray-100" />
        ))}
      </div>
    </div>
  )
}

export function AccountingBalanceSheetSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 h-20 bg-gray-100" />
        ))}
      </div>
      <div className="h-12 bg-gray-200 rounded-lg" />
      <div className="grid md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 h-56 bg-gray-100" />
        ))}
      </div>
    </div>
  )
}

export function AccountingReconciliationBankSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-32" />
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="h-10 bg-gray-200 rounded-lg" />
          <div className="h-10 bg-gray-200 rounded-lg" />
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 p-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 h-20 bg-gray-100" />
        ))}
      </div>
      <AccountingBooksTableSkeleton columnCount={5} rows={6} />
    </div>
  )
}

export function AccountingReconciliationPettySkeleton() {
  return (
    <div className="space-y-5 max-w-3xl animate-pulse">
      <div className="rounded-xl border border-gray-200 h-24 bg-gray-100" />
      <div className="grid sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 h-20 bg-gray-100" />
        ))}
      </div>
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="h-10 bg-gray-200 rounded-lg" />
          <div className="h-10 bg-gray-200 rounded-lg" />
        </div>
        <div className="h-24 bg-gray-200 rounded-lg" />
      </div>
      <div className="flex gap-2 justify-end">
        <div className="h-9 bg-gray-200 rounded-lg w-24" />
        <div className="h-9 bg-gray-200 rounded-lg w-40" />
      </div>
    </div>
  )
}

export function AccountingPayablesSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 h-20 bg-gray-100" />
        ))}
      </div>
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-40" />
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="h-10 bg-gray-200 rounded-lg" />
          <div className="h-10 bg-gray-200 rounded-lg" />
        </div>
      </div>
      <AccountingBooksTableSkeleton columnCount={7} rows={8} tableMinWidthClass="min-w-[800px]" />
    </div>
  )
}

export function AccountingTransfersListSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 h-20 bg-gray-100" />
        ))}
      </div>
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-28" />
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="h-10 bg-gray-200 rounded-lg" />
          <div className="h-10 bg-gray-200 rounded-lg" />
        </div>
      </div>
      <AccountingBooksTableSkeleton columnCount={6} rows={5} tableMinWidthClass="w-full" />
    </div>
  )
}

export function AccountingGlToolbarSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="h-4 bg-gray-200 rounded w-28" />
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="h-10 bg-gray-200 rounded-lg sm:col-span-2" />
        <div className="h-10 bg-gray-200 rounded-lg" />
        <div className="h-10 bg-gray-200 rounded-lg" />
      </div>
    </div>
  )
}

function skeletonField(labelWidth = 'w-16') {
  return (
    <div className="space-y-1.5">
      <div className={`h-3 bg-gray-200 rounded ${labelWidth}`} />
      <div className="h-[34px] bg-gray-200 rounded" />
    </div>
  )
}

/** Matches payment voucher form layout while invoice prefill loads. */
export function PaymentVoucherPrefillSkeleton({ lineRows = 3 }: { lineRows?: number }) {
  return (
    <div className="space-y-5 animate-pulse" aria-hidden aria-busy="true">
      <div className="pb-3 border-b border-gray-200">
        <div className="h-3 w-36 bg-gray-200 rounded mb-1.5" />
        <div className="flex flex-wrap items-center gap-y-1 font-mono text-xs">
          <div className="h-3.5 w-28 bg-gray-200 rounded" />
          <span className="text-gray-100 select-none px-2">|</span>
          <div className="h-3.5 w-32 bg-gray-200 rounded" />
          <span className="text-gray-100 select-none px-2">|</span>
          <div className="h-3.5 w-36 bg-gray-200 rounded" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {skeletonField('w-10')}
        {skeletonField('w-20')}
        {skeletonField('w-24')}
        {skeletonField('w-12')}
      </div>

      <div className="space-y-4">
        {skeletonField('w-24')}
        <div className="grid grid-cols-2 gap-3">
          <div className="h-[38px] bg-gray-200 rounded" />
          <div className="h-[38px] bg-gray-200 rounded" />
        </div>
      </div>

      <div className="space-y-3 pt-1">
        <div className="flex justify-between items-center">
          <div className="h-3 w-16 bg-gray-200 rounded" />
          <div className="h-3 w-14 bg-gray-200 rounded" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: lineRows }).map((_, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-4 h-[34px] bg-gray-200 rounded" />
              <div className="col-span-3 h-[34px] bg-gray-200 rounded" />
              <div className="col-span-2 h-[34px] bg-gray-200 rounded" />
              <div className="col-span-2 h-[34px] bg-gray-200 rounded" />
              <div className="col-span-1 h-4 bg-gray-200 rounded justify-self-end w-4" />
            </div>
          ))}
        </div>
        <div className="h-4 w-28 bg-gray-200 rounded ml-auto" />
      </div>

      <div className="space-y-1.5">
        <div className="h-3 w-10 bg-gray-200 rounded" />
        <div className="h-16 bg-gray-200 rounded" />
      </div>
    </div>
  )
}
