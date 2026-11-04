import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Send, Copy, Swords, Plus, KeyRound, ChevronRight } from 'lucide-react'
import { useStore } from '../store/app.js'
import { useT } from '../lib/i18n.js'
import { request } from '../lib/socket.js'
import { api } from '../lib/api.js'
import { shareLink, copyText, haptic } from '../lib/telegram.js'
import { sfx } from '../lib/sound.js'
import { PageHeader, Spinner, Avatar } from '../components/ui.jsx'

const CODE_LEN = 5

function CodeDigits({ code, size = 'lg' }) {
  const big = size === 'lg'
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: CODE_LEN }, (_, i) => (
        <div
          key={i}
          className={`flex items-center justify-center rounded-2xl bg-white/[0.06] font-display font-bold text-fuchsia-100 ring-1 ring-fuchsia-300/30 ${big ? 'h-16 w-12 text-4xl' : 'h-12 w-10 text-2xl'}`}
        >
          {code?.[i] ?? ''}
        </div>
      ))}
    </div>
  )
}

/** 5 boxes backed by one numeric input (works with the phone's number pad and paste) */
function CodeInput({ value, onChange, onComplete, error, disabled }) {
  const ref = useRef(null)
  useEffect(() => {
    const id = setTimeout(() => ref.current?.focus(), 250)
    return () => clearTimeout(id)
  }, [])
  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        value={value}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={CODE_LEN}
        aria-label="code"
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, CODE_LEN)
          if (v.length > value.length) haptic.tap()
          onChange(v)
          if (v.length === CODE_LEN) onComplete(v)
        }}
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />
      <motion.div className="flex justify-center gap-2" animate={error ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }} transition={{ duration: 0.4 }}>
        {Array.from({ length: CODE_LEN }, (_, i) => {
          const active = i === Math.min(value.length, CODE_LEN - 1) && !disabled
          return (
            <div
              key={i}
              className={`flex h-16 w-12 items-center justify-center rounded-2xl font-display text-3xl font-bold transition-colors ${
                error ? 'bg-rose-500/15 text-rose-200 ring-2 ring-rose-400/60'
                  : active ? 'bg-white/[0.08] ring-2 ring-cyan-300' : 'bg-white/[0.05] ring-1 ring-white/10'
              }`}
            >
              {value[i] ?? (active ? <span className="h-7 w-0.5 animate-pulse bg-cyan-300" /> : '')}
            </div>
          )
        })}
      </motion.div>
    </div>
  )
}

function Choice({ icon: Icon, title, sub, color, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={() => {
        sfx.tap()
        haptic.light()
        onClick()
      }}
      className="glass relative mb-3 flex w-full items-center gap-4 overflow-hidden p-5 text-left"
    >
      <div className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${color} opacity-25 blur-2xl`} />
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${color} text-ink-950`}>
        <Icon size={26} strokeWidth={2.4} />
      </div>
      <div className="flex-1">
        <div className="text-[17px] font-extrabold">{title}</div>
        <div className="text-xs text-slate-400">{sub}</div>
      </div>
      <ChevronRight className="text-slate-500" size={20} />
    </motion.button>
  )
}

function Host() {
  const t = useT()
  const navigate = useNavigate()
  const p = useStore((s) => s.profile)
  const connected = useStore((s) => s.connected)
  const toast = useStore((s) => s.toast)
  const [code, setCode] = useState(null)
  const [link, setLink] = useState(null)

  useEffect(() => {
    if (!connected) return
    let cancelled = false
    request('duel:create').then(async (res) => {
      if (cancelled) return
      if (res.error) {
        toast(res.error, 'error')
        return navigate(-1)
      }
      setCode(res.code)
      const l = await api(`/duel-link/${res.code}`).catch(() => null)
      if (!cancelled) setLink(l?.link || null)
    })
    return () => {
      cancelled = true
      if (!useStore.getState().game) request('duel:cancel')
    }
  }, [connected]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="glass relative mb-4 overflow-hidden p-6 text-center">
        <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative mb-5 flex items-center justify-center gap-4">
          <Avatar photo={p.photo} name={p.name} frame={p.equipped.frame} size={60} />
          <Swords className="text-fuchsia-300" size={26} />
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} className="flex h-[60px] w-[60px] items-center justify-center rounded-full border-2 border-dashed border-white/25 text-2xl">
            ?
          </motion.div>
        </div>
        <div className="label mb-2">{t('duel_code')}</div>
        {code ? <CodeDigits code={code} /> : <div className="flex h-16 items-center justify-center"><Spinner /></div>}
        <p className="mt-4 text-sm text-slate-300">{t('duel_host_hint')}</p>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-400">
          <Spinner size={16} /> {t('waiting_friend')}
        </div>
      </div>
      <button
        className="btn-primary mb-2 w-full"
        disabled={!code}
        onClick={async () => {
          await copyText(code)
          haptic.success()
          toast(t('code_copied'), 'success')
        }}
      >
        <Copy size={18} /> {t('copy_code')}
      </button>
      <button
        className="btn-ghost w-full"
        disabled={!code}
        onClick={() => {
          haptic.medium()
          shareLink(link || location.origin, t('duel_share', { code }))
        }}
      >
        <Send size={18} /> {t('send_invite')}
      </button>
      <p className="mt-4 text-center text-xs text-slate-500">{t('duel_rewards_left', { n: p.duelRewardsLeft })}</p>
    </div>
  )
}

function Join({ initial = '' }) {
  const t = useT()
  const navigate = useNavigate()
  const connected = useStore((s) => s.connected)
  const toast = useStore((s) => s.toast)
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(0)
  const [showError, setShowError] = useState(false)

  const join = async (code) => {
    if (busy || code.length !== CODE_LEN) return
    setBusy(true)
    const res = await request('duel:join', { code })
    setBusy(false)
    if (res.error) {
      haptic.error()
      sfx.invalid()
      setError((n) => n + 1)
      setShowError(true)
      toast(res.error, 'error')
      setValue('')
    } else if (res.hosting) {
      toast(t('err_own_duel'), 'info')
    }
    // On success the server starts the game and the app switches to the battle screen
  }

  useEffect(() => {
    if (initial.length === CODE_LEN && connected) join(initial)
  }, [connected]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pt-4 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-300 to-blue-500 text-ink-950">
        <KeyRound size={30} />
      </div>
      <h2 className="h-display mb-1 text-xl">{t('enter_code')}</h2>
      <p className="mb-6 text-sm text-slate-400">{t('enter_code_sub')}</p>
      <CodeInput
        key={error}
        value={value}
        onChange={(v) => {
          setShowError(false)
          setValue(v)
        }}
        onComplete={join}
        error={showError}
        disabled={busy}
      />
      <button className="btn-primary mt-6 w-full" disabled={value.length !== CODE_LEN || busy || !connected} onClick={() => join(value)}>
        {busy ? <Spinner size={20} /> : <><Swords size={18} /> {t('join_battle')}</>}
      </button>
      <button className="mt-3 text-sm font-bold text-slate-400" onClick={() => navigate('/duel/new', { replace: true })}>
        {t('duel_create_instead')}
      </button>
    </div>
  )
}

export default function Duel() {
  const t = useT()
  const navigate = useNavigate()
  const { code: param = '' } = useParams()
  const mode = param === 'new' ? 'host' : param ? 'join' : 'menu'
  const deepCode = mode === 'join' ? param.replace(/\D/g, '').slice(0, CODE_LEN) : ''

  return (
    <div>
      <PageHeader title={t('duel_title')} />
      {mode === 'menu' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="mb-5 text-sm text-slate-400">{t('duel_sub')}</p>
          <Choice icon={Plus} title={t('duel_create')} sub={t('duel_create_sub')} color="from-fuchsia-400 to-violet-500" onClick={() => navigate('/duel/new')} />
          <Choice icon={KeyRound} title={t('duel_join')} sub={t('duel_join_sub')} color="from-cyan-300 to-blue-500" onClick={() => navigate('/duel/join')} />
        </motion.div>
      )}
      {mode === 'host' && <Host />}
      {mode === 'join' && <Join initial={deepCode} />}
    </div>
  )
}
