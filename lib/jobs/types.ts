// Typed job payloads for the background worker.
//
// The queue itself is the `uploads` table: a row with status='pending' IS an
// enqueued job (claimed atomically via claimNextUpload). So a job payload is
// just the upload id. Modeling it as a discriminated union keeps room for future
// job kinds (e.g. zip exports) without reshaping the worker.
export type JobPayload = { kind: 'process_upload'; uploadId: string }

export type JobKind = JobPayload['kind']

export interface JobResult {
  ok: boolean
  uploadId: string
  detail: string
}
