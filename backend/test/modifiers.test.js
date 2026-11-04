import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GameRoom, botProfile } from '../src/game/room.js'
import { CELL, shipCells, SIZE } from '../../shared/engine.js'
import { CAMPAIGN, FOG_MEMORY } from '../../shared/catalog.js'

process.env.BOT_FAST = '1'

function makeRoom(mods) {
  const events = []
  let finished = null
  const room = new GameRoom({
    mode: 'campaign',
    level: 31,
    mods,
    seats: [{ kind: 'human', userId: 1, profile: { name: 'Me' } }, { kind: 'bot', profile: botProfile('easy') }],
    hooks: { emit: (uid, ev, p) => events.push([ev, p]), onFinish: (r) => { finished = r.result } },
  })
  room.place(1, 'random')
  return { room, events, finished: () => finished }
}

const enemy = (room) => room.seats[1].board
const emptyWater = (room) => {
  const b = enemy(room)
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (b.occ[r][c] < 0 && b.shots[r][c] === CELL.EMPTY) return [r, c]
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const myTurn = async (room) => {
  for (let i = 0; i < 200 && room.turn !== 0 && room.phase === 'battle'; i++) await wait(5)
}

test('campaign has 60 missions, second half with special rules', () => {
  assert.equal(CAMPAIGN.length, 60)
  assert.ok(CAMPAIGN.slice(30).every((l) => Object.keys(l.mods).length > 0))
  assert.ok(CAMPAIGN.slice(0, 30).every((l) => Object.keys(l.mods).length === 0))
})

test('enemyFirst: the bot shoots first', async () => {
  const { room } = makeRoom({ enemyFirst: true })
  assert.equal(room.turn, 1)
  await wait(50)
  assert.ok(room.seats[1].shots >= 1)
  room.dispose()
})

test('noBoosters disables boosters', () => {
  const { room } = makeRoom({ noBoosters: true })
  assert.equal(room.boostersAllowed, false)
  room.dispose()
})

test('fog: misses fade after FOG_MEMORY shots; firing there again is a wasted shot', async () => {
  const { room } = makeRoom({ fog: true })
  const [r, c] = emptyWater(room)
  room.fire(1, r, c)
  assert.equal(room.snapshot(0).opp.shots[r][c], CELL.MISS, 'visible right after the shot')
  // Make FOG_MEMORY more shots
  for (let k = 0; k < FOG_MEMORY; k++) {
    await myTurn(room)
    const [rr, cc] = emptyWater(room)
    room.fire(1, rr, cc)
  }
  await myTurn(room)
  assert.equal(room.snapshot(0).opp.shots[r][c], CELL.EMPTY, 'faded')
  const before = room.seats[0].shots
  assert.equal(room.fire(1, r, c).ok, true, 'hidden cell can be fired at')
  assert.equal(room.seats[0].shots, before + 1, 'and it costs a shot')
  assert.equal(room.snapshot(0).opp.shots[r][c], CELL.MISS, 'revealed again')
  assert.equal(room.turn, 1, 'turn passes')
  room.dispose()
})

test('noHalo: cells around a sunk ship stay unknown to the shooter', () => {
  const { room, events } = makeRoom({ noHalo: true })
  const b = enemy(room)
  const boat = b.ships.find((s) => s.size === 1)
  const [r, c] = shipCells(boat)[0]
  room.fire(1, r, c)
  const shot = events.filter(([e, p]) => e === 'game:shot' && p.by === 'me').at(-1)[1]
  assert.equal(shot.results[0].result, 'sunk')
  assert.equal(shot.results[0].around, undefined)
  const view = room.snapshot(0).opp.shots
  let hidden = 0
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const rr = r + dr
    const cc = c + dc
    if ((dr || dc) && rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) {
      assert.equal(b.shots[rr][cc], CELL.MISS, 'server knows')
      if (view[rr][cc] === CELL.EMPTY) hidden++
    }
  }
  assert.ok(hidden > 0)
  room.dispose()
})

test('ammo: running out of shots loses the mission', async () => {
  const { room, finished } = makeRoom({ ammo: 3 })
  for (let k = 0; k < 3 && room.phase === 'battle'; k++) {
    await myTurn(room)
    const [r, c] = emptyWater(room)
    room.fire(1, r, c)
  }
  await wait(20)
  assert.equal(room.phase, 'over')
  assert.deepEqual([finished().winnerSeat, finished().reason], [1, 'out_of_ammo'])
  assert.equal(room.snapshot(0).ammoLeft, 0)
})

test('blitz: 10-second turns with an auto-shot, no forfeit', () => {
  const { room } = makeRoom({ blitz: true })
  assert.equal(room.turnMs, 10_000)
  assert.ok(room.deadline && room.deadline - Date.now() <= 10_000)
  for (let k = 0; k < 4; k++) {
    room.turn = 0
    room.turnTimeout()
  }
  assert.notEqual(room.result?.reason, 'timeout')
  assert.equal(room.seats[0].shots, 4)
  room.dispose()
})
