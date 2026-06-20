import { createClient } from './db.mjs'

// Minimal, idempotent local fixtures: one photographer with a published event,
// a QR code, a guest who uploaded media, a curated album, a moderation decision,
// and a pending export. Fixed UUIDs + ON CONFLICT make re-running safe.
//
// Covers every MVP table so a fresh `npm run db:reset` yields a usable dataset
// for the dashboard and guest-upload flows.

const ID = {
  user: '11111111-1111-1111-1111-111111111111',
  event: '22222222-2222-2222-2222-222222222222',
  qr: '33333333-3333-3333-3333-333333333333',
  guest: '44444444-4444-4444-4444-444444444444',
  uploadPhoto: '55555555-5555-5555-5555-555555555551',
  uploadPending: '55555555-5555-5555-5555-555555555552',
  uploadVideo: '55555555-5555-5555-5555-555555555553',
  album: '66666666-6666-6666-6666-666666666666',
  moderation: '77777777-7777-7777-7777-777777777777',
  export: '88888888-8888-8888-8888-888888888888',
}

const key = (file) => `events/${ID.event}/original/${file}`

async function main() {
  const client = createClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    await client.query(
      `INSERT INTO users (id, email, role, display_name)
       VALUES ($1, $2, 'photographer', 'Demo Photographer')
       ON CONFLICT (id) DO NOTHING`,
      [ID.user, 'demo@candidvault.test'],
    )

    await client.query(
      `INSERT INTO photographer_profiles (user_id, business_name, contact_email, website_url)
       VALUES ($1, 'Demo Studio', 'hello@demostudio.test', 'https://demostudio.test')
       ON CONFLICT (user_id) DO NOTHING`,
      [ID.user],
    )

    await client.query(
      `INSERT INTO events (id, photographer_id, slug, name, description, status, event_date)
       VALUES ($1, $2, 'demo-wedding', 'Demo Wedding',
               'Sample event for local development.', 'active', '2026-06-01')
       ON CONFLICT (id) DO NOTHING`,
      [ID.event, ID.user],
    )

    await client.query(
      `INSERT INTO event_qr_codes (id, event_id, token, label, scan_count)
       VALUES ($1, $2, 'demo-qr-entrance', 'Entrance', 12)
       ON CONFLICT (id) DO NOTHING`,
      [ID.qr, ID.event],
    )

    await client.query(
      `INSERT INTO guest_sessions (id, event_id, qr_code_id, display_name, token)
       VALUES ($1, $2, $3, 'Alex Guest', 'demo-guest-token')
       ON CONFLICT (id) DO NOTHING`,
      [ID.guest, ID.event, ID.qr],
    )

    // An approved, fully processed photo with promoted metadata.
    await client.query(
      `INSERT INTO uploads
         (id, event_id, guest_session_id, uploader_name, media_type, status,
          moderation_status, storage_key, original_filename, mime_type,
          file_size_bytes, width, height, captured_at, metadata)
       VALUES ($1, $2, $3, 'Alex Guest', 'photo', 'ready', 'approved', $4,
               'ceremony.jpg', 'image/jpeg', 3145728, 4000, 3000,
               '2026-06-01T15:04:00Z', '{"cameraMake":"Canon","cameraModel":"R6"}')
       ON CONFLICT (id) DO NOTHING`,
      [ID.uploadPhoto, ID.event, ID.guest, key('ceremony.jpg')],
    )

    // A freshly confirmed upload still awaiting processing + moderation.
    await client.query(
      `INSERT INTO uploads
         (id, event_id, guest_session_id, uploader_name, media_type, status,
          moderation_status, storage_key, original_filename, mime_type, file_size_bytes)
       VALUES ($1, $2, $3, 'Alex Guest', 'photo', 'pending', 'pending', $4,
               'reception.heic', 'image/heic', 5242880)
       ON CONFLICT (id) DO NOTHING`,
      [ID.uploadPending, ID.event, ID.guest, key('reception.heic')],
    )

    // A processed video (photographer upload — no guest session).
    await client.query(
      `INSERT INTO uploads
         (id, event_id, uploader_name, media_type, status, moderation_status,
          storage_key, original_filename, mime_type, file_size_bytes,
          width, height, duration_seconds)
       VALUES ($1, $2, 'Demo Photographer', 'video', 'ready', 'approved', $3,
               'first-dance.mp4', 'video/mp4', 78643200, 1920, 1080, 42.5)
       ON CONFLICT (id) DO NOTHING`,
      [ID.uploadVideo, ID.event, key('first-dance.mp4')],
    )

    await client.query(
      `INSERT INTO upload_variants
         (upload_id, variant, storage_key, mime_type, width, height, file_size_bytes)
       VALUES ($1, 'thumbnail', $2, 'image/webp', 400, 300, 24576)
       ON CONFLICT (upload_id, variant) DO NOTHING`,
      [ID.uploadPhoto, `events/${ID.event}/thumbnails/${ID.uploadPhoto}.webp`],
    )

    // Cover photo now that the upload exists (resolves the events->uploads cycle).
    await client.query(`UPDATE events SET cover_upload_id = $2 WHERE id = $1`, [
      ID.event,
      ID.uploadPhoto,
    ])

    await client.query(
      `INSERT INTO albums (id, event_id, name, description, position)
       VALUES ($1, $2, 'Selects', 'Photographer''s hand-picked favorites.', 0)
       ON CONFLICT (id) DO NOTHING`,
      [ID.album, ID.event],
    )

    await client.query(
      `INSERT INTO album_items (album_id, upload_id, position)
       VALUES ($1, $2, 0)
       ON CONFLICT (album_id, upload_id) DO NOTHING`,
      [ID.album, ID.uploadPhoto],
    )

    await client.query(
      `INSERT INTO moderation_actions (id, upload_id, actor_id, action, reason)
       VALUES ($1, $2, $3, 'approve', 'Looks great')
       ON CONFLICT (id) DO NOTHING`,
      [ID.moderation, ID.uploadPhoto, ID.user],
    )

    await client.query(
      `INSERT INTO exports (id, event_id, requested_by, status, scope)
       VALUES ($1, $2, $3, 'pending', 'approved')
       ON CONFLICT (id) DO NOTHING`,
      [ID.export, ID.event, ID.user],
    )

    await client.query('COMMIT')
    console.log('seed complete: 1 photographer, 1 event, 3 uploads, 1 album, 1 export')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
