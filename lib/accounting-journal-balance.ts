export type DraftJournalLine = {
  account_id: string
  debit: number
  credit: number
  line_no?: number
  memo?: string
}

export function validateBalanced(lines: DraftJournalLine[]): {
  ok: boolean
  debit: number
  credit: number
} {
  const debit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const credit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const ok = Math.abs(debit - credit) < 0.005 && debit > 0
  return { ok, debit, credit }
}
