import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Alert, Field } from '../ui'

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const redirect = window.location.origin + window.location.pathname

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const em = email.trim().toLowerCase()
    const r = mode === 'in' ? await supabase.auth.signInWithPassword({ email: em, password: pw })
      : mode === 'up' ? await supabase.auth.signUp({ email: em, password: pw, options: { emailRedirectTo: redirect } })
      : await supabase.auth.resetPasswordForEmail(em, { redirectTo: redirect })
    setBusy(false)
    if (r.error) return setMsg({ kind: 'error', text: r.error.message })
    if (mode === 'up') setMsg({ kind: 'ok', text: 'Account created. Check your email to confirm, then log in.' })
    if (mode === 'reset') setMsg({ kind: 'ok', text: 'Check your email for a link to set a new password.' })
  }

  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand big"><span className="logo">⌂</span> Haven Space</div>
        <p className="muted">{mode === 'in' ? 'Admin login' : mode === 'up' ? 'Create your admin account (your email must be added by an admin first)' : 'Reset password'}</p>
        <Field label="Email"><input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
        {mode !== 'reset' && <Field label="Password"><input type="password" required minLength={8} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={pw} onChange={e => setPw(e.target.value)} /></Field>}
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        <button className="primary wide" disabled={busy}>{mode === 'in' ? 'Log in' : mode === 'up' ? 'Create account' : 'Send reset link'}</button>
        <div className="row between small">
          {mode !== 'in' ? <a onClick={() => setMode('in')}>Back to login</a> : <a onClick={() => setMode('up')}>New admin? Create account</a>}
          {mode === 'in' && <a onClick={() => setMode('reset')}>Forgot password</a>}
        </div>
      </form>
    </div>
  )
}
