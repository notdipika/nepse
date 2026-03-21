'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Stock {
  symbol: string; name: string; sector: string
  close_price: number; percent_change: number
  open_price: number; high_price: number; low_price: number
  volume: number; turnover: number
}

function Pill({ v }: { v: number }) {
  const up = v >= 0
  return (
    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{
        background: up ? '#f0fdf4' : '#fef2f2',
        color:      up ? '#16a34a' : '#dc2626',
        border:     up ? '1px solid #bbf7d0' : '1px solid #fecaca',
      }}>
      {up ? '▲' : '▼'} {Math.abs(v).toFixed(2)}%
    </span>
  )
}

export default function DashboardPage() {
  const [stocks,      setStocks]      = useState<Stock[]>([])
  const [tradingDate, setTradingDate] = useState('')
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [sectorFilter,setSectorFilter]= useState('all')
  const [sortCol,     setSortCol]     = useState<'turnover'|'change'|'volume'>('turnover')

  useEffect(() => {
    fetch('/api/stocks/all')
      .then(r => r.json())
      .then(d => {
        const rows = Array.isArray(d?.rows) ? d.rows : []
        setTradingDate(d?.tradingDate ?? '')
        setStocks(rows.map((r: any) => ({
          symbol:         String(r.symbol ?? '').toUpperCase(),
          name:           String(r.company_name ?? r.name ?? ''),
          sector:         String(r.sector_name  ?? r.sector  ?? 'Others'),
          close_price:    Number(r.close_price   ?? 0),
          percent_change: Number(r.change_percent ?? r.percent_change ?? 0),
          open_price:     Number(r.open_price  ?? 0),
          high_price:     Number(r.high_price  ?? 0),
          low_price:      Number(r.low_price   ?? 0),
          volume:         Number(r.volume      ?? 0),
          turnover:       Number(r.turnover    ?? 0),
        })))
      })
      .catch(() => setError('Failed to load market data'))
      .finally(() => setLoading(false))
  }, [])

  // Derived stats
  const gainers    = stocks.filter(s => s.percent_change > 0).sort((a,b) => b.percent_change - a.percent_change)
  const losers     = stocks.filter(s => s.percent_change < 0).sort((a,b) => a.percent_change - b.percent_change)
  const neutral    = stocks.filter(s => s.percent_change === 0)
  const totalTurn  = stocks.reduce((s,r) => s + r.turnover, 0)
  const avgChange  = stocks.length ? stocks.reduce((s,r) => s + r.percent_change, 0) / stocks.length : 0
  const gainTurn   = gainers.reduce((s,r) => s + r.turnover, 0)
  const lossTurn   = losers.reduce((s,r)  => s + r.turnover, 0)

  // Sector breakdown
  const sectors    = Array.from(new Set(stocks.map(s => s.sector))).sort()
  const sectorData = sectors.map(sec => {
    const ss = stocks.filter(s => s.sector === sec)
    return {
      sec, count: ss.length,
      g: ss.filter(s => s.percent_change > 0).length,
      l: ss.filter(s => s.percent_change < 0).length,
      avg: ss.length ? ss.reduce((a,s) => a + s.percent_change, 0) / ss.length : 0,
      turn: ss.reduce((a,s) => a + s.turnover, 0),
    }
  }).sort((a,b) => b.turn - a.turn)

  // Filtered + sorted table
  const tableData = stocks
    .filter(s => sectorFilter === 'all' || s.sector === sectorFilter)
    .sort((a,b) => {
      if (sortCol === 'turnover') return b.turnover - a.turnover
      if (sortCol === 'change')   return Math.abs(b.percent_change) - Math.abs(a.percent_change)
      return b.volume - a.volume
    })

  const Cr  = (v: number) => `Rs.${(v/1e7).toFixed(2)}Cr`
  const Rs  = (v: number) => `Rs.${v.toLocaleString('en-NP',{maximumFractionDigits:2})}`

  const todayNPT = new Date(Date.now()+(5*60+45)*60*1000).toISOString().split('T')[0]
  const isToday  = tradingDate === todayNPT

  // Loading state
  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-sm" style={{ color: '#94a3b8' }}>
      <svg className="animate-spin w-5 h-5" style={{ color: '#2563eb' }} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      Loading market data…
    </div>
  )

  // Empty state
  if (!loading && stocks.length === 0) return (
    <div className="max-w-xl mx-auto mt-16 text-center">
      <div className="bg-white rounded-2xl border p-10" style={{ borderColor: '#e2e8f0' }}>
        <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
          style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <svg className="w-7 h-7" style={{ color: '#2563eb' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: '#0f172a' }}>No market data yet</h2>
        <p className="text-sm mb-5" style={{ color: '#64748b' }}>
          Run this in your terminal to load 30 days of NEPSE data:
        </p>
        <code className="block rounded-lg px-5 py-3 text-sm text-left"
          style={{ background: '#0f172a', color: '#4ade80', fontFamily: 'monospace' }}>
          python load_history.py --days 30
        </code>
        <p className="text-xs mt-4" style={{ color: '#94a3b8' }}>
          Data auto-loads on next login once the command finishes.
        </p>
      </div>
    </div>
  )

  return (
    <div className="space-y-5 max-w-screen-xl mx-auto">

      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#0f172a' }}>Market Overview</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
            {stocks.length} companies &middot; {isToday ? 'Today' : 'Last session'} &middot; {tradingDate}
          </p>
        </div>
        {!isToday && tradingDate && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Market closed — showing {tradingDate}
          </div>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Turnover',   value: Cr(totalTurn),          sub: `${stocks.length} companies`,          blue: true  },
          { label: 'Gainers',          value: gainers.length.toString(), sub: `${Cr(gainTurn)} turnover`,          green: true },
          { label: 'Losers',           value: losers.length.toString(),  sub: `${Cr(lossTurn)} turnover`,          red: true   },
          { label: 'Market Sentiment', value: `${avgChange>=0?'+':''}${avgChange.toFixed(2)}%`,
            sub: `${neutral.length} unchanged`, green: avgChange > 0, red: avgChange < 0 },
        ].map(({ label, value, sub, blue, green, red }) => (
          <div key={label} className="bg-white rounded-xl border p-5" style={{ borderColor: '#e2e8f0' }}>
            <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#64748b' }}>{label}</p>
            <p className="text-2xl font-bold"
              style={{ color: blue ? '#2563eb' : green ? '#16a34a' : red ? '#dc2626' : '#0f172a' }}>
              {value}
            </p>
            <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Gainers + Losers */}
      <div className="grid md:grid-cols-2 gap-4">
        {[
          { title: 'Top Gainers', data: gainers.slice(0,8), color: '#16a34a', bg: '#f0fdf4', bd: '#bbf7d0' },
          { title: 'Top Losers',  data: losers.slice(0,8),  color: '#dc2626', bg: '#fef2f2', bd: '#fecaca' },
        ].map(({ title, data, color, bg, bd }) => (
          <div key={title} className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
            <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: '#f1f5f9' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: color }}/>
              <h2 className="text-sm font-semibold" style={{ color: '#0f172a' }}>{title}</h2>
              <span className="ml-auto text-xs" style={{ color: '#94a3b8' }}>{tradingDate}</span>
            </div>
            {data.length === 0
              ? <p className="p-8 text-center text-sm" style={{ color: '#94a3b8' }}>No data</p>
              : <div className="divide-y" style={{ borderColor: '#f8fafc' }}>
                  {data.map(s => (
                    <Link key={s.symbol} href={`/dashboard/stock/${s.symbol}`}
                      className="flex items-center justify-between px-5 py-3 transition-colors"
                      style={{ textDecoration: 'none' }}
                      onMouseOver={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                      onMouseOut={e  => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: bg, border: `1px solid ${bd}`, color }}>
                          {s.symbol.slice(0,2)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#0f172a' }}>{s.symbol}</p>
                          <p className="text-xs truncate max-w-[120px]" style={{ color: '#94a3b8' }}>
                            {s.sector.split(' ').slice(0,2).join(' ')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold" style={{ color: '#0f172a', fontFamily: 'monospace' }}>
                          {Rs(s.close_price)}
                        </p>
                        <Pill v={s.percent_change}/>
                      </div>
                    </Link>
                  ))}
                </div>
            }
          </div>
        ))}
      </div>

      {/* Sector breakdown */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
        <div className="px-5 py-3.5 border-b" style={{ borderColor: '#f1f5f9' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#0f172a' }}>
            Sector Breakdown
            <span className="text-xs font-normal ml-2" style={{ color: '#94a3b8' }}>
              click a row to filter the table below
            </span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium border-b"
                style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#64748b' }}>
                {['Sector','Companies','Gainers','Losers','Avg Change','Turnover'].map(h => (
                  <th key={h} className="text-left px-5 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectorData.map(s => (
                <tr key={s.sec}
                  className="border-b cursor-pointer transition-colors"
                  style={{
                    borderColor: '#f1f5f9',
                    background: sectorFilter === s.sec ? '#eff6ff' : 'transparent',
                  }}
                  onClick={() => setSectorFilter(sectorFilter === s.sec ? 'all' : s.sec)}
                  onMouseOver={e => { if (sectorFilter !== s.sec) (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
                  onMouseOut={e  => { if (sectorFilter !== s.sec) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <td className="px-5 py-2.5 font-medium"
                    style={{ color: sectorFilter === s.sec ? '#2563eb' : '#0f172a' }}>
                    {s.sec}
                  </td>
                  <td className="px-5 py-2.5" style={{ color: '#475569' }}>{s.count}</td>
                  <td className="px-5 py-2.5 font-medium" style={{ color: '#16a34a' }}>{s.g}</td>
                  <td className="px-5 py-2.5 font-medium" style={{ color: '#dc2626' }}>{s.l}</td>
                  <td className="px-5 py-2.5 font-semibold text-xs"
                    style={{ color: s.avg >= 0 ? '#16a34a' : '#dc2626', fontFamily: 'monospace' }}>
                    {s.avg >= 0 ? '+' : ''}{s.avg.toFixed(2)}%
                  </td>
                  <td className="px-5 py-2.5" style={{ color: '#64748b', fontFamily: 'monospace' }}>
                    {Cr(s.turn)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* All companies table */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b flex-wrap gap-3"
          style={{ borderColor: '#f1f5f9' }}>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold" style={{ color: '#0f172a' }}>All Companies</h2>
            <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
              className="text-xs rounded-md px-2 py-1 outline-none"
              style={{ border: '1px solid #e2e8f0', color: '#475569', background: 'white' }}>
              <option value="all">All Sectors</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            {(['turnover','change','volume'] as const).map(c => (
              <button key={c} onClick={() => setSortCol(c)}
                className="text-xs px-2.5 py-1 rounded-md font-medium transition-all"
                style={{
                  background:  sortCol === c ? '#eff6ff' : 'white',
                  color:       sortCol === c ? '#2563eb' : '#64748b',
                  border:      sortCol === c ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                }}>
                {c.charAt(0).toUpperCase()+c.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium border-b"
                style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#64748b' }}>
                {['Symbol','Company','Sector','Open','High','Low','Close','Change','Volume','Turnover'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map(s => (
                <tr key={s.symbol}
                  className="border-b cursor-pointer transition-colors"
                  style={{ borderColor: '#f8fafc' }}
                  onClick={() => window.location.href = `/dashboard/stock/${s.symbol}`}
                  onMouseOver={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                  onMouseOut={e  => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/stock/${s.symbol}`}
                      onClick={e => e.stopPropagation()}
                      className="font-bold"
                      style={{ color: '#2563eb', textDecoration: 'none' }}>
                      {s.symbol}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 max-w-[160px] truncate" style={{ color: '#475569' }}>{s.name}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                      {s.sector.split(' ').slice(0,2).join(' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: '#64748b', fontFamily:'monospace' }}>{s.open_price.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-xs font-medium" style={{ color: '#16a34a', fontFamily:'monospace' }}>{s.high_price.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-xs font-medium" style={{ color: '#dc2626', fontFamily:'monospace' }}>{s.low_price.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: '#0f172a', fontFamily:'monospace' }}>{s.close_price.toFixed(2)}</td>
                  <td className="px-4 py-2.5"><Pill v={s.percent_change}/></td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: '#64748b', fontFamily:'monospace' }}>{s.volume.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: '#64748b', fontFamily:'monospace' }}>Rs.{(s.turnover/1e6).toFixed(2)}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t" style={{ borderColor: '#f1f5f9', background: '#f8fafc' }}>
          <p className="text-xs" style={{ color: '#94a3b8' }}>
            {tableData.length} companies &middot; prices as of {tradingDate}
          </p>
        </div>
      </div>
    </div>
  )
}