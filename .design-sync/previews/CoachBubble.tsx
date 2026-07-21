import { CoachBubble } from 'web'

// The AI coach line shown on the dashboard. Text-heavy — one cell per mood so
// the emoji + accent treatment for each tone is visible on the void surface.
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface-void)', padding: 28, maxWidth: 560 }}>
      {children}
    </div>
  )
}

export function Celebrate() {
  return (
    <Frame>
      <CoachBubble
        mood="celebrate"
        message="Seven days straight — you and Sai are both on streak. Consistency beats intensity."
      />
    </Frame>
  )
}

export function Neutral() {
  return (
    <Frame>
      <CoachBubble
        mood="neutral"
        message="You're at 57% today. One workout proof away from pulling even with your partner."
      />
    </Frame>
  )
}

export function Warn() {
  return (
    <Frame>
      <CoachBubble
        mood="warn"
        message="Sai hasn't logged a workout yet today. A quick cheer might be the nudge that keeps the streak alive."
      />
    </Frame>
  )
}
