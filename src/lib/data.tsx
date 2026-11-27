import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

export type Settings = {
  id: number; company_name: string | null; landlord_name: string | null; landlord_ic: string | null
  bank_name: string | null; account_name: string | null; account_no: string | null
  witness_name: string | null; witness_ic: string | null; grace_days: number; low_collection_alert: number
}
export type Property = {
  id: string; code: string; name: string; address: string | null; drive_url: string | null; map_url: string | null
  owner_rent: number; target_collected: number; target_expenses: number; sort: number
}
export type Room = { id: string; property_id: string; name: string; price: number; beds: number; notes: string | null; sort: number; active: boolean }
export type Tenant = { id: string; full_name: string | null; nickname: string; ic_no: string | null; phone: string | null; notes: string | null }
export type Tenancy = {
  id: string; room_id: string; tenant_id: string; status: 'active' | 'ended'; monthly_rent: number; deposit: number | null
  pay_day: number | null; agreement_date: string | null; start_date: string | null; end_date: string | null
  moved_in_on: string | null; moved_out_on: string | null; signed: boolean; doc_link: string | null; remarks: string | null
  premises_address: string | null; ic_front_path: string | null; ic_back_path: string | null
  signed_file_path: string | null; signed_uploaded_at: string | null; extra_fields: Record<string, string> | null
}
export type Payment = {
  id: string; tenancy_id: string; period: string; amount: number; paid_on: string | null; method: string | null
  note: string | null; created_by: string | null; created_at: string
}
export type Expense = {
  id: string; property_id: string | null; period: string; category: string; label: string | null
  amount: number; note: string | null; created_by: string | null
}
export type Admin = { email: string; name: string | null }

export type Data = {
  settings: Settings | null; properties: Property[]; rooms: Room[]; tenants: Tenant[]; tenancies: Tenancy[]
  payments: Payment[]; expenses: Expense[]; admins: Admin[]
}

const empty: Data = { settings: null, properties: [], rooms: [], tenants: [], tenancies: [], payments: [], expenses: [], admins: [] }

type Ctx = { data: Data; loading: boolean; error: string | null; reload: () => Promise<void> }
const DataCtx = createContext<Ctx>({ data: empty, loading: true, error: null, reload: async () => {} })

const num = <T extends object>(rows: T[], keys: (keyof T)[]) =>
  rows.map(r => { const o = { ...r } as Record<string, unknown>; keys.forEach(k => { if (o[k as string] != null) o[k as string] = Number(o[k as string]) }); return o as T })

async function all<T>(table: string, order = 'created_at'): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').order(order).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data as T[]))
    if (!data || data.length < 1000) return out
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    try {
      const [settings, properties, rooms, tenants, tenancies, payments, expenses, admins] = await Promise.all([
        all<Settings>('settings', 'id'), all<Property>('properties', 'sort'), all<Room>('rooms', 'sort'), all<Tenant>('tenants'),
        all<Tenancy>('tenancies'), all<Payment>('payments'), all<Expense>('expenses'), all<Admin>('admins'),
      ])
      setData({
        settings: settings[0] ?? null,
        properties: num(properties, ['owner_rent', 'target_collected', 'target_expenses']),
        rooms: num(rooms, ['price']), tenants,
        tenancies: num(tenancies, ['monthly_rent', 'deposit']),
        payments: num(payments, ['amount']), expenses: num(expenses, ['amount']), admins,
      })
      setError(null)
    } catch (e) { setError((e as Error).message) }
    setLoading(false)
  }, [])
  useEffect(() => { reload() }, [reload])
  return <DataCtx.Provider value={{ data, loading, error, reload }}>{children}</DataCtx.Provider>
}
export const useData = () => useContext(DataCtx)

// ---------- helpers
export const RM = (n: number) => 'RM' + n.toLocaleString('en-MY', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })
export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
export const thisMonth = () => monthKey(new Date())
export const monthLabel = (p: string) => new Date(p + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
export const shortMonth = (p: string) => new Date(p + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' })
export const addMonths = (p: string, n: number) => { const d = new Date(p + 'T00:00:00'); d.setMonth(d.getMonth() + n); return monthKey(d) }
export const fmtDate = (s: string | null) => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
export const today = () => new Date().toISOString().slice(0, 10)
export const icDigits = (s: string | null) => (s || '').replace(/\D/g, '')
export const phoneDigits = (s: string | null) => (s || '').replace(/\D/g, '').replace(/^6/, '')

export const CATEGORIES: Record<string, string> = {
  owner_rent: 'Rent to owner', maintenance: 'Maintenance', electricity: 'Electricity', water: 'Water', wifi: 'Wi-Fi',
  cleaner: 'Cleaner', ads: 'Ads', shop: 'Shop items', salary: 'Salary', renovation: 'Add-on / renovation', other: 'Other',
}
export const PROPERTY_CATS = ['owner_rent', 'maintenance', 'electricity', 'water', 'wifi', 'cleaner', 'other']
export const COMPANY_CATS = ['ads', 'shop', 'salary', 'renovation', 'other']

/** tenancy covers month p (occupied that month) */
export function coversMonth(t: Tenancy, p: string) {
  const start = t.moved_in_on || t.start_date
  if (start && p < start.slice(0, 7) + '-01') return false
  if (t.status === 'ended') {
    if (!t.moved_out_on) return false
    if (p > t.moved_out_on.slice(0, 7) + '-01') return false
  }
  return true
}

export type PropStats = {
  property: Property; rooms: number; occupied: number; expected: number; collected: number
  expenses: number; profit: number; rate: number
}
export function propertyStats(d: Data, p: string): PropStats[] {
  return d.properties.map(property => {
    const rooms = d.rooms.filter(r => r.property_id === property.id && r.active)
    const roomIds = new Set(rooms.map(r => r.id))
    const ts = d.tenancies.filter(t => roomIds.has(t.room_id))
    const tsIds = new Set(ts.map(t => t.id))
    const covering = ts.filter(t => coversMonth(t, p))
    const occupied = rooms.reduce((s, r) => s + Math.min(r.beds || 1, ts.filter(t => t.room_id === r.id && t.status === 'active').length), 0)
    const expected = covering.reduce((s, t) => s + t.monthly_rent, 0)
    const collected = d.payments.filter(x => x.period === p && tsIds.has(x.tenancy_id)).reduce((s, x) => s + x.amount, 0)
    const expenses = d.expenses.filter(e => e.period === p && e.property_id === property.id).reduce((s, e) => s + e.amount, 0)
    const target = property.target_collected || expected
    return { property, rooms: rooms.reduce((s, r) => s + (r.beds || 1), 0), occupied, expected, collected, expenses, profit: collected - expenses, rate: target ? collected / target * 100 : 0 }
  })
}

/** Room display order: single rooms first, then shared rooms; within each group by the room's position number. */
export function roomOrder(a?: Room, b?: Room) {
  if (!a || !b) return 0
  return Number((a.beds || 1) > 1) - Number((b.beds || 1) > 1) || a.sort - b.sort || a.name.localeCompare(b.name)
}

const PROP_COLORS = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#6366f1', '#f97316', '#14b8a6', '#84cc16', '#e11d48']
/** A distinct colour per property (by its order), used for tags and chart accents. */
export function propColor(d: Data, propertyId: string | null | undefined) {
  const i = d.properties.findIndex(p => p.id === propertyId)
  return PROP_COLORS[(i < 0 ? 0 : i) % PROP_COLORS.length]
}

export function paidFor(d: Data, tenancyId: string, p: string) {
  return d.payments.filter(x => x.tenancy_id === tenancyId && x.period === p).reduce((s, x) => s + x.amount, 0)
}

export function useLookups() {
  const { data } = useData()
  const room = (id: string) => data.rooms.find(r => r.id === id)
  const prop = (id: string | null) => data.properties.find(p => p.id === id)
  const tenant = (id: string) => data.tenants.find(t => t.id === id)
  const tenancy = (id: string) => data.tenancies.find(t => t.id === id)
  const roomLabel = (id: string) => { const r = room(id); return r ? `${prop(r.property_id)?.code ?? ''} · ${r.name}` : '?' }
  const activeTenancies = (roomId: string) => data.tenancies.filter(t => t.room_id === roomId && t.status === 'active')
  const activeTenancy = (roomId: string) => activeTenancies(roomId)[0]
  /** beds still free in a room (shared rooms have more than one bed) */
  const freeBeds = (roomId: string) => { const r = room(roomId); return r ? Math.max(0, (r.beds || 1) - activeTenancies(roomId).length) : 0 }
  return { room, prop, tenant, tenancy, roomLabel, activeTenancy, activeTenancies, freeBeds }
}

export function friendlyError(msg: string) {
  if (msg.includes('merge_error: ')) return msg.slice(msg.indexOf('merge_error: ') + 13).replace(/^b/, 'B')
  if (msg.includes('room_full: ')) return msg.slice(msg.indexOf('room_full: ') + 11).replace(/^t/, 'T')
  if (msg.includes('one_active_tenancy_per_room')) return 'This room already has an active tenant. End that tenancy first.'
  if (msg.includes('one_active_tenancy_per_tenant')) return 'This tenant already rents another room. End that tenancy first (no duplicate tenants).'
  if (msg.includes('tenants_ic_unique')) return 'Another tenant record has this IC number. If it is the same person, use Merge in the warning above.'
  if (msg.includes('row-level security')) return 'Your account is not on the admin list. Ask an admin to add your email in Settings.'
  return msg
}
