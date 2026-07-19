import type { ModuleKey, ModuleState } from '../api/types'

export type RowKey = ModuleKey | 'potd'

export interface ModuleMeta {
  key: RowKey
  label: string
  unit: string
}

export const MODULE_ORDER: RowKey[] = ['wake', 'study', 'workout', 'diet', 'tasks', 'potd']

export const MODULE_META: Record<RowKey, ModuleMeta> = {
  wake: { key: 'wake', label: 'Wake', unit: '' },
  study: { key: 'study', label: 'Study', unit: 'h' },
  workout: { key: 'workout', label: 'Workout', unit: '' },
  diet: { key: 'diet', label: 'Diet', unit: ' kcal' },
  tasks: { key: 'tasks', label: 'Tasks', unit: '' },
  potd: { key: 'potd', label: 'POTD', unit: '' },
}

/** Two-letter initials from a display name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** Human value for a module row's You/Partner cell, e.g. "1.5/2h", "4/6". */
export function formatModuleValue(key: RowKey, state: ModuleState | undefined): string {
  if (!state) return '—'
  const meta = MODULE_META[key]

  if (key === 'wake') {
    const detail: unknown = state.detail
    if (typeof detail === 'string' && detail) return detail
    if (
      detail &&
      typeof detail === 'object' &&
      typeof (detail as { time?: unknown }).time === 'string'
    ) {
      return (detail as { time: string }).time
    }
    return state.status === 'done' ? 'Up' : '—'
  }

  if (key === 'workout') {
    return state.status === 'done' ? 'Done' : '—'
  }

  if (key === 'study') {
    // Server reports study in minutes; render as hours.
    const mins = state.value ?? 0
    const targetMins = state.target
    if (mins === 0 && targetMins == null) return state.status === 'done' ? 'Done' : '—'
    const hours = trimNumber(mins / 60)
    return targetMins != null ? `${hours}/${trimNumber(targetMins / 60)}h` : `${hours}h`
  }

  if (state.value != null && state.target != null) {
    return `${trimNumber(state.value)}/${trimNumber(state.target)}${meta.unit}`
  }
  if (state.value != null) {
    return `${trimNumber(state.value)}${meta.unit}`
  }
  return state.status === 'done' ? 'Done' : '—'
}

/** Minutes → "1h 24m" / "45m". */
export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** Minutes → "1:24" clock form for stat rows. */
export function formatClock(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
