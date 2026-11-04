import { Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../lib/i18n.js'

/** Renders a sentence with {terms}/{privacy} placeholders as in-app links */
export function LegalLinks({ textKey, onOpen }) {
  const t = useT()
  const navigate = useNavigate()
  const open = (doc) => {
    onOpen?.()
    navigate(`/legal/${doc}`)
  }
  const parts = t(textKey).split(/(\{terms\}|\{privacy\})/)
  return (
    <>
      {parts.map((p, i) =>
        p === '{terms}' ? (
          <button key={i} className="font-bold text-cyan-300 underline-offset-2 hover:underline" onClick={() => open('terms')}>{t('legal_consent_terms')}</button>
        ) : p === '{privacy}' ? (
          <button key={i} className="font-bold text-cyan-300 underline-offset-2 hover:underline" onClick={() => open('privacy')}>{t('legal_consent_privacy')}</button>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  )
}
