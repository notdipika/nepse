'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import WatchlistPopup from '@/components/WatchlistPopup'
import { toNum, f2, rsFormat, normaliseStockRow, type NormalisedStock } from '@/lib/utils'

function StatCard({ label, value, green, red }: { label:string; value:string; green?:boolean; red?:boolean }) {
  return (
    <div className="rounded-lg p-3 border" style={{ background:'#f8fafc', borderColor:'#e2e8f0' }}>
      <p className="text-xs mb-1" style={{ color:'#94a3b8' }}>{label}</p>
      <p className="text-sm font-semibold" style={{ color:green?'#16a34a':red?'#dc2626':'#0f172a', fontFamily:'monospace' }}>{value}</p>
    </div>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-64 gap-2 text-sm" style={{ color:'#94a3b8' }}>
      <svg className="animate-spin w-4 h-4" style={{ color:'#2563eb' }} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      {label}
    </div>
  )
}

export default function PortfolioPage() {
  const [companies, setCompanies] = useState<NormalisedStock[]>([])
  const [query,     setQuery]     = useState('')
  const [isOpen,    setIsOpen]    = useState(false)
  const [sel,       setSel]       = useState<NormalisedStock|null>(null)
  const [loading,   setLoading]   = useState(true)
  const [showPopup, setShowPopup] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/stocks/all').then(r=>r.json()).then(d => {
      const rows: unknown[] = Array.isArray(d?.rows)?d.rows:Array.isArray(d)?d:[]
      const cs = rows.map(r=>normaliseStockRow(r as Record<string,unknown>))
      setCompanies(cs)
      if (cs[0]) { setSel(cs[0]); setQuery(`${cs[0].symbol} — ${cs[0].company_name}`) }
    }).finally(()=>setLoading(false))
  },[])

  useEffect(() => {
    const fn=(e:MouseEvent)=>{ if(!dropRef.current?.contains(e.target as Node)) setIsOpen(false) }
    document.addEventListener('mousedown',fn); return ()=>document.removeEventListener('mousedown',fn)
  },[])

  const filtered = query.trim()
    ? companies.filter(c=>{ const q=query.trim().toLowerCase(); return c.symbol.toLowerCase().includes(q)||c.company_name.toLowerCase().includes(q) })
    : companies

  const up = toNum(sel?.change_percent)>=0

  if (loading) return <Spinner label="Loading portfolio data…"/>

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold" style={{ color:'#0f172a' }}>My Portfolio</h1>
        <p className="text-sm mt-0.5" style={{ color:'#64748b' }}>Browse company metrics and add to watchlist</p>
      </div>

      {/* Company selector */}
      <div className="bg-white rounded-xl border p-5" style={{ borderColor:'#e2e8f0' }} ref={dropRef}>
        <label className="block text-xs font-medium uppercase tracking-wide mb-2" style={{ color:'#64748b' }}>Select Company</label>
        <div className="relative">
          <input value={query} onChange={e=>{setQuery(e.target.value);setIsOpen(true)}} autoComplete="off"
            placeholder="Search symbol or company name…"
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
            style={{ border:'1px solid #e2e8f0', color:'#0f172a', background:'white', transition:'border-color 0.15s' }}
            onFocus={e=>{ e.currentTarget.style.borderColor='#93c5fd'; setIsOpen(true) }}
            onBlur={e=>e.currentTarget.style.borderColor='#e2e8f0'}/>
          <button onClick={()=>setIsOpen(v=>!v)} aria-label="Toggle list"
            style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',color:'#94a3b8',background:'none',border:'none',cursor:'pointer' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          {isOpen&&(
            <div className="absolute z-20 mt-1 w-full rounded-lg shadow-lg" role="listbox"
              style={{ background:'white', border:'1px solid #e2e8f0', maxHeight:280, overflowY:'auto' }}>
              {filtered.length===0
                ?<p className="px-4 py-3 text-sm" style={{ color:'#94a3b8' }}>No company found</p>
                :filtered.slice(0,50).map(c=>(
                  <button key={c.symbol} role="option" aria-selected={sel?.symbol===c.symbol}
                    onClick={()=>{ setSel(c); setQuery(`${c.symbol} — ${c.company_name}`); setIsOpen(false) }}
                    className="w-full text-left px-4 py-2.5 transition-colors"
                    style={{ background:sel?.symbol===c.symbol?'#eff6ff':'transparent' }}
                    onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='#f8fafc'}
                    onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=sel?.symbol===c.symbol?'#eff6ff':'transparent'}>
                    <p className="text-sm font-medium" style={{ color:'#0f172a' }}>{c.symbol}</p>
                    <p className="text-xs truncate" style={{ color:'#94a3b8' }}>{c.company_name}</p>
                  </button>
                ))
              }
            </div>
          )}
        </div>
        <p className="text-xs mt-2" style={{ color:'#94a3b8' }}>{companies.length} companies available</p>
      </div>

      {/* Selected company detail */}
      {sel&&(
        <div className="bg-white rounded-xl border p-6" style={{ borderColor:'#e2e8f0' }}>
          <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold"
                style={{ background:'#eff6ff', border:'1px solid #bfdbfe', color:'#2563eb' }} aria-hidden>
                {sel.symbol.slice(0,2)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-2xl font-bold" style={{ color:'#0f172a' }}>{sel.symbol}</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe' }}>{sel.sector_name}</span>
                </div>
                <p className="text-sm mt-0.5" style={{ color:'#64748b' }}>{sel.company_name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold" style={{ color:'#0f172a', fontFamily:'monospace' }}>{rsFormat(sel.close_price)}</p>
              <p className="text-xs mt-0.5" style={{ color:'#94a3b8' }}>
                {sel.updated_at?new Date(sel.updated_at).toLocaleDateString('en-NP',{year:'numeric',month:'short',day:'numeric'}):''}
              </p>
              <div className="flex items-center gap-2 justify-end mt-1.5">
                <span className="flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium"
                  style={{ background:up?'#f0fdf4':'#fef2f2', color:up?'#16a34a':'#dc2626', border:`1px solid ${up?'#bbf7d0':'#fecaca'}` }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={up?'M5 10l7-7m0 0l7 7m-7-7v18':'M19 14l-7 7m0 0l-7-7m7 7V3'}/>
                  </svg>
                  {f2(Math.abs(toNum(sel.change_percent)))}%
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-5 border-t" style={{ borderColor:'#f1f5f9' }}>
            <StatCard label="Open"      value={rsFormat(sel.open_price)}/>
            <StatCard label="High"      value={rsFormat(sel.high_price)} green/>
            <StatCard label="Low"       value={rsFormat(sel.low_price)}  red/>
            <StatCard label="Pr. Close" value={rsFormat(sel.prev_close)}/>
            <StatCard label="Turnover"  value={sel.turnover!=null?`Rs.${toNum(sel.turnover).toLocaleString()}`:'—'}/>
            <StatCard label="Volume"    value={sel.volume!=null?toNum(sel.volume).toLocaleString():'—'}/>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-5">
            <div className="rounded-xl border p-4" style={{ background:'#f8fafc', borderColor:'#e2e8f0' }}>
              <p className="text-xs font-medium mb-3" style={{ color:'#64748b' }}>Trading Information</p>
              <div className="space-y-2">
                <div className="flex justify-between py-1.5 border-b" style={{ borderColor:'#e2e8f0' }}>
                  <span className="text-sm" style={{ color:'#64748b' }}>Volume</span>
                  <span className="text-sm font-medium" style={{ color:'#0f172a', fontFamily:'monospace' }}>
                    {sel.volume!=null?toNum(sel.volume).toLocaleString():'—'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-sm" style={{ color:'#64748b' }}>Last Updated</span>
                  <span className="text-sm font-medium" style={{ color:'#2563eb' }}>
                    {sel.updated_at?new Date(sel.updated_at).toLocaleDateString('en-NP'):'N/A'}
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border p-4" style={{ background:'#f8fafc', borderColor:'#e2e8f0' }}>
              <p className="text-xs font-medium mb-3" style={{ color:'#64748b' }}>Quick Actions</p>
              <div className="space-y-2">
                <Link href={`/dashboard/stock/${sel.symbol}`}
                  className="block w-full px-4 py-2 rounded-lg text-sm font-medium text-center"
                  style={{ background:'#eff6ff', border:'1px solid #bfdbfe', color:'#2563eb', textDecoration:'none' }}>
                  View Detailed Chart
                </Link>
                <button onClick={()=>setShowPopup(true)}
                  className="w-full px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background:'#2563eb', color:'white', border:'none', cursor:'pointer' }}>
                  Add to Watchlist
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPopup&&sel&&(
        <WatchlistPopup symbol={sel.symbol} name={sel.company_name} sector={sel.sector_name}
          price={sel.close_price??undefined} change={sel.change_percent??undefined}
          onClose={()=>setShowPopup(false)}/>
      )}
    </div>
  )
}
