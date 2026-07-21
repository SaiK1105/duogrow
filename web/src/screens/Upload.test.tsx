import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { ToastProvider } from '../components/Toast'
import { Upload } from './Upload'

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
})

describe('Upload', () => {
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
})
