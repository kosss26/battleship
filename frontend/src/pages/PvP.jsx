import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '../utils/telegram.js'
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
    haptic.medium()
    searchOpponent()
  }

  // Расстановка готова
  const handlePlacementComplete = (board) => {
    haptic.medium()
    submitPlacement(board)
  }

  // Ход игрока
  const handleCellClick = (row, col) => {
    if (!gameState.isMyTurn) return
    if (gameState.enemyBoard[row][col] !== CELL_STATE.EMPTY) return
    haptic.light()
    makeMove(row, col)
  }

  // Форматирование координат
  const formatCoord = (row, col) => {
    const letters = 'АБВГДЕЖЗИК'
    return `${letters[col]}${row + 1}`
  }

  // Рендер клетки своей доски
  const renderPlayerCell = (cell, row, col) => {
    let bgColor = 'bg-blue-400/20'
    let content = ''
    let borderColor = 'border-blue-400/30'

    switch (cell) {
      case CELL_STATE.SHIP:
        bgColor = 'bg-gray-600/80'
        borderColor = 'border-gray-500/50'
        content = '█'
        break
      case CELL_STATE.HIT:
        bgColor = 'bg-red-500/80'
        borderColor = 'border-red-400/50'
        content = '💥'
        break
      case CELL_STATE.MISS:
        bgColor = 'bg-white/30'
        borderColor = 'border-white/40'
        content = '○'
        break
      case CELL_STATE.SUNK:
        bgColor = 'bg-red-700/80'
        borderColor = 'border-red-600/50'
        content = '🔥'
        break
    }

    return (
      <motion.div
        key={`player-${row}-${col}`}
        whileHover={{ scale: 1.05 }}
        className={`w-10 h-10 border rounded ${bgColor} ${borderColor} flex items-center justify-center text-white font-bold text-sm shadow-lg`}
      >
        {content}
      </motion.div>
    )
  }

  // Рендер клетки доски врага
  const renderEnemyCell = (cell, row, col) => {
    let bgColor = 'bg-blue-400/20'
    let content = ''
    let borderColor = 'border-blue-400/30'
    const clickable = gameState.isMyTurn && cell === CELL_STATE.EMPTY

    switch (cell) {
      case CELL_STATE.HIT:
        bgColor = 'bg-red-500/80'
        borderColor = 'border-red-400/50'
        content = '💥'
        break
      case CELL_STATE.MISS:
        bgColor = 'bg-white/30'
        borderColor = 'border-white/40'
        content = '○'
        break
      case CELL_STATE.SUNK:
        bgColor = 'bg-red-700/80'
        borderColor = 'border-red-600/50'
        content = '🔥'
        break
      default:
        if (clickable) {
          bgColor = 'bg-blue-400/20 hover:bg-blue-500/40 cursor-pointer'
          borderColor = 'border-blue-400/50'
        }
    }

    return (
      <motion.button
        key={`enemy-${row}-${col}`}
        onClick={() => clickable && handleCellClick(row, col)}
        disabled={!clickable}
        whileHover={clickable ? { scale: 1.1 } : {}}
        whileTap={clickable ? { scale: 0.95 } : {}}
        className={`w-10 h-10 border rounded ${bgColor} ${borderColor} flex items-center justify-center text-white font-bold text-sm shadow-lg disabled:cursor-not-allowed transition-all duration-200`}
      >
        {content}
      </motion.button>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Фоновые элементы */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-cyan-900/20" />
        <motion.div
          className="absolute top-20 left-10 w-2 h-2 bg-red-400/30 rounded-full"
          animate={{
            y: [0, -100, 0],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{ duration: 4, repeat: Infinity, delay: 0 }}
        />
        <motion.div
          className="absolute top-32 right-16 w-1 h-1 bg-orange-400/40 rounded-full"
          animate={{
            y: [0, -80, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{ duration: 3, repeat: Infinity, delay: 1 }}
        />
      </div>

      <div className="max-w-4xl mx-auto pt-8 px-4 relative z-10">
        {/* Idle - показываем кнопку поиска */}
        <AnimatePresence mode="wait">
          {gameState.status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-8"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <h1 className="text-6xl font-black text-transparent bg-gradient-to-r from-red-400 via-pink-500 to-purple-600 bg-clip-text drop-shadow-2xl">
                  PvP АРЕНА
                </h1>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <motion.div
                    className="w-8 h-1 bg-gradient-to-r from-red-400 to-pink-500 rounded-full"
                    animate={{ scaleX: [0, 1, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                  />
                  <p className="text-white/80 font-medium tracking-widest text-sm uppercase">
                    Битва в реальном времени
                  </p>
                  <motion.div
                    className="w-8 h-1 bg-gradient-to-r from-pink-500 to-purple-400 rounded-full"
                    animate={{ scaleX: [0, 1, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                  />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl max-w-md mx-auto"
              >
                <p className="text-white/90 text-lg mb-6">
                  Найдите противника с похожим рейтингом и сразитесь в эпичной битве!
                </p>

                <motion.button
                  onClick={handleSearch}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full py-4 bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 text-white rounded-xl font-bold text-xl shadow-2xl flex items-center justify-center gap-3 overflow-hidden relative"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <span className="text-2xl">⚔️</span>
                  <span>Найти противника</span>
                </motion.button>
              </motion.div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-red-500/20 backdrop-blur-xl rounded-xl p-4 border border-red-400/50 shadow-2xl max-w-md mx-auto"
                  >
                    <p className="text-red-200 font-medium">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Searching - ищем противника */}
          {gameState.status === 'searching' && (
            <motion.div
              key="searching"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center space-y-8"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="text-8xl"
              >
                🔍
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="space-y-4"
              >
                <h2 className="text-3xl font-black text-white">Поиск противника...</h2>
                <p className="text-white/80 text-lg">
                  Ищем игрока с рейтингом ±200 от вашего ({user?.rating || 1000})
                </p>
              </motion.div>

              <motion.button
                onClick={() => {
                  haptic.medium()
                  cancelSearch()
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-3 bg-white/10 backdrop-blur-xl text-white rounded-xl font-bold hover:bg-white/20 transition-all border border-white/20 shadow-lg"
              >
                Отменить поиск
              </motion.button>
            </motion.div>
          )}

          {/* Placement - расстановка кораблей */}
          {gameState.status === 'placement' && (
            <motion.div
              key="placement"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center"
              >
                <h2 className="text-4xl font-black text-transparent bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text">
                  Противник найден!
                </h2>
                <p className="text-white/80 text-lg mt-2">
                  Расставьте корабли за 30 секунд
                </p>
              </motion.div>

              {gameState.opponent && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl max-w-md mx-auto"
                >
                  <div className="flex items-center justify-center gap-4">
                    <motion.div
                      className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
                      whileHover={{ scale: 1.1 }}
                    >
                      {gameState.opponent.username?.[0]?.toUpperCase() || 'И'}
                    </motion.div>
                    <div className="text-left">
                      <p className="text-white font-bold text-lg">{gameState.opponent.username || 'Игрок'}</p>
                      <p className="text-white/70">Рейтинг: {gameState.opponent.rating || 1000}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              <ShipPlacement onPlacementComplete={handlePlacementComplete} />
            </motion.div>
          )}

          {/* Playing - игра идёт */}
          {gameState.status === 'playing' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              {/* Статус игры */}
              <motion.div
                animate={gameState.isMyTurn ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 2, repeat: gameState.isMyTurn ? Infinity : 0 }}
                className="text-center"
              >
                <h2 className="text-4xl font-black text-white mb-4">⚔️ БИТВА</h2>
                <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full backdrop-blur-xl border shadow-2xl ${
                  gameState.isMyTurn
                    ? 'bg-green-500/20 border-green-400/50 text-green-200'
                    : 'bg-orange-500/20 border-orange-400/50 text-orange-200'
                }`}>
                  <span className="text-2xl">
                    {gameState.isMyTurn ? '🎯' : '⏳'}
                  </span>
                  <span className="font-bold text-lg">
                    {gameState.isMyTurn ? 'Ваш ход' : 'Ход противника...'}
                  </span>
                </div>
              </motion.div>

              {/* Игровые доски */}
              <div className="flex flex-col lg:flex-row gap-8 justify-center items-center">
                {/* Своя доска */}
                <motion.div
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-4"
                >
                  <h3 className="text-center text-white font-bold text-xl">🚢 Ваша доска</h3>
                  <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20 shadow-2xl">
                    <div className="grid grid-cols-10 gap-1">
                      {gameState.playerBoard?.map((row, rowIndex) =>
                        row.map((cell, colIndex) => renderPlayerCell(cell, rowIndex, colIndex))
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Доска врага */}
                <motion.div
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-4"
                >
                  <h3 className="text-center text-white font-bold text-xl">🎯 Доска противника</h3>
                  <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20 shadow-2xl">
                    <div className="grid grid-cols-10 gap-1">
                      {gameState.enemyBoard?.map((row, rowIndex) =>
                        row.map((cell, colIndex) => renderEnemyCell(cell, rowIndex, colIndex))
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* История ходов */}
              {gameState.moves.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl max-w-2xl mx-auto"
                >
                  <h4 className="text-white font-bold text-lg mb-4 text-center">📜 История ходов</h4>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {gameState.moves.slice(-12).map((move, index) => (
                      <motion.span
                        key={index}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className={`text-sm px-3 py-2 rounded-xl font-medium shadow-lg ${
                          move.hit
                            ? 'bg-red-500/20 text-red-200 border border-red-400/30'
                            : 'bg-white/20 text-white/70 border border-white/30'
                        }`}
                      >
                        {move.player === 'me' ? '👤' : '👾'}
                        {formatCoord(move.row, move.col)}
                        {move.hit ? '💥' : '○'}
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Finished - игра окончена */}
          {gameState.status === 'finished' && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 100 }}
              className="text-center space-y-8"
            >
              <motion.div
                animate={gameState.winner === 'player' ? {
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0]
                } : {}}
                transition={{ duration: 1, repeat: gameState.winner === 'player' ? Infinity : 0 }}
                className={`text-8xl ${gameState.winner === 'player' ? 'text-yellow-400' : 'text-red-400'}`}
              >
                {gameState.winner === 'player' ? '🏆' : '💔'}
              </motion.div>

              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className={`text-5xl font-black ${
                  gameState.winner === 'player'
                    ? 'text-transparent bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text'
                    : 'text-transparent bg-gradient-to-r from-red-400 to-pink-500 bg-clip-text'
                }`}
              >
                {gameState.winner === 'player' ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ'}
              </motion.h2>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-4"
              >
                <motion.button
                  onClick={() => {
                    haptic.medium()
                    reset()
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full max-w-xs mx-auto py-4 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white rounded-xl font-bold text-xl shadow-2xl flex items-center justify-center gap-3 overflow-hidden relative"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <span className="text-2xl">🔄</span>
                  <span>Играть ещё</span>
                </motion.button>

                <Link
                  to="/"
                  onClick={() => haptic.light()}
                  className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors font-medium"
                >
                  <span>←</span>
                  <span>Главное меню</span>
                </Link>
              </motion.div>
            </motion.div>
          )}

          {/* Кнопка выхода (кроме finished) */}
          {gameState.status !== 'finished' && gameState.status !== 'idle' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-center mt-8"
            >
              <button
                onClick={() => {
                  haptic.medium()
                  leaveGame()
                }}
                className="px-6 py-3 bg-red-500/20 backdrop-blur-xl text-red-200 rounded-xl font-bold hover:bg-red-500/30 transition-all border border-red-400/30 shadow-lg"
              >
                🚪 Покинуть игру
              </button>
            </motion.div>
          )}

          {/* Назад в меню (для idle) */}
          {gameState.status === 'idle' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-center mt-8"
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
        </AnimatePresence>
      </div>
    </div>
  )
      </div>
    </div>
  )
}

export default PvP
