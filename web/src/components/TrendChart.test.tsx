import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrendChart } from './TrendChart'
import { tickIndices, trendPath, trendX, trendY, type ChartDimensions } from './trend-scale'

// Round numbers so every expectation below is an exact, hand-checkable value.
const dims: ChartDimensions = {
  width: 120,
  height: 100,
  margin: { top: 10, right: 20, bottom: 20, left: 20 },
}
// usable width = 120 - 20 - 20 = 80, usable height = 100 - 10 - 20 = 70

describe('trendX', () => {
  it('places the first point on the left margin and the last on the right', () => {
    expect(trendX(0, 5, dims)).toBe(20)
    expect(trendX(4, 5, dims)).toBe(100)
  })

  it('spaces interior points evenly across the usable width', () => {
    expect(trendX(1, 5, dims)).toBe(40)
    expect(trendX(2, 5, dims)).toBe(60)
  })

  it('pins a lone point to the left margin instead of dividing by zero', () => {
    expect(trendX(0, 1, dims)).toBe(20)
  })
})

describe('trendY', () => {
  it('maps 1 to the top margin and 0 to the baseline', () => {
    expect(trendY(1, dims)).toBe(10)
    expect(trendY(0, dims)).toBe(80)
  })

  it('maps the midpoint to the middle of the usable height', () => {
    expect(trendY(0.5, dims)).toBe(45)
  })

  it('clamps values outside 0..1', () => {
    expect(trendY(1.4, dims)).toBe(10)
    expect(trendY(-0.3, dims)).toBe(80)
  })
})

describe('trendPath', () => {
  it('builds a move-then-line path through the scaled points', () => {
    expect(trendPath([1, 0.5, 0], dims)).toBe('M20 10 L60 45 L100 80')
  })

  it('returns an empty path for no values rather than emitting NaN', () => {
    expect(trendPath([], dims)).toBe('')
  })
})

describe('tickIndices', () => {
  it('always includes the first and last index', () => {
    const ticks = tickIndices(30, 6)
    expect(ticks[0]).toBe(0)
    expect(ticks[ticks.length - 1]).toBe(29)
  })

  it('never repeats an index', () => {
    const ticks = tickIndices(7, 6)
    expect(new Set(ticks).size).toBe(ticks.length)
  })

  it('handles a single point', () => {
    expect(tickIndices(1, 6)).toEqual([0])
  })
})

describe('TrendChart', () => {
  it('exposes an accessible name and renders one path per series', () => {
    const { container } = render(
      <TrendChart
        labels={['Jul 1', 'Jul 2', 'Jul 3']}
        series={[
          { label: 'Sai', color: 'green', values: [1, 0.5, 0] },
          { label: 'Ari', color: 'orange', values: [0, 0.5, 1] },
        ]}
        title="Daily completion"
        dimensions={dims}
      />,
    )

    expect(screen.getByRole('img', { name: 'Daily completion' })).toBeInTheDocument()
    const paths = container.querySelectorAll('.trend__line')
    expect(paths).toHaveLength(2)
    // Known input → known geometry, asserted rather than snapshotted.
    expect(paths[0].getAttribute('d')).toBe('M20 10 L60 45 L100 80')
  })

  it('labels each series in the legend', () => {
    render(
      <TrendChart
        labels={['Jul 1']}
        series={[{ label: 'Sai', color: 'green', values: [1] }]}
        title="Daily completion"
        dimensions={dims}
      />,
    )

    expect(screen.getByText('Sai')).toBeInTheDocument()
  })
})
