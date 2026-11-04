import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import {
  STAR_PRODUCTS, THEMES, SHIP_SKINS, EFFECTS, FRAMES, BOOSTERS, GOLD_EXCHANGE, RARITY,
} from '@shared/catalog.js'
import { useStore } from '../store/app.js'
import { useT, useL, tr } from '../lib/i18n.js'
import { post } from '../lib/api.js'
import { openInvoice, haptic } from '../lib/telegram.js'
import { Segmented, Price, Coin, Gem, fmt, Avatar } from '../components/ui.jsx'
import Ship from '../components/Ship.jsx'
import { Wallet } from './Home.jsx'
import { LegalLinks } from '../components/LegalLinks.jsx'

/** Buys a Telegram Stars product: creates the invoice server-side and opens it */
export async function buyStars(productId) {
  const st = useStore.getState()
  haptic.medium()
  try {
    const { link } = await post('/me/invoice', { productId })
    const before = st.profile
    const status = await openInvoice(link)
    if (status === 'paid') {
      st.toast(tr('payment_pending'))
      // Fulfilment arrives via the bot webhook; poll briefly for the updated profile
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1000))
        const p = await st.refreshProfile()
        if (p.gems !== before.gems || JSON.stringify(p.purchases) !== JSON.stringify(before.purchases)) break
      }
      haptic.success()
      st.toast(tr('purchase_ok'), 'success')
    } else if (status === 'cancelled') st.toast(tr('payment_cancelled'))
    else if (status === 'failed') st.toast('error_generic', 'error')
  } catch (e) {
    st.toast(e.code === 'payments_unavailable' ? 'payments_unavailable' : e.code || 'error_generic', 'error')
  }
}

function Offers() {
  const t = useT()
  const l = useL()
  const p = useStore((s) => s.profile)
  const starter = STAR_PRODUCTS.find((x) => x.id === 'starter')
  const gems = STAR_PRODUCTS.filter((x) => x.kind === 'gems')
  return (
    <div>
      {!p.purchases?.starter && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => buyStars('starter')}
          className="relative mb-4 w-full overflow-hidden rounded-[28px] p-5 text-left ring-1 ring-fuchsia-300/30"
          style={{ background: 'linear-gradient(135deg, #3b0764 0%, #1e1b4b 50%, #0c4a6e 100%)' }}
        >
          <div className="shine absolute inset-0" />
          <div className="absolute -right-4 -top-4 text-[90px] opacity-90">🎁</div>
          <span className="chip mb-2 bg-rose-500 text-white">-80%</span>
          <div className="h-display mb-1 text-xl">{l(starter.title)}</div>
          <div className="mb-4 max-w-[220px] text-sm text-fuchsia-100/80">{l(starter.desc)}</div>
          <span className="btn-sm relative bg-white px-5 text-ink-950">⭐ {starter.stars}</span>
        </motion.button>
      )}

      <div className="label mb-2">{t('gems_packs')}</div>
      <div className="grid grid-cols-2 gap-3">
        {gems.map((g, i) => (
          <motion.button
            key={g.id}
            whileTap={{ scale: 0.96 }}
            onClick={() => buyStars(g.id)}
            className={`glass relative flex flex-col items-center p-4 ${g.popular ? 'ring-1 ring-cyan-300/50' : ''} ${g.best ? 'col-span-2 ring-1 ring-amber-300/50' : ''}`}
          >
            {(g.popular || g.best) && (
              <span className={`chip absolute -top-2 left-1/2 -translate-x-1/2 ${g.best ? 'bg-amber-300 text-ink-950' : 'bg-cyan-300 text-ink-950'}`}>
                {g.best ? t('best_value') : t('popular')}
              </span>
            )}
            {g.bonus && <span className="chip absolute right-2 top-2 bg-emerald-400/15 text-emerald-300">{t('bonus', { n: g.bonus })}</span>}
            <div className="relative my-2 flex h-14 items-center justify-center">
              {Array.from({ length: Math.min(i + 1, 4) }, (_, k) => (
                <Gem key={k} size={34 - k * 2} className="-mx-1.5" />
              ))}
            </div>
            <div className="font-display text-xl font-bold">{fmt(g.gems)}</div>
            <div className="mb-3 text-xs text-slate-400">{l(g.title)}</div>
            <span className="btn-sm w-full bg-gradient-to-r from-amber-300 to-orange-400 text-ink-950">⭐ {g.stars}</span>
          </motion.button>
        ))}
      </div>
      <p className="mt-4 px-2 text-center text-[11px] leading-relaxed text-slate-500">
        <LegalLinks textKey="purchase_legal" />
      </p>
    </div>
  )
}

function CosmeticPreview({ slot, item }) {
  if (slot === 'theme') {
    return (
      <div className="water grid h-16 w-full grid-cols-5 grid-rows-3 overflow-hidden rounded-xl" style={Object.fromEntries(Object.entries(item.vars).map(([k, v]) => [`--${k}`, v]))}>
        {Array.from({ length: 15 }, (_, i) => (
          <div key={i} className="border border-[color:var(--grid)]">{i === 7 && <div className="m-auto mt-2 h-2 w-2 rounded-full" style={{ background: 'var(--miss)' }} />}</div>
        ))}
      </div>
    )
  }
  if (slot === 'ship') return <div className="flex h-16 items-center px-2"><Ship size={4} skin={item} className="h-9 w-full" /></div>
  if (slot === 'effect') {
    return (
      <div className="flex h-16 items-center justify-center">
        <div className="h-12 w-12 rounded-full" style={{ background: `radial-gradient(circle, #fff 5%, ${item.colors[1]} 30%, ${item.colors[0]} 60%, transparent 72%)` }} />
      </div>
    )
  }
  return <div className="flex h-16 items-center justify-center"><Avatar name="BS" frame={item.id} size={52} /></div>
}

function Collection() {
  const t = useT()
  const l = useL()
  const p = useStore((s) => s.profile)
  const mutate = useStore((s) => s.mutate)
  const [slot, setSlot] = useState('theme')
  const lists = { theme: THEMES, ship: SHIP_SKINS, effect: EFFECTS, frame: FRAMES }
  return (
    <div>
      <Segmented
        value={slot}
        onChange={setSlot}
        className="mb-4"
        options={[
          { value: 'theme', label: t('themes') },
          { value: 'ship', label: t('ships') },
          { value: 'effect', label: t('effects') },
          { value: 'frame', label: t('frames') },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        {lists[slot].map((item) => {
          const owned = p.owned.includes(item.id)
          const equipped = p.equipped[slot] === item.id
          const rarity = RARITY[item.rarity]
          return (
            <div key={item.id} className="glass flex flex-col p-3" style={{ boxShadow: equipped ? `0 0 0 2px ${rarity.color}` : undefined }}>
              <CosmeticPreview slot={slot} item={item} />
              <div className="mt-2 text-sm font-extrabold">{l(item.name)}</div>
              <div className="mb-2 text-[11px] font-bold" style={{ color: rarity.color }}>{l(rarity.name)}</div>
              <div className="mt-auto">
                {equipped ? (
                  <div className="btn-sm w-full bg-white/10 text-slate-300"><Check size={14} /> {t('equipped')}</div>
                ) : owned ? (
                  <button className="btn-sm w-full bg-cyan-300 text-ink-950" onClick={() => mutate('/me/equip', { itemId: item.id }, { popup: false })}>{t('equip')}</button>
                ) : item.price ? (
                  <button className="btn-sm w-full bg-white/[0.08] text-white" onClick={() => mutate('/me/shop/buy', { itemId: item.id })}>
                    <Price price={item.price} />
                  </button>
                ) : (
                  <div className="btn-sm w-full bg-amber-300/10 text-[11px] text-amber-200">🏆 {t('pass_exclusive')}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Boosters() {
  const t = useT()
  const l = useL()
  const p = useStore((s) => s.profile)
  const mutate = useStore((s) => s.mutate)
  return (
    <div>
      <p className="mb-4 rounded-2xl bg-white/[0.04] p-3 text-xs text-slate-400">ℹ️ {t('boosters_sub')}</p>
      <div className="space-y-3">
        {Object.values(BOOSTERS).map((b) => (
          <div key={b.id} className="glass p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400/30 to-indigo-500/20 text-3xl">{b.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 font-extrabold">{l(b.name)} <span className="chip bg-white/10">{p.boosters[b.id] || 0}</span></div>
                <div className="text-xs text-slate-400">{l(b.desc)}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[[1, 1], [5, 4.5], [10, 8]].map(([n, mult]) => (
                <button key={n} className="btn-sm flex-col !h-auto bg-white/[0.06] py-2" onClick={() => mutate('/me/shop/buy', { itemId: `booster:${b.id}`, qty: n })}>
                  <span className="text-sm">{t('pack_of', { n })}</span>
                  <span className="flex items-center gap-1 text-xs text-amber-200"><Coin size={13} />{fmt(Math.round(b.price.gold * mult))}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Exchange() {
  const t = useT()
  const mutate = useStore((s) => s.mutate)
  return (
    <div>
      <p className="mb-4 text-sm text-slate-400">{t('exchange_sub')}</p>
      <div className="space-y-3">
        {GOLD_EXCHANGE.map((e, i) => (
          <button key={e.id} onClick={() => mutate('/me/shop/buy', { itemId: `exchange:${e.id}` })} className="glass flex w-full items-center gap-3 p-4 active:scale-[0.98]">
            <div className="flex -space-x-2">{Array.from({ length: i + 1 }, (_, k) => <Coin key={k} size={30} />)}</div>
            <div className="flex-1 text-left font-display text-lg font-bold">{fmt(e.gold)}</div>
            <span className="btn-sm bg-white/[0.08]"><Gem size={15} /> {e.gems}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Shop() {
  const t = useT()
  const [tab, setTab] = useState('offers')
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="h-display text-[22px]">{t('shop')}</h1>
        <Wallet />
      </div>
      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-4"
        options={[
          { value: 'offers', label: t('offers') },
          { value: 'collection', label: t('collection') },
          { value: 'boosters', label: t('boosters') },
          { value: 'exchange', label: t('exchange') },
        ]}
      />
      {tab === 'offers' && <Offers />}
      {tab === 'collection' && <Collection />}
      {tab === 'boosters' && <Boosters />}
      {tab === 'exchange' && <Exchange />}
    </div>
  )
}
