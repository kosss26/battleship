import { test, expect } from '@playwright/test'
import { newPlayer, uid, fireOnce, resign, expectNoPageErrors } from './helpers.js'

test('ranked: matchmaking, drag-and-drop, emotes, early forfeit protection', async ({ browser }) => {
  const tag = uid()
  const a = await newPlayer(browser, `Анна ${tag}`)
  const b = await newPlayer(browser, `Борис ${tag}`)
  await a.getByRole('button', { name: 'В бой' }).click()
  await expect(a.getByText('Поиск соперника')).toBeVisible()
  await b.getByRole('button', { name: 'В бой' }).click()
  await expect(a.getByText('Расстановка флота')).toBeVisible()
  await expect(b.getByText('Расстановка флота')).toBeVisible()

  // Drag the 4-deck ship from the dock onto the board
  await a.getByRole('button', { name: 'Очистить' }).click()
  const dock = a.locator('.touch-none.rounded-lg')
  await expect(dock).toHaveCount(10)
  const from = await dock.first().boundingBox()
  const board = await a.locator('.water').first().boundingBox()
  await a.mouse.move(from.x + 10, from.y + 10)
  await a.mouse.down()
  await a.mouse.move(board.x + board.width * 0.15, board.y + board.height * 0.15, { steps: 8 })
  await a.mouse.up()
  await expect(dock).toHaveCount(9)

  await a.getByRole('button', { name: 'Случайно' }).click()
  await a.getByRole('button', { name: 'Готов к бою' }).click()
  await b.getByRole('button', { name: 'Готов к бою' }).click()
  await expect(a.getByText(/Ваш ход|Ход соперника/)).toBeVisible()
  for (let i = 0; i < 3; i++) {
    await fireOnce(a)
    await fireOnce(b)
    await a.waitForTimeout(300)
  }

  await b.getByRole('button', { name: 'Эмоции' }).click()
  await b.getByText('🔥').click()
  await expect(a.getByText('🔥')).toBeVisible()

  await resign(a)
  await expect(b.getByRole('heading', { name: 'Победа!' })).toBeVisible()
  await expect(b.getByText('Рейтинг не начислен: соперник сдался в самом начале боя')).toBeVisible()
  await expect(a.getByRole('heading', { name: 'Поражение' })).toBeVisible()
  expectNoPageErrors(a, b)
})
