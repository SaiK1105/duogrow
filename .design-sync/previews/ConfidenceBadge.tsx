import { ConfidenceBadge } from 'web'

// The AI-verification confidence pill — one cell per band so the tier colors
// (green / amber / muted) read side by side against the void surface.
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface-void)',
        padding: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
  )
}

export function High() {
  return (
    <Frame>
      <ConfidenceBadge tier="high" percent={96} animated={false} />
    </Frame>
  )
}

export function Medium() {
  return (
    <Frame>
      <ConfidenceBadge tier="medium" percent={72} animated={false} />
    </Frame>
  )
}

export function Low() {
  return (
    <Frame>
      <ConfidenceBadge tier="low" percent={41} animated={false} />
    </Frame>
  )
}
