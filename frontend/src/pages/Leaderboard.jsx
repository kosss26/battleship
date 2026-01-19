import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { haptic } from '../utils/telegram.js'
import api from '../services/api.js'

function Leaderboard() {
  const user = useSelector((state) => state.user.user)
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      // TODO: Заменить на реальный API endpoint когда будет готов backend
      // const response = await api.get('/leaderboards/global')
      // setLeaderboard(response.data)

      // Временные мок-данные для отображения
      const mockLeaderboard = [
        { rank: 1, username: 'Player1', rating: 1850, winRate: 85 },
        { rank: 2, username: 'Player2', rating: 1800, winRate: 82 },
        { rank: 3, username: 'Player3', rating: 1750, winRate: 80 },
        { rank: 4, username: 'Player4', rating: 1700, winRate: 78 },
        { rank: 5, username: 'Player5', rating: 1650, winRate: 75 },
      ]
      setLeaderboard(mockLeaderboard)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      setLoading(false)
    }
  }

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  const getUserRank = () => {
    if (!user) return null
    // TODO: Получить реальный рейтинг пользователя из API
    return { rank: 10, rating: user.rating || 1000 }
  }

  const userRank = getUserRank()

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
        className="max-w-2xl mx-auto pt-8 px-4 relative z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Заголовок */}
        <motion.div
          variants={itemVariants}
          className="text-center mb-8"
        >
          <motion.div
            variants={floatingVariants}
            animate="animate"
            className="inline-block"
          >
            <h1 className="text-5xl font-black text-transparent bg-gradient-to-r from-white via-yellow-100 to-orange-200 bg-clip-text drop-shadow-2xl">
              РЕЙТИНГ
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <motion.div
                className="w-8 h-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
                animate={{ scaleX: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              />
              <p className="text-white/80 font-medium tracking-widest text-sm uppercase">
                Топ игроков
              </p>
              <motion.div
                className="w-8 h-1 bg-gradient-to-r from-orange-500 to-yellow-400 rounded-full"
                animate={{ scaleX: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              />
            </div>
          </motion.div>
        </motion.div>

        {loading ? (
          <motion.div
            variants={itemVariants}
            className="text-center py-16"
          >
            <motion.div
              className="w-12 h-12 border-3 border-white/30 border-t-white rounded-full mx-auto mb-4"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <p className="text-white/70 text-lg">Загрузка рейтинга...</p>
          </motion.div>
        ) : (
          <>
            {/* Топ-3 игроков */}
            <motion.div
              variants={itemVariants}
              className="mb-8 space-y-4"
            >
              {leaderboard.slice(0, 3).map((player, index) => (
                <motion.div
                  key={player.rank}
                  whileHover={{ scale: 1.02 }}
                  className={`relative overflow-hidden ${
                    player.rank === 1
                      ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20'
                      : player.rank === 2
                      ? 'bg-gradient-to-r from-gray-500/20 to-gray-600/20'
                      : player.rank === 3
                      ? 'bg-gradient-to-r from-orange-500/20 to-orange-600/20'
                      : ''
                  } backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <motion.span
                        className="text-4xl"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: index * 0.5 }}
                      >
                        {getMedalEmoji(player.rank)}
                      </motion.span>
                      <div>
                        <p className="font-bold text-xl text-white">{player.username}</p>
                        <p className="text-sm text-white/70">Рейтинг: {player.rating}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2 border border-white/20">
                        <p className="text-sm text-white/70">Побед</p>
                        <p className="text-2xl font-bold text-white">{player.winRate}%</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Остальные игроки */}
            {leaderboard.length > 3 && (
              <motion.div
                variants={itemVariants}
                className="space-y-3 mb-8"
              >
                {leaderboard.slice(3).map((player) => (
                  <motion.div
                    key={player.rank}
                    whileHover={{ scale: 1.02 }}
                    className="bg-white/10 backdrop-blur-xl rounded-xl p-4 border border-white/20 shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-white/70 font-semibold w-8 text-lg">
                          #{player.rank}
                        </span>
                        <div>
                          <p className="font-semibold text-white">{player.username}</p>
                          <p className="text-sm text-white/70">Рейтинг: {player.rating}</p>
                        </div>
                      </div>
                      <div className="bg-white/10 backdrop-blur rounded-lg px-3 py-1 border border-white/20">
                        <p className="text-sm text-white/70">Побед: {player.winRate}%</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Рейтинг текущего пользователя */}
            {userRank && (
              <motion.div
                variants={itemVariants}
                className="bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <motion.div
                      className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
                      whileHover={{ scale: 1.1 }}
                    >
                      {user.first_name?.[0]?.toUpperCase() || 'В'}
                    </motion.div>
                    <div>
                      <p className="text-white font-semibold text-lg">Ваше место</p>
                      <p className="text-white/70">Рейтинг: {userRank.rating}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="bg-white/20 backdrop-blur rounded-xl px-4 py-2 border border-white/30">
                      <span className="text-3xl font-black text-white">
                        #{userRank.rank}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}

        {/* Кнопка назад */}
        <motion.div
          variants={itemVariants}
          className="text-center mt-8"
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
      </motion.div>
    </div>
  )
}

export default Leaderboard
