import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { nepsePool } from '@/lib/db'
import { RowDataPacket } from 'mysql2'
import SearchResults from './SearchResults'

export const runtime = 'nodejs'

interface SearchRow {
  symbol:         string
  name:           string
  sector:         string
  close_price:    number | null
  percent_change: number | null
  volume:         number | null
  trading_date:   string | null
}

/**
 * FIX: Original searched only v_latest_prices, so companies with no
 * price data loaded yet were invisible.
 * Now queries company + sector directly, LEFT JOINs latest price.
 * Every active company appears in results regardless of price data.
 */
async function search(q: string): Promise<SearchRow[]> {
  if (!q) return []
  const keyword = `%${q}%`
  const [rows] = await nepsePool().query<RowDataPacket[]>(
    `SELECT
       c.symbol,
       c.name,
       s.name                                         AS sector,
       p.close_price,
       p.percent_change,
       p.volume,
       DATE_FORMAT(t.trading_date, '%Y-%m-%d')        AS trading_date
     FROM company c
     JOIN sector s ON c.sector_id = s.sector_id
     -- Derive latest session per company in one pass (no correlated subquery)
     LEFT JOIN (
       SELECT company_id, MAX(session_id) AS latest_sid
       FROM price_data
       GROUP BY company_id
     ) lp ON lp.company_id = c.company_id
     LEFT JOIN price_data     p ON p.company_id = c.company_id
                                AND p.session_id = lp.latest_sid
     LEFT JOIN trading_session t ON t.session_id = lp.latest_sid
     WHERE c.is_active = 1
       AND (c.symbol LIKE ? OR c.name LIKE ?)
     ORDER BY
       CASE WHEN c.symbol = ? THEN 0 ELSE 1 END,
       c.symbol ASC
     LIMIT 30`,
    [keyword, keyword, q]
  )
  return rows as SearchRow[]
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const params  = await searchParams
  const q       = (params.q ?? '').trim().toUpperCase()
  const results = q ? await search(q) : []

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#1e1b4b' }}>
          {q ? `Results for "${q}"` : 'Search Companies'}
        </h1>
        {q && (
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </p>
        )}
      </div>

      <form method="get" style={{ display: 'flex', gap: 10 }}>
        <input name="q" defaultValue={q}
          placeholder="Search by symbol or company name…"
          autoFocus autoComplete="off"
          style={{ flex:1, padding:'10px 14px', borderRadius:8, fontSize:14,
            border:'1px solid #e2e8f0', color:'#0f172a', background:'white', outline:'none' }}/>
        <button type="submit"
          style={{ padding:'10px 20px', borderRadius:8, fontSize:14, fontWeight:600,
            color:'white', background:'#4338ca', border:'none', cursor:'pointer' }}>
          Search
        </button>
      </form>

      {q && results.length === 0 && (
        <div className="bg-white rounded-xl border p-8 text-center" style={{ borderColor:'#e2e8f0' }}>
          <p className="text-sm" style={{ color:'#94a3b8' }}>
            No companies found for <span style={{ color:'#0f172a', fontWeight:600 }}>"{q}"</span>
          </p>
        </div>
      )}

      {results.length > 0 && <SearchResults results={results} />}

      {!q && (
        <div className="bg-white rounded-xl border p-10 text-center" style={{ borderColor:'#e2e8f0' }}>
          <svg className="w-10 h-10 mx-auto mb-4" style={{ color:'#c7d2fe' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <p className="text-sm" style={{ color:'#94a3b8' }}>Type a symbol or company name above to search</p>
        </div>
      )}
    </div>
  )
}