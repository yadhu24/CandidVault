import { DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
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

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } }
  return e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404
}
