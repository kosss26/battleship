import { useState } from 'react'
import { Check, Lock } from 'lucide-react'
import { ACHIEVEMENTS, DEFAULT_OWNED } from '@shared/catalog.js'
import { useStore } from '../store/app.js'
import { useT, useL } from '../lib/i18n.js'
import { RewardChips, fmt } from '../components/ui.jsx'
import { NavalSubHeader, NavalTabs } from '../components/naval.jsx'
import { MedalArt, achievementMedal } from '../components/NavalIdentity.jsx'

function value(p, stat) {
  if (stat === 'peakRating') return Math.max(p.peakRating || 0, p.rating || 0)
  if (stat === 'cosmetics') return Math.max(0, p.owned.length - DEFAULT_OWNED.length)
  if (stat === 'campaignStars') return Object.values(p.campaign).reduce((a, b) => a + b, 0)
  return p.stats[stat] || 0
}

export default function Achievements() {
  const t = useT()
  const l = useL()
  const p = useStore((s) => s.profile)
  const [filter, setFilter] = useState('all')
  const done = ACHIEVEMENTS.filter((a) => p.achievements[a.id]).length
  const sorted = [...ACHIEVEMENTS].sort((a, b) => Number(!!p.achievements[b.id]) - Number(!!p.achievements[a.id]))
  const visible = sorted.filter((a) => filter === 'all' || (filter === 'earned' ? !!p.achievements[a.id] : !p.achievements[a.id]))
  return <div className="naval-screen naval-achievements">
    <NavalSubHeader title={t('achievements')} />
    <section className="naval-panel awards-banner">
      <MedalArt type="star" /><div><h2>{t('expedition_your_awards')}</h2><p>{t('expedition_awards_count', { n: done, total: ACHIEVEMENTS.length })}</p><div className="awards-progress-line"><div className="awards-progress" role="progressbar" aria-label={t('achievements')} aria-valuemin={0} aria-valuemax={ACHIEVEMENTS.length} aria-valuenow={done}><span style={{ width: `${done / ACHIEVEMENTS.length * 100}%` }} /></div><span>{done} / {ACHIEVEMENTS.length}</span></div></div>
    </section>
    <NavalTabs className="expedition-tabs" value={filter} onChange={setFilter} label={t('achievements')} options={[{ value: 'all', label: t('expedition_all') }, { value: 'earned', label: t('expedition_earned') }, { value: 'progress', label: t('expedition_in_progress') }]} />
    <div className="award-list" aria-live="polite">
      {visible.length ? visible.map((a) => {
        const earned = !!p.achievements[a.id]
        const progress = Math.max(0, Math.min(value(p, a.stat), a.goal))
        return <article key={a.id} className={`naval-panel award-row ${earned ? 'is-earned' : 'is-progress'}`}>
          <div className="award-medal"><MedalArt type={achievementMedal(a)} locked={!earned && progress === 0} />{!earned && <Lock size={12} className="award-lock" aria-label={t('identity_locked')} />}</div>
          <div className="award-body"><h2>{l(a.title)}</h2><p>{l(a.desc)}</p>{earned ? <span className="award-earned"><Check size={16} />{t('identity_unlocked')}</span> : <><span className="award-count">{fmt(progress)} / {fmt(a.goal)}</span><div className="awards-progress" role="progressbar" aria-label={l(a.title)} aria-valuemin={0} aria-valuemax={a.goal} aria-valuenow={progress}><span style={{ width: `${progress / a.goal * 100}%` }} /></div></>}</div>
          <div className="award-reward" aria-label={t('expedition_reward')}><RewardChips reward={a.reward} /></div>
        </article>
      }) : <div className="naval-panel expedition-empty"><MedalArt type="anchor" /><p>{t(filter === 'earned' ? 'expedition_no_awards' : 'expedition_all_awards')}</p></div>}
    </div>
  </div>
}
