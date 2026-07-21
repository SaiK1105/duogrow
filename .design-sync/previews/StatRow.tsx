import { StatRow } from 'web'

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

export function Stats() {
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
          gap: 4,
        }}
      >
        <StatRow label="Current streak" value="7 days" sub="personal best" />
        <StatRow label="Growth score" value="86" accent />
        <StatRow label="Proofs verified" value="23" />
        <StatRow label="Days active" value="41" />
      </div>
    </Frame>
  )
}

export function Accent() {
  return (
    <Frame>
      <div
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--surface-border)',
          borderRadius: 16,
          padding: 16,
        }}
      >
        <StatRow label="Growth score" value="86" sub="all-time high" accent />
      </div>
    </Frame>
  )
}
