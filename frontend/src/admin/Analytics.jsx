import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Segmented, Spinner, Empty, fmt } from '../components/ui.jsx'
import { Card, Tile, PRODUCT_LABELS, adminError } from './common.jsx'

/*
 * Charts follow one rule set: one measure per chart (no dual axes), a single hue,
 * values in text colours, hover/tap tooltips, and headline numbers as stat tiles.
 */
const HUE = '#22d3ee'
const dayLabel = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`

function ColumnChart({ rows, field, unit = '' }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...rows.map((r) => r[field]))
  const total = rows.reduce((a, r) => a + r[field], 0)
  const h = hover != null ? rows[hover] : null
  const step = Math.max(1, Math.ceil(rows.length / 7))
  return (
    <div>
      <div className="mb-2 flex h-5 items-baseline justify-between text-xs">
        <span className="text-slate-400">{h ? dayLabel(h.day) : `Σ ${fmt(total)}${unit}`}</span>
        {h && <span className="font-bold text-white">{fmt(h[field])}{unit}</span>}
      </div>
      <div className="relative flex h-28 items-end gap-[2px] border-b border-white/10" onPointerLeave={() => setHover(null)}>
        {rows.map((r, i) => (
          <div
            key={r.day}
            className="flex h-full flex-1 cursor-pointer items-end"
            onPointerEnter={() => setHover(i)}
            onPointerDown={() => setHover(i)}
          >
            <div
              className="w-full rounded-t-[4px]"
              style={{
                height: `${r[field] ? Math.max(3, (r[field] / max) * 100) : 0}%`,
                background: HUE,
                opacity: hover == null || hover === i ? 1 : 0.35,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex text-[9px] text-slate-500">
        {rows.map((r, i) => (
          <span key={r.day} className="flex-1 text-center">{i % step === 0 ? dayLabel(r.day) : ''}</span>
        ))}
      </div>
    </div>
  )
}

/** Horizontal bars: label · bar · value (identity carried by the label, not by colour) */
function HBars({ items, format = (v) => fmt(v), max: forcedMax }) {
  const max = forcedMax ?? Math.max(1, ...items.map((i) => i.value))
  if (!items.length) return <div className="text-sm text-slate-500">Нет данных</div>
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label} title={`${it.label}: ${format(it.value)}`}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-slate-300">{it.label}</span>
            <span className="font-bold text-white">{format(it.value)}{it.sub ? <span className="ml-1 font-normal text-slate-500">{it.sub}</span> : null}</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06]">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(it.value ? 2 : 0, (it.value / max) * 100)}%`, background: HUE }} />
          </div>
        </div>
      ))}
    </div>
  )
}

const RET = ['d1', 'd3', 'd7', 'd14', 'd30']

/** Sequential single-hue heatmap: darker = higher return rate */
function RetentionTable({ cohorts }) {
  if (!cohorts.length) return <div className="text-sm text-slate-500">Нет когорт</div>
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[330px] border-separate border-spacing-[2px] text-center text-[11px]">
        <thead>
          <tr className="text-slate-500">
            <th className="text-left font-semibold">Дата</th>
            <th className="font-semibold">Игроков</th>
            {RET.map((k) => <th key={k} className="font-semibold">D{k.slice(1)}</th>)}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.day}>
              <td className="text-left text-slate-400">{dayLabel(c.day)}</td>
              <td className="text-slate-300">{c.size}</td>
              {RET.map((k) => (
                <td
                  key={k}
                  className="rounded-[4px] py-1.5 font-bold"
                  title={c[k] == null ? 'ещё рано' : `${c[k]}%`}
                  style={c[k] == null ? { color: '#475569' } : { background: `rgba(34,211,238,${0.08 + (c[k] / 100) * 0.85})`, color: c[k] > 45 ? '#04121f' : '#e2e8f0' }}
                >
                  {c[k] == null ? '—' : `${Math.round(c[k])}%`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const MODE_LABELS = { ai: 'Против ИИ', campaign: 'Кампания', ranked: 'Рейтинг', duel: 'Дуэли' }
const PLACEMENT_LABELS = { gold: 'Бесплатное золото', booster: 'Бесплатный бустер', double: 'Удвоение награды' }

export default function Analytics() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    setData(null)
    setError(null)
    api(`/admin/analytics?days=${days}`).then(setData).catch((e) => setError(e.code || 'error'))
  }, [days])

  return (
    <div>
      <Segmented className="mb-3" value={days} onChange={setDays} options={[{ value: 7, label: '7 дней' }, { value: 30, label: '30 дней' }, { value: 90, label: '90 дней' }]} />
      {!data ? (error ? <Empty icon="⚠️" text={adminError(error)} /> : <div className="flex justify-center py-12"><Spinner /></div>) : (() => {
        const k = data.kpi
        const f = data.funnel
        const pctOf = (v) => (f.registered ? `${Math.round((v / f.registered) * 100)}%` : '')
        return (
          <div>
            <Card title="Аудитория">
              <div className="grid grid-cols-3 gap-2">
                <Tile label="Ср. DAU" value={fmt(k.avgDau)} />
                <Tile label="MAU" value={fmt(k.mau)} />
                <Tile label="DAU / MAU" value={k.stickiness != null ? `${k.stickiness}%` : '—'} />
                <Tile label="Новых" value={fmt(k.newUsers)} sub={k.referredShare != null ? `${k.referredShare}% по ссылкам` : null} />
                <Tile label="Активных" value={fmt(k.active)} />
                <Tile label="Боёв / игрок" value={k.gamesPerActive} />
              </div>
            </Card>

            <Card title="Удержание (среднее по когортам)">
              <div className="mb-3 grid grid-cols-5 gap-1.5">
                {RET.map((r) => (
                  <div key={r} className="rounded-xl bg-white/[0.04] p-2 text-center">
                    <div className="font-display text-base font-bold">{data.retention[r] != null ? `${Math.round(data.retention[r])}%` : '—'}</div>
                    <div className="text-[10px] font-bold text-slate-500">D{r.slice(1)}</div>
                  </div>
                ))}
              </div>
              <p className="mb-2 text-[11px] text-slate-500">Доля игроков, вернувшихся ровно на N-й день после регистрации. Темнее — лучше.</p>
              <RetentionTable cohorts={data.cohorts} />
            </Card>

            <Card title={`Воронка новичков (${data.days} дн.)`}>
              <HBars
                max={f.registered || 1}
                items={[
                  { label: 'Зарегистрировались', value: f.registered, sub: '100%' },
                  { label: 'Прошли обучение', value: f.onboarded, sub: pctOf(f.onboarded) },
                  { label: 'Сыграли 1 бой', value: f.played1, sub: pctOf(f.played1) },
                  { label: 'Вернулись на другой день', value: f.returned, sub: pctOf(f.returned) },
                  { label: 'Сыграли 5+ боёв', value: f.played5, sub: pctOf(f.played5) },
                  { label: 'Посмотрели рекламу', value: f.watched_ad, sub: pctOf(f.watched_ad) },
                  { label: 'Совершили покупку', value: f.paid, sub: pctOf(f.paid) },
                ]}
              />
            </Card>

            <Card title="Монетизация">
              <div className="grid grid-cols-3 gap-2">
                <Tile label="Выручка ⭐" value={fmt(k.stars)} accent="text-amber-200" />
                <Tile label="Платящих" value={fmt(k.payers)} sub={k.payerConversion != null ? `${k.payerConversion}% активных` : null} />
                <Tile label="ARPU ⭐" value={k.arpu} />
                <Tile label="ARPPU ⭐" value={fmt(k.arppu)} />
                <Tile label="Реклама" value={fmt(k.ads)} sub="просмотров" />
                <Tile label="Реклама / игрок" value={k.adsPerActive} />
              </div>
            </Card>

            <Card title="Активные игроки (DAU)"><ColumnChart rows={data.daily} field="dau" /></Card>
            <Card title="Новые игроки"><ColumnChart rows={data.daily} field="new_users" /></Card>
            <Card title="Бои"><ColumnChart rows={data.daily} field="games" /></Card>
            <Card title="Выручка, Stars"><ColumnChart rows={data.daily} field="stars" unit=" ⭐" /></Card>
            <Card title="Просмотры рекламы"><ColumnChart rows={data.daily} field="ads" /></Card>

            <Card title="Выручка по товарам">
              <HBars items={data.products.map((p) => ({ label: PRODUCT_LABELS[p.id] || p.title, value: p.stars, sub: `· ${p.n} шт.` }))} format={(v) => `${fmt(v)} ⭐`} />
            </Card>
            <Card title="Реклама по местам показа">
              <HBars items={data.placements.map((p) => ({ label: PLACEMENT_LABELS[p.placement] || p.placement, value: p.n }))} />
            </Card>
            <Card title="Бои по режимам">
              <HBars items={data.modes.map((m) => ({ label: MODE_LABELS[m.mode] || m.mode, value: m.n }))} />
            </Card>
          </div>
        )
      })()}
    </div>
  )
}
