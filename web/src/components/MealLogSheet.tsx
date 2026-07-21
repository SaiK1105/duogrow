import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './meal-log-sheet.css'

interface MealLogSheetProps {
  isOpen: boolean
  initialCalories: number
  onCancel: () => void
  onSubmit: (calories: number) => void
}

const QUICK_ADD_CALORIES = [300, 500, 700]

export function MealLogSheet({
  isOpen,
  initialCalories,
  onCancel,
  onSubmit,
}: MealLogSheetProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [calories, setCalories] = useState(String(initialCalories || ''))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return

    setCalories(String(initialCalories || ''))
    setError('')
    inputRef.current?.focus()
  }, [initialCalories, isOpen])

  if (!isOpen) return null

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsedCalories = Number.parseInt(calories, 10)
    const numericCalories = Number(calories)

    if (
      !Number.isFinite(parsedCalories) ||
      parsedCalories < 1 ||
      !Number.isInteger(numericCalories) ||
      numericCalories !== parsedCalories
    ) {
      setError('Enter a positive number of calories.')
      return
    }

    setError('')
    onSubmit(parsedCalories)
  }

  return (
    <div
      className="meal-log-sheet__backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
    >
      <section
        className="meal-log-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meal-log-sheet-title"
        aria-describedby="meal-log-sheet-description"
      >
        <p className="meal-log-sheet__eyebrow">Daily nutrition</p>
        <h2 id="meal-log-sheet-title" className="meal-log-sheet__title">
          Log a meal
        </h2>
        <p id="meal-log-sheet-description" className="meal-log-sheet__description">
          Add your best estimate for this meal to today&apos;s nutrition total.
        </p>
        <form noValidate onSubmit={submit}>
          <label className="meal-log-sheet__label" htmlFor="meal-calories">
            Calories
          </label>
          <input
            ref={inputRef}
            id="meal-calories"
            className="meal-log-sheet__input"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={calories}
            onChange={(event) => setCalories(event.target.value)}
            aria-describedby={error ? 'meal-calories-error' : undefined}
          />
          {error && (
            <p id="meal-calories-error" className="meal-log-sheet__error" role="alert">
              {error}
            </p>
          )}

          <div className="meal-log-sheet__quick-add" aria-label="Quick add calories">
            {QUICK_ADD_CALORIES.map((amount) => (
              <button
                key={amount}
                className="meal-log-sheet__quick-add-button"
                type="button"
                onClick={() => {
                  setCalories(String(amount))
                  setError('')
                }}
              >
                {amount} calories
              </button>
            ))}
          </div>

          <div className="meal-log-sheet__actions">
            <button className="btn btn--outline meal-log-sheet__button" type="button" onClick={onCancel}>
              Cancel
            </button>
            <button className="btn btn--primary meal-log-sheet__button" type="submit">
              Add meal
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
