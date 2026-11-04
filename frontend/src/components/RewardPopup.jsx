import { motion } from 'framer-motion'
import { useStore } from '../store/app.js'
import { useT, useL } from '../lib/i18n.js'
import { Modal, RewardChips } from './ui.jsx'
import { ACHIEVEMENTS } from '@shared/catalog.js'

export default function RewardPopup() {
  const t = useT()
  const l = useL()
  const reward = useStore((s) => s.reward)
  const close = useStore((s) => s.closeReward)
  const s = reward?.summary
  return (
    <Modal open={!!reward} onClose={close}>
      <div className="glass-strong relative overflow-hidden p-6 text-center">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-amber-300/25 blur-3xl" />
        <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} className="mb-2 text-6xl">
          🎁
        </motion.div>
        <div className="h-display mb-4 text-xl">{reward?.title || t('rewards')}</div>
        {s?.levelUps?.length > 0 && (
          <div className="mb-3 rounded-2xl bg-cyan-400/10 py-2 text-sm font-bold text-cyan-200">⬆️ {t('level_up', { n: s.levelUps.at(-1) })}</div>
        )}
        <div className="mb-4 flex justify-center">
          <RewardChips reward={s} size="lg" />
        </div>
        {s?.achievements?.map((id) => {
          const a = ACHIEVEMENTS.find((x) => x.id === id)
          return (
            <div key={id} className="mb-2 flex items-center gap-3 rounded-2xl bg-white/5 p-2.5 text-left">
              <span className="text-2xl">{a?.icon}</span>
              <div>
                <div className="text-[11px] font-bold uppercase text-amber-300">{t('achievement_unlocked')}</div>
                <div className="text-sm font-bold">{l(a?.title)}</div>
              </div>
            </div>
          )
        })}
        <button className="btn-primary mt-2 w-full" onClick={close}>OK</button>
      </div>
    </Modal>
  )
}
