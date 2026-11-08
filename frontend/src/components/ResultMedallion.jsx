import { useId } from 'react'
import '../styles/battle-report.css'

export default function ResultMedallion({ won, cancelled }) {
  const id = `medal-${useId().replace(/:/g,'')}`
  return <svg className="report-medallion" viewBox="0 0 180 130" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2=".8" y2="1"><stop stopColor={won?'#f5e2ac':'#c2d0c6'}/><stop offset=".45" stopColor={won?'#b99a5a':'#6c8583'}/><stop offset=".72" stopColor={won?'#e4ca87':'#b6c9c0'}/><stop offset="1" stopColor={won?'#7b643a':'#5b7470'}/></linearGradient></defs>
    <circle cx="90" cy="62" r="47" fill="#101f22" stroke={`url(#${id})`} strokeWidth="1.4"/>
    <circle cx="90" cy="62" r="41" fill="none" stroke={`url(#${id})`} strokeWidth=".5" opacity=".6"/>
    {[false,true].map(flip=><g key={String(flip)} transform={flip?'translate(180,0) scale(-1,1)':undefined} fill={`url(#${id})`}>
      <path d="M78 112C37 105 23 73 39 36" fill="none" stroke={`url(#${id})`} strokeWidth="1"/>
      {Array.from({length:7},(_,i)=><ellipse key={i} cx={33+i*.8+i*i*.7} cy={47+i*9} rx="3.2" ry="7" transform={`rotate(${-36+i*11} ${33+i*.8+i*i*.7} ${47+i*9})`}/>)}
    </g>)}
    <g fill="none" stroke={`url(#${id})`} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="90" cy="41" r="6" strokeWidth="2"/>
      <path d="M90 47v42M76 57h28M66 74c2 18 20 16 24 24 4-8 22-6 24-24M66 74l-2 10m2-10 9 3m39-3 2 10m-2-10-9 3" strokeWidth="3"/>
    </g>
    {won&&!cancelled&&<path d="m79 18-2-10 9 5 4-8 4 8 9-5-2 10Z" fill={`url(#${id})`}/>}
    <path d="M73 119h34" stroke={`url(#${id})`} strokeWidth="1"/>
    <path d="m90 115 4 4-4 4-4-4Z" fill={`url(#${id})`}/>
  </svg>
}
