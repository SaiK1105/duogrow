import './module-comparison.css'

export interface ComparisonBar {
  label: string
  color: string
  /** 0..1. */
  value: number
  /** Optional secondary text, e.g. "18 days done". */
  detail?: string
}

export interface ComparisonGroup {
  label: string
  bars: ComparisonBar[]
}

interface ModuleComparisonProps {
  groups: ComparisonGroup[]
  /** Accessible name for the whole comparison. */
  title: string
}

/**
 * Grouped horizontal bars. Plain data in — no API types — so the same component
 * can compare any set of 0..1 values across any set of labelled series.
 */
export function ModuleComparison({ groups, title }: ModuleComparisonProps) {
  return (
    <div className="modcmp" role="group" aria-label={title}>
      {groups.map((group) => (
        <div key={group.label} className="modcmp__group">
          <span className="modcmp__group-label">{group.label}</span>
          <div className="modcmp__bars">
            {group.bars.map((bar) => (
              <div key={bar.label} className="modcmp__row">
                <span className="modcmp__bar-label">{bar.label}</span>
                <div
                  className="modcmp__track"
                  role="meter"
                  aria-label={`${group.label} — ${bar.label}`}
                  aria-valuenow={Math.round(bar.value * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuetext={`${Math.round(bar.value * 100)}%`}
                >
                  <span
                    className="modcmp__fill"
                    style={{
                      width: `${Math.max(0, Math.min(1, bar.value)) * 100}%`,
                      background: bar.color,
                    }}
                  />
                </div>
                <span className="modcmp__value">
                  {Math.round(bar.value * 100)}%
                  {bar.detail && <span className="modcmp__detail">{bar.detail}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
