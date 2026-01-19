import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BOARD_SIZE,
  SHIPS_CONFIG,
  CELL_STATE,
  canPlaceShip,
  placeShip,
  generateRandomBoard,
  validateBoard,
  createEmptyBoard,
  countPlacedShips,
} from '../utils/gameLogic.js'
import { haptic } from '../utils/telegram.js'

function ShipPlacement({ onPlacementComplete }) {
  const [board, setBoard] = useState(() => createEmptyBoard())
  const [selectedShip, setSelectedShip] = useState(SHIPS_CONFIG[0].id)
  const [orientation, setOrientation] = useState('horizontal')
  const [error, setError] = useState(null)
  const [hoveredCell, setHoveredCell] = useState(null)

  // Подсчёт размещённых кораблей
  const placedShips = useMemo(() => countPlacedShips(board), [board])

  // Проверка, размещены ли все корабли данного типа
  const isShipFullyPlaced = (shipId) => {
    const ship = SHIPS_CONFIG.find(s => s.id === shipId)
    if (!ship) return false
    return (placedShips[ship.size] || 0) >= ship.count
  }

  // Получение оставшегося количества кораблей для размещения
  const getRemainingCount = (shipId) => {
    const ship = SHIPS_CONFIG.find(s => s.id === shipId)
    if (!ship) return 0
    return ship.count - (placedShips[ship.size] || 0)
  }

  // Проверка, можно ли разместить корабль в данной позиции (для подсветки)
  const canPlaceAtCell = (row, col) => {
    if (!selectedShip) return false
    const shipConfig = SHIPS_CONFIG.find(s => s.id === selectedShip)
    if (!shipConfig) return false
    if (isShipFullyPlaced(selectedShip)) return false
    return canPlaceShip(board, row, col, shipConfig.size, orientation)
  }

  // Получение клеток, которые займёт корабль
  const getShipCells = (row, col) => {
    if (!selectedShip) return []
    const shipConfig = SHIPS_CONFIG.find(s => s.id === selectedShip)
    if (!shipConfig) return []
    
    const cells = []
    for (let i = 0; i < shipConfig.size; i++) {
      if (orientation === 'horizontal') {
        cells.push({ row, col: col + i })
      } else {
        cells.push({ row: row + i, col })
      }
    }
    return cells
  }

  const handleCellClick = (row, col) => {
    if (!selectedShip) {
      setError('Выберите корабль для размещения')
      haptic.warning()
      return
    }

    if (isShipFullyPlaced(selectedShip)) {
      setError('Все корабли этого типа уже размещены')
      haptic.warning()
      return
    }

    const shipConfig = SHIPS_CONFIG.find(s => s.id === selectedShip)
    if (!shipConfig) return

    if (!canPlaceShip(board, row, col, shipConfig.size, orientation)) {
      setError('Невозможно разместить корабль здесь')
      haptic.error()
      return
    }

    const newBoard = placeShip(board, row, col, shipConfig.size, orientation)
    setBoard(newBoard)
    setError(null)
    haptic.medium()

    // Автоматически снимаем выбор, если все корабли этого типа размещены
    const newPlaced = countPlacedShips(newBoard)
    if ((newPlaced[shipConfig.size] || 0) >= shipConfig.count) {
      // Переключаемся на следующий неразмещённый тип
      const nextShip = SHIPS_CONFIG.find(s => 
        (newPlaced[s.size] || 0) < s.count
      )
      setSelectedShip(nextShip?.id || null)
    }
  }

  const handleRandomPlacement = () => {
    haptic.medium()
    const randomBoard = generateRandomBoard()
    setBoard(randomBoard)
    setError(null)
    setSelectedShip(null)
  }

  const handleClear = () => {
    haptic.light()
    setBoard(createEmptyBoard())
    setError(null)
    setSelectedShip(SHIPS_CONFIG[0].id)
  }

  const handleComplete = () => {
    const validation = validateBoard(board)
    if (!validation.valid) {
      setError(validation.error || 'Расстановка кораблей неверна')
      haptic.error()
      return
    }
    haptic.success()
    onPlacementComplete(board)
  }

  // Визуализация клетки с подсветкой
  const renderCell = (cell, rowIndex, colIndex) => {
    const isShip = cell === CELL_STATE.SHIP
    const isHovered = hoveredCell && hoveredCell.row === rowIndex && hoveredCell.col === colIndex
    
    // Проверяем, входит ли клетка в предпросмотр размещаемого корабля
    let isPreview = false
    let isValidPreview = false
    if (hoveredCell && selectedShip && !isShipFullyPlaced(selectedShip)) {
      const previewCells = getShipCells(hoveredCell.row, hoveredCell.col)
      isPreview = previewCells.some(c => c.row === rowIndex && c.col === colIndex)
      isValidPreview = isPreview && canPlaceAtCell(hoveredCell.row, hoveredCell.col)
    }

    let bgClass = 'bg-white/5'
    let borderClass = 'border-white/10'
    let content = ''

    if (isShip) {
      bgClass = 'bg-gray-600/80 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]'
      borderClass = 'border-gray-500/50'
      content = <div className="w-full h-full bg-gradient-to-br from-gray-500 to-gray-700 opacity-80" />
    } else if (isPreview) {
      bgClass = isValidPreview ? 'bg-green-500/40' : 'bg-red-500/40'
      borderClass = isValidPreview ? 'border-green-400/50' : 'border-red-400/50'
    } else if (isHovered) {
        bgClass = 'bg-white/10'
    }

    return (
      <motion.button
        key={`${rowIndex}-${colIndex}`}
        onClick={() => handleCellClick(rowIndex, colIndex)}
        onMouseEnter={() => setHoveredCell({ row: rowIndex, col: colIndex })}
        onMouseLeave={() => setHoveredCell(null)}
        whileTap={{ scale: 0.95 }}
        className={`relative w-8 h-8 md:w-10 md:h-10 border ${borderClass} ${bgClass} rounded flex items-center justify-center transition-colors duration-200 select-none overflow-hidden`}
      >
        {/* Сетка для текстуры */}
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white to-transparent pointer-events-none" />
        {content}
      </motion.button>
    )
  }

  const allShipsPlaced = SHIPS_CONFIG.every(ship => 
    (placedShips[ship.size] || 0) >= ship.count
  )

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2 tracking-wide drop-shadow-md">РАССТАНОВКА</h2>
        <p className="text-blue-200/70 text-sm">Подготовьте свой флот к бою</p>
      </div>
      
      <div className="flex flex-col-reverse lg:flex-row gap-8 w-full justify-center items-start">
        {/* Панель инструментов */}
        <div className="w-full lg:w-64 space-y-4">
            {/* Выбор кораблей */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-xl">
                <h3 className="text-white/70 font-bold mb-3 border-b border-white/10 pb-2 text-sm">ВЫБОР КОРАБЛЕЙ</h3>
                <div className="space-y-2">
                    {SHIPS_CONFIG.map(ship => {
                        const remaining = getRemainingCount(ship.id)
                        const isFullyPlaced = remaining === 0
                        const isSelected = selectedShip === ship.id
                        
                        return (
                            <motion.button
                                key={ship.id}
                                onClick={() => {
                                    if (!isFullyPlaced) {
                                        setSelectedShip(ship.id)
                                        haptic.selectionChanged()
                                    }
                                }}
                                disabled={isFullyPlaced}
                                whileHover={!isFullyPlaced ? { scale: 1.02, x: 5 } : {}}
                                whileTap={!isFullyPlaced ? { scale: 0.98 } : {}}
                                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
                                    isSelected 
                                    ? 'bg-blue-500/20 border-blue-400/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                                    : isFullyPlaced
                                        ? 'bg-white/5 border-transparent opacity-50 cursor-not-allowed'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                }`}
                            >
                                <div className="flex flex-col items-start">
                                    <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-white/70'}`}>
                                        {ship.name}
                                    </span>
                                    <div className="flex gap-1 mt-1">
                                        {Array(ship.size).fill(0).map((_, i) => (
                                            <div key={i} className={`w-2 h-2 rounded-sm ${isFullyPlaced ? 'bg-green-500/50' : 'bg-gray-400/50'}`} />
                                        ))}
                                    </div>
                                </div>
                                <div className={`text-sm font-mono font-bold ${isFullyPlaced ? 'text-green-400' : 'text-blue-300'}`}>
                                    {isFullyPlaced ? '✓' : `${remaining}/${ship.count}`}
                                </div>
                            </motion.button>
                        )
                    })}
                </div>
            </div>

            {/* Управление */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-xl space-y-3">
                <button
                    onClick={() => {
                        setOrientation(orientation === 'horizontal' ? 'vertical' : 'horizontal')
                        haptic.medium()
                    }}
                    className="w-full py-3 bg-white/10 rounded-xl font-bold text-white hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                >
                    <span>🔄</span>
                    {orientation === 'horizontal' ? 'Горизонтально' : 'Вертикально'}
                </button>
                
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={handleRandomPlacement}
                        className="py-3 bg-white/10 rounded-xl font-bold text-white/80 hover:bg-white/20 transition-colors text-sm"
                    >
                        🎲 Случайная
                    </button>
                    <button
                        onClick={handleClear}
                        className="py-3 bg-white/10 rounded-xl font-bold text-red-300/80 hover:bg-red-500/20 transition-colors text-sm"
                    >
                        🗑️ Очистить
                    </button>
                </div>
            </div>
        </div>

        {/* Доска */}
        <div className="relative p-3 bg-gradient-to-b from-blue-900/40 to-slate-900/40 backdrop-blur-md rounded-xl border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
            {/* Декоративные уголки */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-400 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-400 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-400 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-400 rounded-br-lg" />

            <div className="grid grid-cols-10 gap-px bg-blue-500/10 border border-blue-500/10 rounded overflow-hidden">
                {board.map((row, rowIndex) =>
                    row.map((cell, colIndex) => renderCell(cell, rowIndex, colIndex))
                )}
            </div>
        </div>
      </div>

      {/* Кнопка подтверждения */}
      <div className="fixed bottom-6 left-0 right-0 px-4 z-50 flex justify-center pointer-events-none">
        <AnimatePresence>
            {allShipsPlaced && (
                <motion.button
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    onClick={handleComplete}
                    className="pointer-events-auto px-12 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-bold text-xl shadow-[0_0_20px_rgba(34,197,94,0.5)] hover:shadow-[0_0_30px_rgba(34,197,94,0.7)] transition-all transform hover:scale-105 active:scale-95"
                >
                    В БОЙ! 🚀
                </motion.button>
            )}
        </AnimatePresence>
      </div>

      {/* Сообщение об ошибке */}
      <AnimatePresence>
        {error && (
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="fixed top-20 left-0 right-0 flex justify-center pointer-events-none z-50"
            >
                <div className="bg-red-500/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-xl border border-red-400 font-bold">
                    {error}
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ShipPlacement
