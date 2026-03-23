import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { nepsePool } from '@/lib/db'
import { RowDataPacket } from 'mysql2'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toUpperCase()
  if (!q) return NextResponse.json({ results: [] })

  try {
    const keyword = `%${q}%`
    const [rows] = await nepsePool().query<RowDataPacket[]>(
      `SELECT symbol, company_name, sector, close_price, percent_change,
              DATE_FORMAT(trading_date,'%Y-%m-%d') AS trading_date
       FROM v_latest_prices
       WHERE symbol LIKE ? OR company_name LIKE ?
       ORDER BY CASE WHEN symbol = ? THEN 0 ELSE 1 END, symbol ASC
       LIMIT 30`,
      [keyword, keyword, q]
    )
    return NextResponse.json({ results: rows })
  } catch (err) {
    console.error('[/api/stocks/search]', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}