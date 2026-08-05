import { TREND_DIMENSIONS, tickIndices, trendPath, trendX, trendY, type ChartDimensions } from './trend-scale'
import './trend-chart.css'

export interface TrendSeries {
  label: string
  color: string
  /** Values in 0..1, one per x tick, parallel to `labels`. */
  values: number[]
}

interface TrendChartProps {
  labels: string[]
  series: TrendSeries[]
  /** Accessible name for the chart image. */
  title: string
  description?: string
  dimensions?: ChartDimensions
  /** Approximate number of x-axis labels; first and last are always kept. */
  tickCount?: number
}

const Y_TICKS = [0, 0.25, 0.5, 0.75, 1]

/**
 * Hand-rolled SVG line chart. It knows nothing about the DuoGrow API — plain
 * numbers in, pixels out — so the same component serves any 0..1 daily series.
 */
export function TrendChart({
  labels,
  series,
  title,
  description,
  dimensions = TREND_DIMENSIONS,
  tickCount = 6,
}: TrendChartProps) {
  const baseline = trendY(0, dimensions)
  const ticks = tickIndices(labels.length, tickCount)

  return (
    <figure className="trend">
      <svg
        className="trend__svg"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        role="img"
        aria-label={title}
      >
        {Y_TICKS.map((tick) => (
          <g key={tick}>
            <line
              className="trend__grid"
              x1={dimensions.margin.left}
              x2={dimensions.width - dimensions.margin.right}
              y1={trendY(tick, dimensions)}
              y2={trendY(tick, dimensions)}
            />
            <text
              className="trend__axis-text"
              x={dimensions.margin.left - 8}
              y={trendY(tick, dimensions) + 4}
              textAnchor="end"
            >
              {Math.round(tick * 100)}%
            </text>
          </g>
        ))}

        {series.map((line) => (
          <path
            key={line.label}
            className="trend__line"
            d={trendPath(line.values, dimensions)}
            fill="none"
            stroke={line.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {ticks.map((index) => (
          <text
            key={labels[index] ?? index}
            className="trend__axis-text"
            x={trendX(index, labels.length, dimensions)}
            y={baseline + 20}
            textAnchor="middle"
          >
            {labels[index]}
          </text>
        ))}
      </svg>

      <figcaption className="trend__legend">
        {series.map((line) => (
          <span key={line.label} className="trend__legend-item">
            <span className="trend__swatch" style={{ background: line.color }} aria-hidden="true" />
            {line.label}
          </span>
        ))}
      </figcaption>
      {description && <p className="trend__description">{description}</p>}
    </figure>
  )
}
