import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../lib/api.js'
import { useStore } from '../store/app.js'
import { useT } from '../lib/i18n.js'
import { Avatar, Segmented, Spinner, Empty, RankBadge } from '../components/ui.jsx'
import { SeasonBanner } from '../components/Season.jsx'

export default function Leaderboard() {
  const t = useT()
  const p = useStore((s) => s.profile)
  const [type, setType] = useState('rating')
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    setData(null)
    api(`/leaderboard?type=${type}`).then((d) => alive && setData(d)).catch(() => alive && setData({ entries: [] }))
    return () => {
      alive = false
    }
  }, [type])

  const top = data?.entries.slice(0, 3) || []
  const rest = data?.entries.slice(3) || []
  const scoreLabel = (e) => (type === 'weekly' ? `${e.score} ${t('wins_week')}` : e.rating)
  const podium = [top[1], top[0], top[2]]

  return (
    <div>
      <h1 className="h-display mb-4 text-[22px]">{t('leaderboard')}</h1>
      <SeasonBanner progress={data?.progress} />
      <Segmented
        value={type}
        onChange={setType}
        className="mb-5"
        options={[
          { value: 'rating', label: t('lb_global') },
          { value: 'weekly', label: t('lb_week') },
          { value: 'friends', label: t('lb_friends') },
        ]}
      />
      {!data ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : !data.entries.length ? (
        <Empty icon="🏆" text={t('empty_lb')} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-3 items-end gap-2">
            {podium.map((e, i) => {
              if (!e) return <div key={i} />
              const place = e.place
              const h = place === 1 ? 'h-28' : place === 2 ? 'h-20' : 'h-16'
              const medal = ['🥇', '🥈', '🥉'][place - 1]
              return (
                <motion.div key={e.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.08 }} className="flex flex-col items-center">
                  <Avatar photo={e.photo} name={e.name} frame={e.frame} size={place === 1 ? 64 : 52} />
                  <div className="mt-1.5 w-full truncate text-center text-xs font-bold">{e.name}</div>
                  <div className="text-[11px] font-bold text-cyan-300">{scoreLabel(e)}</div>
                  <div className={`mt-2 flex w-full items-start justify-center rounded-t-2xl pt-2 text-2xl ${h} ${place === 1 ? 'bg-gradient-to-b from-amber-300/30 to-transparent' : 'bg-gradient-to-b from-white/10 to-transparent'}`}>
                    {medal}
                  </div>
                </motion.div>
              )
            })}
          </div>
          <div className="space-y-2">
            {rest.map((e) => (
              <div key={e.id} className={`flex items-center gap-3 rounded-2xl p-2.5 ${e.me ? 'bg-cyan-400/10 ring-1 ring-cyan-300/30' : 'bg-white/[0.03]'}`}>
                <span className="w-7 text-center text-sm font-black text-slate-500">{e.place}</span>
                <Avatar photo={e.photo} name={e.name} frame={e.frame} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{e.name}</div>
                  <div className="text-[11px] text-slate-500">{t('level')} {e.level}</div>
                </div>
                <span className="text-sm font-extrabold">{scoreLabel(e)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {data && type === 'rating' && (
        <div className="glass-strong sticky mt-4 flex items-center gap-3 p-3" style={{ bottom: 'calc(96px + var(--safe-bottom))' }}>
          <span className="w-10 text-center font-display text-sm font-bold text-cyan-300">#{data.myPlace}</span>
          <Avatar photo={p.photo} name={p.name} frame={p.equipped.frame} size={36} />
          <div className="flex-1">
            <div className="text-sm font-bold">{t('your_place')}</div>
            <RankBadge rating={p.rating} />
          </div>
          <span className="font-display font-bold">{p.rating}</span>
        </div>
      )}
    </div>
  )
}
