import { useState } from 'react'
import { CATEGORIES, COMPANY_CATS, PROPERTY_CATS, RM, friendlyError, monthLabel, propColor, propertyStats, thisMonth, useData, type Expense } from '../lib/data'
import { supabase } from '../lib/supabase'
import { Alert, MonthPicker, PropTag, useSaver } from '../ui'

export default function Expenses() {
  const { data, reload } = useData()
  const [month, setMonth] = useState(thisMonth())
  const stats = propertyStats(data, month)
  const s = useSaver()
  const missingRent = data.properties.filter(p => p.owner_rent > 0 && !data.expenses.some(e => e.period === month && e.property_id === p.id && e.category === 'owner_rent'))

  async function addFixed() {
    const ok = await s.run(async () => {
      const { error } = await supabase.from('expenses').insert(missingRent.map(p => ({ property_id: p.id, period: month, category: 'owner_rent', amount: p.owner_rent })))
      if (error) throw new Error(friendlyError(error.message))
    })
    if (ok) reload()
  }
  const company = data.expenses.filter(e => e.period === month && !e.property_id)

  return (
    <>
      <div className="page-head">
        <h1>Expenses</h1>
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      {missingRent.length > 0 && <Alert kind="warn">
        Rent to owner not recorded yet for {missingRent.map(p => p.code).join(', ')} in {monthLabel(month)}.{' '}
        <button className="small primary" disabled={s.busy} onClick={addFixed}>Add owner rent ({RM(missingRent.reduce((a, p) => a + p.owner_rent, 0))})</button>
      </Alert>}
      {s.err && <Alert>{s.err}</Alert>}
      <div className="cards">
        {stats.map(st => {
          const items = data.expenses.filter(e => e.period === month && e.property_id === st.property.id)
          return <section className="card" key={st.property.id}>
            <h2><PropTag code={st.property.code} color={propColor(data, st.property.id)} /> {st.property.name}</h2>
            <ExpenseList items={items} />
            <AddExpense month={month} propertyId={st.property.id} cats={PROPERTY_CATS} />
            <dl className="sum">
              <dt>Collected</dt><dd>{RM(st.collected)}</dd>
              <dt>Expenses</dt><dd>{RM(st.expenses)} {st.property.target_expenses > 0 && <small className={st.expenses > st.property.target_expenses ? 'neg' : 'muted'}>/ target {RM(st.property.target_expenses)}</small>}</dd>
              <dt>Profit</dt><dd className={st.profit < 0 ? 'neg' : 'pos'}>{RM(st.profit)}</dd>
            </dl>
          </section>
        })}
        <section className="card">
          <h2>Company costs</h2>
          <p className="muted small">Ads, salaries, shop items and costs not tied to one house.</p>
          <ExpenseList items={company} />
          <AddExpense month={month} propertyId={null} cats={COMPANY_CATS} />
          <dl className="sum"><dt>Total</dt><dd>{RM(company.reduce((a, e) => a + e.amount, 0))}</dd></dl>
        </section>
      </div>
    </>
  )
}

function ExpenseList({ items }: { items: Expense[] }) {
  const { reload } = useData()
  async function del(id: string) {
    if (!confirm('Delete this expense?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) alert(error.message); else reload()
  }
  if (!items.length) return <p className="muted small">Nothing recorded.</p>
  return <ul className="list compact">{items.map(e => (
    <li key={e.id}><span>{e.label || CATEGORIES[e.category]} {e.note && <span className="muted small">· {e.note}</span>}</span>
      <span className="row"><b>{RM(e.amount)}</b><button className="ghost small" onClick={() => del(e.id)} aria-label="Delete">🗑</button></span></li>
  ))}</ul>
}

function AddExpense({ month, propertyId, cats }: { month: string; propertyId: string | null; cats: string[] }) {
  const { reload } = useData()
  const [cat, setCat] = useState(cats[propertyId ? 1 : 0])
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [label, setLabel] = useState('')
  const s = useSaver()
  async function add() {
    if (!(Number(amount) > 0)) return s.setErr('Enter an amount.')
    if ((cat === 'other' || cat === 'salary') && !label.trim() && !note.trim()) return s.setErr('Say what this is for.')
    const ok = await s.run(async () => {
      const { error } = await supabase.from('expenses').insert({ property_id: propertyId, period: month, category: cat, amount: Number(amount), note: note.trim() || null, label: label.trim() || null })
      if (error) throw new Error(friendlyError(error.message))
    })
    if (ok) { setAmount(''); setNote(''); setLabel(''); reload() }
  }
  return <div className="add-exp">
    <select value={cat} onChange={e => setCat(e.target.value)}>{cats.map(c => <option key={c} value={c}>{CATEGORIES[c]}</option>)}</select>
    {(cat === 'salary' || cat === 'other') && <input placeholder={cat === 'salary' ? 'Name' : 'What'} value={label} onChange={e => setLabel(e.target.value)} />}
    <input type="number" inputMode="decimal" placeholder="RM" value={amount} onChange={e => setAmount(e.target.value)} />
    <input placeholder="Note" value={note} onChange={e => setNote(e.target.value)} />
    <button className="small primary" disabled={s.busy} onClick={add}>Add</button>
    {s.err && <small className="neg">{s.err}</small>}
  </div>
}
