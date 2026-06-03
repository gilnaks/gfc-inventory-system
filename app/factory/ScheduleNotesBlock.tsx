export function ScheduleNotesBlock({ notes }: { notes?: string }) {
  if (!notes) return null
  return (
    <div className="mt-3 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-gray-700 leading-snug">
      <span className="font-semibold text-gray-600">Notes: </span>
      <span>{notes}</span>
    </div>
  )
}
