import { useState } from 'react'
import { FRAMES } from '@shared/catalog.js'
import RegentFrame from './RegentFrame.jsx'
import '../styles/player-avatar.css'

/** One face aperture and frame geometry for profiles, standings, shops and battles. */
export default function PlayerAvatar({photo,name='?',frame='frame_none',size=44,className='',captain=false}) {
  const [failed,setFailed]=useState(null)
  const design=FRAMES.find(f=>f.id===frame)
  const regent=design?.model==='regent'
  const initials=name.split(' ').filter(Boolean).map(p=>p[0]).join('').slice(0,2).toUpperCase()||'?'
  const hue=[...name].reduce((h,c)=>h+c.charCodeAt(0),0)%360
  const background=regent?'transparent':design?.ring&&design.ring!=='transparent'?design.ring:captain?'linear-gradient(135deg,#8dfaff,#35d0e4 45%,#296c86)':'#132a3c'
  return <span role="img" aria-label={name} data-avatar-frame={frame} className={`player-avatar ${captain?'captain-avatar ':''}${regent?'avatar-regent ':''}${className}`} style={{width:size,height:size,background}}>
    <span className="player-avatar-face" data-avatar-face>
      {photo&&failed!==photo?<img src={photo} alt="" draggable={false} onError={()=>setFailed(photo)}/>:captain?<span className="naval-art naval-art-captain"/>:<span className="avatar-initials" style={{background:regent?'linear-gradient(135deg,#35555c,#142e37)':`linear-gradient(135deg,hsl(${hue} 70% 45%),hsl(${(hue+50)%360} 70% 30%))`,fontSize:size*.32}}>{initials}</span>}
    </span>
    {regent&&<RegentFrame/>}
  </span>
}
