import { useId } from 'react'
import { CELL } from '@shared/engine.js'
import '../styles/regent-combat.css'

const fragments = Array.from({ length: 10 }, (_, i) => {
  const a = i * Math.PI * .2 + .18
  return { '--dx': `${Math.cos(a) * (22 + i % 3 * 5)}px`, '--dy': `${Math.sin(a) * 24 - 8}px`, '--turn': `${i * 73}deg`, '--delay': `${i % 3 * 14}ms` }
})

/** Brass jacket, steel penetrator. Shared flight timing with every other shell. */
export function RegentShellArt({ id }) {
  return <svg viewBox="0 0 24 38" className="h-full w-full" aria-hidden="true">
    <defs><linearGradient id={id}><stop stopColor="#735b35"/><stop offset=".28" stopColor="#e9d49e"/><stop offset=".52" stopColor="#b89758"/><stop offset=".75" stopColor="#efdfb2"/><stop offset="1" stopColor="#5f4b2e"/></linearGradient></defs>
    <path d="M12 2C8 7 6 11 6 16v18h12V16c0-5-2-9-6-14Z" fill={`url(#${id})`} stroke="#392f24" strokeWidth=".8"/>
    <path d="M12 2C9 5 7 9 6.4 12h11.2C17 9 15 5 12 2Z" fill="#8a9a9b"/>
    <path d="M12 3c-2 3-3 5-3.7 8" fill="none" stroke="#e3e6d9" strokeWidth="1.2"/>
    <path d="M6 28h12M6 31h12" stroke="#4b3d29" strokeWidth="1.4"/>
    <path d="M8 16v9" stroke="#fff2cd" strokeWidth=".8" opacity=".65"/>
  </svg>
}

export function RegentImpact({ sunk = false }) {
  return <div data-impact="hit" data-effect-style="regent" className={`regent-impact${sunk ? ' is-sinking' : ''}`} aria-hidden="true">
    <span className="regent-impact-pressure"/>
    <span className="regent-impact-core"/><span className="regent-impact-fire"/>
    {fragments.map((style, i) => <span key={i} className={`regent-fragment${i % 3 === 0 ? ' is-steel' : ''}`} style={style}/>)}
    {[0,1,2].map(i => <span key={i} className="regent-gun-smoke" style={{'--drift': `${(i-1)*12}px`, '--delay': `${90+i*85}ms`}}/>)}
  </div>
}

export function RegentSplash() {
  return <div data-impact="miss" data-effect-style="regent" className="regent-splash" aria-hidden="true">
    {[0,1,2].map(i => <span key={i} className="regent-splash-ring" style={{'--delay':`${i*100}ms`}}/>)}
    <span className="regent-water-base"/><span className="regent-water-plume"/>
    {[-3,-2,-1,0,1,2,3].map((x,i) => <span key={x} className="regent-spray" style={{'--dx':`${x*6}px`, '--dy':`${-25+Math.abs(x)*4}px`, '--delay':`${i%3*24}ms`}}/>)}
  </div>
}

/** Persistent marks must stay legible once all transient effects have finished. */
export function RegentShotMark({ state }) {
  const id = `regent-mark-${useId().replace(/:/g, '')}`
  if (state === CELL.MISS) return <span className="regent-shot-mark regent-miss-mark" data-regent-mark="miss" aria-hidden="true">
    <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="8.5" fill="#061d24aa" stroke="#a9d2cf" strokeOpacity=".75" strokeWidth="1"/><circle cx="20" cy="20" r="3" fill="#c8e5df"/><path d="M17 8a12 12 0 0 1 13 5M23 32a12 12 0 0 1-13-5" fill="none" stroke="#9fc4c0" strokeOpacity=".35" strokeWidth=".8"/></svg>
  </span>
  const sunk = state === CELL.SUNK
  return <span className={`regent-shot-mark ${sunk ? 'regent-wreck-mark' : 'regent-hit-mark'}`} data-regent-mark={sunk ? 'sunk' : 'hit'} aria-hidden="true">
    <svg viewBox="0 0 40 40">
      <defs><radialGradient id={id}><stop stopColor={sunk?'#071719':'#edab4b'} stopOpacity={sunk?'.9':'.65'}/><stop offset=".48" stopColor={sunk?'#101d20':'#a24b20'} stopOpacity=".75"/><stop offset="1" stopColor="#06151a" stopOpacity="0"/></radialGradient></defs>
      <circle cx="20" cy="20" r="18" fill={`url(#${id})`}/>
      <path d="m13 13 14 14m0-14L13 27" fill="none" stroke="#061113" strokeWidth="5" strokeLinecap="round"/>
      <path d="m13 13 14 14m0-14L13 27" fill="none" stroke={sunk?'#a9bab3':'#ffe0a2'} strokeWidth={sunk?'2':'2.4'} strokeLinecap="round"/>
      {sunk ? <path d="M7 14V7h7m12 0h7v7m0 12v7h-7m-12 0H7v-7" fill="none" stroke="#a5b6ac" strokeOpacity=".55" strokeWidth="1"/> : <circle className="regent-hit-ember" cx="20" cy="20" r="2" fill="#fff4cd"/>}
    </svg>
  </span>
}

export function RegentSinkWake() {
  return <div data-sinking data-effect-style="regent" className="regent-sink" aria-hidden="true">
    <span className="regent-hull-shadow"/>
    {[0,1,2].map(i => <span key={i} className="regent-hull-wave" style={{'--delay':`${i*145}ms`}}/>)}
    <span className="regent-hull-foam"/>
    {Array.from({length:8},(_,i)=><span key={i} className="regent-wreck-bubble" style={{left:`${10+i*11}%`,top:`${28+i%3*20}%`,'--delay':`${i*60}ms`}}/>)}
  </div>
}

/** Survey points at intersections are decorative; all cell hitboxes stay identical. */
export function RegentChart() {
  return <svg className="regent-chart" viewBox="0 0 1000 1000" aria-hidden="true">
    <g fill="none" stroke="#cbb788" strokeWidth="1.2" opacity=".42">
      <path d="M20 72V20h52m856 0h52v52m0 856v52h-52m-856 0H20v-52" strokeWidth="3"/>
      {[200,500,800].flatMap(x=>[200,500,800].map(y=><path key={`${x}-${y}`} d={`M${x-5} ${y}h10m-5-5v10`}/>))}
      {Array.from({length:9},(_,i)=><path key={i} d={`M${(i+1)*100} 0v6m0 988v12M0 ${(i+1)*100}h6m988 0h12`}/>)}
    </g>
    <g transform="translate(922,84)" fill="none" stroke="#c6b78b" opacity=".25">
      <circle r="42" strokeWidth=".8"/><circle r="32" strokeWidth=".6"/>
      <path d="M0-48V48m-48-48h96M-30-30l60 60m0-60-60 60" strokeWidth=".7"/>
      <path d="m0-33 7 33-7 33-7-33Z" strokeWidth="1.2"/><path d="m0-33 7 33H0Z" fill="#c6b78b"/>
    </g>
  </svg>
}
