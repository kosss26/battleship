import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Crown, Crosshair, RotateCcw, ShieldCheck, Waves, Check } from 'lucide-react'
import { useStore } from '../store/app.js'
import { useLang, useL, useT, errorText } from '../lib/i18n.js'
import { request } from '../lib/socket.js'
import { openLink } from '../lib/telegram.js'
import { SHIP_SKINS, THEMES, EFFECTS, collectionItems, collectionQuote } from '@shared/catalog.js'
import { createBoard, randomFleet, fire, shipCells, occupancy } from '@shared/engine.js'
import { mulberry32 } from '@shared/rng.js'
import Ship from '../components/Ship.jsx'
import Board from '../components/Board.jsx'
import { RegentArtwork, REGENT_CLASSES } from '../components/RegentShip.jsx'
import { RegentShotMark } from '../components/RegentEffects.jsx'
import { CELL } from '@shared/engine.js'
import { Avatar, Price } from '../components/ui.jsx'
import '../styles/regent-showroom.css'

const sample = () => createBoard(randomFleet(mulberry32(1864)))

export default function RegentShowroom() {
  const t = useT(), l = useL(), lang = useLang(), navigate = useNavigate()
  const ready = useStore(s => s.status === 'ready')
  const config = useStore(s => s.config)
  const profile = useStore(s => s.profile)
  const mutate = useStore(s => s.mutate)
  const [purchasePending,setPurchasePending] = useState(false)
  const [selected, setSelected] = useState(4)
  const [compare, setCompare] = useState(false)
  const [board, setBoard] = useState(sample)
  const [feed, setFeed] = useState([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const [eventId, setEventId] = useState(0)
  const [lastDemo, setLastDemo] = useState('')
  const [previewSequence, setPreviewSequence] = useState(0)
  const design = REGENT_CLASSES.find(c => c.size === selected)
  const regent = SHIP_SKINS.find(s => s.id === 'ship_regent')
  const steel = SHIP_SKINS.find(s => s.id === 'ship_steel')
  const theme = THEMES.find(s => s.id === 'theme_regent')
  const effect = EFFECTS.find(s => s.id === 'fx_regent')
  const items = collectionItems('regent')
  const quote = collectionQuote('regent',profile?.owned||[])
  const allOwned = quote.items.length===0
  const equipped = allOwned && items.every(({slot,item})=>profile?.equipped[slot]===item.id)
  const acquire = async () => {
    if (!ready) { if(config?.appLink&&!config.devLogin) openLink(config.appLink); else navigate('/'); return }
    setPurchasePending(true);setError(null)
    try {
      await mutate(allOwned?'/me/equip':'/me/shop/buy',{itemId:'collection:regent'},{popup:false})
    } catch(e) { setError(e.code||'error_generic') }
    finally { setPurchasePending(false) }
  }
  const reset = () => { setBoard(sample()); setFeed([]); setLastDemo(''); setPreviewSequence(n => n+1) }
  const shoot = (r, c) => {
    const next = structuredClone(board)
    const shot = fire(next, r, c)
    if (!shot.ok) return
    const id = eventId + 1
    setEventId(id)
    setBoard(next)
    setFeed(events => [...events.slice(-20), { ...shot, id, at: Date.now(), by: 'me' }])
  }
  const demo = kind => {
    setPreviewSequence(n => n+1)
    const next = sample()
    let r, c
    if (kind === 'miss') {
      const occ = occupancy(next.ships)
      const cell = occ.flatMap((row, r) => row.map((v, c) => [r, c, v])).find(([, , v]) => v === -1)
      ;[r, c] = cell
    } else {
      const ship = next.ships.find(s => s.size === (kind === 'sunk' ? 3 : 4))
      const cells = shipCells(ship)
      if (kind === 'sunk') cells.slice(0, -1).forEach(([a, b]) => fire(next, a, b))
      ;[r, c] = kind === 'sunk' ? cells.at(-1) : cells[0]
    }
    const shot = fire(next, r, c), id = eventId + 1
    setEventId(id); setBoard(next)
    setFeed([{ ...shot, id, at: Date.now(), by: 'me' }]); setLastDemo(kind)
  }
  const tryBattle = async () => {
    if (!ready) {
      if (config?.appLink && !config.devLogin) openLink(config.appLink)
      else navigate('/')
      return
    }
    setPending(true); setError(null)
    try {
      const response = await request('ai:start', { difficulty: 'easy', demoFleet: 'regent' })
      if (response.error) setError(response.error)
      else navigate('/battle')
    } finally { setPending(false) }
  }

  return <main className="regent-page" lang={lang}>
    <div className="regent-shell">
      <header className="regent-nav">
        <Link to="/shop?tab=collection" aria-label={t('regent_back')}><ArrowLeft size={18} /><span>BATTLESHIP</span></Link>
        <span>{t('regent_private_edition')}</span>
      </header>
      <section className="regent-intro">
        <div className="regent-crest" aria-hidden="true"><span /><Crown size={28} strokeWidth={1.2} /><span /></div>
        <p className="regent-eyebrow">{t('regent_collection')}</p>
        <h1>{t('regent_name')}</h1>
        <p className="regent-lead">{t('regent_lead')}</p>
      </section>

      <section className="regent-drydock" aria-label={t('regent_inspect')}>
        <div className="regent-dock-meta"><span><span className="regent-live-dot" />{t('regent_inspect')}</span><span>{design.code}</span></div>
        <div className="regent-ship-stage" key={`${selected}-${compare}`}>
          <div className="regent-stage-water" aria-hidden="true" />
          {compare ? <Ship size={selected} skin={steel} className="regent-hero-ship regent-standard-ship" />
            : <RegentArtwork size={selected} className="regent-hero-ship" />}
          <div className="regent-measure" aria-hidden="true"><i /><span>{selected} {t('regent_cells')}</span><i /></div>
        </div>
        <div className="regent-class-description">
          <div><span>{compare ? t('regent_standard') : l(design.type)}</span><h2>{compare ? t('regent_standard_fleet') : l(design.name)}</h2></div>
          <button className="regent-compare" onClick={() => setCompare(!compare)} aria-pressed={compare}>
            {compare ? <Crown size={14} /> : <RotateCcw size={14} />}{compare ? t('regent_return') : t('regent_compare')}
          </button>
        </div>
        <p className="regent-ship-detail">{compare ? t('regent_compare_note') : l(design.detail)}</p>
        <div className="regent-class-picker" role="group" aria-label={t('regent_classes')}>
          {REGENT_CLASSES.map(c => <button key={c.size} onClick={() => { setSelected(c.size); setCompare(false) }}
            aria-pressed={selected === c.size} className={selected === c.size ? 'is-selected' : ''} data-regent-pick={c.size}>
            <span className="regent-picker-code">{c.code}</span>
            <RegentArtwork size={c.size} />
            <strong>{l(c.name)}</strong><span className="regent-cell-marks" aria-hidden="true">{Array.from({length:c.size}, (_, i) => <i key={i} />)}</span>
          </button>)}
        </div>
      </section>

      <div className="regent-materials">
        <div><span className="regent-material regent-material-steel" /><span>{t('regent_steel')}</span></div>
        <div><span className="regent-material regent-material-teak" /><span>{t('regent_teak')}</span></div>
        <div><span className="regent-material regent-material-brass" /><span>{t('regent_brass')}</span></div>
      </div>

      <section className="regent-range" aria-labelledby="regent-range-title">
        <div className="regent-section-title"><div><p className="regent-eyebrow">{t('regent_in_action')}</p><h2 id="regent-range-title">{t('regent_on_board')}</h2></div><Crosshair size={22} strokeWidth={1.3} /></div>
        <p className="regent-range-hint">{t('regent_board_hint')}</p>
        <div className="regent-range-board" data-regent-range>
          <div className="regent-sea-caption"><span>{l(theme.name)}</span><span>REGENT · 01</span></div>
          <Board shots={board.shots} ships={board.ships.map((s, i) => ({...s, key:i,state:s.hits>=s.size?'sunk':'alive'}))}
            skin={regent} effect={effect} theme={theme} onCell={shoot} feed={feed} previewSequence={previewSequence} />
        </div>
        <div className="regent-shot-legend">
          {[[CELL.HIT,'hit'],[CELL.MISS,'miss'],[CELL.SUNK,'sunk']].map(([state,key])=><span key={key}>
            <i><RegentShotMark state={state}/></i>{t(`fx_demo_${key}`)}
          </span>)}
        </div>
        <div className="regent-range-controls" role="group" aria-label={t('fx_demo')}>
          {['hit','miss','sunk'].map(kind => <button key={kind} onClick={() => demo(kind)} aria-pressed={lastDemo===kind}>
            {kind==='miss'?<Waves size={15}/>:<Crosshair size={15}/>} {t(`fx_demo_${kind}`)}
          </button>)}
          <button onClick={reset} aria-label={t('skins_reset')}><RotateCcw size={16}/></button>
        </div>
      </section>

      <section className="regent-order-preview">
        <Avatar name="R" size={58} frame="frame_regent"/>
        <div><h3>{t('regent_order')}</h3><p>{t('regent_order_hint')}</p></div>
      </section>
      <section className="regent-ownership" aria-labelledby="regent-ownership-title">
        <p className="regent-eyebrow">{t('regent_keep')}</p>
        <h2 id="regent-ownership-title">{t('regent_collection_title')}</h2>
        <p>{t('regent_ownership_hint')}</p>
        <div className="regent-parts">
          {items.map(({slot,item})=><div key={item.id} data-regent-item={item.id}>
            <span><small>{t({theme:'themes',ship:'ships',effect:'effects',frame:'frames'}[slot])}</small><strong>{l(item.name)}</strong></span>
            {profile?.owned.includes(item.id)?<span className="regent-part-owned"><Check size={14}/>{t('regent_owned')}</span>:<Price price={item.price}/>}
          </div>)}
        </div>
        <p className="regent-ownership-hint">{t('regent_partial_price')}</p>
        {error&&<p role="alert">{errorText(error)}</p>}
        <button className="regent-cta" onClick={acquire} disabled={purchasePending||equipped}>
          {purchasePending?t('loading'):!ready?t('regent_sign_in'):equipped?<><Check size={18}/>{t('regent_set_equipped')}</>:allOwned?t('regent_equip_set'):<>{t('regent_buy_set')}<Price price={quote.price}/></>}
        </button>
        {ready&&<span className="regent-balance">{t('regent_balance')} <Price price={{gems:profile.gems}}/></span>}
        {ready&&!allOwned&&profile.gems<(quote.price.gems||0)&&<Link className="regent-topup" to="/shop">{t('regent_topup')}<ArrowUpRight size={14}/></Link>}
      </section>
      <section className="regent-invitation">
        <div className="regent-invitation-icon"><ShieldCheck size={25} strokeWidth={1.2}/></div>
        <p className="regent-eyebrow">{t('regent_your_command')}</p>
        <h2>{t('regent_try_title')}</h2>
        <p>{t('regent_try_description')}</p>
        <button className="regent-cta" onClick={tryBattle} disabled={pending}>
          <span>{pending ? t('loading') : ready ? t('regent_trial_cta') : t('regent_open_game')}</span><ArrowUpRight size={20}/>
        </button>
        <span className="regent-free-note"><Check size={13}/>{t('regent_no_purchase')}</span>
      </section>
      <footer className="regent-footer"><span>BATTLESHIP ATELIER</span><span>01 — REGENT</span></footer>
    </div>
  </main>
}
