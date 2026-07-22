import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { Insights } from './Insights'

vi.mock('../api/client', () => ({ api: { insights: vi.fn(), weeklyReport: vi.fn(), aiSettings: vi.fn() } }))

const mockedApi = vi.mocked(api)
const settings = { personalEnabled: true, duoEnabled: false, mutualDuoConsent: false, policyVersion: 'v1', mode: 'demo' as const, dailyBudgetRemainingCents: 3, usage: { daily_plan: { remaining: 3, estimatedCostCents: 0 }, duo_reflection: { remaining: 3, estimatedCostCents: 0 }, potd_tutor: { remaining: 3, estimatedCostCents: 0 }, chat: { remaining: 3, estimatedCostCents: 0 }, insights_explain: { remaining: 3, estimatedCostCents: 0 } } }

afterEach(() => vi.clearAllMocks())

describe('Insights AI launchers', () => {
  it('keeps insight content visible when AI settings are unavailable', async () => {
    mockedApi.insights.mockResolvedValue({ growthScore: 50, subscores: { discipline: 50, mind: 50, health: 50, consistency: 50 }, prediction: { forUser: 'You', behavior: 'Study', riskPercent: 20, reason: 'On track' }, suggestion: 'Keep going', strength: 'Consistency', weeklyVerdict: 'Good' })
    mockedApi.weeklyReport.mockResolvedValue({ studyTime: 60, workouts: { done: 1, target: 2 }, goals: { done: 1, target: 2 }, consistency: 50, verdict: 'Good' })
    mockedApi.aiSettings.mockRejectedValue(new Error('Unavailable'))

    render(<Insights />)

    expect(await screen.findByText('AI coach unavailable')).toBeVisible()
    expect(screen.getByText('Keep going')).toBeVisible()
  })

  it.each([['Explain this', 'Explain insights'], ['Make a plan', 'Create daily plan']])('opens the corresponding labelled DuoGrow AI action from %s', async (label, selectedAction) => {
    const user = userEvent.setup()
    mockedApi.insights.mockResolvedValue({ growthScore: 50, subscores: { discipline: 50, mind: 50, health: 50, consistency: 50 }, prediction: { forUser: 'You', behavior: 'Study', riskPercent: 20, reason: 'On track' }, suggestion: 'Keep going', strength: 'Consistency', weeklyVerdict: 'Good' })
    mockedApi.weeklyReport.mockResolvedValue({ studyTime: 60, workouts: { done: 1, target: 2 }, goals: { done: 1, target: 2 }, consistency: 50, verdict: 'Good' })
    mockedApi.aiSettings.mockResolvedValue(settings)

    render(<Insights />)
    await user.click(await screen.findByRole('button', { name: label }))

    expect(screen.getByRole('dialog', { name: 'DuoGrow AI coach' })).toBeVisible()
    expect(screen.getByText(`Selected action: ${selectedAction}`)).toBeVisible()
  })
})
