import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AiCoachSheet } from './AiCoachSheet'

const settings = {
  personalEnabled: true,
  duoEnabled: true,
  policyVersion: '1',
  mode: 'demo' as const,
  usage: {
    daily_plan: { remaining: 2, estimatedCostCents: 1 },
    duo_reflection: { remaining: 1, estimatedCostCents: 1 },
    potd_tutor: { remaining: 5, estimatedCostCents: 1 },
    chat: { remaining: 10, estimatedCostCents: 1 },
  },
}

describe('AiCoachSheet', () => {
  it('labels the dialog and explains that demo coaching uses aggregate-only context', () => {
    render(<AiCoachSheet isOpen settings={settings} onClose={vi.fn()} />)

    expect(screen.getByRole('dialog')).toHaveAccessibleName('DuoGrow AI coach')
    expect(screen.getByText(/Demo coaching/)).toBeVisible()
    expect(screen.getByText(/aggregate progress and goals only/i)).toBeVisible()
    expect(screen.getByText(/proof media is never shared/i)).toBeVisible()
  })

  it('does not issue a request until personal consent is enabled', async () => {
    const user = userEvent.setup()
    const dailyPlan = vi.fn()
    render(<AiCoachSheet isOpen settings={{ ...settings, personalEnabled: false }} onClose={vi.fn()} client={{ dailyPlan }} />)

    await user.click(screen.getByRole('button', { name: 'Create daily plan' }))

    expect(dailyPlan).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Enable personal AI consent')
  })

  it('shows a polite demo response with usage after a request', async () => {
    const user = userEvent.setup()
    const dailyPlan = vi.fn().mockResolvedValue({ text: 'Start with a 20-minute study block.', mode: 'demo', remaining: 1, estimatedCostCents: 1 })
    render(<AiCoachSheet isOpen settings={settings} onClose={vi.fn()} client={{ dailyPlan }} />)

    await user.click(screen.getByRole('button', { name: 'Create daily plan' }))

    expect(await screen.findByText('Start with a 20-minute study block.')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Demo coaching')
    expect(screen.getByText('1 request remaining today')).toBeVisible()
  })

  it('enforces the 500 character chat limit before requesting', async () => {
    const user = userEvent.setup()
    const chat = vi.fn()
    render(<AiCoachSheet isOpen settings={settings} onClose={vi.fn()} client={{ chat }} />)

    fireEvent.change(screen.getByLabelText('Ask your coach'), { target: { value: 'x'.repeat(501) } })
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    expect(chat).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('500 characters or fewer')
  })

  it('shows quota and retry states after a failed request', async () => {
    const user = userEvent.setup()
    const dailyPlan = vi.fn().mockRejectedValueOnce({ status: 429 }).mockResolvedValueOnce({ text: 'Try a walk.', mode: 'live', remaining: 0, estimatedCostCents: 1 })
    render(<AiCoachSheet isOpen settings={settings} onClose={vi.fn()} client={{ dailyPlan }} />)

    await user.click(screen.getByRole('button', { name: 'Create daily plan' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('daily AI budget')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Try a walk.')).toBeVisible()
  })

  it('explains when Duo Reflection is blocked by missing mutual partner consent', async () => {
    const user = userEvent.setup()
    const duoReflection = vi.fn().mockRejectedValue(new Error('mutual duo consent required'))
    render(<AiCoachSheet isOpen settings={settings} onClose={vi.fn()} client={{ duoReflection }} />)

    await user.click(screen.getByRole('button', { name: 'Duo reflection' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('both partners consent')
  })

  it('supports Escape, backdrop closing, and focus trapping', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<AiCoachSheet isOpen settings={settings} onClose={onClose} />)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
    screen.getByRole('button', { name: 'Send message' }).focus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close AI coach' })).toHaveFocus()
  })

  it('closes on its backdrop and returns focus to the opener', () => {
    const onClose = vi.fn()
    const { rerender } = render(<><button>Open AI</button><AiCoachSheet isOpen={false} settings={settings} onClose={onClose} /></>)
    const opener = screen.getByRole('button', { name: 'Open AI' })
    opener.focus()
    rerender(<><button>Open AI</button><AiCoachSheet isOpen settings={settings} onClose={onClose} /></>)
    fireEvent.click(document.querySelector('.ai-coach-sheet__backdrop')!)
    expect(onClose).toHaveBeenCalledOnce()
    rerender(<><button>Open AI</button><AiCoachSheet isOpen={false} settings={settings} onClose={onClose} /></>)
    expect(opener).toHaveFocus()
  })

  it('makes the application root inert while the modal is open', () => {
    const root = document.createElement('div')
    root.id = 'root'
    document.body.append(root)
    const initiallyInert = root.inert
    const { rerender } = render(<AiCoachSheet isOpen settings={settings} onClose={vi.fn()} />, { container: root })
    expect(root).toHaveProperty('inert', true)
    rerender(<AiCoachSheet isOpen={false} settings={settings} onClose={vi.fn()} />)
    expect(root).toHaveProperty('inert', initiallyInert)
    root.remove()
  })
})
