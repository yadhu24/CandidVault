import { GetObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import type { Readable } from 'node:stream'
import { getR2Client } from './r2'

// Streaming R2 helpers for the worker ONLY (ZIP export). Intentionally NOT
// re-exported from ./index so @aws-sdk/lib-storage never lands in app bundles.

const BUCKET = process.env.R2_BUCKET_NAME!

// Opens an object as a Node stream — never buffers the whole object, so a 500 MB
// video doesn't blow up memory.
export async function getObjectStream(key: string): Promise<Readable> {
  const res = await getR2Client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  if (!res.Body) throw new Error(`Object has no body: ${key}`)
  return res.Body as Readable
}

// Streams a body to R2 via managed multipart upload (parts are uploaded as the
// stream flows; the whole payload is never held in memory). Resolves when done;
// lib-storage aborts the multipart upload automatically if it rejects.
export async function uploadStream(key: string, body: Readable, contentType: string): Promise<void> {
  const upload = new Upload({
    client: getR2Client(),
    params: { Bucket: BUCKET, Key: key, Body: body, ContentType: contentType },
  })
  await upload.done()
}
