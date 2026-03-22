'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Row {
  symbol: string; name: string; sector: string; date: string
  open_price: number; high_price: number; low_price: number
  close_price: number; volume: number; turnover: number; percent_change: number
}
interface ExplorerResult {
  columns: string[]; rows: any[][]; rowCount: number; ms: number; error?: string
}

const SORT_OPTIONS = [
  { value:'ts.trading_date',   label:'Date'        },
  { value:'pd.close_price',    label:'Close Price'  },
  { value:'pd.volume',         label:'Volume'       },
  { value:'pd.turnover',       label:'Turnover'     },
  { value:'pd.percent_change', label:'% Change'     },
  { value:'c.symbol',          label:'Symbol'       },
]

const QUICK_QUERIES = [
  { label:'Latest Prices (View)',       sql:'SELECT * FROM v_latest_prices ORDER BY turnover DESC LIMIT 20;' },
  { label:'Top Gainers (View)',         sql:'SELECT * FROM v_top_gainers;' },
  { label:'Top Losers (View)',          sql:'SELECT * FROM v_top_losers;' },
  { label:'Sector Summary (View)',      sql:'SELECT * FROM v_sector_summary;' },
  { label:'52-Week Range (View)',       sql:'SELECT * FROM v_52week_range ORDER BY week52_high DESC LIMIT 20;' },
  { label:'Daily Market Summary',       sql:'SELECT * FROM daily_market_summary ORDER BY trading_date DESC LIMIT 10;' },
  { label:'Price Records Count',        sql:'SELECT COUNT(*) AS total_records, COUNT(DISTINCT company_id) AS companies, COUNT(DISTINCT session_id) AS trading_days FROM price_data;' },
  { label:'All Sectors',               sql:'SELECT s.*, COUNT(c.company_id) AS companies FROM sector s LEFT JOIN company c ON c.sector_id=s.sector_id GROUP BY s.sector_id ORDER BY s.sector_id;' },
  { label:'All Companies',             sql:'SELECT c.symbol, c.name, s.name AS sector, c.is_active FROM company c JOIN sector s ON c.sector_id=s.sector_id ORDER BY c.symbol LIMIT 50;' },
  { label:'Trading Sessions',          sql:'SELECT * FROM trading_session ORDER BY trading_date DESC LIMIT 20;' },
  { label:'Data Sources (Audit)',       sql:'SELECT source_name, entry_method, COUNT(*) AS records, MAX(entered_at) AS last_load FROM data_source GROUP BY source_name, entry_method;' },
  { label:'fn_price_change_pct()',      sql:'SELECT fn_price_change_pct(420.00, 400.00) AS change_pct;' },
  { label:'fn_trading_days_between()', sql:"SELECT fn_trading_days_between('2026-01-01', CURDATE()) AS trading_days;" },
  { label:'SHOW TABLES',               sql:'SHOW TABLES;' },
  { label:'SHOW TRIGGERS',            sql:"SELECT trigger_name, event_manipulation, event_object_table, action_timing FROM information_schema.triggers WHERE trigger_schema='nepse_db';" },
  { label:'SHOW PROCEDURES',          sql:"SELECT routine_name, routine_comment FROM information_schema.routines WHERE routine_schema='nepse_db' AND routine_type='PROCEDURE';" },
  { label:'SHOW VIEWS',              sql:"SELECT table_name FROM information_schema.views WHERE table_schema='nepse_db';" },
  { label:'Table Row Counts',         sql:"SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema='nepse_db' ORDER BY table_rows DESC;" },
]

function toDateInput(d: Date) { return d.toISOString().split('T')[0] }

/* Fix: escape HTML before highlighting to prevent regex corrupting color codes */
function highlightSql(raw: string): string {
  const s = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  return s
    .replace(/\b(SELECT|FROM|JOIN|LEFT JOIN|WHERE|AND|OR|ORDER BY|LIMIT|ON|AS|COUNT|AVG|SUM|MAX|MIN|GROUP BY|HAVING|DISTINCT|DATE_FORMAT|COALESCE|ROUND|NULLIF|CALL|SHOW)\b/gi,
      m=>`<b style="color:#4338ca">${m}</b>`)
    .replace(/\b(price_data|company|trading_session|sector|watchlist|daily_market_summary|pd|c|ts|s)\b/g,
      m=>`<span style="color:#0891b2">${m}</span>`)
    .replace(/'([^']*)'/g, (_,v)=>`<span style="color:#059669">'${v}'</span>`)
    .replace(/--[^\n]*/g, m=>`<span style="color:#94a3b8;font-style:italic">${m}</span>`)
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

const inp: React.CSSProperties = {
  width:'100%', padding:'7px 10px', borderRadius:8, fontSize:12,
  border:'1px solid #e2e8f0', background:'white', color:'#0f172a', outline:'none',
}
const lbl: React.CSSProperties = {
  display:'block', fontSize:10, fontWeight:600, color:'#64748b',
  marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em',
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor:'#f1f5f9' }}>
      <div>
        <h2 className="text-sm font-semibold" style={{ color:'#1e1b4b' }}>{title}</h2>
        {sub && <p className="text-xs mt-0.5" style={{ color:'#94a3b8' }}>{sub}</p>}
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [companies,   setCompanies]   = useState<{symbol:string;name:string}[]>([])
  const [sectors,     setSectors]     = useState<string[]>([])
  const [data,        setData]        = useState<Row[]>([])
  const [sql,         setSql]         = useState('')
  const [queryMs,     setQueryMs]     = useState(0)
  const [loading,     setLoading]     = useState(false)
  const [chartType,   setChartType]   = useState<'price'|'volume'>('price')
  const [showSql,     setShowSql]     = useState(false)
  const [sqlCopied,   setSqlCopied]   = useState(false)

  const [symbol,      setSymbol]      = useState('all')
  const [sector,      setSector]      = useState('all')
  const [from,        setFrom]        = useState(()=>{ const d=new Date(); d.setMonth(d.getMonth()-1); return toDateInput(d) })
  const [to,          setTo]          = useState(()=>toDateInput(new Date()))
  const [minVolume,   setMinVolume]   = useState('')
  const [minTurnover, setMinTurnover] = useState('')
  const [minChange,   setMinChange]   = useState('')
  const [maxChange,   setMaxChange]   = useState('')
  const [sortBy,      setSortBy]      = useState('ts.trading_date')
  const [sortDir,     setSortDir]     = useState<'ASC'|'DESC'>('DESC')
  const [limit,       setLimit]       = useState('200')

  const [explorerSql,    setExplorerSql]    = useState(QUICK_QUERIES[0].sql)
  const [explorerResult, setExplorerResult] = useState<ExplorerResult|null>(null)
  const [explorerLoading,setExplorerLoading]= useState(false)

  useEffect(()=>{
    Promise.all([fetch('/api/stocks/all').then(r=>r.json()), fetch('/api/sectors').then(r=>r.json())])
      .then(([sd,sec])=>{
        const rows = Array.isArray(sd?.rows)?sd.rows:[]
        setCompanies(rows.map((r:any)=>({ symbol:String(r.symbol), name:String(r.company_name??r.name??'') })))
        setSectors((sec?.sectors??[]).map((s:any)=>String(s.name)))
      })
  },[])

  const runQuery = useCallback(async ()=>{
    setLoading(true)
    const t0=Date.now()
    const res=await fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({filters:{
        symbol:symbol!=='all'?symbol:undefined, sector:sector!=='all'?sector:undefined,
        from, to,
        minVolume:minVolume?Number(minVolume):undefined, minTurnover:minTurnover?Number(minTurnover):undefined,
        minChange:minChange?Number(minChange):undefined, maxChange:maxChange?Number(maxChange):undefined,
        sortBy, sortDir, limit:Number(limit),
      }})})
    const d=await res.json()
    setData(d.data||[]); setSql(d.sql||''); setQueryMs(Date.now()-t0); setLoading(false)
  },[symbol,sector,from,to,minVolume,minTurnover,minChange,maxChange,sortBy,sortDir,limit])

  useEffect(()=>{ const t=setTimeout(runQuery,400); return()=>clearTimeout(t) },[runQuery])

  async function runExplorer(){
    if(!explorerSql.trim()) return
    setExplorerLoading(true); setExplorerResult(null)
    try {
      const res=await fetch('/api/db-explorer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sql:explorerSql.trim()})})
      setExplorerResult(await res.json())
    } catch(e:any){ setExplorerResult({columns:[],rows:[],rowCount:0,ms:0,error:e.message}) }
    finally { setExplorerLoading(false) }
  }

  const gainers   = data.filter(r=>(r.percent_change||0)>0).length
  const avgClose  = data.length?data.reduce((s,r)=>s+(r.close_price||0),0)/data.length:0
  const totalVol  = data.reduce((s,r)=>s+(r.volume||0),0)
  const totalTurn = data.reduce((s,r)=>s+(r.turnover||0),0)
  const chartData = symbol!=='all'
    ?[...data].sort((a,b)=>a.date.localeCompare(b.date)).slice(-90)
    :data.slice(0,20)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Page Header ─────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color:'#1e1b4b' }}>Analytics & Query Builder</h1>
          <p className="text-sm mt-0.5" style={{ color:'#64748b' }}>
            Filter NEPSE data · scroll down for the Database Explorer
          </p>
        </div>
        {sql && (
          <button onClick={()=>setShowSql(v=>!v)}
            className="text-xs px-3 py-1.5 rounded-lg border font-medium"
            style={{ borderColor:'#c7d2fe', color:'#4338ca', background:'#eef2ff', cursor:'pointer' }}>
            {showSql?'Hide SQL':'Show SQL'} · {queryMs}ms
          </button>
        )}
      </div>

      {/* ── SECTION 1: Filters + Stats side by side ─────── */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* Filters card — takes 2 cols */}
        <div className="lg:col-span-2 bg-white rounded-xl border overflow-hidden" style={{ borderColor:'#e2e8f0' }}>
          <SectionHeader title="Query Filters" sub="Changes auto-run with 400ms debounce"/>
          <div className="p-5">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10 }}>
              <div style={{ gridColumn:'span 2' }}>
                <label style={lbl}>Company</label>
                <select value={symbol} onChange={e=>setSymbol(e.target.value)} style={inp}>
                  <option value="all">All Companies</option>
                  {companies.map(c=><option key={c.symbol} value={c.symbol}>{c.symbol} — {c.name.slice(0,22)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Sector</label>
                <select value={sector} onChange={e=>setSector(e.target.value)} style={inp}>
                  <option value="all">All Sectors</option>
                  {sectors.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>From Date</label>
                <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={inp}/>
              </div>
              <div>
                <label style={lbl}>To Date</label>
                <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={inp}/>
              </div>
              <div>
                <label style={lbl}>Min Volume</label>
                <input type="number" value={minVolume} onChange={e=>setMinVolume(e.target.value)} placeholder="e.g. 1000" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Min Turnover</label>
                <input type="number" value={minTurnover} onChange={e=>setMinTurnover(e.target.value)} placeholder="e.g. 100000" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Min Change%</label>
                <input type="number" step="0.1" value={minChange} onChange={e=>setMinChange(e.target.value)} placeholder="-5" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Max Change%</label>
                <input type="number" step="0.1" value={maxChange} onChange={e=>setMaxChange(e.target.value)} placeholder="10" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Sort By</label>
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={inp}>
                  {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Order</label>
                <select value={sortDir} onChange={e=>setSortDir(e.target.value as 'ASC'|'DESC')} style={inp}>
                  <option value="DESC">Descending</option>
                  <option value="ASC">Ascending</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Limit</label>
                <select value={limit} onChange={e=>setLimit(e.target.value)} style={inp}>
                  {['50','100','200','500','1000'].map(n=><option key={n} value={n}>{n} rows</option>)}
                </select>
              </div>
            </div>

            {/* Quick date presets */}
            <div className="flex items-center gap-2 mt-4 pt-4 flex-wrap" style={{ borderTop:'1px solid #f1f5f9' }}>
              <span className="text-xs font-medium" style={{ color:'#94a3b8' }}>Quick:</span>
              {([['Today',0],['1W',7],['1M',30],['3M',90],['6M',180],['1Y',365]] as [string,number][]).map(([l,d])=>(
                <button key={l} onClick={()=>{
                  const f=new Date(); f.setDate(f.getDate()-d)
                  setFrom(toDateInput(f)); setTo(toDateInput(new Date()))
                }} className="text-xs px-2.5 py-1 rounded-md border font-medium transition-all"
                  style={{ borderColor:'#e2e8f0', color:'#475569', background:'white', cursor:'pointer' }}
                  onMouseOver={e=>{(e.currentTarget as HTMLElement).style.borderColor='#c7d2fe';(e.currentTarget as HTMLElement).style.color='#4338ca'}}
                  onMouseOut={e=>{(e.currentTarget as HTMLElement).style.borderColor='#e2e8f0';(e.currentTarget as HTMLElement).style.color='#475569'}}>
                  {l}
                </button>
              ))}
              <button onClick={runQuery} disabled={loading}
                className="ml-auto text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
                style={{ background:loading?'#a5b4fc':'#4338ca', border:'none', cursor:loading?'not-allowed':'pointer' }}>
                {loading?'Running…':'▶ Run'}
              </button>
            </div>

            {/* Collapsible SQL */}
            {showSql && sql && (
              <div className="mt-4 rounded-xl overflow-hidden border" style={{ borderColor:'#e2e8f0' }}>
                <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor:'#f1f5f9', background:'#f8fafc' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border"
                      style={{ color:'#4338ca', background:'#eef2ff', borderColor:'#c7d2fe', fontFamily:'monospace' }}>SQL</span>
                    <span className="text-xs" style={{ color:'#94a3b8' }}>{data.length} rows · {queryMs}ms</span>
                  </div>
                  <button onClick={()=>{navigator.clipboard.writeText(sql);setSqlCopied(true);setTimeout(()=>setSqlCopied(false),2000)}}
                    className="text-xs px-2 py-0.5 rounded border"
                    style={{ background:sqlCopied?'#f0fdf4':'white', color:sqlCopied?'#16a34a':'#64748b', borderColor:sqlCopied?'#bbf7d0':'#e2e8f0', cursor:'pointer' }}>
                    {sqlCopied?'✓ Copied':'Copy'}
                  </button>
                </div>
                <pre className="p-3 text-xs leading-relaxed overflow-x-auto"
                  style={{ maxHeight:200, background:'#f8fafc', color:'#374151', fontFamily:'monospace' }}
                  dangerouslySetInnerHTML={{ __html:highlightSql(sql) }}/>
              </div>
            )}
          </div>
        </div>

        {/* Stats card — 1 col */}
        <div className="flex flex-col gap-3">
          {/* Query stats */}
          <div className="bg-white rounded-xl border p-4" style={{ borderColor:'#e2e8f0' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color:'#64748b' }}>Query Stats</p>
            <div className="space-y-3">
              {[
                { l:'Rows returned', v: loading?'…':data.length.toLocaleString(), blue:true },
                { l:'Avg Close',     v: data.length?`Rs.${avgClose.toFixed(2)}`:'—' },
                { l:'Total Volume',  v: data.length?totalVol.toLocaleString():'—' },
                { l:'Total Turnover',v: data.length?`Rs.${(totalTurn/1e7).toFixed(2)}Cr`:'—' },
                { l:'Gainers/Losers',v: data.length?`${gainers} / ${data.length-gainers}`:'—' },
              ].map(({l,v,blue})=>(
                <div key={l} className="flex items-center justify-between py-1.5 border-b last:border-0"
                  style={{ borderColor:'#f8fafc' }}>
                  <span className="text-xs" style={{ color:'#64748b' }}>{l}</span>
                  <span className="text-xs font-semibold" style={{ color:blue?'#4338ca':'#0f172a', fontFamily:'monospace' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Company price chart — only when specific company selected */}
          {symbol!=='all' && chartData.length>1 && (
            <div className="bg-white rounded-xl border overflow-hidden flex-1" style={{ borderColor:'#e2e8f0' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor:'#f1f5f9' }}>
                <div>
                  <p className="text-xs font-semibold" style={{ color:'#1e1b4b' }}>{symbol} Chart</p>
                  <p className="text-[10px]" style={{ color:'#94a3b8' }}>{chartData.length} days</p>
                </div>
                <div className="flex gap-1.5">
                  {(['price','volume'] as const).map(ct=>(
                    <button key={ct} onClick={()=>setChartType(ct)}
                      className="text-[10px] px-2 py-0.5 rounded border font-medium"
                      style={{ background:chartType===ct?'#eef2ff':'white', color:chartType===ct?'#4338ca':'#64748b', borderColor:chartType===ct?'#c7d2fe':'#e2e8f0', cursor:'pointer' }}>
                      {ct.charAt(0).toUpperCase()+ct.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-3">
                <ResponsiveContainer width="100%" height={150}>
                  {chartType==='price'?(
                    <AreaChart data={chartData} margin={{top:4,right:4,left:0,bottom:0}}>
                      <defs>
                        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#4338ca" stopOpacity={0.12}/>
                          <stop offset="95%" stopColor="#4338ca" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                      <XAxis dataKey="date" tick={{fill:'#94a3b8',fontSize:9}} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                      <YAxis tick={{fill:'#94a3b8',fontSize:9}} tickLine={false} axisLine={false}
                        tickFormatter={v=>`Rs.${v}`} width={68} domain={['auto','auto']}/>
                      <Tooltip content={<CTip/>}/>
                      <Area type="monotone" dataKey="close_price" name="Close" stroke="#4338ca" strokeWidth={2} fill="url(#ag)" dot={false}/>
                    </AreaChart>
                  ):(
                    <BarChart data={chartData} margin={{top:4,right:4,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                      <XAxis dataKey="date" tick={{fill:'#94a3b8',fontSize:9}} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                      <YAxis tick={{fill:'#94a3b8',fontSize:9}} tickLine={false} axisLine={false} width={68}/>
                      <Tooltip content={<CTip/>}/>
                      <Bar dataKey="volume" name="Volume" fill="#c7d2fe" radius={[2,2,0,0]}/>
                    </BarChart>
                  )}
                </ResponsiveContainer>
                <Link href={`/dashboard/stock/${symbol}`}
                  className="block text-center text-xs mt-2 py-1.5 rounded-lg font-medium"
                  style={{ background:'#eef2ff', color:'#4338ca', border:'1px solid #c7d2fe', textDecoration:'none' }}>
                  Full Chart →
                </Link>
              </div>
            </div>
          )}

          {/* Placeholder when no company selected */}
          {symbol==='all' && (
            <div className="bg-white rounded-xl border p-4 flex flex-col items-center justify-center text-center"
              style={{ borderColor:'#e2e8f0', minHeight:120 }}>
              <svg className="w-8 h-8 mb-2" style={{ color:'#c7d2fe' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
              </svg>
              <p className="text-xs" style={{ color:'#94a3b8' }}>Select a company<br/>to see its price chart</p>
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION 2: Results table ─────────────────────── */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor:'#e2e8f0' }}>
        <SectionHeader
          title="Query Results"
          sub={loading ? 'Running…' : `${data.length} rows · sorted by ${SORT_OPTIONS.find(o=>o.value===sortBy)?.label ?? sortBy} ${sortDir}`}
        />
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
              {loading?(
                <tr><td colSpan={11} className="text-center py-12" style={{ color:'#94a3b8' }}>
                  <svg className="animate-spin w-4 h-4 inline mr-2" style={{ color:'#4338ca' }} fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Running query…
                </td></tr>
              ):data.length===0?(
                <tr><td colSpan={11} className="text-center py-12" style={{ color:'#94a3b8' }}>
                  No results — adjust the filters above
                </td></tr>
              ):data.map((row,i)=>{
                const up=(row.percent_change||0)>=0
                return (
                  <tr key={i} className="border-b cursor-pointer transition-colors" style={{ borderColor:'#f8fafc' }}
                    onClick={()=>window.location.href=`/dashboard/stock/${row.symbol}`}
                    onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='#f8fafc'}
                    onMouseOut={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                    <td className="px-4 py-2.5">
                      <Link href={`/dashboard/stock/${row.symbol}`} onClick={e=>e.stopPropagation()}
                        style={{ color:'#4338ca', fontWeight:700, textDecoration:'none' }}>{row.symbol}</Link>
                    </td>
                    <td className="px-4 py-2.5 max-w-[130px] truncate" style={{ color:'#475569' }}>{row.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px]"
                        style={{ background:'#eef2ff', color:'#4338ca', border:'1px solid #c7d2fe' }}>
                        {String(row.sector||'').split(' ').slice(0,2).join(' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5" style={{ color:'#94a3b8', fontFamily:'monospace' }}>{row.date}</td>
                    <td className="px-4 py-2.5" style={{ color:'#64748b', fontFamily:'monospace' }}>{Number(row.open_price||0).toFixed(2)}</td>
                    <td className="px-4 py-2.5 font-medium" style={{ color:'#16a34a', fontFamily:'monospace' }}>{Number(row.high_price||0).toFixed(2)}</td>
                    <td className="px-4 py-2.5 font-medium" style={{ color:'#dc2626', fontFamily:'monospace' }}>{Number(row.low_price||0).toFixed(2)}</td>
                    <td className="px-4 py-2.5 font-semibold" style={{ color:'#0f172a', fontFamily:'monospace' }}>{Number(row.close_price||0).toFixed(2)}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-1.5 py-0.5 rounded font-semibold text-[10px]"
                        style={{ background:up?'#f0fdf4':'#fef2f2', color:up?'#16a34a':'#dc2626', border:`1px solid ${up?'#bbf7d0':'#fecaca'}` }}>
                        {up?'+':''}{Number(row.percent_change||0).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5" style={{ color:'#64748b', fontFamily:'monospace' }}>{Number(row.volume||0).toLocaleString()}</td>
                    <td className="px-4 py-2.5" style={{ color:'#64748b', fontFamily:'monospace' }}>Rs.{(Number(row.turnover||0)/1e6).toFixed(2)}M</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION 3: Database Explorer ─────────────────── */}
      <div className="border-t pt-6" style={{ borderColor:'#e2e8f0' }}>
        <div className="mb-4">
          <h2 className="text-lg font-bold" style={{ color:'#1e1b4b' }}>Database Explorer</h2>
          <p className="text-sm mt-0.5" style={{ color:'#64748b' }}>
            Run SQL against{' '}
            <code className="text-xs px-1.5 py-0.5 rounded" style={{ background:'#eef2ff', color:'#4338ca' }}>nepse_db</code>
            {' '}· SELECT / SHOW / CALL · Ctrl+Enter to run
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-4">
          {/* Sidebar */}
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor:'#e2e8f0' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor:'#f1f5f9', background:'#f8fafc' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color:'#64748b' }}>Quick Queries</p>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight:480 }}>
              {QUICK_QUERIES.map(q=>(
                <button key={q.label} onClick={()=>setExplorerSql(q.sql)}
                  className="w-full text-left px-4 py-2.5 text-xs border-b transition-colors"
                  style={{
                    borderColor:'#f8fafc',
                    color:      explorerSql===q.sql?'#4338ca':'#475569',
                    background: explorerSql===q.sql?'#eef2ff':'transparent',
                    fontWeight: explorerSql===q.sql?600:400,
                  }}
                  onMouseOver={e=>{ if(explorerSql!==q.sql)(e.currentTarget as HTMLElement).style.background='#f8fafc' }}
                  onMouseOut={e=>{  if(explorerSql!==q.sql)(e.currentTarget as HTMLElement).style.background='transparent' }}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Editor + results */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor:'#e2e8f0' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor:'#f1f5f9', background:'#f8fafc' }}>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border"
                    style={{ color:'#4338ca', background:'#eef2ff', borderColor:'#c7d2fe', fontFamily:'monospace' }}>SQL</span>
                  <span className="text-xs" style={{ color:'#94a3b8' }}>SELECT · SHOW · CALL only · nepse_db</span>
                </div>
                <button onClick={runExplorer} disabled={explorerLoading}
                  className="flex items-center gap-2 text-xs px-4 py-1.5 rounded-lg font-semibold text-white"
                  style={{ background:explorerLoading?'#a5b4fc':'linear-gradient(135deg,#4338ca,#6366f1)', border:'none', cursor:explorerLoading?'not-allowed':'pointer', boxShadow:explorerLoading?'none':'0 2px 8px rgba(99,102,241,0.3)' }}>
                  {explorerLoading
                    ?<><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Running…</>
                    :'▶ Run Query'}
                </button>
              </div>
              <textarea value={explorerSql} onChange={e=>setExplorerSql(e.target.value)}
                onKeyDown={e=>{ if((e.ctrlKey||e.metaKey)&&e.key==='Enter') runExplorer() }}
                rows={5} spellCheck={false}
                className="w-full px-4 py-3 text-sm outline-none resize-none"
                style={{ fontFamily:'JetBrains Mono,Consolas,monospace', color:'#1e1b4b', background:'#fafafa', border:'none', lineHeight:1.7 }}
                placeholder="SELECT * FROM v_latest_prices LIMIT 10;"/>
            </div>

            {explorerResult && (
              <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor:'#e2e8f0' }}>
                <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor:'#f1f5f9', background:'#f8fafc' }}>
                  {explorerResult.error
                    ?<span className="text-xs font-medium" style={{ color:'#dc2626' }}>✗ Error</span>
                    :<>
                      <span className="text-xs font-medium" style={{ color:'#16a34a' }}>✓ {explorerResult.rowCount} row{explorerResult.rowCount!==1?'s':''}</span>
                      <span className="text-xs" style={{ color:'#94a3b8' }}>{explorerResult.ms}ms · {explorerResult.columns.length} cols</span>
                    </>
                  }
                </div>
                {explorerResult.error
                  ?<div className="px-4 py-3 text-sm font-mono" style={{ color:'#dc2626', background:'#fef2f2' }}>{explorerResult.error}</div>
                  :explorerResult.rows.length===0
                  ?<div className="px-4 py-8 text-center text-sm" style={{ color:'#94a3b8' }}>No rows returned</div>
                  :<div className="overflow-x-auto" style={{ maxHeight:340 }}>
                    <table className="w-full text-xs">
                      <thead className="sticky top-0">
                        <tr className="border-b" style={{ background:'#f8fafc', borderColor:'#e2e8f0' }}>
                          <th className="px-3 py-2 text-left w-8" style={{ color:'#94a3b8' }}>#</th>
                          {explorerResult.columns.map(col=>(
                            <th key={col} className="px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ color:'#4338ca' }}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {explorerResult.rows.map((row,i)=>(
                          <tr key={i} className="border-b transition-colors" style={{ borderColor:'#f8fafc' }}
                            onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='#f8fafc'}
                            onMouseOut={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                            <td className="px-3 py-2" style={{ color:'#94a3b8', fontFamily:'monospace' }}>{i+1}</td>
                            {row.map((cell,j)=>(
                              <td key={j} className="px-3 py-2 whitespace-nowrap max-w-xs truncate"
                                style={{ color:cell===null?'#94a3b8':typeof cell==='number'?'#4338ca':'#0f172a', fontFamily:'monospace', fontStyle:cell===null?'italic':'normal' }}>
                                {cell===null?'NULL':String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                }
              </div>
            )}

            {/* Schema reference */}
            <div className="bg-white rounded-xl border p-5" style={{ borderColor:'#e2e8f0' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color:'#64748b' }}>Schema Reference — nepse_db</p>
              <div className="grid md:grid-cols-3 gap-3 text-xs mb-4">
                {[
                  {name:'price_data',          cols:['price_id PK','company_id FK','session_id FK','open_price','high_price','low_price','close_price','volume','turnover','percent_change'],color:'#4338ca'},
                  {name:'company',             cols:['company_id PK','symbol UNIQUE','name','sector_id FK','is_active'],color:'#059669'},
                  {name:'sector',              cols:['sector_id PK','name UNIQUE','description'],color:'#0891b2'},
                  {name:'trading_session',     cols:['session_id PK','trading_date UNIQUE','open_time','close_time','is_holiday'],color:'#d97706'},
                  {name:'watchlist',           cols:['watchlist_id PK','user_id','company_id FK','added_at'],color:'#7c3aed'},
                  {name:'daily_market_summary',cols:['trading_date UNIQUE','total_turnover','gainers','losers','avg_change_pct'],color:'#dc2626'},
                ].map(t=>(
                  <div key={t.name} className="rounded-lg border p-3" style={{ borderColor:'#e2e8f0' }}>
                    <p className="font-bold mb-2 text-[11px]" style={{ color:t.color, fontFamily:'monospace' }}>{t.name}</p>
                    {t.cols.map(col=>(
                      <div key={col} className="flex items-center gap-1.5 mb-0.5">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background:t.color, opacity:0.4 }}/>
                        <span className="text-[10px]" style={{ color:'#64748b', fontFamily:'monospace' }}>{col}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t" style={{ borderColor:'#f1f5f9' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color:'#94a3b8' }}>Views · Procedures · Functions · Triggers</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ['v_latest_prices','v'],['v_top_gainers','v'],['v_top_losers','v'],['v_sector_summary','v'],['v_52week_range','v'],
                    ['sp_upsert_price','sp'],['sp_get_price_history','sp'],['sp_refresh_daily_summary','sp'],['sp_fix_sectors','sp'],
                    ['fn_price_change_pct','fn'],['fn_trading_days_between','fn'],
                    ['trg_validate_before_insert','trg'],['trg_refresh_summary','trg'],
                  ].map(([name,type])=>(
                    <span key={name} className="text-[10px] px-2 py-0.5 rounded border font-mono"
                      style={{
                        background:  type==='v'?'#eef2ff':type==='sp'?'#f0fdf4':type==='fn'?'#fffbeb':'#fef2f2',
                        color:       type==='v'?'#4338ca':type==='sp'?'#16a34a':type==='fn'?'#d97706':'#dc2626',
                        borderColor: type==='v'?'#c7d2fe':type==='sp'?'#bbf7d0':type==='fn'?'#fde68a':'#fecaca',
                      }}>{name}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}