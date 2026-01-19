import api from './api.js'

/**
 * Аутентификация через Telegram WebApp API
 */
export const authenticateWithTelegram = async (telegramData) => {
  try {
    const response = await api.post('/auth/telegram', {
      initData: telegramData,
    })
    
    if (response.data.token) {
      localStorage.setItem('token', response.data.token)
      return response.data.user
    }
    
    return null
  } catch (error) {
    console.error('Auth error:', error)
    throw error
  }
}

/**
 * Получение данных пользователя из Telegram
 */
export const getTelegramUser = () => {
  if (window.Telegram?.WebApp) {
    return window.Telegram.WebApp.initDataUnsafe?.user
  }
  return null
}

/**
 * Инициализация Telegram WebApp
 */
export const initTelegramWebApp = () => {
  if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp
    tg.ready()
    tg.expand()
    return tg
  }
  return null
}

/**
 * Выход из приложения
 */
export const logout = async () => {
  try {
    await api.post('/auth/logout')
  } catch (error) {
    console.error('Logout error:', error)
  } finally {
    localStorage.removeItem('token')
  }
}
