import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
    setGamePhase('placement')
    setPlayerBoard(null)
    setGameResult(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
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
        
        {gamePhase !== 'finished' && (
          <Link
            to="/"
            className="block mt-4 text-center text-primary hover:underline"
          >
            ← Назад в меню
          </Link>
        )}
      </div>
    </div>
  )
}

export default Game
