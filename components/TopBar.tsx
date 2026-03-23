'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'

/* ─── Types ──────────────────────────────────────────────── */
interface TopBarUser {
  name?: string | null
  email?: string | null
  image?: string | null
}

type StartupStatus = 'idle' | 'checking' | 'running' | 'done' | 'already' | 'no_pipeline' | 'error'

interface StartupState {
  status: StartupStatus
  message?: string
  inserted?: number
}

/* ─── Helpers ────────────────────────────────────────────── */
/** Returns current time in Nepal time (UTC+5:45) */
function nptNow() {
  return new Date(Date.now() + (5 * 60 + 45) * 60 * 1000)
}

/* ─── Market open/closed badge ───────────────────────────── */
function MarketBadge() {
  const [open, setOpen] = useState<boolean | null>(null)

  useEffect(() => {
    const npt = nptNow()
    const day = npt.getUTCDay()               // 0=Sun … 6=Sat
    const mins = npt.getUTCHours() * 60 + npt.getUTCMinutes()
    // NEPSE trades Sun–Thu, 11:00–15:00 NPT
    setOpen(day >= 0 && day <= 4 && mins >= 11 * 60 && mins < 15 * 60)
  }, [])

  if (open === null) return null

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
        open
          ? 'bg-green-50 border-green-200 text-green-700'
          : 'bg-slate-100 border-slate-200 text-slate-500'
      }`}
    >
      <span className="relative flex h-2 w-2">
        {open && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${open ? 'bg-green-500' : 'bg-slate-400'}`} />
      </span>
      {open ? 'Market Open' : 'Market Closed'}
    </div>
  )
}

/* ─── Startup banner ─────────────────────────────────────── */
const BANNER_MESSAGES: Record<string, string> = {
  checking:    'Checking database…',
  running:     'Loading data into MySQL…',
  no_pipeline: '',   // set dynamically
}

function StartupBanner({ startup }: { startup: StartupState }) {
  const { status, inserted, message } = startup

  const colorClass =
    status === 'no_pipeline'
      ? 'bg-amber-50 border-amber-200 text-amber-700'
      : status === 'done'
      ? 'bg-green-50 border-green-200 text-green-700'
      : 'bg-blue-50 border-blue-200 text-blue-700'

  const text =
    status === 'done'
      ? `Loaded ${inserted?.toLocaleString()} rows into MySQL`
      : status === 'no_pipeline'
      ? `Pipeline not found: ${message}`
      : BANNER_MESSAGES[status] ?? ''

  return (
    <div className={`px-6 py-2 text-xs flex items-center gap-3 border-b ${colorClass}`}>
      {(status === 'checking' || status === 'running') && (
        <svg className="animate-spin w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity={0.25} />
          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity={0.75} />
        </svg>
      )}
      {status === 'done'        && <span>✓</span>}
      {status === 'no_pipeline' && <span>⚠</span>}
      <span>{text}</span>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   TOP BAR
════════════════════════════════════════════════════════════ */
export default function TopBar({ user }: { user?: TopBarUser }) {
  const router  = useRouter()
  const [startup, setStartup] = useState<StartupState>({ status: 'idle' })
  const [query,   setQuery]   = useState('')

  /* One-time startup check per browser session */
  useEffect(() => {
    const alreadyRan = sessionStorage.getItem('nepse_startup_ran')
    if (alreadyRan) {
      setStartup({ status: 'already' })
      return
    }

    setStartup({ status: 'checking' })

    fetch('/api/startup')
      .then(r => r.json())
      .then((d: { status?: string; inserted?: number; message?: string }) => {
        sessionStorage.setItem('nepse_startup_ran', '1')

        if (d.status === 'already_done' || d.status === 'already_has_data') {
          setStartup({ status: 'already' })
        } else if (d.status === 'done') {
          setStartup({ status: 'done', inserted: d.inserted })
          setTimeout(() => setStartup({ status: 'already' }), 5000)
        } else if (d.status === 'no_loader') {
          setStartup({ status: 'no_pipeline', message: d.message })
        } else {
          setStartup({ status: 'already' })
        }
      })
      .catch(() => setStartup({ status: 'already' }))
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q) router.push(`/dashboard/search?q=${encodeURIComponent(q.toUpperCase())}`)
  }

  const showBanner = ['checking', 'running', 'done', 'no_pipeline'].includes(startup.status)
  const displayName = user?.name ?? user?.email ?? null

  return (
    <>
      {showBanner && <StartupBanner startup={startup} />}

      <header
        className="flex items-center justify-between border-b px-6 py-3 gap-4"
        style={{ borderColor: '#e2e8f0', background: 'white' }}
      >
        {/* Brand */}
        <div className="shrink-0">
          <h1 className="text-base font-bold" style={{ color: '#1e1b4b' }}>NEPSE Dashboard</h1>
          <p className="text-[10px]" style={{ color: '#94a3b8' }}>Nepal Stock Exchange · MySQL</p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-sm">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
              style={{ color: '#94a3b8' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search symbol or company… (Enter)"
              className="w-full pl-8 pr-3 py-2 text-xs rounded-lg outline-none transition-colors"
              style={{ border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f172a' }}
              onFocus={e => { e.target.style.borderColor = '#c7d2fe'; e.target.style.background = 'white' }}
              onBlur={e  => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc' }}
            />
          </div>
        </form>

        {/* Right side */}
        <div className="flex items-center gap-3 shrink-0">
          <MarketBadge />

          {displayName && (
            <div className="hidden md:flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ background: 'linear-gradient(135deg,#4338ca,#6366f1)', color: 'white' }}
                aria-hidden
              >
                {displayName[0].toUpperCase()}
              </div>
              <span className="text-xs" style={{ color: '#475569' }}>{displayName}</span>
            </div>
          )}

          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
            style={{ background: '#dc2626', border: 'none', cursor: 'pointer' }}
            onMouseOver={e => (e.currentTarget as HTMLElement).style.background = '#b91c1c'}
            onMouseOut={e  => (e.currentTarget as HTMLElement).style.background = '#dc2626'}
          >
            Sign Out
          </button>
        </div>
      </header>
    </>
  )
}