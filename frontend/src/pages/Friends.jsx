import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Copy, Swords, UserPlus, X, Check, Trophy, MoreHorizontal, Trash2 } from 'lucide-react'
import { api, post } from '../lib/api.js'
import { NavalSubHeader, NavalTabs, NavalAction } from '../components/naval.jsx'
import { CaptainAvatar, MedalArt } from '../components/NavalIdentity.jsx'
import { request } from '../lib/socket.js'
import { useStore } from '../store/app.js'
import { useT } from '../lib/i18n.js'
import { shareLink, copyText, haptic } from '../lib/telegram.js'
import { Spinner, Empty, Coin, Gem, Modal, fmt } from '../components/ui.jsx'

export function lastSeenText(t, iso) {
  const min = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (min < 2) return t('just_now')
  if (min < 60) return t('min_ago', { n: min })
  if (min < 1440) return t('hours_ago', { n: Math.floor(min / 60) })
  return t('days_ago', { n: Math.floor(min / 1440) })
}

export function StatusDot({ f }) {
  return (
    <span
      className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-ink-900 ${
        f.inGame ? 'bg-amber-400' : f.online ? 'bg-emerald-400' : 'bg-slate-600'
      }`}
    />
  )
}

/** Sends a duel invite to a friend and opens the hosting screen */
export function useChallenge() {
  const navigate = useNavigate()
  const toast = useStore((s) => s.toast)
  const t = useT()
  return async (friend) => {
    haptic.medium()
    const res = await request('duel:invite', { friendId: friend.id })
    if (res.error) return toast(res.error, 'error')
    toast(t('invite_sent_to', { name: friend.name }), 'success')
    navigate('/duel/new', { state: { invited: friend } })
  }
}

export function FriendRow({ f, onChallenge, onRemove }) {
  const t = useT()
  return <div className={`naval-panel naval-friend-row ${!f.online ? 'is-offline' : ''}`}>
    <div className="friend-avatar"><CaptainAvatar photo={f.photo} name={f.name} frame={f.frame} size={48} /><StatusDot f={f} /></div>
    <div className="friend-person"><strong title={f.name}>{f.name}</strong><span>{t('tier', { n: f.level })} · <Trophy size={11} />{fmt(f.rating)}</span><small title={!f.online && f.lastSeen ? t('was_online', { t: lastSeenText(t, f.lastSeen) }) : undefined} className={f.inGame ? 'is-busy' : f.online ? 'is-online' : ''}>{f.inGame ? t('in_game') : f.online ? t('online') : t('expedition_offline')}</small></div>
    {onChallenge && <NavalAction className="friend-challenge" disabled={f.inGame} onClick={() => onChallenge(f)}><Swords size={15} />{t('challenge')}</NavalAction>}
    {onRemove && <details className="friend-menu"><summary aria-label={t('expedition_friend_actions', { name: f.name })}><MoreHorizontal size={16} /></summary><button onClick={(e) => { e.currentTarget.closest('details').open = false; onRemove(f) }}><Trash2 size={14} />{t('remove')}</button></details>}
  </div>
}

function Invite() {
  const t = useT()
  const toast = useStore((s) => s.toast)
  const [data, setData] = useState(null)
  useEffect(() => {
    api('/me/referrals').then(setData).catch(() => setData({ friends: [], total: 0, active: 0 }))
  }, [])
  return (
    <div>
      <div className="naval-panel friend-referral-rewards">
        <MedalArt type="friends" />
        <div className="relative max-w-[240px]">
          <div className="mb-2 flex items-center gap-2 text-2xl font-black">
            <Coin size={26} /> 500 <span className="text-slate-400">+</span> <Gem size={26} /> 10
          </div>
          <p className="text-sm text-cyan-50/80">{t('friends_sub')}</p>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="glass rounded-2xl p-3 text-center">
          <div className="font-display text-2xl font-bold">{data?.total ?? '–'}</div>
          <div className="text-[11px] font-bold uppercase text-slate-500">{t('invited')}</div>
        </div>
        <div className="glass rounded-2xl p-3 text-center">
          <div className="font-display text-2xl font-bold">{data?.active ?? '–'}</div>
          <div className="text-[11px] font-bold uppercase text-slate-500">{t('active')}</div>
        </div>
      </div>
      <button className="naval-button friend-share-button" disabled={!data?.link} onClick={() => shareLink(data.link, t('invite_text'))}>
        <Send size={18} /> {t('send_invite')}
      </button>
      <button
        className="naval-button naval-button-steel friend-share-button"
        disabled={!data?.link}
        onClick={async () => {
          await copyText(data.link)
          haptic.success()
          toast(t('copied'), 'success')
        }}
      >
        <Copy size={18} /> {t('copy_link')}
      </button>
    </div>
  )
}

export default function Friends() {
  const t = useT()
  const p = useStore((s) => s.profile)
  const toast = useStore((s) => s.toast)
  const challenge = useChallenge()
  const [tab, setTab] = useState('friends')
  const [data, setData] = useState(null)
  const [idInput, setIdInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const mounted = useRef(false)
  const sequence = useRef(0)

  const load = useCallback(async () => {
    const version = ++sequence.current
    try {
      const result = await api('/me/friends')
      if (mounted.current && version === sequence.current) { setData(result); setLoadError(false) }
    } catch {
      if (mounted.current && version === sequence.current) setLoadError(true)
    }
  }, [])
  useEffect(() => {
    mounted.current = true
    load()
    useStore.setState({ friendsBadge: 0 })
    const id = setInterval(load, 15000)
    return () => { mounted.current = false; sequence.current++; clearInterval(id) }
  }, [load])

  const act = async (fn, okText) => {
    try {
      const res = await fn()
      if (!mounted.current) return res
      sequence.current++
      setData(res)
      setLoadError(false)
      if (okText) toast(okText, 'success')
      haptic.success()
      return res
    } catch (e) {
      haptic.error()
      toast(e.code || 'error_generic', 'error')
    }
  }

  const add = async () => {
    const id = Number(idInput.replace(/\D/g, ''))
    if (!id) return
    setBusy(true)
    const res = await act(() => post('/me/friends', { id }))
    if (res) {
      toast(res.status === 'accepted' ? t('friend_added') : t('request_sent'), 'success')
      setIdInput('')
    }
    setBusy(false)
  }

  const requests = (data?.incoming.length || 0) + (data?.outgoing.length || 0)

  return (
    <div className="naval-screen naval-friends">
      <NavalSubHeader title={t('friends')} />
      <section className="naval-panel friends-banner"><h2>{t('expedition_your_flotilla')}</h2><NavalAction className="friend-id-copy" aria-label={t('expedition_copy_id')} onClick={async () => { await copyText(String(p.id)); haptic.success(); toast(t('copied'), 'success') }}><Copy size={15} /><span>{t('my_id')}: <b>{p.id}</b></span></NavalAction></section>
      <form className="friend-add-form" onSubmit={(e) => { e.preventDefault(); if (!busy) add() }}>
        <input aria-label={t('friend_id_placeholder')} placeholder={t('friend_id_placeholder')} inputMode="numeric" value={idInput} onChange={(e) => setIdInput(e.target.value.replace(/\D/g, '').slice(0, 12))} />
        <button className="naval-button" disabled={!idInput || busy} aria-busy={busy}><UserPlus size={16} />{t('add_friend')}</button>
      </form>
      <NavalTabs className="expedition-tabs" value={tab} onChange={setTab} label={t('friends')} options={[
        { value: 'friends', label: `${t('friends_tab')}${data ? ` · ${data.friends.length}` : ''}` },
        { value: 'requests', label: `${t('requests_tab')}${requests ? ` · ${requests}` : ''}` },
        { value: 'invite', label: t('invite_tab') },
      ]} />
      {loadError && tab !== 'invite' && <div className="naval-panel friends-load-error"><p>{t('error_generic')}</p><button className="naval-button" onClick={load}>{t('retry')}</button></div>}
      {tab === 'invite' ? <Invite /> : !data ? (
        loadError ? null :
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : tab === 'friends' ? (
        data.friends.length ? (
          <div className="friend-list"><h2>{t('online')} · {data.friends.filter((f) => f.online).length}</h2>
            {[...data.friends].sort((a, b) => Number(b.online) - Number(a.online)).map((f) => <FriendRow key={f.id} f={f} onChallenge={challenge} onRemove={setRemoving} />)}
          </div>
        ) : <Empty icon="🫂" text={t('no_friends_yet')} />
      ) : (
        <div>
          {!requests && <Empty icon="📭" text={t('no_requests')} />}
          {data.incoming.length > 0 && <div className="label mb-2">{t('incoming')}</div>}
          <div className="mb-4 space-y-2">
            {data.incoming.map((f) => (
              <div key={f.id} className="naval-panel friend-request-row">
                <CaptainAvatar photo={f.photo} name={f.name} frame={f.frame} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{f.name}</div>
                  <div className="text-[11px] text-slate-500">{t('level')} {f.level} · ⚡{f.rating}</div>
                </div>
                <NavalAction className="naval-button friend-request-accept" onClick={() => act(() => post(`/me/friends/${f.id}/accept`), t('friend_added'))}>
                  <Check size={14} /> {t('accept')}
                </NavalAction>
                <NavalAction className="friend-request-decline" aria-label={t('decline')} onClick={() => act(() => api(`/me/friends/${f.id}`, { method: 'DELETE' }))}>
                  <X size={16} />
                </NavalAction>
              </div>
            ))}
          </div>
          {data.outgoing.length > 0 && <div className="label mb-2">{t('outgoing')}</div>}
          <div className="space-y-2">
            {data.outgoing.map((f) => (
              <div key={f.id} className="naval-panel friend-request-row">
                <CaptainAvatar photo={f.photo} name={f.name} frame={f.frame} size={40} />
                <div className="min-w-0 flex-1 truncate text-sm font-bold">{f.name}</div>
                <NavalAction className="naval-button naval-button-steel" onClick={() => act(() => api(`/me/friends/${f.id}`, { method: 'DELETE' }))}>
                  {t('cancel_request')}
                </NavalAction>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab !== 'invite' && <button className="naval-panel friend-invite-banner" onClick={() => setTab('invite')}><MedalArt type="friends" /><span><strong>{t('expedition_invite_friend')}</strong><small>{t('expedition_referral_hint')}</small></span><span className="naval-button">{t('invite_tab')}</span></button>}

      <Modal open={!!removing} onClose={() => setRemoving(null)}>
        {removing && (
          <div className="glass-strong p-6 text-center">
            <div className="mb-3 flex justify-center"><CaptainAvatar photo={removing.photo} name={removing.name} frame={removing.frame} size={56} /></div>
            <div className="mb-5 font-bold">{t('remove_friend')}<br /><span className="text-slate-400">{removing.name}</span></div>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-ghost" onClick={() => setRemoving(null)}>{t('cancel')}</button>
              <button
                className="btn h-12 bg-rose-500 text-white"
                onClick={async () => {
                  const f = removing
                  setRemoving(null)
                  await act(() => api(`/me/friends/${f.id}`, { method: 'DELETE' }))
                }}
              >
                {t('remove')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
