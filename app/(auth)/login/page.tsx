'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name,email,password}) })
        const d = await res.json().catch(()=>({}))
        if (!res.ok) { setError(d.error ?? 'Registration failed'); return }
        setSuccess(true)
        setTimeout(() => { setSuccess(false); setMode('login'); setName('') }, 2000)
        return
      }
      const r = await signIn('credentials', { email, password, redirect: false })
      if (r?.error) { setError('Invalid email or password'); return }
      router.push('/dashboard'); router.refresh()
    } catch { setError('Something went wrong') }
    finally { setLoading(false) }
  }

  const inp = `w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-[#475569]
    bg-[#0c1120] border border-[#1e2d47] outline-none transition-all
    focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/30`

  return (
    <main className="min-h-screen flex" style={{background:'var(--bg)'}}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-10 border-r border-[#1e2d47]"
        style={{background:'var(--surface)'}}>
        <div>
          <div className="flex items-center gap-3 mb-14">
            <div className="w-9 h-9 rounded-lg bg-[#3b82f6] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M3 17l4-8 4 4 4-6 4 10H3z"/></svg>
            </div>
            <span className="font-semibold text-lg text-white tracking-tight">NEPSE Dashboard</span>
          </div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            Nepal Stock Exchange<br/>Analytics Platform
          </h2>
          <p className="text-[#94a3b8] text-sm leading-relaxed mb-10">
            Track real-time OHLCV data, monitor watchlists, and explore historical trends across all NEPSE-listed companies.
          </p>
          <div className="space-y-3">
            {['30 days of price history via load_history.py','Live SQL query viewer with syntax highlighting','Sector-wise analytics and custom filters','Interactive OHLCV charts per company'].map(f => (
              <div key={f} className="flex items-center gap-3 text-sm text-[#94a3b8]">
                <div className="w-5 h-5 rounded-full bg-[#3b82f6]/20 border border-[#3b82f6]/40 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M2 6l3 3 5-5" stroke="#3b82f6" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                {f}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-[#475569]">DBMS Project · Nepal Stock Exchange</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 justify-center mb-10">
            <div className="w-9 h-9 rounded-lg bg-[#3b82f6] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M3 17l4-8 4 4 4-6 4 10H3z"/></svg>
            </div>
            <span className="font-semibold text-lg text-white">NEPSE Dashboard</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="text-sm text-[#94a3b8]">
              {mode === 'login' ? 'Sign in to your account' : 'Get started with NEPSE analytics'}
            </p>
          </div>

          {/* Tab toggle */}
          <div className="flex p-1 rounded-lg mb-7" style={{background:'var(--surface)', border:'1px solid var(--border)'}}>
            {(['login','register'] as const).map(t => (
              <button key={t} onClick={() => {setMode(t);setError('')}}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                  mode===t ? 'bg-[#3b82f6] text-white shadow-sm' : 'text-[#94a3b8] hover:text-white'}`}>
                {t==='login'?'Sign In':'Register'}
              </button>
            ))}
          </div>

          {success && (
            <div className="mb-5 p-3 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] text-sm text-center">
              Account created! Redirecting to login...
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode==='register' && (
              <div>
                <label className="block text-xs text-[#94a3b8] mb-1.5 font-medium">Full Name</label>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" required className={inp}/>
              </div>
            )}
            <div>
              <label className="block text-xs text-[#94a3b8] mb-1.5 font-medium">Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required className={inp}/>
            </div>
            <div>
              <label className="block text-xs text-[#94a3b8] mb-1.5 font-medium">Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className={inp}/>
            </div>
            {error && (
              <div className="p-3 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] text-sm">{error}</div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors mt-2">
              {loading ? 'Please wait...' : mode==='login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-[#94a3b8] mt-6">
            {mode==='login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}}
              className="text-[#3b82f6] hover:text-[#60a5fa] font-medium transition-colors">
              {mode==='login'?'Sign up':'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </main>
  )
}
