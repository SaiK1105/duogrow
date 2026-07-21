import { SubscoreBar } from 'web'

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface-void)',
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth: 440,
      }}
    >
      {children}
    </div>
  )
}

export function Breakdown() {
  return (
    <Frame>
      <div
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--surface-border)',
          borderRadius: 16,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <SubscoreBar label="Discipline" value={85} delayMs={0} />
        <SubscoreBar label="Mind" value={73} delayMs={80} />
        <SubscoreBar label="Health" value={86} delayMs={160} />
        <SubscoreBar
          label="Consistency"
          value={100}
          color="var(--partner-400)"
          delayMs={240}
        />
      </div>
    </Frame>
  )
}

export function Single() {
  return (
    <Frame>
      <SubscoreBar label="Discipline" value={85} />
    </Frame>
  )
}
