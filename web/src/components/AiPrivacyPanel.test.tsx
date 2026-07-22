import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AiPrivacyPanel } from './AiPrivacyPanel'

const settings = { personalEnabled: false, duoEnabled: false, policyVersion: '1', mode: 'disabled' as const, usage: { daily_plan: { remaining: 3, estimatedCostCents: 0 }, duo_reflection: { remaining: 1, estimatedCostCents: 0 }, potd_tutor: { remaining: 5, estimatedCostCents: 0 }, chat: { remaining: 10, estimatedCostCents: 0 } } }

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
})
