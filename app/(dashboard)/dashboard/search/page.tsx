import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import nepsePool from '@/lib/db-nepse'
import { RowDataPacket } from 'mysql2'
import Link from 'next/link'

export const runtime = 'nodejs'

async function search(q: string) {
  if (!q) return []
  const [rows] = await nepsePool.query<RowDataPacket[]>(
    `SELECT c.symbol, c.name, s.name AS sector, p.close_price, p.percent_change, p.volume, t.trading_date
     FROM company c
     JOIN sector s ON c.sector_id=s.sector_id
     LEFT JOIN price_data p ON c.company_id=p.company_id
     LEFT JOIN trading_session t ON p.session_id=t.session_id
       AND t.trading_date=(SELECT MAX(ts2.trading_date) FROM price_data p2 JOIN trading_session ts2 ON p2.session_id=ts2.session_id WHERE p2.company_id=c.company_id)
     WHERE (c.symbol LIKE ? OR c.name LIKE ?) AND c.is_active=1
     ORDER BY c.symbol LIMIT 30`,
    [`${q}%`, `%${q}%`])
  return rows
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{q?:string}> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const p = await searchParams
  const q = (p.q??'').toUpperCase().trim()
  const results = await search(q)

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">{q ? `Results for "${q}"` : 'Search Companies'}</h1>
        {q && <p className="text-sm text-[#475569] mt-0.5">{results.length} result{results.length!==1?'s':''} found</p>}
      </div>

      {/* Search box */}
      <form method="get" className="flex gap-3">
        <input name="q" defaultValue={q} placeholder="Search by symbol or company name..."
          className="flex-1 px-4 py-2.5 rounded-lg text-sm text-white placeholder-[#475569] outline-none"
          style={{background:'var(--card)',border:'1px solid var(--border2)'}}
          autoFocus/>
        <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm font-medium transition-colors">
          Search
        </button>
      </form>

      {results.length===0 && q && (
        <div className="card p-8 text-center text-sm text-[#475569]">
          No companies found for <span className="text-white">&quot;{q}&quot;</span>
        </div>
      )}

      {results.length>0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-[#475569]" style={{background:'var(--surface)',borderColor:'var(--border)'}}>
                {['Symbol','Company','Sector','Close','Change','Volume'].map(h=>(
                  <th key={h} className="text-left px-5 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(results as any[]).map(r=>{
                const up = Number(r.percent_change??0)>=0
                return (
                  <tr key={r.symbol} className="border-b hover:bg-white/2 transition-colors" style={{borderColor:'rgba(30,45,71,0.5)'}}>
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/stock/${r.symbol}`} className="font-bold text-[#3b82f6] hover:text-[#60a5fa]">{r.symbol}</Link>
                    </td>
                    <td className="px-5 py-3 text-[#94a3b8] max-w-[200px] truncate">{r.name}</td>
                    <td className="px-5 py-3"><span className="badge-blue text-xs px-2 py-0.5 rounded-full">{String(r.sector||'').split(' ').slice(0,2).join(' ')}</span></td>
                    <td className="px-5 py-3 font-semibold text-white mono">{r.close_price?`Rs.${Number(r.close_price).toLocaleString()}`:'—'}</td>
                    <td className="px-5 py-3">
                      {r.percent_change!=null
                        ? <span className={`text-xs font-semibold ${up?'text-[#22c55e]':'text-[#ef4444]'}`}>{up?'+':''}{Number(r.percent_change).toFixed(2)}%</span>
                        : <span className="text-xs text-[#475569]">—</span>}
                    </td>
                    <td className="px-5 py-3 text-[#475569] mono">{r.volume?Number(r.volume).toLocaleString():'—'}</td>
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
