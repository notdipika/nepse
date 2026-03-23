/**
 * app/api/watchlist/route.ts
 * ─────────────────────────────────────────────────────────────────
 * GET    → returns user's watchlist enriched with latest prices
 * POST   → adds a symbol
 * DELETE → removes a symbol
 *
 * Auth: reads session via NextAuth auth() — server-side only.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  getWatchlistSymbols,
  addWatchlistSymbol,
  removeWatchlistSymbol,
  watchlistSymbolExists,
  getEnrichedWatchlist,
} from '@/lib/db'

export const runtime = 'nodejs'

async function getUserId(): Promise<string | null> {
  const session = await auth()
  return session?.user?.id ?? null
}

// GET /api/watchlist
export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const symbols  = await getWatchlistSymbols(userId)
    const enriched = await getEnrichedWatchlist(symbols)
    return NextResponse.json(enriched, { status: 200 })
  } catch (err) {
    console.error('[GET /api/watchlist]', err)
    return NextResponse.json({ error: 'Failed to load watchlist' }, { status: 500 })
  }
}

// POST /api/watchlist  { symbol: "NABIL" }
export async function POST(req: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { symbol } = await req.json().catch(() => ({})) as { symbol?: unknown }
    if (typeof symbol !== 'string' || !symbol.trim()) {
      return NextResponse.json({ error: 'Symbol required' }, { status: 400 })
    }
    const sym = symbol.trim().toUpperCase()

    const exists = await watchlistSymbolExists(userId, sym)
    if (exists) return NextResponse.json({ error: 'Already in watchlist' }, { status: 409 })

    await addWatchlistSymbol(userId, sym)
    return NextResponse.json({ success: true, symbol: sym }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/watchlist]', err)
    return NextResponse.json({ error: 'Failed to add to watchlist' }, { status: 500 })
  }
}

// DELETE /api/watchlist  { symbol: "NABIL" }
export async function DELETE(req: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { symbol } = await req.json().catch(() => ({})) as { symbol?: unknown }
    if (typeof symbol !== 'string' || !symbol.trim()) {
      return NextResponse.json({ error: 'Symbol required' }, { status: 400 })
    }
    await removeWatchlistSymbol(userId, symbol.trim().toUpperCase())
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('[DELETE /api/watchlist]', err)
    return NextResponse.json({ error: 'Failed to remove from watchlist' }, { status: 500 })
  }
}