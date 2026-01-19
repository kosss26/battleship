/**
 * Утилиты для работы с Telegram WebApp API
 * Согласно ТЗ: Haptic Feedback, нативные кнопки, платежи
 */

/**
 * Получает объект Telegram WebApp
 */
export function getTelegram() {
  return window.Telegram?.WebApp
}

/**
 * Проверяет, запущено ли приложение в Telegram
 */
export function isTelegramWebApp() {
  return !!getTelegram()
}

/**
 * Инициализирует WebApp
 */
export function initWebApp() {
  const tg = getTelegram()
  if (!tg) return null

  tg.ready()
  tg.expand()
  
  // Устанавливаем цвет header
  tg.setHeaderColor('#3B82F6')
  tg.setBackgroundColor('#F9FAFB')

  return tg
}

/**
 * Haptic Feedback - тактильная обратная связь
 */
export const haptic = {
  // Лёгкий импакт (нажатие кнопки)
  light() {
    getTelegram()?.HapticFeedback?.impactOccurred('light')
  },
  
  // Средний импакт (переключение)
  medium() {
    getTelegram()?.HapticFeedback?.impactOccurred('medium')
  },
  
  // Сильный импакт (важное действие)
  heavy() {
    getTelegram()?.HapticFeedback?.impactOccurred('heavy')
  },
  
  // Мягкий импакт
  soft() {
    getTelegram()?.HapticFeedback?.impactOccurred('soft')
  },
  
  // Жёсткий импакт
  rigid() {
    getTelegram()?.HapticFeedback?.impactOccurred('rigid')
  },
  
  // Успех
  success() {
    getTelegram()?.HapticFeedback?.notificationOccurred('success')
  },
  
  // Предупреждение
  warning() {
    getTelegram()?.HapticFeedback?.notificationOccurred('warning')
  },
  
  // Ошибка
  error() {
    getTelegram()?.HapticFeedback?.notificationOccurred('error')
  },
  
  // Выбор (изменение значения)
  selectionChanged() {
    getTelegram()?.HapticFeedback?.selectionChanged()
  },
}

/**
 * Главная кнопка (Main Button)
 */
export const mainButton = {
  show(text, onClick) {
    const tg = getTelegram()
    if (!tg) return

    tg.MainButton.text = text
    tg.MainButton.onClick(onClick)
    tg.MainButton.show()
  },
  
  hide() {
    getTelegram()?.MainButton?.hide()
  },
  
  showProgress() {
    getTelegram()?.MainButton?.showProgress()
  },
  
  hideProgress() {
    getTelegram()?.MainButton?.hideProgress()
  },
  
  setParams({ text, color, textColor, isActive, isVisible }) {
    getTelegram()?.MainButton?.setParams({
      text,
      color,
      text_color: textColor,
      is_active: isActive,
      is_visible: isVisible,
    })
  },
}

/**
 * Кнопка "Назад"
 */
export const backButton = {
  show(onClick) {
    const tg = getTelegram()
    if (!tg) return

    tg.BackButton.onClick(onClick)
    tg.BackButton.show()
  },
  
  hide() {
    getTelegram()?.BackButton?.hide()
  },
}

/**
 * Открывает ссылку в Telegram
 */
export function openTelegramLink(url) {
  getTelegram()?.openTelegramLink(url)
}

/**
 * Открывает внешнюю ссылку
 */
export function openLink(url, options = {}) {
  getTelegram()?.openLink(url, options)
}

/**
 * Показывает всплывающее окно
 */
export function showPopup(title, message, buttons = []) {
  return new Promise((resolve) => {
    const tg = getTelegram()
    if (!tg) {
      resolve(null)
      return
    }

    tg.showPopup({
      title,
      message,
      buttons: buttons.length > 0 ? buttons : [{ type: 'ok' }],
    }, (buttonId) => {
      resolve(buttonId)
    })
  })
}

/**
 * Показывает alert
 */
export function showAlert(message) {
  return new Promise((resolve) => {
    const tg = getTelegram()
    if (!tg) {
      alert(message)
      resolve()
      return
    }
    tg.showAlert(message, resolve)
  })
}

/**
 * Показывает confirm
 */
export function showConfirm(message) {
  return new Promise((resolve) => {
    const tg = getTelegram()
    if (!tg) {
      resolve(confirm(message))
      return
    }
    tg.showConfirm(message, resolve)
  })
}

/**
 * Открывает платёжную форму
 */
export function openInvoice(url) {
  return new Promise((resolve) => {
    const tg = getTelegram()
    if (!tg) {
      window.open(url, '_blank')
      resolve('opened')
      return
    }
    
    tg.openInvoice(url, (status) => {
      resolve(status) // 'paid', 'cancelled', 'failed', 'pending'
    })
  })
}

/**
 * Закрывает WebApp
 */
export function close() {
  getTelegram()?.close()
}

/**
 * Получает данные пользователя
 */
export function getUser() {
  return getTelegram()?.initDataUnsafe?.user
}

/**
 * Получает initData для отправки на сервер
 */
export function getInitData() {
  return getTelegram()?.initData
}

/**
 * Проверяет, доступна ли функция
 */
export function isVersionAtLeast(version) {
  return getTelegram()?.isVersionAtLeast(version) ?? false
}

/**
 * Получает цветовую схему (light/dark)
 */
export function getColorScheme() {
  return getTelegram()?.colorScheme || 'light'
}

/**
 * Получает тему
 */
export function getThemeParams() {
  return getTelegram()?.themeParams || {}
}

export default {
  getTelegram,
  isTelegramWebApp,
  initWebApp,
  haptic,
  mainButton,
  backButton,
  openTelegramLink,
  openLink,
  showPopup,
  showAlert,
  showConfirm,
  openInvoice,
  close,
  getUser,
  getInitData,
  isVersionAtLeast,
  getColorScheme,
  getThemeParams,
}
