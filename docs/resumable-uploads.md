# Resumable guest uploads

Built so a dropped connection at a low-signal venue doesn't lose progress, and so
guests can finish from home — uploads are not venue-dependent.

## Flow

```
Browser                                   App server                         R2
───────                                   ──────────                         ──
compressImage() (non-HEIC images)
POST /upload-sessions {name,type,size} ──▶ validate + guest session + key
                                           size > 10MB ? CreateMultipartUpload  ─▶ uploadId
                                           ◀── { mode, partSize?, ticket }      (key+uploadId live
                                                                                  ONLY in the ticket)
 single (≤10MB):  PUT file ──────────────────────────────────────────────────▶ object
 multipart (>10MB):
   slice into partSize chunks
   POST /upload-parts {ticket, partNumbers} ─▶ presign each part ◀── { urls }
   PUT part 1..N ───────────────────────────────────────────────────────────▶ parts
     (drop? re-presign just that part and retry; resume skips done parts)
POST /uploads {ticket, parts[]} ─────────▶ CompleteMultipartUpload ───────────▶ object
                                           HEAD + revalidate size/type
                                           registerUpload (status=pending) → worker
```

## Behavior

- **Threshold**: files over `MULTIPART_THRESHOLD_BYTES` (10 MB) use multipart with
  `UPLOAD_PART_SIZE_BYTES` (8 MB) parts; smaller files use a single presigned PUT.
- **In-session resume**: each uploaded part's ETag is kept in memory; a dropped
  connection retries only the failed/missing parts, not the whole file.
- **Client compression**: non-HEIC images are resized (≤2560px) and re-encoded to
  JPEG (q0.82) before upload to cut payload. HEIC/video pass through untouched.
- **Finish later**: copy frames it ("leave and finish from home"); started-but-
  unfinished filenames are remembered in `localStorage` per event, so a returning
  guest sees a reminder to re-add them. The signed ticket lapses after 30 min —
  if a resume happens later, that file restarts fresh (re-init).

## Security (unchanged trust model)

The browser never sees the object key or the R2 upload id — both live only inside
the HMAC-signed, short-lived ticket. `/upload-parts` and `/uploads` re-verify the
ticket and the event, presign only by part **number**, and the confirm step still
HEADs the assembled object and re-validates real size/type before registering
(deleting/aborting on violation). All three endpoints are rate-limited.

## Required R2 setup (manual)

1. **CORS — expose ETag.** The browser must read each part's `ETag` response
   header to complete a multipart upload. Add to the bucket CORS rule:
   `AllowedMethods: [PUT]`, `AllowedOrigins: [https://candidvault.org]`,
   `ExposeHeaders: [ETag]`. Without `ExposeHeaders: ETag`, multipart completion
   fails with "Missing ETag".
2. **Lifecycle — abort orphans.** Add a bucket lifecycle rule to abort incomplete
   multipart uploads after N days, so abandoned uploads (guest closed the tab
   mid-upload) don't accrue storage. The app also aborts on failed completion,
   but the lifecycle rule is the backstop.
