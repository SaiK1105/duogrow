import './delta-stat.css'

interface DeltaStatProps {
  label: string
  /** Already-formatted headline value, e.g. "72" or "64%". */
  value: string
  /** Signed change vs the previous period, in the same unit as `value`. */
  delta: number
  /** Unit appended to the delta, e.g. "%" or " pts". */
  deltaUnit?: string
  /** What the comparison is against, e.g. "vs previous 30 days". */
  comparison: string
}

/** Rounded to one decimal, then compared: -0.04 must not render as "-0.0". */
function describeDelta(delta: number, unit: string): { text: string; tone: 'up' | 'down' | 'flat' } {
  const rounded = Math.round(delta * 10) / 10
  if (rounded === 0) return { text: 'no change', tone: 'flat' }
  const sign = rounded > 0 ? '+' : '−'
  return { text: `${sign}${Math.abs(rounded)}${unit}`, tone: rounded > 0 ? 'up' : 'down' }
}

export function DeltaStat({ label, value, delta, deltaUnit = '', comparison }: DeltaStatProps) {
  const { text, tone } = describeDelta(delta, deltaUnit)

  return (
    <article className="delta-stat">
      <span className="delta-stat__label">{label}</span>
      <span className="delta-stat__value">{value}</span>
      <span className={`delta-stat__change delta-stat__change--${tone}`}>
        {text}
        <span className="delta-stat__comparison">{comparison}</span>
      </span>
    </article>
  )
}
