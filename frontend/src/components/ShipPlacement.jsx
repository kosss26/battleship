import { useState, useMemo } from 'react'
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

function ShipPlacement({ onPlacementComplete }) {
  const [board, setBoard] = useState(() => createEmptyBoard())
  const [selectedShip, setSelectedShip] = useState(null)
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
      return
    }

    if (isShipFullyPlaced(selectedShip)) {
      setError('Все корабли этого типа уже размещены')
      return
    }

    const shipConfig = SHIPS_CONFIG.find(s => s.id === selectedShip)
    if (!shipConfig) return

    if (!canPlaceShip(board, row, col, shipConfig.size, orientation)) {
      setError('Невозможно разместить корабль здесь')
      return
    }

    const newBoard = placeShip(board, row, col, shipConfig.size, orientation)
    setBoard(newBoard)
    setError(null)

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
    const randomBoard = generateRandomBoard()
    setBoard(randomBoard)
    setError(null)
    setSelectedShip(null)
  }

  const handleClear = () => {
    setBoard(createEmptyBoard())
    setError(null)
    setSelectedShip(SHIPS_CONFIG[0].id)
  }

  const handleComplete = () => {
    const validation = validateBoard(board)
    if (!validation.valid) {
      setError(validation.error || 'Расстановка кораблей неверна')
      return
    }
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

    let bgColor = 'bg-blue-200'
    if (isShip) {
      bgColor = 'bg-gray-600'
    } else if (isPreview) {
      bgColor = isValidPreview ? 'bg-green-300' : 'bg-red-300'
    }

    return (
      <button
        key={`${rowIndex}-${colIndex}`}
        onClick={() => handleCellClick(rowIndex, colIndex)}
        onMouseEnter={() => setHoveredCell({ row: rowIndex, col: colIndex })}
        onMouseLeave={() => setHoveredCell(null)}
        className={`
          w-10 h-10 border border-blue-300 rounded
          ${bgColor}
          ${!isShip && !isPreview ? 'hover:bg-blue-300' : ''}
          touch-manipulation transition-colors
        `}
      >
        {isShip ? '█' : ''}
      </button>
    )
  }

  const allShipsPlaced = SHIPS_CONFIG.every(ship => 
    (placedShips[ship.size] || 0) >= ship.count
  )

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-center">Расстановка флота</h2>
      
      {/* Выбор кораблей с индикаторами */}
      <div className="flex flex-wrap gap-2 justify-center mb-4">
        {SHIPS_CONFIG.map(ship => {
          const remaining = getRemainingCount(ship.id)
          const isFullyPlaced = remaining === 0
          
          return (
            <button
              key={ship.id}
              onClick={() => !isFullyPlaced && setSelectedShip(ship.id)}
              disabled={isFullyPlaced}
              className={`px-4 py-2 rounded relative ${
                selectedShip === ship.id 
                  ? 'bg-primary text-white' 
                  : isFullyPlaced
                    ? 'bg-green-200 text-green-800'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              {ship.name} ({ship.size})
              <span className={`ml-2 text-sm ${isFullyPlaced ? 'text-green-600' : ''}`}>
                {isFullyPlaced ? '✓' : `${remaining}/${ship.count}`}
              </span>
            </button>
          )
        })}
      </div>

      {/* Кнопка ориентации */}
      <button
        onClick={() => setOrientation(orientation === 'horizontal' ? 'vertical' : 'horizontal')}
        className="block mx-auto mb-4 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
      >
        🔄 {orientation === 'horizontal' ? 'Горизонтально' : 'Вертикально'}
      </button>

      {/* Доска */}
      <div className="grid grid-cols-10 gap-1 p-4 bg-blue-100 rounded-lg mx-auto max-w-fit">
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => renderCell(cell, rowIndex, colIndex))
        )}
      </div>

      {/* Сообщение об ошибке */}
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded text-center max-w-md mx-auto">
          {error}
        </div>
      )}

      {/* Кнопки управления */}
      <div className="flex gap-4 justify-center">
        <button
          onClick={handleRandomPlacement}
          className="px-6 py-2 bg-gray-300 rounded hover:bg-gray-400"
        >
          🎲 Случайная
        </button>
        <button
          onClick={handleClear}
          className="px-6 py-2 bg-gray-300 rounded hover:bg-gray-400"
        >
          🗑️ Очистить
        </button>
        <button
          onClick={handleComplete}
          disabled={!allShipsPlaced}
          className={`px-6 py-2 rounded ${
            allShipsPlaced 
              ? 'bg-primary text-white hover:bg-blue-600' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          ✅ Готово
        </button>
      </div>
    </div>
  )
}

export default ShipPlacement
