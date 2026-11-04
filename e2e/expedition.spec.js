import { test, expect, login, uid, userId, sql, expectNoPageErrors } from './helpers.js'

test('campaign chapter navigation preserves locks, replay and the next mission', async ({ page }) => {
  const name = `Поход ${uid()}`
  await login(page, name)
  const id = await userId(name)
  await sql(`UPDATE users SET data = jsonb_set(data, '{campaign}', $2::jsonb) WHERE id = $1`, [id, JSON.stringify(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 3])))])
  await page.goto('/campaign')
  await expect(page.locator('.campaign-total')).toHaveText('30 / 180')
  await expect(page.locator('.campaign-chapter-banner h2')).toHaveText('Туманный пролив')
  await expect(page.locator('.campaign-mission.is-current')).toContainText('11')
  await expect(page.locator('.campaign-mission:disabled')).toHaveCount(9)
  await page.locator('.campaign-continue').click()
  await expect(page.getByRole('heading', { name: 'Миссия 11', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.locator('.campaign-chapter-preview').filter({ hasText: 'Тихая бухта' }).click()
  await expect(page.locator('.campaign-chapter-banner h2')).toHaveText('Тихая бухта')
  await expect(page.locator('.campaign-mission:disabled')).toHaveCount(0)
  await expect(page.locator('.campaign-mission.is-complete')).toHaveCount(10)
  await page.locator('.campaign-continue').click()
  await expect(page.getByRole('heading', { name: /Миссия 10/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Начать', exact: true })).toBeVisible()
  expectNoPageErrors(page)
})

test('achievement filters use the profile and never claim or grant rewards', async ({ page }) => {
  const name = `Медали ${uid()}`
  await login(page, name)
  const id = await userId(name)
  await sql(`UPDATE users SET data = jsonb_set(data, '{achievements}', $2::jsonb) WHERE id = $1`, [id, JSON.stringify({ first_win: '2026-11-04', wins_10: '2026-11-04' })])
  const [before] = await sql('SELECT gold, gems FROM users WHERE id = $1', [id])
  const writes = []
  page.on('request', (req) => { if (req.method() !== 'GET' && new URL(req.url()).pathname.startsWith('/api/me/')) writes.push(req.url()) })
  await page.goto('/achievements')
  await expect(page.locator('.awards-banner')).toContainText('Получено 2 из 26')
  await page.getByRole('button', { name: 'Получены', exact: true }).click()
  await expect(page.locator('.award-row')).toHaveCount(2)
  await expect(page.locator('.award-row.is-earned')).toHaveCount(2)
  await page.getByRole('button', { name: 'В процессе', exact: true }).click()
  await expect(page.locator('.award-row')).toHaveCount(24)
  await page.getByRole('button', { name: 'Все', exact: true }).click()
  await expect(page.locator('.award-row')).toHaveCount(26)
  expect(writes).toEqual([])
  const [after] = await sql('SELECT gold, gems FROM users WHERE id = $1', [id])
  expect(after).toEqual(before)
  expectNoPageErrors(page)
})
