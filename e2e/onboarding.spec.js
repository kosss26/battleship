import { test, expect } from '@playwright/test'
import { login, uid, expectNoPageErrors } from './helpers.js'

test('new player: tutorial, legal links, notifications, training battle', async ({ page }) => {
  await login(page, `Новичок ${uid()}`, { skipTutorial: false })
  await expect(page.getByText('Добро пожаловать, капитан!')).toBeVisible()
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Далее' }).click()
  await expect(page.getByText('Не пропустите вызов')).toBeVisible()
  await expect(page.getByText(/Продолжая, вы принимаете/)).toBeVisible()
  await page.getByRole('button', { name: 'Разрешить уведомления' }).click()
  await expect(page.getByText('Уведомления включены').first()).toBeVisible()
  await page.getByRole('button', { name: 'Тренировочный бой' }).click()
  await expect(page.getByText('Расстановка флота')).toBeVisible()
  expectNoPageErrors(page)
})

test('legal documents open without signing in', async ({ page }) => {
  await page.goto('/legal/privacy')
  await expect(page.getByRole('heading', { name: 'Политика конфиденциальности' })).toBeVisible()
  await expect(page.getByText('Какие данные мы получаем')).toBeVisible()
  await page.goto('/legal/terms')
  await expect(page.getByRole('heading', { name: 'Пользовательское соглашение' })).toBeVisible()
})
