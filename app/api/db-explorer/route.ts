/**
 * app/api/db-explorer/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Runs a user-supplied SQL statement against nepse_db.
 * Restricted to SELECT / SHOW / CALL / EXPLAIN only.
 */
import { NextResponse } from 'next/server'
import { runExplorerQuery } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const { sql } = await req.json().catch(() => ({ sql: '' })) as { sql?: string }
    if (!sql?.trim()) {
      return NextResponse.json({ error: 'No SQL provided', columns: [], rows: [], rowCount: 0 }, { status: 400 })
    }
    const result = await runExplorerQuery(sql)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  } catch (err) {
    console.error('[/api/db-explorer]', err)
    return NextResponse.json({ error: 'Internal error', columns: [], rows: [], rowCount: 0 }, { status: 500 })
  }
}