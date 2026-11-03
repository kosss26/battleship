import { useEffect, useState } from 'react'
import { Send, Copy } from 'lucide-react'
import { api } from '../lib/api.js'
import { useStore } from '../store/app.js'
import { useT } from '../lib/i18n.js'
import { shareLink, copyText, haptic } from '../lib/telegram.js'
import { PageHeader, Avatar, Spinner, Empty, Coin, Gem } from '../components/ui.jsx'

export default function Friends() {
  const t = useT()
  const toast = useStore((s) => s.toast)
  const [data, setData] = useState(null)
  useEffect(() => {
    api('/me/referrals').then(setData).catch(() => setData({ friends: [], total: 0, active: 0 }))
  }, [])

  return (
    <div>
      <PageHeader title={t('friends_title')} />
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
        className="btn-ghost mb-5 w-full"
        disabled={!data?.link}
        onClick={async () => {
          await copyText(data.link)
          haptic.success()
          toast(t('copied'), 'success')
        }}
      >
        <Copy size={18} /> {t('copy_link')}
      </button>

      {!data ? (
        <div className="flex justify-center"><Spinner /></div>
      ) : !data.friends.length ? (
        <Empty icon="📣" text={t('no_friends')} />
      ) : (
        <div className="space-y-2">
          {data.friends.map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3">
              <Avatar photo={f.photo} name={f.name} size={38} />
              <div className="flex-1">
                <div className="text-sm font-bold">{f.name}</div>
                <div className="text-[11px] text-slate-500">{t('level')} {f.level} · ⚡ {f.rating}</div>
              </div>
              {f.active ? <span className="chip bg-emerald-400/15 text-emerald-300">✓</span> : <span className="chip bg-white/5 text-slate-500">…</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
