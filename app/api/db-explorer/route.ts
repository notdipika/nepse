import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import nepsePool from '@/lib/db-nepse'
import { RowDataPacket } from 'mysql2'

export const runtime = 'nodejs'

const BLOCKED = /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|REPLACE|LOAD)\b/i

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const { sql } = body
  if (!sql || typeof sql !== 'string')
    return NextResponse.json({ error: 'No SQL provided' }, { status: 400 })

  if (BLOCKED.test(sql.trim()))
    return NextResponse.json({ error: 'Only SELECT, SHOW, and CALL queries are allowed.' }, { status: 403 })

  const t0 = Date.now()
  try {
    const [rows] = await nepsePool.query<RowDataPacket[]>(sql)
    const data    = Array.isArray(rows) ? rows : []
    const columns = data.length > 0 ? Object.keys(data[0]) : []
    const result  = data.map(r => columns.map(c => r[c] ?? null))
    return NextResponse.json({ columns, rows: result, rowCount: result.length, ms: Date.now() - t0 })
  } catch (e: any) {
    return NextResponse.json({ columns:[], rows:[], rowCount:0, ms: Date.now()-t0, error: e.message })
  }
}