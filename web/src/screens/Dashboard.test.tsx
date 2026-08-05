import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { AnalyticsSummary } from '../api/types'
import { Dashboard } from './Dashboard'

vi.mock('../api/client', () => ({
  api: {
    analyticsSummary: vi.fn(),
    analyticsProofs: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api)

function summaryWith(overrides: Partial<AnalyticsSummary> = {}): AnalyticsSummary {
  return {
    range: { from: '2026-06-22', to: '2026-07-21', days: 30 },
    members: [
      { userId: 'u1', name: 'Sai' },
      { userId: 'u2', name: 'Ari' },
    ],
    series: [
      { date: '2026-07-20', values: [0.8, 0.4] },
      { date: '2026-07-21', values: [0.6, 0.2] },
    ],
    modules: [
      { module: 'wake', averages: [0.9, 0.5], doneDays: [27, 15] },
      { module: 'study', averages: [0.7, 0.3], doneDays: [21, 9] },
      { module: 'workout', averages: [0.5, 0.5], doneDays: [15, 15] },
      { module: 'diet', averages: [0.4, 0.6], doneDays: [12, 18] },
      { module: 'tasks', averages: [0.3, 0.7], doneDays: [9, 21] },
    ],
    current: {
      from: '2026-06-22',
      to: '2026-07-21',
      growthScore: 72,
      subscores: { discipline: 70, mind: 65, health: 60, consistency: 80 },
      completion: [0.7, 0.3],
    },
    previous: {
      from: '2026-05-23',
      to: '2026-06-21',
      growthScore: 64,
      subscores: { discipline: 60, mind: 60, health: 55, consistency: 70 },
      completion: [0.6, 0.25],
    },
    ...overrides,
  }
}

const emptyPeriod = {
  from: '2026-06-22',
  to: '2026-07-21',
  growthScore: 0,
  subscores: { discipline: 0, mind: 0, health: 0, consistency: 0 },
  completion: [0, 0],
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('Dashboard', () => {
  it('shows a loading state until the summary resolves', () => {
    mockedApi.analyticsSummary.mockImplementation(() => new Promise(() => undefined))

    render(<Dashboard />)

    expect(screen.getByText('Loading analytics…')).toBeVisible()
  })

  it('offers a retry that refetches after a failed request', async () => {
    const user = userEvent.setup()
    mockedApi.analyticsSummary.mockRejectedValueOnce(new Error('boom'))
    mockedApi.analyticsProofs.mockResolvedValue({ proofs: [], nextCursor: null })

    render(<Dashboard />)

    expect(await screen.findByText('Analytics are unavailable')).toBeVisible()

    mockedApi.analyticsSummary.mockResolvedValueOnce(summaryWith())
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('img', { name: /Daily completion per member/ })).toBeInTheDocument()
  })

  it('explains that data accumulates when the duo has no history at all', async () => {
    mockedApi.analyticsSummary.mockResolvedValue(
      summaryWith({
        series: [
          { date: '2026-07-20', values: [0, 0] },
          { date: '2026-07-21', values: [0, 0] },
        ],
        current: emptyPeriod,
        previous: emptyPeriod,
      }),
    )

    render(<Dashboard />)

    expect(await screen.findByText('No history yet')).toBeVisible()
    expect(screen.queryByText('Analytics are unavailable')).not.toBeInTheDocument()
  })

  it('prompts to widen the range when only earlier periods have data', async () => {
    mockedApi.analyticsSummary.mockResolvedValue(
      summaryWith({
        series: [
          { date: '2026-07-20', values: [0, 0] },
          { date: '2026-07-21', values: [0, 0] },
        ],
        current: emptyPeriod,
      }),
    )

    render(<Dashboard />)

    expect(await screen.findByText('Nothing logged in this window')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Show 90 days' })).toBeVisible()
  })

  it('renders the charts, stats and proof history for a populated duo', async () => {
    mockedApi.analyticsSummary.mockResolvedValue(summaryWith())
    mockedApi.analyticsProofs.mockResolvedValue({
      proofs: [
        {
          id: 'p1',
          userId: 'u1',
          date: '2026-07-21',
          module: 'study',
          status: 'verified',
          confidence: 92,
          band: 'high',
          summary: 'Timer screenshot',
          createdAt: '2026-07-21T09:00:00.000Z',
        },
      ],
      nextCursor: null,
    })

    render(<Dashboard />)

    expect(await screen.findByRole('img', { name: /Daily completion per member/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /one column per week/ })).toBeInTheDocument()
    expect(screen.getByText('Growth score')).toBeVisible()
    expect(screen.getByText('+8')).toBeVisible()
    expect(await screen.findByText('Timer screenshot')).toBeVisible()
    expect(screen.getByText('92%')).toBeVisible()
  })

  it('refetches with the new range when the range changes', async () => {
    const user = userEvent.setup()
    mockedApi.analyticsSummary.mockResolvedValue(summaryWith())
    mockedApi.analyticsProofs.mockResolvedValue({ proofs: [], nextCursor: null })

    render(<Dashboard />)

    await waitFor(() => expect(mockedApi.analyticsSummary).toHaveBeenCalledWith(30))

    await user.click(screen.getByRole('button', { name: '365 days' }))

    await waitFor(() => expect(mockedApi.analyticsSummary).toHaveBeenCalledWith(365))
    expect(mockedApi.analyticsSummary).toHaveBeenCalledTimes(2)
  })
})
