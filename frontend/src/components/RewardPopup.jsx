import { Gift } from 'lucide-react'
import { useStore } from '../store/app.js'
import { useT, useL } from '../lib/i18n.js'
import { Modal, RewardChips } from './ui.jsx'
import { ACHIEVEMENTS } from '@shared/catalog.js'
import { MedalArt, achievementMedal } from './NavalIdentity.jsx'

export default function RewardPopup() {
  const t = useT()
  const l = useL()
  const reward = useStore((s) => s.reward)
  const close = useStore((s) => s.closeReward)
  const s = reward?.summary
  return (
    <Modal open={!!reward} onClose={close} label={reward?.title||t('rewards')}>
      <div className="naval-reward-popup">
        <div className="naval-modal-icon is-gold"><Gift size={32} strokeWidth={1.4}/></div>
        <p className="naval-modal-kicker">BATTLESHIP</p>
        <h2>{reward?.title || t('rewards')}</h2>
        {s?.levelUps?.length > 0 && (
          <div className="mb-3 rounded-2xl bg-cyan-400/10 py-2 text-sm font-bold text-cyan-200">⬆️ {t('level_up', { n: s.levelUps.at(-1) })}</div>
        )}
        <div className="mb-4 flex justify-center">
          <RewardChips reward={s} size="lg" />
        </div>
        {s?.achievements?.map((id) => {
          const a = ACHIEVEMENTS.find((x) => x.id === id)
          return (
                <div key={id} className="naval-reward-achievement">
              {a&&<MedalArt type={achievementMedal(a)}/>}
              <div>
                <small>{t('achievement_unlocked')}</small>
                <strong>{l(a?.title)}</strong>
              </div>
            </div>
          )
        })}
        <button className="btn-primary mt-2 w-full" onClick={close}>OK</button>
      </div>
    </Modal>
  )
}
