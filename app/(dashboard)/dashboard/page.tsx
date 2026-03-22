'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, BarChart, Bar,
} from 'recharts'

interface Stock {
  symbol: string; name: string; sector: string
  close_price: number; percent_change: number
  open_price: number; high_price: number; low_price: number
  volume: number; turnover: number
}

const N  = (v: unknown) => { const n=Number(v); return Number.isFinite(n)?n:0 }
const Cr = (v: number)  => `Rs.${(v/1e7).toFixed(2)}Cr`
const Rs = (v: number)  => `Rs.${v.toLocaleString('en-NP',{maximumFractionDigits:2})}`

function Badge({ v }: { v: number }) {
  const up = v >= 0
  return (
    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background:up?'#f0fdf4':'#fef2f2', color:up?'#16a34a':'#dc2626', border:`1px solid ${up?'#bbf7d0':'#fecaca'}` }}>
      {up?'▲':'▼'} {Math.abs(v).toFixed(2)}%
    </span>
  )
}

function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.04) return null
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * Math.PI / 180)
  const y = cy + r * Math.sin(-midAngle * Math.PI / 180)
  return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={600}>{(percent*100).toFixed(0)}%</text>
}

function PieTip({ active, payload }: any) {
  if (!active||!payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border rounded-lg p-2.5 text-xs shadow-md" style={{ borderColor:'#e2e8f0' }}>
      <p className="font-semibold mb-0.5" style={{ color:'#0f172a' }}>{d.name}</p>
      <p style={{ color:'#64748b' }}>{d.value} companies · {Cr(d.payload.turn)}</p>
    </div>
  )
}

const SECTOR_COLORS = [
  '#4338ca','#0891b2','#059669','#d97706','#dc2626',
  '#7c3aed','#db2777','#65a30d','#ea580c','#0284c7',
  '#6d28d9','#047857','#b45309','#9f1239','#1d4ed8','#0f766e','#7e22ce',
]

export default function DashboardPage() {
  const [stocks,       setStocks]       = useState<Stock[]>([])
  const [tradingDate,  setTradingDate]  = useState('')
  const [loading,      setLoading]      = useState(true)
  const [sectorFilter, setSectorFilter] = useState('all')
  const [sortCol,      setSortCol]      = useState<'turnover'|'change'|'volume'>('turnover')
  const [activeChart,  setActiveChart]  = useState<'pie'|'bar'>('pie')

  useEffect(() => {
    fetch('/api/stocks/all').then(r=>r.json()).then(d => {
      const rows = Array.isArray(d?.rows)?d.rows:Array.isArray(d)?d:[]
      setTradingDate(d?.tradingDate??'')
      setStocks(rows.map((r:any) => ({
        symbol:         String(r.symbol??'').toUpperCase(),
        name:           String(r.company_name??r.name??''),
        sector:         String(r.sector_name??r.sector??'Others'),
        close_price:    N(r.close_price),
        percent_change: N(r.change_percent??r.percent_change),
        open_price:     N(r.open_price),
        high_price:     N(r.high_price),
        low_price:      N(r.low_price),
        volume:         N(r.volume),
        turnover:       N(r.turnover),
      })))
    }).finally(()=>setLoading(false))
  },[])

  const gainers   = useMemo(()=>stocks.filter(s=>s.percent_change>0).sort((a,b)=>b.percent_change-a.percent_change),[stocks])
  const losers    = useMemo(()=>stocks.filter(s=>s.percent_change<0).sort((a,b)=>a.percent_change-b.percent_change),[stocks])
  const neutral   = useMemo(()=>stocks.filter(s=>s.percent_change===0),[stocks])
  const totalTurn = useMemo(()=>stocks.reduce((s,r)=>s+r.turnover,0),[stocks])
  const gainTurn  = useMemo(()=>gainers.reduce((s,r)=>s+r.turnover,0),[gainers])
  const lossTurn  = useMemo(()=>losers.reduce((s,r)=>s+r.turnover,0),[losers])
  const avgChange = useMemo(()=>stocks.length?stocks.reduce((s,r)=>s+r.percent_change,0)/stocks.length:0,[stocks])
  const sectors   = useMemo(()=>Array.from(new Set(stocks.map(s=>s.sector))).sort(),[stocks])

  const sectorStats = useMemo(()=>sectors.map((sec,i)=>{
    const ss=stocks.filter(s=>s.sector===sec)
    return { sec, count:ss.length, g:ss.filter(s=>s.percent_change>0).length,
      l:ss.filter(s=>s.percent_change<0).length,
      avg:ss.length?ss.reduce((a,s)=>a+s.percent_change,0)/ss.length:0,
      turn:ss.reduce((a,s)=>a+s.turnover,0), color:SECTOR_COLORS[i%SECTOR_COLORS.length] }
  }).sort((a,b)=>b.turn-a.turn),[stocks,sectors])

  const rangeData = useMemo(()=>
    [...stocks].sort((a,b)=>b.turnover-a.turnover).slice(0,15).map(s=>({
      symbol:s.symbol, high:s.high_price, low:s.low_price,
      range:s.high_price-s.low_price, up:s.close_price>=s.open_price,
    })),[stocks])

  const filtered = useMemo(()=>stocks
    .filter(s=>sectorFilter==='all'||s.sector===sectorFilter)
    .sort((a,b)=>sortCol==='turnover'?b.turnover-a.turnover:sortCol==='change'?Math.abs(b.percent_change)-Math.abs(a.percent_change):b.volume-a.volume)
  ,[stocks,sectorFilter,sortCol])

  const todayNPT = new Date(Date.now()+(5*60+45)*60*1000).toISOString().split('T')[0]

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-sm" style={{ color:'#94a3b8' }}>
      <svg className="animate-spin w-5 h-5" style={{ color:'#4338ca' }} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      Loading market data…
    </div>
  )

  if (stocks.length===0) return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <div className="bg-white rounded-2xl border p-10" style={{ borderColor:'#e2e8f0' }}>
        <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
          style={{ background:'linear-gradient(135deg,#eef2ff,#e0e7ff)', border:'1px solid #c7d2fe' }}>
          <svg className="w-7 h-7" style={{ color:'#4338ca' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <h2 className="text-lg font-semibold mb-2" style={{ color:'#1e1b4b' }}>No market data yet</h2>
        <p className="text-sm mb-5" style={{ color:'#64748b' }}>Run this to load data from the GitHub archive:</p>
        <code className="block rounded-lg px-5 py-3 text-sm text-left" style={{ background:'#1e1b4b', color:'#a5b4fc', fontFamily:'monospace' }}>
          .venv/bin/python load_history.py --excel
        </code>
      </div>
    </div>
  )

  return (
    <div className="space-y-5 max-w-screen-xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color:'#1e1b4b' }}>Market Overview</h1>
          <p className="text-sm mt-0.5" style={{ color:'#64748b' }}>
            {stocks.length} companies · {tradingDate===todayNPT?'Today':'Last session'} · {tradingDate}
          </p>
        </div>
        {tradingDate && tradingDate!==todayNPT && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background:'#fffbeb', border:'1px solid #fde68a', color:'#92400e' }}>
            ⚠ Market closed — showing {tradingDate}
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Total Turnover',   value:Cr(totalTurn),                                    sub:`${stocks.length} companies`,  accent:'#4338ca' },
          { label:'Gainers',          value:String(gainers.length),                           sub:`${Cr(gainTurn)} turnover`,     accent:'#16a34a' },
          { label:'Losers',           value:String(losers.length),                            sub:`${Cr(lossTurn)} turnover`,     accent:'#dc2626' },
          { label:'Market Sentiment', value:`${avgChange>=0?'+':''}${avgChange.toFixed(2)}%`, sub:`${neutral.length} unchanged`,  accent:avgChange>=0?'#16a34a':'#dc2626' },
        ].map(({label,value,sub,accent})=>(
          <div key={label} className="bg-white rounded-xl border p-5" style={{ borderColor:'#e2e8f0' }}>
            <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color:'#64748b' }}>{label}</p>
            <p className="text-2xl font-bold" style={{ color:accent }}>{value}</p>
            <p className="text-xs mt-1" style={{ color:'#94a3b8' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Sector pie */}
        <div className="bg-white rounded-xl border p-5" style={{ borderColor:'#e2e8f0' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color:'#1e1b4b' }}>Sector Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={sectorStats} dataKey="count" nameKey="sec" cx="50%" cy="50%"
                innerRadius={45} outerRadius={80} labelLine={false} label={PieLabel}>
                {sectorStats.map((s,i)=><Cell key={s.sec} fill={s.color}/>)}
              </Pie>
              <ReTooltip content={<PieTip/>}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 max-h-28 overflow-y-auto">
            {sectorStats.slice(0,10).map(s=>(
              <div key={s.sec} className="flex items-center gap-1.5 text-xs truncate" style={{ color:'#475569' }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background:s.color }}/>
                <span className="truncate">{s.sec.split(' ').slice(0,2).join(' ')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Market breadth donut */}
        <div className="bg-white rounded-xl border p-5" style={{ borderColor:'#e2e8f0' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color:'#1e1b4b' }}>Market Breadth</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={[
                { name:'Gainers', value:gainers.length, turn:gainTurn },
                { name:'Losers',  value:losers.length,  turn:lossTurn },
                { name:'Neutral', value:neutral.length,  turn:0 },
              ]} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} labelLine={false} label={PieLabel}>
                <Cell fill="#16a34a"/><Cell fill="#dc2626"/><Cell fill="#94a3b8"/>
              </Pie>
              <ReTooltip formatter={(v:any,n:any)=>[`${v} companies`,n]}
                contentStyle={{ background:'white', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12 }}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-5 mt-2">
            {[['#16a34a','Gainers',gainers.length],['#dc2626','Losers',losers.length],['#94a3b8','Neutral',neutral.length]].map(([c,l,v])=>(
              <div key={String(l)} className="flex items-center gap-1.5 text-xs" style={{ color:'#475569' }}>
                <span className="w-2 h-2 rounded-full" style={{ background:String(c) }}/>
                {l}: <span className="font-semibold" style={{ color:'#0f172a' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top 10 turnover bar */}
        <div className="bg-white rounded-xl border p-5" style={{ borderColor:'#e2e8f0' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color:'#1e1b4b' }}>Top 10 by Turnover</h2>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={[...stocks].sort((a,b)=>b.turnover-a.turnover).slice(0,10)}
              layout="vertical" margin={{top:0,right:8,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
              <XAxis type="number" tick={{fill:'#94a3b8',fontSize:9}} tickLine={false} axisLine={false}
                tickFormatter={v=>`${(v/1e7).toFixed(1)}Cr`}/>
              <YAxis type="category" dataKey="symbol" tick={{fill:'#475569',fontSize:10}} tickLine={false} axisLine={false} width={48}/>
              <ReTooltip formatter={(v:any)=>[`Rs.${Number(v).toLocaleString()}`,'Turnover']}
                contentStyle={{ background:'white', border:'1px solid #e2e8f0', borderRadius:8, fontSize:11 }}/>
              <Bar dataKey="turnover" radius={[0,3,3,0]}>
                {[...stocks].sort((a,b)=>b.turnover-a.turnover).slice(0,10).map((s,i)=>(
                  <Cell key={s.symbol} fill={s.percent_change>=0?'#4338ca':'#7c3aed'} fillOpacity={1-i*0.06}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie / Range toggle panel */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor:'#e2e8f0' }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor:'#f1f5f9' }}>
          <h2 className="text-sm font-semibold" style={{ color:'#1e1b4b' }}>
            {activeChart==='pie' ? 'Sector Turnover Share' : 'Top 15 — Price Range (High–Low)'}
          </h2>
          <div className="flex gap-2">
            {([['pie','Pie'],['bar','Range']] as const).map(([k,l])=>(
              <button key={k} onClick={()=>setActiveChart(k)}
                className="text-xs px-2.5 py-1 rounded-md border font-medium transition-all"
                style={{ background:activeChart===k?'#eef2ff':'white', color:activeChart===k?'#4338ca':'#64748b', borderColor:activeChart===k?'#c7d2fe':'#e2e8f0', cursor:'pointer' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="p-5">
          {activeChart==='pie' && (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={sectorStats} dataKey="turn" nameKey="sec" cx="50%" cy="50%"
                  innerRadius={60} outerRadius={110} labelLine={false} label={PieLabel}>
                  {sectorStats.map(s=><Cell key={s.sec} fill={s.color}/>)}
                </Pie>
                <ReTooltip content={<PieTip/>}/>
              </PieChart>
            </ResponsiveContainer>
          )}
          {activeChart==='bar' && (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={rangeData} margin={{top:4,right:4,left:0,bottom:20}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="symbol" tick={{fill:'#94a3b8',fontSize:10}} tickLine={false} axisLine={false} angle={-35} textAnchor="end" interval={0}/>
                <YAxis tick={{fill:'#94a3b8',fontSize:10}} tickLine={false} axisLine={false} tickFormatter={v=>`Rs.${v}`} width={55}/>
                <ReTooltip formatter={(_:any,__:any,p:any)=>[`H: Rs.${p.payload.high} / L: Rs.${p.payload.low}`,'Range']}
                  contentStyle={{ background:'white', border:'1px solid #e2e8f0', borderRadius:8, fontSize:11 }}/>
                <Bar dataKey="range" radius={[3,3,0,0]}>
                  {rangeData.map(d=>(
                    <Cell key={d.symbol} fill={d.up?'#4338ca':'#dc2626'}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Gainers + Losers */}
      <div className="grid md:grid-cols-2 gap-4">
        {[
          { title:'Top Gainers', data:gainers.slice(0,10) },
          { title:'Top Losers',  data:losers.slice(0,10)  },
        ].map(({title,data})=>(
          <div key={title} className="bg-white rounded-xl border overflow-hidden" style={{ borderColor:'#e2e8f0' }}>
            <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor:'#f1f5f9' }}>
              <h2 className="text-sm font-semibold" style={{ color:'#1e1b4b' }}>{title}</h2>
              <span className="text-xs" style={{ color:'#94a3b8' }}>{tradingDate}</span>
            </div>
            {data.length===0
              ? <p className="p-8 text-center text-sm" style={{ color:'#94a3b8' }}>No data</p>
              : <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs font-medium border-b" style={{ background:'#f8fafc', borderColor:'#f1f5f9', color:'#64748b' }}>
                      <th className="text-left px-5 py-2">Symbol</th>
                      <th className="text-left px-4 py-2">Company</th>
                      <th className="text-right px-5 py-2">Price</th>
                      <th className="text-right px-5 py-2">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map(s=>(
                      <tr key={s.symbol} className="border-b transition-colors" style={{ borderColor:'#f8fafc' }}
                        onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='#f8fafc'}
                        onMouseOut={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                        <td className="px-5 py-2.5">
                          <Link href={`/dashboard/stock/${s.symbol}`}
                            style={{ color:'#4338ca', fontWeight:700, textDecoration:'none' }}>{s.symbol}</Link>
                        </td>
                        <td className="px-4 py-2.5 max-w-[120px] truncate text-xs" style={{ color:'#94a3b8' }}>{s.name}</td>
                        <td className="px-5 py-2.5 text-right text-xs font-semibold" style={{ color:'#0f172a', fontFamily:'monospace' }}>{Rs(s.close_price)}</td>
                        <td className="px-5 py-2.5 text-right"><Badge v={s.percent_change}/></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        ))}
      </div>

      {/* Sector table */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor:'#e2e8f0' }}>
        <div className="px-5 py-3.5 border-b" style={{ borderColor:'#f1f5f9' }}>
          <h2 className="text-sm font-semibold" style={{ color:'#1e1b4b' }}>
            Sector Breakdown <span className="text-xs font-normal ml-1" style={{ color:'#94a3b8' }}>· click to filter companies below</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium border-b" style={{ background:'#f8fafc', borderColor:'#e2e8f0', color:'#64748b' }}>
                {['Sector','Companies','Gainers','Losers','Avg Change','Turnover'].map(h=>(
                  <th key={h} className="text-left px-5 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectorStats.map(s=>(
                <tr key={s.sec} className="border-b cursor-pointer transition-colors"
                  style={{ borderColor:'#f8fafc', background:sectorFilter===s.sec?'#eef2ff':'transparent' }}
                  onClick={()=>setSectorFilter(sectorFilter===s.sec?'all':s.sec)}
                  onMouseOver={e=>{ if(sectorFilter!==s.sec)(e.currentTarget as HTMLElement).style.background='#f8fafc' }}
                  onMouseOut={e=>{ if(sectorFilter!==s.sec)(e.currentTarget as HTMLElement).style.background='transparent' }}>
                  <td className="px-5 py-2.5 font-medium" style={{ color:sectorFilter===s.sec?'#4338ca':'#0f172a' }}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background:s.color }}/>
                      {s.sec}
                    </div>
                  </td>
                  <td className="px-5 py-2.5" style={{ color:'#475569' }}>{s.count}</td>
                  <td className="px-5 py-2.5 font-medium" style={{ color:'#16a34a' }}>{s.g}</td>
                  <td className="px-5 py-2.5 font-medium" style={{ color:'#dc2626' }}>{s.l}</td>
                  <td className="px-5 py-2.5 font-semibold text-xs" style={{ color:s.avg>=0?'#16a34a':'#dc2626', fontFamily:'monospace' }}>
                    {s.avg>=0?'+':''}{s.avg.toFixed(2)}%
                  </td>
                  <td className="px-5 py-2.5 text-xs" style={{ color:'#64748b', fontFamily:'monospace' }}>{Cr(s.turn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* All companies */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor:'#e2e8f0' }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b flex-wrap gap-3" style={{ borderColor:'#f1f5f9' }}>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold" style={{ color:'#1e1b4b' }}>All Companies</h2>
            <select value={sectorFilter} onChange={e=>setSectorFilter(e.target.value)}
              className="text-xs rounded-md px-2 py-1 outline-none"
              style={{ border:'1px solid #e2e8f0', color:'#475569', background:'white' }}>
              <option value="all">All Sectors</option>
              {sectors.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            {(['turnover','change','volume'] as const).map(c=>(
              <button key={c} onClick={()=>setSortCol(c)}
                className="text-xs px-2.5 py-1 rounded-md font-medium transition-all"
                style={{ background:sortCol===c?'#eef2ff':'white', color:sortCol===c?'#4338ca':'#64748b', border:`1px solid ${sortCol===c?'#c7d2fe':'#e2e8f0'}`, cursor:'pointer' }}>
                {c.charAt(0).toUpperCase()+c.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium border-b" style={{ background:'#f8fafc', borderColor:'#e2e8f0', color:'#64748b' }}>
                {['Symbol','Company','Sector','Open','High','Low','Close','Change','Volume','Turnover'].map(h=>(
                  <th key={h} className="text-left px-4 py-2.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s=>(
                <tr key={s.symbol} className="border-b cursor-pointer transition-colors" style={{ borderColor:'#f8fafc' }}
                  onClick={()=>window.location.href=`/dashboard/stock/${s.symbol}`}
                  onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='#f8fafc'}
                  onMouseOut={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/stock/${s.symbol}`} onClick={e=>e.stopPropagation()}
                      style={{ color:'#4338ca', fontWeight:700, textDecoration:'none' }}>{s.symbol}</Link>
                  </td>
                  <td className="px-4 py-2.5 max-w-[150px] truncate" style={{ color:'#475569' }}>{s.name}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:'#eef2ff', color:'#4338ca', border:'1px solid #c7d2fe' }}>
                      {s.sector.split(' ').slice(0,2).join(' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color:'#64748b',fontFamily:'monospace' }}>{s.open_price.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-xs font-medium" style={{ color:'#16a34a',fontFamily:'monospace' }}>{s.high_price.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-xs font-medium" style={{ color:'#dc2626',fontFamily:'monospace' }}>{s.low_price.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold" style={{ color:'#0f172a',fontFamily:'monospace' }}>{s.close_price.toFixed(2)}</td>
                  <td className="px-4 py-2.5"><Badge v={s.percent_change}/></td>
                  <td className="px-4 py-2.5 text-xs" style={{ color:'#64748b',fontFamily:'monospace' }}>{s.volume.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color:'#64748b',fontFamily:'monospace' }}>Rs.{(s.turnover/1e6).toFixed(2)}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t" style={{ borderColor:'#f1f5f9', background:'#f8fafc' }}>
          <p className="text-xs" style={{ color:'#94a3b8' }}>{filtered.length} companies · prices as of {tradingDate}</p>
        </div>
      </div>
    </div>
  )
}