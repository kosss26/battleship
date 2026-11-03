import { ACHIEVEMENTS, DEFAULT_OWNED } from '@shared/catalog.js'
import { useStore } from '../store/app.js'
import { useT, useL } from '../lib/i18n.js'
import { PageHeader, Progress, RewardChips } from '../components/ui.jsx'

function value(p, stat) {
  if (stat === 'peakRating') return Math.max(p.peakRating, p.rating)
  if (stat === 'cosmetics') return p.owned.length - DEFAULT_OWNED.length
  if (stat === 'campaignStars') return Object.values(p.campaign).reduce((a, b) => a + b, 0)
  return p.stats[stat] || 0
}

export default function Achievements() {
  const t = useT()
  const l = useL()
  const p = useStore((s) => s.profile)
  const sorted = [...ACHIEVEMENTS].sort((a, b) => Number(!!p.achievements[b.id]) - Number(!!p.achievements[a.id]))
  const done = Object.keys(p.achievements).length
  return (
    <div>
      <PageHeader title={t('achievements')} right={<span className="chip bg-amber-300/15 text-amber-200">{done}/{ACHIEVEMENTS.length}</span>} />
      <Progress value={done} max={ACHIEVEMENTS.length} className="mb-4" color="from-amber-300 to-orange-400" />
      <div className="space-y-2">
        {sorted.map((a) => {
          const unlocked = !!p.achievements[a.id]
          const v = Math.min(value(p, a.stat), a.goal)
          return (
            <div key={a.id} className={`flex items-center gap-3 rounded-2xl p-3 ${unlocked ? 'bg-gradient-to-r from-amber-300/15 to-transparent ring-1 ring-amber-300/25' : 'bg-white/[0.03]'}`}>
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${unlocked ? 'bg-amber-300/20' : 'bg-white/[0.05] grayscale'}`}>{a.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-extrabold">{l(a.title)}</span>
                  {unlocked ? <span className="text-emerald-300">✓</span> : <span className="text-[11px] font-bold text-slate-500">{v}/{a.goal}</span>}
                </div>
                <div className="mb-1.5 text-xs text-slate-400">{l(a.desc)}</div>
                {!unlocked ? <Progress value={v} max={a.goal} height="h-1" /> : <RewardChips reward={a.reward} />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
