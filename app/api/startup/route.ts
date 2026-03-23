/**
 * app/api/startup/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Called once per browser session by TopBar to check DB state.
 * Returns a status string that TopBar uses to show/hide a banner.
 *
 * Does NOT reference combined_excel or any Excel file.
 * Data loading is done exclusively by load_history.py.
 */
import { NextResponse } from 'next/server'
import { nepsePool } from '@/lib/db'
import { RowDataPacket } from 'mysql2'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const [[row]] = await nepsePool().query<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM price_data LIMIT 1'
    )
    const count = Number(row?.cnt ?? 0)

    if (count > 0) {
      return NextResponse.json({ status: 'already_has_data', count }, { status: 200 })
    }

    // No data — tell the user how to load it
    return NextResponse.json({
      status:  'no_loader',
      message: 'Run: python load_history.py --days 90',
    }, { status: 200 })

  } catch (err) {
    console.error('[/api/startup]', err)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}