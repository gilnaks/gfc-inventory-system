import { supabase } from './supabase'
import type { ProductionStickerLog } from './supabase'

export function isActiveSticker(
  row: Pick<ProductionStickerLog, 'voided_at'> | { voided_at?: string | null }
): boolean {
  return !row.voided_at
}

export function countActiveStickers<T extends { voided_at?: string | null }>(
  stickers: T[]
): number {
  return stickers.filter(isActiveSticker).length
}

export async function voidProductionSticker(stickerId: string): Promise<void> {
  const { data: sticker, error: fetchError } = await supabase
    .from('production_sticker_logs')
    .select('id, product_id, produced_at, voided_at, serial_number')
    .eq('id', stickerId)
    .single()

  if (fetchError || !sticker) {
    throw new Error('Sticker not found')
  }

  if (sticker.voided_at) {
    throw new Error('This sticker is already voided')
  }

  const { error: updateError } = await supabase
    .from('production_sticker_logs')
    .update({ voided_at: new Date().toISOString() })
    .eq('id', stickerId)

  if (updateError) {
    if (
      updateError.message.includes('voided_at') ||
      updateError.message.includes('does not exist') ||
      updateError.message.includes('schema cache')
    ) {
      throw new Error(
        'Void column is not set up yet. Run migrations/production-sticker-voided.sql in Supabase first.'
      )
    }
    throw updateError
  }
}
