import { DuoProgressBar } from 'web'

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

export function Balanced() {
  return (
    <Frame>
      <DuoProgressBar
        duoProgress={43}
        youPercent={57}
        partnerPercent={29}
        youName="Sreya"
        partnerName="Sai"
      />
    </Frame>
  )
}

export function Ahead() {
  return (
    <Frame>
      <DuoProgressBar
        duoProgress={71}
        youPercent={82}
        partnerPercent={60}
        youName="Sreya"
        partnerName="Sai"
      />
    </Frame>
  )
}
