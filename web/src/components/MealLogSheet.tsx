import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import './meal-log-sheet.css'

interface MealLogSheetProps {
  isOpen: boolean
  initialCalories: number
  isSubmitting?: boolean
  onCancel: () => void
  onSubmit: (calories: number) => void
}

const QUICK_ADD_CALORIES = [300, 500, 700]
const FOCUSABLE_SELECTOR = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'

export function MealLogSheet({
  isOpen,
  initialCalories,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: MealLogSheetProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const [calories, setCalories] = useState(String(initialCalories || ''))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return

    setCalories(String(initialCalories || ''))
    setError('')
    inputRef.current?.focus()
  }, [initialCalories, isOpen])

  useEffect(() => {
    if (!isOpen) return

    const appRoot = document.getElementById('root')
    if (!appRoot) return

    const wasInert = appRoot.inert
    appRoot.inert = true

    return () => {
      appRoot.inert = wasInert
    }
  }, [isOpen])

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

  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
      return
    }

    if (event.key !== 'Tab') return

    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      className="meal-log-sheet__backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
      onKeyDown={trapFocus}
    >
      <section
        ref={dialogRef}
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
            aria-invalid={error ? true : undefined}
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
            <button className="btn btn--primary meal-log-sheet__button" type="submit" disabled={isSubmitting}>
              Add meal
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  )
}
