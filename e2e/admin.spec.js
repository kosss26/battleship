import { test, expect } from '@playwright/test'
import { newPlayer, uid, expectNoPageErrors } from './helpers.js'

test('admin panel: hidden from players, analytics, ban/unban', async ({ browser }) => {
  const tag = uid()
  const player = await newPlayer(browser, `Игрок ${tag}`)
  await player.goto('/profile')
  await expect(player.getByText('Админ-панель')).toHaveCount(0)
  await player.goto('/admin')
  await expect(player.getByText('Рейтинговый бой')).toBeVisible()

  const admin = await newPlayer(browser, 'Админ Тест')
  await admin.goto('/profile')
  await admin.getByText('Админ-панель').click()
  await expect(admin.getByText('Доход (Telegram Stars)')).toBeVisible()

  await admin.getByRole('button', { name: 'Данные' }).click()
  await expect(admin.getByText('Удержание (среднее по когортам)')).toBeVisible()
  await expect(admin.getByText('Воронка новичков (30 дн.)')).toBeVisible()
  await admin.getByRole('button', { name: '7 дней' }).click()
  await expect(admin.getByText('Воронка новичков (7 дн.)')).toBeVisible()

  await admin.getByRole('button', { name: 'Игроки' }).click()
  await admin.getByPlaceholder(/ID, Telegram ID/).fill(`Игрок ${tag}`)
  await admin.locator('button', { hasText: `Игрок ${tag}` }).first().click()
  await expect(admin.getByText('Корректировка')).toBeVisible()
  await admin.getByRole('button', { name: 'Забанить' }).click()
  await admin.getByPlaceholder('Причина (обязательно)').fill('e2e')
  await admin.locator('.btn.bg-rose-500').click()
  await expect(player.getByText('Аккаунт заблокирован')).toBeVisible()
  await admin.getByRole('button', { name: 'Разбанить' }).click()
  await admin.locator('.btn.bg-cyan-300').click()
  await expect(admin.getByRole('button', { name: 'Забанить' })).toBeVisible()
  expectNoPageErrors(admin)
})
