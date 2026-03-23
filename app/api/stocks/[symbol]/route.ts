import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { nepsePool } from '@/lib/db'
import { RowDataPacket } from 'mysql2'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { symbol } = await params

  try {
    const [rows] = await nepsePool().query<RowDataPacket[]>(
      `SELECT symbol, company_name, sector, close_price, percent_change,
              volume, DATE_FORMAT(trading_date,'%Y-%m-%d') AS trading_date
       FROM v_latest_prices WHERE symbol = ? LIMIT 1`,
      [symbol.toUpperCase()]
    )
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (err) {
    console.error(`[/api/stocks/${symbol}]`, err)
    return NextResponse.json({ error: 'Failed to load stock' }, { status: 500 })
  }
}