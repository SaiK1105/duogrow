import { ProgressRing } from 'web'

// Night Terrarium is a dark design system — preview cards render on a white
// body by default, so every cell sits on the app's own void surface.
function Frame({ children, pad = 28 }: { children: React.ReactNode; pad?: number }) {
  return (
    <div
      style={{
        background: 'var(--surface-void)',
        padding: pad,
        display: 'flex',
        gap: 32,
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}
    >
      {children}
    </div>
  )
}

export function Growth() {
  return (
    <Frame>
      <ProgressRing value={86} label="Growth" suffix="" />
    </Frame>
  )
}

export function DuoSplit() {
  return (
    <Frame>
      <ProgressRing value={57} max={100} size={120} label="You" suffix="%" />
      <ProgressRing
        value={43}
        max={100}
        size={120}
        label="Partner"
        suffix="%"
        color="var(--partner-400)"
      />
    </Frame>
  )
}

export function Compact() {
  return (
    <Frame>
      <ProgressRing value={9} max={10} size={96} strokeWidth={9} label="Streak" />
    </Frame>
  )
}
