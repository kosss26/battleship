import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Swords } from 'lucide-react'
import { useStore } from '../store/app.js'
import { useT } from '../lib/i18n.js'
import { request } from '../lib/socket.js'
import { haptic } from '../lib/telegram.js'
import { Avatar, Modal, Spinner } from './ui.jsx'

/** Incoming duel challenge from a friend */
export default function InvitePopup() {
  const t = useT()
  const invite = useStore((s) => s.invite)
  const toast = useStore((s) => s.toast)
  const [busy, setBusy] = useState(false)
  const close = () => useStore.setState({ invite: null })

  useEffect(() => {
    if (!invite) return
    const id = setTimeout(close, 60_000)
    return () => clearTimeout(id)
  }, [invite])

  const accept = async () => {
    setBusy(true)
    haptic.heavy()
    const res = await request('duel:join', { code: invite.code })
    setBusy(false)
    close()
    if (res.error) toast(res.error, 'error')
  }

  const decline = () => {
    request('duel:decline', { code: invite.code })
    close()
  }

  return (
    <Modal open={!!invite} onClose={decline}>
      {invite && (
        <div className="glass-strong relative overflow-hidden p-6 text-center">
          <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-56 -translate-x-1/2 rounded-full bg-fuchsia-500/30 blur-3xl" />
          <motion.div initial={{ scale: 0.6 }} animate={{ scale: [0.6, 1.08, 1] }} className="relative mx-auto mb-3 w-fit">
            <Avatar photo={invite.from.photo} name={invite.from.name} frame={invite.from.frame} size={76} />
            <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-fuchsia-400 text-ink-950 ring-4 ring-ink-800">
              <Swords size={16} />
            </div>
          </motion.div>
          <div className="relative mb-1 font-display text-lg font-bold">{t('invite_title', { name: invite.from.name })}</div>
          <div className="relative mb-5 text-sm text-slate-400">{t('level')} {invite.from.level} · ⚡{invite.from.rating}</div>
          <div className="relative grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={decline} disabled={busy}>{t('decline')}</button>
            <button className="btn h-12 bg-gradient-to-r from-fuchsia-400 to-violet-500 text-ink-950" onClick={accept} disabled={busy}>
              {busy ? <Spinner size={18} /> : t('accept')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
