import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Anchor, Plus, LoaderCircle } from 'lucide-react'
import { useStore } from '../store/app.js'
import { useT } from '../lib/i18n.js'
import { Coin, Gem, fmt } from './ui.jsx'
import '../styles/naval-home.css'
import '../styles/naval-pages.css'

export const isNavalRoute = (path) => ['/', '/quests', '/shop', '/top', '/profile'].includes(path)

export function NavalWordmark() {
  return (
    <div className="naval-wordmark" aria-label="Battleship">
      <span className="naval-wordmark-line" />
      <span><Anchor size={17} aria-hidden="true" /><b>BATTLESHIP</b></span>
      <span className="naval-wordmark-line" />
    </div>
  )
}

export function NavalWallet() {
  const t = useT()
  const p = useStore((s) => s.profile)
  const navigate = useNavigate()
  return (
    <div className="naval-wallet" aria-label={t('tab_shop')}>
      {[['gold', Coin], ['gems', Gem]].map(([key, Icon]) => (
        <button key={key} onClick={() => navigate('/shop')} aria-label={`${t(`home_${key}`)}: ${p[key]}. ${t('tab_shop')}`}>
          <Icon size={20} /><span>{fmt(p[key])}</span><Plus size={17} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

export function NavalHeader({ title }) {
  return (
    <header className="naval-screen-header">
      <NavalWordmark />
      <div className="naval-title-row"><h1>{title}</h1><NavalWallet /></div>
    </header>
  )
}

/** Prevent repeat taps while a reward or purchase request is in flight. */
export function NavalAction({ onClick, children, disabled, className = '', ...props }) {
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  return (
    <button {...props} disabled={disabled || busy} aria-busy={busy} className={className}
      onClick={async () => {
        if (pending.current || disabled) return
        pending.current = true
        setBusy(true)
        try { await onClick?.() } catch {
          // Store mutations show their own error toast. Keep this action retryable.
        } finally { pending.current = false; setBusy(false) }
      }}>
      {busy && <LoaderCircle className="animate-spin naval-action-spinner" size={15} aria-hidden="true" />}
      {children}
    </button>
  )
}

export function NavalTabs({ value, onChange, options, label, className = '' }) {
  return (
    <div className={`naval-tabs ${className}`} role="group" aria-label={label}>
      {options.map((o) => <button key={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  )
}
