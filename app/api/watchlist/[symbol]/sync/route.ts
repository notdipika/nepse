import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

export const runtime = 'nodejs'

function resolveLoaderPath(): string | null {
  const candidates = [
    process.env.HIST_LOADER_PATH,
    process.env.HISTORY_LOADER_PATH,
    path.join(process.cwd(), 'load_history.py'),
  ].filter(Boolean) as string[]
  for (const p of candidates) { if (fs.existsSync(p)) return p }
  return null
}

function runLoader(loaderPath: string, args: string[]): Promise<{ ok: boolean; output: string }> {
  const python = process.env.PYTHON_PATH ?? 'python'
  return new Promise(resolve => {
    const child = spawn(python, [loaderPath, ...args], {
      cwd: path.dirname(loaderPath),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    })
    let out = '', err = ''
    child.stdout.on('data', (d: Buffer) => { out += d.toString() })
    child.stderr.on('data', (d: Buffer) => { err += d.toString() })
    child.on('close', code => resolve({ ok: code === 0, output: code === 0 ? out : err || out }))
    child.on('error', e => resolve({ ok: false, output: e.message }))
    setTimeout(() => { child.kill(); resolve({ ok: false, output: 'Timed out' }) }, 10 * 60 * 1000)
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { symbol } = await params
  const body = await req.json().catch(() => ({}))
  const days = Number(body.days ?? 30)

  const loaderPath = resolveLoaderPath()
  if (!loaderPath) {
    return NextResponse.json({ error: 'load_history.py not found', hint: 'Set HIST_LOADER_PATH in .env.local' }, { status: 500 })
  }

  const args = ['--days', String(Math.min(days, 365)), '--symbol', symbol.toUpperCase()]
  const { ok, output } = await runLoader(loaderPath, args)

  const loadedMatch = output.match(/Total loaded\s*:\s*(\d+)/i)
  const loaded = loadedMatch ? parseInt(loadedMatch[1], 10) : 0

  return NextResponse.json({ ok, loaded, message: ok ? `Loaded ${loaded} rows for ${symbol}` : 'Sync failed', output: output.slice(-400) })
}
