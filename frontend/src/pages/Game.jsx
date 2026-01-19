import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
    haptic.medium()
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden flex flex-col">
      {/* Фоновые элементы */}
      <div className="absolute inset-0 pointer-events-none">
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

      {/* Верхняя панель */}
      <div className="w-full bg-white/5 backdrop-blur-md border-b border-white/10 p-4 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link
              to="/"
              onClick={() => haptic.light()}
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
            >
              <span>←</span>
              <span className="hidden sm:inline">Меню</span>
            </Link>

            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r ${getDifficultyColor(difficulty)} shadow-lg`}>
                <span className="text-white font-bold text-sm uppercase tracking-wider">{getDifficultyLabel(difficulty)}</span>
            </div>

            <div className="w-8" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Основной контент */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 relative z-10">
        <AnimatePresence mode="wait">
          {gamePhase === 'placement' && (
            <motion.div
                key="placement"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="w-full max-w-4xl mx-auto"
            >
                <ShipPlacement onPlacementComplete={handlePlacementComplete} />
            </motion.div>
          )}

          {gamePhase === 'playing' && playerBoard && (
            <motion.div
                key="playing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="w-full h-full flex flex-col justify-center"
            >
                <BattlePhase
                    playerBoard={playerBoard}
                    onGameEnd={handleGameEnd}
                    aiDifficulty={difficulty}
                />
            </motion.div>
          )}

          {gamePhase === 'finished' && (
            <motion.div
                key="finished"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-4xl mx-auto flex items-center justify-center min-h-[50vh]"
            >
                <GameResults
                    gameResult={gameResult}
                    difficulty={difficulty}
                    onPlayAgain={handlePlayAgain}
                />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default Game
