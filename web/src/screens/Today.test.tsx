import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { TodayResponse } from '../api/types'
import { ToastProvider } from '../components/Toast'
import { Today } from './Today'

vi.mock('../api/client', () => ({
  api: {
    today: vi.fn(),
    updateModule: vi.fn(),
    seenCheer: vi.fn(),
    cheer: vi.fn(),
  },
}))

const todayResponse: TodayResponse = {
  date: 'Tuesday, July 22',
  you: {
    userId: 'you',
    name: 'Sai',
    progress: 50,
    modules: {
      wake: { status: 'done', value: null, target: null, detail: null },
      study: { status: 'pending', value: 30, target: 60, detail: null },
      workout: { status: 'pending', value: 0, target: 1, detail: null },
      diet: { status: 'pending', value: 200, target: 2000, detail: null },
      tasks: { status: 'pending', value: 0, target: 3, detail: null },
    },
    potd: null,
  },
  partner: null,
  duoProgress: 50,
  streak: 3,
  growthScore: 50,
  unseenCheers: [],
  coachMessage: 'Keep going.',
}

const mockedApi = vi.mocked(api)

function renderToday() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Today />
      </ToastProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('Today', () => {
  it('adds a selected meal to the current diet total', async () => {
    const user = userEvent.setup()
    mockedApi.today.mockResolvedValue(todayResponse)
    mockedApi.updateModule.mockResolvedValue({
      ok: true,
      entry: { module: 'diet', status: 'pending', value: 700, target: 2000, detail: null },
    })

    renderToday()

    await user.click(await screen.findByRole('button', { name: '+ Log meal' }))
    await user.click(screen.getByRole('button', { name: '500 calories' }))
    await user.click(screen.getByRole('button', { name: 'Add meal' }))

    await waitFor(() => {
      expect(mockedApi.updateModule).toHaveBeenCalledWith('diet', { value: 700 })
    })
  })

  it('ignores a second Study action while the first module update is pending', async () => {
    const user = userEvent.setup()
    let resolveUpdate: (() => void) | undefined
    mockedApi.today.mockResolvedValue(todayResponse)
    mockedApi.updateModule.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = () =>
            resolve({
              ok: true,
              entry: { module: 'study', status: 'pending', value: 60, target: 60, detail: null },
            })
        }),
    )

    renderToday()

    const studyAction = await screen.findByRole('button', { name: '+30m' })
    await user.click(studyAction)
    await user.click(studyAction)

    expect(mockedApi.updateModule).toHaveBeenCalledTimes(1)
    expect(studyAction).toBeDisabled()

    resolveUpdate?.()
  })

  it('disables Add meal while its diet update is unresolved', async () => {
    const user = userEvent.setup()
    mockedApi.today.mockResolvedValue(todayResponse)
    mockedApi.updateModule.mockImplementation(() => new Promise(() => undefined))

    renderToday()

    await user.click(await screen.findByRole('button', { name: '+ Log meal' }))
    await user.click(screen.getByRole('button', { name: 'Add meal' }))

    expect(screen.getByRole('button', { name: 'Add meal' })).toBeDisabled()
  })

  it('disables cheering while a Today mutation is unresolved', async () => {
    const user = userEvent.setup()
    mockedApi.today.mockResolvedValue(todayResponse)
    mockedApi.updateModule.mockImplementation(() => new Promise(() => undefined))

    renderToday()

    await user.click(await screen.findByRole('button', { name: '+30m' }))

    expect(screen.getByRole('button', { name: 'Cheer Partner' })).toBeDisabled()
  })

  it('restores meal trigger focus after a successful save clears', async () => {
    const user = userEvent.setup()
    let resolveUpdate: (() => void) | undefined
    mockedApi.today.mockResolvedValue(todayResponse)
    mockedApi.updateModule.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = () =>
            resolve({
              ok: true,
              entry: { module: 'diet', status: 'pending', value: 700, target: 2000, detail: null },
            })
        }),
    )

    renderToday()

    const mealTrigger = await screen.findByRole('button', { name: '+ Log meal' })
    await user.click(mealTrigger)
    await user.click(screen.getByRole('button', { name: 'Add meal' }))

    expect(mealTrigger).toBeDisabled()
    expect(mealTrigger).not.toHaveFocus()

    resolveUpdate?.()

    await waitFor(() => {
      expect(mealTrigger).toBeEnabled()
      expect(mealTrigger).toHaveFocus()
    })
  })

  it('restores meal trigger focus after cancelling the meal sheet', async () => {
    const user = userEvent.setup()
    mockedApi.today.mockResolvedValue(todayResponse)

    renderToday()

    const mealTrigger = await screen.findByRole('button', { name: '+ Log meal' })
    await user.click(mealTrigger)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(mealTrigger).toHaveFocus())
  })
})
