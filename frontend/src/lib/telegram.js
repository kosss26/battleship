/** Thin, defensive wrapper around window.Telegram.WebApp */
const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null

export const isTelegram = () => !!tg?.initData
export const webApp = tg

const supports = (v) => !!tg?.isVersionAtLeast?.(v)

let hapticsOn = true
export const setHapticsEnabled = (on) => { hapticsOn = on }

export function initTelegram() {
  if (!tg) return
  try {
    tg.ready()
    tg.expand()
    if (supports('7.7')) tg.disableVerticalSwipes()
    if (supports('6.1')) {
      tg.setHeaderColor('#060d1d')
      tg.setBackgroundColor('#060d1d')
    }
    if (supports('7.10')) tg.setBottomBarColor('#060d1d')
  } catch (e) {
    console.warn('tg init', e)
  }
}

export const initData = () => tg?.initData || ''
export const platform = () => tg?.platform || 'web'
export const tgUser = () => tg?.initDataUnsafe?.user || null

export function startParam() {
  const fromTg = tg?.initDataUnsafe?.start_param
  if (fromTg) return fromTg
  const q = new URLSearchParams(window.location.search)
  return q.get('tgWebAppStartParam') || q.get('startapp') || ''
}

export const haptic = {
  tap: () => hapticsOn && supports('6.1') && tg.HapticFeedback.selectionChanged(),
  light: () => hapticsOn && supports('6.1') && tg.HapticFeedback.impactOccurred('light'),
  medium: () => hapticsOn && supports('6.1') && tg.HapticFeedback.impactOccurred('medium'),
  heavy: () => hapticsOn && supports('6.1') && tg.HapticFeedback.impactOccurred('heavy'),
  rigid: () => hapticsOn && supports('6.1') && tg.HapticFeedback.impactOccurred('rigid'),
  success: () => hapticsOn && supports('6.1') && tg.HapticFeedback.notificationOccurred('success'),
  error: () => hapticsOn && supports('6.1') && tg.HapticFeedback.notificationOccurred('error'),
  warning: () => hapticsOn && supports('6.1') && tg.HapticFeedback.notificationOccurred('warning'),
}

export function backButton(show, onClick) {
  if (!tg?.BackButton || !supports('6.1')) return () => {}
  if (!show) {
    tg.BackButton.hide()
    return () => {}
  }
  tg.BackButton.show()
  tg.BackButton.onClick(onClick)
  return () => tg.BackButton.offClick(onClick)
}

/** Opens a Stars invoice. Resolves with 'paid' | 'cancelled' | 'failed' | 'pending' */
export function openInvoice(link) {
  return new Promise((resolve) => {
    if (tg?.openInvoice && supports('6.1')) tg.openInvoice(link, (status) => resolve(status))
    else {
      window.open(link, '_blank')
      resolve('pending')
    }
  })
}

export function openLink(url) {
  if (url.startsWith('https://t.me/') && tg?.openTelegramLink) tg.openTelegramLink(url)
  else if (tg?.openLink) tg.openLink(url)
  else window.open(url, '_blank')
}

export function shareLink(url, text) {
  const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  openLink(share)
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export function confirmClose(on) {
  if (!supports('6.2')) return
  if (on) tg.enableClosingConfirmation()
  else tg.disableClosingConfirmation()
}
