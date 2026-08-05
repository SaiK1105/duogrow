import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CalendarHeatmap } from './CalendarHeatmap'
import {
  heatmapBand,
  heatmapHeight,
  heatmapPosition,
  heatmapWidth,
  weekdayIndex,
  type HeatmapGeometry,
} from './heatmap-scale'

// step = cellSize + gap = 12, so every expectation below is a whole number.
const geometry: HeatmapGeometry = { cellSize: 10, gap: 2 }

describe('heatmapBand', () => {
  it('gives an unlogged day its own band rather than the lowest ramp step', () => {
    expect(heatmapBand(0)).toBe(0)
    expect(heatmapBand(0.01)).toBe(1)
  })

  it('splits the remaining range into quarters', () => {
    expect(heatmapBand(0.24)).toBe(1)
    expect(heatmapBand(0.25)).toBe(2)
    expect(heatmapBand(0.49)).toBe(2)
    expect(heatmapBand(0.5)).toBe(3)
    expect(heatmapBand(0.74)).toBe(3)
    expect(heatmapBand(0.75)).toBe(4)
    expect(heatmapBand(1)).toBe(4)
  })
})

describe('heatmapPosition', () => {
  it('offsets the first day by its weekday within the first column', () => {
    expect(heatmapPosition(0, 3, geometry)).toEqual({ x: 0, y: 36 })
  })

  it('starts a new column once the week rolls over', () => {
    expect(heatmapPosition(3, 3, geometry)).toEqual({ x: 0, y: 72 })
    expect(heatmapPosition(4, 3, geometry)).toEqual({ x: 12, y: 0 })
  })

  it('walks down the rows of a column in order', () => {
    expect(heatmapPosition(5, 3, geometry)).toEqual({ x: 12, y: 12 })
  })
})

describe('heatmapWidth / heatmapHeight', () => {
  it('covers exactly the columns the days occupy', () => {
    expect(heatmapWidth(10, 3, geometry)).toBe(22)
    expect(heatmapWidth(4, 3, geometry)).toBe(10)
    expect(heatmapWidth(0, 3, geometry)).toBe(0)
  })

  it('is always seven rows tall', () => {
    expect(heatmapHeight(geometry)).toBe(82)
  })
})

describe('weekdayIndex', () => {
  it('reads the weekday from the date fields, not from local time', () => {
    expect(weekdayIndex('2026-07-19')).toBe(0)
    expect(weekdayIndex('2026-07-22')).toBe(3)
  })
})

describe('CalendarHeatmap', () => {
  it('exposes an accessible name and one banded cell per day', () => {
    const { container } = render(
      <CalendarHeatmap
        days={[
          { date: '2026-07-19', value: 0 },
          { date: '2026-07-20', value: 0.8 },
        ]}
        title="Duo completion calendar"
        geometry={geometry}
      />,
    )

    expect(screen.getByRole('img', { name: 'Duo completion calendar' })).toBeInTheDocument()
    const cells = container.querySelectorAll('.heatmap__cell')
    expect(cells).toHaveLength(2)
    expect(cells[0].getAttribute('class')).toContain('heatmap__cell--0')
    expect(cells[1].getAttribute('class')).toContain('heatmap__cell--4')
    // 2026-07-19 is a Sunday, so the first cell sits at the top of column one.
    expect(cells[0].getAttribute('y')).toBe('0')
    expect(cells[1].getAttribute('y')).toBe('12')
  })
})
