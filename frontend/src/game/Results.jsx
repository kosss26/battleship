import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
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
import { battleCosmetics, opponentCosmetics } from '@shared/catalog.js'
import { shipCells, CELL } from '@shared/engine.js'
import ResultMedallion from '../components/ResultMedallion.jsx'
import BattleAppearance from '../components/BattleAppearance.jsx'
import {MedalArt,achievementMedal} from '../components/NavalIdentity.jsx'
import '../styles/battle-report.css'

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
  const appearance = useStore(s => s.battleAppearance)
  const reducedMotion = useReducedMotion()
  const [reportSide,setReportSide] = useState('opponent')
  const game = over.state
  const { won, rewards, extra, myStats, durationMs, reason } = over
  const cancelled = reason === 'server_restart'
  const accuracy = myStats.shots ? Math.round((myStats.hits / myStats.shots) * 100) : 0
  const mine = battleCosmetics(game, profile.equipped)
  const opponent = opponentCosmetics(game)
  const reportLook = reportSide==='mine' || appearance==='mine' ? mine : opponent
  const reportBoard = reportSide==='mine' ? game.me : game.opp
  const reportEffect = reportSide==='mine' ? opponent.effect : mine.effect

  useEffect(() => {
    useStore.setState({ feed: [] })
  }, [])

  const reasonText = reason === 'victory' ? null
    : reason === 'resign' ? (won ? t('reason_resign') : t('reason_resign_me'))
      : t(`reason_${reason}`)

  const home = () => {
    leaveGame()
    navigate(game.demoFleet ? '/fleet/regent' : '/', { replace: true })
  }

  const again = async () => {
    if (game.mode === 'ai') {
      leaveGame()
      await startAi(game.difficulty, { demoFleet: game.demoFleet || undefined })
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
      {won && !reducedMotion && <Confetti />}
      <div className={`battle-report ${won?'is-victory':cancelled?'is-cancelled':'is-defeat'}`} data-battle-report>
        <motion.div initial={reducedMotion ? false : { y:12, opacity:0 }} animate={{ y:0, opacity:1 }} transition={{ duration:.35 }} className="report-hero">
          <div className="report-kicker"><span>BATTLESHIP</span><span>{t('battle_report')}</span></div>
          <ResultMedallion won={won} cancelled={cancelled}/>
          <h1>
            {cancelled ? t('battle_cancelled') : won ? t('victory') : t('defeat')}
          </h1>
          <p className="report-outcome">{cancelled?t('report_cancelled'):won?t('report_win'):t('report_loss')}</p>
          {game.demoFleet && <p className="report-trial-note">{t('regent_trial_note')}</p>}
          {reasonText && <div className="report-reason">{reasonText}</div>}
          {game.mode === 'campaign' && won && extra?.stars > 0 && (
            <div className="mt-3 flex justify-center"><Stars n={extra.stars} size={30} /></div>
          )}
        </motion.div>

        <div className="report-versus">
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

        <div className="report-stats">
          {[
            [t('shots'), myStats.shots],
            [t('accuracy'), `${accuracy}%`],
            [t('ships_sunk'), myStats.sunk],
            [t('duration'), fmtTime(durationMs)],
          ].map(([k, v]) => (
            <div key={k} className="report-stat">
              <strong>{v}</strong>
              <span>{k}</span>
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
            {!game.demoFleet && doubleGold > 0 && (
              <AdButton placement="double" className="mt-3 w-full">{t('ad_double', { n: doubleGold })}</AdButton>
            )}
            {rewards?.levelUps?.length > 0 && (
              <div className="mt-3 rounded-2xl bg-cyan-400/10 py-2 text-center text-sm font-bold text-cyan-200">⬆️ {t('level_up', { n: rewards.levelUps.at(-1) })}</div>
            )}
            {rewards?.achievements?.map((id) => {
              const a = ACHIEVEMENTS.find((x) => x.id === id)
              return (
                <div key={id} className="mt-2 flex items-center gap-3 rounded-2xl bg-amber-300/10 p-2.5">
                  {a&&<MedalArt type={achievementMedal(a)} className="report-achievement-medal"/>}
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
          <button className="report-board-toggle" aria-expanded={showBoard} onClick={() => setShowBoard((v) => !v)}>
            <span><b>{t('report_review')}</b><small>{t('report_review_hint')}</small></span><ChevronRight size={18} className={`transition-transform ${showBoard ? 'rotate-90' : ''}`} />
          </button>
        )}
        {showBoard && reportBoard.ships && (
          <div className="report-board" data-report-board>
            <div className="report-side-picker" role="group" aria-label={t('report_review')}>
              {['opponent','mine'].map(side=><button key={side} aria-pressed={reportSide===side} onClick={()=>setReportSide(side)}>{side==='mine'?t('your_fleet'):t('enemy_waters')}</button>)}
            </div>
            {reportSide==='opponent'&&<BattleAppearance/>}
            <Board shots={reportBoard.shots} ships={reportBoard.ships.map((s, i) => ({ ...s, key:i, state:shipCells(s).every(([r,c])=>reportBoard.shots?.[r]?.[c]===CELL.SUNK)?'sunk':'alive' }))} skin={reportLook.skin} theme={reportLook.theme} effect={reportEffect} />
          </div>
        )}

        {rematchOffered && !rematchWait && game.mode === 'duel' && (
          <div className="mb-2 rounded-2xl bg-fuchsia-400/15 p-3 text-center text-sm font-bold text-fuchsia-200">{t('rematch_offer')}</div>
        )}

        <button className="report-primary" onClick={again} disabled={rematchWait}>
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
