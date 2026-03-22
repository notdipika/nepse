'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Row {
  symbol: string; name: string; sector: string; date: string
  open_price: number; high_price: number; low_price: number
  close_price: number; volume: number; turnover: number; percent_change: number
}

const SORT_OPTIONS = [
  { value:'ts.trading_date', label:'Date' }, { value:'pd.close_price', label:'Close' },
  { value:'pd.volume', label:'Volume' },     { value:'pd.turnover', label:'Turnover' },
  { value:'pd.percent_change', label:'% Change' }, { value:'c.symbol', label:'Symbol' },
]

// Formats date as YYYY-MM-DD (required for <input type="date">)
function toDateInput(d: Date) { return d.toISOString().split('T')[0] }
function defaultFrom() { const d=new Date(); d.setMonth(d.getMonth()-1); return toDateInput(d) }
function defaultTo()   { return toDateInput(new Date()) }

function SqlPanel({ sql, count, ms }: { sql:string; count:number; ms:number }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(sql); setCopied(true); setTimeout(()=>setCopied(false),2000) }
  const hl = sql
    .replace(/\b(SELECT|FROM|JOIN|WHERE|AND|OR|ORDER BY|LIMIT|ON|AS|MAX|MIN|COUNT|DATE_FORMAT|COALESCE|ROUND|NULLIF)\b/g,
      '<span style="color:#2563eb;font-weight:600">$1</span>')
    .replace(/\b(price_data|company|trading_session|sector|pd|c|ts|s)\b/g,
      '<span style="color:#7c3aed">$1</span>')
    .replace(/'([^']*)'/g, '<span style="color:#16a34a">\'$1\'</span>')
    .replace(/\b(\d+)\b/g, '<span style="color:#d97706">$1</span>')
  return (
    <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor:'#e2e8f0' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor:'#e2e8f0', background:'#f8fafc' }}>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded border" style={{ color:'#2563eb', background:'#eff6ff', borderColor:'#bfdbfe', fontFamily:'monospace' }}>SQL</span>
          <span className="text-xs" style={{ color:'#64748b' }}>{count} rows · {ms}ms · sent to MySQL</span>
        </div>
        <button onClick={copy} className="text-xs px-2.5 py-1 rounded border font-medium"
          style={{ background: copied?'#f0fdf4':'white', color: copied?'#16a34a':'#64748b', borderColor: copied?'#bbf7d0':'#e2e8f0', cursor:'pointer' }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-xs leading-relaxed overflow-x-auto" style={{ maxHeight:280, background:'#f8fafc', color:'#374151', fontFamily:'monospace' }}
        dangerouslySetInnerHTML={{ __html: hl }}/>
    </div>
  )
}

function CTip({ active, payload, label }: any) {
  if (!active||!payload?.length) return null
  return (
    <div className="bg-white border rounded-lg p-2.5 text-xs shadow-md" style={{ borderColor:'#e2e8f0' }}>
      <p className="mb-1.5" style={{ color:'#94a3b8' }}>{label}</p>
      {payload.map((p:any) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color:'#64748b' }}>{p.name}</span>
          <span className="font-medium" style={{ color:'#0f172a', fontFamily:'monospace' }}>{Number(p.value).toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [companies, setCompanies] = useState<{symbol:string;name:string}[]>([])
  const [sectors,   setSectors]   = useState<string[]>([])
  const [data,      setData]      = useState<Row[]>([])
  const [sql,       setSql]       = useState('')
  const [ms,        setMs]        = useState(0)
  const [loading,   setLoading]   = useState(false)
  const [chart,     setChart]     = useState<'price'|'volume'>('price')
  const [symbol,    setSymbol]    = useState('all')
  const [sector,    setSector]    = useState('all')
  const [from,      setFrom]      = useState(defaultFrom)
  const [to,        setTo]        = useState(defaultTo)
  const [minVol,    setMinVol]    = useState('')
  const [minTurn,   setMinTurn]   = useState('')
  const [minChg,    setMinChg]    = useState('')
  const [maxChg,    setMaxChg]    = useState('')
  const [sortBy,    setSortBy]    = useState('ts.trading_date')
  const [sortDir,   setSortDir]   = useState<'ASC'|'DESC'>('DESC')
  const [limit,     setLimit]     = useState('200')

  useEffect(() => {
    Promise.all([fetch('/api/stocks/all').then(r=>r.json()), fetch('/api/sectors').then(r=>r.json())])
      .then(([sd, sec]) => {
        const rows = Array.isArray(sd?.rows)?sd.rows:[]
        setCompanies(rows.map((r:any) => ({ symbol:String(r.symbol), name:String(r.company_name??r.name??'') })))
        setSectors((sec?.sectors??[]).map((s:any)=>String(s.name)))
      })
  }, [])

  const runQuery = useCallback(async () => {
    setLoading(true)
    const t0 = Date.now()
    const res = await fetch('/api/query', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ filters: {
        symbol: symbol!=='all'?symbol:undefined,
        sector: sector!=='all'?sector:undefined,
        from, to,
        minVolume:   minVol  ? Number(minVol)  : undefined,
        minTurnover: minTurn ? Number(minTurn) : undefined,
        minChange:   minChg  ? Number(minChg)  : undefined,
        maxChange:   maxChg  ? Number(maxChg)  : undefined,
        sortBy, sortDir, limit: Number(limit),
      }})
    })
    const d = await res.json()
    setData(d.data??[]); setSql(d.sql??''); setMs(Date.now()-t0)
    setLoading(false)
  }, [symbol,sector,from,to,minVol,minTurn,minChg,maxChg,sortBy,sortDir,limit])

  useEffect(() => { const t=setTimeout(runQuery,400); return ()=>clearTimeout(t) }, [runQuery])

  const avgClose = data.length ? data.reduce((s,r)=>s+(r.close_price||0),0)/data.length : 0
  const gainers  = data.filter(r=>(r.percent_change||0)>0).length
  const chartData= symbol!=='all' ? [...data].sort((a,b)=>a.date.localeCompare(b.date)).slice(-60) : data.slice(0,20)

  const inp: React.CSSProperties = {
    width:'100%', padding:'7px 10px', borderRadius:8, fontSize:12,
    border:'1px solid #e2e8f0', background:'white', color:'#0f172a',
    outline:'none', fontFamily:'inherit',
  }
  const lbl: React.CSSProperties = {
    display:'block', fontSize:10, fontWeight:500, color:'#64748b',
    marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em',
  }

  return (
    <div className="space-y-5 max-w-screen-xl mx-auto">
      <div>
        <h1 className="text-xl font-bold" style={{ color:'#0f172a' }}>Analytics & Query Builder</h1>
        <p className="text-sm mt-0.5" style={{ color:'#64748b' }}>Filter NEPSE data — live MySQL query shown below results</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-5" style={{ borderColor:'#e2e8f0' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" style={{ color:'#2563eb' }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.553.894l-4 2A1 1 0 016 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd"/>
            </svg>
            <span className="text-sm font-semibold" style={{ color:'#0f172a' }}>Filters</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:'#f1f5f9', color:'#64748b' }}>{data.length} rows</span>
          </div>
          <button onClick={runQuery} disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: loading?'#bfdbfe':'#2563eb', color:'white', border:'none', cursor: loading?'not-allowed':'pointer' }}>
            {loading ? 'Running…' : 'Run Query'}
          </button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
          <div style={{ gridColumn:'span 2' }}>
            <label style={lbl}>Company</label>
            <select value={symbol} onChange={e=>setSymbol(e.target.value)} style={inp}>
              <option value="all">All Companies</option>
              {companies.map(c => <option key={c.symbol} value={c.symbol}>{c.symbol} — {c.name.slice(0,24)}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Sector</label>
            <select value={sector} onChange={e=>setSector(e.target.value)} style={inp}>
              <option value="all">All Sectors</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>From Date</label>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={inp}
              onFocus={e=>e.target.style.borderColor='#93c5fd'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
          </div>
          <div>
            <label style={lbl}>To Date</label>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={inp}
              onFocus={e=>e.target.style.borderColor='#93c5fd'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
          </div>
          <div>
            <label style={lbl}>Min Volume</label>
            <input type="number" value={minVol} onChange={e=>setMinVol(e.target.value)} placeholder="e.g. 1000" style={inp}
              onFocus={e=>e.target.style.borderColor='#93c5fd'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
          </div>
          <div>
            <label style={lbl}>Min Turnover</label>
            <input type="number" value={minTurn} onChange={e=>setMinTurn(e.target.value)} placeholder="e.g. 100000" style={inp}
              onFocus={e=>e.target.style.borderColor='#93c5fd'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
          </div>
          <div>
            <label style={lbl}>Min Change%</label>
            <input type="number" step="0.1" value={minChg} onChange={e=>setMinChg(e.target.value)} placeholder="-5" style={inp}
              onFocus={e=>e.target.style.borderColor='#93c5fd'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
          </div>
          <div>
            <label style={lbl}>Max Change%</label>
            <input type="number" step="0.1" value={maxChg} onChange={e=>setMaxChg(e.target.value)} placeholder="10" style={inp}
              onFocus={e=>e.target.style.borderColor='#93c5fd'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
          </div>
          <div>
            <label style={lbl}>Sort By</label>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={inp}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Order</label>
            <select value={sortDir} onChange={e=>setSortDir(e.target.value as 'ASC'|'DESC')} style={inp}>
              <option value="DESC">Descending</option><option value="ASC">Ascending</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Limit</label>
            <select value={limit} onChange={e=>setLimit(e.target.value)} style={inp}>
              {['50','100','200','500','1000'].map(n=><option key={n} value={n}>{n} rows</option>)}
            </select>
          </div>
        </div>

        {/* Quick presets — all use YYYY-MM-DD */}
        <div className="flex items-center gap-2 mt-4 pt-4 flex-wrap" style={{ borderTop:'1px solid #f1f5f9' }}>
          <span className="text-xs" style={{ color:'#94a3b8' }}>Quick:</span>
          {([['Today',0],['1W',7],['1M',30],['3M',90],['6M',180],['1Y',365]] as [string,number][]).map(([l,d]) => (
            <button key={l} onClick={() => {
              const f = new Date(); f.setDate(f.getDate()-d)
              setFrom(toDateInput(f)); setTo(toDateInput(new Date()))
            }} className="text-xs px-2.5 py-1 rounded-md border font-medium"
              style={{ borderColor:'#e2e8f0', color:'#475569', background:'white', cursor:'pointer' }}
              onMouseOver={e=>{(e.currentTarget as HTMLElement).style.borderColor='#93c5fd';(e.currentTarget as HTMLElement).style.color='#2563eb'}}
              onMouseOut={e=>{(e.currentTarget as HTMLElement).style.borderColor='#e2e8f0';(e.currentTarget as HTMLElement).style.color='#475569'}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      {data.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
          {[
            { l:'Rows',      v:data.length.toLocaleString(), blue:true },
            { l:'Avg Close', v:`Rs.${avgClose.toFixed(2)}` },
            { l:'Gainers',   v:`${gainers} / ${data.length-gainers}` },
            { l:'Total Vol', v:data.reduce((s,r)=>s+(r.volume||0),0).toLocaleString() },
            { l:'Turnover',  v:`Rs.${(data.reduce((s,r)=>s+(r.turnover||0),0)/1e7).toFixed(2)}Cr` },
          ].map(({l,v,blue}) => (
            <div key={l} className="bg-white rounded-xl border p-4" style={{ borderColor:'#e2e8f0' }}>
              <p className="text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color:'#64748b' }}>{l}</p>
              <p className="text-lg font-bold" style={{ color: blue?'#2563eb':'#0f172a', fontFamily:'monospace' }}>{v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {data.length > 1 && (
        <div className="bg-white rounded-xl border p-5" style={{ borderColor:'#e2e8f0' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color:'#0f172a' }}>
              {symbol!=='all' ? `${symbol} — Chart` : 'Top 20 Companies'}
            </h2>
            <div className="flex gap-2">
              {(['price','volume'] as const).map(ct => (
                <button key={ct} onClick={()=>setChart(ct)}
                  className="text-xs px-2.5 py-1 rounded-md border font-medium"
                  style={{ background: chart===ct?'#eff6ff':'white', color: chart===ct?'#2563eb':'#64748b', borderColor: chart===ct?'#bfdbfe':'#e2e8f0', cursor:'pointer' }}>
                  {ct.charAt(0).toUpperCase()+ct.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            {chart==='price' ? (
              <AreaChart data={chartData} margin={{top:4,right:4,left:0,bottom:0}}>
                <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.12}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey={symbol!=='all'?'date':'symbol'} tick={{fill:'#94a3b8',fontSize:10}} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                <YAxis tick={{fill:'#94a3b8',fontSize:10}} tickLine={false} axisLine={false} tickFormatter={v=>`Rs.${v}`} width={75}/>
                <Tooltip content={<CTip/>}/>
                <Area type="monotone" dataKey="close_price" name="Close" stroke="#2563eb" strokeWidth={2} fill="url(#ag)" dot={false}/>
                {symbol!=='all' && <Area type="monotone" dataKey="open_price" name="Open" stroke="#93c5fd" strokeWidth={1} fill="none" dot={false} strokeDasharray="4 4"/>}
              </AreaChart>
            ) : (
              <BarChart data={chartData} margin={{top:4,right:4,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey={symbol!=='all'?'date':'symbol'} tick={{fill:'#94a3b8',fontSize:10}} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                <YAxis tick={{fill:'#94a3b8',fontSize:10}} tickLine={false} axisLine={false} width={75}/>
                <Tooltip content={<CTip/>}/>
                <Bar dataKey="volume" name="Volume" fill="#bfdbfe" radius={[2,2,0,0]}/>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Results table */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor:'#e2e8f0' }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor:'#f1f5f9' }}>
          <h2 className="text-sm font-semibold" style={{ color:'#0f172a' }}>Query Results</h2>
          {loading && <span className="text-xs" style={{ color:'#94a3b8' }}>Running…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b font-medium" style={{ background:'#f8fafc', borderColor:'#e2e8f0', color:'#64748b' }}>
                {['Symbol','Company','Sector','Date','Open','High','Low','Close','Change%','Volume','Turnover'].map(h=>(
                  <th key={h} className="text-left px-4 py-2.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={11} className="text-center py-10" style={{ color:'#94a3b8' }}>Running query…</td></tr>
                : data.length===0
                ? <tr><td colSpan={11} className="text-center py-10" style={{ color:'#94a3b8' }}>No results — adjust the filters above</td></tr>
                : data.map((row,i) => {
                    const up=(row.percent_change||0)>=0
                    return (
                      <tr key={i} className="border-b cursor-pointer transition-colors"
                        style={{ borderColor:'#f8fafc' }}
                        onClick={()=>window.location.href=`/dashboard/stock/${row.symbol}`}
                        onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='#f8fafc'}
                        onMouseOut={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                        <td className="px-4 py-2.5">
                          <Link href={`/dashboard/stock/${row.symbol}`} onClick={e=>e.stopPropagation()}
                            style={{ color:'#2563eb', fontWeight:700, textDecoration:'none' }}>{row.symbol}</Link>
                        </td>
                        <td className="px-4 py-2.5 max-w-[130px] truncate" style={{ color:'#475569' }}>{row.name}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-1.5 py-0.5 rounded" style={{ background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', fontSize:10 }}>
                            {String(row.sector||'').split(' ').slice(0,2).join(' ')}
                          </span>
                        </td>
                        <td className="px-4 py-2.5" style={{ color:'#94a3b8', fontFamily:'monospace' }}>{row.date}</td>
                        <td className="px-4 py-2.5" style={{ color:'#64748b', fontFamily:'monospace' }}>{Number(row.open_price||0).toFixed(2)}</td>
                        <td className="px-4 py-2.5" style={{ color:'#16a34a', fontFamily:'monospace' }}>{Number(row.high_price||0).toFixed(2)}</td>
                        <td className="px-4 py-2.5" style={{ color:'#dc2626', fontFamily:'monospace' }}>{Number(row.low_price||0).toFixed(2)}</td>
                        <td className="px-4 py-2.5 font-semibold" style={{ color:'#0f172a', fontFamily:'monospace' }}>{Number(row.close_price||0).toFixed(2)}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: up?'#f0fdf4':'#fef2f2', color: up?'#16a34a':'#dc2626', border: `1px solid ${up?'#bbf7d0':'#fecaca'}`, fontSize:10 }}>
                            {up?'+':''}{Number(row.percent_change||0).toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5" style={{ color:'#64748b', fontFamily:'monospace' }}>{Number(row.volume||0).toLocaleString()}</td>
                        <td className="px-4 py-2.5" style={{ color:'#64748b', fontFamily:'monospace' }}>Rs.{(Number(row.turnover||0)/1e6).toFixed(2)}M</td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>
      </div>

      {sql && <SqlPanel sql={sql} count={data.length} ms={ms}/>}
    </div>
  )
}