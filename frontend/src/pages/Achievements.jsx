import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
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

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-center">🏆 Достижения</h2>

          {/* Прогресс */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Прогресс</span>
              <span>{totalUnlocked}/{totalAchievements} ({progress}%)</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Загрузка достижений...
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedAchievements).map(([category, achievements]) => (
                <div key={category}>
                  <h3 className="font-semibold text-gray-700 mb-3">{category}</h3>
                  <div className="space-y-2">
                    {achievements.map((achievement) => {
                      const isUnlocked = unlockedIds.has(achievement.id)
                      
                      return (
                        <div
                          key={achievement.id}
                          className={`flex items-center p-3 rounded-lg border ${
                            isUnlocked 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-gray-50 border-gray-200 opacity-60'
                          }`}
                        >
                          <div className="text-3xl mr-3">
                            {isUnlocked ? achievement.icon : '🔒'}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">
                              {achievement.name}
                              {isUnlocked && <span className="ml-2 text-green-600">✓</span>}
                            </p>
                            <p className="text-sm text-gray-600">{achievement.description}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-yellow-600">
                              +{achievement.reward} 🪙
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
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

export default Achievements
