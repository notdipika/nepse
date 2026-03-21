'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import WatchlistPopup from '@/components/WatchlistPopup'

interface Company { symbol:string; name:string; sector:string; close_price:number|null; percent_change:number|null; open_price:number|null; high_price:number|null; low_price:number|null; prev_close:number|null; turnover:number|null; volume:number|null }

function fmt(v:unknown) { return Number(v||0).toFixed(2) }
function fmtRs(v:unknown) { return `Rs. ${Number(v||0).toLocaleString('en-NP',{maximumFractionDigits:2})}` }

export default function PortfolioPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Company|null>(null)
  const [loading, setLoading] = useState(true)
  const [showPopup, setShowPopup] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(()=>{
    fetch('/api/stocks/all').then(r=>r.json()).then(d=>{
      const rows = Array.isArray(d?.rows)?d.rows:Array.isArray(d)?d:[]
      const cs: Company[] = rows.map((r:any)=>({
        symbol: String(r.symbol||'').toUpperCase(),
        name: String(r.company_name||r.name||''),
        sector: String(r.sector_name||r.sector||'Others'),
        close_price:   r.close_price==null   ? null : Number(r.close_price),
        percent_change: r.change_percent==null? null : Number(r.change_percent),
        open_price:    r.open_price==null     ? null : Number(r.open_price),
        high_price:    r.high_price==null     ? null : Number(r.high_price),
        low_price:     r.low_price==null      ? null : Number(r.low_price),
        prev_close:    r.prev_close==null     ? null : Number(r.prev_close),
        turnover:      r.turnover==null       ? null : Number(r.turnover),
        volume:        r.volume==null         ? null : Number(r.volume),
      }))
      setCompanies(cs)
      if (cs[0]) { setSelected(cs[0]); setQuery(`${cs[0].symbol} — ${cs[0].name}`) }
    }).finally(()=>setLoading(false))
  },[])

  useEffect(()=>{
    function onClickOutside(e:MouseEvent) { if (!dropRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    return ()=>document.removeEventListener('mousedown', onClickOutside)
  },[])

  const filtered = companies.filter(c=>{
    const q = query.trim().toLowerCase()
    if (!q || open) return true
    return c.symbol.toLowerCase().includes(q)||c.name.toLowerCase().includes(q)
  })
  const searchFiltered = companies.filter(c=>{
    const q = query.trim().toLowerCase()
    if (!q) return true
    return c.symbol.toLowerCase().includes(q)||c.name.toLowerCase().includes(q)
  })

  const up = Number(selected?.percent_change??0)>=0

  const Stat = ({l,v,c}:{l:string;v:string;c?:string}) => (
    <div className="rounded-lg p-3.5" style={{background:'var(--surface)',border:'1px solid var(--border)'}}>
      <p className="text-xs text-[#475569] mb-1">{l}</p>
      <p className="text-sm font-semibold mono" style={{color:c||'#f1f5ff'}}>{v}</p>
    </div>
  )

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white">Portfolio</h1>
        <p className="text-sm text-[#475569] mt-0.5">Browse company metrics and add to watchlist</p>
      </div>

      {/* Company selector */}
      <div className="card p-5" ref={dropRef}>
        <label className="block text-xs text-[#475569] mb-2 uppercase tracking-wider">Select Company</label>
        <div className="relative">
          <input value={query} onChange={e=>{setQuery(e.target.value);setOpen(true)}} onFocus={()=>setOpen(true)}
            placeholder="Search symbol or company name..."
            className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-[#475569] outline-none transition-all"
            style={{background:'var(--surface)',border:'1px solid var(--border2)'}}
            onFocus={e=>e.target.style.borderColor='#3b82f6'}
            onBlur={e=>e.target.style.borderColor='var(--border2)'}/>
          <button type="button" onClick={()=>setOpen(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
          </button>
          {open && (
            <div className="absolute z-20 mt-1 w-full rounded-lg shadow-xl overflow-hidden"
              style={{background:'var(--card)',border:'1px solid var(--border2)',maxHeight:280,overflowY:'auto'}}>
              {searchFiltered.length===0
                ? <p className="px-4 py-3 text-sm text-[#475569]">No company found</p>
                : searchFiltered.slice(0,50).map(c=>(
                    <button key={c.symbol} type="button"
                      onClick={()=>{setSelected(c);setQuery(`${c.symbol} — ${c.name}`);setOpen(false)}}
                      className={`w-full text-left px-4 py-2.5 transition-colors hover:bg-white/4 ${selected?.symbol===c.symbol?'bg-[#3b82f6]/10':''}`}>
                      <p className="text-sm text-white font-medium">{c.symbol}</p>
                      <p className="text-xs text-[#475569] truncate">{c.name}</p>
                    </button>
                  ))
              }
            </div>
          )}
        </div>
        <p className="text-xs text-[#475569] mt-2">{companies.length} companies available</p>
      </div>

      {loading && <div className="card p-8 text-center text-sm text-[#475569]">Loading portfolio data...</div>}

      {selected && !loading && (
        <div className="card p-6">
          <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-[#3b82f6] text-sm font-bold"
                style={{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.2)'}}>
                {selected.symbol.slice(0,2)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-white">{selected.symbol}</h2>
                  <span className="badge-blue text-xs px-2 py-0.5 rounded-full">{selected.sector}</span>
                </div>
                <p className="text-sm text-[#94a3b8] mt-0.5">{selected.name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-white mono">{selected.close_price!=null?fmtRs(selected.close_price):'—'}</p>
              <div className="flex items-center gap-2 justify-end mt-1">
                <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${up?'badge-up':'badge-down'}`}>
                  {up?'+':''}{fmt(selected.percent_change)}%
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <Stat l="Open"      v={selected.open_price!=null?fmtRs(selected.open_price):'—'}/>
            <Stat l="High"      v={selected.high_price!=null?fmtRs(selected.high_price):'—'}  c="#22c55e"/>
            <Stat l="Low"       v={selected.low_price!=null?fmtRs(selected.low_price):'—'}   c="#ef4444"/>
            <Stat l="Pr. Close" v={selected.prev_close!=null?fmtRs(selected.prev_close):'—'}/>
            <Stat l="Turnover"  v={selected.turnover!=null?`Rs.${Number(selected.turnover).toLocaleString()}`:'—'}/>
            <Stat l="Volume"    v={selected.volume!=null?Number(selected.volume).toLocaleString():'—'}/>
          </div>

          <div className="flex gap-3 mt-5">
            <Link href={`/dashboard/stock/${selected.symbol}`}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#3b82f6] border border-[#3b82f6]/30 hover:bg-[#3b82f6]/10 transition-colors">
              View Chart
            </Link>
            <button onClick={()=>setShowPopup(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#3b82f6] hover:bg-[#2563eb] transition-colors">
              Add to Watchlist
            </button>
          </div>
        </div>
      )}

      {showPopup && selected && (
        <WatchlistPopup symbol={selected.symbol} name={selected.name} sector={selected.sector}
          price={selected.close_price??undefined} change={selected.percent_change??undefined}
          onClose={()=>setShowPopup(false)}/>
      )}
    </div>
  )
}
