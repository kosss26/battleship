import dotenv from 'dotenv'

dotenv.config()

const env = process.env
/** Project owner's Telegram id — always has admin access */
const OWNER_ID = '1763619724'
const isProd = env.NODE_ENV === 'production'

if (isProd && (!env.JWT_SECRET || env.JWT_SECRET.length < 16)) {
  throw new Error('JWT_SECRET must be set (16+ chars) in production')
}
if (isProd && env.TELEGRAM_BOT_TOKEN && env.BOT_POLLING !== 'true' && !env.WEBHOOK_SECRET) {
  throw new Error('WEBHOOK_SECRET must be configured for production payment webhooks')
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
  // Telegram ids with access to the admin panel: the project owner always, plus anyone in ADMIN_IDS
  // Rewarded ads (Adsgram). Block id from partner.adsgram.ai; with ADSGRAM_REWARD_SECRET set,
  // rewards are only granted after Adsgram calls our reward URL (server-to-server confirmation).
  adsgramBlockId: env.ADSGRAM_BLOCK_ID || '',
  adsgramRewardSecret: env.ADSGRAM_REWARD_SECRET || '',
  // Shown in the Terms and Privacy Policy
  legalOperator: env.LEGAL_OPERATOR || '',
  legalContact: env.LEGAL_CONTACT || '',
  adminIds: [...new Set([OWNER_ID, ...(env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)])],
}
