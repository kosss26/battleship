import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CELL_STATE, makeShot, isGameOver, generateRandomBoard, BOARD_SIZE } from '../utils/gameLogic.js'
import { BattleshipAI } from '../utils/ai.js'
import { haptic } from '../utils/telegram.js'

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
      return newHistory.slice(-10)
    })
  }

  // Обработка хода игрока
  const handlePlayerShot = async (row, col) => {
    if (currentTurn !== 'player' || gameStatus !== 'playing' || isProcessing) return
    if (enemyBattleBoard[row][col] !== CELL_STATE.EMPTY) return

    setIsProcessing(true)
    haptic.light()

    // Анимация выстрела (задержка для реализма)
    await new Promise(resolve => setTimeout(resolve, 300))

    const result = makeShot(aiBoard, row, col)
    const newEnemyBoard = enemyBattleBoard.map(r => [...r])
    newEnemyBoard[row][col] = result.hit ? CELL_STATE.HIT : CELL_STATE.MISS

    setEnemyBattleBoard(newEnemyBoard)
    setAiBoard(result.board)
    addMoveToHistory('player', row, col, result.hit, result.sunk)

    if (result.hit) {
        haptic.success()
    } else {
        haptic.soft()
    }

    if (isGameOver(result.board)) {
      setGameStatus('playerWon')
      haptic.success()
      onGameEnd({ winner: 'player', playerBoard: playerBattleBoard, enemyBoard: newEnemyBoard })
      setIsProcessing(false)
      return
    }

    if (result.hit) {
      setIsProcessing(false)
      return
    }

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
    
    // Небольшая задержка перед ходом AI
    await new Promise(resolve => setTimeout(resolve, 500))

    const result = makeShot(playerBattleBoard, move.row, move.col)

    const newPlayerBoard = playerBattleBoard.map(r => [...r])
    if (result.hit) {
      newPlayerBoard[move.row][move.col] = result.sunk ? CELL_STATE.SUNK : CELL_STATE.HIT
      haptic.warning()
    } else {
      newPlayerBoard[move.row][move.col] = CELL_STATE.MISS
    }

    setPlayerBattleBoard(newPlayerBoard)
    ai.processShotResult(move.row, move.col, result.hit, result.sunk)
    addMoveToHistory('ai', move.row, move.col, result.hit, result.sunk)

    if (isGameOver(newPlayerBoard)) {
      setGameStatus('playerLost')
      haptic.error()
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

  // Визуализация клетки
  const Cell = ({ type, cellState, onClick, disabled, isPlayerBoard }) => {
    let content = ''
    let bgClass = 'bg-white/5'
    let borderClass = 'border-white/10'
    let animate = {}

    switch (cellState) {
        case CELL_STATE.SHIP:
            if (isPlayerBoard) {
                bgClass = 'bg-gray-600/80 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]'
                borderClass = 'border-gray-500/50'
                content = <div className="w-full h-full bg-gradient-to-br from-gray-500 to-gray-700 opacity-80" />
            }
            break
        case CELL_STATE.HIT:
            bgClass = 'bg-red-500/20'
            borderClass = 'border-red-500/50'
            content = (
                <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    className="text-red-500 font-bold text-lg drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]"
                >
                    💥
                </motion.div>
            )
            break
        case CELL_STATE.MISS:
            bgClass = 'bg-blue-500/10'
            borderClass = 'border-blue-500/20'
            content = (
                <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    className="w-2 h-2 rounded-full bg-blue-400/50 shadow-[0_0_5px_rgba(96,165,250,0.8)]" 
                />
            )
            break
        case CELL_STATE.SUNK:
            bgClass = 'bg-red-900/40'
            borderClass = 'border-red-700/60'
            content = (
                <motion.div 
                    initial={{ scale: 0, rotate: 180 }} 
                    animate={{ scale: 1, rotate: 0 }} 
                    transition={{ type: 'spring' }}
                    className="text-2xl drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]"
                >
                    ☠️
                </motion.div>
            )
            break
        case CELL_STATE.EMPTY:
        default:
            if (!disabled && !isPlayerBoard) {
                bgClass = 'hover:bg-blue-400/20 cursor-pointer active:bg-blue-400/30'
            }
            break
    }

    return (
      <motion.div
        onClick={onClick}
        className={`relative w-8 h-8 md:w-10 md:h-10 border ${borderClass} ${bgClass} rounded flex items-center justify-center transition-colors duration-200 select-none overflow-hidden`}
        whileHover={!disabled && !isPlayerBoard && cellState === CELL_STATE.EMPTY ? { scale: 1.05 } : {}}
        whileTap={!disabled && !isPlayerBoard && cellState === CELL_STATE.EMPTY ? { scale: 0.95 } : {}}
      >
        {/* Сетка для текстуры */}
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white to-transparent pointer-events-none" />
        {content}
      </motion.div>
    )
  }

  const formatCoord = (row, col) => {
    const letters = 'ABCDEFGHIJ' // Используем латиницу для стиля
    return `${letters[col]}${row + 1}`
  }

  return (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto space-y-6">
      
      {/* Статус бар */}
      <div className="w-full flex items-center justify-between bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl">
        <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${currentTurn === 'player' ? 'bg-green-500 shadow-[0_0_10px_#22c55e] animate-pulse' : 'bg-gray-500'}`} />
            <span className={`font-bold text-lg ${currentTurn === 'player' ? 'text-green-400' : 'text-gray-400'}`}>
                ВАШ ХОД
            </span>
        </div>
        
        <div className="text-white/50 font-mono text-sm hidden md:block">
            BATTLE PHASE
        </div>

        <div className="flex items-center gap-3">
            <span className={`font-bold text-lg ${currentTurn === 'ai' ? 'text-red-400' : 'text-gray-400'}`}>
                ХОД AI
            </span>
            <div className={`w-3 h-3 rounded-full ${currentTurn === 'ai' ? 'bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse' : 'bg-gray-500'}`} />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 w-full justify-center items-start">
        {/* Доска игрока */}
        <div className="flex flex-col items-center space-y-3 w-full lg:w-auto">
            <h3 className="text-blue-300 font-bold text-xl tracking-wider drop-shadow-md">ВАШ ФЛОТ</h3>
            <div className="relative p-3 bg-gradient-to-b from-blue-900/40 to-slate-900/40 backdrop-blur-md rounded-xl border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                {/* Декоративные уголки */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-400 rounded-br-lg" />

                <div className="grid grid-cols-10 gap-px bg-blue-500/10 border border-blue-500/10 rounded overflow-hidden">
                    {playerBattleBoard.map((row, rowIndex) =>
                        row.map((cell, colIndex) => (
                            <Cell 
                                key={`player-${rowIndex}-${colIndex}`} 
                                cellState={cell} 
                                isPlayerBoard={true}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>

        {/* Инфо панель (по центру на десктопе, скрыта на мобильных если не нужна) */}
        <div className="hidden lg:flex flex-col w-64 space-y-4 h-full">
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 flex-1">
                <h4 className="text-white/70 font-bold mb-3 border-b border-white/10 pb-2">RADAR LOG</h4>
                <div className="space-y-2 overflow-y-auto max-h-[400px] pr-2 scrollbar-thin scrollbar-thumb-white/20">
                    <AnimatePresence>
                        {moveHistory.slice().reverse().map((move) => (
                            <motion.div
                                key={move.time}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0 }}
                                className={`flex items-center justify-between text-xs p-2 rounded ${
                                    move.player === 'player' ? 'bg-green-500/10' : 'bg-red-500/10'
                                }`}
                            >
                                <span className={move.player === 'player' ? 'text-green-400' : 'text-red-400'}>
                                    {move.player === 'player' ? 'YOU' : 'CPU'}
                                </span>
                                <span className="font-mono text-white/50">{formatCoord(move.row, move.col)}</span>
                                <span className={move.hit ? (move.sunk ? 'text-red-500 font-bold' : 'text-orange-400') : 'text-blue-300/50'}>
                                    {move.hit ? (move.sunk ? 'DESTROYED' : 'HIT') : 'MISS'}
                                </span>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </div>

        {/* Доска противника */}
        <div className="flex flex-col items-center space-y-3 w-full lg:w-auto">
            <h3 className="text-red-300 font-bold text-xl tracking-wider drop-shadow-md">ПРОТИВНИК</h3>
            <div className="relative p-3 bg-gradient-to-b from-red-900/40 to-slate-900/40 backdrop-blur-md rounded-xl border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                {/* Декоративные уголки */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-red-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-red-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-red-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-red-400 rounded-br-lg" />

                <div className="grid grid-cols-10 gap-px bg-red-500/10 border border-red-500/10 rounded overflow-hidden">
                    {enemyBattleBoard.map((row, rowIndex) =>
                        row.map((cell, colIndex) => (
                            <Cell 
                                key={`enemy-${rowIndex}-${colIndex}`} 
                                cellState={cell} 
                                isPlayerBoard={false}
                                disabled={currentTurn !== 'player' || gameStatus !== 'playing' || isProcessing}
                                onClick={() => handlePlayerShot(rowIndex, colIndex)}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* Мобильный лог (последний ход) */}
      <div className="lg:hidden w-full bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10 text-center">
        {moveHistory.length > 0 ? (
            <div className="flex items-center justify-center gap-2 text-sm">
                <span className={moveHistory[moveHistory.length - 1].player === 'player' ? 'text-green-400' : 'text-red-400'}>
                    {moveHistory[moveHistory.length - 1].player === 'player' ? 'YOU' : 'CPU'}
                </span>
                <span className="text-white/30">target</span>
                <span className="font-mono text-white font-bold">{formatCoord(moveHistory[moveHistory.length - 1].row, moveHistory[moveHistory.length - 1].col)}</span>
                <span className="text-white/30">→</span>
                <span className={moveHistory[moveHistory.length - 1].hit ? 'text-red-400 font-bold' : 'text-blue-300'}>
                    {moveHistory[moveHistory.length - 1].hit ? (moveHistory[moveHistory.length - 1].sunk ? 'DESTROYED' : 'HIT') : 'MISS'}
                </span>
            </div>
        ) : (
            <span className="text-white/30 text-sm">Ожидание первого выстрела...</span>
        )}
      </div>
    </div>
  )
}

export default BattlePhase
