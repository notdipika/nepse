/**
 * lib/db.ts
 * ─────────────────────────────────────────────────────────────────
 * Single module for ALL database access in this project.
 *
 * Two pools:
 *   authPool  → nepse_auth   (users, watchlist symbols)
 *   nepsePool → nepse_db     (company, price_data, trading_session, …)
 *
 * Rules:
 *  • Both pools are lazy singletons — created on first access.
 *  • Auth schema (users + watchlist) is created once per process via
 *    a module-level Promise; no per-request CREATE TABLE IF NOT EXISTS.
 *  • Every query is typed — no `any`.
 *  • nepse_db queries always target the views / tables that
 *    load_history.py actually populates:
 *      company, trading_session, price_data, data_source, sector
 *    and the views defined in setup_databases.sql:
 *      v_latest_prices, v_52week_range, v_top_gainers, v_top_losers,
 *      v_sector_summary, daily_market_summary
 */

import {
  createPool,
  type Pool,
  type RowDataPacket,
  type ResultSetHeader,
} from 'mysql2/promise'
import bcrypt from 'bcryptjs'

// ─── Shared env-config helper ──────────────────────────────────────
function cfg(primary: string, fallback: string, def: string): string {
  return process.env[primary] ?? process.env[fallback] ?? def
}
function cfgNum(primary: string, fallback: string, def: number): number {
  return Number(process.env[primary] ?? process.env[fallback] ?? def)
}

// ══════════════════════════════════════════════════════════════════
//  AUTH POOL  (nepse_auth database)
// ══════════════════════════════════════════════════════════════════

let _authPool: Pool | null = null

export function authPool(): Pool {
  if (_authPool) return _authPool
  _authPool = createPool({
    host:               cfg('AUTH_DB_HOST',     'DB_HOST',     'localhost'),
    port:               cfgNum('AUTH_DB_PORT',  'DB_PORT',     3306),
    user:               cfg('AUTH_DB_USER',     'DB_USER',     'root'),
    password:           cfg('AUTH_DB_PASSWORD', 'DB_PASSWORD', ''),
    database:           cfg('AUTH_DB_NAME',     'DB_AUTH_NAME','nepse_auth'),
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
  })
  return _authPool
}

// Schema init — runs exactly once per process
let _authInitPromise: Promise<void> | null = null

async function _initAuthSchema(): Promise<void> {
  const pool = authPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      name          VARCHAR(100)  NULL,
      email         VARCHAR(255)  NOT NULL UNIQUE,
      password_hash VARCHAR(255)  NOT NULL,
      created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS watchlist (
      id       INT AUTO_INCREMENT PRIMARY KEY,
      user_id  INT         NOT NULL,
      symbol   VARCHAR(20) NOT NULL,
      added_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_symbol (user_id, symbol),
      CONSTRAINT fk_wl_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

function ensureAuthSchema(): Promise<void> {
  if (!_authInitPromise) _authInitPromise = _initAuthSchema()
  return _authInitPromise
}

// ── Auth-DB row types ──────────────────────────────────────────────
export interface AuthUser extends RowDataPacket {
  id:            number
  name:          string | null
  email:         string
  password_hash: string
}

export interface WatchlistSymbolRow extends RowDataPacket {
  symbol:   string
  added_at: string
}

// ── Auth-DB functions ──────────────────────────────────────────────
export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  await ensureAuthSchema()
  const [rows] = await authPool().query<AuthUser[]>(
    'SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1',
    [email]
  )
  return rows[0] ?? null
}

export async function createUser(input: {
  name?: string
  email: string
  password: string
}): Promise<{ id: string; name: string | null; email: string }> {
  await ensureAuthSchema()

  const existing = await findUserByEmail(input.email)
  if (existing) throw new Error('EMAIL_EXISTS')

  const hash = await bcrypt.hash(input.password, 10)
  const [result] = await authPool().query<ResultSetHeader>(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
    [input.name ?? null, input.email, hash]
  )
  if (!result.insertId) throw new Error('USER_CREATE_FAILED')

  return { id: String(result.insertId), name: input.name ?? null, email: input.email }
}

export async function verifyUserPassword(
  email: string,
  password: string
): Promise<{ id: string; name: string | null; email: string } | null> {
  const user = await findUserByEmail(email)
  if (!user) return null
  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) return null
  return { id: String(user.id), name: user.name, email: user.email }
}

export async function getWatchlistSymbols(userId: string): Promise<WatchlistSymbolRow[]> {
  await ensureAuthSchema()
  const [rows] = await authPool().query<WatchlistSymbolRow[]>(
    `SELECT symbol,
            DATE_FORMAT(added_at,'%Y-%m-%d %H:%i:%s') AS added_at
     FROM watchlist WHERE user_id = ? ORDER BY added_at DESC`,
    [userId]
  )
  return rows
}

export async function addWatchlistSymbol(userId: string, symbol: string): Promise<void> {
  await ensureAuthSchema()
  await authPool().query(
    'INSERT IGNORE INTO watchlist (user_id, symbol) VALUES (?, ?)',
    [userId, symbol.toUpperCase()]
  )
}

export async function removeWatchlistSymbol(userId: string, symbol: string): Promise<void> {
  await ensureAuthSchema()
  await authPool().query(
    'DELETE FROM watchlist WHERE user_id = ? AND symbol = ?',
    [userId, symbol.toUpperCase()]
  )
}

export async function watchlistSymbolExists(userId: string, symbol: string): Promise<boolean> {
  await ensureAuthSchema()
  const [rows] = await authPool().query<RowDataPacket[]>(
    'SELECT 1 FROM watchlist WHERE user_id = ? AND symbol = ? LIMIT 1',
    [userId, symbol.toUpperCase()]
  )
  return (rows as RowDataPacket[]).length > 0
}

// ══════════════════════════════════════════════════════════════════
//  NEPSE POOL  (nepse_db database)
// ══════════════════════════════════════════════════════════════════

let _nepsePool: Pool | null = null

export function nepsePool(): Pool {
  if (_nepsePool) return _nepsePool
  _nepsePool = createPool({
    host:               cfg('NEPSE_DB_HOST',     'DB_HOST',      'localhost'),
    port:               cfgNum('NEPSE_DB_PORT',  'DB_PORT',      3306),
    user:               cfg('NEPSE_DB_USER',     'DB_USER',      'root'),
    password:           cfg('NEPSE_DB_PASSWORD', 'DB_PASSWORD',  ''),
    database:           cfg('NEPSE_DB_NAME',     'DB_NEPSE_NAME','nepse_db'),
    waitForConnections: true,
    connectionLimit:    20,
    queueLimit:         0,
    decimalNumbers:     true,   // return DECIMAL as JS number, not string
  })
  return _nepsePool
}

// ── nepse_db row types ─────────────────────────────────────────────

/** One row from v_latest_prices */
export interface LatestPriceRow extends RowDataPacket {
  company_id:     number
  symbol:         string
  company_name:   string
  sector:         string
  sector_name:    string   // alias used by some pages
  open_price:     number
  high_price:     number
  low_price:      number
  close_price:    number
  volume:         number
  turnover:       number | null
  prev_close:     number | null
  percent_change: number | null
  change_percent: number | null  // alias used by some pages
  trading_date:   string
  updated_at:     string | null  // alias used by portfolio page
}

/** One row from price_data joined with trading_session */
export interface PriceHistoryRow extends RowDataPacket {
  trading_date:   string
  open_price:     number
  high_price:     number
  low_price:      number
  close_price:    number
  volume:         number
  turnover:       number | null
  prev_close:     number | null
  percent_change: number | null
}

/** One row from company joined with sector */
export interface CompanyRow extends RowDataPacket {
  company_id:  number
  symbol:      string
  name:        string
  sector_id:   number
  sector_name: string
  is_active:   number
}

/** One row from sector */
export interface SectorRow extends RowDataPacket {
  sector_id:   number
  name:        string
  description: string | null
}

// ── nepse_db query functions ───────────────────────────────────────

/**
 * All latest prices — used by dashboard, portfolio, analytics.
 * Returns v_latest_prices with aliases matching every page's expectations.
 */
export async function getAllLatestPrices(): Promise<LatestPriceRow[]> {
  const [rows] = await nepsePool().query<LatestPriceRow[]>(`
    SELECT
      company_id,
      symbol,
      company_name,
      sector                        AS sector,
      sector                        AS sector_name,
      open_price,
      high_price,
      low_price,
      close_price,
      volume,
      turnover,
      prev_close,
      percent_change,
      percent_change                AS change_percent,
      DATE_FORMAT(trading_date,'%Y-%m-%d') AS trading_date,
      DATE_FORMAT(trading_date,'%Y-%m-%d') AS updated_at
    FROM v_latest_prices
    ORDER BY symbol
  `)
  return rows
}

/**
 * All active sectors.
 */
export async function getAllSectors(): Promise<SectorRow[]> {
  const [rows] = await nepsePool().query<SectorRow[]>(
    `SELECT sector_id, name, description
     FROM sector
     WHERE sector_id IN (
       SELECT DISTINCT sector_id FROM company WHERE is_active = 1
     )
     ORDER BY name`
  )
  return rows
}

/**
 * Single company detail + latest price.
 * Used by stock/[symbol] page.
 */
export async function getCompanyWithLatestPrice(symbol: string): Promise<{
  company: CompanyRow
  latest: PriceHistoryRow | null
  range52: { high52: number | null; low52: number | null } | null
} | null> {
  const [[company]] = await nepsePool().query<CompanyRow[]>(
    `SELECT c.company_id, c.symbol, c.name, c.sector_id,
            s.name AS sector_name, c.is_active
     FROM company c
     JOIN sector s ON c.sector_id = s.sector_id
     WHERE c.symbol = ? AND c.is_active = 1
     LIMIT 1`,
    [symbol.toUpperCase()]
  )
  if (!company) return null

  const id = company.company_id

  const [latestRows, range52Rows] = await Promise.all([
    nepsePool().query<PriceHistoryRow[]>(
      `SELECT
         DATE_FORMAT(t.trading_date,'%Y-%m-%d') AS trading_date,
         p.open_price, p.high_price, p.low_price, p.close_price,
         p.volume, p.turnover, p.prev_close, p.percent_change
       FROM price_data p
       JOIN trading_session t ON p.session_id = t.session_id
       WHERE p.company_id = ?
       ORDER BY t.trading_date DESC
       LIMIT 1`,
      [id]
    ),
    nepsePool().query<RowDataPacket[]>(
      `SELECT MAX(p.high_price) AS high52, MIN(p.low_price) AS low52
       FROM price_data p
       JOIN trading_session t ON p.session_id = t.session_id
       WHERE p.company_id = ?
         AND t.trading_date >= DATE_SUB(CURDATE(), INTERVAL 52 WEEK)`,
      [id]
    ),
  ])

  const latest  = (latestRows[0] as PriceHistoryRow[])[0] ?? null
  const r52     = (range52Rows[0] as RowDataPacket[])[0] ?? null

  return {
    company,
    latest,
    range52: r52
      ? { high52: Number(r52.high52) || null, low52: Number(r52.low52) || null }
      : null,
  }
}

/**
 * Price history for a company — used by stock page chart and watchlist history.
 */
export async function getPriceHistory(
  symbol: string,
  fromDate: string,
  toDate: string,
  limit = 365
): Promise<PriceHistoryRow[]> {
  const [rows] = await nepsePool().query<PriceHistoryRow[]>(
    `SELECT
       DATE_FORMAT(t.trading_date,'%Y-%m-%d') AS trading_date,
       p.open_price, p.high_price, p.low_price, p.close_price,
       p.volume, p.turnover, p.prev_close, p.percent_change
     FROM price_data p
     JOIN trading_session t ON p.session_id = t.session_id
     JOIN company c         ON p.company_id = c.company_id
     WHERE c.symbol = ?
       AND t.trading_date BETWEEN ? AND ?
     ORDER BY t.trading_date ASC
     LIMIT ?`,
    [symbol.toUpperCase(), fromDate, toDate, limit]
  )
  return rows
}

/**
 * Filtered price query — used by analytics filter builder.
 * Returns rows + the generated SQL string for display.
 */
export interface FilteredQueryRow extends RowDataPacket {
  symbol:         string
  name:           string
  sector:         string
  date:           string
  open_price:     number
  high_price:     number
  low_price:      number
  close_price:    number
  volume:         number
  turnover:       number | null
  percent_change: number | null
}

export interface FilterParams {
  symbol?:      string
  sector?:      string
  from:         string
  to:           string
  minVolume?:   number
  minTurnover?: number
  minChange?:   number
  maxChange?:   number
  sortBy:       string
  sortDir:      'ASC' | 'DESC'
  limit:        number
}

// Allowlist for sortBy to prevent SQL injection
const SORT_ALLOWLIST = new Set([
  'ts.trading_date', 'pd.close_price', 'pd.volume',
  'pd.turnover', 'pd.percent_change', 'c.symbol',
])

export async function getFilteredPrices(f: FilterParams): Promise<{
  data: FilteredQueryRow[]
  sql: string
}> {
  const sortBy  = SORT_ALLOWLIST.has(f.sortBy) ? f.sortBy : 'ts.trading_date'
  const sortDir = f.sortDir === 'ASC' ? 'ASC' : 'DESC'
  const limit   = Math.min(Math.max(1, f.limit), 1000)

  const conditions: string[] = [
    'ts.trading_date BETWEEN ? AND ?',
    'c.is_active = 1',
  ]
  const params: unknown[] = [f.from, f.to]

  if (f.symbol) { conditions.push('c.symbol = ?');               params.push(f.symbol.toUpperCase()) }
  if (f.sector) { conditions.push('s.name = ?');                 params.push(f.sector) }
  if (f.minVolume   != null) { conditions.push('pd.volume >= ?');          params.push(f.minVolume) }
  if (f.minTurnover != null) { conditions.push('pd.turnover >= ?');        params.push(f.minTurnover) }
  if (f.minChange   != null) { conditions.push('pd.percent_change >= ?');  params.push(f.minChange) }
  if (f.maxChange   != null) { conditions.push('pd.percent_change <= ?');  params.push(f.maxChange) }

  const where = conditions.join('\n     AND ')
  const sql = `SELECT
     c.symbol,
     c.name,
     s.name                                         AS sector,
     DATE_FORMAT(ts.trading_date,'%Y-%m-%d')        AS date,
     pd.open_price, pd.high_price, pd.low_price,
     pd.close_price, pd.volume, pd.turnover,
     pd.percent_change
   FROM price_data pd
   JOIN company         c  ON pd.company_id = c.company_id
   JOIN sector          s  ON c.sector_id   = s.sector_id
   JOIN trading_session ts ON pd.session_id = ts.session_id
   WHERE ${where}
   ORDER BY ${sortBy} ${sortDir}
   LIMIT ${limit}`

  const [data] = await nepsePool().query<FilteredQueryRow[]>(sql, params)
  return { data, sql }
}

/**
 * Safe SQL explorer — only allows SELECT / SHOW / CALL.
 */
export interface ExplorerResult {
  columns:  string[]
  rows:     unknown[][]
  rowCount: number
  error?:   string
}

export async function runExplorerQuery(rawSql: string): Promise<ExplorerResult> {
  const trimmed = rawSql.trim()
  const first   = trimmed.split(/\s+/)[0].toUpperCase()
  if (!['SELECT', 'SHOW', 'CALL', 'EXPLAIN'].includes(first)) {
    return { columns: [], rows: [], rowCount: 0, error: 'Only SELECT, SHOW, CALL, EXPLAIN are allowed.' }
  }
  try {
    const [results, fields] = await nepsePool().query(trimmed)
    const rows = Array.isArray(results) ? (results as RowDataPacket[]) : []
    const columns = (fields as { name: string }[] | undefined)?.map(f => f.name) ?? []
    const data = rows.map(r => columns.map(c => (r as Record<string, unknown>)[c] ?? null))
    return { columns, rows: data, rowCount: data.length }
  } catch (err: unknown) {
    return {
      columns: [], rows: [], rowCount: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Watchlist items enriched with latest price from nepse_db.
 * Joins auth watchlist symbols with v_latest_prices.
 */
export interface WatchlistEnrichedRow {
  watchlist_id:   number
  symbol:         string
  name:           string
  sector:         string | undefined
  close_price:    number | undefined
  percent_change: number | undefined
  trading_date:   string | undefined
}

export async function getEnrichedWatchlist(
  symbols: WatchlistSymbolRow[]
): Promise<WatchlistEnrichedRow[]> {
  if (symbols.length === 0) return []

  const syms = symbols.map(s => s.symbol.toUpperCase())
  const placeholders = syms.map(() => '?').join(',')

  const [priceRows] = await nepsePool().query<LatestPriceRow[]>(
    `SELECT symbol, company_name, sector, close_price, percent_change, trading_date
     FROM v_latest_prices
     WHERE symbol IN (${placeholders})`,
    syms
  )

  const priceMap = new Map(priceRows.map(r => [r.symbol, r]))

  return symbols.map((s, i) => {
    const p = priceMap.get(s.symbol)
    return {
      watchlist_id:   i + 1,
      symbol:         s.symbol,
      name:           p?.company_name ?? s.symbol,
      sector:         p?.sector ?? undefined,
      close_price:    p?.close_price ?? undefined,
      percent_change: p?.percent_change ?? undefined,
      trading_date:   p?.trading_date ?? undefined,
    }
  })
}

// Re-export pool instances for raw queries in API routes
export const nepse = nepsePool
export const auth  = authPool