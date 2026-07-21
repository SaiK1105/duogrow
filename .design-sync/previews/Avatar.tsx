import { Avatar } from 'web'

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface-void)',
        padding: 28,
        display: 'flex',
        gap: 20,
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}
    >
      {children}
    </div>
  )
}

export function Duo() {
  return (
    <Frame>
      <Avatar name="Sreya" tone="you" ring />
      <Avatar name="Sai" tone="partner" ring />
    </Frame>
  )
}

export function Sizes() {
  return (
    <Frame>
      <Avatar name="Sreya" tone="you" size={28} />
      <Avatar name="Sreya" tone="you" size={40} />
      <Avatar name="Sreya" tone="you" size={56} />
    </Frame>
  )
}

export function Neutral() {
  return (
    <Frame>
      <Avatar name="Coach" tone="neutral" />
    </Frame>
  )
}
