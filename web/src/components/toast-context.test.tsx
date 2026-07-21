import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from './Toast'
import { useToast } from './toast-context'

function ToastTrigger() {
  const { showToast } = useToast()

  return (
    <button type="button" onClick={() => showToast('Saved')}>Show toast</button>
  )
}

describe('useToast', () => {
  it('shares the ToastProvider context with consumer components', async () => {
    const user = userEvent.setup()

    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Show toast' }))

    expect(screen.getByRole('button', { name: 'Saved' })).toBeInTheDocument()
  })
})
