// End-to-end tests: real backend + Vite frontend + Chromium in a phone-sized viewport.
// Run: npm run e2e   (needs PostgreSQL; see E2E_DATABASE_URL)
import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'url'

const root = fileURLToPath(new URL('..', import.meta.url))
export const DATABASE_URL = process.env.E2E_DATABASE_URL || 'postgres://bs:bs@localhost:5432/battleship'
// Dev-login Telegram id of the player named "Админ Тест" (see /auth/dev)
export const E2E_ADMIN_ID = '9000096482'

export default defineConfig({
  testDir: '.',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // matchmaking pairs any two waiting players, so tests run one at a time
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 390, height: 844 },
    locale: 'ru-RU',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node backend/src/index.js',
      cwd: root,
      url: 'http://localhost:5055/api/health',
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: '5055',
        NODE_ENV: 'development',
        DATABASE_URL,
        JWT_SECRET: 'e2e-secret-0123456789',
        ALLOW_DEV_LOGIN: 'true',
        ADMIN_IDS: E2E_ADMIN_ID,
        BOT_FAST: '1',
        FRONTEND_URL: 'http://localhost:3000',
        WEBAPP_URL: 'http://localhost:3000',
      },
    },
    {
      command: 'npm --prefix frontend run dev -- --port 3000 --strictPort',
      cwd: root,
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
