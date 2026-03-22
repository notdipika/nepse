import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import nepsePool from '@/lib/db-nepse'
import { RowDataPacket } from 'mysql2'
import { spawn, execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

export const runtime = 'nodejs'

type State = 'idle' | 'loading' | 'done' | 'no_loader'
let state: State = 'idle'
let loadedRows = 0

function resolveLoader(): string | null {
  const candidates = [
    process.env.HIST_LOADER_PATH,
    path.join(process.cwd(), 'load_history.py'),
  ].filter(Boolean) as string[]
  for (const p of candidates) { if (fs.existsSync(p)) return p }
  return null
}

function resolvePython(root: string): string {
  // Prefer .venv
  const bins = [
    path.join(root, '.venv', 'bin', 'python'),
    path.join(root, '.venv', 'Scripts', 'python.exe'),
    process.env.PYTHON_PATH,
  ].filter(Boolean) as string[]
  for (const p of bins) { if (fs.existsSync(p)) return p }

  // Try system python
  for (const cmd of ['python3', 'python']) {
    try { execSync(`${cmd} --version`, { stdio: 'ignore' }); return cmd } catch {}
  }
  return 'python3'
}

function ensureVenv(root: string, python: string): string {
  const venvDir = path.join(root, '.venv')
  const req     = path.join(root, 'requirements.txt')

  if (!fs.existsSync(venvDir)) {
    try { execSync(`"${python}" -m venv "${venvDir}"`, { stdio: 'ignore', timeout: 60000 }) } catch {}
  }

  const pip = fs.existsSync(path.join(venvDir, 'bin', 'pip'))
    ? path.join(venvDir, 'bin', 'pip')
    : path.join(venvDir, 'Scripts', 'pip.exe')

  if (fs.existsSync(pip)) {
    const pkgs = 'mysql-connector-python pymysql pandas requests openpyxl'
    try { execSync(`"${pip}" install -q ${pkgs}`, { stdio: 'ignore', timeout: 120000 }) } catch {}
  }

  const venvPy = fs.existsSync(path.join(venvDir, 'bin', 'python'))
    ? path.join(venvDir, 'bin', 'python')
    : path.join(venvDir, 'Scripts', 'python.exe')

  return fs.existsSync(venvPy) ? venvPy : python
}

function spawnLoader(loaderPath: string) {
  const root   = process.cwd()
  const python = ensureVenv(root, resolvePython(root))

  const child = spawn(python, [loaderPath, '--excel'], {
    cwd:   path.dirname(loaderPath),
    stdio: ['ignore', 'pipe', 'pipe'],
    env:   { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
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
  setTimeout(() => { if (state === 'loading') state = 'done' }, 25 * 60 * 1000)
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (state === 'done')      return NextResponse.json({ status: 'done', rows: loadedRows })
  if (state === 'loading')   return NextResponse.json({ status: 'loading' })
  if (state === 'no_loader') return NextResponse.json({ status: 'no_loader' })

  try {
    const [[row]] = await nepsePool.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM price_data')
    const count = Number((row as RowDataPacket).cnt ?? 0)
    if (count > 0) {
      state = 'done'; loadedRows = count
      return NextResponse.json({ status: 'already_has_data', rows: count })
    }
  } catch {
    return NextResponse.json({ status: 'loading' })
  }

  const loaderPath = resolveLoader()
  if (!loaderPath) {
    state = 'no_loader'
    return NextResponse.json({ status: 'no_loader', message: 'load_history.py not found in project root' })
  }

  state = 'loading'
  spawnLoader(loaderPath)
  return NextResponse.json({ status: 'loading' })
}