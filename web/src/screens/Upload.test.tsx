import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { ProofResponse } from '../api/types'
import { ToastProvider } from '../components/Toast'
import { Upload } from './Upload'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../api/client', () => ({
  api: {
    listProofs: vi.fn(),
    uploadProof: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api)

function renderUpload() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Upload />
      </ToastProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('Upload', () => {
  beforeEach(() => {
    mockedApi.listProofs.mockResolvedValue({ proofs: [] })
  })

  it('keeps the recent-proofs recovery visible while a retry is pending', async () => {
    const user = userEvent.setup()
    let resolveRetry: ((value: { proofs: [] }) => void) | undefined
    const pendingRetry = new Promise<{ proofs: [] }>((resolve) => {
      resolveRetry = resolve
    })
    mockedApi.listProofs.mockRejectedValueOnce(new Error('Unavailable')).mockReturnValueOnce(pendingRetry)

    renderUpload()

    const recovery = await screen.findByRole('alert')
    expect(recovery).toHaveTextContent('Recent proofs are unavailable')
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(mockedApi.listProofs).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('alert')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Trying again…' })).toBeDisabled()

    resolveRetry?.({ proofs: [] })
  })

  it('submits a selected proof only once while AI analysis is pending', async () => {
    const user = userEvent.setup()
    let resolveUpload: ((value: ProofResponse) => void) | undefined
    const pendingUpload = new Promise<ProofResponse>((resolve) => {
      resolveUpload = resolve
    })
    mockedApi.uploadProof.mockReturnValueOnce(pendingUpload)

    const { container } = renderUpload()
    const file = new File(['proof'], 'proof.png', { type: 'image/png' })
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    expect(input).not.toBeNull()
    fireEvent.change(input!, { target: { files: [file] } })

    const verify = screen.getByRole('button', { name: 'Verify with AI' })
    await user.click(verify)
    await user.click(verify)

    expect(verify).toBeDisabled()
    expect(mockedApi.uploadProof).toHaveBeenCalledTimes(1)

    expect(resolveUpload).toBeDefined()
  })

  it('does not navigate when an upload resolves after Upload unmounts', async () => {
    vi.useFakeTimers()
    let resolveUpload: ((value: ProofResponse) => void) | undefined
    mockedApi.uploadProof.mockReturnValueOnce(
      new Promise<ProofResponse>((resolve) => {
        resolveUpload = resolve
      }),
    )

    const { container, unmount } = renderUpload()
    const file = new File(['proof'], 'proof.png', { type: 'image/png' })
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    expect(input).not.toBeNull()
    fireEvent.change(input!, { target: { files: [file] } })

    fireEvent.click(screen.getByRole('button', { name: 'Verify with AI' }))
    unmount()
    resolveUpload?.({ proof: { id: 'proof-1' } } as ProofResponse)
    await act(async () => {
      await Promise.resolve()
    })
    await vi.advanceTimersByTimeAsync(1800)

    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
