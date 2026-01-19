import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { setUser, setLoading, setError } from '../store/slices/userSlice.js'
import { initTelegramWebApp, getTelegramUser, authenticateWithTelegram } from '../services/auth.js'

/**
 * Хук для инициализации Telegram WebApp и аутентификации
 */
export const useTelegramAuth = () => {
  const dispatch = useDispatch()

  useEffect(() => {
    const initAuth = async () => {
      try {
        dispatch(setLoading(true))

        // Инициализация Telegram WebApp
        const tg = initTelegramWebApp()
        
        if (!tg) {
          // Если не в Telegram, используем мок-данные для разработки
          console.warn('Telegram WebApp not available, using mock user')
          const mockUser = {
            id: 12345,
            first_name: 'Test',
            username: 'testuser',
            rating: 1000,
            level: 1,
            gold: 0,
            gems: 0,
          }
          dispatch(setUser(mockUser))
          dispatch(setLoading(false))
          return
        }

        // Получаем данные пользователя из Telegram
        const telegramUser = getTelegramUser()

        if (!telegramUser) {
          throw new Error('Failed to get Telegram user data')
        }

        // Пытаемся аутентифицироваться через backend
        try {
          const initData = tg.initData || tg.initDataUnsafe || ''
          
          if (initData) {
            const user = await authenticateWithTelegram(initData)
            if (user) {
              dispatch(setUser(user))
            } else {
              // Fallback на локальные данные Telegram
              dispatch(setUser({
                id: telegramUser.id,
                telegram_id: telegramUser.id,
                username: telegramUser.username,
                first_name: telegramUser.first_name,
                last_name: telegramUser.last_name,
                photo_url: telegramUser.photo_url,
                rating: 1000,
                level: 1,
                gold: 0,
                gems: 0,
              }))
            }
          } else {
            // Fallback на локальные данные Telegram
            dispatch(setUser({
              id: telegramUser.id,
              telegram_id: telegramUser.id,
              username: telegramUser.username,
              first_name: telegramUser.first_name,
              last_name: telegramUser.last_name,
              photo_url: telegramUser.photo_url,
              rating: 1000,
              level: 1,
              gold: 0,
              gems: 0,
            }))
          }
        } catch (authError) {
          console.warn('Backend auth failed, using local Telegram data:', authError)
          // Fallback на локальные данные Telegram
          dispatch(setUser({
            id: telegramUser.id,
            telegram_id: telegramUser.id,
            username: telegramUser.username,
            first_name: telegramUser.first_name,
            last_name: telegramUser.last_name,
            photo_url: telegramUser.photo_url,
            rating: 1000,
            level: 1,
            gold: 0,
            gems: 0,
          }))
        }

        dispatch(setLoading(false))
      } catch (error) {
        console.error('Auth initialization error:', error)
        dispatch(setError(error.message))
        dispatch(setLoading(false))
      }
    }

    initAuth()
  }, [dispatch])
}
