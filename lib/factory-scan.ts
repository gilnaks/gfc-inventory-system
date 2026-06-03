import { supabase } from './supabase'
import { isActiveSticker } from './production-sticker'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type FactoryScanResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

function extractIdFromScanInput(raw: string): string | null {
  const code = raw.trim()
  if (!code) return null
  if (UUID_RE.test(code)) return code
  if (code.includes('id=')) {
    try {
      const url = code.startsWith('http') ? new URL(code) : new URL(code, 'https://x')
      const id = url.searchParams.get('id')
      if (id && UUID_RE.test(id)) return id
    } catch {
      /* ignore */
    }
  }
  return null
}

export async function resolveStickerIdFromCode(raw: string): Promise<string | null> {
  const code = raw.trim()
  if (!code) return null

  const directId = extractIdFromScanInput(code)
  if (directId) return directId

  const upper = code.toUpperCase()
  const serialCandidates = new Set<string>([upper])
  if (!upper.startsWith('GFC-')) {
    serialCandidates.add(`GFC-${upper}`)
  }

  for (const serial of Array.from(serialCandidates)) {
    const { data } = await supabase
      .from('production_sticker_logs')
      .select('id, voided_at')
      .eq('serial_number', serial)
      .is('voided_at', null)
      .maybeSingle()
    if (data?.id) return data.id
  }

  const suffix = upper.replace(/^GFC-/, '').split('-').pop() || upper
  if (suffix.length >= 6) {
    const { data: rows } = await supabase
      .from('production_sticker_logs')
      .select('id, serial_number, produced_at, voided_at')
      .ilike('serial_number', `%-${suffix}`)
      .is('voided_at', null)
      .order('created_at', { ascending: false })
      .limit(10)

    const matches = (rows || []).filter(isActiveSticker)
    const pending = matches.filter((r) => !r.produced_at)
    const pick = pending.length > 0 ? pending : matches
    if (pick.length === 1) return pick[0].id
  }

  return null
}

export type RecordProductionScanOptions = {
  expectedProductId?: string
  expectedProductName?: string
}

export async function recordProductionScan(
  stickerId: string,
  options?: RecordProductionScanOptions
): Promise<FactoryScanResult> {
  try {
    const { data: sticker, error: fetchError } = await supabase
      .from('production_sticker_logs')
      .select('id, product_id, produced_at, serial_number, voided_at')
      .eq('id', stickerId)
      .single()

    if (fetchError || !sticker) {
      return { ok: false, message: 'Invalid or unknown sticker' }
    }

    if (!isActiveSticker(sticker)) {
      const label = sticker.serial_number ? ` (${sticker.serial_number})` : ''
      return { ok: false, message: `Voided sticker${label} — cannot scan` }
    }

    if (
      options?.expectedProductId &&
      sticker.product_id !== options.expectedProductId
    ) {
      const label = options.expectedProductName || 'the selected item'
      return {
        ok: false,
        message: `Wrong product — scan a sticker for ${label}`,
      }
    }

    if (sticker.produced_at) {
      const label = sticker.serial_number ? ` (${sticker.serial_number})` : ''
      return { ok: true, message: `Already in production inventory${label}` }
    }

    const { data: product } = await supabase
      .from('products')
      .select('production')
      .eq('id', sticker.product_id)
      .single()

    const newProduction = (product?.production || 0) + 1
    await supabase.from('products').update({ production: newProduction }).eq('id', sticker.product_id)

    await supabase
      .from('production_sticker_logs')
      .update({ produced_at: new Date().toISOString() })
      .eq('id', stickerId)

    const label = sticker.serial_number ? ` (${sticker.serial_number})` : ''
    return { ok: true, message: `Added to production inventory${label}` }
  } catch (err) {
    console.error('Factory scan error:', err)
    return { ok: false, message: 'Failed to process scan' }
  }
}
