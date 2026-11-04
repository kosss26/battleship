import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { LEGAL, LEGAL_UPDATED } from '../legal/content.js'
import { useStore } from '../store/app.js'
import { useLang } from '../lib/i18n.js'

const FALLBACK = {
  ru: { operator: 'администрация игры Battleship Online', contact: 'бот игры, команда /paysupport', bot: 'игры' },
  en: { operator: 'the Battleship Online team', contact: 'the game bot, command /paysupport', bot: 'of the game' },
}

export default function Legal({ standalone = false }) {
  const { doc } = useParams()
  const navigate = useNavigate()
  const lang = useLang()
  const config = useStore((s) => s.config)
  const page = LEGAL[doc] ? LEGAL[doc][lang] || LEGAL[doc].ru : null
  const fb = FALLBACK[lang] || FALLBACK.ru
  const vars = {
    operator: config?.legal?.operator || fb.operator,
    contact: config?.legal?.contact || fb.contact,
    bot: config?.botUsername ? `@${config.botUsername}` : fb.bot,
  }
  const fill = (s) => s.replace(/\{(operator|contact|bot)\}/g, (_, k) => vars[k])

  if (!page) return null
  return (
    <div className={standalone ? 'app-bg min-h-screen px-5' : ''} style={standalone ? { paddingTop: 'calc(var(--safe-top) + 16px)', paddingBottom: 'calc(24px + var(--safe-bottom))' } : undefined}>
      <div className="mx-auto max-w-lg">
        <div className="mb-1 flex items-center gap-2">
          {!standalone && (
            <button className="-ml-1 rounded-xl p-1.5 text-slate-300" onClick={() => navigate(-1)} aria-label="back">
              <ChevronLeft size={26} />
            </button>
          )}
          <h1 className="h-display text-[22px] leading-tight">{page.title}</h1>
        </div>
        <div className="mb-5 text-xs text-slate-500">
          {lang === 'en' ? 'Last updated' : 'Редакция от'} {new Date(LEGAL_UPDATED).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU')}
        </div>
        <div className="space-y-5 select-text">
          {page.sections.map(([title, paragraphs]) => (
            <section key={title}>
              <h2 className="mb-2 text-[15px] font-extrabold text-white">{title}</h2>
              {paragraphs.map((p, i) => (
                <p key={i} className="mb-2 text-[13.5px] leading-relaxed text-slate-300">{fill(p)}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
