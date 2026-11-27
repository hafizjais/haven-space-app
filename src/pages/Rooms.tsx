import { useState } from 'react'
import { RM, friendlyError, roomOrder, icDigits, phoneDigits, today, useData, useLookups, type Property, type Room, type Tenancy } from '../lib/data'
import { supabase } from '../lib/supabase'
import { Alert, Badge, Field, Modal, useSaver } from '../ui'

export default function Rooms() {
  const { data } = useData()
  const L = useLookups()
  const [editRoom, setEditRoom] = useState<Partial<Room> | null>(null)
  const [editProp, setEditProp] = useState<Partial<Property> | null>(null)
  const [checkIn, setCheckIn] = useState<Room | null>(null)
  const [moveOut, setMoveOut] = useState<Tenancy | null>(null)
  const [filter, setFilter] = useState<'all' | 'vacant'>('all')

  return (
    <>
      <div className="page-head">
        <h1>Properties & rooms</h1>
        <div className="row">
          <div className="seg">
            <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
            <button className={filter === 'vacant' ? 'on' : ''} onClick={() => setFilter('vacant')}>Vacant</button>
          </div>
          <button onClick={() => setEditProp({ code: `HS${data.properties.length + 1}`, name: '', owner_rent: 0, target_collected: 0, target_expenses: 0, sort: data.properties.length })}>+ Property</button>
        </div>
      </div>
      {data.properties.map(p => {
        const rooms = data.rooms.filter(r => r.property_id === p.id && (r.active || filter === 'all'))
          .filter(r => filter === 'all' || L.freeBeds(r.id) > 0).sort(roomOrder)
        if (filter === 'vacant' && rooms.length === 0) return null
        return (
          <section className="card" key={p.id}>
            <div className="row between">
              <h2>{p.code} · {p.name}</h2>
              <div className="row">
                {p.map_url && <a className="btn small" href={p.map_url} target="_blank" rel="noreferrer">Map</a>}
                {p.drive_url && <a className="btn small" href={p.drive_url} target="_blank" rel="noreferrer">Photos</a>}
                <button className="small" onClick={() => setEditProp(p)}>Edit</button>
                <button className="small" onClick={() => setEditRoom({ property_id: p.id, name: '', price: 0, beds: 1, active: true, sort: rooms.length + 1 })}>+ Room</button>
              </div>
            </div>
            <p className="muted small">{p.address}</p>
            <div className="rooms">{rooms.map(r => {
              const ts = L.activeTenancies(r.id)
              const beds = r.beds || 1
              const free = L.freeBeds(r.id)
              const one = (t: Tenancy) => { const tn = L.tenant(t.tenant_id); return tn && <>
                <div>{tn.nickname} {t.monthly_rent !== r.price && <Badge kind="warn">pays {RM(t.monthly_rent)}</Badge>}</div>
                <div className="small muted">{tn.phone || 'no phone'} · pay day {t.pay_day ?? '?'}</div>
              </> }
              return (
                <div key={r.id} className={`room ${ts.length ? '' : 'vacant'} ${r.active ? '' : 'inactive'}`}>
                  <div className="row between"><b>{r.name}</b><span>{RM(r.price)}{beds > 1 && <span className="muted small"> / bed</span>}</span></div>
                  {beds > 1 && <div className="small muted">Shared room · {beds} beds · {free ? `${free} free` : 'full'}</div>}
                  {beds === 1 ? (ts[0] ? one(ts[0]) : <div><Badge kind="ok">Vacant</Badge>{!r.active && <Badge kind="muted">Not in use</Badge>}</div>) :
                    <ul className="beds">{Array.from({ length: Math.max(beds, ts.length) }, (_, i) => ts[i] ? (
                      <li key={ts[i].id}><span className="bed-no">Bed {i + 1}</span><div className="grow">{one(ts[i])}</div>
                        <button className="small" onClick={() => setMoveOut(ts[i])}>Move out</button></li>
                    ) : <li key={'free' + i}><span className="bed-no">Bed {i + 1}</span><div className="grow"><Badge kind="ok">Vacant</Badge></div></li>)}</ul>}
                  <div className="row">
                    <button className="small" onClick={() => setEditRoom(r)}>Edit</button>
                    {beds === 1 && ts[0] && <button className="small" onClick={() => setMoveOut(ts[0])}>Move out</button>}
                    {free > 0 && r.active && <button className="small primary" onClick={() => setCheckIn(r)}>Check in tenant</button>}
                  </div>
                </div>
              )
            })}</div>
          </section>
        )
      })}
      {editRoom && <RoomModal room={editRoom} onClose={() => setEditRoom(null)} />}
      {editProp && <PropertyModal p={editProp} onClose={() => setEditProp(null)} />}
      {checkIn && <CheckInModal room={checkIn} onClose={() => setCheckIn(null)} />}
      {moveOut && <MoveOutModal t={moveOut} onClose={() => setMoveOut(null)} />}
    </>
  )
}

function RoomModal({ room, onClose }: { room: Partial<Room>; onClose: () => void }) {
  const { reload } = useData()
  const [r, setR] = useState(room)
  const s = useSaver()
  async function save() {
    if (!r.name?.trim()) return s.setErr('Room name is required.')
    const ok = await s.run(async () => {
      const row = { property_id: r.property_id, name: r.name!.trim(), price: Number(r.price) || 0, beds: Math.min(6, Math.max(1, Number(r.beds) || 1)), notes: r.notes || null, active: r.active ?? true, sort: r.sort ?? 0 }
      const { error } = r.id ? await supabase.from('rooms').update(row).eq('id', r.id) : await supabase.from('rooms').insert(row)
      if (error) throw new Error(friendlyError(error.message))
    })
    if (ok) { await reload(); onClose() }
  }
  return (
    <Modal title={r.id ? 'Edit room' : 'New room'} onClose={onClose}>
      <div className="form-grid">
        <Field label="Room name"><input value={r.name ?? ''} onChange={e => setR({ ...r, name: e.target.value })} placeholder="e.g. Bilik Master" /></Field>
        <Field label={(r.beds ?? 1) > 1 ? 'Listed price per bed (RM)' : 'Listed price (RM)'}><input type="number" min="0" value={r.price ?? 0} onChange={e => setR({ ...r, price: Number(e.target.value) })} /></Field>
        <Field label="Beds (tenants)" hint="2 for a twin sharing room"><input type="number" min="1" max="6" value={r.beds ?? 1} onChange={e => setR({ ...r, beds: Number(e.target.value) })} /></Field>
        <Field label="Position" hint="Lower numbers show first. Shared rooms always show after single rooms."><input type="number" min="0" value={r.sort ?? 0} onChange={e => setR({ ...r, sort: Number(e.target.value) })} /></Field>
      </div>
      <Field label="Notes"><input value={r.notes ?? ''} onChange={e => setR({ ...r, notes: e.target.value })} /></Field>
      <label className="check"><input type="checkbox" checked={r.active ?? true} onChange={e => setR({ ...r, active: e.target.checked })} /> Room is in use</label>
      <p className="muted small">Changing the listed price doesn't change what the current tenant pays. Edit their rent in Agreements.</p>
      {s.err && <Alert>{s.err}</Alert>}
      <div className="row end"><button onClick={onClose}>Cancel</button><button className="primary" disabled={s.busy} onClick={save}>Save</button></div>
    </Modal>
  )
}

function PropertyModal({ p: init, onClose }: { p: Partial<Property>; onClose: () => void }) {
  const { reload } = useData()
  const [p, setP] = useState(init)
  const s = useSaver()
  const set = (k: keyof Property) => (e: { target: { value: string } }) => setP({ ...p, [k]: e.target.value })
  async function save() {
    if (!p.code?.trim() || !p.name?.trim()) return s.setErr('Code and name are required.')
    const ok = await s.run(async () => {
      const row = { code: p.code!.trim(), name: p.name!.trim(), address: p.address || null, drive_url: p.drive_url || null, map_url: p.map_url || null,
        owner_rent: Number(p.owner_rent) || 0, target_collected: Number(p.target_collected) || 0, target_expenses: Number(p.target_expenses) || 0, sort: p.sort ?? 0 }
      const { error } = p.id ? await supabase.from('properties').update(row).eq('id', p.id) : await supabase.from('properties').insert(row)
      if (error) throw new Error(friendlyError(error.message))
    })
    if (ok) { await reload(); onClose() }
  }
  return (
    <Modal title={p.id ? `Edit ${p.code}` : 'New property'} onClose={onClose}>
      <div className="form-grid">
        <Field label="Code"><input value={p.code ?? ''} onChange={set('code')} /></Field>
        <Field label="Name"><input value={p.name ?? ''} onChange={set('name')} /></Field>
      </div>
      <Field label="Full address (used in agreements)"><textarea rows={2} value={p.address ?? ''} onChange={set('address')} /></Field>
      <div className="form-grid">
        <Field label="Monthly rent to owner (RM)"><input type="number" value={p.owner_rent ?? 0} onChange={set('owner_rent')} /></Field>
        <Field label="Target collected (RM)"><input type="number" value={p.target_collected ?? 0} onChange={set('target_collected')} /></Field>
        <Field label="Target expenses (RM)"><input type="number" value={p.target_expenses ?? 0} onChange={set('target_expenses')} /></Field>
        <Field label="Google Maps link"><input value={p.map_url ?? ''} onChange={set('map_url')} /></Field>
        <Field label="Photos folder link"><input value={p.drive_url ?? ''} onChange={set('drive_url')} /></Field>
      </div>
      {s.err && <Alert>{s.err}</Alert>}
      <div className="row end"><button onClick={onClose}>Cancel</button><button className="primary" disabled={s.busy} onClick={save}>Save</button></div>
    </Modal>
  )
}

function CheckInModal({ room, onClose }: { room: Room; onClose: () => void }) {
  const { data, reload } = useData()
  const L = useLookups()
  const free = data.tenants.filter(t => !data.tenancies.some(x => x.tenant_id === t.id && x.status === 'active'))
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [tenantId, setTenantId] = useState('')
  const [tn, setTn] = useState({ full_name: '', nickname: '', ic_no: '', phone: '' })
  const start = today()
  const end = (() => { const d = new Date(start); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10) })()
  const [t, setT] = useState({ monthly_rent: room.price, deposit: room.price, pay_day: new Date().getDate(), agreement_date: start, start_date: start, end_date: end })
  const s = useSaver()

  // duplicate detection while typing
  const dupIc = icDigits(tn.ic_no).length >= 6 ? data.tenants.find(x => icDigits(x.ic_no) === icDigits(tn.ic_no)) : undefined
  const dupPhone = phoneDigits(tn.phone).length >= 8 ? data.tenants.find(x => phoneDigits(x.phone) === phoneDigits(tn.phone)) : undefined
  const dup = dupIc || dupPhone
  const dupActive = dup && data.tenancies.find(x => x.tenant_id === dup.id && x.status === 'active')

  async function save() {
    if (mode === 'new' && !tn.nickname.trim()) return s.setErr('Enter at least a short name for the tenant.')
    if (mode === 'existing' && !tenantId) return s.setErr('Pick a tenant.')
    if (mode === 'new' && dupIc) return s.setErr(`A tenant with this IC already exists (${dupIc.nickname}). Use "Existing tenant" instead.`)
    const ok = await s.run(async () => {
      let tid = tenantId
      if (mode === 'new') {
        const { data: row, error } = await supabase.from('tenants').insert({
          full_name: tn.full_name.trim().toUpperCase() || null, nickname: tn.nickname.trim(), ic_no: tn.ic_no.trim() || null, phone: tn.phone.trim() || null,
        }).select('id').single()
        if (error) throw new Error(friendlyError(error.message))
        tid = row.id
      }
      const { error } = await supabase.from('tenancies').insert({
        room_id: room.id, tenant_id: tid, status: 'active', monthly_rent: Number(t.monthly_rent), deposit: Number(t.deposit) || null,
        pay_day: Number(t.pay_day) || null, agreement_date: t.agreement_date || null, start_date: t.start_date || null,
        end_date: t.end_date || null, moved_in_on: t.start_date || null,
      })
      if (error) {
        if (mode === 'new') await supabase.from('tenants').delete().eq('id', tid)
        throw new Error(friendlyError(error.message))
      }
    })
    if (ok) { await reload(); onClose() }
  }

  return (
    <Modal title={`Check in · ${L.roomLabel(room.id)}`} onClose={onClose}>
      <div className="seg"><button className={mode === 'new' ? 'on' : ''} onClick={() => setMode('new')}>New tenant</button><button className={mode === 'existing' ? 'on' : ''} onClick={() => setMode('existing')}>Existing tenant</button></div>
      {mode === 'new' ? <>
        <div className="form-grid">
          <Field label="Short name"><input value={tn.nickname} onChange={e => setTn({ ...tn, nickname: e.target.value })} placeholder="e.g. Faheem" /></Field>
          <Field label="Phone"><input inputMode="tel" value={tn.phone} onChange={e => setTn({ ...tn, phone: e.target.value })} /></Field>
        </div>
        <Field label="Full name (as in IC)"><input value={tn.full_name} onChange={e => setTn({ ...tn, full_name: e.target.value })} /></Field>
        <Field label="IC number"><input value={tn.ic_no} onChange={e => setTn({ ...tn, ic_no: e.target.value })} placeholder="000000-00-0000" /></Field>
        {dup && <Alert kind="warn">This looks like an existing tenant: <b>{dup.nickname}</b> {dup.full_name ? `(${dup.full_name})` : ''}
          {dupActive ? ` who already rents ${L.roomLabel(dupActive.room_id)}. A tenant can only rent one room at a time.` : '. Use "Existing tenant" to avoid a duplicate.'}</Alert>}
      </> : (
        <Field label="Tenant (only those not renting a room now)">
          <select value={tenantId} onChange={e => setTenantId(e.target.value)}>
            <option value="">Choose…</option>
            {free.map(x => <option key={x.id} value={x.id}>{x.nickname}{x.full_name ? ` · ${x.full_name}` : ''}</option>)}
          </select>
        </Field>
      )}
      <div className="form-grid">
        <Field label="Monthly rent (RM)" hint={Number(t.monthly_rent) !== room.price ? `Listed price is ${RM(room.price)}` : undefined}><input type="number" value={t.monthly_rent} onChange={e => setT({ ...t, monthly_rent: Number(e.target.value) })} /></Field>
        <Field label="Deposit (RM)"><input type="number" value={t.deposit} onChange={e => setT({ ...t, deposit: Number(e.target.value) })} /></Field>
        <Field label="Pay day (day of month)"><input type="number" min="1" max="31" value={t.pay_day} onChange={e => setT({ ...t, pay_day: Number(e.target.value) })} /></Field>
        <Field label="Agreement date"><input type="date" value={t.agreement_date} onChange={e => setT({ ...t, agreement_date: e.target.value })} /></Field>
        <Field label="Start date"><input type="date" value={t.start_date} onChange={e => setT({ ...t, start_date: e.target.value })} /></Field>
        <Field label="End date"><input type="date" value={t.end_date} onChange={e => setT({ ...t, end_date: e.target.value })} /></Field>
      </div>
      {s.err && <Alert>{s.err}</Alert>}
      <div className="row end"><button onClick={onClose}>Cancel</button><button className="primary" disabled={s.busy || !!dupActive} onClick={save}>Check in</button></div>
    </Modal>
  )
}

function MoveOutModal({ t, onClose }: { t: Tenancy; onClose: () => void }) {
  const { reload } = useData()
  const L = useLookups()
  const [date, setDate] = useState(today())
  const s = useSaver()
  async function save() {
    const ok = await s.run(async () => {
      const { error } = await supabase.from('tenancies').update({ status: 'ended', moved_out_on: date }).eq('id', t.id)
      if (error) throw new Error(friendlyError(error.message))
    })
    if (ok) { await reload(); onClose() }
  }
  return (
    <Modal title={`Move out · ${L.tenant(t.tenant_id)?.nickname}`} onClose={onClose}>
      <p>{(L.room(t.room_id)?.beds ?? 1) > 1 ? `This frees one bed in ${L.roomLabel(t.room_id)}.` : `${L.roomLabel(t.room_id)} will become vacant.`} Payment history is kept.</p>
      <Field label="Move-out date"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
      {s.err && <Alert>{s.err}</Alert>}
      <div className="row end"><button onClick={onClose}>Cancel</button><button className="primary" disabled={s.busy} onClick={save}>Confirm move out</button></div>
    </Modal>
  )
}
