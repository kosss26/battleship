import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, ChevronRight } from 'lucide-react'
import { seasonInfo, RANKS, SEASON_REWARDS, SEASON_TOP_BONUS, SEASON_TOP, SEASON_MIN_GAMES } from '@shared/catalog.js'
import { useT, useL, formatLeft } from '../lib/i18n.js'
import { Sheet, RewardChips, Progress, Avatar } from './ui.jsx'
import { FRAMES } from '@shared/catalog.js'

export const useSeason = () => seasonInfo()

/** Season emblem: themed gradient tile with the season icon */
export function SeasonEmblem({ season, size = 48 }) {
  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${season.color}, ${season.to})`, boxShadow: `0 0 18px -4px ${season.color}` }}
    >
      <div className="shine absolute inset-0 opacity-60" />
      <span style={{ fontSize: size * 0.5 }}>{season.icon}</span>
    </div>
  )
}

/** Compact season line used inside the ranked hero card */
export function SeasonChip() {
  const t = useT()
  const l = useL()
  const s = useSeason()
  return (
    <span className="chip text-ink-950" style={{ background: `linear-gradient(90deg, ${s.color}, ${s.to})` }}>
      {s.icon} {t('season_n', { n: s.number })} · {l(s.name)}
    </span>
  )
}

/** Big banner for the leaderboard */
export function SeasonBanner({ progress }) {
  const t = useT()
  const l = useL()
  const s = useSeason()
  const [open, setOpen] = useState(false)
  const games = progress?.games ?? 0
  const qualified = games >= SEASON_MIN_GAMES
  return (
    <>
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen(true)}
        className="relative mb-4 w-full overflow-hidden rounded-[26px] p-4 text-left ring-1 ring-white/10"
        style={{ background: `linear-gradient(135deg, ${s.color}33, ${s.to}22 60%, transparent), #0a1428` }}
      >
        <div className="pointer-events-none absolute -right-6 -top-8 text-[110px] opacity-20">{s.icon}</div>
        <div className="relative flex items-center gap-3">
          <SeasonEmblem season={s} />
          <div className="min-w-0 flex-1">
            <div className="label" style={{ color: s.color }}>{t('season_n', { n: s.number })} · {t('season_ends_in', { t: formatLeft(s.endsAt, t) })}</div>
            <div className="truncate font-display text-lg font-bold">{l(s.name)}</div>
          </div>
          <span className="flex items-center gap-1 text-xs font-bold text-slate-300"><Trophy size={14} /> <ChevronRight size={16} /></span>
        </div>
        {progress && (
          <div className="relative mt-3">
            <div className="mb-1 flex justify-between text-[11px] font-bold">
              <span className={qualified ? 'text-emerald-300' : 'text-slate-400'}>{qualified ? `✓ ${t('season_qualified')}` : t('season_progress', { a: games, b: SEASON_MIN_GAMES })}</span>
              <span className="text-slate-500">{t('season_rewards')} →</span>
            </div>
            {!qualified && <Progress value={games} max={SEASON_MIN_GAMES} height="h-1.5" />}
          </div>
        )}
      </motion.button>
      <SeasonRewardsSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function SeasonRewardsSheet({ open, onClose }) {
  const t = useT()
  const l = useL()
  const s = useSeason()
  const frameName = (id) => l(FRAMES.find((f) => f.id === id)?.name)
  return (
    <Sheet open={open} onClose={onClose} title={t('season_rewards')} tall>
      <div className="mb-4 flex items-center gap-3">
        <SeasonEmblem season={s} size={44} />
        <div>
          <div className="font-extrabold">{t('season_n', { n: s.number })} · {l(s.name)}</div>
          <div className="text-xs text-slate-400">{t('season_ends_in', { t: formatLeft(s.endsAt, t) })}</div>
        </div>
      </div>
      <p className="mb-4 text-xs text-slate-400">{t('season_rewards_sub', { n: SEASON_MIN_GAMES })}</p>
      <div className="mb-3 rounded-2xl p-3 ring-1 ring-amber-300/40" style={{ background: 'linear-gradient(120deg, rgba(251,191,36,0.15), rgba(168,85,247,0.1))' }}>
        <div className="mb-2 flex items-center gap-3">
          <Avatar name="TOP" frame="frame_legend" size={40} />
          <div className="flex-1">
            <div className="text-sm font-extrabold text-amber-200">🏆 {t('season_top_bonus', { n: SEASON_TOP })}</div>
            <div className="text-[11px] text-slate-400">{frameName('frame_legend')}</div>
          </div>
        </div>
        <RewardChips reward={{ gems: SEASON_TOP_BONUS.gems }} />
      </div>
      <div className="space-y-2">
        {[...RANKS].reverse().map((r) => {
          const reward = SEASON_REWARDS[r.id]
          return (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-xl">{r.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{l(r.name)} <span className="text-[11px] font-semibold text-slate-500">{r.min ? `${r.min}+` : ''}</span></div>
                <div className="mt-1"><RewardChips reward={{ gold: reward.gold, gems: reward.gems }} /></div>
              </div>
              {reward.cosmetics && <Avatar name={r.name.ru} frame={reward.cosmetics[0]} size={34} />}
            </div>
          )
        })}
      </div>
      <p className="mt-4 text-[11px] text-slate-500">ℹ️ {t('season_reset_note')}</p>
    </Sheet>
  )
}
