import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MealLogSheet } from './MealLogSheet'

describe('MealLogSheet', () => {
  it('exposes its visible calorie estimate description to the dialog', () => {
    render(
      <MealLogSheet isOpen initialCalories={0} onCancel={vi.fn()} onSubmit={vi.fn()} />,
    )

    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      'Add your best estimate for this meal to today\'s nutrition total.',
    )
  })

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
    expect(calories).toHaveAttribute('aria-invalid', 'true')
  })

  it('rejects a fractional calorie value without submitting it', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <MealLogSheet isOpen initialCalories={300} onCancel={vi.fn()} onSubmit={onSubmit} />,
    )

    const calories = screen.getByLabelText('Calories')
    await user.clear(calories)
    await user.type(calories, '700.5')
    await user.click(screen.getByRole('button', { name: 'Add meal' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a positive number of calories.')
    expect(onSubmit).not.toHaveBeenCalled()
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

  it('disables confirmation while its parent is submitting', () => {
    render(
      <MealLogSheet isOpen initialCalories={300} isSubmitting onCancel={vi.fn()} onSubmit={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: 'Add meal' })).toBeDisabled()
  })

  it('focuses the Calories input after opening', () => {
    render(
      <MealLogSheet isOpen initialCalories={0} onCancel={vi.fn()} onSubmit={vi.fn()} />,
    )

    expect(screen.getByLabelText('Calories')).toHaveFocus()
  })

  it('cycles Tab and Shift+Tab through its enabled controls', async () => {
    const user = userEvent.setup()

    render(
      <MealLogSheet isOpen initialCalories={0} onCancel={vi.fn()} onSubmit={vi.fn()} />,
    )

    const calories = screen.getByLabelText('Calories')
    const quickAdd300 = screen.getByRole('button', { name: '300 calories' })
    const quickAdd500 = screen.getByRole('button', { name: '500 calories' })
    const quickAdd700 = screen.getByRole('button', { name: '700 calories' })
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const addMeal = screen.getByRole('button', { name: 'Add meal' })

    expect(calories).toHaveFocus()
    await user.tab()
    expect(quickAdd300).toHaveFocus()
    await user.tab()
    expect(quickAdd500).toHaveFocus()
    await user.tab()
    expect(quickAdd700).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
    await user.tab()
    expect(addMeal).toHaveFocus()
    await user.tab()
    expect(calories).toHaveFocus()
    await user.tab({ shift: true })
    expect(addMeal).toHaveFocus()
  })

  it('calls onCancel when Escape is pressed', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <MealLogSheet isOpen initialCalories={0} onCancel={onCancel} onSubmit={vi.fn()} />,
    )

    await user.keyboard('{Escape}')

    expect(onCancel).toHaveBeenCalledOnce()
  })
})
