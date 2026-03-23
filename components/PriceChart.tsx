'use client'

import { useMemo, useState } from 'react'
import {
  AreaChart, Area, ComposedChart, Bar,
  CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

/* ─── Types ──────────────────────────────────────────────── */
interface PricePoint {
  date: string
  open: number; high: number; low: number; close: number; volume: number
}

/** Shape accepted from watchlist history panels */
interface LegacyDataPoint {
  name: string
  open?: number; high?: number; low?: number; close: number; volume?: number
}

interface PriceChartProps {
  /** Legacy prop — from watchlist expanded rows (uses `name` as date key) */
  data?: LegacyDataPoint[]
  /** Preferred prop — from stock detail page (uses `date` key) */
  initialData?: PricePoint[]
  symbol?: string
  title?: string
}

/* ─── Formatters ─────────────────────────────────────────── */
function fmtDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('en-NP', { month: 'short', day: 'numeric' })
  } catch {
    return d
  }
}

function fmtVol(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

const isoDate = (d: Date) => d.toISOString().split('T')[0]

/* ─── Tooltip ────────────────────────────────────────────── */
interface TooltipPayload {
  payload?: PricePoint
}
interface ChartTipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}

function ChartTip({ active, payload, label }: ChartTipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  const ROWS: [string, keyof PricePoint, string][] = [
    ['Open',  'open',  '#64748b'],
    ['High',  'high',  '#16a34a'],
    ['Low',   'low',   '#dc2626'],
    ['Close', 'close', '#1e1b4b'],
  ]
  return (
    <div
      className="bg-white border rounded-lg p-3 text-xs shadow-md"
      style={{ borderColor: '#e2e8f0', minWidth: 148 }}
    >
      <p className="font-medium mb-2" style={{ color: '#64748b' }}>
        {fmtDate(String(label ?? ''))}
      </p>
      {ROWS.map(([label, key, color]) => (
        <div key={key} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: '#94a3b8' }}>{label}</span>
          <span className="font-semibold" style={{ color, fontFamily: 'monospace' }}>
            Rs.{Number(d?.[key] ?? 0).toLocaleString('en-NP', { maximumFractionDigits: 2 })}
          </span>
        </div>
      ))}
      <div
        className="flex justify-between gap-4 pt-2 mt-1 border-t"
        style={{ borderColor: '#f1f5f9' }}
      >
        <span style={{ color: '#94a3b8' }}>Volume</span>
        <span style={{ color: '#64748b', fontFamily: 'monospace' }}>
          {fmtVol(Number(d?.volume ?? 0))}
        </span>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
export default function PriceChart({
  data, initialData, symbol, title = 'Price History',
}: PriceChartProps) {
  const [from, setFrom] = useState('')
  const [to,   setTo]   = useState('')

  /* Normalise both prop shapes into PricePoint[] */
  const allRows = useMemo<PricePoint[]>(() => {
    if (initialData?.length) return initialData
    if (!data?.length) return []
    return data.map(d => ({
      date:   d.name,
      open:   Number(d.open   ?? d.close ?? 0),
      high:   Number(d.high   ?? d.close ?? 0),
      low:    Number(d.low    ?? d.close ?? 0),
      close:  Number(d.close  ?? 0),
      volume: Number(d.volume ?? 0),
    }))
  }, [data, initialData])

  /* Date filter */
  const rows = useMemo(() => {
    if (!from && !to) return allRows
    return allRows.filter(r => {
      if (from && r.date < from) return false
      if (to   && r.date > to)   return false
      return true
    })
  }, [allRows, from, to])

  const lastClose  = rows.at(-1)?.close  ?? 0
  const firstClose = rows.at(0)?.close   ?? 0
  const isUp  = lastClose >= firstClose
  const color = isUp ? '#16a34a' : '#dc2626'
  /* Stable gradient id — changes with symbol so multiple charts on one page don't clash */
  const gradId = `price-grad-${symbol ?? 'default'}`

  const inputStyle: React.CSSProperties = {
    border: '1px solid #e2e8f0', color: '#0f172a',
    background: 'white', fontFamily: 'monospace',
  }

  return (
    <div className="space-y-3">

      {/* Date range controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium" style={{ color: '#64748b' }}>Range:</span>

        <input
          type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="text-xs px-2 py-1 rounded-lg outline-none"
          style={inputStyle}
          onFocus={e => e.target.style.borderColor = '#c7d2fe'}
          onBlur={e  => e.target.style.borderColor = '#e2e8f0'}
        />
        <span className="text-xs" style={{ color: '#94a3b8' }}>to</span>
        <input
          type="date" value={to} onChange={e => setTo(e.target.value)}
          className="text-xs px-2 py-1 rounded-lg outline-none"
          style={inputStyle}
          onFocus={e => e.target.style.borderColor = '#c7d2fe'}
          onBlur={e  => e.target.style.borderColor = '#e2e8f0'}
        />

        {(from || to) && (
          <button
            onClick={() => { setFrom(''); setTo('') }}
            className="text-xs px-2.5 py-1 rounded-lg font-medium"
            style={{ background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', cursor: 'pointer' }}
          >
            Reset
          </button>
        )}

        {/* Quick presets */}
        {([10, 20, 30] as const).map(d => (
          <button
            key={d}
            onClick={() => {
              const f = new Date(); f.setDate(f.getDate() - d)
              setFrom(isoDate(f)); setTo(isoDate(new Date()))
            }}
            className="text-xs px-2.5 py-1 rounded-lg border font-medium"
            style={{ borderColor: '#e2e8f0', color: '#64748b', background: 'white', cursor: 'pointer' }}
            onMouseOver={e => {
              (e.currentTarget as HTMLElement).style.borderColor = '#c7d2fe'
              ;(e.currentTarget as HTMLElement).style.color      = '#4338ca'
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'
              ;(e.currentTarget as HTMLElement).style.color      = '#64748b'
            }}
          >
            {d}D
          </button>
        ))}

        {rows.length > 0 && (
          <span className="ml-auto text-xs" style={{ color: '#94a3b8' }}>
            {rows.at(0)?.date} → {rows.at(-1)?.date} · {rows.length} days
          </span>
        )}
      </div>

      {rows.length < 2 ? (
        <div className="h-44 flex items-center justify-center text-sm" style={{ color: '#94a3b8' }}>
          {allRows.length === 0 ? 'No price history available' : 'No data for selected range'}
        </div>
      ) : (
        <>
          {title && <p className="text-xs" style={{ color: '#94a3b8' }}>{title}</p>}

          {/* Price chart */}
          <ResponsiveContainer width="100%" height={220} minWidth={0}>
            <AreaChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.12} />
                  <stop offset="95%" stopColor={color} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `Rs.${Number(v).toLocaleString()}`}
                width={82}
              />
              <Tooltip content={<ChartTip />} />
              <Area
                type="monotone"
                dataKey="close"
                name="Close"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{ r: 3, fill: color }}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Volume chart */}
          <div>
            <p className="text-xs mb-1" style={{ color: '#94a3b8' }}>Volume</p>
            <ResponsiveContainer width="100%" height={60} minWidth={0}>
              <ComposedChart data={rows} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 9 }}
                  axisLine={false} tickLine={false}
                  width={82}
                  tickFormatter={v => fmtVol(Number(v))}
                />
                <Bar dataKey="volume" fill="#c7d2fe" radius={[2, 2, 0, 0]} />
                <Tooltip
                  contentStyle={{
                    background: 'white', border: '1px solid #e2e8f0',
                    borderRadius: 8, fontSize: 11,
                  }}
                  formatter={(v) => [fmtVol(Number(v ?? 0)), 'Volume']}
                  labelFormatter={(l) => fmtDate(String(l ?? ''))}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}