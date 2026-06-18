import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getR2Client } from './r2'

const BUCKET = process.env.R2_BUCKET_NAME!
const UPLOAD_EXPIRY_SECONDS = 300   // 5 minutes — short-lived on purpose
const DOWNLOAD_EXPIRY_SECONDS = 900 // 15 minutes

export async function createUploadPresignedUrl(
  key: string,
  contentType: string,
  contentLengthMax: number,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(getR2Client(), command, { expiresIn: UPLOAD_EXPIRY_SECONDS })
}

export async function createDownloadPresignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(getR2Client(), command, { expiresIn: DOWNLOAD_EXPIRY_SECONDS })
}
