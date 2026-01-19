import { useMemo } from 'react'
import { Link } from 'react-router-dom'

/**
 * Компонент экрана результатов матча
 * Согласно ТЗ: награды, статистика, кнопки действий
 */
function GameResults({ gameResult, difficulty, onPlayAgain }) {
  const isWinner = gameResult?.winner === 'player'

  // Расчёт наград согласно ТЗ
  const rewards = useMemo(() => {
    const difficultyRewards = {
      easy: { gold: 50, exp: 100 },
      medium: { gold: 100, exp: 200 },
      hard: { gold: 150, exp: 300 },
    }

    const base = difficultyRewards[difficulty] || difficultyRewards.easy

    if (isWinner) {
      return {
        gold: base.gold,
        exp: base.exp,
        ratingChange: 0, // В режиме AI рейтинг не меняется
      }
    } else {
      return {
        gold: Math.floor(base.gold * 0.2), // 20% за поражение
        exp: Math.floor(base.exp * 0.5), // 50% опыта за поражение
        ratingChange: 0,
      }
    }
  }, [difficulty, isWinner])

  // Статистика матча (мок, в реальной версии из gameResult)
  const stats = useMemo(() => {
    // TODO: Получить реальную статистику из gameResult
    return {
      duration: '3:45',
      playerShots: 42,
      playerHits: 20,
      aiShots: 38,
      aiHits: 15,
      playerAccuracy: 48,
      aiAccuracy: 39,
    }
  }, [gameResult])

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Результат */}
      <div className={`text-center p-6 rounded-lg ${isWinner ? 'bg-green-100' : 'bg-red-100'}`}>
        <div className="text-6xl mb-4">
          {isWinner ? '🏆' : '😢'}
        </div>
        <h2 className={`text-3xl font-bold ${isWinner ? 'text-green-600' : 'text-red-600'}`}>
          {isWinner ? 'Победа!' : 'Поражение'}
        </h2>
        <p className="text-gray-600 mt-2">
          Режим: {difficulty === 'easy' ? 'Новичок' : difficulty === 'medium' ? 'Опытный' : 'Мастер'}
        </p>
      </div>

      {/* Награды */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-3 text-center">Награды</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl">🪙</div>
            <div className="text-xl font-bold text-yellow-600">+{rewards.gold}</div>
            <div className="text-xs text-gray-500">Gold</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl">⭐</div>
            <div className="text-xl font-bold text-blue-600">+{rewards.exp}</div>
            <div className="text-xs text-gray-500">Опыт</div>
          </div>
        </div>
      </div>

      {/* Статистика */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-3 text-center">Статистика матча</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Длительность:</span>
            <span className="font-semibold">{stats.duration}</span>
          </div>
          <div className="border-t pt-2 mt-2">
            <div className="grid grid-cols-3 gap-2 text-center text-xs text-gray-500 mb-1">
              <span></span>
              <span>Вы</span>
              <span>AI</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <span className="text-left text-gray-600">Выстрелов:</span>
              <span className="font-semibold">{stats.playerShots}</span>
              <span className="font-semibold">{stats.aiShots}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <span className="text-left text-gray-600">Попаданий:</span>
              <span className="font-semibold text-green-600">{stats.playerHits}</span>
              <span className="font-semibold text-green-600">{stats.aiHits}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <span className="text-left text-gray-600">Точность:</span>
              <span className="font-semibold">{stats.playerAccuracy}%</span>
              <span className="font-semibold">{stats.aiAccuracy}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Кнопки действий */}
      <div className="space-y-3">
        <button
          onClick={onPlayAgain}
          className="w-full py-3 bg-primary text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
        >
          🔄 Играть ещё
        </button>
        <Link
          to="/"
          className="block w-full py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold text-center hover:bg-gray-300 transition-colors"
        >
          🏠 Главное меню
        </Link>
      </div>
    </div>
  )
}

export default GameResults
