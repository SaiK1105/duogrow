import { StreakFlame } from 'web'

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

export function OnStreak() {
  return (
    <Frame>
      <StreakFlame count={7} />
    </Frame>
  )
}

export function Milestone() {
  return (
    <Frame>
      <StreakFlame count={30} size={40} />
    </Frame>
  )
}

export function Broken() {
  return (
    <Frame>
      <StreakFlame count={0} active={false} />
    </Frame>
  )
}
