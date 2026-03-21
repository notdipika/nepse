import { notFound } from 'next/navigation'
import nepsePool from '@/lib/db-nepse'
import { RowDataPacket } from 'mysql2'
import PriceChart from '@/components/PriceChart'
import WatchlistPopup from '@/components/WatchlistPopup'

export const runtime = 'nodejs'

async function getData(symbol: string) {
  try {
    const [[company]] = await nepsePool.query<RowDataPacket[]>(
      `SELECT c.*, s.name AS sector_name FROM company c JOIN sector s ON c.sector_id=s.sector_id WHERE c.symbol=?`,
      [symbol.toUpperCase()])
    if (!company) return null
    const [[latest]] = await nepsePool.query<RowDataPacket[]>(
      `SELECT p.*, t.trading_date FROM price_data p JOIN trading_session t ON p.session_id=t.session_id WHERE p.company_id=? ORDER BY t.trading_date DESC LIMIT 1`,
      [company.company_id])
    const [history] = await nepsePool.query<RowDataPacket[]>(
      `SELECT t.trading_date AS date, p.open_price AS open, p.high_price AS high, p.low_price AS low, p.close_price AS close, p.volume
       FROM price_data p JOIN trading_session t ON p.session_id=t.session_id WHERE p.company_id=? ORDER BY t.trading_date ASC LIMIT 90`,
      [company.company_id])
    const [[range52]] = await nepsePool.query<RowDataPacket[]>(
      `SELECT MAX(p.high_price) AS high52, MIN(p.low_price) AS low52 FROM price_data p JOIN trading_session t ON p.session_id=t.session_id WHERE p.company_id=? AND t.trading_date>=DATE_SUB(CURDATE(),INTERVAL 52 WEEK)`,
      [company.company_id])
    return { company, latest, history, range52 }
  } catch { return null }
}

export default async function StockPage({ params }: { params: { symbol: string } }) {
  const data = await getData(params.symbol)
  if (!data) notFound()
  const { company, latest, history, range52 } = data
  const chg = Number(latest?.percent_change ?? 0)
  const isUp = chg >= 0

  const chartData = (history as RowDataPacket[]).map(h => ({
    date: String(h.date), open: Number(h.open??0), high: Number(h.high??0),
    low: Number(h.low??0), close: Number(h.close??0), volume: Number(h.volume??0),
  }))

  const stats = [
    { l:'Open',    v:`Rs. ${Number(latest?.open_price??0).toLocaleString()}` },
    { l:'High',    v:`Rs. ${Number(latest?.high_price??0).toLocaleString()}`, c:'#22c55e' },
    { l:'Low',     v:`Rs. ${Number(latest?.low_price??0).toLocaleString()}`,  c:'#ef4444' },
    { l:'Pr.Close',v:`Rs. ${Number(latest?.prev_close??0).toLocaleString()}` },
    { l:'Turnover',v: latest?.turnover ? `Rs. ${Number(latest.turnover).toLocaleString()}` : '—' },
    { l:'Volume',  v: latest?.volume   ? Number(latest.volume).toLocaleString() : '—' },
    { l:'52W High',v:`Rs. ${Number(range52?.high52??0).toLocaleString()}`, c:'#22c55e' },
    { l:'52W Low', v:`Rs. ${Number(range52?.low52??0).toLocaleString()}`,  c:'#ef4444' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-[#3b82f6] font-bold text-sm"
              style={{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.2)'}}>
              {company.symbol?.slice(0,2)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-white">{company.symbol}</h1>
                <span className="badge-blue text-xs px-2 py-0.5 rounded-full">{company.sector_name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{background:'rgba(34,197,94,0.08)',color:'#22c55e',border:'1px solid rgba(34,197,94,0.2)'}}>Active</span>
              </div>
              <p className="text-sm text-[#94a3b8] mt-0.5">{company.name}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-3 justify-end">
              <span className="text-3xl font-bold text-white mono">Rs. {Number(latest?.close_price??0).toLocaleString()}</span>
              <span className={`text-sm font-medium px-2.5 py-1 rounded-full flex items-center gap-1 ${isUp?'badge-up':'badge-down'}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isUp?'M5 10l7-7m0 0l7 7m-7-7v18':'M19 14l-7 7m0 0l-7-7m7 7V3'}/>
                </svg>
                {Math.abs(chg).toFixed(2)}%
              </span>
            </div>
            <p className="text-xs text-[#475569] mt-1">
              {latest?.trading_date ? new Date(latest.trading_date).toLocaleDateString('en-NP',{year:'numeric',month:'short',day:'numeric'}) : 'No data'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t" style={{borderColor:'var(--border)'}}>
          {stats.map(s=>(
            <div key={s.l} className="rounded-lg p-3" style={{background:'var(--surface)'}}>
              <p className="text-xs text-[#475569] mb-1">{s.l}</p>
              <p className="text-sm font-semibold mono" style={{color:s.c||'#f1f5ff'}}>{s.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <div className="card p-5">
          <PriceChart data={chartData} title="90-Day Price History"/>
        </div>
      ) : (
        <div className="card p-8 text-center text-sm text-[#475569]">
          No price history. Run load_history.py --days 30 to populate data.
        </div>
      )}
    </div>
  )
}
