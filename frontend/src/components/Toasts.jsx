import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store/app.js'
import { errorText } from '../lib/i18n.js'

export default function Toasts() {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4" style={{ top: 'calc(var(--safe-top) + 12px)' }}>
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className={`max-w-sm rounded-2xl px-4 py-2.5 text-center text-sm font-bold shadow-xl backdrop-blur-xl ${
              t.kind === 'error' ? 'bg-rose-500/90 text-white' : t.kind === 'success' ? 'bg-emerald-400/95 text-ink-950' : 'bg-ink-700/95 text-white ring-1 ring-white/10'
            }`}
          >
            {t.kind === 'error' ? errorText(t.text) : t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
