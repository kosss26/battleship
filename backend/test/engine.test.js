import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'
import {
  validateFleet, randomFleet, createBoard, fire, allSunk, remainingSizes, canPlace, FLEET,
} from '../../shared/engine.js'
import { chooseShot } from '../../shared/ai.js'
import { mulberry32 } from '../../shared/rng.js'
import { levelFromXp, xpToNext, questsForDay, passRewards, PASS_TIERS } from '../../shared/catalog.js'
import { verifyInitData } from '../src/telegram.js'
import { eloDelta } from '../src/services/elo.js'

test('random fleets are always valid', () => {
  for (let i = 0; i < 300; i++) {
    const fleet = randomFleet(mulberry32(i))
    assert.ok(validateFleet(fleet), `seed ${i}`)
  }
})

test('validateFleet rejects touching, overlapping and wrong fleets', () => {
  const ok = randomFleet(mulberry32(1))
  assert.equal(validateFleet(ok.slice(1)), false)
  const touching = ok.map((s) => ({ ...s }))
  touching[1] = { ...touching[0], r: touching[0].r, c: touching[0].c }
  assert.equal(validateFleet(touching), false)
  assert.equal(validateFleet(ok.map((s) => ({ ...s, size: 1 }))), false)
  assert.equal(validateFleet(ok.map((s, i) => (i === 0 ? { ...s, r: 9, c: 9 } : s))), false)
  assert.equal(validateFleet('nope'), false)
  assert.equal(canPlace([{ id: 0, r: 0, c: 0, size: 1, vertical: false }], { id: 1, r: 1, c: 1, size: 1 }), false)
})

test('fire: miss, hit, sunk with halo auto-marking', () => {
  const ships = [{ r: 0, c: 0, size: 2, vertical: false }]
  const b = { ...createBoard(ships) }
  assert.equal(fire(b, 5, 5).result, 'miss')
  assert.equal(fire(b, 5, 5).ok, false)
  assert.equal(fire(b, 0, 0).result, 'hit')
  const s = fire(b, 0, 1)
  assert.equal(s.result, 'sunk')
  assert.deepEqual(s.around.length, 4) // (0,2),(1,0),(1,1),(1,2)
  assert.ok(allSunk(b))
})

test('every AI level finishes every game with valid shots', () => {
  for (const level of ['easy', 'medium', 'hard', 'expert']) {
    for (let g = 0; g < 25; g++) {
      const rng = mulberry32(g + 100)
      const b = createBoard(randomFleet(rng))
      let n = 0
      while (!allSunk(b)) {
        const [r, c] = chooseShot(b.shots, remainingSizes(b), level, rng)
        assert.ok(fire(b, r, c).ok)
        assert.ok(++n <= 100)
      }
    }
  }
})

test('progression helpers', () => {
  assert.equal(levelFromXp(0).level, 1)
  assert.equal(levelFromXp(xpToNext(1)).level, 2)
  assert.equal(questsForDay(1, '2026-01-01').length, 3)
  assert.deepEqual(questsForDay(1, '2026-01-01'), questsForDay(1, '2026-01-01'))
  for (let t = 1; t <= PASS_TIERS; t++) {
    const r = passRewards(t)
    assert.ok(r.free && r.premium)
  }
  assert.equal(FLEET.reduce((a, b) => a + b), 20)
})

test('elo is symmetric-ish and bounded', () => {
  assert.equal(eloDelta(1000, 1000, 1), 16)
  assert.equal(eloDelta(1000, 1000, 0), -16)
  assert.ok(eloDelta(1000, 1400, 1) > 25)
  assert.ok(eloDelta(1400, 1000, 1) >= 5)
  assert.ok(eloDelta(1000, 1000, 1, 3) === 20)
})

test('telegram initData verification', () => {
  const token = '123456:TEST'
  const user = JSON.stringify({ id: 42, first_name: 'Ann' })
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user, start_param: 'ref_ABC' })
  const dcs = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n')
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest()
  params.set('hash', crypto.createHmac('sha256', secret).update(dcs).digest('hex'))
  const ok = verifyInitData(params.toString(), token)
  assert.equal(ok.user.id, 42)
  assert.equal(ok.startParam, 'ref_ABC')
  params.set('user', JSON.stringify({ id: 43, first_name: 'Eve' }))
  assert.equal(verifyInitData(params.toString(), token), null)
  assert.equal(verifyInitData('', token), null)
})
