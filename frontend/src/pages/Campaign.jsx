import { useRef, useState } from 'react'
import { Lock, Skull, ChevronRight } from 'lucide-react'
import { CAMPAIGN, CHAPTERS, LEVELS_PER_CHAPTER, CAMPAIGN_STAR_GOLD, MODIFIERS } from '@shared/catalog.js'
import { useStore } from '../store/app.js'
import { useT, useL } from '../lib/i18n.js'
import { haptic } from '../lib/telegram.js'
import { startCampaign } from '../lib/play.js'
import { Sheet, Stars, RewardChips, Coin, Star } from '../components/ui.jsx'
import { NavalSubHeader, NavalAction } from '../components/naval.jsx'

function ChapterArt({ chapter }) {
  return <span className="campaign-chapter-art" aria-hidden="true" style={{ '--chapter-x': chapter % 2 ? '0%' : '100%', '--chapter-y': `${Math.floor((chapter - 1) / 2) * 50}%` }} />
}

function MissionWreath() {
  return <svg className="campaign-mission-wreath" viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M43 90C15 82 7 54 20 29M57 90C85 82 93 54 80 29" stroke="currentColor" strokeWidth="2" />{[[33, 80, -50], [23, 70, -40], [18, 57, -20], [19, 43, 5]].map(([x, y, angle]) => <g key={y} fill="currentColor"><ellipse cx={x} cy={y} rx="3.5" ry="8" transform={`rotate(${angle} ${x} ${y})`} /><ellipse cx={100 - x} cy={y} rx="3.5" ry="8" transform={`rotate(${-angle} ${100 - x} ${y})`} /></g>)}</svg>
}

export default function Campaign() {
  const t = useT()
  const l = useL()
  const p = useStore((s) => s.profile)
  const [sel, setSel] = useState(null)
  const unlocked = (n) => n === 1 || !!p.campaign[n - 1]
  const next = CAMPAIGN.find((level) => unlocked(level.n) && !p.campaign[level.n])
  const [chapterId, setChapterId] = useState(() => next?.chapter || CHAPTERS.at(-1).id)
  const top = useRef(null)
  const chapter = CHAPTERS.find((ch) => ch.id === chapterId)
  const levels = CAMPAIGN.filter((level) => level.chapter === chapterId)
  const completed = levels.filter((level) => p.campaign[level.n]).length
  const current = levels.find((level) => unlocked(level.n) && !p.campaign[level.n])
  const target = current || levels.at(-1)
  const total = Object.values(p.campaign).reduce((a, b) => a + b, 0)
  const chooseMission = (level) => { if (unlocked(level.n)) { haptic.light(); setSel(level) } }

  return (
    <div className="naval-screen naval-campaign" ref={top}>
      <NavalSubHeader title={t('campaign')} right={<span className="campaign-total"><Star filled size={19} />{total} / {CAMPAIGN.length * 3}</span>} />
      <section className="naval-panel campaign-chapter-banner">
        <ChapterArt chapter={chapterId} /><div className="campaign-banner-copy"><span>{t('chapter', { n: chapter.id })}</span><h2>{l(chapter.name)}</h2><p>{t('expedition_missions_done', { n: completed, total: levels.length })}</p></div>
      </section>
      <section className="naval-panel campaign-chart" aria-label={t('expedition_mission_map')}>
        <ChapterArt chapter={chapterId} />
        <svg className="campaign-route" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true"><path d="M100 190H900C1000 190 1000 450 900 450H100" vectorEffect="non-scaling-stroke" /></svg>
        {levels.map((level, i) => {
          const open = unlocked(level.n)
          const stars = p.campaign[level.n] || 0
          const col = i < 5 ? i : 9 - i
          const active = current?.n === level.n
          return <button key={level.n} disabled={!open} className={`campaign-mission ${active ? 'is-current' : ''} ${stars ? 'is-complete' : ''} ${!open ? 'is-locked' : ''}`} style={{ left: `${10 + col * 20}%`, top: i < 5 ? '31.67%' : '75%' }} onClick={() => chooseMission(level)} aria-label={`${t('mission', { n: level.n })}${level.boss ? ` · ${t('boss')}` : ''}, ${stars}/3`}>
            <span className="campaign-mission-number">{level.n}<MissionWreath />{!open ? <Lock className="campaign-node-lock" size={12} /> : level.boss ? <Skull className="campaign-node-lock" size={12} /> : null}</span>
            {active ? <span className="campaign-next-label">{t('expedition_next')}</span> : <Stars n={stars} size={11} />}
            {Object.keys(level.mods).length > 0 && <span className="campaign-modifier-dot" title={Object.keys(level.mods).map((key) => l(MODIFIERS[key].name)).join(', ')} aria-label={t('mission_rules')} />}
          </button>
        })}
      </section>
      <button className="naval-panel campaign-continue" onClick={() => chooseMission(target)}>
        <span className="campaign-continue-copy"><strong>{t('mission', { n: target.n })}</strong><small>{t(current ? 'expedition_continue_journey' : 'expedition_replay_hint')}</small></span><span className="naval-button">{t(current ? 'expedition_continue' : 'expedition_replay')}<ChevronRight size={16} /></span>
      </button>
      <div className="campaign-other-chapters">
        {CHAPTERS.filter((ch) => ch.id !== chapterId).map((ch) => {
          const first = (ch.id - 1) * LEVELS_PER_CHAPTER + 1
          const available = unlocked(first)
          const stars = CAMPAIGN.filter((level) => level.chapter === ch.id).reduce((n, level) => n + (p.campaign[level.n] || 0), 0)
          return <button key={ch.id} disabled={!available} className={`naval-panel campaign-chapter-preview ${available ? '' : 'is-locked'}`} onClick={() => { setChapterId(ch.id); top.current?.scrollIntoView({ block: 'start' }) }}>
            <ChapterArt chapter={ch.id} /><span className="campaign-banner-copy"><span>{t('chapter', { n: ch.id })}</span><strong>{l(ch.name)}</strong><small>{available ? <><Star filled size={12} />{stars} / {LEVELS_PER_CHAPTER * 3}<ChevronRight size={14} /></> : <><Lock size={13} />{t('expedition_after_mission', { n: first - 1 })}</>}</small></span>
          </button>
        })}
      </div>
      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel ? `${t('mission', { n: sel.n })}${sel.boss ? ` · ${t('boss')}` : ''}` : ''}>
        {sel && (
          <div className="expedition-mission-sheet">
            <div className="mb-4 flex items-center justify-between rounded-2xl bg-white/[0.05] p-3">
              <span className="text-sm text-slate-400">{t('opponent')}</span>
              <span className="font-bold">{t(`diff_${sel.ai}`)}</span>
            </div>
            {Object.keys(sel.mods).length > 0 && (
              <div className="mb-4 rounded-2xl bg-amber-400/[0.07] p-3 ring-1 ring-amber-300/25">
                <div className="label mb-2 text-amber-200">{t('mission_rules')}</div>
                <div className="space-y-2">
                  {Object.entries(sel.mods).map(([k, v]) => (
                    <div key={k} className="flex items-start gap-2.5">
                      <span className="text-xl leading-none">{MODIFIERS[k].icon}</span>
                      <div>
                        <div className="text-sm font-bold">{l(MODIFIERS[k].name)}</div>
                        <div className="text-xs text-slate-400">{l(MODIFIERS[k].desc).replace('{n}', v)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-4 space-y-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3">
                  <Stars n={n} size={14} />
                  <span className="flex-1 text-sm">{t(`stars_goal_${n}`, { n: n === 2 ? sel.shots2 : sel.shots3 })}</span>
                  {(p.campaign[sel.n] || 0) >= n ? <span className="text-emerald-300">✓</span> : <span className="flex items-center gap-1 text-xs font-bold text-amber-200"><Coin size={12} />{CAMPAIGN_STAR_GOLD}</span>}
                </div>
              ))}
            </div>
            {!p.campaign[sel.n] && (
              <div className="mb-4">
                <div className="label mb-2">{t('first_clear')}</div>
                <RewardChips reward={sel.reward} />
              </div>
            )}
            <NavalAction
              className="naval-button expedition-start"
              onClick={async () => {
                haptic.medium()
                await startCampaign(sel.n)
              }}
            >
              {t('start')}
            </NavalAction>
          </div>
        )}
      </Sheet>
    </div>
  )
}
