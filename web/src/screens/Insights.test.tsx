import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { Insights } from './Insights'

vi.mock('../api/client', () => ({ api: { insights: vi.fn(), weeklyReport: vi.fn(), aiSettings: vi.fn() } }))

const mockedApi = vi.mocked(api)
const settings = { personalEnabled: true, duoEnabled: false, policyVersion: 'v1', mode: 'demo' as const, usage: { daily_plan: { remaining: 3, estimatedCostCents: 0 }, duo_reflection: { remaining: 3, estimatedCostCents: 0 }, potd_tutor: { remaining: 3, estimatedCostCents: 0 }, chat: { remaining: 3, estimatedCostCents: 0 } } }

afterEach(() => vi.clearAllMocks())

describe('Insights AI launchers', () => {
  it.each(['Explain this', 'Make a plan'])('opens DuoGrow AI coach from %s', async (label) => {
    const user = userEvent.setup()
    mockedApi.insights.mockResolvedValue({ growthScore: 50, subscores: { discipline: 50, mind: 50, health: 50, consistency: 50 }, prediction: { forUser: 'You', behavior: 'Study', riskPercent: 20, reason: 'On track' }, suggestion: 'Keep going', strength: 'Consistency', weeklyVerdict: 'Good' })
    mockedApi.weeklyReport.mockResolvedValue({ studyTime: 60, workouts: { done: 1, target: 2 }, goals: { done: 1, target: 2 }, consistency: 50, verdict: 'Good' })
    mockedApi.aiSettings.mockResolvedValue(settings)

    render(<Insights />)
    await user.click(await screen.findByRole('button', { name: label }))

    expect(screen.getByRole('dialog', { name: 'DuoGrow AI coach' })).toBeVisible()
  })
})
