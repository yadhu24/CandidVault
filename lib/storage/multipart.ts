import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getR2Client } from './r2'

const BUCKET = process.env.R2_BUCKET_NAME!
const PART_URL_EXPIRY_SECONDS = 900 // 15 min — matches the single-PUT window

// Server-initiated multipart upload for a server-chosen key. The returned upload
// id is never sent to the browser directly; it travels inside the signed ticket.
export async function createMultipartUpload(key: string, contentType: string): Promise<string> {
  const res = await getR2Client().send(
    new CreateMultipartUploadCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
  )
  if (!res.UploadId) throw new Error('R2 did not return an UploadId')
  return res.UploadId
}

// Presigned PUT for a single part. The browser uploads the chunk to this URL and
// reads the ETag from the response (needs R2 CORS ExposeHeaders: ETag).
export function presignUploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
): Promise<string> {
  const command = new UploadPartCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  })
  return getSignedUrl(getR2Client(), command, { expiresIn: PART_URL_EXPIRY_SECONDS })
}

export interface CompletedPart {
  partNumber: number
  etag: string
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: CompletedPart[],
): Promise<void> {
  await getR2Client().send(
    new CompleteMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: [...parts]
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    }),
  )
}

// Best-effort cleanup so an abandoned multipart upload doesn't linger (an R2
// lifecycle rule should also abort orphans — see docs).
export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  await getR2Client().send(
    new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId }),
  )
}
