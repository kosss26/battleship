import { useId } from 'react'
import { Anchor, Shield, Crosshair, Star, Lock, Compass } from 'lucide-react'
import { rankFor } from '@shared/catalog.js'
import { useL } from '../lib/i18n.js'
import '../styles/naval-identity.css'
import PlayerAvatar from './PlayerAvatar.jsx'
import '../styles/naval-expedition.css'

export function CaptainAvatar(props) {
  return <PlayerAvatar {...props} captain/>
}

export function NavalRank({ rating }) {
  const l = useL()
  return <span className="identity-rank"><span className="identity-rank-mark"><Shield size={24} /><Anchor size={14} /></span>{l(rankFor(rating).name)}</span>
}

/** Real vector medals keep their metallic detail at every phone density. */
export function NavalMedal({ type = 'anchor', tone = 'silver', locked = false, className = '' }) {
  const id = useId().replace(/:/g, '')
  const Icon = locked ? Lock : ({ anchor: Anchor, target: Crosshair, star: Star, compass: Compass }[type] || Anchor)
  const colors = tone === 'gold' ? ['#fff1bb', '#dcb867', '#86602c'] : ['#edf9ff', '#aac6d7', '#496b81']
  return (
    <span className={`naval-medal ${className}${locked ? ' is-locked' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" fill="none">
        <defs><linearGradient id={id} x1="15" y1="10" x2="80" y2="95" gradientUnits="userSpaceOnUse"><stop stopColor={colors[0]} /><stop offset=".48" stopColor={colors[1]} /><stop offset=".72" stopColor={colors[2]} /><stop offset="1" stopColor={colors[0]} /></linearGradient></defs>
        <g stroke={`url(#${id})`} strokeWidth="1.5">
          <path d="M47 90C18 87 8 61 19 29M53 90C82 87 92 61 81 29" />
          {[[35, 82, -55], [25, 74, -50], [18, 63, -35], [16, 51, -15], [19, 39, 10], [24, 29, 25]].map(([x, y, angle], i) => <g key={i} fill={`url(#${id})`} strokeWidth=".6"><ellipse cx={x} cy={y} rx="3.8" ry="7" transform={`rotate(${angle} ${x} ${y})`} /><ellipse cx={100 - x} cy={y} rx="3.8" ry="7" transform={`rotate(${-angle} ${100 - x} ${y})`} /></g>)}
          {type === 'anchor' || locked ? <><path d="M50 13L73 23V48C73 64 61 75 50 81C39 75 27 64 27 48V23Z" fill="#102b3d" /><path d="M50 19L67 27V48C67 59 59 69 50 74C41 69 33 59 33 48V27Z" /></> : <><circle cx="50" cy="46" r="28" fill="#102b3d" /><circle cx="50" cy="46" r="24" /></>}
        </g>
      </svg>
      <Icon className="naval-medal-symbol" strokeWidth={1.6} style={{ color: colors[0] }} />
    </span>
  )
}


export function MedalArt({ type = 'anchor', locked = false, className = '' }) {
  const index = Math.max(0, ['anchor', 'target', 'star', 'kraken', 'ship', 'compass', 'bolt', 'friends'].indexOf(type))
  return <span aria-hidden="true" data-medal-type={type} className={`naval-medal-art ${locked ? 'is-locked' : ''} ${className}`} style={{ '--medal-x': `${index % 4 * 100 / 3}%`, '--medal-y': index < 4 ? '0%' : '100%' }} />
}

export function achievementMedal(achievement) {
  const stat = achievement.stat
  if (stat === 'sunk') return achievement.goal >= 1000 ? 'kraken' : 'ship'
  if (['bestHitChain', 'perfectWins'].includes(stat)) return 'target'
  if (['bestStreak', 'fastWins', 'expertWins'].includes(stat)) return 'bolt'
  if (['referrals', 'duels'].includes(stat)) return 'friends'
  if (['campaignStars', 'hardWins', 'bestDailyStreak'].includes(stat)) return 'compass'
  if (['wins', 'peakRating', 'pvpWins'].includes(stat)) return 'star'
  return 'anchor'
}
