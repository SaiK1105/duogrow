import { useState } from 'react'
import { api } from '../api/client'
import type { AiSettings } from '../api/types'
import './ai-privacy-panel.css'

type PrivacyClient = Pick<typeof api, 'updateAiSettings' | 'updateAiDuoConsent' | 'deleteAiData'>

interface AiPrivacyPanelProps {
  settings: AiSettings
  onSettingsChange: (settings: AiSettings) => void
  client?: Partial<PrivacyClient>
}

export function AiPrivacyPanel({ settings, onSettingsChange, client = {} }: AiPrivacyPanelProps) {
  const [status, setStatus] = useState('')
  const [confirmingDeletion, setConfirmingDeletion] = useState(false)
  const updateSettings = async (patch: Pick<AiSettings, 'personalEnabled' | 'duoEnabled'>) => {
    const next = await (client.updateAiSettings ?? api.updateAiSettings)(patch)
    onSettingsChange(next)
    setStatus(next.personalEnabled ? 'Personal AI consent saved.' : 'Personal AI consent withdrawn.')
  }
  const updateDuoConsent = async (enabled: boolean) => {
    const result = await (client.updateAiDuoConsent ?? api.updateAiDuoConsent)(enabled)
    setStatus(result.mutual ? 'Mutual partner consent is active.' : 'Waiting for your partner to consent.')
  }
  const deleteData = async () => {
    await (client.deleteAiData ?? api.deleteAiData)()
    setConfirmingDeletion(false)
    setStatus('AI data deleted. Your DuoGrow activity and proof data were not changed.')
  }
  const totalRemaining = Object.values(settings.usage).reduce((total, usage) => total + usage.remaining, 0)

  return <section className="ai-privacy-panel card" aria-labelledby="ai-privacy-title">
    <h2 id="ai-privacy-title">AI privacy controls</h2>
    <p>Your consent is required before personal coaching requests. You can withdraw it at any time.</p>
    <p>Only aggregate progress and goals are sent; proof media is never sent. Live providers follow their provider retention controls. Chat messages are not saved by DuoGrow.</p>
    <p><strong>Daily budget:</strong> {totalRemaining} requests remaining across available coaching tools.</p>
    <p>{settings.mode === 'demo' ? 'Demo coaching is active' : settings.mode === 'live' ? 'Live coaching is active' : 'AI coaching is off'}</p>
    <label className="ai-privacy-panel__toggle"><input type="checkbox" checked={settings.personalEnabled} onChange={(event) => void updateSettings({ personalEnabled: event.target.checked, duoEnabled: settings.duoEnabled })} /> Enable personal AI coaching</label>
    <label className="ai-privacy-panel__toggle"><input type="checkbox" checked={settings.duoEnabled} onChange={(event) => { void updateSettings({ personalEnabled: settings.personalEnabled, duoEnabled: event.target.checked }); void updateDuoConsent(event.target.checked) }} /> Allow Duo Reflection</label>
    <p className="ai-privacy-panel__note">Duo Reflection runs only when both partners consent. Either partner can withdraw consent.</p>
    {status && <p role="status" aria-live="polite">{status}</p>}
    {confirmingDeletion ? <div className="ai-privacy-panel__confirm"><p>This cannot be undone. Delete AI preferences, usage, and audit data?</p><button className="btn btn--danger" type="button" onClick={() => void deleteData()}>Confirm deletion</button><button className="btn btn--ghost" type="button" onClick={() => setConfirmingDeletion(false)}>Cancel</button></div> : <button className="btn btn--danger" type="button" onClick={() => setConfirmingDeletion(true)}>Delete AI data</button>}
  </section>
}
