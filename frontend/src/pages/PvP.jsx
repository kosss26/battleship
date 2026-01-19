import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import ShipPlacement from '../components/ShipPlacement.jsx'
import { usePvPGame } from '../hooks/usePvPGame.js'
import { CELL_STATE, BOARD_SIZE } from '../utils/gameLogic.js'

function PvP() {
  const user = useSelector((state) => state.user.user)
  const {
    gameState,
    error,
    searchOpponent,
    cancelSearch,
    submitPlacement,
    makeMove,
    leaveGame,
    reset,
  } = usePvPGame()

  // Поиск противника
  const handleSearch = () => {
    searchOpponent()
  }

  // Расстановка готова
  const handlePlacementComplete = (board) => {
    submitPlacement(board)
  }

  // Ход игрока
  const handleCellClick = (row, col) => {
    if (!gameState.isMyTurn) return
    if (gameState.enemyBoard[row][col] !== CELL_STATE.EMPTY) return
    makeMove(row, col)
  }

  // Форматирование координат
  const formatCoord = (row, col) => {
    const letters = 'АБВГДЕЖЗИК'
    return `${letters[col]}${row + 1}`
  }

  // Рендер клетки своей доски
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
        className={`w-8 h-8 border border-blue-300 rounded ${bgColor} flex items-center justify-center text-xs`}
      >
        {content}
      </div>
    )
  }

  // Рендер клетки доски врага
  const renderEnemyCell = (cell, row, col) => {
    let bgColor = 'bg-blue-200'
    let content = ''
    const clickable = gameState.isMyTurn && cell === CELL_STATE.EMPTY

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
        onClick={() => clickable && handleCellClick(row, col)}
        disabled={!clickable}
        className={`w-8 h-8 border border-blue-300 rounded ${bgColor} flex items-center justify-center text-xs disabled:cursor-not-allowed`}
      >
        {content}
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Idle - показываем кнопку поиска */}
        {gameState.status === 'idle' && (
          <div className="text-center space-y-6">
            <h2 className="text-2xl font-bold">⚔️ PvP Матч</h2>
            <p className="text-gray-600">
              Найдите противника с похожим рейтингом и сразитесь в реальном времени!
            </p>
            
            <button
              onClick={handleSearch}
              className="px-8 py-4 bg-primary text-white rounded-lg font-semibold text-lg hover:bg-blue-600 transition-colors"
            >
              🔍 Найти противника
            </button>

            {error && (
              <div className="p-4 bg-red-100 text-red-700 rounded-lg">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Searching - ищем противника */}
        {gameState.status === 'searching' && (
          <div className="text-center space-y-6">
            <h2 className="text-2xl font-bold">🔍 Поиск противника...</h2>
            <div className="animate-pulse">
              <div className="text-6xl">⏳</div>
            </div>
            <p className="text-gray-600">
              Ищем игрока с рейтингом ±200 от вашего ({user?.rating || 1000})
            </p>
            
            <button
              onClick={cancelSearch}
              className="px-6 py-2 bg-gray-300 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
            >
              Отменить
            </button>
          </div>
        )}

        {/* Placement - расстановка кораблей */}
        {gameState.status === 'placement' && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-bold">Противник найден!</h2>
              <p className="text-gray-600">
                Расставьте корабли за 30 секунд
              </p>
            </div>
            
            {gameState.opponent && (
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <span className="font-semibold">Противник: </span>
                <span>{gameState.opponent.username || 'Игрок'}</span>
                <span className="text-gray-600 ml-2">
                  (Рейтинг: {gameState.opponent.rating || 1000})
                </span>
              </div>
            )}

            <ShipPlacement onPlacementComplete={handlePlacementComplete} />
          </div>
        )}

        {/* Playing - игра идёт */}
        {gameState.status === 'playing' && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Бой!</h2>
              <p className={`text-lg ${gameState.isMyTurn ? 'text-green-600' : 'text-orange-600'}`}>
                {gameState.isMyTurn ? '🎯 Ваш ход' : '⏳ Ход противника...'}
              </p>
            </div>

            <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
              {/* Своя доска */}
              <div className="space-y-2">
                <h3 className="text-center font-semibold">🚢 Ваша доска</h3>
                <div className="grid grid-cols-10 gap-1 p-3 bg-blue-50 rounded-lg">
                  {gameState.playerBoard?.map((row, rowIndex) =>
                    row.map((cell, colIndex) => renderPlayerCell(cell, rowIndex, colIndex))
                  )}
                </div>
              </div>

              {/* Доска врага */}
              <div className="space-y-2">
                <h3 className="text-center font-semibold">🎯 Доска противника</h3>
                <div className="grid grid-cols-10 gap-1 p-3 bg-blue-50 rounded-lg">
                  {gameState.enemyBoard?.map((row, rowIndex) =>
                    row.map((cell, colIndex) => renderEnemyCell(cell, rowIndex, colIndex))
                  )}
                </div>
              </div>
            </div>

            {/* История ходов */}
            {gameState.moves.length > 0 && (
              <div className="text-center">
                <h4 className="text-sm font-semibold text-gray-600 mb-2">Последние ходы</h4>
                <div className="flex flex-wrap gap-1 justify-center">
                  {gameState.moves.slice(-10).map((move, index) => (
                    <span
                      key={index}
                      className={`text-xs px-2 py-1 rounded ${
                        move.hit 
                          ? 'bg-green-200 text-green-800' 
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {move.player === 'me' ? '👤' : '👾'}
                      {formatCoord(move.row, move.col)}
                      {move.hit ? '💥' : '○'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Finished - игра окончена */}
        {gameState.status === 'finished' && (
          <div className="text-center space-y-6">
            <div className={`text-6xl ${gameState.winner === 'player' ? 'text-green-600' : 'text-red-600'}`}>
              {gameState.winner === 'player' ? '🏆' : '😢'}
            </div>
            <h2 className={`text-3xl font-bold ${gameState.winner === 'player' ? 'text-green-600' : 'text-red-600'}`}>
              {gameState.winner === 'player' ? 'Победа!' : 'Поражение'}
            </h2>

            <div className="space-y-3">
              <button
                onClick={reset}
                className="px-8 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
              >
                🔄 Играть ещё
              </button>
              <Link
                to="/"
                className="block px-6 py-2 text-primary hover:underline"
              >
                ← Главное меню
              </Link>
            </div>
          </div>
        )}

        {/* Кнопка выхода (кроме finished) */}
        {gameState.status !== 'finished' && gameState.status !== 'idle' && (
          <div className="mt-6 text-center">
            <button
              onClick={leaveGame}
              className="text-red-600 hover:underline"
            >
              Покинуть игру
            </button>
          </div>
        )}

        {/* Назад в меню (для idle) */}
        {gameState.status === 'idle' && (
          <Link
            to="/"
            className="block mt-6 text-center text-primary hover:underline"
          >
            ← Назад в меню
          </Link>
        )}
      </div>
    </div>
  )
}

export default PvP
