import { Fragment } from 'react'
import { CATEGORIES, RM, coversMonth, monthLabel, paidFor, propColor, shortMonth, propertyStats, roomOrder, useData, useLookups, type Tenancy } from '../lib/data'
import { Badge, PropTag, Stat } from '../ui'

export default function PropertyDashboard({ propertyId, month }: { propertyId: string; month: string }) {
  const { data } = useData()
  const L = useLookups()
  const st = propertyStats(data, month).find(s => s.property.id === propertyId)
  if (!st) return null
  const p = st.property
  const alertAt = data.settings?.low_collection_alert ?? 80
  const targetCollected = p.target_collected || st.expected
  const targetProfit = targetCollected - p.target_expenses
  const expenses = data.expenses.filter(e => e.period === month && e.property_id === p.id)
  const maint = expenses.filter(e => e.category === 'maintenance')
  const maintTotal = maint.reduce((a, e) => a + e.amount, 0)
  const byCat = Object.entries(expenses.reduce<Record<string, number>>((a, e) => ({ ...a, [e.category]: (a[e.category] ?? 0) + e.amount }), {}))
  const occPct = st.rooms ? st.occupied / st.rooms * 100 : 0

  // one row per bed: tenants who cover this month (or are active), then empty beds
  const rooms = data.rooms.filter(r => r.property_id === p.id && r.active).sort(roomOrder).flatMap(r => {
    const beds = r.beds || 1
    const inRoom = data.tenancies.filter(x => x.room_id === r.id)
    const covering = inRoom.filter(x => coversMonth(x, month))
    const shown = (covering.length ? covering : inRoom.filter(x => x.status === 'active')).slice(0, Math.max(beds, covering.length))
    const rows: { t?: Tenancy; paid: number; due: number; status: string }[] = shown.map(t => {
      const paid = paidFor(data, t.id, month)
      const due = coversMonth(t, month) ? t.monthly_rent : 0
      return { t, paid, due, status: paid >= due && due > 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid' }
    })
    // payments from tenants not shown (e.g. moved out mid-month) still count for the room
    const extra = inRoom.filter(x => !shown.includes(x)).reduce((a, x) => a + paidFor(data, x.id, month), 0)
    if (rows.length && extra) rows[0].paid += extra
    while (rows.length < beds) rows.push({ paid: rows.length === 0 ? extra : 0, due: 0, status: 'Vacant' })
    return rows.map((x, i) => ({ ...x, r, key: r.id + i, label: beds > 1 ? `${r.name} · bed ${i + 1}` : r.name, tenant: x.t && L.tenant(x.t.tenant_id) }))
  })

  return (
    <>
      <h2 className="sub-head"><PropTag code={p.code} color={propColor(data, p.id)} /> {p.name} <span className="muted">· {monthLabel(month)}</span></h2>
      <div className="stats six">
        <Stat icon="wallet" accent="teal" label="Net collected" value={RM(st.collected)} sub={`Target ${RM(targetCollected)}`} />
        <Stat icon="receipt" accent="amber" label="Total expenses" value={RM(st.expenses)} tone={p.target_expenses && st.expenses > p.target_expenses ? 'bad' : undefined} sub={`Target ${RM(p.target_expenses)}`} />
        <Stat icon="trend" accent="green" label="Net profit / (loss)" value={RM(st.profit)} tone={st.profit < 0 ? 'bad' : 'ok'} sub={`Target profit ${RM(targetProfit)}`} />
        <Stat icon="bed" accent="violet" label="Occupancy" value={`${Math.round(occPct)}%`} sub={`${st.occupied} of ${st.rooms} beds occupied`} />
        <Stat icon="wrench" accent="pink" label="Maintenance" value={RM(maintTotal)} sub={`${maint.length} item${maint.length === 1 ? '' : 's'} this month`} />
        <Stat icon="percent" accent="blue" label="Collection rate" value={`${Math.round(st.rate)}%`} tone={st.rate < alertAt ? 'bad' : 'ok'} sub={st.rate < alertAt ? `Below ${alertAt}% alert level` : 'At or above alert level'} />
      </div>

      <div className="grid2">
        <section className="card">
          <h2>Rooms and tenants</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>Room</th><th className="num">Price</th><th>Tenant</th><th className="num">Paid</th><th>Status</th></tr></thead>
            <tbody>{rooms.map(x => (
              <tr key={x.key}>
                <td>{x.label}</td>
                <td className="num">{RM(x.r.price)}</td>
                <td>{x.tenant?.nickname ?? <span className="muted">—</span>}{x.t?.status === 'ended' && <span className="muted small"> (moved out)</span>}</td>
                <td className="num">{x.paid ? RM(x.paid) : ''}</td>
                <td><Badge kind={x.status === 'Paid' ? 'ok' : x.status === 'Partial' ? 'warn' : x.status === 'Unpaid' ? 'bad' : 'muted'}>{x.status}</Badge></td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>

        <ProfitTrend propertyId={p.id} month={month} />
      </div>

      <div className="grid2">
        <section className="card">
          <h2>Maintenance · {monthLabel(month)}</h2>
          {maint.length === 0 ? <p className="empty">No maintenance recorded this month.</p> : (
            <ul className="list compact">{maint.map(e => (
              <li key={e.id}><span>{e.label || 'Maintenance'} {e.note && <span className="muted small">· {e.note}</span>}</span><b>{RM(e.amount)}</b></li>
            ))}</ul>
          )}
        </section>
        <section className="card">
          <h2>All expenses · {monthLabel(month)}</h2>
          {byCat.length === 0 ? <p className="empty">No expenses recorded this month.</p> : (
            <dl className="sum flat">
              {byCat.map(([c, a]) => <Fragment key={c}><dt>{CATEGORIES[c] ?? c}</dt><dd>{RM(a)}</dd></Fragment>)}
              <dt><b>Total</b></dt><dd>{RM(st.expenses)}</dd>
            </dl>
          )}
        </section>
      </div>
    </>
  )
}

/** Year-to-date monthly profit (bars) against target profit (dashed line). */
function ProfitTrend({ propertyId, month }: { propertyId: string; month: string }) {
  const { data } = useData()
  const n = Number(month.slice(5, 7))
  const rows = Array.from({ length: n }, (_, i) => `${month.slice(0, 4)}-${String(i + 1).padStart(2, '0')}-01`).map(m => {
    const st = propertyStats(data, m).find(x => x.property.id === propertyId)!
    const target = (st.property.target_collected || st.expected) - st.property.target_expenses
    return { m, collected: st.collected, expenses: st.expenses, profit: st.profit, target }
  })
  const sum = (k: 'collected' | 'expenses' | 'profit' | 'target') => rows.reduce((a, r) => a + r[k], 0)
  const hi = Math.max(1, ...rows.flatMap(r => [r.profit, r.target]))
  const lo = Math.min(0, ...rows.flatMap(r => [r.profit, r.target]))
  const W = 320, H = 170, top = 8, bottom = 18, plotH = H - top - bottom
  const y = (v: number) => top + (hi - v) / (hi - lo) * plotH
  const slot = W / rows.length, bw = Math.min(26, slot * 0.6)
  const line = rows.map((r, i) => `${i ? 'L' : 'M'}${(i + 0.5) * slot},${y(r.target)}`).join(' ')
  const ytdProfit = sum('profit'), ytdTarget = sum('target')
  return (
    <section className="card">
      <h2>Profit trend · {month.slice(0, 4)} year to date</h2>
      <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly profit compared with target profit">
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} className="axis" />
        {rows.map((r, i) => {
          const x = (i + 0.5) * slot - bw / 2, y0 = y(0), y1 = y(r.profit)
          return <g key={r.m}>
            <rect x={x} width={bw} y={Math.min(y0, y1)} height={Math.max(1, Math.abs(y1 - y0))} rx="2" className={r.profit < 0 ? 'tr-neg' : 'tr-pos'}>
              <title>{`${monthLabel(r.m)}: collected ${RM(r.collected)}, expenses ${RM(r.expenses)}, profit ${RM(r.profit)}, target ${RM(r.target)}`}</title>
            </rect>
            <text x={(i + 0.5) * slot} y={H - 4} textAnchor="middle" className="lbl">{shortMonth(r.m)}</text>
          </g>
        })}
        {rows.length > 1 ? <path d={line} className="target" /> : <line x1={slot * 0.1} x2={slot * 0.9} y1={y(rows[0]?.target ?? 0)} y2={y(rows[0]?.target ?? 0)} className="target" />}
      </svg>
      <div className="legend"><span><i className="tr-pos" /> Profit</span><span><i className="tr-neg" /> Loss</span><span><i className="tr-tgt" /> Target profit</span></div>
      <dl className="sum">
        <dt>Collected (YTD)</dt><dd>{RM(sum('collected'))}</dd>
        <dt>Expenses (YTD)</dt><dd>{RM(sum('expenses'))}</dd>
        <dt>Profit (YTD)</dt><dd className={ytdProfit < 0 ? 'neg' : 'pos'}>{RM(ytdProfit)}</dd>
        <dt>Target profit (YTD)</dt><dd>{RM(ytdTarget)} <span className="muted small">({ytdTarget ? Math.round(ytdProfit / ytdTarget * 100) : 0}% reached)</span></dd>
      </dl>
    </section>
  )
}
