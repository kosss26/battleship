import { useEffect, useRef } from 'react'
import { Lock, Check, Crown, Gift, Clock3, Swords, Crosshair, Ship as ShipIcon, ChevronRight } from 'lucide-react'
import { QUESTS, DAILY_REWARDS, PASS_TIERS, PASS_XP_PER_TIER, passRewards, PASS_PREMIUM_GEMS, STAR_PRODUCTS } from '@shared/catalog.js'
import { useStore } from '../store/app.js'
import { useT, useL, formatLeft } from '../lib/i18n.js'
import { Progress, RewardChips, Gem, Coin, fmt } from '../components/ui.jsx'
import { NavalHeader, NavalAction } from '../components/naval.jsx'
import { buyStars } from './Shop.jsx'

const tomorrow = () => {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString()
}

function RewardIcon({ reward }) {
  if (!reward) return null
  if (reward.cosmetics?.length) return <ShipIcon size={28} aria-hidden="true" />
  if (reward.gold && reward.gems) return <span className="naval-multi-reward"><span><Coin size={13} />{fmt(reward.gold)}</span><span><Gem size={13} />{fmt(reward.gems)}</span></span>
  if (reward.gems) return <><Gem size={22} /><span>{fmt(reward.gems)}</span></>
  if (reward.gold) return <><Coin size={22} /><span>{fmt(reward.gold)}</span></>
  if (reward.boosters) return <Crosshair size={25} aria-hidden="true" />
  return null
}

function PassTrack({ p, tier }) {
  const t = useT()
  const mutate = useStore((s) => s.mutate)
  const scroller = useRef(null)
  useEffect(() => {
    // Scroll the reward rail without jumping the entire page to the pass card.
    if (scroller.current) scroller.current.scrollLeft = Math.max(0, (tier - 1) * 70)
  }, [tier])

  const cell = (n, track) => {
    const rewards = passRewards(n)[track === 'free' ? 'free' : 'premium']
    const unlocked = n <= tier
    const claimed = (track === 'free' ? p.pass.free : p.pass.prem).includes(n)
    const needPremium = track === 'premium' && !p.pass.premium
    const claimable = unlocked && !claimed && !needPremium
    return (
      <NavalAction key={track} disabled={!claimable}
        aria-label={`${t('tier', { n })}, ${t(track === 'free' ? 'free' : 'premium')}${claimed ? `, ${t('claimed')}` : claimable ? `, ${t('claim')}` : ''}`}
        onClick={() => mutate('/me/pass/claim', { tier: n, track })}
        className={`naval-pass-cell ${track === 'premium' ? 'is-premium' : ''} ${claimable ? 'is-claimable' : ''} ${claimed ? 'is-claimed' : ''}`}>
        <RewardIcon reward={rewards} />
        {claimed && <Check className="naval-pass-check" size={14} aria-hidden="true" />}
        {(!unlocked || needPremium) && <Lock className="naval-pass-lock" size={12} aria-hidden="true" />}
      </NavalAction>
    )
  }

  return (
    <div className="naval-pass-rail">
      <div className="naval-pass-labels"><span>{t('free')}</span><span><Crown size={12} />{t('premium')}</span></div>
      <div className="naval-pass-scroller" ref={scroller} tabIndex={0} role="region" aria-label={t('season_pass')}>
        <div className="naval-pass-track">
          {Array.from({ length: PASS_TIERS }, (_, i) => i + 1).map((n) => (
            <div key={n} data-tier={n} className="naval-pass-level">
              <span className={`naval-pass-number ${n <= tier ? 'is-unlocked' : ''}`}>{n}</span>
              {cell(n, 'free')}{cell(n, 'premium')}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Quests() {
  const t = useT()
  const l = useL()
  const p = useStore((s) => s.profile)
  const mutate = useStore((s) => s.mutate)
  const tier = Math.min(PASS_TIERS, Math.floor(p.pass.xp / PASS_XP_PER_TIER))
  const premium = STAR_PRODUCTS.find((x) => x.id === 'pass_premium')
  const currentDay = p.daily.claimedToday ? (p.daily.streak - 1) % DAILY_REWARDS.length : p.daily.nextIndex

  return (
    <div className="naval-screen naval-quests">
      <NavalHeader title={t('tab_quests')} />
      <section className="naval-panel naval-daily-panel" aria-labelledby="naval-daily-title">
        <div className="naval-daily-banner">
          <Gift size={26} aria-hidden="true" />
          <div><h2 id="naval-daily-title">{t('home_daily')}</h2><p>{t('naval_daily_hint')}</p></div>
        </div>
        <div className="naval-days">
          {DAILY_REWARDS.map((reward, i) => {
            const done = p.daily.claimedToday ? i <= currentDay : i < currentDay
            const today = !p.daily.claimedToday && i === currentDay
            return (
              <div key={i} className={`naval-day ${today ? 'is-today' : ''} ${done ? 'is-done' : ''}`} aria-current={today ? 'date' : undefined}>
                <span>{i + 1}</span>
                {done ? <Check size={21} aria-hidden="true" /> : <span className="naval-day-reward"><RewardIcon reward={reward} /></span>}
              </div>
            )
          })}
        </div>
        <div className="naval-daily-footer">
          <div><span>{t('naval_day_of', { n: currentDay + 1, total: DAILY_REWARDS.length })}</span><RewardChips reward={DAILY_REWARDS[currentDay]} /></div>
          <NavalAction className="naval-button naval-button-gold" disabled={p.daily.claimedToday} onClick={() => mutate('/me/daily')}>
            {p.daily.claimedToday ? <><Check size={14} />{t('claimed')}</> : t('claim')}
          </NavalAction>
        </div>
      </section>

      <section aria-labelledby="naval-quests-title">
        <div className="naval-section-heading"><h2 id="naval-quests-title">{t('today_quests')}</h2><span><Clock3 size={13} />{t('quests_reset', { t: formatLeft(tomorrow(), t) })}</span></div>
        <div className="naval-missions">
          {p.quests.map((q) => {
            const def = QUESTS.find((d) => d.id === q.id)
            if (!def) return null
            const done = q.progress >= def.target
            const Icon = def.event === 'sunk' ? ShipIcon : def.event === 'hits' ? Crosshair : Swords
            return (
              <article key={q.id} className={`naval-panel naval-mission ${done && !q.claimed ? 'is-ready' : ''} ${q.claimed ? 'is-claimed' : ''}`}>
                <span className="naval-mission-icon"><Icon size={24} aria-hidden="true" /></span>
                <div className="naval-mission-body">
                  <div className="naval-mission-title"><h3>{l(def.title)}</h3><span>{Math.min(q.progress, def.target)}/{def.target}</span></div>
                  <Progress value={q.progress} max={def.target} height="h-1.5" color="from-cyan-300 to-cyan-500" />
                  <RewardChips reward={def.reward} />
                </div>
                {q.claimed ? <span className="naval-mission-claimed" aria-label={t('claimed')}><Check size={20} /></span> : done && (
                  <NavalAction className="naval-button naval-button-small" onClick={() => mutate(`/me/quests/${q.id}/claim`)}>{t('claim')}</NavalAction>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <section className="naval-panel naval-pass" aria-labelledby="naval-pass-title">
        <div className="naval-pass-heading">
          <div className="naval-eyebrow">{t('naval_season_rewards')}</div>
          <h2 id="naval-pass-title">{t('season_pass')}</h2>
          <div className="naval-pass-progress-label"><span>{t('tier', { n: tier })}</span><span>{tier >= PASS_TIERS ? t('naval_pass_complete') : `${p.pass.xp % PASS_XP_PER_TIER}/${PASS_XP_PER_TIER} XP`}</span></div>
          <Progress value={tier >= PASS_TIERS ? 1 : p.pass.xp % PASS_XP_PER_TIER} max={tier >= PASS_TIERS ? 1 : PASS_XP_PER_TIER} height="h-1.5" color="from-cyan-300 to-cyan-500" />
          <p className="naval-pass-expiry">{t('pass_ends', { t: formatLeft(p.pass.endsAt, t) })}</p>
        </div>
        <PassTrack p={p} tier={tier} />
        {!p.pass.premium ? (
          <details className="naval-premium">
            <summary><Crown size={18} /><span>{t('get_premium')}</span><ChevronRight size={17} /></summary>
            <p>{t('premium_perks')}</p>
            <div className="naval-premium-actions">
              <NavalAction className="naval-button naval-button-gold" onClick={() => buyStars(premium.id)}>⭐ {premium.stars}</NavalAction>
              <NavalAction className="naval-button naval-button-steel" onClick={() => mutate('/me/shop/buy', { itemId: 'pass:premium' })}><Gem size={16} />{PASS_PREMIUM_GEMS}</NavalAction>
            </div>
          </details>
        ) : <div className="naval-premium-owned"><Crown size={16} />{t('premium')}<Check size={15} /></div>}
      </section>
    </div>
  )
}
