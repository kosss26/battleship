import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Send, Copy, Swords } from 'lucide-react'
import { useStore } from '../store/app.js'
import { useT } from '../lib/i18n.js'
import { request } from '../lib/socket.js'
import { api } from '../lib/api.js'
import { shareLink, copyText, haptic } from '../lib/telegram.js'
import { PageHeader, Spinner, Avatar } from '../components/ui.jsx'

export default function Duel() {
  const t = useT()
  const navigate = useNavigate()
  const { code: joinCode } = useParams()
  const p = useStore((s) => s.profile)
  const connected = useStore((s) => s.connected)
  const toast = useStore((s) => s.toast)
  const [code, setCode] = useState(null)
  const [link, setLink] = useState(null)

  // Joining via invite link
  useEffect(() => {
    if (!joinCode || !connected) return
    request('duel:join', { code: joinCode }).then((res) => {
      if (res.error) {
        toast(res.error, 'error')
        navigate('/', { replace: true })
      } else if (res.hosting) {
        setCode(joinCode.toUpperCase())
      }
    })
  }, [joinCode, connected]) // eslint-disable-line react-hooks/exhaustive-deps

  // Hosting
  useEffect(() => {
    if (joinCode || !connected) return
    let cancelled = false
    request('duel:create').then(async (res) => {
      if (cancelled) return
      if (res.error) {
        toast(res.error, 'error')
        return navigate(-1)
      }
      setCode(res.code)
      const l = await api(`/duel-link/${res.code}`).catch(() => null)
      setLink(l?.link || `${location.origin}/duel/${res.code}`)
    })
    return () => {
      cancelled = true
      if (!useStore.getState().game) request('duel:cancel')
    }
  }, [joinCode, connected]) // eslint-disable-line react-hooks/exhaustive-deps

  if (joinCode && !code) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
        <Spinner size={36} />
        <div className="font-bold text-slate-300">{t('joining')}</div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={t('duel_title')} />
      <div className="glass relative mb-4 overflow-hidden p-6 text-center">
        <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative mb-5 flex items-center justify-center gap-4">
          <Avatar photo={p.photo} name={p.name} frame={p.equipped.frame} size={64} />
          <Swords className="text-fuchsia-300" size={28} />
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-white/25 text-2xl">
            ?
          </motion.div>
        </div>
        <p className="relative mb-5 text-sm text-slate-300">{t('duel_sub')}</p>
        <div className="label mb-1">{t('duel_code')}</div>
        <div className="h-display mb-1 text-4xl tracking-[0.3em] text-fuchsia-200">{code || '······'}</div>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-400">
          <Spinner size={16} /> {t('waiting_friend')}
        </div>
      </div>
      <button
        className="btn-primary mb-2 w-full"
        disabled={!link}
        onClick={() => {
          haptic.medium()
          shareLink(link, t('share_text'))
        }}
      >
        <Send size={18} /> {t('send_invite')}
      </button>
      <button
        className="btn-ghost w-full"
        disabled={!link}
        onClick={async () => {
          await copyText(link)
          haptic.success()
          toast(t('copied'), 'success')
        }}
      >
        <Copy size={18} /> {t('copy_link')}
      </button>
      <p className="mt-4 text-center text-xs text-slate-500">{t('duel_rewards_left', { n: p.duelRewardsLeft })}</p>
    </div>
  )
}
