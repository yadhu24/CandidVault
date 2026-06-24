import { query, queryOne } from '../query'

// Upsert this worker's heartbeat. Called on a fixed interval by the worker; the
// row's last_beat_at is what /api/health checks for liveness.
export async function recordWorkerHeartbeat(
  workerId: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await query(
    `INSERT INTO worker_heartbeats (worker_id, last_beat_at, detail)
     VALUES ($1, now(), $2::jsonb)
     ON CONFLICT (worker_id) DO UPDATE SET last_beat_at = now(), detail = EXCLUDED.detail`,
    [workerId, JSON.stringify(detail)],
  )
}

export interface WorkerHeartbeat {
  workerId: string
  lastBeatAt: string
  detail: Record<string, unknown>
}

// The freshest heartbeat across all worker instances — "is any worker alive?".
export function getLatestWorkerHeartbeat(): Promise<WorkerHeartbeat | null> {
  return queryOne<WorkerHeartbeat>(
    `SELECT worker_id, last_beat_at, detail
     FROM worker_heartbeats
     ORDER BY last_beat_at DESC
     LIMIT 1`,
  )
}
