'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function WatchlistPopup({ symbol, name, sector, price, change, onClose }:
  { symbol:string; name:string; sector?:string; price?:number; change?:number; onClose:()=>void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(()=>{
    const fn=(e:KeyboardEvent)=>{ if(e.key==='Escape') onClose() }
    window.addEventListener('keydown',fn)
    return ()=>window.removeEventListener('keydown',fn)
  },[onClose])

  async function add() {
    setBusy(true); setErr('')
    const res = await fetch('/api/watchlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbol})})
    const d = await res.json()
    if (res.status===409) { router.push(`/dashboard/watchlist?sym=${symbol}`); onClose(); return }
    if (!res.ok) { setErr(d?.error||'Failed'); setBusy(false); return }
    router.push(`/dashboard/watchlist?added=${symbol}`); onClose()
  }

  const up = Number(change??0)>=0
  return (
    <div ref={ref} onClick={e=>{if(e.target===ref.current)onClose()}}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{background:'rgba(5,7,15,0.8)'}}>
      <div onClick={e=>e.stopPropagation()} className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{background:'var(--card)',border:'1px solid var(--border2)'}}>
        <div className="p-5 border-b" style={{borderColor:'var(--border)'}}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[#3b82f6] text-sm font-bold"
                style={{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.2)'}}>
                {symbol.slice(0,2)}
              </div>
              <div>
                <p className="font-semibold text-white text-sm">{symbol}</p>
                <p className="text-xs text-[#475569] mt-0.5 max-w-[180px] truncate">{name}</p>
              </div>
            </div>
            <button onClick={onClose} disabled={busy} className="text-[#475569] hover:text-white transition-colors p-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          {price!=null && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{borderColor:'var(--border)'}}>
              <span className="text-base font-semibold text-white">Rs. {price.toLocaleString()}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${up?'badge-up':'badge-down'}`}>
                {up?'+':''}{Number(change??0).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <div className="p-5">
          <p className="text-sm text-white font-medium mb-3">Add {symbol} to watchlist?</p>
          <div className="rounded-lg p-3 mb-4 space-y-1.5 text-xs text-[#94a3b8]" style={{background:'var(--surface)'}}>
            <div>· 30 days of price history loaded via load_history.py</div>
            <div>· Interactive OHLCV chart and data table</div>
            <div>· Real-time price tracking</div>
          </div>
          {err && <div className="text-xs text-[#ef4444] mb-3 p-2 rounded-lg" style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)'}}>{err}</div>}
          <div className="flex gap-3">
            <button onClick={onClose} disabled={busy}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[#94a3b8] hover:text-white transition-colors border"
              style={{borderColor:'var(--border)'}}>Cancel</button>
            <button onClick={add} disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
              {busy ? <><svg className="spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Adding...</> : 'Add to watchlist'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
