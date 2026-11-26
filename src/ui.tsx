import { useEffect, useState, type ReactNode } from 'react'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="ghost" onClick={onClose} aria-label="Close">✕</button></div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'warn' | 'ok'; children: ReactNode }) {
  return <div className={`alert ${kind}`}>{children}</div>
}

export function Badge({ kind, children }: { kind: 'ok' | 'warn' | 'bad' | 'muted'; children: ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>
}

export function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="month" className="month" value={value.slice(0, 7)} onChange={e => e.target.value && onChange(e.target.value + '-01')} />
}

/** wraps an async save: shows errors, disables while busy */
export function useSaver() {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null)
    try { await fn(); return true } catch (e) { setErr((e as Error).message); return false } finally { setBusy(false) }
  }
  return { busy, err, setErr, run }
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'bad' }) {
  return <div className={`stat ${tone ?? ''}`}><div className="stat-label">{label}</div><div className="stat-value">{value}</div>{sub && <div className="stat-sub">{sub}</div>}</div>
}
