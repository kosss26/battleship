import { useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { getSocket, connectSocket, disconnectSocket } from '../services/socket.js'

/**
 * Хук для управления PvP игрой через WebSocket
 */
export function usePvPGame() {
  const user = useSelector((state) => state.user.user)
  const [gameState, setGameState] = useState({
    status: 'idle', // idle, searching, found, placement, playing, finished
    gameId: null,
    opponent: null,
    isPlayer1: false,
    isMyTurn: false,
    playerBoard: null,
    enemyBoard: null,
    moves: [],
    winner: null,
  })
  const [error, setError] = useState(null)

  // Подключение к сокету
  useEffect(() => {
    if (user?.id) {
      const token = localStorage.getItem('token')
      connectSocket(user.id, token)
    }

    return () => {
      // Не отключаемся при unmount, чтобы сохранить соединение
    }
  }, [user])

  // Обработчики событий сокета
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    // Поиск противника
    socket.on('game:searching', () => {
      setGameState(prev => ({ ...prev, status: 'searching' }))
    })

    socket.on('game:search:cancelled', () => {
      setGameState(prev => ({ ...prev, status: 'idle' }))
    })

    socket.on('game:search:timeout', ({ suggestAI }) => {
      setGameState(prev => ({ ...prev, status: 'idle' }))
      if (suggestAI) {
        setError('Противник не найден. Попробуйте сыграть с AI.')
      }
    })

    // Найден противник
    socket.on('game:found', ({ gameId, opponent, isPlayer1 }) => {
      setGameState(prev => ({
        ...prev,
        status: 'placement',
        gameId,
        opponent,
        isPlayer1,
      }))
    })

    // Игра началась
    socket.on('game:started', ({ currentTurn, isYourTurn }) => {
      setGameState(prev => ({
        ...prev,
        status: 'playing',
        isMyTurn: isYourTurn,
        enemyBoard: Array(10).fill(null).map(() => Array(10).fill(0)),
      }))
    })

    // Результат хода
    socket.on('game:move:result', ({ row, col, hit, sunk, gameOver, isYourMove }) => {
      if (isYourMove) {
        setGameState(prev => {
          const newEnemyBoard = prev.enemyBoard.map(r => [...r])
          newEnemyBoard[row][col] = hit ? 3 : 2 // HIT или MISS
          return {
            ...prev,
            enemyBoard: newEnemyBoard,
            moves: [...prev.moves, { player: 'me', row, col, hit, sunk }],
          }
        })
      }
    })

    // Получен ход противника
    socket.on('game:move:received', ({ row, col, hit, sunk, gameOver }) => {
      setGameState(prev => {
        const newPlayerBoard = prev.playerBoard.map(r => [...r])
        if (hit) {
          newPlayerBoard[row][col] = sunk ? 4 : 3 // SUNK или HIT
        } else {
          newPlayerBoard[row][col] = 2 // MISS
        }
        return {
          ...prev,
          playerBoard: newPlayerBoard,
          moves: [...prev.moves, { player: 'opponent', row, col, hit, sunk }],
        }
      })
    })

    // Смена хода
    socket.on('game:turn:changed', ({ isYourTurn }) => {
      setGameState(prev => ({ ...prev, isMyTurn: isYourTurn }))
    })

    // Таймаут хода
    socket.on('game:timeout', ({ autoMove }) => {
      console.log('Turn timeout, auto move:', autoMove)
    })

    // Игра завершена
    socket.on('game:finished', ({ winner, isWinner }) => {
      setGameState(prev => ({
        ...prev,
        status: 'finished',
        winner: isWinner ? 'player' : 'opponent',
      }))
    })

    // Противник вышел
    socket.on('game:opponent:left', ({ winner }) => {
      setGameState(prev => ({
        ...prev,
        status: 'finished',
        winner: 'player',
      }))
      setError('Противник покинул игру')
    })

    // Противник отключился
    socket.on('game:opponent:disconnected', () => {
      setGameState(prev => ({
        ...prev,
        status: 'finished',
        winner: 'player',
      }))
      setError('Противник отключился')
    })

    return () => {
      socket.off('game:searching')
      socket.off('game:search:cancelled')
      socket.off('game:search:timeout')
      socket.off('game:found')
      socket.off('game:started')
      socket.off('game:move:result')
      socket.off('game:move:received')
      socket.off('game:turn:changed')
      socket.off('game:timeout')
      socket.off('game:finished')
      socket.off('game:opponent:left')
      socket.off('game:opponent:disconnected')
    }
  }, [])

  // Поиск противника
  const searchOpponent = useCallback(() => {
    const socket = getSocket()
    if (!socket) return

    setError(null)
    socket.emit('game:search', { rating: user?.rating || 1000 })
  }, [user])

  // Отмена поиска
  const cancelSearch = useCallback(() => {
    const socket = getSocket()
    if (!socket) return

    socket.emit('game:cancel-search')
  }, [])

  // Расстановка готова
  const submitPlacement = useCallback((board) => {
    const socket = getSocket()
    if (!socket) return

    setGameState(prev => ({ ...prev, playerBoard: board }))
    socket.emit('game:placement-ready', { board })
  }, [])

  // Сделать ход
  const makeMove = useCallback((row, col) => {
    const socket = getSocket()
    if (!socket) return

    socket.emit('game:move', { row, col })
  }, [])

  // Выйти из игры
  const leaveGame = useCallback(() => {
    const socket = getSocket()
    if (!socket) return

    socket.emit('game:leave')
    setGameState({
      status: 'idle',
      gameId: null,
      opponent: null,
      isPlayer1: false,
      isMyTurn: false,
      playerBoard: null,
      enemyBoard: null,
      moves: [],
      winner: null,
    })
  }, [])

  // Сброс состояния
  const reset = useCallback(() => {
    setGameState({
      status: 'idle',
      gameId: null,
      opponent: null,
      isPlayer1: false,
      isMyTurn: false,
      playerBoard: null,
      enemyBoard: null,
      moves: [],
      winner: null,
    })
    setError(null)
  }, [])

  return {
    gameState,
    error,
    searchOpponent,
    cancelSearch,
    submitPlacement,
    makeMove,
    leaveGame,
    reset,
  }
}

export default usePvPGame
