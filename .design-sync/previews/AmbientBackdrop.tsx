import { AmbientBackdrop } from 'web'

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

export function Backdrop() {
  return (
    <Frame>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 420,
          height: 260,
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        <AmbientBackdrop />
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--text-caption)',
            letterSpacing: 'var(--tracking-wide)',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
          }}
        >
          Ambient backdrop
        </span>
      </div>
    </Frame>
  )
}
