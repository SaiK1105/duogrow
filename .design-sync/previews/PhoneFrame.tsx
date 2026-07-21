import { PhoneFrame } from 'web'

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

export function Dashboard() {
  return (
    <Frame>
      <PhoneFrame>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
            padding: 'var(--space-5)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          <div>
            <p
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--text-caption)',
                color: 'var(--text-tertiary)',
                margin: 0,
              }}
            >
              Tuesday · Day 7
            </p>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-display-md)',
                fontWeight: 600,
                letterSpacing: 'var(--tracking-tight)',
                color: 'var(--text-primary)',
                margin: '4px 0 0',
              }}
            >
              Good morning, Sreya
            </h1>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <span
              style={{
                fontSize: 'var(--text-micro)',
                fontWeight: 700,
                letterSpacing: 'var(--tracking-wide)',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
              }}
            >
              Today with Sai
            </span>
            <p
              style={{
                fontSize: 'var(--text-body)',
                lineHeight: 'var(--leading-normal)',
                color: 'var(--text-secondary)',
                margin: 0,
              }}
            >
              You're at 57% today. One workout proof away from pulling even with{' '}
              <span style={{ color: 'var(--partner-400)', fontWeight: 600 }}>Sai</span>.
            </p>
            <span
              style={{
                alignSelf: 'flex-start',
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-display-lg)',
                fontWeight: 600,
                color: 'var(--accent-500)',
                lineHeight: 'var(--leading-tight)',
              }}
            >
              88
            </span>
          </div>
        </div>
      </PhoneFrame>
    </Frame>
  )
}
