import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, Globe, Volume2, Vibrate, Users, LifeBuoy, ShieldCheck, Music, Bell, GraduationCap, FileText, Lock, Trash2, Settings, ChevronsUp, Trophy, Swords, Crosshair, ChevronDown,
} from 'lucide-react'
import { ACHIEVEMENTS, seasonInfo, RANKS, MAX_LEVEL } from '@shared/catalog.js'
import { useStore } from '../store/app.js'
import { useT, useL, useLang } from '../lib/i18n.js'
import { api } from '../lib/api.js'
import { openLink, requestWriteAccess, isTelegram } from '../lib/telegram.js'
import { Avatar, Toggle, Segmented, Empty, Spinner, Modal, Sheet, fmt } from '../components/ui.jsx'
import { SeasonEmblem } from '../components/Season.jsx'
import { useHomeScreenAvailable } from '../components/Share.jsx'
import { addToHomeScreen } from '../lib/telegram.js'
import { Smartphone } from 'lucide-react'
import { NavalWordmark } from '../components/naval.jsx'
import { CaptainAvatar, NavalRank, NavalMedal } from '../components/NavalIdentity.jsx'

function History() {
  const t = useT()
  const lang = useLang()
  const [games, setGames] = useState(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    let alive = true
    setError(false)
    api('/me/history').then((d) => { if (alive) setGames(d.games) }).catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [retry])
  return (
    <section className="identity-history">
      <div className="identity-section-heading"><h2>{t('identity_recent_battles')}</h2>{games?.length > 2 && <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{t(expanded ? 'identity_collapse' : 'identity_all_battles')}<ChevronDown size={14} /></button>}</div>
      {error ? <div className="naval-panel identity-empty"><p>{t('error_generic')}</p><button className="naval-button" onClick={() => setRetry((v) => v + 1)}>{t('retry')}</button></div> : !games ? <div className="identity-empty"><Spinner size={22} /></div> : !games.length ? <Empty icon="⚓" text={t('no_history')} /> : (
        <div className="identity-history-list">
          {games.slice(0, expanded ? 10 : 2).map((g) => (
            <div key={g.id} className={`naval-panel identity-history-row ${g.won ? 'is-win' : 'is-loss'}`}>
              <Swords size={22} aria-hidden="true" />
              <div className="identity-row-name"><strong>{t(g.won ? 'identity_victory' : 'defeat')}</strong><small>{t(g.mode === 'ranked' ? 'identity_ranked_battle' : `mode_${g.mode}`)}{g.opponent ? ` · ${g.opponent}` : ''}{g.mode === 'ai' && g.difficulty ? ` · ${t(`diff_${g.difficulty}`)}` : ''}</small>{expanded && <time dateTime={g.endedAt}>{new Date(g.endedAt).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US')}</time>}</div>
              {g.mode === 'ranked' && <span className="identity-score"><Trophy size={14} /><b>{g.ratingDelta > 0 ? '+' : ''}{g.ratingDelta}</b></span>}
            </div>
          ))}
        </div>
      )}
    </section>
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsTitle = useRef(null)
  const settingsTrigger = useRef(null)
  const homeAvailable = useHomeScreenAvailable()
  const l = useL()
  const s = p.stats
  const winrate = s.games ? Math.round((s.wins / s.games) * 100) : 0
  const accuracy = s.shots ? Math.round((s.hits / s.shots) * 100) : 0
  const achCount = Object.keys(p.achievements).length
  const maxLevel = p.level >= MAX_LEVEL
  const xpMax = Math.max(1, p.levelXpNeeded || 0)
  const xpValue = maxLevel ? xpMax : Math.max(0, Math.min(p.levelXp || 0, xpMax))
  const medals = [...ACHIEVEMENTS].sort((a, b) => Number(!!p.achievements[b.id]) - Number(!!p.achievements[a.id])).slice(0, 4)
  const closeSettings = () => { setSettingsOpen(false); settingsTrigger.current?.focus() }
  useEffect(() => { if (settingsOpen) settingsTitle.current?.focus() }, [settingsOpen])

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
    <div className="naval-screen naval-profile">
      <header className="identity-heading"><NavalWordmark compact /><div className="identity-title-row"><h1>{t('profile')}</h1><button ref={settingsTrigger} className="identity-settings-button" onClick={() => setSettingsOpen(true)} aria-label={t('settings')} aria-haspopup="dialog"><Settings size={21} /></button></div></header>
      <section className="naval-panel identity-dossier" aria-label={t('profile')}>
        <div className="identity-dossier-main"><CaptainAvatar photo={p.photo} name={p.name} frame={p.equipped.frame} size={76} /><div className="identity-dossier-copy"><h2 title={p.name}>{p.name}</h2><span className="identity-level"><ChevronsUp size={16} />{t('tier', { n: p.level })}</span><div className="identity-rank-line"><NavalRank rating={p.rating} /><span className="identity-score"><Trophy size={15} /><b>{fmt(p.rating)}</b></span></div></div></div>
        <div className="identity-xp"><div><span>{t(maxLevel ? 'identity_max_level' : 'identity_next_level', { n: p.level + 1 })}</span><span>{maxLevel ? t('identity_xp_complete') : <>{fmt(p.levelXp)} / {fmt(p.levelXpNeeded)} <small>XP</small></>}</span></div><div className="identity-xp-track" role="progressbar" aria-label={t('level')} aria-valuemin={0} aria-valuemax={xpMax} aria-valuenow={xpValue}><span style={{ width: `${xpValue / xpMax * 100}%` }} /></div></div>
      </section>
      <section className="naval-panel identity-stats" aria-label={t('identity_statistics')}>
        {[[Swords, fmt(s.games), t('games')], [Trophy, `${winrate}%`, t('wins')], [Crosshair, `${accuracy}%`, t('accuracy')]].map(([Icon, value, label]) => <div key={label}><Icon size={23} /><span><b>{value}</b><small>{label}</small></span></div>)}
      </section>
      <button className="naval-panel identity-fleet-link" onClick={() => navigate('/shop?tab=collection')}><span className="identity-fleet-copy"><strong>{t('identity_my_fleet')}</strong><small>{t('identity_fleet_sub')}</small></span><ChevronRight size={22} /></button>
      <button className="naval-panel identity-achievements" onClick={() => navigate('/achievements')}>
        <span className="identity-achievements-heading"><strong>{t('achievements')}</strong><span>{achCount} / {ACHIEVEMENTS.length}<ChevronRight size={17} /></span></span>
        <span className="identity-medal-shelf">{medals.map((a, i) => <span key={a.id} title={l(a.title)} aria-label={`${l(a.title)}: ${t(p.achievements[a.id] ? 'identity_unlocked' : 'identity_locked')}`}><NavalMedal type={['anchor', 'target', 'star', 'compass'][i]} tone={i === 2 ? 'gold' : 'silver'} locked={!p.achievements[a.id]} /></span>)}</span>
      </button>
      <History />
      <button className="naval-panel identity-friends" onClick={() => navigate('/friends')}><Users size={23} /><strong>{t('friends')}</strong>{!!friendsBadge && <span className="identity-friends-badge">{friendsBadge}</span>}<ChevronRight size={20} /></button>
      <Sheet open={settingsOpen} onClose={closeSettings} title={t('settings')} tall>
        <div className="identity-profile-settings" role="dialog" aria-modal="true" aria-label={t('settings')}><h2 className="sr-only" ref={settingsTitle} tabIndex={-1}>{t('settings')}</h2>
          {p.username && <p className="mb-3 text-sm text-slate-400">@{p.username}</p>}
          {p.premium && <p className="mb-3 text-sm text-amber-200">Telegram Premium</p>}
          {p.isAdmin && <div className="glass mb-4"><Row icon={ShieldCheck} label={t('admin_panel')} onClick={() => navigate('/admin')} /></div>}
          <div className="glass mb-4"><Row icon={GraduationCap} label={t('how_to_play')} onClick={() => { closeSettings(); useStore.setState({ showTutorial: true }) }} />{homeAvailable && <Row icon={Smartphone} label={t('home_screen')} onClick={() => addToHomeScreen(() => useStore.getState().toast(t('home_screen_added'), 'success'))} />}</div>
          <div className="identity-extra-stats">{[[t('wins'), s.wins], [t('sunk_total'), s.sunk], [t('best_streak'), s.bestStreak]].map(([label, value]) => <div key={label}><b>{fmt(value || 0)}</b><span>{label}</span></div>)}</div>
          <SeasonHistory />
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
        <Row icon={Trash2} label={<span className="text-rose-300">{t('delete_account')}</span>} onClick={() => { closeSettings(); setDeleting(true) }} />
      </div>
        </div>
        <div className="pb-2 text-center text-[11px] text-slate-500">Battleship Online · v2.0 · ID {p.id}</div>
      </Sheet>
      <DeleteAccount open={deleting} onClose={() => setDeleting(false)} />
    </div>
  )
}
