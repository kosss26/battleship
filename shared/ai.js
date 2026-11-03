/**
 * Battleship AI. Works only with public knowledge: the shot grid it has
 * produced and the sizes of ships still afloat. It never peeks at the board.
 *
 * Levels:
 *  - easy:   mostly random, sometimes finishes a wounded ship
 *  - medium: hunt (checkerboard parity) + target mode
 *  - hard:   probability-density targeting with full rule inference
 */
import { SIZE, CELL, inBounds } from './engine.js'

const key = (r, c) => r * SIZE + c

/** Cells that can never contain a ship (diagonal to an unresolved hit) */
function impossibleCells(shots) {
  const bad = new Set()
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (shots[r][c] !== CELL.HIT) continue
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const rr = r + dr
        const cc = c + dc
        if (inBounds(rr, cc)) bad.add(key(rr, cc))
      }
    }
  }
  return bad
}

function candidates(shots, bad) {
  const out = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (shots[r][c] === CELL.EMPTY && !bad.has(key(r, c))) out.push([r, c])
    }
  }
  return out
}

function hitCells(shots) {
  const out = []
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (shots[r][c] === CELL.HIT) out.push([r, c])
  return out
}

/** Neighbours of the wounded ship, respecting its line if known */
function targetCells(shots, bad) {
  const hits = hitCells(shots)
  if (!hits.length) return []
  // Group: take the first hit and follow its line
  const [r0, c0] = hits[0]
  const line = hits.filter(([r, c]) => r === r0 || c === c0)
  let horizontal = null
  if (line.some(([r, c]) => r === r0 && c !== c0)) horizontal = true
  else if (line.some(([r, c]) => c === c0 && r !== r0)) horizontal = false

  const out = []
  const add = (r, c) => {
    if (inBounds(r, c) && shots[r][c] === CELL.EMPTY && !bad.has(key(r, c))) out.push([r, c])
  }
  if (horizontal === true) {
    const cols = line.filter(([r]) => r === r0).map(([, c]) => c)
    add(r0, Math.min(...cols) - 1)
    add(r0, Math.max(...cols) + 1)
  } else if (horizontal === false) {
    const rows = line.filter(([, c]) => c === c0).map(([r]) => r)
    add(Math.min(...rows) - 1, c0)
    add(Math.max(...rows) + 1, c0)
  } else {
    add(r0 - 1, c0)
    add(r0 + 1, c0)
    add(r0, c0 - 1)
    add(r0, c0 + 1)
  }
  return out
}

/** Probability density over all placements of remaining ships */
export function densityMap(shots, remaining) {
  const score = Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
  const bad = impossibleCells(shots)
  const hasHits = hitCells(shots).length > 0
  for (const size of remaining) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        for (const vertical of size === 1 ? [false] : [false, true]) {
          let ok = true
          let hitsCovered = 0
          for (let i = 0; i < size && ok; i++) {
            const rr = vertical ? r + i : r
            const cc = vertical ? c : c + i
            if (!inBounds(rr, cc)) ok = false
            else {
              const v = shots[rr][cc]
              if (v === CELL.MISS || v === CELL.SUNK) ok = false
              else if (v === CELL.HIT) hitsCovered++
              else if (bad.has(key(rr, cc))) ok = false
            }
          }
          if (!ok) continue
          // While a ship is wounded, placements that do not cover it barely matter
          let weight = hitsCovered > 0 ? 1 + hitsCovered * 25 : 1
          if (hasHits && hitsCovered === 0) weight = 0.05
          for (let i = 0; i < size; i++) {
            const rr = vertical ? r + i : r
            const cc = vertical ? c : c + i
            if (shots[rr][cc] === CELL.EMPTY) score[rr][cc] += weight
          }
        }
      }
    }
  }
  return score
}

const randomOf = (arr, rng) => arr[Math.floor(rng() * arr.length)]

export function chooseShot(shots, remaining, level = 'medium', rng = Math.random) {
  const bad = impossibleCells(shots)
  const all = candidates(shots, level === 'easy' ? new Set() : bad)
  const pool = all.length ? all : candidates(shots, new Set())

  if (level === 'easy') {
    const targets = targetCells(shots, new Set())
    if (targets.length && rng() < 0.3) return randomOf(targets, rng)
    return randomOf(pool, rng)
  }

  if (level === 'medium') {
    const targets = targetCells(shots, bad)
    if (targets.length) return randomOf(targets, rng)
    const minShip = Math.min(...remaining, 2)
    const parity = pool.filter(([r, c]) => (r + c) % minShip === 0)
    // Occasionally behaves like a human and skips parity
    if (parity.length && rng() < 0.85) return randomOf(parity, rng)
    return randomOf(pool, rng)
  }

  // hard / expert: density map, random tie-break among the best cells
  const score = densityMap(shots, remaining)
  let best = -1
  let bestCells = []
  for (const [r, c] of pool) {
    const s = score[r][c]
    if (s > best + 1e-9) {
      best = s
      bestCells = [[r, c]]
    } else if (Math.abs(s - best) < 1e-9) bestCells.push([r, c])
  }
  if (level === 'hard' && rng() < 0.2 && !hitCells(shots).length) return randomOf(pool, rng)
  return randomOf(bestCells.length ? bestCells : pool, rng)
}

export const AI_LEVELS = ['easy', 'medium', 'hard', 'expert']
