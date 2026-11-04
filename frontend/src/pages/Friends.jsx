import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Copy, Swords, UserPlus, X, Check } from 'lucide-react'
import { api, post } from '../lib/api.js'
import { request } from '../lib/socket.js'
import { useStore } from '../store/app.js'
import { useT } from '../lib/i18n.js'
import { shareLink, copyText, haptic } from '../lib/telegram.js'
import { PageHeader, Avatar, Spinner, Empty, Coin, Gem, Segmented, Modal } from '../components/ui.jsx'

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
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3">
      <div className="relative">
        <Avatar photo={f.photo} name={f.name} frame={f.frame} size={42} />
        <StatusDot f={f} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{f.name}</div>
        <div className="truncate text-[11px] text-slate-500">
          {f.inGame ? <span className="text-amber-300">{t('in_game')}</span> : f.online ? <span className="text-emerald-300">{t('online')}</span> : t('was_online', { t: lastSeenText(t, f.lastSeen) })}
          {' · '}{t('level')} {f.level} · ⚡{f.rating}
        </div>
      </div>
      {onChallenge && (
        <button className="btn-sm bg-gradient-to-r from-fuchsia-400 to-violet-500 text-ink-950" disabled={f.inGame} onClick={() => onChallenge(f)}>
          <Swords size={14} /> {t('challenge')}
        </button>
      )}
      {onRemove && (
        <button className="rounded-xl p-2 text-slate-500 active:bg-white/10" onClick={() => onRemove(f)} aria-label={t('remove')}>
          <X size={16} />
        </button>
      )}
    </div>
  )
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
      <div className="relative mb-4 overflow-hidden rounded-[28px] p-5" style={{ background: 'linear-gradient(135deg, #134e4a 0%, #0c4a6e 60%, #1e1b4b 100%)' }}>
        <div className="absolute -right-3 -top-3 text-[86px] opacity-80">🤝</div>
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
      <button className="btn-primary mb-2 w-full" disabled={!data?.link} onClick={() => shareLink(data.link, t('invite_text'))}>
        <Send size={18} /> {t('send_invite')}
      </button>
      <button
        className="btn-ghost w-full"
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

  const load = useCallback(() => api('/me/friends').then(setData).catch(() => setData({ friends: [], incoming: [], outgoing: [] })), [])
  useEffect(() => {
    load()
    useStore.setState({ friendsBadge: 0 })
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [load])

  const act = async (fn, okText) => {
    try {
      const res = await fn()
      setData(res)
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
    <div>
      <PageHeader title={t('friends')} />

      <div className="glass mb-3 flex items-center gap-3 p-4">
        <div className="flex-1">
          <div className="label">{t('my_id')}</div>
          <div className="font-display text-2xl font-bold">{p.id}</div>
          <div className="text-[11px] text-slate-500">{t('my_id_hint')}</div>
        </div>
        <button
          className="btn-sm bg-white/[0.08]"
          onClick={async () => {
            await copyText(String(p.id))
            haptic.success()
            toast(t('copied'), 'success')
          }}
        >
          <Copy size={14} />
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none focus:border-cyan-300/60"
          placeholder={t('friend_id_placeholder')}
          inputMode="numeric"
          value={idInput}
          onChange={(e) => setIdInput(e.target.value.replace(/\D/g, '').slice(0, 12))}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn h-12 bg-cyan-300 px-4 text-sm text-ink-950" disabled={!idInput || busy} onClick={add}>
          <UserPlus size={18} /> {t('add_friend')}
        </button>
      </div>

      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'friends', label: `${t('friends_tab')}${data ? ` · ${data.friends.length}` : ''}` },
          { value: 'requests', label: `${t('requests_tab')}${requests ? ` · ${requests}` : ''}` },
          { value: 'invite', label: t('invite_tab') },
        ]}
      />

      {tab === 'invite' ? <Invite /> : !data ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : tab === 'friends' ? (
        data.friends.length ? (
          <div className="space-y-2">
            {data.friends.map((f) => <FriendRow key={f.id} f={f} onChallenge={challenge} onRemove={setRemoving} />)}
          </div>
        ) : <Empty icon="🫂" text={t('no_friends_yet')} />
      ) : (
        <div>
          {!requests && <Empty icon="📭" text={t('no_requests')} />}
          {data.incoming.length > 0 && <div className="label mb-2">{t('incoming')}</div>}
          <div className="mb-4 space-y-2">
            {data.incoming.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-2xl bg-cyan-400/[0.06] p-3 ring-1 ring-cyan-300/20">
                <Avatar photo={f.photo} name={f.name} frame={f.frame} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{f.name}</div>
                  <div className="text-[11px] text-slate-500">{t('level')} {f.level} · ⚡{f.rating}</div>
                </div>
                <button className="btn-sm bg-emerald-400 text-ink-950" onClick={() => act(() => post(`/me/friends/${f.id}/accept`), t('friend_added'))}>
                  <Check size={14} /> {t('accept')}
                </button>
                <button className="rounded-xl p-2 text-slate-500" aria-label={t('decline')} onClick={() => act(() => api(`/me/friends/${f.id}`, { method: 'DELETE' }))}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          {data.outgoing.length > 0 && <div className="label mb-2">{t('outgoing')}</div>}
          <div className="space-y-2">
            {data.outgoing.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3">
                <Avatar photo={f.photo} name={f.name} frame={f.frame} size={40} />
                <div className="min-w-0 flex-1 truncate text-sm font-bold">{f.name}</div>
                <button className="btn-sm bg-white/[0.07] text-slate-300" onClick={() => act(() => api(`/me/friends/${f.id}`, { method: 'DELETE' }))}>
                  {t('cancel_request')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={!!removing} onClose={() => setRemoving(null)}>
        {removing && (
          <div className="glass-strong p-6 text-center">
            <Avatar photo={removing.photo} name={removing.name} size={56} className="mx-auto mb-3" />
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
