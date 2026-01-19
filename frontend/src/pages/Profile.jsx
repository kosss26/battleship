import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { haptic } from '../utils/telegram.js'
import api from '../services/api.js'

function Profile() {
  const user = useSelector((state) => state.user.user)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recentGames, setRecentGames] = useState([])

  useEffect(() => {
    fetchProfileData()
  }, [user])

  const fetchProfileData = async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      // Получаем статистику и историю игр
      const [statsResponse, historyResponse] = await Promise.all([
        api.get(`/users/${user.id}/stats`).catch(() => ({ data: { stats: null } })),
        api.get('/games/history?limit=5').catch(() => ({ data: { games: [] } })),
      ])

      setStats(statsResponse.data.stats || {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
      })
      setRecentGames(historyResponse.data.games || [])
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  // Форматирование даты
  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Получение ранга по рейтингу
  const getRankInfo = (rating) => {
    if (rating >= 2000) return { name: 'Адмирал', icon: '⭐', color: 'text-yellow-500' }
    if (rating >= 1800) return { name: 'Капитан', icon: '🎖️', color: 'text-blue-500' }
    if (rating >= 1600) return { name: 'Лейтенант', icon: '🏅', color: 'text-green-500' }
    if (rating >= 1400) return { name: 'Мичман', icon: '🎗️', color: 'text-orange-500' }
    if (rating >= 1200) return { name: 'Матрос', icon: '⚓', color: 'text-gray-500' }
    return { name: 'Юнга', icon: '🚢', color: 'text-gray-400' }
  }

  const rankInfo = getRankInfo(user?.rating || 1000)

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Фоновые элементы */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-cyan-900/20" />
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
      </div>

      <motion.div
        className="max-w-md mx-auto pt-8 px-4 relative z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Заголовок */}
        <motion.div
          variants={itemVariants}
          className="text-center mb-8"
        >
          <motion.h1
            className="text-4xl font-black text-transparent bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text drop-shadow-2xl"
          >
            ПРОФИЛЬ
          </motion.h1>
          <p className="text-white/80 font-medium tracking-widest text-sm uppercase mt-2">
            Статистика игрока
          </p>
        </motion.div>

        {/* Основная карточка профиля */}
        <motion.div
          variants={itemVariants}
          className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl mb-6"
        >
          <h2 className="text-2xl font-bold mb-6 text-center text-white">👤 Профиль</h2>

          {user ? (
            <div className="space-y-6">
              {/* Аватар и имя */}
              <div className="flex items-center space-x-4">
                {user.photo_url ? (
                  <motion.img
                    src={user.photo_url}
                    alt="Avatar"
                    className="w-20 h-20 rounded-full border-4 border-blue-400/50 shadow-lg"
                    whileHover={{ scale: 1.1 }}
                  />
                ) : (
                  <motion.div
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-3xl font-bold border-4 border-white/30 shadow-lg"
                    whileHover={{ scale: 1.1 }}
                  >
                    {user.first_name?.[0]?.toUpperCase() || 'И'}
                  </motion.div>
                )}
                <div>
                  <p className="font-bold text-xl text-white">
                    {user.first_name || 'Игрок'} {user.last_name || ''}
                  </p>
                  {user.username && (
                    <p className="text-white/70">@{user.username}</p>
                  )}
                  <p className={`text-lg font-semibold ${rankInfo.color}`}>
                    {rankInfo.icon} {rankInfo.name}
                  </p>
                </div>
              </div>

              {/* Рейтинг и уровень */}
              <div className="grid grid-cols-2 gap-4">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl text-white shadow-lg"
                >
                  <p className="text-sm opacity-80 mb-1">Рейтинг</p>
                  <p className="text-3xl font-bold">{user.rating || 1000}</p>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl text-white shadow-lg"
                >
                  <p className="text-sm opacity-80 mb-1">Уровень</p>
                  <p className="text-3xl font-bold">{user.level || 1}</p>
                </motion.div>
              </div>

              {/* Валюта */}
              <div className="grid grid-cols-2 gap-4">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-r from-yellow-400 to-orange-500 p-4 rounded-xl text-white shadow-lg"
                >
                  <p className="text-sm opacity-80 mb-1">🪙 Золото</p>
                  <p className="text-2xl font-bold">{user.gold || 0}</p>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 rounded-xl text-white shadow-lg"
                >
                  <p className="text-sm opacity-80 mb-1">💎 Гемы</p>
                  <p className="text-2xl font-bold">{user.gems || 0}</p>
                </motion.div>
              </div>
            </div>
          ) : (
            <p className="text-white/70 text-center py-8">Загрузка профиля...</p>
          )}
        </motion.div>

        {/* Статистика */}
        <motion.div
          variants={itemVariants}
          className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl mb-6"
        >
          <h3 className="font-bold text-lg mb-4 text-white">📊 Статистика</h3>

          {loading ? (
            <div className="flex justify-center py-8">
              <motion.div
                className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            </div>
          ) : stats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white/70 text-sm">Всего матчей</span>
                    <span className="text-2xl font-bold text-white">{stats.totalMatches}</span>
                  </div>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-green-400 text-sm">Побед</span>
                    <span className="text-2xl font-bold text-white">{stats.wins}</span>
                  </div>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-red-400 text-sm">Поражений</span>
                    <span className="text-2xl font-bold text-white">{stats.losses}</span>
                  </div>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-blue-400 text-sm">Winrate</span>
                    <span className="text-2xl font-bold text-white">{stats.winRate}%</span>
                  </div>
                </motion.div>
              </div>

              {/* Прогресс-бар winrate */}
              <div className="pt-2">
                <div className="flex justify-between text-sm text-white/70 mb-2">
                  <span>Прогресс побед</span>
                  <span>{stats.winRate}%</span>
                </div>
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.winRate}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-white/70 text-center py-8">Статистика недоступна</p>
          )}
        </motion.div>

        {/* Последние игры */}
        {recentGames.length > 0 && (
          <motion.div
            variants={itemVariants}
            className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl mb-6"
          >
            <h3 className="font-bold text-lg mb-4 text-white">🎮 Последние игры</h3>
            <div className="space-y-3">
              {recentGames.map((game, index) => {
                const isWinner = game.winner_id === user?.id
                return (
                  <motion.div
                    key={game.id || index}
                    whileHover={{ scale: 1.02 }}
                    className={`p-4 rounded-xl border backdrop-blur-sm ${
                      isWinner
                        ? 'bg-green-500/20 border-green-400/50'
                        : 'bg-red-500/20 border-red-400/50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-white">
                        {isWinner ? '✅ Победа' : '❌ Поражение'}
                      </span>
                      <span className="text-sm text-white/70 bg-white/10 px-3 py-1 rounded-full">
                        {game.mode?.replace('ai_', 'AI ').toUpperCase() || 'PvP'}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 mt-2">
                      {formatDate(game.ended_at)}
                    </p>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Быстрые действия */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-2 gap-4 mb-6"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link
              to="/achievements"
              onClick={() => haptic.light()}
              className="block w-full bg-gradient-to-br from-purple-500 to-pink-500 text-white py-4 px-4 rounded-xl font-bold shadow-lg text-center overflow-hidden group"
            >
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <span className="text-2xl block mb-1">🎖️</span>
                <div className="text-sm">Достижения</div>
              </div>
            </Link>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link
              to="/leaderboard"
              onClick={() => haptic.light()}
              className="block w-full bg-gradient-to-br from-yellow-500 to-orange-500 text-white py-4 px-4 rounded-xl font-bold shadow-lg text-center overflow-hidden group"
            >
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <span className="text-2xl block mb-1">🏆</span>
                <div className="text-sm">Рейтинг</div>
              </div>
            </Link>
          </motion.div>
        </motion.div>

        {/* Кнопка назад */}
        <motion.div
          variants={itemVariants}
          className="text-center"
        >
          <Link
            to="/"
            onClick={() => haptic.light()}
            className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors font-medium"
          >
            <span>←</span>
            <span>Назад в меню</span>
          </Link>
        </motion.div>
      </div>
    </div>
  )
}

export default Profile
