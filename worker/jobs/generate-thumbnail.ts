// Idempotent: checks status before processing; safe to re-run.
export async function generateThumbnailJob(assetId: string): Promise<void> {
  // TODO: fetch asset, generate webp thumbnail via sharp, upload to R2, update status
  throw new Error('not implemented')
}
