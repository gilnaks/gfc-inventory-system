export type BackfillResult = {
  vouchers: number
  ordersRevenue: number
  ordersCash: number
  ordersCogs: number
  deliveries: number
  materialMovements: number
  payrollAccruals: number
  productionBatches: number
  factoryMaterialReleases: number
  intercompanyTransfers: number
  materialTransfers: number
  errors: string[]
}

export function formatBackfillSummary(result: BackfillResult): string {
  const parts = [
    `${result.vouchers} vouchers`,
    `${result.ordersRevenue} order revenue`,
    `${result.ordersCash} order cash`,
    `${result.ordersCogs} order COGS`,
    `${result.deliveries} deliveries`,
    `${result.materialMovements} material movements`,
    `${result.payrollAccruals} payroll accruals`,
    `${result.productionBatches} production batches`,
    `${result.factoryMaterialReleases} factory material releases`,
    `${result.intercompanyTransfers} intercompany transfers`,
    `${result.materialTransfers} material transfers`,
  ]
  const summary = `Backfill: ${parts.join(', ')}.`
  if (!result.errors.length) return summary
  return `${summary} Errors (${result.errors.length}): ${result.errors.slice(0, 5).join('; ')}${
    result.errors.length > 5 ? '…' : ''
  }`
}
