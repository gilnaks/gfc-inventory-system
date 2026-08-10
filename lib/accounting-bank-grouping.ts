export type CashGlTransaction = {
  journal_entry_id: string
  voucher_id: string | null
  entry_date: string
  entry_number: string
  memo: string | null
  source_type: string
  amount: number
}

export type CashGlLineInput = {
  debit: number
  credit: number
  journal_entry_id: string
  journal_entry: {
    id: string
    entry_date: string
    entry_number: string
    memo: string | null
    source_type: string
    source_id: string | null
  }
}

export function groupCashJournalLines(lines: CashGlLineInput[]): CashGlTransaction[] {
  const byEntry = new Map<string, CashGlTransaction>()
  for (const row of lines) {
    const je = row.journal_entry
    const debit = Number(row.debit) || 0
    const credit = Number(row.credit) || 0
    const signed = debit - credit
    if (!signed) continue

    const existing = byEntry.get(je.id)
    if (existing) {
      existing.amount += signed
    } else {
      let voucher_id: string | null = null
      if (je.source_type === 'payment_voucher' && je.source_id) {
        voucher_id = je.source_id
      }
      byEntry.set(je.id, {
        journal_entry_id: je.id,
        voucher_id,
        entry_date: je.entry_date,
        entry_number: je.entry_number,
        memo: je.memo,
        source_type: je.source_type,
        amount: signed,
      })
    }
  }

  return Array.from(byEntry.values()).sort((a, b) =>
    a.entry_date.localeCompare(b.entry_date) || a.entry_number.localeCompare(b.entry_number)
  )
}
