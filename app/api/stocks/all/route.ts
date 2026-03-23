/**
 * app/api/stocks/all/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Returns every active company's latest OHLCV snapshot.
 * Consumed by: dashboard page, portfolio page, analytics page.
 *
 * Shape: { tradingDate: string, rows: NormalisedStock[] }
 */
import { NextResponse } from 'next/server'
import { getAllLatestPrices } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const rows = await getAllLatestPrices()

    // Derive the single trading date (all rows share the same latest date)
    const tradingDate = rows[0]?.trading_date ?? ''

    return NextResponse.json({ tradingDate, rows }, { status: 200 })
  } catch (err) {
    console.error('[/api/stocks/all]', err)
    return NextResponse.json({ error: 'Failed to load stocks' }, { status: 500 })
  }
}