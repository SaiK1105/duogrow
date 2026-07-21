import { VerifiedStamp } from 'web'

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface-void)',
        padding: 28,
        display: 'flex',
        gap: 24,
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}
    >
      {children}
    </div>
  )
}

export function Verified() {
  return (
    <Frame>
      <VerifiedStamp band="high" size={104} />
    </Frame>
  )
}

export function Review() {
  return (
    <Frame>
      <VerifiedStamp band="medium" />
    </Frame>
  )
}

export function Rejected() {
  return (
    <Frame>
      <VerifiedStamp band="low" />
    </Frame>
  )
}
