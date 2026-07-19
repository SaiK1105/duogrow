import './coach-bubble.css'

type CoachMood = 'celebrate' | 'neutral' | 'warn'

interface CoachBubbleProps {
  message: string
  mood?: CoachMood
}

const MOOD_EMOJI: Record<CoachMood, string> = {
  celebrate: '🌱',
  neutral: '🧭',
  warn: '⚡',
}

export function CoachBubble({ message, mood = 'neutral' }: CoachBubbleProps) {
  return (
    <div className={`coach coach--${mood}`}>
      <span className="coach__avatar" aria-hidden="true">
        {MOOD_EMOJI[mood]}
      </span>
      <div className="coach__body">
        <span className="coach__name">Coach</span>
        <p className="coach__message">{message}</p>
      </div>
    </div>
  )
}
