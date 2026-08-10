import { supabase } from './supabase'
import type { IntercompanyTransfer, IntercompanyTransferLine, Product } from './supabase'
import {
  postIntercompanyTransferJournals,
  postIntercompanyTransferSettlementGfc,
} from './accounting-intercompany-posting'
import { ensureIntercompanyTransferPostingReady } from './accounting-intercompany-coa'
import { computeProductAvailableStock } from './product-bom-component'
import { resolveRetailProductId } from './gfc-production-catalog'

export type IntercompanyTransferLineInput = {
  sourceProductId: string
  destProductId?: string | null
  quantity: number
  unitCost: number
}

async function nextTransferNumber(factoryBrandId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `ICT-${year}-`
  const { data } = await supabase
    .from('intercompany_transfers')
    .select('transfer_number')
    .eq('from_brand_id', factoryBrandId)
    .like('transfer_number', `${prefix}%`)
    .order('transfer_number', { ascending: false })
    .limit(1)
  const last = data?.[0]?.transfer_number as string | undefined
  const seq = last ? parseInt(last.replace(prefix, ''), 10) + 1 : 1
  return `${prefix}${String(seq).padStart(4, '0')}`
}

function lineTotals(lines: IntercompanyTransferLineInput[]): {
  lines: Array<IntercompanyTransferLineInput & { unitPrice: number; lineCost: number; linePrice: number }>
  costTotal: number
  priceTotal: number
} {
  const enriched = lines.map((line) => {
    const qty = Number(line.quantity) || 0
    const unitCost = Number(line.unitCost) || 0
    const unitPrice = unitCost
    const lineCost = Math.round(qty * unitCost * 100) / 100
    const linePrice = lineCost
    return { ...line, unitPrice, lineCost, linePrice }
  })
  const costTotal = enriched.reduce((s, l) => s + l.lineCost, 0)
  const priceTotal = costTotal
  return { lines: enriched, costTotal, priceTotal }
}

export async function loadIntercompanyTransfers(brandId: string): Promise<IntercompanyTransfer[]> {
  const { data, error } = await supabase
    .from('intercompany_transfers')
    .select('*, lines:intercompany_transfer_lines(*), from_brand:brands!intercompany_transfers_from_brand_id_fkey(id, name), to_brand:brands!intercompany_transfers_to_brand_id_fkey(id, name)')
    .or(`from_brand_id.eq.${brandId},to_brand_id.eq.${brandId}`)
    .order('transfer_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as IntercompanyTransfer[]
}

function gfcInventoryUnitCost(product: Product): number {
  return Math.max(0, Number(product.price) || 0)
}


export async function createAndPostIntercompanyTransfer(params: {
  fromBrandId: string
  toBrandId: string
  transferDate: string
  lines: IntercompanyTransferLineInput[]
  notes?: string
  createdBy: string
}): Promise<IntercompanyTransfer> {
  if (!params.lines.length) throw new Error('Add at least one line')

  await ensureIntercompanyTransferPostingReady(params.fromBrandId, params.toBrandId)

  const resolvedLines: IntercompanyTransferLineInput[] = []
  for (const line of params.lines) {
    const { data: sourceProduct } = await supabase
      .from('products')
      .select('*')
      .eq('id', line.sourceProductId)
      .single()
    if (!sourceProduct) throw new Error('Source product not found')
    resolvedLines.push({
      ...line,
      unitCost: gfcInventoryUnitCost(sourceProduct as Product),
    })
  }

  const { lines: pricedLines, costTotal, priceTotal } = lineTotals(resolvedLines)
  const transferNumber = await nextTransferNumber(params.fromBrandId)
  const settledAt = new Date().toISOString()

  const { data: header, error: headerErr } = await supabase
    .from('intercompany_transfers')
    .insert([
      {
        transfer_number: transferNumber,
        from_brand_id: params.fromBrandId,
        to_brand_id: params.toBrandId,
        transfer_date: params.transferDate,
        status: 'draft',
        transfer_price_total: priceTotal,
        cost_amount_total: costTotal,
        margin_total: 0,
        notes: params.notes || null,
        created_by: params.createdBy,
      },
    ])
    .select()
    .single()
  if (headerErr) throw headerErr

  const transferId = header.id as string

  for (let i = 0; i < pricedLines.length; i++) {
    const line = pricedLines[i]
    const { data: sourceProduct } = await supabase
      .from('products')
      .select('*')
      .eq('id', line.sourceProductId)
      .single()
    if (!sourceProduct) throw new Error('Source product not found')

    const available = computeProductAvailableStock(sourceProduct as Product)
    if (available < line.quantity) {
      const productLabel =
        (sourceProduct as Product).name || (sourceProduct as Product).product_name || 'product'
      throw new Error(`Insufficient GFC stock for ${productLabel}`)
    }

    let destProductId = line.destProductId
    if (!destProductId) {
      destProductId =
        (await resolveRetailProductId(line.sourceProductId, params.toBrandId)) || undefined
    }
    if (!destProductId) {
      const sku = (sourceProduct as Product).sku
      if (sku) {
        const { data: dest } = await supabase
          .from('products')
          .select('id')
          .eq('brand_id', params.toBrandId)
          .eq('sku', sku)
          .maybeSingle()
        destProductId = dest?.id
      }
    }
    if (!destProductId) {
      throw new Error(`No matching product on destination brand for SKU ${(sourceProduct as Product).sku || '—'}`)
    }

    await supabase.from('intercompany_transfer_lines').insert([
      {
        transfer_id: transferId,
        line_no: i + 1,
        source_product_id: line.sourceProductId,
        dest_product_id: destProductId,
        sku: (sourceProduct as Product).sku,
        description: (sourceProduct as Product).name || (sourceProduct as Product).product_name,
        quantity: line.quantity,
        unit_cost: line.unitCost,
        unit_price: line.unitPrice,
        line_cost: line.lineCost,
        line_price: line.linePrice,
      },
    ])

    const newSourceReleased =
      (Number((sourceProduct as Product).released) || 0) + line.quantity
    const { error: sourceUpdateErr } = await supabase
      .from('products')
      .update({ released: newSourceReleased })
      .eq('id', line.sourceProductId)
    if (sourceUpdateErr) throw new Error(`Failed to release GFC stock: ${sourceUpdateErr.message}`)

    const { data: destProduct } = await supabase
      .from('products')
      .select('production')
      .eq('id', destProductId)
      .single()
    const newDestProduction = (Number(destProduct?.production) || 0) + line.quantity
    await supabase.from('products').update({ production: newDestProduction }).eq('id', destProductId)
  }

  const { data: fullTransfer } = await supabase
    .from('intercompany_transfers')
    .select('*, lines:intercompany_transfer_lines(*)')
    .eq('id', transferId)
    .single()

  const { fromEntryId, toEntryId } = await postIntercompanyTransferJournals(
    fullTransfer as IntercompanyTransfer,
    (fullTransfer?.lines || []) as IntercompanyTransferLine[],
    params.createdBy
  )

  const { data: posted, error: postErr } = await supabase
    .from('intercompany_transfers')
    .update({
      status: 'posted',
      journal_entry_id_from: fromEntryId,
      journal_entry_id_to: toEntryId,
      posted_at: settledAt,
      posted_by: params.createdBy,
      settled_at: settledAt,
      settled_by: params.createdBy,
    })
    .eq('id', transferId)
    .select('*, lines:intercompany_transfer_lines(*)')
    .single()
  if (postErr) throw postErr
  return posted as IntercompanyTransfer
}

export async function settleIntercompanyTransfer(
  transferId: string,
  settledBy: string
): Promise<IntercompanyTransfer> {
  const { data: transfer, error } = await supabase
    .from('intercompany_transfers')
    .select('*, lines:intercompany_transfer_lines(*)')
    .eq('id', transferId)
    .single()
  if (error) throw error
  if (!transfer) throw new Error('Transfer not found')

  const row = transfer as IntercompanyTransfer
  if (row.status !== 'posted') {
    throw new Error('Only posted transfers can be marked as paid')
  }
  if (row.settled_at) {
    throw new Error('Transfer is already settled')
  }
  if (!row.settlement_journal_entry_id_to) {
    throw new Error(
      'Franchise payment voucher must be posted before GFC can mark this transfer as paid'
    )
  }

  const settledAt = new Date().toISOString()
  const transferForPosting: IntercompanyTransfer = { ...row, settled_at: settledAt }

  const { fromEntryId } = await postIntercompanyTransferSettlementGfc(transferForPosting, settledBy)

  const { data: updated, error: updateErr } = await supabase
    .from('intercompany_transfers')
    .update({
      settled_at: settledAt,
      settled_by: settledBy,
      settlement_journal_entry_id_from: fromEntryId,
    })
    .eq('id', transferId)
    .select(
      '*, lines:intercompany_transfer_lines(*), from_brand:brands!intercompany_transfers_from_brand_id_fkey(id, name), to_brand:brands!intercompany_transfers_to_brand_id_fkey(id, name)'
    )
    .single()
  if (updateErr) throw updateErr
  return updated as IntercompanyTransfer
}

export async function postProductionBatchTransfer(params: {
  factoryBrandId: string
  toBrandId: string
  destProductId: string
  quantity: number
  unitCost: number
  transferDate: string
  createdBy: string
  notes?: string
}): Promise<IntercompanyTransfer> {
  const qty = Math.max(0, Number(params.quantity) || 0)
  if (qty <= 0) throw new Error('Batch quantity must be greater than zero.')

  const unitCost = Math.max(0, Number(params.unitCost) || 0)
  const unitPrice = unitCost
  const lineCost = Math.round(qty * unitCost * 100) / 100
  const linePrice = lineCost

  await ensureIntercompanyTransferPostingReady(params.factoryBrandId, params.toBrandId)
  const transferNumber = await nextTransferNumber(params.factoryBrandId)
  const settledAt = new Date().toISOString()

  const { data: header, error: headerErr } = await supabase
    .from('intercompany_transfers')
    .insert([
      {
        transfer_number: transferNumber,
        from_brand_id: params.factoryBrandId,
        to_brand_id: params.toBrandId,
        transfer_date: params.transferDate,
        status: 'draft',
        transfer_price_total: linePrice,
        cost_amount_total: lineCost,
        margin_total: 0,
        notes: params.notes || null,
        created_by: params.createdBy,
      },
    ])
    .select()
    .single()
  if (headerErr) throw headerErr

  const transferId = header.id as string
  const { data: destProduct, error: destErr } = await supabase
    .from('products')
    .select('id, sku, name, production')
    .eq('id', params.destProductId)
    .single()
  if (destErr || !destProduct) throw new Error('Destination product not found for production batch transfer.')

  const { error: lineErr } = await supabase.from('intercompany_transfer_lines').insert([
    {
      transfer_id: transferId,
      line_no: 1,
      source_product_id: null,
      dest_product_id: params.destProductId,
      sku: destProduct.sku,
      description: destProduct.name,
      quantity: qty,
      unit_cost: unitCost,
      unit_price: unitPrice,
      line_cost: lineCost,
      line_price: linePrice,
    },
  ])
  if (lineErr) throw lineErr

  const newDestProduction = (Number(destProduct.production) || 0) + qty
  const { error: stockErr } = await supabase
    .from('products')
    .update({ production: newDestProduction })
    .eq('id', params.destProductId)
  if (stockErr) throw stockErr

  const { data: fullTransfer } = await supabase
    .from('intercompany_transfers')
    .select('*, lines:intercompany_transfer_lines(*)')
    .eq('id', transferId)
    .single()

  const { fromEntryId, toEntryId } = await postIntercompanyTransferJournals(
    fullTransfer as IntercompanyTransfer,
    (fullTransfer?.lines || []) as IntercompanyTransferLine[],
    params.createdBy
  )

  const { data: posted, error: postErr } = await supabase
    .from('intercompany_transfers')
    .update({
      status: 'posted',
      journal_entry_id_from: fromEntryId,
      journal_entry_id_to: toEntryId,
      posted_at: settledAt,
      posted_by: params.createdBy,
      settled_at: settledAt,
      settled_by: params.createdBy,
    })
    .eq('id', transferId)
    .select('*, lines:intercompany_transfer_lines(*)')
    .single()
  if (postErr) throw postErr
  return posted as IntercompanyTransfer
}

/** Reverse a posted auto-transfer from production batch completion (journals + dest production stock). */
export async function reversePostedIntercompanyTransferForBatchRevert(
  transferId: string,
  postedBy: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: transfer, error } = await supabase
    .from('intercompany_transfers')
    .select('*, lines:intercompany_transfer_lines(*)')
    .eq('id', transferId)
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message }
  }
  if (!transfer) {
    return { ok: false, message: 'Intercompany transfer not found.' }
  }
  if (transfer.status === 'void') {
    return { ok: true }
  }
  if (transfer.status !== 'posted') {
    return { ok: false, message: 'Intercompany transfer is not posted.' }
  }
  if (transfer.settlement_journal_entry_id_from || transfer.settlement_journal_entry_id_to) {
    return {
      ok: false,
      message:
        'Cannot revert — the intercompany transfer has already been settled. Undo settlement first.',
    }
  }

  const { reverseJournalEntry } = await import('./accounting-journal-service')
  const memo = 'Production batch reverted to in progress'

  try {
    // After books consolidation, from/to may point at the same GFC journal — reverse once.
    const journalIds = Array.from(
      new Set(
        [transfer.journal_entry_id_from, transfer.journal_entry_id_to].filter(
          (id): id is string => typeof id === 'string' && id.length > 0
        )
      )
    )
    for (const journalId of journalIds) {
      await reverseJournalEntry(journalId, postedBy, memo)
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Could not reverse intercompany transfer journals.',
    }
  }

  for (const line of (transfer.lines as Array<{ dest_product_id?: string | null; quantity?: number }>) ||
    []) {
    const destProductId = line.dest_product_id
    const qty = Number(line.quantity) || 0
    if (!destProductId || qty <= 0) continue

    const { data: productRow } = await supabase
      .from('products')
      .select('production')
      .eq('id', destProductId)
      .maybeSingle()

    const nextProduction = Math.max(0, (Number(productRow?.production) || 0) - qty)
    await supabase.from('products').update({ production: nextProduction }).eq('id', destProductId)
  }

  const { error: voidErr } = await supabase
    .from('intercompany_transfers')
    .update({ status: 'void' })
    .eq('id', transferId)

  if (voidErr) {
    return { ok: false, message: voidErr.message }
  }

  return { ok: true }
}
