import { test, expect, login, uid, expectNoPageErrors } from './helpers.js'

test('settings and season rewards scroll with touch; the handle can dismiss the sheet', async ({ browser, browserName, baseURL }) => {
  test.skip(browserName !== 'chromium', 'Uses Chromium native touch input through CDP')
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 700 }, locale: 'ru-RU', isMobile: true, hasTouch: true })
  try {
    const page = await context.newPage()
    await login(page, `Свайп ${uid()}`)
    const input = await context.newCDPSession(page)
    const swipeUp = async () => {
      await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 230, y: 570 }] })
      for (let y = 550; y >= 170; y -= 20) {
        await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 230, y }] })
        await page.waitForTimeout(20)
      }
      await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }

    await page.getByRole('link', { name: 'Профиль' }).click()
    await page.getByRole('button', { name: 'Настройки', exact: true }).click()
    let panel = page.getByRole('heading', { name: 'Настройки', level: 3, exact: true }).locator('../..')
    await expect(panel).toBeVisible()
    await swipeUp()
    await expect.poll(() => panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(50)
    await expect(panel.getByRole('button', { name: 'Удалить аккаунт', exact: true })).toBeInViewport()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Настройки', exact: true })).toBeFocused()

    await page.getByRole('link', { name: 'Рейтинг' }).click()
    await page.getByRole('button', { name: 'Награды сезона', exact: true }).click()
    const heading = page.getByRole('heading', { name: 'Награды сезона', exact: true })
    panel = heading.locator('../..')
    await expect(panel).toBeVisible()
    await swipeUp()
    await expect.poll(() => panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(50)
    await expect(heading).toBeAttached() // Scrolling content must not dismiss it.
    await swipeUp()
    await expect(panel.getByText('Юнга', { exact: true })).toBeInViewport()

    await panel.evaluate((el) => { el.scrollTop = 0 })
    const handle = panel.locator('[aria-hidden="true"]').first()
    const box = await handle.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + 8)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + 180, { steps: 16 })
    await page.mouse.up()
    await expect(heading).toHaveCount(0)
    expectNoPageErrors(page)
  } finally {
    await context.close()
  }
})
