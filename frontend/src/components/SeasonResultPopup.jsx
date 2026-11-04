import { useState } from 'react'
import { motion } from 'framer-motion'
import { seasonInfo, RANKS } from '@shared/catalog.js'
import { useStore } from '../store/app.js'
import { useT, useL } from '../lib/i18n.js'
import { Modal, RewardChips, Spinner } from './ui.jsx'
import { SeasonEmblem } from './Season.jsx'

/** Shown once after a season ends: final rank, place and the reward to claim */
export default function SeasonResultPopup() {
  const t = useT()
  const l = useL()
  const result = useStore((s) => s.profile?.seasonResult)
  const inBattle = useStore((s) => !!s.game && s.game.phase !== 'over')
  const tutorial = useStore((s) => !s.profile?.onboarded || s.showTutorial)
  const mutate = useStore((s) => s.mutate)
  const [busy, setBusy] = useState(false)
  if (!result || inBattle || tutorial) return null
  const season = seasonInfo(result.season)
  const rank = RANKS.find((r) => r.id === result.rank) || RANKS[0]

  const claim = async () => {
    setBusy(true)
    await mutate('/me/season/claim', { season: result.season }).catch(() => {})
    setBusy(false)
  }

  return (
    <Modal open>
      <div className="relative overflow-hidden rounded-[28px] p-6 text-center ring-1 ring-white/10" style={{ background: `linear-gradient(160deg, ${season.color}40, #0a1428 55%)` }}>
        <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full blur-3xl" style={{ background: `${season.color}55` }} />
        <div className="relative mb-3 flex justify-center"><SeasonEmblem season={season} size={56} /></div>
        <div className="label relative" style={{ color: season.color }}>{t('season_results')} · {t('season_n', { n: season.number })}</div>
        <div className="relative mb-4 font-display text-xl font-bold">{l(season.name)}</div>
        <motion.div initial={{ scale: 0.5, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 12 }} className="relative mb-2 text-6xl">
          {rank.icon}
        </motion.div>
        <div className="relative font-display text-2xl font-bold">{l(rank.name)}</div>
        <div className="relative mb-4 text-sm text-slate-300">
          {result.place ? t('season_place', { n: result.place }) : ''} · {t('season_final_rating')}: <b>{result.rating}</b>
        </div>
        <div className="relative mb-5 flex justify-center"><RewardChips reward={result.reward} size="lg" /></div>
        <button className="btn-gold relative w-full" disabled={busy} onClick={claim}>
          {busy ? <Spinner size={20} /> : t('claim')}
        </button>
      </div>
    </Modal>
  )
}
