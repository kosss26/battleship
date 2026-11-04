import { useEffect, useState } from 'react'
import { Trophy, CalendarDays, ChevronRight } from 'lucide-react'
import { seasonInfo } from '@shared/catalog.js'
import { api } from '../lib/api.js'
import { useStore } from '../store/app.js'
import { useT, useL, formatLeft } from '../lib/i18n.js'
import { Spinner, Empty, fmt } from '../components/ui.jsx'
import { SeasonRewardsSheet } from '../components/Season.jsx'
import { NavalWordmark, NavalTabs } from '../components/naval.jsx'
import { CaptainAvatar, NavalRank, NavalMedal } from '../components/NavalIdentity.jsx'

export default function Leaderboard() {
  const t = useT()
  const l = useL()
  const p = useStore((s) => s.profile)
  const [type, setType] = useState('rating')
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [rewards, setRewards] = useState(false)
  const season = seasonInfo()

  useEffect(() => {
    let alive = true
    setData(null)
    setError(false)
    api(`/leaderboard?type=${type}`).then((d) => { if (alive) setData(d) }).catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [type, retry])

  const entries = data?.entries || []
  const top = entries.slice(0, 3)
  const score = (e) => type === 'weekly' ? e.score : e.rating
  return (
    <div className="naval-screen naval-leaderboard">
      <header className="identity-heading"><NavalWordmark compact /><h1>{t('leaderboard')}</h1></header>
      <button className="naval-panel identity-season" onClick={() => setRewards(true)} aria-label={t('season_rewards')}>
        <NavalMedal type="compass" tone="gold" />
        <span className="identity-season-copy"><span>{t('season_n', { n: season.number })}</span><strong>{l(season.name)}</strong><small><CalendarDays size={12} />{t('season_ends_in', { t: formatLeft(season.endsAt, t) })}</small></span>
        <ChevronRight size={16} className="identity-season-chevron" />
      </button>
      <NavalTabs className="identity-leaderboard-tabs" value={type} onChange={setType} label={t('leaderboard')} options={[
        { value: 'rating', label: t('identity_global') }, { value: 'weekly', label: t('identity_week') }, { value: 'friends', label: t('lb_friends') },
      ]} />
      <section className="identity-standings" aria-live="polite" aria-busy={!data && !error}>
        {error ? <div className="identity-empty naval-panel"><p>{t('error_generic')}</p><button className="naval-button" onClick={() => setRetry((v) => v + 1)}>{t('retry')}</button></div> : !data ? <div className="identity-empty"><Spinner /></div> : !entries.length ? <Empty icon="⚓" text={t('empty_lb')} /> : <>
          <div className="identity-podium" aria-label={t('identity_top_three')}>
            {[top[1], top[0], top[2]].map((e, i) => e ? <div key={e.id} className={`identity-podium-entry place-${i === 1 ? 1 : i === 0 ? 2 : 3}`}>
              <div className="identity-podium-avatar"><CaptainAvatar photo={e.photo} name={e.name} frame={e.frame} size={i === 1 ? 80 : 66} />{i === 1 && <svg className="identity-podium-laurel" viewBox="0 0 100 65" fill="#dcb869" aria-hidden="true"><path d="M36 56C12 53 5 34 13 15M64 56C88 53 95 34 87 15" fill="none" stroke="#dfbd70" strokeWidth="2" />{[[29, 52, -60], [19, 45, -45], [13, 35, -20], [13, 24, 5]].map(([x, y, angle]) => <g key={y}><ellipse cx={x} cy={y} rx="3.5" ry="7" transform={`rotate(${angle} ${x} ${y})`} /><ellipse cx={100 - x} cy={y} rx="3.5" ry="7" transform={`rotate(${-angle} ${100 - x} ${y})`} /></g>)}</svg>}<span className="identity-place-medal">{e.place}</span></div>
              <div className="identity-podium-plinth"><strong title={e.name}>{e.name}</strong><span><Trophy size={13} />{fmt(score(e))}</span></div>
            </div> : <div key={`empty-${i}`} aria-hidden="true" />)}
          </div>
          {entries.length > 3 && <><h2 className="identity-section-title">{t('identity_best_captains')}</h2><ol className="identity-ranking-list" start={4}>
            {entries.slice(3).map((e) => <li key={e.id} className={`naval-panel identity-ranking-row${e.me ? ' is-me' : ''}`}>
              <span className="identity-row-place">{e.place}</span><CaptainAvatar photo={e.photo} name={e.name} frame={e.frame} size={35} />
              <span className="identity-row-name"><strong title={e.name}>{e.name}</strong><small>{t('tier', { n: e.level })}</small></span>
              <span className="identity-score"><Trophy size={15} /><b>{fmt(score(e))}</b></span>
            </li>)}
          </ol></>}
          {type === 'weekly' && <p className="identity-score-note">{t('wins_week')}</p>}
        </>}
      </section>
      {data && type === 'rating' && <div className="naval-panel identity-own-place">
        <span className="identity-own-number">{data.myPlace == null ? '—' : `#${data.myPlace}`}</span><CaptainAvatar photo={p.photo} name={p.name} frame={p.equipped.frame} size={36} />
        <span className="identity-row-name"><strong>{t('your_place')}</strong><NavalRank rating={p.rating} /></span><span className="identity-score"><Trophy size={16} /><b>{fmt(p.rating)}</b></span>
      </div>}
      <SeasonRewardsSheet open={rewards} onClose={() => setRewards(false)} progress={data?.progress} />
    </div>
  )
}
