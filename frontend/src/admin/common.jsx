import { useState } from 'react'
import { Modal } from '../components/ui.jsx'

export const fmtDate = (d) => (d ? new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')

export const ACTION_LABELS = {
  ban: '⛔ Бан',
  unban: '✅ Разбан',
  adjust: '✏️ Корректировка',
  refund: '↩️ Возврат',
  refund_requested: '↩️ Возврат запрошен',
  broadcast: '📣 Рассылка',
}

export const PRODUCT_LABELS = {
  gems_80: '80 💎', gems_450: '450 💎', gems_1000: '1000 💎', gems_2200: '2200 💎', gems_6000: '6000 💎',
  starter: '🎁 Набор новобранца', pass_premium: '🏆 Премиум-пропуск',
}

export function Card({ title, right, children, className = '' }) {
  return (
    <div className={`glass mb-3 p-4 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="label">{title}</span>
          {right}
        </div>
      )}
      {children}
    </div>
  )
}

export function Tile({ label, value, sub, accent = '' }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/[0.04] p-3">
      <div className={`truncate font-display text-xl font-bold ${accent}`}>{value}</div>
      <div className="text-[11px] font-bold uppercase text-slate-500">{label}</div>
      {sub != null && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">{label}</span>
      {children}
    </label>
  )
}

export const inputCls = 'h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-cyan-300/60'

/** Confirmation dialog with an optional reason field */
export function useConfirm() {
  const [state, setState] = useState(null)
  const ask = (opts) => new Promise((resolve) => setState({ ...opts, resolve, reason: '' }))
  const close = (value) => {
    state?.resolve(value)
    setState(null)
  }
  const dialog = (
    <Modal open={!!state} onClose={() => close(null)}>
      {state && (
        <div className="glass-strong p-5">
          <div className="mb-1 font-display text-lg font-bold">{state.title}</div>
          {state.text && <div className="mb-3 whitespace-pre-line text-sm text-slate-300">{state.text}</div>}
          {state.withReason && (
            <textarea
              className="mb-3 h-20 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus:border-cyan-300/60"
              placeholder="Причина (обязательно)"
              value={state.reason}
              onChange={(e) => setState({ ...state, reason: e.target.value })}
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => close(null)}>Отмена</button>
            <button
              className={`btn h-12 ${state.danger ? 'bg-rose-500 text-white' : 'bg-cyan-300 text-ink-950'}`}
              disabled={state.withReason && !state.reason.trim()}
              onClick={() => close({ reason: state.reason.trim() })}
            >
              {state.confirm || 'Подтвердить'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
  return [ask, dialog]
}

export function adminError(code) {
  const map = {
    reason_required: 'Укажите причину',
    negative_gold: 'Золото уйдёт в минус',
    negative_gems: 'Кристаллы уйдут в минус',
    nothing_changed: 'Нет изменений',
    cannot_ban_admin: 'Нельзя забанить администратора',
    already_refunded: 'Уже возвращено',
    telegram_refund_failed: 'Возврат ожидает подтверждения Telegram. Сервер повторит попытку автоматически.',
    bot_not_configured: 'Бот не настроен (TELEGRAM_BOT_TOKEN)',
    broadcast_running: 'Рассылка уже идёт',
    bad_text: 'Текст 2–3500 символов',
    bad_rating: 'Рейтинг 0–5000',
    forbidden: 'Нет доступа',
  }
  return map[code] || code || 'Ошибка'
}
