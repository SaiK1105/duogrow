import {
  HEATMAP_GEOMETRY,
  heatmapBand,
  heatmapHeight,
  heatmapPosition,
  heatmapWidth,
  weekdayIndex,
  type HeatmapGeometry,
} from './heatmap-scale'
import './calendar-heatmap.css'

export interface HeatmapDay {
  /** `YYYY-MM-DD`. */
  date: string
  /** Completion in 0..1. */
  value: number
}

interface CalendarHeatmapProps {
  days: HeatmapDay[]
  /** Accessible name for the grid image. */
  title: string
  geometry?: HeatmapGeometry
}

const BAND_LABELS = ['nothing logged', 'under a quarter', 'under half', 'under three quarters', 'most of the day']

/**
 * Day grid, one column per calendar week. Derived entirely from the daily
 * series the dashboard already has — there is no separate heatmap endpoint.
 */
export function CalendarHeatmap({ days, title, geometry = HEATMAP_GEOMETRY }: CalendarHeatmapProps) {
  const offset = days.length > 0 ? weekdayIndex(days[0].date) : 0
  const width = heatmapWidth(days.length, offset, geometry)
  const height = heatmapHeight(geometry)

  return (
    <figure className="heatmap">
      <svg
        className="heatmap__svg"
        viewBox={`0 0 ${Math.max(width, 1)} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={title}
      >
        {days.map((day, index) => {
          const { x, y } = heatmapPosition(index, offset, geometry)
          const band = heatmapBand(day.value)
          return (
            <rect
              key={day.date}
              className={`heatmap__cell heatmap__cell--${band}`}
              x={x}
              y={y}
              width={geometry.cellSize}
              height={geometry.cellSize}
              rx={3}
            >
              <title>{`${day.date}: ${Math.round(day.value * 100)}% complete`}</title>
            </rect>
          )
        })}
      </svg>
      <figcaption className="heatmap__legend">
        <span className="heatmap__legend-label">Less</span>
        {BAND_LABELS.map((label, band) => (
          <span key={label} className={`heatmap__key heatmap__cell--${band}`} title={label} aria-hidden="true" />
        ))}
        <span className="heatmap__legend-label">More</span>
      </figcaption>
    </figure>
  )
}
