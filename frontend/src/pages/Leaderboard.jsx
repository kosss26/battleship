import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
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

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6 text-center">🏆 Рейтинг игроков</h2>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Загрузка рейтинга...</p>
            </div>
          ) : (
            <>
              {/* Топ-3 игроков */}
              <div className="mb-6 space-y-3">
                {leaderboard.slice(0, 3).map((player) => (
                  <div
                    key={player.rank}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      player.rank === 1
                        ? 'bg-yellow-100 border-2 border-yellow-400'
                        : player.rank === 2
                        ? 'bg-gray-100 border-2 border-gray-300'
                        : player.rank === 3
                        ? 'bg-orange-100 border-2 border-orange-300'
                        : 'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{getMedalEmoji(player.rank)}</span>
                      <div>
                        <p className="font-semibold">{player.username}</p>
                        <p className="text-sm text-gray-600">Рейтинг: {player.rating}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Побед: {player.winRate}%</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Остальные игроки */}
              {leaderboard.length > 3 && (
                <div className="space-y-2 mb-6">
                  {leaderboard.slice(3).map((player) => (
                    <div
                      key={player.rank}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-gray-500 font-semibold w-8">
                          #{player.rank}
                        </span>
                        <div>
                          <p className="font-medium">{player.username}</p>
                          <p className="text-sm text-gray-600">Рейтинг: {player.rating}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">Побед: {player.winRate}%</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Рейтинг текущего пользователя */}
              {userRank && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-600 font-semibold mb-2">Ваше место:</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{user.username || 'Вы'}</p>
                        <p className="text-sm text-gray-600">Рейтинг: {userRank.rating}</p>
                      </div>
                      <span className="text-xl font-bold text-blue-600">
                        #{userRank.rank}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <Link
            to="/"
            className="block mt-6 text-center text-primary hover:underline"
          >
            ← Назад в меню
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Leaderboard
