'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'

// NEPSE market status — trades Sun–Thu 11:00–15:00 NPT (UTC+5:45)
function MarketBadge() {
  const [label, setLabel] = useState('')
  const [open,  setOpen]  = useState(false)

  useEffect(() => {
    const npt  = new Date(Date.now() + (5 * 60 + 45) * 60 * 1000)
    const day  = npt.getUTCDay()
    const mins = npt.getUTCHours() * 60 + npt.getUTCMinutes()
    const isOpen = day >= 0 && day <= 4 && mins >= 660 && mins < 900
    setOpen(isOpen)

    if (!isOpen) {
      const last = new Date(npt)
      last.setUTCHours(0, 0, 0, 0)
      while (last.getUTCDay() === 5 || last.getUTCDay() === 6) {
        last.setUTCDate(last.getUTCDate() - 1)
      }
      setLabel(`Closed · ${last.toLocaleDateString('en-NP', { month:'short', day:'numeric' })}`)
    } else {
      setLabel('Market Open')
    }
  }, [])

  if (!label) return null
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{
        background:  open ? '#f0fdf4' : '#f8fafc',
        border:      open ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
        color:       open ? '#16a34a' : '#64748b',
      }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: open ? '#22c55e' : '#94a3b8' }}/>
      {label}
    </div>
  )
}

type StartupStatus = 'idle' | 'loading' | 'done' | 'already_has_data' | 'no_loader'

export default function TopBar({ user }: { user?: any }) {
  const router   = useRouter()
  const [q, setQ]             = useState('')
  const [status, setStatus]   = useState<StartupStatus>('idle')
  const [rows,   setRows]     = useState(0)
  const [loaderMsg, setLoaderMsg] = useState('')
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Poll /api/startup until done
  const poll = async () => {
    try {
      const res  = await fetch('/api/startup')
      const data = await res.json()

      if (data.status === 'loading') {
        // Still running — poll again in 4 seconds
        setStatus('loading')
        pollRef.current = setTimeout(poll, 4000)
      } else if (data.status === 'done') {
        setStatus('done'); setRows(data.rows ?? 0)
        setTimeout(() => setStatus('already_has_data'), 6000)
      } else if (data.status === 'already_has_data' || data.status === 'already_done') {
        setStatus('already_has_data')
      } else if (data.status === 'no_loader') {
        setStatus('no_loader'); setLoaderMsg(data.message ?? '')
        setTimeout(() => setStatus('already_has_data'), 12000)
      } else {
        setStatus('already_has_data')
      }
    } catch {
      // Network error — retry in 5s
      pollRef.current = setTimeout(poll, 5000)
    }
  }

  useEffect(() => {
    const key = `nepse_startup_${new Date().toDateString()}`
    if (sessionStorage.getItem(key)) { setStatus('already_has_data'); return }

    setStatus('loading')
    poll()

    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [])

  // Mark done in sessionStorage so we don't re-check today
  useEffect(() => {
    if (status === 'already_has_data') {
      sessionStorage.setItem(`nepse_startup_${new Date().toDateString()}`, '1')
    }
  }, [status])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (q.trim()) {
      router.push(`/dashboard/search?q=${encodeURIComponent(q.trim().toUpperCase())}`)
      setQ('')
    }
  }

  const showBanner = status === 'loading' || status === 'done' || status === 'no_loader'

  return (
    <>
      {/* Data loading banner */}
      {showBanner && (
        <div className="flex items-center gap-3 px-5 py-2 text-xs border-b"
          style={{
            background:  status === 'done'      ? '#f0fdf4'
                       : status === 'no_loader' ? '#fffbeb'
                       : '#eff6ff',
            borderColor: status === 'done'      ? '#bbf7d0'
                       : status === 'no_loader' ? '#fde68a'
                       : '#bfdbfe',
            color:       status === 'done'      ? '#15803d'
                       : status === 'no_loader' ? '#92400e'
                       : '#1d4ed8',
          }}>
          {status === 'loading' && (
            <svg className="animate-spin w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          )}
          {status === 'done'      && <span>✓</span>}
          {status === 'no_loader' && <span>⚠</span>}
          <span>
            {status === 'loading'   && 'Loading 30 days of NEPSE data via load_history.py — this runs once in the background…'}
            {status === 'done'      && `Data ready — ${rows.toLocaleString()} rows loaded into MySQL.`}
            {status === 'no_loader' && loaderMsg}
          </span>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center gap-4 px-5 py-3 border-b bg-white"
        style={{ borderColor: '#e2e8f0' }}>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-sm">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: '#94a3b8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search symbol or company…"
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg outline-none transition-all"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a' }}
              onFocus={e => { e.target.style.borderColor = '#93c5fd'; e.target.style.background = 'white' }}
              onBlur={e  => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc' }}
            />
          </div>
        </form>

        {/* Right */}
        <div className="ml-auto flex items-center gap-3">
          <MarketBadge/>

          {user && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hidden sm:flex"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[11px] font-bold"
                style={{ background: '#2563eb' }}>
                {(user.name || user.email || 'U')[0].toUpperCase()}
              </div>
              <span className="text-xs" style={{ color: '#475569' }}>
                {user.name || user.email}
              </span>
            </div>
          )}

          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
            style={{ border: '1px solid #e2e8f0', color: '#64748b', background: 'white', cursor: 'pointer' }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = '#fca5a5'; (e.currentTarget as HTMLElement).style.color = '#dc2626' }}
            onMouseOut={e  => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLElement).style.color = '#64748b' }}>
            Sign out
          </button>
        </div>
      </header>
    </>
  )
}