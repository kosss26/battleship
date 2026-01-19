import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion, useScroll, useTransform } from 'framer-motion'
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
      transition: { staggerChildren: 0.15, delayChildren: 0.2 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    },
  }

  const floatingVariants = {
    animate: {
      y: [0, -10, 0],
      rotate: [0, 2, 0, -2, 0],
      transition: {
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Фоновые элементы */}
      <div className="absolute inset-0">
        {/* Градиентный фон */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-cyan-900/20" />

        {/* Анимированные частицы */}
        <motion.div
          className="absolute top-20 left-10 w-2 h-2 bg-blue-400/30 rounded-full"
          animate={{
            y: [0, -100, 0],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{ duration: 4, repeat: Infinity, delay: 0 }}
        />
        <motion.div
          className="absolute top-32 right-16 w-1 h-1 bg-purple-400/40 rounded-full"
          animate={{
            y: [0, -80, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{ duration: 3, repeat: Infinity, delay: 1 }}
        />
        <motion.div
          className="absolute bottom-40 left-20 w-3 h-3 bg-cyan-400/20 rounded-full"
          animate={{
            y: [0, -60, 0],
            opacity: [0.2, 0.8, 0.2],
          }}
          transition={{ duration: 5, repeat: Infinity, delay: 2 }}
        />

        {/* Геометрические фигуры */}
        <motion.div
          className="absolute top-1/4 right-1/4 w-32 h-32 border border-blue-500/10 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute bottom-1/4 left-1/4 w-24 h-24 border border-purple-500/10 rounded-full"
          animate={{ rotate: -360 }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <motion.div
        className="max-w-md mx-auto pt-8 px-4 relative z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Хедер с профилем */}
        {user && (
          <motion.div
            variants={itemVariants}
            className="mb-8"
          >
            <div className="flex items-center justify-between bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20 shadow-2xl">
              <div className="flex items-center gap-3">
                <motion.div
                  className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
                  whileHover={{ scale: 1.1 }}
                >
                  {user.first_name?.[0]?.toUpperCase() || 'И'}
                </motion.div>
                <div>
                  <p className="text-white font-semibold text-lg">
                    {user.first_name || 'Игрок'}
                  </p>
                  <div className="flex items-center gap-2 text-white/70 text-sm">
                    <span>⭐ {user.rating || 1000}</span>
                    <span>•</span>
                    <span>Ур. {user.level || 1}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-r from-yellow-400 to-orange-500 px-3 py-2 rounded-xl flex items-center gap-1 text-white font-semibold shadow-lg"
                >
                  <span className="text-sm">🪙</span>
                  <span className="text-sm">{user.gold || 0}</span>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-r from-blue-400 to-purple-500 px-3 py-2 rounded-xl flex items-center gap-1 text-white font-semibold shadow-lg"
                >
                  <span className="text-sm">💎</span>
                  <span className="text-sm">{user.gems || 0}</span>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Логотип */}
        <motion.div
          variants={itemVariants}
          className="text-center mb-8"
        >
          <motion.div
            variants={floatingVariants}
            animate="animate"
            className="inline-block"
          >
            <h1 className="text-5xl font-black text-transparent bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text drop-shadow-2xl">
              BATTLESHIP
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <motion.div
                className="w-8 h-1 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full"
                animate={{ scaleX: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              />
              <p className="text-white/80 font-medium tracking-widest text-sm uppercase">
                Online Arena
              </p>
              <motion.div
                className="w-8 h-1 bg-gradient-to-r from-purple-500 to-blue-400 rounded-full"
                animate={{ scaleX: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              />
            </div>
          </motion.div>
        </motion.div>

        {/* Основные игровые режимы */}
        <motion.div
          variants={itemVariants}
          className="space-y-4"
        >
          {/* PvP режим - главный */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="relative group"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
            <button
              onClick={handlePvP}
              className="relative w-full bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white py-5 px-6 rounded-2xl font-bold text-xl shadow-2xl flex items-center justify-center gap-3 overflow-hidden"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <span className="text-2xl">⚔️</span>
              <div className="text-left">
                <div className="font-black text-lg">Быстрый Матч</div>
                <div className="text-sm font-medium opacity-90">PvP • Онлайн</div>
              </div>
            </button>
          </motion.div>

          {/* AI режимы */}
          <motion.div
            variants={itemVariants}
            className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">Тренировка с AI</h3>
              <span className="text-white/60 text-sm">Выберите уровень</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  diff: 'easy',
                  label: 'Легкий',
                  icon: '🟢',
                  color: 'from-emerald-500 to-green-600',
                  desc: 'Новичок'
                },
                {
                  diff: 'medium',
                  label: 'Средний',
                  icon: '🟡',
                  color: 'from-amber-500 to-orange-600',
                  desc: 'Опытный'
                },
                {
                  diff: 'hard',
                  label: 'Сложный',
                  icon: '🔴',
                  color: 'from-red-500 to-rose-600',
                  desc: 'Мастер'
                },
              ].map(({ diff, label, icon, color, desc }) => (
                <motion.button
                  key={diff}
                  onClick={() => handleStartGame(diff)}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative bg-gradient-to-br ${color} text-white py-4 px-3 rounded-xl font-bold shadow-lg overflow-hidden group`}
                >
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative text-center">
                    <span className="text-2xl block mb-1">{icon}</span>
                    <div className="font-black text-sm">{label}</div>
                    <div className="text-xs opacity-80">{desc}</div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Особые возможности */}
        <motion.div
          variants={itemVariants}
          className="space-y-3"
        >
          {/* Battle Pass */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="relative group overflow-hidden"
          >
            <Link
              to="/battlepass"
              onClick={handleNavClick}
              className="block w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white py-4 px-5 rounded-2xl font-bold shadow-xl relative overflow-hidden"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎖️</span>
                  <div>
                    <div className="font-black">Battle Pass</div>
                    <div className="text-sm font-medium opacity-90">Сезон 1 • Награды</div>
                  </div>
                </div>
                <span className="bg-white/30 px-3 py-1 rounded-full text-sm font-semibold">АКТИВЕН</span>
              </div>
            </Link>
          </motion.div>

          {/* Ежедневные задания */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="relative group overflow-hidden"
          >
            <Link
              to="/daily"
              onClick={handleNavClick}
              className="block w-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white py-4 px-5 rounded-2xl font-bold shadow-xl relative overflow-hidden"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📋</span>
                  <div>
                    <div className="font-black">Ежедневные Задания</div>
                    <div className="text-sm font-medium opacity-90">+100 🪙 • Прогресс</div>
                  </div>
                </div>
                <span className="bg-white/30 px-3 py-1 rounded-full text-sm font-semibold">ГОТОВО</span>
              </div>
            </Link>
          </motion.div>
        </motion.div>

        {/* Навигация */}
        <motion.div
          variants={itemVariants}
          className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20 shadow-2xl"
        >
          <h3 className="text-white font-bold text-lg mb-4 text-center">Меню</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { to: '/profile', icon: '👤', label: 'Профиль', color: 'from-blue-500 to-cyan-500' },
              { to: '/leaderboard', icon: '🏆', label: 'Рейтинг', color: 'from-yellow-500 to-orange-500' },
              { to: '/achievements', icon: '🎖️', label: 'Достижения', color: 'from-purple-500 to-pink-500' },
              { to: '/referrals', icon: '👥', label: 'Рефералы', color: 'from-green-500 to-emerald-500' },
              { to: '/shop', icon: '🛍️', label: 'Магазин', color: 'from-indigo-500 to-purple-500' },
              { to: '/tournaments', icon: '⚔️', label: 'Турниры', color: 'from-red-500 to-rose-500' },
            ].map(({ to, icon, label, color }) => (
              <motion.div
                key={to}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="relative group"
              >
                <Link
                  to={to}
                  onClick={handleNavClick}
                  className={`block bg-gradient-to-br ${color} text-white p-4 rounded-xl font-bold shadow-lg text-center overflow-hidden group-hover:shadow-2xl transition-all duration-300`}
                >
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <span className="text-2xl block mb-2">{icon}</span>
                    <div className="text-sm font-black">{label}</div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Версия и футер */}
        <motion.div
          variants={itemVariants}
          className="text-center mt-8"
        >
          <div className="bg-white/5 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
            <p className="text-white/60 text-sm font-medium">
              v1.0.0 • Telegram Mini App
            </p>
            <p className="text-white/40 text-xs mt-1">
              Разработано с ❤️ для моряков
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default Home
