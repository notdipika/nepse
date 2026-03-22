'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function WatchlistPopup({ symbol, name, sector, price, change, onClose }:
  { symbol:string; name:string; sector?:string; price?:number; change?:number; onClose:()=>void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e:KeyboardEvent) => { if(e.key==='Escape') onClose() }
    window.addEventListener('keydown',fn); return ()=>window.removeEventListener('keydown',fn)
  },[onClose])

  async function add() {
    setBusy(true); setErr('')
    const res = await fetch('/api/watchlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbol})})
    const d   = await res.json()
    if (res.status===409) { router.push(`/dashboard/watchlist?sym=${symbol}`); onClose(); return }
    if (!res.ok) { setErr(d?.error||'Failed'); setBusy(false); return }
    router.push(`/dashboard/watchlist?added=${symbol}`); onClose()
  }

  const up = Number(change??0) >= 0

  return (
    <div ref={ref} onClick={e=>{if(e.target===ref.current)onClose()}}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{background:'rgba(15,23,42,0.5)'}}>
      <div onClick={e=>e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border"
        style={{borderColor:'#e2e8f0'}}>

        {/* Header */}
        <div className="p-5 border-b" style={{borderColor:'#f1f5f9'}}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                style={{background:'#eef2ff',border:'1px solid #c7d2fe',color:'#4338ca'}}>
                {symbol.slice(0,2)}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{color:'#1e1b4b'}}>{symbol}</p>
                <p className="text-xs mt-0.5 max-w-[180px] truncate" style={{color:'#94a3b8'}}>{name}</p>
                {sector && <p className="text-xs" style={{color:'#94a3b8'}}>{sector}</p>}
              </div>
            </div>
            <button onClick={onClose} disabled={busy}
              style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',padding:4}}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          {price != null && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{borderColor:'#f1f5f9'}}>
              <span className="text-base font-bold" style={{color:'#1e1b4b',fontFamily:'monospace'}}>
                Rs. {price.toLocaleString()}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{background:up?'#f0fdf4':'#fef2f2',color:up?'#16a34a':'#dc2626',border:`1px solid ${up?'#bbf7d0':'#fecaca'}`}}>
                {up?'+':''}{Number(change??0).toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-sm font-semibold mb-3" style={{color:'#1e1b4b'}}>Add {symbol} to watchlist?</p>
          <div className="rounded-lg p-3 mb-4 text-xs space-y-1.5 border" style={{background:'#f8fafc',borderColor:'#e2e8f0',color:'#64748b'}}>
            <div>· Price history loaded automatically</div>
            <div>· Interactive OHLCV chart and data table</div>
            <div>· Real-time price tracking</div>
          </div>
          {err && (
            <div className="text-xs mb-3 p-2 rounded-lg" style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca'}}>{err}</div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} disabled={busy}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{border:'1px solid #e2e8f0',color:'#64748b',background:'white',cursor:'pointer'}}>
              Cancel
            </button>
            <button onClick={add} disabled={busy}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2"
              style={{
                background: busy ? '#a5b4fc' : 'linear-gradient(135deg,#4338ca,#6366f1)',
                border:'none', cursor: busy?'not-allowed':'pointer',
                boxShadow: busy?'none':'0 4px 12px rgba(99,102,241,0.3)',
              }}>
              {busy ? (
                <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>Adding…</>
              ) : 'Add to Watchlist'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}