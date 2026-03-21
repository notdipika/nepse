'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PriceChart from '@/components/PriceChart'

interface WItem { watchlist_id:number; symbol:string; name:string; sector:string; close_price?:number; percent_change?:number; trading_date?:string }
interface HistRow { trading_date:string; open_price:number; high_price:number; low_price:number; close_price:number; volume:number; percent_change:number }
interface Exp { data:HistRow[]; loading:boolean }

function toNum(v:unknown) { const n=Number(v); return Number.isFinite(n)?n:0 }
function fmt(v:unknown) { return toNum(v).toFixed(2) }

function WatchlistContent() {
  const sp = useSearchParams()
  const addedSym = (sp.get('added')||'').toUpperCase()
  const [items, setItems] = useState<WItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string,Exp>>({})
  const [from, setFrom] = useState(() => { const d=new Date(); d.setDate(d.getDate()-30); return d.toISOString().split('T')[0] })
  const [to, setTo] = useState(new Date().toISOString().split('T')[0])

  useEffect(()=>{
    fetch('/api/watchlist').then(r=>r.json()).then(d=>{
      const arr = Array.isArray(d)?d:[]
      setItems(arr.map((i:any)=>({
        watchlist_id: Number(i.watchlist_id||0), symbol:String(i.symbol||''), name:String(i.name||''),
        sector:String(i.sector||''), close_price:i.close_price==null?undefined:toNum(i.close_price),
        percent_change:i.percent_change==null?undefined:toNum(i.percent_change),
        trading_date:i.trading_date??undefined,
      })))
    }).finally(()=>setLoading(false))
  },[])

  const loadHistory = async (symbol:string) => {
    setExpanded(p=>({...p,[symbol]:{data:[],loading:true}}))
    const res = await fetch(`/api/watchlist/${symbol}/history?fromDate=${from}&toDate=${to}`)
    const d = await res.json()
    const rows:HistRow[] = Array.isArray(d.data)?d.data.map((r:any)=>({
      trading_date:String(r.trading_date||''), open_price:toNum(r.open_price), high_price:toNum(r.high_price),
      low_price:toNum(r.low_price), close_price:toNum(r.close_price), volume:toNum(r.volume), percent_change:toNum(r.percent_change),
    })):[]
    setExpanded(p=>({...p,[symbol]:{data:rows,loading:false}}))
  }

  const toggle = (symbol:string) => {
    if (expanded[symbol]) setExpanded(p=>{const n={...p}; delete n[symbol]; return n})
    else loadHistory(symbol)
  }

  const remove = async (symbol:string) => {
    await fetch('/api/watchlist',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbol})})
    setItems(p=>p.filter(i=>i.symbol!==symbol))
    setExpanded(p=>{const n={...p}; delete n[symbol]; return n})
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Watchlist</h1>
          <p className="text-sm text-[#475569] mt-0.5">{items.length} companies tracked</p>
        </div>
        {items.length>0 && (
          <div className="flex items-center gap-2">
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg text-white outline-none mono"
              style={{background:'var(--card)',border:'1px solid var(--border)'}}/>
            <span className="text-xs text-[#475569]">to</span>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg text-white outline-none mono"
              style={{background:'var(--card)',border:'1px solid var(--border)'}}/>
          </div>
        )}
      </div>

      {addedSym && <div className="card p-3 text-sm text-[#22c55e] flex items-center gap-2" style={{background:'rgba(34,197,94,0.06)',borderColor:'rgba(34,197,94,0.2)'}}>
        <span>✓</span> {addedSym} added to watchlist
      </div>}

      {loading ? (
        <div className="card p-8 text-center text-sm text-[#475569]">Loading watchlist...</div>
      ) : items.length===0 ? (
        <div className="card p-12 text-center">
          <p className="text-[#94a3b8] mb-2">Your watchlist is empty</p>
          <p className="text-sm text-[#475569] mb-4">Search for companies or browse Portfolio to add stocks</p>
          <Link href="/dashboard/portfolio" className="text-sm text-[#3b82f6] hover:text-[#60a5fa]">Browse companies →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const up = (item.percent_change??0)>=0
            const exp = expanded[item.symbol]
            return (
              <div key={item.watchlist_id} className="card overflow-hidden">
                <div className="flex items-center justify-between p-4 hover:bg-white/2 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[#3b82f6] text-xs font-bold shrink-0"
                      style={{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.15)'}}>
                      {item.symbol.slice(0,2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/dashboard/stock/${item.symbol}`}
                        className="text-sm font-semibold text-white hover:text-[#3b82f6] transition-colors">{item.symbol}</Link>
                      <p className="text-xs text-[#475569] truncate max-w-[200px]">{item.name}</p>
                    </div>
                    <span className="badge-blue text-xs px-2 py-0.5 rounded-full hidden sm:inline">{item.sector?.split(' ').slice(0,2).join(' ')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.close_price!=null && <>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white mono">Rs.{item.close_price.toLocaleString()}</p>
                        <p className="text-xs text-[#475569]">{item.trading_date?new Date(item.trading_date).toLocaleDateString('en-NP',{month:'short',day:'numeric'}):''}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${up?'badge-up':'badge-down'}`}>
                        {up?'+':''}{fmt(item.percent_change)}%
                      </span>
                    </>}
                    <button onClick={()=>toggle(item.symbol)}
                      className="text-xs px-3 py-1.5 rounded-lg border transition-all"
                      style={{borderColor:'var(--border)',color:exp?'#3b82f6':'#94a3b8',background:exp?'rgba(59,130,246,0.08)':'transparent'}}>
                      {exp?'Close':'History'}
                    </button>
                    <button onClick={()=>remove(item.symbol)} className="text-[#475569] hover:text-[#ef4444] transition-colors text-sm px-1">✕</button>
                  </div>
                </div>

                {exp && (
                  <div className="border-t p-4" style={{borderColor:'var(--border)',background:'var(--surface)'}}>
                    {exp.loading ? (
                      <div className="py-6 text-center text-sm text-[#475569] flex items-center justify-center gap-2">
                        <svg className="spin w-4 h-4 text-[#3b82f6]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        Loading history...
                      </div>
                    ) : exp.data.length===0 ? (
                      <div className="py-6 text-center text-sm text-[#475569]">No data for selected date range</div>
                    ) : (
                      <div className="space-y-4">
                        <PriceChart data={exp.data.map(r=>({date:r.trading_date,open:r.open_price,high:r.high_price,low:r.low_price,close:r.close_price,volume:r.volume}))} title={`${item.symbol} · ${from} to ${to}`}/>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs mono">
                            <thead><tr className="border-b text-[#475569]" style={{borderColor:'var(--border)'}}>
                              {['Date','Open','High','Low','Close','Change%','Volume'].map(h=><th key={h} className="text-left px-3 py-2 font-medium">{h}</th>)}
                            </tr></thead>
                            <tbody>
                              {[...exp.data].reverse().map((r,i)=>(
                                <tr key={i} className="border-b hover:bg-white/2" style={{borderColor:'rgba(30,45,71,0.4)'}}>
                                  <td className="px-3 py-2 text-[#94a3b8]">{new Date(r.trading_date).toLocaleDateString('en-NP')}</td>
                                  <td className="px-3 py-2 text-[#94a3b8]">{fmt(r.open_price)}</td>
                                  <td className="px-3 py-2 text-[#22c55e]">{fmt(r.high_price)}</td>
                                  <td className="px-3 py-2 text-[#ef4444]">{fmt(r.low_price)}</td>
                                  <td className="px-3 py-2 font-semibold text-white">{fmt(r.close_price)}</td>
                                  <td className={`px-3 py-2 font-semibold ${r.percent_change>=0?'text-[#22c55e]':'text-[#ef4444]'}`}>
                                    {r.percent_change>=0?'+':''}{fmt(r.percent_change)}%
                                  </td>
                                  <td className="px-3 py-2 text-[#475569]">{r.volume.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    <button onClick={()=>loadHistory(item.symbol)}
                      className="mt-3 text-xs text-[#3b82f6] hover:text-[#60a5fa] transition-colors">
                      ↻ Reload with new dates
                    </button>
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
  return <Suspense fallback={<div className="p-8 text-center text-[#475569]">Loading...</div>}><WatchlistContent/></Suspense>
}
