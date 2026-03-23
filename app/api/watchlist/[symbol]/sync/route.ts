import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getPriceHistory } from '@/lib/db'
import { todayIso, daysAgo } from '@/lib/utils'

export const runtime = 'nodejs'

/**
 * GET /api/watchlist/[symbol]/sync
 * Returns the latest 30 days of price history for a watchlist symbol.
 * Used to keep watchlist charts fresh without a full page reload.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { symbol } = await params

  try {
    const rows = await getPriceHistory(symbol, daysAgo(30), todayIso(), 30)
    return NextResponse.json({ symbol: symbol.toUpperCase(), data: rows })
  } catch (err) {
    console.error(`[/api/watchlist/${symbol}/sync]`, err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}