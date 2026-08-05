/**
 * Scale maths for TrendChart. Kept out of the .tsx so it is unit-testable on
 * its own and so the component file only exports a component.
 */

export interface ChartMargin {
  top: number
  right: number
  bottom: number
  left: number
}

export interface ChartDimensions {
  width: number
  height: number
  margin: ChartMargin
}

export const TREND_DIMENSIONS: ChartDimensions = {
  width: 720,
  height: 260,
  margin: { top: 16, right: 16, bottom: 30, left: 42 },
}

/** x pixel for point `index` of `count`. A lone point sits on the left edge. */
export function trendX(index: number, count: number, dims: ChartDimensions): number {
  const left = dims.margin.left
  const usable = dims.width - dims.margin.left - dims.margin.right
  if (count <= 1) return left
  return left + (usable * index) / (count - 1)
}

/** y pixel for a 0..1 value: 1 maps to the top edge, 0 to the baseline. */
export function trendY(value: number, dims: ChartDimensions): number {
  const top = dims.margin.top
  const usable = dims.height - dims.margin.top - dims.margin.bottom
  const clamped = Math.max(0, Math.min(1, value))
  return top + usable * (1 - clamped)
}

/** Polyline path for one series. Empty input yields '' rather than 'M NaN NaN'. */
export function trendPath(values: number[], dims: ChartDimensions): string {
  if (values.length === 0) return ''
  return values
    .map((value, index) => {
      const x = roundTo2(trendX(index, values.length, dims))
      const y = roundTo2(trendY(value, dims))
      return `${index === 0 ? 'M' : 'L'}${x} ${y}`
    })
    .join(' ')
}

/**
 * Evenly spaced label indices, always including the first and last so the axis
 * is anchored to the real range rather than to an arbitrary stride.
 */
export function tickIndices(count: number, wanted: number): number[] {
  if (count <= 0) return []
  if (count === 1 || wanted <= 1) return [0]
  const stride = Math.max(1, Math.round((count - 1) / Math.min(wanted, count)))
  const picked = new Set<number>()
  for (let i = 0; i < count - 1; i += stride) picked.add(i)
  picked.add(count - 1)
  return [...picked].sort((a, b) => a - b)
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100
}
