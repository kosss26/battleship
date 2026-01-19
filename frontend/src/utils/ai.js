/**
 * AI логика для игры в Морской Бой
 * Согласно ТЗ: Easy (случайные ходы), Medium (умная логика), Hard (продвинутая)
 */

import { BOARD_SIZE, CELL_STATE } from './gameLogic.js'

/**
 * AI класс для игры
 */
export class BattleshipAI {
  constructor(difficulty = 'easy') {
    this.difficulty = difficulty
    this.targetQueue = []
    this.hitCells = []
    this.shotHistory = []
    this.lastHitDirection = null
    this.probabilityMap = null // Для Hard AI
    this.remainingShips = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1] // Размеры оставшихся кораблей
  }

  /**
   * Получает все доступные для выстрела клетки
   */
  getAvailableCells() {
    const available = []
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const hasShot = this.shotHistory.some(shot => shot.row === r && shot.col === c)
        if (!hasShot) {
          available.push({ row: r, col: c })
        }
      }
    }
    return available
  }

  /**
   * Получает следующий ход от AI
   */
  getNextMove(enemyBoard) {
    const availableCells = this.getAvailableCells()
    
    if (availableCells.length === 0) {
      return { row: 0, col: 0 }
    }

    if (this.difficulty === 'easy') {
      return this.getEasyMove(availableCells)
    } else if (this.difficulty === 'medium') {
      return this.getMediumMove(availableCells)
    } else if (this.difficulty === 'hard') {
      return this.getHardMove(availableCells, enemyBoard)
    }

    return this.getEasyMove(availableCells)
  }

  /**
   * Easy AI: случайные ходы
   */
  getEasyMove(availableCells) {
    const randomIndex = Math.floor(Math.random() * availableCells.length)
    return availableCells[randomIndex]
  }

  /**
   * Medium AI: умная логика поиска
   */
  getMediumMove(availableCells) {
    // Если есть очередь целей, стреляем по ним
    while (this.targetQueue.length > 0) {
      const target = this.targetQueue.shift()
      const isAvailable = availableCells.some(
        cell => cell.row === target.row && cell.col === target.col
      )
      if (isAvailable) {
        return target
      }
    }

    // Если есть попадания без потопления, определяем направление
    if (this.hitCells.length >= 2) {
      const direction = this.detectShipDirection()
      if (direction) {
        const nextTarget = this.getNextInDirection(direction, availableCells)
        if (nextTarget) {
          return nextTarget
        }
      }
    }

    // Иначе стреляем случайно с шахматным паттерном
    const checkerboardCells = availableCells.filter(
      cell => (cell.row + cell.col) % 2 === 0
    )
    
    if (checkerboardCells.length > 0) {
      const randomIndex = Math.floor(Math.random() * checkerboardCells.length)
      return checkerboardCells[randomIndex]
    }

    const randomIndex = Math.floor(Math.random() * availableCells.length)
    return availableCells[randomIndex]
  }

  /**
   * Hard AI: продвинутая логика с картой вероятностей
   */
  getHardMove(availableCells, enemyBoard) {
    // Если есть попадания без потопления
    if (this.hitCells.length > 0) {
      const targetMove = this.getTargetModeMove(availableCells)
      if (targetMove) {
        return targetMove
      }
    }

    // Строим карту вероятностей
    this.buildProbabilityMap(enemyBoard)

    // Находим клетку с максимальной вероятностью
    let maxProb = 0
    let bestCells = []

    for (const cell of availableCells) {
      const prob = this.probabilityMap[cell.row][cell.col]
      if (prob > maxProb) {
        maxProb = prob
        bestCells = [cell]
      } else if (prob === maxProb) {
        bestCells.push(cell)
      }
    }

    // Выбираем случайную из лучших
    if (bestCells.length > 0) {
      return bestCells[Math.floor(Math.random() * bestCells.length)]
    }

    return availableCells[Math.floor(Math.random() * availableCells.length)]
  }

  /**
   * Режим преследования для Hard AI
   */
  getTargetModeMove(availableCells) {
    // Определяем направление если есть 2+ попадания
    if (this.hitCells.length >= 2) {
      const direction = this.detectShipDirection()
      if (direction) {
        const nextTarget = this.getNextInDirection(direction, availableCells)
        if (nextTarget) {
          return nextTarget
        }
      }
    }

    // Стреляем вокруг последнего попадания
    const lastHit = this.hitCells[this.hitCells.length - 1]
    const directions = [
      { row: lastHit.row - 1, col: lastHit.col },
      { row: lastHit.row + 1, col: lastHit.col },
      { row: lastHit.row, col: lastHit.col - 1 },
      { row: lastHit.row, col: lastHit.col + 1 },
    ]

    // Приоритет: сначала горизонтальные, потом вертикальные (или наоборот)
    const prioritized = this.prioritizeDirections(directions)

    for (const dir of prioritized) {
      const isAvailable = availableCells.some(
        cell => cell.row === dir.row && cell.col === dir.col
      )
      if (isAvailable) {
        return dir
      }
    }

    return null
  }

  /**
   * Приоритизация направлений на основе статистики
   */
  prioritizeDirections(directions) {
    // Случайно перемешиваем для разнообразия
    return directions.sort(() => Math.random() - 0.5)
  }

  /**
   * Строит карту вероятностей для Hard AI
   */
  buildProbabilityMap(enemyBoard) {
    this.probabilityMap = Array(BOARD_SIZE).fill(null).map(() => 
      Array(BOARD_SIZE).fill(0)
    )

    // Для каждого оставшегося корабля
    for (const shipSize of this.remainingShips) {
      // Горизонтальное размещение
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col <= BOARD_SIZE - shipSize; col++) {
          if (this.canPlaceShipOnMap(row, col, shipSize, 'horizontal')) {
            for (let i = 0; i < shipSize; i++) {
              this.probabilityMap[row][col + i]++
            }
          }
        }
      }

      // Вертикальное размещение
      for (let row = 0; row <= BOARD_SIZE - shipSize; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          if (this.canPlaceShipOnMap(row, col, shipSize, 'vertical')) {
            for (let i = 0; i < shipSize; i++) {
              this.probabilityMap[row + i][col]++
            }
          }
        }
      }
    }

    // Увеличиваем вероятность рядом с попаданиями
    for (const hit of this.hitCells) {
      const neighbors = [
        { row: hit.row - 1, col: hit.col },
        { row: hit.row + 1, col: hit.col },
        { row: hit.row, col: hit.col - 1 },
        { row: hit.row, col: hit.col + 1 },
      ]

      for (const n of neighbors) {
        if (n.row >= 0 && n.row < BOARD_SIZE && n.col >= 0 && n.col < BOARD_SIZE) {
          const hasShot = this.shotHistory.some(s => s.row === n.row && s.col === n.col)
          if (!hasShot) {
            this.probabilityMap[n.row][n.col] *= 5 // Увеличиваем приоритет
          }
        }
      }
    }
  }

  /**
   * Проверяет можно ли разместить корабль на карте вероятностей
   */
  canPlaceShipOnMap(row, col, size, orientation) {
    for (let i = 0; i < size; i++) {
      const r = orientation === 'vertical' ? row + i : row
      const c = orientation === 'horizontal' ? col + i : col

      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
        return false
      }

      // Проверяем, что клетка не была поражена промахом
      const shot = this.shotHistory.find(s => s.row === r && s.col === c)
      if (shot && !this.hitCells.some(h => h.row === r && h.col === c)) {
        return false // Был промах
      }
    }

    return true
  }

  /**
   * Определяет направление корабля по попаданиям
   */
  detectShipDirection() {
    if (this.hitCells.length < 2) return null

    const firstHit = this.hitCells[0]
    const secondHit = this.hitCells[1]

    if (firstHit.row === secondHit.row) {
      return 'horizontal'
    } else if (firstHit.col === secondHit.col) {
      return 'vertical'
    }

    return null
  }

  /**
   * Получает следующую цель по направлению
   */
  getNextInDirection(direction, availableCells) {
    const sortedHits = [...this.hitCells].sort((a, b) => {
      if (direction === 'horizontal') {
        return a.col - b.col
      }
      return a.row - b.row
    })

    const first = sortedHits[0]
    const last = sortedHits[sortedHits.length - 1]

    let targets = []
    if (direction === 'horizontal') {
      targets = [
        { row: first.row, col: first.col - 1 },
        { row: last.row, col: last.col + 1 },
      ]
    } else {
      targets = [
        { row: first.row - 1, col: first.col },
        { row: last.row + 1, col: last.col },
      ]
    }

    for (const target of targets) {
      const isAvailable = availableCells.some(
        cell => cell.row === target.row && cell.col === target.col
      )
      if (isAvailable) {
        return target
      }
    }

    return null
  }

  /**
   * Обрабатывает результат выстрела
   */
  processShotResult(row, col, hit, sunk) {
    this.shotHistory.push({ row, col })

    if (hit) {
      this.hitCells.push({ row, col })

      if (!sunk) {
        // Добавляем соседние клетки в очередь для Medium AI
        if (this.difficulty === 'medium') {
          const directions = [
            { row: row - 1, col },
            { row: row + 1, col },
            { row, col: col - 1 },
            { row, col: col + 1 },
          ]

          for (const dir of directions) {
            if (
              dir.row >= 0 && dir.row < BOARD_SIZE &&
              dir.col >= 0 && dir.col < BOARD_SIZE
            ) {
              const hasShot = this.shotHistory.some(
                shot => shot.row === dir.row && shot.col === dir.col
              )
              const inQueue = this.targetQueue.some(
                t => t.row === dir.row && t.col === dir.col
              )
              if (!hasShot && !inQueue) {
                this.targetQueue.push(dir)
              }
            }
          }
        }
      }

      if (sunk) {
        // Определяем размер потопленного корабля
        const sunkSize = this.hitCells.length
        const shipIndex = this.remainingShips.indexOf(sunkSize)
        if (shipIndex !== -1) {
          this.remainingShips.splice(shipIndex, 1)
        }

        // Сбрасываем состояние охоты
        this.targetQueue = []
        this.hitCells = []
        this.lastHitDirection = null
      }
    }
  }

  /**
   * Сброс AI для новой игры
   */
  reset() {
    this.targetQueue = []
    this.hitCells = []
    this.shotHistory = []
    this.lastHitDirection = null
    this.probabilityMap = null
    this.remainingShips = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]
  }

  /**
   * Имитация раздумий AI (согласно ТЗ)
   */
  async think() {
    let thinkTime
    switch (this.difficulty) {
      case 'easy':
        thinkTime = 1000 + Math.random() * 2000 // 1-3 сек
        break
      case 'medium':
        thinkTime = 1500 + Math.random() * 1500 // 1.5-3 сек
        break
      case 'hard':
        thinkTime = 500 + Math.random() * 1000 // 0.5-1.5 сек (быстрее думает)
        break
      default:
        thinkTime = 1000
    }
    
    return new Promise(resolve => setTimeout(resolve, thinkTime))
  }
}
