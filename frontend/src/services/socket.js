import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000'

let socket = null

/**
 * Подключение к WebSocket серверу
 */
export const connectSocket = (userId, token) => {
  if (socket?.connected) {
    console.log('Socket already connected')
    return socket
  }

  socket = io(SOCKET_URL, {
    auth: {
      userId,
      token,
    },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  })

  socket.on('connect', () => {
    console.log('🔌 Connected to game server:', socket.id)
  })

  socket.on('disconnect', (reason) => {
    console.log('🔌 Disconnected from game server:', reason)
  })

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error)
  })

  socket.on('reconnect', (attemptNumber) => {
    console.log('🔌 Reconnected to game server (attempt', attemptNumber, ')')
  })

  return socket
}

/**
 * Отключение от WebSocket сервера
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
    console.log('🔌 Socket disconnected manually')
  }
}

/**
 * Получение текущего socket
 */
export const getSocket = () => {
  return socket
}

/**
 * Эмит события с promise
 */
export const emitWithAck = (event, data) => {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Socket not connected'))
      return
    }

    socket.emit(event, data, (response) => {
      if (response?.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })

    // Таймаут 10 секунд
    setTimeout(() => {
      reject(new Error('Socket emit timeout'))
    }, 10000)
  })
}

export default { connectSocket, disconnectSocket, getSocket, emitWithAck }
