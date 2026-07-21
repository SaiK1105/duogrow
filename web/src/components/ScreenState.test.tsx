import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ScreenState } from './ScreenState'

describe('ScreenState', () => {
  it('announces its title and retries once', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()

    render(<ScreenState title="Insights are unavailable" onRetry={onRetry} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Insights are unavailable')

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
