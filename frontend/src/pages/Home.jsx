import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Anchor, Swords, ChevronRight, ChevronsUp, Gift, Shield, Trophy, LoaderCircle } from 'lucide-react'
import { useStore } from '../store/app.js'
import { useT, useL } from '../lib/i18n.js'
import { haptic } from '../lib/telegram.js'
import { sfx } from '../lib/sound.js'
import { startAi } from '../lib/play.js'
import { Avatar, Coin, Gem, Progress, Sheet, fmt, RewardChips, Stars } from '../components/ui.jsx'
import { MATCH_REWARDS, QUESTS, PASS_XP_PER_TIER, PASS_TIERS, DAILY_REWARDS, CAMPAIGN, FRAMES, rankFor } from '@shared/catalog.js'
import { buyStars } from './Shop.jsx'
import { SeasonChip } from '../components/Season.jsx'
import { AdButton, useAdsEnabled } from '../components/Ads.jsx'
import { NavalWordmark, NavalWallet } from '../components/naval.jsx'

export function TopBar() {
  const t = useT()
  const p = useStore((s) => s.profile)
  const navigate = useNavigate()
  const frame = FRAMES.find((f) => f.id === p.equipped.frame)?.ring
  return (
    <header className="naval-header">
      <NavalWordmark />
      <div className="naval-player-row">
        <button onClick={() => navigate('/profile')} className="naval-player" aria-label={t('tab_profile')}>
          {p.photo ? <Avatar photo={p.photo} name={p.name} frame={p.equipped.frame} size={50} /> : (
            <span className="naval-avatar" style={frame && frame !== 'transparent' ? { background: frame } : undefined}>
              <span className="naval-art naval-art-captain" />
            </span>
          )}
          <span className="naval-player-copy">
            <strong>{p.name}</strong>
            <span><ChevronsUp size={14} aria-hidden="true" />{t('tier', { n: p.level })}</span>
          </span>
        </button>
        <NavalWallet />
      </div>
    </header>
  )
}

export function Wallet() {
  const p = useStore((s) => s.profile)
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate('/shop')} className="flex items-center gap-1.5">
      <span className="chip bg-white/[0.07] py-1.5 text-[13px] text-amber-100"><Coin size={16} />{fmt(p.gold)}</span>
      <span className="chip bg-white/[0.07] py-1.5 text-[13px] text-fuchsia-100"><Gem size={16} />{fmt(p.gems)}<span className="ml-0.5 text-cyan-300">+</span></span>
    </button>
  )
}

const DIFFS = [
  { id: 'easy', color: 'from-emerald-400 to-teal-500', icon: '🐣' },
  { id: 'medium', color: 'from-sky-400 to-blue-500', icon: '⚓' },
  { id: 'hard', color: 'from-violet-400 to-fuchsia-500', icon: '🧠' },
  { id: 'expert', color: 'from-rose-400 to-orange-500', icon: '🤖' },
]

function AiSheet({ open, onClose }) {
  const t = useT()
  const [busy, setBusy] = useState(null)
  return (
    <Sheet open={open} onClose={onClose} title={t('choose_difficulty')}>
      <div className="space-y-2.5">
        {DIFFS.map((d) => {
          const r = MATCH_REWARDS.ai[d.id].win
          return (
            <button
              key={d.id}
              disabled={!!busy}
              onClick={async () => {
                haptic.medium()
                setBusy(d.id)
                await startAi(d.id)
                setBusy(null)
              }}
              className="glass flex w-full items-center gap-3 p-3 text-left active:scale-[0.98]"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${d.color} text-2xl`}>{d.icon}</div>
              <div className="flex-1">
                <div className="font-extrabold">{t(`diff_${d.id}`)}</div>
                <div className="text-xs text-slate-400">{t(`diff_${d.id}_d`)}</div>
              </div>
              <div className="text-right">
                <div className="label mb-0.5">{t('reward_win')}</div>
                <div className="flex items-center justify-end gap-1 text-sm font-extrabold text-amber-200"><Coin size={14} />{r.gold}</div>
              </div>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

function ModeCard({ art, title, sub, onClick, wide = false }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={() => {
        sfx.tap()
        haptic.light()
        onClick()
      }}
      className={`naval-mode ${wide ? 'naval-mode-wide' : ''}`}
    >
      <span className={`naval-art naval-art-${art}`} aria-hidden="true" />
      <span className="naval-mode-copy"><strong>{title}</strong><span>{sub}</span></span>
      {wide && <ChevronRight className="naval-mode-arrow" size={22} aria-hidden="true" />}
    </motion.button>
  )
}

export default function Home() {
  const t = useT()
  const l = useL()
  const navigate = useNavigate()
  const p = useStore((s) => s.profile)
  const mutate = useStore((s) => s.mutate)
  const [aiOpen, setAiOpen] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const adsEnabled = useAdsEnabled()

  const cleared = Object.keys(p.campaign).length
  const tier = Math.min(PASS_TIERS, Math.floor(p.pass.xp / PASS_XP_PER_TIER))
  const daily = DAILY_REWARDS[p.daily.nextIndex]
  const rank = rankFor(p.rating)

  const claimDaily = async () => {
    if (claiming) return
    setClaiming(true)
    haptic.light()
    try {
      await mutate('/me/daily')
    } catch {
      // The store shows the error toast; keep the reward available for a retry.
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="naval-home">
      <TopBar />

      {/* Ranked hero */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="naval-hero" aria-labelledby="naval-hero-title">
        <img src="/art/naval/hero.webp" className="naval-hero-art" alt="" fetchPriority="high" width="1152" height="768" />
        <div className="naval-hero-shade" />
        <div className="naval-hero-heading">
          <div className="naval-eyebrow">{t('ranked')}</div>
          <h1 id="naval-hero-title">{t('home_heading')}</h1>
          <p>{t('home_subheading')}</p>
        </div>
        <div className="naval-hero-bottom">
          <button className="naval-rank" onClick={() => navigate('/top')} aria-label={`${l(rank.name)}, ${t('rating')}: ${p.rating}`}>
            <span className="naval-rank-shield"><Shield size={33} aria-hidden="true" /><Anchor size={16} aria-hidden="true" /></span>
            <strong>{l(rank.name)}</strong><span className="naval-rank-divider" /><Trophy size={16} aria-hidden="true" /><span>{fmt(p.rating)}</span>
            <ChevronRight size={15} aria-hidden="true" />
          </button>
          <button
            className="naval-battle-button"
            onClick={() => {
              haptic.medium()
              navigate('/search')
            }}
          >
            <Swords size={25} strokeWidth={2.2} aria-hidden="true" />
            {t('to_battle')}
          </button>
        </div>
      </motion.section>

      {/* Modes */}
      <section className="naval-modes" aria-labelledby="naval-modes-title">
        <h2 id="naval-modes-title">{t('home_modes')}</h2>
        <div className="naval-mode-grid">
          <ModeCard art="radar" title={t('vs_ai')} sub={t('home_ai_sub')} onClick={() => setAiOpen(true)} />
          <ModeCard art="island" title={t('campaign')} sub={t('home_campaign_sub', { n: cleared, total: CAMPAIGN.length })} onClick={() => navigate('/campaign')} />
        </div>
        <ModeCard wide art="fleet" title={t('home_friend')} sub={t('home_friend_sub')} onClick={() => navigate('/duel')} />
      </section>

      {/* Daily */}
      {!p.daily.claimedToday && (
        <motion.button
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={claimDaily}
          disabled={claiming}
          aria-busy={claiming}
          className="naval-daily"
        >
          <span className="naval-daily-icon"><Gift size={31} strokeWidth={1.7} aria-hidden="true" /></span>
          <span className="naval-daily-copy">
            <strong>{t('home_daily')}</strong>
            <span className="naval-daily-rewards"><span>{t('home_day', { n: p.daily.nextIndex + 1 })} · </span><RewardChips reward={daily} /></span>
          </span>
          <span className="naval-claim-button">{claiming ? <LoaderCircle size={17} className="animate-spin" /> : t('claim')}</span>
        </motion.button>
      )}

      <details className="naval-more">
        <summary><span>{t('home_more')}</span><ChevronRight size={17} aria-hidden="true" /></summary>
        <div className="naval-more-content">

      {/* Free gold for an ad */}
      {adsEnabled && (p.ads?.left?.gold ?? 0) > 0 && (
        <div className="glass mt-3 flex items-center gap-3 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 to-teal-500 text-2xl">📺</div>
          <div className="flex-1">
            <div className="font-extrabold">{t('ad_free_gold')}</div>
            <div className="text-xs text-slate-400">{t('ad_left', { n: p.ads.left.gold })}</div>
          </div>
          <AdButton placement="gold" compact>+100 🪙</AdButton>
        </div>
      )}

      {/* Starter offer */}
      {!p.purchases?.starter && (
        <button onClick={() => buyStars('starter')} className="relative mt-3 flex w-full items-center gap-3 overflow-hidden rounded-3xl p-4 text-left ring-1 ring-fuchsia-300/30" style={{ background: 'linear-gradient(120deg, rgba(192,132,252,0.25), rgba(56,189,248,0.12))' }}>
          <div className="shine absolute inset-0" />
          <div className="text-4xl">🎁</div>
          <div className="relative flex-1">
            <div className="font-extrabold">{t('starter_title')}</div>
            <div className="text-xs text-fuchsia-100/80">{t('starter_sub')}</div>
          </div>
          <span className="relative btn-sm bg-white text-ink-950">⭐ 99</span>
        </button>
      )}

      {/* Battle pass strip */}
      <button onClick={() => navigate('/quests')} className="glass mt-3 flex w-full items-center gap-3 p-4 text-left">
        <div className="flex h-12 w-12 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 to-cyan-500 text-ink-950">
          <span className="text-[9px] font-black leading-none">LVL</span>
          <span className="font-display text-lg font-bold leading-none">{tier}</span>
        </div>
        <div className="flex-1">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-extrabold">{t('season_pass')}</span>
            <span className="text-xs text-slate-400">{p.pass.xp % PASS_XP_PER_TIER}/{PASS_XP_PER_TIER}</span>
          </div>
          <Progress value={tier >= PASS_TIERS ? 1 : p.pass.xp % PASS_XP_PER_TIER} max={tier >= PASS_TIERS ? 1 : PASS_XP_PER_TIER} color="from-emerald-300 to-cyan-400" />
        </div>
        <ChevronRight className="text-slate-500" size={20} />
      </button>

      {/* Quests preview */}
      <div className="glass mt-3 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-extrabold">{t('today_quests')}</span>
          <button className="text-xs font-bold text-cyan-300" onClick={() => navigate('/quests')}>{t('all')}</button>
        </div>
        <div className="space-y-3">
          {p.quests.map((q) => {
            const def = QUESTS.find((d) => d.id === q.id)
            if (!def) return null
            const done = q.progress >= def.target
            return (
              <div key={q.id} className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm ${done ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/[0.06] text-slate-400'}`}>{done ? '✓' : '•'}</div>
                <div className="flex-1">
                  <div className="mb-1 flex justify-between text-[13px]">
                    <span className={q.claimed ? 'text-slate-500 line-through' : 'font-semibold'}>{l(def.title)}</span>
                    <span className="text-slate-400">{q.progress}/{def.target}</span>
                  </div>
                  <Progress value={q.progress} max={def.target} height="h-1.5" color={done ? 'from-emerald-300 to-emerald-500' : undefined} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Invite */}
      <button onClick={() => navigate('/friends')} className="glass mt-3 flex w-full items-center gap-3 p-4 text-left">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.07] text-2xl">🤝</div>
        <div className="flex-1">
          <div className="font-extrabold">{t('invite_friends')}</div>
          <div className="text-xs text-slate-400">{t('invite_sub')}</div>
        </div>
        <ChevronRight className="text-slate-500" size={20} />
      </button>

        <button className="naval-season-link" onClick={() => navigate('/top')}><SeasonChip /><ChevronRight size={17} /></button>
        </div>
      </details>

      <AiSheet open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  )
}

export { Stars }
