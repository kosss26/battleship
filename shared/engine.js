/**
 * Core Battleship rules. Pure functions, no dependencies.
 * Shared by the server (authoritative) and the client (placement UI, previews).
 */

export const SIZE = 10
/** Classic Russian fleet: 1×4, 2×3, 3×2, 4×1 */
export const FLEET = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]

/** Shot grid values */
export const CELL = { EMPTY: 0, MISS: 1, HIT: 2, SUNK: 3 }

export const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE

export function shipCells(ship) {
  const out = []
  for (let i = 0; i < ship.size; i++) {
    out.push(ship.vertical ? [ship.r + i, ship.c] : [ship.r, ship.c + i])
  }
  return out
}

/** Cells surrounding a ship (8-neighbourhood), excluding the ship itself */
export function shipHalo(ship) {
  const own = new Set(shipCells(ship).map(([r, c]) => r * SIZE + c))
  const halo = new Set()
  for (const [r, c] of shipCells(ship)) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr
        const cc = c + dc
        const k = rr * SIZE + cc
        if (inBounds(rr, cc) && !own.has(k)) halo.add(k)
      }
    }
  }
  return [...halo].map((k) => [Math.floor(k / SIZE), k % SIZE])
}

export function emptyGrid(fill = 0) {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(fill))
}

/** Grid with ship index at each occupied cell, -1 elsewhere */
export function occupancy(ships) {
  const g = emptyGrid(-1)
  ships.forEach((s, i) => {
    for (const [r, c] of shipCells(s)) if (inBounds(r, c)) g[r][c] = i
  })
  return g
}

/**
 * Can `ship` be placed among `ships` (ignoring the ship with id `ignoreId`)?
 * Ships may not overlap or touch, including diagonally.
 */
export function canPlace(ships, ship, ignoreId = null) {
  const cells = shipCells(ship)
  if (!cells.every(([r, c]) => inBounds(r, c))) return false
  const others = ships.filter((s) => s.id !== ignoreId)
  const blocked = new Set()
  for (const o of others) {
    for (const [r, c] of shipCells(o)) blocked.add(r * SIZE + c)
    for (const [r, c] of shipHalo(o)) blocked.add(r * SIZE + c)
  }
  return cells.every(([r, c]) => !blocked.has(r * SIZE + c))
}

/** Validates a full fleet coming from an untrusted client */
export function validateFleet(ships) {
  if (!Array.isArray(ships) || ships.length !== FLEET.length) return false
  const sizes = ships.map((s) => s?.size).sort((a, b) => b - a)
  if (sizes.some((s, i) => s !== FLEET[i])) return false
  const clean = []
  for (let i = 0; i < ships.length; i++) {
    const s = ships[i]
    if (![s.r, s.c].every(Number.isInteger)) return false
    const ship = { id: i, r: s.r, c: s.c, size: s.size, vertical: !!s.vertical }
    if (!canPlace(clean, ship)) return false
    clean.push(ship)
  }
  return clean
}

/** Random valid fleet. `rng` returns [0,1). */
export function randomFleet(rng = Math.random) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const ships = []
    let ok = true
    for (let i = 0; i < FLEET.length && ok; i++) {
      const size = FLEET[i]
      let placed = false
      for (let t = 0; t < 300; t++) {
        const vertical = rng() < 0.5
        const r = Math.floor(rng() * (vertical ? SIZE - size + 1 : SIZE))
        const c = Math.floor(rng() * (vertical ? SIZE : SIZE - size + 1))
        const ship = { id: i, r, c, size, vertical }
        if (canPlace(ships, ship)) {
          ships.push(ship)
          placed = true
          break
        }
      }
      ok = placed
    }
    if (ok) return ships
  }
  throw new Error('Unable to generate fleet')
}

/** Creates a battle board from a validated fleet */
export function createBoard(ships) {
  return {
    ships: ships.map((s, i) => ({ ...s, id: i, hits: 0 })),
    occ: occupancy(ships),
    shots: emptyGrid(CELL.EMPTY),
  }
}

/**
 * Fires at (r, c). Mutates the board.
 * Returns { ok:false } for an invalid shot, otherwise
 * { ok:true, r, c, result:'miss'|'hit'|'sunk', ship?, around? }
 * When a ship is sunk, its halo is auto-marked as MISS (`around`).
 */
export function fire(board, r, c) {
  if (!inBounds(r, c) || board.shots[r][c] !== CELL.EMPTY) return { ok: false }
  const idx = board.occ[r][c]
  if (idx < 0) {
    board.shots[r][c] = CELL.MISS
    return { ok: true, r, c, result: 'miss' }
  }
  const ship = board.ships[idx]
  ship.hits++
  board.shots[r][c] = CELL.HIT
  if (ship.hits < ship.size) return { ok: true, r, c, result: 'hit' }

  for (const [sr, sc] of shipCells(ship)) board.shots[sr][sc] = CELL.SUNK
  const around = []
  for (const [hr, hc] of shipHalo(ship)) {
    if (board.shots[hr][hc] === CELL.EMPTY) {
      board.shots[hr][hc] = CELL.MISS
      around.push([hr, hc])
    }
  }
  return { ok: true, r, c, result: 'sunk', ship: publicShip(ship), around }
}

export const publicShip = (s) => ({ r: s.r, c: s.c, size: s.size, vertical: s.vertical })

export const allSunk = (board) => board.ships.every((s) => s.hits >= s.size)

export const sunkShips = (board) => board.ships.filter((s) => s.hits >= s.size).map(publicShip)

/** Sizes of ships still afloat (what the opponent may infer from the HUD) */
export const remainingSizes = (board) =>
  board.ships.filter((s) => s.hits < s.size).map((s) => s.size)

export const emptyCells = (shots) => {
  const out = []
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (shots[r][c] === CELL.EMPTY) out.push([r, c])
  return out
}

export const COLS = 'АБВГДЕЖЗИК'
export const COLS_EN = 'ABCDEFGHIJ'
export const coordLabel = (r, c, lang = 'ru') => `${(lang === 'ru' ? COLS : COLS_EN)[c]}${r + 1}`
