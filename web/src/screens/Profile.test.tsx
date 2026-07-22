import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { ToastProvider } from '../components/Toast'
import { Profile } from './Profile'

vi.mock('../api/client', () => ({ api: { me: vi.fn(), today: vi.fn(), health: vi.fn(), aiSettings: vi.fn(), updateAiSettings: vi.fn(), deleteAiData: vi.fn() }, clearToken: vi.fn() }))
const mockedApi = vi.mocked(api)
const settings = { personalEnabled: true, duoEnabled: false, mutualDuoConsent: false, policyVersion: 'v1', mode: 'demo' as const, dailyBudgetRemainingCents: 3, usage: { daily_plan: { remaining: 3, estimatedCostCents: 0 }, duo_reflection: { remaining: 3, estimatedCostCents: 0 }, potd_tutor: { remaining: 3, estimatedCostCents: 0 }, chat: { remaining: 3, estimatedCostCents: 0 }, insights_explain: { remaining: 3, estimatedCostCents: 0 } } }

afterEach(() => vi.clearAllMocks())

describe('Profile AI privacy', () => {
  it('keeps profile actions available when AI privacy settings fail to load', async () => {
    mockedApi.me.mockResolvedValue({ user: { id: 'me', name: 'Sai', duoId: 'duo' }, duo: { id: 'duo', name: 'Duo', inviteCode: 'JOIN', members: [{ id: 'me', name: 'Sai' }, { id: 'partner', name: 'Sreya' }] } })
    mockedApi.today.mockResolvedValue({ streak: 4 } as Awaited<ReturnType<typeof api.today>>)
    mockedApi.health.mockResolvedValue({ demo: true })
    mockedApi.aiSettings.mockRejectedValue(new Error('Unavailable'))

    render(<MemoryRouter><ToastProvider><Profile /></ToastProvider></MemoryRouter>)

    expect(await screen.findByText('AI privacy controls are unavailable.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled()
  })

  it('shows AI & Privacy and gates Duo Reflection until mutual consent is active', async () => {
    mockedApi.me.mockResolvedValue({ user: { id: 'me', name: 'Sai', duoId: 'duo' }, duo: { id: 'duo', name: 'Duo', inviteCode: 'JOIN', members: [{ id: 'me', name: 'Sai' }, { id: 'partner', name: 'Sreya' }] } })
    mockedApi.today.mockResolvedValue({ streak: 4 } as Awaited<ReturnType<typeof api.today>>)
    mockedApi.health.mockResolvedValue({ demo: true })
    mockedApi.aiSettings.mockResolvedValue(settings)

    render(<MemoryRouter><ToastProvider><Profile /></ToastProvider></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'AI & Privacy' })).toBeVisible()
    expect(screen.getByText(/Duo Reflection is unavailable until both partners enable it/)).toBeVisible()
  })
})
