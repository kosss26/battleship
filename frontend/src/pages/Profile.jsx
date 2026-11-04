import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Globe, Volume2, Vibrate, Users, Award, LifeBuoy, ShieldCheck, Music, Bell, GraduationCap } from 'lucide-react'
import { requestWriteAccess, isTelegram } from '../lib/telegram.js'
import { ACHIEVEMENTS } from '@shared/catalog.js'
import { useStore } from '../store/app.js'
import { useT } from '../lib/i18n.js'
import { api } from '../lib/api.js'
import { openLink } from '../lib/telegram.js'
import { Avatar, Progress, RankBadge, Toggle, Segmented, Empty, Spinner } from '../components/ui.jsx'

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

export default function Profile() {
  const t = useT()
  const navigate = useNavigate()
  const p = useStore((s) => s.profile)
  const config = useStore((s) => s.config)
  const updateSettings = useStore((s) => s.updateSettings)
  const friendsBadge = useStore((s) => s.friendsBadge)
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
      <div className="pb-2 text-center text-[11px] text-slate-600">Battleship Online · v2.0 · ID {p.id}</div>
    </div>
  )
}
