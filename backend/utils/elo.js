/**
 * Утилиты для расчета рейтинга ELO
 * Согласно ТЗ: ΔRating = 32 × (Result - Expected)
 * где Expected = 1 / (1 + 10^((opponent_rating - your_rating) / 400))
 */

/**
 * Рассчитывает ожидаемый результат (вероятность победы)
 * @param {number} playerRating - Рейтинг игрока
 * @param {number} opponentRating - Рейтинг противника
 * @returns {number} - Ожидаемый результат (0-1)
 */
export const calculateExpected = (playerRating, opponentRating) => {
  const diff = opponentRating - playerRating
  return 1 / (1 + Math.pow(10, diff / 400))
}

/**
 * Рассчитывает изменение рейтинга
 * @param {number} playerRating - Рейтинг игрока
 * @param {number} opponentRating - Рейтинг противника
 * @param {number} result - Результат (1 = победа, 0 = поражение, 0.5 = ничья)
 * @param {number} kFactor - K-фактор (по умолчанию 32 согласно ТЗ)
 * @returns {number} - Изменение рейтинга
 */
export const calculateRatingChange = (
  playerRating,
  opponentRating,
  result,
  kFactor = 32
) => {
  const expected = calculateExpected(playerRating, opponentRating)
  return Math.round(kFactor * (result - expected))
}

/**
 * Рассчитывает новые рейтинги после матча
 * @param {number} player1Rating - Рейтинг первого игрока
 * @param {number} player2Rating - Рейтинг второго игрока
 * @param {number} winner - 1 (player1), 2 (player2), или 0 (ничья)
 * @returns {Object} - { player1NewRating, player2NewRating, player1Change, player2Change }
 */
export const calculateNewRatings = (player1Rating, player2Rating, winner) => {
  let player1Result, player2Result

  if (winner === 1) {
    player1Result = 1
    player2Result = 0
  } else if (winner === 2) {
    player1Result = 0
    player2Result = 1
  } else {
    player1Result = 0.5
    player2Result = 0.5
  }

  const player1Change = calculateRatingChange(player1Rating, player2Rating, player1Result)
  const player2Change = calculateRatingChange(player2Rating, player1Rating, player2Result)

  // Согласно ТЗ: минимальный рейтинг 0
  const player1NewRating = Math.max(0, player1Rating + player1Change)
  const player2NewRating = Math.max(0, player2Rating + player2Change)

  return {
    player1NewRating,
    player2NewRating,
    player1Change,
    player2Change,
  }
}
