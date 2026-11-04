import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buyItem, equip } from '../src/services/shop.js'
import { ACHIEVEMENTS, DEFAULT_EQUIPPED, DEFAULT_OWNED, FLEET_COLLECTIONS, findCosmetic } from '../../shared/catalog.js'

const player = () => ({
  id: 1, gold: 10000, gems: 2000, xp: 45, rating: 1200, peak_rating: 1200,
  data: { owned: [...DEFAULT_OWNED], equipped: { ...DEFAULT_EQUIPPED }, stats: {}, campaign: {},
    achievements: Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, 1])), boosters: {}, pass: {} },
})

test('collection cosmetics purchase and equip without affecting match stats', () => {
  for (const c of FLEET_COLLECTIONS) {
    const u = player()
    for (const id of [c.themeId, c.shipId, c.effectId]) {
      const { slot, item } = findCosmetic(id)
      const gold = u.gold
      const gems = u.gems
      const result = buyItem(u, id)
      assert.equal(u.gold, gold - (item.price.gold || 0))
      assert.equal(u.gems, gems - (item.price.gems || 0))
      assert.ok(result.cosmetics.includes(id))
      assert.notEqual(u.data.equipped[slot], id, 'Buying must not silently equip')
      equip(u, id)
      assert.equal(u.data.equipped[slot], id)
    }
    assert.equal(u.xp, 45)
    assert.equal(u.rating, 1200)
    assert.deepEqual(u.data.stats, {})
    assert.deepEqual(u.data.boosters, {})
    assert.deepEqual(u.data.campaign, {})
  }
})

test('unowned and duplicate cosmetics cannot be equipped or charged again', () => {
  const u = player()
  assert.throws(() => equip(u, 'ship_arctic'), { code: 'not_owned' })
  buyItem(u, 'ship_arctic')
  const after = structuredClone(u)
  assert.throws(() => buyItem(u, 'ship_arctic'), { code: 'already_owned' })
  assert.deepEqual(u, after)
})

test('insufficient balance rejects a new cosmetic without partial changes', () => {
  const u = player()
  u.gems = 449
  const before = structuredClone(u)
  assert.throws(() => buyItem(u, 'theme_imperial'), { code: 'not_enough_gems' })
  assert.deepEqual(u, before)
})

test('existing Arctic and Royal owners keep their items and prices', () => {
  assert.deepEqual(findCosmetic('theme_arctic').item.price, { gold: 3000 })
  assert.deepEqual(findCosmetic('ship_royal').item.price, { gems: 500 })
  const u = player()
  u.data.owned.push('theme_arctic', 'ship_royal')
  const { gold, gems } = u
  equip(u, 'theme_arctic')
  equip(u, 'ship_royal')
  assert.equal(u.gold, gold)
  assert.equal(u.gems, gems)
  assert.equal(u.data.equipped.ship, 'ship_royal')
})

test('effect packs use the normal ownership checks and cannot be charged twice', () => {
  for (const id of ['fx_arctic', 'fx_imperial']) {
    const u = player()
    assert.throws(() => equip(u, id), { code: 'not_owned' })
    buyItem(u, id)
    const after = structuredClone(u)
    assert.throws(() => buyItem(u, id), { code: 'already_owned' })
    assert.deepEqual(u, after)
    equip(u, id)
    assert.equal(u.data.equipped.effect, id)
  }
  assert.deepEqual(findCosmetic('fx_plasma').item.price, { gold: 2500 })
  assert.deepEqual(findCosmetic('fx_firework').item.price, { gems: 350 })
})
