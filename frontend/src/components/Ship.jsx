import { useId } from 'react'
import RegentShip from './RegentShip.jsx'

function DetailedHull({ size, skin, sunk, id }) {
  const L = size * 100
  const imperial = skin.model === 'imperial'
  const accent = sunk ? '#8b4e43' : skin.accent
  const edge = sunk ? '#6d3933' : imperial ? '#c7a464' : '#b7d6eb'
  const hull = `M9,31 Q9,13 27,13 H${L - 35} Q${L - 13},16 ${L - 4},50 Q${L - 13},84 ${L - 35},87 H27 Q9,87 9,69 Z`
  const deck = `M22,33 Q22,25 32,25 H${L - 42} Q${L - 24},28 ${L - 17},50 Q${L - 24},72 ${L - 42},75 H32 Q22,75 22,67 Z`
  const guns = size === 1 ? [62] : size === 2 ? [45, 148] : size === 3 ? [55, L - 65] : [55, L - 138, L - 65]
  const bridge = size === 1 ? 27 : size === 2 ? 96 : size === 3 ? 144 : 169
  return (
    <g data-ship-model={skin.model}>
      <defs>
        <clipPath id={`premium-hull-${id}`}><path d={hull} /></clipPath>
        <clipPath id={`premium-deck-${id}`}><path d={deck} /></clipPath>
        <linearGradient id={`premium-metal-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor={sunk ? '#573530' : imperial ? '#647687' : '#f1f8ff'} />
          <stop offset=".42" stopColor={sunk ? '#412622' : imperial ? '#293e51' : '#b4c8d9'} />
          <stop offset="1" stopColor={sunk ? '#291a19' : imperial ? '#142538' : '#7395b1'} />
        </linearGradient>
        <pattern id={`premium-camo-${id}`} width="85" height="68" patternUnits="userSpaceOnUse">
          <path d="M0 5h31l24 19-25 19L0 27ZM57 43l28-13v38H39Z" fill="#456886" opacity=".56" />
          <path d="m34 0 24 15 27-4V0ZM0 51l28-9 24 26H0Z" fill="#f4faff" opacity=".75" />
        </pattern>
      </defs>
      <path d={hull} fill={sunk ? '#382421' : `url(#h${id})`} stroke="#08121d" strokeWidth="3" />
      {!imperial && !sunk && <path d={hull} fill={`url(#premium-camo-${id})`} />}
      <path d={deck} fill={sunk ? '#482c28' : skin.deck} stroke={edge} strokeWidth="1.6" />
      <g clipPath={`url(#premium-deck-${id})`} opacity={sunk ? .2 : imperial ? .42 : .2}>
        {Array.from({ length: Math.ceil(L / 11) }, (_, i) => <path key={i} d={`M${i * 11} 21v60`} stroke={imperial ? '#39291b' : '#62839e'} strokeWidth="1.1" />)}
      </g>
      <path d={hull} fill="none" stroke={edge} strokeWidth="1.8" opacity=".9" />
      <g clipPath={`url(#premium-hull-${id})`} opacity={sunk ? .25 : .85}>
        {[20, 80].map((y) => <g key={y}>
          <path d={`M22 ${y}H${L - 29}`} stroke={edge} strokeWidth="1.6" />
          {Array.from({ length: Math.max(2, size * 5) }, (_, i) => <path key={i} d={`M${25 + i * 18} ${y - 3}v6`} stroke={edge} strokeWidth="1.5" />)}
        </g>)}
      </g>
      {guns.map((cx, i) => <g key={i} opacity={sunk ? .48 : 1}>
        <ellipse cx={cx} cy="53" rx="17" ry="16" fill="#05121c" opacity=".45" />
        {[46, 54].map((y) => <rect key={y} x={cx + 3} y={y - 2} width={size === 1 ? 22 : 27} height="4" rx="1" fill={sunk ? '#2c1d1b' : '#263b4e'} stroke={edge} strokeWidth=".8" />)}
        <path d={`M${cx - 13} 39q0-5 5-5h17l8 9v14l-8 9H${cx - 8}q-5 0-5-5Z`} fill={`url(#premium-metal-${id})`} stroke={edge} strokeWidth="1.8" />
        {!imperial && !sunk && <path d={`m${cx - 11} 39 16-4 10 10-15 11-11-5Z`} fill="#eaf5ff" opacity=".65" />}
        <path d={`M${cx - 9} 39h14`} stroke={accent} strokeWidth="2" opacity={sunk ? 0 : .8} />
        <circle cx={cx - 5} cy="51" r="3" fill={sunk ? '#412622' : imperial ? '#ac8e55' : '#7997af'} />
      </g>)}
      <g opacity={sunk ? .5 : 1}>
        <rect x={bridge - 17} y="29" width={size >= 3 ? 42 : 29} height="42" rx="5" fill={`url(#premium-metal-${id})`} stroke={edge} strokeWidth="1.5" />
        <rect x={bridge - 12} y="37" width={size >= 3 ? 30 : 20} height="26" rx="4" fill={sunk ? '#3d2824' : imperial ? '#1c3348' : '#d5e4ef'} stroke={edge} strokeWidth="1" />
        {!sunk && <g fill={imperial ? '#f1d18c' : '#72d6ff'}>{[0, 1, 2].map((i) => <rect key={i} x={bridge - 10 + i * 7} y="38" width="4" height="3" rx=".8" />)}</g>}
        <path d={`M${bridge + 2} 43v16m-6-8h12`} stroke={edge} strokeWidth="1.8" />
        <circle cx={bridge + 2} cy="50" r="2" fill={accent} />
      </g>
      {size >= 3 && <g fill="none" stroke={accent} strokeWidth="1.8" opacity={sunk ? .25 : .9}>
        {imperial ? <><circle cx="93" cy="42" r="3" /><path d="M93 45v17m-8-10c0 13 16 13 16 0m-8-3h10m-19 0h9" /></> : <><path d="M93 40v20m-8-15 16 10m-16 0 16-10" /><circle cx="93" cy="50" r="8" strokeWidth="1" /></>}
      </g>}
      {!sunk && <g fill={accent}>{[27, L - 27].map((x) => <g key={x}><rect x={x} y="18" width="8" height="2" rx="1" /><rect x={x} y="80" width="8" height="2" rx="1" /></g>)}</g>}
    </g>
  )
}

/**
 * Vector warship. Drawn horizontally in a (size*100 × 100) box and rotated for vertical ships.
 * state: 'alive' | 'sunk' | 'ghost' | 'invalid'
 */
export default function Ship({ size, vertical, skin, state = 'alive', className = '', style }) {
  const id = useId().replace(/:/g, '')
  if (skin?.model === 'regent') return <RegentShip size={size} vertical={vertical} state={state} className={className} style={style} />
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

  const content = skin?.model ? <DetailedHull size={size} skin={skin} sunk={sunk} id={id} /> : (
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
