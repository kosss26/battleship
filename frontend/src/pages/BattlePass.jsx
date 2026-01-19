import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { updateUser } from '../store/slices/userSlice.js'
import api from '../services/api.js'

// Награды Battle Pass
const REWARDS = [
  { level: 1, free: { gold: 50 }, premium: { gold: 100, gems: 5 } },
  { level: 2, free: { gold: 75 }, premium: { gold: 150 } },
  { level: 3, free: null, premium: { skin: '🎖️ Военный флот' } },
  { level: 4, free: { gold: 100 }, premium: { gold: 200, gems: 10 } },
  { level: 5, free: { gems: 5 }, premium: { gems: 20 } },
  { level: 6, free: { gold: 100 }, premium: { gold: 200 } },
  { level: 7, free: null, premium: { skin: '❄️ Арктика' } },
  { level: 8, free: { gold: 125 }, premium: { gold: 250, gems: 15 } },
  { level: 9, free: { gold: 150 }, premium: { gold: 300 } },
  { level: 10, free: { gems: 10 }, premium: { gems: 30, skin: '✨ Неон' } },
  { level: 11, free: { gold: 150 }, premium: { gold: 300 } },
  { level: 12, free: null, premium: { skin: '🌙 Ночное море' } },
  { level: 13, free: { gold: 175 }, premium: { gold: 350, gems: 20 } },
  { level: 14, free: { gold: 200 }, premium: { gold: 400 } },
  { level: 15, free: { gems: 15 }, premium: { gems: 40 } },
  { level: 16, free: { gold: 200 }, premium: { gold: 400 } },
  { level: 17, free: null, premium: { skin: '🏴‍☠️ Пираты' } },
  { level: 18, free: { gold: 225 }, premium: { gold: 450, gems: 25 } },
  { level: 19, free: { gold: 250 }, premium: { gold: 500 } },
  { level: 20, free: { gems: 20 }, premium: { gems: 50, skin: '👑 Золотой' } },
]

function BattlePass() {
  const dispatch = useDispatch()
  const user = useSelector((state) => state.user.user)
  const [progress, setProgress] = useState({ level: 1, exp: 0, is_premium: false, claimed_rewards: [] })
  const [battlePass, setBattlePass] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(null)
  const [buyingPremium, setBuyingPremium] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchBattlePass()
  }, [])

  const fetchBattlePass = async () => {
    try {
      const response = await api.get('/battlepass')
      setBattlePass(response.data.battlePass)
      if (response.data.progress) {
        setProgress(response.data.progress)
      }
    } catch (error) {
      console.error('Error fetching battle pass:', error)
      // Mock data
      setBattlePass({
        name: 'Сезон 1: Морские легенды',
        season: 1,
        premium_price_gems: 500,
        end_date: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBuyPremium = async () => {
    if (progress.is_premium) return
    
    setBuyingPremium(true)
    try {
      const response = await api.post('/battlepass/buy-premium')
      setProgress(prev => ({ ...prev, is_premium: true }))
      setMessage({ type: 'success', text: '✨ Премиум Battle Pass активирован!' })
      
      // Обновляем баланс
      if (user) {
        dispatch(updateUser({ gems: (user.gems || 0) - (battlePass?.premium_price_gems || 500) }))
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Ошибка покупки' 
      })
    } finally {
      setBuyingPremium(false)
    }
  }

  const handleClaimReward = async (level, isPremium) => {
    const key = `${level}_${isPremium ? 'premium' : 'free'}`
    if ((progress.claimed_rewards || []).includes(key)) return
    
    setClaiming(key)
    try {
      const response = await api.post('/battlepass/claim', { level, isPremium })
      
      if (response.data.success) {
        setProgress(prev => ({
          ...prev,
          claimed_rewards: [...(prev.claimed_rewards || []), key],
        }))
        
        const reward = response.data.reward
        if (reward.gold && user) {
          dispatch(updateUser({ gold: (user.gold || 0) + reward.gold }))
        }
        if (reward.gems && user) {
          dispatch(updateUser({ gems: (user.gems || 0) + reward.gems }))
        }
        
        setMessage({ type: 'success', text: '🎁 Награда получена!' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Ошибка' })
    } finally {
      setClaiming(null)
    }
  }

  const formatReward = (reward) => {
    if (!reward) return '—'
    const parts = []
    if (reward.gold) parts.push(`${reward.gold} 🪙`)
    if (reward.gems) parts.push(`${reward.gems} 💎`)
    if (reward.skin) parts.push(reward.skin)
    return parts.join(' + ') || '—'
  }

  const isRewardClaimed = (level, isPremium) => {
    const key = `${level}_${isPremium ? 'premium' : 'free'}`
    return (progress.claimed_rewards || []).includes(key)
  }

  const canClaim = (level, isPremium) => {
    if (progress.level < level) return false
    if (isPremium && !progress.is_premium) return false
    if (isRewardClaimed(level, isPremium)) return false
    const reward = REWARDS[level - 1]
    return isPremium ? !!reward?.premium : !!reward?.free
  }

  const getDaysLeft = () => {
    if (!battlePass?.end_date) return 0
    const diff = new Date(battlePass.end_date) - new Date()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const expPercent = Math.min(100, (progress.exp / 100) * 100)

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-500 via-orange-500 to-red-600 p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Заголовок */}
        <div className="text-center text-white py-4">
          <motion.h1 
            className="text-3xl font-bold mb-1"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🎖️ Battle Pass
          </motion.h1>
          <p className="text-white/80">{battlePass?.name || 'Сезон 1'}</p>
          <p className="text-sm text-white/60">Осталось {getDaysLeft()} дней</p>
        </div>

        {/* Сообщение */}
        <AnimatePresence>
          {message && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`p-4 rounded-xl text-center font-semibold ${
                message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Прогресс */}
        <div className="bg-white rounded-2xl shadow-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-lg">Уровень {progress.level}/20</span>
            <span className="text-sm text-gray-500">{progress.exp}/100 XP</span>
          </div>
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
              initial={{ width: 0 }}
              animate={{ width: `${expPercent}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Премиум кнопка */}
        {!progress.is_premium && (
          <motion.button
            onClick={handleBuyPremium}
            disabled={buyingPremium}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white rounded-xl font-bold text-lg shadow-lg disabled:opacity-50"
          >
            {buyingPremium ? '⏳ Покупка...' : `👑 Купить Премиум — ${battlePass?.premium_price_gems || 500} 💎`}
          </motion.button>
        )}

        {progress.is_premium && (
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl p-3 text-center font-bold">
            ✨ Премиум активен
          </div>
        )}

        {/* Награды */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="grid grid-cols-3 text-center font-semibold text-sm border-b">
            <div className="p-2 bg-gray-100">Уровень</div>
            <div className="p-2 bg-gray-50">Бесплатно</div>
            <div className="p-2 bg-purple-100">👑 Премиум</div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {REWARDS.map((reward) => {
              const isCurrentLevel = progress.level === reward.level
              const isUnlocked = progress.level >= reward.level
              
              return (
                <motion.div 
                  key={reward.level}
                  className={`grid grid-cols-3 border-b last:border-b-0 ${
                    isCurrentLevel ? 'bg-amber-50' : ''
                  } ${!isUnlocked ? 'opacity-50' : ''}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isUnlocked ? 1 : 0.5 }}
                >
                  {/* Уровень */}
                  <div className="p-3 flex items-center justify-center">
                    <span className={`font-bold ${isCurrentLevel ? 'text-amber-600' : ''}`}>
                      {reward.level}
                    </span>
                  </div>

                  {/* Бесплатная награда */}
                  <div className="p-2 flex items-center justify-center">
                    {reward.free ? (
                      <button
                        onClick={() => handleClaimReward(reward.level, false)}
                        disabled={!canClaim(reward.level, false) || claiming === `${reward.level}_free`}
                        className={`text-xs p-2 rounded-lg transition-all ${
                          isRewardClaimed(reward.level, false)
                            ? 'bg-green-100 text-green-600'
                            : canClaim(reward.level, false)
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {isRewardClaimed(reward.level, false) 
                          ? '✓' 
                          : claiming === `${reward.level}_free` 
                          ? '...' 
                          : formatReward(reward.free)}
                      </button>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </div>

                  {/* Премиум награда */}
                  <div className="p-2 flex items-center justify-center bg-purple-50/50">
                    {reward.premium ? (
                      <button
                        onClick={() => handleClaimReward(reward.level, true)}
                        disabled={!canClaim(reward.level, true) || claiming === `${reward.level}_premium`}
                        className={`text-xs p-2 rounded-lg transition-all ${
                          isRewardClaimed(reward.level, true)
                            ? 'bg-green-100 text-green-600'
                            : canClaim(reward.level, true)
                            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {isRewardClaimed(reward.level, true) 
                          ? '✓' 
                          : claiming === `${reward.level}_premium` 
                          ? '...' 
                          : formatReward(reward.premium)}
                      </button>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Подсказка */}
        <div className="bg-white/20 rounded-xl p-4 text-white text-center text-sm">
          💡 Играйте матчи и выполняйте задания, чтобы получать XP для Battle Pass!
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

export default BattlePass
