import { useEffect, useState } from 'react'
import { Camera, Download, Share2, Smartphone } from 'lucide-react'
import { seasonInfo } from '@shared/catalog.js'
import { useStore } from '../store/app.js'
import { useT, useL } from '../lib/i18n.js'
import { upload } from '../lib/api.js'
import { renderStoryCard } from '../lib/storyCard.js'
import {
  canShareStory, shareToStory, shareLink, haptic, homeScreenStatus, addToHomeScreen,
} from '../lib/telegram.js'
import { Modal, Spinner } from './ui.jsx'

export function inviteLink(config, profile) {
  const base = config?.appLink || location.origin
  return base.includes('t.me/') ? `${base}?startapp=ref_${profile.refCode}` : base
}

const fmtTime = (ms) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** "Post to story" button for a won battle */
export function StoryButton({ over, className = '' }) {
  const t = useT()
  const l = useL()
  const profile = useStore((s) => s.profile)
  const config = useStore((s) => s.config)
  const toast = useStore((s) => s.toast)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null)

  const go = async () => {
    setBusy(true)
    haptic.medium()
    try {
      const { myStats, durationMs, state } = over
      const acc = myStats.shots ? Math.round((myStats.hits / myStats.shots) * 100) : 0
      const season = seasonInfo()
      const blob = await renderStoryCard({
        title: t('victory').replace('!', '').toUpperCase() + '!',
        subtitle: `${state.me.profile.name}  vs  ${state.opp.profile.name}`,
        stats: [[t('shots'), myStats.shots], [t('accuracy'), `${acc}%`], [t('ships_sunk'), myStats.sunk], [t('duration'), fmtTime(durationMs)]],
        shots: state.opp.shots,
        ships: state.opp.ships,
        seasonLabel: `${season.icon} ${t('season_n', { n: season.number })} · ${l(season.name)}`,
        seasonColor: season.color,
        cta: t('story_cta'),
        footer: config?.botUsername ? `@${config.botUsername}` : 'Battleship Online',
      })
      const { url } = await upload('/me/share-card', blob, 'image/png')
      const link = inviteLink(config, profile)
      if (canShareStory()) {
        shareToStory(url, { text: `${t('story_text', { shots: myStats.shots })}\n${link}`, widgetUrl: link, widgetName: t('story_play') })
      } else {
        setPreview({ src: URL.createObjectURL(blob), link, shots: myStats.shots })
      }
    } catch (e) {
      toast(e.code || 'error_generic', 'error')
    }
    setBusy(false)
  }

  return (
    <>
      <button className={`btn h-12 bg-gradient-to-r from-fuchsia-400 via-rose-400 to-amber-300 text-ink-950 ${className}`} onClick={go} disabled={busy}>
        {busy ? <><Spinner size={18} /> {t('story_preparing')}</> : <><Camera size={18} /> {t('story_share')}</>}
      </button>
      <Modal open={!!preview} onClose={() => setPreview(null)}>
        {preview && (
          <div className="glass-strong p-4 text-center">
            <div className="mb-2 font-display font-bold">{t('story_card_ready')}</div>
            <img src={preview.src} alt="" className="mx-auto mb-3 max-h-[52vh] rounded-2xl" />
            <p className="mb-3 text-xs text-slate-400">{t('story_desktop')}</p>
            <div className="grid grid-cols-2 gap-2">
              <a className="btn-ghost" href={preview.src} download="battleship-victory.png"><Download size={16} /> {t('download')}</a>
              <button className="btn-ghost" onClick={() => shareLink(preview.link, t('story_text', { shots: preview.shots }))}><Share2 size={16} /> {t('share')}</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

const PROMPT_KEY = 'bs_home_prompted'

/** One-time suggestion to add the game to the phone's home screen (after the 3rd battle) */
export function HomeScreenPrompt({ games }) {
  const t = useT()
  const toast = useStore((s) => s.toast)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (games < 3) return
    try {
      if (localStorage.getItem(PROMPT_KEY)) return
    } catch {
      return
    }
    let alive = true
    const id = setTimeout(async () => {
      const status = await homeScreenStatus()
      if (alive && (status === 'missed' || status === 'unknown')) setOpen(true)
    }, 2500)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [games])
  const close = () => {
    try {
      localStorage.setItem(PROMPT_KEY, '1')
    } catch {}
    setOpen(false)
  }
  return (
    <Modal open={open} onClose={close}>
      <div className="glass-strong p-6 text-center">
        <div className="naval-modal-icon"><Smartphone size={30} strokeWidth={1.5}/></div>
        <div className="mb-1 font-display text-lg font-bold">{t('home_screen_title')}</div>
        <p className="mb-5 text-sm text-slate-300">{t('home_screen_text')}</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost" onClick={close}>{t('home_screen_later')}</button>
          <button
            className="btn h-12 bg-cyan-300 text-ink-950"
            onClick={() => {
              addToHomeScreen(() => toast(t('home_screen_added'), 'success'))
              close()
            }}
          >
            {t('home_screen_add')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Profile row, shown only where Telegram supports shortcuts and it isn't added yet */
export function useHomeScreenAvailable() {
  const [status, setStatus] = useState('unsupported')
  useEffect(() => {
    homeScreenStatus().then(setStatus)
  }, [])
  return status === 'missed' || status === 'unknown'
}
