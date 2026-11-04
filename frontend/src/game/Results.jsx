import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Home, RotateCcw, Share2, Swords, ChevronRight, UserPlus } from 'lucide-react'
import { post } from '../lib/api.js'
import { useNavigate } from 'react-router-dom'
import { ACHIEVEMENTS, QUESTS, CAMPAIGN } from '@shared/catalog.js'
import { useStore } from '../store/app.js'
import { useT, useL } from '../lib/i18n.js'
import { request } from '../lib/socket.js'
import { shareLink } from '../lib/telegram.js'
import { startAi, startCampaign } from '../lib/play.js'
import { RewardChips, Stars, Avatar } from '../components/ui.jsx'
import Board from '../components/Board.jsx'
import { AdButton } from '../components/Ads.jsx'
import { StoryButton, HomeScreenPrompt, inviteLink } from '../components/Share.jsx'
import { THEMES, SHIP_SKINS } from '@shared/catalog.js'

function Confetti() {
  const pieces = Array.from({ length: 36 }, (_, i) => i)
  const colors = ['#22d3ee', '#fbbf24', '#f472b6', '#a78bfa', '#34d399']
  return (
    <div className="pointer-events-none fixed inset-0 z-[55] overflow-hidden">
      {pieces.map((i) => (
        <motion.div
          key={i}
          className="absolute top-0 h-3 w-2 rounded-sm"
          style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length] }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{ y: '105vh', rotate: 360 + i * 40, x: ((i % 5) - 2) * 30 }}
          transition={{ duration: 2.2 + (i % 6) * 0.25, delay: (i % 8) * 0.06, ease: 'easeIn' }}
        />
      ))}
    </div>
  )
}

const fmtTime = (ms) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function Results({ over }) {
  const t = useT()
  const l = useL()
  const navigate = useNavigate()
  const profile = useStore((s) => s.profile)
  const config = useStore((s) => s.config)
  const leaveGame = useStore((s) => s.leaveGame)
  const rematchOffered = useStore((s) => s.rematchOffered)
  const [rematchWait, setRematchWait] = useState(false)
  const [showBoard, setShowBoard] = useState(false)
  const [friendSent, setFriendSent] = useState(false)
  const doubleGold = useStore((s) => s.profile?.ads?.doubleGold || 0)
  const game = over.state
  const { won, rewards, extra, myStats, durationMs, reason } = over
  const accuracy = myStats.shots ? Math.round((myStats.hits / myStats.shots) * 100) : 0
  const theme = THEMES.find((x) => x.id === profile.equipped.theme)
  const skin = SHIP_SKINS.find((x) => x.id === profile.equipped.ship)

  useEffect(() => {
    useStore.setState({ feed: [] })
  }, [])

  const reasonText = reason === 'victory' ? null
    : reason === 'resign' ? (won ? t('reason_resign') : t('reason_resign_me'))
      : t(`reason_${reason}`)

  const home = () => {
    leaveGame()
    navigate('/', { replace: true })
  }

  const again = async () => {
    if (game.mode === 'ai') {
      leaveGame()
      await startAi(game.difficulty)
    } else if (game.mode === 'campaign') {
      const next = won && CAMPAIGN.find((x) => x.n === game.level + 1)
      leaveGame()
      await startCampaign(next ? next.n : game.level)
    } else if (game.mode === 'ranked') {
      leaveGame()
      navigate('/search', { replace: true })
    } else if (game.mode === 'duel') {
      setRematchWait(true)
      const res = await request('game:rematch')
      if (res.error) {
        setRematchWait(false)
        useStore.getState().toast(res.error, 'error')
      }
    }
  }

  const share = () => {
    const link = inviteLink(config, profile)
    shareLink(link, won ? t('share_text_win', { shots: myStats.shots, acc: accuracy }) : t('share_text'))
  }

  const againLabel = game.mode === 'duel' ? (rematchWait ? t('rematch_wait') : t('rematch'))
    : game.mode === 'campaign' && won && game.level < CAMPAIGN.length ? t('next_level') : t('play_again')

  return (
    <>
      {won && <Confetti />}
      <div className="relative">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }} className="mb-5 pt-4 text-center">
          <div className="relative mx-auto mb-3 h-24 w-24">
            <div className={`absolute inset-0 rounded-full blur-2xl ${won ? 'bg-amber-300/50' : 'bg-rose-500/30'}`} />
            <div className="relative flex h-full w-full items-center justify-center text-6xl">{won ? '🏆' : '⚓'}</div>
          </div>
          <h1 className={`h-display text-4xl ${won ? 'bg-gradient-to-b from-amber-100 to-amber-400 bg-clip-text text-transparent' : 'text-slate-200'}`}>
            {won ? t('victory') : t('defeat')}
          </h1>
          {reasonText && <div className="mt-1 text-sm text-slate-400">{reasonText}</div>}
          {game.mode === 'campaign' && won && extra?.stars > 0 && (
            <div className="mt-3 flex justify-center"><Stars n={extra.stars} size={30} /></div>
          )}
        </motion.div>

        <div className="glass mb-3 flex items-center gap-3 p-3">
          <Avatar photo={game.me.profile.photo} name={game.me.profile.name} frame={game.me.profile.frame} size={36} />
          <div className="flex-1 truncate text-sm font-bold">{game.me.profile.name}</div>
          <span className="font-display text-sm font-bold text-slate-400">VS</span>
          <div className="flex-1 truncate text-right text-sm font-bold">{game.opp.profile.name}</div>
          <Avatar photo={game.opp.profile.photo} name={game.opp.profile.name} frame={game.opp.profile.frame} size={36} />
        </div>
        {!game.opp.profile.bot && typeof game.opp.profile.id === 'number' && !friendSent && (
          <button
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.04] py-2.5 text-sm font-bold text-cyan-200"
            onClick={async () => {
              try {
                const r = await post('/me/friends', { id: game.opp.profile.id })
                useStore.getState().toast(r.status === 'accepted' ? t('friend_added') : t('request_sent'), 'success')
              } catch (e) {
                useStore.getState().toast(e.code || 'error_generic', 'error')
              }
              setFriendSent(true)
            }}
          >
            <UserPlus size={16} /> {t('add_to_friends')}: {game.opp.profile.name}
          </button>
        )}

        <div className="mb-3 grid grid-cols-4 gap-2">
          {[
            [t('shots'), myStats.shots],
            [t('accuracy'), `${accuracy}%`],
            [t('ships_sunk'), myStats.sunk],
            [t('duration'), fmtTime(durationMs)],
          ].map(([k, v]) => (
            <div key={k} className="glass rounded-2xl p-2.5 text-center">
              <div className="font-display text-lg font-bold">{v}</div>
              <div className="text-[10px] font-bold uppercase text-slate-500">{k}</div>
            </div>
          ))}
        </div>

        {(rewards || extra?.ratingDelta || extra?.ratingNote) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass mb-3 p-4">
            <div className="label mb-2.5">{t('rewards')}</div>
            {extra?.ratingNote && (extra.ratingNote !== 'early_forfeit' || won) && (
              <div className="mb-3 rounded-2xl bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200">⚠️ {t(`rating_note_${extra.ratingNote}`)}</div>
            )}
            {extra?.ratingDelta ? (
              <div className="mb-3 flex items-center justify-between rounded-2xl bg-white/[0.04] px-3 py-2">
                <span className="text-sm font-bold">{t('rating')}</span>
                <span className="font-display font-bold">
                  {extra.rating}{' '}
                  <span className={extra.ratingDelta > 0 ? 'text-emerald-300' : 'text-rose-300'}>
                    {extra.ratingDelta > 0 ? '+' : ''}{extra.ratingDelta}
                  </span>
                </span>
              </div>
            ) : null}
            <RewardChips reward={rewards} size="lg" />
            {doubleGold > 0 && (
              <AdButton placement="double" className="mt-3 w-full">{t('ad_double', { n: doubleGold })}</AdButton>
            )}
            {rewards?.levelUps?.length > 0 && (
              <div className="mt-3 rounded-2xl bg-cyan-400/10 py-2 text-center text-sm font-bold text-cyan-200">⬆️ {t('level_up', { n: rewards.levelUps.at(-1) })}</div>
            )}
            {rewards?.achievements?.map((id) => {
              const a = ACHIEVEMENTS.find((x) => x.id === id)
              return (
                <div key={id} className="mt-2 flex items-center gap-3 rounded-2xl bg-amber-300/10 p-2.5">
                  <span className="text-2xl">{a?.icon}</span>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-amber-300">{t('achievement_unlocked')}</div>
                    <div className="text-sm font-bold">{l(a?.title)}</div>
                  </div>
                </div>
              )
            })}
            {rewards?.quests?.map((id) => {
              const q = QUESTS.find((x) => x.id === id)
              return (
                <div key={id} className="mt-2 flex items-center gap-3 rounded-2xl bg-emerald-300/10 p-2.5 text-sm">
                  <span>✅</span>
                  <span><b>{t('quest_done')}:</b> {l(q?.title)}</span>
                </div>
              )
            })}
          </motion.div>
        )}

        {game.opp.ships && (
          <button className="mb-3 flex w-full items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-bold" onClick={() => setShowBoard((v) => !v)}>
            {t('enemy_waters')} <ChevronRight size={18} className={`transition-transform ${showBoard ? 'rotate-90' : ''}`} />
          </button>
        )}
        {showBoard && game.opp.ships && (
          <div className="mb-3">
            <Board shots={game.opp.shots} ships={game.opp.ships.map((s, i) => ({ ...s, key: i, state: 'alive' }))} skin={skin} theme={theme} />
          </div>
        )}

        {rematchOffered && !rematchWait && game.mode === 'duel' && (
          <div className="mb-2 rounded-2xl bg-fuchsia-400/15 p-3 text-center text-sm font-bold text-fuchsia-200">{t('rematch_offer')}</div>
        )}

        <button className="btn-primary mb-2 w-full text-base" onClick={again} disabled={rematchWait}>
          {game.mode === 'duel' ? <Swords size={20} /> : <RotateCcw size={20} />} {againLabel}
        </button>
        {won && <StoryButton over={over} className="mb-2 w-full" />}
        <HomeScreenPrompt games={profile.stats.games} />
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost" onClick={home}><Home size={18} /> {t('home')}</button>
          <button className="btn-ghost" onClick={share}><Share2 size={18} /> {t('share')}</button>
        </div>
      </div>
    </>
  )
}
