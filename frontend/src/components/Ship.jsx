import { useId } from 'react'

/**
 * Vector warship. Drawn horizontally in a (size*100 × 100) box and rotated for vertical ships.
 * state: 'alive' | 'sunk' | 'ghost' | 'invalid'
 */
export default function Ship({ size, vertical, skin, state = 'alive', className = '', style }) {
  const id = useId().replace(/:/g, '')
  const L = size * 100
  const [h1, h2] = skin?.hull || ['#94a3b8', '#475569']
  const deck = skin?.deck || '#cbd5e1'
  const sunk = state === 'sunk'
  const ghost = state === 'ghost' || state === 'invalid'

  const hull = `M8,30 Q8,10 30,10 H${L - 36} Q${L - 8},12 ${L - 3},50 Q${L - 8},88 ${L - 36},90 H30 Q8,90 8,70 Z`
  const deckPath = `M28,28 H${L - 42} Q${L - 22},30 ${L - 18},50 Q${L - 22},70 ${L - 42},72 H28 Q20,72 20,64 V36 Q20,28 28,28 Z`

  const turrets = []
  for (let i = 0; i < size; i++) {
    const cx = i * 100 + 50 - (i === size - 1 && size > 1 ? 8 : 0)
    turrets.push(cx)
  }

  const content = (
    <g>
      <path d={hull} fill={sunk ? '#3f1d1d' : `url(#h${id})`} stroke={sunk ? '#7f1d1d' : 'rgba(0,0,0,0.45)'} strokeWidth="3" />
      <path d={deckPath} fill={sunk ? '#5b2121' : deck} opacity={sunk ? 0.6 : 0.28} />
      {size >= 3 && <rect x={L / 2 - 26} y={34} width={52} height={32} rx={7} fill={sunk ? '#451a1a' : h2} stroke="rgba(0,0,0,0.35)" strokeWidth="2" />}
      {turrets.map((cx, i) => (
        <g key={i} opacity={sunk ? 0.5 : 1}>
          {size > 2 && i === Math.floor(size / 2) ? null : (
            <>
              <rect x={cx} y={45} width={34} height={10} rx={3} fill={sunk ? '#2a0f0f' : '#1e293b'} />
              <circle cx={cx} cy={50} r={17} fill={sunk ? '#4b1f1f' : h1} stroke="rgba(0,0,0,0.45)" strokeWidth="3" />
              <circle cx={cx - 5} cy={44} r={5} fill="#fff" opacity={sunk ? 0 : 0.35} />
            </>
          )}
        </g>
      ))}
    </g>
  )

  return (
    <svg
      viewBox={vertical ? `0 0 100 ${L}` : `0 0 ${L} 100`}
      className={className}
      style={{
        ...style,
        filter: sunk ? 'grayscale(0.3)' : state === 'invalid' ? 'drop-shadow(0 0 6px #f43f5e)' : ghost ? 'drop-shadow(0 0 8px var(--glow))' : 'drop-shadow(0 3px 4px rgba(0,0,0,0.5))',
        opacity: ghost ? 0.85 : 1,
      }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`h${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={state === 'invalid' ? '#fb7185' : h1} />
          <stop offset="1" stopColor={state === 'invalid' ? '#9f1239' : h2} />
        </linearGradient>
      </defs>
      {vertical ? <g transform={`translate(100,0) rotate(90)`}>{content}</g> : content}
    </svg>
  )
}
