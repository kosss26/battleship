import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { CAMPAIGN, CHAPTERS, LEVELS_PER_CHAPTER, CAMPAIGN_STAR_GOLD, MODIFIERS } from '@shared/catalog.js'
import { useStore } from '../store/app.js'
import { useT, useL } from '../lib/i18n.js'
import { haptic } from '../lib/telegram.js'
import { startCampaign } from '../lib/play.js'
import { PageHeader, Sheet, Stars, RewardChips, Coin } from '../components/ui.jsx'

export default function Campaign() {
  const t = useT()
  const l = useL()
  const p = useStore((s) => s.profile)
  const [sel, setSel] = useState(null)
  const [busy, setBusy] = useState(false)
  const unlocked = (n) => n === 1 || !!p.campaign[n - 1]
  const total = Object.values(p.campaign).reduce((a, b) => a + b, 0)

  return (
    <div>
      <PageHeader title={t('campaign')} right={<span className="chip bg-amber-300/15 text-amber-200">⭐ {total}/{CAMPAIGN.length * 3}</span>} />
      {CHAPTERS.map((ch) => {
        const levels = CAMPAIGN.filter((x) => x.chapter === ch.id)
        const chStars = levels.reduce((a, x) => a + (p.campaign[x.n] || 0), 0)
        return (
          <div key={ch.id} className="mb-6">
            <div className="glass mb-4 flex items-center gap-3 p-4" style={{ background: `linear-gradient(120deg, ${ch.color}22, transparent)` }}>
              <div className="text-3xl">{ch.icon}</div>
              <div className="flex-1">
                <div className="label" style={{ color: ch.color }}>{t('chapter', { n: ch.id })}</div>
                <div className="font-display text-lg font-bold">{l(ch.name)}</div>
              </div>
              <span className="text-sm font-bold text-slate-300">⭐ {chStars}/{LEVELS_PER_CHAPTER * 3}</span>
            </div>
            <div className="relative grid grid-cols-5 gap-y-4">
              {levels.map((lv, i) => {
                const open = unlocked(lv.n)
                const stars = p.campaign[lv.n] || 0
                const current = open && !stars
                const row = Math.floor(i / 5)
                const col = row % 2 ? 4 - (i % 5) : i % 5
                return (
                  <motion.button
                    key={lv.n}
                    whileTap={{ scale: 0.9 }}
                    style={{ gridColumn: col + 1, gridRow: row + 1 }}
                    onClick={() => {
                      haptic.light()
                      if (open) setSel(lv)
                    }}
                    className="flex flex-col items-center gap-1"
                  >
                    <div
                      className={`relative flex items-center justify-center rounded-2xl font-display text-lg font-bold ${lv.boss ? 'h-[60px] w-[60px]' : 'h-14 w-14'} ${
                        !open ? 'bg-white/[0.04] text-slate-600' : stars ? 'text-ink-950' : 'text-white ring-2'
                      }`}
                      style={open ? { background: stars ? `linear-gradient(135deg, ${ch.color}, #fbbf24)` : `${ch.color}33`, '--tw-ring-color': ch.color } : undefined}
                    >
                      {current && <span className="ping-ring absolute inset-0 rounded-2xl border-2" style={{ borderColor: ch.color }} />}
                      {open ? (lv.boss ? '☠' : lv.n) : <Lock size={18} />}
                    </div>
                    <Stars n={stars} size={11} />
                    {Object.keys(lv.mods).length > 0 && (
                      <div className="-mt-0.5 flex gap-px text-[10px] leading-none">{Object.keys(lv.mods).map((k) => <span key={k}>{MODIFIERS[k].icon}</span>)}</div>
                    )}
                  </motion.button>
                )
              })}
            </div>
          </div>
        )
      })}

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel ? `${t('mission', { n: sel.n })}${sel.boss ? ` · ${t('boss')}` : ''}` : ''}>
        {sel && (
          <div>
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
            <button
              className="btn-gold w-full"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                haptic.medium()
                await startCampaign(sel.n)
                setBusy(false)
              }}
            >
              {t('start')}
            </button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
