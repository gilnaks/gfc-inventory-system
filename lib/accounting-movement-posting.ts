import { postMaterialMovementJournal } from './accounting-procurement-posting'

/** Post a material movement journal and surface failures to the user (movement is already saved). */
export async function postMaterialMovementJournalWithNotice(
  movementId: string,
  brandId: string,
  postedBy: string,
  context?: string
): Promise<void> {
  try {
    await postMaterialMovementJournal(movementId, brandId, postedBy)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Accounting journal could not be posted.'
    console.error('Material movement journal failed:', e)
    alert(
      `Stock movement was saved, but the accounting journal failed${context ? ` (${context})` : ''}:\n${msg}\n\nRetry from Accounting → Posting errors.`
    )
  }
}
