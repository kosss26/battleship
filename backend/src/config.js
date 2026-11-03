import dotenv from 'dotenv'

dotenv.config()

const env = process.env
const isProd = env.NODE_ENV === 'production'

if (isProd && (!env.JWT_SECRET || env.JWT_SECRET.length < 16)) {
  throw new Error('JWT_SECRET must be set (16+ chars) in production')
}

export const config = {
  isProd,
  port: Number(env.PORT || 5000),
  frontendOrigins: (env.FRONTEND_URL || 'http://localhost:3000').split(',').map((s) => s.trim()).filter(Boolean),
  publicUrl: (env.PUBLIC_URL || '').replace(/\/$/, ''),
  databaseUrl: env.DATABASE_URL || 'postgres://bs:bs@localhost:5432/battleship',
  databaseSsl: env.DATABASE_SSL === 'true',
  jwtSecret: env.JWT_SECRET || 'dev-only-secret-change-me',
  allowDevLogin: env.ALLOW_DEV_LOGIN === 'true' && !isProd,
  botToken: env.TELEGRAM_BOT_TOKEN || '',
  botUsername: env.BOT_USERNAME || '',
  appShortName: env.APP_SHORT_NAME || 'play',
  webappUrl: env.WEBAPP_URL || 'http://localhost:3000',
  webhookSecret: env.WEBHOOK_SECRET || '',
  botPolling: env.BOT_POLLING === 'true',
  adminIds: (env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean),
}
