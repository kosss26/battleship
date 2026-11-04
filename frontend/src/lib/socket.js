import { io } from 'socket.io-client'
import { getToken } from './api.js'

const WS = import.meta.env.VITE_WS_URL || undefined
let socket = null

export function getSocket() {
  if (socket) return socket
  socket = io(WS, {
    auth: (cb) => cb({ token: getToken() }),
    transports: ['websocket', 'polling'],
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  })
  return socket
}

/** emit with ack and timeout → resolves to server response */
export function request(event, data = {}, timeout = 8000) {
  const s = getSocket()
  return new Promise((resolve) => {
    let done = false
    const timer = setTimeout(() => {
      if (!done) resolve({ error: 'timeout' })
    }, timeout)
    s.emit(event, data, (res) => {
      done = true
      clearTimeout(timer)
      resolve(res || {})
    })
  })
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
