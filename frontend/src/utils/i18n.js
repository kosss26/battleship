/**
 * Простая система локализации
 * Согласно ТЗ: русский (основной), английский
 */

export const LANGUAGES = {
  ru: 'Русский',
  en: 'English',
}

export const translations = {
  ru: {
    // Общие
    app_name: 'Battleship Online',
    loading: 'Загрузка...',
    error: 'Ошибка',
    back: 'Назад',
    save: 'Сохранить',
    cancel: 'Отмена',
    confirm: 'Подтвердить',
    
    // Навигация
    nav_home: 'Главная',
    nav_profile: 'Профиль',
    nav_shop: 'Магазин',
    nav_leaderboard: 'Рейтинг',
    nav_achievements: 'Достижения',
    nav_referrals: 'Рефералы',
    nav_daily: 'Ежедневные задания',
    
    // Главная
    home_hello: 'Привет',
    home_multiplayer: 'Мультиплеер',
    home_quick_match: 'Быстрый матч',
    home_training: 'Тренировка с AI',
    
    // Игра
    game_your_turn: 'Ваш ход',
    game_opponent_turn: 'Ход противника',
    game_hit: 'Попадание!',
    game_miss: 'Промах',
    game_sunk: 'Потоплен!',
    game_victory: 'Победа!',
    game_defeat: 'Поражение',
    game_place_ships: 'Расставьте корабли',
    game_random: 'Случайно',
    game_clear: 'Очистить',
    game_ready: 'Готово',
    game_play_again: 'Играть ещё',
    
    // Расстановка
    placement_title: 'Расстановка флота',
    placement_select_ship: 'Выберите корабль',
    placement_rotate: 'Повернуть',
    placement_horizontal: 'Горизонтально',
    placement_vertical: 'Вертикально',
    
    // Профиль
    profile_rating: 'Рейтинг',
    profile_level: 'Уровень',
    profile_total_matches: 'Всего матчей',
    profile_wins: 'Побед',
    profile_losses: 'Поражений',
    profile_winrate: 'Процент побед',
    
    // Магазин
    shop_title: 'Магазин',
    shop_skins: 'Скины',
    shop_boards: 'Доски',
    shop_gems: 'Гемы',
    shop_buy: 'Купить',
    shop_owned: 'Куплено',
    
    // Достижения
    achievements_title: 'Достижения',
    achievements_progress: 'Прогресс',
    achievements_locked: 'Заблокировано',
    achievements_unlocked: 'Разблокировано',
    
    // Рефералы
    referrals_title: 'Рефералы',
    referrals_your_code: 'Ваш код',
    referrals_copy: 'Копировать',
    referrals_share: 'Поделиться',
    referrals_apply: 'Применить код',
    referrals_invited: 'Приглашённых',
    referrals_earned: 'Заработано',
    
    // Задания
    challenges_title: 'Ежедневные задания',
    challenges_claim: 'Забрать награду',
    challenges_completed: 'Выполнено',
    challenges_reset: 'Обновление через',
    
    // PvP
    pvp_searching: 'Поиск противника...',
    pvp_found: 'Противник найден!',
    pvp_opponent_left: 'Противник покинул игру',
    pvp_timeout: 'Время вышло',
  },
  
  en: {
    // General
    app_name: 'Battleship Online',
    loading: 'Loading...',
    error: 'Error',
    back: 'Back',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    
    // Navigation
    nav_home: 'Home',
    nav_profile: 'Profile',
    nav_shop: 'Shop',
    nav_leaderboard: 'Leaderboard',
    nav_achievements: 'Achievements',
    nav_referrals: 'Referrals',
    nav_daily: 'Daily Challenges',
    
    // Home
    home_hello: 'Hello',
    home_multiplayer: 'Multiplayer',
    home_quick_match: 'Quick Match',
    home_training: 'Training with AI',
    
    // Game
    game_your_turn: 'Your turn',
    game_opponent_turn: "Opponent's turn",
    game_hit: 'Hit!',
    game_miss: 'Miss',
    game_sunk: 'Sunk!',
    game_victory: 'Victory!',
    game_defeat: 'Defeat',
    game_place_ships: 'Place your ships',
    game_random: 'Random',
    game_clear: 'Clear',
    game_ready: 'Ready',
    game_play_again: 'Play again',
    
    // Placement
    placement_title: 'Fleet Placement',
    placement_select_ship: 'Select a ship',
    placement_rotate: 'Rotate',
    placement_horizontal: 'Horizontal',
    placement_vertical: 'Vertical',
    
    // Profile
    profile_rating: 'Rating',
    profile_level: 'Level',
    profile_total_matches: 'Total matches',
    profile_wins: 'Wins',
    profile_losses: 'Losses',
    profile_winrate: 'Win rate',
    
    // Shop
    shop_title: 'Shop',
    shop_skins: 'Skins',
    shop_boards: 'Boards',
    shop_gems: 'Gems',
    shop_buy: 'Buy',
    shop_owned: 'Owned',
    
    // Achievements
    achievements_title: 'Achievements',
    achievements_progress: 'Progress',
    achievements_locked: 'Locked',
    achievements_unlocked: 'Unlocked',
    
    // Referrals
    referrals_title: 'Referrals',
    referrals_your_code: 'Your code',
    referrals_copy: 'Copy',
    referrals_share: 'Share',
    referrals_apply: 'Apply code',
    referrals_invited: 'Invited',
    referrals_earned: 'Earned',
    
    // Challenges
    challenges_title: 'Daily Challenges',
    challenges_claim: 'Claim reward',
    challenges_completed: 'Completed',
    challenges_reset: 'Resets in',
    
    // PvP
    pvp_searching: 'Searching for opponent...',
    pvp_found: 'Opponent found!',
    pvp_opponent_left: 'Opponent left the game',
    pvp_timeout: 'Time out',
  },
}

/**
 * Получает текущий язык из Telegram или localStorage
 */
export function getCurrentLanguage() {
  // Пробуем получить язык из Telegram
  if (window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code) {
    const tgLang = window.Telegram.WebApp.initDataUnsafe.user.language_code
    if (tgLang.startsWith('ru')) return 'ru'
    if (tgLang.startsWith('en')) return 'en'
  }
  
  // Пробуем из localStorage
  const saved = localStorage.getItem('language')
  if (saved && translations[saved]) return saved
  
  // Пробуем из браузера
  const browserLang = navigator.language || navigator.userLanguage
  if (browserLang?.startsWith('ru')) return 'ru'
  
  return 'en'
}

/**
 * Устанавливает язык
 */
export function setLanguage(lang) {
  if (translations[lang]) {
    localStorage.setItem('language', lang)
    return true
  }
  return false
}

/**
 * Получает перевод по ключу
 */
export function t(key, lang = null) {
  const currentLang = lang || getCurrentLanguage()
  return translations[currentLang]?.[key] || translations.ru[key] || key
}

/**
 * React hook для локализации
 */
import { useState, useEffect } from 'react'

export function useTranslation() {
  const [lang, setLang] = useState(getCurrentLanguage())
  
  useEffect(() => {
    // Можно добавить listener на изменение языка
  }, [])
  
  const translate = (key) => t(key, lang)
  
  const changeLanguage = (newLang) => {
    if (setLanguage(newLang)) {
      setLang(newLang)
    }
  }
  
  return { t: translate, lang, changeLanguage, languages: LANGUAGES }
}

export default { t, getCurrentLanguage, setLanguage, useTranslation, LANGUAGES }
