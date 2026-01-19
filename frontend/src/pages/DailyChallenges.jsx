import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-400 to-orange-600 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Заголовок */}
        <div className="text-center text-white py-4">
          <h1 className="text-3xl font-bold mb-2">📋 Ежедневные задания</h1>
          <p className="text-white/80">Обновление через: {timeUntilReset}</p>
        </div>

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
          className="block text-center text-white hover:underline py-4"
        >
          ← Назад в меню
        </Link>
      </div>
    </div>
  )
}

export default DailyChallenges
