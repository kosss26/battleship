/**
 * Rewarded ads via Adsgram (https://adsgram.ai).
 * The server opens an ad session, the ad is shown, then the server grants the reward.
 * Without a block id (local development) a fake 5-second "ad" is shown instead.
 */
import { post } from './api.js'
import { useStore } from '../store/app.js'
import { haptic } from './telegram.js'
import { tr } from './i18n.js'

let sdkPromise = null
const controllers = {}

function loadSdk() {
  if (window.Adsgram) return Promise.resolve()
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://sad.adsgram.ai/js/sad.min.js'
      s.async = true
      s.onload = resolve
      s.onerror = () => {
        sdkPromise = null
        reject(new Error('adsgram_load_failed'))
      }
      document.head.appendChild(s)
    })
  }
  return sdkPromise
}

/** Resolves true if the ad was watched to the end */
async function playAd(blockId, fake) {
  if (fake) {
    return new Promise((resolve) => useStore.setState({ fakeAd: { resolve, startedAt: Date.now() } }))
  }
  await loadSdk()
  if (!controllers[blockId]) controllers[blockId] = window.Adsgram.init({ blockId: String(blockId) })
  try {
    const result = await controllers[blockId].show()
    return !!result?.done
  } catch {
    return false
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Shows a rewarded ad for `placement` ('gold' | 'booster' | 'double').
 * Returns the reward summary, or null if the ad was not completed.
 */
export async function watchAd(placement) {
  const st = useStore.getState()
  if (st.adBusy) return null
  useStore.setState({ adBusy: true })
  try {
    const { sessionId, blockId, fake } = await post('/me/ads/start', { placement })
    const done = await playAd(blockId, fake)
    if (!done) {
      st.toast(tr('ad_not_finished'))
      return null
    }
    // With server-side confirmation the Adsgram callback may arrive a moment later
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await post('/me/ads/complete', { sessionId })
        st.setProfile(res.profile)
        st.showReward(res.summary, tr('ad_reward_title'))
        return res.summary
      } catch (e) {
        if (e.code === 'ad_not_confirmed' && attempt < 5) {
          await sleep(1500)
          continue
        }
        throw e
      }
    }
  } catch (e) {
    haptic.error()
    st.toast(e.code || 'error_generic', 'error')
    return null
  } finally {
    useStore.setState({ adBusy: false })
  }
}
