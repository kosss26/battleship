import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Ban, ShieldCheck, Copy } from 'lucide-react'
import { THEMES, SHIP_SKINS, EFFECTS, FRAMES, ACHIEVEMENTS, DEFAULT_OWNED } from '@shared/catalog.js'
import { api, post } from '../lib/api.js'
import { copyText } from '../lib/telegram.js'
import { useStore } from '../store/app.js'
import { Avatar, PageHeader, Spinner, Empty, Toggle, fmt, Coin, Gem } from '../components/ui.jsx'
import { Card, Tile, Field, fmtDate, useConfirm, adminError, inputCls } from '../admin/common.jsx'
import { PaymentRow, useRefund, LogList } from './Admin.jsx'

const COSMETICS = [...THEMES, ...SHIP_SKINS, ...EFFECTS, ...FRAMES].filter((c) => !DEFAULT_OWNED.includes(c.id))
const MODES = { ai: 'ИИ', campaign: 'Кампания', ranked: 'Рейтинг', duel: 'Дуэль' }

const emptyForm = { gold: '', gems: '', radar: '', barrage: '', rating: '', grant: '', remove: '', premium: null, reason: '' }

function AdjustForm({ data, onSaved }) {
  const toast = useStore((s) => s.toast)
  const [f, setF] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const p = data.profile
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const premium = f.premium ?? p.pass.premium

  const save = async () => {
    const changes = {}
    if (f.gold) changes.gold = Number(f.gold)
    if (f.gems) changes.gems = Number(f.gems)
    if (f.radar || f.barrage) changes.boosters = { radar: Number(f.radar) || 0, barrage: Number(f.barrage) || 0 }
    if (f.rating !== '') changes.rating = Number(f.rating)
    if (f.grant) changes.grantCosmetics = [f.grant]
    if (f.remove) changes.removeCosmetics = [f.remove]
    if (f.premium !== null && f.premium !== p.pass.premium) changes.premiumPass = f.premium
    setBusy(true)
    try {
      const res = await post(`/admin/users/${p.id}/adjust`, { changes, reason: f.reason })
      toast('Сохранено', 'success')
      setF(emptyForm)
      onSaved(res)
    } catch (e) {
      toast(adminError(e.code))
    }
    setBusy(false)
  }

  return (
    <Card title="Корректировка">
      <p className="mb-3 text-[11px] text-slate-500">Золото, кристаллы и бустеры — изменение (можно с минусом). Рейтинг — новое значение.</p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Field label="Золото ±"><input className={inputCls} inputMode="numeric" placeholder="+1000" value={f.gold} onChange={set('gold')} /></Field>
        <Field label="Кристаллы ±"><input className={inputCls} inputMode="numeric" placeholder="+50" value={f.gems} onChange={set('gems')} /></Field>
        <Field label="Радар ±"><input className={inputCls} inputMode="numeric" value={f.radar} onChange={set('radar')} /></Field>
        <Field label="Залп ±"><input className={inputCls} inputMode="numeric" value={f.barrage} onChange={set('barrage')} /></Field>
        <Field label={`Рейтинг (сейчас ${p.rating})`}><input className={inputCls} inputMode="numeric" value={f.rating} onChange={set('rating')} /></Field>
        <div className="flex items-end justify-between rounded-xl bg-white/[0.04] px-3 py-2">
          <span className="text-xs font-bold">Премиум-пропуск</span>
          <Toggle on={premium} onChange={(v) => setF({ ...f, premium: v })} />
        </div>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Field label="Выдать предмет">
          <select className={inputCls} value={f.grant} onChange={set('grant')}>
            <option value="">—</option>
            {COSMETICS.filter((c) => !p.owned.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name.ru}</option>)}
          </select>
        </Field>
        <Field label="Забрать предмет">
          <select className={inputCls} value={f.remove} onChange={set('remove')}>
            <option value="">—</option>
            {COSMETICS.filter((c) => p.owned.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name.ru}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Причина (видна в журнале)">
        <input className={`${inputCls} mb-3`} placeholder="Например: компенсация за сбой" value={f.reason} onChange={set('reason')} />
      </Field>
      <button className="btn-primary w-full" disabled={busy || !f.reason.trim()} onClick={save}>Применить</button>
    </Card>
  )
}

export default function AdminUser() {
  const { id } = useParams()
  const toast = useStore((s) => s.toast)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [ask, dialog] = useConfirm()
  const load = useCallback(() => api(`/admin/users/${id}`).then(setData).catch((e) => setError(e.code)), [id])
  const [refund, refundDialog] = useRefund(load)

  useEffect(() => {
    load()
  }, [load])

  if (!data) return <div><PageHeader title="Игрок" />{error ? <Empty icon="⚠️" text={adminError(error)} /> : <div className="flex justify-center py-12"><Spinner /></div>}</div>

  const p = data.profile
  const s = p.stats
  const stars = data.payments.filter((x) => x.status === 'paid').reduce((a, x) => a + x.stars, 0)

  const toggleBan = async () => {
    const ok = await ask(data.banned
      ? { title: 'Разбанить игрока?', confirm: 'Разбанить' }
      : { title: 'Забанить игрока?', text: 'Текущий бой будет засчитан как поражение, доступ к игре закроется.', withReason: true, danger: true, confirm: 'Забанить' })
    if (!ok) return
    try {
      setData(await post(`/admin/users/${p.id}/ban`, { banned: !data.banned, reason: ok.reason }))
      toast(data.banned ? 'Игрок разбанен' : 'Игрок забанен', 'success')
    } catch (e) {
      toast(adminError(e.code))
    }
  }

  return (
    <div>
      <PageHeader title="Игрок" />
      <Card>
        <div className="flex items-center gap-3">
          <Avatar photo={p.photo} name={p.name} frame={p.equipped.frame} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 truncate font-extrabold">
              {p.name}
              {p.isAdmin && <ShieldCheck size={16} className="text-emerald-300" />}
            </div>
            {p.username && <div className="text-sm text-slate-400">@{p.username}</div>}
            <button className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500" onClick={async () => { await copyText(String(data.tgId)); toast('Скопировано', 'success') }}>
              #{p.id} · TG {data.tgId} <Copy size={11} />
            </button>
          </div>
        </div>
        {data.banned && (
          <div className="mt-3 rounded-2xl bg-rose-500/15 p-3 text-sm text-rose-200">
            <b>Забанен.</b> {data.banReason || ''}
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-1 text-[11px] text-slate-400">
          <span>Регистрация: {fmtDate(data.createdAt)}</span>
          <span>Был в сети: {fmtDate(data.lastSeen)}</span>
          <span>Пригласил: {data.referrals}</span>
          <span>Пришёл от: {data.referrer ? `${data.referrer.name} (#${data.referrer.id})` : '—'}</span>
        </div>
      </Card>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <Tile label="Золото" value={<span className="flex items-center gap-1"><Coin size={16} />{fmt(p.gold)}</span>} />
        <Tile label="Кристаллы" value={<span className="flex items-center gap-1"><Gem size={16} />{fmt(p.gems)}</span>} />
        <Tile label="Потратил ⭐" value={fmt(stars)} accent="text-amber-200" />
        <Tile label="Уровень" value={p.level} />
        <Tile label="Рейтинг" value={p.rating} sub={`пик ${p.peakRating}`} />
        <Tile label="Бои / победы" value={`${s.games}/${s.wins}`} />
        <Tile label="Бустеры" value={`📡${p.boosters.radar || 0} 💥${p.boosters.barrage || 0}`} />
        <Tile label="Достижения" value={`${Object.keys(p.achievements).length}/${ACHIEVEMENTS.length}`} />
        <Tile label="Премиум" value={p.pass.premium ? 'Да' : 'Нет'} sub={`пропуск XP ${p.pass.xp}`} />
      </div>

      {!p.isAdmin && (
        <button className={`btn mb-3 h-12 w-full ${data.banned ? 'bg-emerald-400 text-ink-950' : 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30'}`} onClick={toggleBan}>
          <Ban size={18} /> {data.banned ? 'Разбанить' : 'Забанить'}
        </button>
      )}

      <AdjustForm data={data} onSaved={setData} />

      <Card title={`Покупки (${data.payments.length})`}>
        {data.payments.length ? (
          <div className="space-y-2">{data.payments.map((x) => <PaymentRow key={x.id} p={x} onRefund={refund} showUser={false} />)}</div>
        ) : <div className="text-sm text-slate-500">Покупок нет</div>}
      </Card>

      <Card title="Последние бои">
        {data.games.length ? (
          <div className="space-y-1.5">
            {data.games.map((g) => (
              <div key={g.id} className="flex items-center gap-2 text-sm">
                <span className={`w-6 font-black ${g.won ? 'text-emerald-300' : 'text-rose-300'}`}>{g.won ? 'W' : 'L'}</span>
                <span className="flex-1 truncate">{MODES[g.mode] || g.mode}{g.difficulty ? ` · ${g.difficulty}` : ''} · {g.shots} выстр. · {g.reason}</span>
                {g.mode === 'ranked' && <span className={g.ratingDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{g.ratingDelta > 0 ? '+' : ''}{g.ratingDelta}</span>}
                <span className="text-[11px] text-slate-500">{fmtDate(g.endedAt)}</span>
              </div>
            ))}
          </div>
        ) : <div className="text-sm text-slate-500">Боёв нет</div>}
      </Card>

      <Card title="Действия админов"><LogList log={data.log} showTarget={false} /></Card>
      {dialog}
      {refundDialog}
    </div>
  )
}
