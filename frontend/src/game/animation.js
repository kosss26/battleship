/** Presentation timings are shared by every cosmetic and never affect server turns. */
export const SHELL_FLIGHT_MS = 300
export const IMPACT_FX_MS = 1400

export function finalShotDeadline(game, over, feed, reducedMotion = false) {
  if (reducedMotion || game?.phase !== 'over') return 0
  if (over && !['victory', 'out_of_ammo'].includes(over.reason)) return 0
  const shot = [...feed].reverse().find((f) => f.result === 'sunk')
  return Number.isFinite(shot?.at) ? shot.at + SHELL_FLIGHT_MS + IMPACT_FX_MS : 0
}
