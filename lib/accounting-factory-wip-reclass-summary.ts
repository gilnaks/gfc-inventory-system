export type FactoryWipReclassResult = {
  releasesReversed: number
  releasesReposted: number
  batchesReversed: number
  batchesReposted: number
  skipped: number
  errors: string[]
}

export function formatFactoryWipReclassSummary(result: FactoryWipReclassResult): string {
  const parts = [
    `${result.releasesReposted} factory releases reclassified`,
    `${result.batchesReposted} production batches reclassified`,
    `${result.skipped} skipped`,
  ]
  const summary = `Factory WIP reclass: ${parts.join(', ')}.`
  if (!result.errors.length) return summary
  return `${summary} Errors (${result.errors.length}): ${result.errors.slice(0, 5).join('; ')}${
    result.errors.length > 5 ? '…' : ''
  }`
}
