import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getR2Client } from './r2'

const BUCKET = process.env.R2_BUCKET_NAME!

// Upload window must cover slow uploads of large videos, but stays bounded to
// limit how long the write capability lives. Downloads are shorter-lived.
const UPLOAD_EXPIRY_SECONDS = 900 // 15 minutes
const DOWNLOAD_EXPIRY_SECONDS = 900 // 15 minutes

// Presigned PUT for a single, server-chosen key. ContentType is pinned into the
// signature, so the browser must send exactly this type or R2 rejects the PUT.
// (Size is enforced by the per-type check at presign + a HEAD re-check at confirm;
// presigned PUT can't carry a content-length-range condition.)
export async function createUploadPresignedUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType })
  return getSignedUrl(getR2Client(), command, { expiresIn: UPLOAD_EXPIRY_SECONDS })
}

// Short-lived read URL for private originals/derivatives. The only way bytes
// leave R2 — buckets stay private.
export async function createDownloadPresignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(getR2Client(), command, { expiresIn: DOWNLOAD_EXPIRY_SECONDS })
}
