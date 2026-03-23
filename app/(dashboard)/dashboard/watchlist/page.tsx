'use client'
import { useState, useEffect, Suspense, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import PriceChart from '@/components/PriceChart'
import { toNum, f2, daysAgo, todayIso } from '@/lib/utils'

/* ─── Types ──────────────────────────────────────────────── */
interface WatchlistItem {
  watchlist_id: number; symbol: string; name: string
  sector?: string; close_price?: number; percent_change?: number; trading_date?: string
}
interface HistoryRow {
  trading_date: string
  open_price: number; high_price: number; low_price: number
  close_price: number; volume: number; percent_change: number
}
interface Expanded { symbol: string; data: HistoryRow[]; loading: boolean }

// Preset buttons: label → calendar days ago
const PRESETS: [string, number][] = [
  ['1D', 1], ['1W', 7], ['1M', 30], ['3M', 90], ['1Y', 365],
]

function toHistoryRow(r: Record<string,unknown>): HistoryRow {
  return {
    trading_date:   String(r.trading_date??''),
    open_price:     toNum(r.open_price),
    high_price:     toNum(r.high_price),
    low_price:      toNum(r.low_price),
    close_price:    toNum(r.close_price),
    volume:         toNum(r.volume),
    percent_change: toNum(r.percent_change),
  }
}

async function fetchHistory(symbol: string, from: string, to: string): Promise<HistoryRow[]> {
  const res = await fetch(`/api/watchlist/${symbol}/history?fromDate=${from}&toDate=${to}`)
  const d = await res.json()
  return Array.isArray(d.data) ? d.data.map((r: Record<string,unknown>) => toHistoryRow(r)) : []
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-32 gap-2 text-sm" style={{ color:'#94a3b8' }}>
      <svg className="animate-spin w-4 h-4" style={{ color:'#2563eb' }} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      {label}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   CONTENT
════════════════════════════════════════════════════════════ */
function WatchlistContent() {
  const searchParams  = useSearchParams()
  const highlightSym  = (searchParams.get('sym')??'').toUpperCase()

  const [items,    setItems]    = useState<WatchlistItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [expanded, setExpanded] = useState<Record<string,Expanded>>({})

  // Global date range for all cards — default: last 30 days
  const [from, setFrom] = useState(()=>daysAgo(30))
  const [to,   setTo]   = useState(()=>todayIso())

  const loadWatchlist = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/watchlist')
      const data = await res.json()
      setItems((Array.isArray(data)?data:[]).map((i: Record<string,unknown>)=>({
        watchlist_id:   Number(i.watchlist_id??0),
        symbol:         String(i.symbol??''),
        name:           String(i.name??''),
        sector:         i.sector!=null?String(i.sector):undefined,
        close_price:    i.close_price!=null?toNum(i.close_price):undefined,
        percent_change: i.percent_change!=null?toNum(i.percent_change):undefined,
        trading_date:   i.trading_date!=null?String(i.trading_date):undefined,
      })))
    } catch { setError('Failed to load watchlist') }
    finally  { setLoading(false) }
  },[])

  useEffect(()=>{ loadWatchlist() },[loadWatchlist])

  // When global range changes, reload all currently expanded cards
  useEffect(() => {
    const syms = Object.keys(expanded)
    if (!syms.length) return
    syms.forEach(sym => reloadHistory(sym, from, to))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to])

  async function toggleExpand(symbol: string) {
    if (expanded[symbol]) {
      setExpanded(p=>{const n={...p};delete n[symbol];return n}); return
    }
    setExpanded(p=>({...p,[symbol]:{symbol,data:[],loading:true}}))
    try {
      const rows = await fetchHistory(symbol, from, to)
      setExpanded(p=>({...p,[symbol]:{symbol,data:rows,loading:false}}))
    } catch {
      setExpanded(p=>({...p,[symbol]:{symbol,data:[],loading:false}}))
    }
  }

  async function reloadHistory(symbol: string, fromDate=from, toDate=to) {
    setExpanded(p=>({...p,[symbol]:{...(p[symbol]??{symbol,data:[]}),loading:true}}))
    try {
      const rows = await fetchHistory(symbol, fromDate, toDate)
      setExpanded(p=>({...p,[symbol]:{symbol,data:rows,loading:false}}))
    } catch {
      setExpanded(p=>({...p,[symbol]:{...(p[symbol]??{symbol,data:[]}),loading:false}}))
    }
  }

  async function remove(symbol: string) {
    await fetch('/api/watchlist',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbol})})
    setItems(p=>p.filter(i=>i.symbol!==symbol))
    setExpanded(p=>{const n={...p};delete n[symbol];return n})
  }

  if (loading) return <Spinner label="Loading watchlist…"/>
  if (error) return (
    <div className="text-center p-8">
      <p className="text-sm mb-3" style={{ color:'#dc2626' }}>{error}</p>
      <button onClick={loadWatchlist} className="px-4 py-2 rounded-lg text-sm text-white"
        style={{ background:'#2563eb', border:'none', cursor:'pointer' }}>Retry</button>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header + SINGLE global range picker */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color:'#0f172a' }}>Watchlist</h1>
          <p className="text-sm mt-0.5" style={{ color:'#64748b' }}>
            {items.length} {items.length===1?'company':'companies'} tracked
          </p>
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick preset buttons */}
            {PRESETS.map(([label, days]) => (
              <button key={label}
                onClick={() => { const f=daysAgo(days); const t=todayIso(); setFrom(f); setTo(t) }}
                className="text-xs px-2.5 py-1.5 rounded-lg transition-all"
                style={{
                  border: from===daysAgo(days)&&to===todayIso() ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                  color:  from===daysAgo(days)&&to===todayIso() ? '#2563eb' : '#64748b',
                  background: from===daysAgo(days)&&to===todayIso() ? '#eff6ff' : 'white',
                  cursor: 'pointer', fontWeight: 500,
                }}>
                {label}
              </button>
            ))}
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg outline-none"
              style={{ border:'1px solid #e2e8f0', color:'#0f172a', background:'white', fontFamily:'monospace' }}/>
            <span className="text-xs" style={{ color:'#94a3b8' }}>to</span>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg outline-none"
              style={{ border:'1px solid #e2e8f0', color:'#0f172a', background:'white', fontFamily:'monospace' }}/>
          </div>
        )}
      </div>

      {highlightSym&&(
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
          style={{ background:'#fffbeb', border:'1px solid #fde68a', color:'#92400e' }} role="status">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {highlightSym} is already in your watchlist
        </div>
      )}

      {items.length===0?(
        <div className="bg-white rounded-xl border p-12 text-center" style={{ borderColor:'#e2e8f0' }}>
          <p className="text-sm font-medium mb-1" style={{ color:'#0f172a' }}>Your watchlist is empty</p>
          <p className="text-xs mb-5" style={{ color:'#94a3b8' }}>Browse Portfolio to add stocks</p>
          <Link href="/dashboard/portfolio" style={{ color:'#2563eb', textDecoration:'none', fontSize:14, fontWeight:500 }}>Browse companies →</Link>
        </div>
      ):(
        <div className="space-y-3">
          {items.map(item=>{
            const up  = (item.percent_change??0) >= 0
            const exp = expanded[item.symbol]
            return (
              <div key={item.watchlist_id||item.symbol}
                className="bg-white rounded-xl border overflow-hidden"
                style={{ borderColor:'#e2e8f0' }}>

                {/* Row header */}
                <div className="flex items-center justify-between p-4"
                  onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='#f8fafc'}
                  onMouseOut={e=>(e.currentTarget as HTMLElement).style.background='white'}>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background:'#eff6ff', border:'1px solid #bfdbfe', color:'#2563eb' }}>
                      {item.symbol.slice(0,2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/dashboard/stock/${item.symbol}`} className="text-sm font-semibold"
                        style={{ color:'#0f172a', textDecoration:'none' }}>{item.symbol}</Link>
                      <p className="text-xs truncate max-w-[200px]" style={{ color:'#94a3b8' }}>{item.name}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full hidden sm:inline"
                      style={{ background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe' }}>
                      {item.sector?.split(' ').slice(0,2).join(' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 ml-4">
                    {item.close_price != null ? (
                      <>
                        <div className="text-right">
                          <p className="text-sm font-semibold" style={{ color:'#0f172a', fontFamily:'monospace' }}>
                            Rs.{item.close_price.toLocaleString()}
                          </p>
                          <p className="text-xs" style={{ color:'#94a3b8' }}>
                            {item.trading_date
                              ? new Date(item.trading_date).toLocaleDateString('en-NP',{month:'short',day:'numeric'})
                              : ''}
                          </p>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background:up?'#f0fdf4':'#fef2f2', color:up?'#16a34a':'#dc2626',
                            border:`1px solid ${up?'#bbf7d0':'#fecaca'}` }}>
                          {up?'+':''}{f2(item.percent_change)}%
                        </span>
                      </>
                    ) : (
                      <span className="text-xs" style={{ color:'#94a3b8' }}>No price data</span>
                    )}
                    <button onClick={()=>toggleExpand(item.symbol)}
                      className="text-xs px-3 py-1.5 rounded-lg transition-all"
                      style={{ background:exp?'#eff6ff':'#f8fafc', color:exp?'#2563eb':'#64748b',
                        border:exp?'1px solid #bfdbfe':'1px solid #e2e8f0', cursor:'pointer' }}>
                      {exp ? 'Close' : '📊 History'}
                    </button>
                    <button onClick={()=>remove(item.symbol)} aria-label={`Remove ${item.symbol}`}
                      className="text-xs px-2 py-1.5"
                      style={{ color:'#94a3b8', background:'none', border:'none', cursor:'pointer' }}
                      onMouseOver={e=>(e.currentTarget as HTMLElement).style.color='#dc2626'}
                      onMouseOut={e=>(e.currentTarget as HTMLElement).style.color='#94a3b8'}>✕</button>
                  </div>
                </div>

                {/* Expanded history — NO duplicate range picker, uses global range above */}
                {exp && (
                  <div className="border-t p-4" style={{ borderColor:'#f1f5f9', background:'#f8fafc' }}>
                    <p className="text-xs mb-3" style={{ color:'#94a3b8' }}>
                      Showing {from} → {to}
                      {exp.data.length > 0 && ` · ${exp.data.length} trading days`}
                    </p>

                    {exp.loading ? <Spinner label="Loading history…"/>
                    : exp.data.length===0
                      ? <p className="text-sm text-center py-6" style={{ color:'#94a3b8' }}>No data for selected range</p>
                    : (
                      <div className="space-y-4">
                        <PriceChart
                          title={`${item.symbol} · ${from} to ${to}`}
                          data={exp.data.map(r=>({
                            name:   r.trading_date,
                            open:   r.open_price,
                            high:   r.high_price,
                            low:    r.low_price,
                            close:  r.close_price,
                            volume: r.volume,
                          }))}
                        />
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b font-medium" style={{ borderColor:'#e2e8f0', color:'#64748b' }}>
                                {['Date','Open','High','Low','Close','Change%','Volume'].map(h=>(
                                  <th key={h} className="text-left px-3 py-2">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {exp.data.map((r,i)=>{
                                const rowUp = r.percent_change >= 0
                                return (
                                  <tr key={`${r.trading_date}-${i}`} className="border-b transition-colors"
                                    style={{ borderColor:'#f1f5f9' }}
                                    onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='#f1f5f9'}
                                    onMouseOut={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                                    <td className="px-3 py-2" style={{ color:'#64748b', fontFamily:'monospace' }}>
                                      {new Date(r.trading_date).toLocaleDateString('en-NP')}
                                    </td>
                                    <td className="px-3 py-2" style={{ color:'#64748b', fontFamily:'monospace' }}>{f2(r.open_price)}</td>
                                    <td className="px-3 py-2 font-medium" style={{ color:'#16a34a', fontFamily:'monospace' }}>{f2(r.high_price)}</td>
                                    <td className="px-3 py-2 font-medium" style={{ color:'#dc2626', fontFamily:'monospace' }}>{f2(r.low_price)}</td>
                                    <td className="px-3 py-2 font-semibold" style={{ color:'#0f172a', fontFamily:'monospace' }}>{f2(r.close_price)}</td>
                                    <td className="px-3 py-2 font-semibold"
                                      style={{ color:rowUp?'#16a34a':'#dc2626', fontFamily:'monospace' }}>
                                      {rowUp?'+':''}{f2(r.percent_change)}%
                                    </td>
                                    <td className="px-3 py-2" style={{ color:'#64748b', fontFamily:'monospace' }}>{r.volume.toLocaleString()}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function WatchlistPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-sm" style={{ color:'#94a3b8' }}>Loading…</div>}>
      <WatchlistContent/>
    </Suspense>
  )
}