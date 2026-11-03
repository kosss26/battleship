/** ELO rating change for player A. K is higher for newcomers so they settle quickly. */
export function eloDelta(ratingA, ratingB, scoreA, gamesA = 100) {
  const k = gamesA < 15 ? 40 : 32
  const expected = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
  let delta = Math.round(k * (scoreA - expected))
  if (scoreA === 1) delta = Math.max(delta, 5)
  if (scoreA === 0) delta = Math.min(delta, -5)
  return delta
}

export const applyDelta = (rating, delta) => Math.max(0, rating + delta)
