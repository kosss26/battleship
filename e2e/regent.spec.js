import { test, expect, uid, resign, expectNoPageErrors, sql, userId } from './helpers.js'

test('public Regent showroom has four distinct classes, comparison and playable shot previews', async ({ page }) => {
  await page.goto('/fleet/regent')
  await expect(page.getByRole('heading', { name: 'РЕГЕНТ', exact: true })).toBeVisible()
  await expect(page.locator('.regent-class-picker button')).toHaveCount(4)
  await expect(page.locator('[data-regent-range] [data-board-theme="theme_regent"]')).toBeVisible()
  for (const size of [4,3,2,1]) {
    await page.locator(`[data-regent-pick="${size}"]`).click()
    await expect(page.locator(`.regent-ship-stage [data-regent-class="${size}"]`)).toBeVisible()
  }
  await page.getByRole('button', { name: 'Сравнить с обычным' }).click()
  await expect(page.getByRole('heading', { name: 'Обычный флот' })).toBeVisible()
  await page.getByRole('button', { name: 'Вернуть «Регент»' }).click()
  for (const [name, impact, mark] of [['Попадание','hit','hit'], ['Промах','miss','miss'], ['Потопление','hit','sunk']]) {
    await page.getByRole('button', { name, exact:true }).click()
    await expect(page.locator('[data-regent-range] [data-shell][data-effect-style="regent"]')).toHaveCount(1)
    await expect(page.locator(`[data-regent-range] [data-impact="${impact}"][data-effect-style="regent"]`)).toHaveCount(1)
    await expect(page.locator(`[data-regent-range] [data-regent-mark="${mark}"]`).first()).toBeVisible()
    await expect(page.locator('[data-regent-range] [data-impact]')).toHaveCount(0)
  }
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
  await expect(page.locator('[data-board-theme="theme_regent"]')).toBeVisible()
  for (const size of [1,2,3,4]) await expect(page.locator(`[data-regent-ship="${size}"]`).first()).toBeVisible()
  await page.getByRole('button', { name: 'Готов к бою' }).click()
  await expect(page.getByText('Ваш ход')).toBeVisible()
  await expect(page.locator('[data-board-theme="theme_regent"]')).toHaveCount(2)
  await page.locator('button[aria-label].cursor-crosshair').first().click()
  await expect(page.locator('[data-shell][data-effect-style="regent"]').first()).toBeVisible()
  await resign(page)
  await expect(page.getByText('Пробный бой · без наград и записи в статистику')).toBeVisible()
  const [after] = await sql('SELECT gold,gems,xp,games,data FROM users WHERE id=$1', [id])
  for (const key of ['gold','gems','xp','games']) expect(after[key]).toBe(before[key])
  expect(after.data.owned).toEqual(before.data.owned)
  expect(after.data.equipped).toEqual(before.data.equipped)
  expectNoPageErrors(page)
})

test('Regent keeps clear static marks with reduced motion and cancels a reset preview', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'reduce' })
  await page.goto('/fleet/regent')
  await page.getByRole('button', { name:'Потопление', exact:true }).click()
  await expect(page.locator('[data-regent-range] [data-regent-mark="sunk"]')).toHaveCount(3)
  await expect(page.locator('[data-regent-range] [data-shell], [data-regent-range] [data-impact]')).toHaveCount(0)
  await page.emulateMedia({ reducedMotion:'no-preference' })
  await page.getByRole('button', { name:'Попадание', exact:true }).click()
  await page.getByRole('button', { name:'Сбросить' }).click()
  await expect(page.locator('[data-regent-range] [data-shell], [data-regent-range] [data-impact], [data-regent-range] [data-regent-mark]')).toHaveCount(0)
  for (const width of [320,390,1440]) {
    await page.setViewportSize({width,height:900})
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})
