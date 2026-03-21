/**
 * Returns the most recent trading date that has data in the DB.
 * NEPSE trades Sun–Thu. If today has data → use today.
 * If market is closed (Fri/Sat) or today's data not yet loaded → use last available date.
 */
import nepsePool from './db-nepse'
import { RowDataPacket } from 'mysql2'

// Cache for 60 seconds so every page request doesn't re-query
let cached: { date: string; ts: number } | null = null
const CACHE_TTL = 60_000

export async function getLatestTradingDate(): Promise<string> {
  const now = Date.now()
  if (cached && now - cached.ts < CACHE_TTL) return cached.date

  const [rows] = await nepsePool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(MAX(ts.trading_date), '%Y-%m-%d') AS latest_date
     FROM trading_session ts
     JOIN price_data pd ON ts.session_id = pd.session_id`
  )
  const date = String((rows as RowDataPacket[])[0]?.latest_date ?? '')
  if (date) { cached = { date, ts: now } }
  return date
}

/** Nepal time (UTC+5:45). Returns day-of-week: 0=Sun … 6=Sat */
export function nepseWeekday(): number {
  const npt = new Date(Date.now() + (5 * 60 + 45) * 60 * 1000)
  return npt.getUTCDay()
}

/** Is NEPSE currently open? Sun–Thu, 11:00–15:00 NPT */
export function isMarketOpen(): boolean {
  const npt = new Date(Date.now() + (5 * 60 + 45) * 60 * 1000)
  const day = npt.getUTCDay()
  const t = npt.getUTCHours() * 60 + npt.getUTCMinutes()
  return day >= 0 && day <= 4 && t >= 11 * 60 && t < 15 * 60
}

/** Today's date in NPT as YYYY-MM-DD */
export function todayNPT(): string {
  const npt = new Date(Date.now() + (5 * 60 + 45) * 60 * 1000)
  return npt.toISOString().split('T')[0]
}