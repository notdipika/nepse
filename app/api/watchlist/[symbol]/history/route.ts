/**
 * app/api/watchlist/[symbol]/history/route.ts
 * ─────────────────────────────────────────────────────────────────
 * GET /api/watchlist/NABIL/history?fromDate=2026-01-01&toDate=2026-03-23
 *
 * Returns OHLCV history for a symbol within a date range.
 * Used by the watchlist expanded chart panel.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getPriceHistory } from '@/lib/db'
import { daysAgo, todayIso } from '@/lib/utils'

export const runtime = 'nodejs'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { symbol } = await params
  const url        = new URL(req.url)
  const fromDate   = url.searchParams.get('fromDate') ?? daysAgo(30)
  const toDate     = url.searchParams.get('toDate')   ?? todayIso()

  try {
    const data = await getPriceHistory(symbol, fromDate, toDate, 365)
    return NextResponse.json({ data, symbol: symbol.toUpperCase() }, { status: 200 })
  } catch (err) {
    console.error(`[/api/watchlist/${symbol}/history]`, err)
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 })
  }
}