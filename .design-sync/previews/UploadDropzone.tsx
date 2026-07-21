import { UploadDropzone } from 'web'

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
      <div style={{ width: 420 }}>
        <UploadDropzone
          onFile={() => {}}
          hint="Drop a workout screenshot or tap to browse"
        />
      </div>
    </Frame>
  )
}
