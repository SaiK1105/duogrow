import { DifficultyPill } from 'web'

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

export function Levels() {
  return (
    <Frame>
      <DifficultyPill level="Easy" />
      <DifficultyPill level="Medium" />
      <DifficultyPill level="Hard" />
    </Frame>
  )
}
