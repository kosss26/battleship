/**
 * Generative background music via WebAudio — no audio files.
 * Two moods: 'menu' (calm ocean ambience) and 'battle' (tense pulse).
 * Uses a lookahead scheduler; pauses when the app is hidden.
 */
let ctx = null
let out = null
let enabled = false
let mood = 'menu'
let timer = null
let nextTime = 0
let step = 0
let unlocked = false
let ocean = null

const BPM = { menu: 68, battle: 92 }
// A minor: Am – F – C – G (menu), Am – Am – F – E (battle)
const PROGRESSIONS = {
  menu: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
  battle: [[57, 60, 64], [57, 60, 64], [53, 57, 60], [52, 56, 59]],
}
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12)

function ensureCtx() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  out = ctx.createGain()
  out.gain.value = 0
  const comp = ctx.createDynamicsCompressor()
  out.connect(comp).connect(ctx.destination)
  return ctx
}

function voice({ freq, start, dur, type = 'sine', vol = 0.05, attack = 0.02, cutoff = 2000, detune = 0 }) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  const f = ctx.createBiquadFilter()
  o.type = type
  o.frequency.value = freq
  o.detune.value = detune
  f.type = 'lowpass'
  f.frequency.value = cutoff
  g.gain.setValueAtTime(0.0001, start)
  g.gain.linearRampToValueAtTime(vol, start + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  o.connect(f).connect(g).connect(out)
  o.start(start)
  o.stop(start + dur + 0.05)
}

function kick(start) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.frequency.setValueAtTime(120, start)
  o.frequency.exponentialRampToValueAtTime(40, start + 0.18)
  g.gain.setValueAtTime(0.18, start)
  g.gain.exponentialRampToValueAtTime(0.0001, start + 0.25)
  o.connect(g).connect(out)
  o.start(start)
  o.stop(start + 0.3)
}

/** Soft filtered noise that rises and falls like waves */
function startOcean() {
  if (ocean) return
  const len = ctx.sampleRate * 4
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 420
  const g = ctx.createGain()
  g.gain.value = 0.012
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()
  lfo.frequency.value = 0.09
  lfoGain.gain.value = 0.01
  lfo.connect(lfoGain).connect(g.gain)
  src.connect(f).connect(g).connect(out)
  src.start()
  lfo.start()
  ocean = { src, lfo }
}

function scheduleBar(t) {
  const prog = PROGRESSIONS[mood]
  const beat = 60 / BPM[mood]
  const chord = prog[step % prog.length]
  const bar = beat * 4

  // Pad: detuned chord with slow attack
  for (const n of chord) {
    voice({ freq: midi(n), start: t, dur: bar * 1.05, type: 'triangle', vol: 0.022, attack: bar * 0.35, cutoff: 1100, detune: -6 })
    voice({ freq: midi(n), start: t, dur: bar * 1.05, type: 'sawtooth', vol: 0.006, attack: bar * 0.4, cutoff: 700, detune: 7 })
  }
  // Bass
  voice({ freq: midi(chord[0] - 24), start: t, dur: bar * 0.9, type: 'sine', vol: mood === 'battle' ? 0.07 : 0.05, attack: 0.05, cutoff: 400 })

  if (mood === 'menu') {
    // Sparse plucked arpeggio
    for (let i = 0; i < 8; i++) {
      if (Math.random() < 0.45) continue
      const n = chord[Math.floor(Math.random() * 3)] + (Math.random() < 0.4 ? 12 : 0)
      voice({ freq: midi(n), start: t + (i * bar) / 8, dur: 0.9, type: 'sine', vol: 0.03, attack: 0.005, cutoff: 3000 })
    }
  } else {
    // Driving eighth-note ostinato + kick on the beat
    for (let i = 0; i < 8; i++) {
      const n = chord[i % 3] + 12
      voice({ freq: midi(n), start: t + (i * beat) / 2, dur: beat * 0.45, type: 'square', vol: 0.012, attack: 0.004, cutoff: 1600 })
    }
    for (let i = 0; i < 4; i++) kick(t + i * beat)
  }
  step++
  return bar
}

function tick() {
  if (!ctx) return
  while (nextTime < ctx.currentTime + 1.5) nextTime += scheduleBar(nextTime)
}

function fade(to, sec = 1.2) {
  if (!out) return
  const now = ctx.currentTime
  out.gain.cancelScheduledValues(now)
  out.gain.setValueAtTime(out.gain.value, now)
  out.gain.linearRampToValueAtTime(to, now + sec)
}

function play() {
  if (!enabled || !unlocked || document.hidden) return
  if (!ensureCtx()) return
  if (ctx.state === 'suspended') ctx.resume()
  startOcean()
  if (!timer) {
    nextTime = ctx.currentTime + 0.1
    timer = setInterval(tick, 250)
    tick()
  }
  fade(0.9)
}

function pause() {
  if (!ctx) return
  fade(0, 0.6)
  setTimeout(() => {
    if (!enabled || document.hidden) {
      clearInterval(timer)
      timer = null
    }
  }, 700)
}

export function setMusicEnabled(on) {
  enabled = on
  if (on) play()
  else pause()
}

export function setMusicMood(next) {
  if (mood === next) return
  mood = next
  step = 0
}

// Browsers only allow audio after a user gesture
function unlock() {
  if (unlocked) return
  unlocked = true
  play()
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { once: true, capture: true })
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()))
}
