import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flag, Smile, Crosshair } from 'lucide-react'
import { opponentCosmetics, battleCosmetics, BOOSTERS, MODIFIERS } from '@shared/catalog.js'
import { inBounds } from '@shared/engine.js'
import Board from '../components/Board.jsx'
import BattleAppearance from '../components/BattleAppearance.jsx'
import { Avatar, Modal, Sheet } from '../components/ui.jsx'
import { useStore } from '../store/app.js'
import { useT, useL } from '../lib/i18n.js'
import { request } from '../lib/socket.js'
import { haptic } from '../lib/telegram.js'
import { sfx } from '../lib/sound.js'
import { TimerRing, FleetStatus, useCountdown } from './parts.jsx'

const EMOTES = ['👋', '😎', '😱', '🔥', '🎯', '🤝', '😂', '💀']

function boosterArea(type, r, c) {
  const cells = type === 'radar'
    ? [-1, 0, 1].flatMap((dr) => [-1, 0, 1].map((dc) => [r + dr, c + dc]))
    : [[r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
  return cells.filter(([a, b]) => inBounds(a, b))
}

export default function BattleView({ game }) {
  const t = useT()
  const l = useL()
  const profile = useStore((s) => s.profile)
  const feed = useStore((s) => s.feed)
  const emote = useStore((s) => s.emote)
  const radar = useStore((s) => s.radar)
  const oppConnected = useStore((s) => s.oppConnected)
  const oppGraceUntil = useStore((s) => s.oppGraceUntil)
  const toast = useStore((s) => s.toast)
  const appearance = useStore(s => s.battleAppearance)

  const { theme, skin, effect } = battleCosmetics(game, profile.equipped)
  const opponent = opponentCosmetics(game)
  const enemyLook = appearance === 'mine' ? {theme,skin} : opponent

  const [booster, setBooster] = useState(null) // { type, r?, c? }
  const [emoteOpen, setEmoteOpen] = useState(false)
  const [resignOpen, setResignOpen] = useState(false)
  const [banner, setBanner] = useState(null)
  const [shakeMine, setShakeMine] = useState(0)
  const [pending, setPending] = useState(false)
  const left = useCountdown(game.deadline)
  const lastFeed = useRef(feed.length ? feed[feed.length - 1].id : 0)
  const myBoardRef = useRef(null)

  // Shake my board when it gets hit (restart the CSS animation without remounting)
  useEffect(() => {
    const el = myBoardRef.current
    if (!shakeMine || !el) return
    const id = setTimeout(() => {
      el.classList.remove('shake')
      void el.offsetWidth
      el.classList.add('shake')
    }, 300)
    return () => clearTimeout(id)
  }, [shakeMine])

  // Banners for notable events
  useEffect(() => {
    const fresh = feed.filter((f) => f.id > lastFeed.current)
    if (!fresh.length) return
    lastFeed.current = fresh[fresh.length - 1].id
    const sunkMine = fresh.find((f) => f.result === 'sunk' && f.by === 'opp')
    const sunkTheirs = fresh.find((f) => f.result === 'sunk' && f.by === 'me')
    const hitMine = fresh.find((f) => f.result !== 'miss' && f.by === 'opp')
    if (hitMine) setShakeMine((n) => n + 1)
    if (sunkTheirs) setBanner({ text: t('you_sunk'), kind: 'good', id: sunkTheirs.id })
    else if (sunkMine) setBanner({ text: t('lost_ship'), kind: 'bad', id: sunkMine.id })
    else if (fresh.some((f) => f.auto && f.by === 'me')) setBanner({ text: t('auto_shot'), kind: 'warn', id: fresh[0].id })
  }, [feed]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!banner) return
    const id = setTimeout(() => setBanner(null), 1600)
    return () => clearTimeout(id)
  }, [banner])

  useEffect(() => {
    if (radar) setBanner({ text: t('radar_result', { n: radar.count }), kind: 'good', id: `r${radar.at}` })
  }, [radar]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!emote) return
    const id = setTimeout(() => useStore.setState({ emote: null }), 2600)
    return () => clearTimeout(id)
  }, [emote])

  useEffect(() => {
    if (!game.myTurn) setBooster(null)
  }, [game.myTurn])

  const myFeed = useMemo(() => feed.filter((f) => f.by === 'opp'), [feed])
  const enemyFeed = useMemo(() => feed.filter((f) => f.by === 'me'), [feed])

  const enemyShips = [
    ...(game.opp.sunk || []).map((s, i) => ({ ...s, key: `s${i}`, state: 'sunk' })),
  ]
  const myShips = (game.me.ships || []).map((s, i) => {
    const sunk = s && game.me.shots && Array.from({ length: s.size }, (_, k) => (s.vertical ? game.me.shots[s.r + k][s.c] : game.me.shots[s.r][s.c + k])).every((v) => v === 3)
    return { ...s, key: i, state: sunk ? 'sunk' : 'alive' }
  })

  const fire = async (r, c) => {
    if (!game.myTurn || pending) return
    if (booster) {
      if (booster.r === r && booster.c === c) {
        setPending(true)
        haptic.heavy()
        const res = await request('game:booster', { type: booster.type, r, c })
        setPending(false)
        setBooster(null)
        if (res.error) toast(res.error, 'error')
      } else {
        haptic.tap()
        setBooster({ ...booster, r, c })
      }
      return
    }
    setPending(true)
    haptic.light()
    const res = await request('game:fire', { r, c })
    setPending(false)
    if (res.error && res.error !== 'not_your_turn') toast(res.error, 'error')
  }

  const highlight = booster?.r != null ? boosterArea(booster.type, booster.r, booster.c) : []
  const accuracy = game.me.stats.shots ? Math.round((game.me.stats.hits / game.me.stats.shots) * 100) : 0
  const graceLeft = oppGraceUntil ? Math.max(0, Math.ceil((oppGraceUntil - Date.now()) / 1000)) : 0

  return (
    <div className="relative">
      {/* Opponent header */}
      <div className="mb-3 flex items-center gap-3">
        <div className="relative">
          <Avatar photo={game.opp.profile.photo} name={game.opp.profile.name} frame={game.opp.profile.frame} size={44} />
          <AnimatePresence>
            {emote && (
              <motion.div
                key={emote.at}
                initial={{ scale: 0, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute -bottom-9 left-5 z-30 rounded-2xl rounded-tl-sm bg-white px-2 py-1 text-2xl shadow-xl"
              >
                {emote.emote}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-extrabold">{game.opp.profile.name}</span>
            {!oppConnected && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-rose-500" />}
          </div>
          <div className="mt-1">
            <FleetStatus remaining={game.opp.remaining} compact color="bg-rose-300" />
          </div>
        </div>
        {game.phase !== 'over' && !game.recovering && <TimerRing left={left} active={game.myTurn} total={(game.turnMs || 30000) / 1000} />}
        {game.mode !== 'ai' && game.mode !== 'campaign' && (
          <button disabled={game.phase === 'over'} className="rounded-2xl bg-white/[0.06] p-2.5 disabled:opacity-40" onClick={() => setEmoteOpen(true)} aria-label={t('emotes')}>
            <Smile size={20} />
          </button>
        )}
        <button disabled={game.phase === 'over'} className="rounded-2xl bg-white/[0.06] p-2.5 disabled:opacity-40" onClick={() => setResignOpen(true)} aria-label={t('resign')}>
          <Flag size={20} />
        </button>
      </div>

      {/* Turn status */}
      <div className="relative mb-2 h-9">
        <AnimatePresence mode="wait">
          {banner ? (
            <motion.div
              key={banner.id}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute inset-0 flex items-center justify-center rounded-2xl text-sm font-black ${
                banner.kind === 'good' ? 'bg-emerald-400 text-ink-950' : banner.kind === 'bad' ? 'bg-rose-500 text-white' : 'bg-amber-400 text-ink-950'
              }`}
            >
              {banner.text}
            </motion.div>
          ) : (
            <motion.div
              key={game.myTurn ? 'me' : 'opp'}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              className={`absolute inset-0 flex items-center justify-center gap-2 rounded-2xl text-sm font-extrabold ${
                game.myTurn ? 'bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/30' : 'bg-white/[0.05] text-slate-300'
              }`}
            >
              {game.myTurn ? <Crosshair size={16} /> : <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" />}
              {game.recovering ? t('game_recovering') : game.phase === 'over' ? t('fx_finishing') : !oppConnected ? t('opp_disconnected', { s: graceLeft }) : game.myTurn ? (booster ? t('booster_pick', { name: l(BOOSTERS[booster.type].name) }) : t('your_turn')) : t('their_turn')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mission rules */}
      {game.mods && Object.keys(game.mods).length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {Object.keys(game.mods).filter((k) => k !== 'ammo').map((k) => (
            <span key={k} className="chip bg-white/[0.06] text-[11px] text-slate-300">{MODIFIERS[k].icon} {l(MODIFIERS[k].name)}</span>
          ))}
          {game.ammoLeft != null && (
            <span className={`chip ml-auto text-[12px] ${game.ammoLeft <= 10 ? 'bg-rose-500/20 text-rose-200' : 'bg-amber-300/15 text-amber-200'}`}>
              🎯 {t('ammo_left', { n: game.ammoLeft })}
            </span>
          )}
        </div>
      )}

      {/* Enemy board */}
      <BattleAppearance />
      <div className={`relative transition-all duration-300 ${game.myTurn ? '' : 'opacity-80 saturate-[0.85]'}`}>
        {game.mods?.fog && <div className="fog-overlay pointer-events-none absolute inset-0 z-[45] ml-[18px] mt-[18px] rounded-2xl" />}
        <Board
          shots={game.opp.shots}
          hideNewSunk
          ships={enemyShips}
          skin={enemyLook.skin}
          effect={effect}
          feed={enemyFeed}
          theme={enemyLook.theme}
          onCell={game.myTurn && !pending ? fire : null}
          highlight={highlight}
          scans={game.me.scans}
        />
      </div>

      {/* Boosters */}
      {game.boostersAllowed && (
        <div className="mt-3 flex items-center gap-2">
          {Object.values(BOOSTERS).map((b) => {
            const owned = profile.boosters[b.id] || 0
            const active = booster?.type === b.id
            const disabled = !game.myTurn || game.boostersLeft <= 0 || owned <= 0
            return (
              <button
                key={b.id}
                disabled={!game.myTurn || game.boostersLeft <= 0}
                onClick={() => {
                  if (owned <= 0) return toast('no_booster', 'error')
                  sfx.tap()
                  haptic.light()
                  setBooster(active ? null : { type: b.id })
                }}
                className={`flex flex-1 items-center gap-2 rounded-2xl px-3 py-2 text-left transition-all ${
                  active ? 'bg-amber-300 text-ink-950 shadow-gold' : 'bg-white/[0.05] ring-1 ring-white/10'
                } ${disabled && !active ? 'opacity-45' : ''}`}
              >
                <span className="text-xl">{b.icon}</span>
                <span className="flex-1 text-[13px] font-extrabold">{l(b.name)}</span>
                <span className={`rounded-lg px-1.5 text-xs font-black ${active ? 'bg-ink-950/20' : 'bg-white/10'}`}>{owned}</span>
              </button>
            )
          })}
          <div className="w-12 text-center text-[10px] font-bold leading-tight text-slate-500">{game.boostersLeft}/2</div>
        </div>
      )}

      {/* My fleet */}
      <div className="mt-3 flex gap-3">
        <div className="w-[46%] shrink-0">
          <div ref={myBoardRef}>
            <Board shots={game.me.shots} ships={myShips} skin={skin} effect={opponent.effect} feed={myFeed} theme={theme} labels={false} small />
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-between py-1">
          <div>
            <div className="label mb-1.5">{t('your_fleet')}</div>
            <FleetStatus remaining={game.me.remaining} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/[0.04] p-2.5">
              <div className="text-[10px] font-bold uppercase text-slate-500">{t('shots')}</div>
              <div className="font-display text-lg font-bold">{game.me.stats.shots}</div>
            </div>
            <div className="rounded-2xl bg-white/[0.04] p-2.5">
              <div className="text-[10px] font-bold uppercase text-slate-500">{t('accuracy')}</div>
              <div className="font-display text-lg font-bold">{accuracy}%</div>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={emoteOpen} onClose={() => setEmoteOpen(false)} title={t('emotes')}>
        <div className="grid grid-cols-4 gap-3">
          {EMOTES.map((e) => (
            <button
              key={e}
              className="flex aspect-square items-center justify-center rounded-3xl bg-white/[0.06] text-4xl active:scale-90"
              onClick={() => {
                request('game:emote', { emote: e })
                haptic.light()
                setEmoteOpen(false)
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </Sheet>

      <Modal open={resignOpen} onClose={() => setResignOpen(false)}>
        <div className="glass-strong p-6 text-center">
          <div className="mb-2 text-5xl">🏳️</div>
          <div className="mb-5 font-bold">{t('resign_confirm')}</div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => setResignOpen(false)}>{t('cancel')}</button>
            <button
              className="btn h-12 bg-rose-500 text-white"
              onClick={() => {
                setResignOpen(false)
                request('game:resign')
              }}
            >
              {t('resign')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

