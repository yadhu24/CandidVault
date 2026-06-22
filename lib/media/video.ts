import { spawn } from 'node:child_process'
import type { VideoProbe } from './types'

// Video handling shells out to ffmpeg/ffprobe when they're on PATH. They are NOT
// bundled — a host without them falls back to "no poster" (see process-upload).
// We feed ffmpeg a short-lived presigned GET URL so it range-seeks the original
// in R2 rather than downloading a potentially huge file.

interface RunResult {
  stdout: Buffer
  stderr: string
  code: number
}

function run(cmd: string, args: string[], timeoutMs: number, captureStdout: boolean): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', captureStdout ? 'pipe' : 'ignore', 'pipe'],
    })
    const out: Buffer[] = []
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    child.stdout?.on('data', (d: Buffer) => out.push(d))
    child.stderr?.on('data', (d: Buffer) => {
      err += d.toString()
    })
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ stdout: Buffer.concat(out), stderr: err, code: code ?? -1 })
    })
  })
}

let availability: boolean | undefined

// Cached check for ffmpeg + ffprobe on PATH.
export async function ffmpegAvailable(): Promise<boolean> {
  if (availability !== undefined) return availability
  try {
    const [a, b] = await Promise.all([
      run('ffmpeg', ['-version'], 5000, false),
      run('ffprobe', ['-version'], 5000, false),
    ])
    availability = a.code === 0 && b.code === 0
  } catch {
    availability = false
  }
  return availability
}

// Duration + dimensions from the container metadata (fast; no full read).
export async function probeVideo(sourceUrl: string): Promise<VideoProbe> {
  const { stdout, code } = await run(
    'ffprobe',
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', sourceUrl],
    30_000,
    true,
  )
  if (code !== 0) return { durationSeconds: null, width: null, height: null }
  const json = JSON.parse(stdout.toString()) as {
    format?: { duration?: string }
    streams?: Array<{ codec_type?: string; width?: number; height?: number }>
  }
  const duration = json.format?.duration ? Math.round(parseFloat(json.format.duration)) : null
  const videoStream = json.streams?.find((s) => s.codec_type === 'video')
  return {
    durationSeconds: Number.isFinite(duration) ? duration : null,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
  }
}

// Single JPEG poster frame at `atSeconds`. `-ss` before `-i` is a fast seek, so
// ffmpeg pulls only the bytes around that timestamp. Returns the JPEG bytes.
export async function extractPosterFrame(sourceUrl: string, atSeconds: number): Promise<Buffer> {
  const { stdout, stderr, code } = await run(
    'ffmpeg',
    ['-ss', String(atSeconds), '-i', sourceUrl, '-frames:v', '1', '-f', 'image2', '-vcodec', 'mjpeg', 'pipe:1'],
    60_000,
    true,
  )
  if (code !== 0 || stdout.length === 0) {
    throw new Error(`poster extraction failed: ${stderr.slice(0, 200)}`)
  }
  return stdout
}
