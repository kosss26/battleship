import { test, expect, uid, resign, expectNoPageErrors, sql, userId } from './helpers.js'

test('public Regent showroom has four distinct classes, comparison and playable shot previews', async ({ page }) => {
  await page.goto('/fleet/regent')
  await expect(page.getByRole('heading', { name: 'РЕГЕНТ', exact: true })).toBeVisible()
  await expect(page.locator('.regent-class-picker button')).toHaveCount(4)
  for (const size of [4,3,2,1]) {
    await page.locator(`[data-regent-pick="${size}"]`).click()
    await expect(page.locator(`.regent-ship-stage [data-regent-class="${size}"]`)).toBeVisible()
  }
  await page.getByRole('button', { name: 'Сравнить с обычным' }).click()
  await expect(page.getByRole('heading', { name: 'Обычный флот' })).toBeVisible()
  await page.getByRole('button', { name: 'Вернуть «Регент»' }).click()
  await page.getByRole('button', { name: 'Потопление', exact: true }).click()
  await expect(page.locator('[data-regent-range] [data-shot-state="3"]')).toHaveCount(3)
  await expect(page.getByText('Без покупки и списания валюты')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('Regent showroom launches an actual free AI trial with all four classes and no rewards', async ({ newPlayer }) => {
  const name = `Регент ${uid()}`
  const page = await newPlayer(name)
  const id = await userId(name)
  const [before] = await sql('SELECT gold,gems,xp,games,data FROM users WHERE id=$1', [id])
  await page.goto('/shop?tab=collection')
  await page.locator('[data-regent-showroom]').click()
  await page.getByRole('button', { name: 'Испытать флот в бою' }).click()
  await expect(page.getByText('Расстановка флота')).toBeVisible()
  for (const size of [1,2,3,4]) await expect(page.locator(`[data-regent-ship="${size}"]`).first()).toBeVisible()
  await page.getByRole('button', { name: 'Готов к бою' }).click()
  await expect(page.getByText('Ваш ход')).toBeVisible()
  await resign(page)
  await expect(page.getByText('Пробный бой · без наград и записи в статистику')).toBeVisible()
  const [after] = await sql('SELECT gold,gems,xp,games,data FROM users WHERE id=$1', [id])
  for (const key of ['gold','gems','xp','games']) expect(after[key]).toBe(before[key])
  expect(after.data.owned).toEqual(before.data.owned)
  expect(after.data.equipped).toEqual(before.data.equipped)
  expectNoPageErrors(page)
})
