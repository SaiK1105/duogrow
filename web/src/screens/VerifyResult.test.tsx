import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { ToastProvider } from '../components/Toast'
import { VerifyResult } from './VerifyResult'

vi.mock('../api/client', () => ({ api: { getProof: vi.fn(), applyProof: vi.fn(), proofFile: vi.fn(), aiSettings: vi.fn(), dailyPlan: vi.fn(), duoReflection: vi.fn(), potdTutor: vi.fn(), chat: vi.fn() } }))
const mockedApi = vi.mocked(api)
const settings = { personalEnabled: true, duoEnabled: false, mutualDuoConsent: false, policyVersion: 'v1', mode: 'demo' as const, usage: { daily_plan: { remaining: 3, estimatedCostCents: 0 }, duo_reflection: { remaining: 3, estimatedCostCents: 0 }, potd_tutor: { remaining: 3, estimatedCostCents: 0 }, chat: { remaining: 3, estimatedCostCents: 0 }, insights_explain: { remaining: 3, estimatedCostCents: 0 } } }

beforeEach(() => {
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:proof-preview'), revokeObjectURL: vi.fn() })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

it('opens coaching without attaching proof media or proof data', async () => {
  const user = userEvent.setup()
  mockedApi.getProof.mockResolvedValue({ proof: { id: 'proof-id', url: '/secret-proof.jpg', module: 'study', aiStatus: 'verified', aiConfidence: 0.9, band: 'high', evidence: ['raw evidence'], metrics: { raw: 'detail' }, coachMessage: 'Nice work', summary: 'Raw proof detail', appliedUpdate: null, createdAt: '2026-07-22T00:00:00.000Z' } })
  mockedApi.proofFile.mockResolvedValue(new Blob(['proof'], { type: 'image/jpeg' }))
  mockedApi.aiSettings.mockResolvedValue(settings)
  mockedApi.dailyPlan.mockResolvedValue({ text: 'Plan', mode: 'demo', remaining: 2, estimatedCostCents: 0 })

  render(<MemoryRouter initialEntries={['/verify/proof-id']}><ToastProvider><Routes><Route path="/verify/:id" element={<VerifyResult />} /></Routes></ToastProvider></MemoryRouter>)
  await waitFor(() => expect(mockedApi.proofFile).toHaveBeenCalledWith('proof-id'))
  mockedApi.proofFile.mockClear()

  await user.click(await screen.findByRole('button', { name: 'Ask DuoGrow AI' }))
  await user.click(screen.getByRole('button', { name: 'Create daily plan' }))

  await waitFor(() => expect(mockedApi.dailyPlan).toHaveBeenCalledWith())
  expect(mockedApi.proofFile).not.toHaveBeenCalled()
})

it('keeps the verification result visible when AI settings are unavailable', async () => {
  mockedApi.getProof.mockResolvedValue({ proof: { id: 'proof-id', url: '/secret-proof.jpg', module: 'study', aiStatus: 'verified', aiConfidence: 0.9, band: 'high', evidence: [], metrics: {}, coachMessage: '', summary: 'Summary', appliedUpdate: null, createdAt: '2026-07-22T00:00:00.000Z' } })
  mockedApi.proofFile.mockResolvedValue(new Blob(['proof'], { type: 'image/jpeg' }))
  mockedApi.aiSettings.mockRejectedValue(new Error('Unavailable'))

  render(<MemoryRouter initialEntries={['/verify/proof-id']}><ToastProvider><Routes><Route path="/verify/:id" element={<VerifyResult />} /></Routes></ToastProvider></MemoryRouter>)

  expect(await screen.findByText('AI coach unavailable')).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Verified' })).toBeVisible()
})
