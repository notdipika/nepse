'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode]     = useState<Mode>('login')
  const [name, setName]     = useState('')
  const [email, setEmail]   = useState('')
  const [password, setPass] = useState('')
  const [loading, setLoad]  = useState(false)
  const [error, setError]   = useState('')
  const [success, setOk]    = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoad(true); setError('')
    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok) { setError(d.error ?? 'Registration failed'); return }
        setOk(true)
        setTimeout(() => { setOk(false); setMode('login'); setName('') }, 2000)
        return
      }
      const r = await signIn('credentials', { email, password, redirect: false })
      if (r?.error) { setError('Invalid email or password'); return }
      router.push('/dashboard'); router.refresh()
    } catch { setError('Something went wrong') }
    finally { setLoad(false) }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14,
    border: '1px solid #e2e8f0', color: '#0f172a', background: '#fafafa',
    outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  return (
    <main className="min-h-screen flex" style={{ background: '#f8fafc' }}>

      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-80 shrink-0 p-10 relative overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)',
        }}>
        {/* Subtle grid texture */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)', backgroundSize: '28px 28px' }}/>

        <div className="relative">
          <div className="flex items-center gap-3 mb-14">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M3 17l4-8 4 4 4-6 4 10H3z"/></svg>
            </div>
            <span className="font-bold text-white text-base tracking-tight">NEPSE Dashboard</span>
          </div>

          <h2 className="text-3xl font-bold text-white leading-snug mb-4" style={{ letterSpacing: '-0.02em' }}>
            Nepal Stock<br/>Exchange<br/>Analytics
          </h2>
          <p className="text-sm leading-relaxed mb-10" style={{ color: 'rgba(199,210,254,0.85)' }}>
            Track real-time OHLCV data, monitor watchlists, and explore historical trends across all NEPSE-listed companies.
          </p>

          <div className="space-y-3">
            {[
              'Full OHLCV history from GitHub archive',
              'Live SQL query builder',
              'Sector-wise analytics',
              'Personal watchlist with charts',
            ].map(f => (
              <div key={f} className="flex items-center gap-3 text-sm" style={{ color: 'rgba(199,210,254,0.9)' }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(129,140,248,0.3)', border: '1px solid rgba(129,140,248,0.5)' }}>
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#a5b4fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                {f}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs" style={{ color: 'rgba(165,180,252,0.6)' }}>DBMS Project · Nepal Stock Exchange</p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-10">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #4338ca, #6366f1)' }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M3 17l4-8 4 4 4-6 4 10H3z"/></svg>
            </div>
            <span className="font-bold text-lg" style={{ color: '#1e1b4b' }}>NEPSE Dashboard</span>
          </div>

          {success && (
            <div className="mb-5 p-4 rounded-xl text-sm text-center"
              style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }}>
              Account created! Redirecting to login…
            </div>
          )}

          <div className="bg-white rounded-2xl p-8" style={{ boxShadow: '0 4px 24px rgba(67,56,202,0.08), 0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e8e6f9' }}>

            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold" style={{ color: '#1e1b4b', letterSpacing: '-0.02em' }}>
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </h1>
              <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
                {mode === 'login' ? 'Sign in to your account' : 'Get started with NEPSE analytics'}
              </p>
            </div>

            {/* Tab */}
            <div className="flex p-1 rounded-xl mb-6" style={{ background: '#f1f0fe' }}>
              {(['login', 'register'] as Mode[]).map(t => (
                <button key={t} onClick={() => { setMode(t); setError('') }}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background:  mode === t ? 'white' : 'transparent',
                    color:       mode === t ? '#4338ca' : '#94a3b8',
                    boxShadow:   mode === t ? '0 1px 4px rgba(67,56,202,0.12)' : 'none',
                    border:      'none', cursor: 'pointer',
                  }}>
                  {t === 'login' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Full Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required style={inp}
                    onFocus={e => { e.target.style.borderColor='#6366f1'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)'; e.target.style.background='white' }}
                    onBlur={e  => { e.target.style.borderColor='#e2e8f0'; e.target.style.boxShadow='none'; e.target.style.background='#fafafa' }}/>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required style={inp}
                  onFocus={e => { e.target.style.borderColor='#6366f1'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)'; e.target.style.background='white' }}
                  onBlur={e  => { e.target.style.borderColor='#e2e8f0'; e.target.style.boxShadow='none'; e.target.style.background='#fafafa' }}/>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Password</label>
                <input type="password" value={password} onChange={e => setPass(e.target.value)} placeholder="••••••••" required minLength={6} style={inp}
                  onFocus={e => { e.target.style.borderColor='#6366f1'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)'; e.target.style.background='white' }}
                  onBlur={e  => { e.target.style.borderColor='#e2e8f0'; e.target.style.boxShadow='none'; e.target.style.background='#fafafa' }}/>
              </div>

              {error && (
                <div className="p-3 rounded-lg text-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl text-white text-sm font-semibold mt-1 transition-all"
                style={{
                  background:  loading ? '#a5b4fc' : 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
                  border:      'none',
                  cursor:      loading ? 'not-allowed' : 'pointer',
                  boxShadow:   loading ? 'none' : '0 4px 14px rgba(99,102,241,0.35)',
                  letterSpacing: '0.01em',
                }}>
                {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-sm mt-5" style={{ color: '#94a3b8' }}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
                className="font-semibold transition-colors"
                style={{ color: '#4338ca', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseOver={e => (e.currentTarget as HTMLElement).style.color = '#6366f1'}
                onMouseOut={e  => (e.currentTarget as HTMLElement).style.color = '#4338ca'}>
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}