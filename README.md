# 🚢 Battleship Online - Telegram Mini App

Полнофункциональная Telegram Mini App для игры "Морской Бой" с PvP, AI, турнирами, Battle Pass и социальными функциями.

## 📋 Техническое задание

Полное ТЗ находится в файле `Battleship_Mini_App_TZ Техническое задание.md`

## ✅ Реализованные функции

### Фаза 1 - MVP ✅
- [x] Аутентификация через Telegram WebApp API
- [x] Игра против AI (Easy, Medium, Hard)
- [x] Расстановка кораблей (ручная и случайная)
- [x] Визуализация игрового поля 10x10
- [x] Профиль игрока с статистикой
- [x] Система рейтинга (ELO)
- [x] Таблица лидеров (глобальная)

### Фаза 2 - Социальные функции ✅
- [x] PvP матчмейкинг через WebSocket
- [x] Реферальная система (100 Gold + 10% от побед)
- [x] Система достижений (12 достижений)
- [x] Ежедневные задания (8 типов)
- [x] Магазин скинов и косметики

### Фаза 3 - Продвинутые функции ✅
- [x] Battle Pass (20 уровней, бесплатные + премиум награды)
- [x] Турниры (еженедельные, месячные)
- [x] Telegram Payments интеграция
- [x] Система уведомлений
- [x] Haptic Feedback
- [x] Локализация (RU/EN)
- [x] Анимации и переходы (Framer Motion)

## 🛠 Технологии

### Frontend (57 файлов)
- **React.js 18** + React Router DOM 6
- **Redux Toolkit** - управление состоянием
- **Tailwind CSS** - стилизация
- **Framer Motion** - анимации
- **Socket.io Client** - WebSocket
- **Axios** - HTTP клиент

### Backend
- **Node.js + Express.js** - API сервер
- **PostgreSQL** - база данных
- **Socket.io** - WebSocket для PvP
- **JWT** - аутентификация
- **Telegram Bot API** - верификация и платежи

## 📁 Структура проекта

```
Battleship/
├── frontend/                     # React приложение
│   ├── src/
│   │   ├── components/           # UI компоненты
│   │   │   ├── BattlePhase.jsx   # Боевая фаза
│   │   │   ├── ShipPlacement.jsx # Расстановка кораблей
│   │   │   ├── GameResults.jsx   # Результаты игры
│   │   │   └── PageTransition.jsx# Анимации
│   │   ├── pages/                # Страницы (12 шт)
│   │   │   ├── Home.jsx          # Главная
│   │   │   ├── Game.jsx          # Игра против AI
│   │   │   ├── PvP.jsx           # PvP режим
│   │   │   ├── Profile.jsx       # Профиль
│   │   │   ├── Shop.jsx          # Магазин
│   │   │   ├── Leaderboard.jsx   # Рейтинг
│   │   │   ├── Achievements.jsx  # Достижения
│   │   │   ├── Referrals.jsx     # Рефералы
│   │   │   ├── DailyChallenges.jsx# Ежедневные задания
│   │   │   ├── Tournaments.jsx   # Турниры
│   │   │   └── BattlePass.jsx    # Battle Pass
│   │   ├── hooks/                # React хуки
│   │   │   ├── useTelegramAuth.js
│   │   │   └── usePvPGame.js
│   │   ├── services/             # API сервисы
│   │   │   ├── api.js
│   │   │   ├── auth.js
│   │   │   └── socket.js
│   │   ├── store/                # Redux
│   │   │   ├── store.js
│   │   │   └── slices/
│   │   └── utils/                # Утилиты
│   │       ├── gameLogic.js      # Игровая логика
│   │       ├── ai.js             # AI (3 уровня)
│   │       ├── telegram.js       # Telegram API
│   │       └── i18n.js           # Локализация
│   └── package.json
├── backend/                      # Node.js сервер
│   ├── db/
│   │   ├── index.js              # PostgreSQL подключение
│   │   └── schema.sql            # Схема БД
│   ├── models/                   # Модели данных (8 шт)
│   │   ├── User.js
│   │   ├── Game.js
│   │   ├── Achievement.js
│   │   ├── Referral.js
│   │   ├── DailyChallenge.js
│   │   ├── Tournament.js
│   │   ├── BattlePass.js
│   │   └── Notification.js
│   ├── routes/                   # API маршруты (10 шт)
│   │   ├── auth.js
│   │   ├── games.js
│   │   ├── users.js
│   │   ├── leaderboards.js
│   │   ├── referrals.js
│   │   ├── challenges.js
│   │   ├── tournaments.js
│   │   ├── battlepass.js
│   │   ├── payments.js
│   │   └── notifications.js
│   ├── services/
│   │   └── telegram.js           # Telegram API
│   ├── socket/
│   │   └── gameSocket.js         # PvP WebSocket
│   ├── middleware/
│   │   └── auth.js               # JWT middleware
│   ├── utils/
│   │   └── elo.js                # ELO рейтинг
│   ├── server.js
│   └── package.json
├── package.json                  # Корневой package.json
└── README.md
```

## 🚀 Быстрый старт

### Требования
- Node.js 18+
- PostgreSQL 14+
- Telegram Bot Token

### Установка

```bash
# Клонирование
git clone https://github.com/kosss26/battleship.git
cd battleship

# Установка зависимостей
npm run install:all

# Настройка БД
psql -U postgres -d battleship -f backend/db/schema.sql
```

### Переменные окружения

**Backend (.env)**:
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

DATABASE_URL=postgresql://user:password@localhost:5432/battleship

JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_PAYMENT_PROVIDER_TOKEN=your-payment-token
```

### Запуск

```bash
# Разработка
npm run dev

# Отдельно
cd frontend && npm run dev
cd backend && npm run dev
```

## 🎮 Игровые режимы

### AI (3 уровня)
| Уровень | Стратегия |
|---------|-----------|
| Easy | Случайные выстрелы |
| Medium | Умный поиск + шахматный паттерн |
| Hard | Карта вероятностей + продвинутое преследование |

### PvP
- Матчмейкинг по рейтингу (±200)
- Таймер хода: 30 секунд
- Автоматический ход при таймауте
- Переподключение при разрыве (10 сек)

## 🏆 Система прогрессии

### Рейтинг (ELO)
- Начальный: 1000
- K-фактор: 32
- Ранги: Юнга → Матрос → Мичман → Лейтенант → Капитан → Адмирал

### Battle Pass
- 20 уровней
- Бесплатные + премиум награды
- 100 XP за уровень
- Скины, валюта, эксклюзивы

### Достижения (12 шт)
| Категория | Достижения |
|-----------|------------|
| Первые шаги | Дебютант, Охотник, Мастер флота |
| Боевые | Блиц-король, Точность, Генерал |
| Элитные | Топ-100, Легенда, Босс-киллер |
| AI | Новичок, Опытный, Профессионал |

## 💰 Монетизация

### Внутриигровая валюта
- **Gold (🪙)** - за победы, задания, достижения
- **Gems (💎)** - покупка за реальные деньги

### Магазин
- Скины кораблей (5 шт)
- Темы досок (4 шт)
- Пакеты гемов
- Battle Pass Premium

### Telegram Payments
- Интеграция с провайдером платежей
- Webhook для обработки
- Автоматическое начисление

## 📡 API Endpoints

### Аутентификация
```
POST /api/auth/telegram     - Вход через Telegram
GET  /api/auth/me           - Текущий пользователь
```

### Игры
```
POST /api/games/start       - Начать игру
POST /api/games/:id/finish  - Завершить игру
GET  /api/games/history     - История игр
```

### Социальные
```
GET  /api/referrals/code    - Получить реф. код
POST /api/referrals/apply   - Применить код
GET  /api/challenges/daily  - Ежедневные задания
```

### Турниры & Battle Pass
```
GET  /api/tournaments       - Список турниров
POST /api/tournaments/:id/join - Регистрация
GET  /api/battlepass        - Текущий Battle Pass
POST /api/battlepass/claim  - Забрать награду
```

## 🔌 WebSocket события

### Клиент → Сервер
| Событие | Описание |
|---------|----------|
| game:search | Поиск противника |
| game:placement-ready | Расстановка готова |
| game:move | Сделать ход |
| game:leave | Покинуть игру |

### Сервер → Клиент
| Событие | Описание |
|---------|----------|
| game:found | Противник найден |
| game:started | Игра началась |
| game:move:result | Результат хода |
| game:finished | Игра завершена |

## 📱 Telegram интеграция

- ✅ Аутентификация через initData
- ✅ Haptic Feedback (тактильная отдача)
- ✅ Main Button / Back Button
- ✅ Telegram Payments
- ✅ Шаринг реферальных кодов
- ✅ Автоопределение языка

## 📊 Статистика проекта

| Метрика | Значение |
|---------|----------|
| Файлов кода | 57 |
| Страниц | 12 |
| API endpoints | 25+ |
| Моделей БД | 8 |
| Достижений | 12 |
| Уровней AI | 3 |
| Языков | 2 (RU, EN) |

## 📝 Лицензия

ISC

---

**Разработано согласно ТЗ** 🎮
