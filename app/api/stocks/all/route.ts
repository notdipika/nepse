/**
 * GET /api/stocks/all
 * Returns all active companies for the most recent trading date with data.
 */
import { NextResponse } from 'next/server'
import nepsePool from '@/lib/db-nepse'
import { RowDataPacket } from 'mysql2'

export const runtime = 'nodejs'

let cachedDate: string | null = null
let cacheTs = 0

async function getLatestDate(): Promise<string | null> {
  if (cachedDate && Date.now() - cacheTs < 60_000) return cachedDate
  const [[row]] = await nepsePool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(MAX(ts.trading_date),'%Y-%m-%d') AS d
     FROM trading_session ts JOIN price_data pd ON ts.session_id=pd.session_id`)
  cachedDate = (row as RowDataPacket).d ?? null
  cacheTs = Date.now()
  return cachedDate
}

export async function GET() {
  try {
    const latestDate = await getLatestDate()
    if (!latestDate) return NextResponse.json({ rows: [], tradingDate: null })

    const [rows] = await nepsePool.query<RowDataPacket[]>(
      `SELECT
        c.symbol,
        c.name                                                    AS company_name,
        s.name                                                    AS sector_name,
        p.close_price,
        p.open_price,
        p.high_price,
        p.low_price,
        p.prev_close,
        p.volume,
        p.turnover,
        COALESCE(
          p.percent_change,
          ROUND(((p.close_price - p.open_price) / NULLIF(p.open_price,0)) * 100, 2),
          0
        )                                                         AS change_percent,
        DATE_FORMAT(t.trading_date,'%Y-%m-%d')                    AS updated_at
      FROM company c
      LEFT JOIN sector          s ON c.sector_id  = s.sector_id
      LEFT JOIN price_data      p ON c.company_id = p.company_id
      LEFT JOIN trading_session t ON p.session_id = t.session_id
      WHERE c.is_active = 1
        AND t.trading_date = ?
      ORDER BY p.turnover DESC, c.symbol ASC
      LIMIT 500`,
      [latestDate])

    return NextResponse.json({ rows, tradingDate: latestDate })
  } catch (err) {
    console.error('[stocks/all]', err)
    return NextResponse.json({ error: 'Failed to fetch stocks' }, { status: 500 })
  }
}