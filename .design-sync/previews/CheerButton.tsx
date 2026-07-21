import { CheerButton } from 'web'

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

export function Default() {
  return (
    <Frame>
      <CheerButton onCheer={() => {}} />
    </Frame>
  )
}

export function Custom() {
  return (
    <Frame>
      <CheerButton onCheer={() => {}} label="Send encouragement" />
    </Frame>
  )
}
