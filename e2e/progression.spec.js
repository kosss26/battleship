import { test, expect, login, uid, userId, sql, expectNoPageErrors } from './helpers.js'

test('season banner, rewards sheet and season results', async ({ page }) => {
  const name = `Сезон ${uid()}`
  await login(page, name)
  await page.getByRole('link', { name: 'Рейтинг' }).click()
  await expect(page.locator('.identity-season')).toContainText(/Сезон \d+/)
  await page.getByRole('button', { name: 'Награды сезона', exact: true }).click()
  await expect(page.getByText(/Рейтинговых боёв: 0\/5/)).toBeVisible()
  await expect(page.getByText('Топ-100 мира — дополнительно')).toBeVisible()
  await page.keyboard.press('Escape')

  const id = await userId(name)
  await sql(`INSERT INTO season_results (season, user_id, rating, rank, place, games, wins, reward)
             VALUES ('2026-10', $1, 1720, 'captain', 7, 24, 16, $2)`, [id, { gems: 160, cosmetics: ['frame_officer'] }])
  await page.goto('/')
  await expect(page.getByText('Итоги сезона')).toBeVisible()
  await page.locator('.btn-gold', { hasText: 'Забрать' }).click()
  await expect(page.getByRole('button', { name: 'OK' })).toBeVisible()
  const [{ data }] = await sql('SELECT data FROM users WHERE id = $1', [id])
  expect(data.owned).toContain('frame_officer')
  expectNoPageErrors(page)
})

test('campaign part two: rules on the mission, ammo counter and fog in battle', async ({ page }) => {
  const name = `Мореход ${uid()}`
  await login(page, name)
  const id = await userId(name)
  await sql(`UPDATE users SET data = jsonb_set(data, '{campaign}', (SELECT jsonb_object_agg(g::text, 2) FROM generate_series(1, 50) g)) WHERE id = $1`, [id])
  await page.reload()
  await page.getByText('Кампания', { exact: true }).click()
  await expect(page.getByText('Логово Кракена')).toBeVisible()
  await page.getByText('Логово Кракена').scrollIntoViewIfNeeded()
  await page.locator('button', { hasText: /^51/ }).first().click()
  await expect(page.getByText('Особые условия')).toBeVisible()
  await expect(page.getByText('Туман войны')).toBeVisible()
  await expect(page.getByText('Всего 80 выстрелов — не успели, поражение')).toBeVisible()
  await page.getByRole('button', { name: 'Начать' }).click()
  await page.getByRole('button', { name: 'Готов к бою' }).click()
  await expect(page.getByText('Снаряды: 80')).toBeVisible()
  await expect(page.locator('.fog-overlay')).toHaveCount(1)
  expectNoPageErrors(page)
})

test('account deletion', async ({ page }) => {
  const name = `Удалить ${uid()}`
  await login(page, name)
  const id = await userId(name)
  await page.getByRole('link', { name: 'Профиль' }).click()
  await page.getByRole('button', { name: 'Настройки', exact: true }).click()
  await page.getByRole('button', { name: 'Удалить аккаунт', exact: true }).click()
  await page.getByPlaceholder('Введите УДАЛИТЬ для подтверждения').fill('удалить')
  await page.locator('.btn.bg-rose-500').click()
  await expect(page.getByText('Аккаунт удалён')).toBeVisible()
  const [row] = await sql('SELECT first_name, tg_id, banned FROM users WHERE id = $1', [id])
  expect(row).toEqual({ first_name: 'Deleted', tg_id: null, banned: true })
})
