import pg from 'pg'
import { expect } from '@playwright/test'
import { DATABASE_URL } from './playwright.config.js'

let pool
export async function sql(text, params) {
  pool ||= new pg.Pool({ connectionString: DATABASE_URL, max: 2 })
  const { rows } = await pool.query(text, params)
  return rows
}

export const uid = () => String(Date.now() % 1_000_000) + Math.floor(Math.random() * 90 + 10)

/** Opens the app as a new dev player. Skips the tutorial unless asked not to. */
export async function login(page, name, { skipTutorial = true } = {}) {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByPlaceholder('Ваше имя').fill(name)
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByText('Рейтинговый бой')).toBeVisible()
  if (skipTutorial) {
    const skip = page.getByText('Пропустить')
    if (await skip.isVisible().catch(() => false)) await skip.click()
    await expect(skip).toBeHidden()
  }
  page.errors = errors
  return page
}

/** A second independent player in the same test */
export async function newPlayer(browser, name, opts) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' })
  const page = await ctx.newPage()
  return login(page, name, opts)
}

export async function userId(name) {
  return (await sql('SELECT id FROM users WHERE first_name = $1 ORDER BY id DESC LIMIT 1', [name]))[0].id
}

/** Fires at the first open enemy cell while it is our turn */
export async function fireOnce(page) {
  const cell = page.locator('button[aria-label].cursor-crosshair').first()
  if (await cell.count()) await cell.click({ timeout: 2000 }).catch(() => {})
}

export async function resign(page) {
  await page.getByRole('button', { name: 'Сдаться' }).click()
  await page.locator('.btn.bg-rose-500').click()
}

export function expectNoPageErrors(...pages) {
  for (const p of pages) expect(p.errors || [], 'uncaught page errors').toEqual([])
}
