import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api from '../services/api.js'

function Referrals() {
  const user = useSelector((state) => state.user.user)
  const [referralCode, setReferralCode] = useState('')
  const [stats, setStats] = useState({ totalReferrals: 0, totalBonus: 0 })
  const [referrals, setReferrals] = useState([])
  const [inputCode, setInputCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchReferralData()
  }, [])

  const fetchReferralData = async () => {
    try {
      const [codeResponse, listResponse] = await Promise.all([
        api.get('/referrals/code'),
        api.get('/referrals/list'),
      ])
      
      setReferralCode(codeResponse.data.code)
      setStats(codeResponse.data.stats)
      setReferrals(listResponse.data.referrals || [])
    } catch (error) {
      console.error('Error fetching referral data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      // Fallback для Telegram WebApp
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`Ваш код: ${referralCode}`)
      }
    }
  }

  const handleShareTelegram = () => {
    const text = `🚢 Присоединяйся к Battleship Online!\n\nИспользуй мой код: ${referralCode}\nИ получи бонус при регистрации!\n\n👉 t.me/BattleshipOnlineBot`
    
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent('t.me/BattleshipOnlineBot')}&text=${encodeURIComponent(text)}`
      )
    } else {
      window.open(`https://t.me/share/url?url=${encodeURIComponent('t.me/BattleshipOnlineBot')}&text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  const handleApplyCode = async () => {
    if (!inputCode.trim()) {
      setMessage({ type: 'error', text: 'Введите код' })
      return
    }

    try {
      const response = await api.post('/referrals/apply', { code: inputCode.trim() })
      setMessage({ type: 'success', text: response.data.message })
      setInputCode('')
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Ошибка применения кода' 
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-500 to-purple-700 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Заголовок */}
        <div className="text-center text-white py-4">
          <h1 className="text-3xl font-bold mb-2">👥 Рефералы</h1>
          <p className="text-white/80">Приглашай друзей и получай бонусы!</p>
        </div>

        {/* Твой код */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="font-bold text-lg mb-4 text-center">Твой реферальный код</h3>
          
          {loading ? (
            <div className="text-center text-gray-500">Загрузка...</div>
          ) : (
            <>
              <div className="bg-gray-100 rounded-lg p-4 text-center mb-4">
                <span className="text-2xl font-mono font-bold tracking-wider text-purple-600">
                  {referralCode}
                </span>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleCopyCode}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                    copied 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  {copied ? '✓ Скопировано' : '📋 Копировать'}
                </button>
                <button
                  onClick={handleShareTelegram}
                  className="flex-1 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                >
                  📤 Поделиться
                </button>
              </div>
            </>
          )}
        </div>

        {/* Бонусы */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="font-bold text-lg mb-4">🎁 Бонусы за приглашение</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
              <span className="text-2xl">🪙</span>
              <div>
                <p className="font-semibold">100 Gold</p>
                <p className="text-gray-600">За каждого приглашённого друга</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <span className="text-2xl">📈</span>
              <div>
                <p className="font-semibold">+10% от побед</p>
                <p className="text-gray-600">От выигрышей приглашённых навсегда</p>
              </div>
            </div>
          </div>
        </div>

        {/* Статистика */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="font-bold text-lg mb-4">📊 Твоя статистика</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-3xl font-bold text-purple-600">{stats.totalReferrals}</p>
              <p className="text-sm text-gray-600">Приглашённых</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-3xl font-bold text-yellow-600">{stats.totalBonus}</p>
              <p className="text-sm text-gray-600">Заработано 🪙</p>
            </div>
          </div>
        </div>

        {/* Список рефералов */}
        {referrals.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="font-bold text-lg mb-4">👥 Приглашённые друзья</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {referrals.map((ref, index) => (
                <div 
                  key={ref.id || index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center">
                      {ref.first_name?.[0] || '?'}
                    </div>
                    <div>
                      <p className="font-semibold">{ref.first_name || ref.username}</p>
                      <p className="text-xs text-gray-500">Рейтинг: {ref.rating}</p>
                    </div>
                  </div>
                  <span className="text-sm text-yellow-600 font-semibold">
                    +{ref.bonus_gold} 🪙
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ввод чужого кода */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="font-bold text-lg mb-4">🎟️ Ввести код друга</h3>
          
          {message && (
            <div className={`mb-4 p-3 rounded-lg text-center ${
              message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {message.text}
            </div>
          )}
          
          <div className="flex gap-2">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="Введите код"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono uppercase"
              maxLength={12}
            />
            <button
              onClick={handleApplyCode}
              className="px-6 py-3 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition-colors"
            >
              Применить
            </button>
          </div>
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

export default Referrals
