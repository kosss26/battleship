import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from './store/app.js'
import { backButton, openLink } from './lib/telegram.js'
import { useT, errorText } from './lib/i18n.js'
import TabBar from './components/TabBar.jsx'
import Toasts from './components/Toasts.jsx'
import RewardPopup from './components/RewardPopup.jsx'
import { Spinner } from './components/ui.jsx'
import Home from './pages/Home.jsx'
import Quests from './pages/Quests.jsx'
import Shop from './pages/Shop.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import Profile from './pages/Profile.jsx'
import Campaign from './pages/Campaign.jsx'
import Friends from './pages/Friends.jsx'
import Achievements from './pages/Achievements.jsx'
import Duel from './pages/Duel.jsx'
import Search from './pages/Search.jsx'
import Battle from './pages/Battle.jsx'
import Admin from './pages/Admin.jsx'
import AdminUser from './pages/AdminUser.jsx'
import { START_PARAM } from '@shared/catalog.js'

const TABS = ['/', '/quests', '/shop', '/top', '/profile']

function Splash({ text }) {
  return (
    <div className="app-bg flex min-h-screen flex-col items-center justify-center gap-6">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative h-28 w-28">
        <div className="absolute inset-0 rounded-full border border-cyan-300/30" />
        <div className="absolute inset-4 rounded-full border border-cyan-300/20" />
        <div className="absolute inset-0 animate-sweep rounded-full" style={{ background: 'conic-gradient(from 0deg, rgba(34,211,238,0.45), transparent 25%)' }} />
        <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-glow" />
      </motion.div>
      <div className="text-center">
        <div className="h-display text-2xl">BATTLESHIP</div>
        <div className="mt-1 text-sm text-slate-400">{text}</div>
      </div>
    </div>
  )
}

function DevLogin() {
  const t = useT()
  const devLogin = useStore((s) => s.devLogin)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="app-bg flex min-h-screen flex-col items-center justify-center px-6">
      <div className="glass w-full max-w-sm p-6">
        <div className="h-display mb-1 text-xl">BATTLESHIP</div>
        <p className="mb-5 text-sm text-slate-400">{t('open_in_tg_sub')}</p>
        <input
          className="mb-3 h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 outline-none focus:border-cyan-300/60"
          placeholder={t('your_name')}
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="btn-primary w-full"
          disabled={!name.trim() || busy}
          onClick={async () => {
            setBusy(true)
            await devLogin(name.trim()).catch(() => setBusy(false))
          }}
        >
          {t('dev_login')}
        </button>
      </div>
    </div>
  )
}

function NeedTelegram() {
  const t = useT()
  const config = useStore((s) => s.config)
  return (
    <div className="app-bg flex min-h-screen flex-col items-center justify-center px-8 text-center">
      <div className="mb-4 text-6xl">⚓</div>
      <h1 className="h-display mb-2 text-2xl">{t('open_in_tg')}</h1>
      <p className="mb-6 text-sm text-slate-400">{t('open_in_tg_sub')}</p>
      {config?.appLink && (
        <button className="btn-primary w-full max-w-xs" onClick={() => openLink(config.appLink)}>
          Telegram
        </button>
      )}
    </div>
  )
}

export default function App() {
  const t = useT()
  const location = useLocation()
  const navigate = useNavigate()
  const status = useStore((s) => s.status)
  const boot = useStore((s) => s.boot)
  const game = useStore((s) => s.game)
  const connected = useStore((s) => s.connected)
  const isAdmin = useStore((s) => !!s.profile?.isAdmin)

  useEffect(() => {
    boot()
  }, [boot])

  // Deep links: duel invites
  useEffect(() => {
    if (status !== 'ready') return
    const p = useStore.getState().consumeStart()
    if (p?.startsWith(START_PARAM.duel)) navigate(`/duel/${p.slice(START_PARAM.duel.length)}`)
  }, [status, navigate])

  // Jump into an active game (e.g. matched or reconnected)
  useEffect(() => {
    if (game && game.phase !== 'over' && location.pathname !== '/battle') navigate('/battle')
  }, [game?.id, game?.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Telegram back button
  const isRoot = TABS.includes(location.pathname)
  useEffect(() => {
    if (location.pathname === '/battle') return backButton(false)
    return backButton(!isRoot, () => navigate(-1))
  }, [isRoot, location.pathname, navigate])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  if (status === 'boot') return <Splash text={t('loading')} />
  if (status === 'dev_login') return <DevLogin />
  if (status === 'need_tg') return <NeedTelegram />
  if (status === 'banned') {
    return (
      <div className="app-bg flex min-h-screen flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="text-5xl">⛔</div>
        <div className="font-bold text-slate-200">{t('err_banned')}</div>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="app-bg flex min-h-screen flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="text-5xl">🌊</div>
        <div className="text-slate-300">{errorText('error_generic')}</div>
        <button className="btn-primary px-8" onClick={boot}>{t('retry')}</button>
      </div>
    )
  }

  const showTabs = isRoot
  return (
    <div className="app-bg min-h-screen">
      <div className="grid-bg pointer-events-none fixed inset-0 opacity-60" />
      <AnimatePresence>
        {!connected && (
          <motion.div
            initial={{ y: -40 }}
            animate={{ y: 0 }}
            exit={{ y: -40 }}
            className="fixed left-0 right-0 z-50 flex justify-center"
            style={{ top: 'calc(var(--safe-top) + 6px)' }}
          >
            <div className="chip bg-amber-400/90 text-ink-950 shadow-lg">
              <Spinner size={12} /> {t('offline')}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <main
        className="relative mx-auto max-w-lg px-4"
        style={{
          paddingTop: 'calc(var(--safe-top) + 14px)',
          paddingBottom: showTabs ? 'calc(96px + var(--safe-bottom))' : 'calc(24px + var(--safe-bottom))',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname.split('/')[1] || 'home'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/quests" element={<Quests />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/top" element={<Leaderboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/campaign" element={<Campaign />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/duel" element={<Duel />} />
              <Route path="/duel/:code" element={<Duel />} />
              <Route path="/search" element={<Search />} />
              <Route path="/battle" element={<Battle />} />
              <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/" replace />} />
              <Route path="/admin/user/:id" element={isAdmin ? <AdminUser /> : <Navigate to="/" replace />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      {showTabs && <TabBar />}
      <Toasts />
      <RewardPopup />
    </div>
  )
}
