export interface TransferSheetDsirItem {
  name: string
  quantity: number
}

interface TransferSheetDsirPayload {
  type: 'dsir_ice_cream_transfer_v1'
  items: Array<{ flavor: string; arrival: number }>
}

export const TRANSFER_SHEET_DSIR_QR_PREFIX = 'DSIR_TRANSFER_V1|'

function normalizeFlavorName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toUpperCase()
}

export function buildTransferSheetDsirPayload(items: TransferSheetDsirItem[]): string | null {
  const rows = items
    .map((item) => ({
      flavor: normalizeFlavorName(item.name),
      arrival: Math.max(0, Math.floor(Number(item.quantity) || 0)),
    }))
    .filter((item) => item.flavor.length > 0 && item.arrival > 0)

  if (rows.length === 0) return null

  const payload: TransferSheetDsirPayload = {
    type: 'dsir_ice_cream_transfer_v1',
    items: rows,
  }

  return `${TRANSFER_SHEET_DSIR_QR_PREFIX}${JSON.stringify(payload)}`
}
