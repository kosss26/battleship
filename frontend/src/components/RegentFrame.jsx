import { useId } from 'react'
import '../styles/battle-report.css'

export default function RegentFrame() {
  const id = `order-${useId().replace(/:/g,'')}`
  return <svg className="regent-avatar-frame" viewBox="0 0 100 100" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff1c4"/><stop offset=".3" stopColor="#c7ab6b"/><stop offset=".55" stopColor="#695635"/><stop offset=".77" stopColor="#e6d19a"/><stop offset="1" stopColor="#a28851"/></linearGradient></defs>
    <circle cx="50" cy="50" r="44.5" fill="none" stroke="#081b20" strokeWidth="8"/>
    <circle cx="50" cy="50" r="44.5" fill="none" stroke={`url(#${id})`} strokeWidth="4.5"/>
    <circle cx="50" cy="50" r="40" fill="none" stroke="#f8dfaa" strokeOpacity=".55" strokeWidth=".8"/>
    {[false,true].map(flip=><g key={String(flip)} transform={flip?'translate(100,0) scale(-1,1)':undefined} fill={`url(#${id})`}>
      <path d="M40 92C12 83 2 55 15 31" fill="none" stroke={`url(#${id})`} strokeWidth="1.4"/>
      {Array.from({length:6},(_,i)=><ellipse key={i} cx={11+i*.9+i*i*.57} cy={40+i*8} rx="3.3" ry="6" transform={`rotate(${-35+i*8} ${11+i*.9+i*i*.57} ${40+i*8})`}/>)}
    </g>)}
    <path d="m38 9-2-9 9 5 5-8 5 8 9-5-2 9Z" fill={`url(#${id})`} stroke="#433a26" strokeWidth="1"/>
    <path d="M39 11h22" stroke="#eedba3" strokeWidth="2"/>
    <path d="m50 87 5 7-5 7-5-7Z" fill={`url(#${id})`} stroke="#453d2b"/>
  </svg>
}
