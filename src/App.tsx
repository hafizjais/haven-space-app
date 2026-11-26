import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { DataProvider, useData } from './lib/data'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Rooms from './pages/Rooms'
import Payments from './pages/Payments'
import Tenants from './pages/Tenants'
import Expenses from './pages/Expenses'
import Agreements from './pages/Agreements'
import SettingsPage from './pages/Settings'

const NAV = [
  ['/', 'Dashboard', '▦'], ['/payments', 'Payments', '₨'], ['/rooms', 'Rooms', '⌂'], ['/tenants', 'Tenants', '☺'],
  ['/expenses', 'Expenses', '⇣'], ['/agreements', 'Agreements', '✎'], ['/settings', 'Settings', '⚙'],
] as const

function Shell({ session }: { session: Session }) {
  const { loading, error, data } = useData()
  const notAdmin = !loading && !error && data.properties.length === 0 && data.admins.length === 0
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="logo">⌂</span> Haven Space</div>
        <nav>{NAV.map(([to, label, icon]) => (
          <NavLink key={to} to={to} end={to === '/'}><span className="ico">{icon}</span><span>{label}</span></NavLink>
        ))}</nav>
        <div className="me">
          <small>{session.user.email}</small>
          <button className="ghost small" onClick={() => supabase.auth.signOut()}>Log out</button>
        </div>
      </aside>
      <main className="main">
        {loading ? <p className="muted">Loading…</p>
          : error ? <div className="alert error">Could not load data: {error}</div>
          : notAdmin ? <div className="alert warn">You are signed in as <b>{session.user.email}</b>, but this email is not on the admin list yet. Ask an existing admin to add it in Settings, then refresh.</div>
          : (
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/tenants" element={<Tenants />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/agreements" element={<Agreements />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          )}
      </main>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === undefined) return null
  if (!session) return <Login />
  return <HashRouter><DataProvider key={session.user.id}><Shell session={session} /></DataProvider></HashRouter>
}
