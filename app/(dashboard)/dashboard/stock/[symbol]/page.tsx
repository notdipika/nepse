import { notFound } from 'next/navigation'
import { getCompanyWithLatestPrice, getPriceHistory } from '@/lib/db'
import { rsFormat } from '@/lib/utils'
import PriceChart from '@/components/PriceChart'

export const runtime = 'nodejs'

export default async function StockPage({
  params,
}: {
  params: Promise<{ symbol: string }>
}) {
  const { symbol } = await params
  const result = await getCompanyWithLatestPrice(symbol)
  if (!result) notFound()

  const { company, latest, range52 } = result

  // Fetch 90-day history (parallel with above via getCompanyWithLatestPrice already doing Promise.all)
  const history = await getPriceHistory(
    company.symbol,
    new Date(Date.now() - 90 * 86400_000).toISOString().split('T')[0],
    new Date().toISOString().split('T')[0],
    90
  )

  const chg  = Number(latest?.percent_change ?? 0)
  const isUp = chg >= 0

  const chartData = history.map(h => ({
    date:   h.trading_date,
    open:   Number(h.open_price  ?? 0),
    high:   Number(h.high_price  ?? 0),
    low:    Number(h.low_price   ?? 0),
    close:  Number(h.close_price ?? 0),
    volume: Number(h.volume      ?? 0),
  }))

  const stats: { l: string; v: string; c: string }[] = [
    { l:'Open',      v:rsFormat(latest?.open_price),  c:'#0f172a' },
    { l:'High',      v:rsFormat(latest?.high_price),  c:'#16a34a' },
    { l:'Low',       v:rsFormat(latest?.low_price),   c:'#dc2626' },
    { l:'Pr. Close', v:rsFormat(latest?.prev_close),  c:'#0f172a' },
    { l:'Turnover',  v:latest?.turnover?`Rs.${Number(latest.turnover).toLocaleString()}`:'—', c:'#0f172a' },
    { l:'Volume',    v:latest?.volume?Number(latest.volume).toLocaleString():'—', c:'#0f172a' },
    { l:'52W High',  v:rsFormat(range52?.high52), c:'#16a34a' },
    { l:'52W Low',   v:rsFormat(range52?.low52),  c:'#dc2626' },
  ]

  const latestDate = latest?.trading_date
    ? new Date(latest.trading_date).toLocaleDateString('en-NP',{year:'numeric',month:'short',day:'numeric'})
    : 'No data'

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border p-6" style={{ borderColor:'#e2e8f0' }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ background:'#eef2ff', border:'1px solid #c7d2fe', color:'#4338ca' }} aria-hidden>
              {company.symbol.slice(0,2)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color:'#1e1b4b' }}>{company.symbol}</h1>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:'#eef2ff', color:'#4338ca', border:'1px solid #c7d2fe' }}>{company.sector_name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0' }}>Active</span>
              </div>
              <p className="text-sm mt-0.5" style={{ color:'#64748b' }}>{company.name}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-3 justify-end">
              <span className="text-3xl font-bold" style={{ color:'#1e1b4b', fontFamily:'monospace' }}>
                {rsFormat(latest?.close_price)}
              </span>
              <span className="text-sm font-semibold px-2.5 py-1 rounded-full flex items-center gap-1"
                style={{ background:isUp?'#f0fdf4':'#fef2f2', color:isUp?'#16a34a':'#dc2626', border:`1px solid ${isUp?'#bbf7d0':'#fecaca'}` }}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isUp?'M5 10l7-7m0 0l7 7m-7-7v18':'M19 14l-7 7m0 0l-7-7m7 7V3'}/>
                </svg>
                {Math.abs(chg).toFixed(2)}%
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color:'#94a3b8' }}>{latestDate}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-6 pt-5 border-t" style={{ borderColor:'#f1f5f9' }}>
          {stats.map(s=>(
            <div key={s.l} className="rounded-lg p-3 border" style={{ background:'#f8fafc', borderColor:'#e2e8f0' }}>
              <p className="text-xs mb-1" style={{ color:'#94a3b8' }}>{s.l}</p>
              <p className="text-sm font-semibold" style={{ color:s.c, fontFamily:'monospace' }}>{s.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      {chartData.length>0?(
        <div className="bg-white rounded-xl border p-5" style={{ borderColor:'#e2e8f0' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color:'#1e1b4b' }}>
            Price History · {company.symbol} · last {chartData.length} trading days
          </h2>
          <PriceChart symbol={company.symbol} initialData={chartData} title={`${company.symbol} · Close Price`}/>
        </div>
      ):(
        <div className="bg-white rounded-xl border p-8 text-center" style={{ borderColor:'#e2e8f0' }}>
          <p className="text-sm" style={{ color:'#94a3b8' }}>
            No price history. Run:{' '}
            <code className="text-xs px-2 py-0.5 rounded" style={{ background:'#f1f5f9', color:'#4338ca' }}>
              python load_history.py --symbol {company.symbol} --days 90
            </code>
          </p>
        </div>
      )}
    </div>
  )
}