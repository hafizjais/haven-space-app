import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RM, addMonths, coversMonth, monthLabel, paidFor, propertyStats, shortMonth, thisMonth, useData, useLookups } from '../lib/data'
import { Badge, MonthPicker, Stat } from '../ui'

export default function Dashboard() {
  const { data } = useData()
  const L = useLookups()
  const [month, setMonth] = useState(thisMonth())
  const stats = propertyStats(data, month)
  const alertAt = data.settings?.low_collection_alert ?? 80
  const company = data.expenses.filter(e => e.period === month && !e.property_id).reduce((s, e) => s + e.amount, 0)
  const tot = stats.reduce((a, s) => ({
    collected: a.collected + s.collected, target: a.target + (s.property.target_collected || s.expected),
    expenses: a.expenses + s.expenses, rooms: a.rooms + s.rooms, occupied: a.occupied + s.occupied,
  }), { collected: 0, target: 0, expenses: 0, rooms: 0, occupied: 0 })
  const profit = tot.collected - tot.expenses - company

  // who has not fully paid this month
  const now = new Date()
  const isCurrent = month === thisMonth()
  const unpaid = data.tenancies.filter(t => coversMonth(t, month)).map(t => ({ t, paid: paidFor(data, t.id, month) }))
    .filter(x => x.paid < x.t.monthly_rent)
    .map(x => ({ ...x, overdue: !isCurrent || now.getDate() > (x.t.pay_day ?? 1) + (data.settings?.grace_days ?? 7) }))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue))

  const vacant = data.rooms.filter(r => r.active && !L.activeTenancy(r.id))
  const in60 = new Date(); in60.setDate(in60.getDate() + 60)
  const ending = data.tenancies.filter(t => t.status === 'active' && t.end_date && new Date(t.end_date) <= in60)
  const unsigned = data.tenancies.filter(t => t.status === 'active' && !t.signed)

  // 6-month trend
  const trend = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5)).map(p => {
    const st = propertyStats(data, p)
    const c = st.reduce((s, x) => s + x.collected, 0)
    const e = st.reduce((s, x) => s + x.expenses, 0) + data.expenses.filter(x => x.period === p && !x.property_id).reduce((s, x) => s + x.amount, 0)
    return { p, c, e }
  })
  const max = Math.max(1, ...trend.flatMap(t => [t.c, t.e]))

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      <div className="stats">
        <Stat label="Collected" value={RM(tot.collected)} sub={`of ${RM(tot.target)} target · ${tot.target ? Math.round(tot.collected / tot.target * 100) : 0}%`} />
        <Stat label="Expenses" value={RM(tot.expenses + company)} sub={`properties ${RM(tot.expenses)} · company ${RM(company)}`} />
        <Stat label="Profit" value={RM(profit)} tone={profit < 0 ? 'bad' : 'ok'} sub={monthLabel(month)} />
        <Stat label="Occupancy" value={`${tot.occupied}/${tot.rooms}`} sub={`${tot.rooms ? Math.round(tot.occupied / tot.rooms * 100) : 0}% rooms filled · ${vacant.length} vacant`} />
      </div>

      <div className="grid2">
        <section className="card">
          <h2>By property · {monthLabel(month)}</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>Property</th><th className="num">Collected</th><th className="num">Target</th><th className="num">Expenses</th><th className="num">Profit</th><th>Rooms</th><th>Rate</th></tr></thead>
            <tbody>{stats.map(s => (
              <tr key={s.property.id}>
                <td><b>{s.property.code}</b> <span className="muted">{s.property.name}</span></td>
                <td className="num">{RM(s.collected)}</td>
                <td className="num muted">{RM(s.property.target_collected || s.expected)}</td>
                <td className="num">{RM(s.expenses)}</td>
                <td className={`num ${s.profit < 0 ? 'neg' : ''}`}>{RM(s.profit)}</td>
                <td>{s.occupied}/{s.rooms}</td>
                <td><div className="bar"><i style={{ width: Math.min(100, s.rate) + '%' }} className={s.rate < alertAt ? 'low' : ''} /></div>
                  <small className={s.rate < alertAt ? 'neg' : ''}>{Math.round(s.rate)}%{s.rate < alertAt ? ' ⚠' : ''}</small></td>
              </tr>))}
            </tbody>
          </table></div>
        </section>

        <section className="card">
          <h2>Last 6 months</h2>
          <div className="chart">
            {trend.map(t => (
              <div key={t.p} className="chart-col" title={`${monthLabel(t.p)}: collected ${RM(t.c)}, expenses ${RM(t.e)}`}>
                <div className="chart-bars">
                  <i className="c" style={{ height: t.c / max * 100 + '%' }} />
                  <i className="e" style={{ height: t.e / max * 100 + '%' }} />
                </div>
                <small>{shortMonth(t.p)}</small>
              </div>
            ))}
          </div>
          <div className="legend"><span><i className="c" /> Collected</span><span><i className="e" /> Expenses</span></div>
        </section>
      </div>

      <div className="grid2">
        <section className="card">
          <h2>Not fully paid · {monthLabel(month)} <span className="count">{unpaid.length}</span></h2>
          {unpaid.length === 0 ? <p className="muted">Everyone has paid. 🎉</p> : (
            <ul className="list">{unpaid.map(({ t, paid, overdue }) => {
              const tn = L.tenant(t.tenant_id)
              return <li key={t.id}>
                <div><b>{tn?.nickname}</b> <span className="muted">{L.roomLabel(t.room_id)}</span>
                  <div className="small muted">Pay day {t.pay_day ?? '?'} · paid {RM(paid)} of {RM(t.monthly_rent)}</div></div>
                <div className="row">
                  {overdue ? <Badge kind="bad">Overdue</Badge> : <Badge kind="muted">Due</Badge>}
                  {tn?.phone && <a className="btn small" target="_blank" rel="noreferrer" href={waLink(tn.phone, tn.nickname, t.monthly_rent - paid, month)}>WhatsApp</a>}
                </div>
              </li>
            })}</ul>
          )}
          <Link to="/payments" className="btn">Record payments →</Link>
        </section>

        <section className="card">
          <h2>Alerts</h2>
          <ul className="list">
            {stats.filter(s => s.rate < alertAt).map(s => <li key={s.property.id}><span>⚠ <b>{s.property.code}</b> collection at {Math.round(s.rate)}% (below {alertAt}%)</span></li>)}
            {ending.map(t => <li key={t.id}><span>📅 <b>{L.tenant(t.tenant_id)?.nickname}</b> ({L.roomLabel(t.room_id)}) agreement ends {t.end_date}</span></li>)}
            {unsigned.length > 0 && <li><span>✎ {unsigned.length} active agreements not signed yet. <Link to="/agreements">View</Link></span></li>}
            {vacant.length > 0 && <li><span>⌂ Vacant: {vacant.map(r => L.roomLabel(r.id)).join(', ')}</span></li>}
          </ul>
        </section>
      </div>
    </>
  )
}

function waLink(phone: string, name: string, amount: number, month: string) {
  let n = phone.split('&')[0].replace(/\D/g, '')
  if (n.startsWith('0')) n = '6' + n
  const text = `Hi ${name}, peringatan mesra: sewa bilik bagi ${monthLabel(month)} sebanyak ${RM(amount)} masih belum diterima. Terima kasih! - Haven Space`
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`
}
