import { useEffect, useState } from 'react'
import { RM, fmtDate, friendlyError, icDigits, today, useData, useLookups, type Tenancy } from '../lib/data'
import { downloadAgreementPdf, downloadAgreementWord, openAgreementPdf } from '../lib/agreement'
import { FIELDS } from '../lib/pdf'
import { supabase } from '../lib/supabase'
import { BUCKET, fileUrl, loadTemplate } from '../lib/template'
import { Alert, Badge, Field, Modal, useSaver } from '../ui'

const ext = (f: File) => (f.name.split('.').pop() || 'bin').toLowerCase()
const plusYear = (d: string) => { if (!d) return ''; const x = new Date(d + 'T00:00:00'); x.setFullYear(x.getFullYear() + 1); return x.toISOString().slice(0, 10) }

export default function Agreements() {
  const { data } = useData()
  const L = useLookups()
  const [edit, setEdit] = useState<Tenancy | null>(null)
  const [create, setCreate] = useState(false)
  const [ready, setReady] = useState<string | null>(null)
  const [upload, setUpload] = useState<Tenancy | null>(null)
  const [show, setShow] = useState<'active' | 'all'>('active')
  const [err, setErr] = useState<string | null>(null)
  const [hasTpl, setHasTpl] = useState<boolean | null>(null)
  useEffect(() => { loadTemplate().then(t => setHasTpl(!!t)).catch(() => setHasTpl(false)) }, [])

  const list = data.tenancies.filter(t => show === 'all' || t.status === 'active')
    .sort((a, b) => L.roomLabel(a.room_id).localeCompare(L.roomLabel(b.room_id)))
  const run = (fn: () => Promise<unknown>) => { setErr(null); fn().catch(e => setErr((e as Error).message)) }
  const readyT = ready ? data.tenancies.find(t => t.id === ready) : null

  return (
    <>
      <div className="page-head">
        <h1>Agreements</h1>
        <div className="row wrap">
          <div className="seg"><button className={show === 'active' ? 'on' : ''} onClick={() => setShow('active')}>Current</button><button className={show === 'all' ? 'on' : ''} onClick={() => setShow('all')}>All</button></div>
          <button className="primary" onClick={() => setCreate(true)}>+ Create Agreement</button>
        </div>
      </div>
      {hasTpl === false && <Alert kind="warn">Your Word template isn't uploaded yet. PDFs work without it, but signatures and "Download Word" need it. Upload it in Settings.</Alert>}
      {err && <Alert>{err}</Alert>}
      <section className="card">
        <div className="table-wrap"><table>
          <thead><tr><th>Tenant</th><th>Room</th><th className="num">Rent</th><th>Period</th><th>Status</th><th /></tr></thead>
          <tbody>{list.map(t => {
            const tn = L.tenant(t.tenant_id)
            return <tr key={t.id}>
              <td><b>{tn?.nickname}</b><div className="small muted">{tn?.full_name || <i>full name missing</i>}</div>{t.remarks && <div className="small warn-text">{t.remarks}</div>}</td>
              <td>{L.roomLabel(t.room_id)}</td>
              <td className="num">{RM(t.monthly_rent)}</td>
              <td className="small">{fmtDate(t.start_date)} → {fmtDate(t.end_date)}</td>
              <td>{t.signed_file_path ? <Badge kind="ok">Signed copy</Badge> : t.signed ? <Badge kind="ok">Signed</Badge> : <Badge kind="warn">Not signed</Badge>}{t.status === 'ended' && <Badge kind="muted">ended</Badge>}</td>
              <td><div className="row wrap">
                <button className="small" onClick={() => run(() => openAgreementPdf(data, t))}>View PDF</button>
                {t.signed_file_path
                  ? <button className="small primary" onClick={() => { const w = window.open('', '_blank'); run(async () => { const u = await fileUrl(t.signed_file_path!); if (w) w.location.href = u; else window.location.href = u }) }}>Signed copy</button>
                  : <button className="small primary" onClick={() => setUpload(t)}>Upload signed</button>}
                <button className="small" onClick={() => setEdit(t)}>Edit</button>
              </div></td>
            </tr>
          })}</tbody>
        </table></div>
      </section>
      {create && <CreateAgreement onClose={() => setCreate(false)} onDone={id => { setCreate(false); setReady(id) }} />}
      {readyT && <Modal title="Agreement ready" onClose={() => setReady(null)}>
        <p><b>{L.tenant(readyT.tenant_id)?.full_name}</b> · {L.roomLabel(readyT.room_id)}</p>
        <p className="muted small">Send the PDF to the tenant to sign. When they send it back, tap "Upload signed" on this agreement.</p>
        {err && <Alert>{err}</Alert>}
        <div className="row wrap">
          <button className="primary" onClick={() => run(() => openAgreementPdf(data, readyT))}>View PDF</button>
          <button onClick={() => run(() => downloadAgreementPdf(data, readyT))}>Download PDF</button>
          {hasTpl && <button onClick={() => run(() => downloadAgreementWord(data, readyT))}>Download Word</button>}
        </div>
      </Modal>}
      {upload && <UploadSigned t={upload} onClose={() => setUpload(null)} />}
      {edit && <TenancyModal t={edit} hasTpl={!!hasTpl} onClose={() => setEdit(null)} />}
    </>
  )
}

async function uploadFile(path: string, f: File) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, await f.arrayBuffer(), { upsert: true, contentType: f.type || (path.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg') })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return path
}

function CreateAgreement({ onClose, onDone }: { onClose: () => void; onDone: (tenancyId: string) => void }) {
  const { data, reload } = useData()
  const L = useLookups()
  const [mode, setMode] = useState<'new' | 'current'>('new')
  const vacant = data.rooms.filter(r => r.active && !L.activeTenancy(r.id))
  const current = data.tenancies.filter(t => t.status === 'active')
  const [roomId, setRoomId] = useState('')
  const [tenancyId, setTenancyId] = useState('')
  const [extra, setExtra] = useState<string[]>([])
  useEffect(() => { loadTemplate().then(t => setExtra((t?.placeholders ?? []).filter(p => !FIELDS.some(f => f.key === p)))).catch(() => {}) }, [])
  const start = today()
  const [v, setV] = useState({ nickname: '', phone: '', full_name: '', ic_no: '', address: '', agreement_date: start, start_date: start, end_date: plusYear(start), rent: '', pay_day: String(new Date().getDate()), extra: {} as Record<string, string> })
  const [icFront, setIcFront] = useState<File | null>(null)
  const [icBack, setIcBack] = useState<File | null>(null)
  const s = useSaver()
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })

  function pickRoom(id: string) {
    setRoomId(id)
    const r = L.room(id); if (!r) return
    setV(x => ({ ...x, rent: String(r.price), address: L.prop(r.property_id)?.address ?? '' }))
  }
  function pickTenancy(id: string) {
    setTenancyId(id)
    const t = L.tenancy(id); if (!t) return
    const tn = L.tenant(t.tenant_id); const r = L.room(t.room_id)
    setV(x => ({ ...x, nickname: tn?.nickname ?? '', phone: tn?.phone ?? '', full_name: tn?.full_name ?? '', ic_no: tn?.ic_no ?? '',
      address: t.premises_address || L.prop(r?.property_id ?? null)?.address || '', rent: String(t.monthly_rent), pay_day: String(t.pay_day ?? ''),
      start_date: t.start_date ?? start, end_date: t.end_date ?? plusYear(t.start_date ?? start), agreement_date: start, extra: t.extra_fields ?? {} }))
  }

  const dup = mode === 'new' && icDigits(v.ic_no).length >= 6 ? data.tenants.find(x => icDigits(x.ic_no) === icDigits(v.ic_no)) : undefined

  async function save() {
    const need: [string, string][] = [['Room', mode === 'new' ? roomId : tenancyId], ['Nama Penuh Penyewa', v.full_name], ['IC Penyewa', v.ic_no], ['Alamat', v.address],
      ['Tarikh Perjanjian', v.agreement_date], ['Tarikh Mula Sewa', v.start_date], ['Tarikh Tamat Sewa', v.end_date], ['Sewa Bulanan', v.rent], ['Tarikh Bayaran Sewa', v.pay_day]]
    const missing = need.filter(([, x]) => !String(x).trim()).map(([k]) => k)
    if (missing.length) return s.setErr('Please fill in: ' + missing.join(', '))
    if (dup) return s.setErr(`${dup.nickname} already has this IC. Use "Current tenant" if they're renewing.`)
    const day = Number(v.pay_day); if (!(day >= 1 && day <= 31)) return s.setErr('Tarikh Bayaran Sewa must be a day from 1 to 31.')
    let id = tenancyId
    const ok = await s.run(async () => {
      const fields = { monthly_rent: Number(v.rent), deposit: Number(v.rent), pay_day: day, agreement_date: v.agreement_date, start_date: v.start_date, end_date: v.end_date,
        premises_address: v.address.trim(), extra_fields: v.extra, signed: false }
      if (mode === 'new') {
        const { data: tn, error } = await supabase.from('tenants').insert({ full_name: v.full_name.trim().toUpperCase(), nickname: v.nickname.trim() || v.full_name.trim().split(' ')[0], ic_no: v.ic_no.trim(), phone: v.phone.trim() || null }).select('id').single()
        if (error) throw new Error(friendlyError(error.message))
        const { data: ty, error: e2 } = await supabase.from('tenancies').insert({ ...fields, room_id: roomId, tenant_id: tn.id, status: 'active', moved_in_on: v.start_date }).select('id').single()
        if (e2) { await supabase.from('tenants').delete().eq('id', tn.id); throw new Error(friendlyError(e2.message)) }
        id = ty.id
      } else {
        const t = L.tenancy(tenancyId)!
        const { error } = await supabase.from('tenants').update({ full_name: v.full_name.trim().toUpperCase(), ic_no: v.ic_no.trim(), ...(v.phone.trim() ? { phone: v.phone.trim() } : {}) }).eq('id', t.tenant_id)
        if (error) throw new Error(friendlyError(error.message))
        const { error: e2 } = await supabase.from('tenancies').update({ ...fields, signed_file_path: null, signed_uploaded_at: null }).eq('id', id)
        if (e2) throw new Error(friendlyError(e2.message))
      }
      const files: Record<string, string> = {}
      if (icFront) files.ic_front_path = await uploadFile(`ic/${id}-front.${ext(icFront)}`, icFront)
      if (icBack) files.ic_back_path = await uploadFile(`ic/${id}-back.${ext(icBack)}`, icBack)
      if (Object.keys(files).length) { const { error } = await supabase.from('tenancies').update(files).eq('id', id); if (error) throw error }
    })
    if (ok) { await reload(); onDone(id) }
  }

  return (
    <Modal title="Create Agreement" onClose={onClose}>
      <div className="seg"><button className={mode === 'new' ? 'on' : ''} onClick={() => setMode('new')}>New tenant</button><button className={mode === 'current' ? 'on' : ''} onClick={() => setMode('current')}>Current tenant (renewal)</button></div>
      {mode === 'new' ? (
        <Field label="Room (vacant only)">
          <select value={roomId} onChange={e => pickRoom(e.target.value)}>
            <option value="">Choose a room…</option>
            {vacant.map(r => <option key={r.id} value={r.id}>{L.roomLabel(r.id)} · {RM(r.price)}</option>)}
          </select>
        </Field>
      ) : (
        <Field label="Tenant">
          <select value={tenancyId} onChange={e => pickTenancy(e.target.value)}>
            <option value="">Choose a tenant…</option>
            {current.map(t => <option key={t.id} value={t.id}>{L.tenant(t.tenant_id)?.nickname} · {L.roomLabel(t.room_id)}</option>)}
          </select>
        </Field>
      )}
      {mode === 'new' && <div className="form-grid">
        <Field label="Short name"><input value={v.nickname} onChange={set('nickname')} placeholder="e.g. Faheem" /></Field>
        <Field label="Phone"><input inputMode="tel" value={v.phone} onChange={set('phone')} /></Field>
      </div>}
      <Field label="Nama Penuh Penyewa"><input value={v.full_name} onChange={set('full_name')} style={{ textTransform: 'uppercase' }} /></Field>
      <Field label="IC Penyewa"><input value={v.ic_no} onChange={set('ic_no')} placeholder="000000-00-0000" /></Field>
      {dup && <Alert kind="warn">{dup.nickname} already has this IC number.</Alert>}
      <Field label="Alamat"><textarea rows={2} value={v.address} onChange={set('address')} /></Field>
      <div className="form-grid">
        <Field label="Tarikh Perjanjian"><input type="date" value={v.agreement_date} onChange={set('agreement_date')} /></Field>
        <Field label="Tarikh Mula Sewa"><input type="date" value={v.start_date} onChange={e => setV({ ...v, start_date: e.target.value, end_date: plusYear(e.target.value), pay_day: String(new Date(e.target.value + 'T00:00:00').getDate() || v.pay_day) })} /></Field>
        <Field label="Tarikh Tamat Sewa"><input type="date" value={v.end_date} onChange={set('end_date')} /></Field>
        <Field label="Sewa Bulanan (RM)"><input type="number" inputMode="decimal" value={v.rent} onChange={set('rent')} /></Field>
        <Field label="Tarikh Bayaran Sewa (hari bulan)"><input type="number" min="1" max="31" value={v.pay_day} onChange={set('pay_day')} /></Field>
      </div>
      {extra.map(k => <Field key={k} label={k}><input value={v.extra[k] ?? ''} onChange={e => setV({ ...v, extra: { ...v.extra, [k]: e.target.value } })} /></Field>)}
      <div className="form-grid">
        <Field label="IC photo (front)"><input type="file" accept="image/jpeg,image/png" onChange={e => setIcFront(e.target.files?.[0] ?? null)} /></Field>
        <Field label="IC photo (back)"><input type="file" accept="image/jpeg,image/png" onChange={e => setIcBack(e.target.files?.[0] ?? null)} /></Field>
      </div>
      <p className="muted small">IC photos are optional and stored privately. Saving {mode === 'new' ? 'checks the tenant into the room and ' : ''}creates the agreement.</p>
      {s.err && <Alert>{s.err}</Alert>}
      <div className="row end"><button onClick={onClose}>Cancel</button><button className="primary" disabled={s.busy} onClick={save}>{s.busy ? 'Saving…' : 'Create Agreement'}</button></div>
    </Modal>
  )
}

function UploadSigned({ t, onClose }: { t: Tenancy; onClose: () => void }) {
  const { reload } = useData()
  const L = useLookups()
  const [file, setFile] = useState<File | null>(null)
  const s = useSaver()
  async function save() {
    if (!file) return s.setErr('Choose the signed PDF.')
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return s.setErr('Please upload a PDF file.')
    const ok = await s.run(async () => {
      const path = await uploadFile(`signed/${t.id}-${Date.now()}.pdf`, file)
      const { error } = await supabase.from('tenancies').update({ signed_file_path: path, signed_uploaded_at: new Date().toISOString(), signed: true }).eq('id', t.id)
      if (error) throw error
    })
    if (ok) { await reload(); onClose() }
  }
  return (
    <Modal title={`Upload signed agreement · ${L.tenant(t.tenant_id)?.nickname}`} onClose={onClose}>
      <p className="muted small">Attach the PDF the tenant signed and sent back. It's stored privately with this agreement and marks it signed.</p>
      <Field label="Signed PDF"><input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></Field>
      {s.err && <Alert>{s.err}</Alert>}
      <div className="row end"><button onClick={onClose}>Cancel</button><button className="primary" disabled={s.busy} onClick={save}>{s.busy ? 'Uploading…' : 'Upload'}</button></div>
    </Modal>
  )
}

function TenancyModal({ t: init, hasTpl, onClose }: { t: Tenancy; hasTpl: boolean; onClose: () => void }) {
  const { data, reload } = useData()
  const L = useLookups()
  const [t, setT] = useState(init)
  const s = useSaver()
  const set = (k: keyof Tenancy) => (e: { target: { value: string } }) => setT({ ...t, [k]: e.target.value })
  async function save() {
    const ok = await s.run(async () => {
      const row: Partial<Tenancy> = {
        monthly_rent: Number(t.monthly_rent), deposit: t.deposit === null || (t.deposit as unknown) === '' ? null : Number(t.deposit),
        pay_day: Number(t.pay_day) || null, agreement_date: t.agreement_date || null, start_date: t.start_date || null, end_date: t.end_date || null,
        moved_in_on: t.moved_in_on || null, signed: t.signed, doc_link: t.doc_link || null, remarks: t.remarks || null, premises_address: t.premises_address || null,
      }
      const { error } = await supabase.from('tenancies').update(row).eq('id', t.id)
      if (error) throw new Error(friendlyError(error.message))
    })
    if (ok) { await reload(); onClose() }
  }
  async function removeSigned() {
    if (!confirm('Remove the uploaded signed copy from this agreement?')) return
    const ok = await s.run(async () => {
      await supabase.storage.from(BUCKET).remove([t.signed_file_path!])
      const { error } = await supabase.from('tenancies').update({ signed_file_path: null, signed_uploaded_at: null, signed: false }).eq('id', t.id)
      if (error) throw error
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
      <Field label="Alamat (if different from the property address)"><textarea rows={2} value={t.premises_address ?? ''} onChange={set('premises_address')} /></Field>
      <label className="check"><input type="checkbox" checked={t.signed} onChange={e => setT({ ...t, signed: e.target.checked })} /> Agreement signed</label>
      {t.signed_file_path && <div className="row between small"><span>Signed copy uploaded {t.signed_uploaded_at ? fmtDate(t.signed_uploaded_at.slice(0, 10)) : ''}</span><button className="small danger" onClick={removeSigned}>Remove</button></div>}
      <Field label="Old document link (optional)"><input value={t.doc_link ?? ''} onChange={set('doc_link')} /></Field>
      <Field label="Remarks"><textarea rows={2} value={t.remarks ?? ''} onChange={set('remarks')} /></Field>
      <p className="muted small">Full name and IC are edited on the Tenants page, or with Create Agreement → Current tenant.</p>
      {s.err && <Alert>{s.err}</Alert>}
      <div className="row between">
        <div className="row wrap">
          <button className="small" onClick={() => downloadAgreementPdf(data, t).catch(e => s.setErr(e.message))}>Download PDF</button>
          {hasTpl && <button className="small" onClick={() => downloadAgreementWord(data, t).catch(e => s.setErr(e.message))}>Word</button>}
          {t.doc_link && <a className="btn small" href={t.doc_link} target="_blank" rel="noreferrer">Old doc</a>}
        </div>
        <div className="row"><button onClick={onClose}>Cancel</button><button className="primary" disabled={s.busy} onClick={save}>Save</button></div>
      </div>
    </Modal>
  )
}
