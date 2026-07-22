import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { ToastProvider } from '../components/Toast'
import { Profile } from './Profile'

vi.mock('../api/client', () => ({ api: { me: vi.fn(), today: vi.fn(), health: vi.fn(), aiSettings: vi.fn(), updateAiSettings: vi.fn(), updateAiDuoConsent: vi.fn(), deleteAiData: vi.fn() }, clearToken: vi.fn() }))
const mockedApi = vi.mocked(api)
const settings = { personalEnabled: true, duoEnabled: false, policyVersion: 'v1', mode: 'demo' as const, usage: { daily_plan: { remaining: 3, estimatedCostCents: 0 }, duo_reflection: { remaining: 3, estimatedCostCents: 0 }, potd_tutor: { remaining: 3, estimatedCostCents: 0 }, chat: { remaining: 3, estimatedCostCents: 0 } } }

afterEach(() => vi.clearAllMocks())

describe('Profile AI privacy', () => {
  it('shows AI & Privacy and gates Duo Reflection until mutual consent is active', async () => {
    mockedApi.me.mockResolvedValue({ user: { id: 'me', name: 'Sai', duoId: 'duo' }, duo: { id: 'duo', name: 'Duo', inviteCode: 'JOIN', members: [{ id: 'me', name: 'Sai' }, { id: 'partner', name: 'Sreya' }] } })
    mockedApi.today.mockResolvedValue({ streak: 4 } as Awaited<ReturnType<typeof api.today>>)
    mockedApi.health.mockResolvedValue({ demo: true })
    mockedApi.aiSettings.mockResolvedValue(settings)

    render(<MemoryRouter><ToastProvider><Profile /></ToastProvider></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'AI & Privacy' })).toBeVisible()
    expect(screen.getByText(/Partner consent required/)).toBeVisible()
  })
})
