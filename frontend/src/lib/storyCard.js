/**
 * Renders a 1080×1920 victory card for Telegram Stories on a canvas.
 * No remote images are drawn (avatars would taint the canvas), only shapes and text.
 */
import { CELL } from '@shared/engine.js'

const W = 1080
const H = 1920

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

function drawBoard(ctx, x, y, size, shots, ships) {
  const cell = size / 10
  roundRect(ctx, x - 12, y - 12, size + 24, size + 24, 36)
  ctx.fillStyle = 'rgba(14,79,122,0.55)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(125,211,252,0.25)'
  ctx.lineWidth = 2
  for (let i = 0; i <= 10; i++) {
    ctx.beginPath()
    ctx.moveTo(x + i * cell, y)
    ctx.lineTo(x + i * cell, y + size)
    ctx.moveTo(x, y + i * cell)
    ctx.lineTo(x + size, y + i * cell)
    ctx.stroke()
  }
  for (const s of ships || []) {
    const w = (s.vertical ? 1 : s.size) * cell
    const h = (s.vertical ? s.size : 1) * cell
    roundRect(ctx, x + s.c * cell + 6, y + s.r * cell + 6, w - 12, h - 12, 18)
    ctx.fillStyle = 'rgba(148,163,184,0.35)'
    ctx.fill()
  }
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const v = shots?.[r]?.[c]
      const cx = x + c * cell + cell / 2
      const cy = y + r * cell + cell / 2
      if (v === CELL.MISS) {
        ctx.fillStyle = 'rgba(125,211,252,0.85)'
        ctx.beginPath()
        ctx.arc(cx, cy, cell * 0.12, 0, Math.PI * 2)
        ctx.fill()
      } else if (v === CELL.HIT || v === CELL.SUNK) {
        glow(ctx, cx, cy, cell * 0.55, v === CELL.SUNK ? 'rgba(244,63,94,0.55)' : 'rgba(249,115,22,0.6)')
        ctx.strokeStyle = v === CELL.SUNK ? '#fb7185' : '#fff7ed'
        ctx.lineWidth = 7
        ctx.lineCap = 'round'
        const d = cell * 0.22
        ctx.beginPath()
        ctx.moveTo(cx - d, cy - d)
        ctx.lineTo(cx + d, cy + d)
        ctx.moveTo(cx + d, cy - d)
        ctx.lineTo(cx - d, cy + d)
        ctx.stroke()
      }
    }
  }
}

/**
 * data: { title, subtitle, playerName, opponentName, stats: [[label, value]×4],
 *         shots, ships, seasonLabel, seasonColor, cta, footer }
 * Returns a PNG Blob.
 */
export async function renderStoryCard(data) {
  try {
    await Promise.all([document.fonts.load('700 120px Unbounded'), document.fonts.load('800 40px Manrope')])
  } catch {}
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0b2747')
  bg.addColorStop(0.55, '#081530')
  bg.addColorStop(1, '#050b18')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  glow(ctx, W / 2, 360, 620, 'rgba(251,191,36,0.22)')
  glow(ctx, W * 0.1, H * 0.75, 520, 'rgba(34,211,238,0.14)')
  ctx.strokeStyle = 'rgba(148,163,184,0.06)'
  ctx.lineWidth = 2
  for (let i = 0; i < W; i += 60) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, H)
    ctx.stroke()
  }
  for (let i = 0; i < H; i += 60) {
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(W, i)
    ctx.stroke()
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  // Brand + season
  ctx.fillStyle = 'rgba(226,232,240,0.75)'
  ctx.font = '700 40px Unbounded, sans-serif'
  ctx.fillText('B A T T L E S H I P', W / 2, 170)
  if (data.seasonLabel) {
    ctx.font = '800 34px Manrope, sans-serif'
    const tw = ctx.measureText(data.seasonLabel).width + 64
    roundRect(ctx, W / 2 - tw / 2, 205, tw, 64, 32)
    ctx.fillStyle = data.seasonColor || '#34d399'
    ctx.fill()
    ctx.fillStyle = '#04121f'
    ctx.fillText(data.seasonLabel, W / 2, 249)
  }

  // Trophy + title
  ctx.font = '200px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
  ctx.fillText('🏆', W / 2, 520)
  const tg = ctx.createLinearGradient(0, 560, 0, 700)
  tg.addColorStop(0, '#fef3c7')
  tg.addColorStop(1, '#f59e0b')
  ctx.fillStyle = tg
  ctx.font = '700 140px Unbounded, sans-serif'
  ctx.fillText(data.title, W / 2, 690)
  ctx.fillStyle = '#cbd5e1'
  ctx.font = '700 44px Manrope, sans-serif'
  ctx.fillText(data.subtitle, W / 2, 770)

  // Stats
  const bx = 70
  const bw = (W - bx * 2 - 30) / 2
  data.stats.forEach(([label, value], i) => {
    const x = bx + (i % 2) * (bw + 30)
    const y = 830 + Math.floor(i / 2) * 190
    roundRect(ctx, x, y, bw, 160, 36)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 70px Unbounded, sans-serif'
    ctx.fillText(String(value), x + bw / 2, y + 90)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '800 28px Manrope, sans-serif'
    ctx.fillText(label.toUpperCase(), x + bw / 2, y + 132)
  })

  // Enemy board
  drawBoard(ctx, (W - 520) / 2, 1250, 520, data.shots, data.ships)

  // CTA
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 48px Manrope, sans-serif'
  ctx.fillText(data.cta, W / 2, 1848)
  ctx.fillStyle = '#22d3ee'
  ctx.font = '800 40px Manrope, sans-serif'
  ctx.fillText(data.footer, W / 2, 1900)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('render_failed'))), 'image/png'))
}
