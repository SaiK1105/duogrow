import { EvidenceChecklist } from 'web'

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

export function HighConfidence() {
  return (
    <Frame>
      <EvidenceChecklist
        band="high"
        items={[
          'Workout app screenshot recognized',
          'Timestamp visible: this morning',
          'Completed session summary detected',
        ]}
      />
    </Frame>
  )
}

export function NeedsReview() {
  return (
    <Frame>
      <EvidenceChecklist
        band="medium"
        items={[
          'Gym photo detected, location unclear',
          'Timestamp readable but not today',
          'Partial session data recognized',
        ]}
      />
    </Frame>
  )
}

export function Rejected() {
  return (
    <Frame>
      <EvidenceChecklist
        band="low"
        items={['Image is too blurry to read', 'No timestamp detected']}
      />
    </Frame>
  )
}
