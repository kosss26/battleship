import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
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

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Основная карточка профиля */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6 text-center">👤 Профиль</h2>
          
          {user ? (
            <div className="space-y-6">
              {/* Аватар и имя */}
              <div className="flex items-center space-x-4">
                {user.photo_url ? (
                  <img
                    src={user.photo_url}
                    alt="Avatar"
                    className="w-20 h-20 rounded-full border-4 border-primary"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-3xl font-bold border-4 border-primary">
                    {user.first_name?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div>
                  <p className="font-bold text-xl">
                    {user.first_name || 'Игрок'} {user.last_name || ''}
                  </p>
                  {user.username && (
                    <p className="text-gray-600">@{user.username}</p>
                  )}
                  <p className={`text-lg font-semibold ${rankInfo.color}`}>
                    {rankInfo.icon} {rankInfo.name}
                  </p>
                </div>
              </div>

              {/* Рейтинг и уровень */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-lg text-white">
                  <p className="text-sm opacity-80 mb-1">Рейтинг</p>
                  <p className="text-3xl font-bold">{user.rating || 1000}</p>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-lg text-white">
                  <p className="text-sm opacity-80 mb-1">Уровень</p>
                  <p className="text-3xl font-bold">{user.level || 1}</p>
                </div>
              </div>

              {/* Валюта */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <p className="text-sm text-gray-600 mb-1">🪙 Золото</p>
                  <p className="text-2xl font-bold text-yellow-600">{user.gold || 0}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <p className="text-sm text-gray-600 mb-1">💎 Гемы</p>
                  <p className="text-2xl font-bold text-purple-600">{user.gems || 0}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Загрузка профиля...</p>
          )}
        </div>

        {/* Статистика */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="font-bold text-lg mb-4">📊 Статистика</h3>
          
          {loading ? (
            <p className="text-gray-500 text-center">Загрузка...</p>
          ) : stats ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Всего матчей:</span>
                <span className="font-bold text-lg">{stats.totalMatches}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Побед:</span>
                <span className="font-bold text-lg text-green-600">{stats.wins}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Поражений:</span>
                <span className="font-bold text-lg text-red-600">{stats.losses}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Winrate:</span>
                <span className="font-bold text-lg">
                  {stats.winRate}%
                </span>
              </div>
              
              {/* Прогресс-бар winrate */}
              <div className="pt-2">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                    style={{ width: `${stats.winRate}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center">Статистика недоступна</p>
          )}
        </div>

        {/* Последние игры */}
        {recentGames.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="font-bold text-lg mb-4">🎮 Последние игры</h3>
            <div className="space-y-2">
              {recentGames.map((game, index) => {
                const isWinner = game.winner_id === user?.id
                return (
                  <div 
                    key={game.id || index}
                    className={`p-3 rounded-lg border ${
                      isWinner 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">
                        {isWinner ? '✅ Победа' : '❌ Поражение'}
                      </span>
                      <span className="text-sm text-gray-600">
                        {game.mode?.replace('ai_', 'AI ').toUpperCase() || 'PvP'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(game.ended_at)}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Быстрые действия */}
        <div className="space-y-2">
          <Link
            to="/achievements"
            className="block w-full bg-white border border-gray-200 text-gray-800 py-3 px-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            🎖️ Мои достижения
          </Link>
          <Link
            to="/leaderboard"
            className="block w-full bg-white border border-gray-200 text-gray-800 py-3 px-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            🏆 Рейтинг игроков
          </Link>
        </div>

        <Link
          to="/"
          className="block text-center text-primary hover:underline py-4"
        >
          ← Назад в меню
        </Link>
      </div>
    </div>
  )
}

export default Profile
