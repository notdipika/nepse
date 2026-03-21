'use client'
import { useMemo } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type Point = { date:string; open:number; high:number; low:number; close:number; volume:number }

function Tip({ active, payload, label }: any) {
  if (!active||!payload?.length) return null
  const d = payload[0]?.payload
  const fmt = (v:any) => Number(v||0).toLocaleString('en-NP',{maximumFractionDigits:2})
  return (
    <div className="rounded-lg p-3 text-xs shadow-xl mono" style={{background:'var(--card)',border:'1px solid var(--border2)'}}>
      <p className="text-[#94a3b8] mb-2">{new Date(label).toLocaleDateString('en-NP',{month:'short',day:'numeric',year:'numeric'})}</p>
      {[['Open','open','#94a3b8'],['High','high','#22c55e'],['Low','low','#ef4444'],['Close','close','#f1f5ff']].map(([l,k,c])=>(
        <div key={String(k)} className="flex justify-between gap-6 mb-0.5">
          <span style={{color:'#64748b'}}>{l}</span>
          <span style={{color:c}}>Rs.{fmt(d?.[String(k)])}</span>
        </div>
      ))}
      <div className="border-t mt-2 pt-2 flex justify-between gap-6" style={{borderColor:'var(--border)'}}>
        <span style={{color:'#64748b'}}>Volume</span>
        <span className="text-[#94a3b8]">{Number(d?.volume||0).toLocaleString()}</span>
      </div>
    </div>
  )
}

export default function PriceChart({ data, title='Price History' }: { data: Point[]; title?: string }) {
  const isUp = useMemo(()=>(data.at(-1)?.close??0)>=(data[0]?.close??0), [data])
  const color = isUp ? '#3b82f6' : '#ef4444'
  const gradId = `g${Math.random().toString(36).slice(2,7)}`
  const fmt = (d:string) => new Date(d).toLocaleDateString('en-NP',{month:'short',day:'numeric'})

  if (data.length < 2) return <div className="h-40 flex items-center justify-center text-sm text-[#475569]">Not enough data</div>

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-[#475569] mb-2">{title} · {data.length} trading days</p>
        <ResponsiveContainer width="100%" height={200} minWidth={0}>
          <AreaChart data={data} margin={{top:4,right:4,left:0,bottom:0}}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.18}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,71,0.8)" vertical={false}/>
            <XAxis dataKey="date" tickFormatter={fmt} tick={{fill:'#475569',fontSize:10}} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
            <YAxis tick={{fill:'#475569',fontSize:10}} tickLine={false} axisLine={false} tickFormatter={v=>`Rs.${Number(v).toLocaleString()}`} width={80}/>
            <Tooltip content={<Tip/>}/>
            <Area type="monotone" dataKey="close" stroke={color} strokeWidth={1.5} fill={`url(#${gradId})`} dot={false} activeDot={{r:3,fill:color}}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div>
        <p className="text-xs text-[#475569] mb-1">Volume</p>
        <ResponsiveContainer width="100%" height={55} minWidth={0}>
          <BarChart data={data} margin={{top:0,right:4,left:0,bottom:0}}>
            <XAxis dataKey="date" hide/>
            <YAxis tick={{fill:'#475569',fontSize:9}} axisLine={false} tickLine={false} width={80}
              tickFormatter={v=>{const n=Number(v);return n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(0)}K`:String(n)}}/>
            <Tooltip contentStyle={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,fontSize:11}}
              formatter={(v:any)=>[Number(v).toLocaleString(),'Volume']}
              labelFormatter={l=>fmt(String(l))}/>
            <Bar dataKey="volume" fill="#1e2d47" radius={[2,2,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
