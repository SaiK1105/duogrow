import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AiPrivacyPanel } from './AiPrivacyPanel'

const settings = { personalEnabled: false, duoEnabled: false, policyVersion: '1', mode: 'disabled' as const, usage: { daily_plan: { remaining: 3, estimatedCostCents: 0 }, duo_reflection: { remaining: 1, estimatedCostCents: 0 }, potd_tutor: { remaining: 5, estimatedCostCents: 0 }, chat: { remaining: 10, estimatedCostCents: 0 } } }

function deferred<T>() {
  let resolve: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve: resolve! }
}

describe('AiPrivacyPanel', () => {
  it('discloses consent, withdrawal, provider retention controls, daily budget, and demo state', () => {
    render(<AiPrivacyPanel settings={{ ...settings, mode: 'demo' }} onSettingsChange={vi.fn()} />)
    expect(screen.getByText(/Your consent is required/i)).toBeVisible()
    expect(screen.getByText(/withdraw it at any time/i)).toBeVisible()
    expect(screen.getByText(/provider retention controls/i)).toBeVisible()
    expect(screen.getByText(/Daily budget/i)).toBeVisible()
    expect(screen.getByText('Demo coaching is active')).toBeVisible()
  })

  it('updates personal consent and records duo consent separately', async () => {
    const user = userEvent.setup()
    const updateAiSettings = vi.fn().mockResolvedValue({ ...settings, personalEnabled: true, mode: 'demo' })
    const updateAiDuoConsent = vi.fn().mockResolvedValue({ enabled: true, mutual: false })
    render(<AiPrivacyPanel settings={settings} onSettingsChange={vi.fn()} client={{ updateAiSettings, updateAiDuoConsent }} />)

    await user.click(screen.getByRole('checkbox', { name: 'Enable personal AI coaching' }))
    await user.click(screen.getByRole('checkbox', { name: 'Allow Duo Reflection' }))

    expect(updateAiSettings).toHaveBeenCalledWith({ personalEnabled: true, duoEnabled: false })
    expect(updateAiDuoConsent).toHaveBeenCalledWith(true)
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for your partner')
  })

  it('requires confirmation before deleting AI data', async () => {
    const user = userEvent.setup()
    const deleteAiData = vi.fn().mockResolvedValue(undefined)
    render(<AiPrivacyPanel settings={settings} onSettingsChange={vi.fn()} client={{ deleteAiData }} />)

    await user.click(screen.getByRole('button', { name: 'Delete AI data' }))
    expect(deleteAiData).not.toHaveBeenCalled()
    expect(screen.getByText(/This cannot be undone/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Confirm deletion' }))
    expect(deleteAiData).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('AI data deleted')
  })

  it('shows a polite error and retries a failed preference update', async () => {
    const user = userEvent.setup()
    const updateAiSettings = vi.fn().mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValueOnce({ ...settings, personalEnabled: true, mode: 'demo' })
    render(<AiPrivacyPanel settings={settings} onSettingsChange={vi.fn()} client={{ updateAiSettings }} />)

    await user.click(screen.getByRole('checkbox', { name: 'Enable personal AI coaching' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved')
    await user.click(screen.getByRole('button', { name: 'Retry last action' }))
    await waitFor(() => expect(updateAiSettings).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('status')).toHaveTextContent('Personal AI consent saved')
  })

  it('awaits preference persistence before mutual duo-consent feedback', async () => {
    const user = userEvent.setup()
    const preferences = deferred<typeof settings>()
    const consent = deferred<{ enabled: boolean; mutual: boolean }>()
    const updateAiSettings = vi.fn().mockReturnValue(preferences.promise)
    const updateAiDuoConsent = vi.fn().mockReturnValue(consent.promise)
    render(<AiPrivacyPanel settings={settings} onSettingsChange={vi.fn()} client={{ updateAiSettings, updateAiDuoConsent }} />)

    await user.click(screen.getByRole('checkbox', { name: 'Allow Duo Reflection' }))
    expect(updateAiDuoConsent).not.toHaveBeenCalled()
    preferences.resolve({ ...settings, duoEnabled: true })
    await waitFor(() => expect(updateAiDuoConsent).toHaveBeenCalledWith(true))
    consent.resolve({ enabled: true, mutual: true })
    await waitFor(() => expect(screen.getByText('Mutual partner consent is active.')).toBeVisible())
  })
})
