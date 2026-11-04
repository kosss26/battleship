import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Clapperboard, X } from 'lucide-react'
import { AD_COOLDOWN_MS } from '@shared/catalog.js'
import { useStore } from '../store/app.js'
import { useT } from '../lib/i18n.js'
import { watchAd } from '../lib/ads.js'
import { Spinner } from './ui.jsx'

export const useAdsEnabled = () => useStore((s) => !!s.config?.ads?.enabled)

function useCooldown() {
  const until = useStore((s) => (s.profile?.ads?.cooldownUntil || 0) + AD_COOLDOWN_MS)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (until <= now) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [until, now])
  return Math.max(0, Math.ceil((until - now) / 1000))
}

/** "Watch an ad" button. Hidden when ads are off; disabled while on cooldown or out of views. */
export function AdButton({ placement, children, className = '', compact = false }) {
  const t = useT()
  const enabled = useAdsEnabled()
  const left = useStore((s) => s.profile?.ads?.left?.[placement] ?? 0)
  const busy = useStore((s) => s.adBusy)
  const cooldown = useCooldown()
  if (!enabled) return null
  const disabled = busy || left <= 0 || cooldown > 0
  return (
    <button
      className={`btn ${compact ? 'h-9 rounded-xl px-3 text-[13px]' : 'h-12'} bg-gradient-to-r from-emerald-300 to-teal-400 text-ink-950 ${className}`}
      disabled={disabled}
      onClick={() => watchAd(placement)}
    >
      {busy ? <Spinner size={18} /> : <Clapperboard size={compact ? 15 : 18} />}
      <span>{left <= 0 ? t('ad_limit_reached') : cooldown > 0 ? t('ad_wait', { s: cooldown }) : children}</span>
    </button>
  )
}

/** Stand-in "ad" for local development (no Adsgram block id configured) */
export function FakeAd() {
  const t = useT()
  const fake = useStore((s) => s.fakeAd)
  const [, tick] = useState(0)
  // Countdown is derived from the start time so a new ad never inherits the previous one's state
  const left = fake ? Math.ceil((fake.startedAt + 5000 - Date.now()) / 1000) : 5
  useEffect(() => {
    if (!fake) return
    const id = setInterval(() => {
      if (Date.now() >= fake.startedAt + 5000) {
        clearInterval(id)
        fake.resolve(true)
        useStore.setState({ fakeAd: null })
      } else tick((n) => n + 1)
    }, 250)
    return () => clearInterval(id)
  }, [fake])
  if (!fake) return null
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/95 px-8 text-center">
      <button
        className="absolute right-5 top-5 rounded-full bg-white/10 p-2"
        style={{ marginTop: 'var(--safe-top)' }}
        onClick={() => {
          fake.resolve(false)
          useStore.setState({ fakeAd: null })
        }}
        aria-label="close"
      >
        <X size={20} />
      </button>
      <div className="mb-4 text-6xl">📺</div>
      <div className="h-display mb-2 text-xl">{t('ad_test_title')}</div>
      <div className="mb-6 text-sm text-slate-400">{t('ad_test_text')}</div>
      <div className="font-display text-5xl font-bold text-emerald-300">{Math.max(0, left)}</div>
    </motion.div>
  )
}
