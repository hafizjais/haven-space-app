import { useState } from 'react'
import { RM, fmtDate, friendlyError, useData, useLookups, type Tenancy } from '../lib/data'
import { agreementPdf } from '../lib/pdf'
import { supabase } from '../lib/supabase'
import { Alert, Badge, Field, Modal, useSaver } from '../ui'

export default function Agreements() {
  const { data } = useData()
  const L = useLookups()
  const [edit, setEdit] = useState<Tenancy | null>(null)
  const [show, setShow] = useState<'active' | 'all'>('active')
  const [err, setErr] = useState<string | null>(null)
  const list = data.tenancies.filter(t => show === 'all' || t.status === 'active')
    .sort((a, b) => L.roomLabel(a.room_id).localeCompare(L.roomLabel(b.room_id)))

  async function pdf(t: Tenancy) {
    setErr(null)
    const tn = L.tenant(t.tenant_id), room = L.room(t.room_id), prop = room && L.prop(room.property_id)
    const missing = [!tn?.full_name && 'full name', !tn?.ic_no && 'IC number', !t.start_date && 'start date', !t.end_date && 'end date', !prop?.address && 'property address'].filter(Boolean)
    if (missing.length && !confirm(`Missing: ${missing.join(', ')}. These will be blank lines in the PDF. Continue?`)) return
    try { await agreementPdf(t, tn!, room!, prop!, data.settings!) } catch (e) { setErr((e as Error).message) }
  }

  return (
    <>
      <div className="page-head">
        <h1>Agreements</h1>
        <div className="seg"><button className={show === 'active' ? 'on' : ''} onClick={() => setShow('active')}>Current</button><button className={show === 'all' ? 'on' : ''} onClick={() => setShow('all')}>All</button></div>
      </div>
      <p className="muted small">Each tenancy is one agreement. Download a ready-to-sign PDF in Malay, filled with the tenant, room, rent and dates. Landlord, bank and witness details come from Settings.</p>
      {err && <Alert>{err}</Alert>}
      <section className="card">
        <div className="table-wrap"><table>
          <thead><tr><th>Tenant</th><th>Room</th><th className="num">Rent</th><th>Period</th><th>Signed</th><th /></tr></thead>
          <tbody>{list.map(t => {
            const tn = L.tenant(t.tenant_id)
            return <tr key={t.id}>
              <td><b>{tn?.nickname}</b><div className="small muted">{tn?.full_name || <i>full name missing</i>}</div>{t.remarks && <div className="small warn-text">{t.remarks}</div>}</td>
              <td>{L.roomLabel(t.room_id)}</td>
              <td className="num">{RM(t.monthly_rent)}</td>
              <td className="small">{fmtDate(t.start_date)} → {fmtDate(t.end_date)}</td>
              <td>{t.signed ? <Badge kind="ok">Signed</Badge> : <Badge kind="warn">Not yet</Badge>}{t.status === 'ended' && <Badge kind="muted">ended</Badge>}</td>
              <td className="row nowrap">
                <button className="small primary" onClick={() => pdf(t)}>PDF</button>
                {t.doc_link && <a className="btn small" href={t.doc_link} target="_blank" rel="noreferrer">Old doc</a>}
                <button className="small" onClick={() => setEdit(t)}>Edit</button>
              </td>
            </tr>
          })}</tbody>
        </table></div>
      </section>
      {edit && <TenancyModal t={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function TenancyModal({ t: init, onClose }: { t: Tenancy; onClose: () => void }) {
  const { reload } = useData()
  const L = useLookups()
  const [t, setT] = useState(init)
  const s = useSaver()
  const set = (k: keyof Tenancy) => (e: { target: { value: string } }) => setT({ ...t, [k]: e.target.value })
  async function save() {
    const ok = await s.run(async () => {
      const { error } = await supabase.from('tenancies').update({
        monthly_rent: Number(t.monthly_rent), deposit: t.deposit === null || (t.deposit as unknown) === '' ? null : Number(t.deposit),
        pay_day: Number(t.pay_day) || null, agreement_date: t.agreement_date || null, start_date: t.start_date || null, end_date: t.end_date || null,
        moved_in_on: t.moved_in_on || null, signed: t.signed, doc_link: t.doc_link || null, remarks: t.remarks || null,
      }).eq('id', t.id)
      if (error) throw new Error(friendlyError(error.message))
    })
    if (ok) { await reload(); onClose() }
  }
  return (
    <Modal title={`${L.tenant(t.tenant_id)?.nickname} · ${L.roomLabel(t.room_id)}`} onClose={onClose}>
      <div className="form-grid">
        <Field label="Monthly rent (RM)"><input type="number" value={t.monthly_rent} onChange={set('monthly_rent')} /></Field>
        <Field label="Deposit (RM)"><input type="number" value={t.deposit ?? ''} onChange={set('deposit')} /></Field>
        <Field label="Pay day"><input type="number" min="1" max="31" value={t.pay_day ?? ''} onChange={set('pay_day')} /></Field>
        <Field label="Agreement date"><input type="date" value={t.agreement_date ?? ''} onChange={set('agreement_date')} /></Field>
        <Field label="Start date"><input type="date" value={t.start_date ?? ''} onChange={set('start_date')} /></Field>
        <Field label="End date"><input type="date" value={t.end_date ?? ''} onChange={set('end_date')} /></Field>
        <Field label="Moved in on"><input type="date" value={t.moved_in_on ?? ''} onChange={set('moved_in_on')} /></Field>
      </div>
      <label className="check"><input type="checkbox" checked={t.signed} onChange={e => setT({ ...t, signed: e.target.checked })} /> Agreement signed</label>
      <Field label="Link to signed copy (optional)"><input value={t.doc_link ?? ''} onChange={set('doc_link')} /></Field>
      <Field label="Remarks"><textarea rows={2} value={t.remarks ?? ''} onChange={set('remarks')} /></Field>
      <p className="muted small">Full name and IC are edited on the Tenants page.</p>
      {s.err && <Alert>{s.err}</Alert>}
      <div className="row end"><button onClick={onClose}>Cancel</button><button className="primary" disabled={s.busy} onClick={save}>Save</button></div>
    </Modal>
  )
}
