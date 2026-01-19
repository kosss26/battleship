/**
 * Утилиты для работы с игровой логикой Battleship
 */

export const BOARD_SIZE = 10

// Конфигурация кораблей согласно ТЗ
export const SHIPS_CONFIG = [
  { id: 1, size: 4, count: 1, name: 'Линкор' },
  { id: 2, size: 3, count: 2, name: 'Крейсер' },
  { id: 3, size: 2, count: 3, name: 'Эсминец' },
  { id: 4, size: 1, count: 4, name: 'Катер' },
]

// Состояния клетки доски
export const CELL_STATE = {
  EMPTY: 0,      // Пустая клетка (вода)
  SHIP: 1,       // Корабль
  MISS: 2,       // Промах
  HIT: 3,        // Попадание
  SUNK: 4,       // Потопленный корабль
}

/**
 * Создает пустую доску
 */
export const createEmptyBoard = () => {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(CELL_STATE.EMPTY))
}

/**
 * Проверяет, можно ли разместить корабль на доске
 * Упрощённая и более надёжная версия
 */
export const canPlaceShip = (board, row, col, size, orientation) => {
  // Проверка границ доски
  if (orientation === 'horizontal') {
    if (col + size > BOARD_SIZE) return false
  } else {
    if (row + size > BOARD_SIZE) return false
  }

  // Получаем все клетки корабля
  const shipCells = []
  for (let i = 0; i < size; i++) {
    if (orientation === 'horizontal') {
      shipCells.push({ row, col: col + i })
    } else {
      shipCells.push({ row: row + i, col })
    }
  }

  // Проверяем каждую клетку корабля и её соседей
  for (const cell of shipCells) {
    // Проверяем саму клетку
    if (board[cell.row][cell.col] !== CELL_STATE.EMPTY) {
      return false
    }

    // Проверяем все 8 соседних клеток (включая диагональ)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        
        const checkRow = cell.row + dr
        const checkCol = cell.col + dc
        
        // Пропускаем если за границами
        if (checkRow < 0 || checkRow >= BOARD_SIZE || checkCol < 0 || checkCol >= BOARD_SIZE) {
          continue
        }
        
        // Пропускаем если это часть того же корабля
        const isPartOfShip = shipCells.some(sc => sc.row === checkRow && sc.col === checkCol)
        if (isPartOfShip) continue
        
        // Проверяем наличие другого корабля
        if (board[checkRow][checkCol] === CELL_STATE.SHIP) {
          return false
        }
      }
    }
  }

  return true
}

/**
 * Размещает корабль на доске
 */
export const placeShip = (board, row, col, size, orientation) => {
  const newBoard = board.map(r => [...r])

  for (let i = 0; i < size; i++) {
    if (orientation === 'horizontal') {
      newBoard[row][col + i] = CELL_STATE.SHIP
    } else {
      newBoard[row + i][col] = CELL_STATE.SHIP
    }
  }

  return newBoard
}

/**
 * Случайная расстановка кораблей
 */
export const generateRandomBoard = () => {
  let board = createEmptyBoard()
  
  // Сортируем корабли по размеру (сначала большие)
  const ships = []
  for (const shipConfig of SHIPS_CONFIG) {
    for (let i = 0; i < shipConfig.count; i++) {
      ships.push({ ...shipConfig, instanceId: i })
    }
  }
  ships.sort((a, b) => b.size - a.size)

  for (const ship of ships) {
    let placed = false
    let attempts = 0
    const maxAttempts = 500

    while (!placed && attempts < maxAttempts) {
      const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical'
      const row = Math.floor(Math.random() * BOARD_SIZE)
      const col = Math.floor(Math.random() * BOARD_SIZE)

      if (canPlaceShip(board, row, col, ship.size, orientation)) {
        board = placeShip(board, row, col, ship.size, orientation)
        placed = true
      }
      attempts++
    }

    if (!placed) {
      // Если не удалось разместить, начинаем заново
      return generateRandomBoard()
    }
  }

  return board
}

/**
 * Подсчитывает размещённые корабли на доске
 */
export const countPlacedShips = (board) => {
  const foundShips = {}
  const visited = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false))

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === CELL_STATE.SHIP && !visited[row][col]) {
        visited[row][col] = true
        
        // Определяем размер корабля
        let horizontalSize = 1
        for (let c = col + 1; c < BOARD_SIZE && board[row][c] === CELL_STATE.SHIP && !visited[row][c]; c++) {
          visited[row][c] = true
          horizontalSize++
        }

        let verticalSize = 1
        for (let r = row + 1; r < BOARD_SIZE && board[r][col] === CELL_STATE.SHIP && !visited[r][col]; r++) {
          visited[r][col] = true
          verticalSize++
        }

        const size = Math.max(horizontalSize, verticalSize)
        foundShips[size] = (foundShips[size] || 0) + 1
      }
    }
  }

  return foundShips
}

/**
 * Проверяет, валидна ли расстановка кораблей
 */
export const validateBoard = (board) => {
  const requiredShips = {}
  for (const ship of SHIPS_CONFIG) {
    requiredShips[ship.size] = ship.count
  }

  const foundShips = countPlacedShips(board)

  // Проверяем соответствие требуемому количеству кораблей
  for (const [size, count] of Object.entries(requiredShips)) {
    if ((foundShips[parseInt(size)] || 0) !== count) {
      const shipName = SHIPS_CONFIG.find(s => s.size === parseInt(size))?.name || `размера ${size}`
      const found = foundShips[parseInt(size)] || 0
      return {
        valid: false,
        error: `${shipName}: ${found}/${count}`,
      }
    }
  }

  return { valid: true, ships: foundShips }
}

/**
 * Выполняет выстрел по доске
 */
export const makeShot = (board, row, col) => {
  const newBoard = board.map(r => [...r])

  if (newBoard[row][col] === CELL_STATE.SHIP) {
    newBoard[row][col] = CELL_STATE.HIT

    const sunk = isShipSunk(newBoard, row, col)
    if (sunk) {
      markShipAsSunk(newBoard, row, col)
    }

    return { hit: true, sunk, board: newBoard }
  } else if (newBoard[row][col] === CELL_STATE.EMPTY) {
    newBoard[row][col] = CELL_STATE.MISS
    return { hit: false, sunk: false, board: newBoard }
  }

  return { hit: false, sunk: false, board: newBoard, alreadyShot: true }
}

/**
 * Проверяет, потоплен ли корабль
 */
const isShipSunk = (board, row, col) => {
  const visited = new Set()
  const queue = [[row, col]]
  visited.add(`${row},${col}`)

  while (queue.length > 0) {
    const [r, c] = queue.shift()

    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]]
    for (const [dr, dc] of directions) {
      const newRow = r + dr
      const newCol = c + dc
      const key = `${newRow},${newCol}`

      if (
        newRow >= 0 && newRow < BOARD_SIZE &&
        newCol >= 0 && newCol < BOARD_SIZE &&
        !visited.has(key)
      ) {
        if (board[newRow][newCol] === CELL_STATE.SHIP) {
          return false // Есть непотопленная часть
        }
        if (board[newRow][newCol] === CELL_STATE.HIT) {
          visited.add(key)
          queue.push([newRow, newCol])
        }
      }
    }
  }

  return true
}

/**
 * Помечает весь корабль как потопленный
 */
const markShipAsSunk = (board, row, col) => {
  const queue = [[row, col]]
  const visited = new Set()

  while (queue.length > 0) {
    const [r, c] = queue.shift()
    const key = `${r},${c}`

    if (visited.has(key)) continue
    visited.add(key)

    board[r][c] = CELL_STATE.SUNK

    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]]
    for (const [dr, dc] of directions) {
      const newRow = r + dr
      const newCol = c + dc

      if (
        newRow >= 0 && newRow < BOARD_SIZE &&
        newCol >= 0 && newCol < BOARD_SIZE &&
        !visited.has(`${newRow},${newCol}`) &&
        board[newRow][newCol] === CELL_STATE.HIT
      ) {
        queue.push([newRow, newCol])
      }
    }
  }
}

/**
 * Проверяет, закончилась ли игра
 */
export const isGameOver = (board) => {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === CELL_STATE.SHIP) {
        return false
      }
    }
  }
  return true
}
