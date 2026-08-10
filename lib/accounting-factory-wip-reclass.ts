import { supabase } from './supabase'
import { periodRangeFromFilter } from './accounting-reports'
import type { BillingTimeFilter } from './timezone'
import { reverseJournalEntry } from './accounting-journal-service'
import { postFactoryMaterialReleaseJournal } from './accounting-factory-wip-posting'
import { postProductionBatchJournal } from './accounting-production-posting'
import {
  formatFactoryWipReclassSummary,
  type FactoryWipReclassResult,
} from './accounting-factory-wip-reclass-summary'

export { formatFactoryWipReclassSummary, type FactoryWipReclassResult } from './accounting-factory-wip-reclass-summary'

async function journalCreditsAccount(
  journalEntryId: string,
  accountCode: string
): Promise<boolean> {
  const { data: lines } = await supabase
    .from('accounting_journal_lines')
    .select('credit, account:accounting_accounts(code)')
    .eq('journal_entry_id', journalEntryId)
  for (const line of lines || []) {
    const code = (line.account as { code?: string } | null)?.code
    if (code === accountCode && Number(line.credit) > 0) return true
  }
  return false
}

export async function reclassifyFactoryGlToWip(
  brandId: string,
  timeFilter: BillingTimeFilter,
  postedBy: string
): Promise<FactoryWipReclassResult> {
  const { fromDate, toDate } = periodRangeFromFilter(timeFilter)
  const result: FactoryWipReclassResult = {
    releasesReversed: 0,
    releasesReposted: 0,
    batchesReversed: 0,
    batchesReposted: 0,
    skipped: 0,
    errors: [],
  }

  const { data: movements } = await supabase
    .from('material_stock_movements')
    .select(
      'id, reference_id, reference_type, movement_date, journal_entry_id, material:raw_materials!inner(brand_id)'
    )
    .eq('reference_type', 'factory_request')
    .eq('material.brand_id', brandId)
    .gte('movement_date', fromDate)
    .lte('movement_date', toDate)

  for (const mov of movements || []) {
    const requestId = mov.reference_id as string
    if (!requestId) continue

    try {
      const { data: request } = await supabase
        .from('factory_material_requests')
        .select('id, journal_entry_id')
        .eq('id', requestId)
        .maybeSingle()

      if (request?.journal_entry_id) {
        const { data: releaseJe } = await supabase
          .from('accounting_journal_entries')
          .select('id, source_type')
          .eq('id', request.journal_entry_id)
          .maybeSingle()
        if (releaseJe?.source_type === 'factory_material_release') {
          result.skipped++
          continue
        }
      }

      let oldJeId = mov.journal_entry_id as string | null
      if (!oldJeId) {
        const { data: movementJe } = await supabase
          .from('accounting_journal_entries')
          .select('id')
          .eq('brand_id', brandId)
          .eq('source_type', 'material_movement')
          .eq('source_id', mov.id)
          .eq('status', 'posted')
          .maybeSingle()
        oldJeId = movementJe?.id ?? null
      }

      if (oldJeId) {
        const isOldVarianceRelease = await journalCreditsAccount(oldJeId, '1200')
        if (isOldVarianceRelease) {
          await reverseJournalEntry(oldJeId, postedBy, 'Reclassify factory release to WIP')
          result.releasesReversed++
          await supabase
            .from('material_stock_movements')
            .update({ journal_entry_id: null })
            .eq('id', mov.id)
          await supabase
            .from('factory_material_requests')
            .update({ journal_entry_id: null })
            .eq('id', requestId)
        }
      }

      const newJeId = await postFactoryMaterialReleaseJournal(
        requestId,
        mov.id as string,
        brandId,
        postedBy
      )
      if (newJeId) result.releasesReposted++
    } catch (e: unknown) {
      result.errors.push(
        `Release ${requestId.slice(0, 8)}: ${e instanceof Error ? e.message : 'failed'}`
      )
    }
  }

  const { data: batches } = await supabase
    .from('factory_production_batches')
    .select('id, journal_entry_id, work_date, status, product:products!inner(brand_id)')
    .eq('product.brand_id', brandId)
    .eq('status', 'completed')
    .not('journal_entry_id', 'is', null)
    .gte('work_date', fromDate)
    .lte('work_date', toDate)

  for (const batch of batches || []) {
    const batchId = batch.id as string
    const oldJeId = batch.journal_entry_id as string
    if (!oldJeId) continue

    try {
      const { data: oldJe } = await supabase
        .from('accounting_journal_entries')
        .select('id, source_type')
        .eq('id', oldJeId)
        .maybeSingle()

      if (oldJe?.source_type !== 'production_batch') {
        result.skipped++
        continue
      }

      const credits5900 = await journalCreditsAccount(oldJeId, '5900')
      const credits1210 = await journalCreditsAccount(oldJeId, '1210')
      if (credits1210 && !credits5900) {
        result.skipped++
        continue
      }

      if (credits5900) {
        await reverseJournalEntry(oldJeId, postedBy, 'Reclassify production batch to WIP model')
        result.batchesReversed++
        await supabase
          .from('factory_production_batches')
          .update({ journal_entry_id: null })
          .eq('id', batchId)
      }

      const newJeId = await postProductionBatchJournal(batchId, brandId, postedBy)
      if (newJeId) result.batchesReposted++
    } catch (e: unknown) {
      result.errors.push(`Batch ${batchId.slice(0, 8)}: ${e instanceof Error ? e.message : 'failed'}`)
    }
  }

  return result
}
