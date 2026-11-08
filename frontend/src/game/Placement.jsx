import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Shuffle, RotateCw, Eraser, Check } from 'lucide-react'
import { FLEET, SIZE, canPlace, randomFleet } from '@shared/engine.js'
import { THEMES, SHIP_SKINS } from '@shared/catalog.js'
import Board from '../components/Board.jsx'
import Ship from '../components/Ship.jsx'
import { useT } from '../lib/i18n.js'
import { haptic } from '../lib/telegram.js'
import { sfx } from '../lib/sound.js'
import { request } from '../lib/socket.js'
import { useStore } from '../store/app.js'

const withIds = (ships) => ships.map((s, i) => ({ ...s, id: i }))

export default function Placement({ game, deadlineLeft }) {
  const t = useT()
  const profile = useStore((s) => s.profile)
  const toast = useStore((s) => s.toast)
  const theme = THEMES.find((x) => x.id === profile.equipped.theme)
  const skin = SHIP_SKINS.find((x) => x.id === profile.equipped.ship)

  // placed ships carry an id = index in FLEET
  const [ships, setShips] = useState(() => withIds(randomFleet()))
  const [dockVertical, setDockVertical] = useState(false)
  const [drag, setDrag] = useState(null) // { id, size, vertical, offR, offC, x, y, cand, valid, moved, fromDock }
  const [busy, setBusy] = useState(false)
  const boardRef = useRef(null)
  const dragRef = useRef(null)
  dragRef.current = drag

  const placedIds = new Set(ships.map((s) => s.id))
  const dock = FLEET.map((size, id) => ({ id, size })).filter((s) => !placedIds.has(s.id))

  const cellAt = useCallback((x, y, touch) => {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return null
    const cell = rect.width / SIZE
    const yy = touch ? y - cell * 0.9 : y
    if (x < rect.left || x > rect.right || yy < rect.top - cell || yy > rect.bottom) return null
    return { r: Math.floor((yy - rect.top) / cell), c: Math.floor((x - rect.left) / cell) }
  }, [])

  const computeCand = (d, x, y, touch) => {
    const cell = cellAt(x, y, touch)
    if (!cell) return { cand: null, valid: false }
    const maxR = d.vertical ? SIZE - d.size : SIZE - 1
    const maxC = d.vertical ? SIZE - 1 : SIZE - d.size
    const cand = {
      id: d.id,
      size: d.size,
      vertical: d.vertical,
      r: Math.max(0, Math.min(maxR, cell.r - d.offR)),
      c: Math.max(0, Math.min(maxC, cell.c - d.offC)),
    }
    return { cand, valid: canPlace(ships, cand, d.id) }
  }

  useEffect(() => {
    if (!drag) return
    const move = (e) => {
      const d = dragRef.current
      if (!d) return
      const moved = d.moved || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6
      const { cand, valid } = computeCand(d, e.clientX, e.clientY, d.touch)
      if (cand && (!d.cand || cand.r !== d.cand.r || cand.c !== d.cand.c) && moved) haptic.tap()
      setDrag({ ...d, x: e.clientX, y: e.clientY, moved, cand, valid })
    }
    const up = () => {
      const d = dragRef.current
      setDrag(null)
      if (!d) return
      if (!d.moved && !d.fromDock) {
        // tap → rotate in place
        const ship = ships.find((s) => s.id === d.id)
        const rotated = { ...ship, vertical: !ship.vertical }
        if (canPlace(ships, rotated, ship.id)) {
          sfx.place()
          haptic.light()
          setShips(ships.map((s) => (s.id === ship.id ? rotated : s)))
        } else {
          sfx.invalid()
          haptic.error()
        }
        return
      }
      if (d.cand && d.valid) {
        sfx.place()
        haptic.medium()
        setShips([...ships.filter((s) => s.id !== d.id), d.cand])
      } else if (d.moved) {
        sfx.invalid()
        haptic.warning()
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [drag !== null, ships]) // eslint-disable-line react-hooks/exhaustive-deps

  const onBoardDown = (e) => {
    const cell = cellAt(e.clientX, e.clientY, false)
    if (!cell) return
    const ship = ships.find((s) => (s.vertical ? s.c === cell.c && cell.r >= s.r && cell.r < s.r + s.size : s.r === cell.r && cell.c >= s.c && cell.c < s.c + s.size))
    if (!ship) return
    e.preventDefault()
    haptic.tap()
    setDrag({
      id: ship.id, size: ship.size, vertical: ship.vertical,
      offR: cell.r - ship.r, offC: cell.c - ship.c,
      sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY,
      touch: e.pointerType === 'touch', moved: false, cand: ship, valid: true, fromDock: false,
    })
  }

  const onDockDown = (e, item) => {
    e.preventDefault()
    haptic.tap()
    setDrag({
      id: item.id, size: item.size, vertical: dockVertical, offR: 0, offC: 0,
      sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY,
      touch: e.pointerType === 'touch', moved: true, cand: null, valid: false, fromDock: true,
    })
  }

  const ready = async () => {
    setBusy(true)
    haptic.heavy()
    const res = await request('game:place', { ships: ships.map(({ r, c, size, vertical }) => ({ r, c, size, vertical })) })
    if (res.error) {
      toast(res.error, 'error')
      setBusy(false)
    }
  }

  const drawn = ships
    .filter((s) => !drag || s.id !== drag.id || !drag.moved)
    .map((s) => ({ ...s, key: s.id, state: 'alive' }))
  if (drag?.cand && drag.moved) drawn.push({ ...drag.cand, key: 'ghost', state: drag.valid ? 'ghost' : 'invalid' })

  const cellPx = boardRef.current ? boardRef.current.getBoundingClientRect().width / SIZE : 34

  return (
    <div>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="h-display text-xl">{t('placement')}</h2>
          <p className="text-xs text-slate-400">{t('placement_hint')}</p>
        </div>
        {deadlineLeft != null && !game.recovering && (
          <div className={`chip shrink-0 whitespace-nowrap ${deadlineLeft <= 10 ? 'bg-rose-500/20 text-rose-200' : 'bg-white/[0.07]'}`}>⏱ {deadlineLeft}s</div>
        )}
      </div>
      {game.recovering && <p role="status" className="mb-3 text-sm text-amber-200">{t('game_recovering')}</p>}

      <Board ref={boardRef} ships={drawn} skin={skin} theme={theme} onPointerDown={onBoardDown} />

      {/* Dock */}
      <div className="mt-4 min-h-[64px] rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-3">
        {dock.length ? (
          <div className="flex flex-wrap items-center gap-2">
            {dock.map((item) => (
              <div
                key={item.id}
                onPointerDown={(e) => onDockDown(e, item)}
                className="touch-none rounded-lg bg-white/[0.04] p-1"
                style={{ width: item.size * 26 + 8, height: 34, opacity: drag?.id === item.id ? 0.3 : 1 }}
              >
                <Ship size={item.size} vertical={false} skin={skin} className="h-full w-full" />
              </div>
            ))}
            <button className="btn-sm ml-auto bg-white/[0.07] text-slate-200" onClick={() => setDockVertical((v) => !v)}>
              <RotateCw size={14} className={dockVertical ? 'rotate-90' : ''} /> {dockVertical ? '↕' : '↔'}
            </button>
          </div>
        ) : (
          <div className="flex h-10 items-center justify-center text-sm font-semibold text-emerald-300">✓ {t('fleet_ready')}</div>
        )}
      </div>

      {/* floating ship while dragging outside the board */}
      {drag && drag.moved && !drag.cand && (
        <div className="pointer-events-none fixed z-50" style={{ left: drag.x - cellPx / 2, top: drag.y - cellPx / 2 - (drag.touch ? cellPx : 0), width: (drag.vertical ? 1 : drag.size) * cellPx, height: (drag.vertical ? drag.size : 1) * cellPx }}>
          <Ship size={drag.size} vertical={drag.vertical} skin={skin} state="ghost" className="h-full w-full" />
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          className="btn-ghost"
          onClick={() => {
            sfx.place()
            haptic.light()
            setShips(withIds(randomFleet()))
          }}
        >
          <Shuffle size={18} /> {t('random')}
        </button>
        <button
          className="btn-ghost"
          onClick={() => {
            haptic.light()
            setShips([])
          }}
        >
          <Eraser size={18} /> {t('clear')}
        </button>
      </div>
      <motion.button whileTap={{ scale: 0.97 }} className="btn-primary mt-3 w-full text-base" disabled={dock.length > 0 || busy} onClick={ready}>
        <Check size={20} strokeWidth={3} /> {dock.length ? t('place_all') : t('ready')}
      </motion.button>
    </div>
  )
}
