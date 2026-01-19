import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { haptic } from '../utils/telegram.js'
import api from '../services/api.js'

// Список достижений согласно ТЗ
const ACHIEVEMENTS = [
  // Категория "Первые шаги"
  { id: 'first_win', name: 'Дебютант', description: 'Выиграй первый матч', icon: '🥉', reward: 50, category: 'Первые шаги' },
  { id: 'hunter_5', name: 'Охотник', description: 'Выиграй 5 матчей', icon: '🥉', reward: 100, category: 'Первые шаги' },
  { id: 'master_50', name: 'Мастер флота', description: 'Выиграй 50 матчей', icon: '🥉', reward: 500, category: 'Первые шаги' },
  
  // Категория "Боевые"
  { id: 'streak_5', name: 'Блиц-король', description: 'Выиграй 5 матчей подряд', icon: '🥈', reward: 200, category: 'Боевые' },
  { id: 'accuracy_15', name: 'Точность', description: 'Попади 15 раз подряд', icon: '🥈', reward: 200, category: 'Боевые' },
  { id: 'perfect_game', name: 'Генерал', description: 'Выиграй без промахов', icon: '🥈', reward: 300, category: 'Боевые' },
  
  // Категория "Высокие достижения"
  { id: 'top_100', name: 'Топ-100', description: 'Попади в топ-100 рейтинга', icon: '🥇', reward: 500, category: 'Элитные' },
  { id: 'legend_2000', name: 'Легенда', description: 'Достигни рейтинга 2000+', icon: '🥇', reward: 1000, category: 'Элитные' },
  { id: 'boss_killer', name: 'Босс-киллер', description: 'Выиграй против Hard AI', icon: '🥇', reward: 300, category: 'Элитные' },
  
  // Категория "AI"
  { id: 'ai_easy_10', name: 'Новичок', description: 'Выиграй 10 раз против Easy AI', icon: '🎮', reward: 100, category: 'Тренировка' },
  { id: 'ai_medium_10', name: 'Опытный', description: 'Выиграй 10 раз против Medium AI', icon: '🎮', reward: 200, category: 'Тренировка' },
  { id: 'ai_hard_10', name: 'Профессионал', description: 'Выиграй 10 раз против Hard AI', icon: '🎮', reward: 500, category: 'Тренировка' },
]

function Achievements() {
  const user = useSelector((state) => state.user.user)
  const [unlockedIds, setUnlockedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAchievements()
  }, [user])

  const fetchAchievements = async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      const response = await api.get(`/users/${user.id}/achievements`)
      const unlocked = new Set(
        response.data.achievements
          .filter(a => a.unlocked)
          .map(a => a.id)
      )
      setUnlockedIds(unlocked)
    } catch (error) {
      console.error('Error fetching achievements:', error)
    } finally {
      setLoading(false)
    }
  }

  // Группируем достижения по категориям
  const groupedAchievements = ACHIEVEMENTS.reduce((acc, achievement) => {
    if (!acc[achievement.category]) {
      acc[achievement.category] = []
    }
    acc[achievement.category].push(achievement)
    return acc
  }, {})

  const totalUnlocked = unlockedIds.size
  const totalAchievements = ACHIEVEMENTS.length
  const progress = Math.round((totalUnlocked / totalAchievements) * 100)

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
              ДОСТИЖЕНИЯ
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <motion.div
                className="w-8 h-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
                animate={{ scaleX: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              />
              <p className="text-white/80 font-medium tracking-widest text-sm uppercase">
                Ваш прогресс
              </p>
              <motion.div
                className="w-8 h-1 bg-gradient-to-r from-orange-500 to-yellow-400 rounded-full"
                animate={{ scaleX: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              />
            </div>
          </motion.div>
        </motion.div>

        {/* Прогресс */}
        <motion.div
          variants={itemVariants}
          className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl mb-8"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-bold text-xl">Общий прогресс</h3>
            <div className="bg-white/20 backdrop-blur rounded-xl px-4 py-2 border border-white/30">
              <span className="text-white font-bold text-lg">{totalUnlocked}/{totalAchievements}</span>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-sm text-white/70 mb-2">
              <span>Завершено</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-4 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.5, delay: 0.5 }}
              />
            </div>
          </div>
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
            <p className="text-white/70 text-lg">Загрузка достижений...</p>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedAchievements).map(([category, achievements], categoryIndex) => (
              <motion.div
                key={category}
                variants={itemVariants}
                className="space-y-4"
              >
                <motion.h3
                  className="text-white font-bold text-xl bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: categoryIndex * 0.2 }}
                >
                  {category}
                </motion.h3>
                <div className="grid gap-3">
                  {achievements.map((achievement, index) => {
                    const isUnlocked = unlockedIds.has(achievement.id)

                    return (
                      <motion.div
                        key={achievement.id}
                        whileHover={{ scale: 1.02 }}
                        className={`relative overflow-hidden ${
                          isUnlocked
                            ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20'
                            : 'bg-white/5'
                        } backdrop-blur-xl rounded-xl p-4 border border-white/20 shadow-lg`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <div className="flex items-center gap-4">
                          <motion.div
                            className={`text-4xl ${isUnlocked ? '' : 'grayscale opacity-50'}`}
                            animate={isUnlocked ? {
                              scale: [1, 1.1, 1],
                              rotate: [0, 5, 0, -5, 0]
                            } : {}}
                            transition={{ duration: 2, repeat: Infinity, delay: index * 0.5 }}
                          >
                            {isUnlocked ? achievement.icon : '🔒'}
                          </motion.div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-white text-lg">
                                {achievement.name}
                              </p>
                              {isUnlocked && (
                                <motion.span
                                  className="text-green-400 text-xl"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", delay: 0.5 }}
                                >
                                  ✓
                                </motion.span>
                              )}
                            </div>
                            <p className={`text-sm ${isUnlocked ? 'text-white/70' : 'text-white/50'}`}>
                              {achievement.description}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-bold ${isUnlocked ? 'text-yellow-400' : 'text-white/50'}`}>
                              +{achievement.reward} 🪙
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            ))}
          </div>
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

export default Achievements
