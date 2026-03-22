import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import nepsePool from '@/lib/db-nepse'
import { RowDataPacket } from 'mysql2'
import Link from 'next/link'

export const runtime = 'nodejs'

async function search(q: string) {
  if (!q) return []
  const [rows] = await nepsePool.query<RowDataPacket[]>(
    `SELECT c.symbol, c.name, s.name AS sector,
        p.close_price, p.percent_change, p.volume, t.trading_date
     FROM company c
     JOIN sector s ON c.sector_id = s.sector_id
     LEFT JOIN price_data p ON c.company_id = p.company_id
     LEFT JOIN trading_session t ON p.session_id = t.session_id
       AND t.trading_date = (
         SELECT MAX(ts2.trading_date) FROM price_data p2
         JOIN trading_session ts2 ON p2.session_id = ts2.session_id
         WHERE p2.company_id = c.company_id
       )
     WHERE (c.symbol LIKE ? OR c.name LIKE ?) AND c.is_active = 1
     ORDER BY c.symbol LIMIT 30`,
    [`${q}%`, `%${q}%`])
  return rows
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const params = await searchParams
  const q = (params.q ?? '').toUpperCase().trim()
  const results = await search(q)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#0f172a' }}>
          {q ? `Results for "${q}"` : 'Search Companies'}
        </h1>
        {q && <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>{results.length} result{results.length !== 1 ? 's' : ''} found</p>}
      </div>

      <form method="get" className="flex gap-3">
        <input name="q" defaultValue={q} placeholder="Search by symbol or company name…" autoFocus
          className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
          style={{ border: '1px solid #e2e8f0', color: '#0f172a', background: 'white' }}/>
        <button type="submit" className="px-5 py-2.5 rounded-lg text-sm font-medium text-white"
          style={{ background: '#2563eb', border: 'none', cursor: 'pointer' }}>
          Search
        </button>
      </form>

      {results.length === 0 && q && (
        <div className="bg-white rounded-xl border p-8 text-center" style={{ borderColor: '#e2e8f0' }}>
          <p className="text-sm" style={{ color: '#94a3b8' }}>No companies found for <span style={{ color: '#0f172a' }}>&quot;{q}&quot;</span></p>
        </div>
      )}

      {results.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs font-medium" style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#64748b' }}>
                <th className="text-left px-5 py-3">Symbol</th>
                <th className="text-left px-4 py-3">Company</th>
                <th className="text-left px-4 py-3">Sector</th>
                <th className="text-right px-4 py-3">Close</th>
                <th className="text-right px-5 py-3">Change</th>
                <th className="text-right px-5 py-3">Volume</th>
              </tr>
            </thead>
            <tbody>
              {(results as any[]).map(r => {
                const up = Number(r.percent_change ?? 0) >= 0
                return (
                  <tr key={`${r.symbol}-${r.trading_date}`} className="border-b transition-colors"
                    style={{ borderColor: '#f8fafc' }}
                    onMouseOver={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                    onMouseOut={e  => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/stock/${r.symbol}`}
                        style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
                        {r.symbol}
                      </Link>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate" style={{ color: '#475569' }}>{r.name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                        {String(r.sector ?? '').split(' ').slice(0, 2).join(' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: '#0f172a', fontFamily: 'monospace' }}>
                      {r.close_price ? `Rs.${Number(r.close_price).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {r.percent_change != null
                        ? <span className="text-xs font-semibold" style={{ color: up ? '#16a34a' : '#dc2626' }}>
                            {up ? '+' : ''}{Number(r.percent_change).toFixed(2)}%
                          </span>
                        : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
                    </td>
                    <td className="px-5 py-3 text-right" style={{ color: '#64748b', fontFamily: 'monospace' }}>
                      {r.volume ? Number(r.volume).toLocaleString() : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}