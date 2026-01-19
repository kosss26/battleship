/**
 * WebSocket события для PvP игры
 * Согласно ТЗ: game:create, game:join, game:move, game:leave, etc.
 */

// Хранилище активных игр и игроков
const waitingPlayers = new Map() // userId -> socket
const activeGames = new Map() // gameId -> { player1, player2, state }
const playerToGame = new Map() // oderId -> gameId

/**
 * Инициализация WebSocket событий
 */
export function initGameSocket(io) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    const userId = socket.handshake.auth?.userId

    // Поиск противника
    socket.on('game:search', (data) => {
      handleGameSearch(io, socket, userId, data)
    })

    // Отмена поиска
    socket.on('game:cancel-search', () => {
      waitingPlayers.delete(userId)
      socket.emit('game:search:cancelled')
    })

    // Расстановка кораблей готова
    socket.on('game:placement-ready', (data) => {
      handlePlacementReady(io, socket, userId, data)
    })

    // Ход игрока
    socket.on('game:move', (data) => {
      handleGameMove(io, socket, userId, data)
    })

    // Выход из игры
    socket.on('game:leave', () => {
      handleGameLeave(io, socket, userId)
    })

    // Отключение
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
      handleDisconnect(io, socket, userId)
    })
  })
}

/**
 * Обработка поиска противника
 */
function handleGameSearch(io, socket, userId, data) {
  const { rating = 1000 } = data

  // Проверяем, есть ли подходящий противник
  for (const [waitingUserId, waitingSocket] of waitingPlayers.entries()) {
    if (waitingUserId === userId) continue

    // Проверяем рейтинг (±200 согласно ТЗ)
    const ratingDiff = Math.abs(rating - (waitingSocket.rating || 1000))
    if (ratingDiff <= 200) {
      // Нашли противника!
      waitingPlayers.delete(waitingUserId)

      // Создаём игру
      const gameId = `pvp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const gameState = {
        id: gameId,
        player1: { id: waitingUserId, socket: waitingSocket, board: null, ready: false },
        player2: { id: userId, socket, board: null, ready: false },
        currentTurn: null,
        status: 'placement',
        moves: [],
        startedAt: Date.now(),
      }

      activeGames.set(gameId, gameState)
      playerToGame.set(waitingUserId, gameId)
      playerToGame.set(userId, gameId)

      // Уведомляем обоих игроков
      waitingSocket.emit('game:found', {
        gameId,
        opponent: { id: userId, rating },
        isPlayer1: true,
      })

      socket.emit('game:found', {
        gameId,
        opponent: { id: waitingUserId, rating: waitingSocket.rating },
        isPlayer1: false,
      })

      // Запускаем таймер расстановки (30 сек согласно ТЗ)
      setTimeout(() => {
        const game = activeGames.get(gameId)
        if (game && game.status === 'placement') {
          // Проверяем, кто не готов
          if (!game.player1.ready) {
            handlePlayerTimeout(io, game, 'player1')
          }
          if (!game.player2.ready) {
            handlePlayerTimeout(io, game, 'player2')
          }
        }
      }, 30000)

      return
    }
  }

  // Противник не найден, добавляем в очередь
  socket.rating = rating
  waitingPlayers.set(userId, socket)
  socket.emit('game:searching')

  // Таймаут 30 сек, потом предлагаем AI
  setTimeout(() => {
    if (waitingPlayers.has(userId)) {
      waitingPlayers.delete(userId)
      socket.emit('game:search:timeout', { suggestAI: true })
    }
  }, 30000)
}

/**
 * Обработка готовности расстановки
 */
function handlePlacementReady(io, socket, userId, data) {
  const { board } = data
  const gameId = playerToGame.get(userId)

  if (!gameId) return

  const game = activeGames.get(gameId)
  if (!game || game.status !== 'placement') return

  // Определяем какой это игрок
  const isPlayer1 = game.player1.id === userId
  const player = isPlayer1 ? game.player1 : game.player2

  player.board = board
  player.ready = true

  // Проверяем, готовы ли оба
  if (game.player1.ready && game.player2.ready) {
    game.status = 'playing'
    game.currentTurn = game.player1.id // Первый игрок ходит первым

    // Уведомляем обоих
    game.player1.socket.emit('game:started', {
      currentTurn: game.player1.id,
      isYourTurn: true,
    })

    game.player2.socket.emit('game:started', {
      currentTurn: game.player1.id,
      isYourTurn: false,
    })

    // Запускаем таймер хода
    startTurnTimer(io, game)
  }
}

/**
 * Обработка хода
 */
function handleGameMove(io, socket, userId, data) {
  const { row, col } = data
  const gameId = playerToGame.get(userId)

  if (!gameId) return

  const game = activeGames.get(gameId)
  if (!game || game.status !== 'playing') return
  if (game.currentTurn !== userId) return

  // Определяем противника
  const isPlayer1 = game.player1.id === userId
  const opponent = isPlayer1 ? game.player2 : game.player1
  const player = isPlayer1 ? game.player1 : game.player2

  // Проверяем доску противника
  const cell = opponent.board[row][col]
  let hit = false
  let sunk = false

  if (cell === 1) { // SHIP
    opponent.board[row][col] = 3 // HIT
    hit = true
    sunk = checkShipSunk(opponent.board, row, col)
  } else if (cell === 0) { // EMPTY
    opponent.board[row][col] = 2 // MISS
  } else {
    // Уже стреляли
    return
  }

  // Сохраняем ход
  game.moves.push({ player: userId, row, col, hit, sunk, timestamp: Date.now() })

  // Проверяем победу
  const gameOver = checkGameOver(opponent.board)

  // Уведомляем игроков
  const moveResult = { row, col, hit, sunk, gameOver }

  socket.emit('game:move:result', {
    ...moveResult,
    isYourMove: true,
  })

  opponent.socket.emit('game:move:received', {
    ...moveResult,
    isYourMove: false,
  })

  if (gameOver) {
    handleGameEnd(io, game, userId)
    return
  }

  // Переключаем ход (если промах)
  if (!hit) {
    game.currentTurn = opponent.id
    startTurnTimer(io, game)

    socket.emit('game:turn:changed', { isYourTurn: false })
    opponent.socket.emit('game:turn:changed', { isYourTurn: true })
  }
}

/**
 * Таймер хода (30 сек согласно ТЗ)
 */
function startTurnTimer(io, game) {
  if (game.turnTimer) {
    clearTimeout(game.turnTimer)
  }

  game.turnTimer = setTimeout(() => {
    if (game.status !== 'playing') return

    // Автоматический случайный ход
    const currentPlayer = game.currentTurn === game.player1.id ? game.player1 : game.player2
    const opponent = game.currentTurn === game.player1.id ? game.player2 : game.player1

    // Ищем случайную нестрелянную клетку
    const availableCells = []
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (opponent.board[r][c] === 0 || opponent.board[r][c] === 1) {
          availableCells.push({ row: r, col: c })
        }
      }
    }

    if (availableCells.length > 0) {
      const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)]
      
      // Эмулируем ход
      currentPlayer.socket.emit('game:timeout', { autoMove: randomCell })
      handleGameMove(io, currentPlayer.socket, game.currentTurn, randomCell)
    }
  }, 30000)
}

/**
 * Проверка потопления корабля
 */
function checkShipSunk(board, row, col) {
  const visited = new Set()
  const queue = [[row, col]]
  visited.add(`${row},${col}`)

  while (queue.length > 0) {
    const [r, c] = queue.shift()

    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]]
    for (const [dr, dc] of directions) {
      const newR = r + dr
      const newC = c + dc
      const key = `${newR},${newC}`

      if (newR >= 0 && newR < 10 && newC >= 0 && newC < 10 && !visited.has(key)) {
        if (board[newR][newC] === 1) return false // Есть непотопленная часть
        if (board[newR][newC] === 3) {
          visited.add(key)
          queue.push([newR, newC])
        }
      }
    }
  }

  return true
}

/**
 * Проверка окончания игры
 */
function checkGameOver(board) {
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (board[r][c] === 1) return false
    }
  }
  return true
}

/**
 * Обработка конца игры
 */
function handleGameEnd(io, game, winnerId) {
  game.status = 'finished'
  
  if (game.turnTimer) {
    clearTimeout(game.turnTimer)
  }

  const winner = game.player1.id === winnerId ? game.player1 : game.player2
  const loser = game.player1.id === winnerId ? game.player2 : game.player1

  game.player1.socket.emit('game:finished', {
    winner: winnerId,
    isWinner: game.player1.id === winnerId,
  })

  game.player2.socket.emit('game:finished', {
    winner: winnerId,
    isWinner: game.player2.id === winnerId,
  })

  // Очищаем
  playerToGame.delete(game.player1.id)
  playerToGame.delete(game.player2.id)
  activeGames.delete(game.id)
}

/**
 * Обработка выхода из игры
 */
function handleGameLeave(io, socket, userId) {
  waitingPlayers.delete(userId)

  const gameId = playerToGame.get(userId)
  if (!gameId) return

  const game = activeGames.get(gameId)
  if (!game) return

  const opponent = game.player1.id === userId ? game.player2 : game.player1

  // Засчитываем победу противнику
  opponent.socket.emit('game:opponent:left', { winner: opponent.id })
  handleGameEnd(io, game, opponent.id)
}

/**
 * Обработка отключения
 */
function handleDisconnect(io, socket, userId) {
  waitingPlayers.delete(userId)

  const gameId = playerToGame.get(userId)
  if (!gameId) return

  const game = activeGames.get(gameId)
  if (!game) return

  const opponent = game.player1.id === userId ? game.player2 : game.player1

  // Даём 10 секунд на переподключение (согласно ТЗ)
  setTimeout(() => {
    const currentGame = activeGames.get(gameId)
    if (currentGame && currentGame.status !== 'finished') {
      opponent.socket.emit('game:opponent:disconnected', { winner: opponent.id })
      handleGameEnd(io, currentGame, opponent.id)
    }
  }, 10000)
}

/**
 * Обработка таймаута игрока
 */
function handlePlayerTimeout(io, game, playerKey) {
  const player = game[playerKey]
  const opponent = playerKey === 'player1' ? game.player2 : game.player1

  player.socket.emit('game:placement:timeout')
  opponent.socket.emit('game:opponent:timeout', { winner: opponent.id })
  
  handleGameEnd(io, game, opponent.id)
}

export default { initGameSocket }
