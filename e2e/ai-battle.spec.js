import { test, expect, login, uid, fireOnce, resign, sql, expectNoPageErrors } from './helpers.js'

test('battle vs AI: placement, shell animation, results, double reward for an ad', async ({ page }) => {
  const name = `Пилот ${uid()}`
  await login(page, name)
  await page.getByText('Против ИИ').click()
  await page.getByText('Мастер').click()
  await expect(page.getByText('Расстановка флота')).toBeVisible()
  await page.getByRole('button', { name: 'Случайно' }).click()
  await page.getByRole('button', { name: 'Готов к бою' }).click()
  await expect(page.getByText('Ваш ход')).toBeVisible()

  // The shell is in the air for ~300 ms, then the marker appears
  await page.locator('button[aria-label="Д5"]').click()
  // (the bot answers instantly in tests, so its shell may be in the air too)
  await expect(page.locator('[data-shell]').first()).toBeVisible()
  await expect(page.locator('[data-shell]')).toHaveCount(0, { timeout: 3000 })

  for (let i = 0; i < 6; i++) {
    await fireOnce(page)
    await page.waitForTimeout(500)
  }
  await resign(page)
  await expect(page.getByRole('heading', { name: 'Поражение' })).toBeVisible()

  const double = page.getByRole('button', { name: /Удвоить награду/ })
  await expect(double).toBeVisible()
  const [{ gold: before }] = await sql('SELECT gold FROM users WHERE first_name = $1', [name])
  await double.click()
  await expect(page.getByText('Тестовая реклама')).toBeVisible()
  await expect(page.getByText('Спасибо за просмотр!')).toBeVisible({ timeout: 12_000 })
  const [{ gold: after }] = await sql('SELECT gold FROM users WHERE first_name = $1', [name])
  expect(after).toBeGreaterThan(before)
  expectNoPageErrors(page)
})

test('a win can be turned into a story card', async ({ newPlayer }) => {
  // Deterministic win: a friend duel where the opponent resigns
  const tag = uid()
  const winner = await newPlayer(`Победитель ${tag}`)
  const loser = await newPlayer(`Соперник ${tag}`)
  await winner.getByRole('button', { name: 'Бой с другом', exact: false }).click()
  await winner.getByText('Создать бой').click()
  await expect(winner.locator('.h-16.w-12').first()).not.toHaveText('')
  const code = (await winner.locator('.h-16.w-12').allTextContents()).join('')
  await loser.goto(`/duel/${code}`)
  await winner.getByRole('button', { name: 'Готов к бою' }).click()
  await loser.getByRole('button', { name: 'Готов к бою' }).click()
  await expect(loser.getByText(/Ваш ход|Ход соперника/)).toBeVisible()
  await resign(loser)
  await expect(winner.getByRole('heading', { name: 'Победа!' })).toBeVisible()

  await winner.getByRole('button', { name: 'В сторис' }).click()
  // Outside the mobile Telegram app a preview with download/share is shown
  await expect(winner.getByText('Карточка для сторис')).toBeVisible({ timeout: 15_000 })
  await expect(winner.locator('img[src^="blob:"]')).toBeVisible()
  const [{ n }] = await sql(
    'SELECT count(*)::int AS n FROM share_cards sc JOIN users u ON u.id = sc.user_id WHERE u.first_name = $1',
    [`Победитель ${tag}`],
  )
  expect(n).toBe(1)
  expectNoPageErrors(winner, loser)
})
