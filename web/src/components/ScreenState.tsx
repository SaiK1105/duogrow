import './screen-state.css'

interface ScreenStateProps {
  title: string
  message?: string
  onRetry: () => void
}

export function ScreenState({
  title,
  message = "We couldn't load this right now. Please try again.",
  onRetry,
}: ScreenStateProps) {
  return (
    <section className="screen-state" role="alert">
      <h2 className="screen-state__title">{title}</h2>
      <p className="screen-state__message">{message}</p>
      <button type="button" className="btn btn--outline" onClick={onRetry}>
        Try again
      </button>
    </section>
  )
}
