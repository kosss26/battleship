import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { X, Bot } from 'lucide-react'
import { useStore } from '../store/app.js'
import { useT } from '../lib/i18n.js'
import { joinQueue, leaveQueue, startAi } from '../lib/play.js'
import { Avatar, RankBadge } from '../components/ui.jsx'

export default function Search() {
  const t = useT()
  const navigate = useNavigate()
  const p = useStore((s) => s.profile)
  const mm = useStore((s) => s.mm)
  const game = useStore((s) => s.game)
  const connected = useStore((s) => s.connected)
  const [switching, setSwitching] = useState(false)
  const [since] = useState(Date.now())
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!connected) return
    useStore.setState({ mm: { since: Date.now(), inQueue: 1 } })
    joinQueue().then((res) => {
      if (res.error) navigate(-1)
    })
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => {
      clearInterval(id)
      if (!useStore.getState().game) leaveQueue()
      useStore.setState({ mm: null })
    }
  }, [connected]) // eslint-disable-line react-hooks/exhaustive-deps

  const secs = Math.floor((now - since) / 1000)
  const long = secs >= 30

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center text-center">
      <div className="relative mb-8 h-64 w-64">
        {[0, 1, 2].map((i) => (
          <div key={i} className="absolute rounded-full border border-cyan-300/25" style={{ inset: i * 32 }} />
        ))}
        <div className="absolute inset-0 animate-sweep rounded-full" style={{ background: 'conic-gradient(from 0deg, rgba(34,211,238,0.4), transparent 25%)' }} />
        <div className="ping-ring absolute inset-[38%] rounded-full border-2 border-cyan-300/60" />
        {[[22, 30], [70, 62], [35, 78], [80, 25]].map(([x, y], i) => (
          <motion.div
            key={i}
            className="absolute h-2 w-2 rounded-full bg-cyan-200 shadow-glow"
            style={{ left: `${x}%`, top: `${y}%` }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 2.4, delay: i * 0.6, repeat: Infinity }}
          />
        ))}
        <div className="absolute inset-0 flex items-center justify-center">
          <Avatar photo={p.photo} name={p.name} frame={p.equipped.frame} size={72} />
        </div>
      </div>
      <h1 className="h-display mb-1 text-2xl">{game ? t('found') : t('searching')}</h1>
      <p className="mb-2 text-sm text-slate-400">{t('searching_sub')}</p>
      <div className="mb-6 flex items-center gap-2">
        <RankBadge rating={p.rating} />
        <span className="chip bg-white/[0.07]">⏱ {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span>
        {mm?.inQueue > 1 && <span className="chip bg-white/[0.07]">{t('in_queue', { n: mm.inQueue })}</span>}
      </div>

      {long && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass mb-3 w-full p-4">
          <p className="mb-3 text-sm text-slate-300">{t('long_wait')}</p>
          <button
            className="btn-ghost w-full"
            disabled={switching || !connected}
            onClick={async () => {
              setSwitching(true)
              try {
                const left = await leaveQueue()
                if (!left.error) await startAi('medium')
              } finally { setSwitching(false) }
            }}
          >
            <Bot size={18} /> {t('play_ai_instead')}
          </button>
        </motion.div>
      )}
      <button className="btn-ghost w-full" onClick={() => navigate(-1)}>
        <X size={18} /> {t('cancel')}
      </button>
    </div>
  )
}
