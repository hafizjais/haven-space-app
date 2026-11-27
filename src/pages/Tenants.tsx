import { useMemo, useState } from 'react'
import { RM, fmtDate, friendlyError, icDigits, phoneDigits, useData, useLookups, type Tenant } from '../lib/data'
import { supabase } from '../lib/supabase'
import { Alert, Badge, Field, Modal, useSaver } from '../ui'

export default function Tenants() {
  const { data } = useData()
  const L = useLookups()
  const [q, setQ] = useState('')
  const [show, setShow] = useState<'current' | 'all'>('current')
  const [edit, setEdit] = useState<Partial<Tenant> | null>(null)

  const active = (id: string) => data.tenancies.find(t => t.tenant_id === id && t.status === 'active')
  const list = data.tenants
    .filter(t => show === 'all' || active(t.id))
    .filter(t => !q || [t.nickname, t.full_name, t.phone, t.ic_no].some(v => v?.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.nickname.localeCompare(b.nickname))

  const dups = useMemo(() => {
    const out: string[] = []
    const by = (key: (t: Tenant) => string, what: string) => {
      const m = new Map<string, Tenant[]>()
      data.tenants.forEach(t => { const k = key(t); if (k.length >= 8) m.set(k, [...(m.get(k) || []), t]) })
      m.forEach(ts => ts.length > 1 && out.push(`Same ${what}: ${ts.map(t => t.nickname).join(', ')}`))
    }
    by(t => icDigits(t.ic_no), 'IC'); by(t => phoneDigits(t.phone).split('&')[0], 'phone')
    return out
  }, [data.tenants])

  return (
    <>
      <div className="page-head">
        <h1>Tenants</h1>
        <div className="row wrap">
          <input type="search" placeholder="Search name, phone, IC" value={q} onChange={e => setQ(e.target.value)} />
          <div className="seg"><button className={show === 'current' ? 'on' : ''} onClick={() => setShow('current')}>Current</button><button className={show === 'all' ? 'on' : ''} onClick={() => setShow('all')}>All</button></div>
          <button onClick={() => setEdit({ nickname: '' })}>+ Tenant</button>
        </div>
      </div>
      {dups.length > 0 && <Alert kind="warn">Possible duplicate tenants: {dups.join(' · ')}</Alert>}
      <section className="card">
        <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Phone</th><th>IC</th><th>Room</th><th className="num">Rent</th><th /></tr></thead>
          <tbody>{list.map(t => {
            const a = active(t.id)
            return <tr key={t.id} onClick={() => setEdit(t)} className="click">
              <td><b>{t.nickname}</b><div className="small muted">{t.full_name || <i>full name missing</i>}</div></td>
              <td>{t.phone}</td>
              <td>{t.ic_no || <Badge kind="warn">missing</Badge>}</td>
              <td>{a ? L.roomLabel(a.room_id) : <span className="muted">not renting</span>}</td>
              <td className="num">{a ? RM(a.monthly_rent) : ''}</td>
              <td><button className="small">Open</button></td>
            </tr>
          })}</tbody>
        </table></div>
        {list.length === 0 && <p className="muted">No tenants match.</p>}
      </section>
      {edit && <TenantModal t={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function TenantModal({ t: init, onClose }: { t: Partial<Tenant>; onClose: () => void }) {
  const { data, reload } = useData()
  const L = useLookups()
  const [t, setT] = useState(init)
  const s = useSaver()
  const tenancies = data.tenancies.filter(x => x.tenant_id === t.id)
  const dupIc = icDigits(t.ic_no ?? '').length >= 6 ? data.tenants.find(x => x.id !== t.id && icDigits(x.ic_no) === icDigits(t.ic_no ?? '')) : undefined
  const dupPhone = phoneDigits(t.phone ?? '').length >= 8 ? data.tenants.find(x => x.id !== t.id && phoneDigits(x.phone) === phoneDigits(t.phone ?? '')) : undefined

  async function save() {
    if (!t.nickname?.trim()) return s.setErr('Short name is required.')
    const ok = await s.run(async () => {
      const row = { nickname: t.nickname!.trim(), full_name: t.full_name?.trim().toUpperCase() || null, ic_no: t.ic_no?.trim() || null, phone: t.phone?.trim() || null, notes: t.notes || null }
      const { error } = t.id ? await supabase.from('tenants').update(row).eq('id', t.id) : await supabase.from('tenants').insert(row)
      if (error) throw new Error(friendlyError(error.message))
    })
    if (ok) { await reload(); onClose() }
  }
  const dup = dupIc ?? dupPhone
  const history = (id: string) => data.tenancies.filter(x => x.tenant_id === id)
    .map(x => `${L.roomLabel(x.room_id)}${x.status === 'ended' ? ' (moved out)' : ''}`).join(', ') || 'no rentals'
  const bothActive = !!dup && tenancies.some(x => x.status === 'active') && data.tenancies.some(x => x.tenant_id === dup.id && x.status === 'active')
  async function mergeAndSave() {
    if (!dup || !t.id) return
    if (!confirm(`Merge ${dup.nickname} into this tenant? Their rentals, payments and agreements move here and the duplicate record is removed.`)) return
    const ok = await s.run(async () => {
      const { error } = await supabase.rpc('merge_tenants', { keep_id: t.id, drop_id: dup.id })
      if (error) throw new Error(friendlyError(error.message))
      // notes were combined by the merge; only overwrite them if edited in this form
      const row = { nickname: t.nickname!.trim(), full_name: t.full_name?.trim().toUpperCase() || null, ic_no: t.ic_no?.trim() || null, phone: t.phone?.trim() || null,
        ...(t.notes !== init.notes ? { notes: t.notes || null } : {}) }
      const { error: e2 } = await supabase.from('tenants').update(row).eq('id', t.id)
      if (e2) throw new Error(friendlyError(e2.message))
    })
    if (ok) { await reload(); onClose() }
  }
  async function del() {
    if (!confirm('Delete this tenant?')) return
    const ok = await s.run(async () => { const { error } = await supabase.from('tenants').delete().eq('id', t.id!); if (error) throw new Error(friendlyError(error.message)) })
    if (ok) { await reload(); onClose() }
  }

  return (
    <Modal title={t.id ? t.nickname || 'Tenant' : 'New tenant'} onClose={onClose}>
      <div className="form-grid">
        <Field label="Short name"><input value={t.nickname ?? ''} onChange={e => setT({ ...t, nickname: e.target.value })} /></Field>
        <Field label="Phone"><input inputMode="tel" value={t.phone ?? ''} onChange={e => setT({ ...t, phone: e.target.value })} /></Field>
      </div>
      <Field label="Full name (as in IC)"><input value={t.full_name ?? ''} onChange={e => setT({ ...t, full_name: e.target.value })} /></Field>
      <Field label="IC number"><input value={t.ic_no ?? ''} onChange={e => setT({ ...t, ic_no: e.target.value })} /></Field>
      <Field label="Notes"><textarea rows={2} value={t.notes ?? ''} onChange={e => setT({ ...t, notes: e.target.value })} /></Field>
      {dup && <Alert kind="warn">
        <div>Another tenant record has this {dupIc ? 'IC' : 'phone'}: <b>{dup.nickname}</b>{dup.full_name ? ` (${dup.full_name})` : ''}{dup.phone ? ` · ${dup.phone}` : ''} · {history(dup.id)}</div>
        {!t.id ? <div>Use that tenant instead of adding a new one.</div>
          : bothActive ? <div>Both records rent a room right now, so they can't be merged. Check the {dupIc ? 'IC number' : 'phone number'} is right.</div>
          : <div className="row wrap" style={{ marginTop: '.4rem' }}><span>Same person? Merge them to keep one record with all rentals, payments and agreements.</span>
              <button className="small primary" disabled={s.busy} onClick={mergeAndSave}>Merge with {dup.nickname} and save</button></div>}
      </Alert>}
      {s.err && <Alert>{s.err}</Alert>}
      <div className="row between">
        {t.id && tenancies.length === 0 ? <button className="danger" onClick={del}>Delete</button> : <span />}
        <div className="row"><button onClick={onClose}>Cancel</button><button className="primary" disabled={s.busy} onClick={save}>Save</button></div>
      </div>
      {tenancies.length > 0 && <>
        <h3>Rental history</h3>
        <ul className="list compact">{tenancies.map(x => {
          const total = data.payments.filter(p => p.tenancy_id === x.id).reduce((a, p) => a + p.amount, 0)
          return <li key={x.id}><span><b>{L.roomLabel(x.room_id)}</b> · {RM(x.monthly_rent)}/mo · {fmtDate(x.moved_in_on || x.start_date)} → {x.status === 'active' ? 'now' : fmtDate(x.moved_out_on)}
            <div className="small muted">Total paid {RM(total)}{x.remarks ? ' · ' + x.remarks : ''}</div></span>
            <Badge kind={x.status === 'active' ? 'ok' : 'muted'}>{x.status}</Badge></li>
        })}</ul>
      </>}
    </Modal>
  )
}
