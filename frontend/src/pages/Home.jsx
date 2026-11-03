import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bot, Map, Swords, Users, ChevronRight, Gift, Zap } from 'lucide-react'
import { useStore } from '../store/app.js'
import { useT, useL } from '../lib/i18n.js'
import { haptic } from '../lib/telegram.js'
import { sfx } from '../lib/sound.js'
import { startAi } from '../lib/play.js'
import { Avatar, Coin, Gem, Progress, RankBadge, Sheet, fmt, RewardChips, Stars } from '../components/ui.jsx'
import { MATCH_REWARDS, QUESTS, PASS_XP_PER_TIER, PASS_TIERS, DAILY_REWARDS, CAMPAIGN } from '@shared/catalog.js'
import { buyStars } from './Shop.jsx'

export function TopBar() {
  const p = useStore((s) => s.profile)
  const navigate = useNavigate()
  return (
    <div className="mb-5 flex items-center gap-3">
      <button onClick={() => navigate('/profile')} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="relative">
          <Avatar photo={p.photo} name={p.name} frame={p.equipped.frame} size={46} />
          <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-400 px-1 text-[10px] font-black text-ink-950 ring-2 ring-ink-900">
            {p.level}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-extrabold">{p.name}</div>
          <Progress value={p.levelXp} max={p.levelXpNeeded} className="mt-1.5 max-w-[120px]" height="h-1.5" />
        </div>
      </button>
      <Wallet />
    </div>
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

function ModeCard({ icon: Icon, title, sub, color, onClick, children, wide = false }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={() => {
        sfx.tap()
        haptic.light()
        onClick()
      }}
      className={`glass relative flex overflow-hidden p-4 text-left ${wide ? 'w-full flex-row items-center gap-3' : 'flex-col items-start'}`}
    >
      <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${color} opacity-25 blur-2xl`} />
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${color} text-ink-950 ${wide ? '' : 'mb-3'}`}>
        <Icon size={22} strokeWidth={2.4} />
      </div>
      <div className="flex-1">
        <div className="text-[15px] font-extrabold">{title}</div>
        <div className="text-xs text-slate-400">{sub}</div>
        {children}
      </div>
      {wide && <ChevronRight className="text-slate-500" size={20} />}
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

  const cleared = Object.keys(p.campaign).length
  const stars = Object.values(p.campaign).reduce((a, b) => a + b, 0)
  const tier = Math.min(PASS_TIERS, Math.floor(p.pass.xp / PASS_XP_PER_TIER))
  const daily = DAILY_REWARDS[p.daily.nextIndex]

  return (
    <div>
      <TopBar />

      {/* Ranked hero */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative mb-3 overflow-hidden rounded-[30px] border border-cyan-300/20 p-5" style={{ background: 'linear-gradient(145deg, #0e2a4a 0%, #0a1830 55%, #0b1226 100%)' }}>
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 opacity-70">
          <div className="absolute inset-0 rounded-full border border-cyan-300/25" />
          <div className="absolute inset-8 rounded-full border border-cyan-300/20" />
          <div className="absolute inset-16 rounded-full border border-cyan-300/15" />
          <div className="absolute inset-0 animate-sweep rounded-full" style={{ background: 'conic-gradient(from 0deg, rgba(34,211,238,0.35), transparent 22%)' }} />
          <div className="absolute left-[30%] top-[62%] h-2 w-2 animate-pulse rounded-full bg-rose-400 shadow-[0_0_10px_#fb7185]" />
        </div>
        <div className="relative">
          <div className="mb-3 flex items-center gap-2">
            <RankBadge rating={p.rating} />
            <span className="chip bg-cyan-300/10 text-cyan-200"><Zap size={12} />{p.rating}</span>
          </div>
          <h2 className="h-display mb-1 text-[26px] leading-tight">{t('ranked')}</h2>
          <p className="mb-5 max-w-[220px] text-sm text-slate-300/80">{t('ranked_sub')}</p>
          <button
            className="btn-primary shine w-full text-base"
            onClick={() => {
              haptic.medium()
              navigate('/search')
            }}
          >
            <Swords size={20} strokeWidth={2.6} />
            {t('to_battle')}
          </button>
        </div>
      </motion.div>

      {/* Modes */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        <ModeCard icon={Bot} title={t('vs_ai')} sub={t('vs_ai_sub')} color="from-emerald-300 to-teal-500" onClick={() => setAiOpen(true)} />
        <ModeCard icon={Map} title={t('campaign')} sub={t('campaign_sub', { n: cleared })} color="from-amber-300 to-orange-500" onClick={() => navigate('/campaign')}>
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-amber-200">⭐ {stars}/{CAMPAIGN.length * 3}</div>
        </ModeCard>
      </div>
      <ModeCard wide icon={Users} title={t('with_friend')} sub={t('with_friend_sub')} color="from-fuchsia-400 to-violet-500" onClick={() => navigate('/duel')} />

      {/* Daily */}
      {!p.daily.claimedToday && (
        <motion.button
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => mutate('/me/daily')}
          className="relative mt-3 flex w-full items-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-r from-amber-400/20 to-orange-500/10 p-4 text-left ring-1 ring-amber-300/30"
        >
          <div className="flex h-12 w-12 animate-float items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500"><Gift className="text-ink-950" /></div>
          <div className="flex-1">
            <div className="font-extrabold">{t('daily_bonus')}</div>
            <div className="mt-1"><RewardChips reward={daily} /></div>
          </div>
          <span className="btn-sm bg-amber-300 text-ink-950">{t('claim')}</span>
        </motion.button>
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

      <AiSheet open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  )
}

export { Stars }
