import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { motion } from 'framer-motion'
import { haptic } from '../utils/telegram.js'
import { updateUser } from '../store/slices/userSlice.js'
import api from '../services/api.js'

function DailyChallenges() {
  const dispatch = useDispatch()
  const user = useSelector((state) => state.user.user)
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [message, setMessage] = useState(null)

  // Время до сброса заданий
  const [timeUntilReset, setTimeUntilReset] = useState('')

  useEffect(() => {
    fetchChallenges()
    updateResetTimer()
    
    const interval = setInterval(updateResetTimer, 60000) // Обновляем каждую минуту
    return () => clearInterval(interval)
  }, [])

  const fetchChallenges = async () => {
    try {
      const response = await api.get('/challenges/daily')
      setChallenges(response.data.challenges || [])
    } catch (error) {
      console.error('Error fetching challenges:', error)
      // Mock data для демонстрации
      setChallenges([
        { id: 1, challenge: { id: 'win_3', name: 'Победитель', description: 'Выиграй 3 матча', target: 3, reward: { gold: 100, exp: 50 } }, progress: 1, target: 3, completed: false },
        { id: 2, challenge: { id: 'play_5', name: 'Активный игрок', description: 'Сыграй 5 матчей', target: 5, reward: { gold: 75, exp: 30 } }, progress: 5, target: 5, completed: false },
        { id: 3, challenge: { id: 'sink_10', name: 'Разрушитель', description: 'Потопи 10 кораблей', target: 10, reward: { gold: 80, exp: 40 } }, progress: 7, target: 10, completed: false },
      ])
    } finally {
      setLoading(false)
    }
  }

  const updateResetTimer = () => {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    
    const diff = tomorrow - now
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    setTimeUntilReset(`${hours}ч ${minutes}м`)
  }

  const handleClaim = async () => {
    const completedChallenges = challenges.filter(c => c.progress >= c.target && !c.completed)
    
    if (completedChallenges.length === 0) {
      setMessage({ type: 'info', text: 'Нет завершённых заданий для получения награды' })
      return
    }

    setClaiming(true)
    
    try {
      const response = await api.post('/challenges/claim')
      
      if (response.data.success) {
        const { rewards } = response.data
        
        // Обновляем локально
        setChallenges(prev => prev.map(c => 
          c.progress >= c.target ? { ...c, completed: true } : c
        ))
        
        // Обновляем баланс пользователя
        if (user) {
          dispatch(updateUser({ gold: (user.gold || 0) + rewards.gold }))
        }
        
        setMessage({ 
          type: 'success', 
          text: `Получено: ${rewards.gold} 🪙 и ${rewards.exp} ✨` 
        })
      }
    } catch (error) {
      // Mock для демонстрации
      const totalGold = completedChallenges.reduce((sum, c) => sum + (c.challenge?.reward?.gold || 0), 0)
      const totalExp = completedChallenges.reduce((sum, c) => sum + (c.challenge?.reward?.exp || 0), 0)
      
      setChallenges(prev => prev.map(c => 
        c.progress >= c.target ? { ...c, completed: true } : c
      ))
      
      if (user) {
        dispatch(updateUser({ gold: (user.gold || 0) + totalGold }))
      }
      
      setMessage({ 
        type: 'success', 
        text: `Получено: ${totalGold} 🪙 и ${totalExp} ✨` 
      })
    } finally {
      setClaiming(false)
    }
  }

  const getProgressPercent = (progress, target) => {
    return Math.min(100, Math.round((progress / target) * 100))
  }

  const hasClaimable = challenges.some(c => c.progress >= c.target && !c.completed)

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-orange-900 to-red-900 relative overflow-hidden">
      {/* Фоновые элементы */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-900/20 via-red-900/20 to-yellow-900/20" />
        <motion.div
          className="absolute top-20 left-10 w-2 h-2 bg-orange-400/30 rounded-full"
          animate={{
            y: [0, -100, 0],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{ duration: 4, repeat: Infinity, delay: 0 }}
        />
        <motion.div
          className="absolute top-32 right-16 w-1 h-1 bg-red-400/40 rounded-full"
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
          <motion.div
            variants={{
              animate: {
                y: [0, -10, 0],
                rotate: [0, 2, 0, -2, 0],
                transition: {
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut"
                }
              }
            }}
            animate="animate"
            className="inline-block"
          >
            <h1 className="text-5xl font-black text-transparent bg-gradient-to-r from-white via-orange-200 to-red-200 bg-clip-text drop-shadow-2xl">
              ЗАДАНИЯ
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <motion.div
                className="w-8 h-1 bg-gradient-to-r from-orange-400 to-red-500 rounded-full"
                animate={{ scaleX: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              />
              <p className="text-white/80 font-medium tracking-widest text-sm uppercase">
                Ежедневные вызовы
              </p>
              <motion.div
                className="w-8 h-1 bg-gradient-to-r from-red-500 to-orange-400 rounded-full"
                animate={{ scaleX: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              />
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="mt-4 bg-white/10 backdrop-blur-xl rounded-xl px-4 py-2 border border-white/20 inline-block"
          >
            <p className="text-white/70 text-sm">Обновление через: <span className="font-bold text-white">{timeUntilReset}</span></p>
          </motion.div>
        </motion.div>

        {/* Сообщение */}
        {message && (
          <div className={`p-4 rounded-xl text-center font-semibold ${
            message.type === 'success' ? 'bg-green-100 text-green-700' :
            message.type === 'error' ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Кнопка забрать награды */}
        {hasClaimable && (
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="w-full py-4 bg-green-500 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-green-600 transition-all transform hover:scale-105 disabled:opacity-50"
          >
            {claiming ? '⏳ Получение...' : '🎁 Забрать награды!'}
          </button>
        )}

        {/* Задания */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center text-white py-8">Загрузка заданий...</div>
          ) : challenges.length === 0 ? (
            <div className="text-center text-white py-8">
              <p className="text-xl mb-2">🎮</p>
              <p>Начните играть, чтобы получить задания!</p>
            </div>
          ) : (
            challenges.map((item) => {
              const { challenge, progress, target, completed } = item
              const percent = getProgressPercent(progress, target)
              const isComplete = progress >= target

              return (
                <div 
                  key={item.id}
                  className={`bg-white rounded-xl shadow-lg p-4 ${
                    completed ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">
                        {challenge?.name || 'Задание'}
                        {completed && <span className="ml-2 text-green-500">✓</span>}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {challenge?.description || ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-yellow-600 font-bold">
                        +{challenge?.reward?.gold || 0} 🪙
                      </p>
                      <p className="text-purple-600 text-sm">
                        +{challenge?.reward?.exp || 0} ✨
                      </p>
                    </div>
                  </div>

                  {/* Прогресс-бар */}
                  <div className="relative">
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          isComplete 
                            ? 'bg-gradient-to-r from-green-400 to-green-500' 
                            : 'bg-gradient-to-r from-orange-400 to-orange-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                      <span>{progress}/{target}</span>
                      <span>{percent}%</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Подсказка */}
        <div className="bg-white/20 rounded-xl p-4 text-white text-center">
          <p className="text-sm">
            💡 Выполняйте задания каждый день для получения максимальных наград!
          </p>
        </div>

        <Link
          to="/"
          onClick={() => haptic.light()}
          className="block text-center text-white/80 hover:text-white py-4 font-medium"
        >
          ← Назад в меню
        </Link>
      </motion.div>
    </div>
  )
}

export default DailyChallenges
