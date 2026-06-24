import { getLatestWorkerHeartbeat } from '@/lib/db/queries/health'

// Public, unauthenticated health probe for uptime monitors. Returns 200 when the
// DB is reachable and a worker has beaten recently; 503 otherwise (so a monitor
// alerts). Exposes only timestamps/ages — no secrets.
export const dynamic = 'force-dynamic'

// The worker beats every ~15s; allow generous slack before calling it dead.
const WORKER_STALE_MS = 60_000

export async function GET() {
  let dbOk = true
  let worker = {
    ok: false,
    lastBeatAt: null as string | null,
    ageSeconds: null as number | null,
  }

  try {
    const hb = await getLatestWorkerHeartbeat()
    if (hb) {
      const ageMs = Date.now() - new Date(hb.lastBeatAt).getTime()
      worker = {
        ok: ageMs <= WORKER_STALE_MS,
        lastBeatAt: hb.lastBeatAt,
        ageSeconds: Math.round(ageMs / 1000),
      }
    }
  } catch {
    dbOk = false
  }

  const healthy = dbOk && worker.ok
  return Response.json(
    { status: healthy ? 'ok' : 'degraded', db: dbOk ? 'ok' : 'down', worker },
    { status: healthy ? 200 : 503 },
  )
}
