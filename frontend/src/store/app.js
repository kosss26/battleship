import { create } from 'zustand'
import { api, post, patch, setToken, getToken, ApiError } from '../lib/api.js'
import { getSocket, request } from '../lib/socket.js'
import { initData, isTelegram, startParam, tgUser, setHapticsEnabled, haptic } from '../lib/telegram.js'
import { setSoundEnabled, sfx } from '../lib/sound.js'
import { setMusicEnabled } from '../lib/music.js'
import { tr } from '../lib/i18n.js'

let toastId = 0
export const SHELL_FLIGHT_MS = 300
let feedId = 0

const emptySummary = (s) =>
  !s || (!s.gold && !s.gems && !s.xp && !Object.keys(s.boosters || {}).length && !(s.cosmetics || []).length && !(s.achievements || []).length && !(s.levelUps || []).length)

export const useStore = create((set, get) => ({
  status: 'boot',
  lang: (tgUser()?.language_code || navigator.language || 'ru').startsWith('ru') ? 'ru' : 'en',
  config: null,
  profile: null,
  connected: false,
  pendingStart: startParam(),

  game: null,
  clockOffset: 0,
  feed: [],
  over: null,
  emote: null,
  oppConnected: true,
  rematchOffered: false,
  radar: null,

  mm: null,
  invite: null,
  friendsBadge: 0,
  toasts: [],
  reward: null,

  /* ───────── boot & auth ───────── */

  async boot() {
    set({ status: 'boot' })
    try {
      const config = await api('/config').catch(() => null)
      set({ config })
      if (isTelegram()) {
        const ref = new URLSearchParams(location.search).get('ref')
        const res = await post('/auth/telegram', { initData: initData(), ref })
        return get().afterLogin(res)
      }
      if (config?.devLogin) {
        let name = null
        try {
          name = localStorage.getItem('bs_dev_name')
        } catch {}
        if (name) return get().devLogin(name)
        return set({ status: 'dev_login' })
      }
      set({ status: 'need_tg' })
    } catch (e) {
      console.error(e)
      set({ status: e?.code === 'banned' ? 'banned' : e instanceof ApiError && e.status === 401 ? 'need_tg' : 'error' })
    }
  },

  async devLogin(name) {
    try {
      localStorage.setItem('bs_dev_name', name)
    } catch {}
    const ref = new URLSearchParams(location.search).get('ref')
    const res = await post('/auth/dev', { name, lang: get().lang, ref })
    get().afterLogin(res)
  },

  afterLogin({ token, profile }) {
    setToken(token)
    get().setProfile(profile)
    set({ status: 'ready' })
    get().connectSocket()
  },

  setProfile(profile) {
    if (!profile) return
    // Realtime updates (socket 'profile') don't carry the season result — keep the last known one
    if (!('seasonResult' in profile)) profile = { ...profile, seasonResult: get().profile?.seasonResult ?? null }
    setSoundEnabled(profile.settings?.sound !== false)
    setHapticsEnabled(profile.settings?.haptics !== false)
    setMusicEnabled(profile.settings?.music !== false)
    set({ profile })
  },

  async refreshProfile() {
    const { profile } = await api('/me')
    get().setProfile(profile)
    return profile
  },

  /* ───────── mutations with reward popups ───────── */

  async mutate(path, body, { popup = true, method = 'POST' } = {}) {
    try {
      const res = method === 'PATCH' ? await patch(path, body) : await post(path, body)
      get().setProfile(res.profile)
      if (popup && !emptySummary(res.summary)) get().showReward(res.summary)
      return res
    } catch (e) {
      haptic.error()
      get().toast(e.code || 'error_generic', 'error')
      throw e
    }
  },

  showReward(summary, title = null) {
    sfx.coin()
    haptic.success()
    set({ reward: { summary, title } })
  },
  closeReward: () => set({ reward: null }),

  toast(text, kind = 'info', ms = 2600) {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, kind }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ms)
  },

  consumeStart() {
    const p = get().pendingStart
    set({ pendingStart: '' })
    return p
  },

  /* ───────── realtime ───────── */

  connectSocket() {
    if (!getToken()) return
    const s = getSocket()
    if (s.__wired) return
    s.__wired = true
    s.on('connect', () => {
      set({ connected: true })
      request('game:resume')
    })
    s.on('disconnect', (reason) => {
      set({ connected: false })
      // Server-side kick (e.g. ban): reconnect so the handshake reports the reason
      if (reason === 'io server disconnect') setTimeout(() => s.connect(), 500)
    })
    s.on('connect_error', (err) => {
      set({ connected: false })
      if (err?.message === 'unauthorized') get().boot()
      if (err?.message === 'banned' && get().status !== 'deleted') set({ status: 'banned' })
    })
    s.on('profile', (p) => get().setProfile(p))
    s.on('game:state', (st) => {
      const prev = get().game
      const fresh = !prev || prev.id !== st.id
      set({
        game: st,
        clockOffset: st.serverNow - Date.now(),
        ...(fresh ? { feed: [], over: null, oppConnected: true, rematchOffered: false, radar: null, mm: null } : {}),
      })
      if (prev && !fresh && st.myTurn && !prev.myTurn) {
        sfx.turn()
        haptic.light()
      }
    })
    s.on('game:shot', (ev) => {
      const items = ev.results.map((r) => ({ ...r, by: ev.by, id: ++feedId, booster: ev.booster, auto: ev.auto }))
      set((st) => ({ feed: [...st.feed.slice(-40), ...items] }))
      const worst = items.some((i) => i.result === 'sunk') ? 'sunk' : items.some((i) => i.result === 'hit') ? 'hit' : 'miss'
      // The shell takes ~300 ms to land (see Board), impact feedback is synced to it
      sfx.fire()
      setTimeout(() => {
        sfx[worst]()
        if (worst === 'sunk') haptic.heavy()
        else if (worst === 'hit') (ev.by === 'opp' ? haptic.rigid : haptic.medium)()
        else haptic.light()
      }, SHELL_FLIGHT_MS)
    })
    s.on('game:radar', (r) => {
      sfx.radar()
      set({ radar: { ...r, at: Date.now() } })
    })
    s.on('game:over', (o) => {
      set({ over: o, game: o.state })
      setTimeout(() => (o.won ? sfx.win() : sfx.lose()), 500)
      ;(o.won ? haptic.success : haptic.error)()
    })
    s.on('game:emote', ({ emote }) => {
      set({ emote: { emote, at: Date.now() } })
      haptic.tap()
    })
    s.on('game:opponent', ({ connected, graceMs }) => set({ oppConnected: connected, oppGraceUntil: connected ? null : Date.now() + graceMs }))
    s.on('game:rematch', () => set({ rematchOffered: true }))
    s.on('duel:invite', ({ code, from }) => {
      if (get().game && get().game.phase !== 'over') return
      sfx.found()
      haptic.success()
      set({ invite: { code, from, at: Date.now() } })
    })
    s.on('duel:declined', () => get().toast(tr('invite_declined')))
    s.on('friend:request', ({ from }) => {
      haptic.light()
      set((st) => ({ friendsBadge: st.friendsBadge + 1 }))
      get().toast(tr('friend_request_from', { name: from.name }))
    })
    s.on('friend:accepted', ({ from }) => {
      haptic.success()
      get().toast(tr('friend_accepted_from', { name: from.name }), 'success')
    })
    s.on('mm:status', (m) => set((st) => ({ mm: st.mm ? { ...st.mm, ...m } : st.mm })))
    s.on('mm:found', () => {
      sfx.found()
      haptic.success()
      set({ mm: null })
    })
  },

  async deleteAccount() {
    await post('/me/delete', { confirm: 'DELETE' })
    setToken(null)
    try {
      localStorage.removeItem('bs_dev_name')
    } catch {}
    getSocket().disconnect()
    set({ status: 'deleted', profile: null, game: null })
  },

  leaveGame() {
    request('game:leave')
    set({ game: null, over: null, feed: [], radar: null, emote: null })
  },

  async updateSettings(patchBody) {
    const { profile } = get()
    set({ profile: { ...profile, ...(patchBody.language ? { language: patchBody.language } : {}), settings: { ...profile.settings, ...patchBody } } })
    return get().mutate('/me/settings', patchBody, { popup: false, method: 'PATCH' })
  },
}))
