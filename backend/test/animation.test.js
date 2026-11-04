import { test } from 'node:test'
import assert from 'node:assert/strict'
import { finalShotDeadline, SHELL_FLIGHT_MS, IMPACT_FX_MS } from '../../frontend/src/game/animation.js'

const game = { phase: 'over' }
const feed = [{ id: 1, at: 1000, result: 'sunk' }, { id: 2, at: 1000, result: 'miss' }]

test('a final sinking waits for shell and wake even if the volley ends in a miss', () => {
  assert.equal(SHELL_FLIGHT_MS, 300)
  assert.equal(finalShotDeadline(game, { reason: 'victory' }, feed), 1000 + SHELL_FLIGHT_MS + IMPACT_FX_MS)
  assert.equal(finalShotDeadline(game, null, feed), 1000 + SHELL_FLIGHT_MS + IMPACT_FX_MS)
})

test('reduced motion, resignations and reconnects never wait for old effects', () => {
  assert.equal(finalShotDeadline(game, { reason: 'victory' }, feed, true), 0)
  for (const reason of ['resign', 'disconnect', 'abandoned']) assert.equal(finalShotDeadline(game, { reason }, feed), 0)
  assert.equal(finalShotDeadline(game, { reason: 'victory' }, []), 0)
  assert.equal(finalShotDeadline(game, { reason: 'victory' }, [{ result: 'sunk' }]), 0)
  assert.equal(finalShotDeadline({ phase: 'battle' }, null, feed), 0)
})
