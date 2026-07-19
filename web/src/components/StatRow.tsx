import './stat-row.css'

interface StatRowProps {
  label: string
  value: string
  sub?: string
  accent?: boolean
}

export function StatRow({ label, value, sub, accent = false }: StatRowProps) {
  return (
    <div className="stat-row">
      <span className="stat-row__label">{label}</span>
      <span className="stat-row__values">
        <span className={`stat-row__value ${accent ? 'stat-row__value--accent' : ''}`}>
          {value}
        </span>
        {sub && <span className="stat-row__sub">{sub}</span>}
      </span>
    </div>
  )
}
