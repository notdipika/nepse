import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import nepsePool from '@/lib/db-nepse'
import { RowDataPacket } from 'mysql2'

export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [rows] = await nepsePool.query<RowDataPacket[]>(
    'SELECT sector_id, name FROM sector ORDER BY name ASC'
  )
  return NextResponse.json({ sectors: rows })
}
