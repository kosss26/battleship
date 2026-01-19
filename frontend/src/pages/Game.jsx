import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { haptic } from '../utils/telegram.js'
import ShipPlacement from '../components/ShipPlacement.jsx'
import BattlePhase from '../components/BattlePhase.jsx'
import GameResults from '../components/GameResults.jsx'

function Game() {
  const [searchParams] = useSearchParams()
  const difficulty = searchParams.get('difficulty') || 'easy'
  
  const [gamePhase, setGamePhase] = useState('placement')
  const [playerBoard, setPlayerBoard] = useState(null)
  const [gameResult, setGameResult] = useState(null)

  const handlePlacementComplete = (board) => {
    setPlayerBoard(board)
    setGamePhase('playing')
  }

  const handleGameEnd = (result) => {
    setGameResult(result)
    setGamePhase('finished')
  }

  const handlePlayAgain = () => {
    haptic.medium()
    setGamePhase('placement')
    setPlayerBoard(null)
    setGameResult(null)
  }

  const getDifficultyColor = (diff) => {
    switch(diff) {
      case 'easy': return 'from-green-400 to-green-600'
      case 'medium': return 'from-yellow-400 to-orange-500'
      case 'hard': return 'from-red-400 to-red-600'
      default: return 'from-blue-400 to-purple-500'
    }
  }

  const getDifficultyLabel = (diff) => {
    switch(diff) {
      case 'easy': return 'Легкий'
      case 'medium': return 'Средний'
      case 'hard': return 'Сложный'
      default: return 'Неизвестно'
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

      <div className="max-w-4xl mx-auto pt-4 px-4 relative z-10">
        {/* Хедер с уровнем сложности */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-4"
        >
          <div className={`inline-flex items-center gap-3 bg-gradient-to-r ${getDifficultyColor(difficulty)} px-6 py-3 rounded-full text-white font-bold shadow-2xl`}>
            <span className="text-2xl">🎯</span>
            <span>Уровень: {getDifficultyLabel(difficulty)}</span>
          </div>
        </motion.div>

        {/* Фазы игры */}
        <motion.div
          key={gamePhase}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
        >
          {gamePhase === 'placement' && (
            <ShipPlacement onPlacementComplete={handlePlacementComplete} />
          )}

          {gamePhase === 'playing' && playerBoard && (
            <BattlePhase
              playerBoard={playerBoard}
              onGameEnd={handleGameEnd}
              aiDifficulty={difficulty}
            />
          )}

          {gamePhase === 'finished' && (
            <GameResults
              gameResult={gameResult}
              difficulty={difficulty}
              onPlayAgain={handlePlayAgain}
            />
          )}
        </motion.div>

        {/* Кнопка назад */}
        {gamePhase !== 'finished' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-6"
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
        )}
      </div>
    </div>
  )
}

export default Game
