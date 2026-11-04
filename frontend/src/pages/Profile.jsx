import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, Globe, Volume2, Vibrate, Users, Award, LifeBuoy, ShieldCheck, Music, Bell, GraduationCap, FileText, Lock, Trash2,
} from 'lucide-react'
import { ACHIEVEMENTS, seasonInfo, RANKS } from '@shared/catalog.js'
import { useStore } from '../store/app.js'
import { useT, useL } from '../lib/i18n.js'
import { api } from '../lib/api.js'
import { openLink, requestWriteAccess, isTelegram } from '../lib/telegram.js'
import { Avatar, Progress, RankBadge, Toggle, Segmented, Empty, Spinner, Modal } from '../components/ui.jsx'
import { SeasonEmblem } from '../components/Season.jsx'

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] p-3">
      <div className="font-display text-xl font-bold">{value}</div>
      <div className="text-[11px] font-bold uppercase text-slate-500">{label}</div>
    </div>
  )
}

function History() {
  const t = useT()
  const [games, setGames] = useState(null)
  useEffect(() => {
    api('/me/history').then((d) => setGames(d.games)).catch(() => setGames([]))
  }, [])
  if (!games) return <div className="flex justify-center py-6"><Spinner size={22} /></div>
  if (!games.length) return <Empty icon="⚓" text={t('no_history')} />
  return (
    <div className="space-y-2">
      {games.slice(0, 10).map((g) => (
        <div key={g.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${g.won ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
            {g.won ? 'W' : 'L'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">
              {t(`mode_${g.mode}`)}
              {g.mode === 'ai' && g.difficulty ? ` · ${t(`diff_${g.difficulty}`)}` : ''}
              {g.opponent ? ` · ${g.opponent}` : ''}
            </div>
            <div className="text-[11px] text-slate-500">{new Date(g.endedAt).toLocaleString()}</div>
          </div>
          {g.mode === 'ranked' && (
            <span className={`text-sm font-black ${g.ratingDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{g.ratingDelta > 0 ? '+' : ''}{g.ratingDelta}</span>
          )}
        </div>
      ))}
    </div>
  )
}

function SeasonHistory() {
  const t = useT()
  const l = useL()
  const [data, setData] = useState(null)
  useEffect(() => {
    api('/me/seasons').then(setData).catch(() => {})
  }, [])
  if (!data?.history?.length) return null
  return (
    <div className="mb-4">
      <div className="label mb-2 px-1">{t('season_history')}</div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {data.history.map((h) => {
          const s = seasonInfo(h.season)
          const rank = RANKS.find((r) => r.id === h.rank) || RANKS[0]
          return (
            <div key={h.season} className="glass flex w-36 shrink-0 flex-col items-center p-3 text-center">
              <SeasonEmblem season={s} size={40} />
              <div className="mt-2 text-[11px] font-bold" style={{ color: s.color }}>{t('season_n', { n: s.number })}</div>
              <div className="text-xs text-slate-400">{l(s.name)}</div>
              <div className="mt-1 text-sm font-extrabold">{rank.icon} {l(rank.name)}</div>
              <div className="text-[11px] text-slate-500">⚡{h.rating}{h.place ? ` · #${h.place}` : ''}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DeleteAccount({ open, onClose }) {
  const t = useT()
  const deleteAccount = useStore((s) => s.deleteAccount)
  const toast = useStore((s) => s.toast)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = word.trim().toUpperCase() === t('delete_account_word')
  return (
    <Modal open={open} onClose={onClose}>
      <div className="glass-strong p-6 text-center">
        <div className="mb-2 text-5xl">🗑️</div>
        <div className="mb-2 font-display text-lg font-bold">{t('delete_account_title')}</div>
        <p className="mb-4 text-sm text-slate-300">{t('delete_account_text')}</p>
        <input
          className="mb-4 h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-sm font-bold outline-none focus:border-rose-400/60"
          placeholder={t('delete_account_type')}
          value={word}
          onChange={(e) => setWord(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button
            className="btn h-12 bg-rose-500 text-white"
            disabled={!ok || busy}
            onClick={async () => {
              setBusy(true)
              try {
                await deleteAccount()
              } catch (e) {
                toast(e.code || 'error_generic', 'error')
                setBusy(false)
              }
            }}
          >
            {t('delete_account')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function Profile() {
  const t = useT()
  const navigate = useNavigate()
  const p = useStore((s) => s.profile)
  const config = useStore((s) => s.config)
  const updateSettings = useStore((s) => s.updateSettings)
  const friendsBadge = useStore((s) => s.friendsBadge)
  const [deleting, setDeleting] = useState(false)
  const s = p.stats
  const winrate = s.games ? Math.round((s.wins / s.games) * 100) : 0
  const accuracy = s.shots ? Math.round((s.hits / s.shots) * 100) : 0
  const achCount = Object.keys(p.achievements).length

  const Row = ({ icon: Icon, label, right, onClick }) => {
    const Tag = onClick ? 'button' : 'div'
    return (
      <Tag onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <Icon size={20} className="text-slate-400" />
        <span className="flex-1 text-sm font-bold">{label}</span>
        {right ?? <ChevronRight size={18} className="text-slate-500" />}
      </Tag>
    )
  }

  return (
    <div>
      <div className="glass relative mb-4 overflow-hidden p-5 text-center">
        <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative mx-auto mb-3 w-fit">
          <Avatar photo={p.photo} name={p.name} frame={p.equipped.frame} size={92} />
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-cyan-400 px-2.5 py-0.5 text-xs font-black text-ink-950 ring-4 ring-ink-850">
            {t('level')} {p.level}
          </span>
        </div>
        <h1 className="h-display mt-4 text-xl">{p.name}</h1>
        {p.username && <div className="text-sm text-slate-500">@{p.username}</div>}
        <div className="mt-3 flex items-center justify-center gap-2">
          <RankBadge rating={p.rating} size="lg" />
          <span className="chip bg-white/[0.07] px-3 py-1.5 text-sm">⚡ {p.rating}</span>
          {p.premium && <span className="chip bg-amber-300/15 px-3 py-1.5 text-sm text-amber-200">👑 Premium</span>}
        </div>
        <div className="mx-auto mt-4 max-w-[240px]">
          <Progress value={p.levelXp} max={p.levelXpNeeded} />
          <div className="mt-1 text-[11px] font-bold text-slate-500">{p.levelXp} / {p.levelXpNeeded} XP</div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label={t('games')} value={s.games} />
        <Stat label={t('wins')} value={s.wins} />
        <Stat label={t('winrate')} value={`${winrate}%`} />
        <Stat label={t('accuracy')} value={`${accuracy}%`} />
        <Stat label={t('sunk_total')} value={s.sunk} />
        <Stat label={t('best_streak')} value={s.bestStreak} />
      </div>

      {p.isAdmin && (
        <button onClick={() => navigate('/admin')} className="mb-4 flex w-full items-center gap-3 rounded-3xl bg-gradient-to-r from-emerald-400/20 to-cyan-400/10 p-4 text-left ring-1 ring-emerald-300/30">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400 text-ink-950"><ShieldCheck size={22} /></div>
          <div className="flex-1">
            <div className="font-extrabold">{t('admin_panel')}</div>
            <div className="text-xs text-slate-400">{t('admin_panel_sub')}</div>
          </div>
          <ChevronRight size={18} className="text-slate-500" />
        </button>
      )}

      <div className="glass mb-4 divide-y divide-white/[0.05] p-0">
        <Row icon={Award} label={t('achievements')} onClick={() => navigate('/achievements')} right={<span className="chip bg-amber-300/15 text-amber-200">{achCount}/{ACHIEVEMENTS.length}</span>} />
        <Row icon={Users} label={t('friends')} onClick={() => navigate('/friends')} right={friendsBadge ? <span className="chip bg-rose-500 text-white">{friendsBadge}</span> : undefined} />
        <Row icon={GraduationCap} label={t('how_to_play')} onClick={() => useStore.setState({ showTutorial: true })} />
      </div>

      <SeasonHistory />

      <div className="label mb-2 px-1">{t('history')}</div>
      <div className="mb-4"><History /></div>

      <div className="label mb-2 px-1">{t('settings')}</div>
      <div className="glass mb-4 divide-y divide-white/[0.05] p-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <Globe size={20} className="text-slate-400" />
          <span className="flex-1 text-sm font-bold">{t('language')}</span>
          <Segmented className="w-32" value={p.language} onChange={(v) => updateSettings({ language: v })} options={[{ value: 'ru', label: 'RU' }, { value: 'en', label: 'EN' }]} />
        </div>
        <Row icon={Volume2} label={t('sound')} right={<Toggle on={p.settings.sound} onChange={(v) => updateSettings({ sound: v })} />} />
        <Row icon={Music} label={t('music')} right={<Toggle on={p.settings.music !== false} onChange={(v) => updateSettings({ music: v })} />} />
        <Row icon={Vibrate} label={t('haptics')} right={<Toggle on={p.settings.haptics} onChange={(v) => updateSettings({ haptics: v })} />} />
        <Row
          icon={Bell}
          label={t('notifications')}
          right={
            <Toggle
              on={p.settings.notify !== false}
              onChange={async (v) => {
                if (v && isTelegram() && !(await requestWriteAccess())) return useStore.getState().toast(t('notif_denied'))
                updateSettings({ notify: v })
              }}
            />
          }
        />
        {config?.botUsername && <Row icon={LifeBuoy} label={t('support')} onClick={() => openLink(`https://t.me/${config.botUsername}`)} />}
      </div>
      <div className="glass mb-4 divide-y divide-white/[0.05] p-0">
        <Row icon={FileText} label={t('terms')} onClick={() => navigate('/legal/terms')} />
        <Row icon={Lock} label={t('privacy')} onClick={() => navigate('/legal/privacy')} />
        <Row icon={Trash2} label={<span className="text-rose-300">{t('delete_account')}</span>} onClick={() => setDeleting(true)} />
      </div>
      <DeleteAccount open={deleting} onClose={() => setDeleting(false)} />
      <div className="pb-2 text-center text-[11px] text-slate-600">Battleship Online · v2.0 · ID {p.id}</div>
    </div>
  )
}
