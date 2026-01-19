import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useTelegramAuth } from './hooks/useTelegramAuth.js'
import Home from './pages/Home.jsx'
import Profile from './pages/Profile.jsx'
import Game from './pages/Game.jsx'
import Shop from './pages/Shop.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import Achievements from './pages/Achievements.jsx'
import PvP from './pages/PvP.jsx'
import Referrals from './pages/Referrals.jsx'
import DailyChallenges from './pages/DailyChallenges.jsx'
import Tournaments from './pages/Tournaments.jsx'
import BattlePass from './pages/BattlePass.jsx'

function App() {
  const location = useLocation()
  
  // Инициализация Telegram аутентификации
  useTelegramAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/game" element={<Game />} />
          <Route path="/pvp" element={<PvP />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/daily" element={<DailyChallenges />} />
          <Route path="/tournaments" element={<Tournaments />} />
          <Route path="/battlepass" element={<BattlePass />} />
        </Routes>
      </AnimatePresence>
    </div>
  )
}

export default App
