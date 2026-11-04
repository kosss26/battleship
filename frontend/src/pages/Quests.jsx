import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Lock, Check, Crown } from 'lucide-react'
import { QUESTS, DAILY_REWARDS, PASS_TIERS, PASS_XP_PER_TIER, passRewards, PASS_PREMIUM_GEMS } from '@shared/catalog.js'
import { useStore } from '../store/app.js'
import { useT, useL, formatLeft } from '../lib/i18n.js'
import { Progress, RewardChips, Gem, Coin } from '../components/ui.jsx'
import { buyStars } from './Shop.jsx'
import { Wallet } from './Home.jsx'

const tomorrow = () => {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString()
}

function RewardIcon({ reward }) {
  if (!reward) return null
  if (reward.cosmetics?.length) return <span className="text-2xl">🎨</span>
  if (reward.gems) return <div className="flex flex-col items-center"><Gem size={22} /><span className="text-[11px] font-black">{reward.gems}</span></div>
  if (reward.gold) return <div className="flex flex-col items-center"><Coin size={22} /><span className="text-[11px] font-black">{reward.gold}</span></div>
  if (reward.boosters) return <span className="text-2xl">📡</span>
  return null
}

function PassTrack({ p }) {
  const t = useT()
  const mutate = useStore((s) => s.mutate)
  const tier = Math.min(PASS_TIERS, Math.floor(p.pass.xp / PASS_XP_PER_TIER))
  const scroller = useRef(null)

  useEffect(() => {
    const el = scroller.current?.querySelector(`[data-tier="${Math.max(1, tier)}"]`)
    el?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cell = (n, track) => {
    const rewards = passRewards(n)[track === 'free' ? 'free' : 'premium']
    const unlocked = n <= tier
    const claimed = (track === 'free' ? p.pass.free : p.pass.prem).includes(n)
    const needPremium = track === 'premium' && !p.pass.premium
    const claimable = unlocked && !claimed && !needPremium
    return (
      <motion.button
        whileTap={{ scale: 0.93 }}
        disabled={!claimable}
        onClick={() => mutate('/me/pass/claim', { tier: n, track })}
        className={`relative flex h-[76px] w-[68px] flex-col items-center justify-center rounded-2xl ${
          track === 'premium' ? 'bg-gradient-to-b from-amber-300/15 to-fuchsia-500/10 ring-1 ring-amber-300/20' : 'bg-white/[0.05]'
        } ${claimable ? 'ring-2 !ring-emerald-300 shadow-[0_0_16px_-4px_#34d399]' : ''} ${!unlocked ? 'opacity-50' : ''}`}
      >
        <RewardIcon reward={rewards} />
        {claimed && <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-ink-950/60"><Check className="text-emerald-300" /></div>}
        {needPremium && <Lock size={12} className="absolute right-1.5 top-1.5 text-amber-300" />}
      </motion.button>
    )
  }

  return (
    <div ref={scroller} className="-mx-4 overflow-x-auto px-4 pb-1">
      <div className="flex gap-2">
        {Array.from({ length: PASS_TIERS }, (_, i) => i + 1).map((n) => (
          <div key={n} data-tier={n} className="flex flex-col items-center gap-2">
            {cell(n, 'free')}
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${n <= tier ? 'bg-emerald-300 text-ink-950' : 'bg-white/10 text-slate-400'}`}>{n}</div>
            {cell(n, 'premium')}
          </div>
        ))}
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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="h-display text-[22px]">{t('quests_title')}</h1>
        <Wallet />
      </div>

      {/* Daily login */}
      <div className="glass mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-extrabold">{t('daily_rewards')}</span>
          <span className="text-xs text-slate-400">🔥 {p.daily.streak}</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {DAILY_REWARDS.map((r, i) => {
            const done = p.daily.claimedToday ? i <= (p.daily.streak - 1) % DAILY_REWARDS.length : i < p.daily.nextIndex
            const today = !p.daily.claimedToday && i === p.daily.nextIndex
            return (
              <button
                key={i}
                disabled={!today}
                onClick={() => mutate('/me/daily')}
                className={`relative flex aspect-[3/4] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-bold ${
                  today ? 'bg-gradient-to-b from-amber-300 to-orange-500 text-ink-950 shadow-gold' : done ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/[0.05] text-slate-400'
                } ${i === 6 && !today ? 'ring-1 ring-fuchsia-300/40' : ''}`}
              >
                <span>{t('day_n', { n: i + 1 })}</span>
                <span className="text-base">{done ? '✓' : r.gems ? '💎' : r.boosters && !r.gold ? '📡' : '🪙'}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Quests */}
      <div className="glass mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-extrabold">{t('today_quests')}</span>
          <span className="text-xs text-slate-400">{t('quests_reset', { t: formatLeft(tomorrow(), t) })}</span>
        </div>
        <div className="space-y-3">
          {p.quests.map((q) => {
            const def = QUESTS.find((d) => d.id === q.id)
            if (!def) return null
            const done = q.progress >= def.target
            return (
              <div key={q.id} className={`rounded-2xl p-3 ${done && !q.claimed ? 'bg-emerald-400/10 ring-1 ring-emerald-300/30' : 'bg-white/[0.03]'}`}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="text-sm font-bold">{l(def.title)}</div>
                  {q.claimed ? (
                    <span className="chip bg-white/5 text-slate-400"><Check size={12} /> {t('claimed')}</span>
                  ) : done ? (
                    <button className="btn-sm bg-emerald-400 text-ink-950" onClick={() => mutate(`/me/quests/${q.id}/claim`)}>{t('claim')}</button>
                  ) : (
                    <span className="text-xs font-bold text-slate-400">{q.progress}/{def.target}</span>
                  )}
                </div>
                <Progress value={q.progress} max={def.target} height="h-1.5" color={done ? 'from-emerald-300 to-emerald-500' : undefined} />
                <div className="mt-2"><RewardChips reward={def.reward} /></div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Battle pass */}
      <div className="glass mb-4 overflow-hidden p-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-display text-base font-bold">{t('season_pass')}</span>
          <span className="text-xs text-slate-400">{t('pass_ends', { t: formatLeft(p.pass.endsAt, t) })}</span>
        </div>
        <div className="mb-3 flex items-center gap-3">
          <span className="text-sm font-bold text-emerald-300">{t('tier', { n: tier })}</span>
          <Progress value={tier >= PASS_TIERS ? 1 : p.pass.xp % PASS_XP_PER_TIER} max={tier >= PASS_TIERS ? 1 : PASS_XP_PER_TIER} className="flex-1" color="from-emerald-300 to-cyan-400" />
          <span className="text-xs text-slate-400">{p.pass.xp % PASS_XP_PER_TIER}/{PASS_XP_PER_TIER}</span>
        </div>
        <div className="mb-2 flex justify-between text-[11px] font-bold uppercase tracking-wider">
          <span className="text-slate-400">{t('free')}</span>
          <span className="flex items-center gap-1 text-amber-300"><Crown size={12} /> {t('premium')}</span>
        </div>
        <PassTrack p={p} />
        {!p.pass.premium && (
          <div className="mt-4 rounded-3xl bg-gradient-to-br from-amber-300/20 via-fuchsia-500/10 to-transparent p-4 ring-1 ring-amber-300/30">
            <div className="mb-1 flex items-center gap-2 font-extrabold"><Crown size={18} className="text-amber-300" /> {t('get_premium')}</div>
            <p className="mb-3 text-xs text-slate-300">{t('premium_perks')}</p>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-gold h-12" onClick={() => buyStars('pass_premium')}>⭐ 299</button>
              <button className="btn-ghost" onClick={() => mutate('/me/shop/buy', { itemId: 'pass:premium' })}>
                <Gem size={16} /> {PASS_PREMIUM_GEMS}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
