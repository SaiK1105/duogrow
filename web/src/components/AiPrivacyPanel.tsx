import { useState } from 'react'
import { api } from '../api/client'
import type { AiSettings } from '../api/types'
import './ai-privacy-panel.css'

type PrivacyClient = Pick<typeof api, 'updateAiSettings' | 'updateAiDuoConsent' | 'deleteAiData'>
type PendingAction = 'preferences' | 'deletion' | null

interface RetryAction {
  kind: Exclude<PendingAction, null>
  operation: () => Promise<void>
}

interface AiPrivacyPanelProps {
  settings: AiSettings
  onSettingsChange: (settings: AiSettings) => void
  client?: Partial<PrivacyClient>
}

export function AiPrivacyPanel({ settings, onSettingsChange, client = {} }: AiPrivacyPanelProps) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [retry, setRetry] = useState<RetryAction | null>(null)
  const [confirmingDeletion, setConfirmingDeletion] = useState(false)

  const run = async (kind: Exclude<PendingAction, null>, operation: () => Promise<void>) => {
    setPendingAction(kind)
    setError('')
    setRetry(null)
    try {
      await operation()
    } catch {
      setError(kind === 'deletion' ? 'AI data could not be deleted. Please retry.' : 'Your AI preferences could not be saved. Please retry.')
      setRetry({ kind, operation })
    } finally {
      setPendingAction(null)
    }
  }

  const savePersonal = (enabled: boolean) => {
    const operation = async () => {
      const next = await (client.updateAiSettings ?? api.updateAiSettings)({ personalEnabled: enabled, duoEnabled: settings.duoEnabled })
      onSettingsChange(next)
      setStatus(next.personalEnabled ? 'Personal AI consent saved.' : 'Personal AI consent withdrawn.')
    }
    void run('preferences', operation)
  }

  const saveDuoPreferences = (enabled: boolean) => {
    const operation = async () => {
      const next = await (client.updateAiSettings ?? api.updateAiSettings)({ personalEnabled: settings.personalEnabled, duoEnabled: enabled })
      onSettingsChange(next)
      const consent = await (client.updateAiDuoConsent ?? api.updateAiDuoConsent)(enabled)
      setStatus(consent.mutual ? 'Mutual partner consent is active.' : 'Waiting for your partner to consent.')
    }
    void run('preferences', operation)
  }

  const deleteData = () => {
    const operation = async () => {
      await (client.deleteAiData ?? api.deleteAiData)()
      setConfirmingDeletion(false)
      setStatus('AI data deleted. Your DuoGrow activity and proof data were not changed.')
    }
    void run('deletion', operation)
  }

  const totalRemaining = Object.values(settings.usage).reduce((total, usage) => total + usage.remaining, 0)
  const controlsDisabled = pendingAction !== null

  return <section className="ai-privacy-panel card" aria-labelledby="ai-privacy-title">
    <h2 id="ai-privacy-title">AI privacy controls</h2>
    <p>Your consent is required before personal coaching requests. You can withdraw it at any time.</p>
    <p>Only aggregate progress and goals are sent; proof media is never sent. Live providers follow their provider retention controls. Chat messages are not saved by DuoGrow.</p>
    <p><strong>Daily budget:</strong> {totalRemaining} requests remaining across available coaching tools.</p>
    <p>{settings.mode === 'demo' ? 'Demo coaching is active' : settings.mode === 'live' ? 'Live coaching is active' : 'AI coaching is off'}</p>
    <label className="ai-privacy-panel__toggle"><input type="checkbox" checked={settings.personalEnabled} disabled={controlsDisabled} onChange={(event) => savePersonal(event.target.checked)} /> Enable personal AI coaching</label>
    <label className="ai-privacy-panel__toggle"><input type="checkbox" checked={settings.duoEnabled} disabled={controlsDisabled} onChange={(event) => saveDuoPreferences(event.target.checked)} /> Allow Duo Reflection</label>
    <p className="ai-privacy-panel__note">Duo Reflection runs only when both partners consent. Either partner can withdraw consent.</p>
    {pendingAction && <p role="status" aria-live="polite">Saving your AI controls…</p>}
    {status && <p role="status" aria-live="polite">{status}</p>}
    {error && <div className="ai-privacy-panel__error"><p role="alert" aria-live="polite">{error}</p>{retry && <button className="btn btn--outline" type="button" onClick={() => void run(retry.kind, retry.operation)}>Retry last action</button>}</div>}
    {confirmingDeletion ? <div className="ai-privacy-panel__confirm"><p>This cannot be undone. Delete AI preferences, usage, and audit data?</p><button className="btn btn--danger" type="button" disabled={controlsDisabled} onClick={deleteData}>{pendingAction === 'deletion' ? 'Deleting AI data…' : 'Confirm deletion'}</button><button className="btn btn--ghost" type="button" disabled={controlsDisabled} onClick={() => setConfirmingDeletion(false)}>Cancel</button></div> : <button className="btn btn--danger" type="button" disabled={controlsDisabled} onClick={() => setConfirmingDeletion(true)}>Delete AI data</button>}
  </section>
}
