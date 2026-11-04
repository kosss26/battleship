import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, BellRing, Swords } from 'lucide-react'
import { randomFleet, createBoard, fire } from '@shared/engine.js'
import { mulberry32 } from '@shared/rng.js'
import { THEMES, SHIP_SKINS, EFFECTS } from '@shared/catalog.js'
import { useStore } from '../store/app.js'
import { useT } from '../lib/i18n.js'
import { haptic, requestWriteAccess, isTelegram } from '../lib/telegram.js'
import { sfx } from '../lib/sound.js'
import { startAi } from '../lib/play.js'
import Board from './Board.jsx'
import Ship from './Ship.jsx'
import { LegalLinks } from './LegalLinks.jsx'

const DEMO_FLEET = randomFleet(mulberry32(7))

function RadarArt() {
  return (
    <div className="relative mx-auto h-48 w-48">
      {[0, 1, 2].map((i) => <div key={i} className="absolute rounded-full border border-cyan-300/30" style={{ inset: i * 26 }} />)}
      <div className="absolute inset-0 animate-sweep rounded-full" style={{ background: 'conic-gradient(from 0deg, rgba(34,211,238,0.45), transparent 25%)' }} />
      <div className="absolute left-[28%] top-[30%] h-2.5 w-2.5 animate-pulse rounded-full bg-rose-400 shadow-[0_0_12px_#fb7185]" />
      <div className="absolute left-[64%] top-[62%] h-2 w-2 animate-pulse rounded-full bg-rose-400 shadow-[0_0_12px_#fb7185]" />
      <div className="absolute inset-0 flex items-center justify-center text-5xl">⚓</div>
    </div>
  )
}

function FleetArt({ theme, skin }) {
  return (
    <div className="mx-auto w-56">
      <Board ships={DEMO_FLEET.map((s, i) => ({ ...s, key: i, state: 'alive' }))} skin={skin} theme={theme} labels={false} small />
      <div className="mt-3 flex items-end justify-center gap-2">
        {[4, 3, 2, 1].map((n) => (
          <div key={n} className="flex flex-col items-center gap-1">
            <div style={{ width: n * 16, height: 18 }}><Ship size={n} skin={skin} className="h-full w-full" /></div>
            <span className="text-[10px] font-bold text-slate-400">×{5 - n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Plays a short scripted volley on a mini board to show hits, misses and a sinking */
function ShootingArt({ theme, skin, effect }) {
  const target = useMemo(() => [{ r: 3, c: 2, size: 3, vertical: false }], [])
  const script = useMemo(() => [[6, 6], [3, 3], [3, 4], [3, 2]], [])
  const [state, setState] = useState(() => ({ board: createBoard(target), feed: [], step: 0 }))

  useEffect(() => {
    let i = 0
    let board = createBoard(target)
    let feed = []
    const id = setInterval(() => {
      if (i >= script.length + 3) {
        i = 0
        board = createBoard(target)
        feed = []
        setState({ board, feed, step: 0 })
        return
      }
      if (i < script.length) {
        const [r, c] = script[i]
        const res = fire(board, r, c)
        feed = [...feed, { id: Date.now() + i, r, c, result: res.result }]
        setState({ board: { ...board, shots: board.shots.map((row) => [...row]) }, feed, step: i + 1 })
      }
      i++
    }, 900)
    return () => clearInterval(id)
  }, [target, script])

  const sunk = state.board.ships[0].hits >= 3
  return (
    <div className="mx-auto w-56">
      <Board shots={state.board.shots} ships={sunk ? target.map((s) => ({ ...s, key: 's', state: 'sunk' })) : []} feed={state.feed} skin={skin} effect={effect} theme={theme} labels={false} small />
    </div>
  )
}

function RewardsArt() {
  const items = [['🎁', 'from-amber-300 to-orange-500'], ['📜', 'from-emerald-300 to-teal-500'], ['🏆', 'from-fuchsia-400 to-violet-500'], ['📡', 'from-sky-300 to-blue-500'], ['💥', 'from-rose-400 to-orange-500'], ['💎', 'from-violet-300 to-fuchsia-500']]
  return (
    <div className="mx-auto grid w-56 grid-cols-3 gap-3">
      {items.map(([icon, c], i) => (
        <motion.div key={i} initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: i * 0.08, type: 'spring', stiffness: 300, damping: 15 }} className={`flex aspect-square items-center justify-center rounded-3xl bg-gradient-to-br ${c} text-3xl shadow-lg`}>
          {icon}
        </motion.div>
      ))}
    </div>
  )
}

function BellArt({ on }) {
  return (
    <motion.div animate={on ? { rotate: [0, -15, 15, -10, 10, 0] } : { y: [0, -6, 0] }} transition={{ duration: on ? 0.8 : 2.4, repeat: on ? 0 : Infinity }} className="mx-auto flex h-36 w-36 items-center justify-center rounded-[40px] bg-gradient-to-br from-cyan-300 to-blue-500 text-ink-950 shadow-glow">
      {on ? <BellRing size={64} /> : <Bell size={64} />}
    </motion.div>
  )
}

export default function Onboarding() {
  const t = useT()
  const profile = useStore((s) => s.profile)
  const mutate = useStore((s) => s.mutate)
  const updateSettings = useStore((s) => s.updateSettings)
  const toast = useStore((s) => s.toast)
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const [notifOn, setNotifOn] = useState(false)
  const theme = THEMES.find((x) => x.id === profile.equipped.theme)
  const skin = SHIP_SKINS.find((x) => x.id === profile.equipped.ship)
  const effect = EFFECTS.find((x) => x.id === profile.equipped.effect)

  const slides = [
    { title: t('tut1_title'), text: t('tut1_text'), art: <RadarArt /> },
    { title: t('tut2_title'), text: t('tut2_text'), art: <FleetArt theme={theme} skin={skin} /> },
    { title: t('tut3_title'), text: t('tut3_text'), art: <ShootingArt theme={theme} skin={skin} effect={effect} /> },
    { title: t('tut4_title'), text: t('tut4_text'), art: <RewardsArt /> },
    { title: t('tut5_title'), text: t('tut5_text'), art: <BellArt on={notifOn} /> },
  ]
  const last = i === slides.length - 1

  const go = (n) => {
    if (n < 0 || n >= slides.length) return
    sfx.tap()
    haptic.tap()
    setDir(n > i ? 1 : -1)
    setI(n)
  }

  const finish = async (training) => {
    useStore.setState({ showTutorial: false })
    if (!profile.onboarded) await mutate('/me/onboarded', {}, { popup: false }).catch(() => {})
    if (training) await startAi('easy')
  }

  const allowNotifications = async () => {
    haptic.light()
    const granted = isTelegram() ? await requestWriteAccess() : true
    if (granted) {
      setNotifOn(true)
      haptic.success()
      if (profile.settings.notify === false) updateSettings({ notify: true })
      toast(t('notifications_on'), 'success')
    } else toast(t('notif_denied'))
  }

  return (
    <motion.div className="app-bg fixed inset-0 z-[70] flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="flex justify-end px-5" style={{ paddingTop: 'calc(var(--safe-top) + 14px)' }}>
        {!last && <button className="text-sm font-bold text-slate-400" onClick={() => finish(false)}>{t('tut_skip')}</button>}
        {last && <div className="h-5" />}
      </div>
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={i}
            custom={dir}
            initial={{ x: dir * 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir * -320, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.4}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) go(i + 1)
              else if (info.offset.x > 60) go(i - 1)
            }}
            className="absolute inset-0 mx-auto flex max-w-md flex-col items-center justify-center px-7 text-center"
          >
            <div className="mb-8 w-full">{slides[i].art}</div>
            <h2 className="h-display mb-3 text-[24px] leading-tight">{slides[i].title}</h2>
            <p className="text-[15px] leading-relaxed text-slate-300">{slides[i].text}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mx-auto w-full max-w-md px-5" style={{ paddingBottom: 'calc(20px + var(--safe-bottom))' }}>
        <div className="mb-5 flex justify-center gap-1.5">
          {slides.map((_, n) => (
            <button key={n} onClick={() => go(n)} className={`h-2 rounded-full transition-all ${n === i ? 'w-6 bg-cyan-300' : 'w-2 bg-white/20'}`} aria-label={`${n + 1}`} />
          ))}
        </div>
        {last ? (
          <div className="space-y-2">
            <button className="btn-ghost w-full" onClick={allowNotifications} disabled={notifOn}>
              {notifOn ? <><BellRing size={18} /> {t('notifications_on')}</> : <><Bell size={18} /> {t('allow_notifications')}</>}
            </button>
            <p className="px-2 pb-1 text-center text-[11px] leading-relaxed text-slate-500"><LegalLinks textKey="legal_consent" onOpen={() => useStore.setState({ showTutorial: false })} /></p>
            {profile.stats.games === 0 ? (
              <button className="btn-primary w-full text-base" onClick={() => finish(true)}>
                <Swords size={20} /> {t('start_training')}
              </button>
            ) : (
              <button className="btn-primary w-full text-base" onClick={() => finish(false)}>{t('to_menu')}</button>
            )}
          </div>
        ) : (
          <button className="btn-primary w-full text-base" onClick={() => go(i + 1)}>{t('tut_next')}</button>
        )}
      </div>
    </motion.div>
  )
}

