/**
 * lib/utils.ts
 * ─────────────────────────────────────────────────────────────────
 * Shared pure helpers used by BOTH server-side API routes AND
 * client-side pages. No imports from Next.js or React here.
 *
 * Pages and routes should import from here instead of re-defining
 * toNum / isoDate / formatters inline.
 */

// ── Numeric helpers ────────────────────────────────────────────────

/** Safely coerce any value to a finite number; returns 0 on failure. */
export const toNum = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Format a number to 2 decimal places as string. */
export const f2 = (v: unknown): string => toNum(v).toFixed(2)

// ── Date helpers ───────────────────────────────────────────────────

/** Date object → "YYYY-MM-DD" string (local timezone). */
export const isoDate = (d: Date): string => d.toISOString().split('T')[0]

/** N days ago as "YYYY-MM-DD". */
export const daysAgo = (n: number): string => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return isoDate(d)
}

/** Today as "YYYY-MM-DD". */
export const todayIso = (): string => isoDate(new Date())

/** "YYYY-MM-DD" → localized short date string. */
export function fmtDate(d: string, locale = 'en-NP'): string {
  try {
    return new Date(d).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  } catch {
    return d
  }
}

// ── Money helpers ──────────────────────────────────────────────────

/**
 * Format a rupee value.
 * Returns "Rs. 1,234.56" or "—" for null/undefined.
 */
export function rsFormat(v: unknown, locale = 'en-NP'): string {
  if (v == null) return '—'
  const n = toNum(v)
  if (!Number.isFinite(n)) return '—'
  return `Rs. ${n.toLocaleString(locale, { maximumFractionDigits: 2 })}`
}

/** Compact crore formatting: Rs.12.34Cr */
export const toCrore = (v: number): string => `Rs.${(v / 1e7).toFixed(2)}Cr`

/** Volume shorthand: 1.2M / 456K / 789 */
export function fmtVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

// ── Normalisation ──────────────────────────────────────────────────

/**
 * Normalise a raw API/DB row into the shape every page expects.
 * Works for rows from v_latest_prices and /api/stocks/all.
 */
export interface NormalisedStock {
  symbol:         string
  company_name:   string
  sector_name:    string
  close_price:    number | null
  change_percent: number | null
  open_price:     number | null
  high_price:     number | null
  low_price:      number | null
  prev_close:     number | null
  turnover:       number | null
  volume:         number | null
  trading_date:   string | null
  updated_at:     string | null
}

export function normaliseStockRow(r: Record<string, unknown>): NormalisedStock {
  const num = (k: string): number | null =>
    r[k] == null ? null : toNum(r[k])
  const str = (k: string, fallback = ''): string =>
    String(r[k] ?? fallback)

  return {
    symbol:         str('symbol').toUpperCase(),
    company_name:   str('company_name', str('name')),
    sector_name:    str('sector_name', str('sector', 'Others')),
    close_price:    num('close_price'),
    change_percent:
      r['change_percent'] != null ? toNum(r['change_percent'])
      : r['percent_change'] != null ? toNum(r['percent_change'])
      : null,
    open_price:     num('open_price'),
    high_price:     num('high_price'),
    low_price:      num('low_price'),
    prev_close:     num('prev_close'),
    turnover:       num('turnover'),
    volume:         num('volume'),
    trading_date:   r['trading_date'] != null ? str('trading_date') : null,
    updated_at:     r['updated_at']   != null ? str('updated_at')   : null,
  }
}