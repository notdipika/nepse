/**
 * POST /api/query
 * Parameterised query builder — returns { data, sql } where sql is
 * the exact statement sent to MySQL (with values substituted for display).
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import nepsePool from '@/lib/db-nepse'
import { RowDataPacket } from 'mysql2'

export const runtime = 'nodejs'

export interface QueryFilters {
  symbol?:      string
  sector?:      string
  from?:        string
  to?:          string
  minVolume?:   number
  minTurnover?: number
  minChange?:   number
  maxChange?:   number
  sortBy?:      string
  sortDir?:     'ASC' | 'DESC'
  limit?:       number
}

const ALLOWED_SORT = new Set([
  'ts.trading_date', 'pd.close_price', 'pd.open_price', 'pd.high_price',
  'pd.low_price', 'pd.volume', 'pd.turnover', 'pd.percent_change', 'c.symbol',
])

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { filters = {} }: { filters: QueryFilters } = await req.json()

  const {
    symbol, sector, from, to,
    minVolume, minTurnover, minChange, maxChange,
    sortBy   = 'ts.trading_date',
    sortDir  = 'DESC',
    limit    = 200,
  } = filters

  const safeSort  = ALLOWED_SORT.has(sortBy) ? sortBy : 'ts.trading_date'
  const safeDir   = sortDir === 'ASC' ? 'ASC' : 'DESC'
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000)

  const conditions: string[] = []
  const params: (string | number)[] = []

  if (symbol && symbol !== 'all') {
    conditions.push('c.symbol = ?')
    params.push(symbol.toUpperCase().trim())
  }
  if (sector && sector !== 'all') {
    conditions.push('s.name = ?')
    params.push(sector)
  }
  if (from)        { conditions.push('ts.trading_date >= ?');  params.push(from) }
  if (to)          { conditions.push('ts.trading_date <= ?');  params.push(to) }
  if (minVolume   && minVolume > 0)   { conditions.push('pd.volume >= ?');         params.push(minVolume) }
  if (minTurnover && minTurnover > 0) { conditions.push('pd.turnover >= ?');       params.push(minTurnover) }
  if (minChange   != null)            { conditions.push('pd.percent_change >= ?'); params.push(minChange) }
  if (maxChange   != null)            { conditions.push('pd.percent_change <= ?'); params.push(maxChange) }

  const where = conditions.length ? `WHERE ${conditions.join('\n  AND ')}` : ''

  const sql = `SELECT
  c.symbol,
  c.name,
  s.name          AS sector,
  ts.trading_date AS date,
  pd.open_price,
  pd.high_price,
  pd.low_price,
  pd.close_price,
  pd.prev_close,
  pd.volume,
  pd.turnover,
  pd.percent_change
FROM price_data pd
JOIN company         c  ON pd.company_id = c.company_id
JOIN trading_session ts ON pd.session_id = ts.session_id
JOIN sector          s  ON c.sector_id   = s.sector_id
${where}
ORDER BY ${safeSort} ${safeDir}
LIMIT ${safeLimit}`

  // Build display SQL with real values substituted
  let displaySql = sql
  let tmpParams  = [...params]
  displaySql = displaySql.replace(/\?/g, () => {
    const v = tmpParams.shift()
    return typeof v === 'string' ? `'${v}'` : String(v)
  })

  try {
    const [rows] = await nepsePool.query<RowDataPacket[]>(sql, params)
    return NextResponse.json({ data: rows, sql: displaySql, count: rows.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, sql: displaySql }, { status: 500 })
  }
}
