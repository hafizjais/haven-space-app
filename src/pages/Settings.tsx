import { useEffect, useState } from 'react'
import { friendlyError, useData, type Settings } from '../lib/data'
import { supabase } from '../lib/supabase'
import { Alert, Field, useSaver } from '../ui'
import { BUCKET, TEMPLATE_PATH, clearTemplateCache, loadTemplate, parseTemplate, saveBlob, type Template } from '../lib/template'

export default function SettingsPage() {
  const { data, reload } = useData()
  const [st, setSt] = useState<Settings>(data.settings ?? { id: 1, grace_days: 7, low_collection_alert: 80 } as Settings)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const s = useSaver()
  const a = useSaver()
  const [saved, setSaved] = useState(false)
  const set = (k: keyof Settings) => (e: { target: { value: string } }) => { setSt({ ...st, [k]: e.target.value }); setSaved(false) }

  async function save() {
    const ok = await s.run(async () => {
      const { error } = await supabase.from('settings').upsert({ ...st, id: 1, grace_days: Number(st.grace_days) || 7, low_collection_alert: Number(st.low_collection_alert) || 80 })
      if (error) throw new Error(friendlyError(error.message))
    })
    if (ok) { setSaved(true); reload() }
  }
  async function addAdmin() {
    const em = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(em)) return a.setErr('Enter a valid email.')
    const ok = await a.run(async () => {
      const { error } = await supabase.from('admins').insert({ email: em, name: name.trim() || null })
      if (error) throw new Error(error.message.includes('duplicate') ? 'Already an admin.' : friendlyError(error.message))
    })
    if (ok) { setEmail(''); setName(''); reload() }
  }
  async function removeAdmin(em: string) {
    if (data.admins.length <= 1) return alert('There must be at least one admin.')
    if (!confirm(`Remove ${em} as admin?`)) return
    const { error } = await supabase.from('admins').delete().eq('email', em)
    if (error) alert(error.message); else reload()
  }

  return (
    <>
      <div className="page-head"><h1>Settings</h1><button onClick={() => supabase.auth.signOut()}>Log out</button></div>
      <div className="grid2">
        <section className="card">
          <h2>Agreement details</h2>
          <p className="muted small">Used in every agreement PDF.</p>
          <Field label="Business name"><input value={st.company_name ?? ''} onChange={set('company_name')} /></Field>
          <div className="form-grid">
            <Field label="Landlord full name"><input value={st.landlord_name ?? ''} onChange={set('landlord_name')} /></Field>
            <Field label="Landlord IC"><input value={st.landlord_ic ?? ''} onChange={set('landlord_ic')} /></Field>
            <Field label="Bank"><input value={st.bank_name ?? ''} onChange={set('bank_name')} /></Field>
            <Field label="Account name"><input value={st.account_name ?? ''} onChange={set('account_name')} /></Field>
            <Field label="Account number"><input value={st.account_no ?? ''} onChange={set('account_no')} /></Field>
            <Field label="Grace period (days)"><input type="number" value={st.grace_days} onChange={set('grace_days')} /></Field>
            <Field label="Witness full name"><input value={st.witness_name ?? ''} onChange={set('witness_name')} /></Field>
            <Field label="Witness IC"><input value={st.witness_ic ?? ''} onChange={set('witness_ic')} /></Field>
            <Field label="Alert when collection is below (%)"><input type="number" value={st.low_collection_alert} onChange={set('low_collection_alert')} /></Field>
          </div>
          {s.err && <Alert>{s.err}</Alert>}
          {saved && <Alert kind="ok">Saved.</Alert>}
          <div className="row end"><button className="primary" disabled={s.busy} onClick={save}>Save</button></div>
        </section>
        <TemplateCard />
        <section className="card">
          <h2>Admins</h2>
          <p className="muted small">Everyone here has full access. To add someone: add their email here, then they open this site, tap "New admin? Create account" and sign up with that email.</p>
          <ul className="list compact">{data.admins.map(x => (
            <li key={x.email}><span><b>{x.name || x.email}</b> {x.name && <span className="muted small">{x.email}</span>}</span>
              <button className="ghost small" onClick={() => removeAdmin(x.email)}>Remove</button></li>
          ))}</ul>
          <div className="form-grid">
            <Field label="Email"><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
            <Field label="Name"><input value={name} onChange={e => setName(e.target.value)} /></Field>
          </div>
          {a.err && <Alert>{a.err}</Alert>}
          <div className="row end"><button className="primary" disabled={a.busy} onClick={addAdmin}>Add admin</button></div>
        </section>
      </div>
    </>
  )
}

function TemplateCard() {
  const [tpl, setTpl] = useState<Template | null | undefined>(undefined)
  const s = useSaver()
  useEffect(() => { loadTemplate().then(setTpl).catch(e => { console.error('Template', e); setTpl(null) }) }, [])
  async function upload(f: File | undefined) {
    if (!f) return
    const ok = await s.run(async () => {
      const parsed = await parseTemplate(await f.arrayBuffer()).catch(() => { throw new Error('That file is not a Word (.docx) document.') })
      if (!parsed.placeholders.length) throw new Error('No {{fields}} found in this document.')
      const { error } = await supabase.storage.from(BUCKET).upload(TEMPLATE_PATH, await f.arrayBuffer(), { upsert: true, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      if (error) throw new Error(error.message)
      clearTemplateCache(); setTpl(await loadTemplate())
    })
    if (!ok) return
  }
  async function download() {
    const { data, error } = await supabase.storage.from(BUCKET).download(TEMPLATE_PATH)
    if (error) return s.setErr(error.message)
    saveBlob(data, 'Template_Agreement.docx')
  }
  return (
    <section className="card">
      <h2>Agreement template (Word)</h2>
      <p className="muted small">Fields written as {'{{Field Name}}'} are filled in by Create Agreement. The 1st picture is used as the landlord signature, the 2nd as the witness signature, and the 4th and 5th are replaced with the tenant's IC photos. Stored privately.</p>
      {tpl === undefined ? <p className="muted">Checking…</p> : tpl ? <>
        <p className="small">Fields found: {tpl.placeholders.map(p => <span key={p} className="badge muted">{p}</span>)}</p>
        <p className="small muted">{tpl.images.length} pictures found.</p>
      </> : <Alert kind="warn">No template uploaded yet.</Alert>}
      {s.err && <Alert>{s.err}</Alert>}
      <div className="row wrap">
        <label className="btn primary small">{tpl ? 'Replace template' : 'Upload template'}<input type="file" hidden accept=".docx" onChange={e => upload(e.target.files?.[0])} /></label>
        {tpl && <button className="small" onClick={download}>Download current</button>}
        {s.busy && <span className="muted small">Uploading…</span>}
      </div>
    </section>
  )
}
