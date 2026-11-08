import {
  MATCH_REWARDS, DAILY_REWARDS, QUESTS, questsForDay, levelFromXp, levelUpReward,
  PASS_TIERS, PASS_XP_PER_TIER, passRewards, CAMPAIGN, CAMPAIGN_STAR_GOLD,
  AD_PLACEMENTS, DUEL_REWARDS_PER_DAY,
} from '../shared/catalog.js'

// Reproducible scenarios, not a prediction of retention or willingness to pay.
const scenarios = [
  { name: 'Новичок', games: 3, modes: ['easy'], winRate: .5, ads: false },
  { name: 'Регулярный', games: 6, modes: ['medium', 'ranked', 'duel'], winRate: .55, ads: false },
  { name: 'Регулярный + реклама', games: 6, modes: ['medium', 'ranked', 'duel'], winRate: .55, ads: true },
  { name: 'Активный + кампания', games: 12, modes: ['hard', 'ranked', 'campaign'], winRate: .6, ads: false },
]
function simulate(model) {
  const balance = { gold: 500, gems: 20, xp: 0, passXp: 0 }
  let tier = 0, level = 1, firstSkin = null, finishedPass = null, mission = 0, random = 12345
  const add = reward => {
    for (const key of Object.keys(balance)) balance[key] += reward?.[key] || 0
    const next = levelFromXp(balance.xp).level
    while (level < next) { level++; const r = levelUpReward(level); balance.gold += r.gold; balance.gems += r.gems }
  }
  for (let day = 1; day <= 30; day++) {
    add(DAILY_REWARDS[(day-1) % 7])
    const events = {}, doubles = []
    let duels = 0
    for (let i = 0; i < model.games; i++) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0
      const won = random / 2**32 < model.winRate
      const mode = model.modes[i % model.modes.length]
      let reward
      if (mode === 'campaign') {
        const stage = CAMPAIGN[Math.min(mission, CAMPAIGN.length-1)]
        if (won && mission < CAMPAIGN.length) {
          const stars = 45 <= stage.shots3 ? 3 : 45 <= stage.shots2 ? 2 : 1
          reward = { ...stage.reward, gold: stage.reward.gold + stars * CAMPAIGN_STAR_GOLD }
          mission++
        } else reward = won ? { gold: 20, xp: 30 } : { gold: 5, xp: 15 }
      } else {
        const source = MATCH_REWARDS[mode] || MATCH_REWARDS.ai[mode]
        reward = mode === 'duel' && ++duels > DUEL_REWARDS_PER_DAY ? {} : source[won ? 'win' : 'loss']
      }
      add({ ...reward, passXp: reward.xp || 0 })
      doubles.push(Math.min(reward.gold || 0, AD_PLACEMENTS.double.maxGold))
      const values = { played: 1, won: +won, sunk: won ? 10 : 6, hits: won ? 20 : 12,
        won_hard: +(won && mode === 'hard'), won_pvp: +(won && mode === 'ranked'),
        campaign_win: +(won && mode === 'campaign'), played_duel: +(mode === 'duel'),
        accurate_win: 0, fast_win: 0 }
      for (const [key, n] of Object.entries(values)) events[key] = (events[key] || 0) + n
    }
    const date = `2026-11-${String(day).padStart(2,'0')}`
    for (const id of questsForDay(1, date)) {
      const q = QUESTS.find(q => q.id === id)
      if ((events[q.event] || 0) >= q.target) add(q.reward)
    }
    if (model.ads) {
      add({ gold: AD_PLACEMENTS.gold.daily * AD_PLACEMENTS.gold.reward.gold })
      add({ gold: doubles.slice(0, AD_PLACEMENTS.double.daily).reduce((a,b) => a+b, 0) })
    }
    const unlocked = Math.min(PASS_TIERS, Math.floor(balance.passXp / PASS_XP_PER_TIER))
    while (tier < unlocked) add(passRewards(++tier).free)
    if (tier === PASS_TIERS && finishedPass === null) finishedPass = day
    if (balance.gold >= 2500 && firstSkin === null) firstSkin = day
  }
  return { name: model.name, firstSkin, finishedPass, tier, mission, ...balance }
}

console.log('# Модель экономики: 30 дней\n')
console.log('Начало сезона, ежедневный вход, 45 выстрелов за победу. Квесты по каталогу для игрока №1; награды забираются. Нет расходов, покупок, рефералов, достижений и сезонных наград. Колонки валют показывают накопление, а не обычный остаток после покупок. Реклама: 5 роликов за золото + до 5 удвоений, без превышения общего лимита.\n')
console.log('| Сценарий | Бои/день | 2500 золота, день | Пропуск 30/30, день | Золото | Кристаллы | Миссии |')
console.log('|---|---:|---:|---:|---:|---:|---:|')
for (const model of scenarios) {
  const r = simulate(model)
  console.log(`| ${r.name} | ${model.games} | ${r.firstSkin ?? '—'} | ${r.finishedPass ?? `${r.tier}/30`} | ${r.gold} | ${r.gems} | ${r.mission} |`)
}
console.log('\nРазовые награды всех 60 миссий без звёзд:', JSON.stringify(CAMPAIGN.reduce((a,l) => ({gold:a.gold+l.reward.gold,gems:a.gems+l.reward.gems,xp:a.xp+l.reward.xp}), {gold:0,gems:0,xp:0})))
console.log('Повторы миссий: 20 золота и 30 XP за победу; дуэли оплачиваются только первые', DUEL_REWARDS_PER_DAY, 'раз за сутки. Это отдельные источники для проверки на накрутку при нагрузочном тестировании.')
