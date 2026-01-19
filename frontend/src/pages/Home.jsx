import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { haptic } from '../utils/telegram.js'

function Home() {
  const navigate = useNavigate()
  const user = useSelector((state) => state.user.user)

  const handleStartGame = (difficulty) => {
    haptic.medium()
    navigate(`/game?difficulty=${difficulty}`)
  }

  const handlePvP = () => {
    haptic.heavy()
    navigate('/pvp')
  }

  const handleNavClick = () => {
    haptic.light()
  }

  // Анимации
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-500 via-blue-600 to-blue-800 p-4 overflow-hidden">
      {/* Декоративные волны */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-blue-900/30 to-transparent" />
        <motion.div 
          className="absolute -bottom-4 left-0 right-0 h-16 bg-blue-800/20"
          animate={{ x: [0, 10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ borderRadius: '100% 100% 0 0' }}
        />
      </div>

      <motion.div 
        className="max-w-md mx-auto pt-6 relative z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Приветствие пользователя */}
        {user && (
          <motion.div variants={itemVariants} className="text-center text-white mb-4">
            <p className="text-lg font-medium">Привет, {user.first_name || 'Игрок'}! 👋</p>
            <p className="text-sm opacity-80">
              ⭐ {user.rating || 1000} • Уровень {user.level || 1}
            </p>
          </motion.div>
        )}

        {/* Логотип */}
        <motion.div 
          variants={itemVariants}
          className="text-center mb-6"
        >
          <motion.h1 
            className="text-4xl font-bold text-white drop-shadow-lg"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🚢 Battleship
          </motion.h1>
          <p className="text-white/80 text-sm mt-1">Online Battle Arena</p>
        </motion.div>
        
        {/* Основные кнопки */}
        <motion.div 
          variants={itemVariants}
          className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-5 space-y-4"
        >
          {/* PvP режим */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Мультиплеер</p>
            <motion.button
              onClick={handlePvP}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2"
            >
              ⚔️ Быстрый матч
            </motion.button>
          </div>

          {/* Режим против AI */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Тренировка с AI</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { diff: 'easy', label: 'Easy', color: 'from-green-400 to-green-500' },
                { diff: 'medium', label: 'Medium', color: 'from-yellow-400 to-orange-400' },
                { diff: 'hard', label: 'Hard', color: 'from-red-400 to-red-500' },
              ].map(({ diff, label, color }) => (
                <motion.button
                  key={diff}
                  onClick={() => handleStartGame(diff)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`py-3 bg-gradient-to-r ${color} text-white rounded-xl font-semibold shadow-md`}
                >
                  {label}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Battle Pass - выделенный блок */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="relative overflow-hidden"
          >
            <Link
              to="/battlepass"
              onClick={handleNavClick}
              className="block w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white py-3 px-4 rounded-xl font-semibold shadow-md"
            >
              <div className="flex items-center justify-between">
                <span>🎖️ Battle Pass</span>
                <span className="bg-white/30 px-2 py-0.5 rounded-full text-xs">Сезон 1</span>
              </div>
            </Link>
          </motion.div>

          {/* Ежедневные задания */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="relative overflow-hidden"
          >
            <Link
              to="/daily"
              onClick={handleNavClick}
              className="block w-full bg-gradient-to-r from-orange-400 to-amber-400 text-white py-3 px-4 rounded-xl font-semibold shadow-md"
            >
              <div className="flex items-center justify-between">
                <span>📋 Ежедневные задания</span>
                <span className="bg-white/30 px-2 py-0.5 rounded-full text-xs">+100 🪙</span>
              </div>
            </Link>
          </motion.div>

          {/* Навигация */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            {[
              { to: '/profile', icon: '👤', label: 'Профиль' },
              { to: '/leaderboard', icon: '🏆', label: 'Рейтинг' },
              { to: '/achievements', icon: '🎖️', label: 'Достижения' },
              { to: '/referrals', icon: '👥', label: 'Рефералы' },
              { to: '/shop', icon: '🛍️', label: 'Магазин' },
              { to: '/tournaments', icon: '⚔️', label: 'Турниры' },
            ].map(({ to, icon, label }) => (
              <motion.div key={to} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to={to}
                  onClick={handleNavClick}
                  className="flex items-center gap-2 w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Валюта */}
        {user && (
          <motion.div 
            variants={itemVariants}
            className="mt-4 flex justify-center gap-3"
          >
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-white/20 backdrop-blur-sm px-5 py-2 rounded-full flex items-center gap-2 text-white font-semibold shadow-lg"
            >
              <span className="text-lg">🪙</span>
              <span>{user.gold || 0}</span>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-white/20 backdrop-blur-sm px-5 py-2 rounded-full flex items-center gap-2 text-white font-semibold shadow-lg"
            >
              <span className="text-lg">💎</span>
              <span>{user.gems || 0}</span>
            </motion.div>
          </motion.div>
        )}

        {/* Версия */}
        <motion.p 
          variants={itemVariants}
          className="text-center text-white/50 text-xs mt-6"
        >
          v1.0.0 • Telegram Mini App
        </motion.p>
      </motion.div>
    </div>
  )
}

export default Home
