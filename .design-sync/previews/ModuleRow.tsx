import { ModuleRow } from 'web'

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

export function Today() {
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
          gap: 6,
        }}
      >
        <ModuleRow
          module="workout"
          label="Workout"
          you={{ value: 'Done', done: true }}
          partner={{ value: 'Done', done: true }}
        />
        <ModuleRow
          module="study"
          label="Study"
          you={{ value: '1.5h', done: false }}
          partner={{ value: '2h', done: true }}
        />
        <ModuleRow
          module="wake"
          label="Wake"
          you={{ value: '6:10a', done: true }}
          partner={{ value: '6:25a', done: true }}
        />
      </div>
    </Frame>
  )
}
