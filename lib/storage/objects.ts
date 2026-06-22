import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getR2Client } from './r2'

const BUCKET = process.env.R2_BUCKET_NAME!

export interface ObjectHead {
  contentLength: number
  contentType: string | null
}

// Returns null when the object does not exist; used at confirm to prove the
// browser actually uploaded before we record any metadata.
export async function headObject(key: string): Promise<ObjectHead | null> {
  try {
    const res = await getR2Client().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return { contentLength: res.ContentLength ?? 0, contentType: res.ContentType ?? null }
  } catch (err) {
    if (isNotFound(err)) return null
    throw err
  }
}

// Used to remove an object that failed server-side validation at confirm, so we
// never keep raw bytes we won't register.
export async function deleteObject(key: string): Promise<void> {
  await getR2Client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

// Worker-only: downloads an original into memory for processing (hashing,
// dimensions, thumbnails). The app server never does this — only the background
// worker, which legitimately handles media (CLAUDE.md §2).
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const res = await getR2Client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  if (!res.Body) throw new Error(`Object has no body: ${key}`)
  const bytes = await res.Body.transformToByteArray()
  return Buffer.from(bytes)
}

// Worker-only: writes a derived variant (thumbnail/preview) back to the private
// bucket. Server-side credentials only; variants are read later via presigned GET.
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await getR2Client().send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
  )
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } }
  return e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404
}
