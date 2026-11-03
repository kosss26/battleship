import { motion } from 'framer-motion'

const particles = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 + (i % 2) * 0.3
  return { x: Math.cos(a), y: Math.sin(a), s: 0.5 + (i % 3) * 0.25 }
})

export function Explosion({ colors = ['#f97316', '#facc15'], big = false }) {
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

export function Splash() {
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
export function Flame({ colors = ['#f97316', '#facc15'] }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="burn absolute h-[70%] w-[70%] rounded-full" style={{ background: `radial-gradient(circle, ${colors[1]} 0%, ${colors[0]} 45%, transparent 70%)` }} />
      <svg viewBox="0 0 24 24" className="relative h-[62%] w-[62%]">
        <path d="M5 5l14 14M19 5L5 19" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
    </div>
  )
}
