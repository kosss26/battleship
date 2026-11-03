/**
 * Game economy & content catalogue. Single source of truth for the server
 * (prices, rewards) and the client (display).
 * Text fields are { ru, en }.
 */
import { mulberry32, hashString, shuffle } from './rng.js'

/* ───────────────────────── Progression ───────────────────────── */

export const MAX_LEVEL = 100
/** XP needed to go from `level` to `level + 1` */
export const xpToNext = (level) => Math.round(120 + (level - 1) * 40 + Math.pow(level - 1, 1.6) * 6)

export function levelFromXp(totalXp) {
  let level = 1
  let rest = totalXp
  while (level < MAX_LEVEL && rest >= xpToNext(level)) {
    rest -= xpToNext(level)
    level++
  }
  return { level, xpInLevel: rest, xpForLevel: xpToNext(level) }
}

/** Reward granted when reaching a level */
export const levelUpReward = (level) => ({ gold: 100 + level * 20, gems: level % 5 === 0 ? 15 : 0 })

export const RANKS = [
  { min: 0, id: 'recruit', icon: '⚓', name: { ru: 'Юнга', en: 'Deckhand' } },
  { min: 1100, id: 'sailor', icon: '🧭', name: { ru: 'Матрос', en: 'Sailor' } },
  { min: 1250, id: 'bosun', icon: '🎖️', name: { ru: 'Боцман', en: 'Bosun' } },
  { min: 1400, id: 'lieutenant', icon: '⭐', name: { ru: 'Лейтенант', en: 'Lieutenant' } },
  { min: 1600, id: 'captain', icon: '🌟', name: { ru: 'Капитан', en: 'Captain' } },
  { min: 1800, id: 'commodore', icon: '💫', name: { ru: 'Коммодор', en: 'Commodore' } },
  { min: 2000, id: 'admiral', icon: '👑', name: { ru: 'Адмирал', en: 'Admiral' } },
]
export const rankFor = (rating) => [...RANKS].reverse().find((r) => rating >= r.min) || RANKS[0]

/* ───────────────────────── Match rewards ───────────────────────── */

export const MATCH_REWARDS = {
  ai: {
    easy: { win: { gold: 30, xp: 40 }, loss: { gold: 8, xp: 15 } },
    medium: { win: { gold: 60, xp: 70 }, loss: { gold: 12, xp: 25 } },
    hard: { win: { gold: 100, xp: 110 }, loss: { gold: 18, xp: 35 } },
    expert: { win: { gold: 150, xp: 150 }, loss: { gold: 25, xp: 45 } },
  },
  ranked: { win: { gold: 80, xp: 100 }, loss: { gold: 20, xp: 40 } },
  duel: { win: { gold: 50, xp: 80 }, loss: { gold: 20, xp: 40 } },
}
/** Duel rewards only for this many duels per day (anti-farming) */
export const DUEL_REWARDS_PER_DAY = 10

/* ───────────────────────── Cosmetics ───────────────────────── */

export const RARITY = {
  common: { color: '#94a3b8', name: { ru: 'Обычный', en: 'Common' } },
  rare: { color: '#38bdf8', name: { ru: 'Редкий', en: 'Rare' } },
  epic: { color: '#a78bfa', name: { ru: 'Эпический', en: 'Epic' } },
  legendary: { color: '#fbbf24', name: { ru: 'Легендарный', en: 'Legendary' } },
}

/** Board themes: CSS variables applied to the battle grid */
export const THEMES = [
  {
    id: 'theme_ocean', rarity: 'common', price: null,
    name: { ru: 'Океан', en: 'Ocean' },
    vars: { water: '#0b3b5c', water2: '#0e4f7a', grid: 'rgba(125,211,252,0.18)', glow: '#38bdf8', miss: '#7dd3fc' },
  },
  {
    id: 'theme_night', rarity: 'rare', price: { gold: 2500 },
    name: { ru: 'Ночная операция', en: 'Night Ops' },
    vars: { water: '#06131f', water2: '#0b2233', grid: 'rgba(74,222,128,0.20)', glow: '#4ade80', miss: '#86efac' },
  },
  {
    id: 'theme_arctic', rarity: 'rare', price: { gold: 3000 },
    name: { ru: 'Арктика', en: 'Arctic' },
    vars: { water: '#1e3a5f', water2: '#3b6aa0', grid: 'rgba(255,255,255,0.28)', glow: '#e0f2fe', miss: '#f0f9ff' },
  },
  {
    id: 'theme_lava', rarity: 'epic', price: { gems: 150 },
    name: { ru: 'Вулкан', en: 'Volcano' },
    vars: { water: '#2a0a0a', water2: '#4a1208', grid: 'rgba(251,146,60,0.25)', glow: '#fb923c', miss: '#fdba74' },
  },
  {
    id: 'theme_synth', rarity: 'epic', price: { gems: 200 },
    name: { ru: 'Синтвейв', en: 'Synthwave' },
    vars: { water: '#1a0b2e', water2: '#341463', grid: 'rgba(244,114,182,0.30)', glow: '#f472b6', miss: '#f9a8d4' },
  },
  {
    id: 'theme_gold', rarity: 'legendary', price: { gems: 450 },
    name: { ru: 'Золотой флот', en: 'Golden Fleet' },
    vars: { water: '#1c1405', water2: '#3d2b07', grid: 'rgba(251,191,36,0.30)', glow: '#fbbf24', miss: '#fde68a' },
  },
]

/** Ship skins: hull gradient + deck colour */
export const SHIP_SKINS = [
  { id: 'ship_steel', rarity: 'common', price: null, name: { ru: 'Сталь', en: 'Steel' }, hull: ['#94a3b8', '#475569'], deck: '#cbd5e1' },
  { id: 'ship_camo', rarity: 'rare', price: { gold: 2000 }, name: { ru: 'Камуфляж', en: 'Camo' }, hull: ['#65a30d', '#365314'], deck: '#a3e635' },
  { id: 'ship_stealth', rarity: 'rare', price: { gold: 3500 }, name: { ru: 'Стелс', en: 'Stealth' }, hull: ['#334155', '#020617'], deck: '#64748b' },
  { id: 'ship_pirate', rarity: 'epic', price: { gems: 180 }, name: { ru: 'Пиратский', en: 'Pirate' }, hull: ['#b45309', '#451a03'], deck: '#fcd34d' },
  { id: 'ship_cyber', rarity: 'epic', price: { gems: 220 }, name: { ru: 'Кибер', en: 'Cyber' }, hull: ['#22d3ee', '#7c3aed'], deck: '#f0abfc' },
  { id: 'ship_royal', rarity: 'legendary', price: { gems: 500 }, name: { ru: 'Королевский', en: 'Royal' }, hull: ['#fde047', '#b45309'], deck: '#fff7ed' },
  { id: 'ship_season', rarity: 'legendary', price: null, exclusive: 'pass', name: { ru: 'Флагман сезона', en: 'Season Flagship' }, hull: ['#f43f5e', '#7e22ce'], deck: '#fecdd3' },
]

/** Shot effects */
export const EFFECTS = [
  { id: 'fx_fire', rarity: 'common', price: null, name: { ru: 'Пламя', en: 'Fire' }, icon: '🔥', colors: ['#f97316', '#facc15'] },
  { id: 'fx_plasma', rarity: 'rare', price: { gold: 2500 }, name: { ru: 'Плазма', en: 'Plasma' }, icon: '⚡', colors: ['#22d3ee', '#a78bfa'] },
  { id: 'fx_toxic', rarity: 'epic', price: { gems: 150 }, name: { ru: 'Токсин', en: 'Toxic' }, icon: '☢️', colors: ['#84cc16', '#facc15'] },
  { id: 'fx_firework', rarity: 'legendary', price: { gems: 350 }, name: { ru: 'Салют', en: 'Fireworks' }, icon: '🎆', colors: ['#f472b6', '#38bdf8', '#facc15'] },
]

/** Avatar frames */
export const FRAMES = [
  { id: 'frame_none', rarity: 'common', price: null, name: { ru: 'Без рамки', en: 'None' }, ring: 'transparent' },
  { id: 'frame_silver', rarity: 'rare', price: { gold: 1500 }, name: { ru: 'Серебро', en: 'Silver' }, ring: 'linear-gradient(135deg,#e2e8f0,#64748b)' },
  { id: 'frame_neon', rarity: 'epic', price: { gems: 120 }, name: { ru: 'Неон', en: 'Neon' }, ring: 'linear-gradient(135deg,#22d3ee,#a855f7,#f43f5e)' },
  { id: 'frame_admiral', rarity: 'legendary', price: null, exclusive: 'pass', name: { ru: 'Адмиральская', en: 'Admiral' }, ring: 'linear-gradient(135deg,#fde047,#f59e0b,#fde047)' },
]

export const COSMETIC_SLOTS = { theme: THEMES, ship: SHIP_SKINS, effect: EFFECTS, frame: FRAMES }
export const DEFAULT_EQUIPPED = { theme: 'theme_ocean', ship: 'ship_steel', effect: 'fx_fire', frame: 'frame_none' }
export const DEFAULT_OWNED = Object.values(DEFAULT_EQUIPPED)

export function findCosmetic(id) {
  for (const [slot, list] of Object.entries(COSMETIC_SLOTS)) {
    const item = list.find((i) => i.id === id)
    if (item) return { slot, item }
  }
  return null
}

/* ───────────────────────── Boosters ───────────────────────── */
/* Only usable vs AI and in the campaign — ranked stays skill-only. */

export const BOOSTERS = {
  radar: {
    id: 'radar', icon: '📡', price: { gold: 250 },
    name: { ru: 'Радар', en: 'Radar' },
    desc: { ru: 'Сканирует зону 3×3 и показывает, сколько там палуб', en: 'Scans a 3×3 area and reveals how many ship cells are inside' },
  },
  barrage: {
    id: 'barrage', icon: '💥', price: { gold: 400 },
    name: { ru: 'Залп', en: 'Barrage' },
    desc: { ru: 'Удар крестом по 5 клеткам за один ход', en: 'Strikes 5 cells in a cross pattern in one turn' },
  },
}
export const BOOSTERS_PER_MATCH = 2

/* ───────────────────────── Premium shop (Telegram Stars) ───────────────────────── */

export const STAR_PRODUCTS = [
  { id: 'gems_80', kind: 'gems', stars: 50, gems: 80, title: { ru: 'Горсть кристаллов', en: 'Handful of Gems' }, icon: '💎' },
  { id: 'gems_450', kind: 'gems', stars: 250, gems: 450, bonus: 10, title: { ru: 'Мешок кристаллов', en: 'Bag of Gems' }, icon: '💎' },
  { id: 'gems_1000', kind: 'gems', stars: 500, gems: 1000, bonus: 25, popular: true, title: { ru: 'Сундук кристаллов', en: 'Chest of Gems' }, icon: '💎' },
  { id: 'gems_2200', kind: 'gems', stars: 1000, gems: 2200, bonus: 37, title: { ru: 'Трюм кристаллов', en: 'Hold of Gems' }, icon: '💎' },
  { id: 'gems_6000', kind: 'gems', stars: 2500, gems: 6000, bonus: 50, best: true, title: { ru: 'Сокровищница', en: 'Treasury' }, icon: '👑' },
  {
    id: 'starter', kind: 'bundle', stars: 99, oncePerUser: true,
    title: { ru: 'Набор новобранца', en: 'Starter Pack' }, icon: '🎁',
    grant: { gems: 300, gold: 3000, boosters: { radar: 5, barrage: 3 }, cosmetics: ['ship_camo'] },
    desc: { ru: '300 💎 + 3000 🪙 + 8 бустеров + скин «Камуфляж»', en: '300 💎 + 3000 🪙 + 8 boosters + Camo skin' },
  },
  {
    id: 'pass_premium', kind: 'pass', stars: 299,
    title: { ru: 'Премиум-пропуск', en: 'Premium Pass' }, icon: '🏆',
    desc: { ru: 'Премиум-награды сезона и +20% золота', en: 'Premium season rewards and +20% gold' },
  },
]
export const PASS_PREMIUM_GEMS = 800
export const PREMIUM_GOLD_BONUS = 0.2

/** Gems → gold exchange */
export const GOLD_EXCHANGE = [
  { id: 'gold_s', gems: 50, gold: 1000 },
  { id: 'gold_m', gems: 200, gold: 4500 },
  { id: 'gold_l', gems: 500, gold: 12500 },
]

export const findStarProduct = (id) => STAR_PRODUCTS.find((p) => p.id === id)

/* ───────────────────────── Daily login reward ───────────────────────── */

export const DAILY_REWARDS = [
  { gold: 100 },
  { gold: 150 },
  { gems: 10 },
  { gold: 250, boosters: { radar: 1 } },
  { gold: 300 },
  { boosters: { radar: 1, barrage: 1 } },
  { gold: 500, gems: 30 },
]

/* ───────────────────────── Daily quests ───────────────────────── */

export const QUESTS = [
  { id: 'play3', event: 'played', target: 3, reward: { gold: 80, passXp: 60 }, title: { ru: 'Сыграй 3 боя', en: 'Play 3 battles' } },
  { id: 'win2', event: 'won', target: 2, reward: { gold: 120, passXp: 80 }, title: { ru: 'Победи 2 раза', en: 'Win 2 battles' } },
  { id: 'sink10', event: 'sunk', target: 10, reward: { gold: 100, passXp: 70 }, title: { ru: 'Потопи 10 кораблей', en: 'Sink 10 ships' } },
  { id: 'hits25', event: 'hits', target: 25, reward: { gold: 90, passXp: 60 }, title: { ru: 'Попади 25 раз', en: 'Land 25 hits' } },
  { id: 'hard1', event: 'won_hard', target: 1, reward: { gold: 150, gems: 5, passXp: 100 }, title: { ru: 'Победи сложный ИИ', en: 'Beat the Hard AI' } },
  { id: 'pvp1', event: 'won_pvp', target: 1, reward: { gold: 150, gems: 5, passXp: 100 }, title: { ru: 'Победи в рейтинговом бою', en: 'Win a ranked battle' } },
  { id: 'camp2', event: 'campaign_win', target: 2, reward: { gold: 120, passXp: 80 }, title: { ru: 'Пройди 2 уровня кампании', en: 'Clear 2 campaign levels' } },
  { id: 'acc60', event: 'accurate_win', target: 1, reward: { gold: 130, passXp: 90 }, title: { ru: 'Победи с точностью 60%+', en: 'Win with 60%+ accuracy' } },
  { id: 'duel1', event: 'played_duel', target: 1, reward: { gold: 100, passXp: 80 }, title: { ru: 'Сыграй с другом', en: 'Play with a friend' } },
  { id: 'fast1', event: 'fast_win', target: 1, reward: { gold: 140, passXp: 90 }, title: { ru: 'Победи меньше чем за 45 выстрелов', en: 'Win in under 45 shots' } },
]
export const QUESTS_PER_DAY = 3

/** Deterministic set of quests for a user and a UTC date (YYYY-MM-DD) */
export function questsForDay(userId, day) {
  const rng = mulberry32(hashString(`${userId}:${day}`))
  return shuffle(QUESTS, rng).slice(0, QUESTS_PER_DAY).map((q) => q.id)
}

/* ───────────────────────── Battle pass ───────────────────────── */

export const PASS_TIERS = 30
export const PASS_XP_PER_TIER = 250

export function passRewards(tier) {
  // tier: 1..PASS_TIERS
  const free =
    tier % 10 === 0 ? { gems: 50 }
      : tier % 5 === 0 ? { boosters: { radar: 1, barrage: 1 } }
        : tier % 2 === 0 ? { gold: 150 + tier * 10 } : { gold: 100 + tier * 5 }
  let premium
  if (tier === PASS_TIERS) premium = { cosmetics: ['ship_season', 'frame_admiral'], gems: 200 }
  else if (tier === 15) premium = { cosmetics: ['theme_synth'], gems: 50 }
  else if (tier % 5 === 0) premium = { gems: 60, boosters: { barrage: 2 } }
  else if (tier % 3 === 0) premium = { gems: 25 }
  else premium = { gold: 300 + tier * 15, boosters: tier % 2 ? { radar: 1 } : undefined }
  return { free, premium }
}

export const seasonId = (date = new Date()) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

export function seasonEnds(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString()
}

/* ───────────────────────── Achievements ───────────────────────── */
/* `stat` refers to user.stats keys. */

export const ACHIEVEMENTS = [
  { id: 'first_win', stat: 'wins', goal: 1, icon: '🥉', reward: { gold: 100 }, title: { ru: 'Первая кровь', en: 'First Blood' }, desc: { ru: 'Выиграй первый бой', en: 'Win your first battle' } },
  { id: 'wins_10', stat: 'wins', goal: 10, icon: '🎯', reward: { gold: 250 }, title: { ru: 'Охотник', en: 'Hunter' }, desc: { ru: 'Выиграй 10 боёв', en: 'Win 10 battles' } },
  { id: 'wins_50', stat: 'wins', goal: 50, icon: '⚔️', reward: { gold: 600, gems: 20 }, title: { ru: 'Мастер флота', en: 'Fleet Master' }, desc: { ru: 'Выиграй 50 боёв', en: 'Win 50 battles' } },
  { id: 'wins_200', stat: 'wins', goal: 200, icon: '🏛️', reward: { gems: 100 }, title: { ru: 'Живая легенда', en: 'Living Legend' }, desc: { ru: 'Выиграй 200 боёв', en: 'Win 200 battles' } },
  { id: 'games_25', stat: 'games', goal: 25, icon: '🧭', reward: { gold: 200 }, title: { ru: 'Морской волк', en: 'Sea Wolf' }, desc: { ru: 'Сыграй 25 боёв', en: 'Play 25 battles' } },
  { id: 'games_100', stat: 'games', goal: 100, icon: '⚓', reward: { gold: 500, gems: 20 }, title: { ru: 'Ветеран', en: 'Veteran' }, desc: { ru: 'Сыграй 100 боёв', en: 'Play 100 battles' } },
  { id: 'sunk_100', stat: 'sunk', goal: 100, icon: '🌊', reward: { gold: 300 }, title: { ru: 'Гроза морей', en: 'Scourge of Seas' }, desc: { ru: 'Потопи 100 кораблей', en: 'Sink 100 ships' } },
  { id: 'sunk_1000', stat: 'sunk', goal: 1000, icon: '🌀', reward: { gems: 80 }, title: { ru: 'Кракен', en: 'Kraken' }, desc: { ru: 'Потопи 1000 кораблей', en: 'Sink 1000 ships' } },
  { id: 'streak_3', stat: 'bestStreak', goal: 3, icon: '🔥', reward: { gold: 200 }, title: { ru: 'В ударе', en: 'On Fire' }, desc: { ru: 'Выиграй 3 боя подряд', en: 'Win 3 in a row' } },
  { id: 'streak_10', stat: 'bestStreak', goal: 10, icon: '☄️', reward: { gems: 50 }, title: { ru: 'Неудержимый', en: 'Unstoppable' }, desc: { ru: 'Выиграй 10 боёв подряд', en: 'Win 10 in a row' } },
  { id: 'hit_chain_8', stat: 'bestHitChain', goal: 8, icon: '🎯', reward: { gold: 300 }, title: { ru: 'Снайпер', en: 'Sniper' }, desc: { ru: '8 попаданий подряд', en: '8 hits in a row' } },
  { id: 'perfect', stat: 'perfectWins', goal: 1, icon: '💎', reward: { gems: 30 }, title: { ru: 'Без единой царапины', en: 'Flawless' }, desc: { ru: 'Победи, не потеряв ни одного корабля', en: 'Win without losing a single ship' } },
  { id: 'fast_win', stat: 'fastWins', goal: 1, icon: '⚡', reward: { gold: 400 }, title: { ru: 'Блицкриг', en: 'Blitz' }, desc: { ru: 'Победи меньше чем за 35 выстрелов', en: 'Win in under 35 shots' } },
  { id: 'beat_hard', stat: 'hardWins', goal: 1, icon: '🧠', reward: { gold: 300 }, title: { ru: 'Умнее машины', en: 'Smarter than AI' }, desc: { ru: 'Победи сложный ИИ', en: 'Beat the Hard AI' } },
  { id: 'beat_expert', stat: 'expertWins', goal: 1, icon: '🤖', reward: { gems: 40 }, title: { ru: 'Терминатор', en: 'Terminator' }, desc: { ru: 'Победи ИИ «Эксперт»', en: 'Beat the Expert AI' } },
  { id: 'pvp_10', stat: 'pvpWins', goal: 10, icon: '🏅', reward: { gold: 500 }, title: { ru: 'Дуэлянт', en: 'Duelist' }, desc: { ru: '10 побед в рейтинге', en: '10 ranked wins' } },
  { id: 'rating_1400', stat: 'peakRating', goal: 1400, icon: '⭐', reward: { gems: 30 }, title: { ru: 'Офицер', en: 'Officer' }, desc: { ru: 'Достигни рейтинга 1400', en: 'Reach 1400 rating' } },
  { id: 'rating_2000', stat: 'peakRating', goal: 2000, icon: '👑', reward: { gems: 150 }, title: { ru: 'Адмирал', en: 'Admiral' }, desc: { ru: 'Достигни рейтинга 2000', en: 'Reach 2000 rating' } },
  { id: 'friends_1', stat: 'referrals', goal: 1, icon: '🤝', reward: { gold: 200 }, title: { ru: 'Вербовщик', en: 'Recruiter' }, desc: { ru: 'Пригласи друга', en: 'Invite a friend' } },
  { id: 'friends_10', stat: 'referrals', goal: 10, icon: '📣', reward: { gems: 60 }, title: { ru: 'Адмирал флотилии', en: 'Flotilla Admiral' }, desc: { ru: 'Пригласи 10 друзей', en: 'Invite 10 friends' } },
  { id: 'duels_5', stat: 'duels', goal: 5, icon: '🫱', reward: { gold: 250 }, title: { ru: 'Свои люди', en: 'Old Friends' }, desc: { ru: 'Сыграй 5 дуэлей с друзьями', en: 'Play 5 duels with friends' } },
  { id: 'camp_10', stat: 'campaignStars', goal: 10, icon: '🗺️', reward: { gold: 300 }, title: { ru: 'Первооткрыватель', en: 'Explorer' }, desc: { ru: 'Собери 10 звёзд кампании', en: 'Earn 10 campaign stars' } },
  { id: 'camp_90', stat: 'campaignStars', goal: 90, icon: '🌟', reward: { gems: 120 }, title: { ru: 'Покоритель морей', en: 'Sea Conqueror' }, desc: { ru: 'Собери все 90 звёзд кампании', en: 'Earn all 90 campaign stars' } },
  { id: 'collector', stat: 'cosmetics', goal: 8, icon: '🎨', reward: { gems: 40 }, title: { ru: 'Коллекционер', en: 'Collector' }, desc: { ru: 'Собери 8 предметов коллекции', en: 'Own 8 collection items' } },
  { id: 'daily_7', stat: 'bestDailyStreak', goal: 7, icon: '📅', reward: { gems: 25 }, title: { ru: 'Верный курс', en: 'Steady Course' }, desc: { ru: 'Заходи 7 дней подряд', en: 'Log in 7 days in a row' } },
]

/* ───────────────────────── Campaign ───────────────────────── */

export const CHAPTERS = [
  { id: 1, icon: '🏝️', name: { ru: 'Тихая бухта', en: 'Quiet Bay' }, color: '#38bdf8' },
  { id: 2, icon: '🌫️', name: { ru: 'Туманный пролив', en: 'Misty Strait' }, color: '#a78bfa' },
  { id: 3, icon: '🌋', name: { ru: 'Огненный архипелаг', en: 'Fire Archipelago' }, color: '#fb923c' },
]
export const LEVELS_PER_CHAPTER = 10

/**
 * Level n (1..30). Stars: 1 = win, 2 = win within `shots2` shots, 3 = win within `shots3` shots.
 */
export const CAMPAIGN = Array.from({ length: CHAPTERS.length * LEVELS_PER_CHAPTER }, (_, i) => {
  const n = i + 1
  const chapter = Math.ceil(n / LEVELS_PER_CHAPTER)
  const ai = n <= 6 ? 'easy' : n <= 14 ? 'medium' : n <= 24 ? 'hard' : 'expert'
  const boss = n % LEVELS_PER_CHAPTER === 0
  return {
    n,
    chapter,
    ai,
    boss,
    shots2: Math.max(42, 75 - n),
    shots3: Math.max(34, 60 - n),
    reward: {
      gold: 60 + n * 12 + (boss ? 200 : 0),
      xp: 50 + n * 6,
      gems: boss ? 25 * chapter : 0,
    },
  }
})

export const CAMPAIGN_STAR_GOLD = 25

/** Telegram deep-link start params */
export const START_PARAM = { ref: 'ref_', duel: 'duel_' }
