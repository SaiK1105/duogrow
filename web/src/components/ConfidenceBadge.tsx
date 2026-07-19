import type { Band } from '../api/types'
import { useCountUp } from '../hooks/useCountUp'
import './confidence-badge.css'

interface ConfidenceBadgeProps {
  tier: Band
  percent: number
  animated?: boolean
}

const LABELS: Record<Band, string> = {
  high: 'Confidence',
  medium: 'Needs Confirmation',
  low: 'Low Confidence',
}

export function ConfidenceBadge({ tier, percent, animated = true }: ConfidenceBadgeProps) {
  const shown = useCountUp(animated ? percent : percent, animated ? 900 : 0, 300)
  return (
    <span className={`conf-badge conf-badge--${tier}`}>
      <span className="conf-badge__dot" />
      <span className="conf-badge__pct">{Math.round(shown)}%</span>
      <span className="conf-badge__label">{LABELS[tier]}</span>
    </span>
  )
}
