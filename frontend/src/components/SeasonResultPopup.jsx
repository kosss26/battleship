import { useState } from 'react'
import { seasonInfo, RANKS } from '@shared/catalog.js'
import { useStore } from '../store/app.js'
import { useT, useL } from '../lib/i18n.js'
import { Modal, RewardChips, Spinner } from './ui.jsx'
import { SeasonEmblem, RankMedal } from './Season.jsx'

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
    <Modal open label={t('season_results')}>
      <section className="season-result">
        <div className="season-result-topline"><span>BATTLESHIP</span><span>{t('season_n', {n:season.number})}</span></div>
        <div className="season-result-emblem"><SeasonEmblem season={season} size={62}/></div>
        <p className="naval-modal-kicker">{t('season_results')}</p>
        <h2>{l(season.name)}</h2>
        <div className="season-result-rank"><RankMedal rank={rank} size={74}/><strong>{l(rank.name)}</strong></div>
        <div className="season-result-stats">
          <div><strong>{result.rating}</strong><span>{t('season_result_rating')}</span></div>
          <div><strong>{result.place?`#${result.place}`:'—'}</strong><span>{t('season_result_place')}</span></div>
        </div>
        <div className="season-result-reward"><small>{t('rewards')}</small><RewardChips reward={result.reward} size="lg" /></div>
        <button className="btn-gold relative w-full" disabled={busy} onClick={claim}>
          {busy ? <Spinner size={20} /> : t('claim')}
        </button>
      </section>
    </Modal>
  )
}
