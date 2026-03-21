'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/dashboard',           label: 'Dashboard',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/dashboard/analytics', label: 'Analytics',   icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { href: '/dashboard/portfolio', label: 'My Portfolio', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { href: '/dashboard/watchlist', label: 'Watchlist',   icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  { href: '/dashboard/search',    label: 'Search',      icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 flex flex-col h-screen border-r bg-white" style={{ borderColor: '#e2e8f0' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: '#e2e8f0' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: '#2563eb' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
            <path d="M3 17l4-8 4 4 4-6 4 10H3z"/>
          </svg>
        </div>
        <div>
          <div className="text-sm font-bold leading-none" style={{ color: '#0f172a' }}>NEPSE</div>
          <div className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>Dashboard</div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {links.map((link) => {
          const active = pathname === link.href
          return (
            <Link key={link.href} href={link.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background:   active ? '#eff6ff' : 'transparent',
                color:        active ? '#2563eb' : '#475569',
                border:       active ? '1px solid #bfdbfe' : '1px solid transparent',
              }}
              onMouseOver={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
              onMouseOut={e =>  { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                style={{ strokeWidth: active ? 2 : 1.5 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d={link.icon}/>
              </svg>
              {link.label}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: '#2563eb' }}/>}
            </Link>
          )
        })}
      </nav>

      {/* SQL badge */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <span className="text-[10px] font-bold" style={{ color: '#2563eb', fontFamily: 'monospace' }}>SQL</span>
          <span className="text-[11px]" style={{ color: '#64748b' }}>Live query viewer</span>
        </div>
      </div>
    </aside>
  )
}