/** One transparent atlas, four actual ship designs. Shared by showcase and board. */
export const REGENT_CLASSES = [
  { size: 4, code: 'RG–04', name: { ru: 'Суверен', en: 'Sovereign' }, type: { ru: 'Линкор · флагман', en: 'Battleship · flagship' },
    detail: { ru: 'Четыре башни главного калибра, броневая цитадель и кормовая катапульта.', en: 'Four main battery turrets, an armoured citadel and a stern catapult.' }, crop: [27, 74, 1483, 278] },
  { size: 3, code: 'RG–03', name: { ru: 'Виконт', en: 'Viscount' }, type: { ru: 'Тяжёлый крейсер', en: 'Heavy cruiser' },
    detail: { ru: 'Три артиллерийские башни, две дымовые трубы и открытая шлюпочная палуба.', en: 'Three gun turrets, twin funnels and an open boat deck.' }, crop: [106, 412, 1296, 175] },
  { size: 2, code: 'RG–02', name: { ru: 'Корсар', en: 'Corsair' }, type: { ru: 'Эсминец', en: 'Destroyer' },
    detail: { ru: 'Стремительный корпус, низкая рубка и торпедные аппараты в центре палубы.', en: 'A sleek hull, low bridge and amidships torpedo launchers.' }, crop: [207, 661, 1065, 130] },
  { size: 1, code: 'RG–01', name: { ru: 'Страж', en: 'Sentinel' }, type: { ru: 'Бронекатер', en: 'Armoured launch' },
    detail: { ru: 'Компактный корпус, носовое орудие, закрытая рубка и кормовые бомбомёты.', en: 'A compact hull, bow cannon, enclosed wheelhouse and stern depth charges.' }, crop: [465, 858, 541, 130] },
]

export function RegentArtwork({ size = 4, className = '', style, board = false, sunk = false }) {
  const design = REGENT_CLASSES.find(c => c.size === size) || REGENT_CLASSES[0]
  const [x, y, w, h] = design.crop
  const L = size * 100
  const height = { 1: 46, 2: 65, 3: 78, 4: 91 }[size]
  return <svg viewBox={board ? `0 0 ${L} 100` : `${x} ${y} ${w} ${h}`}
    width={board ? L : undefined} height={board ? 100 : undefined}
    className={className} style={style} role="img" aria-label={design.name.ru}
    data-regent-class={size} preserveAspectRatio="xMidYMid meet">
    {board ? <svg x="0" y={(100-height)/2} width={L} height={height} viewBox={`${x} ${y} ${w} ${h}`} preserveAspectRatio="none" overflow="hidden">
      <image href="/art/naval/regent-atlas.webp" width="1536" height="1024" style={sunk ? { filter: 'grayscale(.85) brightness(.55)' } : undefined} />
    </svg> : <svg x={x} y={y} width={w} height={h} viewBox={`${x} ${y} ${w} ${h}`} overflow="hidden">
      <image href="/art/naval/regent-atlas.webp" width="1536" height="1024" />
    </svg>}
  </svg>
}

export default function RegentShip({ size, vertical, state, className, style }) {
  const L = size * 100
  return <svg viewBox={vertical ? `0 0 100 ${L}` : `0 0 ${L} 100`} className={className} style={style}
    data-regent-ship={size} preserveAspectRatio="none" aria-hidden="true">
    <g transform={vertical ? `translate(100,0) rotate(90)` : undefined}>
      <RegentArtwork size={size} board sunk={state === 'sunk'} />
      {state === 'invalid' && <rect width={L} height="100" fill="#f43f5e" opacity=".4" />}
    </g>
  </svg>
}
