import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MealLogSheet } from './MealLogSheet'

describe('MealLogSheet', () => {
  it('submits the selected 700-calorie quick-add amount', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <MealLogSheet isOpen initialCalories={0} onCancel={vi.fn()} onSubmit={onSubmit} />,
    )

    await user.click(screen.getByRole('button', { name: '700 calories' }))
    await user.click(screen.getByRole('button', { name: 'Add meal' }))

    expect(onSubmit).toHaveBeenCalledWith(700)
  })

  it('shows an alert when the entered calories are zero', async () => {
    const user = userEvent.setup()

    render(
      <MealLogSheet isOpen initialCalories={300} onCancel={vi.fn()} onSubmit={vi.fn()} />,
    )

    const calories = screen.getByLabelText('Calories')
    await user.clear(calories)
    await user.type(calories, '0')
    await user.click(screen.getByRole('button', { name: 'Add meal' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a positive number of calories.')
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <MealLogSheet isOpen initialCalories={0} onCancel={onCancel} onSubmit={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('focuses the Calories input after opening', () => {
    render(
      <MealLogSheet isOpen initialCalories={0} onCancel={vi.fn()} onSubmit={vi.fn()} />,
    )

    expect(screen.getByLabelText('Calories')).toHaveFocus()
  })
})
