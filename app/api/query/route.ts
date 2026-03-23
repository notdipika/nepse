/**
 * app/api/query/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Accepts filter parameters from the analytics filter builder and
 * returns matching price rows + the generated SQL string.
 */
import { NextResponse } from 'next/server'
import { getFilteredPrices, type FilterParams } from '@/lib/db'
import { todayIso, daysAgo } from '@/lib/utils'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as { filters?: Partial<FilterParams> }
    const f    = body.filters ?? {}

    const params: FilterParams = {
      symbol:      typeof f.symbol === 'string' ? f.symbol : undefined,
      sector:      typeof f.sector === 'string' ? f.sector : undefined,
      from:        typeof f.from   === 'string' ? f.from   : daysAgo(30),
      to:          typeof f.to     === 'string' ? f.to     : todayIso(),
      minVolume:   typeof f.minVolume   === 'number' ? f.minVolume   : undefined,
      minTurnover: typeof f.minTurnover === 'number' ? f.minTurnover : undefined,
      minChange:   typeof f.minChange   === 'number' ? f.minChange   : undefined,
      maxChange:   typeof f.maxChange   === 'number' ? f.maxChange   : undefined,
      sortBy:      typeof f.sortBy  === 'string' ? f.sortBy  : 'ts.trading_date',
      sortDir:     f.sortDir === 'ASC' ? 'ASC' : 'DESC',
      limit:       typeof f.limit   === 'number' ? f.limit   : 200,
    }

    const { data, sql } = await getFilteredPrices(params)
    return NextResponse.json({ data, sql, rowCount: data.length }, { status: 200 })
  } catch (err) {
    console.error('[/api/query]', err)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}