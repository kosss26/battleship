import {useEffect,useRef} from 'react'

const overlays=[]
let originalOverflow=''
const focusable='button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

export default function useOverlay(open,ref,onClose) {
  const close=useRef(onClose);close.current=onClose
  useEffect(()=>{
    if(!open||!ref.current)return
    const node=ref.current,previous=document.activeElement,entry={node}
    if(!overlays.length){originalOverflow=document.body.style.overflow;document.body.style.overflow='hidden'}
    overlays.push(entry)
    const controls=()=>[...node.querySelectorAll(focusable)].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden')
    ;(controls()[0]||node).focus({preventScroll:true})
    const key=e=>{
      if(overlays.at(-1)!==entry)return
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close.current?.()}
      if(e.key==='Tab'){
        const items=controls(),first=items[0],last=items.at(-1)
        if(!first){e.preventDefault();node.focus();return}
        if(!node.contains(document.activeElement)||e.shiftKey&&document.activeElement===first){e.preventDefault();(e.shiftKey?last:first).focus()}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
      }
    }
    document.addEventListener('keydown',key)
    return()=>{
      document.removeEventListener('keydown',key)
      const wasTop=overlays.at(-1)===entry
      overlays.splice(overlays.indexOf(entry),1)
      if(!overlays.length)document.body.style.overflow=originalOverflow
      if(wasTop&&previous?.isConnected)previous.focus({preventScroll:true})
    }
  },[open,ref])
}
