import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, ChevronRight, Anchor, Sparkles, CloudLightning, Skull, Snowflake, Flame, Waves, TreePalm, Sunset, Moon, Compass } from 'lucide-react'
import { seasonInfo, RANKS, SEASON_REWARDS, SEASON_TOP_BONUS, SEASON_TOP, SEASON_MIN_GAMES } from '@shared/catalog.js'
import { useT, useL, formatLeft } from '../lib/i18n.js'
import { Sheet, RewardChips, Progress, Avatar } from './ui.jsx'
import { FRAMES } from '@shared/catalog.js'
import { NavalMedal } from './NavalIdentity.jsx'
import '../styles/naval-season.css'

export const useSeason = () => seasonInfo()

/** Season emblem: themed gradient tile with the season icon */
export function SeasonEmblem({ season, size = 48 }) {
  const Icon=({'🌌':Sparkles,'⛈️':CloudLightning,'🏴‍☠️':Skull,'🧊':Snowflake,'🌋':Flame,'🐙':Waves,'🏝️':TreePalm,'🌅':Sunset,'⚓':Anchor,'🌕':Moon,'🐉':Compass,'❄️':Snowflake})[season.icon]||Anchor
  return (
    <span className="season-emblem" style={{width:size,height:size,'--season-accent':season.color}} aria-hidden="true"><svg viewBox="0 0 100 100"><path d="m50 3 36 20v48L50 97 14 71V23Z" fill="#102d3f" stroke="#779fae" strokeWidth="2"/><path d="m50 10 29 17v41L50 89 21 68V27Z" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth="1"/><path d="M31 28h38M34 73h32" stroke="#9fc6cf" strokeOpacity=".4"/></svg><Icon size={size*.43} strokeWidth={1.5}/></span>
  )
}

export function RankMedal({rank,size=54}) {
  const type=rank.id==='recruit'?'anchor':rank.id==='sailor'?'compass':['bosun','lieutenant'].includes(rank.id)?'target':'star'
  return <span className="season-rank-medal" style={{width:size,height:size}}><NavalMedal type={type} tone={rank.min>=1600?'gold':'silver'}/></span>
}

/** Compact season line used inside the ranked hero card */
export function SeasonChip() {
  const t = useT()
  const l = useL()
  const s = useSeason()
  return (
    <span className="season-chip">
      <SeasonEmblem season={s} size={21}/><span>{t('season_n', { n: s.number })} · {l(s.name)}</span>
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
        className="season-banner relative mb-4 w-full overflow-hidden p-4 text-left"
      >
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

export function SeasonRewardsSheet({ open, onClose, progress }) {
  const t = useT()
  const l = useL()
  const s = useSeason()
  const frameName = (id) => l(FRAMES.find((f) => f.id === id)?.name)
  return (
    <Sheet open={open} onClose={onClose} title={t('season_rewards')} tall>
      <section className="season-summary">
        <SeasonEmblem season={s} size={58} />
        <div>
          <small>{t('season_n', { n: s.number })}</small><h4>{l(s.name)}</h4>
          <p>{t('season_ends_in', { t: formatLeft(s.endsAt, t) })}</p>
        </div>
      </section>
      <p className="mb-4 text-xs text-slate-400">{t('season_rewards_sub', { n: SEASON_MIN_GAMES })}</p>
      {progress && <div className="mb-4 rounded-2xl bg-white/[0.04] p-3">
        <p className={`mb-2 text-xs font-bold ${progress.games >= SEASON_MIN_GAMES ? 'text-emerald-300' : 'text-slate-300'}`}>{progress.games >= SEASON_MIN_GAMES ? `✓ ${t('season_qualified')}` : t('season_progress', { a: progress.games ?? 0, b: SEASON_MIN_GAMES })}</p>
        <Progress value={progress.games ?? 0} max={SEASON_MIN_GAMES} height="h-1.5" />
      </div>}
      <div className="season-top-reward">
        <div className="mb-2 flex items-center gap-3">
          <NavalMedal type="star" tone="gold" className="season-top-medal"/>
          <div className="flex-1">
            <div className="text-sm font-extrabold text-amber-200">{t('season_top_bonus', { n: SEASON_TOP })}</div>
            <div className="text-[11px] text-slate-400">{frameName('frame_legend')}</div>
          </div>
        </div>
        <RewardChips reward={{ gems: SEASON_TOP_BONUS.gems }} />
      </div>
      <div className="season-rank-list">
        {[...RANKS].reverse().map((r) => {
          const reward = SEASON_REWARDS[r.id]
          return (
            <div key={r.id} className="season-rank-row">
              <RankMedal rank={r} size={46}/>
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
