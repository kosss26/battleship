import { Palette } from 'lucide-react'
import { useStore } from '../store/app.js'
import { useT } from '../lib/i18n.js'
import '../styles/battle-report.css'

export default function BattleAppearance() {
  const t = useT()
  const value = useStore(s => s.battleAppearance)
  const choose = useStore(s => s.setBattleAppearance)
  return <div className="battle-appearance" role="group" aria-label={t('battle_appearance')}>
    <span><Palette size={13}/>{t('battle_appearance')}</span>
    <div>{['opponent','mine'].map(v=><button key={v} type="button" aria-pressed={value===v} onClick={()=>choose(v)}>{t(`appearance_${v}`)}</button>)}</div>
  </div>
}
