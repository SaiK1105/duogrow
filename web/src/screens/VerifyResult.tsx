import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { AiSettings, Band, Proof } from '../api/types'
import { AiCoachSheet } from '../components/AiCoachSheet'
import { CoachBubble } from '../components/CoachBubble'
import { ConfidenceBadge } from '../components/ConfidenceBadge'
import { EvidenceChecklist } from '../components/EvidenceChecklist'
import { BackIcon } from '../components/icons'
import { VerifiedStamp } from '../components/VerifiedStamp'
import { useToast } from '../components/toast-context'
import { usePrivateProofUrl } from '../hooks/usePrivateProofUrl'
import './verify-result.css'

const HEADLINE: Record<Band, string> = {
  high: 'Verified',
  medium: 'Needs Confirmation',
  low: "Couldn't Verify",
}

const FOOTER_NOTE: Record<Band, string> = {
  high: 'This proof has been verified and applied to your dashboard.',
  medium: 'The AI is fairly sure. Confirm to apply this to your dashboard.',
  low: "The AI couldn't ground enough evidence. Try a clearer photo.",
}

export function VerifyResult() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [proof, setProof] = useState<Proof | null>(null)
  const [error, setError] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null)
  const [aiSettingsError, setAiSettingsError] = useState(false)
  const [isCoachOpen, setIsCoachOpen] = useState(false)
  const proofUrl = usePrivateProofUrl(id)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    api
      .getProof(id)
      .then((res) => !cancelled && setProof(res.proof))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    api.aiSettings().then(
      (settings) => { if (!cancelled) setAiSettings(settings) },
      () => { if (!cancelled) setAiSettingsError(true) },
    )
    return () => { cancelled = true }
  }, [])

  const confirm = async () => {
    if (!id) return
    setConfirming(true)
    try {
      await api.applyProof(id)
      showToast('Confirmed — dashboard updated', 'success')
      navigate('/today')
    } catch {
      setConfirming(false)
      showToast('Could not confirm — try again', 'danger')
    }
  }

  if (error) {
    return (
      <div className="screen verify">
        <p className="verify__error">That proof could not be loaded.</p>
        <button type="button" className="btn btn--outline btn--block" onClick={() => navigate('/upload')}>
          Back to upload
        </button>
      </div>
    )
  }

  if (!proof) {
    return (
      <div className="screen verify">
        <div className="verify__skeleton" />
      </div>
    )
  }

  const band = proof.band
  const autoApplied = band === 'high'

  return (
    <div className="verify" data-band={band}>
      <div className="verify__ghost" aria-hidden="true" style={proofUrl ? { backgroundImage: `url(${proofUrl})` } : undefined} />

      <header className="verify__header">
        <button type="button" className="verify__back" onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon size={20} />
        </button>
        <span className="verify__eyebrow">Verification Result</span>
        <span className="verify__spacer" />
      </header>

      <div className="verify__body screen__enter">
        <article className={`verify__card verify__card--${band}`}>
          <span className="verify__stamp">
            <VerifiedStamp band={band} size={92} />
          </span>

          <h1 className="verify__headline">{HEADLINE[band]}</h1>
          <ConfidenceBadge tier={band} percent={proof.aiConfidence} />

          <hr className="verify__divider" />

          {proof.evidence.length > 0 ? (
            <EvidenceChecklist items={proof.evidence} band={band} />
          ) : (
            <p className="verify__no-evidence">No evidence was extracted from this image.</p>
          )}

          <p className={`verify__note verify__note--${band}`}>{FOOTER_NOTE[band]}</p>
        </article>

        {autoApplied && (
          <div className="verify__streak-chip">
            Duo streak +1 <span aria-hidden="true">🔥</span>
          </div>
        )}

        {proof.coachMessage && (
          <CoachBubble message={proof.coachMessage} mood={band === 'low' ? 'warn' : 'celebrate'} />
        )}

        <div className="verify__footer">
          {aiSettings ? <button type="button" className="btn btn--outline btn--block" onClick={() => setIsCoachOpen(true)}>Ask DuoGrow AI</button> : aiSettingsError ? <p>AI coach unavailable</p> : null}
          {band === 'high' && (
            <button type="button" className="btn btn--primary btn--block" onClick={() => navigate('/today')}>
              View updated dashboard →
            </button>
          )}

          {band === 'medium' && (
            <>
              <button
                type="button"
                className="btn btn--primary btn--block"
                onClick={confirm}
                disabled={confirming}
              >
                {confirming ? 'Confirming…' : 'Confirm & apply'}
              </button>
              <button type="button" className="btn btn--ghost btn--block" onClick={() => navigate(-1)}>
                Back
              </button>
            </>
          )}

          {band === 'low' && (
            <button type="button" className="btn btn--outline btn--block" onClick={() => navigate('/upload')}>
              Try another photo
            </button>
          )}
        </div>
      </div>
      {aiSettings && <AiCoachSheet isOpen={isCoachOpen} settings={aiSettings} onClose={() => setIsCoachOpen(false)} />}
    </div>
  )
}
