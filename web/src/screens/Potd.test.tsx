import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { ToastProvider } from '../components/Toast'
import { Potd } from './Potd'

vi.mock('../api/client', () => ({ api: { potdToday: vi.fn(), potdBank: vi.fn(), potdUpload: vi.fn(), aiSettings: vi.fn() } }))
const mockedApi = vi.mocked(api)
const settings = { personalEnabled: true, duoEnabled: false, policyVersion: 'v1', mode: 'demo' as const, usage: { daily_plan: { remaining: 3, estimatedCostCents: 0 }, duo_reflection: { remaining: 3, estimatedCostCents: 0 }, potd_tutor: { remaining: 3, estimatedCostCents: 0 }, chat: { remaining: 3, estimatedCostCents: 0 } } }

afterEach(() => vi.clearAllMocks())

it('opens DuoGrow AI coach from the POTD tutor launcher', async () => {
  const user = userEvent.setup()
  mockedApi.potdToday.mockResolvedValue({ yours: { id: 'assignment', status: 'open', question: { id: 'question', title: 'Two Sum', body: 'Find the pair.', topic: 'Arrays', difficulty: 'easy', source: 'Local' } }, partners: null })
  mockedApi.potdBank.mockResolvedValue({ questions: [] })
  mockedApi.aiSettings.mockResolvedValue(settings)

  render(<MemoryRouter><ToastProvider><Potd /></ToastProvider></MemoryRouter>)
  await user.click(await screen.findByRole('button', { name: 'Tutor' }))

  expect(screen.getByRole('dialog', { name: 'DuoGrow AI coach' })).toBeVisible()
})
