import './screen-state.css'

interface ScreenStateProps {
  title: string
  message?: string
  onRetry: () => void
  retrying?: boolean
}

export function ScreenState({
  title,
  message = "We couldn't load this right now. Please try again.",
  onRetry,
  retrying = false,
}: ScreenStateProps) {
  return (
    <section className="screen-state" role="alert" aria-busy={retrying}>
      <h2 className="screen-state__title">{title}</h2>
      <p className="screen-state__message">{message}</p>
      <button type="button" className="btn btn--outline" onClick={onRetry} disabled={retrying}>
        {retrying ? 'Trying again…' : 'Try again'}
      </button>
    </section>
  )
}
