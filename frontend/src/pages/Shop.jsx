import { useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import {
  STAR_PRODUCTS, THEMES, SHIP_SKINS, EFFECTS, FRAMES, BOOSTERS, GOLD_EXCHANGE, RARITY,
} from '@shared/catalog.js'
import { useStore } from '../store/app.js'
import { useT, useL, tr } from '../lib/i18n.js'
import { post } from '../lib/api.js'
import { openInvoice, haptic } from '../lib/telegram.js'
import { Price, Coin, Gem, fmt, Avatar, RewardChips } from '../components/ui.jsx'
import Ship from '../components/Ship.jsx'
import { NavalHeader, NavalAction, NavalTabs } from '../components/naval.jsx'
import { LegalLinks } from '../components/LegalLinks.jsx'
import { AdButton, useAdsEnabled } from '../components/Ads.jsx'

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

function FreeForAds() {
  const t = useT()
  const enabled = useAdsEnabled()
  const left = useStore((s) => s.profile?.ads?.left || {})
  if (!enabled) return null
  return (
    <div className="glass mb-4 p-4">
      <div className="mb-1 flex items-center gap-2 font-extrabold">📺 {t('ad_free_title')}</div>
      <div className="mb-3 text-xs text-slate-400">{t('ad_free_sub')}</div>
      <div className="space-y-2">
        <div>
          <AdButton placement="gold" className="w-full">{t('ad_watch_gold')}</AdButton>
          <div className="mt-1 text-right text-[11px] text-slate-500">{t('ad_left', { n: left.gold ?? 0 })}</div>
        </div>
        <div>
          <AdButton placement="booster" className="w-full">{t('ad_watch_booster')}</AdButton>
          <div className="mt-1 text-right text-[11px] text-slate-500">{t('ad_left', { n: left.booster ?? 0 })}</div>
        </div>
      </div>
    </div>
  )
}

function Offers({ onCollection }) {
  const t = useT()
  const l = useL()
  const p = useStore((s) => s.profile)
  const starter = STAR_PRODUCTS.find((x) => x.id === 'starter')
  const gems = STAR_PRODUCTS.filter((x) => x.kind === 'gems')
  const starterSkin = SHIP_SKINS.find((x) => x.id === starter.grant.cosmetics[0])
  const boosterCount = Object.values(starter.grant.boosters).reduce((sum, n) => sum + n, 0)
  return (
    <div className="naval-offers">
      {!p.purchases?.starter && (
        <NavalAction onClick={() => buyStars(starter.id)} data-product-id={starter.id} className="naval-panel naval-starter">
          <span className="naval-once">{t('naval_once')}</span>
          <h2>{l(starter.title)}</h2>
          <RewardChips reward={{ gold: starter.grant.gold, gems: starter.grant.gems }} />
          <p>{t('naval_starter_details', { n: boosterCount, skin: l(starterSkin.name) })}</p>
          <span className="naval-starter-footer"><span className="naval-button">⭐ {starter.stars}</span><span>{t('naval_stars_payment')}</span></span>
        </NavalAction>
      )}

      <FreeForAds />
      <div className="naval-section-heading naval-gems-heading"><h2>{t('naval_crystals')}</h2><span>{t('naval_crystals_hint')}</span></div>
      <div className="naval-gem-grid">
        {gems.map((g, i) => (
          <NavalAction key={g.id} onClick={() => buyStars(g.id)} data-product-id={g.id}
            aria-label={`${l(g.title)}: ${fmt(g.gems)} ${t('naval_crystals')}, ${g.stars} Telegram Stars`}
            className={`naval-panel naval-gem-card ${g.best ? 'is-best' : ''}`}>
            {(g.popular || g.best) && <span className="naval-product-badge">{g.best ? t('best_value') : t('popular')}</span>}
            {g.bonus && <span className="naval-product-bonus">{t('bonus', { n: g.bonus })}</span>}
            <span className={`naval-gem-art naval-gem-art-${Math.min(i, 3)}`} aria-hidden="true" />
            <span className="naval-gem-amount">{fmt(g.gems)} <span>{t('naval_crystals')}</span></span>
            <span className="naval-gem-name">{l(g.title)}</span>
            <span className="naval-price">⭐ {fmt(g.stars)}</span>
          </NavalAction>
        ))}
      </div>
      <button className="naval-panel naval-collection-link" onClick={onCollection}>
        <span className="naval-art naval-art-fleet" aria-hidden="true" />
        <span><strong>{t('naval_collect_fleet')}</strong><span>{t('naval_collection_hint')}</span></span><ChevronRight size={22} />
      </button>
      <p className="naval-purchase-legal"><LegalLinks textKey="purchase_legal" /></p>
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
      <NavalTabs
        label={t('collection')}
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
                  <NavalAction className="btn-sm w-full bg-cyan-300 text-ink-950" onClick={() => mutate('/me/equip', { itemId: item.id }, { popup: false })}>{t('equip')}</NavalAction>
                ) : item.price ? (
                  <NavalAction className="btn-sm w-full bg-white/[0.08] text-white" onClick={() => mutate('/me/shop/buy', { itemId: item.id })}>
                    <Price price={item.price} />
                  </NavalAction>
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
                <NavalAction key={n} className="btn-sm flex-col !h-auto bg-white/[0.06] py-2" onClick={() => mutate('/me/shop/buy', { itemId: `booster:${b.id}`, qty: n })}>
                  <span className="text-sm">{t('pack_of', { n })}</span>
                  <span className="flex items-center gap-1 text-xs text-amber-200"><Coin size={13} />{fmt(Math.round(b.price.gold * mult))}</span>
                </NavalAction>
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
          <NavalAction key={e.id} onClick={() => mutate('/me/shop/buy', { itemId: `exchange:${e.id}` })} className="glass flex w-full items-center gap-3 p-4 active:scale-[0.98]">
            <div className="flex -space-x-2">{Array.from({ length: i + 1 }, (_, k) => <Coin key={k} size={30} />)}</div>
            <div className="flex-1 text-left font-display text-lg font-bold">{fmt(e.gold)}</div>
            <span className="btn-sm bg-white/[0.08]"><Gem size={15} /> {e.gems}</span>
          </NavalAction>
        ))}
      </div>
    </div>
  )
}

export default function Shop() {
  const t = useT()
  const [tab, setTab] = useState('offers')
  return (
    <div className="naval-screen naval-shop">
      <NavalHeader title={t('shop')} />
      <NavalTabs
        label={t('shop')}
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
      {tab === 'offers' && <Offers onCollection={() => setTab('collection')} />}
      {tab === 'collection' && <Collection />}
      {tab === 'boosters' && <Boosters />}
      {tab === 'exchange' && <Exchange />}
    </div>
  )
}
