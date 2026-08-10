import { supabase } from './supabase'

const MAX_PROOF_FILE_BYTES = 10 * 1024 * 1024
const PROOF_BUCKET = 'payment_receipts'

export async function uploadPaymentVoucherProof(
  brandId: string,
  voucherNumber: string,
  file: File
): Promise<string> {
  if (file.size > MAX_PROOF_FILE_BYTES) {
    throw new Error('File must be under 10 MB.')
  }

  const ext = file.name.split('.').pop() || 'pdf'
  const safeNumber = voucherNumber.replace(/[^\w-]/g, '_')
  const path = `${brandId}/${safeNumber}-${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(PROOF_BUCKET).upload(path, file)
  if (error) throw error

  const { data } = supabase.storage.from(PROOF_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
