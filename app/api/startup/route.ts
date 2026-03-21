/**
 * GET /api/startup
 * Called once per day on login via TopBar.
 * If DB is empty → spawns load_history.py --days 30 in the background,
 * responds immediately with { status: 'loading' } so the UI doesn't hang.
 * Polls /api/startup again to check if done.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import nepsePool from '@/lib/db-nepse'
import { RowDataPacket } from 'mysql2'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

export const runtime = 'nodejs'

// Per-process state
type State = 'idle' | 'loading' | 'done' | 'no_loader'
let state: State = 'idle'
let loadedRows = 0

function resolveLoader(): string | null {
  const candidates = [
    process.env.HIST_LOADER_PATH,
    process.env.HISTORY_LOADER_PATH,
    path.join(process.cwd(), 'load_history.py'),
  ].filter(Boolean) as string[]
  for (const p of candidates) { if (fs.existsSync(p)) return p }
  return null
}

function spawnLoader(loaderPath: string) {
  const python = process.env.PYTHON_PATH ?? 'python3'
  const child  = spawn(python, [loaderPath, '--days', '30'], {
    cwd:   path.dirname(loaderPath),
    stdio: ['ignore', 'pipe', 'pipe'],
    env:   { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    detached: false,
  })

  let out = ''
  child.stdout.on('data', (d: Buffer) => { out += d.toString() })
  child.stderr.on('data', (d: Buffer) => { out += d.toString() })

  child.on('close', () => {
    const m = out.match(/Total loaded\s*:\s*(\d+)/i)
    loadedRows = m ? parseInt(m[1], 10) : 0
    state = 'done'
  })

  child.on('error', () => { state = 'done' })

  // Safety: mark done after 20 min even if script hangs
  setTimeout(() => { if (state === 'loading') state = 'done' }, 20 * 60 * 1000)
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Already finished
  if (state === 'done') return NextResponse.json({ status: 'done', rows: loadedRows })

  // Still running — tell client to poll again
  if (state === 'loading') return NextResponse.json({ status: 'loading' })

  // Check DB
  try {
    const [[row]] = await nepsePool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM price_data'
    )
    const count = Number((row as RowDataPacket).cnt ?? 0)

    if (count > 0) {
      state = 'done'
      loadedRows = count
      return NextResponse.json({ status: 'already_has_data', rows: count })
    }
  } catch {
    // DB not ready yet — let it retry
    return NextResponse.json({ status: 'loading' })
  }

  // Find load_history.py
  const loaderPath = resolveLoader()
  if (!loaderPath) {
    state = 'no_loader'
    return NextResponse.json({
      status: 'no_loader',
      message: 'load_history.py not found. Place it in the project root or set HIST_LOADER_PATH in .env.local',
    })
  }

  // Spawn in background — respond immediately
  state = 'loading'
  spawnLoader(loaderPath)
  return NextResponse.json({ status: 'loading' })
}