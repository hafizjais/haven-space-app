import { useState } from 'react'
import { RM, coversMonth, friendlyError, monthLabel, paidFor, shortMonth, thisMonth, today, useData, useLookups, type Tenancy } from '../lib/data'
import { supabase } from '../lib/supabase'
import { Alert, Badge, Field, Modal, MonthPicker, useSaver } from '../ui'

export default function Payments() {
  const { data, reload } = useData()
  const L = useLookups()
  const [month, setMonth] = useState(thisMonth())
  const [view, setView] = useState<'month' | 'year'>('month')
  const [prop, setProp] = useState('')
  const [open, setOpen] = useState<{ t: Tenancy; period: string } | null>(null)
  const quick = useSaver()

  const props = data.properties.filter(p => !prop || p.id === prop)
  const tenanciesFor = (pid: string, test: (t: Tenancy) => boolean) =>
    data.tenancies.filter(t => L.room(t.room_id)?.property_id === pid && test(t))
      .sort((a, b) => (L.room(a.room_id)?.sort ?? 0) - (L.room(b.room_id)?.sort ?? 0))

  async function payFull(t: Tenancy) {
    const rest = t.monthly_rent - paidFor(data, t.id, month)
    if (rest <= 0) return
    const ok = await quick.run(async () => {
      const { error } = await supabase.from('payments').insert({ tenancy_id: t.id, period: month, amount: rest, paid_on: today() })
      if (error) throw new Error(friendlyError(error.message))
    })
    if (ok) reload()
  }

  async function undo(t: Tenancy) {
    const rows = data.payments.filter(x => x.tenancy_id === t.id && x.period === month)
    const last = rows.sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    if (!last) return
    const who = L.tenant(t.tenant_id)?.nickname
    if (!confirm(`Remove ${RM(last.amount)} recorded for ${who}, ${monthLabel(month)}?`)) return
    const ok = await quick.run(async () => {
      const { error } = await supabase.from('payments').delete().eq('id', last.id)
      if (error) throw new Error(friendlyError(error.message))
    })
    if (ok) reload()
  }

  const year = month.slice(0, 4)
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}-01`)

  return (
    <>
      <div className="page-head">
        <h1>Payments</h1>
        <div className="row wrap">
          <div className="seg">
            <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>Month</button>
            <button className={view === 'year' ? 'on' : ''} onClick={() => setView('year')}>Year grid</button>
          </div>
          <select value={prop} onChange={e => setProp(e.target.value)}>
            <option value="">All properties</option>
            {data.properties.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select>
          <MonthPicker value={month} onChange={setMonth} />
        </div>
      </div>
      {quick.err && <Alert>{quick.err}</Alert>}
      <p className="muted small">Payments can only be recorded against a tenant who is renting a room, so empty rooms can't receive payments by mistake. Amounts that differ from the rent need a note.</p>

      {view === 'month' ? props.map(p => {
        const ts = tenanciesFor(p.id, t => coversMonth(t, month))
        const total = ts.reduce((s, t) => s + paidFor(data, t.id, month), 0)
        const exp = ts.reduce((s, t) => s + t.monthly_rent, 0)
        return (
          <section className="card" key={p.id}>
            <h2>{p.code} · {p.name} <span className="muted small">{RM(total)} of {RM(exp)}</span></h2>
            {ts.length === 0 ? <p className="muted">No tenants this month.</p> : (
              <ul className="list pay-list">{ts.map(t => {
                const paid = paidFor(data, t.id, month)
                const tn = L.tenant(t.tenant_id)
                const st = paid >= t.monthly_rent ? 'ok' : paid > 0 ? 'warn' : 'bad'
                return <li key={t.id}>
                  <div className="grow" onClick={() => setOpen({ t, period: month })} role="button">
                    <b>{tn?.nickname}</b> <span className="muted">{L.room(t.room_id)?.name}</span>
                    <div className="small muted">Rent {RM(t.monthly_rent)} · pay day {t.pay_day ?? '?'}</div>
                  </div>
                  <Badge kind={st}>{st === 'ok' ? `Paid ${RM(paid)}` : st === 'warn' ? `Part ${RM(paid)}` : 'Not paid'}</Badge>
                  {paid < t.monthly_rent && <button className="primary small" disabled={quick.busy} onClick={() => payFull(t)}>✓ {RM(t.monthly_rent - paid)}</button>}
                  {paid > 0 && <button className="small" disabled={quick.busy} onClick={() => undo(t)}>↶ Undo</button>}
                  <button className="small" onClick={() => setOpen({ t, period: month })}>{paid > 0 ? 'Edit' : 'Other'}</button>
                </li>
              })}</ul>
            )}
          </section>
        )
      }) : props.map(p => {
        const ts = tenanciesFor(p.id, t => months.some(m => coversMonth(t, m)) || data.payments.some(x => x.tenancy_id === t.id && x.period.startsWith(year)))
        return (
          <section className="card" key={p.id}>
            <h2>{p.code} · {p.name} · {year}</h2>
            <div className="table-wrap"><table className="grid">
              <thead><tr><th>Room / tenant</th><th className="num">Rent</th>{months.map(m => <th key={m} className="num">{shortMonth(m)}</th>)}</tr></thead>
              <tbody>
                {ts.map(t => (
                  <tr key={t.id} className={t.status === 'ended' ? 'ended' : ''}>
                    <td><b>{L.tenant(t.tenant_id)?.nickname}</b><div className="small muted">{L.room(t.room_id)?.name}{t.status === 'ended' ? ' · moved out' : ''}</div></td>
                    <td className="num muted">{t.monthly_rent}</td>
                    {months.map(m => {
                      const paid = paidFor(data, t.id, m); const cov = coversMonth(t, m)
                      const cls = paid >= t.monthly_rent ? 'ok' : paid > 0 ? 'warn' : cov && m <= thisMonth() ? 'bad' : ''
                      return <td key={m} className={`num cell ${cls}`} onClick={() => cov && setOpen({ t, period: m })}>{paid || (cov ? '·' : '')}</td>
                    })}
                  </tr>
                ))}
                <tr className="total"><td>Total</td><td />{months.map(m => <td key={m} className="num">{ts.reduce((s, t) => s + paidFor(data, t.id, m), 0) || ''}</td>)}</tr>
              </tbody>
            </table></div>
          </section>
        )
      })}

      {open && <PaymentModal t={open.t} period={open.period} onClose={() => setOpen(null)} />}
    </>
  )
}

function PaymentModal({ t, period: initial, onClose }: { t: Tenancy; period: string; onClose: () => void }) {
  const { data, reload } = useData()
  const L = useLookups()
  const [period, setPeriod] = useState(initial)
  const paid = paidFor(data, t.id, period)
  const [amount, setAmount] = useState(String(Math.max(0, t.monthly_rent - paid) || t.monthly_rent))
  const [paidOn, setPaidOn] = useState(today())
  const [method, setMethod] = useState('Bank transfer')
  const [note, setNote] = useState('')
  const s = useSaver()
  const amt = Number(amount)
  const mismatch = amt > 0 && paid + amt !== t.monthly_rent
  const history = data.payments.filter(x => x.tenancy_id === t.id).sort((a, b) => b.period.localeCompare(a.period) || b.created_at.localeCompare(a.created_at))

  async function save() {
    if (!(amt > 0)) return s.setErr('Enter an amount above 0.')
    if (mismatch && !note.trim()) return s.setErr(`Total for ${monthLabel(period)} would be ${RM(paid + amt)} but rent is ${RM(t.monthly_rent)}. Add a note explaining why.`)
    if (data.payments.some(x => x.tenancy_id === t.id && x.period === period) && paid + amt > t.monthly_rent &&
      !confirm(`${monthLabel(period)} already has ${RM(paid)} recorded. Add ${RM(amt)} more?`)) return
    const ok = await s.run(async () => {
      const { error } = await supabase.from('payments').insert({ tenancy_id: t.id, period, amount: amt, paid_on: paidOn || null, method, note: note.trim() || null })
      if (error) throw new Error(friendlyError(error.message))
    })
    if (ok) { await reload(); onClose() }
  }
  const [editing, setEditing] = useState<{ id: string; amount: string; note: string; paid_on: string } | null>(null)
  async function saveEdit() {
    if (!editing) return
    const a = Number(editing.amount); if (!(a > 0)) return s.setErr('Enter an amount above 0.')
    const ok = await s.run(async () => {
      const { error } = await supabase.from('payments').update({ amount: a, note: editing.note.trim() || null, paid_on: editing.paid_on || null }).eq('id', editing.id)
      if (error) throw new Error(friendlyError(error.message))
    })
    if (ok) { setEditing(null); reload() }
  }
  async function del(id: string) {
    if (!confirm('Delete this payment?')) return
    const ok = await s.run(async () => { const { error } = await supabase.from('payments').delete().eq('id', id); if (error) throw error })
    if (ok) reload()
  }

  return (
    <Modal title={`${L.tenant(t.tenant_id)?.nickname} · ${L.roomLabel(t.room_id)}`} onClose={onClose}>
      <p className="muted small">Rent {RM(t.monthly_rent)} · already paid for {monthLabel(period)}: <b>{RM(paid)}</b></p>
      <div className="form-grid">
        <Field label="For month"><MonthPicker value={period} onChange={setPeriod} /></Field>
        <Field label="Amount (RM)"><input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
        <Field label="Date received"><input type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} /></Field>
        <Field label="Method"><select value={method} onChange={e => setMethod(e.target.value)}>{['Bank transfer', 'DuitNow', 'Cash', 'Other'].map(m => <option key={m}>{m}</option>)}</select></Field>
      </div>
      <Field label={mismatch ? 'Note (required: amount differs from rent)' : 'Note'}><input value={note} onChange={e => setNote(e.target.value)} placeholder={mismatch ? 'e.g. partial payment, discount, rent changed' : ''} /></Field>
      {mismatch && <Alert kind="warn">Total for this month would be {RM(paid + amt)}, rent is {RM(t.monthly_rent)}.</Alert>}
      {s.err && <Alert>{s.err}</Alert>}
      <div className="row end"><button onClick={onClose}>Cancel</button><button className="primary" disabled={s.busy} onClick={save}>Save payment</button></div>

      <h3>History <span className="muted small">(tap Edit or Delete to fix a mistake)</span></h3>
      <ul className="list compact">{history.map(x => (
        editing?.id === x.id ? <li key={x.id} className="edit-row">
          <b>{monthLabel(x.period)}</b>
          <input type="number" inputMode="decimal" value={editing.amount} onChange={e => setEditing({ ...editing, amount: e.target.value })} aria-label="Amount" />
          <input type="date" value={editing.paid_on} onChange={e => setEditing({ ...editing, paid_on: e.target.value })} aria-label="Date received" />
          <input placeholder="Note" value={editing.note} onChange={e => setEditing({ ...editing, note: e.target.value })} aria-label="Note" />
          <span className="row"><button className="small" onClick={() => setEditing(null)}>Cancel</button><button className="small primary" disabled={s.busy} onClick={saveEdit}>Save</button></span>
        </li> :
        <li key={x.id}><span><b>{monthLabel(x.period)}</b> · {RM(x.amount)} <span className="muted small">{x.paid_on ?? ''} {x.method ?? ''} {x.note ? '· ' + x.note : ''}</span></span>
          <span className="row nowrap">
            <button className="ghost small" onClick={() => setEditing({ id: x.id, amount: String(x.amount), note: x.note ?? '', paid_on: x.paid_on ?? '' })} aria-label="Edit">✎ Edit</button>
            <button className="ghost small" onClick={() => del(x.id)} aria-label="Delete">🗑 Delete</button>
          </span></li>
      ))}{history.length === 0 && <li className="muted">No payments yet.</li>}</ul>
    </Modal>
  )
}
