import { useEffect, useState } from 'react'
import { FLEET } from '@shared/engine.js'
import { useStore } from '../store/app.js'
import { sfx } from '../lib/sound.js'

/** Seconds left until the server deadline (accounts for clock offset) */
export function useCountdown(deadline) {
  const offset = useStore((s) => s.clockOffset)
  const calc = () => (deadline ? Math.max(0, Math.ceil((deadline - (Date.now() + offset)) / 1000)) : null)
  const [left, setLeft] = useState(calc)
  useEffect(() => {
    setLeft(calc())
    if (!deadline) return
    const id = setInterval(() => setLeft(calc()), 250)
    return () => clearInterval(id)
  }, [deadline, offset]) // eslint-disable-line react-hooks/exhaustive-deps
  return left
}

export function TimerRing({ left, total = 30, active }) {
  const pct = left == null ? 1 : left / total
  const danger = left != null && left <= 8
  useEffect(() => {
    if (active && danger && left > 0) sfx.tick()
  }, [left, active, danger])
  const R = 16
  const C = 2 * Math.PI * R
  return (
    <div className="relative h-11 w-11">
      <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90">
        <circle cx="20" cy="20" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <circle
          cx="20" cy="20" r={R} fill="none"
          stroke={danger ? '#fb7185' : active ? '#22d3ee' : '#fbbf24'}
          strokeWidth="4" strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.25s linear' }}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[13px] font-black ${danger ? 'text-rose-300' : ''}`}>
        {left ?? '∞'}
      </span>
    </div>
  )
}

/** Shows which ships are still afloat */
export function FleetStatus({ remaining, compact = false, color = 'bg-cyan-300' }) {
  if (!remaining) return null
  const left = [...remaining]
  const items = FLEET.map((size) => {
    const i = left.indexOf(size)
    if (i >= 0) {
      left.splice(i, 1)
      return { size, alive: true }
    }
    return { size, alive: false }
  })
  return (
    <div className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-1.5'}`}>
      {items.map((it, i) => (
        <div key={i} className="flex gap-[2px]">
          {Array.from({ length: it.size }, (_, k) => (
            <span key={k} className={`${compact ? 'h-1.5 w-1.5' : 'h-2 w-2'} rounded-[2px] ${it.alive ? color : 'bg-rose-500/40'}`} />
          ))}
        </div>
      ))}
    </div>
  )
}
