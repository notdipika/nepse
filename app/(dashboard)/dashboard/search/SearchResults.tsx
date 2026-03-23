'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface SearchRow {
  symbol: string
  name: string
  sector: string
  close_price: number | null
  percent_change: number | null
  volume: number | null
  trading_date: string | null
}

export default function SearchResults({ results }: { results: SearchRow[] }) {
  const router = useRouter()

  return (
    <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs font-semibold border-b"
            style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#64748b' }}>
            <th className="text-left px-5 py-3">Symbol</th>
            <th className="text-left px-4 py-3">Company</th>
            <th className="text-left px-4 py-3">Sector</th>
            <th className="text-right px-4 py-3">Close</th>
            <th className="text-right px-4 py-3">Change</th>
            <th className="text-right px-5 py-3">Volume</th>
          </tr>
        </thead>
        <tbody>
          {results.map(r => {
            const up = Number(r.percent_change ?? 0) >= 0
            return (
              <tr
                key={`${r.symbol}-${r.trading_date ?? 'nd'}`}
                style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                onClick={() => router.push(`/dashboard/stock/${r.symbol}`)}
                onMouseOver={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                onMouseOut={e  => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <td className="px-5 py-3">
                  <Link
                    href={`/dashboard/stock/${r.symbol}`}
                    onClick={e => e.stopPropagation()}
                    style={{ color: '#4338ca', fontWeight: 700, textDecoration: 'none' }}
                  >
                    {r.symbol}
                  </Link>
                </td>
                <td className="px-4 py-3 max-w-[180px] truncate" style={{ color: '#475569' }}>
                  {r.name}
                </td>
                <td className="px-4 py-3">
                  <span style={{
                    fontSize: 10, padding: '2px 7px', borderRadius: 4,
                    background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe',
                  }}>
                    {String(r.sector ?? '').split(' ').slice(0, 2).join(' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold"
                  style={{ color: '#0f172a', fontFamily: 'monospace' }}>
                  {r.close_price != null
                    ? `Rs.${Number(r.close_price).toLocaleString('en-NP', { maximumFractionDigits: 2 })}`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.percent_change != null ? (
                    <span style={{ fontSize: 11, fontWeight: 600, color: up ? '#16a34a' : '#dc2626' }}>
                      {up ? '+' : ''}{Number(r.percent_change).toFixed(2)}%
                    </span>
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right" style={{ color: '#64748b', fontFamily: 'monospace' }}>
                  {r.volume != null ? Number(r.volume).toLocaleString() : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}