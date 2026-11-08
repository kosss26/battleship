import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion'
import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import PlayerAvatar from './PlayerAvatar.jsx'
import useOverlay from './useOverlay.js'
import '../styles/naval-overlays.css'
import { ChevronLeft, X, Frame, Ship as ShipIcon, Waves, Crosshair } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BOOSTERS, findCosmetic, RANKS } from '@shared/catalog.js'
import { useL, useT } from '../lib/i18n.js'
import { haptic } from '../lib/telegram.js'
import { sfx } from '../lib/sound.js'

export const fmt = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ')

export function Coin({ size = 18, className = '' }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.5" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10.5" fill={`url(#${id})`} stroke="#92400e" strokeWidth="1" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="#fef3c7" strokeOpacity=".7" strokeWidth="1.2" />
      <path d="M12 7.5v9M9.5 9.5h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4" stroke="#92400e" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function Gem({ size = 18, className = '' }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f5d0fe" />
          <stop offset="0.45" stopColor="#c084fc" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <path d="M6 3h12l4 6-10 12L2 9z" fill={`url(#${id})`} stroke="#581c87" strokeWidth="0.8" />
      <path d="M2 9h20M8.5 3L12 9l3.5-6M12 9v12" stroke="#faf5ff" strokeOpacity=".55" strokeWidth=".9" fill="none" />
    </svg>
  )
}

export function Star({ filled, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"
        fill={filled ? '#fbbf24' : 'rgba(255,255,255,0.12)'}
        stroke={filled ? '#b45309' : 'rgba(255,255,255,0.15)'}
        strokeWidth="1"
      />
    </svg>
  )
}

export function Stars({ n, size = 14, total = 3 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: total }, (_, i) => <Star key={i} filled={i < n} size={size} />)}
    </div>
  )
}

export function Price({ price, className = '' }) {
  if (!price) return null
  return (
    <span className={`inline-flex items-center gap-1 font-extrabold ${className}`}>
      {price.gold ? <><Coin size={15} />{fmt(price.gold)}</> : null}
      {price.gems ? <><Gem size={15} />{fmt(price.gems)}</> : null}
      {price.stars ? <>⭐ {fmt(price.stars)}</> : null}
    </span>
  )
}

export function Avatar(props) {
  return <PlayerAvatar {...props}/>
}

export function Progress({ value, max, className = '', color = 'from-cyan-400 to-blue-500', height = 'h-2' }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className={`overflow-hidden rounded-full bg-white/[0.08] ${height} ${className}`}>
      <motion.div
        className={`h-full rounded-full bg-gradient-to-r ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 80, damping: 20 }}
      />
    </div>
  )
}

export function RankBadge({ rating, size = 'sm' }) {
  const l = useL()
  const rank = [...RANKS].reverse().find((r) => rating >= r.min) || RANKS[0]
  return (
    <span className={`chip bg-white/[0.07] text-slate-200 ${size === 'lg' ? 'px-3 py-1.5 text-sm' : ''}`}>
      <span>{rank.icon}</span>
      {l(rank.name)}
    </span>
  )
}

export function Sheet({ open, onClose, title, children, tall = false }) {
  const dragControls = useDragControls()
  const reducedMotion=useReducedMotion()
  const panel=useRef(null)
  const titleId=useId()
  const t=useT()
  useOverlay(open,panel,onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="naval-overlay naval-sheet-overlay fixed inset-0 z-50 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="naval-overlay-backdrop absolute inset-0" onClick={onClose} />
          <motion.div
            ref={panel} role="dialog" aria-modal="true" aria-labelledby={title?titleId:undefined} tabIndex={-1}
            className={`naval-sheet relative w-full max-w-lg px-5 pt-3 ${tall ? 'max-h-[88vh]' : 'max-h-[80vh]'} overflow-y-auto`}
            style={{ paddingBottom: 'calc(20px + var(--safe-bottom))', touchAction: 'pan-x pan-y', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}
            initial={reducedMotion?false:{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={reducedMotion?{duration:0}:{ type: 'spring', stiffness: 380, damping: 36 }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => info.offset.y > 120 && onClose?.()}
          >
            <div className="flex h-6 w-full shrink-0 cursor-grab items-start justify-center" style={{ touchAction: 'none' }} onPointerDown={(e) => dragControls.start(e)} aria-hidden="true"><span className="mt-0.5 h-1.5 w-10 rounded-full bg-white/20" /></div>
            {title && (
              <div className="naval-sheet-heading mb-4 flex items-center justify-between">
                <h3 id={titleId}>{title}</h3>
                <button className="rounded-full bg-white/[0.06] p-2" onClick={onClose} aria-label={t('close')}>
                  <X size={18} />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,document.body
  )
}

export function Modal({ open, onClose, children, className = '', label }) {
  const panel=useRef(null)
  const t=useT()
  const reducedMotion=useReducedMotion()
  useOverlay(open,panel,onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="naval-overlay naval-modal-overlay fixed inset-0 z-50 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="naval-overlay-backdrop absolute inset-0" onClick={onClose} />
          <motion.div ref={panel} role="dialog" aria-modal="true" aria-label={label||t('naval_dialog')} tabIndex={-1}
            className={`naval-modal-panel relative w-full max-w-sm ${className}`}
            initial={reducedMotion?false:{ y:12, scale:.97, opacity:0 }} animate={{ y:0, scale:1, opacity:1 }} exit={{ y:8, opacity:0 }} transition={{duration:reducedMotion?0:.2}}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,document.body
  )
}

export function Segmented({ value, onChange, options, className = '' }) {
  // Indicator is positioned by index (no shared layoutId): layout animations inside a page
  // that is exiting an AnimatePresence transition can stall the route change.
  const idx = Math.max(0, options.findIndex((o) => o.value === value))
  const w = 100 / options.length
  return (
    <div className={`relative flex rounded-2xl bg-white/[0.05] p-1 ${className}`}>
      <div className="pointer-events-none absolute inset-1">
        <motion.div
          className="absolute inset-y-0 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-400"
          initial={false}
          animate={{ left: `${idx * w}%`, width: `${w}%` }}
          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
        />
      </div>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => {
            haptic.tap()
            onChange(o.value)
          }}
          className={`relative flex-1 whitespace-nowrap rounded-xl px-1 py-2 text-[12.5px] font-bold transition-colors ${value === o.value ? 'text-ink-950' : 'text-slate-300'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => {
        haptic.tap()
        onChange(!on)
      }}
      className={`relative h-7 w-12 rounded-full transition-colors ${on ? 'bg-cyan-400' : 'bg-white/15'}`}
      role="switch"
      aria-checked={on}
    >
      <motion.span className="absolute top-1 h-5 w-5 rounded-full bg-white shadow" animate={{ left: on ? 24 : 4 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
    </button>
  )
}

export function PageHeader({ title, right, back = true }) {
  const navigate = useNavigate()
  return (
    <div className="mb-4 flex items-center gap-2">
      {back && (
        <button
          className="-ml-1 rounded-xl p-1.5 text-slate-300 active:bg-white/10"
          onClick={() => {
            sfx.tap()
            navigate(-1)
          }}
          aria-label="back"
        >
          <ChevronLeft size={26} />
        </button>
      )}
      <h1 className="h-display flex-1 text-[22px]">{title}</h1>
      {right}
    </div>
  )
}

/** Renders a list of reward chips from a summary or reward object */
export function RewardChips({ reward, size = 'md' }) {
  const l = useL()
  const t = useT()
  if (!reward) return null
  const big = size === 'lg'
  const chip = `chip ${big ? 'px-3 py-1.5 text-sm' : ''} bg-white/[0.07]`
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {reward.gold ? <span className={`${chip} text-amber-200`}><Coin size={big ? 18 : 14} />+{fmt(reward.gold)}</span> : null}
      {reward.gems ? <span className={`${chip} text-fuchsia-200`}><Gem size={big ? 18 : 14} />+{fmt(reward.gems)}</span> : null}
      {reward.xp ? <span className={`${chip} text-cyan-200`}>XP +{fmt(reward.xp)}</span> : null}
      {reward.passXp ? <span className={`${chip} text-emerald-200`}>{t('pass_xp_reward', { n: fmt(reward.passXp) })}</span> : null}
      {Object.entries(reward.boosters || {}).filter(([, n]) => n).map(([id, n]) => (
        <span key={id} className={`${chip} text-sky-200`}>{BOOSTERS[id]?.icon} ×{n}</span>
      ))}
      {(reward.cosmetics || []).map((id) => {
        const cosmetic=findCosmetic(id),Icon=({frame:Frame,ship:ShipIcon,theme:Waves,effect:Crosshair})[cosmetic?.slot]||Frame
        return <span key={id} className={`${chip} text-violet-200`}><Icon size={big?17:14} strokeWidth={1.6}/>{l(cosmetic?.item.name)}</span>
      })}
    </div>
  )
}

export function Empty({ icon = '🌊', text }) {
  return (
    <div className="flex flex-col items-center py-10 text-center text-slate-400">
      <div className="mb-2 text-4xl opacity-80">{icon}</div>
      <div className="text-sm">{text}</div>
    </div>
  )
}

export function Spinner({ size = 28 }) {
  return (
    <div className="animate-spin rounded-full border-[3px] border-white/15 border-t-cyan-300" style={{ width: size, height: size }} />
  )
}

