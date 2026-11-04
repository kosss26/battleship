import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, RefreshCw, Send, ChevronRight, ShieldCheck } from 'lucide-react'
import { api, post } from '../lib/api.js'
import { useStore } from '../store/app.js'
import { Avatar, PageHeader, Segmented, Spinner, Empty, Toggle, fmt } from '../components/ui.jsx'
import { Card, Tile, fmtDate, ACTION_LABELS, PRODUCT_LABELS, useConfirm, adminError, inputCls } from '../admin/common.jsx'

function useLoad(fn, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const load = useCallback(() => {
    setError(null)
    return fn().then(setData).catch((e) => setError(e.code || 'error'))
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load()
  }, [load])
  return { data, error, reload: load, setData }
}

function Loading({ error }) {
  return error ? <Empty icon="⚠️" text={adminError(error)} /> : <div className="flex justify-center py-12"><Spinner /></div>
}

/* ───────── Overview ───────── */

function Bars({ rows, field, color }) {
  const max = Math.max(1, ...rows.map((r) => r[field]))
  return (
    <div className="flex h-24 items-end gap-1">
      {rows.map((r) => (
        <div key={r.day} className="group relative flex flex-1 flex-col items-center justify-end">
          <span className="mb-0.5 text-[9px] font-bold text-slate-400">{r[field] || ''}</span>
          <div className={`w-full rounded-t ${color}`} style={{ height: `${Math.max(3, (r[field] / max) * 72)}px`, opacity: r[field] ? 1 : 0.25 }} />
          <span className="mt-1 text-[8px] text-slate-500">{r.day.slice(3)}</span>
        </div>
      ))}
    </div>
  )
}

function Overview() {
  const { data, error, reload } = useLoad(() => api('/admin/dashboard'))
  if (!data) return <Loading error={error} />
  const { users, payments, live, gamesToday, daily } = data
  const modes = { ai: 'ИИ', campaign: 'Кампания', ranked: 'Рейтинг', duel: 'Дуэли' }
  return (
    <div>
      <Card title="Сейчас" right={<button onClick={reload} className="text-slate-400"><RefreshCw size={16} /></button>}>
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Онлайн" value={live.online} accent="text-emerald-300" />
          <Tile label="Боёв идёт" value={live.rooms} />
          <Tile label="В очереди" value={live.queue} />
        </div>
      </Card>
      <Card title="Игроки">
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Всего" value={fmt(users.total)} />
          <Tile label="DAU" value={fmt(users.dau)} />
          <Tile label="WAU" value={fmt(users.wau)} />
          <Tile label="MAU" value={fmt(users.mau)} />
          <Tile label="Новых 24ч" value={fmt(users.new_day)} sub={`за 7 дн: ${users.new_week}`} />
          <Tile label="Рефералов" value={fmt(users.referred)} sub={`в бане: ${users.banned}`} />
        </div>
      </Card>
      <Card title="Доход (Telegram Stars)">
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Всего ⭐" value={fmt(payments.stars_total)} accent="text-amber-200" />
          <Tile label="24ч ⭐" value={fmt(payments.stars_day)} />
          <Tile label="7 дн ⭐" value={fmt(payments.stars_week)} />
          <Tile label="Платящих" value={fmt(payments.payers)} sub={`${payments.conversion}% от всех`} />
          <Tile label="ARPPU ⭐" value={fmt(payments.arppu)} />
          <Tile label="Возвратов" value={fmt(payments.refunds)} sub={`покупок: ${payments.payments}`} />
        </div>
      </Card>
      <Card title="Боёв за 24 часа">
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(modes).map(([k, v]) => <Tile key={k} label={v} value={gamesToday[k] || 0} />)}
        </div>
      </Card>
      <Card title="14 дней · новые игроки"><Bars rows={daily} field="new_users" color="bg-cyan-400" /></Card>
      <Card title="14 дней · бои"><Bars rows={daily} field="games" color="bg-emerald-400" /></Card>
      <Card title="14 дней · Stars"><Bars rows={daily} field="stars" color="bg-amber-300" /></Card>
    </div>
  )
}

/* ───────── Players ───────── */

function Players() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const { data, error } = useLoad(() => api(`/admin/users?q=${encodeURIComponent(term)}`), [term])
  useEffect(() => {
    const t = setTimeout(() => setTerm(q), 350)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div>
      <div className="relative mb-3">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className={`${inputCls} pl-10`} placeholder="ID, Telegram ID, @username, имя или реф-код" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!data ? <Loading error={error} /> : !data.users.length ? <Empty icon="🔍" text="Никого не найдено" /> : (
        <div className="space-y-2">
          {!term && <div className="label px-1">Недавно заходили</div>}
          {data.users.map((u) => (
            <button key={u.id} onClick={() => navigate(`/admin/user/${u.id}`)} className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.03] p-3 text-left active:bg-white/[0.06]">
              <Avatar photo={u.photo} name={u.name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate text-sm font-bold">
                  {u.name}
                  {u.banned && <span className="chip bg-rose-500/20 py-0 text-[10px] text-rose-300">БАН</span>}
                </div>
                <div className="truncate text-[11px] text-slate-500">
                  #{u.id}{u.username ? ` · @${u.username}` : ''} · ур. {u.level} · ⚡{u.rating} · {u.games} боёв
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-500">{fmtDate(u.lastSeen)}</div>
              <ChevronRight size={16} className="text-slate-600" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ───────── Payments ───────── */

export function PaymentRow({ p, onRefund, showUser = true }) {
  const navigate = useNavigate()
  return (
    <div className="rounded-2xl bg-white/[0.03] p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{PRODUCT_LABELS[p.productId] || p.productId}</div>
          <div className="truncate text-[11px] text-slate-500">
            {fmtDate(p.createdAt)}
            {showUser && (
              <> · <button className="text-cyan-300" onClick={() => navigate(`/admin/user/${p.userId}`)}>{p.userName || `#${p.userId}`}</button></>
            )}
          </div>
        </div>
        <span className="font-display font-bold text-amber-200">⭐ {p.stars}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {p.status === 'paid' ? (
          <>
            <span className="chip bg-emerald-400/15 text-emerald-300">Оплачено</span>
            {onRefund && <button className="btn-sm ml-auto bg-rose-500/15 text-rose-200" onClick={() => onRefund(p)}>↩️ Вернуть</button>}
          </>
        ) : (
          <span className="chip bg-rose-500/15 text-rose-300">Возврат {fmtDate(p.refundedAt)}</span>
        )}
        <span className="ml-auto truncate text-[10px] text-slate-600" title={p.chargeId}>{p.chargeId.slice(0, 18)}…</span>
      </div>
    </div>
  )
}

export function useRefund(onDone) {
  const toast = useStore((s) => s.toast)
  const [ask, dialog] = useConfirm()
  const refund = async (p) => {
    const ok = await ask({
      title: `Вернуть ⭐ ${p.stars}?`,
      text: `${PRODUCT_LABELS[p.productId] || p.productId}\nStars вернутся покупателю, купленное будет списано с аккаунта.`,
      withReason: true,
      danger: true,
      confirm: 'Вернуть',
    })
    if (!ok) return
    try {
      await post(`/admin/payments/${p.id}/refund`, { reason: ok.reason })
      toast('Возврат выполнен', 'success')
      onDone?.()
    } catch (e) {
      toast(adminError(e.code))
    }
  }
  return [refund, dialog]
}

function Payments() {
  const [status, setStatus] = useState('all')
  const { data, error, reload } = useLoad(() => api(`/admin/payments?status=${status}`), [status])
  const [refund, dialog] = useRefund(reload)
  return (
    <div>
      <Segmented
        className="mb-3"
        value={status}
        onChange={setStatus}
        options={[{ value: 'all', label: 'Все' }, { value: 'paid', label: 'Оплачено' }, { value: 'refunded', label: 'Возвраты' }]}
      />
      {!data ? <Loading error={error} /> : !data.payments.length ? <Empty icon="⭐" text="Платежей пока нет" /> : (
        <div className="space-y-2">{data.payments.map((p) => <PaymentRow key={p.id} p={p} onRefund={refund} />)}</div>
      )}
      {dialog}
    </div>
  )
}

/* ───────── Broadcast ───────── */

const SEGMENTS = [
  ['all', 'Все'],
  ['active', 'Активные 3 дня'],
  ['inactive7', 'Не заходили 7+ дней'],
  ['payers', 'Платящие'],
  ['nonpayers', 'Неплатящие'],
]

function Broadcast() {
  const toast = useStore((s) => s.toast)
  const [text, setText] = useState('')
  const [segment, setSegment] = useState('all')
  const [button, setButton] = useState(true)
  const [count, setCount] = useState(null)
  const { data, reload } = useLoad(() => api('/admin/broadcast'))
  const [ask, dialog] = useConfirm()
  const running = data?.jobs.some((j) => !j.done)

  useEffect(() => {
    setCount(null)
    post('/admin/broadcast', { segment, dryRun: true }).then((r) => setCount(r.recipients)).catch(() => {})
  }, [segment])

  useEffect(() => {
    if (!running) return
    const id = setInterval(reload, 2000)
    return () => clearInterval(id)
  }, [running, reload])

  const send = async () => {
    const ok = await ask({ title: `Отправить ${count ?? '?'} игрокам?`, text: 'Сообщение придёт от бота. Отменить рассылку после запуска нельзя.', confirm: 'Отправить' })
    if (!ok) return
    try {
      await post('/admin/broadcast', { text, segment, button })
      toast('Рассылка запущена', 'success')
      setText('')
      reload()
    } catch (e) {
      toast(adminError(e.code))
    }
  }

  return (
    <div>
      <Card title="Новое сообщение">
        <textarea
          className="mb-1 h-36 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus:border-cyan-300/60"
          placeholder="Текст. Поддерживается HTML: <b>жирный</b>, <i>курсив</i>, <a href='…'>ссылка</a>"
          value={text}
          maxLength={3500}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mb-3 text-right text-[11px] text-slate-500">{text.length}/3500</div>
        <div className="label mb-2">Кому</div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {SEGMENTS.map(([k, v]) => (
            <button key={k} onClick={() => setSegment(k)} className={`chip py-1.5 ${segment === k ? 'bg-cyan-300 text-ink-950' : 'bg-white/[0.06] text-slate-300'}`}>{v}</button>
          ))}
        </div>
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-white/[0.04] px-3 py-2.5">
          <span className="text-sm font-bold">Кнопка «Играть»</span>
          <Toggle on={button} onChange={setButton} />
        </div>
        <button className="btn-primary w-full" disabled={text.trim().length < 2 || running || !count} onClick={send}>
          <Send size={18} /> Отправить {count != null ? `(${count})` : ''}
        </button>
      </Card>
      {data?.jobs?.length > 0 && (
        <Card title="Последние рассылки">
          <div className="space-y-2">
            {data.jobs.map((j) => (
              <div key={j.id} className="rounded-2xl bg-white/[0.03] p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-bold">{SEGMENTS.find((s) => s[0] === j.segment)?.[1]}</span>
                  <span className={j.done ? 'text-emerald-300' : 'text-amber-300'}>{j.done ? 'Готово' : 'Идёт…'}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Отправлено {j.sent} из {j.total} · ошибок {j.failed} · {fmtDate(j.startedAt)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {dialog}
    </div>
  )
}

/* ───────── Log ───────── */

export function LogList({ log, showTarget = true }) {
  const navigate = useNavigate()
  if (!log.length) return <Empty icon="📜" text="Действий пока не было" />
  return (
    <div className="space-y-2">
      {log.map((l) => (
        <div key={l.id} className="rounded-2xl bg-white/[0.03] p-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-bold">{ACTION_LABELS[l.action] || l.action}</span>
            <span className="text-[11px] text-slate-500">{fmtDate(l.createdAt)}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {l.adminName}
            {showTarget && l.targetId && (
              <> → <button className="text-cyan-300" onClick={() => navigate(`/admin/user/${l.targetId}`)}>{l.targetName || `#${l.targetId}`}</button></>
            )}
          </div>
          <div className="mt-1 break-words font-mono text-[10.5px] leading-snug text-slate-500">
            {Object.entries(l.details || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ')}
          </div>
        </div>
      ))}
    </div>
  )
}

function Log() {
  const { data, error } = useLoad(() => api('/admin/log'))
  if (!data) return <Loading error={error} />
  return <LogList log={data.log} />
}

/* ───────── Page ───────── */

export default function Admin() {
  const [tab, setTab] = useState(() => sessionStorage.getItem('admin_tab') || 'overview')
  const select = (v) => {
    setTab(v)
    try {
      sessionStorage.setItem('admin_tab', v)
    } catch {}
  }
  return (
    <div>
      <PageHeader title="Админ-панель" right={<ShieldCheck className="text-emerald-300" size={22} />} />
      <div className="mb-4">
        <Segmented
          className="[&_button]:text-[11.5px]"
          value={tab}
          onChange={select}
          options={[
            { value: 'overview', label: 'Обзор' },
            { value: 'players', label: 'Игроки' },
            { value: 'payments', label: 'Платежи' },
            { value: 'broadcast', label: 'Рассылка' },
            { value: 'log', label: 'Журнал' },
          ]}
        />
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'players' && <Players />}
      {tab === 'payments' && <Payments />}
      {tab === 'broadcast' && <Broadcast />}
      {tab === 'log' && <Log />}
    </div>
  )
}
