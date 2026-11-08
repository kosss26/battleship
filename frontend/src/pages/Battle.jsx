import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useStore } from '../store/app.js'
import { useT } from '../lib/i18n.js'
import { confirmClose } from '../lib/telegram.js'
import Placement from '../game/Placement.jsx'
import BattleView from '../game/BattleView.jsx'
import Results from '../game/Results.jsx'
import { useCountdown } from '../game/parts.jsx'
import { Avatar, Spinner } from '../components/ui.jsx'
import Board from '../components/Board.jsx'
import { battleCosmetics } from '@shared/catalog.js'
import { finalShotDeadline } from '../game/animation.js'

function VersusIntro({ game }) {
  const t = useT()
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 flex items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        <Avatar photo={game.me.profile.photo} name={game.me.profile.name} frame={game.me.profile.frame} size={32} />
        <span className="max-w-[90px] truncate text-sm font-bold">{game.me.profile.name}</span>
      </div>
      <span className="h-display text-sm text-cyan-300">VS</span>
      <div className="flex items-center gap-2">
        <span className="max-w-[90px] truncate text-sm font-bold">{game.opp.profile.name}</span>
        <Avatar photo={game.opp.profile.photo} name={game.opp.profile.name} frame={game.opp.profile.frame} size={32} />
      </div>
      {game.opp.ready && <span className="chip bg-emerald-400/15 text-emerald-300">✓ {t('opponent_ready')}</span>}
    </motion.div>
  )
}

export default function Battle() {
  const t = useT()
  const navigate = useNavigate()
  const game = useStore((s) => s.game)
  const over = useStore((s) => s.over)
  const profile = useStore((s) => s.profile)
  const feed = useStore((s) => s.feed)
  const reducedMotion = useReducedMotion()
  const [finishedAt, setFinishedAt] = useState(0)
  const finalAt = finalShotDeadline(game, over, feed, reducedMotion)
  const holdFinalShot = finalAt > Date.now() && finishedAt !== finalAt
  const left = useCountdown(game?.phase === 'placement' ? game.deadline : null)

  useEffect(() => {
    if (!finalAt) return
    const timer = setTimeout(() => setFinishedAt(finalAt), Math.max(0, finalAt - Date.now()))
    return () => clearTimeout(timer)
  }, [finalAt])

  useEffect(() => {
    if (!game) navigate('/', { replace: true })
  }, [game, navigate])

  useEffect(() => {
    const active = game && game.phase !== 'over'
    confirmClose(!!active)
    return () => confirmClose(false)
  }, [game?.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!game) return null
  if (over && game.phase === 'over' && !holdFinalShot) return <Results over={over} />
  if (game.phase === 'over' && !holdFinalShot) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  if (game.phase === 'placement') {
    if (!game.me.ready) {
      return (
        <div>
          {game.mode !== 'ai' && game.mode !== 'campaign' && <VersusIntro game={game} />}
          <Placement game={game} deadlineLeft={left} />
        </div>
      )
    }
    const { theme, skin, effect } = battleCosmetics(game, profile.equipped)
    return (
      <div>
        <VersusIntro game={game} />
        <div className="opacity-70">
          <Board shots={game.me.shots} ships={game.me.ships.map((s, i) => ({ ...s, key: i, state: 'alive' }))} skin={skin} theme={theme} effect={effect} />
        </div>
        <div className="mt-6 flex flex-col items-center gap-3 text-slate-300">
          <Spinner />
          <div className="font-bold">{t('waiting_opponent')}</div>
          {left != null && <div className="text-sm text-slate-500">⏱ {left}s</div>}
        </div>
      </div>
    )
  }

  return <BattleView game={game} />
}
