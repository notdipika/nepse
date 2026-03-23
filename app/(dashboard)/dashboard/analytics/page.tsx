'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { toNum, daysAgo, todayIso } from '@/lib/utils'

/* ─── Types ──────────────────────────────────────────────── */
interface FilterRow {
  symbol: string; name: string; sector: string; date: string
  open_price: number; high_price: number; low_price: number
  close_price: number; volume: number; turnover: number; percent_change: number
}
interface ExplorerResult {
  columns: string[]; rows: unknown[][]; rowCount: number; error?: string
}
type Mode = 'filter' | 'sql'

/* ─── Constants ──────────────────────────────────────────── */
const SORT_OPTIONS = [
  { value: 'ts.trading_date',   label: 'Date'        },
  { value: 'pd.close_price',    label: 'Close Price'  },
  { value: 'pd.volume',         label: 'Volume'       },
  { value: 'pd.turnover',       label: 'Turnover'     },
  { value: 'pd.percent_change', label: '% Change'     },
  { value: 'c.symbol',          label: 'Symbol'       },
]

const QUICK_QUERIES = [
  { label: 'Latest Prices',             sql: 'SELECT * FROM v_latest_prices ORDER BY turnover DESC LIMIT 20;' },
  { label: 'Top Gainers',              sql: 'SELECT * FROM v_top_gainers;' },
  { label: 'Top Losers',               sql: 'SELECT * FROM v_top_losers;' },
  { label: 'Sector Summary',           sql: 'SELECT * FROM v_sector_summary;' },
  { label: '52-Week Range',            sql: 'SELECT * FROM v_52week_range ORDER BY week52_high DESC LIMIT 20;' },
  { label: 'Daily Market Summary',     sql: 'SELECT * FROM daily_market_summary ORDER BY trading_date DESC LIMIT 10;' },
  { label: 'Price Records Count',      sql: 'SELECT COUNT(*) AS total_records, COUNT(DISTINCT company_id) AS companies, COUNT(DISTINCT session_id) AS trading_days FROM price_data;' },
  { label: 'All Sectors',             sql: 'SELECT s.*, COUNT(c.company_id) AS companies FROM sector s LEFT JOIN company c ON c.sector_id=s.sector_id GROUP BY s.sector_id ORDER BY s.sector_id;' },
  { label: 'All Companies',           sql: 'SELECT c.symbol, c.name, s.name AS sector, c.is_active FROM company c JOIN sector s ON c.sector_id=s.sector_id ORDER BY c.symbol LIMIT 50;' },
  { label: 'Trading Sessions',        sql: 'SELECT * FROM trading_session ORDER BY trading_date DESC LIMIT 20;' },
  { label: 'Data Sources (Audit)',     sql: 'SELECT source_name, entry_method, COUNT(*) AS records, MAX(entered_at) AS last_load FROM data_source GROUP BY source_name, entry_method;' },
  { label: 'fn_price_change_pct()',   sql: 'SELECT fn_price_change_pct(420.00, 400.00) AS change_pct;' },
  { label: 'fn_trading_days_between()',sql:"SELECT fn_trading_days_between('2026-01-01', CURDATE()) AS trading_days;" },
  { label: 'SHOW TABLES',            sql: 'SHOW TABLES;' },
  { label: 'SHOW TRIGGERS',          sql: "SELECT trigger_name, event_manipulation, event_object_table, action_timing FROM information_schema.triggers WHERE trigger_schema='nepse_db';" },
  { label: 'SHOW PROCEDURES',        sql: "SELECT routine_name, routine_comment FROM information_schema.routines WHERE routine_schema='nepse_db' AND routine_type='PROCEDURE';" },
  { label: 'SHOW VIEWS',             sql: "SELECT table_name FROM information_schema.views WHERE table_schema='nepse_db';" },
  { label: 'Table Row Counts',       sql: "SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema='nepse_db' ORDER BY table_rows DESC;" },
]

const SCHEMA_TABLES = [
  { name:'price_data',           cols:['price_id PK','company_id FK','session_id FK','open_price','high_price','low_price','close_price','volume','turnover','percent_change'], color:'#4338ca' },
  { name:'company',              cols:['company_id PK','symbol UNIQUE','name','sector_id FK','is_active'],                                                                      color:'#059669' },
  { name:'sector',               cols:['sector_id PK','name UNIQUE','description'],                                                                                            color:'#0891b2' },
  { name:'trading_session',      cols:['session_id PK','trading_date UNIQUE','open_time','close_time','is_holiday'],                                                            color:'#d97706' },
  { name:'watchlist',            cols:['watchlist_id PK','user_id','company_id FK','added_at'],                                                                                 color:'#7c3aed' },
  { name:'daily_market_summary', cols:['trading_date UNIQUE','total_turnover','gainers','losers','avg_change_pct'],                                                             color:'#dc2626' },
]

const DB_OBJECTS: [string,string][] = [
  ['v_latest_prices','v'],['v_top_gainers','v'],['v_top_losers','v'],['v_sector_summary','v'],['v_52week_range','v'],
  ['sp_upsert_price','sp'],['sp_get_price_history','sp'],['sp_refresh_daily_summary','sp'],['sp_fix_sectors','sp'],
  ['fn_price_change_pct','fn'],['fn_trading_days_between','fn'],
  ['trg_validate_before_insert','trg'],['trg_refresh_summary','trg'],
]
const DB_OBJ_COLORS:Record<string,{bg:string;color:string;border:string}> = {
  v:{bg:'#eef2ff',color:'#4338ca',border:'#c7d2fe'},
  sp:{bg:'#f0fdf4',color:'#16a34a',border:'#bbf7d0'},
  fn:{bg:'#fffbeb',color:'#d97706',border:'#fde68a'},
  trg:{bg:'#fef2f2',color:'#dc2626',border:'#fecaca'},
}

function highlightSql(raw:string):string {
  return raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\b(SELECT|FROM|JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN|WHERE|AND|OR|ORDER\s+BY|GROUP\s+BY|HAVING|LIMIT|ON|AS|COUNT|AVG|SUM|MAX|MIN|DISTINCT|DATE_FORMAT|COALESCE|ROUND|NULLIF|CALL|SHOW|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH|UNION|ALL|CASE|WHEN|THEN|ELSE|END)\b/gi,
      m=>`<span class="sql-kw">${m}</span>`)
    .replace(/\b(price_data|company|trading_session|sector|watchlist|daily_market_summary|pd|c|ts|s|nepse_db)\b/g,
      m=>`<span class="sql-tbl">${m}</span>`)
    .replace(/'([^']*)'/g,(_,v)=>`<span class="sql-str">'${v}'</span>`)
    .replace(/\b(\d+(\.\d+)?)\b/g,m=>`<span class="sql-num">${m}</span>`)
    .replace(/--[^\n]*/g,m=>`<span class="sql-cmt">${m}</span>`)
}

const SQL_CSS=`
  .sql-kw{color:#4338ca;font-weight:600}.sql-tbl{color:#0891b2}
  .sql-str{color:#059669}.sql-num{color:#d97706}.sql-cmt{color:#94a3b8;font-style:italic}
`
const inp:React.CSSProperties={width:'100%',padding:'7px 10px',borderRadius:8,fontSize:12,border:'1px solid #e2e8f0',background:'white',color:'#0f172a',outline:'none'}
const lbl:React.CSSProperties={display:'block',fontSize:10,fontWeight:600,color:'#64748b',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}

function ChartTip({active,payload,label}:{active?:boolean;payload?:{name:string;value:number}[];label?:string}) {
  if(!active||!payload?.length) return null
  return (
    <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:11,boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}}>
      <p style={{color:'#94a3b8',marginBottom:4,fontSize:10}}>{label}</p>
      {payload.map(p=>(
        <div key={p.name} style={{display:'flex',justifyContent:'space-between',gap:16}}>
          <span style={{color:'#64748b'}}>{p.name}</span>
          <span style={{color:'#0f172a',fontFamily:'monospace',fontWeight:600}}>{Number(p.value).toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════════ */
export default function AnalyticsPage() {
  const [mode,      setMode]      = useState<Mode>('filter')
  const [companies, setCompanies] = useState<{symbol:string;name:string}[]>([])
  const [sectors,   setSectors]   = useState<string[]>([])

  /* filter state */
  const [data,        setData]      = useState<FilterRow[]>([])
  const [queryMs,     setQueryMs]   = useState(0)
  const [loading,     setLoading]   = useState(false)
  const [chartView,   setChartView] = useState<'price'|'volume'>('price')
  const [symbol,      setSymbol]    = useState('all')
  const [sector,      setSector]    = useState('all')
  const [from,        setFrom]      = useState(()=>daysAgo(30))
  const [to,          setTo]        = useState(()=>todayIso())
  const [minVolume,   setMinVolume]   = useState('')
  const [minTurnover, setMinTurnover] = useState('')
  const [minChange,   setMinChange]   = useState('')
  const [maxChange,   setMaxChange]   = useState('')
  const [sortBy,      setSortBy]    = useState('ts.trading_date')
  const [sortDir,     setSortDir]   = useState<'ASC'|'DESC'>('DESC')
  const [limit,       setLimit]     = useState('1000')

  /* explorer state */
  const [explorerSql,     setExplorerSql]     = useState(QUICK_QUERIES[0].sql)
  const [explorerResult,  setExplorerResult]  = useState<ExplorerResult|null>(null)
  const [explorerLoading, setExplorerLoading] = useState(false)
  const [explorerMs,      setExplorerMs]      = useState(0)
  const [schemaOpen,      setSchemaOpen]      = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(()=>{
    Promise.all([
      fetch('/api/stocks/all').then(r=>r.json()),
      fetch('/api/sectors').then(r=>r.json()),
    ]).then(([sd,sec])=>{
      setCompanies((Array.isArray(sd?.rows)?sd.rows:[]).map((r:Record<string,unknown>)=>({symbol:String(r.symbol),name:String(r.company_name??r.name??'')})))
      setSectors((sec?.sectors??[]).map((s:Record<string,unknown>)=>String(s.name)))
    })
  },[])

  const runFilter=useCallback(async()=>{
    setLoading(true); const t0=Date.now()
    try {
      const res=await fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({filters:{
          symbol:symbol!=='all'?symbol:undefined,
          sector:sector!=='all'?sector:undefined,
          from,to,
          minVolume:   minVolume   ?Number(minVolume)  :undefined,
          minTurnover: minTurnover ?Number(minTurnover):undefined,
          minChange:   minChange   ?Number(minChange)  :undefined,
          maxChange:   maxChange   ?Number(maxChange)  :undefined,
          sortBy,sortDir,limit:Number(limit),
        }})})
      const d=await res.json(); setData(d.data||[])
    } finally { setQueryMs(Date.now()-t0); setLoading(false) }
  },[symbol,sector,from,to,minVolume,minTurnover,minChange,maxChange,sortBy,sortDir,limit])

  useEffect(()=>{
    if(mode!=='filter') return
    const t=setTimeout(runFilter,400); return()=>clearTimeout(t)
  },[runFilter,mode])

  async function runExplorer(){
    if(!explorerSql.trim()) return
    setExplorerLoading(true);setExplorerResult(null);const t0=Date.now()
    try {
      const res=await fetch('/api/db-explorer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sql:explorerSql.trim()})})
      setExplorerResult(await res.json())
    } catch(e:unknown){setExplorerResult({columns:[],rows:[],rowCount:0,error:(e as Error).message})}
    finally{setExplorerMs(Date.now()-t0);setExplorerLoading(false)}
  }

  /* Derived */
  const gainers   = data.filter(r=>toNum(r.percent_change)>0).length
  const avgClose  = data.length?data.reduce((s,r)=>s+toNum(r.close_price),0)/data.length:0
  const totalTurn = data.reduce((s,r)=>s+toNum(r.turnover),0)
  const uniqueSymbols = useMemo(()=>new Set(data.map(r=>r.symbol)).size,[data])

  /**
   * Chart data:
   * - Single company → close price per date, sorted asc (last 120 pts)
   * - All companies  → group by date, compute avg close & total volume.
   *   This renders a true "all 379 companies avg" line chart.
   */
  const chartData = useMemo(()=>{
    const sorted=[...data].sort((a,b)=>a.date.localeCompare(b.date))
    if(symbol!=='all') return sorted.slice(-120).map(r=>({date:r.date,close_price:toNum(r.close_price),volume:toNum(r.volume)}))
    const map=new Map<string,{closes:number[];vols:number[]}>()
    for(const r of sorted){
      if(!map.has(r.date))map.set(r.date,{closes:[],vols:[]})
      map.get(r.date)!.closes.push(toNum(r.close_price))
      map.get(r.date)!.vols.push(toNum(r.volume))
    }
    return Array.from(map.entries()).map(([date,v])=>({
      date,
      close_price:v.closes.reduce((a,b)=>a+b,0)/v.closes.length,
      volume:v.vols.reduce((a,b)=>a+b,0),
    })).slice(-60)
  },[data,symbol])

  const chartTitle = symbol!=='all'
    ? `${symbol} — Close Price · ${from} → ${to}`
    : `Market Avg Close Price — ${uniqueSymbols} Companies · ${from} → ${to}`

  return (
    <div style={{width:'100%',maxWidth:1280,margin:'0 auto',padding:'0 0 48px',boxSizing:'border-box'}}>
      <style>{SQL_CSS}</style>

      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:'#1e1b4b',margin:0}}>Analytics</h1>
          <p style={{fontSize:13,color:'#64748b',marginTop:3}}>
            {mode==='filter'?'Filter NEPSE data · live chart preview':'Run raw SQL against nepse_db · Ctrl+Enter'}
          </p>
        </div>
        <div style={{display:'flex',background:'#f1f5f9',borderRadius:10,padding:3,gap:2}}>
          {(['filter','sql'] as Mode[]).map(m=>(
            <button key={m} onClick={()=>setMode(m)}
              style={{padding:'6px 18px',borderRadius:8,fontSize:12,fontWeight:600,border:'none',cursor:'pointer',
                background:mode===m?'white':'transparent',color:mode===m?'#4338ca':'#64748b',
                boxShadow:mode===m?'0 1px 4px rgba(0,0,0,0.08)':'none'}}>
              {m==='filter'?'⚙ Filter Builder':'⌨ SQL Explorer'}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ FILTER BUILDER ═══ */}
      {mode==='filter'&&(
        <div style={{display:'flex',flexDirection:'column',gap:16}}>

          {/* Filter card — full width, no sidebar */}
          <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
            {/* Card header with inline stats */}
            <div style={{padding:'12px 16px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
              <div>
                <span style={{fontSize:13,fontWeight:600,color:'#1e1b4b'}}>Query Filters</span>
                <span style={{fontSize:11,color:'#94a3b8',marginLeft:8}}>auto-runs · 400ms debounce</span>
              </div>
              {/* Stats strip — replaces the old sidebar */}
              {!loading&&data.length>0&&(
                <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
                  {[
                    {l:'Rows',     v:data.length.toLocaleString(), c:'#4338ca'},
                    {l:'Avg Close',v:`Rs.${avgClose.toFixed(2)}`,  c:'#0f172a'},
                    {l:'Turnover', v:`Rs.${(totalTurn/1e7).toFixed(2)}Cr`, c:'#0f172a'},
                    {l:'▲ / ▼',   v:`${gainers} / ${data.length-gainers}`, c:'#0f172a'},
                  ].map(({l,v,c})=>(
                    <span key={l} style={{fontSize:11,color:'#64748b'}}>
                      {l}: <span style={{fontWeight:700,color:c,fontFamily:'monospace'}}>{v}</span>
                    </span>
                  ))}
                </div>
              )}
              {loading&&<span style={{fontSize:11,color:'#94a3b8'}}>Running…</span>}
            </div>

            <div style={{padding:16}}>
              {/* Filter grid */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10}}>
                <div style={{gridColumn:'span 2'}}>
                  <label style={lbl}>Company</label>
                  <select value={symbol} onChange={e=>setSymbol(e.target.value)} style={inp}>
                    <option value="all">All Companies</option>
                    {companies.map(c=><option key={c.symbol} value={c.symbol}>{c.symbol} — {c.name.slice(0,22)}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Sector</label>
                  <select value={sector} onChange={e=>setSector(e.target.value)} style={inp}>
                    <option value="all">All Sectors</option>
                    {sectors.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>From</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={inp}/></div>
                <div><label style={lbl}>To</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} style={inp}/></div>
                <div><label style={lbl}>Min Volume</label><input type="number" value={minVolume} onChange={e=>setMinVolume(e.target.value)} placeholder="none" style={inp}/></div>
                <div><label style={lbl}>Min Turnover</label><input type="number" value={minTurnover} onChange={e=>setMinTurnover(e.target.value)} placeholder="none" style={inp}/></div>
                <div><label style={lbl}>Min Change %</label><input type="number" step="0.1" value={minChange} onChange={e=>setMinChange(e.target.value)} placeholder="none" style={inp}/></div>
                <div><label style={lbl}>Max Change %</label><input type="number" step="0.1" value={maxChange} onChange={e=>setMaxChange(e.target.value)} placeholder="none" style={inp}/></div>
                <div><label style={lbl}>Sort By</label>
                  <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={inp}>
                    {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Order</label>
                  <select value={sortDir} onChange={e=>setSortDir(e.target.value as 'ASC'|'DESC')} style={inp}>
                    <option value="DESC">Descending</option><option value="ASC">Ascending</option>
                  </select>
                </div>
                <div><label style={lbl}>Limit</label>
                  <select value={limit} onChange={e=>setLimit(e.target.value)} style={inp}>
                    {['50','100','200','500','1000','2000'].map(n=><option key={n} value={n}>{n} rows</option>)}
                  </select>
                </div>
              </div>

              {/* Quick presets */}
              <div style={{display:'flex',alignItems:'center',gap:6,marginTop:12,paddingTop:12,borderTop:'1px solid #f1f5f9',flexWrap:'wrap'}}>
                <span style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em'}}>Quick:</span>
                {([['1D',0],['1W',7],['1M',30],['3M',90],['6M',180],['1Y',365]] as [string,number][]).map(([l,d])=>(
                  <button key={l} onClick={()=>{setFrom(daysAgo(d));setTo(todayIso())}}
                    style={{fontSize:11,padding:'3px 9px',borderRadius:6,border:'1px solid #e2e8f0',color:'#475569',background:'white',cursor:'pointer',fontWeight:500}}>
                    {l}
                  </button>
                ))}
                {symbol!=='all'&&(
                  <Link href={`/dashboard/stock/${symbol}`}
                    style={{marginLeft:'auto',fontSize:11,padding:'3px 10px',borderRadius:6,border:'1px solid #c7d2fe',background:'#eef2ff',color:'#4338ca',textDecoration:'none',fontWeight:600}}>
                    Full Chart →
                  </Link>
                )}
              </div>

              {/* ── CHART: directly below Quick buttons, full width ── */}
              {(chartData.length>1||loading)&&(
                <div style={{marginTop:16,borderTop:'1px solid #f1f5f9',paddingTop:16}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
                    <div>
                      <p style={{fontSize:12,fontWeight:600,color:'#1e1b4b',margin:0}}>{chartTitle}</p>
                      <p style={{fontSize:10,color:'#94a3b8',marginTop:2}}>
                        {loading?'Loading data…':`${chartData.length} data points`}
                        {symbol==='all'&&!loading&&` · avg across ${uniqueSymbols} companies`}
                      </p>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      {(['price','volume'] as const).map(v=>(
                        <button key={v} onClick={()=>setChartView(v)}
                          style={{fontSize:11,padding:'4px 12px',borderRadius:6,cursor:'pointer',fontWeight:600,
                            border:`1px solid ${chartView===v?'#c7d2fe':'#e2e8f0'}`,
                            background:chartView===v?'#eef2ff':'white',
                            color:chartView===v?'#4338ca':'#64748b'}}>
                          {v==='price'?'Price':'Volume'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {loading?(
                    <div style={{height:240,display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc',borderRadius:10}}>
                      <span style={{fontSize:12,color:'#94a3b8'}}>Loading chart…</span>
                    </div>
                  ):chartView==='price'?(
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={chartData} margin={{top:4,right:8,left:0,bottom:0}}>
                        <defs>
                          <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#4338ca" stopOpacity={0.12}/>
                            <stop offset="95%" stopColor="#4338ca" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                        <XAxis dataKey="date" tick={{fill:'#94a3b8',fontSize:9}} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                        <YAxis tick={{fill:'#94a3b8',fontSize:9}} tickLine={false} axisLine={false}
                          tickFormatter={v=>`Rs.${Number(v).toFixed(0)}`} width={72} domain={['auto','auto']}/>
                        <Tooltip content={<ChartTip/>}/>
                        <Area type="monotone" dataKey="close_price" name="Close" stroke="#4338ca" strokeWidth={2}
                          fill="url(#aGrad)" dot={false} activeDot={{r:4,fill:'#4338ca'}}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  ):(
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={chartData} margin={{top:4,right:8,left:0,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                        <XAxis dataKey="date" tick={{fill:'#94a3b8',fontSize:9}} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                        <YAxis tick={{fill:'#94a3b8',fontSize:9}} tickLine={false} axisLine={false} width={72}/>
                        <Tooltip content={<ChartTip/>}/>
                        <Bar dataKey="volume" name="Volume" fill="#c7d2fe" radius={[2,2,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Results table */}
          <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              <span style={{fontSize:13,fontWeight:600,color:'#1e1b4b'}}>Results</span>
              <span style={{fontSize:11,color:'#94a3b8'}}>
                {loading?'Running…':`${data.length} rows · ${SORT_OPTIONS.find(o=>o.value===sortBy)?.label} ${sortDir} · ${queryMs}ms`}
              </span>
            </div>
            <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
              <table style={{width:'100%',minWidth:820,fontSize:12,borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
                    {['Symbol','Company','Sector','Date','Open','High','Low','Close','Change%','Volume','Turnover'].map(h=>(
                      <th key={h} style={{textAlign:'left',padding:'8px 14px',color:'#64748b',fontWeight:600,whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading?(
                    <tr><td colSpan={11} style={{textAlign:'center',padding:'40px 0',color:'#94a3b8'}}>Running query…</td></tr>
                  ):data.length===0?(
                    <tr><td colSpan={11} style={{textAlign:'center',padding:'40px 0',color:'#94a3b8'}}>No results — adjust the filters above</td></tr>
                  ):data.map((row,i)=>{
                    const up=toNum(row.percent_change)>=0
                    return (
                      <tr key={`${row.symbol}-${row.date}-${i}`}
                        style={{borderBottom:'1px solid #f8fafc',cursor:'pointer'}}
                        onClick={()=>window.location.href=`/dashboard/stock/${row.symbol}`}
                        onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='#f8fafc'}
                        onMouseOut={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                        <td style={{padding:'8px 14px'}}>
                          <Link href={`/dashboard/stock/${row.symbol}`} onClick={e=>e.stopPropagation()}
                            style={{color:'#4338ca',fontWeight:700,textDecoration:'none'}}>{row.symbol}</Link>
                        </td>
                        <td style={{padding:'8px 14px',color:'#475569',maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.name}</td>
                        <td style={{padding:'8px 14px'}}>
                          <span style={{background:'#eef2ff',color:'#4338ca',border:'1px solid #c7d2fe',fontSize:10,padding:'2px 6px',borderRadius:4,whiteSpace:'nowrap'}}>
                            {String(row.sector||'').split(' ').slice(0,2).join(' ')}
                          </span>
                        </td>
                        <td style={{padding:'8px 14px',color:'#94a3b8',fontFamily:'monospace',whiteSpace:'nowrap'}}>{row.date}</td>
                        <td style={{padding:'8px 14px',color:'#64748b',fontFamily:'monospace'}}>{toNum(row.open_price).toFixed(2)}</td>
                        <td style={{padding:'8px 14px',color:'#16a34a',fontFamily:'monospace',fontWeight:600}}>{toNum(row.high_price).toFixed(2)}</td>
                        <td style={{padding:'8px 14px',color:'#dc2626',fontFamily:'monospace',fontWeight:600}}>{toNum(row.low_price).toFixed(2)}</td>
                        <td style={{padding:'8px 14px',color:'#0f172a',fontFamily:'monospace',fontWeight:700}}>{toNum(row.close_price).toFixed(2)}</td>
                        <td style={{padding:'8px 14px'}}>
                          <span style={{background:up?'#f0fdf4':'#fef2f2',color:up?'#16a34a':'#dc2626',border:`1px solid ${up?'#bbf7d0':'#fecaca'}`,fontSize:10,padding:'2px 6px',borderRadius:4,fontWeight:600,whiteSpace:'nowrap'}}>
                            {up?'+':''}{toNum(row.percent_change).toFixed(2)}%
                          </span>
                        </td>
                        <td style={{padding:'8px 14px',color:'#64748b',fontFamily:'monospace'}}>{toNum(row.volume).toLocaleString()}</td>
                        <td style={{padding:'8px 14px',color:'#64748b',fontFamily:'monospace'}}>Rs.{(toNum(row.turnover)/1e6).toFixed(2)}M</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SQL EXPLORER ═══ */}
      {mode==='sql'&&(
        <div style={{display:'grid',gridTemplateColumns:'220px minmax(0,1fr)',gap:16,alignItems:'start'}}>
          {/* Sidebar */}
          <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
            <div style={{padding:'10px 14px',borderBottom:'1px solid #f1f5f9',background:'#f8fafc'}}>
              <p style={{fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.06em',margin:0}}>Quick Queries</p>
            </div>
            <div style={{maxHeight:600,overflowY:'auto'}}>
              {QUICK_QUERIES.map(q=>(
                <button key={q.label} onClick={()=>{setExplorerSql(q.sql);setExplorerResult(null)}}
                  style={{width:'100%',textAlign:'left',padding:'9px 14px',fontSize:11,border:'none',borderBottom:'1px solid #f8fafc',cursor:'pointer',
                    background:explorerSql===q.sql?'#eef2ff':'transparent',color:explorerSql===q.sql?'#4338ca':'#475569',fontWeight:explorerSql===q.sql?600:400}}
                  onMouseOver={e=>{if(explorerSql!==q.sql)(e.currentTarget as HTMLElement).style.background='#f8fafc'}}
                  onMouseOut={e=>{if(explorerSql!==q.sql)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Editor + results */}
          <div style={{display:'flex',flexDirection:'column',gap:14,minWidth:0}}>
            <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:'1px solid #f1f5f9',background:'#f8fafc'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:4,border:'1px solid #c7d2fe',color:'#4338ca',background:'#eef2ff',fontFamily:'monospace'}}>SQL</span>
                  <span style={{fontSize:11,color:'#94a3b8'}}>nepse_db · SELECT · SHOW · CALL</span>
                </div>
                <button onClick={runExplorer} disabled={explorerLoading}
                  style={{fontSize:12,padding:'6px 16px',borderRadius:8,fontWeight:600,color:'white',background:explorerLoading?'#a5b4fc':'#4338ca',border:'none',cursor:explorerLoading?'not-allowed':'pointer'}}>
                  {explorerLoading?'Running…':'▶ Run Query'}
                </button>
              </div>
              <div style={{position:'relative'}}>
                <pre aria-hidden style={{position:'absolute',top:0,left:0,right:0,bottom:0,margin:0,padding:'12px 16px',fontSize:13,lineHeight:1.7,fontFamily:'"JetBrains Mono",Consolas,monospace',pointerEvents:'none',whiteSpace:'pre-wrap',wordBreak:'break-word',color:'transparent',background:'transparent',overflowX:'hidden'}}
                  dangerouslySetInnerHTML={{__html:highlightSql(explorerSql)}}/>
                <textarea ref={textareaRef} value={explorerSql} onChange={e=>setExplorerSql(e.target.value)}
                  onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();runExplorer()}}}
                  rows={6} spellCheck={false}
                  style={{width:'100%',padding:'12px 16px',fontSize:13,lineHeight:1.7,fontFamily:'"JetBrains Mono",Consolas,monospace',color:'#1e1b4b',background:'#fafafa',border:'none',outline:'none',resize:'vertical',caretColor:'#4338ca',boxSizing:'border-box'}}
                  placeholder="SELECT * FROM v_latest_prices LIMIT 10;"/>
              </div>
              <div style={{padding:'6px 16px 10px',fontSize:10,color:'#94a3b8'}}>Ctrl+Enter to run · SELECT, SHOW, CALL only</div>
            </div>

            {explorerResult&&(
              <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden',minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:'1px solid #f1f5f9',background:'#f8fafc',flexWrap:'wrap'}}>
                  {explorerResult.error
                    ?<span style={{fontSize:12,fontWeight:600,color:'#dc2626'}}>✗ Error</span>
                    :<><span style={{fontSize:12,fontWeight:600,color:'#16a34a'}}>✓ {explorerResult.rowCount} row{explorerResult.rowCount!==1?'s':''}</span>
                      <span style={{fontSize:11,color:'#94a3b8'}}>{explorerMs}ms · {explorerResult.columns.length} cols</span></>
                  }
                </div>
                {explorerResult.error
                  ?<div style={{padding:'12px 16px',fontFamily:'monospace',fontSize:12,color:'#dc2626',background:'#fef2f2',wordBreak:'break-all'}}>{explorerResult.error}</div>
                  :explorerResult.rows.length===0
                    ?<div style={{padding:'32px 0',textAlign:'center',fontSize:13,color:'#94a3b8'}}>No rows returned</div>
                    :<div style={{overflowX:'auto',maxHeight:400,WebkitOverflowScrolling:'touch'}}>
                      <table style={{width:'100%',fontSize:12,borderCollapse:'collapse',tableLayout:'auto'}}>
                        <thead style={{position:'sticky',top:0,zIndex:1}}>
                          <tr style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
                            <th style={{padding:'7px 10px',textAlign:'left',color:'#94a3b8',fontWeight:600,width:32,whiteSpace:'nowrap'}}>#</th>
                            {explorerResult.columns.map(col=>(
                              <th key={col} style={{padding:'7px 10px',textAlign:'left',color:'#4338ca',fontWeight:700,whiteSpace:'nowrap'}}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {explorerResult.rows.map((row,i)=>(
                            <tr key={i} style={{borderBottom:'1px solid #f8fafc'}}
                              onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='#f8fafc'}
                              onMouseOut={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                              <td style={{padding:'7px 10px',color:'#94a3b8',fontFamily:'monospace'}}>{i+1}</td>
                              {(row as unknown[]).map((cell,j)=>(
                                <td key={j} style={{padding:'7px 10px',whiteSpace:'nowrap',maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',fontFamily:'monospace',
                                  color:cell===null?'#94a3b8':typeof cell==='number'?'#4338ca':'#0f172a',fontStyle:cell===null?'italic':'normal'}}>
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
            <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
              <button onClick={()=>setSchemaOpen(v=>!v)}
                style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',background:'none',border:'none',cursor:'pointer',borderBottom:schemaOpen?'1px solid #f1f5f9':'none'}}>
                <span style={{fontSize:12,fontWeight:600,color:'#1e1b4b'}}>Schema Reference — nepse_db</span>
                <span style={{fontSize:14,color:'#94a3b8',transform:schemaOpen?'rotate(180deg)':'none',transition:'transform 0.2s'}}>▾</span>
              </button>
              {schemaOpen&&(
                <div style={{padding:16}}>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))',gap:10,marginBottom:16}}>
                    {SCHEMA_TABLES.map(t=>(
                      <div key={t.name} style={{border:'1px solid #e2e8f0',borderRadius:8,padding:10}}>
                        <p style={{fontFamily:'monospace',fontSize:11,fontWeight:700,color:t.color,margin:'0 0 6px'}}>{t.name}</p>
                        {t.cols.map(col=>(
                          <div key={col} style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                            <span style={{width:5,height:5,borderRadius:'50%',background:t.color,opacity:0.4,flexShrink:0}}/>
                            <span style={{fontSize:10,color:'#64748b',fontFamily:'monospace'}}>{col}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div style={{borderTop:'1px solid #f1f5f9',paddingTop:12}}>
                    <p style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Views · Procedures · Functions · Triggers</p>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {DB_OBJECTS.map(([name,type])=>{
                        const c=DB_OBJ_COLORS[type]
                        return (
                          <span key={name}
                            style={{fontSize:10,padding:'2px 8px',borderRadius:4,border:`1px solid ${c.border}`,background:c.bg,color:c.color,fontFamily:'monospace',cursor:'pointer'}}
                            onClick={()=>{const q=QUICK_QUERIES.find(qq=>qq.label.toLowerCase().includes(name.toLowerCase()));if(q){setExplorerSql(q.sql);setExplorerResult(null)}}}>
                            {name}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}