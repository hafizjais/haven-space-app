import { Fragment } from 'react'
import { CATEGORIES, RM, coversMonth, monthLabel, paidFor, propertyStats, useData, useLookups, type Tenancy } from '../lib/data'
import { Badge, Stat } from '../ui'

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
  const rooms = data.rooms.filter(r => r.property_id === p.id && r.active).sort((a, b) => a.sort - b.sort).flatMap(r => {
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
  const max = Math.max(1, ...rooms.flatMap(x => [x.paid, x.r.price]))

  return (
    <>
      <h2 className="sub-head">{p.code} · {p.name} · {monthLabel(month)}</h2>
      <div className="stats six">
        <Stat label="Net collected" value={RM(st.collected)} sub={`Target ${RM(targetCollected)}`} />
        <Stat label="Total expenses" value={RM(st.expenses)} tone={p.target_expenses && st.expenses > p.target_expenses ? 'bad' : undefined} sub={`Target ${RM(p.target_expenses)}`} />
        <Stat label="Net profit / (loss)" value={RM(st.profit)} tone={st.profit < 0 ? 'bad' : 'ok'} sub={`Target profit ${RM(targetProfit)}`} />
        <Stat label="Occupancy" value={`${Math.round(occPct)}%`} sub={`${st.occupied} of ${st.rooms} beds occupied`} />
        <Stat label="Maintenance" value={RM(maintTotal)} sub={`${maint.length} item${maint.length === 1 ? '' : 's'} this month`} />
        <Stat label="Collection rate" value={`${Math.round(st.rate)}%`} tone={st.rate < alertAt ? 'bad' : 'ok'} sub={st.rate < alertAt ? `Below ${alertAt}% alert level` : 'At or above alert level'} />
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

        <section className="card">
          <h2>Paid in month vs room price</h2>
          <div className="chart">
            {rooms.map(x => (
              <div key={x.key} className="chart-col" title={`${x.label}: paid ${RM(x.paid)}, price ${RM(x.r.price)}`}>
                <div className="chart-bars">
                  <i className="c" style={{ height: x.paid / max * 100 + '%' }} />
                  <i className="p" style={{ height: x.r.price / max * 100 + '%' }} />
                </div>
                <small className="chart-label">{x.label.replace(/^Bilik /, '').replace(' · bed ', ' #')}</small>
              </div>
            ))}
          </div>
          <div className="legend"><span><i className="c" /> Paid</span><span><i className="p" /> Price</span></div>
        </section>
      </div>

      <div className="grid2">
        <section className="card">
          <h2>Maintenance · {monthLabel(month)}</h2>
          {maint.length === 0 ? <p className="muted">No maintenance recorded.</p> : (
            <ul className="list compact">{maint.map(e => (
              <li key={e.id}><span>{e.label || 'Maintenance'} {e.note && <span className="muted small">· {e.note}</span>}</span><b>{RM(e.amount)}</b></li>
            ))}</ul>
          )}
        </section>
        <section className="card">
          <h2>All expenses · {monthLabel(month)}</h2>
          {byCat.length === 0 ? <p className="muted">No expenses recorded.</p> : (
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
