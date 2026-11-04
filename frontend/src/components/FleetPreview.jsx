import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Eye, RotateCcw } from 'lucide-react'
import { THEMES, SHIP_SKINS, FLEET_COLLECTIONS, findCosmetic } from '@shared/catalog.js'
import { createBoard, randomFleet, fire, shipCells, occupancy } from '@shared/engine.js'
import { mulberry32 } from '@shared/rng.js'
import { useStore } from '../store/app.js'
import { useT, useL, errorText } from '../lib/i18n.js'
import { Price } from './ui.jsx'
import { NavalAction, NavalTabs } from './naval.jsx'
import Board from './Board.jsx'
import '../styles/fleet-collections.css'

function sampleBoard(marked = false) {
  const board = createBoard(randomFleet(mulberry32(76)))
  if (marked) {
    const cells = shipCells(board.ships.find((s) => s.size === 4))
    cells.slice(0, 2).forEach(([r, c]) => fire(board, r, c))
    const single = board.ships.find((s) => s.size === 1)
    fire(board, single.r, single.c)
    const occupied = occupancy(board.ships)
    let misses = 0
    for (let r = 2; r < 10 && misses < 4; r += 2) {
      for (let c = 1; c < 10 && misses < 4; c += 3) {
        if (occupied[r][c] === -1) { fire(board, r, c); misses++ }
      }
    }
  }
  return board
}

/** Local-only fitting room: the same Board/Ship renderer, no game/socket actions. */
export default function FleetPreview({ selection, onClose }) {
  const t = useT()
  const l = useL()
  const p = useStore((s) => s.profile)
  const mutate = useStore((s) => s.mutate)
  const dialog = useRef(null)
  const [mode, setMode] = useState('fleet')
  const [board, setBoard] = useState(() => sampleBoard())
  const [error, setError] = useState(null)
  const theme = THEMES.find((x) => x.id === selection.themeId) || THEMES[0]
  const skin = SHIP_SKINS.find((x) => x.id === selection.shipId) || SHIP_SKINS[0]
  const collection = FLEET_COLLECTIONS.find((x) => x.id === selection.collectionId)
  const items = useMemo(() => collection
    ? [findCosmetic(collection.themeId), findCosmetic(collection.shipId)]
    : [findCosmetic(selection.itemId)].filter(Boolean), [collection, selection.itemId])
  const title = collection ? l(collection.name) : l(items[0]?.item.name)

  useEffect(() => {
    const node = dialog.current
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    node.showModal()
    return () => {
      node.close()
      document.body.style.overflow = overflow
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])

  const setPreviewMode = (value) => { setMode(value); setBoard(sampleBoard(value === 'marks')) }
  const shoot = (r, c) => {
    setMode('marks')
    setBoard((current) => {
      const next = JSON.parse(JSON.stringify(current))
      fire(next, r, c)
      return next
    })
  }
  const perform = async (path, body) => {
    setError(null)
    try { await mutate(path, body, { popup: false }) }
    catch (e) { setError(e.code || 'error_generic') }
  }

  return createPortal(
    <dialog ref={dialog} className="fleet-preview naval-screen" aria-labelledby="fleet-preview-title"
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        if (e.target === e.currentTarget && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) onClose()
      }}>
      <div className="fleet-preview-heading">
        <div><span><Eye size={12} />{t('skins_fitting')}</span><h2 id="fleet-preview-title">{title}</h2></div>
        <button autoFocus onClick={onClose} aria-label={t('skins_close')} className="fleet-preview-close"><X size={20} /></button>
      </div>
      <p className="fleet-preview-hint">{t('skins_preview_hint')}</p>
      <NavalTabs label={t('skins_preview_state')} value={mode} onChange={setPreviewMode}
        options={[{ value: 'fleet', label: t('skins_clean') }, { value: 'marks', label: t('skins_marks') }]} />
      <div className="fleet-preview-board">
        <Board shots={board.shots} ships={board.ships.map((s, key) => ({ ...s, key, state: s.hits >= s.size ? 'sunk' : 'alive' }))}
          skin={skin} theme={theme} onCell={shoot} />
      </div>
      <div className="fleet-preview-caption"><span>{t('skins_local_demo')}</span><button onClick={() => setPreviewMode('fleet')} aria-label={t('skins_reset')}><RotateCcw size={14} />{t('skins_reset')}</button></div>
      {error && <p className="fleet-preview-error" role="alert">{errorText(error)}</p>}
      <div className="fleet-preview-items">
        {items.map(({ slot, item }) => {
          const owned = p.owned.includes(item.id)
          const equipped = p.equipped[slot] === item.id
          return <div className="fleet-preview-item" key={item.id}>
            <div><span>{t(slot === 'theme' ? 'themes' : 'ships')}</span><strong>{l(item.name)}</strong></div>
            {equipped ? <span className="fleet-preview-equipped"><Check size={14} />{t('equipped')}</span>
              : owned ? <NavalAction className="naval-button" data-equip-id={item.id} onClick={() => perform('/me/equip', { itemId: item.id })}>{t('equip')}</NavalAction>
                : item.price ? <NavalAction className="naval-button naval-button-steel" data-buy-id={item.id} onClick={() => perform('/me/shop/buy', { itemId: item.id })}><span>{t('skins_buy')}</span><Price price={item.price} /></NavalAction>
                  : <span className="fleet-preview-equipped">{t('pass_exclusive')}</span>}
          </div>
        })}
      </div>
      <p className="fleet-preview-fair">{collection ? l(collection.description) : t('skins_cosmetic_only')}</p>
      {collection && <p className="fleet-preview-fair">{t('skins_separate_items')}</p>}
    </dialog>, document.body,
  )
}
