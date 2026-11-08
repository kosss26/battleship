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
  {
    id: 'theme_imperial', rarity: 'legendary', price: { gems: 450 },
    name: { ru: 'Императорские воды', en: 'Imperial Waters' },
    vars: { water: '#081b30', water2: '#183b57', grid: 'rgba(225,191,124,0.32)', glow: '#d8b775', miss: '#c5e4f5' },
  },
]

/** Ship skins: hull gradient + deck colour */
export const SHIP_SKINS = [
  { id: 'ship_steel', rarity: 'common', price: null, name: { ru: 'Сталь', en: 'Steel' }, hull: ['#94a3b8', '#475569'], deck: '#cbd5e1' },
  { id: 'ship_camo', rarity: 'rare', price: { gold: 2000 }, name: { ru: 'Камуфляж', en: 'Camo' }, hull: ['#65a30d', '#365314'], deck: '#a3e635' },
  { id: 'ship_stealth', rarity: 'rare', price: { gold: 3500 }, name: { ru: 'Стелс', en: 'Stealth' }, hull: ['#334155', '#020617'], deck: '#64748b' },
  { id: 'ship_pirate', rarity: 'epic', price: { gems: 180 }, name: { ru: 'Пиратский', en: 'Pirate' }, hull: ['#b45309', '#451a03'], deck: '#fcd34d' },
  { id: 'ship_cyber', rarity: 'epic', price: { gems: 220 }, name: { ru: 'Кибер', en: 'Cyber' }, hull: ['#22d3ee', '#7c3aed'], deck: '#f0abfc' },
  { id: 'ship_royal', rarity: 'legendary', price: { gems: 500 }, name: { ru: 'Королевский', en: 'Royal' }, hull: ['#334b60', '#0b192c'], deck: '#a88d59', model: 'imperial', accent: '#e6c780' },
  { id: 'ship_arctic', rarity: 'epic', price: { gems: 180 }, name: { ru: 'Полярный', en: 'Polar' }, hull: ['#e7f3fc', '#738fa8'], deck: '#c0d4e3', model: 'arctic', accent: '#9ee7ff' },
  { id: 'ship_season', rarity: 'legendary', price: null, exclusive: 'pass', name: { ru: 'Флагман сезона', en: 'Season Flagship' }, hull: ['#f43f5e', '#7e22ce'], deck: '#fecdd3' },
  { id: 'ship_regent', demo: true, rarity: 'legendary', price: null,
    name: { ru: 'Регент', en: 'Regent' }, model: 'regent',
    hull: ['#334552', '#101c27'], deck: '#9e7245', accent: '#d9b875',
    description: { ru: 'Четыре отдельных класса кораблей. Бесплатная демонстрация флота.', en: 'Four distinct ship classes. A free fleet demonstration.' } },
]

export function battleShipSkin(game, equippedId) {
  const id = game?.demoFleet === 'regent' ? 'ship_regent' : equippedId
  return SHIP_SKINS.find(s => s.id === id) || SHIP_SKINS.find(s => s.id === 'ship_steel')
}

/** Shot effects */
export const EFFECTS = [
  { id: 'fx_fire', rarity: 'common', price: null, name: { ru: 'Пламя', en: 'Fire' }, icon: '🔥', colors: ['#f97316', '#facc15'] },
  { id: 'fx_plasma', rarity: 'rare', price: { gold: 2500 }, name: { ru: 'Плазма', en: 'Plasma' }, icon: '⚡', colors: ['#22d3ee', '#a78bfa'] },
  { id: 'fx_toxic', rarity: 'epic', price: { gems: 150 }, name: { ru: 'Токсин', en: 'Toxic' }, icon: '☢️', colors: ['#84cc16', '#facc15'] },
  { id: 'fx_firework', rarity: 'legendary', price: { gems: 350 }, name: { ru: 'Салют', en: 'Fireworks' }, icon: '🎆', colors: ['#f472b6', '#38bdf8', '#facc15'] },
  { id: 'fx_arctic', rarity: 'epic', price: { gems: 180 }, model: 'arctic', name: { ru: 'Полярный залп', en: 'Polar Salvo' }, icon: '❄️', colors: ['#64c8ef', '#edfcff', '#478ebd'], description: { ru: 'Ледяной след снаряда, осколки инея, холодные всплески и пена при потоплении.', en: 'An ice-blue shell trail, frost fragments, cold splashes and a foaming sinking wake.' } },
  { id: 'fx_imperial', rarity: 'legendary', price: { gems: 250 }, model: 'imperial', name: { ru: 'Адмиральский залп', en: 'Admiral’s Salvo' }, icon: '⚓', colors: ['#d5a956', '#fff1c9', '#67879f'], description: { ru: 'Латунный снаряд, тёплые искры, морской всплеск и дым над уходящим под воду корпусом.', en: 'A brass shell, warm sparks, a sea-water splash and smoke above the sinking hull.' } },
]

/** Avatar frames */
export const FRAMES = [
  { id: 'frame_none', rarity: 'common', price: null, name: { ru: 'Без рамки', en: 'None' }, ring: 'transparent' },
  { id: 'frame_silver', rarity: 'rare', price: { gold: 1500 }, name: { ru: 'Серебро', en: 'Silver' }, ring: 'linear-gradient(135deg,#e2e8f0,#64748b)' },
  { id: 'frame_neon', rarity: 'epic', price: { gems: 120 }, name: { ru: 'Неон', en: 'Neon' }, ring: 'linear-gradient(135deg,#22d3ee,#a855f7,#f43f5e)' },
  { id: 'frame_admiral', rarity: 'legendary', price: null, exclusive: 'pass', name: { ru: 'Адмиральская', en: 'Admiral' }, ring: 'linear-gradient(135deg,#fde047,#f59e0b,#fde047)' },
  { id: 'frame_officer', rarity: 'epic', price: null, exclusive: 'season', name: { ru: 'Офицер сезона', en: 'Season Officer' }, ring: 'conic-gradient(from 0deg,#38bdf8,#e0f2fe,#38bdf8,#0ea5e9,#38bdf8)' },
  { id: 'frame_legend', rarity: 'legendary', price: null, exclusive: 'season', name: { ru: 'Легенда сезона', en: 'Season Legend' }, ring: 'conic-gradient(from 0deg,#f43f5e,#fbbf24,#22d3ee,#a855f7,#f43f5e)' },
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

/** Curated looks. Components use the normal cosmetic purchase/equip endpoints. */
export const FLEET_COLLECTIONS = [
  {
    id: 'arctic', themeId: 'theme_arctic', shipId: 'ship_arctic', effectId: 'fx_arctic',
    name: { ru: 'Арктика', en: 'Arctic' },
    tagline: { ru: 'Холодная сталь. Чистая тактика.', en: 'Cold steel. Clear tactics.' },
    description: { ru: 'Зимний камуфляж, ледяные огни и холодные воды. Все корабли сохраняют обычные размеры и правила боя.', en: 'Winter camouflage, ice-blue lights and polar waters. Ship sizes and battle rules stay the same.' },
  },
  {
    id: 'imperial', themeId: 'theme_imperial', shipId: 'ship_royal', effectId: 'fx_imperial',
    name: { ru: 'Императорский флот', en: 'Imperial Fleet' },
    tagline: { ru: 'Тёмная сталь. Золотые детали.', en: 'Midnight steel. Golden details.' },
    description: { ru: 'Латунная окантовка, тиковая палуба и глубокое синее море. Королевский скин остаётся доступен его владельцам.', en: 'Brass trim, a teak deck and deep blue water. Existing Royal owners keep their ship skin.' },
  },
]

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
  { id: 'camp_90', stat: 'campaignStars', goal: 90, icon: '🌟', reward: { gems: 120 }, title: { ru: 'Покоритель морей', en: 'Sea Conqueror' }, desc: { ru: 'Собери 90 звёзд кампании', en: 'Earn 90 campaign stars' } },
  { id: 'camp_180', stat: 'campaignStars', goal: 180, icon: '🐙', reward: { gems: 250 }, title: { ru: 'Укротитель Кракена', en: 'Kraken Tamer' }, desc: { ru: 'Собери все 180 звёзд кампании', en: 'Earn all 180 campaign stars' } },
  { id: 'collector', stat: 'cosmetics', goal: 8, icon: '🎨', reward: { gems: 40 }, title: { ru: 'Коллекционер', en: 'Collector' }, desc: { ru: 'Собери 8 предметов коллекции', en: 'Own 8 collection items' } },
  { id: 'daily_7', stat: 'bestDailyStreak', goal: 7, icon: '📅', reward: { gems: 25 }, title: { ru: 'Верный курс', en: 'Steady Course' }, desc: { ru: 'Заходи 7 дней подряд', en: 'Log in 7 days in a row' } },
]

/* ───────────────────────── Campaign ───────────────────────── */

export const CHAPTERS = [
  { id: 1, icon: '🏝️', name: { ru: 'Тихая бухта', en: 'Quiet Bay' }, color: '#38bdf8' },
  { id: 2, icon: '🌫️', name: { ru: 'Туманный пролив', en: 'Misty Strait' }, color: '#a78bfa' },
  { id: 3, icon: '🌋', name: { ru: 'Огненный архипелаг', en: 'Fire Archipelago' }, color: '#fb923c' },
  { id: 4, icon: '🪸', name: { ru: 'Туманные рифы', en: 'Fog Reefs' }, color: '#94a3b8' },
  { id: 5, icon: '⛈️', name: { ru: 'Штормовой фронт', en: 'Storm Front' }, color: '#facc15' },
  { id: 6, icon: '🐙', name: { ru: 'Логово Кракена', en: "Kraken's Lair" }, color: '#e879f9' },
]

/**
 * Special rules for campaign missions 31–60. All are enforced by the server.
 *  fog        — your misses vanish from the map after FOG_MEMORY of your shots
 *  noHalo     — cells around sunk ships are not auto-marked
 *  ammo       — limited number of shots; running out is a defeat
 *  blitz      — BLITZ_MS per turn, then a random shot is fired for you
 *  enemyFirst — the enemy opens fire
 *  noBoosters — boosters are disabled
 */
export const MODIFIERS = {
  fog: { icon: '🌫️', name: { ru: 'Туман войны', en: 'Fog of War' }, desc: { ru: 'Ваши промахи исчезают с карты через 5 выстрелов', en: 'Your misses fade from the map after 5 shots' } },
  noHalo: { icon: '🙈', name: { ru: 'Без подсказок', en: 'No Hints' }, desc: { ru: 'Клетки вокруг потопленных кораблей не отмечаются', en: 'Cells around sunk ships are not marked' } },
  ammo: { icon: '🎯', name: { ru: 'Ограниченный боезапас', en: 'Limited Ammo' }, desc: { ru: 'Всего {n} выстрелов — не успели, поражение', en: 'Only {n} shots — run out and you lose' } },
  blitz: { icon: '⚡', name: { ru: 'Блиц', en: 'Blitz' }, desc: { ru: '10 секунд на ход', en: '10 seconds per turn' } },
  enemyFirst: { icon: '🏴‍☠️', name: { ru: 'Засада', en: 'Ambush' }, desc: { ru: 'Противник стреляет первым', en: 'The enemy fires first' } },
  noBoosters: { icon: '🚫', name: { ru: 'Без бустеров', en: 'No Boosters' }, desc: { ru: 'Бустеры недоступны', en: 'Boosters are disabled' } },
}
export const FOG_MEMORY = 5
export const BLITZ_MS = 10_000

// Missions 31–60: [modifiers] per mission, in order
const HARD_MISSIONS = [
  // Chapter 4 — Fog Reefs
  { noHalo: 1 }, { fog: 1 }, { noHalo: 1 }, { fog: 1, enemyFirst: 1 }, { noHalo: 1, enemyFirst: 1 },
  { fog: 1 }, { fog: 1, noHalo: 1 }, { noHalo: 1, noBoosters: 1 }, { fog: 1, enemyFirst: 1 }, { fog: 1, noHalo: 1, enemyFirst: 1 },
  // Chapter 5 — Storm Front
  { blitz: 1 }, { ammo: 80 }, { blitz: 1, enemyFirst: 1 }, { ammo: 76 }, { blitz: 1, noHalo: 1 },
  { ammo: 74, enemyFirst: 1 }, { blitz: 1, fog: 1 }, { ammo: 74, noHalo: 1 }, { blitz: 1, ammo: 76 }, { blitz: 1, ammo: 72, enemyFirst: 1 },
  // Chapter 6 — Kraken's Lair
  { fog: 1, ammo: 80 }, { noHalo: 1, blitz: 1 }, { fog: 1, noHalo: 1, noBoosters: 1 }, { ammo: 72, fog: 1 }, { blitz: 1, fog: 1, noHalo: 1 },
  { ammo: 70, enemyFirst: 1, noBoosters: 1 }, { fog: 1, noHalo: 1, ammo: 76 }, { blitz: 1, ammo: 72, fog: 1 },
  { fog: 1, noHalo: 1, blitz: 1, enemyFirst: 1 }, { fog: 1, noHalo: 1, ammo: 74, enemyFirst: 1, noBoosters: 1 },
]
export const LEVELS_PER_CHAPTER = 10

/**
 * Level n (1..60). Stars: 1 = win, 2 = win within `shots2` shots, 3 = win within `shots3` shots.
 * Missions 31+ carry special rules (`mods`).
 */
export const CAMPAIGN = Array.from({ length: CHAPTERS.length * LEVELS_PER_CHAPTER }, (_, i) => {
  const n = i + 1
  const chapter = Math.ceil(n / LEVELS_PER_CHAPTER)
  const ai = n <= 6 ? 'easy' : n <= 14 ? 'medium' : n <= 24 ? 'hard' : n <= 30 ? 'expert' : n <= 40 ? 'hard' : 'expert'
  const boss = n % LEVELS_PER_CHAPTER === 0
  const raw = n > 30 ? HARD_MISSIONS[n - 31] : {}
  const mods = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, k === 'ammo' ? v : true]))
  // Hidden information costs shots, so the star thresholds are looser in the second half
  const shots2 = n > 30 ? Math.min(58, (mods.ammo || 99) - 8) : Math.max(42, 75 - n)
  const shots3 = n > 30 ? Math.min(50, (mods.ammo || 99) - 16) : Math.max(34, 60 - n)
  return {
    n,
    chapter,
    ai,
    boss,
    mods,
    shots2,
    shots3,
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

/* ───────────────────────── Rating seasons ───────────────────────── */
/* A season is a calendar month (UTC), shared with the battle pass. */

export const SEASON_EPOCH = '2026-11' // season #1
export const SEASON_MIN_GAMES = 5 // ranked games needed to qualify for season rewards
export const SEASON_TOP = 100

const SEASON_THEMES = [
  { icon: '🌌', color: '#34d399', to: '#0ea5e9', name: { ru: 'Северное сияние', en: 'Aurora' } },
  { icon: '⛈️', color: '#38bdf8', to: '#6366f1', name: { ru: 'Шторм', en: 'Storm' } },
  { icon: '🏴‍☠️', color: '#fbbf24', to: '#ef4444', name: { ru: 'Пиратская удача', en: "Pirate's Luck" } },
  { icon: '🧊', color: '#93c5fd', to: '#e0f2fe', name: { ru: 'Ледяной фронт', en: 'Ice Front' } },
  { icon: '🌋', color: '#fb923c', to: '#dc2626', name: { ru: 'Огненное кольцо', en: 'Ring of Fire' } },
  { icon: '🐙', color: '#a78bfa', to: '#ec4899', name: { ru: 'Зов глубин', en: 'Call of the Deep' } },
  { icon: '🏝️', color: '#2dd4bf', to: '#facc15', name: { ru: 'Тропический рейд', en: 'Tropical Raid' } },
  { icon: '🌅', color: '#fb7185', to: '#f59e0b', name: { ru: 'Багровый закат', en: 'Crimson Dusk' } },
  { icon: '⚓', color: '#60a5fa', to: '#1e3a8a', name: { ru: 'Флот адмиралтейства', en: 'Admiralty Fleet' } },
  { icon: '🌕', color: '#e2e8f0', to: '#94a3b8', name: { ru: 'Лунный прилив', en: 'Lunar Tide' } },
  { icon: '🐉', color: '#4ade80', to: '#15803d', name: { ru: 'Морской змей', en: 'Sea Serpent' } },
  { icon: '❄️', color: '#bae6fd', to: '#818cf8', name: { ru: 'Полярная ночь', en: 'Polar Night' } },
]

const monthIndex = (id) => {
  const [y, m] = id.split('-').map(Number)
  return y * 12 + (m - 1)
}

export function seasonInfo(id = seasonId()) {
  const n = monthIndex(id) - monthIndex(SEASON_EPOCH) + 1
  const theme = SEASON_THEMES[((n - 1) % SEASON_THEMES.length + SEASON_THEMES.length) % SEASON_THEMES.length]
  const [y, m] = id.split('-').map(Number)
  return {
    id,
    number: Math.max(1, n),
    ...theme,
    startsAt: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
    endsAt: new Date(Date.UTC(y, m, 1)).toISOString(),
  }
}

export function prevSeasonId(id = seasonId()) {
  const i = monthIndex(id) - 1
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
}

/** End-of-season reward by final rank (and a bonus for the global top) */
export const SEASON_REWARDS = {
  recruit: { gold: 200 },
  sailor: { gold: 400 },
  bosun: { gold: 600, gems: 10 },
  lieutenant: { gold: 800, gems: 30 },
  captain: { gems: 60, cosmetics: ['frame_officer'] },
  commodore: { gems: 100, cosmetics: ['frame_officer'] },
  admiral: { gems: 200, cosmetics: ['frame_officer'] },
}
export const SEASON_TOP_BONUS = { gems: 100, cosmetics: ['frame_legend'] }

export function seasonReward(rating, place) {
  const rank = rankFor(rating)
  const base = SEASON_REWARDS[rank.id] || {}
  if (!place || place > SEASON_TOP) return { ...base }
  const bonus = SEASON_TOP_BONUS
  return {
    ...base,
    gems: (base.gems || 0) + bonus.gems,
    cosmetics: [...new Set([...(base.cosmetics || []), ...bonus.cosmetics])],
  }
}

/** Soft reset applied at the start of a new season */
export const seasonResetRating = (rating) => Math.round(1000 + (rating - 1000) / 2)

/* ───────────────────────── Rewarded ads ───────────────────────── */

export const AD_PLACEMENTS = {
  gold: { daily: 5, reward: { gold: 100 } }, // free gold (home, shop)
  booster: { daily: 2, reward: { boosters: { radar: 1 } } }, // free booster (shop)
  double: { daily: 5, maxGold: 300 }, // double the gold from the last battle (results screen)
}
export const AD_DAILY_LIMIT = 10 // all placements together
export const AD_COOLDOWN_MS = 20_000
export const AD_MIN_WATCH_MS = 4_000 // a claim faster than this after start is rejected
export const AD_DOUBLE_WINDOW_MS = 15 * 60_000
