import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Anchor, ScrollText, ShoppingBag, Trophy, User } from 'lucide-react'
import { useStore } from '../store/app.js'
import { useT } from '../lib/i18n.js'
import { haptic } from '../lib/telegram.js'
import { QUESTS, PASS_XP_PER_TIER } from '@shared/catalog.js'

export function useQuestBadge() {
  const p = useStore((s) => s.profile)
  if (!p) return 0
  let n = 0
  for (const q of p.quests) {
    const def = QUESTS.find((d) => d.id === q.id)
    if (def && q.progress >= def.target && !q.claimed) n++
  }
  if (!p.daily.claimedToday) n++
  const tiers = Math.floor(p.pass.xp / PASS_XP_PER_TIER)
  for (let i = 1; i <= tiers; i++) {
    if (!p.pass.free.includes(i)) n++
    if (p.pass.premium && !p.pass.prem.includes(i)) n++
  }
  return n
}

export default function TabBar() {
  const t = useT()
  const badge = useQuestBadge()
  const tabs = [
    { to: '/', icon: Anchor, label: t('tab_home') },
    { to: '/quests', icon: ScrollText, label: t('tab_quests'), badge },
    { to: '/shop', icon: ShoppingBag, label: t('tab_shop') },
    { to: '/top', icon: Trophy, label: t('tab_top') },
    { to: '/profile', icon: User, label: t('tab_profile') },
  ]
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-3" style={{ paddingBottom: 'calc(10px + var(--safe-bottom))' }}>
      <div className="glass-strong flex w-full max-w-lg items-stretch justify-between rounded-[26px] px-1.5 py-1.5">
        {tabs.map(({ to, icon: Icon, label, badge: b }) => (
          <NavLink key={to} to={to} end onClick={() => haptic.tap()} className="relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2">
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div layoutId="tab-bg" className="absolute inset-0 rounded-2xl bg-white/[0.08]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                )}
                <div className="relative">
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} className={isActive ? 'text-cyan-300' : 'text-slate-400'} />
                  {b > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white ring-2 ring-ink-850">
                      {b > 9 ? '9+' : b}
                    </span>
                  )}
                </div>
                <span className={`relative text-[10.5px] font-bold ${isActive ? 'text-white' : 'text-slate-500'}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
