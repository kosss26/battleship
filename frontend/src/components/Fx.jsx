import { useId } from 'react'
import { motion } from 'framer-motion'
import '../styles/combat-effects.css'

export { IMPACT_FX_MS } from '../game/animation.js'

function material(effect) {
  const [color = '#d5a956', light = '#fff1c9', smoke = '#67879f'] = effect?.colors || []
  return { '--fx-color': color, '--fx-light': light, '--fx-smoke': smoke }
}

const particles = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 + (i % 2) * 0.3
  return { x: Math.cos(a), y: Math.sin(a), s: 0.5 + (i % 3) * 0.25 }
})

export function Explosion({ colors = ['#f97316', '#facc15'], big = false, effect }) {
  if (effect?.model) return (
    <div data-impact="hit" data-effect-style={effect.model} className={`combat-impact combat-impact-${effect.model}${big ? ' combat-impact-sunk' : ''}`} style={material(effect)}>
      <span className="combat-flash" /><span className="combat-impact-ring" /><span className="combat-impact-mist" />
      {particles.slice(0, 8).map((p, i) => <span key={i} className="combat-spark" style={{ '--dx': `${p.x * 25}px`, '--dy': `${p.y * 24 - 9}px`, '--turn': `${i * 47}deg`, '--delay': `${i * 9}ms` }} />)}
    </div>
  )
  const [c1, c2, c3 = c1] = colors
  const scale = big ? 1.6 : 1
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <motion.div
        className="absolute rounded-full"
        style={{ width: '100%', height: '100%', background: `radial-gradient(circle, #fff 0%, ${c2} 30%, ${c1} 60%, transparent 72%)` }}
        initial={{ scale: 0.2, opacity: 1 }}
        animate={{ scale: 2.4 * scale, opacity: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute rounded-full border-2"
        style={{ width: '100%', height: '100%', borderColor: c2 }}
        initial={{ scale: 0.5, opacity: 0.9 }}
        animate={{ scale: 3.2 * scale, opacity: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{ width: 5 * p.s * scale, height: 5 * p.s * scale, background: i % 3 === 0 ? c3 : i % 2 ? c1 : c2, boxShadow: `0 0 6px ${c2}` }}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: p.x * 34 * scale, y: p.y * 34 * scale + 8, opacity: 0 }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

export function Splash({ effect }) {
  if (effect?.model) return (
    <div data-impact="miss" data-effect-style={effect.model} className={`combat-impact combat-splash combat-splash-${effect.model}`} style={material(effect)}>
      {[0, 1, 2].map((i) => <span key={i} className="combat-water-ring" style={{ '--delay': `${i * 110}ms` }} />)}
      {[-2, -1, 0, 1, 2].map((x) => <span key={x} className="combat-droplet" style={{ '--dx': `${x * 7}px`, '--dy': `${-20 + Math.abs(x) * 3}px`, '--delay': `${Math.abs(x) * 22}ms` }} />)}
      <span className="combat-water-crown" />
    </div>
  )
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      {[0, 0.12, 0.24].map((d, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border"
          style={{ width: '70%', height: '70%', borderColor: 'var(--miss)' }}
          initial={{ scale: 0.2, opacity: 0.9 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.8, delay: d, ease: 'easeOut' }}
        />
      ))}
      {[-1, 0, 1].map((x) => (
        <motion.div
          key={x}
          className="absolute h-1.5 w-1 rounded-full bg-white/80"
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: x * 10, y: [-2, -16, -4], opacity: 0 }}
          transition={{ duration: 0.6 }}
        />
      ))}
    </div>
  )
}

/** Marker for a burning hit cell */
export function Flame({ colors = ['#f97316', '#facc15'], effect }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className={`burn absolute h-[70%] w-[70%] rounded-full${effect?.model ? ` combat-burn-${effect.model}` : ''}`} style={{ background: `radial-gradient(circle, ${colors[1]} 0%, ${colors[0]} 45%, transparent 70%)` }} />
      <svg viewBox="0 0 24 24" className="relative h-[62%] w-[62%]">
        <path d="M5 5l14 14M19 5L5 19" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

/**
 * A shell falling onto the cell (top-down view): it shrinks as it "drops",
 * while its shadow on the water grows and sharpens. Lands after `ms`.
 */
export function Shell({ ms = 300, effect }) {
  const d = ms / 1000
  const gid = `shell-${useId().replace(/:/g, '')}`
  if (effect?.model) return (
    <div data-shell data-effect-style={effect.model} className="combat-shell" style={material(effect)}>
      <motion.span className="combat-shell-shadow" initial={{ scale: .15, opacity: 0 }} animate={{ scale: 1, opacity: [0, .5, 0] }} transition={{ duration: d, times: [0, .85, 1] }} />
      <motion.span className="combat-shell-body" initial={{ x: -17, y: -40, scale: 2.6, rotate: -24, opacity: 0 }} animate={{ x: 0, y: 0, scale: .65, rotate: 0, opacity: [0, 1, 1] }} transition={{ duration: d, ease: [.55, 0, .9, .4] }}>
        <span className="combat-shell-trail" />
        <svg viewBox="0 0 24 32" className="h-full w-full">
          <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--fx-light)" /><stop offset=".48" stopColor="var(--fx-color)" /><stop offset="1" stopColor="var(--fx-smoke)" /></linearGradient></defs>
          <path d="M12 2Q5 8 5 15v11q7 5 14 0V15Q19 8 12 2Z" fill={`url(#${gid})`} stroke="var(--fx-light)" strokeWidth="1" />
          <path d="M6 22h12M6 25h12" stroke="var(--fx-smoke)" strokeWidth="1.6" /><path d="M9 12v7" stroke="#fff" strokeOpacity=".8" strokeWidth="1.5" />
        </svg>
      </motion.span>
    </div>
  )
  return (
    <div data-shell className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <motion.div
        className="absolute rounded-full bg-black/50 blur-[2px]"
        style={{ width: '55%', height: '55%' }}
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: 1, opacity: [0, 0.6, 0] }}
        transition={{ duration: d, ease: 'easeIn', opacity: { times: [0, 0.85, 1], duration: d } }}
      />
      <motion.div
        className="absolute"
        style={{ width: '46%', height: '46%' }}
        initial={{ scale: 3.2, y: -26, x: -10, opacity: 0, rotate: -35 }}
        animate={{ scale: 0.55, y: 0, x: 0, opacity: [0, 1, 1], rotate: 0 }}
        transition={{ duration: d, ease: [0.55, 0, 0.9, 0.4] }}
      >
        <svg viewBox="0 0 24 24" className="h-full w-full drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]">
          <defs>
            <radialGradient id={gid} cx="35%" cy="35%" r="70%">
              <stop offset="0" stopColor="#fff7ed" />
              <stop offset="0.4" stopColor="#fbbf24" />
              <stop offset="1" stopColor="#b45309" />
            </radialGradient>
          </defs>
          <circle cx="12" cy="12" r="9" fill={`url(#${gid})`} stroke="#78350f" strokeWidth="1.2" />
        </svg>
      </motion.div>
    </div>
  )
}

/** Whole-hull wake. Stays inside the board; final wreck and X markers remain. */
export function SinkWake({ effect }) {
  return (
    <div data-sinking data-effect-style={effect?.model || 'classic'} className={`combat-sink combat-sink-${effect?.model || 'classic'}`} style={material(effect)}>
      <span className="combat-sink-ripple" /><span className="combat-sink-ripple combat-sink-ripple-late" />
      <span className="combat-sink-mist" />
      {Array.from({ length: 7 }, (_, i) => <span key={i} className="combat-sink-bubble" style={{ left: `${12 + i * 12}%`, top: `${25 + i % 3 * 22}%`, '--delay': `${i * 42}ms` }} />)}
    </div>
  )
}
