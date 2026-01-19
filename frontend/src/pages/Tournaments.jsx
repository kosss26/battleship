import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import api from '../services/api.js'

function Tournaments() {
  const user = useSelector((state) => state.user.user)
  const [tournaments, setTournaments] = useState([])
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchTournaments()
  }, [])

  const fetchTournaments = async () => {
    try {
      const response = await api.get('/tournaments')
      setTournaments(response.data.tournaments || [])
    } catch (error) {
      console.error('Error fetching tournaments:', error)
      // Mock data
      setTournaments([
        {
          id: '1',
          name: 'Еженедельный турнир',
          type: 'weekly',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          entry_fee_gems: 0,
          min_rating: 0,
          max_players: 100,
          prize_pool: { '1': 1000, '2': 500, '3': 250 },
          status: 'active',
        },
        {
          id: '2',
          name: 'Турнир мастеров',
          type: 'monthly',
          start_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          entry_fee_gems: 50,
          min_rating: 1500,
          max_players: 50,
          prize_pool: { '1': 5000, '2': 2500, '3': 1000 },
          status: 'upcoming',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTournament = async (tournament) => {
    setSelectedTournament(tournament)
    try {
      const response = await api.get(`/tournaments/${tournament.id}/leaderboard`)
      setLeaderboard(response.data.leaderboard || [])
    } catch (error) {
      // Mock leaderboard
      setLeaderboard([
        { rank: 1, first_name: 'Александр', wins: 10, losses: 2, points: 30 },
        { rank: 2, first_name: 'Мария', wins: 8, losses: 3, points: 24 },
        { rank: 3, first_name: 'Дмитрий', wins: 7, losses: 4, points: 21 },
      ])
    }
  }

  const handleJoin = async (tournamentId) => {
    setJoining(true)
    try {
      const response = await api.post(`/tournaments/${tournamentId}/join`)
      setMessage({ type: 'success', text: response.data.message || 'Вы зарегистрированы!' })
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Ошибка регистрации' 
      })
    } finally {
      setJoining(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="bg-green-500 text-white px-2 py-0.5 rounded-full text-xs">Активен</span>
      case 'upcoming':
        return <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs">Скоро</span>
      case 'finished':
        return <span className="bg-gray-500 text-white px-2 py-0.5 rounded-full text-xs">Завершён</span>
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-500 to-purple-700 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Заголовок */}
        <div className="text-center text-white py-4">
          <h1 className="text-3xl font-bold mb-2">🏆 Турниры</h1>
          <p className="text-white/80">Соревнуйтесь с лучшими игроками</p>
        </div>

        {/* Сообщение */}
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl text-center font-semibold ${
              message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {message.text}
          </motion.div>
        )}

        {/* Список турниров */}
        {loading ? (
          <div className="text-center text-white py-8">Загрузка турниров...</div>
        ) : selectedTournament ? (
          /* Детали турнира */
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4 text-white">
              <button 
                onClick={() => setSelectedTournament(null)}
                className="text-white/80 hover:text-white mb-2"
              >
                ← Назад
              </button>
              <h2 className="text-xl font-bold">{selectedTournament.name}</h2>
              <p className="text-white/80 text-sm">
                {formatDate(selectedTournament.start_date)} - {formatDate(selectedTournament.end_date)}
              </p>
            </div>

            <div className="p-4 space-y-4">
              {/* Призовой фонд */}
              <div className="bg-yellow-50 p-4 rounded-xl">
                <h3 className="font-semibold mb-2">🏆 Призы</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {Object.entries(selectedTournament.prize_pool || {}).slice(0, 3).map(([place, prize]) => (
                    <div key={place} className="bg-white p-2 rounded-lg shadow">
                      <p className="text-lg font-bold">
                        {place === '1' ? '🥇' : place === '2' ? '🥈' : '🥉'}
                      </p>
                      <p className="text-yellow-600 font-semibold">{prize} 🪙</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Условия */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-500">Взнос</p>
                  <p className="font-bold">
                    {selectedTournament.entry_fee_gems > 0 
                      ? `${selectedTournament.entry_fee_gems} 💎` 
                      : 'Бесплатно'}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-500">Мин. рейтинг</p>
                  <p className="font-bold">{selectedTournament.min_rating || 'Нет'}</p>
                </div>
              </div>

              {/* Кнопка регистрации */}
              {selectedTournament.status !== 'finished' && (
                <button
                  onClick={() => handleJoin(selectedTournament.id)}
                  disabled={joining}
                  className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold hover:shadow-lg transition-shadow disabled:opacity-50"
                >
                  {joining ? '⏳ Регистрация...' : '✅ Участвовать'}
                </button>
              )}

              {/* Таблица лидеров */}
              <div>
                <h3 className="font-semibold mb-2">📊 Таблица лидеров</h3>
                {leaderboard.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {leaderboard.map((player) => (
                      <div 
                        key={player.rank}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold w-6 text-center">
                            {player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : `#${player.rank}`}
                          </span>
                          <span>{player.first_name || 'Игрок'}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          <span className="text-green-600">{player.wins}W</span>
                          {' / '}
                          <span className="text-red-600">{player.losses}L</span>
                          {' • '}
                          <span className="font-semibold">{player.points} pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Пока нет участников</p>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          /* Список турниров */
          <div className="space-y-3">
            {tournaments.length === 0 ? (
              <div className="text-center text-white py-8">
                <p className="text-xl mb-2">🎮</p>
                <p>Нет активных турниров</p>
              </div>
            ) : (
              tournaments.map((tournament) => (
                <motion.div
                  key={tournament.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectTournament(tournament)}
                  className="bg-white rounded-xl shadow-lg p-4 cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">{tournament.name}</h3>
                    {getStatusBadge(tournament.status)}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">
                    {formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}
                  </p>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-yellow-600 font-semibold">
                      🏆 {Object.values(tournament.prize_pool || {})[0] || 0} 🪙
                    </span>
                    <span className="text-gray-500">
                      {tournament.entry_fee_gems > 0 
                        ? `Взнос: ${tournament.entry_fee_gems} 💎` 
                        : 'Бесплатный'}
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

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

export default Tournaments
