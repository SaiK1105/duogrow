/**
 * Grid + banding maths for CalendarHeatmap. Kept out of the .tsx so it is
 * unit-testable on its own.
 */

export interface HeatmapGeometry {
  cellSize: number
  gap: number
}

export const HEATMAP_GEOMETRY: HeatmapGeometry = { cellSize: 13, gap: 3 }

export const HEATMAP_ROWS = 7

/** Band 0 is "nothing logged"; 1..4 are increasing completion. */
export type HeatmapBand = 0 | 1 | 2 | 3 | 4

/**
 * Zero is its own band on purpose: an unlogged day must not read as "a bit of
 * progress", which is what a linear ramp starting above zero would suggest.
 */
export function heatmapBand(value: number): HeatmapBand {
  if (!(value > 0)) return 0
  if (value < 0.25) return 1
  if (value < 0.5) return 2
  if (value < 0.75) return 3
  return 4
}

/**
 * Day `index` in a column-per-week grid. `offset` is the weekday (0 = Sunday)
 * of the first day, so week columns line up with real calendar weeks.
 */
export function heatmapPosition(
  index: number,
  offset: number,
  geometry: HeatmapGeometry = HEATMAP_GEOMETRY,
): { x: number; y: number } {
  const slot = index + offset
  const step = geometry.cellSize + geometry.gap
  return {
    x: Math.floor(slot / HEATMAP_ROWS) * step,
    y: (slot % HEATMAP_ROWS) * step,
  }
}

/** Total pixel width needed for `count` days starting at weekday `offset`. */
export function heatmapWidth(
  count: number,
  offset: number,
  geometry: HeatmapGeometry = HEATMAP_GEOMETRY,
): number {
  if (count <= 0) return 0
  const columns = Math.floor((count + offset - 1) / HEATMAP_ROWS) + 1
  return columns * (geometry.cellSize + geometry.gap) - geometry.gap
}

export function heatmapHeight(geometry: HeatmapGeometry = HEATMAP_GEOMETRY): number {
  return HEATMAP_ROWS * (geometry.cellSize + geometry.gap) - geometry.gap
}

/**
 * Weekday index (0 = Sunday) for a `YYYY-MM-DD` string. Parsed field-by-field
 * rather than via `new Date(iso)` so the grid does not shift by a day for
 * users west of UTC.
 */
export function weekdayIndex(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return 0
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}
