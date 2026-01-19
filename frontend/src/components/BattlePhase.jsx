import { useState } from 'react'
import { CELL_STATE, makeShot, isGameOver, generateRandomBoard, BOARD_SIZE } from '../utils/gameLogic.js'
import { BattleshipAI } from '../utils/ai.js'

/**
 * Компонент боевой фазы игры
 * Согласно ТЗ: левая доска - свои корабли, правая - враг (только попадания/промахи)
 */
function BattlePhase({ playerBoard, onGameEnd, aiDifficulty = 'easy' }) {
  const [playerBattleBoard, setPlayerBattleBoard] = useState(() => 
    playerBoard.map(row => [...row])
  )
  const [enemyBattleBoard, setEnemyBattleBoard] = useState(() => 
    Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(CELL_STATE.EMPTY))
  )
  const [currentTurn, setCurrentTurn] = useState('player')
  const [gameStatus, setGameStatus] = useState('playing')
  const [moveHistory, setMoveHistory] = useState([])
  const [ai] = useState(() => new BattleshipAI(aiDifficulty))
  const [aiBoard, setAiBoard] = useState(() => generateRandomBoard())
  const [isProcessing, setIsProcessing] = useState(false)

  // Добавление хода в историю
  const addMoveToHistory = (player, row, col, hit, sunk) => {
    setMoveHistory(prev => {
      const newHistory = [...prev, { player, row, col, hit, sunk, time: Date.now() }]
      return newHistory.slice(-10) // Последние 10 ходов
    })
  }

  // Обработка хода игрока
  const handlePlayerShot = async (row, col) => {
    if (currentTurn !== 'player' || gameStatus !== 'playing' || isProcessing) return
    if (enemyBattleBoard[row][col] !== CELL_STATE.EMPTY) return

    setIsProcessing(true)

    const result = makeShot(aiBoard, row, col)
    const newEnemyBoard = enemyBattleBoard.map(r => [...r])
    newEnemyBoard[row][col] = result.hit ? CELL_STATE.HIT : CELL_STATE.MISS

    setEnemyBattleBoard(newEnemyBoard)
    setAiBoard(result.board)
    addMoveToHistory('player', row, col, result.hit, result.sunk)

    if (isGameOver(result.board)) {
      setGameStatus('playerWon')
      onGameEnd({ winner: 'player', playerBoard: playerBattleBoard, enemyBoard: newEnemyBoard })
      setIsProcessing(false)
      return
    }

    if (result.hit) {
      setIsProcessing(false)
      return // Продолжаем ход игрока
    }

    // Ход AI
    setCurrentTurn('ai')
    await ai.think()
    await handleAIShot()
  }

  // Обработка хода AI
  const handleAIShot = async () => {
    if (gameStatus !== 'playing') {
      setIsProcessing(false)
      return
    }

    const move = ai.getNextMove(playerBattleBoard)
    const result = makeShot(playerBattleBoard, move.row, move.col)

    const newPlayerBoard = playerBattleBoard.map(r => [...r])
    if (result.hit) {
      newPlayerBoard[move.row][move.col] = result.sunk ? CELL_STATE.SUNK : CELL_STATE.HIT
    } else {
      newPlayerBoard[move.row][move.col] = CELL_STATE.MISS
    }

    setPlayerBattleBoard(newPlayerBoard)
    ai.processShotResult(move.row, move.col, result.hit, result.sunk)
    addMoveToHistory('ai', move.row, move.col, result.hit, result.sunk)

    if (isGameOver(newPlayerBoard)) {
      setGameStatus('playerLost')
      onGameEnd({ winner: 'ai', playerBoard: newPlayerBoard, enemyBoard: enemyBattleBoard })
      setIsProcessing(false)
      return
    }

    if (result.hit) {
      await ai.think()
      await handleAIShot()
      return
    }

    setCurrentTurn('player')
    setIsProcessing(false)
  }

  // Конвертация координат в буквенно-цифровой формат
  const formatCoord = (row, col) => {
    const letters = 'АБВГДЕЖЗИК'
    return `${letters[col]}${row + 1}`
  }

  // Визуализация клетки доски игрока
  const renderPlayerCell = (cell, row, col) => {
    let bgColor = 'bg-blue-200'
    let content = ''

    switch (cell) {
      case CELL_STATE.SHIP:
        bgColor = 'bg-gray-600'
        content = '█'
        break
      case CELL_STATE.HIT:
        bgColor = 'bg-red-500'
        content = '💥'
        break
      case CELL_STATE.MISS:
        bgColor = 'bg-gray-300'
        content = '○'
        break
      case CELL_STATE.SUNK:
        bgColor = 'bg-red-700'
        content = '🔥'
        break
    }

    return (
      <div
        key={`player-${row}-${col}`}
        className={`w-10 h-10 border border-blue-300 rounded ${bgColor} flex items-center justify-center text-sm touch-manipulation`}
      >
        {content}
      </div>
    )
  }

  // Визуализация клетки доски врага
  const renderEnemyCell = (cell, row, col) => {
    let bgColor = 'bg-blue-200'
    let content = ''
    const clickable = currentTurn === 'player' && gameStatus === 'playing' && !isProcessing && cell === CELL_STATE.EMPTY

    switch (cell) {
      case CELL_STATE.HIT:
        bgColor = 'bg-red-500'
        content = '💥'
        break
      case CELL_STATE.MISS:
        bgColor = 'bg-gray-300'
        content = '○'
        break
      case CELL_STATE.SUNK:
        bgColor = 'bg-red-700'
        content = '🔥'
        break
      default:
        if (clickable) {
          bgColor = 'bg-blue-200 hover:bg-blue-300 cursor-pointer'
        }
    }

    return (
      <button
        key={`enemy-${row}-${col}`}
        onClick={() => clickable && handlePlayerShot(row, col)}
        disabled={!clickable}
        className={`w-10 h-10 border border-blue-300 rounded ${bgColor} flex items-center justify-center text-sm touch-manipulation disabled:cursor-not-allowed`}
      >
        {content}
      </button>
    )
  }

  // Последний ход для отображения
  const lastMove = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : null

  return (
    <div className="space-y-4">
      {/* Статус игры */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Ход боя</h2>
        {gameStatus === 'playing' && (
          <p className={`text-lg ${currentTurn === 'player' ? 'text-green-600' : 'text-orange-600'}`}>
            {currentTurn === 'player' ? '🎯 Ваш ход' : '⏳ Ход противника...'}
          </p>
        )}
        {gameStatus === 'playerWon' && (
          <p className="text-2xl font-bold text-green-600">🎉 Вы победили!</p>
        )}
        {gameStatus === 'playerLost' && (
          <p className="text-2xl font-bold text-red-600">😢 Вы проиграли</p>
        )}
      </div>

      {/* Сообщение о последнем ходе */}
      {lastMove && gameStatus === 'playing' && (
        <div className="text-center text-sm">
          <span className={lastMove.player === 'player' ? 'text-blue-600' : 'text-red-600'}>
            {lastMove.player === 'player' ? 'Вы' : 'Противник'}
          </span>
          {' → '}
          <span className="font-mono">{formatCoord(lastMove.row, lastMove.col)}</span>
          {': '}
          {lastMove.hit ? (
            lastMove.sunk ? (
              <span className="text-red-600 font-semibold">Корабль потоплен! 🔥</span>
            ) : (
              <span className="text-green-600 font-semibold">Попадание! 💥</span>
            )
          ) : (
            <span className="text-gray-600">Промах</span>
          )}
        </div>
      )}

      {/* Игровые доски */}
      <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
        {/* Доска игрока */}
        <div className="space-y-2">
          <h3 className="text-center font-semibold">🚢 Ваша доска</h3>
          <div className="grid grid-cols-10 gap-1 p-3 bg-blue-50 rounded-lg">
            {playerBattleBoard.map((row, rowIndex) =>
              row.map((cell, colIndex) => renderPlayerCell(cell, rowIndex, colIndex))
            )}
          </div>
        </div>

        {/* Доска врага */}
        <div className="space-y-2">
          <h3 className="text-center font-semibold">🎯 Доска противника</h3>
          <div className="grid grid-cols-10 gap-1 p-3 bg-blue-50 rounded-lg">
            {enemyBattleBoard.map((row, rowIndex) =>
              row.map((cell, colIndex) => renderEnemyCell(cell, rowIndex, colIndex))
            )}
          </div>
        </div>
      </div>

      {/* История ходов */}
      {moveHistory.length > 0 && (
        <div className="max-w-md mx-auto">
          <h4 className="text-sm font-semibold text-gray-600 mb-2">История ходов</h4>
          <div className="flex flex-wrap gap-1 justify-center">
            {moveHistory.map((move, index) => (
              <span
                key={index}
                className={`text-xs px-2 py-1 rounded ${
                  move.hit 
                    ? move.sunk 
                      ? 'bg-red-200 text-red-800' 
                      : 'bg-green-200 text-green-800'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {move.player === 'player' ? '👤' : '🤖'}
                {formatCoord(move.row, move.col)}
                {move.hit ? (move.sunk ? '🔥' : '💥') : '○'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default BattlePhase
