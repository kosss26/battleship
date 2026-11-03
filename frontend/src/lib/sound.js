/**
 * Procedural sound effects via WebAudio — no asset downloads.
 */
let ctx = null
let enabled = true
let master = null

export const setSoundEnabled = (on) => { enabled = on }

function ac() {
  if (!enabled) return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.55
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function noise(c, duration) {
  const len = Math.floor(c.sampleRate * duration)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  return src
}

function env(c, gainNode, t, a, peak, dec) {
  gainNode.gain.setValueAtTime(0.0001, t)
  gainNode.gain.exponentialRampToValueAtTime(peak, t + a)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + a + dec)
}

function tone(freq, { type = 'sine', dur = 0.15, vol = 0.3, delay = 0, slideTo = null } = {}) {
  const c = ac()
  if (!c) return
  const t = c.currentTime + delay
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  env(c, g, t, 0.01, vol, dur)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + dur + 0.05)
}

function burst({ dur = 0.4, vol = 0.5, freq = 800, q = 1, type = 'lowpass', delay = 0, sweepTo = null }) {
  const c = ac()
  if (!c) return
  const t = c.currentTime + delay
  const src = noise(c, dur + 0.1)
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(freq, t)
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur)
  f.Q.value = q
  const g = c.createGain()
  env(c, g, t, 0.005, vol, dur)
  src.connect(f).connect(g).connect(master)
  src.start(t)
  src.stop(t + dur + 0.1)
}

export const sfx = {
  tap: () => tone(660, { type: 'triangle', dur: 0.06, vol: 0.12 }),
  place: () => tone(320, { type: 'triangle', dur: 0.09, vol: 0.2, slideTo: 420 }),
  invalid: () => tone(180, { type: 'square', dur: 0.12, vol: 0.08 }),
  fire: () => burst({ dur: 0.18, vol: 0.25, freq: 2400, type: 'bandpass', q: 0.8, sweepTo: 500 }),
  miss: () => {
    burst({ dur: 0.5, vol: 0.28, freq: 1200, type: 'bandpass', q: 0.6, sweepTo: 300, delay: 0.05 })
    tone(900, { dur: 0.12, vol: 0.05, delay: 0.05, slideTo: 500 })
  },
  hit: () => {
    burst({ dur: 0.55, vol: 0.7, freq: 900, sweepTo: 80 })
    tone(120, { type: 'sine', dur: 0.4, vol: 0.5, slideTo: 40 })
  },
  sunk: () => {
    burst({ dur: 1.1, vol: 0.8, freq: 600, sweepTo: 50 })
    tone(90, { type: 'sawtooth', dur: 0.9, vol: 0.25, slideTo: 30 })
    burst({ dur: 0.6, vol: 0.3, freq: 3000, type: 'highpass', delay: 0.15 })
  },
  radar: () => {
    tone(1200, { dur: 0.35, vol: 0.12, slideTo: 1500 })
    tone(1200, { dur: 0.35, vol: 0.07, delay: 0.4, slideTo: 1500 })
  },
  turn: () => tone(880, { type: 'triangle', dur: 0.12, vol: 0.12, slideTo: 1320 }),
  coin: () => {
    tone(988, { type: 'square', dur: 0.08, vol: 0.06 })
    tone(1319, { type: 'square', dur: 0.25, vol: 0.06, delay: 0.08 })
  },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.3, vol: 0.18, delay: i * 0.12 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, { type: 'sine', dur: 0.35, vol: 0.16, delay: i * 0.16 })),
  found: () => [660, 880].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.18, vol: 0.16, delay: i * 0.1 })),
  tick: () => tone(1500, { type: 'square', dur: 0.03, vol: 0.04 }),
}
