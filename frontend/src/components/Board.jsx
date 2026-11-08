import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { SIZE, CELL, COLS, COLS_EN, shipCells } from '@shared/engine.js'
import Ship from './Ship.jsx'
import { RegentChart, RegentShotMark } from './RegentEffects.jsx'
import { Explosion, Splash, Flame, Shell, SinkWake, IMPACT_FX_MS } from './Fx.jsx'
import { SHELL_FLIGHT_MS } from '../game/animation.js'
import { useLang } from '../lib/i18n.js'

const pct = (n) => `${n * 10}%`

/**
 * Miss marker: dimmed cell + dot with a splash ring.
 * Centred with flex — framer-motion's `scale` overrides CSS translate-based centring.
 */
function MissMark({ reducedMotion }) {
  return (
    <span className="absolute inset-[6%] flex items-center justify-center rounded-[22%] bg-black/20">
      <motion.span
        className="absolute h-[62%] w-[62%] rounded-full border-[1.5px]"
        style={{ borderColor: 'var(--miss)', opacity: 0.45 }}
        initial={reducedMotion ? false : { scale: 0.3 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      />
      <motion.span
        className="h-[30%] w-[30%] rounded-full"
        style={{ background: 'var(--miss)', boxShadow: '0 0 6px var(--miss)' }}
        initial={reducedMotion ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      />
    </span>
  )
}

/** One shot: the shell falls, then the explosion/splash plays on impact */
function ShotFx({ f, effect, small, landed }) {
  return (
    <div className="pointer-events-none absolute z-30" style={{ left: pct(f.c), top: pct(f.r), width: pct(1), height: pct(1) }}>
      {!landed && <Shell ms={SHELL_FLIGHT_MS} effect={effect} />}
      {landed && (f.result === 'miss' ? <Splash effect={effect} /> : <Explosion effect={effect} colors={effect?.colors} big={f.result === 'sunk' && !small} />)}
    </div>
  )
}

/**
 * Battle grid.
 *  shots      10×10 grid of CELL values (or null)
 *  ships      ships to draw: { r, c, size, vertical, state }
 *  feed       shot events to animate on this board
 *  onCell     (r, c) => void, enables targeting
 *  highlight  [[r,c]] cells to highlight (booster preview)
 */
const Board = forwardRef(function Board(
  { shots, ships = [], skin, effect, feed = [], onCell, highlight = [], scans = [], labels = true, dim = false, small = false, theme, children, onPointerDown, shake, hideNewSunk = false, previewSequence = 0 },
  ref,
) {
  const lang = useLang()
  const reducedMotion = useReducedMotion()
  const regentMarks = effect?.model === 'regent'
  const [fx, setFx] = useState([])
  const [landing, setLanding] = useState(() => new Set())
  const [hover, setHover] = useState(null)
  const seen = useRef(new Set(feed.map((f) => f.id)))
  const timers = useRef(new Set())
  const sequence = useRef(previewSequence)

  useLayoutEffect(() => {
    if (sequence.current !== previewSequence) {
      // A fitting-room preset replaces the previous shot, including its timers.
      timers.current.forEach(clearTimeout)
      timers.current.clear()
      setFx([])
      setLanding(new Set())
      seen.current.clear()
      sequence.current = previewSequence
    }
    const fresh = feed.filter((f) => !seen.current.has(f.id))
    fresh.forEach((f) => seen.current.add(f.id))
    if (reducedMotion) {
      timers.current.forEach(clearTimeout)
      timers.current.clear()
      setFx((cur) => cur.length ? [] : cur)
      setLanding((cur) => cur.size ? new Set() : cur)
      return
    }
    if (!fresh.length) return
    setFx((cur) => [...cur, ...fresh])
    // Hide the result marker until the shell lands
    const keys = fresh.map((f) => f.r * SIZE + f.c)
    setLanding((cur) => new Set([...cur, ...keys]))
    const ids = new Set(fresh.map((f) => f.id))
    // Timers are independent per shot: a quick follow-up shot must not cancel them
    const schedule = (fn, ms) => {
      const timer = setTimeout(() => { timers.current.delete(timer); fn() }, ms)
      timers.current.add(timer)
    }
    schedule(() => setLanding((cur) => new Set([...cur].filter((k) => !keys.includes(k)))), SHELL_FLIGHT_MS)
    schedule(() => setFx((cur) => cur.filter((f) => !ids.has(f.id))), SHELL_FLIGHT_MS + IMPACT_FX_MS)
  }, [feed, reducedMotion, previewSequence])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const cols = lang === 'ru' ? COLS : COLS_EN
  const style = theme ? Object.fromEntries(Object.entries(theme.vars).map(([k, v]) => [`--${k}`, v])) : undefined
  const pendingWrecks = ships.filter((s) => s.state === 'sunk' && shipCells(s).some(([r, c]) => landing.has(r * SIZE + c)))
  const pendingWreckCells = new Set(pendingWrecks.flatMap((s) => shipCells(s).map(([r, c]) => r * SIZE + c)))
  const pendingHalo = new Set(fx.filter((f) => f.result === 'sunk' && landing.has(f.r * SIZE + f.c)).flatMap((f) => (f.around || []).map(([r, c]) => r * SIZE + c)))
  const contains = (s, f) => shipCells(s).some(([r, c]) => r === f.r && c === f.c)

  const grid = (
    <div
      ref={ref}
      data-board-theme={theme?.id}
      onPointerDown={onPointerDown}
      className={`water relative aspect-square w-full touch-none overflow-hidden ${small ? 'rounded-xl' : 'rounded-2xl'} ${shake ? 'shake' : ''}`}
      style={{ boxShadow: `inset 0 0 0 1px var(--grid), 0 0 ${small ? 12 : 30}px -10px var(--glow)` }}
      onPointerLeave={() => setHover(null)}
    >
      <div className="water-waves absolute inset-0" />
      {theme?.id === 'theme_regent' && <RegentChart />}
      {/* grid lines */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px)',
          backgroundSize: '10% 10%',
        }}
      />

      {/* ships */}
      {ships.map((s, i) => {
        const pendingWreck = pendingWrecks.includes(s)
        if (hideNewSunk && pendingWreck) return null
        const state = pendingWreck ? 'alive' : s.state
        const sinking = !reducedMotion && fx.some((f) => f.result === 'sunk' && !landing.has(f.r * SIZE + f.c) && contains(s, f))
        return (
        <motion.div
          key={`${s.key ?? i}`}
          className="absolute z-10 p-[1.2%]"
          style={{ left: pct(s.c), top: pct(s.r), width: pct(s.vertical ? 1 : s.size), height: pct(s.vertical ? s.size : 1) }}
          data-sinking-hull={sinking || undefined}
          initial={false}
          animate={sinking ? { scale: [1, 1.02, .9], opacity: [1, .65, .35], rotate: [0, s.vertical ? -3 : 3, 0] } : { scale: 1, opacity: state === 'sunk' ? .55 : 1, rotate: 0 }}
          transition={{ duration: reducedMotion ? 0 : sinking ? 1.05 : .15, ease: 'easeOut' }}
        >
          <Ship size={s.size} vertical={s.vertical} skin={skin} state={state} className="h-full w-full" />
        </motion.div>
      )})}

      {/* highlight (booster area) */}
      {highlight.map(([r, c]) => (
        <div key={`h${r}-${c}`} className="absolute z-20 rounded-sm border-2 border-amber-300/90 bg-amber-300/20" style={{ left: pct(c), top: pct(r), width: pct(1), height: pct(1) }} />
      ))}

      {/* radar scans */}
      {scans.map((s, i) => (
        <div
          key={`scan${i}`}
          className="absolute z-20 rounded-lg border-2 border-dashed border-emerald-300/80 bg-emerald-300/10"
          style={{ left: pct(Math.max(0, s.c - 1)), top: pct(Math.max(0, s.r - 1)), width: pct(Math.min(SIZE, s.c + 2) - Math.max(0, s.c - 1)), height: pct(Math.min(SIZE, s.r + 2) - Math.max(0, s.r - 1)) }}
        >
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-400 px-1 text-[11px] font-black text-ink-950">{s.count}</span>
        </div>
      ))}

      {/* shot markers + interactive cells */}
      <div className={`absolute inset-0 z-20 grid grid-cols-10 grid-rows-10 ${onCell ? '' : 'pointer-events-none'}`}>
        {Array.from({ length: SIZE * SIZE }, (_, k) => {
          const r = Math.floor(k / SIZE)
          const c = k % SIZE
          const v = landing.has(k) || pendingHalo.has(k) ? CELL.EMPTY : pendingWreckCells.has(k) ? CELL.HIT : shots ? shots[r][c] : CELL.EMPTY
          const canShoot = onCell && (shots ? shots[r][c] : CELL.EMPTY) === CELL.EMPTY
          const Tag = onCell ? 'button' : 'div'
          return (
            <Tag
              key={k}
              data-shot-state={v}
              {...(onCell
                ? { type: 'button', tabIndex: -1, onClick: () => canShoot && onCell(r, c), onPointerEnter: () => setHover(k), 'aria-label': `${cols[c]}${r + 1}` }
                : {})}
              className={`relative outline-none ${canShoot ? 'cursor-crosshair' : 'cursor-default'}`}
            >
              {regentMarks && v !== CELL.EMPTY && <RegentShotMark state={v} />}
              {!regentMarks && v === CELL.MISS && <MissMark reducedMotion={reducedMotion} />}
              {!regentMarks && v === CELL.HIT && <Flame effect={effect} colors={effect?.colors} />}
              {!regentMarks && v === CELL.SUNK && (
                <span className="absolute inset-[8%] flex items-center justify-center rounded-md bg-rose-950/40">
                  <svg viewBox="0 0 24 24" className="h-[60%] w-[60%] opacity-90">
                    <path d="M5 5l14 14M19 5L5 19" stroke="#fb7185" strokeWidth="3.2" strokeLinecap="round" />
                  </svg>
                </span>
              )}
              {canShoot && hover === k && !small && (
                <span className={regentMarks ? 'regent-reticle' : 'absolute inset-[6%] rounded-md border-2 border-white/70 bg-white/10'} />
              )}
            </Tag>
          )
        })}
      </div>

      {/* effects */}
      <AnimatePresence>
        {fx.map((f) => <ShotFx key={f.id} f={f} effect={effect} small={small} landed={!landing.has(f.r * SIZE + f.c)} />)}
        {fx.filter((f) => f.result === 'sunk' && !landing.has(f.r * SIZE + f.c)).map((f) => {
          const s = f.ship || ships.find((s) => contains(s, f))
          return s ? <div key={`sink-${f.id}`} className="pointer-events-none absolute z-30" style={{ left: pct(s.c), top: pct(s.r), width: pct(s.vertical ? 1 : s.size), height: pct(s.vertical ? s.size : 1) }}><SinkWake effect={effect} /></div> : null
        })}
      </AnimatePresence>

      {dim && <div className="pointer-events-none absolute inset-0 z-40 bg-ink-950/35 transition-opacity" />}
      {children}
    </div>
  )

  if (!labels) return <div style={style}>{grid}</div>

  return (
    <div style={style} className={`grid grid-cols-[14px_1fr] grid-rows-[14px_1fr] gap-1${theme?.id === 'theme_regent' ? ' regent-board-labels' : ''}`}>
      <div />
      <div className="grid grid-cols-10 text-center text-[10px] font-bold text-slate-500">
        {cols.split('').map((ch) => <span key={ch}>{ch}</span>)}
      </div>
      <div className="grid grid-rows-10 items-center text-right text-[10px] font-bold text-slate-500">
        {Array.from({ length: SIZE }, (_, i) => <span key={i}>{i + 1}</span>)}
      </div>
      {grid}
    </div>
  )
})

export default Board
