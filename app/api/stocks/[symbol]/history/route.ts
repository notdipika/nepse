import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getPriceHistory } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { symbol } = await params
  const from = req.nextUrl.searchParams.get('from') ?? '2020-01-01'
  const to   = req.nextUrl.searchParams.get('to')   ?? new Date().toISOString().split('T')[0]

  try {
    const rows = await getPriceHistory(symbol, from, to, 1000)
    const history = rows.map(r => ({
      date:   r.trading_date,
      open:   Number(r.open_price  ?? 0),
      high:   Number(r.high_price  ?? 0),
      low:    Number(r.low_price   ?? 0),
      close:  Number(r.close_price ?? 0),
      volume: Number(r.volume      ?? 0),
    }))
    return NextResponse.json({ history })
  } catch (err) {
    console.error(`[/api/stocks/${symbol}/history]`, err)
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 })
  }
}